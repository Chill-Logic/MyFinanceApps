import { useNavigate } from 'react-router-dom';

import { ITemplateProps } from '@/types';

import Button from '@/components/atoms/Button';

const BlankTemplate = ({ children }: ITemplateProps) => {
	const navigate = useNavigate();
	return (
		<div className='h-screen'>
			<div className='container h-full'>
				<div
					className='h-14 flex items-center'
					onClick={() => navigate(-1)}
				>
					<Button>
            Voltar
					</Button>
				</div>
				<div className='pt-8'>
					{children}
				</div>
			</div>
		</div>
	);
};

export default BlankTemplate;