import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSourceManifest,
  FORMAT_NAME,
  PROSODY,
  VOICE,
  VO_LINES,
} from './vo-inventory.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VO_DIR = join(ROOT, 'public', 'audio', 'vo');
const SOURCE_MANIFEST = join(VO_DIR, 'source-manifest.json');
const EXPECTED_FORMAT = 'AUDIO_24KHZ_48KBITRATE_MONO_MP3';

async function listMp3Files(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listMp3Files(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp3')) files.push(path);
  }
  return files;
}

function relativeAssetId(path) {
  return relative(VO_DIR, path).split(sep).join('/').replace(/\.mp3$/i, '');
}

function id3v2End(bytes) {
  if (bytes.length < 10 || bytes.toString('ascii', 0, 3) !== 'ID3') return 0;
  const flags = bytes[5];
  for (let i = 6; i < 10; i += 1) {
    assert.equal(bytes[i] & 0x80, 0, 'ID3v2 size is not sync-safe');
  }
  const size = ((bytes[6] & 0x7f) << 21)
    | ((bytes[7] & 0x7f) << 14)
    | ((bytes[8] & 0x7f) << 7)
    | (bytes[9] & 0x7f);
  return 10 + size + ((flags & 0x10) ? 10 : 0);
}

function parseFrameHeader(bytes, offset, id) {
  assert.ok(offset + 4 <= bytes.length, `${id}: truncated MPEG frame header`);
  const header = bytes.readUInt32BE(offset);
  assert.equal(
    (header & 0xffe00000) >>> 0,
    0xffe00000,
    `${id}: invalid MPEG frame sync at byte ${offset}`,
  );

  const versionBits = (header >>> 19) & 0x3;
  const layerBits = (header >>> 17) & 0x3;
  const bitrateIndex = (header >>> 12) & 0xf;
  const sampleRateIndex = (header >>> 10) & 0x3;
  const padding = (header >>> 9) & 0x1;
  const channelMode = (header >>> 6) & 0x3;

  assert.equal(versionBits, 0b10, `${id}: expected MPEG-2 for 24kHz audio`);
  assert.equal(layerBits, 0b01, `${id}: expected MPEG Layer III`);
  assert.notEqual(bitrateIndex, 0, `${id}: free-format MP3 is not allowed`);
  assert.notEqual(bitrateIndex, 0xf, `${id}: invalid MP3 bitrate index`);
  assert.notEqual(sampleRateIndex, 0x3, `${id}: invalid MP3 sample-rate index`);

  const bitratesKbps = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const sampleRatesHz = [22050, 24000, 16000];
  const bitrateKbps = bitratesKbps[bitrateIndex];
  const sampleRateHz = sampleRatesHz[sampleRateIndex];
  const channels = channelMode === 0b11 ? 1 : 2;
  const frameBytes = Math.floor((72 * bitrateKbps * 1000) / sampleRateHz) + padding;

  assert.equal(sampleRateHz, 24000, `${id}: narrator VO must be 24kHz`);
  assert.equal(bitrateKbps, 48, `${id}: narrator VO must be encoded at about 48kbps`);
  assert.equal(channels, 1, `${id}: narrator VO must be mono`);
  assert.ok(frameBytes > 4, `${id}: invalid MPEG frame length`);
  return frameBytes;
}

function validateMp3(bytes, id) {
  assert.ok(bytes.length >= 1024, `${id}: narrator asset is unexpectedly small`);
  let offset = id3v2End(bytes);
  let frameCount = 0;
  while (offset < bytes.length) {
    // ID3v1, when present, is a fixed 128-byte trailer after the audio frames.
    if (bytes.length - offset === 128 && bytes.toString('ascii', offset, offset + 3) === 'TAG') {
      offset = bytes.length;
      break;
    }
    const frameBytes = parseFrameHeader(bytes, offset, id);
    assert.ok(offset + frameBytes <= bytes.length, `${id}: truncated MPEG frame at byte ${offset}`);
    offset += frameBytes;
    frameCount += 1;
  }
  assert.equal(offset, bytes.length, `${id}: unparsed bytes remain after the MPEG frames`);
  assert.ok(frameCount >= 2, `${id}: narrator asset has too few MPEG frames`);
  return frameCount;
}

assert.equal(FORMAT_NAME, EXPECTED_FORMAT, 'VO inventory format drifted from the asset gate');
assert.deepEqual(PROSODY, { rate: '-8%' });
assert.equal(VOICE, 'en-US-AndrewNeural');

const ids = VO_LINES.map(({ id }) => id);
assert.equal(new Set(ids).size, ids.length, 'narrator line ids must be unique');
for (const id of ids) {
  assert.match(id, /^[a-z0-9][a-z0-9/_-]*$/, `unsafe narrator asset id: ${id}`);
  assert.ok(!id.split('/').includes('..'), `narrator asset id escapes the VO directory: ${id}`);
}

const bakedManifest = JSON.parse(await readFile(SOURCE_MANIFEST, 'utf8'));
const expectedManifest = createSourceManifest();
assert.deepEqual(
  bakedManifest,
  expectedManifest,
  'narrator source changed without regenerating the matching VO (`npm run vo -- --id <line-id>`)',
);

const actualFiles = await listMp3Files(VO_DIR);
const actualIds = actualFiles.map(relativeAssetId).sort();
assert.deepEqual(
  actualIds,
  [...ids].sort(),
  'generated narrator MP3 files must match the source-manifest inventory exactly',
);

let totalFrames = 0;
for (const { id } of VO_LINES) {
  const bytes = await readFile(join(VO_DIR, `${id}.mp3`));
  totalFrames += validateMp3(bytes, id);
}

console.log(
  `VO assets passed: ${VO_LINES.length} source hashes/files · ${totalFrames} valid 24kHz mono 48kbps MP3 frames.`,
);
