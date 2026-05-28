import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Bundle the calendar JSON into the output so consumers need no extra files.
  loader: { ".json": "json" },
});
