import useNavItems from '@/hooks/useNavItems';

import Button from '@/components/atoms/Button';
import Typography from '@/components/atoms/Typography';

const MyWalletsPage = () => {
	const { newWalletAction } = useNavItems();

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex items-center justify-between'>
				<Typography variant='large' className='dark:text-white'>
					Carteiras
				</Typography>

				<Button type='button' onClick={newWalletAction.onClick} className='gap-2'>
					<newWalletAction.icon className='h-4 w-4' />
					{newWalletAction.label}
				</Button>
			</div>

			<Typography className='dark:text-white'>
				Em construção.
			</Typography>
		</div>
	);
};

export default MyWalletsPage;
