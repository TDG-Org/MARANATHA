import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build runs correctly under a GitHub Pages
  // project subpath (tdg-org.github.io/MARANATHA/) or any static host / itch.
  base: './',
  server: {
    // MARANATHA's fixed, unique dev port (1225 = "Maranatha", 1 Cor 16:22).
    // An externally assigned PORT (preview tooling) still wins.
    port: Number(process.env.PORT) || 1225,
  },
});
