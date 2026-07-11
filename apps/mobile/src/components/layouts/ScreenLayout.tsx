import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { colors } from '@myfinance/shared';

import { ThemedView } from '../atoms/ThemedView';

const ScreenLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<View style={styles.container}>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			>
				<ThemedView style={styles.content}>
					{children}
				</ThemedView>
			</KeyboardAvoidingView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors['background-default'],
	},
	flex: {
		flex: 1,
	},
	content: {
		flex: 1,
		padding: 20,
	},
});

export default ScreenLayout;
