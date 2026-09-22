/**
 * docs/phase7-wave3.md §3.2: the round structure's own timing points as trigger events — `phaseBeginning`,
 * `phaseEnding` (the villain phase's end is the round's end) and `villainStepResolved` ("after resolving step one of the
 * villain phase"). Proven with a synthetic support that listens to each, shaped like Museum Ship / Nebula's Ship ("When
 * the villain phase begins"), Blazing Inferno ("After the villain phase begins"), Bombardment ("After resolving step one
 * of the villain phase"), the Collector's ∞ face and Regroup ("When the round ends"), and Rogue Vessel ("When the
 * villain phase ends").
 *
 * Sources: RRG 1.8 "Round Overview" (p. 4), "End of Player Phase" (p. 18), "Villain Phase" (p. 47) steps 1 and 6,
 * "Delayed Effect" (p. 15), "Lasting Effects" (p. 26).
 */

import { type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import type { TriggerEventKind } from "./trigger-events.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, HERO, MAIN_SCHEME } from "./testing/scenario.js";

const p1 = playerId("p1");
const self: TargetRef = { kind: "self" };
const mainScheme: TargetRef = { kind: "mainScheme" };
const n = (value: number): ValueSpec => ({ kind: "const", value });
const counters = (counterType: string): ValueSpec => ({ kind: "counters", of: self, counterType });
const add = (counterType: string, amount: ValueSpec = n(1)): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount,
});
/** Bumps a shared `seq` counter, then records its new value under `label`: the order the listeners resolved in. */
const stamp = (label: string): readonly EffectSpec[] => [add("seq"), add(label, counters("seq"))];

const listener = (
  id: string,
  timing: "interrupt" | "response",
  on: TriggerEventKind,
  eventIs: Readonly<Record<string, string>>,
  effects: readonly EffectSpec[],
): StubAbility => {
  const definition: AbilityDefinition = {
    trigger: { kind: timing, forced: true, on: { on, eventIs } },
    effects,
  };
  return stubAbility(id, definition);
};

// "When the villain phase begins" records the main scheme's threat before step one has placed any.
const VILLAIN_BEGINS_I = listener("clock.villain-begins-i", "interrupt", "phaseBeginning", { phase: "villain" }, [
  ...stamp("villainBeginsI"),
  add("threatAtBegin", { kind: "threat", of: mainScheme }),
]);
const VILLAIN_BEGINS_R = listener("clock.villain-begins-r", "response", "phaseBeginning", { phase: "villain" }, [
  ...stamp("villainBeginsR"),
]);
// "After resolving step one of the villain phase" sees step one's threat.
const STEP_ONE = listener("clock.step-one", "response", "villainStepResolved", { step: "placeThreat" }, [
  ...stamp("stepOne"),
  add("threatAfterStepOne", { kind: "threat", of: mainScheme }),
]);
// "When the round ends" (= "when the villain phase ends"), an "at the end of the round" delayed effect scheduled at the
// start of the villain phase, and "After the round ends".
const ROUND_ENDS_I = listener("clock.round-ends-i", "interrupt", "phaseEnding", { phase: "villain" }, [
  ...stamp("roundEndsI"),
]);
const ROUND_ENDS_R = listener("clock.round-ends-r", "response", "phaseEnding", { phase: "villain" }, [
  ...stamp("roundEndsR"),
]);
const SCHEDULE = listener("clock.schedule", "response", "phaseBeginning", { phase: "villain" }, [
  { kind: "atEndOfRound", effects: stamp("delayedRound") },
]);
const PLAYER_BEGINS = listener("clock.player-begins", "response", "phaseBeginning", { phase: "player" }, [
  ...stamp("playerBegins"),
]);
const PLAYER_ENDS = listener("clock.player-ends", "interrupt", "phaseEnding", { phase: "player" }, [
  ...stamp("playerEnds"),
]);
const CLOCK_ABILITIES = [
  VILLAIN_BEGINS_I,
  VILLAIN_BEGINS_R,
  STEP_ONE,
  ROUND_ENDS_I,
  ROUND_ENDS_R,
  SCHEDULE,
  PLAYER_BEGINS,
  PLAYER_ENDS,
];
const CLOCK = stubSupport({ id: "clock", cost: 0, abilities: CLOCK_ABILITIES.map((ability) => ability.ref) });

/** A player-turn threat placement on the main scheme, which "after resolving step one" must not hear. */
const PLACE_THREAT_ABILITY = stubAbility("place-threat.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "placeThreat", target: mainScheme, amount: n(2) }],
});
const PLACE_THREAT = stubEvent({ id: "place-threat", cost: 0, abilities: [PLACE_THREAT_ABILITY.ref] });

const deps: EngineDeps = depsOf(...CLOCK_ABILITIES, PLACE_THREAT_ABILITY);
const CARDS: readonly AnyCard[] = [...DEFAULT_CARDS, CLOCK, PLACE_THREAT];
const copies = (id: CardId, count: number): readonly CardId[] => Array.from({ length: count }, () => id);

function drive(session: GameSession, commands: readonly Command[]) {
  let current = session;
  const events: GameEvent[] = [];
  const apply = (command: Command): void => {
    const result = sessionApply(current, command, deps);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    current = result.session;
    events.push(...result.events);
  };
  const answer = (): void => {
    for (let guard = 0; current.state.pendingChoice && !current.state.outcome; guard++) {
      if (guard > 200) throw new Error("choices did not settle");
      const choice = current.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: defaultPick(current.state),
      });
    }
  };
  answer();
  for (const command of commands) {
    apply(command);
    answer();
  }
  return { session: current, events };
}

/** A game at p1's first turn with the clock support in play and a place-threat event in hand (all before the log). */
function start(withClock = true): { session: GameSession; placeThreat: InstanceId } {
  const result = createGame(
    {
      seed: 5,
      cards: CARDS,
      villainCardId: DEFAULT_CARDS[4]!.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: copies(DEFAULT_CARDS[6]!.id, 30),
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, CLOCK.id, PLACE_THREAT.id] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  let state = drive(startSession(result.state), []).session.state;
  const threat = giveCard(state, p1, PLACE_THREAT.id);
  state = threat.state;
  if (withClock) {
    const clock = giveCard(state, p1, CLOCK.id);
    const player = mustPlayer(clock.state, p1);
    state = {
      ...clock.state,
      players: clock.state.players.map((p) =>
        p.playerId === p1
          ? { ...p, hand: player.hand.filter((id) => id !== clock.id), playArea: [...player.playArea, clock.id] }
          : p,
      ),
      instances: { ...clock.state.instances, [clock.id]: { ...mustInstance(clock.state, clock.id), controllerId: p1 } },
    };
  }
  return { session: startSession(state), placeThreat: threat.id };
}

const endTurn: Command = { type: "endTurn", playerId: p1 };
const clockOf = (state: GameState): Readonly<Record<string, number>> => {
  const id = mustPlayer(state, p1).playArea.find((candidate) => state.instances[candidate]?.cardId === CLOCK.id);
  if (!id) throw new Error("no clock in play");
  return mustInstance(state, id).counters;
};

describe("§3.2 the round structure's timing points", () => {
  it("resolve in RRG order through one round, each once", () => {
    const { session } = start();
    const { session: after } = drive(session, [endTurn]);
    const seen = clockOf(after.state);
    // Player phase ends (step 5) → villain phase begins (interrupt, then response; the delayed effect is scheduled by
    // the response) → step one → … → the round ends (interrupt, its delayed effect, then response) → the next round's
    // player phase begins.
    expect(seen).toMatchObject({
      playerEnds: 1,
      villainBeginsI: 2,
      villainBeginsR: 3,
      stepOne: 4,
      roundEndsI: 5,
      delayedRound: 6,
      roundEndsR: 7,
      playerBegins: 8,
      seq: 8,
    });
  });

  it("the villain phase begins before step one places threat, and 'after step one' sees that threat", () => {
    const { session } = start();
    const seen = clockOf(drive(session, [endTurn]).session.state);
    expect(seen["threatAtBegin"] ?? 0).toBe(0);
    // MAIN_SCHEME's acceleration is 1.
    expect(seen["threatAfterStepOne"]).toBe(1);
  });

  it("'after resolving step one' does not hear threat placed at any other time", () => {
    const { session, placeThreat } = start();
    const { session: played } = drive(session, [
      { type: "playCard", playerId: p1, cardInstanceId: placeThreat, payment: [], attachToInstanceId: null },
    ]);
    expect(clockOf(played.state)["stepOne"]).toBeUndefined();
  });

  it("with nothing listening, the new events are never pushed, so the log is as before", () => {
    const NEW_KINDS: readonly string[] = ["phaseBeginning", "phaseEnding", "villainStepResolved"];
    const kindsIn = (events: readonly GameEvent[]): readonly string[] =>
      events.flatMap((event) => (event.type === "triggerEvent" ? [event.event.kind] : []));
    const quiet = kindsIn(drive(start(false).session, [endTurn]).events);
    expect(quiet.filter((kind) => NEW_KINDS.includes(kind))).toEqual([]);
    // The positive control: with the clock in play, every one of them is on the log.
    const loud = kindsIn(drive(start(true).session, [endTurn]).events);
    for (const kind of NEW_KINDS) expect(loud).toContain(kind);
  });

  it("replaying a round with every listener reproduces the same state", () => {
    const { session } = start();
    const { session: after } = drive(session, [endTurn]);
    const replayed = replay(after.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after.state);
  });
});
