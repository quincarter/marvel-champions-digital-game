/**
 * Official rule, RRG 1.8 "Main Scheme" (p. 27), when the main scheme deck advances: "1. Remove the top main scheme card
 * from the game. Return all tokens (except acceleration tokens) that were on that card to the token pool and discard
 * each card attached to it." Each card goes to its owner's discard pile: an encounter card to the encounter discard
 * pile, a player card to its owner's (RRG 1.8 "Ownership and Control", p. 31). A permanent player card cannot leave
 * play (RRG 1.8 "Permanent", p. 32) and cannot stay on a card that is out of play ("Attach To", p. 8), so it is
 * unattached in play, as when any other host leaves (docs/phase7-wave5.md §3.30).
 *
 * Synthetic cards: a three-stage scheme, a player upgrade and an encounter attachment attached to it by card effects.
 */
import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubMainScheme, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const theMainScheme: TargetRef = { kind: "mainScheme" };
const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const n = (value: number): ValueSpec => ({ kind: "const", value });

const stage = { startingThreat: flat(1), targetThreat: flat(6), acceleration: flat(0) };
const SCHEME = stubMainScheme({ id: "three-stages", stages: [stage, stage, stage] });

const TRACKER = stubSupport({ id: "tracker", cost: 0 });
const mark = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: named("tracker"),
  counterType,
  amount,
});
/** "Interrupt: When [this card] leaves play, …": records the threat and the stage it still sees. */
const BUG_INTERRUPT = stubAbility("bug.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [
    mark("heard", n(1)),
    mark("threatSeen", { kind: "threat", of: theMainScheme }),
    mark("stageSeen", { kind: "mainSchemeStageNumber" }),
  ],
});

const BUG = stubUpgrade({ id: "bug", cost: 0 });
const LISTENING_BUG = stubUpgrade({ id: "bug", cost: 0, abilities: [BUG_INTERRUPT.ref] });
const PERMANENT_BUG = stubUpgrade({ id: "bug", cost: 0, keywords: [{ name: "permanent" }] });
const WARD = stubAttachment({ id: "ward" });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ATTACH_BUG = event("attach-bug", [{ kind: "attach", card: named("bug"), to: theMainScheme }]);
const ATTACH_WARD = event("attach-ward", [{ kind: "attach", card: named("ward"), to: theMainScheme }]);
const ADVANCE = event("advance-card", [{ kind: "advanceMainScheme" }]);
const PLOT = event("plot", [{ kind: "placeThreat", target: theMainScheme, amount: n(5) }]);
const EVENTS = [ATTACH_BUG, ATTACH_WARD, ADVANCE, PLOT];
const deps: EngineDeps = depsOf(BUG_INTERRUPT, ...EVENTS.map((e) => e.ability));

interface Table {
  readonly state: GameState;
  readonly bug: InstanceId;
  readonly ward: InstanceId;
  readonly tracker: InstanceId;
}

/** Both cards attached to stage 1 of the scheme; the bug belongs to `owner`. */
function table(bugCard = BUG, players: 1 | 2 = 1, owner = P1): Table {
  const start = gameAtFirstTurn({
    cards: [bugCard, WARD, TRACKER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [TRACKER.id, bugCard.id, ...EVENTS.map((e) => e.card.id)],
    mainScheme: SCHEME,
    encounter: [WARD.id, ...copiesOf(TREACHERY.id, 29)],
    players,
  });
  const tracker = playerCardIntoPlay(start, TRACKER.id);
  const bug = playerCardIntoPlay(tracker.state, bugCard.id, owner);
  const ward = encounterCardInVillainArea(bug.state, WARD.id);
  const attached = playFree(playFree(ward.state, deps, ATTACH_BUG.card.id).state, deps, ATTACH_WARD.card.id).state;
  expect(mustInstance(attached, attached.mainScheme.instanceId).attachments).toEqual([bug.id, ward.id]);
  return { state: attached, bug: bug.id, ward: ward.id, tracker: tracker.id };
}

/** Plays a free event, and checks the log replays to the same state. */
function play(state: GameState, card: { readonly card: { readonly id: CardId } }) {
  const run = playFree(state, deps, card.card.id);
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.state);
  return run;
}

const scheme = (state: GameState) => mustInstance(state, state.mainScheme.instanceId);
const encounterDiscard = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!.discard;
const advances = (events: readonly GameEvent[]) => events.filter((e) => e.type === "mainSchemeAdvanced").length;
const withOnScheme = (state: GameState, patch: Partial<ReturnType<typeof scheme>>): GameState => ({
  ...state,
  instances: { ...state.instances, [state.mainScheme.instanceId]: { ...scheme(state), ...patch } },
});

describe("a main scheme that advances discards each card attached to the old stage (RRG 1.8 p. 27)", () => {
  it("advanced by a card: the player card goes to its owner's discard pile, the encounter card to the encounter discard", () => {
    const at = table();
    const { state, events } = play(withOnScheme(at.state, { threat: 3, counters: { spark: 2 } }), ADVANCE);
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(scheme(state).attachments).toEqual([]);
    expect(mustPlayer(state, P1).discard).toContain(at.bug);
    expect(mustPlayer(state, P1).playArea).not.toContain(at.bug);
    expect(encounterDiscard(state)).toContain(at.ward);
    expect(state.villainArea).not.toContain(at.ward);
    expect(mustInstance(state, at.bug).attachedTo).toBeNull();
    expect(mustInstance(state, at.ward).attachedTo).toBeNull();
    // Tokens and threat are handled as before: counters returned, the new stage's starting threat placed.
    expect(scheme(state).counters).toEqual({});
    expect(scheme(state).threat).toBe(1);
    expect(events.some((e) => e.type === "counterRemoved" && e.returnedOnAdvance)).toBe(true);
    expect(advances(events)).toBe(1);
    expect(state.stack).toEqual([]);
  });

  it("completed by threat: the same discard, and the scheme advances once", () => {
    const at = table();
    const { state, events } = play(at.state, PLOT);
    expect(events.some((e) => e.type === "mainSchemeCompleted")).toBe(true);
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(scheme(state).attachments).toEqual([]);
    expect(mustPlayer(state, P1).discard).toContain(at.bug);
    expect(encounterDiscard(state)).toContain(at.ward);
    expect(scheme(state).threat).toBe(1);
    expect(advances(events)).toBe(1);
  });

  it("a player card another player owns goes to that player's discard pile", () => {
    const at = table(BUG, 2, P2);
    const { state } = play(at.state, ADVANCE);
    expect(mustPlayer(state, P2).discard).toContain(at.bug);
    expect(mustPlayer(state, P1).discard).not.toContain(at.bug);
  });

  it("its 'when this leaves play' interrupt resolves first, with the old stage and its threat still there", () => {
    const at = table(LISTENING_BUG);
    const { state, events } = play(withOnScheme(at.state, { threat: 4 }), ADVANCE);
    expect(mustInstance(state, at.tracker).counters).toEqual({ heard: 1, threatSeen: 4, stageSeen: 1 });
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(scheme(state).attachments).toEqual([]);
    expect(mustPlayer(state, P1).discard).toContain(at.bug);
    expect(encounterDiscard(state)).toContain(at.ward);
    expect(advances(events)).toBe(1);
    expect(state.stack).toEqual([]);
  });

  it("the interrupt window of a completion does not complete the stage a second time", () => {
    const at = table(LISTENING_BUG);
    const { state, events } = play(at.state, PLOT);
    expect(mustInstance(state, at.tracker).counters).toEqual({ heard: 1, threatSeen: 6, stageSeen: 1 });
    expect(events.filter((e) => e.type === "mainSchemeCompleted")).toHaveLength(1);
    expect(advances(events)).toBe(1);
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(scheme(state).threat).toBe(1);
  });

  it("a permanent player card is unattached in play rather than discarded (RRG 1.8 pp. 8, 32)", () => {
    const at = table(PERMANENT_BUG);
    const { state } = play(at.state, ADVANCE);
    expect(scheme(state).attachments).toEqual([]);
    expect(mustInstance(state, at.bug).attachedTo).toBeNull();
    expect(mustPlayer(state, P1).playArea).toContain(at.bug);
    expect(mustPlayer(state, P1).discard).not.toContain(at.bug);
    expect(encounterDiscard(state)).toContain(at.ward);
  });
});
