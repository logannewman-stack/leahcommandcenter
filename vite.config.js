import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The Command Center's build. One page app, served by Vercel next to the
 * functions in `api/`. In development `/api` is proxied to `vercel dev`
 * (`npm run dev:api`) on port 3000, so the Setup page's health check and the
 * admin calls work locally too.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") }
  },
  server: {
    port: 5174,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true }
    }
  },
  build: {
    sourcemap: false
  }
});
