import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
  	extend: {
  		screens: {
  			xs: '375px'
  		},
  		spacing: {
  			'1.25': '0.3125rem',
  			'1.75': '0.4375rem'
  		},
  		colors: {
  			background: 'rgb(var(--ff-bg-rgb) / <alpha-value>)',
  			foreground: 'rgb(var(--ff-text-rgb) / <alpha-value>)',
  			card: {
  				DEFAULT: 'rgb(var(--ff-surface-rgb) / <alpha-value>)',
  				foreground: 'rgb(var(--ff-text-rgb) / <alpha-value>)'
  			},
  			popover: {
  				DEFAULT: 'rgb(var(--ff-surface-rgb) / <alpha-value>)',
  				foreground: 'rgb(var(--ff-text-rgb) / <alpha-value>)'
  			},
  			primary: {
  				DEFAULT: 'rgb(var(--ff-primary-rgb) / <alpha-value>)',
  				foreground: 'rgb(255 255 255 / <alpha-value>)'
  			},
  			secondary: {
  				DEFAULT: 'rgb(var(--ff-surface-2-rgb) / <alpha-value>)',
  				foreground: 'rgb(var(--ff-text-rgb) / <alpha-value>)'
  			},
  			muted: {
  				DEFAULT: 'rgb(var(--ff-surface-2-rgb) / <alpha-value>)',
  				foreground: 'rgb(var(--ff-text-muted-rgb) / <alpha-value>)'
  			},
  			accent: {
  				DEFAULT: 'rgb(var(--ff-surface-2-rgb) / <alpha-value>)',
  				foreground: 'rgb(var(--ff-text-rgb) / <alpha-value>)'
  			},
  			destructive: {
  				DEFAULT: 'rgb(var(--ff-error-rgb) / <alpha-value>)',
  				foreground: 'rgb(255 255 255 / <alpha-value>)'
  			},
  			border: 'rgb(var(--ff-border-rgb) / <alpha-value>)',
  			input: 'rgb(var(--ff-border-rgb) / <alpha-value>)',
  			ring: 'rgb(var(--ff-primary-rgb) / <alpha-value>)',
  			sidebar: 'rgb(var(--ff-surface-rgb) / <alpha-value>)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [animate],
};
