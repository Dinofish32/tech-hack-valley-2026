/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,jsx}',
    './src/index.html',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0F1E',
        surface: '#0D1117',
        accent: '#2563EB',
        muted: '#1E2A45',
        text: '#E2E8F0',
        'text-muted': '#64748B',
        danger: '#EF4444',
        success: '#22C55E',
        warning: '#F59E0B',
      },
    },
  },
  plugins: [],
};
