import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, type TCreditCard } from '@myfinance/shared';
import { CreditCard, Info } from 'lucide-react';

import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useCreateCreditCard } from '@/hooks/api/credit-cards/useCreateCreditCard';
import { useUpdateCreditCard } from '@/hooks/api/credit-cards/useUpdateCreditCard';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import { AffixInput, Field, FIELD_INPUT, SheetDialog, SheetDialogFooter } from '@/components/molecules/SheetDialog';
import { MiniCardPreview } from '@/components/organisms/NewCardDialog';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/** Obrigatório na criação (a qual limite/fatura o cartão pertence). */
	creditBalanceId?: string;
	card?: TCreditCard | null;
}

/* Novo/editar plástico de um crédito (redesign 2026-11, mockup "DlgCreditCard"), com a mini prévia do cartão. */
const CreditCardFormDialog = ({ open, onOpenChange, creditBalanceId, card }: IProps) => {
	const { toast } = useToast();
	const { user_wallet } = useWallet();

	const { mutate: createMutation, isPending: is_create_pending } = useCreateCreditCard();
	const { mutate: updateMutation, isPending: is_update_pending } = useUpdateCreditCard();

	/* Crédito dono do plástico, só pra exibir nome/vencimento (mesma query da tela Cartões, já em cache). */
	const wallet_id = user_wallet.data?.id;
	const { data: credit_balances_data } = useIndexCreditBalances({
		enabled: open && Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const owner_id = card?.credit_balance_id || creditBalanceId;
	const credit_balance = credit_balances_data?.data?.find((balance) => balance.id === owner_id);

	const [ name, setName ] = useState('');
	const [ last_digits, setLastDigits ] = useState('');

	useEffect(() => {
		if (!open) return;

		if (card) {
			setName(card.name);
			setLastDigits(card.last_digits || '');
		} else {
			setName('');
			setLastDigits('');
		}
	}, [ open, card ]);

	const is_pending = is_create_pending || is_update_pending;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (is_pending || !name) return;

		const body = { name, last_digits: last_digits || undefined };

		if (card) {
			updateMutation({
				id: card.id,
				body,
				onSuccess: () => {
					toast.success('Cartão atualizado!');
					onOpenChange(false);
				},
				onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar cartão')),
			});
			return;
		}

		if (!creditBalanceId) {
			toast.error('Crédito não identificado');
			return;
		}

		createMutation({
			credit_balance_id: creditBalanceId,
			body,
			onSuccess: () => {
				toast.success('Cartão criado!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar cartão')),
		});
	};

	return (
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			title={card ? 'Editar cartão' : 'Novo cartão'}
			context={credit_balance ? `Plástico do crédito ${ credit_balance.name }` : undefined}
			contextIcon={CreditCard}
			onSubmit={handleSubmit}
			footer={(
				<SheetDialogFooter
					submitLabel={card ? 'Salvar' : 'Adicionar cartão'}
					onCancel={() => onOpenChange(false)}
					isLoading={is_pending}
					disabled={is_pending || !name}
				/>
			)}
		>
			{/* Celular: prévia em cima. Tablet/desktop: prévia à esquerda dos campos. */}
			<div className='flex flex-col gap-4 md:grid md:grid-cols-[216px_minmax(0,1fr)]'>
				<div className='flex flex-col justify-end'>
					<MiniCardPreview
						title={name || 'Cartão'}
						lastDigits={last_digits}
						trailing={credit_balance ? `vence dia ${ credit_balance.due_day }` : undefined}
					/>
				</div>
				<div className='flex flex-col gap-4 md:gap-3'>
					<Field label='Nome' htmlFor='credit-card-name'>
						<input
							id='credit-card-name'
							className={FIELD_INPUT}
							placeholder='Ex.: Físico, Virtual, Adicional'
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={is_pending}
						/>
					</Field>
					<Field label='Últimos dígitos (opcional)' htmlFor='credit-card-digits'>
						<AffixInput
							id='credit-card-digits'
							prefix='••••'
							inputMode='numeric'
							placeholder='1234'
							className='pl-[52px] font-mono'
							value={last_digits}
							onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
							disabled={is_pending}
						/>
					</Field>
				</div>
			</div>

			{credit_balance && (
				<p className='flex items-start gap-2 px-1 text-[13px] leading-[1.45] text-muted-foreground'>
					<Info className='mt-0.5 size-3.5 shrink-0' />
					<span>Limite, fatura e vencimento são do crédito {credit_balance.name}. Para mudar, edite o crédito.</span>
				</p>
			)}
		</SheetDialog>
	);
};

export default CreditCardFormDialog;
