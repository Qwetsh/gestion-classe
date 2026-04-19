import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'http'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'pronote-proxy',
      configureServer(server) {
        server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (!req.url?.startsWith('/api/pronote-proxy')) return next()

          const url = new URL(req.url, 'http://localhost')
          const targetUrl = url.searchParams.get('url')
          if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Missing url parameter' }))
            return
          }

          try {
            // Read request body
            let body = ''
            for await (const chunk of req) body += chunk

            // Forward request to Pronote
            const headers: Record<string, string> = {}
            const fwdHeaders = ['content-type', 'cookie']
            for (const h of fwdHeaders) {
              if (req.headers[h]) headers[h] = req.headers[h] as string
            }
            // Forward custom headers from x-pronote-* prefix
            for (const [key, val] of Object.entries(req.headers)) {
              if (key.startsWith('x-pronote-')) {
                headers[key.replace('x-pronote-', '')] = val as string
              }
            }

            const response = await fetch(targetUrl, {
              method: req.method || 'GET',
              headers,
              body: body || undefined,
              redirect: 'manual',
            })

            // Forward response headers
            const responseHeaders: Record<string, string> = {
              'Access-Control-Allow-Origin': '*',
            }
            response.headers.forEach((val, key) => {
              responseHeaders[key] = val
            })

            res.writeHead(response.status, responseHeaders)
            const text = await response.text()
            res.end(text)
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Proxy error'
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: message }))
          }
        })
      },
    },
  ],
  base: '/gestion-classe/',
})
