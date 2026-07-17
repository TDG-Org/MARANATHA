// npm run vo — regenerate EVERY narrator line as a real mp3 in public/audio/vo/.
//
// One voice, forever: the narrator is en-US-AndrewNeural (warm, clear neural
// storyteller via the free Edge Read Aloud API — the msedge-tts package),
// baked at build time so every device hears the IDENTICAL voice. Runtime never
// picks a voice again; it just plays these files through the voice bus.
//
// The line list is derived from the SAME data the game displays (versesWEB.js)
// — edit a verse there, run `npm run vo`, and the audio can never drift from
// the text. Requires network (it calls Microsoft's TTS endpoint).
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { WEB } from '../src/data/versesWEB.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VO_DIR = join(ROOT, 'public', 'audio', 'vo');
const VOICE = 'en-US-AndrewNeural';
// 48kbps mono mp3 — already the compression target; no re-encode needed.
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
// A touch slower than default — a calm storyteller reading scripture.
const PROSODY = { rate: '-8%' };

// Same normalization the Narrator applies before speaking, plus: a leading
// ellipsis (the whole-clause trim marker on _short verses) is display-only —
// the voice must not read it.
const speakable = (text) => text
  .replace(/^…\s*/, '')
  .replace(/[“”]/g, '"')
  .replace(/’/g, "'")
  .replace(/…/g, '.')
  .replace(/\bLORD\b/g, 'Lord');

// The complete narrator-line inventory: every WEB verse (each carries its own
// vo line-id) + the two non-verse lines the narrator can speak.
const LINES = [
  ...Object.values(WEB).map((v) => ({ id: v.vo, text: speakable(v.text) })),
  { id: 'ui/voice-test', text: 'The Lord was with Joseph.' },           // settings slider test
  { id: 'playground/demo/line-1', text: 'In the beginning, God created the heavens and the earth.' }, // Gen 1:1 (WEB) — bench demo
];

const tts = new MsEdgeTTS();
await tts.setMetadata(VOICE, FORMAT);
console.log(`VO: ${LINES.length} lines · voice ${VOICE} · 24kHz 48kbps mono mp3\n`);

let total = 0;
for (const { id, text } of LINES) {
  const outFile = join(VO_DIR, `${id}.mp3`);
  const tmpDir = join(VO_DIR, '.vo-tmp');
  await mkdir(dirname(outFile), { recursive: true });
  await mkdir(tmpDir, { recursive: true });
  const { audioFilePath } = await tts.toFile(tmpDir, text, PROSODY); // writes tmpDir/audio.mp3
  await rm(outFile, { force: true });
  await rename(audioFilePath, outFile);
  const kb = (await stat(outFile)).size / 1024;
  total += kb;
  console.log(`  ✓ ${id}.mp3  (${kb.toFixed(0)} KB)  “${text.slice(0, 52)}${text.length > 52 ? '…' : ''}”`);
}
await rm(join(VO_DIR, '.vo-tmp'), { recursive: true, force: true });
console.log(`\nDone — ${LINES.length} files, ${(total / 1024).toFixed(2)} MB total, in public/audio/vo/`);
