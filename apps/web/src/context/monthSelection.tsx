import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useEffect, useState } from 'react';

import { useWallet } from '@/context/wallet';

export type TMonthYear = {
	month: number;
	year: number;
};

const getCurrentMonthYear = (): TMonthYear => {
	const now = new Date();
	return { month: now.getMonth(), year: now.getFullYear() };
};

interface IContextType {
	month_year: TMonthYear;
	setMonthYear: Dispatch<SetStateAction<TMonthYear>>;
}

const initialValue: IContextType = {
	month_year: getCurrentMonthYear(),
	setMonthYear: () => {},
};

const MonthSelectionContext = createContext(initialValue);

/**
 * Guarda o mês/ano que o usuário está visualizando, fora do TransactionList — assim trocar de tela
 * e voltar preserva o mês selecionado (o provider vive na raiz, acima das páginas). Sem mês no
 * contexto → mês atual. Trocar de carteira ativa reseta pro mês atual (a visão de outra carteira
 * começa "do zero"). Estado só em memória (dura a sessão), não persiste entre reloads.
 */
export const MonthSelectionProvider = ({ children }: { children: ReactNode }) => {
	const { user_wallet } = useWallet();
	const [ month_year, setMonthYear ] = useState<TMonthYear>(getCurrentMonthYear);

	const wallet_id = user_wallet.data?.id;

	useEffect(() => {
		setMonthYear(getCurrentMonthYear());
	}, [ wallet_id ]);

	return (
		<MonthSelectionContext.Provider value={{ month_year, setMonthYear }}>
			{children}
		</MonthSelectionContext.Provider>
	);
};

export const useMonthSelection = () => {
	const context = useContext(MonthSelectionContext);
	if (!context) {
		throw new Error('useMonthSelection must be used within a MonthSelectionProvider');
	}
	return context;
};

export default MonthSelectionProvider;
