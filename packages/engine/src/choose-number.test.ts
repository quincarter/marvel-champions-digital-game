/**
 * docs/phase7-wave6.md §3.69: choosing a number. Break a Leg (`mojo` 39009): "Take 2 damage … You may place any number
 * of ratings counters on The Champion to reduce this damage by 1 for each counter placed this way." `EffectSpec
 * chooseNumber` asks the player for a whole number in a range (a `chooseNumber` choice, one option per number) and
 * binds it as `<bind>.amount`, which the counters and the damage both read.
 *
 * Sources: RRG 1.8 "May" (p. 28: the player decides whether, and here how far, to resolve the optional part),
 * "Choose (Option)" (p. 12).
 */

import type { AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { PendingChoice } from "./choices.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { stubEvent, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const controller = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: controller };
const theChampion: TargetRef = { kind: "each", query: { categories: ["support"] } };
const placed: ValueSpec = { kind: "var", name: "placed.amount" };
const ratingsOn = (of: TargetRef): ValueSpec => ({ kind: "counters", of, counterType: "ratings" });

/** The Champion's stand-in: a card in play that holds ratings counters. */
const CHAMPION = stubSupport({ id: "champion", cost: 0 });

/**
 * Break a Leg's shape: take `damage`; place any number (up to the damage) of ratings counters on The Champion to
 * reduce it by 1 for each. `range` overrides the bounds.
 */
const breakALeg = (
  damage: number,
  range: { readonly min?: ValueSpec; readonly max?: ValueSpec } = {},
): EffectSpec[] => [
  {
    kind: "chooseNumber",
    player: controller,
    ...(range.min ? { min: range.min } : {}),
    max: range.max ?? n(damage),
    bind: "placed",
  },
  { kind: "addCounters", target: theChampion, counterType: "ratings", amount: placed },
  {
    kind: "dealDamage",
    target: yourIdentity,
    amount: { kind: "sum", values: [n(damage), { kind: "scaled", value: placed, times: -1 }] },
  },
];

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TWO = action("take-two", breakALeg(2));
const FOUR = action("take-four", breakALeg(4));
/** "Up to as many as The Champion already holds": a bound read from the board as the effect resolves. */
const LIVE_MAX = action("live-max", breakALeg(5, { max: ratingsOn(theChampion) }));
const ONE_TO_THREE = action("one-to-three", breakALeg(5, { min: n(1), max: n(3) }));
const ONLY_TWO = action("only-two", breakALeg(5, { min: n(2), max: n(2) }));
/** Tells "no number" from "chose 0": 1 threat on the main scheme only when nothing was bound from the range. */
const THREAT_IF_NOT_MADE: EffectSpec = {
  kind: "if",
  condition: { kind: "not", of: { kind: "varAtLeast", name: "placed.made", amount: 1 } },
  then: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: n(1) }],
};
const NONE_LEGAL = action("none-legal", [...breakALeg(5, { min: n(1), max: n(0) }), THREAT_IF_NOT_MADE]);
const SOME_LEGAL = action("some-legal", [...breakALeg(5, { max: n(1) }), THREAT_IF_NOT_MADE]);
const REVEAL_TOP = action("reveal-top", [{ kind: "revealEncounterCard", player: controller }]);
const ACTIONS = [TWO, FOUR, LIVE_MAX, ONE_TO_THREE, ONLY_TWO, NONE_LEGAL, SOME_LEGAL, REVEAL_TOP];

const WHEN_REVEALED = stubAbility("break-a-leg.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: breakALeg(2),
});
const BREAK_A_LEG = stubTreachery({ id: "break-a-leg", boostIcons: 2, abilities: [WHEN_REVEALED.ref] });
const PERIL_BREAK_A_LEG = stubTreachery({
  id: "peril-break-a-leg",
  boostIcons: 0,
  keywords: [{ name: "peril" }],
  abilities: [WHEN_REVEALED.ref],
});

const deps: EngineDeps = depsOf(WHEN_REVEALED, ...ACTIONS.map((a) => a.ability));
const CARDS: readonly AnyCard[] = [CHAMPION, BREAK_A_LEG, PERIL_BREAK_A_LEG, ...ACTIONS.map((a) => a.card)];

function start(players: 1 | 2 = 1): { readonly state: GameState; readonly champion: InstanceId } {
  const state = gameAtFirstTurn({
    deps,
    cards: CARDS,
    deck: [CHAMPION.id, ...ACTIONS.flatMap((a) => copiesOf(a.card.id, 2))],
    encounter: [BREAK_A_LEG.id, PERIL_BREAK_A_LEG.id, ...copiesOf("treachery" as never, 20)],
    players,
  });
  const inPlay = playerCardIntoPlay(state, CHAMPION.id);
  return { state: inPlay.state, champion: inPlay.id };
}

const heroId = (state: GameState): InstanceId => state.players[0]!.identity.instanceId;
const damageOn = (state: GameState): number => mustInstance(state, heroId(state)).damage;
const ratings = (state: GameState, id: InstanceId): number => mustInstance(state, id).counters["ratings"] ?? 0;
const withRatings = (state: GameState, id: InstanceId, count: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), counters: { ratings: count } } },
});

/** Plays `card` up to its number choice and returns the session parked there. */
function atNumber(state: GameState, card: (typeof ACTIONS)[number]): GameSession {
  const given = giveCard(state, P1, card.card.id);
  let session = startSession(given.state);
  const apply = (command: Parameters<typeof sessionApply>[1]): void => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  };
  apply({ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null });
  for (let guard = 0; session.state.pendingChoice?.prompt.kind !== "chooseNumber"; guard++) {
    const choice = session.state.pendingChoice;
    if (!choice || guard > 20) throw new Error("no chooseNumber choice opened");
    apply({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: defaultPick(session.state),
    });
  }
  return session;
}

/** Answers the open choice; later choices take their default. */
function answer(
  session: GameSession,
  selectedOptionIds: readonly string[],
): { readonly session: GameSession; readonly events: readonly GameEvent[] } {
  const choice = session.state.pendingChoice as PendingChoice;
  const result = sessionApply(
    session,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const rest = driveSession(result.session, deps);
  return { session: rest.session, events: [...result.events, ...rest.events] };
}

const numbersChosen = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "numberChosen" ? [{ playerId: e.playerId, bind: e.bind, amount: e.amount }] : []));

describe("§3.69 chooseNumber: the choice", () => {
  it("asks the player with one option per number from 0 to the maximum, exactly one to be selected", () => {
    const { state } = start();
    const session = atNumber(state, TWO);
    const choice = session.state.pendingChoice;
    expect(choice).toMatchObject({
      playerId: P1,
      prompt: { kind: "chooseNumber", min: 0, max: 2 },
      minSelections: 1,
      maxSelections: 1,
      ordered: false,
      authority: "player",
      soleDecider: false,
    });
    expect(choice?.options).toEqual([
      { optionId: "0", label: "0", ref: { kind: "none" } },
      { optionId: "1", label: "1", ref: { kind: "none" } },
      { optionId: "2", label: "2", ref: { kind: "none" } },
    ]);
    // Nothing has resolved yet: the counters and the damage wait for the number.
    expect(damageOn(session.state)).toBe(0);
    expect(legalActions(session.state, P1, deps)).toEqual({ kind: "choice", choice });
  });

  it("the legal answers are exactly the numbers in the range, one at a time", () => {
    const { state } = start();
    const session = atNumber(state, TWO);
    const choice = session.state.pendingChoice as PendingChoice;
    const tryAnswer = (selectedOptionIds: readonly string[]) =>
      sessionApply(session, { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds }, deps)
        .ok;
    expect(tryAnswer(["3"])).toBe(false);
    expect(tryAnswer(["-1"])).toBe(false);
    expect(tryAnswer([])).toBe(false);
    expect(tryAnswer(["1", "2"])).toBe(false);
    expect(tryAnswer(["1"])).toBe(true);
    // Only the asked player answers.
    expect(
      sessionApply(
        session,
        { type: "resolveChoice", playerId: P2, choiceId: choice.choiceId, selectedOptionIds: ["1"] },
        deps,
      ).ok,
    ).toBe(false);
  });
});

describe("§3.69 chooseNumber: Break a Leg's counters and damage both read the number", () => {
  it.each([
    { chosen: 0, counters: 0, damage: 2 },
    { chosen: 1, counters: 1, damage: 1 },
    { chosen: 2, counters: 2, damage: 0 },
  ])("2 damage, choosing $chosen: $counters counters placed, $damage damage taken", ({ chosen, counters, damage }) => {
    const { state, champion } = start();
    const { session, events } = answer(atNumber(state, TWO), [String(chosen)]);
    expect(session.state.pendingChoice).toBeNull();
    expect(ratings(session.state, champion)).toBe(counters);
    expect(damageOn(session.state)).toBe(damage);
    expect(numbersChosen(events)).toEqual([{ playerId: P1, bind: "placed", amount: chosen }]);
  });

  it("the 4 damage version offers 0 to 4, and choosing 3 leaves 1 damage", () => {
    const { state, champion } = start();
    const session = atNumber(state, FOUR);
    expect(session.state.pendingChoice?.prompt).toEqual({ kind: "chooseNumber", min: 0, max: 4 });
    expect(session.state.pendingChoice?.options.map((o) => o.optionId)).toEqual(["0", "1", "2", "3", "4"]);
    const after = answer(session, ["3"]).session.state;
    expect(ratings(after, champion)).toBe(3);
    expect(damageOn(after)).toBe(1);
  });

  it("counters already on the card are added to, not replaced", () => {
    const { state, champion } = start();
    const after = answer(atNumber(withRatings(state, champion, 5), TWO), ["2"]).session.state;
    expect(ratings(after, champion)).toBe(7);
  });

  it("as a treachery's When Revealed, the revealing player chooses", () => {
    const { state, champion } = start();
    const session = atNumber(onTopOfEncounterDeck(state, BREAK_A_LEG.id), REVEAL_TOP);
    expect(session.state.pendingChoice).toMatchObject({
      playerId: P1,
      prompt: { kind: "chooseNumber", min: 0, max: 2 },
      authority: "player",
      soleDecider: false,
    });
    const after = answer(session, ["1"]).session.state;
    expect(ratings(after, champion)).toBe(1);
    expect(damageOn(after)).toBe(1);
  });

  it("a peril card's number is the revealing player's alone to choose", () => {
    const session = atNumber(onTopOfEncounterDeck(start(2).state, PERIL_BREAK_A_LEG.id), REVEAL_TOP);
    expect(session.state.pendingChoice).toMatchObject({ playerId: P1, soleDecider: true });
  });
});

describe("§3.69 chooseNumber: the bounds", () => {
  it("a maximum read from the board is read as the effect resolves", () => {
    const { state, champion } = start();
    const session = atNumber(withRatings(state, champion, 3), LIVE_MAX);
    expect(session.state.pendingChoice?.prompt).toEqual({ kind: "chooseNumber", min: 0, max: 3 });
    expect(session.state.pendingChoice?.options).toHaveLength(4);
  });

  it("a minimum removes the numbers below it", () => {
    const { state, champion } = start();
    const session = atNumber(state, ONE_TO_THREE);
    expect(session.state.pendingChoice?.prompt).toEqual({ kind: "chooseNumber", min: 1, max: 3 });
    expect(session.state.pendingChoice?.options.map((o) => o.optionId)).toEqual(["1", "2", "3"]);
    const choice = session.state.pendingChoice as PendingChoice;
    expect(
      sessionApply(
        session,
        { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: ["0"] },
        deps,
      ).ok,
    ).toBe(false);
    const after = answer(session, ["3"]).session.state;
    expect(ratings(after, champion)).toBe(3);
    expect(damageOn(after)).toBe(2);
  });

  it("a range of one number is bound and logged without asking", () => {
    const { state, champion } = start();
    const given = giveCard(state, P1, ONLY_TWO.card.id);
    let asked = false;
    const { session, events } = driveSession(
      startSession(given.state),
      deps,
      [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
      (current) => {
        if (current.pendingChoice?.prompt.kind === "chooseNumber") asked = true;
        return defaultPick(current);
      },
    );
    expect(asked).toBe(false);
    expect(ratings(session.state, champion)).toBe(2);
    expect(damageOn(session.state)).toBe(3);
    expect(numbersChosen(events)).toEqual([{ playerId: P1, bind: "placed", amount: 2 }]);
  });

  it("a maximum of 0 (no damage to reduce) asks nothing and places nothing", () => {
    const { state, champion } = start();
    const given = giveCard(withRatings(state, champion, 0), P1, LIVE_MAX.card.id);
    const { session, events } = driveSession(startSession(given.state), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ]);
    expect(events.some((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "chooseNumber")).toBe(false);
    expect(ratings(session.state, champion)).toBe(0);
    expect(damageOn(session.state)).toBe(5);
    expect(numbersChosen(events)).toEqual([{ playerId: P1, bind: "placed", amount: 0 }]);
  });

  it("with no number in the range nobody is asked: the amount is 0, `made` is 0, and nothing is logged as chosen", () => {
    const { state, champion } = start();
    const given = giveCard(state, P1, NONE_LEGAL.card.id);
    const threatBefore = mustInstance(state, state.mainScheme.instanceId).threat;
    const { session, events } = driveSession(startSession(given.state), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ]);
    expect(events.some((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "chooseNumber")).toBe(false);
    expect(numbersChosen(events)).toEqual([]);
    expect(ratings(session.state, champion)).toBe(0);
    expect(damageOn(session.state)).toBe(5);
    expect(mustInstance(session.state, session.state.mainScheme.instanceId).threat).toBe(threatBefore + 1);
  });

  it("choosing 0 from a real range is a number chosen (`made` is 1), unlike an empty range", () => {
    const { state } = start();
    const threatBefore = mustInstance(state, state.mainScheme.instanceId).threat;
    const { session, events } = answer(atNumber(state, SOME_LEGAL), ["0"]);
    expect(numbersChosen(events)).toEqual([{ playerId: P1, bind: "placed", amount: 0 }]);
    expect(damageOn(session.state)).toBe(5);
    expect(mustInstance(session.state, session.state.mainScheme.instanceId).threat).toBe(threatBefore);
  });
});

describe("§3.69 chooseNumber: the log", () => {
  it("records the request, the answer and the number, and replays to an identical state", () => {
    const { state } = start();
    const parked = atNumber(state, FOUR);
    const choice = parked.state.pendingChoice as PendingChoice;
    const { session, events } = answer(parked, ["3"]);
    expect(events).toContainEqual({
      type: "choiceResolved",
      choiceId: choice.choiceId,
      playerId: P1,
      selectedOptionIds: ["3"],
    });
    expect(events).toContainEqual({ type: "numberChosen", playerId: P1, bind: "placed", amount: 3 });
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("a different answer replays to a different state", () => {
    const { state } = start();
    const one = answer(atNumber(state, FOUR), ["1"]).session;
    const four = answer(atNumber(state, FOUR), ["4"]).session;
    const replayedOne = replay(one.log, deps);
    const replayedFour = replay(four.log, deps);
    expect(replayedOne.ok && damageOn(replayedOne.state)).toBe(3);
    expect(replayedFour.ok && damageOn(replayedFour.state)).toBe(0);
  });
});
