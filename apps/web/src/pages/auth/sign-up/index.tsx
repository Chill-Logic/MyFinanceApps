import AuthFlow from '@/components/organisms/AuthFlow';

/* Criar conta: o mesmo fluxo do Entrar, começando pelo e-mail (se ele já tiver conta, pede a senha). */
const SignUpPage = () => <AuthFlow intent='sign-up' />;

export default SignUpPage;
