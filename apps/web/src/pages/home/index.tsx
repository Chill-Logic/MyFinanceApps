import { useTheme } from '@/hooks/useTheme';

import Button from '@/components/atoms/Button';

const HomePage = () => {
	const { theme, toggleTheme } = useTheme();

	return (
		<div>
			<Button onClick={toggleTheme}>
				Alterar tema {theme}
			</Button>
		</div>
	);
};

export default HomePage;