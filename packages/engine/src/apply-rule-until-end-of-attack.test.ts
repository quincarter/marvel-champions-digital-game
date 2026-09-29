/**
 * `EffectSpec applyRuleUntil` with `until: "endOfAttack"` (spec.ts docblock). Modeled on In Cold Blood (`sm` 27029):
 * "The Lizard attacks you. You cannot play events until after that attack resolves." Synthetic cards: a support whose
 * action makes the villain attack you under that restriction, an interrupt event that would answer the attack, and an
 * action event to play once it is over.
 *
 * "That attack" is the one the same effects frame's next `enemyAttack` initiates (`attack: "initiated"`): the rule
 * waits on the frame (`awaitingAttack`), is retimed to the attack's event frame, and expires with it. No attack, no
 * lingering rule. Sources: RRG 1.8 "Lasting Effects" (p. 26); "Play, Put Into Play" (p. 32): an event played in a
 * timing window is still played, so a `cannotPlay` rule keeps it out of the window.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { cannotPlayCard } from "./rules.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE, resolvePending, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);

const NO_EVENTS: RuleSpec = { kind: "cannotPlay", player: { kind: "controller" }, cards: { categories: ["event"] } };
const untilThatAttack: EffectSpec = {
  kind: "applyRuleUntil",
  rule: NO_EVENTS,
  until: "endOfAttack",
  attack: "initiated",
};
const villainAttacksYou = (name = "villain"): EffectSpec => ({
  kind: "enemyAttack",
  enemies: { kind: "named", name },
  against: { kind: "controller" },
  bind: "attack",
});

/** "Action: The villain attacks you. You cannot play events until after that attack resolves." */
const LURE_ABILITY = stubAbility(
  "lure.action",
  def({ trigger: { kind: "action" }, effects: [untilThatAttack, villainAttacksYou()] }),
);
/** The same attack with no restriction: the control case, showing the interrupt is otherwise offered. */
const BAIT_ABILITY = stubAbility("bait.action", def({ trigger: { kind: "action" }, effects: [villainAttacksYou()] }));
/** "Action: A minion named Nobody attacks you. You cannot play events until after that attack resolves." */
const DUD_ABILITY = stubAbility(
  "dud.action",
  def({ trigger: { kind: "action" }, effects: [untilThatAttack, villainAttacksYou("Nobody")] }),
);
/** The rule with no `enemyAttack` after it at all: it must end with its frame. */
const STRAY_ABILITY = stubAbility("stray.action", def({ trigger: { kind: "action" }, effects: [untilThatAttack] }));
/** "Until the end of this attack" with no attack in progress and no initiated one: not created. */
const IDLE_ABILITY = stubAbility(
  "idle.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "applyRuleUntil", rule: NO_EVENTS, until: "endOfAttack" }] }),
);
/** "Hero Interrupt: When an enemy attacks you, draw 1 card." */
const WARD_ABILITY = stubAbility(
  "ward.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: false,
      on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
    },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
  }),
);
/** "Action: Draw 1 card." */
const TRICK_ABILITY = stubAbility(
  "trick.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
  }),
);

const LURE = stubSupport({ id: "lure", cost: 0, abilities: [LURE_ABILITY.ref] });
const BAIT = stubSupport({ id: "bait", cost: 0, abilities: [BAIT_ABILITY.ref] });
const DUD = stubSupport({ id: "dud", cost: 0, abilities: [DUD_ABILITY.ref] });
const STRAY = stubSupport({ id: "stray", cost: 0, abilities: [STRAY_ABILITY.ref] });
const IDLE = stubSupport({ id: "idle", cost: 0, abilities: [IDLE_ABILITY.ref] });
const WARD = stubEvent({ id: "ward", cost: 0, abilities: [WARD_ABILITY.ref] });
const TRICK = stubEvent({ id: "trick", cost: 0, abilities: [TRICK_ABILITY.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  LURE_ABILITY,
  BAIT_ABILITY,
  DUD_ABILITY,
  STRAY_ABILITY,
  IDLE_ABILITY,
  WARD_ABILITY,
  TRICK_ABILITY,
);

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const use = (id: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: id,
  abilityId: abilityId as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

interface Setup {
  readonly state: GameState;
  readonly support: InstanceId;
  readonly ward: InstanceId;
  readonly trick: InstanceId;
}

/** Hero form, `support` in play, Ward and Trick in hand. */
function setup(support: typeof LURE): Setup {
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 1, sch: 0 }] }),
    mainScheme: stubMainScheme({
      id: "scheme",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [BLANK, support, WARD, TRICK],
    deck: [support.id, WARD.id, TRICK.id, ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(BLANK.id, 20),
    deps,
  });
  const given = giveCards(state, p1, support.id, WARD.id, TRICK.id);
  const [supportId, ward, trick] = given.ids as [InstanceId, InstanceId, InstanceId];
  const ready = runWith(deps, given.state, { type: "changeForm", playerId: p1 }, play(supportId));
  return { state: ready, support: supportId, ward, trick };
}

interface Traced {
  readonly state: GameState;
  /** Every option id offered while the action resolved. */
  readonly offered: readonly string[];
  /** Whether Trick was forbidden at each choice point along the way. */
  readonly trickForbidden: readonly boolean[];
}

/** Uses the support's action and answers every choice by default, recording what each choice offered. */
function useAndTrace(setupState: Setup, abilityId: string): Traced {
  const result = applyCommand(setupState.state, use(setupState.support, abilityId), deps);
  if (!result.ok) throw new Error(result.error.message);
  let state = result.state;
  const offered: string[] = [];
  const trickForbidden: boolean[] = [];
  for (let guard = 0; state.pendingChoice && !state.outcome; guard++) {
    if (guard > 100) throw new Error("choice loop did not settle");
    offered.push(...state.pendingChoice.options.map((o) => o.optionId));
    trickForbidden.push(cannotPlayCard(state, deps, p1, setupState.trick));
    state = resolvePending(state, defaultPick(state), deps);
  }
  return { state, offered, trickForbidden };
}

const cannotPlayRules = (state: GameState) =>
  state.lastingEffects.filter((e) => e.kind === "ruleGrant" && e.rule.kind === "cannotPlay");

describe("applyRuleUntil endOfAttack — 'You cannot play events until after that attack resolves'", () => {
  it("control: without the rule, the interrupt event is offered during the attack", () => {
    const s = setup(BAIT);
    const { offered } = useAndTrace(s, BAIT_ABILITY.ref.id);
    expect(offered.some((id) => id.startsWith(`${s.ward}:`))).toBe(true);
  });

  it("events cannot be played while that attack resolves: the interrupt event is never offered", () => {
    const s = setup(LURE);
    const hp = mustPlayer(s.state, p1).identity.instanceId;
    const damageBefore = s.state.instances[hp]!.damage;
    const { state, offered, trickForbidden } = useAndTrace(s, LURE_ABILITY.ref.id);
    expect(offered.some((id) => id.startsWith(`${s.ward}:`))).toBe(false);
    // Every choice point inside the attack had the restriction active.
    expect(trickForbidden.length).toBeGreaterThan(0);
    expect(trickForbidden.every(Boolean)).toBe(true);
    // The attack did resolve (villain ATK 1, undefended).
    expect(state.instances[hp]!.damage).toBe(damageBefore + 1);
    expect(mustPlayer(state, p1).hand).toContain(s.ward);
  });

  it("events are playable again once the attack has resolved", () => {
    const s = setup(LURE);
    const { state } = useAndTrace(s, LURE_ABILITY.ref.id);
    expect(cannotPlayRules(state)).toEqual([]);
    expect(cannotPlayCard(state, deps, p1, s.trick)).toBe(false);
    const played = applyCommand(state, play(s.trick), deps);
    expect(played.ok).toBe(true);
  });

  it("logs the rule waiting on the frame, retimed to the attack's event frame, and expiring with it", () => {
    const s = setup(LURE);
    const { session, events } = driveSession(
      startSession(s.state),
      deps,
      [use(s.support, LURE_ABILITY.ref.id)],
      defaultPick,
    );
    const added = events.find(
      (e): e is Extract<GameEvent, { type: "lastingEffectAdded" }> =>
        e.type === "lastingEffectAdded" && e.effect.kind === "ruleGrant",
    );
    expect(added?.effect.duration.kind).toBe("awaitingAttack");
    const retimed = events.find(
      (e): e is Extract<GameEvent, { type: "lastingEffectRetimed" }> =>
        e.type === "lastingEffectRetimed" && e.id === added?.effect.id,
    );
    expect(retimed?.duration.kind).toBe("endOfEvent");
    const retimedAt = events.indexOf(retimed!);
    const endedAt = events.findIndex((e) => e.type === "lastingEffectEnded" && e.id === added?.effect.id);
    const resolvedAt = events.findIndex((e) => e.type === "attackResolved");
    expect(resolvedAt).toBeGreaterThan(retimedAt);
    expect(endedAt).toBeGreaterThan(resolvedAt);
    expect(cannotPlayRules(session.state)).toEqual([]);
  });

  it("no attack made (no such enemy in play): the rule does not linger", () => {
    const s = setup(DUD);
    const { state, offered } = useAndTrace(s, DUD_ABILITY.ref.id);
    expect(offered).toEqual([]);
    expect(cannotPlayRules(state)).toEqual([]);
    expect(cannotPlayCard(state, deps, p1, s.trick)).toBe(false);
  });

  it("no attack made (the enemy is stunned): the rule does not linger", () => {
    const s = setup(LURE);
    const villain = Object.values(s.state.instances).find((i) => i.cardId === "villain")!;
    const stunned: Setup = {
      ...s,
      state: {
        ...s.state,
        instances: {
          ...s.state.instances,
          [villain.instanceId]: { ...villain, statuses: { ...villain.statuses, stunned: 1 } },
        },
      },
    };
    const { state } = useAndTrace(stunned, LURE_ABILITY.ref.id);
    expect(state.instances[villain.instanceId]!.statuses.stunned ?? 0).toBe(0);
    expect(cannotPlayRules(state)).toEqual([]);
  });

  it("the frame finishes without reaching an enemyAttack: the rule ends with it", () => {
    const s = setup(STRAY);
    const { state } = useAndTrace(s, STRAY_ABILITY.ref.id);
    expect(cannotPlayRules(state)).toEqual([]);
  });

  it("attack: 'current' with no attack in progress: not created at all", () => {
    const s = setup(IDLE);
    const { session, events } = driveSession(
      startSession(s.state),
      deps,
      [use(s.support, IDLE_ABILITY.ref.id)],
      defaultPick,
    );
    expect(events.some((e) => e.type === "lastingEffectAdded")).toBe(false);
    expect(cannotPlayRules(session.state)).toEqual([]);
  });

  it("replays deep-equal", () => {
    const s = setup(LURE);
    const { session } = driveSession(
      startSession(s.state),
      deps,
      [use(s.support, LURE_ABILITY.ref.id), play(s.trick)],
      defaultPick,
    );
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
