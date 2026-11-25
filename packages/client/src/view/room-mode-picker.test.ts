import { describe, expect, it } from "vitest";
import { en } from "../i18n/en.js";
import { es } from "../i18n/es.js";
import {
  ROOM_MODES,
  ROOM_MODE_COPY,
  kindOfWidth,
  modeInFocus,
  modePickerLayout,
  tileParts,
} from "./room-mode-picker.js";

const sizes: readonly [string, number, number][] = [
  ["se", 375, 667],
  ["pixel", 412, 924],
  ["tablet-portrait", 768, 1024],
  ["tablet", 1024, 768],
  ["desktop", 1440, 900],
];

describe("modePickerLayout", () => {
  it("picks a layout by width", () => {
    expect(kindOfWidth(375)).toBe("compact");
    expect(kindOfWidth(768)).toBe("strip");
    expect(kindOfWidth(1024)).toBe("side");
  });

  it.each(sizes)("keeps everything inside the box and the screen at %s", (_n, width, height) => {
    const l = modePickerLayout(width, height);
    const inside = (r: { x: number; y: number; width: number; height: number }, within = l.box): void => {
      expect(r.x).toBeGreaterThanOrEqual(within.x);
      expect(r.y).toBeGreaterThanOrEqual(within.y);
      expect(r.x + r.width).toBeLessThanOrEqual(within.x + within.width + 0.5);
      expect(r.y + r.height).toBeLessThanOrEqual(within.y + within.height + 0.5);
    };
    inside(l.box, { x: 0, y: 0, width, height });
    for (const r of [...l.tiles, l.info, l.confirm, l.cancel]) inside(r);
    expect(l.tiles).toHaveLength(3);
    for (let i = 1; i < 3; i++) expect(l.tiles[i]!.x).toBeGreaterThanOrEqual(l.tiles[i - 1]!.x + l.tiles[i - 1]!.width);
    expect(l.confirm.x).toBeGreaterThanOrEqual(l.cancel.x + l.cancel.width);
  });

  it.each(sizes)("leaves the info panel room to read at %s", (_n, width, height) => {
    const l = modePickerLayout(width, height);
    expect(l.info.height).toBeGreaterThanOrEqual(l.kind === "side" ? 360 : 300);
    expect(l.info.width).toBeGreaterThanOrEqual(l.kind === "side" ? 340 : 340);
  });

  it("puts the info beside the tiles on a wide screen and under them otherwise", () => {
    const wide = modePickerLayout(1440, 900);
    expect(wide.info.x).toBeGreaterThanOrEqual(wide.tiles[2]!.x + wide.tiles[2]!.width);
    for (const [w, h] of [
      [375, 667],
      [768, 1024],
    ] as const) {
      const l = modePickerLayout(w, h);
      expect(l.info.y).toBeGreaterThanOrEqual(l.tiles[0]!.y + l.tiles[0]!.height);
    }
  });

  it("splits a tile into art and a title band that fill it", () => {
    for (const tagline of [true, false]) {
      const { art, band } = tileParts({ x: 10, y: 20, width: 100, height: 140 }, tagline);
      expect(art.height + band.height).toBe(140);
      expect(band.y).toBe(art.y + art.height);
    }
  });
});

describe("modes", () => {
  it("shows what is under the pointer, else the pick", () => {
    expect(modeInFocus("epic", null)).toBe("epic");
    expect(modeInFocus("epic", "competitive")).toBe("competitive");
  });

  it("has every line of copy in English and Spanish", () => {
    for (const id of ROOM_MODES) {
      const copy = ROOM_MODE_COPY[id];
      for (const key of [copy.title, copy.tagline, ...copy.facts.flatMap((f) => [f.label, f.text])]) {
        expect(en[key], key).toBeTruthy();
        expect(es[key], key).toBeTruthy();
      }
    }
  });
});
