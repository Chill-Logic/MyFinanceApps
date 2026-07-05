import { StyleSheet } from 'react-native';

import { IScreenProps } from '../../types/screen';

import { ThemedView } from '../../components/atoms/ThemedView';
import AuthenticatedLayout from '../../components/layouts/AuthenticatedLayout';
import TransactionsList from '../../components/organisms/TransactionList';

const HomeScreen = ({ navigation }: IScreenProps<'Home'>) => {

	return (
		<AuthenticatedLayout navigation={navigation}>
			<ThemedView style={styles.container}>
				<TransactionsList />
			</ThemedView>
		</AuthenticatedLayout>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});

export default HomeScreen;
