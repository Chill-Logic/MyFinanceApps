import AuthFlow from '@/components/organisms/AuthFlow';

/* Entrar: o fluxo em duas etapas decide se pede a senha, manda pro Google ou abre o cadastro. */
const SignInPage = () => <AuthFlow intent='sign-in' />;

export default SignInPage;
