/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Kibo design tokens — mirrored from apps/desktop tailwind.config
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
    },
  },
  plugins: [],
};
