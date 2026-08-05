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
function shipLicense() {
  return {
    name: 'maranatha-ship-license',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'LICENSE',
        // A Buffer keeps the bytes exact — the em dash and the LF endings
        // survive the round trip, so dist/LICENSE hashes identical to source.
        source: readFileSync(join(ROOT, 'LICENSE')),
      });
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
