/**
 * docs/phase7-wave11-hero-packs.md H3.21 (engine task HT15): "If the discarded card has a 'Boost' ability" (Sidewinder
 * 62033) as a printed fact (`TargetQuery.printsBoostAbility`, `query.ts printsBoostAbility`). Synthetic encounter cards
 * in the encounter deck and discard pile: a starred card with a scripted Boost, a starred card whose Boost is not
 * scripted, a starred card whose Boost another card grants (`boostGrantedBy`), boost pips only, and nothing.
 *
 * Sources: RRG 1.8 "Boost, Boost Icon" (p. 11: "If the boost field has a star icon, it indicates that the card has a
 * 'Boost' ability … A star icon is not itself considered a boost icon"), "Printed" (p. 35). Purple Man 60097: "Each
 * boost card from the Purple Man encounter set gains: '[star] Boost: …'" (a grant to boost cards, not printed text).
 * No FFG ruling names the reading; "printed only" is the engine's (rules authority level 5).
 */

import { PLAYABLE_CARDS, cardId, type AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { hasStarIcon, printsBoostAbility } from "./query.js";
import { explainQuery } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubTreachery } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const boost = stubAbility("scripted.boost", { trigger: { kind: "boost" }, effects: [] } as never);
const SCRIPTED = stubTreachery({ id: "scripted", boostIcons: 1, starIcon: true, abilities: [boost.ref as never] });
/** The data prints a star and a Boost; no script is registered for it. */
const UNSCRIPTED = stubTreachery({
  id: "unscripted",
  boostIcons: 0,
  starIcon: true,
  abilities: [{ id: "unscripted.boost" } as never],
});
/** Purple Man's set: the star stands for a Boost the villain's stages grant. */
const GRANTED: AnyCard = {
  ...stubTreachery({ id: "granted", boostIcons: 3, starIcon: true }),
  boostGrantedBy: [cardId("pm")],
};
const PIPS = stubTreachery({ id: "pips", boostIcons: 2 });
const PLAIN = stubTreachery({ id: "plain", boostIcons: 0 });
const ENCOUNTER: readonly AnyCard[] = [SCRIPTED, UNSCRIPTED, GRANTED, PIPS, PLAIN];

const deps: EngineDeps = depsOf(boost);
const HAS_BOOST: TargetQuery = { printsBoostAbility: true };
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };

function start(): GameState {
  return gameAtFirstTurn({ cards: [...ENCOUNTER], deps, encounter: ENCOUNTER.map((card) => card.id) });
}
const idOf = (state: GameState, name: string): InstanceId =>
  Object.values(state.instances).find((instance) => (instance.cardId as string) === name)!.instanceId;
/** Surgery: the card goes from the encounter deck to the encounter discard pile, as a discard from the top would. */
function discarded(state: GameState, id: InstanceId): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const piles = state.encounterDecks[deckId as never]!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== id), discard: [...piles.discard, id] },
    },
  };
}

describe("H3.21 `TargetQuery.printsBoostAbility`", () => {
  it("matches a card that prints a Boost, scripted or not, in the encounter discard pile", () => {
    let state = start();
    for (const name of ["scripted", "unscripted", "granted", "pips", "plain"])
      state = discarded(state, idOf(state, name));
    expect(explainQuery(state, idOf(state, "scripted"), HAS_BOOST, context)).toBeNull();
    // What has been scripted does not change what a card prints (the reason `hasStarIcon` reads data too).
    expect(explainQuery(state, idOf(state, "unscripted"), HAS_BOOST, context)).toBeNull();
  });

  it("a star whose Boost another card grants is not a printed Boost; the star itself is still read by `starIcon`", () => {
    const state = discarded(start(), idOf(start(), "granted"));
    const granted = idOf(state, "granted");
    expect(explainQuery(state, granted, HAS_BOOST, context)).toBe("noSuchAbility");
    expect(printsBoostAbility(state, granted)).toBe(false);
    expect(hasStarIcon(state, granted)).toBe(true);
    expect(explainQuery(state, granted, { starIcon: true }, context)).toBeNull();
  });

  it("control: boost pips are not a Boost ability (RRG p. 11), nor is a card with none", () => {
    const state = start();
    expect(explainQuery(state, idOf(state, "pips"), HAS_BOOST, context)).toBe("noSuchAbility");
    expect(explainQuery(state, idOf(state, "plain"), HAS_BOOST, context)).toBe("noSuchAbility");
    // Without the field every card matches.
    for (const name of ["pips", "plain", "granted"])
      expect(explainQuery(state, idOf(state, name), {}, context)).toBeNull();
  });

  it("is read wherever the card is: a copy still in the encounter deck matches too", () => {
    const state = start();
    expect(explainQuery(state, idOf(state, "scripted"), HAS_BOOST, context)).toBeNull();
  });

  it("the real data: Cottonmouth 62029 prints a Boost; Purple Man's set cards (granted by 60097) do not", () => {
    const card = (id: string) => PLAYABLE_CARDS.find((c) => (c.id as string) === id)!;
    const state = gameAtFirstTurn({
      cards: [card("62029"), card("62033")],
      deps,
      encounter: ["62029", "62033"] as never,
    });
    expect(printsBoostAbility(state, idOf(state, "62029"))).toBe(true);
    // Sidewinder prints no star: her own text reads other cards.
    expect(printsBoostAbility(state, idOf(state, "62033"))).toBe(false);
    const purpleSet = PLAYABLE_CARDS.filter((c) => "boostGrantedBy" in c && (c.boostGrantedBy ?? []).length > 0);
    expect(purpleSet.length).toBeGreaterThan(0);
    const withPurple = gameAtFirstTurn({ cards: purpleSet, deps, encounter: purpleSet.map((c) => c.id) });
    for (const c of purpleSet) expect(printsBoostAbility(withPurple, idOf(withPurple, c.id)), c.id).toBe(false);
  });
});
