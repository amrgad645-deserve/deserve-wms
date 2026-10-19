/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        deserve: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
          blue: '#2563EB',
          green: '#16A34A',
          amber: '#D97706',
          red: '#DC2626',
        }
      }
    },
  },
  plugins: [],
}
