/**
 * docs/phase7-wave11-scenarios.md §S7 E28: `TargetQuery inEncounterSet` also matches a player card printed as
 * belonging to the set (`specificTo.encounterSetId`), so "each player takes a Daily Bugle support" (Stop the Presses!,
 * the supports 60153-60156 carry only `specificTo`) can name its set. An encounter card still matches by
 * `encounterSetIds`, and a player card of no set, or of another set, still never matches.
 */

import { describe, expect, it } from "vitest";
import { encounterSetId, type SupportCard } from "@mc/content";
import { DEFAULT_DEPS } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { playerId } from "./ids.js";
import { evaluate, type EffectContext } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { stubMinion, stubSupport } from "./testing/fixtures.js";
import { activeEncounterDeck } from "./query.js";
import { DEFAULT_DECK, giveCard, newGame, TREACHERY } from "./testing/scenario.js";

const p1 = playerId("p1");

const bugle = (id: string, setId: string): SupportCard => ({
  ...stubSupport({ id, cost: 1 }),
  specificTo: { kind: "scenario", encounterSetId: encounterSetId(setId) },
});
const BUGLE_SUPPORT = bugle("bugle-support", "stop_the_presses");
const OTHER_SET_SUPPORT = bugle("other-set-support", "protection_racket");
const PLAIN_SUPPORT = stubSupport({ id: "plain-support", cost: 1 });
const BUGLE_MINION = {
  ...stubMinion({ id: "bugle-minion", atk: 0, sch: 0, hp: 1 }),
  encounterSetIds: [encounterSetId("stop_the_presses")],
};

const IN_SET: TargetQuery = { inEncounterSet: "stop_the_presses" };

function matches(state: GameState, id: InstanceId, query: TargetQuery): boolean {
  const context: EffectContext = {
    selfInstanceId: null,
    controllerId: p1,
    event: null,
    bindings: { card: [id] },
    deps: DEFAULT_DEPS,
  };
  return evaluate(state, { kind: "refMatches", ref: { kind: "slot", slot: "card" }, query, anywhere: true }, context);
}

describe("§S7 E28 inEncounterSet reads specificTo", () => {
  const start = newGame({
    extraCards: [BUGLE_SUPPORT, OTHER_SET_SUPPORT, PLAIN_SUPPORT, BUGLE_MINION],
    deck: [...DEFAULT_DECK, BUGLE_SUPPORT.id, OTHER_SET_SUPPORT.id, PLAIN_SUPPORT.id],
    encounterDeck: [BUGLE_MINION.id, ...Array.from({ length: 15 }, () => TREACHERY.id)],
  });
  const held = (card: { readonly id: string }) => giveCard(start, p1, card.id);

  it("a support printed as belonging to the set matches it, wherever it is (here, in hand)", () => {
    const { state, id } = held(BUGLE_SUPPORT);
    expect(matches(state, id, IN_SET)).toBe(true);
    expect(matches(state, id, { categories: ["support"], ...IN_SET })).toBe(true);
  });

  it("a player card of another set, or of none, does not", () => {
    const other = held(OTHER_SET_SUPPORT);
    expect(matches(other.state, other.id, IN_SET)).toBe(false);
    const plain = held(PLAIN_SUPPORT);
    expect(matches(plain.state, plain.id, IN_SET)).toBe(false);
  });

  it("an encounter card still matches by encounterSetIds", () => {
    const state = start;
    const id = activeEncounterDeck(start).deck.find((x) => start.instances[x]?.cardId === BUGLE_MINION.id)!;
    expect(matches(state, id, IN_SET)).toBe(true);
    expect(matches(state, id, { inEncounterSet: "protection_racket" })).toBe(false);
  });
});
