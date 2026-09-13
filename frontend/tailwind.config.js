/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: '#000000',
        panel: '#09090b', // Zinc 950
        'panel-border': '#27272a', // Zinc 800
        'neon-green': '#39ff14', // High-vis hacker green
        'neon-cyan': '#00f0ff', // Cyberpunk cyan
        'neon-blue': '#3b82f6',
        'alert-red': '#ff003c',
        'alert-yellow': '#facc15',
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
