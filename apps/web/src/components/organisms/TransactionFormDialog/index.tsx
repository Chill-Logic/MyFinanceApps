import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
	DateUtils,
	getApiErrorMessage,
	InvoiceUtils,
	MONTH_NAMES_PT,
	MoneyUtils,
	RECURRENCE_FREQUENCY_OPTIONS,
	RecurrenceUtils,
	TransactionUtils,
	type TRecurrenceFrequency,
	type TRepeatMode,
	type TTransaction,
	type TTransactionKind,
	type TTransactionSourceType,
	type TUpdateTransactionBody,
} from '@myfinance/shared';
import { addMonths, format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ArrowRight, CalendarIcon, Check, CheckCircle2, ChevronLeft, CircleDashed, ChevronRight, CreditCard, Delete, Landmark, Receipt, Repeat, UserRound, Wallet } from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useEnumOptions } from '@/hooks/api/core/useEnumOptions';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useIndexCreditCards } from '@/hooks/api/credit-cards/useIndexCreditCards';
import { useCreateRecurrence } from '@/hooks/api/recurrences/useCreateRecurrence';
import { useShowRecurrence } from '@/hooks/api/recurrences/useShowRecurrence';
import { useUpdateRecurrence } from '@/hooks/api/recurrences/useUpdateRecurrence';
import { useCreateTransactions } from '@/hooks/api/transactions/useCreateTransactions';
import { useUpdateTransactions } from '@/hooks/api/transactions/useUpdateTransactions';
import { useListWalletMembers } from '@/hooks/api/wallets/useListWalletMembers';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import { withDatePart, withTimePart } from '@/components/molecules/DateTimeField';
import SegmentedControl from '@/components/molecules/SegmentedControl';
import RecurrenceFormDialog from '@/components/organisms/RecurrenceFormDialog';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import Checkbox from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Input from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	transaction?: TTransaction | null;
	suggestedDate?: Date;
	/* Origem pré-selecionada na criação (ex.: a origem que a lista está filtrando). */
	defaultSourceType?: TTransactionSourceType;
	defaultSourceId?: string;
	/* Abre com "Repetir" já ligado (ex.: "Nova recorrência" na aba Recorrências). Só na criação. */
	defaultRepeatMode?: TRepeatMode;
}

type TFormValues = {
	/* Origem codificada como `${source_type}:${source_id}` (ex.: "Account:uuid"). */
	origin: string;
	credit_card_id: string;
	kind: TTransactionKind;
	description: string;
	value: string;
	/* "Data da transação" (transaction_date) — carrega data + horário. */
	transaction_date: Date;
	/* "Pago em" (settled_date) — `null` = pendente. Carrega data + horário. */
	settled_date: Date | null;
	/* Fatura do gasto de cartão: `AUTO_INVOICE_MONTH` = deixa o backend calcular pelo ciclo. */
	invoice_month: string;
	draft: boolean;
	/* Só em transferência (`kind === 'transfer'`): a conta que recebe. */
	destination_account_id: string;
	/* Autor ("Responsável"): um dos participantes da carteira. Vazio = o backend usa o usuário logado. */
	user_id: string;
	/* "Repetir" (só na criação): `none` = transação avulsa; senão vira uma recorrência/compra parcelada. */
	repeat_mode: TRepeatMode;
	frequency: TRecurrenceFrequency;
	/* Recorrente: termina nunca ou após `repeat_count` vezes. */
	repeat_ends: 'never' | 'count';
	repeat_count: string;
	/* "Valor varia" (conta de luz, salário) → `value_mode: 'estimated'`. */
	value_varies: boolean;
	/* Parcelado: número de parcelas. */
	installments: string;
};

/* Sentinela do "deixa o backend decidir" — o Select do Radix não aceita item com value vazio. */
const AUTO_INVOICE_MONTH = 'auto';

const buildDefaultValues = (suggestedDate?: Date, origin = '', user_id = ''): TFormValues => ({
	origin,
	credit_card_id: '',
	kind: 'withdraw',
	description: '',
	value: '',
	transaction_date: DateUtils.withCurrentTime(suggestedDate ?? new Date()),
	settled_date: null,
	invoice_month: AUTO_INVOICE_MONTH,
	draft: false,
	destination_account_id: '',
	user_id,
	repeat_mode: 'none',
	frequency: 'monthly',
	repeat_ends: 'never',
	repeat_count: '12',
	value_varies: false,
	installments: '2',
});

const MAX_INSTALLMENTS = 48;

/* "YYYY-MM" de um Date, no fuso local — o formato do `invoice_month`. */
const monthKey = (date: Date): string =>
	`${ date.getFullYear() }-${ String(date.getMonth() + 1).padStart(2, '0') }`;

const DEFAULT_KIND_OPTIONS = [
	{ value: 'withdraw', label: 'Saída' },
	{ value: 'deposit', label: 'Entrada' },
	{ value: 'transfer', label: 'Transferência' },
];

/* Ordem fixa do select "Tipo", independente da ordem em que a API devolve as opções. */
const KIND_ORDER: string[] = [ 'withdraw', 'deposit', 'transfer' ];

const KIND_TITLE: Record<TTransactionKind, string> = { deposit: 'entrada', withdraw: 'saída', transfer: 'transferência' };

/* Rótulos das abas de tipo (os do enum da API são "Saque"/"Depósito"; o redesign usa Saída/Entrada). */
/*
 * Atalho de salvar mostrado no botão: "⌘ Enter" no Mac, "Ctrl Enter" no resto. Por extenso — o símbolo ↵
 * renderiza mal na Geist e ninguém reconhece "⌘" no Windows.
 */
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const SUBMIT_SHORTCUT = IS_MAC ? '⌘ Enter' : 'Ctrl Enter';

const KIND_TAB_LABEL: Record<string, string> = { withdraw: 'Saída', deposit: 'Entrada', transfer: 'Transferência' };

const parseOrigin = (origin: string): { source_type: TTransactionSourceType | ''; source_id: string } => {
	const [ source_type, source_id ] = origin.split(':');
	return { source_type: (source_type as TTransactionSourceType) || '', source_id: source_id || '' };
};

const TransactionFormDialog = ({ open, onOpenChange, transaction, suggestedDate, defaultSourceType, defaultSourceId, defaultRepeatMode = 'none' }: IProps) => {
	const navigate = useNavigate();
	const { user_wallet } = useWallet();
	const { current_user } = useCurrentUserContext();
	const { toast } = useToast();

	const current_user_id = current_user.data?.id || '';

	const wallet_id = user_wallet.data?.id;
	const is_editing = Boolean(transaction);
	const default_origin = defaultSourceType && defaultSourceId ? `${ defaultSourceType }:${ defaultSourceId }` : '';

	const { mutate: createTransactionMutation, isPending: is_create_pending } = useCreateTransactions();
	const { mutate: updateTransactionMutation, isPending: is_update_pending } = useUpdateTransactions();
	const { mutate: createRecurrenceMutation, isPending: is_create_recurrence_pending } = useCreateRecurrence();
	const { mutate: updateRecurrenceMutation, isPending: is_update_recurrence_pending } = useUpdateRecurrence();
	/* Edição de ocorrência de recorrência que mudou descrição/valor: guarda o body até o usuário escolher o escopo. */
	const [ pending_scope_body, setPendingScopeBody ] = useState<TUpdateTransactionBody | null>(null);
	const { data: kind_options } = useEnumOptions({ entity: 'transaction', type: 'kind' });

	const [ values, setValues ] = useState<TFormValues>(buildDefaultValues(suggestedDate, default_origin, current_user_id));
	/*
	 * Etapa 1 da CRIAÇÃO: tipo de origem escolhido (Conta/Cartão). `null` = ainda na tela de escolha —
	 * evita criar uma transação de cartão sem querer. Na edição vem do próprio transaction (pula a etapa 1).
	 */
	const [ origin_type, setOriginType ] = useState<TTransactionSourceType | null>(null);

	const { source_type, source_id } = parseOrigin(values.origin);
	/* Deriva do TIPO escolhido (não do source_id): vale já na etapa 2, antes de escolher a origem específica. */
	const is_credit = origin_type === 'CreditBalance';
	/*
	 * Na edição a origem pode ser trocada (conta↔conta, conta↔crédito, crédito↔crédito). Só quando ela de
	 * fato muda é que `source_type`/`source_id` vão no body e a fatura volta a ter o checkbox "automática".
	 */
	const original_origin = transaction ? `${ transaction.source_type }:${ transaction.source_id }` : '';
	const origin_changed = is_editing && Boolean(values.origin) && values.origin !== original_origin;
	/*
	 * Pagamento de fatura (`paid_credit_balance_id`) não troca de origem: ele é amarrado à fatura que quitou,
	 * e mudar a conta de onde saiu (ou virar gasto de crédito) deixaria esse vínculo incoerente.
	 */
	const is_origin_locked = Boolean(transaction?.paid_credit_balance_id);

	const { data: accounts_data } = useIndexAccounts({
		enabled: open && Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const { data: credit_balances_data } = useIndexCreditBalances({
		enabled: open && Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const { data: credit_cards_data, isLoading: is_cards_loading } = useIndexCreditCards({
		enabled: open && is_credit && Boolean(source_id),
		params: { credit_balance_id: source_id },
	});

	/*
	 * Participantes da carteira em que a transação vai ficar: a atual na criação ou quando a origem muda
	 * (as origens listadas são desta carteira); senão, a da própria transação.
	 */
	const members_wallet_id = transaction && !origin_changed ? transaction.wallet_id : wallet_id;
	const { data: members_data } = useListWalletMembers({ enabled: open, wallet_id: members_wallet_id });
	const members = members_data || [];

	const accounts = accounts_data?.data || [];
	const credit_balances = credit_balances_data?.data || [];
	const credit_cards = credit_cards_data?.data || [];
	const has_origins = accounts.length > 0 || credit_balances.length > 0;

	/* Se o crédito escolhido tem exatamente um cartão, não faz sentido obrigar a escolher — pré-seleciona. */
	const single_card_id = credit_cards.length === 1 ? credit_cards[0].id : null;

	const kinds = kind_options?.length
		? [ ...kind_options ].sort((a, b) => KIND_ORDER.indexOf(a.value) - KIND_ORDER.indexOf(b.value))
		: DEFAULT_KIND_OPTIONS;

	/* Transferência só sai de conta: escolher cartão como origem nunca deixa o tipo em transferência. */
	const is_transfer = !is_credit && values.kind === 'transfer';
	/*
	 * Transferência é escolhida na etapa 1 (botão próprio) e NÃO é editável (a lista não oferece "Editar"
	 * pra ela). Então o "Tipo" de uma conta é só Entrada/Saída — nem na edição uma transação vira
	 * transferência — e numa transferência ele some.
	 */
	const kind_options_for_form = kinds.filter((option) => option.value !== 'transfer');

	/*
	 * Origem que pode não estar entre as contas ativas desta carteira (conta excluída — as transações dela
	 * continuam existindo). Sem isso o select abriria vazio na edição. O nome vem pronto do backend.
	 */
	const foreign_source = transaction && transaction.source_type === 'Account' && !accounts.some((item) => item.id === transaction.source_id)
		? { id: transaction.source_id, name: transaction.source_name }
		: null;
	const destination_options = accounts.filter((item) => item.id !== source_id);
	const destination_name = destination_options.find((item) => item.id === values.destination_account_id)?.name;
	const source_name = [ ...accounts, ...(foreign_source ? [ foreign_source ] : []) ].find((item) => item.id === source_id)?.name;
	const default_transfer_description = is_transfer ? TransactionUtils.transferDescription(source_name, destination_name) : '';

	useEffect(() => {
		if (!open) return;

		if (transaction) {
			setOriginType(transaction.source_type);
			setValues({
				origin: `${ transaction.source_type }:${ transaction.source_id }`,
				credit_card_id: transaction.credit_card_id || '',
				kind: transaction.kind,
				description: transaction.description,
				value: MoneyUtils.formatMoney(transaction.value),
				transaction_date: new Date(transaction.transaction_date),
				settled_date: transaction.settled_date ? new Date(transaction.settled_date) : null,
				invoice_month: transaction.invoice_month || monthKey(new Date(transaction.transaction_date)),
				draft: transaction.draft,
				destination_account_id: transaction.destination_account_id || '',
				user_id: transaction.user_id,
				repeat_mode: 'none',
				frequency: 'monthly',
				repeat_ends: 'never',
				repeat_count: '12',
				value_varies: false,
				installments: '2',
			});
		} else {
			setOriginType(defaultSourceType ?? null);
			setValues({ ...buildDefaultValues(suggestedDate, default_origin, current_user_id), repeat_mode: defaultRepeatMode });
		}
	}, [ open, transaction, suggestedDate, default_origin, defaultSourceType, current_user_id, defaultRepeatMode ]);

	/*
	 * O autor precisa ser participante da carteira (o backend valida). Se a carteira mudou (troca de origem)
	 * e ele não está nela, volta pro usuário logado — ou pro primeiro participante, se nem ele estiver.
	 */
	useEffect(() => {
		if (!members.length || members.some((member) => member.id === values.user_id)) return;

		const fallback = members.find((member) => member.id === current_user_id) ?? members[0];
		setValues((prev) => ({ ...prev, user_id: fallback.id }));
	}, [ members, values.user_id, current_user_id ]);

	/*
	 * Auto-seleciona o único cartão do crédito escolhido, sem sobrescrever uma escolha que já
	 * exista (edição ou seleção manual anterior). Resetar a origem já zera `credit_card_id`, então
	 * trocar de crédito re-dispara isto pro novo cartão único.
	 */
	useEffect(() => {
		if (is_credit && single_card_id) {
			setValues((prev) => (prev.credit_card_id ? prev : { ...prev, credit_card_id: single_card_id }));
		}
	}, [ is_credit, single_card_id ]);

	/*
	 * Ocorrência de recorrência/parcela mostra a regra (e edita por "Editar regra"); transação avulsa pode
	 * virar recorrente ou parcelada também na edição — ela vira a 1ª ocorrência.
	 */
	const linked_recurrence_id = open && transaction?.recurrence_id ? transaction.recurrence_id : null;
	const { data: linked_recurrence } = useShowRecurrence(linked_recurrence_id);
	const [ is_rule_dialog_open, setIsRuleDialogOpen ] = useState(false);

	/* Parcelado só existe em cartão: se a origem deixou de ser cartão, volta pra "Não repete". */
	const repeat_mode: TRepeatMode = linked_recurrence_id || ((!is_credit || values.kind !== 'withdraw') && values.repeat_mode === 'installment') ? 'none' : values.repeat_mode;
	const is_repeating = repeat_mode !== 'none';
	/* Na criação a repetição substitui o lançamento avulso (some "Pago em"/fatura manual); na edição a transação continua existindo. */
	const hides_single_fields = is_repeating && !is_editing;
	const repeat_count = Number(values.repeat_count);
	const installments = Number(values.installments);
	const installment_total_value = Number(MoneyUtils.unformatMoney(values.value));
	const installment_split = repeat_mode === 'installment' && installments >= 2 && installment_total_value > 0
		? RecurrenceUtils.splitInstallments(installment_total_value, installments)
		: null;
	const is_repeat_invalid = (repeat_mode === 'recurring' && values.repeat_ends === 'count' && !(repeat_count >= 2))
		|| (repeat_mode === 'installment' && !(installments >= 2 && installments <= MAX_INSTALLMENTS));

	const is_pending = is_create_pending || is_update_pending || is_create_recurrence_pending || is_update_recurrence_pending;
	const is_submit_disabled = is_pending
		|| !values.value
		|| (!is_transfer && !values.description.trim())
		|| (!is_editing && !values.origin)
		|| (is_credit && !values.credit_card_id)
		|| (is_transfer && !values.destination_account_id)
		|| is_repeat_invalid;

	/* "Não repete" não entra: quem liga/desliga é o chip "Repetir" — o painel só escolhe o modo. */
	const repeat_segments = [
		{ value: 'recurring', label: 'Recorrente' },
		...(is_credit && values.kind === 'withdraw' ? [ { value: 'installment', label: 'Parcelado' } ] : []),
	];

	/* Transferência na criação precisa de duas contas nesta carteira (origem ≠ destino). */
	const can_transfer = accounts.length >= 2;

	const is_invoice_auto = values.invoice_month === AUTO_INVOICE_MONTH;
	const [ invoice_year, invoice_month_part ] = is_invoice_auto ? [ '', '' ] : values.invoice_month.split('-');

	/* Mês e ano são escolhidos separados, mas o estado guarda o "YYYY-MM" que vai pro backend. */
	const setInvoicePart = (part: 'year' | 'month', value: string) => {
		setValues((prev) => {
			const [ year, month ] = prev.invoice_month.split('-');

			return { ...prev, invoice_month: part === 'year' ? `${ value }-${ month }` : `${ year }-${ value }` };
		});
	};

	/*
	 * Dentro de um <form>, o Select do Radix espelha o valor num <select> nativo escondido e dispara um
	 * `change` a cada troca de `value`. Se as opções ainda não chegaram da API (1ª abertura da edição),
	 * o <option> não existe, o nativo cai em '' e o Radix chama `onValueChange('')` — zerando a origem/cartão
	 * que o efeito de edição acabou de preencher. Nenhum item tem value vazio, então '' é sempre esse ruído.
	 */
	const setOrigin = (origin: string) => {
		if (!origin) return;

		/* Na edição o tipo pode mudar junto com a origem (a lista mostra contas E créditos). */
		setOriginType(parseOrigin(origin).source_type || null);

		/* Voltou pra origem original da edição: restaura o cartão e a fatura gravados. */
		if (transaction && origin === original_origin) {
			setValues((prev) => ({
				...prev,
				origin,
				credit_card_id: transaction.credit_card_id || '',
				invoice_month: transaction.invoice_month || monthKey(prev.transaction_date),
			}));
			return;
		}

		/* Origem nova na edição: a fatura antiga não vale mais, volta a ser calculada pelo ciclo. */
		setValues((prev) => ({
			...prev,
			origin,
			credit_card_id: '',
			invoice_month: is_editing ? AUTO_INVOICE_MONTH : prev.invoice_month,
			/* Origem e destino de uma transferência não podem ser a mesma conta. */
			destination_account_id: parseOrigin(origin).source_id === prev.destination_account_id ? '' : prev.destination_account_id,
		}));
	};

	/* Mesmo guarda do `setOrigin` contra o '' espúrio do Radix. */
	const setDestination = (destination_account_id: string) => {
		if (destination_account_id) setValues((prev) => ({ ...prev, destination_account_id }));
	};

	/* Mesmo guarda do `setOrigin` contra o '' espúrio do Radix. */
	const setAuthor = (user_id: string) => {
		if (user_id) setValues((prev) => ({ ...prev, user_id }));
	};

	const setCreditCard = (credit_card_id: string) => {
		if (credit_card_id) setValues((prev) => ({ ...prev, credit_card_id }));
	};

	const finalize = (message: string) => {
		toast.success(message);
		onOpenChange(false);
	};

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		const value = Number(MoneyUtils.unformatMoney(values.value));
		/*
		 * Cartão: na CRIAÇÃO só existe saída (compra). Na EDIÇÃO vale o tipo original — um estorno ou o pagamento da
		 * fatura que aparece no cartão é `deposit`, e forçar `withdraw` virava compra ao salvar (inverte a fatura).
		 */
		const effective_kind: TTransactionKind = values.kind;
		const transaction_date = values.transaction_date.toISOString();
		/*
		 * "Pago em" só é controlável em conta, onde `null` = pendente. Em crédito não existe pendente (o gasto
		 * é efetivado no ato) e mandamos o `settled_date` IGUAL ao `transaction_date` de propósito: o backend
		 * só carimba o campo quando ele está vazio (`settled_date ||= transaction_date`), então numa EDIÇÃO
		 * ele não acompanhava a mudança da data e ficava fossilizado no valor antigo — a transação passava a
		 * ter data de compra num mês e efetivação em outro.
		 */
		const account_settled_date = values.settled_date ? values.settled_date.toISOString() : null;
		const settled_date = is_credit ? transaction_date : account_settled_date;
		/*
		 * Fatura: só faz sentido em cartão. `AUTO_INVOICE_MONTH` vira string vazia no UPDATE (é assim que o
		 * backend devolve o campo pro default calculado pelo ciclo) e some no CREATE (ausente = default).
		 */
		const chosen_invoice_month = values.invoice_month === AUTO_INVOICE_MONTH ? '' : values.invoice_month;
		/* Em transferência pode ir em branco: o backend gera "Transferência <origem> -> <destino>". */
		const description = values.description.trim();

		if (transaction) {
			/* Saindo de um crédito pra uma conta, '' desvincula o cartão antigo. */
			const unlinked_card_id = origin_changed ? '' : undefined;

			const body: TUpdateTransactionBody = {
				kind: effective_kind,
				description,
				value,
				transaction_date,
				settled_date,
				credit_card_id: is_credit ? values.credit_card_id : unlinked_card_id,
				/* Mudar o kind pra entrada/saída zera o destino no backend — só mandamos em transferência. */
				destination_account_id: is_transfer ? values.destination_account_id : undefined,
				invoice_month: is_credit ? chosen_invoice_month : undefined,
				draft: values.draft,
				user_id: values.user_id !== transaction.user_id ? values.user_id : undefined,
				...(origin_changed ? { source_type: source_type as TTransactionSourceType, source_id } : {}),
			};

			if (is_repeating) {
				convertToRecurrence(body, transaction.id);
				return;
			}

			/* Ocorrência de recorrência com descrição/valor novos: pergunta se vale só pra ela ou pras próximas. */
			const rule_changed = description !== transaction.description || value !== transaction.value;
			if (RecurrenceUtils.isRecurringOccurrence(transaction) && rule_changed) {
				setPendingScopeBody(body);
				return;
			}

			updateOnlyThis(body);
			return;
		}

		if (is_repeating) {
			const recurring_total = values.repeat_ends === 'count' ? repeat_count : null;
			createRecurrenceMutation({
				body: {
					source_type: source_type as TTransactionSourceType,
					source_id,
					recurrence_type: repeat_mode === 'installment' ? 'installment' : 'recurring',
					kind: effective_kind,
					description,
					...(repeat_mode === 'installment' ? { total_value: value } : { value }),
					start_date: RecurrenceUtils.toYmd(values.transaction_date),
					frequency: values.frequency,
					value_mode: values.value_varies ? 'estimated' : 'fixed',
					occurrences_total: repeat_mode === 'installment' ? installments : recurring_total,
					credit_card_id: is_credit ? values.credit_card_id : undefined,
					destination_account_id: is_transfer ? values.destination_account_id : undefined,
					user_id: values.user_id || undefined,
				},
				onSuccess: () => finalize(repeat_mode === 'installment' ? 'Compra parcelada criada!' : 'Recorrência criada!'),
				onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar a recorrência')),
			});
			return;
		}

		createTransactionMutation({
			body: {
				description,
				value,
				kind: effective_kind,
				transaction_date,
				settled_date: settled_date || undefined,
				source_type: source_type as TTransactionSourceType,
				source_id,
				credit_card_id: is_credit ? values.credit_card_id : undefined,
				destination_account_id: is_transfer ? values.destination_account_id : undefined,
				invoice_month: is_credit ? chosen_invoice_month || undefined : undefined,
				draft: values.draft,
				user_id: values.user_id || undefined,
			},
			onSuccess: () => finalize('Transação criada!'),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar transação')),
		});
	};

	/* Salva a transação e a transforma na 1ª ocorrência da regra escolhida (o resto ela herda no backend). */
	const convertToRecurrence = (body: TUpdateTransactionBody, transaction_id: string) => {
		const is_installment = repeat_mode === 'installment';
		const recurring_total = values.repeat_ends === 'count' ? repeat_count : null;
		updateTransactionMutation({
			body,
			id: transaction_id,
			onSuccess: () => createRecurrenceMutation({
				body: {
					transaction_id,
					recurrence_type: is_installment ? 'installment' : 'recurring',
					frequency: values.frequency,
					value_mode: values.value_varies ? 'estimated' : 'fixed',
					occurrences_total: is_installment ? installments : recurring_total,
					...(is_installment ? { total_value: body.value } : {}),
				},
				onSuccess: () => finalize(is_installment ? 'Compra parcelada!' : 'Transação agora é recorrente!'),
				onError: (error) => toast.error(getApiErrorMessage(error, 'Transação salva, mas não deu para criar a recorrência')),
			}),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar transação')),
		});
	};

	const updateOnlyThis = (body: TUpdateTransactionBody) => {
		if (!transaction) return;

		updateTransactionMutation({
			body,
			id: transaction.id,
			onSuccess: () => finalize('Transação atualizada!'),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar transação')),
		});
	};

	/*
	 * "Esta e as próximas": a regra passa a valer desta ocorrência em diante (o backend divide a recorrência).
	 * Prevista é regerada pela regra nova; já confirmada recebe também o update dela própria.
	 */
	const updateThisAndFollowing = (body: TUpdateTransactionBody) => {
		if (!transaction?.recurrence_id) return;

		const updateRule = () => updateRecurrenceMutation({
			id: transaction.recurrence_id!,
			body: { description: body.description, value: body.value },
			effective_from: RecurrenceUtils.occurrenceDate(transaction),
			onSuccess: () => finalize('Esta e as próximas atualizadas!'),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar a recorrência')),
		});

		if (transaction.projected) {
			updateRule();
			return;
		}

		updateTransactionMutation({
			body,
			id: transaction.id,
			onSuccess: updateRule,
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar transação')),
		});
	};

	const chooseScope = (scope: 'this' | 'following') => {
		const body = pending_scope_body;
		setPendingScopeBody(null);
		if (!body) return;

		if (scope === 'this') updateOnlyThis(body);
		else updateThisAndFollowing(body);
	};

	/*
	 * ----- Tipo (Saída / Entrada / Transferência) -----
	 * Na criação o tipo vem primeiro (como no mockup) e define as origens possíveis: saída e entrada de conta OU
	 * cartão (entrada no cartão = estorno/crédito, desconta da fatura); transferência, só de conta. Trocar pra um tipo que a origem escolhida não aceita
	 * limpa a origem. Na edição: transferência não é editável e compra de cartão é sempre saída, então as
	 * abas só aparecem (Saída/Entrada) em transação de conta.
	 */
	const setKind = (kind: TTransactionKind) => {
		const clears_origin = kind === 'transfer' && is_credit;
		if (clears_origin) setOriginType(null);
		setValues((prev) => ({
			...prev,
			kind,
			...(clears_origin ? { origin: '', credit_card_id: '' } : {}),
			destination_account_id: kind === 'transfer' ? prev.destination_account_id : '',
		}));
	};

	const kind_tabs = (() => {
		if (!is_editing) return kinds;
		return is_credit || is_transfer ? [] : kind_options_for_form;
	})();

	/* Contas listadas como origem (inclui a conta excluída de uma transação em edição) e se cartão vale aqui. */
	const origin_accounts = [ ...accounts, ...(foreign_source ? [ foreign_source ] : []) ];
	const allows_credit_origin = is_editing ? !is_transfer : values.kind !== 'transfer';

	/* Na criação, se só existe UMA origem possível pro tipo, ela já vem escolhida. */
	useEffect(() => {
		if (!open || is_editing || values.origin) return;
		const candidates = [
			...accounts.map((item) => `Account:${ item.id }`),
			...(allows_credit_origin ? credit_balances.map((item) => `CreditBalance:${ item.id }`) : []),
		];
		if (candidates.length === 1) setOrigin(candidates[0]);
	}, [ open, is_editing, values.origin, values.kind, accounts.length, credit_balances.length ]);

	/* Qual chip está com o popover aberto (um por vez; escolher uma opção fecha). */
	const [ open_chip, setOpenChip ] = useState<string | null>(null);
	const chipOpenProps = (id: string) => ({
		open: open_chip === id,
		onOpenChange: (next: boolean) => setOpenChip(next ? id : null),
	});

	/* Valor ao lado do nome nas listas: saldo da conta ou o que falta pagar da fatura atual do crédito. */
	const renderAmountHint = (type: TTransactionSourceType, id: string) => {
		if (type === 'CreditBalance') {
			const credit_balance = credit_balances.find((item) => item.id === id);
			if (!credit_balance) return null;
			return <span className='shrink-0 text-xs text-muted-foreground'>fatura {MoneyUtils.formatMoney(credit_balance.current_invoice.remaining)}</span>;
		}

		const account = accounts.find((item) => item.id === id);
		if (!account) return null;
		return (
			<span className={cn('shrink-0 text-xs', account.balance < 0 ? 'text-destructive' : 'text-muted-foreground')}>
				{MoneyUtils.formatSignedMoney(account.balance)}
			</span>
		);
	};

	const LIST_ITEM = 'pressable flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-accent active:bg-accent';
	const LIST_LABEL = 'px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

	const renderListItem = (key: string, selected: boolean, onPick: ()=> void, content: React.ReactNode, hint?: React.ReactNode) => (
		<button key={key} type='button' className={cn(LIST_ITEM, selected && 'bg-accent')} onClick={() => { onPick(); setOpenChip(null); }}>
			<span className='flex min-w-0 items-center gap-2'>{content}</span>
			<span className='flex shrink-0 items-center gap-2'>
				{hint}
				{selected && <Check className='h-4 w-4 text-brand' />}
			</span>
		</button>
	);

	/*
	 * Chips de campo (Origem, Quando, Fatura, Responsável…): pílula no celular, cartão com rótulo em cima no
	 * tablet/desktop (grade 2×2 do mockup). `empty` = campo obrigatório ainda sem escolha.
	 */
	const FIELD_CHIP = (empty = false) => cn(
		'pressable inline-flex h-[34px] max-w-full items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[13px] font-semibold hover:bg-accent dark:bg-[rgba(199,195,191,0.05)] data-[state=open]:border-primary/50 data-[state=open]:bg-accent',
		'xl:h-auto xl:w-full xl:flex-col xl:items-start xl:gap-0.5 xl:rounded-2xl xl:px-4 xl:py-2.5 xl:text-sm',
		'disabled:cursor-not-allowed disabled:opacity-60',
		empty && 'text-warning',
	);
	/* Chips de alternância (Repetir, Rascunho): tracejados quando desligados, como no mockup. */
	const TOGGLE_CHIP = (active: boolean) => cn(
		'pressable inline-flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px]',
		active
			? 'border-primary/40 bg-primary/15 font-semibold text-brand'
			: 'border-dashed border-muted-foreground/40 font-medium text-muted-foreground hover:text-foreground',
	);

	/* `extra`: informação ao lado do valor escolhido (saldo da conta, fatura do cartão). */
	const renderChipBody = (label: string, value: string, icon?: React.ReactNode, extra?: React.ReactNode) => (
		<>
			<span className='hidden text-[11px] font-medium text-muted-foreground xl:block'>{label}</span>
			<span className='flex min-w-0 max-w-full items-center gap-1.5'>
				{/* Ícone só na pílula do celular; no cartão com rótulo (tablet/desktop) o rótulo já diz o que é. */}
				{icon && <span className='flex shrink-0 xl:hidden'>{icon}</span>}
				<span className='truncate'>{value}</span>
				{extra && <span className='flex shrink-0 items-center gap-1.5 font-medium'><span className='text-muted-foreground'>·</span>{extra}</span>}
			</span>
		</>
	);

	/* "Hoje, 17:42" / "21 nov · 17:42" */
	const whenLabel = (date: Date) => {
		const time = format(date, 'HH:mm');
		if (isToday(date)) return `Hoje, ${ time }`;
		return `${ format(date, 'd MMM', { locale: ptBR }).replace('.', '') } · ${ time }`;
	};

	/* Calendário + horário dentro do popover de um chip de data. */
	const renderDateTimePicker = (value: Date, onChange: (next: Date)=> void) => (
		<div className='flex flex-col gap-2'>
			<Calendar mode='single' selected={value} onSelect={(picked) => picked && onChange(withDatePart(value, picked))} />
			<div className='flex items-center gap-2 px-3 pb-3'>
				<span className='text-sm text-muted-foreground'>Horário</span>
				<Input
					type='time'
					value={format(value, 'HH:mm')}
					onChange={(e) => onChange(withTimePart(value, e.target.value))}
					className='h-9 flex-1 justify-end text-right [&::-webkit-datetime-edit]:ml-auto [&::-webkit-datetime-edit-fields-wrapper]:justify-end'
				/>
			</div>
		</div>
	);

	const origin_dot = <span className={cn('h-2 w-2 shrink-0 rounded-full', is_credit ? 'bg-info' : 'bg-primary')} />;
	const origin_value = (() => {
		if (!source_id) return is_transfer ? 'De qual conta?' : 'Escolher origem';
		const name = is_credit
			? credit_balances.find((item) => item.id === source_id)?.name
			: origin_accounts.find((item) => item.id === source_id)?.name;
		return name || 'Origem';
	})();

	const renderOriginChip = () => (
		<Popover {...chipOpenProps('origin')}>
			<PopoverTrigger asChild>
				<button type='button' disabled={is_origin_locked || is_pending} className={FIELD_CHIP(!source_id)}>
					{renderChipBody(
						is_transfer ? 'De' : 'Origem',
						origin_value,
						source_id ? origin_dot : null,
						/* Continua mostrando o saldo da conta (ou a fatura do cartão) depois de escolher, não só na lista. */
						source_id ? renderAmountHint(is_credit ? 'CreditBalance' : 'Account', source_id) : null,
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent align='start' className='max-h-80 w-72 overflow-y-auto p-1.5'>
				{origin_accounts.length > 0 && <p className={LIST_LABEL}>Contas</p>}
				{origin_accounts.map((item) => renderListItem(
					item.id,
					values.origin === `Account:${ item.id }`,
					() => setOrigin(`Account:${ item.id }`),
					<><Wallet className='h-3.5 w-3.5 shrink-0 text-brand' /><span className='truncate'>{item.name}</span></>,
					renderAmountHint('Account', item.id),
				))}
				{allows_credit_origin && credit_balances.length > 0 && <p className={LIST_LABEL}>Cartões</p>}
				{allows_credit_origin && credit_balances.map((item) => renderListItem(
					item.id,
					values.origin === `CreditBalance:${ item.id }`,
					() => setOrigin(`CreditBalance:${ item.id }`),
					<><CreditCard className='h-3.5 w-3.5 shrink-0 text-info' /><span className='truncate'>{item.name}</span></>,
					renderAmountHint('CreditBalance', item.id),
				))}
			</PopoverContent>
		</Popover>
	);

	const renderDestinationChip = () => (
		<Popover {...chipOpenProps('destination')}>
			<PopoverTrigger asChild>
				<button type='button' disabled={is_pending} className={FIELD_CHIP(!values.destination_account_id)}>
					{renderChipBody(
						'Para',
						destination_name || 'Para qual conta?',
						values.destination_account_id ? <ArrowRight className='h-3.5 w-3.5 shrink-0' /> : null,
						values.destination_account_id ? renderAmountHint('Account', values.destination_account_id) : null,
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent align='start' className='max-h-80 w-72 overflow-y-auto p-1.5'>
				{destination_options.length === 0 && <p className='px-3 py-2 text-sm text-muted-foreground'>Nenhuma outra conta</p>}
				{destination_options.map((account) => renderListItem(
					account.id,
					values.destination_account_id === account.id,
					() => setDestination(account.id),
					<><Wallet className='h-3.5 w-3.5 shrink-0 text-brand' /><span className='truncate'>{account.name}</span></>,
					renderAmountHint('Account', account.id),
				))}
			</PopoverContent>
		</Popover>
	);

	/* Cartão (plástico) do crédito: só pede escolha quando há mais de um — com um só ele já vem escolhido. */
	const selected_card = credit_cards.find((card) => card.id === values.credit_card_id);
	const cardLabel = (card: { name: string; last_digits?: string | null }) => `${ card.name }${ card.last_digits ? ` ·· ${ card.last_digits }` : '' }`;
	const renderCardChip = () => (
		<Popover {...chipOpenProps('card')}>
			<PopoverTrigger asChild>
				<button type='button' disabled={is_pending} className={FIELD_CHIP(!values.credit_card_id)}>
					{renderChipBody('Cartão', selected_card ? cardLabel(selected_card) : 'Qual cartão?', <CreditCard className='h-3.5 w-3.5 shrink-0' />)}
				</button>
			</PopoverTrigger>
			<PopoverContent align='start' className='w-64 p-1.5'>
				{credit_cards.map((card) => renderListItem(card.id, values.credit_card_id === card.id, () => setCreditCard(card.id), <span className='truncate'>{cardLabel(card)}</span>))}
			</PopoverContent>
		</Popover>
	);

	const renderWhenChip = () => (
		<Popover {...chipOpenProps('when')}>
			<PopoverTrigger asChild>
				<button type='button' disabled={is_pending} className={FIELD_CHIP()}>
					{renderChipBody('Quando', whenLabel(values.transaction_date), <CalendarIcon className='h-3.5 w-3.5 shrink-0' />)}
				</button>
			</PopoverTrigger>
			<PopoverContent align='start' className='w-auto p-0'>
				{renderDateTimePicker(values.transaction_date, (next) => setValues((prev) => ({ ...prev, transaction_date: next })))}
			</PopoverContent>
		</Popover>
	);

	/* "Pago em" (só conta): pendente até marcar; marcar já vem com a data/hora da transação. */
	const renderPaymentChip = () => (
		<Popover {...chipOpenProps('payment')}>
			<PopoverTrigger asChild>
				<button type='button' disabled={is_pending} className={FIELD_CHIP()}>
					{renderChipBody(
						'Pagamento',
						values.settled_date ? `Pago · ${ whenLabel(values.settled_date) }` : 'Pendente',
						values.settled_date
							? <CheckCircle2 className='h-3.5 w-3.5 shrink-0 text-success' />
							: <span className='h-2 w-2 shrink-0 rounded-full bg-warning-dot' />,
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent align='start' className='w-auto p-0'>
				{values.settled_date ? (
					<>
						{/* Desfazer em cima, à vista: no rodapé, abaixo do calendário, ninguém achava. */}
						<div className='flex items-center justify-between gap-3 border-b border-border px-3 py-2'>
							<span className='text-xs font-semibold text-muted-foreground'>Pago em</span>
							<Button
								type='button'
								variant='outline'
								size='sm'
								onClick={() => { setValues((prev) => ({ ...prev, settled_date: null })); setOpenChip(null); }}
							>
								<CircleDashed className='h-3.5 w-3.5' />
								Desfazer pagamento
							</Button>
						</div>
						{renderDateTimePicker(values.settled_date, (next) => setValues((prev) => ({ ...prev, settled_date: next })))}
					</>
				) : (
					<div className='flex w-64 flex-col gap-2 p-3'>
						<p className='text-sm text-muted-foreground'>Ainda não foi pago — entra no previsto, não no saldo.</p>
						<Button
							type='button'
							variant='secondary'
							onClick={() => setValues((prev) => ({ ...prev, settled_date: new Date(prev.transaction_date) }))}
						>
							<CheckCircle2 className='h-4 w-4' />
							Marcar como pago
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);

	/*
	 * Fatura do gasto (`invoice_month`): é ELE que decide de qual fatura a compra é, não a data. Automática =
	 * o backend calcula pelo ciclo do cartão. O "automática" só existe na criação (e na edição que trocou de
	 * origem); na edição a fatura gravada vem direto pra escolha. Mês/ano em botões (Select do Radix dentro
	 * de popover fecharia o popover ao escolher, porque a lista dele abre fora).
	 */
	const can_auto_invoice = !is_editing || origin_changed;
	/*
	 * Fatura em que a compra cai pelo ciclo (o que o "automática" vai gravar): parte da fatura atual do crédito
	 * (`current_invoice`, que traz o ciclo de hoje) e anda um ciclo por mês até a data da compra caber nele.
	 * É só pra mostrar no chip — quem grava de verdade é o backend.
	 */
	const selected_credit = is_credit ? credit_balances.find((item) => item.id === source_id) : undefined;
	const auto_invoice_month = (() => {
		const current = selected_credit?.current_invoice;
		if (!current?.invoice_month || !current.cycle_start || !current.cycle_end) return null;
		const date = values.transaction_date;
		let start = new Date(current.cycle_start);
		let end = new Date(current.cycle_end);
		let offset = 0;
		for (let guard = 0; guard < 240 && date > end; guard += 1) {
			offset += 1;
			start = addMonths(start, 1);
			end = addMonths(end, 1);
		}
		for (let guard = 0; guard < 240 && date < start; guard += 1) {
			offset -= 1;
			start = addMonths(start, -1);
			end = addMonths(end, -1);
		}
		return InvoiceUtils.shiftMonth(current.invoice_month, offset);
	})();
	const invoice_value = (() => {
		if (!is_invoice_auto) return `${ MONTH_NAMES_PT[Number(invoice_month_part) - 1] ?? '' } ${ invoice_year }`.trim();
		return auto_invoice_month ? `${ InvoiceUtils.monthLabel(auto_invoice_month) } · automática` : 'Automática';
	})();
	const shiftInvoiceYear = (delta: number) => setValues((prev) => {
		const [ year, month ] = prev.invoice_month.split('-');
		return { ...prev, invoice_month: `${ Number(year) + delta }-${ month }` };
	});
	const renderInvoiceChip = () => (
		<Popover {...chipOpenProps('invoice')}>
			<PopoverTrigger asChild>
				<button type='button' disabled={is_pending} className={FIELD_CHIP()}>
					{renderChipBody('Fatura', invoice_value, <Receipt className='h-3.5 w-3.5 shrink-0' />)}
				</button>
			</PopoverTrigger>
			<PopoverContent align='start' className='w-72 p-3'>
				<div className='flex flex-col gap-3'>
					{can_auto_invoice && (
						<label className='flex items-center gap-2 text-sm'>
							<Checkbox
								checked={is_invoice_auto}
								onCheckedChange={(checked) => setValues((prev) => ({
									...prev,
									invoice_month: checked === true ? AUTO_INVOICE_MONTH : monthKey(prev.transaction_date),
								}))}
							/>
							<span>Automática <span className='text-muted-foreground'>— pelo ciclo do cartão</span></span>
						</label>
					)}
					{is_invoice_auto && auto_invoice_month && (
						<p className='text-sm'>Cai na fatura de <span className='font-semibold'>{InvoiceUtils.monthLabel(auto_invoice_month)}</span>.</p>
					)}
					{selected_credit && (
						<p className='text-xs text-muted-foreground'>
							Fatura atual ({InvoiceUtils.label(selected_credit.current_invoice)}): {MoneyUtils.formatMoney(selected_credit.current_invoice.remaining)} em aberto
						</p>
					)}
					{!is_invoice_auto && (
						<>
							<div className='flex items-center justify-between'>
								<Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => shiftInvoiceYear(-1)} aria-label='Ano anterior'>
									<ChevronLeft className='h-4 w-4' />
								</Button>
								<span className='text-sm font-semibold'>{invoice_year}</span>
								<Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => shiftInvoiceYear(1)} aria-label='Próximo ano'>
									<ChevronRight className='h-4 w-4' />
								</Button>
							</div>
							<div className='grid grid-cols-3 gap-1'>
								{MONTH_NAMES_PT.map((name, index) => {
									const month = String(index + 1).padStart(2, '0');
									return (
										<button
											key={name}
											type='button'
											onClick={() => setInvoicePart('month', month)}
											className={cn(
												'pressable rounded-xl px-2 py-2 text-xs font-medium',
												month === invoice_month_part ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
											)}
										>
											{name.slice(0, 3)}
										</button>
									);
								})}
							</div>
						</>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);

	const author = members.find((member) => member.id === values.user_id);
	const renderAuthorChip = () => (
		<Popover {...chipOpenProps('author')}>
			<PopoverTrigger asChild>
				<button type='button' disabled={is_pending} className={FIELD_CHIP()}>
					{renderChipBody(
						'Responsável',
						author ? `${ author.name }${ author.id === current_user_id ? ' · você' : '' }` : 'Responsável',
						<UserRound className='h-3.5 w-3.5 shrink-0' />,
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent align='start' className='w-64 p-1.5'>
				{members.map((member) => renderListItem(
					member.id,
					values.user_id === member.id,
					() => setAuthor(member.id),
					<><UserRound className='h-3.5 w-3.5 shrink-0' /><span className='truncate'>{member.name}</span></>,
					member.id === current_user_id ? <span className='text-xs text-muted-foreground'>você</span> : null,
				))}
			</PopoverContent>
		</Popover>
	);

	/* Resumo do "Repetir" no chip: "Mensal", "Mensal · 12x", "10x". */
	const repeat_summary = (() => {
		if (repeat_mode === 'installment') return `${ values.installments }x`;
		const frequency = RECURRENCE_FREQUENCY_OPTIONS.find((option) => option.value === values.frequency)?.label ?? '';
		return values.repeat_ends === 'count' ? `${ frequency } · ${ values.repeat_count }x` : frequency;
	})();

	/* "Repetir" (criação, ou edição de transação avulsa — ela vira a 1ª ocorrência): o painel abre inline. */
	const renderRepeat = () => (
		<div className='flex flex-col gap-3 rounded-2xl border border-border p-4'>
			{repeat_segments.length > 1 && (
				<SegmentedControl
					segments={repeat_segments}
					value={repeat_mode}
					onChange={(next) => setValues((prev) => ({ ...prev, repeat_mode: next as TRepeatMode }))}
				/>
			)}

			{repeat_mode === 'recurring' && (
				<div className='flex flex-col gap-3'>
					<div className='flex gap-3'>
						<div className='flex min-w-0 flex-1 flex-col gap-1.5'>
							<label className='text-sm font-medium'>Frequência</label>
							<Select value={values.frequency} disabled={is_pending} onValueChange={(next) => next && setValues((prev) => ({ ...prev, frequency: next as TRecurrenceFrequency }))}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{RECURRENCE_FREQUENCY_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className='flex min-w-0 flex-1 flex-col gap-1.5'>
							<label className='text-sm font-medium'>Termina</label>
							<Select value={values.repeat_ends} disabled={is_pending} onValueChange={(next) => next && setValues((prev) => ({ ...prev, repeat_ends: next as 'never' | 'count' }))}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='never'>Nunca</SelectItem>
									<SelectItem value='count'>Após N vezes</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{values.repeat_ends === 'count' && (
						<TextInput
							type='number'
							label='Quantas vezes'
							name='repeat_count'
							min={2}
							value={values.repeat_count}
							onChange={(e) => setValues((prev) => ({ ...prev, repeat_count: e.target.value }))}
							disabled={is_pending}
						/>
					)}

					<label className='flex items-center gap-2 text-sm'>
						<Checkbox
							checked={values.value_varies}
							disabled={is_pending}
							onCheckedChange={(checked) => setValues((prev) => ({ ...prev, value_varies: checked === true }))}
						/>
						<span>Valor varia <span className='text-muted-foreground'>— ex.: conta de luz, salário</span></span>
					</label>

					<span className='text-xs text-muted-foreground'>
						As próximas ocorrências entram como previstas e são confirmadas sozinhas quando o banco trouxer a transação.
					</span>
				</div>
			)}

			{repeat_mode === 'installment' && (
				<div className='flex flex-col gap-1.5'>
					<TextInput
						type='number'
						label='Número de parcelas'
						name='installments'
						min={2}
						max={MAX_INSTALLMENTS}
						value={values.installments}
						onChange={(e) => setValues((prev) => ({ ...prev, installments: e.target.value }))}
						disabled={is_pending}
					/>
					<span className='text-xs text-muted-foreground'>
						{installment_split
							? `${ installments }x de ${ MoneyUtils.formatMoney(installment_split.installment) }${ installment_split.first !== installment_split.installment ? ` (1ª de ${ MoneyUtils.formatMoney(installment_split.first) })` : '' }, uma por fatura.`
							: 'O valor digitado é o total da compra; gera todas as parcelas, uma por fatura.'}
					</span>
				</div>
			)}
		</div>
	);

	/* Ocorrência de recorrência/parcela: mostra a regra (e "Editar regra") no lugar do "Repetir". */
	const renderLinkedRecurrence = () => {
		const is_installment = transaction?.recurrence_type === 'installment';
		const title = is_installment
			? `Parcela ${ transaction?.installment_number ?? transaction?.recurrence_index ?? '?' }/${ transaction?.installment_total ?? linked_recurrence?.occurrences_total ?? '?' }`
			: 'Recorrente';
		const rule = linked_recurrence && !is_installment ? RecurrenceUtils.ruleLabel(linked_recurrence) : null;

		return (
			<div className='flex items-start gap-2 rounded-2xl border border-border px-4 py-3 text-sm'>
				<Repeat className='mt-0.5 h-3.5 w-3.5 shrink-0' />
				<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
					<span className='font-medium'>{rule ? `${ title } · ${ rule }` : title}</span>
					<span className='text-xs text-muted-foreground'>
						{is_installment
							? 'Mudanças aqui valem só para esta parcela.'
							: 'Mudar descrição ou valor pergunta se vale só para esta ou para as próximas.'}
					</span>
				</div>
				{linked_recurrence && (
					<button
						type='button'
						className='shrink-0 text-xs font-medium text-brand underline-offset-2 hover:underline'
						onClick={() => setIsRuleDialogOpen(true)}
					>
						Editar regra
					</button>
				)}
			</div>
		);
	};

	/*
	 * ----- Valor -----
	 * Celular: teclado numérico próprio (como no mockup), sem abrir o teclado do sistema. A vírgula é
	 * automática, igual à máscara do campo: os dígitos entram pelos centavos ("1" → 0,01; "1","1" → 0,11).
	 * Os dígitos (centavos) vêm do próprio `value`. A tecla "00" acelera valores redondos. Tablet/desktop:
	 * campo normal com a mesma máscara.
	 */
	/*
	 * Os dígitos do teclado saem do próprio `value` (não de uma cópia): assim o celular e o campo do
	 * desktop sempre mostram o mesmo número — já houve uma cópia separada que ficava em 0,00 depois de
	 * digitar pelo outro campo.
	 */
	const keypad_digits = MoneyUtils.unformatMoney(values.value).replace(/^0+/, '');

	const pressKey = (key: string) => {
		/* Vibração curtinha no Android (o iOS ignora) — o toque do teclado parece de app nativo. */
		try {
			navigator.vibrate?.(8);
		} catch {
			/* sem suporte: segue sem vibrar */
		}
		const next = (key === 'back' ? keypad_digits.slice(0, -1) : `${ keypad_digits }${ key }`).replace(/^0+/, '');
		if (next.length > 11) return;
		setValues((prev) => ({ ...prev, value: next ? MoneyUtils.formatMoney(next) : '' }));
	};

	const keypad_display = MoneyUtils.formatMoney(keypad_digits || '0').replace(/^R\$\s?/, '');

	const plain_value = values.value.replace(/^R\$\s?/, '');
	const effective_kind_title = KIND_TITLE[values.kind];
	const submit_label = is_editing ? 'Salvar alterações' : `Salvar ${ effective_kind_title }`;
	const dialog_title = transaction ? `Editar ${ KIND_TITLE[transaction.kind] }` : 'Nova transação';

	/* ⌘/Ctrl + Enter salva de qualquer campo (o atalho mostrado no botão no desktop). */
	const handleFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !is_submit_disabled) handleSubmit(e);
	};

	const KEYPAD_KEYS = [ '1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back' ];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{/* Celular: tela cheia (como no mockup); tablet/desktop: diálogo. */}
			<DialogContent
				className='max-md:pb-safe max-md:pt-safe max-md:inset-0 max-md:flex max-md:h-dvh max-md:max-h-dvh max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:flex-col max-md:gap-0 max-md:overflow-x-hidden max-md:rounded-none max-md:border-0 max-md:bg-background max-md:p-0 md:max-w-[520px] md:p-6 lg:max-w-[880px] xl:max-w-2xl xl:p-8'
				closeClassName='max-md:left-5 max-md:right-auto max-md:top-[calc(1.25rem+var(--safe-area-inset-top,env(safe-area-inset-top,0px)))] max-md:h-10 max-md:w-10 max-md:bg-white max-md:dark:bg-[rgba(199,195,191,0.05)]'
			>
				{/* Celular: brilho oliva atrás do valor, como no mockup */}
				<div aria-hidden='true' className='pointer-events-none absolute inset-x-0 top-5 h-80 bg-[radial-gradient(60%_50%_at_50%_50%,rgba(137,161,96,0.22)_0%,rgba(137,161,96,0)_100%)] md:hidden' />
				<DialogHeader className='max-md:px-5 max-md:pt-6'>
					<DialogTitle className='max-md:sr-only'>{dialog_title}</DialogTitle>
				</DialogHeader>

				{!is_editing && !has_origins && (
					<div className='flex flex-col items-center gap-4 px-5 py-6 text-center'>
						<div className='flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground'>
							<Landmark className='h-6 w-6' />
						</div>
						<div className='flex flex-col gap-1'>
							<span className='font-medium'>Você ainda não tem contas nem cartões</span>
							<span className='text-sm text-muted-foreground'>
								Toda transação sai de uma conta ou cartão. Crie uma conta para começar a registrar.
							</span>
						</div>
						<Button
							type='button'
							onClick={() => {
								onOpenChange(false);
								navigate('/accounts');
							}}
						>
							Criar minha primeira conta
						</Button>
					</div>
				)}

				{(is_editing || has_origins) && (
					<form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className='relative flex min-h-0 flex-col gap-5 max-md:flex-1 max-md:gap-0 lg:max-xl:grid lg:max-xl:grid-cols-2 lg:max-xl:gap-x-6 lg:max-xl:gap-y-5'>
						{/* Tipo: Saída / Entrada / Transferência — o mesmo SegmentedControl das outras abas do app */}
						{kind_tabs.length > 0 && (
							<div className='flex max-md:pl-[72px] max-md:pr-5 lg:max-xl:col-start-1'>
								<SegmentedControl
									className='w-full'
									value={values.kind}
									onChange={(next) => setKind(next as TTransactionKind)}
									segments={kind_tabs.map((option) => {
										const disabled = option.value === 'transfer' && !can_transfer;
										return {
											value: option.value,
											label: KIND_TAB_LABEL[option.value] ?? option.label,
											disabled: disabled || is_pending,
											title: disabled ? 'Precisa de duas contas nesta carteira' : undefined,
										};
									})}
								/>
							</div>
						)}

						<div className='no-scrollbar flex min-h-0 flex-col gap-5 max-md:flex-1 max-md:overflow-y-auto max-md:px-5 max-md:pb-3 lg:max-xl:col-start-1'>
							{/* Celular e tablets (toque): valor grande preenchido pelo teclado + descrição em pílula */}
							<div className='flex flex-col items-center gap-3.5 pt-8 md:pt-2 xl:hidden'>
								<span className='flex items-baseline gap-1.5'>
									<span className='text-[26px] font-medium text-muted-foreground'>R$</span>
									<span className={cn('text-[64px] font-semibold leading-none tracking-[-0.05em]', !keypad_digits && 'text-muted-foreground/60')}>{keypad_display}</span>
									<span aria-hidden='true' className='h-11 w-[3px] animate-pulse self-center rounded-full bg-primary' />
								</span>
								{repeat_mode === 'installment' && <span className='text-xs text-muted-foreground'>valor total da compra</span>}
								<label htmlFor='transaction-description-mobile' className='sr-only'>Descrição</label>
								<input
									id='transaction-description-mobile'
									value={values.description}
									placeholder={is_transfer ? default_transfer_description || 'Descrição (opcional)' : 'Descrição'}
									onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
									disabled={is_pending}
									className='relative h-[38px] w-[220px] max-w-full rounded-full md:h-10 md:w-[260px] lg:h-[42px] lg:w-[280px] border border-border bg-white px-4 text-center text-[15px] font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground focus:border-primary dark:bg-[rgba(199,195,191,0.05)]'
								/>
							</div>

							{/* Desktop: valor e descrição lado a lado, digitados */}
							{/* Mesma grade de 2 colunas dos chips abaixo, pra as bordas baterem */}
							<div className='hidden gap-2 xl:grid xl:grid-cols-2'>
								<label className='flex flex-col gap-1.5 text-sm font-medium text-muted-foreground'>
									{repeat_mode === 'installment' ? 'Valor total da compra' : 'Valor'}
									<span className='flex h-14 items-center gap-2 rounded-2xl border border-input bg-secondary px-4 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15'>
										<span className='text-lg font-medium text-muted-foreground'>R$</span>
										<input
											inputMode='decimal'
											value={plain_value}
											placeholder='0,00'
											onChange={(e) => setValues((prev) => ({ ...prev, value: MoneyUtils.formatMoney(e.target.value) }))}
											disabled={is_pending}
											className='min-w-0 flex-1 bg-transparent text-[28px] text-foreground font-semibold tracking-[-0.03em] outline-none placeholder:text-muted-foreground/50'
										/>
									</span>
								</label>
								<label className='flex flex-col gap-1.5 text-sm font-medium text-muted-foreground'>
									{is_transfer ? 'Descrição (opcional)' : 'Descrição'}
									<input
										value={values.description}
										placeholder={is_transfer ? default_transfer_description : 'Ex.: Mercado'}
										onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
										disabled={is_pending}
										className='h-14 rounded-2xl border border-input bg-secondary px-4 text-base font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15'
									/>
								</label>
							</div>

							{/* Campos em chips: pílulas no celular, grade 2×2 com rótulo no tablet/desktop */}
							<div className='flex flex-wrap justify-center gap-2 xl:grid xl:grid-cols-2'>
								{renderOriginChip()}
								{is_transfer && renderDestinationChip()}
								{is_credit && source_id && credit_cards.length > 1 && renderCardChip()}
								{renderWhenChip()}
								{!is_credit && !hides_single_fields && renderPaymentChip()}
								{is_credit && !hides_single_fields && renderInvoiceChip()}
								{members.length > 1 && renderAuthorChip()}
							</div>

							{is_credit && values.kind === 'deposit' && !is_editing && (
								<span className='text-center text-xs text-muted-foreground xl:text-left'>Estorno ou crédito no cartão: desconta da fatura em que cair.</span>
							)}

							{is_origin_locked && <span className='text-center text-xs text-muted-foreground xl:text-left'>Pagamento de fatura não pode trocar de origem.</span>}

							{is_credit && source_id && !is_cards_loading && !credit_cards.length && (
								<div className='flex items-start gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-xs text-warning'>
									<AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
									<span className='flex-1'>
										Este crédito não tem cartões. Cadastre um em{' '}
										<button
											type='button'
											className='font-semibold underline'
											onClick={() => { onOpenChange(false); navigate('/accounts'); }}
										>
											Contas &amp; Cartões
										</button>{' '}
										para lançar compras nele.
									</span>
								</div>
							)}

							{/* Alternâncias: Repetir e Rascunho (tracejadas quando desligadas) */}
							{(!linked_recurrence_id || !is_repeating) && (
								<div className='flex flex-wrap justify-center gap-2 xl:justify-start'>
									{!linked_recurrence_id && (
										<button
											type='button'
											disabled={is_pending}
											onClick={() => setValues((prev) => ({ ...prev, repeat_mode: is_repeating ? 'none' : 'recurring' }))}
											className={TOGGLE_CHIP(is_repeating)}
										>
											<Repeat className='h-3.5 w-3.5' />
											{is_repeating ? `Repetir · ${ repeat_summary }` : '+ Repetir'}
										</button>
									)}
									{!is_repeating && (
										<button
											type='button'
											disabled={is_pending}
											onClick={() => setValues((prev) => ({ ...prev, draft: !prev.draft }))}
											className={TOGGLE_CHIP(values.draft)}
											title='Planejamento: fica fora dos totais'
										>
											{values.draft ? <><Check className='h-3.5 w-3.5' /> Rascunho</> : '+ Rascunho'}
										</button>
									)}
								</div>
							)}

							{linked_recurrence_id ? renderLinkedRecurrence() : is_repeating && renderRepeat()}
						</div>

						{/* Celular e tablets: teclado numérico + botão grande de salvar (no tablet deitado, coluna da direita) */}
						<div className='flex flex-col gap-3 px-5 pb-[calc(20px+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] pt-2 md:px-0 md:pb-0 xl:hidden lg:max-xl:col-start-2 lg:max-xl:row-span-2 lg:max-xl:row-start-1 lg:max-xl:self-end'>
							<div className='grid grid-cols-3 gap-1.5'>
								{KEYPAD_KEYS.map((key) => (
									<button
										key={key}
										type='button'
										disabled={is_pending}
										aria-label={key === 'back' ? 'Apagar' : undefined}
										onClick={() => pressKey(key)}
										className={cn(
											'pressable flex h-[54px] items-center justify-center rounded-2xl text-2xl font-medium active:bg-accent md:h-[60px] md:rounded-[18px] md:text-[26px] lg:h-16',
											key === 'back' || key === '00'
												? 'text-muted-foreground hover:bg-accent'
												: 'bg-white hover:bg-accent dark:bg-[rgba(199,195,191,0.06)]',
										)}
									>
										{key === 'back' ? <Delete className='h-6 w-6' /> : key}
									</button>
								))}
							</div>
							<Button type='submit' size='lg' isLoading={is_pending} disabled={is_submit_disabled} className='h-14 w-full text-base font-bold'>
								{submit_label}
								<Check className='h-5 w-5' strokeWidth={2.6} />
							</Button>
						</div>

						{/* Desktop: rodapé com Cancelar + Salvar (atalho Ctrl/⌘ Enter) */}
						<DialogFooter className='hidden xl:flex'>
							<Button type='button' variant='ghost' onClick={() => onOpenChange(false)} disabled={is_pending}>
								Cancelar
							</Button>
							<Button type='submit' isLoading={is_pending} disabled={is_submit_disabled} className='gap-2'>
								{submit_label}
								<kbd className='rounded-md bg-navy/10 px-1.5 py-0.5 font-sans text-[11px] font-semibold'>{SUBMIT_SHORTCUT}</kbd>
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>

			<AlertDialog open={Boolean(pending_scope_body)} onOpenChange={(open) => !open && setPendingScopeBody(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Aplicar a…</AlertDialogTitle>
						<AlertDialogDescription>
							Esta transação é uma recorrência. A mudança de descrição/valor vale só para esta ou para esta e as próximas?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						{/* A ação padrão do AlertDialog é destrutiva (vermelha); aqui é uma edição, então usa os estilos normais. */}
						<AlertDialogAction className={buttonVariants({ variant: 'outline' })} onClick={() => chooseScope('following')}>Esta e as próximas</AlertDialogAction>
						<AlertDialogAction className={buttonVariants({ variant: 'default' })} onClick={() => chooseScope('this')}>Só esta</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<RecurrenceFormDialog open={is_rule_dialog_open} onOpenChange={setIsRuleDialogOpen} recurrence={linked_recurrence ?? null} />
		</Dialog>
	);
};

export default TransactionFormDialog;
