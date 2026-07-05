import React, { useEffect, useState } from 'react';
import {
	StyleSheet,
	TouchableOpacity,
} from 'react-native';
import { Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import CheckBox from '@react-native-community/checkbox';

import { useSignIn } from '../../hooks/api/auth/useSignIn';

import { useCurrentUserContext } from '../../context/current_user';
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
	const { setCurrentUser } = useCurrentUserContext();
	const { setCanSearchForWallets } = useWallet();

	const [ form, setForm ] = useState({ email: '', password: '' });
	const [ keep_logged_in, setKeepLoggedIn ] = useState(false);
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
				LocalStorage.setItem(StorageKeys.TOKEN, sign_in_response.token);
				if (keep_logged_in) {
					LocalStorage.setItem(StorageKeys.KEEP_LOGGED_IN, 'true');
				}
				setCanSearchForWallets(true);
				navigation.replace('Home');
			},
			onError: () => {
				Alert.alert('Erro', 'E-mail ou senha inválidos');
			},
		});
	};

	useEffect(() => {
		(async() => {
			const keep_logged_in_value = await LocalStorage.getItem(StorageKeys.KEEP_LOGGED_IN);
			const user_data = await LocalStorage.getItem(StorageKeys.USER_DATA);

			if (keep_logged_in_value && user_data) {
				setCurrentUser({ data: JSON.parse(user_data) });
				navigation.replace('Home');
			}
		})();
	}, [ navigation, setCurrentUser ]);

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

				<ThemedView style={styles.checkboxContainer}>
					<CheckBox
						disabled={is_sign_in_pending}
						value={keep_logged_in}
						onValueChange={(newValue: boolean) => setKeepLoggedIn(newValue)}
						tintColors={{ true: '#A328D6', false: '#666' }}
					/>
					<ThemedText style={styles.linkText}>Manter logado?</ThemedText>
				</ThemedView>

				<TouchableOpacity
					style={styles.linkContainer}
					onPress={() => navigation.navigate('SignUp')}
				>
					<ThemedText style={styles.linkText}>Primeira vez? Cadastre-se!</ThemedText>
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
	checkboxContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginLeft: 'auto',
		marginTop: 16,
	},
});

export default SignInScreen;
