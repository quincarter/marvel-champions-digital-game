/**
 * docs/phase7-wave6.md §3.21 (verification, "exists (verify)"): a villain sequence of different titles, the Mansion
 * Attack shape (MC32 p. 15) as the Loki shape (`villain-swap.test.ts`) rather than The Sinister Six's. Synthetic
 * villains with different titles (Avalanche, Blob, Toad), one in play and the rest set aside (`randomStartingVillain`),
 * `victory: "cardAbility"`, and Save the School's printed response, written as the spec writes it:
 *
 *   response(on.defeated(theVillain), ifThen(compare(victoryDisplayCount(villains), "atLeast", victoryCondition),
 *     endGame("win"), [dealEncounterCard(each), addVillain(random set-aside villain, { reveal })]))
 *
 * Sources: MC32 p. 15 (Mansion Attack setup); RRG 1.8 "Villain Defeat" (p. 47), "Victory X" (p. 46), "Toughness" (p. 45),
 * "Activation" (p. 6: an enemy that leaves play mid-activation ends it), "Set Aside" (p. 39); wave 5 §3.1 (zero villains
 * in play is a legal state, `set-aside-villains.test.ts`).
 */

import { flat, type CardId, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { mustInstance, undefeatedVillains } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "./testing/scenario.js";
import { copiesOf, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const brother = (id: string, name: string): VillainCard =>
  stubVillain({
    id,
    name,
    stages: [
      {
        hp: flat(10),
        atk: 0,
        sch: id === "blob" || id === "toad" ? 3 : 1,
        keywords: [{ name: "victory", value: 1 }, ...(id === "avalanche" ? [] : [{ name: "toughness" } as const])],
      },
    ],
  });
const AVALANCHE = brother("avalanche", "Avalanche");
const BLOB = brother("blob", "Blob");
const TOAD = brother("toad", "Toad");

const noVillain: EffectSpec = {
  kind: "if",
  condition: { kind: "not", of: { kind: "exists", query: { categories: ["villain"] } } },
  then: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "sawNoVillain", amount: { kind: "const", value: 1 } },
  ],
};
/** Save the School's response; the first effect only probes what the response sees. */
const SAVE_THE_SCHOOL = stubAbility("save-the-school.response", {
  trigger: { kind: "response", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["villain"] } } },
  effects: [
    noVillain,
    {
      kind: "if",
      condition: {
        kind: "compare",
        left: { kind: "victoryDisplayCount", filter: { categories: ["villain"] } },
        op: "atLeast",
        right: { kind: "victoryCondition" },
      },
      then: [{ kind: "endGame", result: "win" }],
      otherwise: [
        { kind: "dealEncounterCard", player: { kind: "each" } },
        {
          kind: "selectCards",
          slot: "next",
          cards: {
            kind: "encounterSetAside",
            filter: { categories: ["villain"] },
            random: { kind: "const", value: 1 },
          },
        },
        { kind: "addVillain", villain: { kind: "slot", slot: "next" }, reveal: true },
      ],
    },
  ],
});
const MAIN = stubMainScheme({
  id: "brotherhood-strikes",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), abilities: [SAVE_THE_SCHOOL.ref] },
  ],
});

/** Forced interrupt: when Avalanche would activate, he is defeated (a villain dying mid-activation). */
const DOOMED = stubAbility("doomed.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "enemyActivating", targetIs: { categories: ["villain"], name: "Avalanche" } },
  },
  effects: [{ kind: "dealDamage", target: { kind: "eventTarget" }, amount: { kind: "const", value: 99 } }],
});
const TRAP = stubSupport({ id: "trap", cost: 0, abilities: [DOOMED.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const SLAY_ABILITY = stubAbility("slay.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 10 } }],
});
const SLAY = stubEvent({ id: "slay", cost: 0, abilities: [SLAY_ABILITY.ref] });

const deps: EngineDeps = depsOf(SAVE_THE_SCHOOL, DOOMED, SLAY_ABILITY);

function start(setAside: readonly VillainCard[] = [BLOB, TOAD]): GameState {
  const result = createGame(
    {
      seed: 8,
      cards: [...DEFAULT_CARDS, AVALANCHE, BLOB, TOAD, MAIN, TRAP, FILLER, SLAY],
      villainCardId: AVALANCHE.id,
      setAsideVillainCardIds: setAside.map((card) => card.id),
      mainSchemeCardId: MAIN.id,
      encounterDeck: copiesOf(FILLER.id, 10),
      victory: "cardAbility",
      victoryCondition: 2,
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, TRAP.id, ...copiesOf(SLAY.id, 3)] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}
const mainCounter = (state: GameState, type: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters[type] ?? 0;
const setAsideVillains = (state: GameState): readonly CardId[] =>
  state.encounterSetAside.flatMap((id) =>
    state.cardPool[mustInstance(state, id).cardId]?.type === "villain" ? [mustInstance(state, id).cardId] : [],
  );
const inDisplay = (state: GameState): readonly CardId[] =>
  state.victoryDisplay.map((id) => mustInstance(state, id).cardId);
describe("§3.21 Mansion Attack: a sequence of villains with different titles", () => {
  it("defeating the first villain (Victory 1, condition 2) puts it in the victory display, and the response runs with NO villain in play", () => {
    const { state, session } = playFree(start(), deps, SLAY.id);
    expect(inDisplay(state)).toEqual([AVALANCHE.id]);
    // The response saw zero villains in play before it added the next one: no auto-advance (`advanceToSetAsideVillain`
    // is title-bound and finds no Avalanche set aside), and no win at one villain in the display of two.
    expect(mainCounter(state, "sawNoVillain")).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the response deals each player an encounter card and brings in a random set-aside villain of another title, tough", () => {
    const before = start();
    const { state } = playFree(before, deps, SLAY.id);
    expect(state.outcome).toBeNull();
    const now = undefeatedVillains(state);
    expect(now).toHaveLength(1);
    const entered = now[0]!;
    expect([BLOB.id, TOAD.id]).toContain(entered.cardId);
    expect(state.activeVillainId).toBe(entered.instanceId);
    expect(setAsideVillains(state)).toHaveLength(1);
    expect(setAsideVillains(state)).not.toContain(entered.cardId);
    // Toughness applies on entering play (RRG 1.8 "Toughness", p. 45).
    expect(mustInstance(state, entered.instanceId).statuses.tough).toBe(1);
    expect(mustInstance(state, entered.instanceId).damage).toBe(0);
    // dealEncounterCard(each): one encounter card dealt to the lone player (revealed later, RRG 1.8 "Deal", p. 15).
    expect(state.players[0]!.dealtEncounter).toHaveLength(1);
  });

  it("the second defeat reaches the victory condition: the response wins instead of adding a villain", () => {
    const first = playFree(start(), deps, SLAY.id).state;
    // The tough status card the entering villain got (RRG 1.8 "Tough", p. 44) absorbs the first hit.
    const second = playFree(playFree(first, deps, SLAY.id).state, deps, SLAY.id).state;
    expect(inDisplay(second)).toHaveLength(2);
    expect(second.outcome?.result).toBe("win");
    expect(setAsideVillains(second)).toHaveLength(1);
  });

  it("with nothing set aside the response finds no villain to add and the game does not end", () => {
    const { state } = playFree(start([]), deps, SLAY.id);
    expect(undefeatedVillains(state)).toHaveLength(0);
    expect(state.outcome).toBeNull();
  });

  it("an activation the old villain was making ends when he is defeated mid-activation (RRG 1.8 'Activation', 'Villain Defeat')", () => {
    // Control: without the trap Avalanche's activation schemes for his SCH of 1.
    const plain = start();
    const plainStep = plain.step;
    if (plainStep.kind !== "turn") throw new Error(`expected a turn, got ${plainStep.kind}`);
    const control = driveSession(startSession(plain), deps, [{ type: "endTurn", playerId: plainStep.activePlayerId }]);
    expect(mustInstance(control.session.state, plain.mainScheme.instanceId).threat).toBe(1);
    const trapped = playerCardIntoPlay(start(), TRAP.id).state;
    const step = trapped.step;
    if (step.kind !== "turn") throw new Error(`expected a turn, got ${step.kind}`);
    const { session } = driveSession(startSession(trapped), deps, [{ type: "endTurn", playerId: step.activePlayerId }]);
    const after = session.state;
    expect(inDisplay(after)).toContain(AVALANCHE.id);
    expect(undefeatedVillains(after)).toHaveLength(1);
    // Avalanche's own scheme (1) never resolves, and neither does the new villain finish his activation (Blob and Toad
    // scheme for 3): the main scheme has no threat from this villain phase's activation of either.
    expect(mustInstance(after, after.mainScheme.instanceId).threat).toBe(0);
  });
});
