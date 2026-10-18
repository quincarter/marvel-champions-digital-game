import { describe, expect, test } from "vitest";
import {
  POWER_SAVING_ROW_NOTE,
  powerSavingFooterOf,
  powerSavingNoticeOf,
  powerSavingRowOf,
} from "./power-saving-notice.js";

describe("power saving notice", () => {
  test("says what the game turned down when the mode comes on", () => {
    expect(powerSavingNoticeOf(true, { reducedMotion: true })).toEqual({
      heading: "Power saving detected",
      body: "Reduced motion and a 30 fps cap are on while it lasts.",
    });
    // A player who turned reduced motion off themselves keeps it off; only the cap is new.
    expect(powerSavingNoticeOf(true, { reducedMotion: false }).body).toBe("A 30 fps cap is on while it lasts.");
  });

  test("says everything is back when the mode goes off", () => {
    expect(powerSavingNoticeOf(false, { reducedMotion: false }).heading).toBe("Power saving off");
  });

  test("the Title footer shows a line only while the mode is on", () => {
    expect(powerSavingFooterOf(true)).toBe("Power saving detected · lighter effects, 30 fps");
    expect(powerSavingFooterOf(false)).toBeNull();
    expect(POWER_SAVING_ROW_NOTE).toMatch(/unless you change it/);
  });

  test("a player who turned lighter play off is told the game runs as usual", () => {
    expect(powerSavingNoticeOf(true, { reducedMotion: false }, false).body).toBe(
      "Lighter play is off in Settings, so the game runs as usual.",
    );
    expect(powerSavingFooterOf(true, false)).toBe("Power saving detected · lighter play off");
  });

  test("the Settings toggle reflects the setting and whether the mode is on now", () => {
    expect(powerSavingRowOf({ powerSavingAdjust: true }, false)).toMatchObject({ on: true });
    expect(powerSavingRowOf({ powerSavingAdjust: false }, true).detail).toMatch(/Power saving mode is on now\.$/);
  });
});
