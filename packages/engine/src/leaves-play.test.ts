/**
 * docs/phase7-wave5.md §3.13: "When/After X leaves play". Synthetic cards shaped like Spider-Man (Hobie Brown) (`sm`
 * 27017: "Interrupt: When Spider-Man leaves play, discard the top 3 cards of the encounter deck …"), Web of Life and
 * Destiny (27023: "Response: After a [Web-Warrior] ally leaves play, …") and Warrior of the Great Web (30029: "Attached
 * character gains the [Web-Warrior] trait").
 *
 * Sources: RRG 1.8 "Leaves Play" (p. 27); ruling Jan 17, 2026 (1) #2 (the "Leaves Play" bullets happen as the card
 * leaves). Since §4.1 Q17 the interrupt resolves before the move (`leaves-play-interrupt-timing.test.ts`).
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const WEB = trait("WEB-WARRIOR");
const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "web-of-life" } };
const mark = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: tracker,
  counterType,
  amount: { kind: "const", value: 1 },
});

const HOBIE_INTERRUPT = stubAbility("hobie.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [mark("interrupt")],
});
const HOBIE = stubAlly({ id: "hobie", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [HOBIE_INTERRUPT.ref] });
const PLAIN_ALLY = stubAlly({ id: "plain", cost: 0, atk: 1, thw: 1, hp: 3 });

const WEB_OF_LIFE_DEFINITION: AbilityDefinition = {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "cardLeavesPlay", targetIs: { categories: ["ally"], trait: WEB } },
  },
  effects: [mark("response")],
};
const WEB_OF_LIFE_RESPONSE = stubAbility("web-of-life.response", WEB_OF_LIFE_DEFINITION);
// "Attached character gains the [Web-Warrior] trait", as a grant to Hobie only.
const WARRIOR = stubAbility("warrior.constant", {
  trigger: { kind: "constant", traitGrants: [{ trait: WEB, target: { categories: ["ally"], name: "hobie" } }] },
  effects: [],
});
const WEB_OF_LIFE = stubSupport({
  id: "web-of-life",
  cost: 0,
  abilities: [WEB_OF_LIFE_RESPONSE.ref, WARRIOR.ref],
});

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const DISCARD_ALLIES = event("discard-allies", [
  { kind: "moveCards", cards: { kind: "ref", ref: { kind: "each", query: { categories: ["ally"] } } }, to: "discard" },
]);
const BOUNCE_ALLIES = event("bounce-allies", [
  { kind: "moveCards", cards: { kind: "ref", ref: { kind: "each", query: { categories: ["ally"] } } }, to: "hand" },
]);

const deps: EngineDeps = depsOf(
  HOBIE_INTERRUPT,
  WEB_OF_LIFE_RESPONSE,
  WARRIOR,
  DISCARD_ALLIES.ability,
  BOUNCE_ALLIES.ability,
);

function start(ally: typeof HOBIE): GameState {
  const state = gameAtFirstTurn({
    cards: [HOBIE, PLAIN_ALLY, WEB_OF_LIFE, DISCARD_ALLIES.card, BOUNCE_ALLIES.card],
    deps,
    deck: [HOBIE.id, PLAIN_ALLY.id, WEB_OF_LIFE.id, DISCARD_ALLIES.card.id, BOUNCE_ALLIES.card.id],
  });
  const withSupport = playerCardIntoPlay(state, WEB_OF_LIFE.id).state;
  return playerCardIntoPlay(withSupport, ally.id).state;
}

const marks = (state: GameState) => {
  const id = mustPlayer(state, P1).playArea.find((i) => mustInstance(state, i).cardId === WEB_OF_LIFE.id)!;
  return mustInstance(state, id).counters;
};
const resolvedOrder = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [String(e.abilityId)] : []));

describe("§3.13 'When [this ally] leaves play' and 'After a [Web-Warrior] ally leaves play'", () => {
  it("a discarded ally's own interrupt resolves, then the response reads its granted trait; replay deep-equal", () => {
    const { state, events, session } = playFree(start(HOBIE), deps, DISCARD_ALLIES.card.id);
    expect(mustPlayer(state, P1).discard.some((id) => mustInstance(state, id).cardId === HOBIE.id)).toBe(true);
    expect(marks(state)).toMatchObject({ interrupt: 1, response: 1 });
    const order = resolvedOrder(events);
    expect(order.indexOf("hobie.interrupt")).toBeLessThan(order.indexOf("web-of-life.response"));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("returning to hand is leaving play too", () => {
    const state = playFree(start(HOBIE), deps, BOUNCE_ALLIES.card.id).state;
    expect(marks(state)).toMatchObject({ interrupt: 1, response: 1 });
  });

  it("an ally without the trait does not trigger the response", () => {
    const state = playFree(start(PLAIN_ALLY), deps, DISCARD_ALLIES.card.id).state;
    expect(marks(state)["response"] ?? 0).toBe(0);
    expect(marks(state)["interrupt"] ?? 0).toBe(0);
  });
});
