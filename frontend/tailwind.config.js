/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: '#030712',
        panel: '#0a0f1e',
        'panel-border': '#1a2535',
        'neon-green': '#00dc82',
        'neon-cyan': '#06b6d4',
        'neon-blue': '#3b82f6',
        'alert-red': '#ef4444',
        'alert-yellow': '#f59e0b',
      },
      fontFamily: {
        mono: ['"Rajdhani"', 'monospace'],
        sans: ['"Space Grotesk"', 'sans-serif'],
      },
      animation: {
        'scanline': 'scanline 8s linear infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' }
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '.8', filter: 'brightness(1.5)' },
        }
      }
    },
  },
  plugins: [],
}
