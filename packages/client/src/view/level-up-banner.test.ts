import { describe, expect, test } from "vitest";
import { cardId } from "@mc/content";
import type { GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { CARDS_BY_ID } from "../content/pool.js";
import { levelUpCaptions } from "./level-up-banner.js";

const state = { cardPool: Object.fromEntries(CARDS_BY_ID) } as unknown as GameState;
const swapped = (from: string, to: string): GameEvent => ({
  type: "identitySwapped",
  playerId: "p1" as PlayerId,
  instanceId: "i1" as InstanceId,
  fromCardId: cardId(from),
  toCardId: cardId(to),
});

describe("the level-up band", () => {
  test("Ironheart's Level Up! names her and the version she became, out of three", () => {
    expect(levelUpCaptions([swapped("29001a", "29002a")], state)).toEqual(["IRONHEART LEVELS UP! · VERSION 2 OF 3"]);
    expect(levelUpCaptions([swapped("29002a", "29003a")], state)).toEqual(["IRONHEART LEVELS UP! · VERSION 3 OF 3"]);
  });

  test("a command with no swap announces nothing", () => {
    expect(levelUpCaptions([], state)).toEqual([]);
  });
});
