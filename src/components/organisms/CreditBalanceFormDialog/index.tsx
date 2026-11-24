import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, MoneyUtils, type TCreditBalance } from '@myfinance/shared';
import { CreditCard, Info, Wallet } from 'lucide-react';

import { useCreateCreditBalance } from '@/hooks/api/credit-balances/useCreateCreditBalance';
import { useUpdateCreditBalance } from '@/hooks/api/credit-balances/useUpdateCreditBalance';
import { useIndexCreditCards } from '@/hooks/api/credit-cards/useIndexCreditCards';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import { GLASS_TILE } from '@/components/molecules/NavKit';
import { AffixInput, Field, FIELD_INPUT, SheetDialog, SheetDialogFooter } from '@/components/molecules/SheetDialog';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	creditBalance?: TCreditBalance | null;
}

/* Mantém o dígito entre 1 e 31 (melhor dia de compra / vencimento). */
const clampDay = (value: string): string => {
	const digits = value.replace(/\D/g, '').slice(0, 2);
	if (!digits) return '';
	return String(Math.min(31, Math.max(1, Number(digits))));
};

/* O ciclo vai do melhor dia de compra até a véspera dele no mês seguinte; dia 1 = mês-calendário. */
const cycleLabel = (best_day: number): string => (best_day === 1
	? 'dia 1 até o fim do mês'
	: `dia ${ best_day } até dia ${ best_day - 1 } do mês seguinte`);

/* Novo/editar crédito (redesign 2026-11, mockup "DlgCreditBalance"): nome, limite, dias e o ciclo resultante. */
const CreditBalanceFormDialog = ({ open, onOpenChange, creditBalance }: IProps) => {
	const { user_wallet } = useWallet();
	const { toast } = useToast();

	const { mutate: createMutation, isPending: is_create_pending } = useCreateCreditBalance();
	const { mutate: updateMutation, isPending: is_update_pending } = useUpdateCreditBalance();

	/* Só pra linha de contexto ("compartilhados por N cartões") — mesma query do detalhe do cartão, já em cache. */
	const { data: cards_data } = useIndexCreditCards({
		enabled: open && Boolean(creditBalance),
		params: { credit_balance_id: creditBalance?.id || '' },
	});
	const cards_count = cards_data?.data?.length ?? 0;

	const [ name, setName ] = useState('');
	const [ credit_limit, setCreditLimit ] = useState('');
	const [ best_purchase_day, setBestPurchaseDay ] = useState('');
	const [ due_day, setDueDay ] = useState('');

	useEffect(() => {
		if (!open) return;

		if (creditBalance) {
			setName(creditBalance.name);
			setCreditLimit(MoneyUtils.formatMoney(creditBalance.credit_limit));
			setBestPurchaseDay(String(creditBalance.best_purchase_day));
			setDueDay(String(creditBalance.due_day));
		} else {
			setName('');
			setCreditLimit('');
			setBestPurchaseDay('');
			setDueDay('');
		}
	}, [ open, creditBalance ]);

	const is_pending = is_create_pending || is_update_pending;
	const is_disabled = is_pending || !name || !credit_limit || !best_purchase_day || !due_day;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (is_disabled) return;

		const body = {
			name,
			credit_limit: Number(MoneyUtils.unformatMoney(credit_limit)),
			best_purchase_day: Number(best_purchase_day),
			due_day: Number(due_day),
		};

		if (creditBalance) {
			updateMutation({
				id: creditBalance.id,
				body,
				onSuccess: () => {
					toast.success('Crédito atualizado!');
					onOpenChange(false);
				},
				onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar crédito')),
			});
			return;
		}

		if (!user_wallet.data) {
			toast.error('Selecione uma carteira para continuar');
			return;
		}

		createMutation({
			wallet_id: user_wallet.data.id,
			body,
			onSuccess: () => {
				toast.success('Crédito criado!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar crédito')),
		});
	};

	const is_shared = Boolean(creditBalance) && cards_count > 1;
	const wallet_context = user_wallet.data ? `Na carteira ${ user_wallet.data.name }` : undefined;

	return (
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			title={creditBalance ? 'Editar crédito' : 'Novo crédito'}
			context={is_shared ? `Limite e fatura compartilhados por ${ cards_count } cartões` : wallet_context}
			contextIcon={is_shared ? CreditCard : Wallet}
			onSubmit={handleSubmit}
			footer={(
				<SheetDialogFooter
					submitLabel={creditBalance ? 'Salvar' : 'Criar crédito'}
					onCancel={() => onOpenChange(false)}
					isLoading={is_pending}
					disabled={is_disabled}
				/>
			)}
		>
			<div className='grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-3'>
				<Field label='Nome' htmlFor='credit-balance-name'>
					<input
						id='credit-balance-name'
						className={FIELD_INPUT}
						placeholder='Ex.: Nubank, Inter'
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={is_pending}
					/>
				</Field>
				<Field label='Limite' htmlFor='credit-balance-limit' hint={creditBalance?.bank_linked ? 'Vem do banco: a próxima atualização troca pelo valor informado pelo banco.' : undefined}>
					<AffixInput
						id='credit-balance-limit'
						prefix='R$'
						inputMode='numeric'
						placeholder='0,00'
						value={credit_limit.replace(/^R\$\s?/, '')}
						onChange={(e) => setCreditLimit(MoneyUtils.formatMoney(e.target.value))}
						disabled={is_pending}
					/>
				</Field>
			</div>

			<div className='grid grid-cols-2 gap-2.5 md:gap-3'>
				<Field label='Melhor dia de compra' htmlFor='credit-balance-best-day'>
					<AffixInput
						id='credit-balance-best-day'
						prefix='dia'
						inputMode='numeric'
						placeholder='1 a 31'
						value={best_purchase_day}
						onChange={(e) => setBestPurchaseDay(clampDay(e.target.value))}
						disabled={is_pending}
					/>
				</Field>
				<Field label='Dia de vencimento' htmlFor='credit-balance-due-day'>
					<AffixInput
						id='credit-balance-due-day'
						prefix='dia'
						inputMode='numeric'
						placeholder='1 a 31'
						value={due_day}
						onChange={(e) => setDueDay(clampDay(e.target.value))}
						disabled={is_pending}
					/>
				</Field>
			</div>

			{best_purchase_day && due_day && (
				<div className={cn('flex items-center justify-between gap-2.5 rounded-[20px] px-4 py-3', GLASS_TILE)}>
					<span className='flex min-w-0 flex-col gap-0.5'>
						<span className='text-xs text-muted-foreground'>Ciclo da fatura</span>
						<span className='text-[15px] font-semibold'>{cycleLabel(Number(best_purchase_day))}</span>
					</span>
					<span className='flex shrink-0 flex-col items-end gap-0.5'>
						<span className='text-xs text-muted-foreground'>Vence</span>
						<span className='text-[15px] font-semibold'>dia {due_day}</span>
					</span>
				</div>
			)}

			{creditBalance && (
				<p className='flex items-start gap-2 px-1 text-[13px] leading-[1.45] text-muted-foreground'>
					<Info className='mt-0.5 size-3.5 shrink-0' />
					<span>Mudar os dias vale para as próximas compras; as já lançadas ficam na fatura em que estão.</span>
				</p>
			)}
		</SheetDialog>
	);
};

export default CreditBalanceFormDialog;
