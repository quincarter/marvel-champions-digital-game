/**
 * `EffectSpec modifyCardEffectsUntil` (a lasting `cardEffectBonusFor`) and `dealDamage.additional`. Synthetic cards
 * shaped like "Until the end of the phase, each [Blast] event deals 1 additional damage."
 *
 * Sources: RRG 1.8 "Event" (p. 19): "If an effect modifies the amount of damage an event deals … and that event deals
 * multiple instances of damage …, each of those instances is modified"; "'For Each'" (p. 20); "Attack (Player Ability
 * Type)" (p. 10): "each instance of damage in that attack ability that does not use the word 'additional' is increased
 * by the specified amount"; "Alteration Effect" (p. 7), "Additional"; "Lasting Effects" (p. 26). Owner ruling Q53
 * (docs/phase7-wave8.md §4.1).
 */
import { trait, type EventCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const BLAST = trait("Blast");
const villain = { kind: "villain" } as const;
const hit = (n: number, more: Partial<Extract<EffectSpec, { kind: "dealDamage" }>> = {}): EffectSpec => ({
  kind: "dealDamage",
  target: villain,
  amount: { kind: "const", value: n },
  ...more,
});
const abilities: StubAbility[] = [];
const action = (id: string, definition: Omit<AbilityDefinition, "trigger">): StubAbility => {
  const stub = stubAbility(id, { trigger: { kind: "action" }, ...definition });
  abilities.push(stub);
  return stub;
};
const event = (id: string, effects: readonly EffectSpec[], blast = true, label?: "attack"): EventCard => ({
  ...stubEvent({
    id,
    cost: 0,
    abilities: [action(`${id}.action`, { effects, ...(label ? { label: [label] } : {}) }).ref],
  }),
  traits: blast ? [BLAST] : [],
});

/** "Action: Until the end of the phase, each [Blast] event deals 1 additional damage." */
const DRUM_ACTION = action("drum.action", {
  effects: [
    {
      kind: "modifyCardEffectsUntil",
      cards: { categories: ["event"], trait: BLAST },
      damage: { kind: "const", value: 1 },
      until: "endOfPhase",
    },
  ],
});
const DRUM = stubSupport({ id: "drum", cost: 0, abilities: [DRUM_ACTION.ref] });

/** Two instances: 2, then 1. */
const VOLLEY = event("volley", [hit(2), hit(1)]);
/** One instance of 2 with a rider: "… deal 1 additional damage". */
const RIDER = event("rider", [hit(2), hit(1, { additional: true })]);
/** The same shape on an "(attack)" event: a label-only attack. */
const STRIKE = event("strike", [hit(2), hit(1), hit(1, { additional: true })], true, "attack");
/** Not a Blast. */
const PLAIN = event("plain", [hit(2)], false);
/** An `attack` effect by the hero with a printed amount. */
const CHARGE = event("charge", [
  {
    kind: "attack",
    attacker: { kind: "identityOf", player: { kind: "controller" } },
    target: villain,
    amount: { kind: "const", value: 3 },
  },
]);

const CARDS = [DRUM, VOLLEY, RIDER, STRIKE, PLAIN, CHARGE];
const deps = depsOf(...abilities);
const start = (): GameState => {
  const state = gameAtFirstTurn({ cards: CARDS, deps, deck: CARDS.flatMap((card) => [card.id, card.id]) });
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
};
const damage = (state: GameState): number => mustInstance(state, state.activeVillainId).damage;
/** The damage the villain takes from one free play of `card`. */
const dealtBy = (state: GameState, card: EventCard): number =>
  damage(playFree(state, deps, card.id).state) - damage(state);
/** The table with the drum in play and, when `beaten`, its lasting bonus in force. */
function table(beaten: boolean): GameState {
  const drum = playerCardIntoPlay(start(), DRUM.id);
  if (!beaten) return drum.state;
  const use: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: drum.id,
    abilityId: DRUM_ACTION.ref.id,
    payment: [],
  };
  return runCommands(drum.state, deps, use).state;
}

describe("modifyCardEffectsUntil: 'each [Blast] event deals 1 additional damage' until the end of the phase", () => {
  it("is recorded as a lasting effect that ends with the phase", () => {
    const state = table(true);
    expect(state.lastingEffects).toMatchObject([
      { kind: "cardEffectBonusFor", damage: 1, threatRemoved: 0, duration: { kind: "endOfPhase" } },
    ]);
    const next = runCommands(state, deps, { type: "endTurn", playerId: P1 }).state;
    expect(next.lastingEffects.some((effect) => effect.kind === "cardEffectBonusFor")).toBe(false);
  });

  it("each instance of damage a matching event deals is increased: 2 + 1 becomes 3 + 2", () => {
    expect(dealtBy(table(false), VOLLEY)).toBe(3);
    expect(dealtBy(table(true), VOLLEY)).toBe(5);
  });

  it("an instruction that is additional damage is not increased a second time: 2 (+1 additional) becomes 3 (+1)", () => {
    expect(dealtBy(table(false), RIDER)).toBe(3);
    expect(dealtBy(table(true), RIDER)).toBe(4);
  });

  it("the same on an (attack) event: its two instances get it, its additional rider does not", () => {
    expect(dealtBy(table(false), STRIKE)).toBe(4);
    expect(dealtBy(table(true), STRIKE)).toBe(6);
  });

  it("an event's `attack` effect is an instance too: 3 becomes 4", () => {
    expect(dealtBy(table(false), CHARGE)).toBe(3);
    expect(dealtBy(table(true), CHARGE)).toBe(4);
  });

  it("an event that does not match is untouched", () => {
    expect(dealtBy(table(true), PLAIN)).toBe(2);
  });

  it("each matching event played while it lasts gets it, not only the first", () => {
    const first = playFree(table(true), deps, VOLLEY.id).state;
    expect(dealtBy(first, VOLLEY)).toBe(5);
  });
});
