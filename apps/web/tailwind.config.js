/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        navy: {
          50: '#f0f1f5',
          100: '#d9dbe6',
          200: '#b3b7cd',
          300: '#8d93b4',
          400: '#676f9b',
          500: '#414b82',
          600: '#1a1a2e',
          700: '#151525',
          800: '#10101c',
          900: '#0b0b13',
        },
        coral: {
          50: '#fdf3f2',
          100: '#fbe5e3',
          200: '#f7ccc8',
          300: '#f2aaa3',
          400: '#e85d4e',
          500: '#d94a3b',
          600: '#b83a2d',
          700: '#973026',
          800: '#7d2a23',
          900: '#662821',
        },
        cream: '#FFF8F0',
      },
      fontFamily: {
        display: ['Oswald', 'sans-serif'],
        sans: ['Inter Tight', 'Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
