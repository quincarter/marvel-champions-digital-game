import { describe, expect, test } from "vitest";
import { fitTileLabel, tileTailVariants } from "./villain-recap-tile.js";
import type { RecapChange } from "./villain-recap.js";

const widthOf = (limit: number) => (text: string) => text.length <= limit;
const change = (partial: Partial<RecapChange>): RecapChange => ({
  kind: "threat",
  label: "BREAKOUT",
  from: 0,
  to: 1,
  max: 12,
  note: null,
  text: null,
  highlight: false,
  playerId: null,
  ...partial,
});

describe("fitTileLabel", () => {
  test("a label that fits is left alone", () => {
    expect(fitTileLabel("SHE-HULK · YOU", widthOf(20))).toBe("SHE-HULK · YOU");
  });

  test("uses the short words before cutting letters", () => {
    expect(fitTileLabel("FIRST PLAYER", widthOf(10))).toBe("1ST PLAYER");
    expect(fitTileLabel("ENCOUNTER DECK", widthOf(9))).toBe("ENC. DECK");
  });

  test("drops the parenthetical before cutting any letters", () => {
    expect(fitTileLabel("SPIDER-MAN (PETER PARKER) · YOU", widthOf(18))).toBe("SPIDER-MAN · YOU");
  });

  test("a long name is cut, and the '· YOU' tag survives", () => {
    const label = fitTileLabel("THE REALM OF RAMA-TUT · YOU", widthOf(16));
    expect(label.endsWith(" · YOU")).toBe(true);
    expect(label).toContain("…");
    expect(label.length).toBeLessThanOrEqual(16);
  });
});

describe("tileTailVariants", () => {
  test("lists the tail widest first, so the panel can keep the figures large and drop the words", () => {
    expect(tileTailVariants(change({ note: "NO DAMAGE" }), false)).toEqual([
      "/12 THREAT · NO DAMAGE",
      "/12 THREAT",
      "/12",
      "",
    ]);
  });

  test("a phone never has room for the words", () => {
    expect(tileTailVariants(change({ note: "NO DAMAGE" }), true)).toEqual(["/12", ""]);
  });

  test("a tile with no ceiling still offers its note, then nothing", () => {
    expect(tileTailVariants(change({ kind: "encounterDeck", max: null, note: "6 DISCARDED" }), false)).toEqual([
      "6 DISCARDED",
      "",
    ]);
  });
});
