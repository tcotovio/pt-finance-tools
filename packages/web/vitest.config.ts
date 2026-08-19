import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts: the helpers under test are pure
// TypeScript, so the tests need neither the React plugin nor the PWA one.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
