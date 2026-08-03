import React, { useEffect, useState } from 'react';
import {
	StyleSheet,
	TouchableOpacity,
} from 'react-native';
import { Alert } from 'react-native';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage } from '@myfinance/shared';

import { useSignIn } from '../../hooks/api/auth/useSignIn';

import { useWallet } from '../../context/wallet';
import { LocalStorage } from '../../services/storage';

import { IScreenProps } from '../../types/screen';
import { StorageKeys } from '../../types/storage';

import { Loader } from '../../components/atoms/Loader';
import Logo from '../../components/atoms/Logo';
import { ThemedText } from '../../components/atoms/ThemedText';
import { ThemedTextInput } from '../../components/atoms/ThemedTextInput';
import { ThemedView } from '../../components/atoms/ThemedView';
import ScreenLayout from '../../components/layouts/ScreenLayout';

const SignInScreen = ({ navigation }: IScreenProps<'SignIn'>) => {
	const { setCanSearchForWallets } = useWallet();

	const [ form, setForm ] = useState({ email: '', password: '' });
	const [ show_password, setShowPassword ] = useState(false);
	const { mutate: signInMutation, isPending: is_sign_in_pending } = useSignIn();

	const onChange = (key: string, value: string) => {
		setForm({ ...form, [key]: value });
	};

	const onSubmit = () => {
		const body = {
			email: form.email,
			password: form.password,
		};

		signInMutation({
			body,
			onSuccess: async(sign_in_response) => {
				await LocalStorage.setItem(StorageKeys.TOKEN, sign_in_response.token);
				setCanSearchForWallets(true);
				navigation.replace('Home');
			},
			onError: (error) => {
				Alert.alert('Erro', getApiErrorMessage(error, 'E-mail ou senha inválidos'));
			},
		});
	};

	/*
	 * Restauração de sessão: só decide "existe sessão pra restaurar?" pela presença do TOKEN,
	 * e NÃO pré-popula o `current_user` a partir do USER_DATA persistido. Motivo: o token pode
	 * estar expirado (não há refresh token no backend), e restaurar o usuário aqui fazia o
	 * `AuthenticatedLayout` achar que já estava autenticado e montar a Home inteira de imediato,
	 * disparando todas as queries autenticadas em paralelo com o token velho — cascata de 401
	 * "token expirou" seguida de 401 "Autorização não encontrada" (depois do logout limpar o
	 * token no meio do voo). Agora quem valida a sessão é só o `/users/me` do próprio layout:
	 * navega pra Home, e é lá que o token é testado antes de qualquer outra requisição.
	 */
	useEffect(() => {
		(async() => {
			const token = await LocalStorage.getItem(StorageKeys.TOKEN);

			if (token) {
				navigation.replace('Home');
			}
		})();
	}, [ navigation ]);

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
					value={form.email}
					onChangeText={(value) => onChange('email', value)}
					editable={!is_sign_in_pending}
				/>
				<ThemedTextInput
					style={styles.input}
					placeholder='Senha'
					placeholderTextColor='#666'
					autoComplete='password'
					value={form.password}
					onChangeText={(value) => onChange('password', value)}
					editable={!is_sign_in_pending}
					secureTextEntry={!show_password}
					rightComponent={(
						<TouchableOpacity onPress={() => setShowPassword(!show_password)}>
							<Icon
								name={show_password ? 'visibility' : 'visibility-off'}
								size={24} color='#666'
							/>
						</TouchableOpacity>
					)}
				/>
				<TouchableOpacity
					style={[ styles.button, is_sign_in_pending && styles.buttonDisabled ]}
					onPress={onSubmit}
					disabled={is_sign_in_pending}
				>
					{is_sign_in_pending ? <Loader /> : <ThemedText style={styles.buttonText}>Entrar</ThemedText>}
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.linkContainer}
					onPress={() => navigation.navigate('SignUp')}
				>
					<ThemedText style={styles.linkText}>Primeira vez? Cadastre-se!</ThemedText>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.linkContainerSecondary}
					onPress={() => navigation.navigate('RecoverPassword')}
				>
					<ThemedText style={styles.linkText}>Esqueci minha senha</ThemedText>
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

export default SignInScreen;
