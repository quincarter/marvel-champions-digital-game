import { describe, expect, it } from "vitest";
import { exportRouteFor } from "./file-transfer.js";

describe("exportRouteFor", () => {
  it("asks the desktop app's Save dialog, whatever the webview can share", () => {
    expect(exportRouteFor("tauri", true)).toBe("save-dialog");
    expect(exportRouteFor("tauri", false)).toBe("save-dialog");
  });

  it("keeps the share sheet on the phone apps when they can share files", () => {
    expect(exportRouteFor("capacitor", true)).toBe("share");
    expect(exportRouteFor("capacitor", false)).toBe("download");
  });

  it("downloads in a browser, even one that can share files", () => {
    expect(exportRouteFor("web", true)).toBe("download");
    expect(exportRouteFor("web", false)).toBe("download");
  });
});
