import type { Config } from 'tailwindcss';

/**
 * CargoTrust design tokens.
 *
 *   navy   deep maritime navy: dark surfaces, headings
 *   ink    text, derived from navy
 *   brand  Atlantic blue: primary actions, links, focus
 *   aqua   maritime teal: secondary accent, positive emphasis on dark surfaces
 *   ai     steel blue: anything read by the AI vision model
 *   amber  (Tailwind default): review states, sparing accent
 *
 * Radii are small (4 to 8 px) and shadows flat: an operations tool, not a showcase.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"IBM Plex Sans Condensed"', '"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        navy: { 50: '#F1F4F8', 100: '#E1E7EF', 200: '#C3CFDD', 300: '#97A9C0', 400: '#6A82A0', 500: '#4A6584', 600: '#364F6C', 700: '#263C56', 800: '#182B42', 900: '#0F2034', 950: '#091626' },
        ink: { 900: '#0E1B2C', 800: '#172638', 700: '#233548', 600: '#34485D', 500: '#4D6177', 400: '#6B7D91', 300: '#96A4B4', 200: '#C5CED8', 100: '#E3E8ED', 50: '#F4F6F8' },
        brand: { 50: '#EDF3FA', 100: '#D8E5F3', 200: '#B0CBE7', 300: '#7FA9D5', 400: '#4C84BF', 500: '#2366AA', 600: '#1B5592', 700: '#174676', 800: '#13385E', 900: '#0F2B48' },
        aqua: { 50: '#EAF6F5', 100: '#CBEBE8', 300: '#79CBC2', 400: '#3AAEA3', 500: '#16928A', 600: '#0E7871', 700: '#0B5F5A' },
        ai: { 50: '#EEF4F7', 100: '#D9E7EE', 300: '#8DB4C7', 400: '#5C93AE', 500: '#3B7896', 600: '#2D6280', 700: '#234E67' },
        line: '#E2E7ED',
        canvas: '#F3F5F7',
      },
      borderRadius: {
        xl: '0.625rem',
        '2xl': '0.75rem',
        '3xl': '1rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,32,52,.05)',
        lift: '0 12px 32px -12px rgba(15,32,52,.22), 0 2px 6px rgba(15,32,52,.06)',
        // retired decorative glows: kept as flat shadows so old class names stay harmless
        glowBrand: '0 1px 2px rgba(15,32,52,.08)',
        glowAi: '0 1px 2px rgba(15,32,52,.08)',
        glowEmerald: '0 1px 2px rgba(15,32,52,.08)',
        glowDanger: '0 1px 2px rgba(15,32,52,.08)',
      },
      keyframes: {
        dashmove: { to: { strokeDashoffset: '-28' } },
        pageIn: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
        popIn: { '0%': { opacity: '0', transform: 'scale(.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shakeX: { '10%,90%': { transform: 'translateX(-1px)' }, '20%,80%': { transform: 'translateX(2px)' }, '30%,50%,70%': { transform: 'translateX(-3px)' }, '40%,60%': { transform: 'translateX(3px)' } },
        toastbar: { from: { width: '100%' }, to: { width: '0%' } },
        sail: { '0%': { transform: 'translateX(-6%)' }, '100%': { transform: 'translateX(6%)' } },
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        dashmove: 'dashmove 1.6s linear infinite',
        pageIn: 'pageIn .25s ease-out both',
        popIn: 'popIn .18s ease-out both',
        shakeX: 'shakeX .4s both',
        sail: 'sail 22s ease-in-out infinite alternate',
        fadeUp: 'fadeUp .45s cubic-bezier(.22,1,.36,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
