import Button from '@/components/atoms/Button';

interface ICardProps {
	// Adicione as propriedades aqui
	user_name: string;
	avatar_url: string;
}

const Card = (props: ICardProps) => {
	const { avatar_url, user_name } = props ;
	return (
		<div>
			<h1>{user_name}</h1>
			<img src={avatar_url} alt={user_name} />
			<Button
				content='Ver Perfil'
			/>
		</div>
	);
};

export default Card;