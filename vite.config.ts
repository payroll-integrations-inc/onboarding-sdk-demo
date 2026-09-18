import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/**
 * Multi-page build:
 *  - index.html         the customer/host page that calls the real SDK `bootstrap()`
 *  - link/start.html    the emulated onboarding frame; the SDK loads `{frameHost}/link/start`
 *                       and both Vite and GitHub Pages serve that path from this file
 *  - oauth.html         the emulated payroll-platform OAuth consent popup
 */
export default defineConfig({
  base: "/",
  appType: "mpa",
  plugins: [tailwindcss()],
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        host: resolve(import.meta.dirname, "index.html"),
        frame: resolve(import.meta.dirname, "link/start.html"),
        oauth: resolve(import.meta.dirname, "oauth.html"),
      },
    },
  },
});
