import { describe, expect, test } from "vitest";
import { chromeStopsOf } from "./chrome-stops.js";

const music = { x: 1094, y: 93, width: 44, height: 44 };
const report = { x: 1146, y: 93, width: 44, height: 44 };
const base = { isTop: true, excluded: false, music, report, own: [] };

describe("chromeStopsOf", () => {
  test("both buttons are stops on the top screen while they are drawn", () => {
    expect(chromeStopsOf(base)).toEqual({ music, report });
  });
  test("a hidden button gives no stop", () => {
    expect(chromeStopsOf({ ...base, report: null })).toEqual({ music, report: null });
  });
  test("a screen under an overlay takes none", () => {
    expect(chromeStopsOf({ ...base, isTop: false })).toEqual({ music: null, report: null });
  });
  test("the report sheet and the chrome scenes take none", () => {
    expect(chromeStopsOf({ ...base, excluded: true })).toEqual({ music: null, report: null });
  });
  test("a button the screen already has its own stop over keeps the screen's stop", () => {
    const own = [{ x: 1090, y: 90, width: 50, height: 50 }];
    expect(chromeStopsOf({ ...base, own })).toEqual({ music: null, report });
  });
  test("a stop that only touches the edge is not over the button", () => {
    const own = [{ x: 1138, y: 93, width: 8, height: 44 }];
    expect(chromeStopsOf({ ...base, own })).toEqual({ music, report });
  });
});
