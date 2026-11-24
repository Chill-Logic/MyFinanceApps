import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';

/*
 * Ação principal da tela no celular: o "+" no meio da barra flutuante (BottomNav). Cada tela — e cada aba,
 * quando a tela é a mesma — registra a sua com `usePrimaryAction` (Carteiras: nova carteira; Recorrências:
 * nova recorrência; Bancos: conectar banco...). Sem registro, a Início cai na nova transação e as outras telas
 * ficam sem "+". Regra do dono: onde a barra aparece, a ação principal da tela fica ali.
 */
export type TPrimaryAction = {
	label: string;
	onClick: ()=> void;
};

type TContext = {
	action: TPrimaryAction | null;
	setAction: (action: TPrimaryAction | null)=> void;
};

const PrimaryActionContext = createContext<TContext>({ action: null, setAction: () => {} });

export const PrimaryActionProvider = ({ children }: { children: ReactNode }) => {
	const [ action, setAction ] = useState<TPrimaryAction | null>(null);
	return <PrimaryActionContext.Provider value={{ action, setAction }}>{children}</PrimaryActionContext.Provider>;
};

export const usePrimaryActionState = () => useContext(PrimaryActionContext);

/*
 * Registra a ação da tela enquanto ela está montada. O `onClick` mais recente é lido por ref, então a ação não
 * precisa ser memoizada; trocar o rótulo (ex.: mudar de aba) re-registra. `null` = a tela não tem "+".
 */
export const usePrimaryAction = (action: TPrimaryAction | null) => {
	const { setAction } = useContext(PrimaryActionContext);
	const handler = useRef(action?.onClick);
	handler.current = action?.onClick;
	const label = action?.label ?? null;

	useEffect(() => {
		if (!label) {
			setAction(null);
			return undefined;
		}
		setAction({ label, onClick: () => handler.current?.() });
		return () => setAction(null);
	}, [ label, setAction ]);
};

export default PrimaryActionProvider;
