import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative asset paths, so the build works under the GitHub Pages project path
// (https://taqix.github.io/hackyeah-2026/) and from any other folder.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // The minifier rewrites colour values (rgba(60,42,20,.06) -> #3c2a140f is a different alpha),
    // which shifts shadows and text rendering. Ship the design-system CSS as written.
    cssMinify: false,
    // The Icon component looks glyphs up by name, so the whole Lucide icon map is bundled.
    chunkSizeWarningLimit: 700,
  },
  server: { port: 4810 },
});
