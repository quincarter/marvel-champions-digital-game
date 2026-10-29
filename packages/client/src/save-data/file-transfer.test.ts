import { describe, expect, it } from "vitest";
import { exportRouteFor } from "./file-transfer.js";

const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 8; wv) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

describe("exportRouteFor", () => {
  it("asks the desktop app's Save dialog, whatever the webview can share", () => {
    expect(exportRouteFor("tauri", true)).toBe("save-dialog");
    expect(exportRouteFor("tauri", false)).toBe("save-dialog");
  });

  it("keeps the share sheet on the phone apps when they can share files", () => {
    expect(exportRouteFor("capacitor", true)).toBe("share");
    expect(exportRouteFor("capacitor", false)).toBe("download");
  });

  it("opens Android's own Save dialog in the Android app, whatever the webview can share", () => {
    expect(exportRouteFor("capacitor", false, ANDROID)).toBe("android-save");
    expect(exportRouteFor("capacitor", true, ANDROID)).toBe("android-save");
    expect(exportRouteFor("capacitor", true, IPHONE)).toBe("share");
  });

  it("downloads in a browser, even Chrome on Android", () => {
    expect(exportRouteFor("web", true, ANDROID)).toBe("download");
  });

  it("downloads in a browser, even one that can share files", () => {
    expect(exportRouteFor("web", true)).toBe("download");
    expect(exportRouteFor("web", false)).toBe("download");
  });
});
