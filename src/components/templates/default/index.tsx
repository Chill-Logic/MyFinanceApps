import { matchPath } from 'react-router-dom';

import { ITemplateProps } from '@/types';

const DefaultTemplate = ({ children }: ITemplateProps) => {

	const isCurrentPath = (path: string) => {
		const resp = matchPath({ path }, window.location.pathname);
		return resp !== null;
	};

	return (
		<div className='h-screen'>
			<div className='container h-full'>
				
				<div className='pt-8'>
					{children}
				</div>
			</div>
		</div>
	);
};

export default DefaultTemplate;