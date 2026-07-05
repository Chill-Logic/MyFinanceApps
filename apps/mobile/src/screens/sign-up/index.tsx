import React, { useState } from 'react';
import {
	StyleSheet,
	TouchableOpacity,
} from 'react-native';
import Toast from 'react-native-toast-message';

import { useSignUp } from '../../hooks/api/auth/useSignUp';

import { TSignUpBody } from '../../types/api';
import { TSignUpForm } from '../../types/forms';
import { IScreenProps } from '../../types/screen';

import { Loader } from '../../components/atoms/Loader';
import Logo from '../../components/atoms/Logo';
import { ThemedText } from '../../components/atoms/ThemedText';
import { ThemedTextInput } from '../../components/atoms/ThemedTextInput';
import { ThemedView } from '../../components/atoms/ThemedView';
import ScreenLayout from '../../components/layouts/ScreenLayout';

const INITIAL_VALUES: TSignUpForm = { nome: '', email: '', senha: '', confirmar_senha: '' };

const SignUpScreen = ({ navigation }: IScreenProps<'SignUp'>) => {
	const [ values, setValues ] = useState<TSignUpForm>(INITIAL_VALUES);
	const { mutate: signUpMutation, isPending: is_sign_up_pending } = useSignUp();

	const onChange = (key: string, value: string) => {
		setValues({ ...values, [key]: value });
	};

	const onSubmit = () => {
		if (values.senha !== values.confirmar_senha) {
			Toast.show({
				type: 'error',
				text1: 'Erro ao cadastrar usuário',
				text2: 'As senhas não coincidem',
			});
			return;
		}

		const body: TSignUpBody = {
			name: values.nome,
			email: values.email,
			password: values.senha,
		};

		signUpMutation({
			body,
			onSuccess: () => {
				Toast.show({
					type: 'success',
					text1: 'Cadastro realizado com sucesso!',
				});
				navigation.replace('SignIn');
			},
			onError: (e) => {
				Toast.show({
					type: 'error',
					text1: 'Erro ao cadastrar usuário',
					text2: 'Verifique os campos e tente novamente',
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
				<ThemedTextInput
					style={styles.input}
					placeholder='E-mail'
					placeholderTextColor='#666'
					keyboardType='email-address'
					autoCapitalize='none'
					value={values.email}
					onChangeText={(value) => onChange('email', value)}
					editable={!is_sign_up_pending}
				/>

				<ThemedTextInput
					style={styles.input}
					placeholder='Nome'
					placeholderTextColor='#666'
					value={values.nome}
					onChangeText={(value) => onChange('nome', value)}
					editable={!is_sign_up_pending}
				/>

				<ThemedTextInput
					style={styles.input}
					placeholder='Senha'
					placeholderTextColor='#666'
					secureTextEntry
					autoComplete='password'
					value={values.senha}
					onChangeText={(value) => onChange('senha', value)}
					editable={!is_sign_up_pending}
				/>

				<ThemedTextInput
					style={styles.input}
					placeholder='Confirmar senha'
					placeholderTextColor='#666'
					secureTextEntry
					autoComplete='password'
					value={values.confirmar_senha}
					onChangeText={(value) => onChange('confirmar_senha', value)}
					editable={!is_sign_up_pending}
				/>

				<TouchableOpacity
					style={[ styles.button, is_sign_up_pending && styles.buttonDisabled ]}
					onPress={onSubmit}
					disabled={is_sign_up_pending}
				>
					{is_sign_up_pending ? <Loader /> : <ThemedText style={styles.buttonText}>Cadastrar</ThemedText>}
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.linkContainer}
					onPress={() => navigation.navigate('SignIn')}
				>
					<ThemedText style={styles.linkText}>Já possui uma conta? Faça login!</ThemedText>
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
		backgroundColor: '#A328D6',
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

export default SignUpScreen;
