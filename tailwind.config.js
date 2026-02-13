/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fdp: {
          'bg-0': '#0a1628',
          'bg-1': '#0f1e33',
          'bg-2': '#132540',
          'surface-1': '#162032',
          'surface-2': '#1a2842',
          'border-1': '#2a3f5f',
          'text-1': '#EAF2FF',
          'text-2': '#C7D5E8',
          'text-3': '#8FA2BF',
          'accent-1': '#00d4ff',
          'accent-2': '#3de0ff',
          'accent-glow': '#7deaff',
          'pos': '#2EE59D',
          'neg': '#FF4D6D',
          'warn': '#F5C542',
        },
      },
    },
  },
  plugins: [],
};
