/**
 * `enterPlayOnReveal`'s "an ownerless card enters where its type goes" switch (`packages/engine/src/resolve/
 * reveal.ts`) had no `"support"` case: `putIntoPlay` on a scenario-specific, ownerless support card
 * (`GameSetupConfig.setAside`, RRG 1.8 "Set Aside", p. 39) silently did nothing — the instance stayed exactly
 * where it was, in no player's play area, `entered` never set. Found scripting the Milano (`gmw` 16142,
 * "Permanent. Setup."): a `specificTo: { kind: "scenario" }` support no player's deck ever holds, entering play
 * only through its scenario's own 1A `Setup:` ability. Fixed generically — any ownerless support, not just the
 * Milano (no card name in the engine) — by giving `"support"` the same "moves to a play area, `entered = true`"
 * treatment `"obligation"` already had, plus setting `controllerId` (an obligation has none; a support ordinarily
 * does).
 *
 * Sources: RRG 1.8 "Set Aside" (p. 39); "Scenario-Specific Card" (p. 38, "specific to a certain scenario … it
 * cannot be added to that player's deck outside of the scenario").
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { playerId } from "./ids.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubMainScheme, stubSupport } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, HERO, settle, TREACHERY, VILLAIN } from "./testing/scenario.js";

const p1 = playerId("p1");

const SUPPORT = { ...stubSupport({ id: "fixture-support", cost: 0 }), name: "Fixture Support" };

const SETUP = stubAbility("scenario-support.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "found", cards: { kind: "encounterSetAside", filter: { name: "Fixture Support" } } },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "firstPlayer" } },
  ],
});
const SCHEME = stubMainScheme({
  id: "athena",
  stages: [
    {
      startingThreat: { base: 0, perPlayer: 0 },
      targetThreat: { base: 99, perPlayer: 0 },
      acceleration: { base: 0, perPlayer: 0 },
      aSideAbilities: [SETUP.ref],
    },
  ],
});

const deps: EngineDeps = depsOf(SETUP);

function game(): GameState {
  const result = createGame(
    {
      seed: 5,
      cards: [...DEFAULT_CARDS, SCHEME, SUPPORT],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: Array.from({ length: 10 }, () => TREACHERY.id),
      setAside: [SUPPORT.id],
      players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return settle(result.state, defaultPick, deps);
}

describe("a scenario-specific, ownerless support card can enter play via its scenario's Setup ability", () => {
  it("moves to the first player's play area and is controlled by them, not left set aside", () => {
    const state = game();
    const id = state.players[0]!.playArea.find((cardId) => mustInstance(state, cardId).cardId === SUPPORT.id);
    expect(id).toBeDefined();
    expect(mustInstance(state, id!).controllerId).toBe(p1);
    expect(mustInstance(state, id!).faceup).toBe(true);
    expect(state.encounterSetAside).not.toContain(id);
  });
});
