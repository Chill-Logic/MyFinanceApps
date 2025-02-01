import { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Fragment } from 'react/jsx-runtime';

import { Paths } from './routes';

export const Router = () => {
	return (
		<BrowserRouter>
			<Routes>
				{
					Paths.map(({ 
						path, 
						element: Element, 
						template: Template 
					}) => (
						<Fragment key={path}>
							<Route 
								path={path}
								element={
									<Suspense>
										<Template>
											<Element/>
										</Template>
									</Suspense>
								}
							/>
						</Fragment>
					))
				}
			</Routes>
		</BrowserRouter>
	);
};