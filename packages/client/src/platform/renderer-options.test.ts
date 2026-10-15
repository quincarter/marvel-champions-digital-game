import { describe, expect, test } from "vitest";
import { rendererOptionsOf } from "./renderer-options.js";

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
