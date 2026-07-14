import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Integration tests share one Postgres DB; avoid cross-file write races.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      // `server-only` throws outside RSC; stub it so server modules are testable.
      "server-only": path.resolve(__dirname, "tests/helpers/server-only-stub.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
