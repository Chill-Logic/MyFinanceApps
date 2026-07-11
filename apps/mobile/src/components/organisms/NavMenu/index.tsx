import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

import Icon from '@expo/vector-icons/MaterialIcons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { colors } from '@myfinance/shared';
import Constants from 'expo-constants';

import { useListInvites } from '../../../hooks/api/user-wallets/useListInvites';
import { useIndexWallets } from '../../../hooks/api/wallets/useIndexWallets';
import useNavItems from '../../../hooks/useNavItems';

import { useCurrentUserContext } from '../../../context/current_user';
import { useRefresh } from '../../../context/refresh';
import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';

import { ThemedText } from '../../atoms/ThemedText';

const version = Constants.expoConfig?.version;

interface INavMenuProps {
	visible: boolean;
	onClose: ()=> void;
	navigate: (route: string)=> void;
	onNewWallet: ()=> void;
	onLogout: ()=> void;
}

/**
 * Equivalente ao NavLinks + Popover do apps/web, agora como bottom sheet
 * (@gorhom/bottom-sheet) em vez de um `<Modal transparent animationType='fade'>` cru —
 * ganha entrada/saída animada, backdrop que fecha ao tocar fora, E drag-to-dismiss nativo
 * (por isso o app inteiro precisou passar a rodar dentro de um `GestureHandlerRootView`,
 * configurado em `App.tsx`). Ver CLAUDE.md ("BottomSheetModal não funcionava — causa raiz e
 * fix") pra o histórico completo de como cada peça abaixo foi descoberta — resumo aqui:
 *
 * - É o `<BottomSheet>` puro (sempre montado), NÃO o `<BottomSheetModal>` — o Modal, que só
 *   monta via Portal quando `present()` é chamado, nunca completava a animação de abertura
 *   neste app (sem erro, sem `onChange`, sem conteúdo visível), em qualquer versão/config
 *   testada. `<BottomSheet>` sempre montado, controlado por `ref` (`snapToIndex`/`close`)
 *   dentro de um `useEffect` reagindo a `visible`, funciona.
 * - `animateOnMount={false}` evita que a primeira renderização tente animar (era o gatilho
 *   real do travamento). `index={-1}` como valor ESTÁTICO da prop (nunca calculado direto
 *   no JSX a partir de `visible`, tipo `index={visible ? 1 : -1}`) evita um warning do
 *   Reanimated sobre escrever em shared value durante o render, que fazia o sheet abrir e
 *   fechar sozinho em sequência.
 * - `snapPoints={['1%', '60%']}` (dois pontos, não um só) é workaround de um bug real do
 *   Reanimated v4 no `withSpring`/`withTiming` (software-mansion/react-native-reanimated#7947,
 *   confirmado pelo time do Reanimated) — com um único snap point a animação falhava.
 * - `enableContentPanningGesture={false}`: sem isso, rolar a lista de carteiras competia
 *   com o gesto de arrastar-pra-fechar do sheet e fechava o menu sozinho. Fechar por
 *   arrasto continua funcionando pela alcinha (handle) no topo.
 * - Expandir/colapsar "Visualizando a carteira" anima com `Animated` (núcleo do
 *   react-native, mesma API do FAB em `BottomNav`), não Reanimated nem `LayoutAnimation`
 *   (que não tem efeito dentro de um `BottomSheetScrollView` — não participa do sistema
 *   clássico de layout animation do RN).
 * - A lista de opções de carteira NÃO tem `ScrollView` próprio — já testamos e um scroll
 *   aninhado dentro do `BottomSheetScrollView` externo compete pelo mesmo gesto e rola o
 *   menu inteiro em vez da lista. Os itens fluem no scroll do menu.
 * - Selecionar uma carteira só troca a carteira e fecha o menu — não navega pra Home (não é
 *   uma ação de navegação, só de contexto).
 *
 * O seletor de carteira deixou de abrir um SEGUNDO modal (o átomo `Dropdown`, removido —
 * só existia pra esse uso). Dois `Modal` nativos abertos ao mesmo tempo já causou problema
 * neste app antes (ver `TransactionFormModal`/calendário no CLAUDE.md).
 */
const NavMenu = ({ visible, onClose, navigate, onNewWallet, onLogout }: INavMenuProps) => {
	const { theme } = useTheme();
	const { current_user } = useCurrentUserContext();
	const { user_wallet, setUserWallet } = useWallet();
	const { refresh, isRefreshing } = useRefresh({ all: true });

	const sheet_ref = useRef<BottomSheet>(null);
	const [ is_wallet_list_open, setIsWalletListOpen ] = useState(false);
	const snap_points = useMemo(() => [ '1%', '60%' ], []);
	const wallet_list_progress = useRef(new Animated.Value(0)).current;

	const { data: data_wallets } = useIndexWallets({
		enabled: !!current_user?.data?.id,
	});
	const { data: data_invites } = useListInvites();
	const { navItems } = useNavItems();

	const wallets_options = useMemo(() => (
		data_wallets?.data.map((wallet) => ({ label: wallet.name, value: wallet.id })) || []
	), [ data_wallets ]);

	const selected_wallet_label = useMemo(() => (
		wallets_options.find((option) => option.value === user_wallet?.data?.id)?.label
		?? 'Selecione uma carteira'
	), [ wallets_options, user_wallet?.data?.id ]);

	useEffect(() => {
		if (visible) {
			sheet_ref.current?.snapToIndex(1);
		} else {
			sheet_ref.current?.close();
			setIsWalletListOpen(false);
		}
	}, [ visible ]);

	useEffect(() => {
		Animated.timing(wallet_list_progress, {
			toValue: is_wallet_list_open ? 1 : 0,
			duration: 120,
			useNativeDriver: false,
		}).start();
	}, [ is_wallet_list_open, wallet_list_progress ]);

	const handleNavigate = (route: string) => {
		onClose();
		navigate(route);
	};

	const toggleWalletList = () => {
		setIsWalletListOpen((prev) => !prev);
	};

	const handleSelectWallet = (wallet_id: string) => {
		const new_wallet = data_wallets?.data.find((wallet) => wallet.id === wallet_id);
		if (new_wallet) setUserWallet({ data: new_wallet });
		setIsWalletListOpen(false);
		onClose();
	};

	const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => (
		<BottomSheetBackdrop
			{...props}
			appearsOnIndex={1}
			disappearsOnIndex={-1}
			pressBehavior='close'
		/>
	), []);

	return (
		<BottomSheet
			ref={sheet_ref}
			index={-1}
			snapPoints={snap_points}
			enableDynamicSizing={false}
			animateOnMount={false}
			enableContentPanningGesture={false}
			onChange={(index) => {
				if (index === -1) onClose();
			}}
			backdropComponent={renderBackdrop}
			backgroundStyle={{ backgroundColor: theme.colors.background }}
			handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
		>
			<BottomSheetScrollView style={styles.content}>
				<View style={styles.menuHeader}>
					<View style={styles.menuHeaderInfo}>
						<ThemedText numberOfLines={1} style={styles.userName}>{current_user?.data?.name}</ThemedText>
						<ThemedText numberOfLines={1} style={styles.userEmail}>{current_user?.data?.email}</ThemedText>
					</View>
					<TouchableOpacity onPress={refresh} disabled={isRefreshing} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
						{isRefreshing ? (
							<ActivityIndicator size='small' color={theme.colors.placeholder} />
						) : (
							<Icon name='refresh' size={20} color={theme.colors.placeholder} />
						)}
					</TouchableOpacity>
				</View>

				<View style={[ styles.divider, { backgroundColor: theme.colors.border } ]} />

				<TouchableOpacity
					style={styles.walletSwitcherHeader}
					onPress={toggleWalletList}
				>
					<View style={styles.walletSwitcherHeaderText}>
						<ThemedText style={styles.walletSwitcherLabel}>Visualizando a carteira</ThemedText>
						<ThemedText numberOfLines={1} style={styles.walletSwitcherValue}>{selected_wallet_label}</ThemedText>
					</View>
					<Icon
						name={is_wallet_list_open ? 'expand-less' : 'expand-more'}
						size={22}
						color={theme.colors.placeholder}
					/>
				</TouchableOpacity>

				<Animated.View
					style={{
						opacity: wallet_list_progress,
						maxHeight: wallet_list_progress.interpolate({
							inputRange: [ 0, 1 ],
							outputRange: [ 0, 300 ],
						}),
						overflow: 'hidden',
					}}
				>
					{wallets_options.map((option) => (
						<TouchableOpacity
							key={option.value}
							style={styles.walletOption}
							onPress={() => handleSelectWallet(option.value)}
						>
							<ThemedText numberOfLines={1} style={styles.walletOptionText}>{option.label}</ThemedText>
							{option.value === user_wallet?.data?.id && (
								<Icon name='check' size={16} color={colors['brand-secondary']} />
							)}
						</TouchableOpacity>
					))}
				</Animated.View>

				<View style={[ styles.divider, { backgroundColor: theme.colors.border } ]} />

				{navItems.map((item) => (
					<TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => handleNavigate(item.route)}>
						<Icon name={item.icon as any} size={20} color={theme.colors.text} />
						<ThemedText style={styles.menuItemText}>{item.label}</ThemedText>
						{item.id === 'wallets_invites' && Boolean(data_invites?.data.length) && (
							<ThemedText style={styles.invitesCount}>{data_invites?.data.length}</ThemedText>
						)}
					</TouchableOpacity>
				))}

				<TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); onNewWallet(); }}>
					<Icon name='create-new-folder' size={20} color={theme.colors.text} />
					<ThemedText style={styles.menuItemText}>Nova Carteira</ThemedText>
				</TouchableOpacity>

				<View style={[ styles.divider, { backgroundColor: theme.colors.border } ]} />

				<TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('WalletsSettings')}>
					<Icon name='settings' size={20} color={theme.colors.text} />
					<ThemedText style={styles.menuItemText}>Configurações</ThemedText>
				</TouchableOpacity>

				<TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); onLogout(); }}>
					<Icon name='logout' size={20} color={colors['feedback-danger-default']} />
					<ThemedText style={[ styles.menuItemText, { color: colors['feedback-danger-default'] } ]}>Sair</ThemedText>
				</TouchableOpacity>

				<ThemedText style={styles.version}>v{version}</ThemedText>
			</BottomSheetScrollView>
		</BottomSheet>
	);
};

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 20,
		paddingTop: 4,
		paddingBottom: 32,
		gap: 4,
	},
	menuHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	menuHeaderInfo: {
		flex: 1,
	},
	userName: {
		fontSize: 14,
		fontWeight: '700',
	},
	userEmail: {
		fontSize: 12,
		color: '#868686',
	},
	divider: {
		height: 1,
		marginVertical: 8,
	},
	walletSwitcherHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 10,
	},
	walletSwitcherHeaderText: {
		flex: 1,
	},
	walletSwitcherLabel: {
		fontSize: 12,
		color: '#868686',
	},
	walletSwitcherValue: {
		fontSize: 15,
		fontWeight: '600',
		marginTop: 2,
	},
	walletOption: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 10,
		paddingLeft: 12,
		paddingRight: 16,
	},
	walletOptionText: {
		flex: 1,
		fontSize: 14,
	},
	menuItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 10,
	},
	menuItemText: {
		flex: 1,
		fontSize: 14,
	},
	invitesCount: {
		color: 'white',
		fontSize: 11,
		fontWeight: 'bold',
		borderRadius: 100,
		backgroundColor: colors['brand-secondary'],
		width: 20,
		height: 20,
		textAlign: 'center',
		lineHeight: 20,
	},
	version: {
		marginTop: 8,
		fontSize: 11,
		color: '#868686',
		textAlign: 'center',
	},
});

export default NavMenu;
