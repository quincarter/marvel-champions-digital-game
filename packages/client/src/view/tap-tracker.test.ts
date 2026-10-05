import { describe, expect, it } from "vitest";
import { TAP_GESTURE_MS, TAP_SLOP_PX, TapTracker, type PressTarget } from "./press-arm.js";

const on = (id: string): PressTarget => ({ id, foreign: false });
const none: PressTarget = { id: null, foreign: false };
const at = { x: 100, y: 100 };

describe("TapTracker", () => {
  it("completes a tap on the control it went down over, however many redraws came between", () => {
    const t = new TapTracker();
    t.down(1, on("btn:tab"), at, 0, true);
    // N redraws between down and up change nothing the tracker sees: it holds ids, not zones.
    expect(t.up(1, on("btn:tab"), at, 40)).toBe("btn:tab");
  });

  it("completes a burst tap (down and up in the same instant)", () => {
    const t = new TapTracker();
    t.down(1, on("target:7"), at, 5, true);
    expect(t.up(1, on("target:7"), at, 5)).toBe("target:7");
  });

  it("completes a press that went down in the frame right after a redraw (no zone saw the down)", () => {
    // The down carries the id the registry resolves by rect, even though the engine's hit-test found nothing.
    const t = new TapTracker();
    t.down(1, { id: "btn:tab", foreign: false }, at, 21, true);
    expect(t.up(1, on("btn:tab"), at, 60)).toBe("btn:tab");
  });

  it("never presses a control on the next screen: down on A, screen change, up over B", () => {
    const t = new TapTracker();
    t.down(1, on("btn:continue-a"), at, 0, true);
    expect(t.up(1, on("btn:other-b"), at, 50)).toBeNull();
  });

  it("never presses a control that did not exist at pointer-down (a sheet that opened under the finger)", () => {
    const t = new TapTracker();
    t.down(1, none, at, 0, true);
    expect(t.up(1, on("btn:sheet-primary"), at, 600)).toBeNull();
  });

  it("does not press when the screen is gone at up", () => {
    const t = new TapTracker();
    t.down(1, on("btn:a"), at, 0, true);
    expect(t.up(1, none, at, 50)).toBeNull();
  });

  it("a touch that drifts within the slop is a tap, beyond it a scroll", () => {
    const within = new TapTracker();
    within.down(1, on("row"), at, 0, true);
    expect(within.up(1, on("row"), { x: at.x + TAP_SLOP_PX, y: at.y }, 80)).toBe("row");
    const beyond = new TapTracker();
    beyond.down(1, on("row"), at, 0, true);
    expect(beyond.up(1, on("row"), { x: at.x + TAP_SLOP_PX + 1, y: at.y }, 80)).toBeNull();
  });

  it("a touch that strayed past the slop and came back is still a scroll", () => {
    const t = new TapTracker();
    t.down(1, on("row"), at, 0, true);
    t.move(1, { x: at.x + 40, y: at.y }, on("row"));
    expect(t.up(1, on("row"), at, 90)).toBeNull();
  });

  it("a mouse that left the control and came back is not a click", () => {
    const t = new TapTracker();
    t.down(1, on("btn"), at, 0, false);
    t.move(1, { x: 300, y: 300 }, none);
    expect(t.up(1, on("btn"), at, 90)).toBeNull();
  });

  it("a mouse that moved within the control still clicks, with no slop", () => {
    const t = new TapTracker();
    t.down(1, on("btn"), at, 0, false);
    t.move(1, { x: at.x + 30, y: at.y }, on("btn"));
    expect(t.up(1, on("btn"), { x: at.x + 30, y: at.y }, 90)).toBe("btn");
  });

  it("does not double fire: an object handler that already pressed it consumes the gesture", () => {
    const t = new TapTracker();
    t.down(1, on("btn"), at, 0, true);
    t.markFired(1);
    expect(t.up(1, on("btn"), at, 30)).toBeNull();
  });

  it("completes a gesture once: a second up with no new down is nothing", () => {
    const t = new TapTracker();
    t.down(1, on("btn"), at, 0, true);
    expect(t.up(1, on("btn"), at, 30)).toBe("btn");
    expect(t.up(1, on("btn"), at, 31)).toBeNull();
  });

  it("leaves a press that began over, or ended over, a foreign object to that object", () => {
    const foreign: PressTarget = { id: "btn", foreign: true };
    const a = new TapTracker();
    a.down(1, foreign, at, 0, true);
    expect(a.up(1, on("btn"), at, 30)).toBeNull();
    const b = new TapTracker();
    b.down(1, on("btn"), at, 0, true);
    expect(b.up(1, foreign, at, 30)).toBeNull();
  });

  it("a press held past the time limit is not completed", () => {
    const t = new TapTracker();
    t.down(1, on("btn"), at, 0, true);
    expect(t.up(1, on("btn"), at, TAP_GESTURE_MS + 1)).toBeNull();
  });

  it("a release of a later press this tracker never saw does not complete an older gesture", () => {
    const t = new TapTracker();
    t.down(1, on("btn"), at, 0, true, 100);
    // Another scene took the next press, so this one saw only its up.
    expect(t.up(1, on("btn"), at, 200, 180)).toBeNull();
  });

  it("an up with no down (a gesture another scene owned) is nothing", () => {
    expect(new TapTracker().up(1, on("btn"), at, 0)).toBeNull();
  });

  it("tracks two fingers apart", () => {
    const t = new TapTracker();
    t.down(1, on("a"), at, 0, true);
    t.down(2, on("b"), { x: 300, y: 300 }, 0, true);
    t.markFired(1);
    expect(t.up(2, on("b"), { x: 300, y: 300 }, 10)).toBe("b");
    expect(t.up(1, on("a"), at, 10)).toBeNull();
  });

  it("a cancelled pointer completes nothing", () => {
    const t = new TapTracker();
    t.down(1, on("a"), at, 0, true);
    t.cancel(1);
    expect(t.up(1, on("a"), at, 10)).toBeNull();
  });
});
