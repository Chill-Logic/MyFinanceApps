import { useCurrentUserContext } from '@/context/current_user';

import Typography from '@/components/atoms/Typography';

const HomePage = () => {
	const { current_user } = useCurrentUserContext();

	return (
		<Typography variant='large' className='dark:text-white'>
			Olá, {current_user.data?.name}!
		</Typography>
	);
};

export default HomePage;
