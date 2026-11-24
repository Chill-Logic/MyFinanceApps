import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useState } from 'react';

/**
 * Estado mínimo compartilhado só pra sincronizar o "Nova Carteira" (que vive na navegação —
 * Sidebar/NavMenu — e no header da página de Carteiras) com o WalletFormDialog (montado no
 * DefaultTemplate). Mesmo padrão do newTransactionDialog: ramos diferentes da árvore, sem esse
 * contexto um não teria como acionar o outro. Espelha o `onNewWallet` do AuthenticatedLayout do
 * mobile, que monta a WalletFormModal no topo da tela autenticada.
 */
interface IContextType {
	is_open: boolean;
	setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const initialValue: IContextType = {
	is_open: false,
	setIsOpen: () => {},
};

const NewWalletDialogContext = createContext(initialValue);

export const NewWalletDialogProvider = ({ children }: { children: ReactNode }) => {
	const [ is_open, setIsOpen ] = useState(false);

	return (
		<NewWalletDialogContext.Provider value={{ is_open, setIsOpen }}>
			{children}
		</NewWalletDialogContext.Provider>
	);
};

export const useNewWalletDialog = () => {
	const context = useContext(NewWalletDialogContext);
	if (!context) {
		throw new Error('useNewWalletDialog must be used within an NewWalletDialogProvider');
	}
	return context;
};

export default NewWalletDialogProvider;
