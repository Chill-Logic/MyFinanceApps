import { createContext, Dispatch, useContext, useState, SetStateAction } from 'react';

/**
 * Estado mínimo compartilhado só pra sincronizar o "+" da BottomNav (vive no
 * AuthenticatedLayout) com o modal de nova transação (vive dentro do organism
 * TransactionList) — são componentes em ramos diferentes da árvore, sem esse contexto não
 * teria como um acionar o outro. Mesmo padrão do equivalente em apps/web.
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

export const NewTransactionDialogProvider = ({ children }: { children: React.ReactNode }) => {
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
