/**
 * docs/phase7-wave11-hero-packs.md H3.7 and H3.8: "Skip the next villain phase" (`EffectSpec skipNextVillainPhase`,
 * `GameState.villainPhasesToSkip`) and "until the start of the next (unskipped) villain phase" (`applyRuleUntil` with
 * `until: "nextVillainPhaseBegins"`). Synthetic events shaped like Run Them to Ground's three When Defeated bullets
 * (61020): skip the next villain phase, deal each player 1 facedown encounter card, the villain cannot take damage.
 *
 * Sources: RRG 1.8 "Villain Phase" (p. 47: steps 1-5, then step 6 ends the phase and the round), "Round Overview"
 * (p. 4: "Pass the first player token", then "End the round"), "Deal" (p. 15: a dealt card "is not revealed at this
 * time" and waits for the villain phase), "Lasting Effects" (p. 26), "Temporary" (p. 44). No rule or ruling covers a
 * skip; Q101 is open and default A is built: steps 1-5 are skipped, the round still ends, the first player token stays.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustInstance, mustPlayer } from "./query.js";
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

/** "Skip the next villain phase." */
const SKIP = action("skip", { kind: "skipNextVillainPhase" });
/** "Deal each player 1 facedown encounter card (immediately)." */
const DEAL = action("deal", { kind: "dealEncounterCard", player: { kind: "each" } });
/** "The villain cannot take damage until the start of the next (unskipped) villain phase." */
const WARD = action("ward", {
  kind: "applyRuleUntil",
  rule: { kind: "cannotTakeDamage", target: { categories: ["villain"] } },
  until: "nextVillainPhaseBegins",
});
const HIT = action("hit", { kind: "dealDamage", target: { kind: "villain" }, amount: one });

/** Listens to the round's timing points, counting each on the main scheme. */
const VILLAIN_BEGINS = stubAbility(
  "watcher.villain-begins",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseBeginning", eventIs: { phase: "villain" } } },
    effects: [tally("villainBegins")],
  }),
);
const VILLAIN_ENDS = stubAbility(
  "watcher.villain-ends",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseEnding", eventIs: { phase: "villain" } } },
    effects: [tally("villainEnds")],
  }),
);
/** "When the round ends" (the DSL's `on.roundEnding()`). */
const ROUND_ENDS = stubAbility(
  "watcher.round-ends",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseEnding", eventIs: { phase: ["villain", "round"] } } },
    effects: [tally("roundEnds")],
  }),
);
const WATCHER = stubSupport({
  id: "watcher",
  cost: 0,
  abilities: [VILLAIN_BEGINS.ref, VILLAIN_ENDS.ref, ROUND_ENDS.ref],
});
const FLEETING = stubSupport({ id: "fleeting", cost: 0, keywords: [{ name: "temporary" }] });
const villainWard = (until: "endOfPhase" | "endOfRound"): EffectSpec => ({
  kind: "applyRuleUntil",
  rule: { kind: "cannotTakeDamage", target: { categories: ["villain"] } },
  until,
});
/** "Forced Interrupt: When the player phase ends, skip the next villain phase; the villain cannot take damage this phase." */
const DUSK = stubAbility(
  "dusk.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseEnding", eventIs: { phase: "player" } } },
    effects: [{ kind: "skipNextVillainPhase" }, villainWard("endOfPhase")],
  }),
);
const DUSK_CARD = stubSupport({ id: "dusk", cost: 0, abilities: [DUSK.ref] });
/** "At the end of the round, …" (a delayed effect) and "until the end of the round" (a lasting one). */
const LATER = action("later", { kind: "atEndOfRound", effects: [tally("delayed")] });
const ROUND_WARD = action("round-ward", villainWard("endOfRound"));

const deps = depsOf(
  SKIP.ability,
  DEAL.ability,
  WARD.ability,
  HIT.ability,
  VILLAIN_BEGINS,
  VILLAIN_ENDS,
  ROUND_ENDS,
  DUSK,
  LATER.ability,
  ROUND_WARD.ability,
);

/** Two players at the first turn, P1 with the watcher and a temporary support in play. */
function start(): GameState {
  let state = gameAtFirstTurn({
    players: 2,
    cards: [SKIP.card, DEAL.card, WARD.card, HIT.card, LATER.card, ROUND_WARD.card, WATCHER, FLEETING, DUSK_CARD],
    deps,
    deck: [
      WATCHER.id,
      FLEETING.id,
      DUSK_CARD.id,
      ...[SKIP, DEAL, WARD, HIT, LATER, ROUND_WARD].flatMap((e) => copiesOf(e.card.id, 3)),
    ],
    encounter: copiesOf(TREACHERY.id, 30),
  });
  state = playerCardIntoPlay(state, WATCHER.id).state;
  return playerCardIntoPlay(state, FLEETING.id).state;
}

const play = (state: GameState, card: { readonly id: CardId }, player = P1) =>
  playFree(state, deps, card.id, player).state;
const endTurns: readonly Command[] = [
  { type: "endTurn", playerId: P1 },
  { type: "endTurn", playerId: P2 },
];
/** Both players end their turns and the round runs on to the next player phase; the log replays to the same state. */
function endRound(state: GameState) {
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
const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;
/**
 * The damage `player` deals the villain with "deal 1 damage to the villain", or `"blocked"`: the engine refuses an
 * event whose only target cannot take damage ("this event has no valid target").
 */
function hit(state: GameState, player = P1): number | "blocked" {
  try {
    return villainDamage(play(state, HIT.card, player)) - villainDamage(state);
  } catch (error) {
    if (String(error).includes("no valid target")) return "blocked";
    throw error;
  }
}
const dealt = (state: GameState) => [P1, P2].map((id) => mustPlayer(state, id).dealtEncounter);
const temporaryInPlay = (state: GameState) =>
  mustPlayer(state, P1).playArea.some((id) => mustInstance(state, id).cardId === FLEETING.id);

describe("H3.7 skipping the next villain phase (Q101 A)", () => {
  it("control: an ordinary round places threat, activates, deals, passes the token and ends the villain phase", () => {
    const game = start();
    const { state, events } = endRound(game);
    expect(state.round).toBe(game.round + 1);
    expect(of(events, "threatPlaced").length).toBeGreaterThan(0);
    expect(of(events, "enemyActivated").length).toBeGreaterThan(0);
    expect(of(events, "encounterCardRevealed")).toHaveLength(2);
    expect(state.firstPlayerId).toBe(P2);
    expect([counter(state, "villainBegins"), counter(state, "villainEnds"), counter(state, "roundEnds")]).toEqual([
      1, 1, 1,
    ]);
    expect(temporaryInPlay(state)).toBe(false);
  });

  it("two players: no threat, no activation, no deal or reveal, the token stays, and the round still ends", () => {
    const game = play(start(), SKIP.card);
    expect(game.villainPhasesToSkip).toBe(1);
    const threat = mustInstance(game, game.mainScheme.instanceId).threat;
    const { state, events } = endRound(game);

    expect(state.round).toBe(game.round + 1);
    expect(state.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P1 });
    expect(state.villainPhasesToSkip).toBe(0);
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(threat);
    expect(of(events, "threatPlaced")).toEqual([]);
    expect(of(events, "enemyActivated")).toEqual([]);
    expect(of(events, "encounterCardRevealed")).toEqual([]);
    expect(of(events, "firstPlayerChanged")).toEqual([]);
    expect(state.firstPlayerId).toBe(P1);
    // Logged: the round's end was reached with the skip recorded on its step, and no step of the villain phase ran.
    const steps = of(events, "stepChanged").map((e) => e.to.kind);
    expect(steps).not.toContain("placeThreat");
    expect(steps).not.toContain("passFirstPlayer");
    expect(of(events, "stepChanged").some((e) => e.to.kind === "endOfRound" && e.to.villainPhaseSkipped)).toBe(true);
    expect(of(events, "villainPhaseSkipped")).toEqual([
      { type: "villainPhaseSkipped", round: game.round, remaining: 0 },
    ]);
    // The villain phase neither began nor ended; the round ended, and temporary resolved with it.
    expect([counter(state, "villainBegins"), counter(state, "villainEnds"), counter(state, "roundEnds")]).toEqual([
      0, 0, 1,
    ]);
    expect(temporaryInPlay(state)).toBe(false);
  });

  it("the round's end still happens: an 'at the end of the round' delayed effect resolves, an 'until the end of the round' rule ends", () => {
    const game = play(play(play(start(), SKIP.card), LATER.card), ROUND_WARD.card);
    expect(hit(game)).toBe("blocked");
    const { state, events } = endRound(game);
    expect(of(events, "threatPlaced")).toEqual([]);
    expect(counter(state, "delayed")).toBe(1);
    expect(state.lastingEffects).toEqual([]);
    expect(hit(state)).toBe(1);
  });

  it("a skip made as the player phase ends skips the villain phase about to start; its 'until the end of the phase' rule still expires", () => {
    const game = playerCardIntoPlay(start(), DUSK_CARD.id).state;
    const { state, events } = endRound(game);
    expect(of(events, "villainPhaseSkipped")).toEqual([
      { type: "villainPhaseSkipped", round: game.round, remaining: 0 },
    ]);
    expect(of(events, "threatPlaced")).toEqual([]);
    expect(of(events, "enemyActivated")).toEqual([]);
    expect(state.firstPlayerId).toBe(P1);
    // The ward was made under the player phase's end, so it outlasts that end and expires as the round ends; the
    // villain phase's end is never raised, the round's is.
    expect(of(events, "lastingEffectAdded")).toHaveLength(1);
    expect(state.lastingEffects).toEqual([]);
    expect([counter(state, "villainEnds"), counter(state, "roundEnds")]).toEqual([0, 1]);
    // Engine reading (flow.ts `skipsVillainPhaseNow`): its beginning was already answered when the skip was made.
    expect(counter(state, "villainBegins")).toBe(1);
  });

  it("only the next villain phase: the one after is played in full, and the token passes then", () => {
    const skipped = endRound(play(start(), SKIP.card)).state;
    const { state, events } = endRound(skipped);
    expect(of(events, "threatPlaced").length).toBeGreaterThan(0);
    expect(of(events, "encounterCardRevealed")).toHaveLength(2);
    expect(state.firstPlayerId).toBe(P2);
    expect(counter(state, "villainBegins")).toBe(1);
  });

  it("two skips skip two villain phases", () => {
    const twice = play(play(start(), SKIP.card), SKIP.card);
    expect(twice.villainPhasesToSkip).toBe(2);
    const first = endRound(twice);
    const second = endRound(first.state);
    expect([...of(first.events, "threatPlaced"), ...of(second.events, "threatPlaced")]).toEqual([]);
    expect(second.state.villainPhasesToSkip).toBe(0);
    expect(counter(second.state, "roundEnds")).toBe(2);
  });

  it("cards dealt 'immediately' wait through the skipped phase and are revealed in the next villain phase played", () => {
    const game = play(play(start(), SKIP.card), DEAL.card);
    const held = dealt(game);
    expect(held.map((cards) => cards.length)).toEqual([1, 1]);
    const skipped = endRound(game);
    expect(dealt(skipped.state)).toEqual(held);
    const next = endRound(skipped.state);
    const revealed = of(next.events, "encounterCardRevealed").map((e) => e.instanceId);
    for (const id of held.flat()) expect(revealed).toContain(id);
    expect(dealt(next.state).flat()).toEqual([]);
  });
});

describe("H3.8 'until the start of the next (unskipped) villain phase'", () => {
  it("lasts through the skipped phase and the next player phase, and ends as the next villain phase played begins", () => {
    const warded = play(play(start(), SKIP.card), WARD.card);
    expect(hit(warded)).toBe("blocked");

    const skipped = endRound(warded).state;
    expect(skipped.lastingEffects).toMatchObject([{ kind: "ruleGrant", duration: { kind: "nextVillainPhaseBegins" } }]);
    // The next player phase: still no damage, from either player.
    expect(hit(skipped)).toBe("blocked");
    expect(hit(skipped, P2)).toBe("blocked");

    const played = endRound(skipped).state;
    expect(played.lastingEffects).toEqual([]);
    expect(hit(played)).toBe(1);
  });

  it("control: with no skip it ends at this round's villain phase", () => {
    const warded = play(start(), WARD.card);
    const { state } = endRound(warded);
    expect(state.lastingEffects).toEqual([]);
    expect(hit(warded)).toBe("blocked");
    expect(hit(state)).toBe(1);
  });
});
