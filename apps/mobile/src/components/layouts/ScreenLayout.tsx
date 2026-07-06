import { StyleSheet, View } from 'react-native';

import { colors } from '@myfinance/shared';

import { ThemedView } from '../atoms/ThemedView';

const ScreenLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<View style={styles.container}>
			<ThemedView style={styles.content}>
				{children}
			</ThemedView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors['background-default'],
	},
	content: {
		flex: 1,
		padding: 20,
	},
});

export default ScreenLayout;
