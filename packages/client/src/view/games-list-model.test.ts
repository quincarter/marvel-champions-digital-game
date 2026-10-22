import { describe, expect, test } from "vitest";
import type { SaveMeta } from "../engine/game-storage.js";
import {
  GAME_ROW_HEIGHT,
  gameRowParts,
  gameRowRects,
  gameRowsOf,
  relativeTimeOf,
  removeConfirmParts,
  shouldShowGamesList,
  type GamesListNames,
} from "./games-list-model.js";
import { rectsOverlap } from "./layout.js";
import { hit } from "../tokens.js";

const NOW = new Date(2026, 9, 22, 15, 30).getTime();
const at = (y: number, mo: number, d: number, h = 12, mi = 0): number => new Date(y, mo, d, h, mi).getTime();

describe("relativeTimeOf", () => {
  test("reads minutes, hours, yesterday, days and weeks", () => {
    expect(relativeTimeOf(NOW - 20_000, NOW)).toBe("just now");
    expect(relativeTimeOf(NOW - 5 * 60_000, NOW)).toBe("5 min ago");
    expect(relativeTimeOf(at(2026, 9, 22, 12, 30), NOW)).toBe("3 h ago");
    expect(relativeTimeOf(at(2026, 9, 21, 23, 0), NOW)).toBe("yesterday");
    expect(relativeTimeOf(at(2026, 9, 21, 9, 0), NOW)).toBe("yesterday");
    expect(relativeTimeOf(at(2026, 9, 19, 9, 0), NOW)).toBe("3 days ago");
    expect(relativeTimeOf(at(2026, 9, 8, 9, 0), NOW)).toBe("2 wk ago");
  });

  test("an old game reads as a date, a clock set back reads as just now", () => {
    expect(relativeTimeOf(at(2026, 5, 1), NOW)).toMatch(/2026/);
    expect(relativeTimeOf(NOW + 5 * 60_000, NOW)).toBe("just now");
  });
});

const NAMES: GamesListNames = {
  scenarioName: (id) => (id === "rhino" ? "Rhino" : undefined),
  identityName: (id) => (id === "spider-man" ? "Spider-Man" : undefined),
  starterDeckName: () => undefined,
  campaignName: (id) => (id === "trors" ? "The Rise of Red Skull" : undefined),
};

const save = (id: string, updatedAt: number, extra: Partial<SaveMeta> = {}): SaveMeta => ({
  id,
  schema: 4,
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ identityCardId: "spider-man", cards: [] }],
    seed: 1,
  } as never,
  createdAt: 1,
  updatedAt,
  status: "active",
  round: 4,
  commandCount: 9,
  outcome: null,
  campaignId: null,
  campaignNodeId: null,
  ...extra,
});

describe("gameRowsOf", () => {
  test("newest first, titled by the game, with round and last played; campaign games say so", () => {
    const rows = gameRowsOf(
      [
        save("old", NOW - 86_400_000 * 2),
        save("new", NOW - 3600_000),
        save("c", NOW - 7200_000, { campaignId: "trors" }),
      ],
      NAMES,
      NOW,
    );
    expect(rows.map((row) => row.id)).toEqual(["new", "c", "old"]);
    expect(rows[0]).toMatchObject({ title: "Rhino · Spider-Man", kicker: null, detail: "Round 4 · 1 h ago" });
    expect(rows[1]!.kicker).toBe("Campaign: The Rise of Red Skull");
  });

  test("an unknown campaign box falls back to its id, not to nothing", () => {
    const [row] = gameRowsOf([save("x", NOW, { campaignId: "mystery" })], NAMES, NOW);
    expect(row!.kicker).toBe("Campaign: mystery");
  });

  test("the list is offered whenever a game is in progress that Continue does not offer", () => {
    expect(shouldShowGamesList([], null)).toBe(false);
    // Continue is that one game.
    expect(shouldShowGamesList(["a"], "a")).toBe(false);
    // Continue is a tutorial (not a listed game) and Rhino is in progress: Rhino must stay reachable.
    expect(shouldShowGamesList(["rhino"], "tutorial")).toBe(true);
    expect(shouldShowGamesList(["rhino"], null)).toBe(true);
    expect(shouldShowGamesList(["a", "b"], "a")).toBe(true);
  });
});

describe("geometry", () => {
  const viewport = { x: 20, y: 100, width: 480, height: 300 };

  test("rows stack with a gap; the content height is the rows plus the gaps between them", () => {
    const { rows, height } = gameRowRects(viewport, 3);
    expect(rows).toHaveLength(3);
    expect(rows[1]!.y).toBeGreaterThan(rows[0]!.y + rows[0]!.height);
    expect(height).toBe(3 * GAME_ROW_HEIGHT + 2 * 8);
    expect(gameRowRects(viewport, 0).height).toBe(0);
  });

  test("a row's text, Resume and Remove sit inside it, apart, at touch size with a clear gap", () => {
    for (const width of [300, 340, 480]) {
      const [row] = gameRowRects({ ...viewport, width }, 1).rows;
      const parts = gameRowParts(row!);
      expect(parts.resume.height).toBeGreaterThanOrEqual(hit.primary);
      expect(parts.remove.height).toBeGreaterThanOrEqual(hit.target);
      // Resume is the main action: wider and taller than Remove.
      expect(parts.resume.width).toBeGreaterThan(parts.remove.width);
      expect(parts.resume.height).toBeGreaterThan(parts.remove.height);
      expect(parts.remove.x - (parts.resume.x + parts.resume.width)).toBeGreaterThanOrEqual(12);
      expect(parts.text.width).toBeGreaterThan(100);
      const rects = [parts.text, parts.resume, parts.remove];
      for (const [i, a] of rects.entries()) {
        for (const b of rects.slice(i + 1)) expect(rectsOverlap(a, b)).toBe(false);
      }
      for (const part of rects) {
        expect(part.x).toBeGreaterThanOrEqual(row!.x);
        expect(part.x + part.width).toBeLessThanOrEqual(row!.x + row!.width);
        expect(part.y).toBeGreaterThanOrEqual(row!.y);
        expect(part.y + part.height).toBeLessThanOrEqual(row!.y + row!.height);
      }
    }
  });

  test("the confirm's buttons sit side by side under the words", () => {
    const parts = removeConfirmParts({ x: 0, y: 0, width: 300, height: 200 });
    expect(rectsOverlap(parts.keep, parts.remove)).toBe(false);
    expect(rectsOverlap(parts.message, parts.keep)).toBe(false);
    expect(rectsOverlap(parts.message, parts.remove)).toBe(false);
    expect(parts.keep.height).toBeGreaterThanOrEqual(hit.target);
  });
});
