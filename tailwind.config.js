/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        xs: '375px',
      },
      spacing: {
        1.25: '0.3125rem',
        1.75: '0.4375rem',
      },
    },
  },
  plugins: [],
};
