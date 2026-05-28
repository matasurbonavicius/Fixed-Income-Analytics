import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@domain": r("./src/domain"),
      "@application": r("./src/application"),
      "@calendars": r("./src/calendars"),
    },
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/index.ts",
        "src/**/*.types.ts",
        "src/**/*.enums.ts",
        // i18n is descriptive localisation helpers, not part of the math engine.
        "src/domain/i18n/**",
      ],
    },
  },
});
