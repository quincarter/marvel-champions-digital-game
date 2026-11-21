import { describe, expect, test, vi } from "vitest";

// Only the fitting helpers run here: Phaser, the rexUI plugins and the art thumbnails just have to import.
vi.mock("phaser", () => ({ default: {} }));
vi.mock("./rex.js", () => ({}));
vi.mock("../scenes/roster-panel.js", () => ({ renderArtThumb: () => null }));

const { fitCredited } = await import("./matchup-rows.js");

/**
 * A text object measured as a fixed-pitch font (each character `0.6 × size` wide), enough of Phaser's `Text` for the
 * fitting helpers: set and read the text and size, and wrap at a width by whole words.
 */
function fakeText(initial: string) {
  let value = initial;
  let size = 16;
  let wrap: number | null = null;
  const charWidth = (): number => size * 0.6;
  const wrapped = (): string[] => {
    if (wrap === null) return value.split("\n");
    return value.split("\n").flatMap((paragraph) => {
      const lines: string[] = [];
      let line = "";
      for (const word of paragraph.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (line && next.length * charWidth() > wrap!) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      return [...lines, line];
    });
  };
  const text = {
    get text() {
      return value;
    },
    get width() {
      return Math.max(...wrapped().map((line) => line.length * charWidth()));
    },
    get style() {
      return { fontSize: `${size}px` };
    },
    letterSpacing: 0,
    context: { measureText: (word: string) => ({ width: word.length * charWidth() }) },
    setText(next: string) {
      value = next;
      return text;
    },
    setFontSize(next: number) {
      size = next;
      return text;
    },
    setWordWrapWidth(width: number | null) {
      wrap = width;
      return text;
    },
    setLetterSpacing() {
      return text;
    },
    getWrappedText: () => wrapped(),
  };
  return text;
}

describe("fitCredited keeps a custom pack's designer in every Match-ups view (issue #937)", () => {
  const long = "The Extraordinarily Long Scenario Name (by PermaKarma)";

  test.each([
    ["Heat Grid row on a phone", 94, 12, 2, false],
    ["Stamps column on a phone", 52, 12, 2, true],
    ["Focus tile", 70, 11, 2, true],
  ])("%s: the name is clipped and the credit keeps its own line", (_view, width, size, lines, wrap) => {
    const text = fakeText(long);
    fitCredited(text as never, width, size, lines, wrap);
    const shown = text.text.split("\n");
    expect(shown).toHaveLength(2);
    expect(shown[1]).toMatch(/^by Perma/);
    expect(text.width).toBeLessThanOrEqual(width);
  });

  test.each([
    ["Shelves name", 120, 18],
    ["Focus side row", 110, 13],
  ])("%s: one line ends with the credit after the clipped name", (_view, width, size) => {
    const text = fakeText(long.toUpperCase());
    fitCredited(text as never, width, size, 1, false);
    expect(text.text).not.toContain("\n");
    expect(text.text).toMatch(/BY PERMA/);
    expect(text.width).toBeLessThanOrEqual(width);
  });

  test("a name that fits whole, or has no credit, is fitted as before", () => {
    const fits = fakeText("The Rose (by PermaKarma)");
    fitCredited(fits as never, 400, 12, 2, false);
    expect(fits.text).toBe("The Rose (by PermaKarma)");
    const official = fakeText("Spider-Man (Peter Parker)");
    fitCredited(official as never, 60, 12, 2, false);
    expect(official.text).not.toContain("\n");
  });
});
