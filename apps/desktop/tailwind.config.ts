import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kibo: {
          bg: '#0a0a0b',
          surface: '#111114',
          border: '#1f1f24',
          muted: '#8a8a94',
          text: '#e8e8ee',
          accent: '#7c8cff',
          accentDeep: '#6366f1',
          violet: '#a78bfa',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'SF Pro Text',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'SF Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 0 0 rgba(255,255,255,0.03), 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
export default config;
