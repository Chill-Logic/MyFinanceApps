import { ITemplateProps } from '@/types';

const AuthTemplate = ({ children }: ITemplateProps) => (
	<div className='h-screen max-h-screen bg-background-light overflow-scroll lg:overflow-hidden py-8'>
		{children}
	</div>
);

export default AuthTemplate;