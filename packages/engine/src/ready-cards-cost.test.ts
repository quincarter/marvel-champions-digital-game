/**
 * docs/phase7-wave8.md §3.54: "Ready your sidekick → …", a cost that readies a card in play (`AbilityCost.readyCards`).
 * Synthetic cards: a "drill" support and a "sync" event whose cost readies an ally the payer controls, a minion that
 * taxes the engaged player's readies (Mister Fear's shape, wave 4 §3.19), a side scheme under which player cards
 * cannot ready heroes and allies (Unnatural Storm's shape), and a "would ready" replacement (Frozen in Time's shape).
 *
 * Sources: RRG 1.8 "Cost" (pp. 13–14: paid in full or not at all; "with cards and/or game elements they control"),
 * "Cost Arrow Icon" (p. 14), "Ready" (p. 36), "Initiating Abilities" (p. 24, steps 3 and 5), "'Cannot'" (p. 11). Owner
 * decision §4.1 Q29 = A: a card that is already ready cannot pay.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
} from "./testing/fixtures.js";
import { giveCard, payFor } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const READY_AN_ALLY = { readyCards: { slot: "readied", query: { categories: ["ally" as const] }, min: 1, max: 1 } };
const mark = {
  kind: "addCounters",
  target: { kind: "self" },
  counterType: "done",
  amount: { kind: "const", value: 1 },
};
/** "Action: Ready an ally you control → place 1 done counter here." */
const DRILL_ACTION = stubAbility(
  "drill.action",
  def({ trigger: { kind: "action" }, cost: READY_AN_ALLY, effects: [mark as never] }),
);
const DRILL = stubSupport({ id: "drill", cost: 0, abilities: [DRILL_ACTION.ref] });
/** "Action: Ready an ally you control → ready your hero and place 1 done counter on that ally." */
const SYNC_ACTION = stubAbility(
  "sync.action",
  def({
    trigger: { kind: "action" },
    cost: READY_AN_ALLY,
    effects: [
      { kind: "ready", target: { kind: "identityOf", player: { kind: "controller" } } },
      { ...mark, target: { kind: "slot", slot: "readied" } } as never,
    ],
  }),
);
const SYNC = stubEvent({ id: "sync", cost: 0, abilities: [SYNC_ACTION.ref] });
/** "As an additional cost for the engaged player to ready a hero or ally they control, spend a [mental] resource." */
const FEAR_RULE = stubAbility(
  "fear.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [
        {
          kind: "readyCost",
          target: { categories: ["hero", "ally"], controlledBy: { kind: "engagedWith", of: { kind: "self" } } },
          player: { kind: "engagedWith", of: { kind: "self" } },
          resources: { mental: 1 },
        },
      ],
    },
    effects: [],
  }),
);
const FEAR = stubMinion({ id: "fear", atk: 1, sch: 1, hp: 5, boostIcons: 0, abilities: [FEAR_RULE.ref] });
/** "Heroes and allies cannot be readied by player card effects." */
const STORM_RULE = stubAbility(
  "storm.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "cannotReady", target: { categories: ["hero", "ally"] }, bySource: "playerCard" }],
    },
    effects: [],
  }),
);
const STORM = stubSideScheme({ id: "storm", startingThreat: 5, abilities: [STORM_RULE.ref] });
/** "Forced Interrupt: When an ally would ready, place 1 frozen counter here instead." */
const FROZEN_RULE = stubAbility(
  "frozen.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "cardReadying", targetIs: { categories: ["ally"] } } },
    effects: [{ kind: "replaceTriggeringEvent", with: [{ ...mark, counterType: "frozen" } as never] }],
  }),
);
const FROZEN = stubUpgrade({ id: "frozen", cost: 0, abilities: [FROZEN_RULE.ref] });
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 3 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps = depsOf(DRILL_ACTION, SYNC_ACTION, FEAR_RULE, STORM_RULE, FROZEN_RULE);
const DECK: readonly CardId[] = [DRILL.id, SYNC.id, FROZEN.id, ...copiesOf(RECRUIT.id, 2)];

function start(players: 1 | 2 = 1): GameState {
  const base = gameAtFirstTurn({
    cards: [DRILL, SYNC, FEAR, STORM, FROZEN, RECRUIT, BLANK],
    deps,
    deck: DECK,
    players,
    encounter: [FEAR.id, STORM.id, ...copiesOf(BLANK.id, 30)],
  });
  return { ...base, players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const identityOf = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).identity.instanceId;
const setExhausted = (state: GameState, exhausted: boolean, ...ids: InstanceId[]): GameState => ({
  ...state,
  instances: {
    ...state.instances,
    ...Object.fromEntries(ids.map((id) => [id, { ...mustInstance(state, id), exhausted }])),
  },
});
const counters = (state: GameState, id: InstanceId, type = "done") => mustInstance(state, id).counters[type] ?? 0;
const exhausted = (state: GameState, id: InstanceId) => mustInstance(state, id).exhausted;
const settled = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: "readyCardsCostSettled" }> => e.type === "readyCardsCostSettled");

/** The drill in play and `allies` recruits, each exhausted or ready as listed. */
function board(allies: readonly boolean[], base = start()) {
  const drill = playerCardIntoPlay(base, DRILL.id);
  let state = drill.state;
  const ids: InstanceId[] = [];
  for (const tired of allies) {
    const placed = playerCardIntoPlay(state, RECRUIT.id);
    state = setExhausted(placed.state, tired, placed.id);
    ids.push(placed.id);
  }
  return { state, drill: drill.id, allies: ids };
}
const useDrill = (drill: InstanceId, extra: Partial<Extract<Command, { type: "useAbility" }>> = {}): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: drill,
  abilityId: DRILL_ACTION.ref.id,
  payment: [],
  ...extra,
});
function run(state: GameState, ...commands: readonly Command[]) {
  const driven = driveSession(startSession(state), deps, commands);
  return { state: driven.session.state, events: driven.events, session: driven.session };
}
/** The drill's action among the legal actions; null when it is not offered. */
function offer(state: GameState) {
  const all = legalActions(state, P1, deps);
  if (all.kind !== "turn") return null;
  return all.legal.find((a) => a.action.kind === "useAbility" && a.action.abilityId === DRILL_ACTION.ref.id) ?? null;
}
const offered = (state: GameState): boolean => offer(state) !== null;

describe("§3.54 `AbilityCost.readyCards`", () => {
  it("an exhausted ally pays: it readies, then the effects resolve; the log replays", () => {
    const { state: before, drill, allies } = board([true]);
    expect(offered(before)).toBe(true);
    const { state, events, session } = run(before, useDrill(drill));
    expect(exhausted(state, allies[0]!)).toBe(false);
    expect(counters(state, drill)).toBe(1);
    expect(settled(events)).toEqual([
      { type: "readyCardsCostSettled", instanceId: drill, playerId: P1, instanceIds: allies, readied: 1, paid: true },
    ]);
    // The ready is logged before the effect after the arrow.
    const order = events.map((e) => e.type).filter((type) => type === "cardReadied" || type === "counterAdded");
    expect(order).toEqual(["cardReadied", "counterAdded"]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("Q29 = A: an ally that is already ready cannot pay, so the ability cannot be used and nothing is spent", () => {
    const { state, drill, allies } = board([false]);
    const result = applyCommand(state, useDrill(drill), deps);
    expect(result.ok).toBe(false);
    expect(applyCommand(state, useDrill(drill, { costChoices: { readied: allies } }), deps).ok).toBe(false);
    expect(offered(state)).toBe(false);
    expect(counters(state, drill)).toBe(0);
  });

  it("no ally in play at all: the ability cannot be used", () => {
    const { state, drill } = board([]);
    expect(applyCommand(state, useDrill(drill), deps).ok).toBe(false);
  });

  it("one exhausted and one ready ally: the pick is forced to the exhausted one", () => {
    const { state: before, drill, allies } = board([false, true]);
    const { state } = run(before, useDrill(drill));
    expect(exhausted(state, allies[1]!)).toBe(false);
    expect(counters(state, drill)).toBe(1);
    // Naming the ready one is refused.
    expect(applyCommand(before, useDrill(drill, { costChoices: { readied: [allies[0]!] } }), deps).ok).toBe(false);
  });

  it("two exhausted allies: the payer names which one; only that one readies", () => {
    const { state: before, drill, allies } = board([true, true]);
    // `legalActions` offers it, with an example command that names one of them.
    const example = offer(before)?.example;
    expect(example?.type === "useAbility" ? example.costChoices : undefined).toEqual({ readied: [allies[0]] });
    const unnamed = applyCommand(before, useDrill(drill), deps);
    expect(unnamed.ok).toBe(false);
    if (!unnamed.ok) expect(unnamed.error.code).toBe("invalid_choice");
    const { state } = run(before, useDrill(drill, { costChoices: { readied: [allies[1]!] } }));
    expect(exhausted(state, allies[0]!)).toBe(true);
    expect(exhausted(state, allies[1]!)).toBe(false);
    // The cost asks for exactly one.
    expect(applyCommand(before, useDrill(drill, { costChoices: { readied: allies } }), deps).ok).toBe(false);
  });

  it("only cards the payer controls: another player's exhausted ally cannot pay", () => {
    const base = start(2);
    const drill = playerCardIntoPlay(base, DRILL.id, P1);
    const theirs = playerCardIntoPlay(drill.state, RECRUIT.id, P2);
    const state = setExhausted(theirs.state, true, theirs.id);
    expect(applyCommand(state, useDrill(drill.id), deps).ok).toBe(false);
    expect(applyCommand(state, useDrill(drill.id, { costChoices: { readied: [theirs.id] } }), deps).ok).toBe(false);
  });

  it("a card that cannot be readied by a player card is no candidate", () => {
    const { state: before, drill } = board([true]);
    const storm = encounterCardInVillainArea(before, STORM.id, 5);
    expect(applyCommand(storm.state, useDrill(drill), deps).ok).toBe(false);
    expect(offered(storm.state)).toBe(false);
  });

  it("the cost of an event played from hand: the ally readies, then the hero; a ready ally refuses the play", () => {
    const { state: before, allies } = board([true]);
    const tired = setExhausted(before, true, identityOf(before));
    const sync = giveCard(tired, P1, SYNC.id);
    const play: Command = {
      type: "playCard",
      playerId: P1,
      cardInstanceId: sync.id,
      payment: [],
      attachToInstanceId: null,
    };
    const { state, events } = run(sync.state, play);
    expect(exhausted(state, allies[0]!)).toBe(false);
    expect(exhausted(state, identityOf(state))).toBe(false);
    // The effects read the card the cost readied from its slot.
    expect(counters(state, allies[0]!)).toBe(1);
    expect(settled(events).map((e) => e.paid)).toEqual([true]);
    const rested = setExhausted(sync.state, false, allies[0]!);
    expect(applyCommand(rested, play, deps).ok).toBe(false);
    expect(mustPlayer(rested, P1).hand).toContain(sync.id);
  });
});

describe("§3.54 an additional cost to ready the card is paid with the cost", () => {
  /** The drill, one exhausted ally, and the taxing minion engaged with the payer. */
  function taxed() {
    const { state, drill, allies } = board([true]);
    return { state: minionEngagedWith(state, FEAR.id).state, drill, ally: allies[0]! };
  }

  it("not paid: the ability cannot be used and the ally stays exhausted", () => {
    const { state, drill, ally } = taxed();
    const result = applyCommand(state, useDrill(drill), deps);
    expect(result.ok).toBe(false);
    expect(exhausted(state, ally)).toBe(true);
  });

  it("paid in the same payment: the ally readies and is not asked for the additional cost again", () => {
    const { state: before, drill, ally } = taxed();
    const payment: readonly Payment[] = payFor(before, P1, 1);
    const { state, events } = run(before, useDrill(drill, { payment }));
    expect(exhausted(state, ally)).toBe(false);
    expect(counters(state, drill)).toBe(1);
    expect(events.filter((e) => e.type === "readyCostAsked")).toEqual([]);
    expect(mustPlayer(state, P1).hand.length).toBe(mustPlayer(before, P1).hand.length - 1);
  });
});

describe("§3.54 a ready that does not happen leaves the cost unpaid", () => {
  it("a 'would ready' replacement takes the ready: the effects after the arrow do not resolve", () => {
    const { state: before, drill, allies } = board([true]);
    const frozen = playerCardIntoPlay(before, FROZEN.id);
    const { state, events } = run(frozen.state, useDrill(drill));
    expect(counters(state, frozen.id, "frozen")).toBe(1);
    expect(exhausted(state, allies[0]!)).toBe(true);
    expect(settled(events)).toEqual([
      { type: "readyCardsCostSettled", instanceId: drill, playerId: P1, instanceIds: allies, readied: 0, paid: false },
    ]);
    expect(counters(state, drill)).toBe(0);
  });
});
