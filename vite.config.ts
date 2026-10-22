import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/**
 * Single page: index.html, the customer/host page that calls the real SDK `bootstrap()`.
 * The onboarding frame it embeds is served by the sandbox stage of pi/onboarding-ui, not
 * from this site.
 */
export default defineConfig({
  base: "/",
  plugins: [tailwindcss()],
  build: {
    sourcemap: true,
  },
});
