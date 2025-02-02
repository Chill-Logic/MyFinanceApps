import { ITemplateProps } from '@/types';

const AuthTemplate = ({ children }: ITemplateProps) => (
	<div className='h-screen bg-background-light overflow-auto py-8'>
		<div className='flex w-full min-h-full items-center justify-center'>
			{children}
		</div>
	</div>
);

export default AuthTemplate;