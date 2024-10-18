import dts from "vite-plugin-dts";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      name: "MiniRdx",
      fileName: "minirdx",
      entry: resolve(__dirname, "src/index.ts"),
    },
  },
});