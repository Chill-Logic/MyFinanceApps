import { BrowserRouter, Routes, Route } from 'react-router-dom';

import useNativeBackButton from '@/hooks/useNativeBackButton';

import { RouteGuard } from './guards';
import { Paths } from './routes';

/* Componente só pra ter acesso ao contexto do router (useNavigate) dentro do <BrowserRouter>. */
const NativeBridge = () => {
	useNativeBackButton();
	return null;
};

export const Router = () => {
	return (
		<BrowserRouter>
			<NativeBridge />
			<Routes>
				{
					Paths.map(({
						path,
						element: Element,
						template: Template,
						isPrivate,
						isGuestOnly,
					}) => (
						<Route
							key={path}
							path={path}
							element={
								<Template>
									<RouteGuard isPrivate={isPrivate} isGuestOnly={isGuestOnly}>
										<Element />
									</RouteGuard>
								</Template>
							}
						/>
					))
				}
			</Routes>
		</BrowserRouter>
	);
};
