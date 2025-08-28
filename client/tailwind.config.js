// Tailwind CSS v4 uses a different configuration approach
// The configuration is now handled through CSS files
// This file can be removed as it's not needed for v4
import { defineConfig } from 'tailwindcss'

export default defineConfig({
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
})
