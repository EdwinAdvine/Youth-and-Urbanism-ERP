/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#51459d',
          50: '#f0eeff',
          100: '#e3dfff',
          200: '#c8c0ff',
          300: '#a99bff',
          400: '#8a76ff',
          500: '#51459d',
          600: '#453a85',
          700: '#382f6d',
          800: '#2b2455',
          900: '#1e183d',
        },
        success: '#6fd943',
        info: '#3ec9d6',
        warning: '#ffa21d',
        danger: '#ff3a6e',
      },
      fontFamily: { sans: ['Open Sans', 'sans-serif'] },
      borderRadius: {
        DEFAULT: '10px',
        lg: '10px',
        md: '8px',
        sm: '6px',
      },
    },
  },
  plugins: [],
}
