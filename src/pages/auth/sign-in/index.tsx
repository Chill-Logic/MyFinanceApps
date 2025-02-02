import logo from '@/assets/Logo Full MyFinance Cortada.png'
import TextInput from '../../../components/atoms/TextInput';

const SignInPage = () => {

  return (
    <form>
      <div className="w-[300px] flex flex-col gap-y-14">
        <img src={logo} alt="logo" />
        <div className="w-full flex flex-col gap-y-4">
          <TextInput type='e-mail' placeholder='Insira aqui seu e-mail' label='E-mail' />
          <TextInput type='password' placeholder='Insira aqui sua senha' label='Senha' />
        </div>
      </div>
    </form>
  );
}

export default SignInPage;
