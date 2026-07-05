import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, Modal, View, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';

const MONTHS = [
	'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
	'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

type TMonthYearSelectorProps = {
	onChange: (month: number, year: number)=> void;
	value: {
		month: number;
		year: number;
	};
};

const 	MonthYearSelector = (props: TMonthYearSelectorProps) => {
	const { onChange, value } = props;

	const [ isModalVisible, setIsModalVisible ] = useState(false);
	const [ tempMonth, setTempMonth ] = useState(value.month);
	const [ tempYear, setTempYear ] = useState(value.year);

	const confirmSelection = () => {
		onChange(tempMonth, tempYear);
		setIsModalVisible(false);
	};

	const generateYearOptions = () => {
		const currentYear = new Date().getFullYear();
		const years = [];
		for (let year = currentYear - 5; year <= currentYear + 9; year++) {
			years.push(year);
		}
		return years;
	};

	return (
		<>
			<TouchableOpacity
				style={styles.monthYearSelectorContainer}
				onPress={() => setIsModalVisible(true)}
			>
				<ThemedView style={styles.monthSelectorContainer}>
					<TouchableOpacity
						style={styles.monthChevron}
						onPress={() => {
							if(value.month === 0) {
								onChange(11, value.year - 1);
							} else {
								onChange(value.month - 1, value.year);
							}
						}}
					>
						<Icon name='chevron-left' size={24} color='#666' />
					</TouchableOpacity>
					<ThemedText>{MONTHS[value.month]}</ThemedText>
					<TouchableOpacity
						style={styles.monthChevron}
						onPress={() => {
							if(value.month === 11) {
								onChange(0, value.year + 1);
							} else {
								onChange(value.month + 1, value.year);
							}
						}}
					>
						<Icon name='chevron-right' size={24} color='#666' />
					</TouchableOpacity>
				</ThemedView>
				<ThemedText style={styles.yearSelector}>
					{value.year}
				</ThemedText>
			</TouchableOpacity>

			<Modal
				visible={isModalVisible}
				transparent={true}
				animationType='slide'
				onRequestClose={() => setIsModalVisible(false)}
			>
				<View style={styles.modalOverlay}>
					<TouchableOpacity
						style={styles.modalBackdrop}
						activeOpacity={1}
						onPress={() => setIsModalVisible(false)}
					/>
					<ThemedView style={styles.modalContainer}>
						<View style={styles.modalHeader}>
							<ThemedText style={styles.modalTitle}>Selecionar Período</ThemedText>
							<TouchableOpacity
								style={styles.todayButton}
								onPress={() => {
									setTempMonth(new Date().getMonth());
									setTempYear(new Date().getFullYear());
									onChange(new Date().getMonth(), new Date().getFullYear());
									setIsModalVisible(false);
								}}
							>
								<Icon name='calendar-today' size={20} color='#666' />
								<ThemedText style={styles.modalTitle}>Hoje</ThemedText>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.closeButton}
								onPress={() => setIsModalVisible(false)}
							>
								<Icon name='close' size={20} color='#666' />
							</TouchableOpacity>
						</View>

						<ScrollView
							style={styles.scrollContainer}
							showsVerticalScrollIndicator={false}
							bounces={false}
						>
							<View style={styles.contentContainer}>
								<View style={styles.sectionContainer}>
									<ThemedText style={styles.sectionTitle}>Mês</ThemedText>
									<View style={styles.monthContainer}>
										{MONTHS.map((month, index) => (
											<TouchableOpacity
												key={index}
												style={[
													styles.monthItem,
													tempMonth === index && styles.selectedMonthItem,
												]}
												onPress={() => setTempMonth(index)}
											>
												<ThemedText
													style={[
														styles.monthItemText,
														tempMonth === index && styles.selectedMonthItemText,
													]}
												>
													{month.substring(0, 3)}
												</ThemedText>
											</TouchableOpacity>
										))}
									</View>
								</View>

								<View style={styles.sectionContainer}>
									<ThemedText style={styles.sectionTitle}>Ano</ThemedText>
									<View style={styles.yearContainer}>
										{generateYearOptions().map((year) => (
											<TouchableOpacity
												key={year}
												style={[
													styles.yearItem,
													tempYear === year && styles.selectedYearItem,
												]}
												onPress={() => setTempYear(year)}
											>
												<ThemedText
													style={[
														styles.yearItemText,
														tempYear === year && styles.selectedYearItemText,
													]}
												>
													{year}
												</ThemedText>
											</TouchableOpacity>
										))}
									</View>
								</View>
							</View>
						</ScrollView>

						<View style={styles.modalFooter}>
							<TouchableOpacity
								style={styles.actionButton}
								onPress={confirmSelection}
							>
								<ThemedText style={styles.actionButtonText}>Confirmar</ThemedText>
							</TouchableOpacity>
						</View>
					</ThemedView>
				</View>
			</Modal>
		</>
	);
};

const styles = StyleSheet.create({
	monthYearSelectorContainer: {
		justifyContent: 'space-between',
		alignItems: 'center',
		width: '100%',
	},
	monthSelectorContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		width: '100%',
	},
	monthChevron: {
		padding: 10,
		borderWidth: 1,
		borderColor: '#666',
		borderRadius: 50,
	},
	monthYearSelectorInput: {
		flex: 1,
	},
	yearSelector: {
		fontSize: 16,
		fontWeight: 'bold',
	},
	picker: {
		textAlign: 'center',
		textAlignVertical: 'center',
	},
	monthYearSelectorInputItem: {
		textAlignVertical: 'center',
		color: 'white',
	},
	modalOverlay: {
		flex: 1,
		justifyContent: 'flex-end',
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.3)',
	},
	modalContainer: {
		backgroundColor: 'white',
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingTop: 8,
		paddingHorizontal: 24,
		maxHeight: '85%',
		minHeight: '60%',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: -4,
		},
		shadowOpacity: 0.1,
		shadowRadius: 12,
		elevation: 8,
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#f0f0f0',
		marginBottom: 24,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: '600',
		color: '#1a1a1a',
	},
	todayButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	closeButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: '#f5f5f5',
		justifyContent: 'center',
		alignItems: 'center',
	},
	scrollContainer: {
		flex: 1,
	},
	contentContainer: {
		paddingBottom: 20,
	},
	sectionContainer: {
		marginBottom: 32,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '500',
		color: '#333',
		marginBottom: 16,
	},
	monthContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		gap: 8,
	},
	yearContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		gap: 8,
	},
	monthItem: {
		width: '22%',
		height: 44,
		justifyContent: 'center',
		alignItems: 'center',
		borderRadius: 12,
		backgroundColor: '#f8f9fa',
		borderWidth: 1,
		borderColor: '#e9ecef',
	},
	selectedMonthItem: {
		backgroundColor: '#e3f2fd',
		borderColor: '#2196f3',
		borderWidth: 2,
	},
	monthItemText: {
		fontSize: 14,
		fontWeight: '500',
		color: '#495057',
	},
	selectedMonthItemText: {
		color: '#1976d2',
		fontWeight: '600',
	},
	yearItem: {
		width: '18%',
		height: 40,
		justifyContent: 'center',
		alignItems: 'center',
		borderRadius: 10,
		backgroundColor: '#f8f9fa',
		borderWidth: 1,
		borderColor: '#e9ecef',
	},
	selectedYearItem: {
		backgroundColor: '#e3f2fd',
		borderColor: '#2196f3',
		borderWidth: 2,
	},
	yearItemText: {
		fontSize: 13,
		fontWeight: '500',
		color: '#495057',
	},
	selectedYearItemText: {
		color: '#1976d2',
		fontWeight: '600',
	},
	modalFooter: {
		paddingTop: 16,
		paddingBottom: 34,
		borderTopWidth: 1,
		borderTopColor: '#f0f0f0',
	},
	actionButton: {
		backgroundColor: '#2196f3',
		paddingVertical: 16,
		borderRadius: 12,
		alignItems: 'center',
		shadowColor: '#2196f3',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 3,
	},
	actionButtonText: {
		color: 'white',
		fontSize: 16,
		fontWeight: '600',
	},
});

export default MonthYearSelector;
