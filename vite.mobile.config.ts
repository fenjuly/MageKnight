import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const mobileRoot = fileURLToPath(new URL("./mobile", import.meta.url));

export default defineConfig({
  root: mobileRoot,
  base: "./",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./dist-mobile", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@project": projectRoot,
    },
  },
});
