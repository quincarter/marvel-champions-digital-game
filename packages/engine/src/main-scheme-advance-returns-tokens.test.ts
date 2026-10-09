/**
 * Official rule, RRG 1.8 "Main Scheme" (p. 27), when the main scheme deck advances: "1. Remove the top main scheme card
 * from the game. Return all tokens (except acceleration tokens) that were on that card to the token pool and discard
 * each card attached to it. 2. Resolve any 'When Revealed' ability on the 'A' side of the new top card of the main
 * scheme deck. 3. Flip the top card of the main scheme deck to its 'B' side, place threat on that card equal to its
 * starting threat value, and resolve any 'When Revealed' ability on that side of the card." And "All-Purpose Counter"
 * (p. 6): "All-purpose counters are considered tokens for all game purposes." Owner row 58 (docs/phase7-wave8.md
 * §4.1, 2026-10-08) asks the game to follow it.
 *
 * Synthetic scheme of three stages, in the shape of a scheme that gathers counters: each stage's B side reads "Forced
 * Response: After a spark counter is placed here, if there are at least 3 spark counters here, remove 3 of them and
 * place 1 burst counter on the villain", and stages 2A and 3A read "When Revealed: Place 1 (2) spark counters here."
 */
import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { ACCELERATION_COUNTER } from "./effects.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard, HERO, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const self: TargetRef = { kind: "self" };
const theMainScheme: TargetRef = { kind: "mainScheme" };
const theVillain: TargetRef = { kind: "villain" };
const n = (value: number) => ({ kind: "const", value }) as const;
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

const sparks = (amount: number, target: TargetRef = self): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType: "spark",
  amount: n(amount),
});
/** The B side of every stage. */
const GATHER = stubAbility("gather.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "countersPlaced", eventIs: { counterType: "spark" }, selfIs: "target" },
  },
  effects: [
    {
      kind: "if",
      condition: {
        kind: "compare",
        left: { kind: "counters", of: self, counterType: "spark" },
        op: "atLeast",
        right: n(3),
      },
      then: [
        { kind: "removeCounters", target: self, counterType: "spark", amount: n(3) },
        { kind: "addCounters", target: theVillain, counterType: "burst", amount: n(1) },
      ],
    },
  ],
});
const REVEAL_ONE = stubAbility("stage-2a.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [sparks(1)] });
const REVEAL_TWO = stubAbility("stage-3a.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [sparks(2)] });
/** A stage 2A that places enough for the B side's threshold by itself: the B side is not faceup to answer it. */
const REVEAL_THREE = stubAbility("flood-2a.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [sparks(3)] });

const stage = { startingThreat: flat(1), targetThreat: flat(99), acceleration: flat(0), abilities: [GATHER.ref] };
const GATHERING = stubMainScheme({
  id: "gathering",
  stages: [stage, { ...stage, aSideAbilities: [REVEAL_ONE.ref] }, { ...stage, aSideAbilities: [REVEAL_TWO.ref] }],
});
const FLOOD = stubMainScheme({ id: "flood", stages: [stage, { ...stage, aSideAbilities: [REVEAL_THREE.ref] }] });

const eventCard = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ADVANCE = eventCard("advance-card", [{ kind: "advanceMainScheme" }]);
const SPARK = eventCard("spark-card", [sparks(1, theMainScheme)]);
const EVENTS = [ADVANCE, SPARK];
const deps: EngineDeps = depsOf(GATHER, REVEAL_ONE, REVEAL_TWO, REVEAL_THREE, ...EVENTS.map((e) => e.ability));

function game(scheme = GATHERING): GameState {
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 5,
      cards: [QUIET_VILLAIN, scheme, BLANK, ...EVENTS.map((e) => e.card), ...identities],
      villainCardId: QUIET_VILLAIN.id,
      mainSchemeCardId: scheme.id,
      encounterDeck: Array.from({ length: 16 }, () => BLANK.id as CardId),
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: EVENTS.flatMap((e) => [e.card.id, e.card.id, e.card.id]),
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

/** Plays a free event from hand, and checks the log replays to the same state. */
function play(state: GameState, card: { readonly card: { readonly id: CardId } }) {
  const given = giveCard(state, p1, card.card.id);
  const run = runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.state);
  return run;
}

const scheme = (state: GameState) => mustInstance(state, state.mainScheme.instanceId);
const sparksOn = (state: GameState): number => scheme(state).counters.spark ?? 0;
const bursts = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).counters.burst ?? 0;
const withOnScheme = (state: GameState, patch: Partial<ReturnType<typeof scheme>>): GameState => ({
  ...state,
  instances: { ...state.instances, [state.mainScheme.instanceId]: { ...scheme(state), ...patch } },
});
const returned = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "counterRemoved" && e.returnedOnAdvance ? [[e.counterType, e.amount]] : []));

describe("a main scheme that advances returns its tokens, except acceleration tokens (RRG 1.8 p. 27)", () => {
  it("every counter on the old stage goes back to the pool, whatever its type; threat is the new stage's starting threat", () => {
    const start = withOnScheme(game(), { threat: 5, damage: 2, counters: { spark: 2, other: 4 } });
    const { state, events } = play(start, ADVANCE);
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(returned(events)).toEqual([
      ["spark", 2],
      ["other", 4],
    ]);
    // 2A's own "place 1 spark counter here" is all the new stage holds.
    expect(scheme(state).counters).toEqual({ spark: 1 });
    expect(scheme(state).threat).toBe(1);
    expect(scheme(state).damage).toBe(0);
    // The return is logged before the advance, and it is not a removal a card made.
    const types = events.map((e) => e.type);
    expect(types.indexOf("counterRemoved")).toBeLessThan(types.indexOf("mainSchemeAdvanced"));
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "countersRemoved")).toBe(false);
  });

  it("acceleration tokens stay: the scheme's own count, and an acceleration counter kept on the card", () => {
    const base = game();
    const start = withOnScheme(
      { ...base, mainScheme: { ...base.mainScheme, accelerationTokens: 2 } },
      { counters: { spark: 2, [ACCELERATION_COUNTER]: 1 } },
    );
    const { state, events } = play(start, ADVANCE);
    expect(state.mainScheme.accelerationTokens).toBe(2);
    expect(scheme(state).counters).toEqual({ [ACCELERATION_COUNTER]: 1, spark: 1 });
    expect(returned(events)).toEqual([["spark", 2]]);
  });

  it("a scheme with nothing on it advances with no return logged", () => {
    const { state, events } = play(game(), ADVANCE);
    expect(returned(events)).toEqual([]);
    expect(sparksOn(state)).toBe(1);
  });
});

describe("counters across an advance: the A side places them, the B side answers only what is placed once it is faceup", () => {
  it("played through both advances: 2 left on stage 1 are not carried; stage 2 starts with 1 and stage 3 with 2", () => {
    // Stage 1B: two placements, no answer yet.
    let at = play(play(game(), SPARK).state, SPARK);
    expect([at.state.mainScheme.stageIndex, sparksOn(at.state), bursts(at.state)]).toEqual([0, 2, 0]);

    // Advance to stage 2: the 2 go back, 2A places 1, the card turns to 2B. 2B does not answer 2A's placement.
    at = play(at.state, ADVANCE);
    expect(returned(at.events)).toEqual([["spark", 2]]);
    expect([at.state.mainScheme.stageIndex, sparksOn(at.state), bursts(at.state)]).toEqual([1, 1, 0]);
    expect(at.state.mainScheme.faceupSide).toBeUndefined();

    // 2B: the next placement makes 2 (no answer), the one after makes 3 and is answered: 3 removed.
    at = play(at.state, SPARK);
    expect([sparksOn(at.state), bursts(at.state)]).toEqual([2, 0]);
    at = play(at.state, SPARK);
    expect([sparksOn(at.state), bursts(at.state)]).toEqual([0, 1]);

    // One more on 2B, then the advance to stage 3: it goes back, 3A places 2, and 3B starts with exactly 2.
    at = play(at.state, SPARK);
    at = play(at.state, ADVANCE);
    expect(returned(at.events)).toEqual([["spark", 1]]);
    expect([at.state.mainScheme.stageIndex, sparksOn(at.state), bursts(at.state)]).toEqual([2, 2, 1]);

    // 3B: the first placement reaches 3 and is answered.
    at = play(at.state, SPARK);
    expect([sparksOn(at.state), bursts(at.state)]).toEqual([0, 2]);
    expect(at.state.stack).toEqual([]);
  });

  it("an A side that reaches the B side's threshold by itself is not answered until the next placement", () => {
    // RRG 1.8 p. 27 step 2 resolves the A side before step 3 turns the card: the B side is not in play yet ("In Play
    // and Out of Play", p. 23: "the faceup side of the top card of the main scheme deck"), and an ability does not
    // answer what happened before it was in play (docs/phase7-wave8.md §4.1 Q56).
    let at = play(game(FLOOD), ADVANCE);
    expect([sparksOn(at.state), bursts(at.state)]).toEqual([3, 0]);
    at = play(at.state, SPARK);
    expect([sparksOn(at.state), bursts(at.state)]).toEqual([1, 1]);
  });
});
