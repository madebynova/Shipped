import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Vitest blanks out CSS by default. The theme tests read the real stylesheet, so let
    // the theme file through.
    css: { include: [/themes\.css/] },
  },
})
