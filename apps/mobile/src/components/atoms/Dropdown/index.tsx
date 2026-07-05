import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../../context/theme';

import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';

type TDropdownOption = {
	label: string;
	value: string;
}

type TDropdownProps = {
	options: TDropdownOption[];
	value: string;
	onChange: (value: string)=> void;
	label?: string;
	disabled?: boolean;
	placeholder?: string;
}

const Dropdown = (props: TDropdownProps) => {
	const { options, value, onChange, label, disabled, placeholder } = props;
	const { theme } = useTheme();
	const [ isOpen, setIsOpen ] = useState(false);

	const selectedOption = options.find(option => option.value === value);

	const handleSelect = (optionValue: string) => {
		onChange(optionValue);
		setIsOpen(false);
	};

	return (
		<ThemedView style={styles.container}>
			{label && <ThemedText style={styles.label}>{label}</ThemedText>}

			<TouchableOpacity
				style={[
					styles.dropdownButton,
					{ borderColor: theme.colors.border },
					disabled && styles.disabled,
				]}
				onPress={() => !disabled && setIsOpen(true)}
				disabled={disabled}
			>
				<ThemedText style={[ styles.buttonText, { color: theme.colors.text } ]}>
					{selectedOption ? selectedOption.label : placeholder || 'Selecione uma opção'}
				</ThemedText>
				<Icon
					name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
					size={20}
					color={theme.colors.text}
				/>
			</TouchableOpacity>

			<Modal
				visible={isOpen}
				transparent={true}
				animationType='fade'
				onRequestClose={() => setIsOpen(false)}
			>
				<TouchableOpacity
					style={styles.modalOverlay}
					activeOpacity={1}
					onPress={() => setIsOpen(false)}
				>
					<ThemedView style={[ styles.dropdownMenu, { backgroundColor: theme.colors.background } ]}>
						<ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
							{options.map((option) => (
								<TouchableOpacity
									key={option.value}
									style={[
										styles.option,
										option.value === value && styles.selectedOption,
									]}
									onPress={() => handleSelect(option.value)}
								>
									<ThemedText style={[
										styles.optionText,
										{ color: theme.colors.text },
										option.value === value && styles.selectedOptionText,
									]}>
										{option.label}
									</ThemedText>
									{option.value === value && (
										<Icon name='check' size={16} color={theme.colors.text} />
									)}
								</TouchableOpacity>
							))}
						</ScrollView>
					</ThemedView>
				</TouchableOpacity>
			</Modal>
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	container: {
		width: '100%',
		marginBottom: 10,
	},
	label: {
		fontSize: 14,
		marginBottom: 5,
		fontWeight: '500',
	},
	dropdownButton: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderWidth: 1,
		borderRadius: 6,
		minHeight: 44,
	},
	buttonText: {
		fontSize: 16,
		flex: 1,
	},
	disabled: {
		opacity: 0.5,
	},
	modalOverlay: {
		flex: 1,
		justifyContent: 'flex-start',
		alignItems: 'flex-start',
		paddingTop: 160,
		paddingLeft: 20,
	},
	dropdownMenu: {
		maxHeight: 200,
		minWidth: 240,
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
		borderWidth: 1,
		borderColor: '#ddd',
	},
	scrollView: {
		maxHeight: 200,
	},
	option: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	selectedOption: {
		backgroundColor: 'rgba(0, 122, 255, 0.1)',
	},
	optionText: {
		fontSize: 16,
		flex: 1,
	},
	selectedOptionText: {
		fontWeight: '600',
	},
});

export default Dropdown;
