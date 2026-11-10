import { PLAYABLE_CARDS } from "@mc/content";
import { PLAYABLE_DEPS } from "@mc/cards";
import { describe, expect, it } from "vitest";
import { cardPoolWithPack, gameDepsWithPack } from "./game.js";
import { tinyPack } from "./fixtures/load.js";

describe("gameDepsWithPack / cardPoolWithPack", () => {
  it("adds a pack's abilities and cards to the base ones", async () => {
    const pack = await tinyPack();
    const deps = gameDepsWithPack(PLAYABLE_DEPS, pack);
    expect(deps.abilities["x.tiny-pack.02.test-rally-action"]).toBeDefined();
    expect(deps.abilities["01005.swinging-web-kick-action"]).toBeDefined();
    const pool = cardPoolWithPack(PLAYABLE_CARDS, pack);
    expect(pool.length).toBe(PLAYABLE_CARDS.length + pack.cards.length);
  });

  it("refuses an ability or card the base game already has", async () => {
    const pack = await tinyPack();
    const shadow = {
      abilities: { "01005.swinging-web-kick-action": pack.abilities["x.tiny-pack.02.test-rally-action"]! },
    };
    expect(() => gameDepsWithPack(PLAYABLE_DEPS, shadow)).toThrow(/already defined/);
    const once = cardPoolWithPack(PLAYABLE_CARDS, pack);
    expect(() => cardPoolWithPack(once, pack)).toThrow(/already in the pool/);
  });
});
