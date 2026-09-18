import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts"],
    coverage: { enabled: true, include: ["src/**/*.ts"], exclude: ["src/**/*.spec.ts"] },
  },
});
