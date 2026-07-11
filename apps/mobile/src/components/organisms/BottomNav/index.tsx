import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors } from '@myfinance/shared';

import useNavItems, { TNavAction, TNavItem } from '../../../hooks/useNavItems';

import { useTheme } from '../../../context/theme';

import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

import NavMenu from '../NavMenu';

interface IBottomNavProps {
	navigate: (route: string)=> void;
	onNewWallet: ()=> void;
	onLogout: ()=> void;
}

/**
 * Docked (não flutuante) desde a primeira versão — o app web só chegou nesse formato depois
 * de reverter uma versão flutuante que escondia a última transação da lista (exigia acertar
 * um padding-bottom frágil no conteúdo). Aqui já nasce docked, parte do fluxo normal do
 * AuthenticatedLayout, reservando o próprio espaço.
 */
const BottomNav = ({ navigate, onNewWallet, onLogout }: IBottomNavProps) => {
	const { theme } = useTheme();
	const { navItems, currentRouteName, centerAction } = useNavItems();
	const [ is_menu_open, setIsMenuOpen ] = useState(false);

	/*
	 * Mesmo truque do equivalente web: guarda a última ação central conhecida mesmo depois
	 * do `centerAction` virar `null`, pra o ícone continuar visível ENQUANTO o botão encolhe
	 * (em vez de sumir instantaneamente no meio da animação).
	 */
	const [ displayed_action, setDisplayedAction ] = useState<TNavAction | null>(centerAction);
	const fab_scale = useRef(new Animated.Value(centerAction ? 1 : 0)).current;
	/*
	 * Espelha o `flex-grow`/`basis-0` com `transition-[flex-grow]` do web: lá, o slot central
	 * encolhe a largura (não só o botão) quando não existe `centerAction`, reaproximando os
	 * outros itens da barra. `width` não anima com o driver nativo, por isso essa animação
	 * roda em thread JS (`useNativeDriver: false`), diferente da escala/opacidade do FAB.
	 */
	const center_width = useRef(new Animated.Value(centerAction ? 64 : 0)).current;

	useEffect(() => {
		if (centerAction) setDisplayedAction(centerAction);

		Animated.parallel([
			Animated.timing(fab_scale, {
				toValue: centerAction ? 1 : 0,
				duration: 200,
				useNativeDriver: true,
			}),
			Animated.timing(center_width, {
				toValue: centerAction ? 64 : 0,
				duration: 200,
				useNativeDriver: false,
			}),
		]).start(() => {
			if (!centerAction) setDisplayedAction(null);
		});
	}, [ centerAction, fab_scale, center_width ]);

	const [ home_item, wallets_item, invites_item ] = navItems;

	const renderNavItem = (item: TNavItem) => {
		const is_active = item.route === currentRouteName;
		const item_color = is_active ? colors['brand-secondary'] : theme.colors.placeholder;

		return (
			<TouchableOpacity key={item.id} style={styles.navItem} onPress={() => navigate(item.route)}>
				<Icon name={item.icon as any} size={22} color={item_color} />
				<ThemedText numberOfLines={1} style={[ styles.navLabel, { color: item_color } ]}>
					{item.label}
				</ThemedText>
			</TouchableOpacity>
		);
	};

	return (
		<>
			<ThemedView style={[ styles.nav, { borderTopColor: theme.colors.border } ]}>
				{renderNavItem(home_item)}
				{renderNavItem(wallets_item)}

				<Animated.View style={[ styles.centerSlot, { width: center_width } ]}>
					<Animated.View
						pointerEvents={centerAction ? 'auto' : 'none'}
						style={{ transform: [ { scale: fab_scale } ], opacity: fab_scale }}
					>
						<TouchableOpacity
							style={styles.fab}
							onPress={() => centerAction?.onClick()}
							accessibilityLabel={displayed_action?.label}
						>
							{displayed_action && <Icon name={displayed_action.icon as any} size={24} color='white' />}
						</TouchableOpacity>
					</Animated.View>
				</Animated.View>

				{renderNavItem(invites_item)}

				<TouchableOpacity style={styles.navItem} onPress={() => setIsMenuOpen(true)}>
					<Icon name='menu' size={22} color={theme.colors.placeholder} />
					<ThemedText numberOfLines={1} style={[ styles.navLabel, { color: theme.colors.placeholder } ]}>
						Menu
					</ThemedText>
				</TouchableOpacity>
			</ThemedView>

			<NavMenu
				visible={is_menu_open}
				onClose={() => setIsMenuOpen(false)}
				navigate={navigate}
				onNewWallet={onNewWallet}
				onLogout={onLogout}
			/>
		</>
	);
};

const styles = StyleSheet.create({
	nav: {
		flexDirection: 'row',
		alignItems: 'center',
		borderTopWidth: 1,
	},
	navItem: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 2,
		paddingVertical: 10,
	},
	navLabel: {
		fontSize: 11,
		lineHeight: 14,
		fontWeight: '500',
	},
	centerSlot: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	fab: {
		width: 64,
		height: 64,
		borderRadius: 32,
		backgroundColor: colors['brand-secondary'],
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: -32,
		elevation: 4,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
	},
});

export default BottomNav;
