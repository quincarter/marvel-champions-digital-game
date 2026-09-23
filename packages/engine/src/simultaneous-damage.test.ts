/**
 * One effect dealing damage to several characters deals it simultaneously, and a villain and the last identity
 * defeated by it at the same time lose the game (docs/phase7-wave3.md §4 Q1).
 *
 * - Ruling, June 2, 2026 (2) answer 1 (Squirrel Girl dealing 1 damage to two enemies): "Damage is dealt
 *   simultaneously; resolve damage steps for both enemies at the same time", the steps being RRG 1.8 "Damage" (p. 14).
 *   So every target is dealt its damage before any of them is checked for defeat.
 * - FFG ruling, May 18, 2023 (The Kraken's "each other character takes 1 damage" defeating every character, villain
 *   included): "the players are considered to have lost the scenario. We agreed that there aren't any ties in Marvel
 *   Champions between the villain and the heroes, so if the heroes don't win, they have lost."
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import { mustInstance, mustPlayer, mustVillain } from "./query.js";
import type { TargetRef, ValueSpec } from "./spec.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const num = (value: number): ValueSpec => ({ kind: "const", value });

/** "When this villain would be defeated, note it": listens without replacing, so its defeat goes on the stack. */
const WITNESS = stubAbility("simultaneous.villain-witness", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: num(1) }],
});
const villain = (abilities: readonly (typeof WITNESS.ref)[]) =>
  stubVillain({ id: "one-hp-villain", stages: [{ hp: flat(1), atk: 1, sch: 1, abilities }] });

/** One `dealDamage` effect on each identity and the villain: past the villain's 1 and the default hero's 10 HP. */
const BLAST_ACTION = stubAbility("simultaneous.blast", {
  trigger: { kind: "action" },
  effects: [
    { kind: "dealDamage", target: { kind: "each", query: { categories: ["identity", "villain"] } }, amount: num(50) },
  ],
});
const BLAST = stubEvent({ id: "simultaneous-blast", cost: 0, abilities: [BLAST_ACTION.ref] });

/** Captain America's Helmet: "When [your hero] would be defeated, set his hit point dial to 1 instead." */
const HELMET_INTERRUPT = stubAbility("simultaneous.helmet", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "characterDefeated", targetIs: { categories: ["identity"], controller: "you" } },
  },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "setRemainingHitPoints", target: { kind: "eventTarget" }, amount: num(1) }],
    },
  ],
});
const HELMET = stubUpgrade({ id: "simultaneous-helmet", cost: 0, abilities: [HELMET_INTERRUPT.ref] });

const deps: EngineDeps = depsOf(WITNESS, BLAST_ACTION, HELMET_INTERRUPT);
const CARDS = [BLAST, HELMET];
const DECK: readonly CardId[] = [BLAST.id, HELMET.id];

const identityOf = (state: ReturnType<typeof gameAtFirstTurn>, player: typeof P1) =>
  mustPlayer(state, player).identity.instanceId;

describe("simultaneous damage from one effect", () => {
  it("deals every target its damage before any defeat is checked", () => {
    const base = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, villain: villain([]) });
    const { events } = playFree(base, deps, BLAST.id);
    const kinds = events.map((event: GameEvent) => event.type);
    const placed = kinds.flatMap((type, index) => (type === "damageDealt" ? [index] : []));
    const firstDefeat = kinds.findIndex((type) => type === "playerEliminated" || type === "characterDefeated");
    expect(placed).toHaveLength(2);
    expect(firstDefeat).toBeGreaterThan(Math.max(...placed));
  });
});

describe("§4 Q1: the villain and the last identity defeated at the same time", () => {
  it("is a loss when nothing listens to either defeat", () => {
    const base = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, villain: villain([]) });
    const identity = identityOf(base, P1);
    const { state } = playFree(base, deps, BLAST.id);
    expect(state.outcome).toEqual({ result: "loss", reason: "allPlayersDefeated" });
    expect(mustPlayer(state, P1).eliminated).toBe(true);
    expect(mustInstance(state, identity).damage).toBeGreaterThanOrEqual(10);
    // The villain was dealt its lethal damage too, but the loss ended the game before its defeat applied.
    const villainId = state.villains[0]?.instanceId;
    if (!villainId) throw new Error("no villain");
    expect(mustInstance(state, villainId).damage).toBeGreaterThanOrEqual(1);
    expect(mustVillain(state, villainId).defeated).toBe(false);
  });

  it("is a loss when the villain's defeat is listened to", () => {
    const base = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, villain: villain([WITNESS.ref]) });
    const { state } = playFree(base, deps, BLAST.id);
    expect(state.outcome).toEqual({ result: "loss", reason: "allPlayersDefeated" });
    expect(mustPlayer(state, P1).eliminated).toBe(true);
  });

  it("is a win when an interrupt saves the identity: the villain's defeat waits for it", () => {
    const setup = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, villain: villain([]) });
    const { state: base } = playerCardIntoPlay(setup, HELMET.id, P1);
    const identity = identityOf(base, P1);
    const { state } = playFree(base, deps, BLAST.id);
    expect(mustPlayer(state, P1).eliminated).toBe(false);
    expect(mustInstance(state, identity).damage).toBe(9);
    expect(state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });

  it("is a win when a player survives, though another is eliminated by the same effect", () => {
    const setup = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, villain: villain([]), players: 2 });
    const { state: base } = playerCardIntoPlay(setup, HELMET.id, P2);
    const { state } = playFree(base, deps, BLAST.id);
    expect(mustPlayer(state, P1).eliminated).toBe(true);
    expect(mustPlayer(state, P2).eliminated).toBe(false);
    expect(state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });
});
