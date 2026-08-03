import { useNavigationState } from '@react-navigation/native';

import { IScreenProps } from '../types/screen';

/**
 * Ordem ESPACIAL das telas "de aba" (posição visual na BottomNav/menu, da esquerda pra
 * direita), não a ordem em que elas são registradas no Stack.Navigator nem a ordem em que
 * o usuário efetivamente navegou entre elas. Bate com a ordem de `NAV_ITEMS` (`useNavItems`):
 * a BottomNav mostra `Home → Finances → MyWallets`, e `WalletsInvites`/`WalletsSettings` só
 * existem no menu do hambúrguer (posições mais à direita de todas). Precisa incluir TODAS as
 * telas de aba — uma rota fora daqui cai no default 'push' e anima na direção errada (foi o que
 * aconteceu com `Finances` quando entrou na barra e não estava listada aqui).
 */
const TAB_ORDER = [ 'Home', 'Finances', 'MyWallets', 'WalletsInvites', 'WalletsSettings' ];

let pending_animation_type_for_replace: 'push' | 'pop' = 'push';

export const getPendingAnimationTypeForReplace = () => pending_animation_type_for_replace;

/**
 * `navigation.navigate()` anima com base no HISTÓRICO da stack (some pra trás se a rota já
 * existir, empilha pra frente se não existir) — isso não bate com a posição espacial dos
 * itens na BottomNav. Ex.: Início -> Convites -> Início (volta, anima certo pra
 * esquerda) -> Convites de novo: como Convites saiu da stack ao voltar pra Início, essa
 * navegação empilha de novo e anima pra direita, mesmo com Convites continuando à direita
 * de Início (nesse caso até bateria, mas em sequências mais longas com Carteiras no meio a
 * direção historicamente calculada diverge da direção espacial esperada).
 *
 * Pra essas 4 telas nunca ter mais de uma na stack ao mesmo tempo (usa `replace`, não
 * `navigate`/`push`) e a animação passa a ser SEMPRE calculada pela posição espacial (`TAB_ORDER`)
 * comparando de onde saiu com pra onde foi, nunca pelo histórico de navegação.
 */
export const useTabNavigate = (navigation: IScreenProps<any>['navigation']) => {
	const current_route_name = useNavigationState((state) => state?.routes[state.index]?.name);

	return (route: string) => {
		const from_index = TAB_ORDER.indexOf(current_route_name ?? '');
		const to_index = TAB_ORDER.indexOf(route);

		pending_animation_type_for_replace = (
			from_index !== -1 && to_index !== -1 && to_index < from_index
		) ? 'pop' : 'push';

		navigation.replace(route);
	};
};

export default useTabNavigate;
