import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, MoneyUtils } from '@myfinance/shared';
import { Info } from 'lucide-react';

import { useCreateCreditBalance } from '@/hooks/api/credit-balances/useCreateCreditBalance';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useCreateCreditCard } from '@/hooks/api/credit-cards/useCreateCreditCard';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import Checkbox from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/* Ao abrir a partir de um crédito existente: já marca "compartilhar" e pré-seleciona esse limite. */
	defaultShareCreditBalanceId?: string;
}

/* Mantém o dígito entre 1 e 31 (dias de fechamento/vencimento). */
const clampDay = (value: string): string => {
	const digits = value.replace(/\D/g, '').slice(0, 2);
	if (!digits) return '';
	return String(Math.min(31, Math.max(1, Number(digits))));
};

/*
 * Modal unificado "Novo Cartão" — some com a distinção linha-de-crédito vs cartão pro usuário:
 * - Sem "Compartilhar limite": cria uma linha de crédito nova (nome = o que o usuário digitou) e, no
 *   sucesso, um cartão "PRINCIPAL" dentro dela (com os últimos dígitos informados).
 * - Com "Compartilhar limite": cria só o cartão (nome = o do usuário) dentro do limite escolhido — os
 *   campos de limite/fechamento/vencimento somem (herda tudo da linha selecionada).
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
	const [ closing_day, setClosingDay ] = useState('');
	const [ due_day, setDueDay ] = useState('');
	const [ submitting, setSubmitting ] = useState(false);

	useEffect(() => {
		if (!open) return;

		setName('');
		setLastDigits('');
		setCreditLimit('');
		setClosingDay('');
		setDueDay('');
		setSubmitting(false);
		setShare(Boolean(defaultShareCreditBalanceId));
		setCreditBalanceId(defaultShareCreditBalanceId || '');
	}, [ open, defaultShareCreditBalanceId ]);

	const is_disabled = submitting
		|| !name
		|| (share ? !credit_balance_id : (!credit_limit || !closing_day || !due_day));

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
				closing_day: Number(closing_day),
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

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Novo cartão</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					<TextInput
						type='text'
						label='Nome'
						name='name'
						placeholder='Ex.: Nubank, Físico, Virtual'
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={submitting}
					/>

					<TextInput
						type='text'
						label='Últimos dígitos (opcional)'
						name='last_digits'
						placeholder='Ex.: 1234'
						value={last_digits}
						onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
						disabled={submitting}
					/>

					<div className='flex flex-col gap-2'>
						<div className='flex items-center gap-2'>
							<Checkbox
								id='share-limit'
								checked={share}
								disabled={submitting || (!has_balances && !defaultShareCreditBalanceId)}
								onCheckedChange={(checked) => setShare(checked === true)}
							/>
							<label htmlFor='share-limit' className='text-sm font-medium'>Compartilhar limite</label>
							<Popover>
								<PopoverTrigger asChild>
									<button type='button' aria-label='O que é compartilhar limite?' className='text-muted-foreground hover:text-foreground'>
										<Info className='h-4 w-4' />
									</button>
								</PopoverTrigger>
								<PopoverContent align='start' className='w-72 text-sm'>
									Ao selecionar, este cartão poderá compartilhar o limite com outros cartões já cadastrados
								</PopoverContent>
							</Popover>
						</div>

						{!has_balances && !defaultShareCreditBalanceId && (
							<span className='text-xs text-muted-foreground'>Você ainda não tem um limite para compartilhar — este cartão vai criar o primeiro.</span>
						)}
					</div>

					{share ? (
						<div className='flex flex-col gap-1.5'>
							<label className='text-sm font-medium'>Limite compartilhado</label>
							<Select value={credit_balance_id} onValueChange={setCreditBalanceId} disabled={submitting}>
								<SelectTrigger>
									<SelectValue placeholder='Escolha o limite' />
								</SelectTrigger>
								<SelectContent>
									{credit_balances.map((credit_balance) => (
										<SelectItem key={credit_balance.id} value={credit_balance.id}>
											{credit_balance.name} · {MoneyUtils.formatMoney(credit_balance.credit_limit)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<span className='text-xs text-muted-foreground'>O cartão usa o limite e a fatura da linha escolhida — sem limite próprio.</span>
						</div>
					) : (
						<>
							<TextInput
								type='text'
								label='Limite'
								name='credit_limit'
								placeholder='R$ 0,00'
								value={credit_limit}
								onChange={(e) => setCreditLimit(MoneyUtils.formatMoney(e.target.value))}
								disabled={submitting}
							/>

							<div className='flex gap-4'>
								<TextInput
									type='text'
									label='Dia de fechamento'
									name='closing_day'
									placeholder='1 a 31'
									value={closing_day}
									onChange={(e) => setClosingDay(clampDay(e.target.value))}
									disabled={submitting}
									className='flex-1'
								/>
								<TextInput
									type='text'
									label='Dia de vencimento'
									name='due_day'
									placeholder='1 a 31'
									value={due_day}
									onChange={(e) => setDueDay(clampDay(e.target.value))}
									disabled={submitting}
									className='flex-1'
								/>
							</div>

							<span className='text-xs text-muted-foreground'>Este cartão cria um novo limite de crédito, com fatura própria.</span>
						</>
					)}

					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
							Cancelar
						</Button>
						<Button type='submit' isLoading={submitting} disabled={is_disabled}>
							Salvar
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default NewCardDialog;
