/**
 * The WebGL context the game asks for, and what a URL or the device changes about it (issue #157).
 *
 * Edge on Android (EdgA 155, a Pixel with a PowerVR GPU) drew every WebGL frame correctly, read back through
 * `?diag=1`, and showed a black page: Edge composites with OpenGL while its WebGL runs on ANGLE's Vulkan backend, and
 * the multisampled drawing buffer never made it across. Chrome on the same phone composites with Vulkan and was fine.
 * On that device `?gl=noaa` and `?gl=preserve` both showed the game, `?gl=alpha` and `?gl=lowpower` did not. So a
 * device that matches (`needsSingleSampledCanvas`) gets `antialiasGL: false` automatically: no multisampled drawing
 * buffer, which costs nothing (it is cheaper than the default) and leaves texture filtering (`antialias`) as it is.
 * Every other device keeps the usual config.
 *
 * A game drawn at 2x or more (the screen's own density, `ui/render-scale.ts`) gets no multisampled buffer either
 * (#328): its edges are already as fine as the glass, and on a 3x phone 4x multisampling meant resolving four samples
 * for each of 2.5 million pixels every frame, for edges no one could see.
 *
 * Test links, for the next device like it:
 *  - `?gl=alpha`: a transparent canvas (`transparent: true`, context `alpha: true`); the page's VOID shows through.
 *  - `?gl=preserve`: `preserveDrawingBuffer: true`.
 *  - `?gl=noaa`: no multisampled drawing buffer (`antialiasGL: false`).
 *  - `?gl=aa`: the multisampled buffer even on a device that matches, or at 2x and up, to compare.
 *  - `?gl=lowpower`: `powerPreference: "low-power"`.
 *  - `?renderer=canvas`: the Canvas renderer instead of WebGL.
 *  - `?renderer=webgl`: WebGL even where the browser reported none, to see Phaser's own error.
 *
 * A browser with no WebGL at all (switched off in Firefox, hardware acceleration off, a blocklisted driver) gets the
 * Canvas renderer by itself (`Phaser.AUTO`, which makes the same `webgl` check Phaser already made when it loaded),
 * rather than Phaser's "Cannot create WebGL context, aborting."
 * (a Discord report: Firefox 157 on Windows). Canvas draws on the CPU at 1x (`ui/render-scale.ts`), so the game says
 * once how to turn WebGL back on (`view/webgl-help.ts`, `scenes/renderer-notice.ts`).
 */
export interface RendererOptions {
  /** `?renderer=canvas`: Canvas whatever the browser has. */
  readonly canvas: boolean;
  /** `?renderer=webgl`: WebGL even where the browser has none. Otherwise Phaser picks (`Phaser.AUTO`). */
  readonly webgl?: true;
  readonly transparent?: true;
  readonly preserveDrawingBuffer?: true;
  readonly antialiasGL?: false;
  readonly powerPreference?: "low-power";
}

export interface DeviceInfo {
  readonly userAgent: string;
  /** The unmasked WebGL renderer string, or null when it was not read. */
  readonly webglRenderer: string | null;
}

/** Edge on Android whose WebGL runs on ANGLE's Vulkan backend: its multisampled WebGL canvas shows black. */
export function needsSingleSampledCanvas(device: DeviceInfo): boolean {
  return isAndroidEdge(device.userAgent) && /\bvulkan\b/i.test(device.webglRenderer ?? "");
}

/** Edge on Android names itself `EdgA/`: only there is the WebGL renderer worth reading before the game starts. */
export const isAndroidEdge = (userAgent: string): boolean => /\bEdgA\//.test(userAgent);

/** At this render scale and above the drawing buffer is fine enough that multisampling adds nothing. */
export const SINGLE_SAMPLED_FROM_SCALE = 2;

export function rendererOptionsOf(search: string, device: DeviceInfo | null = null, renderScale = 1): RendererOptions {
  const params = new URLSearchParams(search);
  const flags = new Set((params.get("gl") ?? "").split(",").map((flag) => flag.trim()));
  const singleSampled =
    flags.has("noaa") ||
    (!flags.has("aa") &&
      ((device !== null && needsSingleSampledCanvas(device)) || renderScale >= SINGLE_SAMPLED_FROM_SCALE));
  const asked = params.get("renderer");
  return {
    canvas: asked === "canvas",
    ...(asked === "webgl" ? { webgl: true } : {}),
    ...(flags.has("alpha") ? { transparent: true } : {}),
    ...(flags.has("preserve") ? { preserveDrawingBuffer: true } : {}),
    ...(singleSampled ? { antialiasGL: false } : {}),
    ...(flags.has("lowpower") ? { powerPreference: "low-power" } : {}),
  } as RendererOptions;
}

/** The renderer type to ask Phaser for: what a link asked for, else `auto` (WebGL, or Canvas where there is none). */
export function rendererTypeOf(options: RendererOptions): "canvas" | "webgl" | "auto" {
  return options.canvas ? "canvas" : options.webgl ? "webgl" : "auto";
}

/** True when Phaser picked Canvas by itself: the browser had no WebGL and no link asked for Canvas. */
export function fellBackToCanvas(options: RendererOptions, pickedCanvas: boolean): boolean {
  return pickedCanvas && !options.canvas;
}

/** Whether this run fell back to Canvas: set once by `main.ts` at boot, read by Title's notice (`scenes/renderer-notice.ts`). */
let fellBack = false;

export function setCanvasFallback(on: boolean): void {
  fellBack = on;
}

export function canvasFallbackInUse(): boolean {
  return fellBack;
}
