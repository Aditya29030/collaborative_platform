/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0F766E', // teal, matches the ReadyNest poster accent
          dark: '#0B4F49',
        },
      },
    },
  },
  plugins: [],
};
