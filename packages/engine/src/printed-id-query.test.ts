/**
 * `TargetQuery.printedId`, for the rare case two cards share a printed name (docs/phase7-wave3.md §1.4: MC16's
 * Campaign Challenge side schemes print the same title on both faces, e.g. 16178a/16178b "Badoon Blitz") and a
 * script needs one specific card rather than "a card named X". Written while closing what `@mc/cards`'
 * `campaigns/gmw.ts` needed to reveal the mode-correct face of each Campaign Challenge side scheme.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_DEPS } from "./abilities.js";
import { getInstance } from "./query.js";
import { matchesQuery, type EffectContext } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import { stubSideScheme } from "./testing/fixtures.js";
import { DEFAULT_CARDS, HERO, MAIN_SCHEME, VILLAIN } from "./testing/scenario.js";

describe("TargetQuery.printedId", () => {
  it("picks the exact card by id when its name alone is ambiguous", () => {
    const blitzA = { ...stubSideScheme({ id: "blitz-a", startingThreat: 2 }), name: "Badoon Blitz" };
    const blitzB = { ...stubSideScheme({ id: "blitz-b", startingThreat: 3 }), name: "Badoon Blitz" };
    const config: GameSetupConfig = {
      seed: 1,
      cards: [...DEFAULT_CARDS, blitzA, blitzB],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [],
      players: [{ identityCardId: HERO.id, deck: [] }],
      setAside: [blitzA.id, blitzB.id],
    };
    const created = createGame(config, DEFAULT_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const [firstPlayer] = created.state.players;
    if (!firstPlayer) throw new Error("no player seated");
    const context: EffectContext = {
      selfInstanceId: null,
      controllerId: firstPlayer.playerId,
      event: null,
      bindings: {},
      deps: DEFAULT_DEPS,
      scopedPlayerId: firstPlayer.playerId,
    };
    const [instanceA, instanceB] = created.state.encounterSetAside;
    if (!instanceA || !instanceB) throw new Error("both side schemes should be set aside");

    // Both match the shared name; only `printedId` tells them apart.
    expect(matchesQuery(created.state, instanceA, { name: "Badoon Blitz" }, context)).toBe(true);
    expect(matchesQuery(created.state, instanceB, { name: "Badoon Blitz" }, context)).toBe(true);
    expect(matchesQuery(created.state, instanceA, { printedId: blitzA.id }, context)).toBe(true);
    expect(matchesQuery(created.state, instanceB, { printedId: blitzA.id }, context)).toBe(false);
    expect(matchesQuery(created.state, instanceB, { printedId: blitzB.id }, context)).toBe(true);
    expect(getInstance(created.state, instanceA)?.cardId).toBe(blitzA.id);
  });
});
