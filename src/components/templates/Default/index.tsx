import { ITemplateProps } from '@/types';

const DefaultTemplate = ({ children }: ITemplateProps) => (
	<div className='h-screen bg-background-light dark:bg-background-default transition-all duration-300'>
		<div className='container h-full'>
			<div>
				{children}
			</div>
		</div>
	</div>
);

export default DefaultTemplate;