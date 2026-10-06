import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Vitest blanks out CSS by default. The theme, overlay and font tests read the real
    // stylesheets, so let those files through.
    css: { include: [/themes\.css/, /app\.css/, /fonts\.css/] },
  },
})
