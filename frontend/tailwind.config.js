/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: '#0b1120',
          text: '#94a3b8',
        },
        page: {
          bg: '#f4f6f9',
        },
        card: {
          bg: '#ffffff',
        },
        status: {
          online: '#10b981',
          offline: '#ef4444',
        },
        entry: {
          from: '#10b981',
          to: '#0d9488',
        },
        guest: {
          from: '#f97316',
          to: '#f59e0b',
        },
        primary: {
          from: '#3b82f6',
          to: '#4f46e5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}