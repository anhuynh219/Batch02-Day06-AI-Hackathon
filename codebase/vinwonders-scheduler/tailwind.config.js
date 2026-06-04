/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: '#FAF4E8',
        cream: '#FFFDF8',
        ink: '#15302E',
        muted: '#5B7370',
        ocean: { DEFAULT: '#0E7C7B', deep: '#0B5E5E', light: '#5FB3B0' },
        coral: { DEFAULT: '#FF6B4A', deep: '#E8492A' },
        mango: '#F6A623',
        sky: '#6FBBD6',
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Be Vietnam Pro"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 24px -12px rgba(21,48,46,0.30)',
        lift: '0 16px 40px -16px rgba(21,48,46,0.40)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bob: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'dot': {
          '0%,80%,100%': { opacity: '0.25', transform: 'translateY(0)' },
          '40%': { opacity: '1', transform: 'translateY(-3px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'pop-in': 'pop-in 0.4s cubic-bezier(0.22,1,0.36,1) both',
        bob: 'bob 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
