/**
 * `CardDestination "encounterSetAside"` (this pass, Escape the Museum's `gmw` 16082a: "Set aside the Ship Command
 * modular encounter set"): `moveCards` could already *read* the shared set-aside pile (`CardSelector
 * encounterSetAside`, used by a signature side scheme's own scenario setup) but had no way to *send* cards there —
 * every printed card before this needed the reverse direction only. Minimal, generic addition (no card name):
 * `spec.ts`'s `CardDestination` gains the literal, `resolve/cards.ts`'s `moveCardsTo` maps it to `ZoneId
 * { kind: "encounterSetAside" }`, the same zone `leavePlay`'s existing "keeps the card" double-sided carve-out
 * already names.
 *
 * Sources: RRG 1.8 "Set Aside" (p. 39).
 */
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubMainScheme, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, HERO, settle, VILLAIN } from "./testing/scenario.js";

/** Two cards of a shared modular set, one an unrelated card left in the deck. */
const SET_A = stubTreachery({ id: "set-a", encounterSetIds: ["modular"] });
const SET_B = stubTreachery({ id: "set-b", encounterSetIds: ["modular"] });
const OTHER = stubTreachery({ id: "other" });

const SETUP = stubAbility("set-aside.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "ref", cards: { kind: "encounter", zones: ["deck"], filter: { name: SET_A.name } } },
    {
      kind: "moveCards",
      cards: { kind: "encounter", zones: ["deck"], filter: { encounterSetOf: { kind: "slot", slot: "ref" } } },
      to: "encounterSetAside",
    },
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
      cards: [...DEFAULT_CARDS, SCHEME, SET_A, SET_B, OTHER],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [SET_A.id, SET_B.id, ...Array.from({ length: 10 }, () => OTHER.id)],
      players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return settle(result.state, defaultPick, deps);
}

describe("moveCards can send cards to the shared encounterSetAside pile", () => {
  it("moves every card sharing an encounter set with the reference, leaving unrelated cards in the deck", () => {
    const state = game();
    const inSetAside = state.encounterSetAside.map((id) => mustInstance(state, id).cardId);
    expect(inSetAside.sort()).toEqual([SET_A.id, SET_B.id].sort());
    const deckIds = Object.values(state.encounterDecks).flatMap((d) =>
      d.deck.map((id) => mustInstance(state, id).cardId),
    );
    expect(deckIds).not.toContain(SET_A.id);
    expect(deckIds).not.toContain(SET_B.id);
    expect(deckIds.filter((id) => id === OTHER.id).length).toBe(10);
  });
});
