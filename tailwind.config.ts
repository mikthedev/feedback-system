import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#CAF76F',
          hover: '#B8E55F',
          active: '#A6D34F',
        },
        background: {
          DEFAULT: '#111111',
          light: '#1a1a1a',
          lighter: '#222222',
        },
        text: {
          primary: '#ffffff',
          secondary: '#b3b3b3',
          muted: '#808080',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        button: '10px',
      },
      transitionTimingFunction: {
        'framer': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
export default config
