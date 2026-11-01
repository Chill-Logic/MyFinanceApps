import { useState } from 'react';

import { BANK_AUTO_SYNC_HELP, BankConnectionUtils, DateUtils, getApiErrorMessage, type TBankAccountLink } from '@myfinance/shared';
import { CreditCard, Download, History, Landmark } from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useUpdateBankAccountLink } from '@/hooks/api/bank-account-links/useUpdateBankAccountLink';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import BankImportDialog from '@/components/organisms/BankImportDialog';
import BankImportHistoryDialog from '@/components/organisms/BankImportHistoryDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Switch from '@/components/ui/switch';

interface IProps {
	link: TBankAccountLink;
	/* Carteira da conexão — o destino tem que ser dela. */
	walletId: string;
}

const TONE_CLASS = {
	success: 'bg-feedback-success-light text-feedback-success-dark',
	warning: 'bg-feedback-warning-light text-feedback-warning-dark',
	error: 'bg-feedback-danger-light text-destructive',
	neutral: 'bg-muted text-muted-foreground',
} as const;

const targetValue = (link: TBankAccountLink) => {
	if (link.status === 'linked' && link.target_id) return link.target_id;
	if (link.status === 'ignored') return 'none';
	return '';
};

const BankAccountLinkCard = ({ link, walletId }: IProps) => {
	const { toast } = useToast();
	const is_credit = link.external_type === 'CREDIT';

	const { data: accounts_data } = useIndexAccounts({ enabled: !is_credit, params: { wallet_id: walletId, per_page: 100 } });
	const { data: credit_balances_data } = useIndexCreditBalances({ enabled: is_credit, params: { wallet_id: walletId, per_page: 100 } });
	const { mutate: updateLinkMutation, isPending } = useUpdateBankAccountLink();

	const [ is_import_open, setIsImportOpen ] = useState(false);
	const [ is_history_open, setIsHistoryOpen ] = useState(false);

	const targets = (is_credit ? credit_balances_data?.data : accounts_data?.data) || [];
	const status = BankConnectionUtils.linkStatus(link.status);
	const amount_label = BankConnectionUtils.linkAmountLabel(link);
	const is_linked = link.status === 'linked';
	const Icon = is_credit ? CreditCard : Landmark;

	const updateLink = (body: Parameters<typeof updateLinkMutation>[0]['body'], success_message: string) => {
		updateLinkMutation({
			id: link.id,
			body,
			onSuccess: () => toast.success(success_message),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar o vínculo')),
		});
	};

	const handleTargetChange = (target: string) => {
		const messages: Record<string, string> = {
			new: is_credit ? 'Cartão criado e vinculado' : 'Conta criada e vinculada',
			none: 'Esta conta não será importada',
		};

		updateLink({ target }, messages[target] || 'Vínculo atualizado');
	};

	return (
		<li className='flex flex-col gap-3 rounded-xl border border-card bg-card p-4'>
			<div className='flex items-start gap-3'>
				<div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground'>
					<Icon className='h-5 w-5' />
				</div>

				<div className='min-w-0 flex-1'>
					<p className='truncate font-medium text-foreground'>{link.name}</p>
					<p className='truncate text-xs text-muted-foreground'>
						{BankConnectionUtils.linkTypeLabel(link)}
						{link.number ? ` · ${ link.number }` : ''}
						{amount_label ? ` · ${ amount_label }` : ''}
					</p>
				</div>

				<span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', TONE_CLASS[status.tone])}>{status.label}</span>
			</div>

			<div className='flex flex-col gap-1'>
				<span className='text-xs font-medium text-muted-foreground'>Importar para</span>
				<Select value={targetValue(link)} onValueChange={handleTargetChange} disabled={isPending}>
					<SelectTrigger>
						<SelectValue placeholder='Escolha o destino' />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='new'>{is_credit ? 'Criar novo cartão' : 'Criar nova conta'}</SelectItem>
						{targets.map((target) => (
							<SelectItem key={target.id} value={target.id}>{target.name}</SelectItem>
						))}
						{is_linked && link.target_id && !targets.some((target) => target.id === link.target_id) && (
							<SelectItem value={link.target_id}>{link.target_name || 'Destino atual'}</SelectItem>
						)}
						<SelectItem value='none'>Não importar</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{is_linked && (
				<div className='flex items-start justify-between gap-3'>
					<div className='flex flex-col gap-0.5'>
						<span className='text-sm font-medium text-foreground'>Sincronizar automaticamente (diário, a partir de hoje)</span>
						<span className='text-xs text-muted-foreground'>{BANK_AUTO_SYNC_HELP}</span>
						{link.auto_sync && link.auto_sync_since && (
							<span className='text-xs text-muted-foreground'>Ativa desde {DateUtils.formatDate(link.auto_sync_since)}</span>
						)}
					</div>
					<Switch
						checked={link.auto_sync}
						disabled={isPending}
						aria-label='Sincronizar automaticamente'
						onCheckedChange={(checked) => updateLink(
							{ auto_sync: checked },
							checked ? 'Sincronização automática ativada' : 'Sincronização automática desativada',
						)}
					/>
				</div>
			)}

			{(is_linked || link.last_imported_at) && (
				<div className='flex flex-wrap items-center justify-between gap-2'>
					<span className='text-xs text-muted-foreground'>
						{link.last_imported_at
							? `Última importação em ${ DateUtils.formateTo(link.last_imported_at, 'dd/MM/yyyy \'às\' HH:mm') }`
							: 'Nada importado ainda'}
					</span>
					<div className='flex items-center gap-2'>
						<Button type='button' variant='ghost' size='sm' onClick={() => setIsHistoryOpen(true)} className='gap-2'>
							<History className='h-4 w-4' />
							Histórico
						</Button>
						{is_linked && (
							<Button type='button' size='sm' onClick={() => setIsImportOpen(true)} className='gap-2'>
								<Download className='h-4 w-4' />
								Importar período
							</Button>
						)}
					</div>
				</div>
			)}

			<BankImportDialog open={is_import_open} onOpenChange={setIsImportOpen} link={link} />
			<BankImportHistoryDialog open={is_history_open} onOpenChange={setIsHistoryOpen} link={link} />
		</li>
	);
};

export default BankAccountLinkCard;
