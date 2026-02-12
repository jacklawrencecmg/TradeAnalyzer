/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fdp: {
          'bg-0': '#000A1E',
          'bg-1': '#0A141E',
          'bg-2': '#0A1428',
          'surface-1': '#001428',
          'surface-2': '#0B1B33',
          'border-1': '#1A2A44',
          'text-1': '#EAF2FF',
          'text-2': '#C7CBD6',
          'text-3': '#8FA2BF',
          'accent-1': '#3CBEDC',
          'accent-2': '#5BC0FF',
          'accent-glow': '#9AF0FF',
          'pos': '#2EE59D',
          'neg': '#FF4D6D',
          'warn': '#F5C542',
        },
      },
    },
  },
  plugins: [],
};
