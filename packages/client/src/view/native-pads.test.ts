import { describe, expect, it } from "vitest";
import { LATCH_STEPS, NativePads, type BridgePad } from "./native-pads.js";

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
const STEAM = { index: 1, id: "Steam Virtual Gamepad (STANDARD GAMEPAD Vendor: 28de Product: 11ff)" };

describe("NativePads", () => {
  it("reports a connected pad in its slot as a standard gamepad", () => {
    const pads = new NativePads();
    expect(pads.apply({ kind: "connected", pad: pad([]) })).toBe(true);
    const [first, second] = pads.snapshot();
    expect(first?.mapping).toBe("standard");
    expect(first?.connected).toBe(true);
    expect(second).toBeNull();
  });

  it("keeps a tap that is already released reading as down for a couple of game steps", () => {
    const pads = new NativePads();
    pads.apply({ kind: "connected", pad: pad([]) });
    pads.apply({ kind: "state", pad: pad([], [0]) });
    for (let step = 0; step < LATCH_STEPS; step++) {
      expect(pads.snapshot()[0]?.buttons[0]?.pressed).toBe(true);
      pads.endStep();
    }
    expect(pads.snapshot()[0]?.buttons[0]?.pressed).toBe(false);
    expect(pads.latching).toBe(false);
  });

  it("never latches a trigger to a full pull", () => {
    const pads = new NativePads();
    pads.apply({ kind: "state", pad: pad([], [6]) });
    expect(pads.snapshot()[0]?.buttons[6]?.value).toBe(0);
    expect(pads.latching).toBe(false);
  });

  it("shows a held button as held, latched or not", () => {
    const pads = new NativePads();
    pads.apply({ kind: "state", pad: pad([1], [1]) });
    pads.endStep();
    pads.endStep();
    pads.endStep();
    expect(pads.snapshot()[0]?.buttons[1]?.pressed).toBe(true);
  });

  it("turns the same object disconnected with every button up when its pad drops", () => {
    const pads = new NativePads();
    pads.apply({ kind: "state", pad: pad([12]) });
    const object = pads.snapshot()[0];
    expect(object?.buttons[12]?.pressed).toBe(true);
    expect(pads.apply({ kind: "disconnected", pad: pad([], [], { connected: false }) })).toBe(true);
    expect(pads.snapshot()[0]).toBe(object);
    expect(object?.connected).toBe(false);
    expect(object?.buttons[12]?.pressed).toBe(false);
    expect(pads.latching).toBe(false);
  });

  it("hands back the same array and objects as the pads change", () => {
    const pads = new NativePads();
    pads.apply({ kind: "state", pad: pad([]) });
    const first = pads.snapshot();
    const object = first[0];
    pads.apply({ kind: "state", pad: pad([3]) });
    expect(pads.snapshot()).toBe(first);
    expect(pads.snapshot()[0]).toBe(object);
    expect(object?.buttons[3]?.pressed).toBe(true);
  });

  it("turns Steam's virtual pad disconnected once the physical pad gives input, so a press doesn't land twice", () => {
    const pads = new NativePads();
    pads.apply({ kind: "connected", pad: pad([]) });
    pads.apply({ kind: "connected", pad: pad([0], [], STEAM) });
    expect(pads.snapshot()[1]?.connected).toBe(true);
    pads.apply({ kind: "state", pad: pad([0], [0]) });
    expect(pads.snapshot()[1]?.connected).toBe(false);
    expect(pads.snapshot()[1]?.buttons[0]?.pressed).toBe(false);
    expect(pads.snapshot()[0]?.buttons[0]?.pressed).toBe(true);
  });

  it("keeps Steam's virtual pad when it is the only one giving input", () => {
    const pads = new NativePads();
    pads.apply({ kind: "connected", pad: pad([]) });
    pads.apply({ kind: "state", pad: pad([0], [0], STEAM) });
    expect(pads.snapshot()[1]?.buttons[0]?.pressed).toBe(true);
  });

  it("reads every pad as gone when the bridge stops", () => {
    const pads = new NativePads();
    pads.apply({ kind: "state", pad: pad([2]) });
    pads.clear();
    expect(pads.snapshot()[0]?.connected).toBe(false);
  });
});
