import { describe, expect, it } from "vitest";
import { PressArm } from "./press-arm.js";

describe("PressArm", () => {
  it("does not count a bare pointer-up as a click", () => {
    // The exact bug: a control that appears mid-gesture (the Inspect sheet's
    // primary button, drawn under the pointer that opened the sheet) sees
    // the release of that gesture with no matching down.
    const arm = new PressArm();
    expect(arm.up()).toBe(false);
  });

  it("counts a down followed by an up as a click", () => {
    const arm = new PressArm();
    arm.down();
    expect(arm.up()).toBe(true);
  });

  it("only counts the click once — a second up with no new down is not a click", () => {
    const arm = new PressArm();
    arm.down();
    expect(arm.up()).toBe(true);
    expect(arm.up()).toBe(false);
  });

  it("cancel() (the press left the control) drops the pending down", () => {
    const arm = new PressArm();
    arm.down();
    arm.cancel();
    expect(arm.up()).toBe(false);
  });

  it("a fresh down after a cancel can still click", () => {
    const arm = new PressArm();
    arm.down();
    arm.cancel();
    arm.down();
    expect(arm.up()).toBe(true);
  });

  it("a second down before an up does not create two clicks", () => {
    const arm = new PressArm();
    arm.down();
    arm.down();
    expect(arm.up()).toBe(true);
    expect(arm.up()).toBe(false);
  });

  it("models the sheet-open sequence: down elsewhere, then up lands on a freshly-created button", () => {
    // The opening gesture's pointerdown happened on a different game object
    // (the hand card), so this control's own PressArm never saw a down().
    const openingGestureButton = new PressArm();
    expect(openingGestureButton.up()).toBe(false);
    // A later, deliberate click on the same button works normally.
    openingGestureButton.down();
    expect(openingGestureButton.up()).toBe(true);
  });
});
