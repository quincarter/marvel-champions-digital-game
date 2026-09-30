/**
 * `TargetQuery.scenarioSpecific`, on synthetic cards: "a scenario-specific side scheme" (Sinister Motives reputation
 * node 17, MC27 p. 22). RRG 1.8 "Scenario-Specific Card" (p. 39): a card of the scenario's own set of accompanying
 * cards, read off the encounter sets of the main scheme the game was set up with — never a modular, nemesis or
 * unaffiliated card, even when it is in the same encounter deck.
 */

import { encounterSetId, flat, type MainSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import { createCtx, moveCard } from "./ctx.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { selectCards } from "./resolve/cards.js";
import { explainQuery, matchesQuery, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { CardSelector, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubIdentity, stubMainScheme, stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, MAIN_SCHEME, settle, VILLAIN } from "./testing/scenario.js";

const p1 = playerId("p1");
const deps = depsOf();
const context: EffectContext = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };

const stats = { hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 } as const;
/** The scenario's own main scheme, in the scenario's own set. */
const OWN_MAIN_SCHEME: MainSchemeCard = {
  ...stubMainScheme({
    id: "own-main-scheme",
    stages: [{ startingThreat: flat(0), targetThreat: flat(20), acceleration: flat(1) }],
  }),
  encounterSetIds: [encounterSetId("scenario")],
};
const OWN_SCHEME = stubSideScheme({ id: "own-scheme", startingThreat: 2, encounterSetIds: ["scenario"] });
const OWN_TREACHERY = stubTreachery({ id: "own-treachery", boostIcons: 1, encounterSetIds: ["scenario"] });
/** In the same encounter deck, but not scenario-specific. */
const MODULAR_SCHEME = stubSideScheme({ id: "modular-scheme", startingThreat: 1, encounterSetIds: ["modular"] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
/** Has a nemesis set with a side scheme: an encounter card set aside at setup, and not scenario-specific either. */
const SOLO = stubIdentity({ id: "solo", ...stats });
const NEMESIS_SCHEME = stubSideScheme({ id: "solo-scheme", startingThreat: 2, encounterSetIds: ["solo-nemesis"] });

function table(mainScheme: MainSchemeCard = OWN_MAIN_SCHEME): GameState {
  const result = createGame(
    {
      seed: 5,
      cards: [
        ...DEFAULT_CARDS,
        OWN_MAIN_SCHEME,
        OWN_SCHEME,
        OWN_TREACHERY,
        MODULAR_SCHEME,
        FILLER,
        SOLO,
        NEMESIS_SCHEME,
      ],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: mainScheme.id,
      encounterDeck: [OWN_SCHEME.id, OWN_SCHEME.id, OWN_TREACHERY.id, MODULAR_SCHEME.id, FILLER.id],
      players: [{ identityCardId: SOLO.id, deck: DEFAULT_DECK }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return settle(result.state, undefined, deps);
}

const idsOf = (state: GameState, id: string): InstanceId[] =>
  Object.values(state.instances)
    .filter((instance) => (instance.cardId as string) === id)
    .map((instance) => instance.instanceId)
    .sort();

const select = (state: GameState, selector: CardSelector) =>
  [...selectCards(createCtx(state, deps), selector, context)].sort();

const deckAndDiscard = (filter: TargetQuery): CardSelector => ({
  kind: "encounter",
  zones: ["deck", "discard"],
  filter,
});

const SCENARIO_SIDE_SCHEME: TargetQuery = { categories: ["sideScheme"], scenarioSpecific: true };

describe("TargetQuery.scenarioSpecific", () => {
  it("a scenario-specific side scheme is the scenario's own, never the modular one in the same deck", () => {
    const start = table();
    const own = idsOf(start, OWN_SCHEME.id);
    expect(own).toHaveLength(2);
    expect(select(start, deckAndDiscard(SCENARIO_SIDE_SCHEME))).toEqual(own);
    for (const id of idsOf(start, MODULAR_SCHEME.id)) {
      expect(matchesQuery(start, id, SCENARIO_SIDE_SCHEME, context)).toBe(false);
      expect(explainQuery(start, id, SCENARIO_SIDE_SCHEME, context)).toBe("wrongEncounterSet");
    }
  });

  it("covers every card of the scenario's own set (the main scheme included), and nothing else in the game", () => {
    const start = table();
    const own = [
      ...idsOf(start, OWN_SCHEME.id),
      ...idsOf(start, OWN_TREACHERY.id),
      ...idsOf(start, OWN_MAIN_SCHEME.id),
    ].sort();
    expect(own).toHaveLength(4);
    const matched = (Object.keys(start.instances) as InstanceId[])
      .filter((id) => matchesQuery(start, id, { scenarioSpecific: true }, context))
      .sort();
    expect(matched).toEqual(own);
    // The nemesis side scheme (set aside), the identity and the player's cards are not scenario-specific.
    const [nemesis] = idsOf(start, NEMESIS_SCHEME.id);
    expect(mustPlayer(start, p1).setAside).toContain(nemesis);
    expect(matchesQuery(start, nemesis!, { scenarioSpecific: true }, context)).toBe(false);
    expect(matchesQuery(start, mustPlayer(start, p1).identity.instanceId, { scenarioSpecific: true }, context)).toBe(
      false,
    );
  });

  it("false is the complement: the modular side scheme and the unaffiliated treachery", () => {
    const start = table();
    expect(select(start, deckAndDiscard({ scenarioSpecific: false }))).toEqual(
      [...idsOf(start, MODULAR_SCHEME.id), ...idsOf(start, FILLER.id)].sort(),
    );
  });

  it("follows the card wherever it is: the encounter discard pile", () => {
    const start = table();
    const [first, second] = idsOf(start, OWN_SCHEME.id);
    const ctx = createCtx(start, deps);
    moveCard(ctx, first!, { kind: "encounterDiscard", deckId: start.encounterDeckOrder[0]! });
    expect(ctx.state.encounterDecks[start.encounterDeckOrder[0]!]?.discard).toContain(first);
    expect(select(ctx.state, deckAndDiscard(SCENARIO_SIDE_SCHEME))).toEqual([first, second].sort());
  });

  it("a main scheme in no encounter set makes nothing scenario-specific", () => {
    const start = table(MAIN_SCHEME);
    expect(select(start, deckAndDiscard({ scenarioSpecific: true }))).toEqual([]);
  });
});
