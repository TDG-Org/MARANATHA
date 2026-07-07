import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build runs correctly under a GitHub Pages
  // project subpath (tdg-org.github.io/MARANATHA/) or any static host / itch.
  base: './',
  server: {
    // Honor an externally assigned port (preview tooling); default 5173.
    port: Number(process.env.PORT) || 5173,
  },
});
