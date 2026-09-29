/**
 * Wave 5 search primitives, on synthetic cards:
 *
 * - `CardSelector removedFromGame`: the removed-from-game area as a search pool ("search the encounter deck, discard
 *   pile, set-aside area, and removed-from-game area for …", Loose Ends, `sm` 27135).
 * - `TargetQuery.obligationOf`: "a copy of your obligation" (RRG 1.8 "Obligation", p. 30).
 * - `TargetQuery.nemesisSideSchemeOf`: "your nemesis side scheme" (RRG 1.8 "Nemesis Encounter Set", p. 30).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { createCtx, moveCard } from "./ctx.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustPlayer } from "./query.js";
import { selectCards } from "./resolve/cards.js";
import { matchesQuery, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { CardSelector, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubIdentity, stubMinion, stubObligation, stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, MAIN_SCHEME, settle, VILLAIN } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const deps = depsOf();
const context = (controllerId = p1): EffectContext => ({
  selfInstanceId: null,
  controllerId,
  event: null,
  bindings: {},
  deps,
});

const stats = { hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 } as const;
/** Has an obligation (two printed copies, like Slipping Sanity) and a nemesis set with a minion and a side scheme. */
const SOLO = stubIdentity({ id: "solo", ...stats });
const SOLO_OBLIGATION = { ...stubObligation({ id: "solo-obligation" }), quantityInSet: 2 };
const SOLO_MINION = stubMinion({ id: "solo-minion", atk: 1, sch: 1, hp: 3, encounterSetIds: ["solo-nemesis"] });
const SOLO_SCHEME = stubSideScheme({ id: "solo-scheme", startingThreat: 2, encounterSetIds: ["solo-nemesis"] });
/** Neither its obligation nor any card of its nemesis set is in the pool: nothing of its own is in the game. */
const BARE = stubIdentity({ id: "bare", ...stats });
/** Encounter cards that must never match: another set's side scheme, a plain treachery. */
const OTHER_SCHEME = stubSideScheme({ id: "other-scheme", startingThreat: 1, encounterSetIds: ["modular"] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

function table(): GameState {
  const result = createGame(
    {
      seed: 5,
      cards: [...DEFAULT_CARDS, SOLO, SOLO_OBLIGATION, SOLO_MINION, SOLO_SCHEME, BARE, OTHER_SCHEME, FILLER],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [OTHER_SCHEME.id, FILLER.id, FILLER.id],
      players: [
        { identityCardId: SOLO.id, deck: DEFAULT_DECK },
        { identityCardId: BARE.id, deck: DEFAULT_DECK },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return settle(result.state, undefined, deps);
}

const idsOf = (state: GameState, card: { readonly id: CardId }): InstanceId[] =>
  Object.values(state.instances)
    .filter((instance) => instance.cardId === card.id)
    .map((instance) => instance.instanceId)
    .sort();

/** Moves `ids` into the removed-from-game area, as the engine's own `moveCard` does. */
function removeFromGame(state: GameState, ids: readonly InstanceId[]): GameState {
  const ctx = createCtx(state, deps);
  for (const id of ids) moveCard(ctx, id, { kind: "removedFromGame" });
  return ctx.state;
}

const select = (state: GameState, selector: CardSelector, controllerId = p1) =>
  [...selectCards(createCtx(state, deps), selector, context(controllerId))].sort();

/** Loose Ends' four-area search, as one pool. */
const everywhere = (filter: TargetQuery): CardSelector => ({
  kind: "anyOf",
  of: [
    { kind: "encounter", zones: ["deck", "discard"], filter },
    { kind: "setAside", player: { kind: "controller" }, filter },
    { kind: "removedFromGame", filter },
  ],
});

describe("CardSelector removedFromGame", () => {
  it("is empty at the start of a game and names exactly the cards moved there, filter applied", () => {
    const start = table();
    expect(select(start, { kind: "removedFromGame" })).toEqual([]);

    const [firstFiller] = idsOf(start, FILLER);
    const [otherScheme] = idsOf(start, OTHER_SCHEME);
    const removed = removeFromGame(start, [firstFiller!, otherScheme!]);
    expect(removed.removedFromGame).toEqual([firstFiller, otherScheme]);
    expect(select(removed, { kind: "removedFromGame" })).toEqual([firstFiller, otherScheme].sort());
    expect(select(removed, { kind: "removedFromGame", filter: { categories: ["sideScheme"] } })).toEqual([otherScheme]);
  });
});

describe("TargetQuery.obligationOf", () => {
  it("matches every copy of that player's obligation, in the encounter deck after setup", () => {
    const start = table();
    const copies = idsOf(start, SOLO_OBLIGATION);
    expect(copies).toHaveLength(2);
    for (const id of copies) expect(activeEncounterDeck(start).deck).toContain(id);
    expect(
      select(start, { kind: "encounter", zones: ["deck"], filter: { obligationOf: { kind: "controller" } } }),
    ).toEqual(copies);
  });

  it("finds a copy in the removed-from-game area, and the four-area search names each copy once", () => {
    const start = table();
    const [removedCopy, deckCopy] = idsOf(start, SOLO_OBLIGATION);
    const removed = removeFromGame(start, [removedCopy!]);
    expect(select(removed, { kind: "removedFromGame", filter: { obligationOf: { kind: "controller" } } })).toEqual([
      removedCopy,
    ]);
    expect(select(removed, everywhere({ obligationOf: { kind: "controller" } }))).toEqual(
      [removedCopy, deckCopy].sort(),
    );
  });

  it("matches nothing else: not the nemesis cards, not other encounter cards, not the identity", () => {
    const start = table();
    const query: TargetQuery = { obligationOf: { kind: "controller" } };
    for (const card of [SOLO_MINION, SOLO_SCHEME, OTHER_SCHEME, FILLER]) {
      for (const id of idsOf(start, card)) expect(matchesQuery(start, id, query, context())).toBe(false);
    }
    expect(matchesQuery(start, mustPlayer(start, p1).identity.instanceId, query, context())).toBe(false);
  });

  it("a player whose obligation is not in the game matches nothing, anywhere", () => {
    const start = table();
    const removed = removeFromGame(start, idsOf(start, SOLO_OBLIGATION).slice(0, 1));
    expect(select(removed, everywhere({ obligationOf: { kind: "controller" } }), p2)).toEqual([]);
    for (const id of idsOf(removed, SOLO_OBLIGATION)) {
      expect(matchesQuery(removed, id, { obligationOf: { kind: "controller" } }, context(p2))).toBe(false);
    }
  });
});

describe("TargetQuery.nemesisSideSchemeOf", () => {
  it("matches the player's nemesis side scheme in their set-aside area, and nothing else in the game", () => {
    const start = table();
    const [scheme] = idsOf(start, SOLO_SCHEME);
    expect(mustPlayer(start, p1).setAside).toContain(scheme);
    const query: TargetQuery = { nemesisSideSchemeOf: { kind: "controller" } };
    expect(select(start, everywhere(query))).toEqual([scheme]);
    const everyOther = Object.keys(start.instances).filter((id) => id !== scheme) as InstanceId[];
    for (const id of everyOther) expect(matchesQuery(start, id, query, context())).toBe(false);
  });

  it("follows the card wherever it is: the encounter discard pile", () => {
    const start = table();
    const [scheme] = idsOf(start, SOLO_SCHEME);
    const ctx = createCtx(start, deps);
    moveCard(ctx, scheme!, { kind: "encounterDiscard", deckId: start.encounterDeckOrder[0]! });
    expect(select(ctx.state, everywhere({ nemesisSideSchemeOf: { kind: "controller" } }))).toEqual([scheme]);
  });

  it("a player with no nemesis side scheme in the game matches nothing, anywhere", () => {
    const start = table();
    const query: TargetQuery = { nemesisSideSchemeOf: { kind: "controller" } };
    expect(select(start, everywhere(query), p2)).toEqual([]);
    for (const id of Object.keys(start.instances) as InstanceId[]) {
      expect(matchesQuery(start, id, query, context(p2))).toBe(false);
    }
  });
});
