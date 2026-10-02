import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Named "slate" in components, but the scale is a neutral zinc palette
        // driven by CSS variables so light mode can invert it without rewrites.
        slate: {
          50: 'rgb(var(--c-50) / <alpha-value>)',
          100: 'rgb(var(--c-100) / <alpha-value>)',
          200: 'rgb(var(--c-200) / <alpha-value>)',
          300: 'rgb(var(--c-300) / <alpha-value>)',
          400: 'rgb(var(--c-400) / <alpha-value>)',
          500: 'rgb(var(--c-500) / <alpha-value>)',
          600: 'rgb(var(--c-600) / <alpha-value>)',
          700: 'rgb(var(--c-700) / <alpha-value>)',
          800: 'rgb(var(--c-800) / <alpha-value>)',
          900: 'rgb(var(--c-900) / <alpha-value>)',
          950: 'rgb(var(--c-950) / <alpha-value>)',
        },
        tea: {
          50: '#effaf3',
          100: '#d8f3e1',
          200: '#b4e5c6',
          300: '#83d0a4',
          400: '#50b47e',
          500: '#2e9862',
          600: '#1f7a4e',
          700: '#1a6141',
          800: '#174e36',
          900: '#14402e',
          950: '#0a241a',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        welcome: ['var(--font-welcome)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
