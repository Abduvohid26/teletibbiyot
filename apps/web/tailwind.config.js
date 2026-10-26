/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /* iShifo logotipi: navy #061743 */
        brand: {
          50: '#f0f3fa',
          100: '#dde4f3',
          200: '#bccae8',
          300: '#8fa5d4',
          400: '#5f7cba',
          500: '#3b5a9e',
          600: '#233f84',
          700: '#1a316b',
          800: '#122554',
          900: '#0b1b45',
          950: '#061743',
        },
        /* iShifo logotipi: oltin #e2b43d */
        gold: {
          50: '#fdf8ea',
          100: '#faefcc',
          200: '#f4dc94',
          300: '#ecc75c',
          400: '#e2b43d',
          500: '#c99a26',
          600: '#a67b1c',
          700: '#7f5d18',
          800: '#5c4416',
          900: '#3d2e10',
        },
        accent: {
          50: '#fdf8ea',
          100: '#faefcc',
          500: '#c99a26',
          600: '#a67b1c',
          700: '#7f5d18',
        },
        surface: {
          DEFAULT: '#f2f4f8',
          card: '#ffffff',
          muted: '#f8fafc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.35s ease-out',
        'liquid-float': 'liquid-float 8s ease-in-out infinite',
        'liquid-float-delayed': 'liquid-float 10s ease-in-out 2s infinite',
        'shimmer': 'shimmer 2.5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
        'dash-flow': 'dash-flow 1.8s linear infinite',
        'ring-pulse': 'ring-pulse 2.8s ease-out infinite',
      },
      keyframes: {
        'dash-flow': {
          to: { strokeDashoffset: '-32' },
        },
        'ring-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'liquid-float': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -20px) scale(1.05)' },
          '66%': { transform: 'translate(-20px, 15px) scale(0.95)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.08)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.04)',
        panel: '0 0 0 1px rgb(0 0 0 / 0.03), 0 2px 8px -2px rgb(0 0 0 / 0.06)',
        glow: '0 0 20px -5px rgb(35 63 132 / 0.25)',
        glass: '0 8px 32px rgb(6 23 67 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.6)',
        'glass-lg': '0 12px 40px rgb(6 23 67 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.7)',
      },
    },
  },
  plugins: [],
};
