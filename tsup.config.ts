import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    registry: "src/registry/index.tsx",
    styles: "src/styles.css",
  },
  format: ["esm", "cjs"],
  // dts: true — disabled for v0.1.3; rolldown's DTS parser chokes on
  // certain TS+JSX combinations in this codebase. Will re-enable in a
  // follow-up once we have repro.
  dts: false,
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
