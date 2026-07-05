import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { Picker } from '@react-native-picker/picker';

import { useTheme } from '../../../context/theme';

import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';

type TSelectOption = {
	label: string;
	value: string;
}

type TSelectInputProps = {
	options: TSelectOption[];
	value: string;
	onChange: (value: string)=> void;
	label?: string;
	disabled?: boolean;
	valueStyle?: StyleProp<ViewStyle>;
	itemStyle?: StyleProp<ViewStyle>;
}

const SelectInput = (props: TSelectInputProps) => {
	const { options, value, onChange, label, disabled, valueStyle, itemStyle } = props;
	const { theme } = useTheme();

	return (
		<ThemedView style={styles.container}>
			{label && <ThemedText>{label}</ThemedText>}
			<ThemedView style={[ styles.pickerContainer, valueStyle ]}>
				<Picker
					selectedValue={value}
					onValueChange={(option: string) => onChange(option)}
					style={[ styles.picker, { color: theme.colors.text } ]}
					enabled={!disabled}
				>
					{options.map((option) => (
						<Picker.Item key={option.value} label={option.label} value={option.value} style={itemStyle} />
					))}
				</Picker>
			</ThemedView>
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	pickerContainer: {
		borderWidth: 1,
		borderColor: '#ccc',
		borderRadius: 5,
		marginTop: 5,
	},
	picker: {
		height: 50,
	},
	container: {
		gap: 5,
		width: '100%',
	},
});

export default SelectInput;
