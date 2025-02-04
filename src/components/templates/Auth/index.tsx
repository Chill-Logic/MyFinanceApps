import { useEffect } from 'react';

import classNames from 'classnames';

import logo from '@/assets/Logo Full MyFinance Cortada.png';

import { useTheme } from '@/hooks/useTheme';

import { ITemplateProps } from '@/types';

const AuthTemplate = ({ children }: ITemplateProps) => {
	const { toggleTheme, theme } = useTheme({ prevent_storage: true });

	useEffect(() => {
		if(theme === 'dark') toggleTheme();
	}, []);

	return (
		<div 
			className={
				classNames(
					'h-screen overflow-auto py-8 transition-all duration-300',
					'bg-background-light dark:bg-background-default'
				)
			}
		>
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