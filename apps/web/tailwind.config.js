/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0eef9',
          100: '#d9d5f0',
          200: '#b3abe1',
          300: '#8d81d2',
          400: '#6757c3',
          500: '#534AB7',
          600: '#433b92',
          700: '#322c6e',
          800: '#221e49',
          900: '#110f25',
        },
      },
    },
  },
  plugins: [],
};
