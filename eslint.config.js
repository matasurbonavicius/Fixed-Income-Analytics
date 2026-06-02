import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "docs/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The Result<T> pattern intentionally uses non-null assertions on
      // metrics that a successful calculation guarantees are present.
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["examples/**/*.ts", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    // Node-run tooling and the consumer smoke test use Node globals.
    files: ["scripts/**/*.mjs", "smoke-test/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  }
);
