import { useMemo, useRef, useState } from 'react';
import {
	Alert,
	Animated,
	LayoutAnimation,
	Modal,
	PanResponder,
	Platform,
	RefreshControl,
	SectionList,
	StyleSheet,
	TouchableOpacity,
	UIManager,
	useWindowDimensions,
	View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Toast } from 'react-native-toast-message/lib/src/Toast';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage, TransactionUtils } from '@myfinance/shared';
import { useNavigation } from '@react-navigation/native';

import { useIndexAccounts } from '../../../hooks/api/accounts/useIndexAccounts';
import { useIndexCreditBalances } from '../../../hooks/api/credit-balances/useIndexCreditBalances';
import { useDeleteTransactions } from '../../../hooks/api/transactions/useDeleteTransactions';
import { useListTransactions } from '../../../hooks/api/transactions/useListTransactions';
import { useUpdateTransactions } from '../../../hooks/api/transactions/useUpdateTransactions';

import { useMonthSelection } from '../../../context/monthSelection';
import { useNewTransactionDialog } from '../../../context/newTransactionDialog';
import { useRefresh } from '../../../context/refresh';
import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';
import { DateUtils } from '../../../utils/date';
import { MoneyUtils } from '../../../utils/money';

import { TTransactionGroup } from '../../../types/api';
import { TTransaction } from '../../../types/models';

import MonthYearSelector from '../../atoms/MonthYearSelector';
import Skeleton from '../../atoms/Skeleton';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

import { QUERY_KEYS } from '../../../constants/QueryKeys';
import { TransactionDuplicateModal } from '../TransactionDuplicateModal';
import { TransactionFormModal } from '../TransactionFormModal';

/* LayoutAnimation precisa ser habilitado explicitamente no Android pra animar o abrir/fechar dos accordions. */
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MONTHS_LOWER = [
	'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
	'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

type TDayGroup = {
	title: string;
	data: TTransaction[];
};

/* Uma seção de cartão: todas as transações de crédito de uma mesma origem (`source_id`). */
type TCreditSection = { id: string; name: string; items: TTransaction[] };

const pad2 = (n: number) => String(n).padStart(2, '0');

/* Conversão só-data (sem Date) pro calendário de "Efetivar pagamento" — o horário fica no input mascarado. */
const toISODate = (display_date: string) => {
	const [ day, month, year ] = display_date.split('/');
	if (!day || !month || !year) return '';
	return `${ year }-${ month }-${ day }`;
};

const toDisplayDate = (iso_date: string) => {
	const [ year, month, day ] = iso_date.split('-');
	return `${ day }/${ month }/${ year }`;
};

/* Máscara "HH:MM": só dígitos, dois-pontos após 2 casas. */
const formatTimeInput = (text: string) => {
	const numbers = text.replace(/\D/g, '').slice(0, 4);
	if (numbers.length <= 2) return numbers;
	return `${ numbers.slice(0, 2) }:${ numbers.slice(2) }`;
};

const isValidTime = (time: string) => {
	const match = /^(\d{2}):(\d{2})$/.exec(time);
	if (!match) return false;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

/**
 * Combina "dd/MM/yyyy" + "HH:MM" numa string ISO via Date LOCAL + toISOString() — mesmo caminho do web,
 * pro instante efetivado bater com o horário escolhido na tela.
 */
const combineToISO = (display_date: string, time: string) => {
	const [ day, month, year ] = display_date.split('/').map(Number);
	if (!day || !month || !year) return '';
	const [ hours, minutes ] = time.split(':').map(Number);
	const date = new Date(year, month - 1, day, Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
	return date.toISOString();
};

/* Data/horário atuais nas partes de tela (dd/MM/yyyy + HH:MM), no fuso local. */
const nowParts = () => {
	const date = new Date();
	return {
		date: `${ pad2(date.getDate()) }/${ pad2(date.getMonth() + 1) }/${ date.getFullYear() }`,
		time: `${ pad2(date.getHours()) }:${ pad2(date.getMinutes()) }`,
	};
};

/*
 * Resumo do card de total — SEMPRE das contas (`accounts`), o único fluxo de caixa real (combinar
 * crédito duplicaria a saída: o pagamento da fatura já é um `withdraw` em `accounts`). Efetivado/previsto
 * vêm PRONTOS do backend (`total_settled`/`total_projected` do grupo) — não recalculamos. Só o split
 * entradas/saídas e a contagem de pendentes saem da lista no cliente (o backend não os devolve).
 */
const buildSummary = (group?: TTransactionGroup) => {
	const non_draft = (group?.data || []).filter((item) => !item.draft);

	const deposit = non_draft.filter((i) => i.kind === 'deposit').reduce((acc, i) => acc + i.value, 0);
	const withdraw = non_draft.filter((i) => i.kind === 'withdraw').reduce((acc, i) => acc + i.value, 0);
	const settled = group?.total_settled ?? 0;
	const projected = group?.total_projected ?? 0;
	const pending = non_draft.filter((i) => !i.settled).length;

	return { deposit, withdraw, settled, projected, gap: projected !== settled, pending };
};

/* Saldo líquido (entradas - saídas) de uma seção, ignorando rascunhos — usado no subtotal do cartão. */
const sectionNet = (items: TTransaction[]) =>
	items
		.filter((item) => !item.draft)
		.reduce((acc, item) => acc + (item.kind === 'deposit' ? item.value : -item.value), 0);

const isSameDay = (a: Date, b: Date) => (
	a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
);

const getGroupLabel = (date: Date) => {
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);

	if (isSameDay(date, today)) return 'Hoje';
	if (isSameDay(date, yesterday)) return 'Ontem';
	return `${ date.getDate() } de ${ MONTHS_LOWER[date.getMonth()] }`;
};

const groupTransactionsByDay = (transactions: TTransaction[]): TDayGroup[] => {
	const groups = new Map<string, TDayGroup>();

	transactions.forEach((transaction_item) => {
		const date = new Date(TransactionUtils.effectiveDate(transaction_item));
		const key = `${ date.getFullYear() }-${ date.getMonth() }-${ date.getDate() }`;

		if (!groups.has(key)) {
			groups.set(key, { title: getGroupLabel(date), data: [] });
		}
		groups.get(key)!.data.push(transaction_item);
	});

	return Array.from(groups.values());
};

/**
 * Fora do componente de propósito — como prop de componente (ItemSeparatorComponent/
 * SectionSeparatorComponent), uma arrow function definida dentro do render vira uma
 * referência nova a cada renderização, o que o react/no-unstable-nested-components acusa.
 */
const ItemSeparator = () => <ThemedView style={styles.transactionSeparator} />;
const SectionSeparator = () => <ThemedView style={styles.sectionSeparator} />;

const TransactionsList = () => {
	const { theme, mode } = useTheme();
	const card_surface = mode === 'dark' ? '#121214' : '#ffffff';
	/* Fundo distinto do corpo do accordion, pra separar visualmente o grupo do cartão dos cards de conta. */
	const accordion_body_bg = mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9';
	const { user_wallet } = useWallet();
	const navigation = useNavigation<{ navigate(route: string): void }>();
	const { is_open: is_new_transaction_open, setIsOpen: setIsNewTransactionOpen } = useNewTransactionDialog();

	const { month_year_selector_values, setMonthYearSelectorValues } = useMonthSelection();

	/* Mês de referência no formato YYYY-MM (mês é 0-indexado no contexto, +1 pro calendário). */
	const reference = `${ month_year_selector_values.year }-${ String(month_year_selector_values.month + 1).padStart(2, '0') }`;

	/*
	 * `enabled` amarrado à presença do `wallet_id`: sem isso, a query dispara com `wallet_id: ''`
	 * enquanto a carteira ainda está carregando (o fallback `|| ''` NÃO segura a requisição, só
	 * troca o valor), e o backend responde 422 "Carteira não encontrada".
	 */
	const wallet_id = user_wallet.data?.id;

	const { data: data_transactions, isLoading: is_data_transactions_loading } = useListTransactions({
		enabled: Boolean(wallet_id),
		params: {
			wallet_id: wallet_id || '',
			reference,
		},
	});

	/* Contas/créditos: resolvem o nome da origem por linha, ordenam os cartões e guiam os empty-states. */
	const { data: accounts_data } = useIndexAccounts({ enabled: Boolean(wallet_id), params: { wallet_id: wallet_id || '' } });
	const { data: credit_balances_data } = useIndexCreditBalances({ enabled: Boolean(wallet_id), params: { wallet_id: wallet_id || '' } });

	const accounts = useMemo(() => accounts_data?.data || [], [ accounts_data ]);
	const credit_balances = useMemo(() => credit_balances_data?.data || [], [ credit_balances_data ]);

	const source_names = useMemo(() => {
		const map = new Map<string, string>();
		accounts.forEach((account) => map.set(account.id, account.name));
		credit_balances.forEach((credit_balance) => map.set(credit_balance.id, credit_balance.name));
		return map;
	}, [ accounts, credit_balances ]);

	const [ transaction, setTransaction ] = useState<TTransaction | null>(null);
	const [ duplicating_transaction, setDuplicatingTransaction ] = useState<TTransaction | null>(null);
	const [ actions_transaction, setActionsTransaction ] = useState<TTransaction | null>(null);
	const [ is_totals_detail_open, setIsTotalsDetailOpen ] = useState(false);
	/* IDs de cartão expandidos (fora do Set = fechado — accordions nascem fechados). */
	const [ expanded, setExpanded ] = useState<Set<string>>(new Set());
	/* Transação sendo efetivada no modal "Efetivar pagamento" + a data/hora escolhida. */
	const [ settling_transaction, setSettlingTransaction ] = useState<TTransaction | null>(null);
	const [ settle_date, setSettleDate ] = useState('');
	const [ settle_time, setSettleTime ] = useState('');

	const { mutate: updateTransaction, isPending: is_settle_pending } = useUpdateTransactions();

	/* Abre o modal de "Efetivar pagamento" com a data/hora pré-preenchida no momento atual. */
	const openSettle = (transaction_item: TTransaction) => {
		const now = nowParts();
		setSettleDate(now.date);
		setSettleTime(now.time);
		setSettlingTransaction(transaction_item);
	};

	/* Efetiva via UPDATE mandando só o `settled_date` (não usa mais o endpoint /settle). */
	const handleConfirmSettle = () => {
		if (!settling_transaction) return;

		updateTransaction({
			id: settling_transaction.id,
			body: { settled_date: combineToISO(settle_date, settle_time) },
			onSuccess: () => {
				Toast.show({ type: 'success', text1: 'Pagamento efetivado' });
				setSettlingTransaction(null);
			},
			onError: (error) => Toast.show({ type: 'error', text1: 'Não foi possível efetivar', text2: getApiErrorMessage(error, 'Tente novamente') }),
		});
	};

	/* Desfazer também é só um UPDATE (`settled_date: null` = volta pra pendente) — sem endpoint /unsettle. */
	const handleUnsettle = (transaction_item: TTransaction) => {
		updateTransaction({
			id: transaction_item.id,
			body: { settled_date: null },
			onSuccess: () => Toast.show({ type: 'success', text1: 'Efetivação desfeita' }),
			onError: (error) => Toast.show({ type: 'error', text1: 'Não foi possível desfazer', text2: getApiErrorMessage(error, 'Tente novamente') }),
		});
	};

	const { refreshControlProps } = useRefresh({
		keys: [
			QUERY_KEYS.transaction.get_all,
		],
	});

	const { mutate: deleteTransaction } = useDeleteTransactions();

	const { width: screen_width } = useWindowDimensions();
	const translate_x = useRef(new Animated.Value(0)).current;

	/*
	 * Forma funcional do setState de propósito — `changeMonth` é chamado de dentro do `pan_responder`
	 * (criado uma única vez via `useRef`), cujos callbacks ficam "congelados" com as closures do primeiro
	 * render. Lendo `month_year_selector_values` direto sempre pegaria o mês de quando o gesto foi montado,
	 * nunca o atual. `prev` sempre reflete o estado mais recente de verdade.
	 */
	const changeMonth = (offset: number) => {
		setMonthYearSelectorValues((prev) => {
			const date = new Date(prev.year, prev.month + offset, 1);
			return { month: date.getMonth(), year: date.getFullYear() };
		});
	};

	/*
	 * Desliza o conteúdo atual pra fora (na direção do dedo), troca o mês fora da tela e traz o conteúdo
	 * novo do lado oposto — efeito de "página". `useNativeDriver: false` em tudo que mexe em `translate_x`
	 * (a RN não deixa misturar driver nativo e JS no mesmo Animated.Value, e o arrasto precisa ler `dx` em JS).
	 */
	const animateMonthChange = (offset: number, exits_to_right: boolean) => {
		const exit_value = exits_to_right ? screen_width : -screen_width;

		Animated.timing(translate_x, {
			toValue: exit_value,
			duration: 180,
			useNativeDriver: false,
		}).start(() => {
			changeMonth(offset);
			translate_x.setValue(-exit_value);
			Animated.timing(translate_x, {
				toValue: 0,
				duration: 220,
				useNativeDriver: false,
			}).start();
		});
	};

	/*
	 * Trocar de mês arrastando a lista — só assume o gesto quando o arrasto é claramente mais horizontal
	 * que vertical (2x), pra não competir com o scroll vertical da SectionList por baixo.
	 */
	const pan_responder = useRef(
		PanResponder.create({
			onMoveShouldSetPanResponder: (_, gesture) => (
				Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2
			),
			onPanResponderMove: Animated.event(
				[ null, { dx: translate_x } ],
				{ useNativeDriver: false },
			),
			onPanResponderRelease: (_, gesture) => {
				if (gesture.dx > 60) {
					animateMonthChange(-1, true);
				} else if (gesture.dx < -60) {
					animateMonthChange(1, false);
				} else {
					Animated.timing(translate_x, { toValue: 0, duration: 150, useNativeDriver: false }).start();
				}
			},
			onPanResponderTerminate: () => {
				Animated.timing(translate_x, { toValue: 0, duration: 150, useNativeDriver: false }).start();
			},
		}),
	).current;

	/*
	 * O backend já separa em `accounts` (bucket mês-calendário) e `credits` (bucket ciclo da fatura).
	 * Home numa tela só (sem abas): contas ficam soltas (agrupadas por dia) e créditos viram accordions
	 * colapsáveis por cartão. O card de total é SÓ das contas (fluxo de caixa real).
	 */
	const accounts_group = data_transactions?.accounts;
	const credits_group = data_transactions?.credits;

	const account_txs = useMemo(() => accounts_group?.data || [], [ accounts_group ]);
	const credit_txs = useMemo(() => credits_group?.data || [], [ credits_group ]);

	const account_groups = useMemo(() => groupTransactionsByDay(account_txs), [ account_txs ]);

	const credit_sections = useMemo<TCreditSection[]>(() => {
		const map = new Map<string, TTransaction[]>();
		credit_txs.forEach((transaction_item) => {
			const list = map.get(transaction_item.source_id) || [];
			list.push(transaction_item);
			map.set(transaction_item.source_id, list);
		});

		const ordered: TCreditSection[] = [];
		// Ordena pela ordem das linhas de crédito; o que sobrar (origem não listada) vai no fim.
		credit_balances.forEach((credit_balance) => {
			const items = map.get(credit_balance.id);
			if (items) {
				ordered.push({ id: credit_balance.id, name: credit_balance.name, items });
				map.delete(credit_balance.id);
			}
		});
		map.forEach((items, id) => ordered.push({ id, name: source_names.get(id) || 'Crédito', items }));
		return ordered;
	}, [ credit_txs, credit_balances, source_names ]);

	const summary = useMemo(() => buildSummary(accounts_group), [ accounts_group ]);

	const has_sources = accounts.length > 0 || credit_balances.length > 0;
	const has_transactions = account_txs.length + credit_txs.length > 0;
	const is_settle_confirm_disabled = is_settle_pending || !isValidTime(settle_time) || !settle_date;

	const isFormOpen = is_new_transaction_open || Boolean(transaction);

	const handleCloseForm = () => {
		setIsNewTransactionOpen(false);
		setTransaction(null);
	};

	const toggleExpanded = (id: string) => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleDeleteTransaction = (transaction_to_delete: TTransaction) => {
		setTimeout(() => {
			Alert.alert(
				'Excluir Transação',
				`Deseja excluir "${ transaction_to_delete.description }"? Essa ação não pode ser desfeita.`,
				[
					{
						text: 'Cancelar',
						style: 'cancel',
					},
					{
						text: 'Excluir',
						style: 'destructive',
						onPress: () => {
							deleteTransaction({
								id: transaction_to_delete.id,
								onSuccess: () => {
									Toast.show({
										type: 'success',
										text1: 'Transação excluída com sucesso',
										text2: `A transação ${ transaction_to_delete.description } foi excluída com sucesso`,
									});
								},
								onError: (error) => {
									Toast.show({
										type: 'error',
										text1: 'Erro ao excluir transação',
										text2: getApiErrorMessage(error, `Não foi possível excluir a transação ${ transaction_to_delete.description }`),
									});
								},
							});
						},
					},
				],
			);
		}, 100);
	};

	const getTransactionColor = (type: string) => (
		type === 'deposit' ? styles.textGreen : styles.textRed
	);

	const renderKindIcon = (transaction_item: TTransaction) => {
		const is_deposit = transaction_item.kind === 'deposit';

		return (
			<View
				style={[
					styles.kindIcon,
					{ backgroundColor: is_deposit ? colors['feedback-success-light'] : colors['feedback-danger-light'] },
				]}
			>
				<Icon
					name={is_deposit ? 'north-east' : 'south-east'}
					size={16}
					color={is_deposit ? colors['feedback-success-dark'] : colors['feedback-danger-dark']}
				/>
			</View>
		);
	};

	/*
	 * Meta por linha (espelha o `renderMeta` do web): chip do NOME da origem (omitido dentro de um
	 * accordion de cartão — o header já diz de qual cartão é), selos de estado (Rascunho/Pendente) e QUEM
	 * fez a transação (`user_name`, sempre visível).
	 */
	const renderTransactionMeta = (transaction_item: TTransaction, hide_source = false) => {
		const is_credit = transaction_item.source_type === 'CreditBalance';
		const name = source_names.get(transaction_item.source_id) || (is_credit ? 'Crédito' : 'Conta');
		const is_pending = !transaction_item.draft && !transaction_item.settled;
		const chip_color = is_credit ? colors['feedback-info-default'] : colors['brand-secondary'];

		return (
			<View style={styles.metaRow}>
				{!hide_source && (
					<View style={[ styles.originChip, { borderColor: chip_color } ]}>
						<Icon name={is_credit ? 'credit-card' : 'account-balance-wallet'} size={11} color={chip_color} />
						<ThemedText style={[ styles.originChipText, { color: chip_color } ]} numberOfLines={1}>{name}</ThemedText>
					</View>
				)}
				{transaction_item.draft && <ThemedText style={[ styles.stateBadge, styles.draftBadge ]}>Rascunho</ThemedText>}
				{is_pending && <ThemedText style={[ styles.stateBadge, styles.pendingBadge ]}>Pendente</ThemedText>}
				<View style={styles.userChip}>
					<Icon name='person' size={11} color={theme.colors.placeholder} />
					<ThemedText style={styles.userChipText} numberOfLines={1}>{transaction_item.user_name}</ThemedText>
				</View>
			</View>
		);
	};

	/*
	 * Linha de data/hora: "Prevista" (transaction_date) + "Pago" (settled_date, quando efetivada). Em
	 * crédito não mostramos a "Prevista" — a compra é auto-efetivada (settled_date = transaction_date),
	 * então só o "Pago" é relevante.
	 */
	const renderDates = (transaction_item: TTransaction) => {
		const is_credit = transaction_item.source_type === 'CreditBalance';

		return (
			<View style={styles.datesCol}>
				{!is_credit && (
					<ThemedText style={styles.dateLine}>Prevista: {DateUtils.formateTo(transaction_item.transaction_date, 'dd/MM/yyyy HH:mm')}</ThemedText>
				)}
				{transaction_item.settled_date && (
					<ThemedText style={styles.dateLine}>Pago: {DateUtils.formateTo(transaction_item.settled_date, 'dd/MM/yyyy HH:mm')}</ThemedText>
				)}
			</View>
		);
	};

	const renderTransactionCard = (transaction_item: TTransaction, hide_source = false) => (
		<TouchableOpacity
			key={transaction_item.id}
			style={[ styles.transactionItem, { backgroundColor: card_surface }, transaction_item.draft && styles.draftItem ]}
			onPress={() => setTransaction(transaction_item)}
		>
			{renderKindIcon(transaction_item)}

			<ThemedView style={[ styles.transactionLeft, { backgroundColor: 'transparent' } ]}>
				<ThemedText style={styles.transactionDescription} numberOfLines={1}>{transaction_item.description}</ThemedText>
				{renderTransactionMeta(transaction_item, hide_source)}
				{renderDates(transaction_item)}
			</ThemedView>

			<ThemedText style={[ styles.transactionValue, getTransactionColor(transaction_item.kind) ]}>
				{transaction_item.kind === 'deposit' ? '+' : '-'}{MoneyUtils.formatMoney(transaction_item.value)}
			</ThemedText>

			<TouchableOpacity
				style={styles.actionsButton}
				onPress={(event) => {
					event.stopPropagation();
					setActionsTransaction(transaction_item);
				}}
				hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
			>
				<Icon name='more-vert' size={20} color={theme.colors.placeholder} />
			</TouchableOpacity>
		</TouchableOpacity>
	);

	const renderTransactionItem = ({ item }: { item: TTransaction }) => renderTransactionCard(item, false);

	const renderSectionHeader = ({ section }: { section: TDayGroup }) => (
		<ThemedText style={styles.sectionHeader}>{section.title}</ThemedText>
	);

	/* Grupos por dia dentro de um accordion de cartão — chip da origem escondido (o header já diz o cartão). */
	const renderCreditDayGroups = (items: TTransaction[]) =>
		groupTransactionsByDay(items).map((group) => (
			<View key={group.title} style={styles.accordionDayGroup}>
				<ThemedText style={styles.sectionHeader}>{group.title}</ThemedText>
				{group.data.map((item) => renderTransactionCard(item, true))}
			</View>
		));

	/*
	 * Accordion de um cartão (espelha o `renderCreditAccordion` do web): header com a altura de um card
	 * de transação (badge + nome + "N transações" + subtotal líquido + chevron) e corpo em cor distinta.
	 * Abre/fecha animado por LayoutAnimation; a tela já rola, então o corpo expande inteiro (sem max-height).
	 */
	const renderCreditAccordion = (section: TCreditSection) => {
		const is_expanded = expanded.has(section.id);
		const net = sectionNet(section.items);

		return (
			<View key={section.id} style={[ styles.accordion, { borderColor: theme.colors.border } ]}>
				<TouchableOpacity
					style={[ styles.accordionHeader, { backgroundColor: card_surface } ]}
					onPress={() => toggleExpanded(section.id)}
					activeOpacity={0.7}
				>
					<View style={styles.accordionHeaderLeft}>
						<View style={styles.accordionBadge}>
							<Icon name='credit-card' size={18} color={colors['feedback-info-default']} />
						</View>
						<View style={styles.accordionTitleCol}>
							<ThemedText style={styles.accordionName} numberOfLines={1}>{section.name}</ThemedText>
							<ThemedText style={styles.accordionCount}>
								{section.items.length} transaç{section.items.length === 1 ? 'ão' : 'ões'}
							</ThemedText>
						</View>
					</View>
					<View style={styles.accordionHeaderRight}>
						<ThemedText style={[ styles.accordionNet, net >= 0 ? styles.textGreen : styles.textRed ]}>{MoneyUtils.formatSignedMoney(net)}</ThemedText>
						<Icon name={is_expanded ? 'expand-more' : 'chevron-right'} size={22} color={theme.colors.placeholder} />
					</View>
				</TouchableOpacity>

				{is_expanded && (
					<View style={[ styles.accordionBody, { backgroundColor: accordion_body_bg } ]}>
						{renderCreditDayGroups(section.items)}
					</View>
				)}
			</View>
		);
	};

	/* Accordions dos cartões vão no rodapé da SectionList — preserva swipe de mês + pull-refresh + performance. */
	const credit_footer = credit_sections.length > 0 ? (
		<View style={styles.accordionList}>
			{credit_sections.map(renderCreditAccordion)}
		</View>
	) : null;

	const calendar_theme = {
		calendarBackground: theme.colors.background,
		dayTextColor: theme.colors.text,
		monthTextColor: theme.colors.text,
		textDisabledColor: theme.colors.placeholder,
		arrowColor: theme.colors.text,
		todayTextColor: colors['brand-secondary'],
		selectedDayBackgroundColor: colors['brand-secondary'],
		selectedDayTextColor: '#fff',
	};

	return (
		<ThemedView style={styles.transactionsContainer}>
			<ThemedView style={styles.header}>
				<MonthYearSelector
					onChange={(month: number, year: number) => {
						setMonthYearSelectorValues({
							month,
							year,
						});
					}}
					value={{
						month: month_year_selector_values.month,
						year: month_year_selector_values.year,
					}}
				/>

				<ThemedView style={[ styles.balanceContainer, { backgroundColor: card_surface, borderColor: card_surface } ]}>
					<ThemedView style={[ styles.balanceContainerTransparent, styles.totalTextCol ]}>
						<ThemedText style={styles.balanceLabel}>Total do mês · Contas</ThemedText>
						{is_data_transactions_loading ? <Skeleton height={20} width={160} /> : (
							<ThemedText style={styles.totalLine}>
								<ThemedText style={[ styles.balanceValue, summary.settled >= 0 ? styles.textGreen : styles.textRed ]}>
									{MoneyUtils.formatSignedMoney(summary.settled)}
								</ThemedText>
								<ThemedText style={styles.previstoInline}>
									{'  '}previsto <ThemedText style={[ styles.previstoInline, summary.gap ? { color: colors['feedback-warning-dark'] } : { color: theme.colors.text } ]}>{MoneyUtils.formatSignedMoney(summary.projected)}</ThemedText>
									{summary.pending > 0 ? ` · ${ summary.pending } pendente${ summary.pending > 1 ? 's' : '' }` : ''}
								</ThemedText>
							</ThemedText>
						)}
					</ThemedView>

					<TouchableOpacity
						style={[ styles.infoButton, { borderColor: theme.colors.border } ]}
						onPress={() => setIsTotalsDetailOpen(true)}
						hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
					>
						<Icon name='info-outline' size={18} color={theme.colors.placeholder} />
					</TouchableOpacity>
				</ThemedView>
			</ThemedView>

			<ThemedView style={styles.listContainer} {...pan_responder.panHandlers}>
				<Animated.View style={[ styles.listAnimatedContent, { transform: [ { translateX: translate_x } ] } ]}>
					{is_data_transactions_loading && (
						<ThemedView style={styles.skeletonList}>
							{new Array(6).fill(null).map((_, index) => (
								<Skeleton key={index} height={56} />
							))}
						</ThemedView>
					)}

					{/* Sem nenhuma origem → manda cadastrar em Contas & Cartões */}
					{!is_data_transactions_loading && !has_transactions && !has_sources && (
						<ThemedView style={styles.emptyContainer}>
							<Icon name='account-balance-wallet' size={40} color={theme.colors.placeholder} />
							<ThemedText style={styles.emptyMessage}>Nenhuma conta ou cartão ainda</ThemedText>
							<ThemedText style={styles.emptySubMessage}>
								Crie uma conta ou um cartão em Contas & Cartões para ver as transações aqui.
							</ThemedText>
							<TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('Finances')}>
								<Icon name='arrow-forward' size={18} color='white' />
								<ThemedText style={styles.emptyButtonText}>Ir para Contas & Cartões</ThemedText>
							</TouchableOpacity>
						</ThemedView>
					)}

					{/* Tem origem, mas nenhuma transação neste mês */}
					{!is_data_transactions_loading && !has_transactions && has_sources && (
						<ThemedView style={styles.emptyContainer}>
							<Icon name='receipt-long' size={40} color={theme.colors.placeholder} />
							<ThemedText style={styles.emptyMessage}>Nenhuma transação neste mês</ThemedText>
							<ThemedText style={styles.emptySubMessage}>Registre uma entrada ou saída pra começar</ThemedText>
							<TouchableOpacity
								style={styles.emptyButton}
								disabled={!user_wallet.data?.id}
								onPress={() => {
									setTransaction(null);
									setIsNewTransactionOpen(true);
								}}
							>
								<Icon name='add' size={18} color='white' />
								<ThemedText style={styles.emptyButtonText}>Adicionar transação</ThemedText>
							</TouchableOpacity>
						</ThemedView>
					)}

					{!is_data_transactions_loading && has_transactions && (
						<SectionList
							sections={account_groups}
							renderItem={renderTransactionItem}
							renderSectionHeader={renderSectionHeader}
							keyExtractor={(item) => item.id}
							style={styles.transactionsList}
							contentContainerStyle={styles.listContent}
							refreshControl={<RefreshControl {...refreshControlProps} />}
							showsVerticalScrollIndicator={false}
							stickySectionHeadersEnabled={false}
							ItemSeparatorComponent={ItemSeparator}
							SectionSeparatorComponent={SectionSeparator}
							ListFooterComponent={credit_footer}
						/>
					)}
				</Animated.View>
			</ThemedView>

			<TransactionFormModal
				visible={isFormOpen}
				transaction={transaction}
				suggested_date={DateUtils.formatDate(new Date(month_year_selector_values.year, month_year_selector_values.month, new Date().getDate()))}
				onClose={handleCloseForm}
			/>

			<TransactionDuplicateModal
				visible={Boolean(duplicating_transaction)}
				transaction={duplicating_transaction}
				source_name={duplicating_transaction ? source_names.get(duplicating_transaction.source_id) : undefined}
				onClose={() => setDuplicatingTransaction(null)}
			/>

			<Modal
				visible={is_totals_detail_open}
				transparent
				animationType='fade'
				onRequestClose={() => setIsTotalsDetailOpen(false)}
			>
				<TouchableOpacity style={styles.actionsSheetOverlay} activeOpacity={1} onPress={() => setIsTotalsDetailOpen(false)}>
					<ThemedView style={[ styles.actionsSheet, styles.detailSheet ]}>
						<ThemedText style={styles.detailTitle}>Total do mês · Contas</ThemedText>

						<View style={styles.detailRow}>
							<ThemedText style={styles.detailLabel}>Saldo efetivado</ThemedText>
							<ThemedText style={[ styles.detailValue, summary.settled >= 0 ? styles.textGreen : styles.textRed ]}>{MoneyUtils.formatSignedMoney(summary.settled)}</ThemedText>
						</View>
						<View style={styles.detailRow}>
							<ThemedText style={styles.detailLabel}>Saldo previsto</ThemedText>
							<ThemedText style={[ styles.detailValue, summary.gap ? { color: colors['feedback-warning-dark'] } : { color: theme.colors.text } ]}>{MoneyUtils.formatSignedMoney(summary.projected)}</ThemedText>
						</View>

						<View style={styles.detailDivider} />

						<View style={styles.detailRow}>
							<View style={styles.detailLabelRow}>
								<Icon name='north-east' size={16} color={colors['feedback-success-default']} />
								<ThemedText style={styles.detailLabel}>Entradas</ThemedText>
							</View>
							<ThemedText style={[ styles.detailValue, styles.textGreen ]}>{MoneyUtils.formatMoney(summary.deposit)}</ThemedText>
						</View>
						<View style={styles.detailRow}>
							<View style={styles.detailLabelRow}>
								<Icon name='south-east' size={16} color={colors['feedback-danger-default']} />
								<ThemedText style={styles.detailLabel}>Saídas</ThemedText>
							</View>
							<ThemedText style={[ styles.detailValue, styles.textRed ]}>{MoneyUtils.formatMoney(summary.withdraw)}</ThemedText>
						</View>
					</ThemedView>
				</TouchableOpacity>
			</Modal>

			<Modal
				visible={Boolean(actions_transaction)}
				transparent
				animationType='fade'
				onRequestClose={() => setActionsTransaction(null)}
			>
				<TouchableOpacity
					style={styles.actionsSheetOverlay}
					activeOpacity={1}
					onPress={() => setActionsTransaction(null)}
				>
					<ThemedView style={styles.actionsSheet}>
						{actions_transaction && !actions_transaction.draft && (
							<TouchableOpacity
								style={styles.actionsSheetItem}
								onPress={() => {
									const target = actions_transaction;
									setActionsTransaction(null);
									if (!target) return;
									if (target.settled) handleUnsettle(target);
									else openSettle(target);
								}}
							>
								<Icon
									name={actions_transaction.settled ? 'radio-button-unchecked' : 'check-circle'}
									size={20}
									color={actions_transaction.settled ? theme.colors.placeholder : colors['feedback-success-default']}
								/>
								<ThemedText style={styles.actionsSheetItemText}>{actions_transaction.settled ? 'Desfazer efetivação' : 'Efetivar pagamento'}</ThemedText>
							</TouchableOpacity>
						)}

						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_transaction;
								setActionsTransaction(null);
								if (target) setTransaction(target);
							}}
						>
							<Icon name='edit' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Editar</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_transaction;
								setActionsTransaction(null);
								if (target) setDuplicatingTransaction(target);
							}}
						>
							<Icon name='content-copy' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Duplicar</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_transaction;
								setActionsTransaction(null);
								if (target) handleDeleteTransaction(target);
							}}
						>
							<Icon name='delete' size={20} color={colors['feedback-danger-default']} />
							<ThemedText style={[ styles.actionsSheetItemText, { color: colors['feedback-danger-default'] } ]}>Excluir</ThemedText>
						</TouchableOpacity>
					</ThemedView>
				</TouchableOpacity>
			</Modal>

			<Modal
				visible={Boolean(settling_transaction)}
				transparent
				animationType='fade'
				onRequestClose={() => setSettlingTransaction(null)}
			>
				<ThemedView style={styles.settleOverlay}>
					<ThemedView style={styles.settleSheet}>
						<ThemedText style={styles.settleTitle}>Efetivar pagamento</ThemedText>

						<View style={styles.settleFieldRow}>
							<View style={styles.settleDateCol}>
								<ThemedText style={styles.settleFieldLabel}>Pago em</ThemedText>
								<ThemedText style={styles.settleDateValue}>{settle_date}</ThemedText>
							</View>
							<View style={styles.settleTimeCol}>
								<ThemedTextInput
									label='Hora *'
									value={settle_time}
									onChangeText={(text) => setSettleTime(formatTimeInput(text))}
									placeholder='HH:MM'
									keyboardType='numeric'
									maxLength={5}
								/>
							</View>
						</View>

						<Calendar
							current={toISODate(settle_date) || undefined}
							onDayPress={(day: DateData) => setSettleDate(toDisplayDate(day.dateString))}
							markedDates={settle_date ? {
								[toISODate(settle_date)]: { selected: true, selectedColor: colors['brand-secondary'] },
							} : undefined}
							theme={calendar_theme}
						/>

						<View style={styles.settleButtons}>
							<TouchableOpacity style={[ styles.settleButton, styles.cancelButton ]} onPress={() => setSettlingTransaction(null)} disabled={is_settle_pending}>
								<ThemedText style={styles.settleButtonText}>Cancelar</ThemedText>
							</TouchableOpacity>
							<TouchableOpacity
								style={[ styles.settleButton, is_settle_confirm_disabled ? styles.saveButtonDisabled : styles.saveButton ]}
								onPress={handleConfirmSettle}
								disabled={is_settle_confirm_disabled}
							>
								<ThemedText style={styles.settleButtonText}>Efetivar</ThemedText>
							</TouchableOpacity>
						</View>
					</ThemedView>
				</ThemedView>
			</Modal>
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	transactionsContainer: {
		flex: 1,
	},
	header: {
		gap: 12,
	},
	listContainer: {
		flex: 1,
		marginTop: 10,
		overflow: 'hidden',
	},
	listAnimatedContent: {
		flex: 1,
	},
	transactionsList: {
		flex: 1,
	},
	listContent: {
		paddingBottom: 12,
	},
	skeletonList: {
		gap: 10,
	},
	transactionItem: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 10,
		paddingVertical: 13,
		paddingHorizontal: 12,
		borderRadius: 10,
	},
	draftItem: {
		opacity: 0.6,
	},
	transactionLeft: {
		flex: 1,
		backgroundColor: 'transparent',
	},
	transactionDescription: {
		fontSize: 14,
		lineHeight: 18,
		fontWeight: '600',
	},
	transactionValue: {
		fontSize: 14,
		lineHeight: 18,
		fontWeight: '600',
		marginRight: 4,
	},
	actionsButton: {
		padding: 4,
	},
	kindIcon: {
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		gap: 8,
		paddingHorizontal: 24,
	},
	emptyMessage: {
		fontWeight: '600',
		textAlign: 'center',
	},
	emptySubMessage: {
		color: '#868686',
		textAlign: 'center',
		fontSize: 13,
		lineHeight: 18,
	},
	emptyButton: {
		marginTop: 12,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: colors['brand-secondary'],
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 8,
	},
	emptyButtonText: {
		color: 'white',
		fontWeight: '600',
	},
	textGreen: {
		color: colors['feedback-success-default'],
	},
	textRed: {
		color: colors['feedback-danger-default'],
	},
	transactionSeparator: {
		height: 8,
	},
	sectionSeparator: {
		height: 12,
	},
	sectionHeader: {
		textTransform: 'uppercase',
		fontSize: 12,
		lineHeight: 16,
		fontWeight: '600',
		color: '#868686',
		marginBottom: 6,
	},
	balanceContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	balanceContainerTransparent: {
		backgroundColor: 'transparent',
	},
	totalTextCol: {
		flex: 1,
		gap: 2,
	},
	totalLine: {
		flexDirection: 'row',
		alignItems: 'baseline',
		flexWrap: 'wrap',
	},
	previstoInline: {
		fontSize: 13,
		color: '#868686',
	},
	infoButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	metaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
		gap: 6,
		marginTop: 3,
	},
	originChip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		maxWidth: 160,
		borderWidth: 1,
		borderRadius: 100,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	originChipText: {
		fontSize: 11,
		lineHeight: 14,
		fontWeight: '500',
	},
	userChip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 3,
		maxWidth: 160,
	},
	userChipText: {
		fontSize: 11,
		lineHeight: 14,
		color: '#868686',
	},
	datesCol: {
		marginTop: 3,
	},
	dateLine: {
		fontSize: 11,
		lineHeight: 15,
		color: '#868686',
	},
	stateBadge: {
		fontSize: 10,
		lineHeight: 14,
		fontWeight: '700',
		textTransform: 'uppercase',
		borderRadius: 4,
		paddingHorizontal: 5,
		paddingVertical: 1,
		overflow: 'hidden',
	},
	draftBadge: {
		color: '#868686',
		backgroundColor: 'rgba(255, 255, 255, 0.10)',
	},
	pendingBadge: {
		color: colors['feedback-warning-dark'],
		backgroundColor: colors['feedback-warning-light'],
	},
	balanceLabel: {
		fontSize: 11,
		lineHeight: 14,
		fontWeight: '600',
		textTransform: 'uppercase',
		color: '#868686',
	},
	balanceValue: {
		fontSize: 16,
		fontWeight: '700',
	},
	accordionList: {
		marginTop: 16,
		gap: 12,
	},
	accordion: {
		borderWidth: 1,
		borderRadius: 12,
		overflow: 'hidden',
	},
	accordionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 10,
		paddingVertical: 12,
		paddingHorizontal: 12,
	},
	accordionHeaderLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		flex: 1,
	},
	accordionBadge: {
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors['feedback-info-light'],
	},
	accordionTitleCol: {
		flex: 1,
	},
	accordionName: {
		fontSize: 14,
		lineHeight: 18,
		fontWeight: '600',
	},
	accordionCount: {
		fontSize: 12,
		lineHeight: 16,
		color: '#868686',
	},
	accordionHeaderRight: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	accordionNet: {
		fontSize: 14,
		fontWeight: '700',
	},
	accordionBody: {
		paddingHorizontal: 10,
		paddingTop: 12,
		paddingBottom: 4,
		gap: 12,
	},
	accordionDayGroup: {
		gap: 8,
	},
	detailSheet: {
		paddingHorizontal: 20,
		paddingTop: 20,
		gap: 12,
	},
	detailTitle: {
		fontSize: 12,
		fontWeight: '700',
		textTransform: 'uppercase',
		color: '#868686',
	},
	detailRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: 'transparent',
	},
	detailLabelRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: 'transparent',
	},
	detailLabel: {
		fontSize: 14,
		color: '#868686',
	},
	detailValue: {
		fontSize: 14,
		fontWeight: '600',
	},
	detailDivider: {
		height: 1,
		backgroundColor: 'rgba(255, 255, 255, 0.10)',
	},
	actionsSheetOverlay: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.4)',
	},
	actionsSheet: {
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		paddingTop: 8,
		paddingBottom: 28,
	},
	actionsSheetItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 14,
		paddingHorizontal: 20,
	},
	actionsSheetItemText: {
		fontSize: 16,
	},
	settleOverlay: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	settleSheet: {
		width: '90%',
		padding: 20,
		borderRadius: 12,
		elevation: 5,
		gap: 14,
	},
	settleTitle: {
		fontSize: 20,
		fontWeight: '600',
		textAlign: 'center',
	},
	settleFieldRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 12,
	},
	settleDateCol: {
		flex: 1.4,
	},
	settleTimeCol: {
		flex: 1,
	},
	settleFieldLabel: {
		fontSize: 13,
		color: '#868686',
	},
	settleDateValue: {
		fontSize: 16,
		fontWeight: '600',
		marginTop: 6,
	},
	settleButtons: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 10,
	},
	settleButton: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 8,
		alignItems: 'center',
	},
	settleButtonText: {
		color: 'white',
		fontSize: 16,
	},
	cancelButton: {
		backgroundColor: '#f16f6f',
	},
	saveButton: {
		backgroundColor: colors['brand-secondary'],
	},
	saveButtonDisabled: {
		backgroundColor: '#ccc',
	},
});

export default TransactionsList;
