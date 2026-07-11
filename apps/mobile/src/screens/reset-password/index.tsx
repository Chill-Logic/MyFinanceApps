import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage } from '@myfinance/shared';

import { useResetPassword } from '../../hooks/api/auth/useResetPassword';

import { IScreenProps } from '../../types/screen';

import { Loader } from '../../components/atoms/Loader';
import Logo from '../../components/atoms/Logo';
import { ThemedText } from '../../components/atoms/ThemedText';
import { ThemedTextInput } from '../../components/atoms/ThemedTextInput';
import { ThemedView } from '../../components/atoms/ThemedView';
import ScreenLayout from '../../components/layouts/ScreenLayout';

const INITIAL_VALUES = { token: '', password: '', password_confirmation: '' };

const ResetPasswordScreen = ({ navigation }: IScreenProps<'ResetPassword'>) => {
	const [ values, setValues ] = useState(INITIAL_VALUES);
	const [ show_password, setShowPassword ] = useState(false);
	const { mutate: resetPasswordMutation, isPending } = useResetPassword();

	const onChange = (key: keyof typeof values, value: string) => {
		setValues((prev) => ({ ...prev, [key]: value }));
	};

	const onSubmit = () => {
		if (values.password !== values.password_confirmation) {
			Toast.show({ type: 'error', text1: 'Erro', text2: 'As senhas não coincidem' });
			return;
		}

		resetPasswordMutation({
			body: values,
			onSuccess: (data) => {
				Toast.show({ type: 'success', text1: data.message || 'Senha alterada com sucesso!' });
				navigation.replace('SignIn');
			},
			onError: (error) => {
				Toast.show({
					type: 'error',
					text1: 'Não foi possível redefinir',
					text2: getApiErrorMessage(error, 'Verifique o token e tente novamente'),
				});
			},
		});
	};

	const is_submit_disabled = isPending || !values.token || !values.password || !values.password_confirmation;

	return (
		<ScreenLayout>
			<ThemedView style={styles.formContainer}>
				<ThemedView style={styles.logoContainer}>
					<Logo />
				</ThemedView>

				<ThemedText style={styles.description}>
					Cole o token recebido por e-mail e defina sua nova senha.
				</ThemedText>

				<ThemedTextInput
					style={styles.input}
					placeholder='Token'
					placeholderTextColor='#666'
					autoCapitalize='none'
					value={values.token}
					onChangeText={(value) => onChange('token', value)}
					editable={!isPending}
				/>

				<ThemedTextInput
					style={styles.input}
					placeholder='Nova senha'
					placeholderTextColor='#666'
					secureTextEntry={!show_password}
					autoComplete='password'
					value={values.password}
					onChangeText={(value) => onChange('password', value)}
					editable={!isPending}
					rightComponent={(
						<TouchableOpacity onPress={() => setShowPassword(!show_password)}>
							<Icon name={show_password ? 'visibility' : 'visibility-off'} size={24} color='#666' />
						</TouchableOpacity>
					)}
				/>

				<ThemedTextInput
					style={styles.input}
					placeholder='Confirmar nova senha'
					placeholderTextColor='#666'
					secureTextEntry={!show_password}
					autoComplete='password'
					value={values.password_confirmation}
					onChangeText={(value) => onChange('password_confirmation', value)}
					editable={!isPending}
				/>

				<TouchableOpacity
					style={[ styles.button, is_submit_disabled && styles.buttonDisabled ]}
					onPress={onSubmit}
					disabled={is_submit_disabled}
				>
					{isPending ? <Loader /> : <ThemedText style={styles.buttonText}>Redefinir senha</ThemedText>}
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.linkContainer}
					onPress={() => navigation.navigate('SignIn')}
				>
					<ThemedText style={styles.linkText}>Voltar para o login</ThemedText>
				</TouchableOpacity>
			</ThemedView>
		</ScreenLayout>
	);
};

const styles = StyleSheet.create({
	formContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	logoContainer: {
		marginBottom: 24,
	},
	description: {
		color: '#fff',
		fontSize: 14,
		textAlign: 'center',
		marginBottom: 20,
	},
	input: {
		width: '100%',
		height: 48,
		backgroundColor: '#fff',
		borderRadius: 8,
		marginBottom: 16,
		paddingHorizontal: 16,
		fontSize: 16,
		color: '#000',
	},
	button: {
		width: '100%',
		height: 48,
		backgroundColor: colors['brand-secondary'],
		borderRadius: 8,
		justifyContent: 'center',
		alignItems: 'center',
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	buttonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
	},
	linkContainer: {
		marginTop: 30,
	},
	linkText: {
		color: '#fff',
		fontSize: 15,
		fontWeight: 'bold',
	},
});

export default ResetPasswordScreen;
