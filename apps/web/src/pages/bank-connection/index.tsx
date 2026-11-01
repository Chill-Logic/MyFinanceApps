import { useNavigate, useParams } from 'react-router-dom';

import { BankConnectionUtils } from '@myfinance/shared';
import { ArrowLeft, Link2 } from 'lucide-react';

import { useIndexBankAccountLinks } from '@/hooks/api/bank-account-links/useIndexBankAccountLinks';
import { useShowBankConnection } from '@/hooks/api/bank-connections/useShowBankConnection';

import Button from '@/components/atoms/Button';
import Typography from '@/components/atoms/Typography';
import BankAccountLinkCard from '@/components/organisms/BankAccountLinkCard';
import { Skeleton } from '@/components/ui/skeleton';

/* "Contas do banco": um card por conta/cartão que a Pluggy trouxe da conexão, pra escolher destino, importar e ligar a rotina. */
const BankConnectionPage = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();

	const { data: connection, isLoading: is_connection_loading } = useShowBankConnection({ id });
	const { data: links_data, isLoading: is_links_loading } = useIndexBankAccountLinks({
		enabled: Boolean(id),
		params: { bank_connection_id: id || '' },
	});

	const links = links_data?.data || [];
	const is_loading = is_connection_loading || is_links_loading;

	return (
		<div className='flex flex-col gap-5'>
			<div className='flex items-center gap-2'>
				<Button type='button' variant='ghost' size='icon' aria-label='Voltar' onClick={() => navigate('/accounts?tab=connections')}>
					<ArrowLeft className='h-5 w-5' />
				</Button>
				<div className='min-w-0'>
					<Typography variant='large' className='truncate dark:text-white'>
						Contas do banco
					</Typography>
					{connection && (
						<p className='truncate text-sm text-muted-foreground'>
							{connection.connector_name || 'Banco'} · {BankConnectionUtils.lastSyncLabel(connection)}
						</p>
					)}
				</div>
			</div>

			<p className='text-sm text-muted-foreground'>
				Escolha para onde cada conta ou cartão do banco vai. Nada é importado até você importar um período ou ligar a sincronização automática.
			</p>

			{is_loading && (
				<div className='flex flex-col gap-2'>
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton key={index} className='h-40 w-full' />
					))}
				</div>
			)}

			{!is_loading && links.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center'>
					<Link2 className='h-10 w-10 text-muted-foreground' />
					<span className='font-medium'>Nenhuma conta encontrada nesta conexão</span>
				</div>
			)}

			{!is_loading && connection && links.length > 0 && (
				<ul className='flex flex-col gap-3'>
					{links.map((link) => (
						<BankAccountLinkCard key={link.id} link={link} walletId={connection.wallet_id} />
					))}
				</ul>
			)}
		</div>
	);
};

export default BankConnectionPage;
