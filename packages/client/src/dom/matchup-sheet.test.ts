import { describe, expect, test, vi } from "vitest";

// Only the naming helper runs here: Phaser, the rexUI plugins and the art thumbnails just have to import.
vi.mock("phaser", () => ({ default: {} }));
vi.mock("../ui/rex.js", () => ({}));
vi.mock("../scenes/roster-panel.js", () => ({ renderArtThumb: () => null }));

const { creditedName } = await import("./matchup-sheet.js");
const { typeRole } = await import("../tokens.js");

interface Drawn {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly options: Record<string, unknown>;
}

/** A builder that measures a fixed-pitch font (each character `0.6 × size` wide, 14 px a line) and records its texts. */
function fakeBuilder() {
  const drawn: Drawn[] = [];
  const builder = {
    measure: (text: string, _spec: unknown, options: { size?: number } = {}) => ({
      width: text.length * (options.size ?? 11) * 0.6,
      height: 14,
    }),
    text: (x: number, y: number, text: string, _spec: unknown, options: Record<string, unknown>) => {
      drawn.push({ text, x, y, options });
      return { width: text.length * ((options.size as number) ?? 11) * 0.6, height: 14 };
    },
  };
  return { drawn, builder: builder as never };
}

const options = { size: 10, color: 0, maxLines: 2, wrap: true } as const;

describe("creditedName", () => {
  test("a name with no credit is one text, wrapped over its lines", () => {
    const { drawn, builder } = fakeBuilder();
    creditedName(builder, "Spider-Man", 0, 0, 100, typeRole.body, options);
    expect(drawn.map((d) => d.text)).toEqual(["Spider-Man"]);
    expect(drawn[0]!.options).toMatchObject({ wrapWidth: 100, maxLines: 2 });
  });

  test("a credited name that fits one line whole stays whole", () => {
    const { drawn, builder } = fakeBuilder();
    creditedName(builder, "Rose (by Perma)", 0, 0, 200, typeRole.body, options);
    expect(drawn.map((d) => d.text)).toEqual(["Rose (by Perma)"]);
  });

  test("a credited name that does not fit keeps its credit on its own last line", () => {
    const { drawn, builder } = fakeBuilder();
    creditedName(builder, "The Very Long Villain (by PermaKarma)", 0, 0, 80, typeRole.body, options);
    expect(drawn.map((d) => d.text)).toEqual(["The Very Long Villain", "by PermaKarma"]);
    expect(drawn[1]!.y).toBeGreaterThan(drawn[0]!.y);
  });

  test("on one line the credit follows the cut name", () => {
    const { drawn, builder } = fakeBuilder();
    creditedName(builder, "The Very Long Villain (by PermaKarma)", 0, 0, 120, typeRole.body, {
      ...options,
      maxLines: 1,
      wrap: false,
    });
    expect(drawn.map((d) => d.text)).toEqual(["The Very Long Villain", "by PermaKarma"]);
    expect(drawn[1]!.x).toBeGreaterThan(drawn[0]!.x);
    expect(drawn[0]!.options.fitWidth).toBeLessThan(120);
  });
});
