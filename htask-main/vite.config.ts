import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "robots.txt",
        "logo.png"
      ],
      manifest: {
        id: "com.hamrotask.app",
        name: "Hamro Task - Best Task Management in Nepal",
        short_name: "Hamro Task",
        description: "Nepal's leading task management software. Boost team productivity with Kanban boards, real-time chat, and seamless collaboration.",
        theme_color: "#FF5C00",
        background_color: "#ffffff",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
        orientation: "any",
        scope: "/",
        start_url: "/auth",
        categories: ["productivity", "business", "utilities"],
        lang: "en",
        dir: "ltr",
        prefer_related_applications: false,
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png",
            purpose: "any",
          },
        ],
        screenshots: [
          {
            src: "/screenshot-wide.png",
            sizes: "1920x1080",
            type: "image/png",
            form_factor: "wide",
            label: "Hamro Task Dashboard"
          },
          {
            src: "/screenshot-mobile.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "Hamro Task Mobile"
          }
        ],
        shortcuts: [
          {
            name: "My Tasks",
            short_name: "My Tasks",
            description: "View your assigned tasks",
            url: "/auth?redirect=/my-tasks",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }]
          },
          {
            name: "Projects",
            short_name: "Projects",
            description: "View all projects",
            url: "/auth?redirect=/projects",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }]
          },
          {
            name: "Calendar",
            short_name: "Calendar",
            description: "View calendar",
            url: "/auth?redirect=/calendar",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }]
          }
        ],
        related_applications: [],
        handle_links: "preferred",
        launch_handler: {
          client_mode: ["navigate-existing", "auto"]
        },
        edge_side_panel: {
          preferred_width: 400
        }
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webp}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Import custom service worker for push notifications
        importScripts: ['/custom-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
