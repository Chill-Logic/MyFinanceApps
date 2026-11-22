import { FormEvent, ReactNode, useEffect, useState } from 'react';

import { getApiErrorMessage, MoneyUtils } from '@myfinance/shared';
import { Info, Wallet } from 'lucide-react';

import icon_mark from '@/assets/brand/icon.svg';

import { useCreateCreditBalance } from '@/hooks/api/credit-balances/useCreateCreditBalance';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useCreateCreditCard } from '@/hooks/api/credit-cards/useCreateCreditCard';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import { GLASS_TILE } from '@/components/molecules/NavKit';
import { AffixInput, Field, FIELD_INPUT, FIELD_LABEL, RadioCard, SheetDialog, SheetDialogFooter } from '@/components/molecules/SheetDialog';
import Checkbox from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/* Ao abrir a partir de um crédito existente: já marca "compartilhar" e pré-seleciona esse limite. */
	defaultShareCreditBalanceId?: string;
}

/* Mantém o dígito entre 1 e 31 (melhor dia de compra / vencimento). */
const clampDay = (value: string): string => {
	const digits = value.replace(/\D/g, '').slice(0, 2);
	if (!digits) return '';
	return String(Math.min(31, Math.max(1, Number(digits))));
};

/*
 * Prévia pequena do "cartão físico" (mesmo degradê do BigCard da tela Cartões): nome + chip em cima,
 * final do cartão e um rótulo curto embaixo. 88px de altura no celular; 216×136 ao lado dos campos no md+.
 * Exportada porque o CreditCardFormDialog usa a mesma prévia.
 */
export const MiniCardPreview = ({ title, lastDigits, trailing, className }: { title: ReactNode; lastDigits?: string; trailing?: ReactNode; className?: string }) => (
	<div
		aria-hidden='true'
		className={cn(
			'relative flex h-[88px] flex-col justify-between overflow-hidden rounded-[20px] border border-white/15 px-4 py-3.5 text-sand-light md:h-[136px]',
			'bg-[radial-gradient(120%_120%_at_0%_0%,#12708A_0%,#0B3E52_48%,#082435_100%)] shadow-[0_14px_30px_rgba(8,36,53,0.22)] dark:shadow-[0_14px_34px_rgba(7,141,167,0.22)]',
			className,
		)}
	>
		<img src={icon_mark} alt='' className='pointer-events-none absolute -bottom-11 -right-[34px] size-[120px] opacity-[0.14]' />
		<span className='relative flex items-center justify-between gap-3'>
			<span className='min-w-0 truncate text-sm font-semibold'>{title}</span>
			<span className='h-[21px] w-[30px] shrink-0 rounded-[5px] bg-gradient-to-br from-[#E2DFDB] to-[#A8A39D]' />
		</span>
		<span className='relative flex justify-between gap-2 whitespace-nowrap font-mono text-xs text-[#A9B6BF]'>
			<span>{lastDigits ? `•••• ${ lastDigits }` : '•••• ••••'}</span>
			<span className='min-w-0 truncate'>{trailing}</span>
		</span>
	</div>
);

/*
 * Modal unificado "Novo Cartão" (redesign 2026-11, mockup "DlgNewCard") — some com a distinção
 * linha-de-crédito vs cartão pro usuário:
 * - Sem "Compartilhar limite": cria uma linha de crédito nova (nome = o que o usuário digitou) e, no
 *   sucesso, um cartão "PRINCIPAL" dentro dela (com os últimos dígitos informados).
 * - Com "Compartilhar limite": cria só o cartão (nome = o do usuário) dentro do limite escolhido — os
 *   campos de limite/melhor compra/vencimento somem (herda tudo da linha selecionada).
 */
const NewCardDialog = ({ open, onOpenChange, defaultShareCreditBalanceId }: IProps) => {
	const { user_wallet } = useWallet();
	const { toast } = useToast();

	const wallet_id = user_wallet.data?.id;
	const { data: credit_balances_data } = useIndexCreditBalances({
		enabled: open && Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const credit_balances = credit_balances_data?.data || [];
	const has_balances = credit_balances.length > 0;

	const { mutate: createBalance } = useCreateCreditBalance();
	const { mutate: createCard } = useCreateCreditCard();

	const [ name, setName ] = useState('');
	const [ last_digits, setLastDigits ] = useState('');
	const [ share, setShare ] = useState(false);
	const [ credit_balance_id, setCreditBalanceId ] = useState('');
	const [ credit_limit, setCreditLimit ] = useState('');
	const [ best_purchase_day, setBestPurchaseDay ] = useState('');
	const [ due_day, setDueDay ] = useState('');
	const [ submitting, setSubmitting ] = useState(false);

	useEffect(() => {
		if (!open) return;

		setName('');
		setLastDigits('');
		setCreditLimit('');
		setBestPurchaseDay('');
		setDueDay('');
		setSubmitting(false);
		setShare(Boolean(defaultShareCreditBalanceId));
		setCreditBalanceId(defaultShareCreditBalanceId || '');
	}, [ open, defaultShareCreditBalanceId ]);

	const is_disabled = submitting
		|| !name
		|| (share ? !credit_balance_id : (!credit_limit || !best_purchase_day || !due_day));

	const finish = (message: string) => {
		toast.success(message);
		setSubmitting(false);
		onOpenChange(false);
	};

	const fail = (error: unknown, fallback: string) => {
		toast.error(getApiErrorMessage(error, fallback));
		setSubmitting(false);
	};

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (is_disabled) return;
		setSubmitting(true);

		/* Compartilhando: só cria o cartão dentro do limite escolhido. */
		if (share) {
			createCard({
				credit_balance_id,
				body: { name, last_digits: last_digits || undefined },
				onSuccess: () => finish('Cartão criado!'),
				onError: (error) => fail(error, 'Erro ao criar cartão'),
			});
			return;
		}

		if (!wallet_id) {
			setSubmitting(false);
			toast.error('Selecione uma carteira para continuar');
			return;
		}

		/*
		 * Novo limite: cria a linha de crédito com o nome informado e, no sucesso, o cartão "PRINCIPAL"
		 * dentro dela (o usuário não precisa saber que "linha de crédito" e "cartão" são coisas separadas).
		 */
		createBalance({
			wallet_id,
			body: {
				name,
				credit_limit: Number(MoneyUtils.unformatMoney(credit_limit)),
				best_purchase_day: Number(best_purchase_day),
				due_day: Number(due_day),
			},
			onSuccess: (created_balance) => {
				createCard({
					credit_balance_id: created_balance.id,
					body: { name: 'PRINCIPAL', last_digits: last_digits || undefined },
					onSuccess: () => finish('Cartão criado!'),
					onError: (error) => fail(error, 'Limite criado, mas houve um erro ao criar o cartão'),
				});
			},
			onError: (error) => fail(error, 'Erro ao criar limite'),
		});
	};

	const share_disabled = submitting || (!has_balances && !defaultShareCreditBalanceId);
	const preview_trailing = share ? 'compartilhado' : (due_day && `vence dia ${ due_day }`);

	const name_field = (
		<Field label='Nome' htmlFor='new-card-name'>
			<input
				id='new-card-name'
				className={FIELD_INPUT}
				placeholder='Ex.: Nubank, Físico, Virtual'
				value={name}
				onChange={(e) => setName(e.target.value)}
				disabled={submitting}
			/>
		</Field>
	);

	const digits_field = (
		<Field label={<>Últimos dígitos<span className='max-md:hidden'> (opcional)</span></>} htmlFor='new-card-digits'>
			<AffixInput
				id='new-card-digits'
				prefix='••••'
				inputMode='numeric'
				placeholder='1234'
				className='pl-[52px] font-mono'
				value={last_digits}
				onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
				disabled={submitting}
			/>
		</Field>
	);

	return (
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			title='Novo cartão'
			context={user_wallet.data ? `Na carteira ${ user_wallet.data.name }` : undefined}
			contextIcon={Wallet}
			onSubmit={handleSubmit}
			footer={(
				<SheetDialogFooter
					submitLabel='Salvar cartão'
					onCancel={() => onOpenChange(false)}
					isLoading={submitting}
					disabled={is_disabled}
				/>
			)}
		>
			{/* Celular: prévia em cima e Nome + dígitos lado a lado. Tablet/desktop: prévia à esquerda dos campos. */}
			<div className='flex flex-col gap-4 md:grid md:grid-cols-[216px_minmax(0,1fr)]'>
				<div className='flex flex-col justify-end'>
					<MiniCardPreview title={name || 'Novo cartão'} lastDigits={last_digits} trailing={preview_trailing} />
				</div>
				<div className='grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2.5 md:grid-cols-1 md:gap-3'>
					{name_field}
					{digits_field}
				</div>
			</div>

			<div className={cn('flex items-start gap-2.5 rounded-[20px] px-3.5 py-3', GLASS_TILE)}>
				<Checkbox
					id='share-limit'
					checked={share}
					disabled={share_disabled}
					onCheckedChange={(checked) => setShare(checked === true)}
					className='mt-0.5'
				/>
				<div className='flex min-w-0 flex-1 flex-col gap-1'>
					<span className='flex items-center gap-1.5'>
						<label htmlFor='share-limit' className={cn('text-sm font-semibold', share_disabled ? 'opacity-60' : 'cursor-pointer')}>Compartilhar limite</label>
						<Popover>
							<PopoverTrigger asChild>
								<button type='button' aria-label='O que é compartilhar limite?' className='text-muted-foreground hover:text-foreground'>
									<Info className='size-3.5' />
								</button>
							</PopoverTrigger>
							<PopoverContent align='start' className='w-72 text-sm'>
								Ao selecionar, este cartão poderá compartilhar o limite com outros cartões já cadastrados
							</PopoverContent>
						</Popover>
					</span>
					<span className='text-xs leading-[1.45] text-muted-foreground'>
						{share
							? 'Este cartão usa o limite e a fatura de um cartão que você já tem — como um adicional ou um virtual.'
							: 'Ligue para usar o limite de outro cartão já cadastrado, em vez de criar um limite novo.'}
					</span>
					{!has_balances && !defaultShareCreditBalanceId && (
						<span className='text-xs leading-[1.45] text-muted-foreground'>Você ainda não tem um limite para compartilhar — este cartão vai criar o primeiro.</span>
					)}
				</div>
			</div>

			{share ? (
				<>
					<div role='radiogroup' aria-label='Limite compartilhado' className='flex flex-col gap-2'>
						<span className={FIELD_LABEL}>Limite compartilhado</span>
						{credit_balances.map((credit_balance) => (
							<RadioCard
								key={credit_balance.id}
								checked={credit_balance_id === credit_balance.id}
								onSelect={() => setCreditBalanceId(credit_balance.id)}
								disabled={submitting}
								title={credit_balance.name}
								description={`Melhor compra dia ${ credit_balance.best_purchase_day } · vence dia ${ credit_balance.due_day }`}
								trailing={(
									<span className='flex flex-col items-end gap-0.5'>
										{MoneyUtils.formatMoney(credit_balance.credit_limit)}
										<span className='text-xs font-normal text-muted-foreground'>limite</span>
									</span>
								)}
							/>
						))}
					</div>
					<span className='px-1 text-xs leading-[1.45] text-muted-foreground'>
						O cartão usa o limite e a fatura da linha escolhida — sem limite próprio. Limite, melhor dia de compra e vencimento vêm dela.
					</span>
				</>
			) : (
				<>
					<Field label='Limite' htmlFor='new-card-limit'>
						<AffixInput
							id='new-card-limit'
							prefix='R$'
							inputMode='numeric'
							placeholder='0,00'
							value={credit_limit.replace(/^R\$\s?/, '')}
							onChange={(e) => setCreditLimit(MoneyUtils.formatMoney(e.target.value))}
							disabled={submitting}
						/>
					</Field>

					<div className='grid grid-cols-2 gap-2.5 md:gap-3'>
						<Field label='Melhor dia de compra' htmlFor='new-card-best-day'>
							<AffixInput
								id='new-card-best-day'
								prefix='dia'
								inputMode='numeric'
								placeholder='1 a 31'
								value={best_purchase_day}
								onChange={(e) => setBestPurchaseDay(clampDay(e.target.value))}
								disabled={submitting}
							/>
						</Field>
						<Field label='Dia de vencimento' htmlFor='new-card-due-day'>
							<AffixInput
								id='new-card-due-day'
								prefix='dia'
								inputMode='numeric'
								placeholder='1 a 31'
								value={due_day}
								onChange={(e) => setDueDay(clampDay(e.target.value))}
								disabled={submitting}
							/>
						</Field>
					</div>

					<span className='px-1 text-xs leading-[1.45] text-muted-foreground'>
						{best_purchase_day
							? `Cria um limite novo, com fatura própria: compras do dia ${ best_purchase_day } em diante já caem na fatura seguinte.`
							: 'Cria um limite novo, com fatura própria.'}
					</span>
				</>
			)}
		</SheetDialog>
	);
};

export default NewCardDialog;
