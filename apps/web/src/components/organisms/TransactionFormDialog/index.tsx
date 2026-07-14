import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage, MoneyUtils, type TTransaction, type TTransactionKind, type TTransactionSourceType } from '@myfinance/shared';
import { format } from 'date-fns';
import { AlertTriangle, CalendarIcon, CreditCard, Landmark, Wallet } from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useEnumOptions } from '@/hooks/api/core/useEnumOptions';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useIndexCreditCards } from '@/hooks/api/credit-cards/useIndexCreditCards';
import { useCreateTransactions } from '@/hooks/api/transactions/useCreateTransactions';
import { useSettleTransaction } from '@/hooks/api/transactions/useSettleTransaction';
import { useUpdateTransactions } from '@/hooks/api/transactions/useUpdateTransactions';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import { Calendar } from '@/components/ui/calendar';
import Checkbox from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	transaction?: TTransaction | null;
	suggestedDate?: Date;
}

type TFormValues = {
	/* Origem codificada como `${source_type}:${source_id}` (ex.: "Account:uuid"). */
	origin: string;
	credit_card_id: string;
	kind: TTransactionKind;
	description: string;
	value: string;
	transaction_date: Date;
	pending: boolean;
	draft: boolean;
};

const buildDefaultValues = (suggestedDate?: Date): TFormValues => ({
	origin: '',
	credit_card_id: '',
	kind: 'withdraw',
	description: '',
	value: '',
	transaction_date: suggestedDate ?? new Date(),
	pending: false,
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

const TransactionFormDialog = ({ open, onOpenChange, transaction, suggestedDate }: IProps) => {
	const navigate = useNavigate();
	const { user_wallet } = useWallet();
	const { toast } = useToast();

	const wallet_id = user_wallet.data?.id;
	const is_editing = Boolean(transaction);

	const { mutate: createTransactionMutation, isPending: is_create_pending } = useCreateTransactions();
	const { mutate: updateTransactionMutation, isPending: is_update_pending } = useUpdateTransactions();
	const { mutate: settleTransactionMutation, isPending: is_settle_pending } = useSettleTransaction();
	const { data: kind_options } = useEnumOptions({ entity: 'transaction', type: 'kind' });

	const [ values, setValues ] = useState<TFormValues>(buildDefaultValues(suggestedDate));

	const { source_type, source_id } = parseOrigin(values.origin);
	const is_credit = source_type === 'CreditBalance';

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
			setValues({
				origin: `${ transaction.source_type }:${ transaction.source_id }`,
				credit_card_id: transaction.credit_card_id || '',
				kind: transaction.kind,
				description: transaction.description,
				value: MoneyUtils.formatMoney(transaction.value),
				transaction_date: new Date(transaction.transaction_date),
				pending: !transaction.settled,
				draft: transaction.draft,
			});
		} else {
			setValues(buildDefaultValues(suggestedDate));
		}
	}, [ open, transaction, suggestedDate ]);

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

	const is_pending = is_create_pending || is_update_pending || is_settle_pending;
	const is_submit_disabled = is_pending
		|| !values.value
		|| !values.description
		|| (!is_editing && !values.origin)
		|| (is_credit && !values.credit_card_id);

	const finalize = (message: string) => {
		toast.success(message);
		onOpenChange(false);
	};

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		const value = Number(MoneyUtils.unformatMoney(values.value));
		const effective_kind: TTransactionKind = is_credit ? 'withdraw' : values.kind;
		const transaction_date = values.transaction_date.toISOString();

		if (transaction) {
			updateTransactionMutation({
				body: {
					kind: effective_kind,
					description: values.description,
					value,
					transaction_date,
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
				source_type: source_type as TTransactionSourceType,
				source_id,
				credit_card_id: is_credit ? values.credit_card_id : undefined,
				draft: values.draft,
			},
			onSuccess: (created) => {
				/*
				 * O backend cria toda transação como pendente (não aceita `settled_at` no create).
				 * Se o usuário não marcou "pendente" nem "rascunho", efetivamos logo em seguida.
				 */
				if (!values.draft && !values.pending) {
					settleTransactionMutation({
						id: created.id,
						onSuccess: () => finalize('Transação criada e efetivada!'),
						onError: () => finalize('Transação criada como pendente (não foi possível efetivar agora)'),
					});
					return;
				}
				finalize('Transação criada!');
			},
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

				{!is_editing && !has_origins ? (
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
				) : (
					<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
						<div className='flex flex-col gap-1.5'>
							<label className='text-sm font-medium'>Origem</label>
							<Select
								value={values.origin}
								disabled={is_editing}
								onValueChange={(origin) => setValues((prev) => ({ ...prev, origin, credit_card_id: '' }))}
							>
								<SelectTrigger>
									<SelectValue placeholder='Escolha a conta ou cartão' />
								</SelectTrigger>
								<SelectContent>
									{accounts.length > 0 && (
										<SelectGroup>
											<SelectLabel>Contas</SelectLabel>
											{accounts.map((account) => (
												<SelectItem key={account.id} value={`Account:${ account.id }`}>
													<span className='flex items-center gap-2'>
														<Wallet className='h-3.5 w-3.5' />
														{account.name}
													</span>
												</SelectItem>
											))}
										</SelectGroup>
									)}
									{credit_balances.length > 0 && (
										<SelectGroup>
											<SelectLabel>Crédito</SelectLabel>
											{credit_balances.map((credit_balance) => (
												<SelectItem key={credit_balance.id} value={`CreditBalance:${ credit_balance.id }`}>
													<span className='flex items-center gap-2'>
														<CreditCard className='h-3.5 w-3.5' />
														{credit_balance.name}
													</span>
												</SelectItem>
											))}
										</SelectGroup>
									)}
								</SelectContent>
							</Select>
						</div>

						{is_credit && (
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

						<div className='flex flex-col gap-4 sm:flex-row'>
							<TextInput
								type='text'
								label='Valor'
								name='value'
								placeholder='R$ 0,00'
								value={values.value}
								onChange={(e) => setValues((prev) => ({ ...prev, value: MoneyUtils.formatMoney(e.target.value) }))}
								disabled={is_pending}
								className='flex-1'
							/>

							<div className='flex flex-1 flex-col gap-1.5'>
								<label className='text-sm font-medium'>Data</label>
								<Popover>
									<PopoverTrigger asChild>
										<Button type='button' variant='outline' disabled={is_pending} className='justify-start gap-2 font-normal'>
											<CalendarIcon className='h-4 w-4' />
											{format(values.transaction_date, 'dd/MM/yyyy')}
										</Button>
									</PopoverTrigger>
									<PopoverContent className='w-auto p-0' align='start'>
										<Calendar
											mode='single'
											selected={values.transaction_date}
											onSelect={(date) => date && setValues((prev) => ({ ...prev, transaction_date: date }))}
										/>
									</PopoverContent>
								</Popover>
							</div>
						</div>

						<div className='flex flex-col gap-2'>
							<label className={cn('flex items-center gap-2 text-sm', values.draft && 'opacity-50')}>
								<Checkbox
									checked={values.pending}
									disabled={values.draft}
									onCheckedChange={(checked) => setValues((prev) => ({ ...prev, pending: checked === true }))}
								/>
								<span>Pendente <span className='text-muted-foreground'>— ainda não efetivada (só no previsto)</span></span>
							</label>
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
