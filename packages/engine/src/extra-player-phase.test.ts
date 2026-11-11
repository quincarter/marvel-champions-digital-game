/**
 * "Start another player phase" in place of the villain phase, within the same round (`EffectSpec
 * replaceNextVillainPhaseWithPlayerPhase`, `GameState.villainPhasesReplacedByPlayerPhase`). Custom content: Out of the
 * Game (Gwenpool by PatataSaurio), "Forced Interrupt: When the villain phase is about to begin, instead remove this card
 * from the game → start again player phase", whose author adds: the round does not end, "once per round" limits do not
 * refresh, "until the end of the round" effects carry on, the first player does not change and no threat is placed.
 *
 * Sources: RRG 1.8 "Round Overview" (p. 4: the round ends at step 10, after the villain phase), "Player Phase" (p. 34:
 * after each player has taken a turn, the players discard down or draw up to their hand size and ready), "End of Player
 * Phase" (p. 18, steps 1-5), "Cancel" (p. 11). The extra player phase is a player phase, so it ends with its own
 * discard, draw and ready.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const one = { kind: "const", value: 1 } as const;
const tally = (name: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "mainScheme" },
  counterType: name,
  amount: one,
});
const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};

/** "Start another player phase instead of the next villain phase." */
const AGAIN = action("again", { kind: "replaceNextVillainPhaseWithPlayerPhase" });
const SKIP = action("skip", { kind: "skipNextVillainPhase" });
const villainWard = (until: "endOfPhase" | "endOfRound"): EffectSpec => ({
  kind: "applyRuleUntil",
  rule: { kind: "cannotTakeDamage", target: { categories: ["villain"] } },
  until,
});
const ROUND_WARD = action("round-ward", villainWard("endOfRound"));
const PHASE_WARD = action("phase-ward", villainWard("endOfPhase"));
const LATER = action("later", { kind: "atEndOfRound", effects: [tally("delayed")] });

/** Out of the Game's shape: cancel the beginning, remove itself from the game, play a player phase instead. */
const OUT_OF_THE_GAME = stubAbility(
  "out.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseBeginning", eventIs: { phase: "villain" } } },
    effects: [
      { kind: "cancelTriggeringEvent" },
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "removedFromGame" },
      { kind: "replaceNextVillainPhaseWithPlayerPhase" },
    ],
  }),
);
const OUT_CARD = stubSupport({ id: "out-of-the-game", cost: 0, abilities: [OUT_OF_THE_GAME.ref] });

/** Counts the round's timing points on the main scheme. */
const watch = (id: string, on: "phaseBeginning" | "phaseEnding", phase: "player" | "villain", interrupt = true) =>
  stubAbility(
    `watcher.${id}`,
    def({
      trigger: interrupt
        ? { kind: "interrupt", forced: true, on: { on, eventIs: { phase } } }
        : { kind: "response", forced: true, on: { on, eventIs: { phase } } },
      effects: [tally(id)],
    }),
  );
const PLAYER_BEGINS = watch("playerBegins", "phaseBeginning", "player");
const VILLAIN_BEGUN = watch("villainBegun", "phaseBeginning", "villain", false);
const VILLAIN_ENDS = watch("villainEnds", "phaseEnding", "villain");
/** "Action: … (Limit once per round.)" and "(Limit once per phase.)" */
const PER_ROUND = stubAbility(
  "watcher.per-round",
  def({ trigger: { kind: "action" }, limit: { count: 1, period: "round" }, effects: [tally("perRound")] }),
);
const PER_PHASE = stubAbility(
  "watcher.per-phase",
  def({ trigger: { kind: "action" }, limit: { count: 1, period: "phase" }, effects: [tally("perPhase")] }),
);
const WATCHER = stubSupport({
  id: "watcher",
  cost: 0,
  abilities: [PLAYER_BEGINS.ref, VILLAIN_BEGUN.ref, VILLAIN_ENDS.ref, PER_ROUND.ref, PER_PHASE.ref],
});

const deps = depsOf(
  AGAIN.ability,
  SKIP.ability,
  ROUND_WARD.ability,
  PHASE_WARD.ability,
  LATER.ability,
  OUT_OF_THE_GAME,
  PLAYER_BEGINS,
  VILLAIN_BEGUN,
  VILLAIN_ENDS,
  PER_ROUND,
  PER_PHASE,
);

/** Two players at the first turn, P1 with the watcher in play. */
function start(): { readonly state: GameState; readonly watcher: InstanceId } {
  const state = gameAtFirstTurn({
    players: 2,
    cards: [AGAIN.card, SKIP.card, ROUND_WARD.card, PHASE_WARD.card, LATER.card, WATCHER, OUT_CARD],
    deps,
    deck: [
      WATCHER.id,
      OUT_CARD.id,
      ...[AGAIN, SKIP, ROUND_WARD, PHASE_WARD, LATER].flatMap((e) => copiesOf(e.card.id, 3)),
      ...copiesOf(AGAIN.card.id, 20),
    ],
    encounter: copiesOf(TREACHERY.id, 30),
  });
  const placed = playerCardIntoPlay(state, WATCHER.id);
  return { state: placed.state, watcher: placed.id };
}

const play = (state: GameState, card: { readonly id: string }, player = P1) =>
  playFree(state, deps, card.id as never, player).state;
const endTurns: readonly Command[] = [
  { type: "endTurn", playerId: P1 },
  { type: "endTurn", playerId: P2 },
];
/** Both players end their turns and the game runs on to the next turn; the log replays to the same state. */
function endPhase(state: GameState) {
  const driven = driveSession(startSession(state), deps, endTurns);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const counter = (state: GameState, name: string) =>
  mustInstance(state, state.mainScheme.instanceId).counters[name] ?? 0;
const use = (state: GameState, watcher: InstanceId, abilityId: string) =>
  sessionApply(
    startSession(state),
    { type: "useAbility", playerId: P1, cardInstanceId: watcher, abilityId: abilityId as never, payment: [] },
    deps,
  );
const hitBlocked = (state: GameState): boolean =>
  state.lastingEffects.some((e) => e.kind === "ruleGrant" && e.rule.kind === "cannotTakeDamage");

describe("a player phase in place of the villain phase, within the same round", () => {
  it("control: without it, the round ends with a villain phase", () => {
    const { state, events } = endPhase(start().state);
    expect(of(events, "threatPlaced").length).toBeGreaterThan(0);
    expect(state.firstPlayerId).toBe(P2);
  });

  it("no threat, activation, deal, reveal or token pass; same round and first player; a new player phase begins", () => {
    const game = play(start().state, AGAIN.card);
    expect(game.villainPhasesReplacedByPlayerPhase).toBe(1);
    const threat = mustInstance(game, game.mainScheme.instanceId).threat;
    const { state, events } = endPhase(game);

    expect(state.round).toBe(game.round);
    expect(state.firstPlayerId).toBe(P1);
    expect(state.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P1, remainingPlayerIds: [P2] });
    expect(state.villainPhasesReplacedByPlayerPhase).toBeUndefined();
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(threat);
    for (const type of ["threatPlaced", "enemyActivated", "encounterCardRevealed", "roundStarted"] as const)
      expect(of(events, type)).toEqual([]);
    expect(of(events, "firstPlayerChanged")).toEqual([]);
    expect(of(events, "villainPhaseSkipped")).toEqual([
      { type: "villainPhaseSkipped", round: game.round, remaining: 0, playerPhaseInstead: true },
    ]);
    // The first player phase ended as always (discard, draw, ready), and the new one began.
    expect(of(events, "handRefilled").map((e) => e.playerId)).toEqual([P1, P2]);
    expect(counter(state, "playerBegins")).toBe(1);
    expect([counter(state, "villainBegun"), counter(state, "villainEnds")]).toEqual([0, 0]);
  });

  it("the extra phase ends with its own discard, draw and ready, then the villain phase and the round's end follow", () => {
    const extra = endPhase(play(start().state, AGAIN.card)).state;
    const { state, events } = endPhase(extra);
    expect(of(events, "handRefilled").map((e) => e.playerId)).toEqual([P1, P2]);
    expect(of(events, "threatPlaced").length).toBeGreaterThan(0);
    expect(of(events, "encounterCardRevealed")).toHaveLength(2);
    expect(state.round).toBe(extra.round + 1);
    expect(state.firstPlayerId).toBe(P2);
    expect([counter(state, "villainBegun"), counter(state, "villainEnds")]).toEqual([1, 1]);
  });

  it("'until the end of the round' and 'at the end of the round' wait for the round's real end; 'until the end of the phase' ends", () => {
    const game = play(play(play(play(start().state, AGAIN.card), ROUND_WARD.card), LATER.card), PHASE_WARD.card);
    expect(wards(game)).toBe(2);
    const extra = endPhase(game).state;
    expect(wards(extra)).toBe(1);
    expect(hitBlocked(extra)).toBe(true);
    expect(counter(extra, "delayed")).toBe(0);
    const after = endPhase(extra).state;
    expect(wards(after)).toBe(0);
    expect(counter(after, "delayed")).toBe(1);
  });

  it("'once per round' limits carry on into the extra phase; 'once per phase' limits are fresh", () => {
    const { state: begun, watcher } = start();
    let game = play(begun, AGAIN.card);
    for (const ability of [PER_ROUND, PER_PHASE]) {
      const used = use(game, watcher, ability.ref.id);
      if (!used.ok) throw new Error(used.error.message);
      game = used.session.state;
    }
    const extra = endPhase(game).state;
    expect(use(extra, watcher, PER_ROUND.ref.id).ok).toBe(false);
    expect(use(extra, watcher, PER_PHASE.ref.id).ok).toBe(true);
    // The round's real end refreshes the round limit.
    const next = endPhase(extra).state;
    expect(use(next, watcher, PER_ROUND.ref.id).ok).toBe(true);
  });

  it("Out of the Game: an interrupt to the villain phase beginning cancels it, leaves play, and a player phase follows", () => {
    const { state: begun } = start();
    const placed = playerCardIntoPlay(begun, OUT_CARD.id);
    const { state, events } = endPhase(placed.state);
    expect(state.round).toBe(begun.round);
    expect(state.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P1 });
    expect(state.removedFromGame).toContain(placed.id);
    expect(of(events, "threatPlaced")).toEqual([]);
    expect(of(events, "villainPhaseSkipped")).toEqual([
      { type: "villainPhaseSkipped", round: begun.round, remaining: 0, playerPhaseInstead: true },
    ]);
    // The cancelled beginning gets no response; no villain phase ended.
    expect([counter(state, "villainBegun"), counter(state, "villainEnds")]).toEqual([0, 0]);
    // The card is gone, so the next villain phase is played.
    const after = endPhase(state);
    expect(of(after.events, "threatPlaced").length).toBeGreaterThan(0);
    expect(after.state.round).toBe(begun.round + 1);
    expect(counter(after.state, "villainBegun")).toBe(1);
  });

  it("with a skip waiting too, the player phase comes first and the skip takes the villain phase after it", () => {
    const game = play(play(start().state, SKIP.card), AGAIN.card);
    const extra = endPhase(game);
    expect(extra.state.round).toBe(game.round);
    expect(extra.state.villainPhasesToSkip).toBe(1);
    const skipped = endPhase(extra.state);
    expect(of(skipped.events, "threatPlaced")).toEqual([]);
    expect(of(skipped.events, "villainPhaseSkipped")).toEqual([
      { type: "villainPhaseSkipped", round: game.round, remaining: 0 },
    ]);
    expect(skipped.state.round).toBe(game.round + 1);
  });

  it("two replacements: two extra player phases in the same round", () => {
    const game = play(play(start().state, AGAIN.card), AGAIN.card);
    expect(game.villainPhasesReplacedByPlayerPhase).toBe(2);
    const first = endPhase(game);
    expect(first.state.villainPhasesReplacedByPlayerPhase).toBe(1);
    const second = endPhase(first.state);
    expect(second.state.villainPhasesReplacedByPlayerPhase).toBeUndefined();
    expect(second.state.round).toBe(game.round);
    expect([...of(first.events, "threatPlaced"), ...of(second.events, "threatPlaced")]).toEqual([]);
  });

  it("a game that never uses it has no such field in its state", () => {
    const { state } = endPhase(start().state);
    expect("villainPhasesReplacedByPlayerPhase" in state).toBe(false);
  });
});

/** How many villain wards (lasting `cannotTakeDamage` rules) are in effect. */
function wards(state: GameState): number {
  return state.lastingEffects.filter((e) => e.kind === "ruleGrant" && e.rule.kind === "cannotTakeDamage").length;
}
