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
      formats: ["es", "cjs"],
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        react: resolve(__dirname, "src/react.ts"),
      },
      fileName: (format, entryName) => `minirdx.${entryName}.${format}.js`,
    },
    rollupOptions: {
      external: ["react"],
    },
  },
});
