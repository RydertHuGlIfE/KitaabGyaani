import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload-pdf': 'http://localhost:5000',
      '/upload-multiple-pdfs': 'http://localhost:5000',
      '/chat': 'http://localhost:5000',
      '/summarize': 'http://localhost:5000',
      '/summarize-multiple': 'http://localhost:5000',
      '/quiz': 'http://localhost:5000',
      '/mindmap': 'http://localhost:5000',
      '/get-pdf-info': 'http://localhost:5000',
      '/pdf': 'http://localhost:5000',
      '/switch-pdf': 'http://localhost:5000',
      '/visualize': 'http://localhost:5000',
      '/visualize/subtopic': 'http://localhost:5000',
    }
  }
})
