interface IButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	// Adicione as propriedades aqui
	content?: string;
}

const Button = (props: IButtonProps) => {
	const { children, onClick, content } = props ;
	return (
		<button onClick={onClick}>
			{children || content}
		</button>
	);
};

export default Button;