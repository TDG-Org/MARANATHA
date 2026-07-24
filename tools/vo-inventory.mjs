import { createHash } from 'node:crypto';
import { WEB, NARRATION } from '../src/data/versesWEB.js';

export const VOICE = 'en-US-AndrewNeural';
export const FORMAT_NAME = 'AUDIO_24KHZ_48KBITRATE_MONO_MP3';
export const PROSODY = Object.freeze({ rate: '-8%' });

// Keep the generated speech and runtime fallback reading the same normalized
// sentence while preserving the exact displayed WEB text in versesWEB.js.
export const speakable = (text) => text
  .replace(/^…\s*/, '')
  .replace(/[“”]/g, '"')
  .replace(/’/g, "'")
  .replace(/…/g, '.')
  .replace(/\bLORD\b/g, 'Lord');

export const VO_LINES = Object.freeze([
  ...Object.values(WEB).map((v) => ({ id: v.vo, text: speakable(v.text) })),
  ...Object.values(NARRATION).map((v) => ({ id: v.vo, text: speakable(v.text) })),
  { id: 'ui/voice-test', text: 'The Lord was with Joseph.' },
  {
    id: 'playground/demo/line-1',
    text: 'In the beginning, God created the heavens and the earth.',
  },
]);

export function sourceFingerprint({ id, text }) {
  return createHash('sha256').update(JSON.stringify({
    id,
    text,
    voice: VOICE,
    format: FORMAT_NAME,
    prosody: PROSODY,
  })).digest('hex');
}

export function createSourceManifest() {
  return {
    schema: 1,
    voice: VOICE,
    format: FORMAT_NAME,
    prosody: PROSODY,
    lines: Object.fromEntries(VO_LINES.map((line) => [
      line.id,
      sourceFingerprint(line),
    ])),
  };
}
