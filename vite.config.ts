// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      injectRegister: null,
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      filename: "sw.js",
      outDir: "dist/client",
      manifest: false,
      injectManifest: undefined,
      workbox: {
        importScripts: ["/mag-push-sw.js"],
        globPatterns: ["**/*.{js,css,woff,woff2,png,svg,ico}"],
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "imag-pages-access-v2",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ url, request, sameOrigin }) =>
              Boolean(sameOrigin) &&
              !url.pathname.startsWith("/api/") &&
              ["style", "script", "font", "image"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "imag-assets-access-v2",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
