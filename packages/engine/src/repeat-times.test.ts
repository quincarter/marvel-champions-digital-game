/**
 * `EffectSpec repeatTimes`: "For each [countable game element], choose: …". Synthetic cards shaped like an event that
 * reads "Hero Action: For each Agency support you control, choose: remove 1 threat from a scheme, or deal 1 damage to
 * an enemy."
 *
 * Sources: RRG 1.8 "'For Each'" (p. 20): "'For each' indicates an effect is repeated based on the number of a
 * countable game element"; "If a 'for each' effect has a 'choose' instruction, each iteration of that choice is
 * considered a separate instance of that effect, even if the same target is chosen multiple times"; "The game state
 * updates after each instance (for example, if a minion or side scheme is defeated)."
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const AGENCY = trait("AGENCY");
const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const slot = (name: string) => ({ kind: "slot", slot: name }) as const;
const count = (query: TargetQuery): ValueSpec => ({ kind: "count", query });

const OFFICE = stubSupport({ id: "office", cost: 1, traits: [AGENCY] });
const SHOP = stubSupport({ id: "shop", cost: 1 });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 1 });

const REMOVE = "Remove 1 threat from a scheme";
const DAMAGE = "Deal 1 damage to an enemy";
const THREAT_OR_DAMAGE: EffectSpec = {
  kind: "chooseOne",
  chooser: you,
  options: [
    {
      label: REMOVE,
      effects: [
        { kind: "chooseTarget", slot: "scheme", query: { categories: ["scheme"] }, chooser: you },
        { kind: "removeThreat", target: slot("scheme"), amount: n(1) },
      ],
    },
    {
      label: DAMAGE,
      effects: [
        { kind: "chooseTarget", slot: "enemy", query: { categories: ["enemy"] }, chooser: you },
        { kind: "dealDamage", target: slot("enemy"), amount: n(1) },
      ],
    },
  ],
};

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "For each Agency support you control, choose: remove 1 threat from a scheme, or deal 1 damage to an enemy." */
const BULLETIN = actionEvent("bulletin", [
  {
    kind: "repeatTimes",
    times: count({ categories: ["support"], trait: AGENCY, controller: "you" }),
    effects: [THREAT_OR_DAMAGE],
  },
]);
/** "For each minion in play, choose an enemy and deal 1 damage to it." */
const SWEEP = actionEvent("sweep", [
  {
    kind: "repeatTimes",
    times: count({ categories: ["minion"] }),
    effects: [
      { kind: "chooseTarget", slot: "enemy", query: { categories: ["enemy"] }, chooser: you },
      { kind: "dealDamage", target: slot("enemy"), amount: n(1) },
    ],
  },
]);
/** Three passes, each of which must choose a minion. */
const HUNT = actionEvent("hunt", [
  {
    kind: "repeatTimes",
    times: n(3),
    effects: [
      { kind: "chooseTarget", slot: "minion", query: { categories: ["minion"] }, chooser: you },
      { kind: "dealDamage", target: slot("minion"), amount: n(1) },
    ],
  },
]);
/** A pass may not choose what the same pass already chose; the next pass starts without that binding. */
const TWICE = actionEvent("twice", [
  {
    kind: "repeatTimes",
    times: n(2),
    effects: [
      { kind: "chooseTarget", slot: "first", query: { categories: ["enemy"] }, chooser: you },
      {
        kind: "chooseTarget",
        slot: "second",
        query: { categories: ["enemy"], excludeSlots: ["first"] },
        chooser: you,
      },
      { kind: "dealDamage", target: slot("first"), amount: n(1) },
      { kind: "dealDamage", target: slot("second"), amount: n(1) },
    ],
  },
]);
/** A target chosen before the repetition is still "that enemy" inside every pass. */
const FOCUS = actionEvent("focus", [
  { kind: "chooseTarget", slot: "outer", query: { categories: ["enemy"] }, chooser: you },
  { kind: "repeatTimes", times: n(3), effects: [{ kind: "dealDamage", target: slot("outer"), amount: n(1) }] },
]);
/** Far more passes than any printed card asks for: stopped at the engine's repetition limit. */
const FLOOD = actionEvent("flood", [
  {
    kind: "repeatTimes",
    times: n(60),
    effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "tally", amount: n(1) }],
  },
]);
const TALLY = stubAbility("ledger.action", { trigger: { kind: "action" }, effects: FLOOD.ability.definition.effects });
const LEDGER = stubSupport({ id: "ledger", cost: 0, abilities: [TALLY.ref] });

const EVENTS = [BULLETIN, SWEEP, HUNT, TWICE, FOCUS];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability), TALLY);

interface Staged {
  readonly offices?: number;
  readonly shops?: number;
  readonly thugs?: number;
  readonly mainThreat?: number;
  readonly players?: 1 | 2;
  /** Agency supports the second player controls. */
  readonly theirOffices?: number;
}

function start(staged: Staged = {}): { state: GameState; thugs: InstanceId[]; main: InstanceId } {
  let state = gameAtFirstTurn({
    cards: [...EVENTS.map((e) => e.card), OFFICE, SHOP, THUG, LEDGER],
    deps,
    deck: [...EVENTS.flatMap((e) => copiesOf(e.card.id, 2)), ...copiesOf(OFFICE.id, 3), SHOP.id, LEDGER.id],
    encounter: copiesOf(THUG.id, 10),
    players: staged.players ?? 1,
  });
  for (let i = 0; i < (staged.offices ?? 0); i++) state = playerCardIntoPlay(state, OFFICE.id).state;
  for (let i = 0; i < (staged.shops ?? 0); i++) state = playerCardIntoPlay(state, SHOP.id).state;
  for (let i = 0; i < (staged.theirOffices ?? 0); i++) state = playerCardIntoPlay(state, OFFICE.id, P2).state;
  const thugs: InstanceId[] = [];
  for (let i = 0; i < (staged.thugs ?? 0); i++) {
    const engaged = minionEngagedWith(state, THUG.id);
    state = engaged.state;
    thugs.push(engaged.id);
  }
  const main = state.mainScheme.instanceId;
  state = {
    ...state,
    instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat: staged.mainThreat ?? 5 } },
  };
  return { state, thugs, main };
}

interface Asked {
  readonly kind: string;
  readonly offered: readonly string[];
}

/**
 * Plays `card` from hand for 0, answering each option prompt with the next label of `labels` and each target prompt
 * with the next id of `targets` (the first one offered once they run out). Records every prompt asked while it resolves.
 */
function playPicking(
  state: GameState,
  card: (typeof EVENTS)[number]["card"],
  labels: readonly string[] = [],
  targets: readonly InstanceId[] = [],
) {
  const given = giveCard(state, P1, card.id);
  const asked: Asked[] = [];
  const nextLabels = [...labels];
  const nextTargets = [...targets];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseOption") {
      asked.push({ kind: "chooseOption", offered: choice.options.map((o) => o.label ?? "") });
      const label = nextLabels.shift();
      const hit = choice.options.find((o) => o.label === label);
      return [hit ? (hit.optionId as string) : offered[0]!];
    }
    if (choice.prompt.kind === "chooseTarget") {
      asked.push({ kind: "chooseTarget", offered });
      const target = nextTargets.shift();
      return [target !== undefined && offered.includes(target) ? target : offered[0]!];
    }
    return defaultPick(s);
  };
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session, events } = driveSession(startSession(given.state), deps, [command], pick);
  return { session, state: session.state, events, asked, played: given.id };
}

const villainDamage = (state: GameState): number => mustInstance(state, state.activeVillainId!).damage;
const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const damageEvents = (events: readonly GameEvent[]): GameEvent[] => events.filter((e) => e.type === "damageDealt");
const options = (asked: readonly Asked[]): Asked[] => asked.filter((a) => a.kind === "chooseOption");

describe("repeatTimes: the count is read once and each pass is its own choice (RRG 1.8 \"'For Each'\", p. 20)", () => {
  it("0 counted cards: nothing is asked, nothing changes, and the event is still played and discarded", () => {
    const { state } = start();
    const result = playPicking(state, BULLETIN.card);
    expect(result.asked).toEqual([]);
    expect(villainDamage(result.state)).toBe(0);
    expect(mainThreat(result.state)).toBe(5);
    expect(mustPlayer(result.state, P1).discard).toContain(result.played);
  });

  it("1 counted card: one choice, 1 damage to the villain", () => {
    const { state } = start({ offices: 1 });
    const result = playPicking(state, BULLETIN.card, [DAMAGE]);
    expect(options(result.asked)).toHaveLength(1);
    expect(options(result.asked)[0]!.offered).toEqual([REMOVE, DAMAGE]);
    expect(villainDamage(result.state)).toBe(1);
    expect(mainThreat(result.state)).toBe(5);
  });

  it("1 counted card: the other option removes 1 threat from the main scheme, 5 to 4", () => {
    const { state } = start({ offices: 1 });
    const result = playPicking(state, BULLETIN.card, [REMOVE]);
    expect(villainDamage(result.state)).toBe(0);
    expect(mainThreat(result.state)).toBe(4);
  });

  it("3 counted cards, the same enemy each time: three separate instances of 1 damage, 3 on the villain", () => {
    const { state } = start({ offices: 3 });
    const villain = state.activeVillainId!;
    const result = playPicking(state, BULLETIN.card, [DAMAGE, DAMAGE, DAMAGE], [villain, villain, villain]);
    expect(options(result.asked)).toHaveLength(3);
    expect(villainDamage(result.state)).toBe(3);
    const dealt = damageEvents(result.events);
    expect(dealt).toHaveLength(3);
    for (const event of dealt) expect(event).toMatchObject({ targetInstanceId: villain, amount: 1 });
  });

  it("3 counted cards, mixed: damage, threat, damage leaves 2 on the villain and 4 threat of 5", () => {
    const { state } = start({ offices: 3 });
    const result = playPicking(state, BULLETIN.card, [DAMAGE, REMOVE, DAMAGE]);
    expect(options(result.asked)).toHaveLength(3);
    expect(villainDamage(result.state)).toBe(2);
    expect(mainThreat(result.state)).toBe(4);
  });

  it("3 counted cards, a different target each time: the villain, a minion and the main scheme", () => {
    const { state, thugs } = start({ offices: 3, thugs: 1 });
    const result = playPicking(state, BULLETIN.card, [DAMAGE, DAMAGE, REMOVE], [state.activeVillainId!, thugs[0]!]);
    expect(villainDamage(result.state)).toBe(1);
    expect(mustPlayer(result.state, P1).playArea).not.toContain(thugs[0]);
    expect(mainThreat(result.state)).toBe(4);
  });

  it("counts only what the query names: a support without the trait and another player's support add no pass", () => {
    const { state } = start({ offices: 2, shops: 1, theirOffices: 3, players: 2 });
    const result = playPicking(state, BULLETIN.card, [DAMAGE, DAMAGE, DAMAGE, DAMAGE]);
    expect(options(result.asked)).toHaveLength(2);
    expect(villainDamage(result.state)).toBe(2);
  });

  it("the count is read once: 2 minions make 2 passes although the first pass defeats one of them", () => {
    const { state, thugs } = start({ thugs: 2 });
    const villain = state.activeVillainId!;
    const result = playPicking(state, SWEEP.card, [], [thugs[0]!, villain]);
    const targets = result.asked.filter((a) => a.kind === "chooseTarget");
    expect(targets).toHaveLength(2);
    // The game state updates between passes: the defeated minion is no longer offered to the second pass.
    expect([...targets[0]!.offered].sort()).toEqual([villain, thugs[0]!, thugs[1]!].sort());
    expect([...targets[1]!.offered].sort()).toEqual([villain, thugs[1]!].sort());
    expect(villainDamage(result.state)).toBe(1);
    expect(mustPlayer(result.state, P1).playArea).toContain(thugs[1]);
    expect(mustInstance(result.state, thugs[1]!).damage).toBe(0);
  });

  it("fewer legal targets than passes: 3 passes over 1 minion deal 1 damage once and the rest do nothing", () => {
    const { state, thugs } = start({ thugs: 1 });
    const result = playPicking(state, HUNT.card);
    expect(damageEvents(result.events)).toHaveLength(1);
    expect(mustPlayer(result.state, P1).playArea).not.toContain(thugs[0]);
    expect(villainDamage(result.state)).toBe(0);
    expect(result.state.pendingChoice).toBeNull();
    expect(mustPlayer(result.state, P1).discard).toContain(result.played);
  });

  it("3 passes of threat removal over 2 threat: the scheme ends at 0 and the game goes on", () => {
    const { state } = start({ offices: 3, mainThreat: 2 });
    const result = playPicking(state, BULLETIN.card, [REMOVE, REMOVE, REMOVE]);
    expect(mainThreat(result.state)).toBe(0);
    expect(villainDamage(result.state)).toBe(0);
    expect(result.state.pendingChoice).toBeNull();
  });

  it("a pass does not see what an earlier pass chose: the second pass is offered the first pass's target again", () => {
    const { state, thugs } = start({ thugs: 1 });
    const villain = state.activeVillainId!;
    // Pass 1: the villain, then (the villain excluded within the pass) the minion. Pass 2: the villain is offered again.
    const result = playPicking(state, TWICE.card, [], [villain, thugs[0]!, villain]);
    const targets = result.asked.filter((a) => a.kind === "chooseTarget");
    expect([...targets[0]!.offered].sort()).toEqual([villain, thugs[0]!].sort());
    expect(targets[1]!.offered).toEqual([thugs[0]!]);
    expect(targets[2]!.offered).toEqual([villain]);
    expect(villainDamage(result.state)).toBe(2);
  });

  it("what the ability bound before the repetition is read by every pass: 3 damage on the enemy chosen first", () => {
    const { state, thugs } = start({ thugs: 1 });
    const villain = state.activeVillainId!;
    const result = playPicking(state, FOCUS.card, [], [villain]);
    expect(result.asked.filter((a) => a.kind === "chooseTarget")).toHaveLength(1);
    expect(villainDamage(result.state)).toBe(3);
    expect(mustInstance(result.state, thugs[0]!).damage).toBe(0);
  });

  it("stops at the repetition limit: 60 passes asked for, 50 resolved", () => {
    const { state } = start();
    const ledger = playerCardIntoPlay(state, LEDGER.id);
    const { session } = driveSession(startSession(ledger.state), deps, [
      { type: "useAbility", playerId: P1, cardInstanceId: ledger.id, abilityId: TALLY.ref.id, payment: [] },
    ]);
    expect(mustInstance(session.state, ledger.id).counters).toEqual({ tally: 50 });
  });

  it("replays to the same state", () => {
    const { state } = start({ offices: 3, thugs: 1 });
    const result = playPicking(state, BULLETIN.card, [DAMAGE, REMOVE, DAMAGE]);
    const replayed = replay(result.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(result.state);
  });
});
