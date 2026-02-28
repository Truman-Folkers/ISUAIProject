import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, "src/sidebar/index.html"),
        content: resolve(__dirname, "src/content/contentScript.js"),
        background: resolve(__dirname, "src/background/background.js")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]"
      }
    }
  }
});