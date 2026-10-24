import { describe, expect, test } from "vitest";
import {
  PAD_CONNECTED_MS,
  PadAnnounced,
  padConnectedMessage,
  padDisconnectedMessage,
  padToastFrameAt,
  padToastRect,
} from "./pad-toast.js";

const DUALSENSE = "054c-0ce6-DualSense Wireless Controller";
const XINPUT = "Xbox 360 Controller (XInput STANDARD GAMEPAD)";

describe("padConnectedMessage", () => {
  test("names the detected family and the pad", () => {
    const message = padConnectedMessage(DUALSENSE, "auto");
    expect(message.heading).toBe("Controller connected");
    expect(message.detail).toBe("PlayStation layout · DualSense Wireless Controller");
    expect(message.holdMs).toBe(PAD_CONNECTED_MS);
    expect(message.controlsButton).toBe(true);
  });

  test("the player's glyph-family setting overrides detection", () => {
    expect(padConnectedMessage(DUALSENSE, "nintendo").detail).toBe(
      "Nintendo Switch layout · DualSense Wireless Controller",
    );
    expect(padConnectedMessage(XINPUT, "auto").detail).toBe("Xbox layout · Xbox 360 Controller");
  });

  test("a disconnect is short, plain and has no Controls button", () => {
    const message = padDisconnectedMessage();
    expect(message.heading).toBe("Controller disconnected");
    expect(message.detail).toBeNull();
    expect(message.holdMs).toBe(3000);
    expect(message.controlsButton).toBe(false);
  });
});

describe("PadAnnounced", () => {
  test("announces a pad id once per session", () => {
    const announced = new PadAnnounced();
    expect(announced.claim("a")).toBe(true);
    expect(announced.claim("a")).toBe(false);
    expect(announced.claim("b")).toBe(true);
  });
});

describe("padToastRect", () => {
  test("sits top-centre under the title bar and stays on screen", () => {
    const desktop = padToastRect(1440, 980, true);
    expect(desktop.y).toBe(76);
    expect(desktop.x * 2 + desktop.width).toBe(1440);
    const phone = padToastRect(390, 844, true);
    expect(phone.x).toBeGreaterThanOrEqual(8);
    expect(phone.x + phone.width).toBeLessThanOrEqual(382);
    expect(phone.y + phone.height).toBeLessThan(844 / 3);
  });
});

describe("padToastFrameAt", () => {
  test("fades in, holds, fades out, then is done", () => {
    expect(padToastFrameAt(0, 4000, false).alpha).toBe(0);
    expect(padToastFrameAt(2000, 4000, false)).toEqual({ alpha: 1, lift: 0, done: false });
    expect(padToastFrameAt(3900, 4000, false).alpha).toBeLessThan(1);
    expect(padToastFrameAt(4000, 4000, false).done).toBe(true);
  });

  test("reduced motion neither fades nor slides", () => {
    expect(padToastFrameAt(10, 4000, true)).toEqual({ alpha: 1, lift: 0, done: false });
    expect(padToastFrameAt(3950, 4000, true)).toEqual({ alpha: 1, lift: 0, done: false });
  });
});
