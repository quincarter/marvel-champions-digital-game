import { describe, expect, test } from "vitest";
import { needsSingleSampledCanvas, rendererOptionsOf, type DeviceInfo } from "./renderer-options.js";

// The device of issue #157, as its own `?diag=1` strip read it.
const EDGE_PIXEL: DeviceInfo = {
  userAgent:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36 EdgA/155.0.0.0",
  webglRenderer:
    "ANGLE (Google Inc. (Imagination Technologies), ANGLE (Imagination Technologies Vulkan 1.4.317 (PowerVR C-Series CXTP-48-1536 MC1 (0x70061042)) PowerVR C-Series Vulkan Driver-1.662.3024), OpenGL ES 3.2)",
};
const CHROME_PIXEL: DeviceInfo = {
  userAgent:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36",
  webglRenderer: EDGE_PIXEL.webglRenderer,
};
const EDGE_ON_GLES: DeviceInfo = {
  userAgent: EDGE_PIXEL.userAgent,
  webglRenderer: "ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)",
};

describe("renderer choices from the URL (issue #157)", () => {
  test("none: the usual WebGL config", () => {
    expect(rendererOptionsOf("")).toEqual({ canvas: false });
    expect(rendererOptionsOf("?diag=1")).toEqual({ canvas: false });
  });

  test("?renderer=canvas", () => {
    expect(rendererOptionsOf("?renderer=canvas&diag=1")).toEqual({ canvas: true });
  });

  test("each ?gl= flag flips one context attribute, and they combine", () => {
    expect(rendererOptionsOf("?gl=alpha")).toEqual({ canvas: false, transparent: true });
    expect(rendererOptionsOf("?gl=preserve")).toEqual({ canvas: false, preserveDrawingBuffer: true });
    expect(rendererOptionsOf("?gl=noaa")).toEqual({ canvas: false, antialiasGL: false });
    expect(rendererOptionsOf("?gl=lowpower")).toEqual({ canvas: false, powerPreference: "low-power" });
    expect(rendererOptionsOf("?gl=alpha,noaa&diag=1")).toEqual({
      canvas: false,
      transparent: true,
      antialiasGL: false,
    });
  });
});

describe("the device workaround (issue #157)", () => {
  test("Edge on Android with WebGL on ANGLE's Vulkan backend gets a single-sampled canvas", () => {
    expect(needsSingleSampledCanvas(EDGE_PIXEL)).toBe(true);
    expect(rendererOptionsOf("", EDGE_PIXEL)).toEqual({ canvas: false, antialiasGL: false });
  });

  test("Chrome on the same phone, Edge on another backend, or an unread renderer keep the usual config", () => {
    expect(rendererOptionsOf("", CHROME_PIXEL)).toEqual({ canvas: false });
    expect(rendererOptionsOf("", EDGE_ON_GLES)).toEqual({ canvas: false });
    expect(rendererOptionsOf("", { userAgent: EDGE_PIXEL.userAgent, webglRenderer: null })).toEqual({ canvas: false });
  });

  test("?gl=aa turns the workaround off, to check it is still needed", () => {
    expect(rendererOptionsOf("?gl=aa", EDGE_PIXEL)).toEqual({ canvas: false });
  });
});

describe("drawing at the screen's density (#328)", () => {
  test("at 2x and up there is no multisampled buffer", () => {
    expect(rendererOptionsOf("", null, 3)).toEqual({ canvas: false, antialiasGL: false });
    expect(rendererOptionsOf("", null, 2)).toEqual({ canvas: false, antialiasGL: false });
  });

  test("under 2x it stays, and ?gl=aa keeps it at any scale", () => {
    expect(rendererOptionsOf("", null, 1.5)).toEqual({ canvas: false });
    expect(rendererOptionsOf("?gl=aa", null, 3)).toEqual({ canvas: false });
  });
});
