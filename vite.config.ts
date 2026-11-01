import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({ envDir: false, plugins: [react(), tailwindcss()], resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }, server: { proxy: { '/supabase': { target: 'http://127.0.0.1:5180', changeOrigin: true } } }, preview: { proxy: { '/supabase': { target: 'http://127.0.0.1:5180', changeOrigin: true } } }, build: { outDir: 'dist' } })
