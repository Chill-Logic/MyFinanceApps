import tailwindScrollbar from 'tailwind-scrollbar';
import tailwindcssAnimate from 'tailwindcss-animate';

import { Tokens } from './src/util';

import { Config } from 'tailwindcss/types/config';

/** @type {import('tailwindcss').Config} */

const tailwindConfig: Config = {
	darkMode: 'class',
	content: [
		'./index.html',
		'./src/**/*.{js,ts,jsx,tsx}',
	],
	theme: {
		fontFamily: Tokens.fontFamily,
		extend: {
			fontSize: Tokens.fontSize,
			fontWeight: Tokens.fontWeight,
			colors: {
				...Tokens.colors,
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
			},
			spacing: Tokens.spacing,
			borderRadius: {
				...Tokens.borderRadius,
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			keyframes: {
				rotate: {
					'0%': { transform: 'rotate(0deg)' },
					'100%': { transform: 'rotate(1turn)' },
				},
				rotateOpacity: {
					'0%': {
						transform: 'rotate(0deg)',
						opacity: '0.1',
					},
					'100%': {
						transform: 'rotate(1turn)',
						opacity: '1',
					},
				}
			},
			animation: {
				rotate: 'rotate ease-in 1s infinite',
				rotateOpacity1: 'rotateOpacity ease-in 1s infinite 0.1s',
				rotateOpacity2: 'rotateOpacity ease-in 1s infinite 0.2s',
				fadeIn: 'fadeIn ease-out 0.2s',
				fadeUp: 'fadeUp ease-out 0.2s'
			},
			backgroundImage: {
				'check': 'url("data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M18.7099 7.20986C18.617 7.11613 18.5064 7.04174 18.3845 6.99097C18.2627 6.9402 18.132 6.91406 17.9999 6.91406C17.8679 6.91406 17.7372 6.9402 17.6154 6.99097C17.4935 7.04174 17.3829 7.11613 17.29 7.20986L9.83995 14.6699L6.70995 11.5299C6.61343 11.4366 6.49949 11.3633 6.37463 11.3141C6.24978 11.2649 6.11645 11.2408 5.98227 11.2431C5.84809 11.2454 5.71568 11.2741 5.5926 11.3276C5.46953 11.3811 5.35819 11.4583 5.26495 11.5549C5.17171 11.6514 5.0984 11.7653 5.04919 11.8902C4.99999 12.015 4.97586 12.1484 4.97818 12.2825C4.9805 12.4167 5.00923 12.5491 5.06272 12.6722C5.11622 12.7953 5.19343 12.9066 5.28995 12.9999L9.12995 16.8399C9.22291 16.9336 9.33351 17.008 9.45537 17.0588C9.57723 17.1095 9.70794 17.1357 9.83995 17.1357C9.97196 17.1357 10.1027 17.1095 10.2245 17.0588C10.3464 17.008 10.457 16.9336 10.55 16.8399L18.7099 8.67986C18.8115 8.58622 18.8925 8.47257 18.9479 8.34607C19.0033 8.21957 19.0319 8.08296 19.0319 7.94486C19.0319 7.80676 19.0033 7.67015 18.9479 7.54365C18.8925 7.41715 18.8115 7.3035 18.7099 7.20986Z\' fill=\'%23FBFBFB\'/%3E%3C/svg%3E%0A")',
				'hospital-room': 'url(\'../assets/images/landing-page/hospital-room.jpeg\')',
				'female-doctor': 'url(\'../assets/images/landing-page/doctor2.png\')',
				'logo': 'url(\'../assets/images/landing-page/logo-bg.png\')',
			}
		}
	},
	plugins: [
		tailwindScrollbar({ nocompatible: true }),
		tailwindcssAnimate,
	],
};

export default tailwindConfig;