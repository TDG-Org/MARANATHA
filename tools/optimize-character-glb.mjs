#!/usr/bin/env node

// Deterministic MARANATHA character-GLB optimizer.
//
// This is deliberately narrower than a generic glTF compressor: it removes
// animation clips that Character3D cannot currently select, then repacks only
// the surviving accessors/bufferViews. Meshes, materials, images, skins, node
// hierarchy, and every retained animation byte remain untouched. There is no
// quantization, resampling, mesh simplification, or lossy texture conversion.
//
// Safe usage (the output MUST differ from the input):
//   node tools/optimize-character-glb.mjs \
//     --input public/models/character-base.glb \
//     --output "$TEMP/maranatha-character-base.candidate.glb"

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

// Character3D's exact live mappings. Keeping exact names prevents its later
// substring fallbacks from silently selecting a different motion.
export const RUNTIME_CLIPS = Object.freeze([
  'Idle',
  'Walking_A',
  'Running_A',
  'Interact',
  'Sit_Floor_Idle',
]);

// Conservative, small safety set for story staging and existing candidate
// fallbacks. These are preserved even though the current scene does not select
// them directly, so a future throw, pickup, seated transition, grounded beat,
// or emote does not require restoring the 76-clip source pack.
export const FUTURE_EMOTE_CLIPS = Object.freeze([
  'Walking_B',
  'Running_B',
  'Cheer',
  'Use_Item',
  'PickUp',
  'Throw',
  'Sit_Floor_Down',
  'Sit_Floor_Pose',
  'Sit_Floor_StandUp',
  'Lie_Down',
  'Lie_Idle',
  'Lie_StandUp',
]);

export const DEFAULT_CLIPS = Object.freeze([
  ...RUNTIME_CLIPS,
  ...FUTURE_EMOTE_CLIPS,
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function align4(value) {
  return (value + 3) & ~3;
}

function asUint8(data) {
  return data instanceof Uint8Array
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function parseGlb(data, label = 'GLB') {
  const bytes = asUint8(data);
  invariant(bytes.byteLength >= 20, `${label}: file is too small to be a GLB`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  invariant(view.getUint32(0, true) === GLB_MAGIC, `${label}: invalid glTF magic`);
  invariant(view.getUint32(4, true) === 2, `${label}: only GLB version 2 is supported`);
  invariant(view.getUint32(8, true) === bytes.byteLength,
    `${label}: header length does not match the file length`);

  let json = null;
  let binary = null;
  let offset = 12;
  let chunkCount = 0;
  while (offset < bytes.byteLength) {
    invariant(offset + 8 <= bytes.byteLength, `${label}: truncated chunk header`);
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + length;
    invariant(end <= bytes.byteLength, `${label}: truncated chunk payload`);
    const chunk = bytes.slice(start, end);
    if (type === JSON_CHUNK) {
      invariant(json === null, `${label}: multiple JSON chunks are unsupported`);
      const text = new TextDecoder().decode(chunk).replace(/[\u0000\u0020]+$/u, '');
      json = JSON.parse(text);
    } else if (type === BIN_CHUNK) {
      invariant(binary === null, `${label}: multiple BIN chunks are unsupported`);
      binary = chunk;
    } else {
      throw new Error(`${label}: unknown GLB chunk 0x${type.toString(16)}; refusing an unsafe rewrite`);
    }
    chunkCount += 1;
    offset = end;
  }

  invariant(json && binary, `${label}: expected one JSON and one BIN chunk`);
  invariant(chunkCount === 2, `${label}: expected exactly two GLB chunks`);
  invariant(Array.isArray(json.buffers) && json.buffers.length === 1,
    `${label}: only one embedded GLB buffer is supported`);
  invariant(!json.buffers[0].uri, `${label}: external buffers are unsupported`);
  invariant((json.extensionsUsed?.length || 0) === 0 && (json.extensionsRequired?.length || 0) === 0,
    `${label}: extensions could contain hidden accessor references; refusing an unsafe rewrite`);
  invariant(json.buffers[0].byteLength <= binary.byteLength,
    `${label}: BIN chunk is shorter than buffers[0].byteLength`);

  return { json, binary, bytes };
}

function addAccessor(indexes, value, context) {
  if (value === undefined || value === null) return;
  invariant(Number.isInteger(value) && value >= 0, `${context}: invalid accessor index ${value}`);
  indexes.add(value);
}

function collectAccessorIndexes(json) {
  const indexes = new Set();
  for (const [meshIndex, mesh] of (json.meshes || []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives || []).entries()) {
      addAccessor(indexes, primitive.indices, `meshes[${meshIndex}].primitives[${primitiveIndex}].indices`);
      for (const [semantic, accessor] of Object.entries(primitive.attributes || {})) {
        addAccessor(indexes, accessor,
          `meshes[${meshIndex}].primitives[${primitiveIndex}].attributes.${semantic}`);
      }
      for (const [targetIndex, target] of (primitive.targets || []).entries()) {
        for (const [semantic, accessor] of Object.entries(target)) {
          addAccessor(indexes, accessor,
            `meshes[${meshIndex}].primitives[${primitiveIndex}].targets[${targetIndex}].${semantic}`);
        }
      }
    }
  }
  for (const [skinIndex, skin] of (json.skins || []).entries()) {
    addAccessor(indexes, skin.inverseBindMatrices, `skins[${skinIndex}].inverseBindMatrices`);
  }
  for (const [animationIndex, animation] of (json.animations || []).entries()) {
    for (const [samplerIndex, sampler] of (animation.samplers || []).entries()) {
      addAccessor(indexes, sampler.input,
        `animations[${animationIndex}].samplers[${samplerIndex}].input`);
      addAccessor(indexes, sampler.output,
        `animations[${animationIndex}].samplers[${samplerIndex}].output`);
    }
  }
  return indexes;
}

function remapAccessor(index, map, context) {
  if (index === undefined || index === null) return index;
  invariant(map.has(index), `${context}: accessor ${index} was not retained`);
  return map.get(index);
}

function remapAccessorReferences(json, map) {
  for (const [meshIndex, mesh] of (json.meshes || []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives || []).entries()) {
      if (primitive.indices !== undefined) {
        primitive.indices = remapAccessor(primitive.indices, map,
          `meshes[${meshIndex}].primitives[${primitiveIndex}].indices`);
      }
      for (const semantic of Object.keys(primitive.attributes || {})) {
        primitive.attributes[semantic] = remapAccessor(primitive.attributes[semantic], map,
          `meshes[${meshIndex}].primitives[${primitiveIndex}].attributes.${semantic}`);
      }
      for (const [targetIndex, target] of (primitive.targets || []).entries()) {
        for (const semantic of Object.keys(target)) {
          target[semantic] = remapAccessor(target[semantic], map,
            `meshes[${meshIndex}].primitives[${primitiveIndex}].targets[${targetIndex}].${semantic}`);
        }
      }
    }
  }
  for (const [skinIndex, skin] of (json.skins || []).entries()) {
    if (skin.inverseBindMatrices !== undefined) {
      skin.inverseBindMatrices = remapAccessor(skin.inverseBindMatrices, map,
        `skins[${skinIndex}].inverseBindMatrices`);
    }
  }
  for (const [animationIndex, animation] of (json.animations || []).entries()) {
    for (const [samplerIndex, sampler] of (animation.samplers || []).entries()) {
      sampler.input = remapAccessor(sampler.input, map,
        `animations[${animationIndex}].samplers[${samplerIndex}].input`);
      sampler.output = remapAccessor(sampler.output, map,
        `animations[${animationIndex}].samplers[${samplerIndex}].output`);
    }
  }
}

function collectBufferViewIndexes(json) {
  const indexes = new Set();
  for (const [accessorIndex, accessor] of (json.accessors || []).entries()) {
    if (accessor.bufferView !== undefined) indexes.add(accessor.bufferView);
    if (accessor.sparse) {
      invariant(accessor.sparse.indices?.bufferView !== undefined,
        `accessors[${accessorIndex}].sparse.indices.bufferView is missing`);
      invariant(accessor.sparse.values?.bufferView !== undefined,
        `accessors[${accessorIndex}].sparse.values.bufferView is missing`);
      indexes.add(accessor.sparse.indices.bufferView);
      indexes.add(accessor.sparse.values.bufferView);
    }
  }
  for (const [imageIndex, image] of (json.images || []).entries()) {
    invariant(!image.uri, `images[${imageIndex}] uses a URI; only embedded images are supported`);
    if (image.bufferView !== undefined) indexes.add(image.bufferView);
  }
  return indexes;
}

function remapBufferView(index, map, context) {
  invariant(map.has(index), `${context}: bufferView ${index} was not retained`);
  return map.get(index);
}

function remapBufferViewReferences(json, map) {
  for (const [accessorIndex, accessor] of (json.accessors || []).entries()) {
    if (accessor.bufferView !== undefined) {
      accessor.bufferView = remapBufferView(accessor.bufferView, map,
        `accessors[${accessorIndex}].bufferView`);
    }
    if (accessor.sparse) {
      accessor.sparse.indices.bufferView = remapBufferView(accessor.sparse.indices.bufferView, map,
        `accessors[${accessorIndex}].sparse.indices.bufferView`);
      accessor.sparse.values.bufferView = remapBufferView(accessor.sparse.values.bufferView, map,
        `accessors[${accessorIndex}].sparse.values.bufferView`);
    }
  }
  for (const [imageIndex, image] of (json.images || []).entries()) {
    if (image.bufferView !== undefined) {
      image.bufferView = remapBufferView(image.bufferView, map,
        `images[${imageIndex}].bufferView`);
    }
  }
}

function writeGlb(json, binary) {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = align4(jsonBytes.byteLength);
  const binLength = align4(binary.byteLength);
  const totalLength = 12 + 8 + jsonLength + 8 + binLength;
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);

  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  output.fill(0x20, 20, 20 + jsonLength);
  output.set(jsonBytes, 20);

  const binHeader = 20 + jsonLength;
  view.setUint32(binHeader, binLength, true);
  view.setUint32(binHeader + 4, BIN_CHUNK, true);
  output.set(binary, binHeader + 8);
  return output;
}

function verifyPreservedCounts(source, candidate) {
  for (const key of ['scenes', 'nodes', 'meshes', 'skins', 'materials', 'textures', 'samplers', 'images']) {
    invariant((candidate[key]?.length || 0) === (source[key]?.length || 0),
      `${key}: count changed during animation-only optimization`);
  }
}

function verifyRetainedBytes(source, candidate, oldViewIndexes, viewMap) {
  for (const oldIndex of oldViewIndexes) {
    const newIndex = viewMap.get(oldIndex);
    const oldView = source.json.bufferViews[oldIndex];
    const newView = candidate.json.bufferViews[newIndex];
    invariant(oldView.byteLength === newView.byteLength,
      `bufferView ${oldIndex}: byteLength changed`);
    const oldStart = oldView.byteOffset || 0;
    const newStart = newView.byteOffset || 0;
    const oldBytes = source.binary.subarray(oldStart, oldStart + oldView.byteLength);
    const newBytes = candidate.binary.subarray(newStart, newStart + newView.byteLength);
    invariant(oldBytes.byteLength === newBytes.byteLength,
      `bufferView ${oldIndex}: copied byte length changed`);
    invariant(sha256(oldBytes) === sha256(newBytes),
      `bufferView ${oldIndex}: retained bytes changed`);
  }
}

export function optimizeCharacterGlb(data, {
  clips = DEFAULT_CLIPS,
  label = 'GLB',
} = {}) {
  const source = parseGlb(data, label);
  const json = cloneJson(source.json);
  const requested = [...new Set(clips)];
  invariant(requested.length === clips.length, `${label}: clip allowlist contains duplicates`);
  for (const clip of RUNTIME_CLIPS) {
    invariant(requested.includes(clip),
      `${label}: clip allowlist must retain runtime clip '${clip}'`);
  }

  const sourceAnimations = json.animations || [];
  const sourceNames = new Set(sourceAnimations.map((animation) => animation.name));
  for (const clip of RUNTIME_CLIPS) {
    invariant(sourceNames.has(clip), `${label}: required runtime clip '${clip}' is missing`);
  }
  const missingRequested = requested.filter((clip) => !sourceNames.has(clip));
  invariant(missingRequested.length === 0,
    `${label}: requested clip(s) missing: ${missingRequested.join(', ')}`);

  const allow = new Set(requested);
  json.animations = sourceAnimations.filter((animation) => allow.has(animation.name));
  invariant(json.animations.length === requested.length,
    `${label}: clip names must be unique in the source GLB`);

  const oldAccessorIndexes = [...collectAccessorIndexes(json)].sort((a, b) => a - b);
  for (const index of oldAccessorIndexes) {
    invariant(index < source.json.accessors.length, `${label}: accessor ${index} is out of range`);
  }
  const accessorMap = new Map(oldAccessorIndexes.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  json.accessors = oldAccessorIndexes.map((index) => cloneJson(source.json.accessors[index]));
  remapAccessorReferences(json, accessorMap);

  const oldViewIndexes = [...collectBufferViewIndexes(json)].sort((a, b) => a - b);
  for (const index of oldViewIndexes) {
    invariant(index < source.json.bufferViews.length, `${label}: bufferView ${index} is out of range`);
  }
  const viewMap = new Map(oldViewIndexes.map((oldIndex, newIndex) => [oldIndex, newIndex]));

  let cursor = 0;
  const chunks = [];
  json.bufferViews = oldViewIndexes.map((oldIndex) => {
    const original = source.json.bufferViews[oldIndex];
    invariant((original.buffer ?? 0) === 0,
      `${label}: bufferView ${oldIndex} references unsupported buffer ${original.buffer}`);
    const sourceStart = original.byteOffset || 0;
    const sourceEnd = sourceStart + original.byteLength;
    invariant(sourceEnd <= source.binary.byteLength,
      `${label}: bufferView ${oldIndex} exceeds the BIN chunk`);
    cursor = align4(cursor);
    const newOffset = cursor;
    chunks.push({ offset: newOffset, bytes: source.binary.subarray(sourceStart, sourceEnd) });
    cursor += original.byteLength;
    return { ...cloneJson(original), buffer: 0, byteOffset: newOffset };
  });

  const packedBinary = new Uint8Array(cursor);
  for (const chunk of chunks) packedBinary.set(chunk.bytes, chunk.offset);
  remapBufferViewReferences(json, viewMap);
  json.buffers = [{ ...cloneJson(source.json.buffers[0]), byteLength: packedBinary.byteLength }];

  const output = writeGlb(json, packedBinary);
  const candidate = parseGlb(output, `${label} candidate`);
  verifyPreservedCounts(source.json, candidate.json);
  verifyRetainedBytes(source, candidate, oldViewIndexes, viewMap);
  invariant(candidate.json.animations.map((animation) => animation.name).join('\u0000')
    === json.animations.map((animation) => animation.name).join('\u0000'),
  `${label}: retained animation names/order changed`);
  invariant(collectAccessorIndexes(candidate.json).size === candidate.json.accessors.length,
    `${label}: candidate contains orphaned accessors`);
  invariant(collectBufferViewIndexes(candidate.json).size === candidate.json.bufferViews.length,
    `${label}: candidate contains orphaned bufferViews`);

  return {
    output,
    report: {
      inputBytes: source.bytes.byteLength,
      outputBytes: output.byteLength,
      savedBytes: source.bytes.byteLength - output.byteLength,
      savedPercent: (1 - output.byteLength / source.bytes.byteLength) * 100,
      clipsBefore: sourceAnimations.length,
      clipsAfter: json.animations.length,
      accessorsBefore: source.json.accessors.length,
      accessorsAfter: json.accessors.length,
      bufferViewsBefore: source.json.bufferViews.length,
      bufferViewsAfter: json.bufferViews.length,
      retainedClips: json.animations.map((animation) => animation.name),
      outputSha256: sha256(output),
    },
  };
}

function parseArgs(argv) {
  const opts = { force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') opts.force = true;
    else if (arg === '--input' || arg === '--output' || arg === '--clips') {
      invariant(argv[i + 1], `${arg} requires a value`);
      opts[arg.slice(2)] = argv[++i];
    } else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function printHelp() {
  console.log(`Usage:
  node tools/optimize-character-glb.mjs --input SOURCE.glb --output CANDIDATE.glb [options]

Options:
  --clips A,B,C  Override the documented ${DEFAULT_CLIPS.length}-clip allowlist.
                  All five runtime clip names must still be listed.
  --force         Replace an existing candidate file (never permits in-place output).
  --help          Show this help.

The tool rejects extensions/external buffers because they can hide references
that an animation-only compactor cannot safely discover.`);
}

function runCli() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { printHelp(); return; }
  invariant(opts.input && opts.output, '--input and --output are required (see --help)');
  const input = path.resolve(opts.input);
  const output = path.resolve(opts.output);
  invariant(input !== output, 'Refusing in-place optimization: output must be a candidate path');
  invariant(existsSync(input), `Input does not exist: ${input}`);
  invariant(opts.force || !existsSync(output),
    `Candidate already exists: ${output} (pass --force to replace that candidate only)`);
  const clips = opts.clips ? opts.clips.split(',').map((name) => name.trim()).filter(Boolean) : DEFAULT_CLIPS;
  const result = optimizeCharacterGlb(readFileSync(input), { clips, label: path.basename(input) });
  writeFileSync(output, result.output);
  const r = result.report;
  console.log(`${path.basename(input)} -> ${output}`);
  console.log(`${r.inputBytes} -> ${r.outputBytes} bytes (${r.savedPercent.toFixed(2)}% saved)`);
  console.log(`clips ${r.clipsBefore} -> ${r.clipsAfter}; accessors ${r.accessorsBefore} -> ${r.accessorsAfter}; bufferViews ${r.bufferViewsBefore} -> ${r.bufferViewsAfter}`);
  console.log(`sha256 ${r.outputSha256}`);
  console.log(`retained: ${r.retainedClips.join(', ')}`);
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try { runCli(); } catch (error) {
    console.error(`[optimize-character-glb] ${error.message}`);
    process.exitCode = 1;
  }
}
