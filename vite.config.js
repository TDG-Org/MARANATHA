import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const ROOT = dirname(fileURLToPath(import.meta.url));

// The built game IS a distribution — it is what GitHub Pages serves — so the
// license has to travel with it, not merely sit in the repo. Section 2(e) of
// the license forbids removing our notices; shipping a build without one would
// be us doing exactly that.
//
// The file is emitted from the single root LICENSE at build time rather than
// kept as a second copy under public/. A duplicated legal document is the kind
// of thing that silently goes stale, and there is no way to notice. Reading it
// here also means a missing or unreadable LICENSE FAILS the build loudly
// instead of quietly producing a build with no license in it.
// Two names, ONE source file, both emitted here so neither can drift:
//
//   LICENSE      — the extensionless name GitHub's detector looks for.
//   license.txt  — the one the game itself links to. A static host serves an
//                  extensionless file as application/octet-stream, so linking
//                  ./LICENSE from the About panel would DOWNLOAD it instead of
//                  showing it. `.txt` is served as text/plain and just opens.
const LICENSE_NAMES = ['LICENSE', 'license.txt'];

function shipLicense() {
  return {
    name: 'maranatha-ship-license',

    // DEV must match the build. The emit below only happens at build time, so
    // in `npm run dev` a request for /license.txt fell through to Vite's SPA
    // fallback and got index.html back with a 200 — clicking "Read the
    // license" opened a second copy of the game. Served here from the same one
    // file so the link means the same thing in both.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (!LICENSE_NAMES.includes(path.replace(/^\//, ''))) return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readFileSync(join(ROOT, 'LICENSE')));
      });
    },

    generateBundle() {
      // A Buffer keeps the bytes exact — the em dash and the LF endings survive
      // the round trip, so both emitted files hash identical to the source.
      const source = readFileSync(join(ROOT, 'LICENSE'));
      for (const fileName of LICENSE_NAMES) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}

export default defineConfig({
  // Relative asset paths so the build runs correctly under a GitHub Pages
  // project subpath (tdg-org.github.io/MARANATHA/) or any static host / itch.
  base: './',
  plugins: [shipLicense()],
  server: {
    // MARANATHA's fixed, unique dev port (1225 = "Maranatha", 1 Cor 16:22).
    // An externally assigned PORT (preview tooling) still wins.
    port: Number(process.env.PORT) || 1225,
  },
});
