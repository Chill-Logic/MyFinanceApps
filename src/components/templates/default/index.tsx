import { ITemplateProps } from '@/types';

const DefaultTemplate = ({ children }: ITemplateProps) => (
	<div className='h-screen'>
		<div className='container h-full'>
			<div>
				{children}
			</div>
		</div>
	</div>
);

export default DefaultTemplate;