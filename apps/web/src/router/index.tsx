import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { RouteGuard } from './guards';
import { Paths } from './routes';

export const Router = () => {
	return (
		<BrowserRouter>
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
