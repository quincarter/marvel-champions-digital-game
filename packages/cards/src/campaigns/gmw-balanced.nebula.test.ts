/**
 * Balanced house rule, issue #609, Gideon's Gaming: Nebula's two changes, through a real campaign game.
 * 2. Nebula's Ship gains a Forced Response (`16093.balanced-evasion-guard`, registry-only).
 * 3. With one hero, The Art of Evasion stage 1's target threat is 12.
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "@mc/engine";
import { firstLegal, inst, instancesOf, P1, patchInstance, settle, toHero } from "../testing/harness.js";
import { playFromHand, runWave3, WAVE3_DEPS } from "../wave3/testing.js";
import { buildGame, logAt, schemeValues, type RunChoice } from "./gmw-balanced-testing.js";

const NEBULA = "nebula";
const NORMAL: RunChoice = { balanced: false };
const BALANCED: RunChoice = { balanced: true };

describe("3. Nebula, one hero: The Art of Evasion stage 1 target threat is 12 (Balanced)", () => {
  const values = (choice: RunChoice, seatCount: number) =>
    schemeValues(buildGame(logAt(NEBULA, choice, seatCount), choice, seatCount).state);

  it("Normal: 6[per_hero], so 6 with one hero and 12 with two", () => {
    expect(values(NORMAL, 1)[0]?.targetThreat).toBe(6);
    expect(values(NORMAL, 2)[0]?.targetThreat).toBe(12);
  });

  it("Balanced: 12 with one hero; stage 2 and every other value are the printed ones", () => {
    const solo = values(BALANCED, 1);
    const normalSolo = values(NORMAL, 1);
    expect(solo[0]?.targetThreat).toBe(12);
    expect(solo[1]).toEqual(normalSolo[1]);
    expect({ ...solo[0], targetThreat: 0 }).toEqual({ ...normalSolo[0], targetThreat: 0 });
  });

  it("Balanced: two heroes already have 12, and nothing changes", () => {
    expect(values(BALANCED, 2)).toEqual(values(NORMAL, 2));
    expect(values(BALANCED, 2)[0]?.targetThreat).toBe(12);
  });
});

describe("2. Nebula's Ship: remove 1 evasion counter after Nebula takes 3+ damage from an attack (Balanced)", () => {
  const ship = (state: GameState) => instancesOf(state, "16093")[0]!;
  const counters = (state: GameState) => inst(state, ship(state)).counters.evasion ?? 0;
  const villainOf = (state: GameState) => state.villains[0]!.instanceId;
  function nebulaAt(choice: RunChoice, evasion: number): GameState {
    const { state } = buildGame(logAt(NEBULA, choice, 1), choice, 1);
    return runWave3(patchInstance(state, ship(state), { counters: { evasion } }), toHero());
  }
  /** Root Stomp (16005): a 5 damage attack. */
  const stomp = (state: GameState): GameState => playFromHand(state, "16005", 2).state;

  it("Normal: a 5 damage hit leaves the counters alone", () => {
    expect(counters(stomp(nebulaAt(NORMAL, 3)))).toBe(3);
  });

  it("Balanced: the hit removes exactly 1 counter, and the Power Stone moving resolves as well", () => {
    const state = nebulaAt(BALANCED, 3);
    const [stone] = instancesOf(state, "16149");
    expect(inst(state, stone!).attachedTo).toBe(villainOf(state));
    const after = stomp(state);
    expect(counters(after)).toBe(2);
    expect(inst(after, stone!).attachedTo).toBe(state.players[0]!.identity.instanceId);
  });

  it("limit once per round: a second 3+ damage hit in the same round removes nothing more", () => {
    const once = stomp(nebulaAt(BALANCED, 3));
    expect(counters(once)).toBe(2);
    expect(counters(stomp(once))).toBe(2);
  });

  it("the limit is per round: next round the guard removes a counter again", () => {
    const once = stomp(nebulaAt(BALANCED, 3));
    expect(counters(once)).toBe(2);
    // The villain phase places 1 evasion counter, then a new round begins.
    const nextRound = settle(runWave3(once, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    const before = counters(nextRound);
    expect(before).toBeGreaterThanOrEqual(3);
    // Space Pirates left a minion engaged, and the attack would take it as the only target: clear it away (surgery).
    const minions = Object.values(nextRound.instances)
      .filter((i) => i.engagedWith !== null)
      .map((i) => i.instanceId);
    const deckId = Object.keys(nextRound.encounterDecks)[0]!;
    const cleared: GameState = {
      ...nextRound,
      players: nextRound.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => !minions.includes(id)) })),
      encounterDecks: {
        ...nextRound.encounterDecks,
        [deckId]: {
          ...nextRound.encounterDecks[deckId]!,
          discard: [...nextRound.encounterDecks[deckId]!.discard, ...minions],
        },
      },
      instances: Object.fromEntries(
        Object.entries(nextRound.instances).map(([id, i]) => [
          id,
          minions.includes(i.instanceId) ? { ...i, engagedWith: null } : i,
        ]),
      ),
    };
    // Evasive Maneuvering's Special stunned the hero during the villain phase: a stunned attack only removes the stun.
    const aimed = stomp(
      patchInstance(cleared, cleared.players[0]!.identity.instanceId, {
        statuses: { stunned: 0, confused: 0, tough: 0 },
      }),
    );
    expect(counters(aimed)).toBe(before - 1);
  });

  it("with no counter on the ship it does not trigger and does not spend the limit", () => {
    const empty = stomp(nebulaAt(BALANCED, 0));
    expect(counters(empty)).toBe(0);
    // A counter that arrives later in the same round is still removed by the next hit.
    const refilled = patchInstance(empty, ship(empty), { counters: { evasion: 2 } });
    expect(counters(stomp(refilled))).toBe(1);
  });

  it("damage taken, not dealt: a tough status card stops it, and the counter stays", () => {
    const state = nebulaAt(BALANCED, 3);
    const toughened = patchInstance(state, villainOf(state), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const after = stomp(toughened);
    expect(inst(after, villainOf(after)).statuses.tough).toBe(0);
    expect(counters(after)).toBe(3);
  });

  it("a hit of less than 3 does not trigger", () => {
    const state = nebulaAt(BALANCED, 3);
    const damageBefore = inst(state, villainOf(state)).damage;
    const hit = runWave3(state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: state.players[0]!.identity.instanceId,
      targetInstanceId: villainOf(state),
    });
    const dealt = inst(hit, villainOf(hit)).damage - damageBefore;
    expect(dealt).toBeGreaterThan(0);
    expect(dealt).toBeLessThan(3);
    expect(counters(hit)).toBe(3);
  });
});
