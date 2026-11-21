import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Native } from '@/services/native';

import App from './App';

import './styles/index.css';

Native.init();

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
