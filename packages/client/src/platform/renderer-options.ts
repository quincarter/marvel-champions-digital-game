/**
 * Renderer choices a URL can make, for narrowing down a device whose WebGL output shows black (issue #157: Edge 155
 * on Android with a PowerVR GPU drew correct pixels, read back through `?diag=1`, yet showed a black page; the Canvas
 * renderer showed the game). Each `?gl=` flag flips one WebGL context attribute, so a test link per flag says which
 * one that browser and GPU mishandle:
 *  - `alpha`: a transparent canvas (`transparent: true`, context `alpha: true`); the page's VOID shows through.
 *  - `preserve`: `preserveDrawingBuffer: true`.
 *  - `noaa`: no multisampled drawing buffer (`antialiasGL: false`).
 *  - `lowpower`: `powerPreference: "low-power"`.
 * `?renderer=canvas` starts the Canvas renderer instead. With neither, the config is the game's usual one.
 */
export interface RendererOptions {
  readonly canvas: boolean;
  readonly transparent?: true;
  readonly preserveDrawingBuffer?: true;
  readonly antialiasGL?: false;
  readonly powerPreference?: "low-power";
}

export function rendererOptionsOf(search: string): RendererOptions {
  const params = new URLSearchParams(search);
  const flags = new Set((params.get("gl") ?? "").split(",").map((flag) => flag.trim()));
  return {
    canvas: params.get("renderer") === "canvas",
    ...(flags.has("alpha") ? { transparent: true } : {}),
    ...(flags.has("preserve") ? { preserveDrawingBuffer: true } : {}),
    ...(flags.has("noaa") ? { antialiasGL: false } : {}),
    ...(flags.has("lowpower") ? { powerPreference: "low-power" } : {}),
  } as RendererOptions;
}
