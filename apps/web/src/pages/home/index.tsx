import { useCurrentUserContext } from '@/context/current_user';
import { useTheme } from '@/context/theme';

import Button from '@/components/atoms/Button';
import Typography from '@/components/atoms/Typography';

const HomePage = () => {
	const { theme, toggleTheme } = useTheme();
	const { current_user, logout } = useCurrentUserContext();

	return (
		<div className='flex flex-col gap-y-4 p-8'>
			<Typography variant='large' className='dark:text-white'>
				Olá, {current_user.data?.name}!
			</Typography>
			<Button onClick={toggleTheme}>
				Alterar tema {theme}
			</Button>
			<Button variant='destructive' onClick={logout}>
				Sair
			</Button>
		</div>
	);
};

export default HomePage;
