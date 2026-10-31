import { describe, expect, it, vi } from "vitest";
import { instanceId as toInstanceId } from "@mc/engine";
import { GuideGateHolder, type GuideGate } from "./guide-gate.js";

const gate = (overrides: Partial<GuideGate> = {}): GuideGate => ({
  actions: new Set(["thwart"]),
  cards: new Set([toInstanceId("i4")]),
  ...overrides,
});

describe("GuideGateHolder — no gate", () => {
  it("allows everything with nothing set", () => {
    const holder = new GuideGateHolder();
    expect(holder.allowsAction("attack")).toBe(true);
    expect(holder.allowsCard(toInstanceId("i1"))).toBe(true);
    expect(holder.current).toBeNull();
  });
});

describe("GuideGateHolder — set", () => {
  it("allows only what the gate names", () => {
    const holder = new GuideGateHolder();
    holder.set(gate());
    expect(holder.allowsAction("thwart")).toBe(true);
    expect(holder.allowsAction("attack")).toBe(false);
    expect(holder.allowsCard(toInstanceId("i4"))).toBe(true);
    expect(holder.allowsCard(toInstanceId("i5"))).toBe(false);
  });

  it("set(null) clears it outright — 'Stop tutorial'", () => {
    const holder = new GuideGateHolder();
    holder.set(gate());
    holder.set(null);
    expect(holder.current).toBeNull();
    expect(holder.allowsAction("attack")).toBe(true);
  });

  it("a fresh gate resets the inert-click count — two strikes on the old gate don't carry over", () => {
    const holder = new GuideGateHolder();
    const onGateEscaped = vi.fn();
    holder.set(gate({ onGateEscaped }));
    holder.noteInertClick();
    holder.set(gate({ onGateEscaped })); // one strike already landed, then a new step starts
    holder.noteInertClick();
    expect(onGateEscaped).not.toHaveBeenCalled(); // only one strike against the new gate
  });
});

describe("GuideGateHolder — two inert clicks nudge, and the gate stays up (#554)", () => {
  it("stays gated after one inert click", () => {
    const holder = new GuideGateHolder();
    const onGateEscaped = vi.fn();
    holder.set(gate({ onGateEscaped }));
    holder.noteInertClick();
    expect(holder.current).not.toBeNull();
    expect(onGateEscaped).not.toHaveBeenCalled();
  });

  it("fires onGateEscaped on the second inert click, and keeps blocking", () => {
    const holder = new GuideGateHolder();
    const onGateEscaped = vi.fn();
    holder.set(gate({ onGateEscaped }));
    holder.noteInertClick();
    holder.noteInertClick();
    expect(onGateEscaped).toHaveBeenCalledOnce();
    expect(holder.current).not.toBeNull();
    expect(holder.allowsAction("attack")).toBe(false);
    expect(holder.allowsCard(toInstanceId("i5"))).toBe(false);
  });

  it("nudges again on every second inert click after that", () => {
    const holder = new GuideGateHolder();
    const onGateEscaped = vi.fn();
    holder.set(gate({ onGateEscaped }));
    for (let i = 0; i < 4; i++) holder.noteInertClick();
    expect(onGateEscaped).toHaveBeenCalledTimes(2);
  });

  it("is a no-op with no gate open", () => {
    const holder = new GuideGateHolder();
    holder.noteInertClick();
    holder.noteInertClick();
    expect(holder.current).toBeNull();
  });
});

describe("GuideGateHolder — release (Escape)", () => {
  it("lifts the gate immediately, regardless of the inert-click count so far, and fires onGateReleased", () => {
    const holder = new GuideGateHolder();
    const onGateReleased = vi.fn();
    const onGateEscaped = vi.fn();
    holder.set(gate({ onGateReleased, onGateEscaped }));
    holder.noteInertClick(); // one strike, still short of the two-click threshold
    expect(holder.release()).toBe(true);
    expect(holder.current).toBeNull();
    expect(onGateReleased).toHaveBeenCalledOnce();
    expect(onGateEscaped).not.toHaveBeenCalled();
  });

  it("every control works again immediately after release", () => {
    const holder = new GuideGateHolder();
    holder.set(gate());
    holder.release();
    expect(holder.allowsAction("attack")).toBe(true);
    expect(holder.allowsCard(toInstanceId("i9"))).toBe(true);
  });

  it("is a no-op, returning false, with no gate open", () => {
    const holder = new GuideGateHolder();
    const onGateReleased = vi.fn();
    expect(holder.release()).toBe(false);
    expect(onGateReleased).not.toHaveBeenCalled();
  });
});
