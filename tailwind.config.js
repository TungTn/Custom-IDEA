/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ij: {
          darkest: '#1E1F22',
          panel: '#2B2D30',
          editor: '#1E1F22',
          header: '#2B2D30',
          border: '#393B40',
          borderLight: '#4E5157',
          hover: '#35373B',
          selected: '#2E436E',
          activeTab: '#1E1F22',
          inactiveTab: '#2B2D30',
          text: '#DFE1E5',
          muted: '#868A91',
          blue: '#3574F0',
          green: '#59A869',
          orange: '#EDA200',
          red: '#E05555'
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Consolas', 'Menlo', 'monospace'],
        sans: ['"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}
