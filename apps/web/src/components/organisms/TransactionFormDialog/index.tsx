import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DateUtils, getApiErrorMessage, MONTH_NAMES_PT, MoneyUtils, TransactionUtils, type TTransaction, type TTransactionKind, type TTransactionSourceType } from '@myfinance/shared';
import { AlertTriangle, ArrowLeftRight, CalendarIcon, CreditCard, Landmark, Wallet, X } from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useEnumOptions } from '@/hooks/api/core/useEnumOptions';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useIndexCreditCards } from '@/hooks/api/credit-cards/useIndexCreditCards';
import { useCreateTransactions } from '@/hooks/api/transactions/useCreateTransactions';
import { useUpdateTransactions } from '@/hooks/api/transactions/useUpdateTransactions';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import DateTimeField from '@/components/molecules/DateTimeField';
import Checkbox from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FIELD_METRICS } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	transaction?: TTransaction | null;
	suggestedDate?: Date;
	/* Origem pré-selecionada na criação (ex.: a origem que a lista está filtrando). */
	defaultSourceType?: TTransactionSourceType;
	defaultSourceId?: string;
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
};

/* Sentinela do "deixa o backend decidir" — o Select do Radix não aceita item com value vazio. */
const AUTO_INVOICE_MONTH = 'auto';

const buildDefaultValues = (suggestedDate?: Date, origin = ''): TFormValues => ({
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
});

/* "YYYY-MM" de um Date, no fuso local — o formato do `invoice_month`. */
const monthKey = (date: Date): string =>
	`${ date.getFullYear() }-${ String(date.getMonth() + 1).padStart(2, '0') }`;

/*
 * Anos do seletor de fatura: dois pra trás, o atual e dois pra frente. O ano do valor atual entra mesmo
 * fora dessa janela, pra uma transação numa fatura antiga não abrir com o select vazio.
 */
const buildInvoiceYearOptions = (current: string): string[] => {
	const this_year = new Date().getFullYear();
	const window_years = Array.from({ length: 5 }, (_unused, index) => String(this_year - 2 + index));
	const [ year_part ] = current.split('-');
	const current_year = /^\d{4}$/.test(year_part) ? year_part : '';
	return Array.from(new Set(current_year ? [ current_year, ...window_years ] : window_years)).sort();
};

const DEFAULT_KIND_OPTIONS = [
	{ value: 'withdraw', label: 'Saída' },
	{ value: 'deposit', label: 'Entrada' },
	{ value: 'transfer', label: 'Transferência' },
];

/* Ordem fixa do select "Tipo", independente da ordem em que a API devolve as opções. */
const KIND_ORDER: string[] = [ 'withdraw', 'deposit', 'transfer' ];

const KIND_TITLE: Record<TTransactionKind, string> = { deposit: 'entrada', withdraw: 'saída', transfer: 'transferência' };

const parseOrigin = (origin: string): { source_type: TTransactionSourceType | ''; source_id: string } => {
	const [ source_type, source_id ] = origin.split(':');
	return { source_type: (source_type as TTransactionSourceType) || '', source_id: source_id || '' };
};

const TransactionFormDialog = ({ open, onOpenChange, transaction, suggestedDate, defaultSourceType, defaultSourceId }: IProps) => {
	const navigate = useNavigate();
	const { user_wallet } = useWallet();
	const { toast } = useToast();

	const wallet_id = user_wallet.data?.id;
	const is_editing = Boolean(transaction);
	const default_origin = defaultSourceType && defaultSourceId ? `${ defaultSourceType }:${ defaultSourceId }` : '';

	const { mutate: createTransactionMutation, isPending: is_create_pending } = useCreateTransactions();
	const { mutate: updateTransactionMutation, isPending: is_update_pending } = useUpdateTransactions();
	const { data: kind_options } = useEnumOptions({ entity: 'transaction', type: 'kind' });

	const [ values, setValues ] = useState<TFormValues>(buildDefaultValues(suggestedDate, default_origin));
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

	const accounts = accounts_data?.data || [];
	const credit_balances = credit_balances_data?.data || [];
	const credit_cards = credit_cards_data?.data || [];
	const has_origins = accounts.length > 0 || credit_balances.length > 0;

	/* Se o crédito escolhido tem exatamente um cartão, não faz sentido obrigar a escolher — pré-seleciona. */
	const single_card_id = credit_cards.length === 1 ? credit_cards[0].id : null;

	const kinds = kind_options?.length
		? [ ...kind_options ].sort((a, b) => KIND_ORDER.indexOf(a.value) - KIND_ORDER.indexOf(b.value))
		: DEFAULT_KIND_OPTIONS;

	/* Transferência só sai de conta — em crédito o `kind` é sempre saída (ver `effective_kind`). */
	const is_transfer = !is_credit && values.kind === 'transfer';
	/*
	 * Transferência é escolhida na etapa 1 (botão próprio) e NÃO é editável (a lista não oferece "Editar"
	 * pra ela). Então o "Tipo" de uma conta é só Entrada/Saída — nem na edição uma transação vira
	 * transferência — e numa transferência ele some.
	 */
	const kind_options_for_form = kinds.filter((option) => option.value !== 'transfer');
	const show_kind_select = !is_credit && !is_transfer;

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
			});
		} else {
			setOriginType(defaultSourceType ?? null);
			setValues(buildDefaultValues(suggestedDate, default_origin));
		}
	}, [ open, transaction, suggestedDate, default_origin, defaultSourceType ]);

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

	const is_pending = is_create_pending || is_update_pending;
	const is_submit_disabled = is_pending
		|| !values.value
		|| (!is_transfer && !values.description.trim())
		|| (!is_editing && !values.origin)
		|| (is_credit && !values.credit_card_id)
		|| (is_transfer && !values.destination_account_id);

	/*
	 * Etapa 1 → 2: escolhe o tipo e, se só houver uma origem daquele tipo, já a pré-seleciona. Transferência
	 * é uma conta com `kind: 'transfer'`; escolher Conta volta o kind pra saída (caso tenha passado por ela).
	 */
	const chooseOriginType = (type: TTransactionSourceType, kind: TTransactionKind = 'withdraw') => {
		const list = type === 'Account' ? accounts : credit_balances;
		setOriginType(type);
		setValues((prev) => ({
			...prev,
			origin: list.length === 1 ? `${ type }:${ list[0].id }` : '',
			credit_card_id: '',
			destination_account_id: '',
			kind,
		}));
	};

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

	const setCreditCard = (credit_card_id: string) => {
		if (credit_card_id) setValues((prev) => ({ ...prev, credit_card_id }));
	};

	/* Volta pra etapa 1 (só na criação), limpando a origem escolhida. */
	const backToTypeStep = () => {
		setOriginType(null);
		setValues((prev) => ({ ...prev, origin: '', credit_card_id: '' }));
	};

	const finalize = (message: string) => {
		toast.success(message);
		onOpenChange(false);
	};

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		const value = Number(MoneyUtils.unformatMoney(values.value));
		const effective_kind: TTransactionKind = is_credit ? 'withdraw' : values.kind;
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

			updateTransactionMutation({
				body: {
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
					...(origin_changed ? { source_type: source_type as TTransactionSourceType, source_id } : {}),
				},
				id: transaction.id,
				onSuccess: () => finalize('Transação atualizada!'),
				onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar transação')),
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
			},
			onSuccess: () => finalize('Transação criada!'),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar transação')),
		});
	};

	const origin_label = (() => {
		if (is_credit) return 'Crédito';
		return is_transfer ? 'Da conta' : 'Conta';
	})();

	/*
	 * Valor ao lado do nome nas opções: saldo da conta, ou o total da fatura atual do crédito — ajuda a
	 * escolher de onde sai o dinheiro. Origem/destino de outra carteira não está nas listas: fica sem valor.
	 */
	const renderAmountHint = (type: TTransactionSourceType, id: string) => {
		if (type === 'CreditBalance') {
			const credit_balance = credit_balances.find((item) => item.id === id);
			if (!credit_balance) return null;
			return <span className='text-xs text-muted-foreground'>fatura {MoneyUtils.formatMoney(credit_balance.current_invoice.remaining)}</span>;
		}

		const account = accounts.find((item) => item.id === id);
		if (!account) return null;
		return (
			<span className={cn('text-xs', account.balance < 0 ? 'text-destructive' : 'text-muted-foreground')}>
				{MoneyUtils.formatSignedMoney(account.balance)}
			</span>
		);
	};

	const renderOriginItem = (type: TTransactionSourceType, origin_item: { id: string; name: string }) => (
		<SelectItem key={origin_item.id} value={`${ type }:${ origin_item.id }`}>
			<span className='flex items-center gap-2'>
				{type === 'CreditBalance' ? <CreditCard className='h-3.5 w-3.5' /> : <Wallet className='h-3.5 w-3.5' />}
				{origin_item.name}
				{renderAmountHint(type, origin_item.id)}
			</span>
		</SelectItem>
	);

	const dialog_title = transaction ? `Editar ${ KIND_TITLE[transaction.kind] }` : 'Nova transação';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{dialog_title}</DialogTitle>
				</DialogHeader>

				{!is_editing && !has_origins && (
					<div className='flex flex-col items-center gap-4 py-6 text-center'>
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

				{/* Etapa 1 (só criação): escolher o tipo de origem antes de ver as opções */}
				{!is_editing && has_origins && origin_type === null && (
					<div className='flex flex-col gap-3 py-2'>
						<span className='text-sm text-muted-foreground'>Que tipo de transação?</span>
						<div className='grid grid-cols-3 gap-2 sm:gap-3'>
							<button
								type='button'
								disabled={!accounts.length}
								onClick={() => chooseOriginType('Account')}
								className='flex flex-col items-center gap-2 rounded-lg border border-input px-2 py-5 text-center text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
							>
								<Wallet className='h-6 w-6 text-brand-secondary' />
								Conta
								{!accounts.length && <span className='text-[11px] font-normal text-muted-foreground'>nenhuma conta</span>}
							</button>
							<button
								type='button'
								disabled={!credit_balances.length}
								onClick={() => chooseOriginType('CreditBalance')}
								className='flex flex-col items-center gap-2 rounded-lg border border-input px-2 py-5 text-center text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
							>
								<CreditCard className='h-6 w-6 text-feedback-info-default' />
								Cartão
								{!credit_balances.length && <span className='text-[11px] font-normal text-muted-foreground'>nenhum cartão</span>}
							</button>
							<button
								type='button'
								disabled={!can_transfer}
								onClick={() => chooseOriginType('Account', 'transfer')}
								className='flex flex-col items-center gap-2 rounded-lg border border-input px-2 py-5 text-center text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
							>
								<ArrowLeftRight className='h-6 w-6 text-feedback-info-default' />
								Transferência
								{!can_transfer && <span className='text-[11px] font-normal text-muted-foreground'>precisa de 2 contas</span>}
							</button>
						</div>
					</div>
				)}

				{/* Etapa 2: o formulário (na edição entra direto aqui) */}
				{(is_editing || origin_type !== null) && (
					<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
						{/*
						 * Em conta, origem e tipo dividem a linha (dois campos curtos, sem precisar de linha própria);
						 * em cartão a origem ocupa a linha toda, porque logo abaixo vem o campo "Cartão".
						 */}
						<div className='flex gap-4'>
							<div className='flex min-w-0 flex-1 flex-col gap-1.5'>
								<label className='text-sm font-medium'>{is_editing ? 'Origem' : origin_label}</label>
								<Select value={values.origin} disabled={is_origin_locked} onValueChange={setOrigin}>
									<SelectTrigger>
										<SelectValue placeholder={is_credit ? 'Escolha o crédito' : 'Escolha a conta'} />
									</SelectTrigger>
									<SelectContent>
										{/* Na criação o tipo já foi escolhido na etapa 1; na edição dá pra trocar de tipo aqui. */}
										{is_editing ? (
											<>
												{accounts.length > 0 && (
													<SelectGroup>
														<SelectLabel>Contas</SelectLabel>
														{accounts.map((origin_item) => renderOriginItem('Account', origin_item))}
														{foreign_source && renderOriginItem('Account', foreign_source)}
													</SelectGroup>
												)}
												{credit_balances.length > 0 && (
													<SelectGroup>
														<SelectLabel>Créditos</SelectLabel>
														{credit_balances.map((origin_item) => renderOriginItem('CreditBalance', origin_item))}
													</SelectGroup>
												)}
											</>
										) : (
											(is_credit ? credit_balances : accounts).map((origin_item) => (
												renderOriginItem(is_credit ? 'CreditBalance' : 'Account', origin_item)
											))
										)}
									</SelectContent>
								</Select>
								{is_origin_locked && <span className='text-xs text-muted-foreground'>Pagamento de fatura não pode trocar de origem.</span>}
							</div>

							{show_kind_select && (
								<div className='flex min-w-0 flex-1 flex-col gap-1.5'>
									<label className='text-sm font-medium'>Tipo</label>
									<Select value={values.kind} onValueChange={(value) => value && setValues((prev) => ({ ...prev, kind: value as TTransactionKind }))}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{kind_options_for_form.map((option) => (
												<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</div>

						{/* Só depois de escolher um crédito específico (source_id) — senão o aviso apareceria à toa */}
						{/* Destino da transferência: contas da carteira (menos a origem) + o destino atual, se for de outra */}
						{is_transfer && (
							<div className='flex flex-col gap-1.5'>
								<label className='text-sm font-medium'>Para a conta</label>
								<Select value={values.destination_account_id} disabled={is_pending} onValueChange={setDestination}>
									<SelectTrigger>
										<SelectValue placeholder={destination_options.length ? 'Escolha a conta de destino' : 'Nenhuma outra conta'} />
									</SelectTrigger>
									<SelectContent>
										{destination_options.map((account) => (
											<SelectItem key={account.id} value={account.id}>
												<span className='flex items-center gap-2'>
													<Wallet className='h-3.5 w-3.5' />
													{account.name}
													{renderAmountHint('Account', account.id)}
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}

						{is_credit && source_id && (
							<div className='flex flex-col gap-1.5'>
								<label className='text-sm font-medium'>Cartão</label>
								<Select
									value={values.credit_card_id}
									disabled={!credit_cards.length}
									onValueChange={setCreditCard}
								>
									<SelectTrigger>
										<SelectValue placeholder={credit_cards.length ? 'Escolha o cartão' : 'Nenhum cartão neste crédito'} />
									</SelectTrigger>
									<SelectContent>
										{credit_cards.map((card) => (
											<SelectItem key={card.id} value={card.id}>
												{card.name}{card.last_digits ? ` ·· ${ card.last_digits }` : ''}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								{!is_cards_loading && !credit_cards.length && (
									<div className='flex items-start gap-2 rounded-md bg-feedback-warning-light px-3 py-2 text-xs text-feedback-warning-dark'>
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
							</div>
						)}

						<TextInput
							type='text'
							label={is_transfer ? 'Descrição (opcional)' : 'Descrição'}
							name='description'
							placeholder={is_transfer ? default_transfer_description : 'Digite a descrição'}
							value={values.description}
							onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
							disabled={is_pending}
						/>

						<TextInput
							type='text'
							label='Valor'
							name='value'
							placeholder='R$ 0,00'
							value={values.value}
							onChange={(e) => setValues((prev) => ({ ...prev, value: MoneyUtils.formatMoney(e.target.value) }))}
							disabled={is_pending}
						/>

						<div className='flex flex-col gap-1.5'>
							<label className='text-sm font-medium'>Data da transação</label>
							<DateTimeField
								value={values.transaction_date}
								disabled={is_pending}
								onChange={(next) => setValues((prev) => ({ ...prev, transaction_date: next }))}
							/>
						</div>

						{/*
						 * Fatura do gasto (`invoice_month`): é ELE que decide de qual fatura a compra é, não a data.
						 * Marcado, o backend calcula pelo ciclo do cartão. Desmarcar serve pra jogar a compra pra
						 * outra fatura (parcelamento, compra lançada fora do ciclo) sem mentir na data da transação.
						 */}
						{is_credit && (
							<div className='flex flex-col gap-2'>
								{/* O checkbox só existe na criação (e na edição que trocou de origem), pra o usuário não precisar
								    pensar na fatura. Na edição a transação já tem a fatura gravada, então os seletores aparecem
								    direto com ela. */}
								{(!is_editing || origin_changed) && (
									<label className='flex items-center gap-2 text-sm'>
										<Checkbox
											checked={is_invoice_auto}
											disabled={is_pending}
											onCheckedChange={(checked) => setValues((prev) => ({
												...prev,
												invoice_month: checked === true ? AUTO_INVOICE_MONTH : monthKey(prev.transaction_date),
											}))}
										/>
										<span>Fatura automática <span className='text-muted-foreground'>— pelo ciclo do cartão</span></span>
									</label>
								)}
								{is_editing && !origin_changed && <span className='text-sm font-medium'>Fatura</span>}

								{!is_invoice_auto && (
									<div className='flex gap-4'>
										<div className='flex min-w-0 flex-1 flex-col gap-1.5'>
											<label className='text-sm font-medium'>Mês</label>
											<Select value={invoice_month_part} disabled={is_pending} onValueChange={(month) => setInvoicePart('month', month)}>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{MONTH_NAMES_PT.map((name, index) => (
														<SelectItem key={name} value={String(index + 1).padStart(2, '0')}>{name}</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className='flex min-w-0 flex-1 flex-col gap-1.5'>
											<label className='text-sm font-medium'>Ano</label>
											<Select value={invoice_year} disabled={is_pending} onValueChange={(year) => setInvoicePart('year', year)}>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{buildInvoiceYearOptions(values.invoice_month).map((year) => (
														<SelectItem key={year} value={year}>{year}</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>
								)}
							</div>
						)}

						{/* "Pago em" só aparece em conta — crédito é efetivado automaticamente pelo backend */}
						{!is_credit && (
							<div className='flex flex-col gap-1.5'>
								<label className='text-sm font-medium'>
									Pago em <span className='font-normal text-muted-foreground'>— vazio = pendente</span>
								</label>
								{values.settled_date ? (
									<div className='flex items-center gap-2'>
										<div className='flex-1'>
											<DateTimeField
												value={values.settled_date}
												disabled={is_pending}
												onChange={(next) => setValues((prev) => ({ ...prev, settled_date: next }))}
											/>
										</div>
										<Button
											type='button'
											variant='ghost'
											size='icon'
											disabled={is_pending}
											aria-label='Marcar como pendente'
											onClick={() => setValues((prev) => ({ ...prev, settled_date: null }))}
										>
											<X className='h-4 w-4' />
										</Button>
									</div>
								) : (
									<Button
										type='button'
										variant='outline'
										disabled={is_pending}
										className={`${ FIELD_METRICS } justify-start gap-2 text-muted-foreground`}
										onClick={() => setValues((prev) => ({ ...prev, settled_date: new Date(prev.transaction_date) }))}
									>
										<CalendarIcon className='h-4 w-4' />
										Marcar como pago
									</Button>
								)}
							</div>
						)}

						<div className='flex flex-col gap-2'>
							<label className='flex items-center gap-2 text-sm'>
								<Checkbox
									checked={values.draft}
									onCheckedChange={(checked) => setValues((prev) => ({ ...prev, draft: checked === true }))}
								/>
								<span>Rascunho <span className='text-muted-foreground'>— planejamento, fora dos totais</span></span>
							</label>
						</div>

						<DialogFooter>
							{/* Ação secundária: fica à esquerda no desktop (`mr-auto`) e por último no mobile, onde o rodapé empilha. */}
							{!is_editing && (
								<Button type='button' variant='ghost' onClick={backToTypeStep} disabled={is_pending} className='sm:mr-auto'>
									← Trocar tipo
								</Button>
							)}
							<Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={is_pending}>
								Cancelar
							</Button>
							<Button type='submit' isLoading={is_pending} disabled={is_submit_disabled}>
								Salvar
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default TransactionFormDialog;
