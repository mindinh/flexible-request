import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import history from 'connect-history-api-fallback'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // Use absolute paths for BTP AppRouter deployment to support deep linking
  base: '/',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "#cds-models": path.resolve(__dirname, "../../@cds-models"),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'spa-fallback',
      configureServer(server) {
        // Add history API fallback BEFORE Vite's own middlewares
        server.middlewares.use(
          history({
            // Don't rewrite API calls, Vite internals, or static files
            rewrites: [
              // Keep Vite internal routes
              { from: /^\/@/, to: (context) => context.parsedUrl.path! },
              { from: /^\/node_modules\//, to: (context) => context.parsedUrl.path! },
              { from: /^\/src\//, to: (context) => context.parsedUrl.path! },
              // Keep OData API routes
              { from: /^\/odata\/.*$/, to: (context) => context.parsedUrl.path! },
              // Keep Admin API routes
              { from: /^\/admin\/.*$/, to: (context) => context.parsedUrl.path! },
              { from: /^\/admin$/, to: (context) => context.parsedUrl.path! },
              // Keep Identity API routes
              { from: /^\/identity\/.*$/, to: (context) => context.parsedUrl.path! },
              { from: /^\/identity$/, to: (context) => context.parsedUrl.path! },
              // Keep legacy routes
              { from: /^\/browse\/.*$/, to: (context) => context.parsedUrl.path! },
              { from: /^\/browse$/, to: (context) => context.parsedUrl.path! },
              // Keep docs (markdown files)
              { from: /^\/docs\/.*$/, to: (context) => context.parsedUrl.path! },
              // Keep static assets (including .md files)
              { from: /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|md)$/, to: (context) => context.parsedUrl.path! }
            ]
          })
        )
      }
    }
  ],
  server: {
    proxy: {
      '/odata/v4': {
        target: 'http://localhost:4004',
        changeOrigin: true,
      },
      '/browse': {
        target: 'http://localhost:4004',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:4004',
        changeOrigin: true,
      }
    }
  }
})
