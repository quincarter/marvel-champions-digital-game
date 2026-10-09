/**
 * `EffectSpec countBoostIcons` (docs/phase7-wave2.md §3.6, §4 Q8): a card effect's count of boost icons is the same
 * `boostIconsCounting` event an activation's boost step announces, so "when boost icons on an encounter card would be
 * counted" (Chaos Control) and "…are counted" (Scarlet Witch's Crest) answer it. Synthetic cards.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubIdentity, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, newGame, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const theVillain: TargetRef = { kind: "villain" };
const counting = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, { trigger: { kind: "interrupt", forced: true, on: { on: "boostIconsCounting" } }, effects });
// "Increase … the number of boost icons on that card by 1 for this count" (Scarlet Witch's Crest), on every count.
const CREST = counting("crest.interrupt", [{ kind: "adjustBoostCount", delta: { kind: "const", value: 1 } }]);
// "… count the number of boost icons on that card instead" (Chaos Control), here a card with none: the identity.
const CHAOS = counting("chaos.interrupt", [
  { kind: "replaceBoostCount", card: { kind: "identityOf", player: { kind: "controller" } } },
]);

/** "Discard the top 2 cards of the encounter deck. Deal 1 damage to the villain for each boost icon discarded this way." */
const COUNT_DISCARDS: readonly EffectSpec[] = [
  { kind: "discardEncounterCards", count: { kind: "const", value: 2 }, bind: "d" },
  { kind: "countBoostIcons", cards: { kind: "slot", slot: "d" }, bind: "d" },
  { kind: "dealDamage", target: theVillain, amount: { kind: "var", name: "d.boostIcons" } },
];
const DISCARD_AND_COUNT = stubAbility("discard-count.action", { trigger: { kind: "action" }, effects: COUNT_DISCARDS });
// A count of a player's card: the identity, whose icons no "on an encounter card" ability hears counted.
const COUNT_OWN = stubAbility("count-own.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "countBoostIcons", cards: { kind: "identityOf", player: { kind: "controller" } }, bind: "own" },
    { kind: "dealDamage", target: theVillain, amount: { kind: "var", name: "own.boostIcons" } },
  ],
});
// "Boost: Discard the top card of the encounter deck. Deal 1 damage to the villain for each boost icon on it."
const COUNTING_BOOST = stubAbility("counting.boost", {
  trigger: { kind: "boost" },
  effects: [
    { kind: "discardEncounterCards", count: { kind: "const", value: 1 }, bind: "d" },
    { kind: "countBoostIcons", cards: { kind: "slot", slot: "d" }, bind: "d" },
    { kind: "dealDamage", target: theVillain, amount: { kind: "var", name: "d.boostIcons" } },
  ],
});

const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });
const BOOST_COUNTS = stubTreachery({ id: "boost-counts", boostIcons: 1, abilities: [COUNTING_BOOST.ref] });

function game(listener: StubAbility | null, deck: CardId) {
  const actions = [DISCARD_AND_COUNT, COUNT_OWN];
  const refs = [...actions, ...(listener ? [listener] : [])].map((a) => a.ref);
  const identity = stubIdentity({
    id: `counter-${listener?.ref.id ?? "none"}`,
    hp: 30,
    atk: 1,
    thw: 1,
    def: 1,
    rec: 1,
    heroHandSize: 5,
    alterEgoHandSize: 5,
    alterEgoAbilities: refs,
    heroAbilities: refs,
  });
  const deps = depsOf(...actions, COUNTING_BOOST, ...(listener ? [listener] : []));
  const state = newGame({
    identity,
    deps,
    extraCards: [ONE_ICON, BOOST_COUNTS],
    encounterDeck: Array.from({ length: 12 }, () => deck),
  });
  return { state, deps };
}

const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;

function useAction(listener: StubAbility | null, action: StubAbility): GameState {
  const { state, deps } = game(listener, ONE_ICON.id);
  const result = applyCommand(
    state,
    {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: state.players[0]!.identity.instanceId,
      abilityId: action.ref.id,
      payment: [],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return settle(result.state, defaultPick, deps);
}

describe("countBoostIcons: a card effect's count of boost icons", () => {
  it("with no listener the count is the discarded cards' icons", () => {
    expect(villainDamage(useAction(null, DISCARD_AND_COUNT))).toBe(2);
  });

  it("each encounter card counted is its own count: an adjustment applies to each", () => {
    expect(villainDamage(useAction(CREST, DISCARD_AND_COUNT))).toBe(4);
  });

  it("a replacement counts another card's icons instead", () => {
    expect(villainDamage(useAction(CHAOS, DISCARD_AND_COUNT))).toBe(0);
  });

  it("a player card's icons are counted without the encounter card window", () => {
    expect(villainDamage(useAction(CREST, COUNT_OWN))).toBe(0);
  });

  it("a count made by a Boost ability and the boost card's own count are changed separately", () => {
    const { state, deps } = game(CREST, BOOST_COUNTS.id);
    // Alter-ego form: the villain schemes with one boost card, whose Boost ability discards and counts a card.
    let result = applyCommand(state, { type: "endTurn", playerId: p1 }, deps);
    const events: GameEvent[] = [];
    let resolved: Extract<GameEvent, { type: "schemeResolved" }> | undefined;
    for (let guard = 0; result.ok && guard < 50 && !resolved; guard++) {
      events.push(...result.events);
      resolved = events.find((e): e is Extract<GameEvent, { type: "schemeResolved" }> => e.type === "schemeResolved");
      const choice = result.state.pendingChoice;
      if (resolved || !choice) break;
      result = applyCommand(
        result.state,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: defaultPick(result.state),
        },
        deps,
      );
    }
    if (!result.ok) throw new Error(result.error.message);
    // The discarded card: 1 icon, +1 for its count. The boost card: 1 icon, +1 for its own count, not +2.
    expect(villainDamage(result.state)).toBe(2);
    expect(resolved?.boostIcons).toBe(2);
    // The effect's count is logged with what it counted.
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "triggerEvent",
        phase: "resolved",
        event: expect.objectContaining({
          kind: "boostIconsCounting",
          enemyInstanceId: null,
          countAdjust: 1,
          counted: 2,
        }),
      }),
    );
  });
});
