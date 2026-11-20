import { describe, expect, it } from "vitest";
import { deviceFormOf, PHONE_SHORT_SIDE_MAX, roomDeviceOf } from "./room-device.js";

const screen = (shortSide: number, coarsePointer = false) => ({ shortSide, coarsePointer });

describe("deviceFormOf", () => {
  it("is a desktop in a native desktop shell, however small its window or screen reads", () => {
    for (const platform of ["windows", "macos", "linux"] as const) {
      expect(deviceFormOf(platform, screen(400, true))).toBe("desktop");
      expect(deviceFormOf(platform, screen(1080))).toBe("desktop");
    }
  });

  it("is a phone or a tablet on android and ios by the screen's shorter side", () => {
    expect(deviceFormOf("android", screen(412))).toBe("phone");
    expect(deviceFormOf("ios", screen(375))).toBe("phone");
    expect(deviceFormOf("ios", screen(PHONE_SHORT_SIDE_MAX - 1))).toBe("phone");
    expect(deviceFormOf("android", screen(PHONE_SHORT_SIDE_MAX))).toBe("tablet");
    expect(deviceFormOf("ios", screen(820))).toBe("tablet");
  });

  it("is a desktop in a browser with a mouse, and a phone or tablet in one with a finger", () => {
    expect(deviceFormOf("web", screen(900))).toBe("desktop");
    expect(deviceFormOf("web", screen(360))).toBe("desktop");
    expect(deviceFormOf("web", screen(390, true))).toBe("phone");
    expect(deviceFormOf("web", screen(768, true))).toBe("tablet");
  });
});

describe("roomDeviceOf", () => {
  it("names exactly the two coarse fields", () => {
    expect(roomDeviceOf("ios", screen(390))).toEqual({ platform: "ios", form: "phone" });
    expect(Object.keys(roomDeviceOf("web", screen(900))!).sort()).toEqual(["form", "platform"]);
  });

  it("sends nothing when the platform cannot be told", () => {
    expect(roomDeviceOf(null, screen(900))).toBeUndefined();
  });
});
