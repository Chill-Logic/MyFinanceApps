import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useState } from 'react';

/**
 * Estado mínimo compartilhado só pra sincronizar o "+" da BottomNav (mobile, vive em
 * DefaultTemplate) com o diálogo de nova transação (vive dentro da Home) — são componentes
 * em ramos diferentes da árvore, sem esse contexto não teria como um acionar o outro.
 */
interface IContextType {
	is_open: boolean;
	setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const initialValue: IContextType = {
	is_open: false,
	setIsOpen: () => {},
};

const NewTransactionDialogContext = createContext(initialValue);

export const NewTransactionDialogProvider = ({ children }: { children: ReactNode }) => {
	const [ is_open, setIsOpen ] = useState(false);

	return (
		<NewTransactionDialogContext.Provider value={{ is_open, setIsOpen }}>
			{children}
		</NewTransactionDialogContext.Provider>
	);
};

export const useNewTransactionDialog = () => {
	const context = useContext(NewTransactionDialogContext);
	if (!context) {
		throw new Error('useNewTransactionDialog must be used within an NewTransactionDialogProvider');
	}
	return context;
};

export default NewTransactionDialogProvider;
