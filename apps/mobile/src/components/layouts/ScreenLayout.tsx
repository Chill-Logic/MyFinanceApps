import { SafeAreaView, StyleSheet } from 'react-native';

import { ThemedView } from '../atoms/ThemedView';

const ScreenLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<SafeAreaView style={styles.container}>
			<ThemedView style={styles.content}>
				{children}
			</ThemedView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
		padding: 20,
	},
});

export default ScreenLayout;
