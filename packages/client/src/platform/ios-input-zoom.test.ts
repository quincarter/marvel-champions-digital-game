import { describe, expect, it } from "vitest";
import { applyIosInputZoomGuard, isIosDevice, withoutFocusZoom, zoomedByFocus } from "./ios-input-zoom.js";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const IPAD_DESKTOP_SITE = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36";
const BASE = "width=device-width, initial-scale=1, interactive-widget=overlays-content";

describe("isIosDevice", () => {
  it("is true on an iPhone and on an iPad asking for the desktop site", () => {
    expect(isIosDevice({ userAgent: IPHONE })).toBe(true);
    expect(isIosDevice({ userAgent: IPAD_DESKTOP_SITE, maxTouchPoints: 5 })).toBe(true);
  });

  it("is false on a Mac, on Android and with no navigator", () => {
    expect(isIosDevice({ userAgent: IPAD_DESKTOP_SITE, maxTouchPoints: 0 })).toBe(false);
    expect(isIosDevice({ userAgent: ANDROID, maxTouchPoints: 5 })).toBe(false);
    expect(isIosDevice(undefined)).toBe(false);
  });
});

describe("withoutFocusZoom", () => {
  it("adds maximum-scale=1 once", () => {
    expect(withoutFocusZoom(BASE)).toBe(`${BASE}, maximum-scale=1`);
    expect(withoutFocusZoom(withoutFocusZoom(BASE))).toBe(`${BASE}, maximum-scale=1`);
    expect(withoutFocusZoom("")).toBe("maximum-scale=1");
  });
});

describe("zoomedByFocus", () => {
  it("resets a zoom the field caused", () => {
    expect(zoomedByFocus(1, 1.6, false)).toBe(true);
  });

  it("keeps a zoom the player chose before tapping the field or by pinching in it, and does nothing unzoomed", () => {
    expect(zoomedByFocus(2, 2, false)).toBe(false);
    expect(zoomedByFocus(1.5, 2, false)).toBe(false);
    expect(zoomedByFocus(1, 2, true)).toBe(false);
    expect(zoomedByFocus(1, 1, false)).toBe(false);
  });
});

describe("applyIosInputZoomGuard", () => {
  const fakeDoc = (): { doc: Document; meta: { content: string }; listeners: string[] } => {
    const meta = { content: BASE };
    const listeners: string[] = [];
    const doc = {
      querySelector: () => meta,
      addEventListener: (type: string) => listeners.push(type),
      defaultView: null,
    } as unknown as Document;
    return { doc, meta, listeners };
  };

  it("limits the viewport scale on iOS and watches fields leaving focus", () => {
    const { doc, meta, listeners } = fakeDoc();
    applyIosInputZoomGuard(doc, { userAgent: IPHONE });
    expect(meta.content).toBe(`${BASE}, maximum-scale=1`);
    expect(listeners).toEqual(["focusin", "touchstart", "focusout"]);
  });

  it("leaves the viewport alone everywhere else, so Android keeps pinch zoom", () => {
    const { doc, meta, listeners } = fakeDoc();
    applyIosInputZoomGuard(doc, { userAgent: ANDROID, maxTouchPoints: 5 });
    expect(meta.content).toBe(BASE);
    expect(listeners).toEqual([]);
  });
});
