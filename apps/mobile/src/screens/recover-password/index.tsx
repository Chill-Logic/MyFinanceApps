import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';

import { colors, getApiErrorMessage } from '@myfinance/shared';

import { useRecoverPassword } from '../../hooks/api/auth/useRecoverPassword';

import { IScreenProps } from '../../types/screen';

import { Loader } from '../../components/atoms/Loader';
import Logo from '../../components/atoms/Logo';
import { ThemedText } from '../../components/atoms/ThemedText';
import { ThemedTextInput } from '../../components/atoms/ThemedTextInput';
import { ThemedView } from '../../components/atoms/ThemedView';
import ScreenLayout from '../../components/layouts/ScreenLayout';

const RecoverPasswordScreen = ({ navigation }: IScreenProps<'RecoverPassword'>) => {
	const [ email, setEmail ] = useState('');
	const { mutate: recoverPasswordMutation, isPending } = useRecoverPassword();

	const onSubmit = () => {
		recoverPasswordMutation({
			body: { email },
			onSuccess: (data) => {
				Toast.show({
					type: 'success',
					text1: data.message || 'E-mail enviado!',
					text2: 'Confira sua caixa de entrada e use o token na próxima tela.',
				});
				navigation.navigate('ResetPassword');
			},
			onError: (error) => {
				Toast.show({
					type: 'error',
					text1: 'Não foi possível enviar',
					text2: getApiErrorMessage(error, 'Tente novamente'),
				});
			},
		});
	};

	return (
		<ScreenLayout>
			<ThemedView style={styles.formContainer}>
				<ThemedView style={styles.logoContainer}>
					<Logo />
				</ThemedView>

				<ThemedText style={styles.description}>
					Informe o e-mail da sua conta. Enviaremos um token para você redefinir a senha.
				</ThemedText>

				<ThemedTextInput
					style={styles.input}
					placeholder='E-mail'
					placeholderTextColor='#666'
					keyboardType='email-address'
					autoCapitalize='none'
					value={email}
					onChangeText={setEmail}
					editable={!isPending}
				/>

				<TouchableOpacity
					style={[ styles.button, isPending && styles.buttonDisabled ]}
					onPress={onSubmit}
					disabled={isPending || !email}
				>
					{isPending ? <Loader /> : <ThemedText style={styles.buttonText}>Enviar instruções</ThemedText>}
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.linkContainer}
					onPress={() => navigation.navigate('ResetPassword')}
				>
					<ThemedText style={styles.linkText}>Já tenho um token</ThemedText>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.linkContainerSecondary}
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
	linkContainerSecondary: {
		marginTop: 12,
	},
	linkText: {
		color: '#fff',
		fontSize: 15,
		fontWeight: 'bold',
	},
});

export default RecoverPasswordScreen;
