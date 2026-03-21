import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary accent — a warm dusty rose
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
        // Warm neutrals for backgrounds and surfaces
        cream: {
          50: '#fdfaf7',
          100: '#faf5ee',
          200: '#f5ead9',
          300: '#eedec4',
          400: '#e3cda4',
          500: '#d4b483',
        },
        // Coffee-toned browns for text
        espresso: {
          100: '#f0e8df',
          200: '#d4bfab',
          300: '#b89b7e',
          400: '#9a7a5c',
          500: '#7a5c3e',
          600: '#5c4029',
          700: '#3d2b1a',
          800: '#22180f',
          900: '#0f0a05',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 16px 0 rgba(154, 122, 92, 0.08)',
        'card': '0 4px 24px 0 rgba(154, 122, 92, 0.10)',
        'elevated': '0 8px 40px 0 rgba(154, 122, 92, 0.16)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
