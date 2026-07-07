import { useCurrentUserContext } from '@/context/current_user';
import { useWallet } from '@/context/wallet';

import Typography from '@/components/atoms/Typography';

const HomePage = () => {
	const { current_user } = useCurrentUserContext();
	const { user_wallet } = useWallet();

	return (
		<div className='flex flex-col gap-2'>
			<Typography variant='large' className='dark:text-white'>
				Olá, {current_user.data?.name}!
			</Typography>

			{user_wallet.data && (
				<Typography className='dark:text-white'>
					Carteira: {user_wallet.data.name}
				</Typography>
			)}
		</div>
	);
};

export default HomePage;
