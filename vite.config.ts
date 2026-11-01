import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const siteOrigin = 'https://rcfito.paxxa.chatgpt.site'
const proxy = (): Record<string, ProxyOptions> => ({
  '/supabase': { target: 'http://127.0.0.1:5180', changeOrigin: true },
  '^/api/(?:application-(?:draft|chat|query|transcription)|ai-settings(?:/test)?)$': { target: siteOrigin, changeOrigin: true, configure: server => { server.on('proxyReq', request => { request.setHeader('Origin', siteOrigin); request.removeHeader('Cookie') }) } },
})
export default defineConfig({ envDir: false, plugins: [react(), tailwindcss()], resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }, server: { proxy: proxy() }, preview: { proxy: proxy() }, build: { outDir: 'dist' } })
