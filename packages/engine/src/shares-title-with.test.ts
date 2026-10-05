/**
 * docs/phase7-wave7.md §3.8: "shares a title with" as a query, `TargetQuery.sharesTitleWith: TargetRef`, and the
 * general negation it is used under, `TargetQuery.not` ("the minion that shares a title with the villain", "a minion
 * that does not share a title with a card in play", "a villain that does not share a title with a card under this").
 *
 * Titles are compared by the uniqueness rule's own comparison (`titles.ts` `sameTitle`, which `unique.ts` `cardsMatch`
 * uses): the title only, never the subtitle (RRG 1.8 "Subtitle", p. 41), a parenthetical being part of the title
 * (ruling January 26, 2026 (4) answer 6) and an identity having only the title of the side that is up (RRG 1.8
 * "Identity", p. 23; the same ruling's answer 7). Each card contributes the title it is showing; a facedown card
 * contributes none; a card shares a title with itself.
 *
 * Synthetic cards only; the engine never names a card.
 */

import { flat, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { explainQuery, matchesQuery, selectTargets, type EffectContext } from "./select.js";
import type { CardSelector, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAlly, stubEnvironment, stubEvent, stubMinion, stubVillain } from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, minionEngagedWith, P1 } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const titled = <C extends AnyCard>(card: C, name: string, subtitle?: string): C => ({
  ...card,
  name,
  ...(subtitle === undefined ? {} : { subtitle }),
});
const minion = (id: string, name: string, subtitle?: string) =>
  titled(stubMinion({ id, atk: 0, sch: 0, hp: 3 }), name, subtitle);
const villain = (id: string, name: string) => stubVillain({ id, name, stages: [{ hp: flat(20), atk: 0, sch: 0 }] });

/** The villain in play: "Arc" on side A, "Arc Unbound" on side B. */
const ARC = stubVillain({
  id: "arc-v",
  name: "Arc",
  stages: [{ hp: flat(20), atk: 0, sch: 0 }],
  back: { name: "Arc Unbound", stages: [{ hp: flat(20), atk: 0, sch: 0 }] },
});
// Villains waiting set aside, as in a scenario whose villains are also printed as minions.
const BRUTE_V = villain("brute-v", "Brute");
const CINDER_V = villain("cinder-v", "Cinder (The Scorcher)");
const DRIFT_V = villain("drift-v", "Drift");
const SET_ASIDE = [BRUTE_V, CINDER_V, DRIFT_V];

const ARC_M = minion("arc-m", "Arc");
const UNBOUND_M = minion("unbound-m", "Arc Unbound");
const BRUTE_M = minion("brute-m", "Brute");
const CINDER_M = minion("cinder-m", "Cinder (The Scorcher)");
/** A different parenthetical: a different title. */
const KINDLER_M = minion("kindler-m", "Cinder (The Kindler)");
const DRIFT_M = minion("drift-m", "Drift");
/** The villain's title with a subtitle of its own: still the same title. */
const ARC_SUB_M = minion("arc-sub-m", "Arc", "The Spark");
/** The villain's title printed only as a subtitle: a different title. */
const ALIAS_M = minion("alias-m", "Spark", "Arc");
const HIDEOUT_M = minion("hideout-m", "Hideout");
const RUINS_M = minion("ruins-m", "Ruins");
const MINIONS = [ARC_M, UNBOUND_M, BRUTE_M, CINDER_M, KINDLER_M, DRIFT_M, ARC_SUB_M, ALIAS_M, HIDEOUT_M, RUINS_M];

/** A double-sided environment: "Hideout", flipping to "Ruins". */
const HIDEOUT = stubEnvironment({ id: "hideout", name: "Hideout", flipSide: { name: "Ruins" } });

// Allies titled like the two sides of the default hero ("hero (alter-ego)" / "hero (hero)").
const ALLY_ALTER_EGO = titled(stubAlly({ id: "ally-ae", cost: 0, atk: 1, thw: 1, hp: 2 }), "hero (alter-ego)");
const ALLY_HERO = titled(stubAlly({ id: "ally-hero", cost: 0, atk: 1, thw: 1, hp: 2 }), "hero (hero)");

const THE_VILLAIN: TargetRef = { kind: "villain" };
const UNDER_HIDEOUT: TargetRef = { kind: "tuckedUnder", of: { kind: "named", name: "Hideout" } };
const sharing = (ref: TargetRef): TargetQuery => ({ categories: ["minion"], sharesTitleWith: ref });
const notSharing = (ref: TargetRef): TargetQuery => ({ categories: ["minion"], not: { sharesTitleWith: ref } });

/** A search that offers what its selector finds: the options of the open choice are the result. */
const search = (id: string, from: CardSelector) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [{ kind: "chooseCards", slot: "found", from, chooser: you, min: 1, max: 1 }],
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Search the encounter deck for the minion that shares a title with the villain." */
const SEARCH_DECK = search("search-deck", { kind: "encounter", zones: ["deck"], filter: sharing(THE_VILLAIN) });
/** "Search the encounter deck for a minion that does not share a title with a card in play." */
const SEARCH_DECK_NOT = search("search-deck-not", {
  kind: "encounter",
  zones: ["deck"],
  filter: notSharing({ kind: "each", query: {} }),
});
/** "A set-aside villain that does not share a title with a card under [the environment]." */
const SEARCH_SET_ASIDE = search("search-set-aside", {
  kind: "encounterSetAside",
  filter: { categories: ["villain"], not: { sharesTitleWith: UNDER_HIDEOUT } },
});
const SEARCHES = [SEARCH_DECK, SEARCH_DECK_NOT, SEARCH_SET_ASIDE];
const deps: EngineDeps = depsOf(...SEARCHES.map((s) => s.ability));

const CONTEXT: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
/** `CONTEXT` with these cards bound to the slot `ref`, so a test can name any card it likes. */
const bound = (...ids: readonly InstanceId[]): EffectContext => ({ ...CONTEXT, bindings: { ref: ids } });
const IN_SLOT: TargetRef = { kind: "slot", slot: "ref" };

function start(): GameState {
  const state = gameAtFirstTurn({
    cards: [...MINIONS, HIDEOUT, ALLY_ALTER_EGO, ALLY_HERO, ...SET_ASIDE, ...SEARCHES.map((s) => s.card)],
    deps,
    villain: ARC,
    encounter: [...MINIONS.map((m) => m.id), ARC_M.id, DRIFT_M.id, HIDEOUT.id, ...copiesOf(TREACHERY.id, 10)],
    deck: [ALLY_ALTER_EGO.id, ALLY_HERO.id, ...SEARCHES.map((s) => s.card.id)],
  });
  // The other villains, set aside (surgery: instances of cards the pool already holds).
  const ids = SET_ASIDE.map((card) => `set-aside-${card.id}` as InstanceId);
  const template = mustInstance(state, state.encounterDecks[state.encounterDeckOrder[0]!]!.deck[0]!);
  return {
    ...state,
    encounterSetAside: [...state.encounterSetAside, ...ids],
    instances: {
      ...state.instances,
      ...Object.fromEntries(
        SET_ASIDE.map((card, i) => [ids[i], { ...template, instanceId: ids[i]!, cardId: card.id as CardId }]),
      ),
    },
  };
}

/** Every instance of a card, wherever it is. */
const copies = (state: GameState, card: { readonly id: string }): readonly InstanceId[] =>
  Object.values(state.instances)
    .filter((instance) => instance.cardId === card.id)
    .map((instance) => instance.instanceId);
const one = (state: GameState, card: { readonly id: string }): InstanceId => copies(state, card)[0]!;
const cardIdsOf = (state: GameState, ids: readonly (InstanceId | string)[]): readonly string[] =>
  ids.map((id) => state.instances[id as InstanceId]!.cardId as string).sort();
/** The printed ids of the minions, anywhere, that the query matches. */
const matching = (state: GameState, query: TargetQuery, context: EffectContext = CONTEXT): readonly string[] =>
  MINIONS.filter((card) => matchesQuery(state, one(state, card), query, context))
    .map((card) => card.id as string)
    .sort();
const ALL = MINIONS.map((m) => m.id as string).sort();
const except = (...ids: readonly string[]): readonly string[] => ALL.filter((id) => !ids.includes(id));

/** Moves cards out of the encounter deck and the set-aside area to under `host` (surgery). */
function tuckUnder(state: GameState, host: InstanceId, ids: readonly InstanceId[]): GameState {
  return {
    ...state,
    encounterSetAside: state.encounterSetAside.filter((id) => !ids.includes(id)),
    encounterDecks: Object.fromEntries(
      Object.entries(state.encounterDecks).map(([deckId, piles]) => [
        deckId,
        { ...piles, deck: piles.deck.filter((id) => !ids.includes(id)) },
      ]),
    ),
    instances: { ...state.instances, [host]: { ...mustInstance(state, host), tucked: ids } },
  };
}
const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][InstanceId]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});
/** The printed ids a search offers, sorted. */
function offered(state: GameState, event: { readonly id: CardId }): readonly string[] {
  const given = giveCard(state, P1, event.id);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const choice = result.state.pendingChoice;
  if (!choice) throw new Error("the search opened no choice");
  return cardIdsOf(
    result.state,
    choice.options.map((option) => option.optionId),
  );
}

describe("§3.8 `TargetQuery.sharesTitleWith`", () => {
  it("selects the minion in play that shares the villain's title, and under `not` the others", () => {
    const arc = minionEngagedWith(start(), ARC_M.id);
    const brute = minionEngagedWith(arc.state, BRUTE_M.id);
    const drift = minionEngagedWith(brute.state, DRIFT_M.id);
    const state = drift.state;

    expect(selectTargets(state, sharing(THE_VILLAIN), CONTEXT)).toEqual([arc.id]);
    expect(selectTargets(state, notSharing(THE_VILLAIN), CONTEXT)).toEqual([brute.id, drift.id]);
    // Which clause said no (`explainQuery`): the title, and the negated query.
    expect(explainQuery(state, brute.id, sharing(THE_VILLAIN), CONTEXT)).toBe("wrongName");
    expect(explainQuery(state, arc.id, notSharing(THE_VILLAIN), CONTEXT)).toBe("matchesNoAlternative");
    expect(explainQuery(state, arc.id, sharing(THE_VILLAIN), CONTEXT)).toBeNull();
  });

  it("reads the title only: a subtitle neither adds a match nor removes one", () => {
    const state = start();
    // "Arc" subtitled "The Spark" shares the villain's title; "Spark" subtitled "Arc" does not.
    expect(matching(state, sharing(THE_VILLAIN))).toEqual(["arc-m", "arc-sub-m"]);
    expect(matching(state, notSharing(THE_VILLAIN))).toEqual(except("arc-m", "arc-sub-m"));
  });

  it("matches a card sharing a title with any card the ref names; a parenthetical is part of the title", () => {
    const placed = encounterCardInVillainArea(start(), HIDEOUT.id);
    const state = tuckUnder(placed.state, placed.id, [one(placed.state, BRUTE_V), one(placed.state, CINDER_V)]);

    // Under the environment: "Brute" and "Cinder (The Scorcher)". "Cinder (The Kindler)" is another title.
    expect(matching(state, sharing(UNDER_HIDEOUT))).toEqual(["brute-m", "cinder-m"]);
    expect(matching(state, notSharing(UNDER_HIDEOUT))).toEqual(except("brute-m", "cinder-m"));
  });

  it("matches nothing when the ref names nothing, and everything under `not`", () => {
    const state = encounterCardInVillainArea(start(), HIDEOUT.id).state;
    expect(matching(state, sharing(UNDER_HIDEOUT))).toEqual([]);
    expect(matching(state, notSharing(UNDER_HIDEOUT))).toEqual(ALL);
    // An empty query matches every card, so its negation matches none.
    expect(matching(state, { categories: ["minion"], not: {} })).toEqual([]);
  });

  it("a facedown card shows no title: it shares one with nothing, as the candidate or as the card named", () => {
    const first = minionEngagedWith(start(), ARC_M.id);
    const second = minionEngagedWith(first.state, ARC_M.id);
    const faceup = second.state;
    expect(selectTargets(faceup, sharing(THE_VILLAIN), CONTEXT)).toEqual([first.id, second.id]);

    const state = patch(faceup, first.id, { facedownAs: { kind: "minion", traits: [] } });
    // As the candidate: not "the minion that shares a title with the villain", and so one that does not.
    expect(selectTargets(state, sharing(THE_VILLAIN), CONTEXT)).toEqual([second.id]);
    expect(selectTargets(state, notSharing(THE_VILLAIN), CONTEXT)).toEqual([first.id]);
    // As the card named: the faceup copy of the same printed card shares no title with it, nor does it with itself.
    expect(selectTargets(state, sharing(IN_SLOT), bound(first.id))).toEqual([]);
    expect(selectTargets(state, notSharing(IN_SLOT), bound(first.id))).toEqual([first.id, second.id]);
  });

  it("a double-sided villain contributes the title of the side showing", () => {
    const state = start();
    expect(matching(state, sharing(THE_VILLAIN))).toEqual(["arc-m", "arc-sub-m"]);
    const flipped: GameState = { ...state, villains: state.villains.map((v) => ({ ...v, side: "B" as const })) };
    expect(matching(flipped, sharing(THE_VILLAIN))).toEqual(["unbound-m"]);
    expect(matching(flipped, notSharing(THE_VILLAIN))).toEqual(except("unbound-m"));
  });

  it("a flipped card contributes its other face's title, not its printed one", () => {
    const placed = encounterCardInVillainArea(start(), HIDEOUT.id);
    const context = bound(placed.id);
    expect(matching(placed.state, sharing(IN_SLOT), context)).toEqual(["hideout-m"]);
    const flipped = patch(placed.state, placed.id, { flipped: true });
    expect(matching(flipped, sharing(IN_SLOT), context)).toEqual(["ruins-m"]);
  });

  it("an identity contributes only the title of the side that is up", () => {
    const state = start();
    const identity: TargetRef = { kind: "identityOf", player: you };
    const query: TargetQuery = { categories: ["ally"], sharesTitleWith: identity };
    const allies = (s: GameState) =>
      [ALLY_ALTER_EGO, ALLY_HERO].filter((card) => matchesQuery(s, one(s, card), query, CONTEXT)).map((c) => c.id);

    expect(allies(state)).toEqual(["ally-ae"]);
    expect(allies(runCommands(state, deps, { type: "changeForm", playerId: P1 }).state)).toEqual(["ally-hero"]);
  });

  it("a card shares a title with itself: the card named matches unless it is excluded", () => {
    const first = minionEngagedWith(start(), ARC_M.id);
    const second = minionEngagedWith(first.state, ARC_M.id);
    const brute = minionEngagedWith(second.state, BRUTE_M.id);
    const state = brute.state;

    expect(selectTargets(state, sharing(IN_SLOT), bound(first.id))).toEqual([first.id, second.id]);
    // "Another minion that shares a title with it."
    expect(selectTargets(state, { ...sharing(IN_SLOT), excluding: IN_SLOT }, bound(first.id))).toEqual([second.id]);
    expect(selectTargets(state, notSharing(IN_SLOT), bound(first.id))).toEqual([brute.id]);
  });

  it("finds cards in the encounter deck when the selector searches it", () => {
    const state = start();
    expect(mustPlayer(state, P1).playArea.filter((id) => mustInstance(state, id).engagedWith)).toEqual([]);
    // Both copies of "Arc" and the subtitled "Arc", out of play in the deck.
    expect(offered(state, SEARCH_DECK.card)).toEqual(["arc-m", "arc-m", "arc-sub-m"]);

    // "… that does not share a title with a card in play": with a "Drift" minion in play, the other "Drift" is out.
    const drift = minionEngagedWith(state, DRIFT_M.id).state;
    expect(offered(drift, SEARCH_DECK_NOT.card)).toEqual(except("arc-m", "arc-sub-m", "drift-m"));
  });

  it("finds a set-aside villain that does not share a title with a card under the host", () => {
    const placed = encounterCardInVillainArea(start(), HIDEOUT.id);
    // The "Brute" minion is under the environment: the set-aside "Brute" villain is the one left out.
    const state = tuckUnder(placed.state, placed.id, [one(placed.state, BRUTE_M)]);
    expect(offered(state, SEARCH_SET_ASIDE.card)).toEqual(["cinder-v", "drift-v"]);
  });
});
