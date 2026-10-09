/**
 * docs/phase7-wave8.md §3.28: `EffectSpec resolveSpecials` with `trigger: "forcedInterrupt"`, shaped like "For each
 * [CELESTIAL] attachment in play, resolve its effect as if the attached villain just schemed against you and attacked
 * you."
 *
 * Each attachment's printed Forced Interrupt ("When the villain schemes against you, …" / "When the villain attacks
 * you, …") resolves with the resolving player as "you" and the attachment as its source, reading an activation of the
 * card it is attached to that never happens. The sibling of §3.11's Forced Response
 * (`resolve-forced-response.test.ts`).
 *
 * Sources: RRG 1.8 "Self-Referential" (p. 39), "You, Your" (p. 49), "Activation" (p. 6: an activation is an enemy
 * resolving its attack or scheme, which is not what happens here), "Interrupt" (p. 25). No FFG ruling on this card in
 * the post-RRG 1.7 transcript. Synthetic cards only.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAttachment, stubEnvironment, stubMinion, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const self: TargetRef = { kind: "self" };
const you: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const mark = (counterType: string, target: TargetRef = self): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType,
  amount: n(1),
});
const interrupt = (
  id: string,
  on: StubAbility["definition"]["trigger"] & { kind: "interrupt" },
  effects: EffectSpec[],
) => stubAbility(id, { trigger: on, effects });
const HOST = { hostOfSelf: true } as const;

/** "Forced Interrupt: When attached villain schemes against you, take 1 damage. [Mark the scheming enemy.]" */
const PLATE_INTERRUPT = interrupt(
  "plate.forced-interrupt",
  { kind: "interrupt", forced: true, on: { on: "enemyScheme", sourceIs: HOST, playerIs: "controller" } },
  [{ kind: "dealDamage", target: you, amount: n(1) }, mark("schemed", { kind: "eventSource" })],
);
/** "Forced Interrupt: When attached villain attacks you, take 2 damage. Discard this card." */
const BLADE_INTERRUPT = interrupt(
  "blade.forced-interrupt",
  {
    kind: "interrupt",
    forced: true,
    on: { on: "enemyAttack", sourceIs: HOST, playerIs: "controller", usesAttackedPlayer: true },
  },
  [
    { kind: "dealDamage", target: you, amount: n(2) },
    mark("attacked", { kind: "eventSource" }),
    { kind: "discardFromPlay", target: self },
  ],
);
/** "Forced Interrupt: When a card enters play, place 1 counter here." Not a condition an activation meets. */
const ALARM_INTERRUPT = interrupt(
  "alarm.forced-interrupt",
  { kind: "interrupt", forced: true, on: { on: "cardEntersPlay" } },
  [mark("rang")],
);
/** An ordinary (unforced) Interrupt on the same attachment: not a Forced Interrupt. */
const ALARM_OPTIONAL = interrupt(
  "alarm.interrupt",
  { kind: "interrupt", forced: false, on: { on: "enemyScheme", sourceIs: HOST } },
  [mark("optional")],
);
const villainHost = { kind: "villain" } as const;
const PLATE = stubAttachment({ id: "plate", attachesTo: villainHost, abilities: [PLATE_INTERRUPT.ref] });
const BLADE = stubAttachment({ id: "blade", attachesTo: villainHost, abilities: [BLADE_INTERRUPT.ref] });
const ALARM = stubAttachment({
  id: "alarm",
  attachesTo: villainHost,
  abilities: [ALARM_INTERRUPT.ref, ALARM_OPTIONAL.ref],
});
/** A minion's own "Forced Interrupt: When this minion attacks you, [mark the attacking enemy]." */
const HOUND_INTERRUPT = interrupt(
  "hound.forced-interrupt",
  { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source", playerIs: "controller" } },
  [mark("attacked", { kind: "eventSource" })],
);
const HOUND = stubMinion({ id: "hound", atk: 1, sch: 1, hp: 3, boostIcons: 0, abilities: [HOUND_INTERRUPT.ref] });
/** An environment (attached to nothing): "Forced Interrupt: When the villain schemes against you, [mark that villain]." */
const SIREN_INTERRUPT = interrupt(
  "siren.forced-interrupt",
  { kind: "interrupt", forced: true, on: { on: "enemyScheme", sourceIs: { categories: ["villain"] } } },
  [mark("schemed", { kind: "eventSource" })],
);
/** "Forced Interrupt: When a minion schemes against you, …": the active villain is not that enemy. */
const SIREN_MINION = interrupt(
  "siren.forced-interrupt-2",
  { kind: "interrupt", forced: true, on: { on: "enemyScheme", sourceIs: { categories: ["minion"] } } },
  [mark("minionSchemed")],
);
const SIREN = stubEnvironment({ id: "siren", abilities: [SIREN_INTERRUPT.ref, SIREN_MINION.ref] });
/** A player card: "Forced Interrupt: When an enemy attacks or schemes, place 1 counter here." Hears real activations. */
const WATCH_INTERRUPT = interrupt(
  "watch.forced-interrupt",
  { kind: "interrupt", forced: true, on: { on: ["enemyAttack", "enemyScheme"] } },
  [mark("heard")],
);
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_INTERRUPT.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const ATTACHMENTS: TargetRef = { kind: "each", query: { categories: ["attachment"] } };
const resolveThem = (of: TargetRef, abilities?: readonly StubAbility[]): EffectSpec => ({
  kind: "resolveSpecials",
  of,
  trigger: "forcedInterrupt",
  bind: "tech",
  ...(abilities ? { abilities: abilities.map((a) => a.ref.id) } : {}),
});
/** Records `<bind>.count` as counters on the source, so a test can read how many resolved. */
const tally: EffectSpec = {
  kind: "addCounters",
  target: self,
  counterType: "resolved",
  amount: { kind: "var", name: "tech.count" },
};
const action = (id: string, ...effects: EffectSpec[]) =>
  stubAbility(`relay.${id}`, { trigger: { kind: "action" }, effects });
/** "For each attachment in play, resolve its effect as if the attached villain just schemed against you and attacked you." */
const EACH = action("each", resolveThem(ATTACHMENTS), tally);
const ONLY_PLATE = action("only-plate", resolveThem(ATTACHMENTS, [PLATE_INTERRUPT]), tally);
const MINIONS = action("minions", resolveThem({ kind: "each", query: { categories: ["minion"] } }), tally);
const ENVIRONMENTS = action(
  "environments",
  resolveThem({ kind: "each", query: { categories: ["environment"] } }),
  tally,
);
const ACTIONS = [EACH, ONLY_PLATE, MINIONS, ENVIRONMENTS];
/** A player's support that prints the four as Actions: its controller is "you". */
const RELAY = stubSupport({ id: "relay", cost: 0, abilities: ACTIONS.map((a) => a.ref) });

const deps: EngineDeps = depsOf(
  PLATE_INTERRUPT,
  BLADE_INTERRUPT,
  ALARM_INTERRUPT,
  ALARM_OPTIONAL,
  HOUND_INTERRUPT,
  SIREN_INTERRUPT,
  SIREN_MINION,
  WATCH_INTERRUPT,
  ...ACTIONS,
);

type Gear = typeof PLATE | typeof BLADE | typeof ALARM;
/** P1's first turn with the relay and the watch in play, and `gear` attached to the villain (surgery: no reveal). */
function start(...gear: readonly Gear[]) {
  const begun = gameAtFirstTurn({
    cards: [PLATE, BLADE, ALARM, HOUND, SIREN, WATCH, RELAY, BLANK],
    deps,
    deck: [WATCH.id, RELAY.id],
    encounter: [PLATE.id, BLADE.id, ALARM.id, HOUND.id, SIREN.id, ...copiesOf(BLANK.id, 20)],
  });
  const relay = playerCardIntoPlay(begun, RELAY.id);
  const watch = playerCardIntoPlay(relay.state, WATCH.id);
  let state = watch.state;
  const villain = activeVillain(state).instanceId;
  const ids: Record<string, InstanceId> = {};
  for (const card of gear) {
    const piles = Object.entries(state.encounterDecks).find(([, p]) =>
      p.deck.some((id) => state.instances[id]?.cardId === card.id),
    )!;
    const id = piles[1].deck.find((candidate) => state.instances[candidate]?.cardId === card.id)!;
    ids[card.id] = id;
    state = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [piles[0]]: { ...piles[1], deck: piles[1].deck.filter((x) => x !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), faceup: true, attachedTo: villain },
        [villain]: { ...mustInstance(state, villain), attachments: [...mustInstance(state, villain).attachments, id] },
      },
    };
  }
  return { state, relay: relay.id, watch: watch.id, villain, ids };
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const counters = (state: GameState, id: InstanceId, type: string) => mustInstance(state, id).counters[type] ?? 0;
const heroDamage = (state: GameState) => mustInstance(state, mustPlayer(state, P1).identity.instanceId).damage;
const resolvedIds = (events: readonly GameEvent[]) => of(events, "abilityResolved").map((e) => e.abilityId as string);
function use(state: GameState, relay: InstanceId, ability: StubAbility, pick = defaultPick) {
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: relay,
    abilityId: ability.ref.id,
    payment: [],
  };
  const run = driveSession(startSession(state), deps, [command], pick);
  return { state: run.session.state, events: run.events, session: run.session };
}

describe("§3.28 resolveSpecials with trigger forcedInterrupt", () => {
  it("each attachment's Forced Interrupt resolves once with the resolving player as 'you', as if its villain schemed and attacked; nothing activates", () => {
    const at = start(PLATE, BLADE);
    const run = use(at.state, at.relay, EACH);
    // The scheme interrupt's 1 damage and the attack interrupt's 2, to the player who resolved them.
    expect(heroDamage(run.state)).toBe(heroDamage(at.state) + 3);
    expect(resolvedIds(run.events)).toEqual(
      expect.arrayContaining([PLATE_INTERRUPT.ref.id as string, BLADE_INTERRUPT.ref.id as string]),
    );
    expect(counters(run.state, at.relay, "resolved")).toBe(2);
    // "The attached villain" is who each reads as having schemed or attacked.
    expect(counters(run.state, at.villain, "schemed")).toBe(1);
    expect(counters(run.state, at.villain, "attacked")).toBe(1);
    // Each attachment is the source of its own ability: the blade discarded itself, the plate stays.
    expect(cardsInPlay(run.state)).not.toContain(at.ids[BLADE.id]);
    expect(cardsInPlay(run.state)).toContain(at.ids[PLATE.id]);
    // No activation: nothing logged as an attack or a scheme, no boost card, and "when an enemy attacks or schemes"
    // on another card heard nothing.
    expect(of(run.events, "attackResolved")).toHaveLength(0);
    expect(of(run.events, "schemeResolved")).toHaveLength(0);
    expect(of(run.events, "boostCardDealt")).toHaveLength(0);
    expect(counters(run.state, at.watch, "heard")).toBe(0);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });

  it("with several, the resolving player orders them", () => {
    const at = start(PLATE, BLADE);
    const prompts: string[] = [];
    const bladeFirst = (state: GameState) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "orderSpecials") return defaultPick(state);
      prompts.push(choice.playerId);
      return [...choice.options].reverse().map((o) => o.optionId);
    };
    const run = use(at.state, at.relay, EACH, bladeFirst);
    expect(prompts).toEqual([P1]);
    const order = resolvedIds(run.events).filter((id) => id !== (EACH.ref.id as string));
    expect(order).toEqual([BLADE_INTERRUPT.ref.id, PLATE_INTERRUPT.ref.id]);
  });

  it("`abilities` names the ones to resolve: the other attachment's is left alone", () => {
    const at = start(PLATE, BLADE);
    const run = use(at.state, at.relay, ONLY_PLATE);
    expect(heroDamage(run.state)).toBe(heroDamage(at.state) + 1);
    expect(counters(run.state, at.relay, "resolved")).toBe(1);
    expect(cardsInPlay(run.state)).toContain(at.ids[BLADE.id]);
  });

  it("a Forced Interrupt with another condition, and an unforced Interrupt, are not resolved or counted", () => {
    const at = start(ALARM, PLATE);
    const run = use(at.state, at.relay, EACH);
    expect(counters(run.state, at.ids[ALARM.id]!, "rang")).toBe(0);
    expect(counters(run.state, at.ids[ALARM.id]!, "optional")).toBe(0);
    expect(counters(run.state, at.relay, "resolved")).toBe(1);
    expect(heroDamage(run.state)).toBe(heroDamage(at.state) + 1);
  });

  it("'when this minion attacks you' reads the minion itself as the attacker", () => {
    const at = start();
    const hound = minionEngagedWith(at.state, HOUND.id);
    const run = use(hound.state, at.relay, MINIONS);
    expect(counters(run.state, hound.id, "attacked")).toBe(1);
    expect(counters(run.state, at.relay, "resolved")).toBe(1);
    expect(of(run.events, "attackResolved")).toHaveLength(0);
  });

  it("a card attached to nothing reads the active villain, when its condition is about that enemy; otherwise nothing resolves", () => {
    const at = start();
    const siren = encounterCardInVillainArea(at.state, SIREN.id);
    const run = use(siren.state, at.relay, ENVIRONMENTS);
    expect(counters(run.state, at.villain, "schemed")).toBe(1);
    expect(counters(run.state, siren.id, "minionSchemed")).toBe(0);
    expect(counters(run.state, at.relay, "resolved")).toBe(1);
  });

  it("with no such attachment in play nothing resolves", () => {
    const at = start();
    const run = use(at.state, at.relay, EACH);
    expect(counters(run.state, at.relay, "resolved")).toBe(0);
    expect(heroDamage(run.state)).toBe(heroDamage(at.state));
  });
});
