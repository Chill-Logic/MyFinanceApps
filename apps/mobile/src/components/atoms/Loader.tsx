import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useThemeColor } from '../../hooks/useThemeColor';

export function Loader() {
	const color = useThemeColor({}, 'text');

	return (
		<View style={styles.container}>
			<ActivityIndicator size='small' color={color} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
});
