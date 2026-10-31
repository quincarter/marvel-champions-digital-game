import { describe, expect, test } from "vitest";
import { chromeStopsOf } from "./chrome-stops.js";

const music = { x: 1094, y: 93, width: 44, height: 44 };
const report = { x: 1146, y: 93, width: 44, height: 44 };
const language = { x: 1030, y: 93, width: 56, height: 44 };
const theme = { x: 978, y: 93, width: 44, height: 44 };
const base = { isTop: true, excluded: false, music, report, own: [] };
const none = { music: null, report: null, language: null, theme: null };

describe("chromeStopsOf", () => {
  test("both buttons are stops on the top screen while they are drawn", () => {
    expect(chromeStopsOf(base)).toEqual({ ...none, music, report });
  });
  test("a hidden button gives no stop", () => {
    expect(chromeStopsOf({ ...base, report: null })).toEqual({ ...none, music });
  });
  test("a screen under an overlay takes none", () => {
    expect(chromeStopsOf({ ...base, isTop: false, language, theme })).toEqual(none);
  });
  test("the report sheet and the chrome scenes take none", () => {
    expect(chromeStopsOf({ ...base, excluded: true, language, theme })).toEqual(none);
  });
  test("a button the screen already has its own stop over keeps the screen's stop", () => {
    const own = [{ x: 1090, y: 90, width: 50, height: 50 }];
    expect(chromeStopsOf({ ...base, own })).toEqual({ ...none, report });
  });
  test("a stop that only touches the edge is not over the button", () => {
    const own = [{ x: 1138, y: 93, width: 8, height: 44 }];
    expect(chromeStopsOf({ ...base, own })).toEqual({ ...none, music, report });
  });
  test("a route that asks for the whole row gets the language and theme buttons too", () => {
    expect(chromeStopsOf({ ...base, language, theme })).toEqual({ music, report, language, theme });
  });
  test("the language and theme buttons are no stops while the row is hidden (the theme button floats alone then)", () => {
    expect(chromeStopsOf({ ...base, music: null, report: null, language: null, theme })).toEqual(none);
  });
  test("a screen's own stop over the language or theme button keeps the screen's stop", () => {
    const own = [{ x: 1030, y: 93, width: 56, height: 44 }];
    expect(chromeStopsOf({ ...base, language, theme, own })).toEqual({ music, report, language: null, theme });
  });
});
