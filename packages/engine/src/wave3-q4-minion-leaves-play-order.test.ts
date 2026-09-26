/**
 * docs/phase7-wave3.md §4 Q4, resolved 2026-09-25: a defeated minion or ally leaves play **after** its own When Defeated
 * abilities resolve. RRG 1.8 "When Defeated Abilities" (p. 48): "When a villain stage, side scheme, main scheme stage,
 * ally, or minion is defeated, all 'When Defeated' abilities on the card resolve. » A defeated card leaves play after its
 * 'When Defeated' ability is resolved, if any." A side scheme already worked this way (ruling, Jan 11, 2026 (1);
 * `victory-keyword.test.ts`). This file pinned the opposite order for a minion until that date.
 *
 * Overkill: the spill's amount is fixed by the damage that caused the defeat, and it is dealt after the card has left.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMinion } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playerCardIntoPlay, playFree } from "./testing/wave3.js";
import type { EffectSpec, TargetRef } from "./spec.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const each = (categories: readonly ("minion" | "ally")[]): TargetRef => ({ kind: "each", query: { categories } });

/** "When Defeated: if this card is still in play, place a 'saw' counter on the villain." */
const whenDefeated = (id: string) =>
  stubAbility(id, {
    trigger: { kind: "whenDefeated" },
    effects: [
      {
        kind: "if",
        condition: { kind: "refMatches", ref: { kind: "self" }, query: {} },
        then: [{ kind: "addCounters", target: { kind: "villain" }, counterType: "saw", amount: n(1) }],
      },
    ],
  });
const GRUNT_DEFEATED = whenDefeated("grunt.when-defeated");
const GRUNT = stubMinion({ id: "q4-grunt", atk: 1, sch: 1, hp: 7, abilities: [GRUNT_DEFEATED.ref] });
/** Goblin Soldier's shape (`gob` 02023): "When Defeated: deal 1 damage to the engaged player's identity." */
const SOLDIER_DEFEATED = stubAbility("soldier.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "engagedWith", of: { kind: "self" } } },
      amount: n(1),
    },
  ],
});
const SOLDIER = stubMinion({ id: "q4-soldier", atk: 1, sch: 1, hp: 3, abilities: [SOLDIER_DEFEATED.ref] });
const PAL_DEFEATED = whenDefeated("pal.when-defeated");
const PAL = stubAlly({ id: "q4-pal", cost: 0, atk: 1, thw: 1, hp: 2, abilities: [PAL_DEFEATED.ref] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const SMASH = actionEvent("q4-smash", [{ kind: "dealDamage", target: each(["minion"]), amount: n(10) }]);
const FRIENDLY_FIRE = actionEvent("q4-friendly-fire", [{ kind: "dealDamage", target: each(["ally"]), amount: n(5) }]);
const CLEAVE = actionEvent("q4-cleave", [{ kind: "attack", target: each(["minion"]), amount: n(10), overkill: true }]);
const EVENTS = [SMASH, FRIENDLY_FIRE, CLEAVE];

const deps: EngineDeps = depsOf(GRUNT_DEFEATED, SOLDIER_DEFEATED, PAL_DEFEATED, ...EVENTS.map((e) => e.ability));
const CARDS = [GRUNT, SOLDIER, PAL, ...EVENTS.map((e) => e.card)];
const ENCOUNTER: readonly CardId[] = [GRUNT.id, ...copiesOf(GRUNT.id, 5), SOLDIER.id];

function start(): GameState {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    encounter: ENCOUNTER,
    deck: [PAL.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  // Attacks are hero actions.
  return { ...base, players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}

/** The defeated card's leaving play, its When Defeated, and (for overkill) the villain's damage, in log order. */
function order(events: readonly GameEvent[], id: InstanceId, abilityId: string, villain: InstanceId): string[] {
  return events.flatMap((event) =>
    event.type === "cardMoved" && event.instanceId === id
      ? ["leftPlay"]
      : event.type === "abilityResolved" && event.abilityId === abilityId
        ? ["whenDefeated"]
        : event.type === "damageDealt" && event.targetInstanceId === villain
          ? ["spill"]
          : [],
  );
}
const saw = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).counters["saw"] ?? 0;

describe("§4 Q4 (resolved): a defeated minion or ally leaves play after its own When Defeated (RRG 1.8 p. 48)", () => {
  it("a minion: its When Defeated resolves while it is still in play, then it goes to the encounter discard pile", () => {
    const grunt = minionEngagedWith(start(), GRUNT.id);
    const { state, events } = playFree(grunt.state, deps, SMASH.card.id);
    const villain = state.villains[0]!.instanceId;
    expect(order(events, grunt.id, GRUNT_DEFEATED.ref.id, villain)).toEqual(["whenDefeated", "leftPlay"]);
    expect(saw(state)).toBe(1);
    expect(cardsInPlay(state)).not.toContain(grunt.id);
    expect(activeEncounterDeck(state).discard).toContain(grunt.id);
  });

  it("an ally: the same order, then it goes to its owner's discard pile", () => {
    const pal = playerCardIntoPlay(start(), PAL.id);
    const { state, events } = playFree(pal.state, deps, FRIENDLY_FIRE.card.id);
    const villain = state.villains[0]!.instanceId;
    expect(order(events, pal.id, PAL_DEFEATED.ref.id, villain)).toEqual(["whenDefeated", "leftPlay"]);
    expect(saw(state)).toBe(1);
    expect(cardsInPlay(state)).not.toContain(pal.id);
    expect(state.players[0]!.discard).toContain(pal.id);
  });

  it("overkill: When Defeated, then the minion leaves, then the excess measured at the defeat spills onto the villain", () => {
    const grunt = minionEngagedWith(start(), GRUNT.id);
    const { state, events } = playFree(grunt.state, deps, CLEAVE.card.id);
    const villain = state.villains[0]!.instanceId;
    expect(order(events, grunt.id, GRUNT_DEFEATED.ref.id, villain)).toEqual(["whenDefeated", "leftPlay", "spill"]);
    expect(mustInstance(state, villain).damage).toBe(3);
  });

  it("a When Defeated that deals damage does not defeat its own card again while it waits to leave play", () => {
    const soldier = minionEngagedWith(start(), SOLDIER.id);
    const identity = soldier.state.players[0]!.identity.instanceId;
    const before = mustInstance(soldier.state, identity).damage;
    const { state, events } = playFree(soldier.state, deps, SMASH.card.id);
    expect(events.filter((e) => e.type === "characterDefeated" && e.instanceId === soldier.id)).toHaveLength(1);
    expect(events.filter((e) => e.type === "abilityResolved" && e.abilityId === SOLDIER_DEFEATED.ref.id)).toHaveLength(
      1,
    );
    expect(mustInstance(state, identity).damage).toBe(before + 1);
    expect(activeEncounterDeck(state).discard).toContain(soldier.id);
  });
});
