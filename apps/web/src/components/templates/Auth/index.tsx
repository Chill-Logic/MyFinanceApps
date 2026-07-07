import classNames from 'classnames';
import { Moon, Sun } from 'lucide-react';

import logo from '@/assets/Logo Full MyFinance Cortada.png';

import { useTheme } from '@/context/theme';

import { ITemplateProps } from '@/types';

import Button from '@/components/atoms/Button';

const AuthTemplate = ({ children }: ITemplateProps) => {
	const { theme, toggleTheme } = useTheme();

	return (
		<div
			className={
				classNames(
					'relative h-screen overflow-auto py-8 transition-all duration-300',
					'bg-background-light dark:bg-background-default'
				)
			}
		>
			<Button
				type='button'
				variant='secondary'
				size='icon'
				className='fixed right-4 top-4'
				onClick={toggleTheme}
				aria-label='Alternar tema'
			>
				{theme === 'dark' ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
			</Button>

			<div className='flex flex-col w-full min-h-full items-center justify-center'>
				<div className='w-[300px]'>
					<img src={logo} alt='logo' className='mb-14' />
					{children}
				</div>
			</div>
		</div>
	);
};

export default AuthTemplate;
