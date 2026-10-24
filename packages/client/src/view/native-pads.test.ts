import { describe, expect, it } from "vitest";
import { LATCH_FRAMES, NativePads, type BridgePad } from "./native-pads.js";

const pad = (pressed: number[], downs: number[] = [], extra: Partial<BridgePad> = {}): BridgePad => ({
  index: 0,
  id: "8BitDo Ultimate 2 Wireless Controller (STANDARD GAMEPAD Vendor: 2dc8 Product: 310b)",
  connected: true,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
  axes: [0, 0, 0, 0],
  timestamp: 10,
  downs,
  ...extra,
});

describe("NativePads", () => {
  it("reports a connected pad in its slot as a standard gamepad", () => {
    const pads = new NativePads();
    expect(pads.apply({ kind: "connected", pad: pad([]) })).toBe(true);
    const [first, second] = pads.snapshot();
    expect(first?.mapping).toBe("standard");
    expect(first?.connected).toBe(true);
    expect(second).toBeNull();
  });

  it("keeps a tap that is already released reading as down for a couple of frames", () => {
    const pads = new NativePads();
    pads.apply({ kind: "connected", pad: pad([]) });
    pads.apply({ kind: "state", pad: pad([], [0]) });
    for (let frame = 0; frame < LATCH_FRAMES; frame++) {
      expect(pads.snapshot()[0]?.buttons[0]?.pressed).toBe(true);
      pads.endFrame();
    }
    expect(pads.snapshot()[0]?.buttons[0]?.pressed).toBe(false);
    expect(pads.latching).toBe(false);
  });

  it("shows a held button as held, latched or not", () => {
    const pads = new NativePads();
    pads.apply({ kind: "state", pad: pad([1], [1]) });
    pads.endFrame();
    pads.endFrame();
    pads.endFrame();
    expect(pads.snapshot()[0]?.buttons[1]?.pressed).toBe(true);
  });

  it("drops a pad that disconnects, with its taps", () => {
    const pads = new NativePads();
    pads.apply({ kind: "state", pad: pad([], [2]) });
    expect(pads.apply({ kind: "disconnected", pad: pad([], [], { connected: false }) })).toBe(true);
    expect(pads.snapshot()[0]).toBeNull();
    expect(pads.latching).toBe(false);
  });

  it("hands back the same array until something changes", () => {
    const pads = new NativePads();
    pads.apply({ kind: "state", pad: pad([]) });
    const first = pads.snapshot();
    expect(pads.snapshot()).toBe(first);
    pads.apply({ kind: "state", pad: pad([3]) });
    expect(pads.snapshot()).not.toBe(first);
  });
});
