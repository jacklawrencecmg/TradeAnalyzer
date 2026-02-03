/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cmg: {
          'primary': '#3CBEDC',
          'primary-dark': '#0694B5',
          'secondary': '#1A2F4F',
          'dark': '#0A1628',
          'accent': '#2EE59D',
        },
      },
    },
  },
  plugins: [],
};
