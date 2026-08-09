import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage, MoneyUtils, type TTransaction, type TTransactionKind, type TTransactionSourceType } from '@myfinance/shared';
import { AlertTriangle, CalendarIcon, CreditCard, Landmark, Wallet, X } from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useEnumOptions } from '@/hooks/api/core/useEnumOptions';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useIndexCreditCards } from '@/hooks/api/credit-cards/useIndexCreditCards';
import { useCreateTransactions } from '@/hooks/api/transactions/useCreateTransactions';
import { useUpdateTransactions } from '@/hooks/api/transactions/useUpdateTransactions';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import DateTimeField from '@/components/molecules/DateTimeField';
import Checkbox from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
	/* "Data prevista" (transaction_date) — carrega data + horário. */
	transaction_date: Date;
	/* "Pago em" (settled_date) — `null` = pendente. Carrega data + horário. */
	settled_date: Date | null;
	draft: boolean;
};

const buildDefaultValues = (suggestedDate?: Date, origin = ''): TFormValues => ({
	origin,
	credit_card_id: '',
	kind: 'withdraw',
	description: '',
	value: '',
	transaction_date: suggestedDate ?? new Date(),
	settled_date: null,
	draft: false,
});

const DEFAULT_KIND_OPTIONS = [
	{ value: 'withdraw', label: 'Saída' },
	{ value: 'deposit', label: 'Entrada' },
];

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
		? [ ...kind_options ].sort((a) => (a.value === 'withdraw' ? -1 : 1))
		: DEFAULT_KIND_OPTIONS;

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
				draft: transaction.draft,
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
		|| !values.description
		|| (!is_editing && !values.origin)
		|| (is_credit && !values.credit_card_id);

	/* Etapa 1 → 2: escolhe o tipo e, se só houver uma origem daquele tipo, já a pré-seleciona. */
	const chooseOriginType = (type: TTransactionSourceType) => {
		const list = type === 'Account' ? accounts : credit_balances;
		setOriginType(type);
		setValues((prev) => ({ ...prev, origin: list.length === 1 ? `${ type }:${ list[0].id }` : '', credit_card_id: '' }));
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
		 * "Pago em" só é controlável em conta — o crédito é auto-efetivado pelo backend (settled_date =
		 * transaction_date), então nem enviamos o campo (seria sobrescrito). Em conta, `null` = pendente.
		 */
		const account_settled_date = values.settled_date ? values.settled_date.toISOString() : null;
		const settled_date = is_credit ? undefined : account_settled_date;

		if (transaction) {
			updateTransactionMutation({
				body: {
					kind: effective_kind,
					description: values.description,
					value,
					transaction_date,
					settled_date,
					credit_card_id: is_credit ? values.credit_card_id : undefined,
					draft: values.draft,
				},
				id: transaction.id,
				onSuccess: () => finalize('Transação atualizada!'),
				onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar transação')),
			});
			return;
		}

		createTransactionMutation({
			body: {
				description: values.description,
				value,
				kind: effective_kind,
				transaction_date,
				settled_date: settled_date || undefined,
				source_type: source_type as TTransactionSourceType,
				source_id,
				credit_card_id: is_credit ? values.credit_card_id : undefined,
				draft: values.draft,
			},
			onSuccess: () => finalize('Transação criada!'),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar transação')),
		});
	};

	const dialog_title = transaction
		? `Editar ${ transaction.kind === 'deposit' ? 'entrada' : 'saída' }`
		: 'Nova transação';

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
						<span className='text-sm text-muted-foreground'>De onde sai essa transação?</span>
						<div className='grid grid-cols-2 gap-3'>
							<button
								type='button'
								disabled={!accounts.length}
								onClick={() => chooseOriginType('Account')}
								className='flex flex-col items-center gap-2 rounded-lg border border-input p-5 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
							>
								<Wallet className='h-6 w-6 text-brand-secondary' />
								Conta
								{!accounts.length && <span className='text-[11px] font-normal text-muted-foreground'>nenhuma conta</span>}
							</button>
							<button
								type='button'
								disabled={!credit_balances.length}
								onClick={() => chooseOriginType('CreditBalance')}
								className='flex flex-col items-center gap-2 rounded-lg border border-input p-5 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
							>
								<CreditCard className='h-6 w-6 text-feedback-info-default' />
								Cartão
								{!credit_balances.length && <span className='text-[11px] font-normal text-muted-foreground'>nenhum cartão</span>}
							</button>
						</div>
					</div>
				)}

				{/* Etapa 2: o formulário (na edição entra direto aqui) */}
				{(is_editing || origin_type !== null) && (
					<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
						<div className='flex flex-col gap-1.5'>
							<div className='flex items-center justify-between'>
								<label className='text-sm font-medium'>{is_credit ? 'Crédito' : 'Conta'}</label>
								{!is_editing && (
									<button type='button' onClick={backToTypeStep} className='text-xs font-medium text-muted-foreground hover:text-foreground'>
										← Trocar tipo
									</button>
								)}
							</div>
							<Select
								value={values.origin}
								disabled={is_editing}
								onValueChange={(origin) => setValues((prev) => ({ ...prev, origin, credit_card_id: '' }))}
							>
								<SelectTrigger>
									<SelectValue placeholder={is_credit ? 'Escolha o crédito' : 'Escolha a conta'} />
								</SelectTrigger>
								<SelectContent>
									{(is_credit ? credit_balances : accounts).map((origin_item) => (
										<SelectItem key={origin_item.id} value={`${ is_credit ? 'CreditBalance' : 'Account' }:${ origin_item.id }`}>
											<span className='flex items-center gap-2'>
												{is_credit ? <CreditCard className='h-3.5 w-3.5' /> : <Wallet className='h-3.5 w-3.5' />}
												{origin_item.name}
											</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Só depois de escolher um crédito específico (source_id) — senão o aviso apareceria à toa */}
						{is_credit && source_id && (
							<div className='flex flex-col gap-1.5'>
								<label className='text-sm font-medium'>Cartão</label>
								<Select
									value={values.credit_card_id}
									disabled={!credit_cards.length}
									onValueChange={(credit_card_id) => setValues((prev) => ({ ...prev, credit_card_id }))}
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

						{!is_credit && (
							<div className='flex flex-col gap-1.5'>
								<label className='text-sm font-medium'>Tipo</label>
								<Select value={values.kind} onValueChange={(value) => setValues((prev) => ({ ...prev, kind: value as TTransactionKind }))}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{kinds.map((option) => (
											<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}

						<TextInput
							type='text'
							label='Descrição'
							name='description'
							placeholder='Digite a descrição'
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
							<label className='text-sm font-medium'>{is_credit ? 'Data da transação' : 'Data prevista'}</label>
							<DateTimeField
								value={values.transaction_date}
								disabled={is_pending}
								onChange={(next) => setValues((prev) => ({ ...prev, transaction_date: next }))}
							/>
						</div>

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
										className='justify-start gap-2 font-normal text-muted-foreground'
										onClick={() => setValues((prev) => ({ ...prev, settled_date: new Date() }))}
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
