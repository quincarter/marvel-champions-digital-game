/**
 * docs/phase7-wave8.md §3.39: a named moment a script raises (`EffectSpec raiseMoment`) and other cards answer
 * (`TriggerEvent momentRaised`, named by `EventPattern.eventIs: { name }`; the DSL's `on.moment(name)`).
 *
 * RRG 1.8 "Triggering Condition" (p. 45), "Response" (p. 38), "Forced" (p. 20) and "Ability" (p. 5, Simultaneous
 * Timing Priority: forced before optional; the first player orders simultaneous forced abilities). MC45 p. 6: "Mission
 * attempts are triggered by the Mission Team (171A) support card."
 *
 * Synthetic cards. "Team" is a support whose action stands for the attempt: step 5 places a counter, the script raises
 * `"missionAttempt"`, and one more counter follows the raise. "Mission" is an encounter side scheme with "Forced
 * Response: After you resolve a mission attempt, deal 2 damage to your identity" (the shape of a mission's a face,
 * with a number a test can read).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, PlayerRef, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const MOMENT = "missionAttempt";
const you: PlayerRef = { kind: "controller" };
const self: TargetRef = { kind: "self" };
const yourIdentity: TargetRef = { kind: "identityOf", player: you };
const constant = (value: number) => ({ kind: "const", value }) as const;
const count = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount: constant(1),
});
const raise = (name: string, player: PlayerRef = you): EffectSpec => ({ kind: "raiseMoment", name, player });

/** What `on.moment(name)` compiles to: "after **you** resolve …". */
const youResolve = (name: string): EventPattern => ({ on: "momentRaised", playerIs: "controller", eventIs: { name } });
/** `on.moment(name, { anyPlayer: true })`: "after **a player** resolves …". */
const aPlayerResolves = (name: string): EventPattern => ({ on: "momentRaised", eventIs: { name } });

const answer = (
  id: string,
  kind: "response" | "interrupt",
  forced: boolean,
  on: EventPattern,
  effects: readonly EffectSpec[],
): StubAbility => stubAbility(id, { trigger: { kind, forced, on }, effects } satisfies AbilityDefinition);
const action = (id: string, effects: readonly EffectSpec[]): StubAbility =>
  stubAbility(id, { trigger: { kind: "action" }, effects } satisfies AbilityDefinition);

/** The attempt: step 5, the raise, and an effect that waits for the answers. */
const ATTEMPT = action("team.attempt", [count("step5"), raise(MOMENT), count("afterRaise")]);
/** An attempt whose step 5 defeated the mission: it has left play when the moment is raised. */
const ATTEMPT_DEFEATING = action("team.attempt-defeating", [
  { kind: "discardFromPlay", target: { kind: "each", query: { name: "mission" } } },
  raise(MOMENT),
  count("afterRaise"),
]);
/** A different moment from the same card: nobody listening for a mission attempt answers it. */
const OTHER_MOMENT = action("team.other", [raise("somethingElse"), count("afterRaise")]);
/** A moment raised for a player the ref does not name. */
const NOBODY = action("team.nobody", [raise(MOMENT, { kind: "eventPlayer" }), count("afterRaise")]);
const TEAM = stubSupport({
  id: "team",
  cost: 0,
  abilities: [ATTEMPT.ref, ATTEMPT_DEFEATING.ref, OTHER_MOMENT.ref, NOBODY.ref],
});

/** "Forced Response: After you resolve a mission attempt, deal 2 damage to your identity." */
const MISSION_ANSWER = answer("mission.answer", "response", true, youResolve(MOMENT), [
  { kind: "dealDamage", target: yourIdentity, amount: constant(2) },
  count("answered"),
]);
const MISSION = stubSideScheme({ id: "mission", startingThreat: 3, abilities: [MISSION_ANSWER.ref] });

/** A second forced answer whose order against the mission's changes the result: "…, heal 1 damage from your identity." */
const MEDIC_ANSWER = answer("medic.answer", "response", true, youResolve(MOMENT), [
  { kind: "heal", target: yourIdentity, amount: constant(1) },
  count("answered"),
]);
const MEDIC = stubSupport({ id: "medic", cost: 0, abilities: [MEDIC_ANSWER.ref] });

/** "Response: After you resolve a mission attempt, …" (optional). */
const UNIFORM_ANSWER = answer("uniform.answer", "response", false, youResolve(MOMENT), [count("answered")]);
const UNIFORM = stubSupport({ id: "uniform", cost: 0, abilities: [UNIFORM_ANSWER.ref] });

/** An interrupt-timed pattern on the moment: never offered, a moment being an announcement (the DSL rejects it). */
const SPOTTER_ANSWER = answer("spotter.answer", "interrupt", false, youResolve(MOMENT), [count("answered")]);
const SPOTTER = stubSupport({ id: "spotter", cost: 0, abilities: [SPOTTER_ANSWER.ref] });

/** "Forced Response: After a player resolves a mission attempt, …": any player's. */
const ONLOOKER_ANSWER = answer("onlooker.answer", "response", true, aPlayerResolves(MOMENT), [count("answered")]);
const ONLOOKER = stubSupport({ id: "onlooker", cost: 0, abilities: [ONLOOKER_ANSWER.ref] });

const deps: EngineDeps = depsOf(
  ATTEMPT,
  ATTEMPT_DEFEATING,
  OTHER_MOMENT,
  NOBODY,
  MISSION_ANSWER,
  MEDIC_ANSWER,
  UNIFORM_ANSWER,
  SPOTTER_ANSWER,
  ONLOOKER_ANSWER,
);

interface Table {
  readonly state: GameState;
  readonly team: InstanceId;
  readonly mission: InstanceId | null;
  readonly ids: Readonly<Record<string, InstanceId>>;
}

/** Team in play under P1, the mission in the villain's area unless `mission: false`, and `extras` in play. */
function table(
  opts: {
    readonly mission?: boolean;
    readonly extras?: readonly (CardId | readonly [CardId, PlayerId])[];
    readonly players?: 1 | 2;
    readonly damage?: number;
  } = {},
): Table {
  const extras = (opts.extras ?? []).map((extra) => (typeof extra === "string" ? ([extra, P1] as const) : extra));
  const base = gameAtFirstTurn({
    cards: [TEAM, MISSION, MEDIC, UNIFORM, SPOTTER, ONLOOKER],
    deps,
    deck: [TEAM.id, MEDIC.id, UNIFORM.id, SPOTTER.id, ONLOOKER.id],
    encounter: [MISSION.id, ...Array.from({ length: 29 }, () => "treachery" as CardId)],
    players: opts.players ?? 1,
  });
  const team = playerCardIntoPlay(base, TEAM.id);
  let state = team.state;
  let mission: InstanceId | null = null;
  if (opts.mission !== false) {
    const placed = encounterCardInVillainArea(state, MISSION.id, 3);
    state = placed.state;
    mission = placed.id;
  }
  const ids: Record<string, InstanceId> = {};
  for (const [card, player] of extras) {
    const placed = playerCardIntoPlay(state, card, player);
    state = placed.state;
    ids[card] = placed.id;
  }
  if (opts.damage) {
    const identity = mustPlayer(state, P1).identity.instanceId;
    state = {
      ...state,
      instances: { ...state.instances, [identity]: { ...mustInstance(state, identity), damage: opts.damage } },
    };
  }
  return { state, team: team.id, mission, ids };
}

const use = (team: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: team,
  abilityId: ability.ref.id,
  payment: [],
});

interface Plan {
  /** Reverse the order the first player is offered for simultaneous forced abilities. */
  readonly reverseOrder?: boolean;
  /** Decline every optional ability offered. */
  readonly decline?: boolean;
}

/** Uses one of Team's abilities, accepting optional abilities unless told to decline, and records every prompt. */
function attempt(at: Table, ability: StubAbility = ATTEMPT, plan: Plan = {}) {
  const prompts: { kind: string; player: PlayerId; options: readonly string[] }[] = [];
  const { session, events } = driveSession(startSession(at.state), deps, [use(at.team, ability)], (current) => {
    const choice = current.pendingChoice;
    if (!choice) return [];
    const options = choice.options.map((option) => option.optionId);
    prompts.push({ kind: choice.prompt.kind, player: choice.playerId, options });
    if (choice.prompt.kind === "orderTriggers") return plan.reverseOrder ? [...options].reverse() : options;
    if (choice.prompt.kind === "chooseTriggers") return plan.decline ? [] : options;
    return defaultPick(current);
  });
  return { session, state: session.state, events, prompts };
}

const counter = (state: GameState, id: InstanceId, type: string): number => mustInstance(state, id).counters[type] ?? 0;
const identityDamage = (state: GameState, player: PlayerId = P1): number =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;
const raisedLog = (events: readonly GameEvent[]) =>
  events.flatMap((event) => (event.type === "momentRaised" ? [event] : []));
/** The `momentRaised` trigger events that went on the stack, by phase. */
const onStack = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((event) =>
    event.type === "triggerEvent" && event.event.kind === "momentRaised" ? [event.phase] : [],
  );
const resolvedAbilities = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((event) => (event.type === "abilityResolved" ? [event.abilityId as string] : []));
/** A flat trace of the things these tests order: abilities resolving, counters placed, the raise. */
const trace = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((event) =>
    event.type === "abilityResolved"
      ? [`resolved ${event.abilityId}`]
      : event.type === "counterAdded"
        ? [`counter ${event.counterType}`]
        : event.type === "momentRaised"
          ? [`raised ${event.name}`]
          : [],
  );
const must = (id: InstanceId | null | undefined): InstanceId => {
  if (!id) throw new Error("missing card");
  return id;
};

describe("§3.39 a mission attempt with the mission on its a face", () => {
  it("raises one momentRaised and the mission's forced response resolves once, with you the attempting player", () => {
    const at = table();
    const after = attempt(at);
    expect(raisedLog(after.events)).toEqual([
      { type: "momentRaised", name: MOMENT, playerId: P1, sourceInstanceId: at.team },
    ]);
    // An announcement: the attempt has been resolved, so the event resolves once and opens a response window only.
    expect(onStack(after.events)).toEqual(["resolved"]);
    expect(resolvedAbilities(after.events)).toEqual([ATTEMPT.ref.id, MISSION_ANSWER.ref.id]);
    expect(counter(after.state, must(at.mission), "answered")).toBe(1);
    expect(identityDamage(after.state)).toBe(2);
    // A forced response alone: nobody is asked anything.
    expect(after.prompts).toEqual([]);
    expect(after.state.stack).toEqual([]);
  });

  it("opens its window where the effect stands: step 5 has resolved, and the effect after the raise waits", () => {
    const at = table();
    const after = attempt(at);
    expect(trace(after.events)).toEqual([
      `resolved ${ATTEMPT.ref.id}`,
      "counter step5",
      `raised ${MOMENT}`,
      `resolved ${MISSION_ANSWER.ref.id}`,
      "counter answered",
      "counter afterRaise",
    ]);
    expect(counter(after.state, at.team, "step5")).toBe(1);
    expect(counter(after.state, at.team, "afterRaise")).toBe(1);
  });

  it("is raised again by each attempt: two attempts, two moments, 4 damage", () => {
    const at = table();
    const first = attempt(at);
    const second = attempt({ ...at, state: first.state });
    expect(raisedLog(second.events)).toHaveLength(1);
    expect(counter(second.state, must(at.mission), "answered")).toBe(2);
    expect(identityDamage(second.state)).toBe(4);
  });
});

describe("§3.39 an attempt whose step 5 defeated the mission", () => {
  it("raises the moment and nothing answers: the a face is gone", () => {
    const at = table();
    const after = attempt(at, ATTEMPT_DEFEATING);
    expect(raisedLog(after.events)).toEqual([
      { type: "momentRaised", name: MOMENT, playerId: P1, sourceInstanceId: at.team },
    ]);
    expect(after.state.villainArea).not.toContain(at.mission);
    expect(resolvedAbilities(after.events)).toEqual([ATTEMPT_DEFEATING.ref.id]);
    expect(identityDamage(after.state)).toBe(0);
    // Unheard, the moment never goes on the stack (the `heard` gate): no event frame, no window.
    expect(onStack(after.events)).toEqual([]);
    expect(after.events.filter((event) => event.type === "windowOpened")).toEqual([]);
    // The game proceeds: the effect after the raise resolved and the stack is empty.
    expect(counter(after.state, at.team, "afterRaise")).toBe(1);
    expect(after.state.stack).toEqual([]);
    expect(after.state.pendingChoice).toBeNull();
  });

  it("the same with no mission in play at all, and the player goes on to act", () => {
    const at = table({ mission: false });
    const after = attempt(at);
    expect(raisedLog(after.events)).toHaveLength(1);
    expect(onStack(after.events)).toEqual([]);
    expect(counter(after.state, at.team, "afterRaise")).toBe(1);
    const next = driveSession(after.session, deps, [{ type: "endTurn", playerId: P1 }]);
    expect(next.session.state.outcome).toBeNull();
  });
});

describe('§3.39 a second card with on.moment("missionAttempt")', () => {
  it("asks the first player to order the two forced answers, once, for the one moment", () => {
    const at = table({ extras: [MEDIC.id] });
    const mission = `${must(at.mission)}:${MISSION_ANSWER.ref.id}`;
    const medic = `${must(at.ids[MEDIC.id])}:${MEDIC_ANSWER.ref.id}`;
    const after = attempt(at);
    expect(after.prompts).toEqual([
      { kind: "orderTriggers", player: at.state.firstPlayerId, options: [medic, mission] },
    ]);
    expect(raisedLog(after.events)).toHaveLength(1);
    expect(onStack(after.events)).toEqual(["resolved"]);
  });

  it("resolves in the order the first player picks: heal first 0 - 0 + 2 = 2 damage, mission first 0 + 2 - 1 = 1", () => {
    const at = table({ extras: [MEDIC.id] });
    const medicFirst = attempt(at);
    expect(resolvedAbilities(medicFirst.events)).toEqual([ATTEMPT.ref.id, MEDIC_ANSWER.ref.id, MISSION_ANSWER.ref.id]);
    expect(identityDamage(medicFirst.state)).toBe(2);
    const missionFirst = attempt(at, ATTEMPT, { reverseOrder: true });
    expect(resolvedAbilities(missionFirst.events)).toEqual([
      ATTEMPT.ref.id,
      MISSION_ANSWER.ref.id,
      MEDIC_ANSWER.ref.id,
    ]);
    expect(identityDamage(missionFirst.state)).toBe(1);
    // Each answered once in either order.
    for (const run of [missionFirst, medicFirst]) {
      expect(counter(run.state, must(at.mission), "answered")).toBe(1);
      expect(counter(run.state, must(at.ids[MEDIC.id]), "answered")).toBe(1);
    }
  });

  it("the order is the first player's in a two-player game too, when the second player raised nothing", () => {
    const at = table({ extras: [MEDIC.id], players: 2 });
    const after = attempt(at, ATTEMPT, { reverseOrder: true });
    expect(after.prompts.map((prompt) => [prompt.kind, prompt.player])).toEqual([["orderTriggers", P1]]);
    expect(at.state.firstPlayerId).toBe(P1);
    expect(identityDamage(after.state, P1)).toBe(1);
    expect(identityDamage(after.state, P2)).toBe(0);
  });

  it("forced before optional: the optional response is offered once the forced ones have resolved", () => {
    const at = table({ extras: [UNIFORM.id] });
    const uniform = must(at.ids[UNIFORM.id]);
    const after = attempt(at);
    expect(after.prompts).toEqual([
      { kind: "chooseTriggers", player: P1, options: [`${uniform}:${UNIFORM_ANSWER.ref.id}`] },
    ]);
    expect(resolvedAbilities(after.events)).toEqual([ATTEMPT.ref.id, MISSION_ANSWER.ref.id, UNIFORM_ANSWER.ref.id]);
    expect(counter(after.state, uniform, "answered")).toBe(1);
    expect(identityDamage(after.state)).toBe(2);
  });

  it("an optional response may be declined: the forced one still resolves and the attempt finishes", () => {
    const at = table({ extras: [UNIFORM.id] });
    const after = attempt(at, ATTEMPT, { decline: true });
    expect(resolvedAbilities(after.events)).toEqual([ATTEMPT.ref.id, MISSION_ANSWER.ref.id]);
    expect(counter(after.state, must(at.ids[UNIFORM.id]), "answered")).toBe(0);
    expect(counter(after.state, at.team, "afterRaise")).toBe(1);
  });

  it("is an announcement: an interrupt-timed ability gets no window, since the moment has already happened", () => {
    const at = table({ extras: [SPOTTER.id, UNIFORM.id] });
    const after = attempt(at);
    expect(resolvedAbilities(after.events)).toEqual([ATTEMPT.ref.id, MISSION_ANSWER.ref.id, UNIFORM_ANSWER.ref.id]);
    const windows = after.events.flatMap((event) =>
      event.type === "windowOpened" && event.event.kind === "momentRaised" ? [event.timing] : [],
    );
    expect(windows).toEqual(["response", "response"]);
    expect(counter(after.state, must(at.ids[SPOTTER.id]), "answered")).toBe(0);
    // Alone, it changes nothing either: no window, no prompt, and the attempt finishes.
    const alone = attempt(table({ mission: false, extras: [SPOTTER.id] }));
    expect(resolvedAbilities(alone.events)).toEqual([ATTEMPT.ref.id]);
    expect(alone.events.filter((event) => event.type === "windowOpened")).toEqual([]);
    expect(alone.prompts).toEqual([]);
    expect(alone.state.stack).toEqual([]);
  });
});

describe("§3.39 the name and the player are all a moment carries", () => {
  it("a moment of another name is not answered by cards listening for this one", () => {
    const at = table({ extras: [MEDIC.id, UNIFORM.id, SPOTTER.id, ONLOOKER.id] });
    const after = attempt(at, OTHER_MOMENT);
    expect(raisedLog(after.events)).toEqual([
      { type: "momentRaised", name: "somethingElse", playerId: P1, sourceInstanceId: at.team },
    ]);
    expect(onStack(after.events)).toEqual([]);
    expect(resolvedAbilities(after.events)).toEqual([OTHER_MOMENT.ref.id]);
    expect(after.prompts).toEqual([]);
    expect(identityDamage(after.state)).toBe(0);
  });

  it('"you" is the player it was raised for: another player\'s card does not answer, an any-player card does', () => {
    const at = table({
      mission: false,
      players: 2,
      extras: [
        [UNIFORM.id, P2],
        [ONLOOKER.id, P2],
      ],
    });
    const after = attempt(at);
    expect(raisedLog(after.events)).toEqual([
      { type: "momentRaised", name: MOMENT, playerId: P1, sourceInstanceId: at.team },
    ]);
    expect(resolvedAbilities(after.events)).toEqual([ATTEMPT.ref.id, ONLOOKER_ANSWER.ref.id]);
    expect(counter(after.state, must(at.ids[UNIFORM.id]), "answered")).toBe(0);
    expect(counter(after.state, must(at.ids[ONLOOKER.id]), "answered")).toBe(1);
    expect(after.prompts).toEqual([]);
  });

  it("an encounter card's \"you\" is that player too: P1's attempt damages P1's identity, not P2's", () => {
    const at = table({ players: 2 });
    const after = attempt(at);
    expect(identityDamage(after.state, P1)).toBe(2);
    expect(identityDamage(after.state, P2)).toBe(0);
  });

  it("a player ref that names nobody raises nothing", () => {
    const at = table();
    const after = attempt(at, NOBODY);
    expect(raisedLog(after.events)).toEqual([]);
    expect(onStack(after.events)).toEqual([]);
    expect(identityDamage(after.state)).toBe(0);
    expect(counter(after.state, at.team, "afterRaise")).toBe(1);
  });
});

describe("§3.39 replay", () => {
  it("the same command list replays deep-equal, answers and ordering included", () => {
    const at = table({ extras: [MEDIC.id, UNIFORM.id, SPOTTER.id], damage: 1 });
    const first = attempt(at, ATTEMPT, { reverseOrder: true });
    const { session } = driveSession(first.session, deps, [use(at.team, ATTEMPT_DEFEATING), use(at.team, ATTEMPT)]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
    // And a second run of the same commands from the same state logs the same events.
    const again = attempt(at, ATTEMPT, { reverseOrder: true });
    expect(again.events).toEqual(first.events);
    expect(again.state).toEqual(first.state);
  });
});
