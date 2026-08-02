/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Indigo 主色：#6366F1 → #818CF8 → #A5B4FC
        primary: {
          DEFAULT: '#6366F1',
          light: '#818CF8',
          lighter: '#A5B4FC',
          dark: '#4F46E5',
        },
        aurora: {
          pink: '#EC4899',
          purple: '#6366F1',
          lavender: '#818CF8',
          lilac: '#A5B4FC',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      backdropBlur: {
        xs: '2px',
        '4xl': '72px',
      },
      boxShadow: {
        glass: '0 20px 60px rgba(0, 0, 0, 0.12)',
        'glass-dark': '0 20px 60px rgba(0, 0, 0, 0.3)',
        glow: '0 0 30px rgba(99, 102, 241, 0.35)',
      },
      backgroundImage: {
        'aurora-gradient':
          'linear-gradient(135deg, #6366F1 0%, #818CF8 50%, #A5B4FC 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        'gradient-drift': 'gradient-drift 8s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'gradient-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(20px, -15px) scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
}
