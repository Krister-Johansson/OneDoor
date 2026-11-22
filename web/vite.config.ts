import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"

import { tanstackStart } from "@tanstack/react-start/plugin/vite"

import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

// The OneDoor server. The browser talks only to this web server, which
// forwards the OneDoor API so requests stay same-origin.
const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3000"

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      routeRules: {
        "/graphql": { proxy: `${apiUrl}/graphql` },
        "/icons/**": { proxy: `${apiUrl}/icons/**` },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
