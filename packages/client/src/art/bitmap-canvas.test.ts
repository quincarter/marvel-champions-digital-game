import { afterEach, describe, expect, it, vi } from "vitest";

import { runningInLinuxDesktopApp } from "../platform/linux-desktop.js";
import { canvasOf } from "./bitmap-canvas.js";

function fakeDocument() {
  const contexts: string[] = [];
  const transferred: unknown[] = [];
  const drawn: unknown[] = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: (kind: string, options?: unknown) => {
      contexts.push(kind + (options ? JSON.stringify(options) : ""));
      if (kind === "bitmaprenderer") return { transferFromImageBitmap: (b: unknown) => transferred.push(b) };
      return { drawImage: (b: unknown) => drawn.push(b) };
    },
  };
  vi.stubGlobal("document", { createElement: () => canvas });
  return { canvas, contexts, transferred, drawn };
}

const bitmap = () => ({ width: 8, height: 4, close: vi.fn() }) as unknown as ImageBitmap;

afterEach(() => vi.unstubAllGlobals());

describe("canvasOf", () => {
  it("hands the bitmap to a bitmaprenderer canvas by default", () => {
    const doc = fakeDocument();
    const b = bitmap();
    expect(canvasOf(b, false)).toBe(doc.canvas);
    expect(doc.transferred).toEqual([b]);
    expect(doc.drawn).toEqual([]);
    expect(doc.canvas.width).toBe(8);
  });

  it("copies into a plain software 2D canvas and closes the bitmap when asked (Linux desktop)", () => {
    const doc = fakeDocument();
    const b = bitmap();
    canvasOf(b, true);
    expect(doc.contexts).toEqual(['2d{"willReadFrequently":true}']);
    expect(doc.drawn).toEqual([b]);
    expect(b.close).toHaveBeenCalledOnce();
  });
});

describe("runningInLinuxDesktopApp", () => {
  it("is true only in a Tauri shell on Linux", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15" });
    expect(runningInLinuxDesktopApp()).toBe(false);
    vi.stubGlobal("__TAURI_INTERNALS__", {});
    expect(runningInLinuxDesktopApp()).toBe(true);
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0)" });
    expect(runningInLinuxDesktopApp()).toBe(false);
  });
});
