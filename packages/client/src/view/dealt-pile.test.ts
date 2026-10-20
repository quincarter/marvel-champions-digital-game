import { describe, expect, test } from "vitest";
import type { GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { appendCardHistory, emptyCardHistoryLog } from "./card-history.js";
import {
  dealtCaption,
  dealtChipText,
  dealtPileParts,
  dealtReasonWords,
  dealtReasonsOf,
  dealtWords,
} from "./dealt-pile.js";
import type { Rect } from "./layout.js";

const id = (value: string): InstanceId => value as InstanceId;
const p1 = "p1" as PlayerId;
const dealt = (
  instanceId: string,
  source: Extract<GameEvent, { type: "encounterCardDealt" }>["source"],
): GameEvent => ({
  type: "encounterCardDealt",
  playerId: p1,
  instanceId: id(instanceId),
  source,
});
// No instance: `cardName` answers "something", which is enough to see the ability is named at all.
const STATE = { instances: {} } as unknown as GameState;

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe("dealtPileParts", () => {
  test("on a wide identity panel the pile sits in the art column's right edge, inside the panel", () => {
    for (const panel of [
      { x: 8, y: 400, width: 300, height: 300 },
      { x: 8, y: 80, width: 360, height: 280 },
      { x: 8, y: 80, width: 200, height: 150 },
    ]) {
      const parts = dealtPileParts(panel, "wide")!;
      expect(parts).not.toBeNull();
      expect(inside(parts.rect, panel)).toBe(true);
      expect(inside(parts.front, parts.rect)).toBe(true);
      expect(inside(parts.chip, parts.rect)).toBe(true);
      // The text column starts right of the art: the pile stays left of where the name is.
      expect(parts.rect.x + parts.rect.width).toBeLessThan(panel.x + panel.width - 100);
    }
  });

  test("the compact row's pile is on its thumbnail", () => {
    const row = { x: 8, y: 300, width: 300, height: 80 };
    const parts = dealtPileParts(row, "compact")!;
    expect(parts.rect.x + parts.rect.width).toBeLessThan(row.x + 6 + 60);
    expect(parts.rect.y).toBeGreaterThanOrEqual(row.y);
  });

  test("a team row's pile sits on its name line, left of the first player token", () => {
    const row = { x: 1000, y: 100, width: 240, height: 60 };
    const parts = dealtPileParts(row, "seat")!;
    expect(inside(parts.rect, row)).toBe(true);
    expect(parts.rect.x + parts.rect.width).toBeLessThanOrEqual(row.x + row.width - 40);
    expect(parts.rect.y).toBeLessThan(row.y + 22);
  });

  test("a one-line or narrow team row has no pile and says it in words", () => {
    expect(dealtPileParts({ x: 0, y: 0, width: 240, height: 18 }, "seat", true)).toBeNull();
    expect(dealtPileParts({ x: 0, y: 0, width: 120, height: 60 }, "seat")).toBeNull();
    expect(dealtWords(2)).toBe("FACEDOWN \u00d72");
  });
});

describe("dealtChipText", () => {
  test("only several cards wear a count", () => {
    expect(dealtChipText(1)).toBeNull();
    expect(dealtChipText(3)).toBe("\u00d73");
  });
});

describe("the reason a card was dealt", () => {
  test("each source has its own words", () => {
    expect(dealtReasonWords("villainPhase", null)).toBe("villain phase deal");
    expect(dealtReasonWords("hazard", null)).toBe("Hazard");
    expect(dealtReasonWords("deckReset", null)).toBe("your deck ran out");
    expect(dealtReasonWords("surge", null)).toBe("Surge");
    expect(dealtReasonWords("uniqueRule", null)).toBe("unique rule");
    expect(dealtReasonWords("ability", null)).toBe("a card effect");
    expect(dealtReasonWords("ability", "Hypnotic Gaze")).toBe("Hypnotic Gaze");
  });

  test("reads the reasons for the cards still facedown off the history, once each, in order", () => {
    let log = emptyCardHistoryLog();
    log = appendCardHistory(log, [dealt("a", "villainPhase"), dealt("b", "villainPhase"), dealt("gone", "surge")]);
    log = appendCardHistory(log, [dealt("c", "hazard")]);
    expect(dealtReasonsOf(log, [id("a"), id("b"), id("c")], STATE)).toEqual(["villain phase deal", "Hazard"]);
  });

  test("an ability deal is named by the card that dealt it when its batch says which", () => {
    const log = appendCardHistory(emptyCardHistoryLog(), [
      { type: "abilityResolved", instanceId: id("source") } as unknown as GameEvent,
      dealt("a", "ability"),
    ]);
    expect(dealtReasonsOf(log, [id("a")], STATE)).toEqual(["something"]);
    const bare = appendCardHistory(emptyCardHistoryLog(), [dealt("a", "ability")]);
    expect(dealtReasonsOf(bare, [id("a")], STATE)).toEqual(["a card effect"]);
  });

  test("a resumed game with no history shows no reason", () => {
    expect(dealtReasonsOf(emptyCardHistoryLog(), [id("a")], STATE)).toEqual([]);
  });
});

describe("dealtCaption", () => {
  test("says what it is, why, and when it flips; never which card it is", () => {
    expect(dealtCaption(1, [])).toBe("Facedown encounter card \u00b7 revealed in the villain phase");
    expect(dealtCaption(2, ["Hazard"])).toBe(
      "2 facedown encounter cards \u00b7 Hazard \u00b7 revealed in the villain phase",
    );
  });
});
