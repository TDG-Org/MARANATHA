// npm run vo — regenerate every narrator line as a real mp3.
// npm run vo -- --id joseph/1/verse-37-2 — regenerate one changed line safely.
//
// One voice, forever: the narrator is en-US-AndrewNeural (warm, clear neural
// storyteller via the free Edge Read Aloud API — the msedge-tts package),
// baked at build time so every device hears the IDENTICAL voice. Runtime never
// picks a voice again; it just plays these files through the voice bus.
//
// The line list is derived from the SAME data the game displays (versesWEB.js)
// — edit a verse there, run `npm run vo`, and the audio can never drift from
// the text. Requires network (it calls Microsoft's TTS endpoint).
import {
  mkdir, mkdtemp, readFile, rename, rm, stat, writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import {
  createSourceManifest,
  PROSODY,
  VOICE,
  VO_LINES,
} from './vo-inventory.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VO_DIR = join(ROOT, 'public', 'audio', 'vo');
const SOURCE_MANIFEST = join(VO_DIR, 'source-manifest.json');
// 48kbps mono mp3 — already the compression target; no re-encode needed.
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

const idArg = process.argv.indexOf('--id');
const requestedId = idArg >= 0 ? process.argv[idArg + 1] : null;
if (idArg >= 0 && !requestedId) throw new Error('--id requires a narrator line id');
const selectedLines = requestedId ? VO_LINES.filter((line) => line.id === requestedId) : VO_LINES;
if (!selectedLines.length) throw new Error(`Unknown narrator line id: ${requestedId}`);

const tts = new MsEdgeTTS();
await tts.setMetadata(VOICE, FORMAT);
console.log(`VO: ${selectedLines.length} line${selectedLines.length === 1 ? '' : 's'} · voice ${VOICE} · 24kHz 48kbps mono mp3\n`);

let total = 0;
for (const { id, text } of selectedLines) {
  const outFile = join(VO_DIR, `${id}.mp3`);
  await mkdir(dirname(outFile), { recursive: true });
  await mkdir(VO_DIR, { recursive: true });
  const tmpDir = await mkdtemp(join(VO_DIR, '.vo-tmp-'));
  const backupFile = `${outFile}.previous-${process.pid}-${Date.now()}`;
  let backedUp = false;
  try {
    const { audioFilePath } = await tts.toFile(tmpDir, text, PROSODY);
    const generated = await stat(audioFilePath);
    if (generated.size < 1024) throw new Error(`Generated VO is unexpectedly small: ${generated.size} bytes`);

    try {
      await rename(audioFilePath, outFile);
    } catch (error) {
      // rename() replaces atomically where the platform supports it. Windows
      // can reject an occupied target, so preserve that target as a uniquely
      // named last-good backup before retrying the move.
      if (!['EEXIST', 'EPERM', 'EACCES'].includes(error?.code)) throw error;
      try {
        await rename(outFile, backupFile);
        backedUp = true;
      } catch (backupError) {
        // If the target vanished between attempts, retry the install directly.
        if (backupError?.code !== 'ENOENT') throw backupError;
      }
      try {
        await rename(audioFilePath, outFile);
      } catch (installError) {
        if (backedUp) {
          try { await rename(backupFile, outFile); } catch (restoreError) {
            throw new AggregateError(
              [installError, restoreError],
              `Failed to install or restore ${id}.mp3`,
            );
          }
        }
        throw installError;
      }
    }

    if (backedUp) await rm(backupFile, { force: true });
    const kb = (await stat(outFile)).size / 1024;
    total += kb;
    console.log(`  ✓ ${id}.mp3  (${kb.toFixed(0)} KB)  “${text.slice(0, 52)}${text.length > 52 ? '…' : ''}”`);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

// Source provenance is updated only for lines successfully generated in this
// run. A targeted bake therefore cannot accidentally certify some other line
// whose text changed but whose MP3 was not regenerated; QA will keep failing
// until that exact id is baked too.
const expectedManifest = createSourceManifest();
let previousLines = {};
try {
  const previous = JSON.parse(await readFile(SOURCE_MANIFEST, 'utf8'));
  if (previous?.schema === 1 && previous.lines) previousLines = previous.lines;
} catch { /* first complete bake creates the manifest */ }
const sourceManifest = {
  ...expectedManifest,
  lines: { ...previousLines },
};
for (const { id } of selectedLines) {
  sourceManifest.lines[id] = expectedManifest.lines[id];
}
const manifestTemp = join(
  VO_DIR,
  `.source-manifest-${process.pid}-${Date.now()}.json`,
);
const manifestBackup = `${SOURCE_MANIFEST}.previous-${process.pid}-${Date.now()}`;
let manifestBackedUp = false;
await writeFile(manifestTemp, `${JSON.stringify(sourceManifest, null, 2)}\n`, 'utf8');
try {
  try {
    await rename(manifestTemp, SOURCE_MANIFEST);
  } catch (error) {
    if (!['EEXIST', 'EPERM', 'EACCES'].includes(error?.code)) throw error;
    try {
      await rename(SOURCE_MANIFEST, manifestBackup);
      manifestBackedUp = true;
    } catch (backupError) {
      if (backupError?.code !== 'ENOENT') throw backupError;
    }
    try {
      await rename(manifestTemp, SOURCE_MANIFEST);
    } catch (installError) {
      if (manifestBackedUp) await rename(manifestBackup, SOURCE_MANIFEST);
      throw installError;
    }
  }
  if (manifestBackedUp) await rm(manifestBackup, { force: true });
} finally {
  await rm(manifestTemp, { force: true });
}
console.log(`\nDone — ${selectedLines.length} file${selectedLines.length === 1 ? '' : 's'}, ${(total / 1024).toFixed(2)} MB total, in public/audio/vo/`);
