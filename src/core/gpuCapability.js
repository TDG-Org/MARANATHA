// IS THERE ACTUALLY A GPU BEHIND THIS CANVAS?
//
// A browser will hand back a working WebGL context that is rasterized entirely
// on the CPU, with no error and no warning, whenever hardware acceleration is
// unavailable OR simply switched off in its settings. People switch it off — to
// fix a flickering video call, on IT policy, or by following some old advice —
// and then never think about it again.
//
// Measured on an RTX 3090 / i9-12900KF at 3840x1080, same code, same machine,
// the browser's "use graphics acceleration" toggle the ONLY difference:
//
//     hardware ON  -> NVIDIA RTX 3090 ............. 72 fps   (submit 2.3 ms)
//     hardware OFF -> Microsoft Basic Render Driver 12 fps   (submit 5.0 ms)
//
// Note the second row: the game's own instrumentation still reported ~5 ms of
// work while the frame took 83 ms. Rasterization and compositing happen after
// submit returns, so `#debug` cannot see any of it — an fps counter reports the
// symptom and names the wrong suspect. That is why this has to be detected
// explicitly rather than inferred from frame times.
//
// What we do about it is in two parts, because only one of them actually works:
//   · Shed what we can (pixels first — see AdaptiveQuality's floor, and the
//     full-screen colour grade, which is a CPU colour-matrix over the whole
//     canvas once GPU compositing is off).
//   · TELL THE PLAYER. Turning the GPU back on is worth ~6x. Nothing we can do
//     to the scene is worth 6x, so the honest fix belongs in their hands.

// Every software rasterizer a browser realistically falls back to.
//   SwiftShader ............ Chrome/Chromium's own (Google Inc. (Google))
//   WARP / Basic Render .... Direct3D's CPU device, what Edge uses on Windows
//   llvmpipe / softpipe .... Mesa's, on Linux
//   Apple Software Renderer  macOS
const SOFTWARE = /swiftshader|llvmpipe|softpipe|warp|basic render|software (adapter|rasterizer|renderer)|microsoft basic/i;

export const GPU = {
  /** True when the WebGL context is being rasterized on the CPU. */
  software: false,
  /** The unmasked renderer string, or '' when the browser withheld it. */
  renderer: '',
  /** True once detect() has run, so callers can tell "no" from "not asked". */
  known: false,
};

/**
 * Read the unmasked renderer string and decide whether this is a CPU
 * rasterizer. Safe to call with anything; never throws.
 */
export function detectSoftwareRenderer(threeRenderer) {
  let name = '';
  try {
    const gl = threeRenderer?.getContext?.();
    const ext = gl?.getExtension?.('WEBGL_debug_renderer_info');
    if (gl && ext) name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    // Some browsers withhold the unmasked string for fingerprinting reasons.
    // RENDERER is masked ("WebKit WebGL") far more often than it is useful, but
    // it costs nothing to look before giving up.
    if (!name && gl) name = String(gl.getParameter(gl.RENDERER) || '');
  } catch {
    name = '';
  }
  GPU.renderer = name;
  GPU.known = true;
  // An unreadable string is NOT evidence of software. Guessing "software" from
  // silence would punish privacy-hardened browsers with a scary banner and a
  // blurry game, so the absence of proof stays a no.
  GPU.software = !!name && SOFTWARE.test(name);
  return GPU;
}

/** Test seam: force a state without a WebGL context. */
export function setGpuCapabilityForTest({ software = false, renderer = '', known = true } = {}) {
  GPU.software = !!software;
  GPU.renderer = renderer;
  GPU.known = known;
  return GPU;
}
