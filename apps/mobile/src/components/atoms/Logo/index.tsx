import { StyleSheet } from 'react-native';

import { ThemedText } from '../ThemedText';

const Logo = () => {
	return (
		<ThemedText style={styles.logo}>
      MyFinance
		</ThemedText>
	);
};

const styles = StyleSheet.create({
	logo: {
		fontSize: 50,
		fontFamily: 'Saira Stencil One',
		fontWeight: 700,
		lineHeight: 50,
	},
});

export default Logo;
