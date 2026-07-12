import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useEffect, useState } from 'react';

import { useWallet } from './wallet';

export type TMonthYear = {
	month: number;
	year: number;
};

const getCurrentMonthYear = (): TMonthYear => {
	const now = new Date();
	return { month: now.getMonth(), year: now.getFullYear() };
};

interface IContextType {
	month_year_selector_values: TMonthYear;
	setMonthYearSelectorValues: Dispatch<SetStateAction<TMonthYear>>;
}

const initialValue: IContextType = {
	month_year_selector_values: getCurrentMonthYear(),
	setMonthYearSelectorValues: () => {},
};

const MonthSelectionContext = createContext(initialValue);

/**
 * Guarda o mês/ano que o usuário está visualizando, fora do TransactionList — assim trocar de tela
 * e voltar preserva o mês selecionado (o provider vive na raiz, acima das telas). Sem mês no
 * contexto → mês atual. Trocar de carteira ativa reseta pro mês atual. Só em memória (dura a
 * sessão), não persiste entre reinícios do app.
 */
export const MonthSelectionProvider = ({ children }: { children: ReactNode }) => {
	const { user_wallet } = useWallet();
	const [ month_year_selector_values, setMonthYearSelectorValues ] = useState<TMonthYear>(getCurrentMonthYear);

	const wallet_id = user_wallet.data?.id;

	useEffect(() => {
		setMonthYearSelectorValues(getCurrentMonthYear());
	}, [ wallet_id ]);

	return (
		<MonthSelectionContext.Provider value={{ month_year_selector_values, setMonthYearSelectorValues }}>
			{children}
		</MonthSelectionContext.Provider>
	);
};

export const useMonthSelection = () => {
	const context = useContext(MonthSelectionContext);
	if (!context) {
		throw new Error('useMonthSelection deve ser usado dentro de um MonthSelectionProvider');
	}
	return context;
};

export default MonthSelectionProvider;
