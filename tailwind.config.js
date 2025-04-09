/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        spin: {
          // The "to" property represents the ending state of the animation.
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        // This defines the animation shorthand.
        // It uses the 'spin' keyframes, a duration of 1s, linear easing, and infinite iterations.
        spin: 'spin 1s linear infinite',
      },
    },
  },
  plugins: [],
}
