import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Browser integration files each launch Chromium; avoid CPU-count oversubscription.
    maxWorkers: 3,
    coverage: {
      enabled: false,
    },
  },
});
