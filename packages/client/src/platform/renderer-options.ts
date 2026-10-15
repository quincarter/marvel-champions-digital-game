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
 * Test links, for the next device like it:
 *  - `?gl=alpha`: a transparent canvas (`transparent: true`, context `alpha: true`); the page's VOID shows through.
 *  - `?gl=preserve`: `preserveDrawingBuffer: true`.
 *  - `?gl=noaa`: no multisampled drawing buffer (`antialiasGL: false`).
 *  - `?gl=aa`: the multisampled buffer even on a device that matches, to check the workaround is still needed.
 *  - `?gl=lowpower`: `powerPreference: "low-power"`.
 *  - `?renderer=canvas`: the Canvas renderer instead of WebGL.
 */
export interface RendererOptions {
  readonly canvas: boolean;
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

export function rendererOptionsOf(search: string, device: DeviceInfo | null = null): RendererOptions {
  const params = new URLSearchParams(search);
  const flags = new Set((params.get("gl") ?? "").split(",").map((flag) => flag.trim()));
  const singleSampled = flags.has("noaa") || (!flags.has("aa") && device !== null && needsSingleSampledCanvas(device));
  return {
    canvas: params.get("renderer") === "canvas",
    ...(flags.has("alpha") ? { transparent: true } : {}),
    ...(flags.has("preserve") ? { preserveDrawingBuffer: true } : {}),
    ...(singleSampled ? { antialiasGL: false } : {}),
    ...(flags.has("lowpower") ? { powerPreference: "low-power" } : {}),
  } as RendererOptions;
}
