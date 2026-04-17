/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        detective: {
          bg: '#1a1a1a',
          ink: '#e8e4d9',
          accent: '#c9a96e',
          dim: '#6b6b6b',
        },
      },
    },
  },
  plugins: [],
};
