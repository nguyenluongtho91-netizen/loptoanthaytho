/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui'],
      },
      backgroundImage: {
        'teal-gradient': 'linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #5eead4 100%)',
        'teal-dark':     'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
        'page-bg':       'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 50%, #5eead4 100%)',
      },
      boxShadow: {
        teal: '0 8px 32px rgba(13,148,136,0.25)',
        'teal-lg': '0 20px 50px rgba(13,148,136,0.35)',
      }
    },
  },
  plugins: [],
}
