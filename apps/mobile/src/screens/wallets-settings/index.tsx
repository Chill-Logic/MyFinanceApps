import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import Icon from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';

import { useVersion } from '../../hooks/api/core/useVersion';

import { useTheme } from '../../context/theme';

import { IScreenProps } from '../../types/screen';

import { ThemedText } from '../../components/atoms/ThemedText';
import AuthenticatedLayout from '../../components/layouts/AuthenticatedLayout';
import { AccountInfoFormModal } from '../../components/organisms/AccountInfoFormModal';
import { AccountPasswordFormModal } from '../../components/organisms/AccountPasswordFormModal';

const app_version = Constants.expoConfig?.version;

/*
 * Normaliza a data do commit pra "DD/MM/AAAA às HH:MM" (formato do Rails ou ISO do git) só
 * extraindo os campos com regex — sem `new Date()`, aqui só interessa exibir o que veio.
 */
const formatVersionDate = (raw?: string) => {
	if (!raw || raw === 'unknown') return raw ?? '—';

	const match = raw.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
	if (!match) return raw;

	const [ , year, month, day, hour, minute ] = match;
	return `${ day }/${ month }/${ year } às ${ hour }:${ minute }`;
};

/**
 * Configurações do app (não mais da carteira — renomear/convidar/excluir carteira vivem no menu de
 * ações ⋮ de cada carteira, na MyWalletsScreen). Lista com "Conta" (Informações pessoais / Atualizar
 * senha, cada um abre um modal) e "Sobre" (versão do app + branch/commit/data da API).
 */
const WalletsSettingsScreen = ({ navigation }: IScreenProps<'WalletsSettings'>) => {
	const { theme } = useTheme();
	const { data: api_version } = useVersion();

	const [ is_info_open, setIsInfoOpen ] = useState(false);
	const [ is_password_open, setIsPasswordOpen ] = useState(false);

	return (
		<AuthenticatedLayout navigation={navigation}>
			<ScrollView showsVerticalScrollIndicator={false}>
				<ThemedText style={styles.sectionLabel}>Conta</ThemedText>

				<TouchableOpacity
					style={[ styles.row, { borderColor: theme.colors.border } ]}
					onPress={() => setIsInfoOpen(true)}
				>
					<Icon name='person' size={22} color={theme.colors.text} />
					<View style={styles.rowInfo}>
						<ThemedText style={styles.rowTitle}>Informações pessoais</ThemedText>
						<ThemedText style={styles.rowDescription}>Nome e e-mail</ThemedText>
					</View>
					<Icon name='chevron-right' size={22} color={theme.colors.placeholder} />
				</TouchableOpacity>

				<TouchableOpacity
					style={[ styles.row, { borderColor: theme.colors.border } ]}
					onPress={() => setIsPasswordOpen(true)}
				>
					<Icon name='lock' size={22} color={theme.colors.text} />
					<View style={styles.rowInfo}>
						<ThemedText style={styles.rowTitle}>Atualizar senha</ThemedText>
						<ThemedText style={styles.rowDescription}>Trocar sua senha</ThemedText>
					</View>
					<Icon name='chevron-right' size={22} color={theme.colors.placeholder} />
				</TouchableOpacity>

				<ThemedText style={styles.sectionLabel}>Sobre</ThemedText>

				<View style={[ styles.aboutBox, { borderColor: theme.colors.border } ]}>
					<ThemedText style={styles.aboutLine}>App: v{app_version}</ThemedText>
					{api_version ? (
						<>
							<ThemedText style={styles.aboutLine}>Branch: {api_version.branch}</ThemedText>
							<ThemedText style={styles.aboutLine}>Commit: {api_version.hash}</ThemedText>
							<ThemedText style={styles.aboutLine}>Data: {formatVersionDate(api_version.date)}</ThemedText>
						</>
					) : (
						<ThemedText style={styles.aboutLine}>Carregando versão da API…</ThemedText>
					)}
				</View>
			</ScrollView>

			<AccountInfoFormModal visible={is_info_open} onClose={() => setIsInfoOpen(false)} />
			<AccountPasswordFormModal visible={is_password_open} onClose={() => setIsPasswordOpen(false)} />
		</AuthenticatedLayout>
	);
};

const styles = StyleSheet.create({
	sectionLabel: {
		fontSize: 13,
		fontWeight: '700',
		textTransform: 'uppercase',
		color: '#868686',
		marginTop: 8,
		marginBottom: 8,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		borderWidth: 1,
		borderRadius: 8,
		padding: 14,
		marginBottom: 10,
	},
	rowInfo: {
		flex: 1,
	},
	rowTitle: {
		fontSize: 15,
		fontWeight: '600',
	},
	rowDescription: {
		fontSize: 12,
		color: '#868686',
		marginTop: 2,
	},
	aboutBox: {
		borderWidth: 1,
		borderRadius: 8,
		padding: 14,
		gap: 4,
	},
	aboutLine: {
		fontSize: 12,
		color: '#868686',
	},
});

export default WalletsSettingsScreen;
