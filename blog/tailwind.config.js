/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 粉紫渐变主色：#8B5CF6 → #A78BFA → #C4B5FD
        primary: {
          DEFAULT: '#8B5CF6',
          light: '#A78BFA',
          lighter: '#C4B5FD',
          dark: '#7C3AED',
        },
        aurora: {
          pink: '#EC4899',
          purple: '#8B5CF6',
          lavender: '#A78BFA',
          lilac: '#C4B5FD',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif',
        ],
        serif: [
          'Noto Serif SC',
          'PingFang SC',
          'Microsoft YaHei',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'serif',
        ],
      },
      backdropBlur: {
        xs: '2px',
        '4xl': '72px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(31, 38, 135, 0.15)',
        'glass-dark': '0 8px 32px rgba(31, 38, 135, 0.2)',
        'glass-lg': '0 20px 50px rgba(139, 92, 246, 0.22)',
        glow: '0 0 30px rgba(139, 92, 246, 0.35)',
      },
      backgroundImage: {
        'aurora-gradient':
          'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 50%, #C4B5FD 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        'gradient-drift': 'gradient-drift 8s ease-in-out infinite',
        'gradient-move': 'gradient-move 15s ease infinite',
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
        'gradient-move': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
    },
  },
  plugins: [],
}
