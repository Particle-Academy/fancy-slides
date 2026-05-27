import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    registry: "src/registry/index.tsx",
    styles: "src/styles.css",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@particle-academy/react-fancy",
    "@particle-academy/fancy-echarts",
    "@particle-academy/fancy-code",
    "@particle-academy/fancy-screens",
  ],
  treeshake: true,
});
