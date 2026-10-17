/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        adn: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fb',
          400: '#38aaf7',
          500: '#0e8fe9',
          600: '#0272c7',
          700: '#035ba1',
          800: '#074d85',
          900: '#0c416e',
          950: '#082949',
        },
      },
    },
  },
  plugins: [],
}
