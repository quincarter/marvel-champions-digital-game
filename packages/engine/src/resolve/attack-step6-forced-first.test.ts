/**
 * The abilities an attack triggers as it finishes resolve forced first, across every trigger of that step, not window by
 * window.
 *
 * RRG v1.8 p.8–9 "Attack (Enemy Activation)" step 6: "a. Forced abilities (such as the retaliate keyword) with the
 * following triggers (in any order): 'after [character] attacks …', 'after [character] is attacked …', 'after
 * [character] defends …', 'after [character] [takes/deals] damage …'. b. Non-forced abilities with the triggers listed
 * above." RRG v1.8 p.9 "Attack (Player Ability Type)" items 7–9: forced "after … attacks" / "after … is attacked"
 * (retaliate) abilities, then the non-forced ones, then consequential damage.
 *
 * Synthetic cards. Each observer resolves to an `abilityResolved` line, and the test reads the order of those lines
 * (and of retaliate's `damageDealt`) in the log.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "../abilities.js";
import type { Command } from "../commands.js";
import { replay, startSession } from "../engine.js";
import type { GameEvent } from "../events.js";
import type { InstanceId } from "../ids.js";
import { activeVillain, mustPlayer } from "../query.js";
import type { EffectSpec, TargetRef } from "../spec.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { driveSession } from "../testing/drive.js";
import { stubIdentity, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "../testing/fixtures.js";
import { defaultPick, HERO, runWith } from "../testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "../testing/wave3.js";

const you = { kind: "controller" } as const;
const theVillain: TargetRef = { kind: "named", name: "villain" };
const mark = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "self" },
  counterType,
  amount: { kind: "const", value: 1 },
});
const response = (id: string, forced: boolean, on: object) =>
  stubAbility(id, { trigger: { kind: "response", forced, on }, effects: [mark(id)] } as AbilityDefinition);

const MY_HERO = { categories: ["hero"], controller: "you" } as const;
/** Forced: "After the villain attacks you." */
const ATTACKS_YOU = response("attacks-you.forced", true, {
  on: "enemyAttack",
  playerIs: "controller",
  usesAttackedPlayer: true,
});
/** Optional: "After the villain attacks you." */
const ATTACKS_YOU_OPTIONAL = response("attacks-you.optional", false, {
  on: "enemyAttack",
  playerIs: "controller",
  usesAttackedPlayer: true,
});
/** Optional: "After your hero takes damage." */
const TAKES_OPTIONAL = response("takes.optional", false, { on: "dealDamage", targetIs: MY_HERO });
/** Forced: "After your hero defends." */
const DEFENDS = response("defends.forced", true, { on: "defended", targetIs: MY_HERO });
/** Forced: "After your hero attacks." */
const YOU_ATTACK = response("you-attack.forced", true, { on: "attack", playerIs: "controller" });
/** Optional: "After you deal damage to an enemy." */
const DEALS_OPTIONAL = response("deals.optional", false, {
  on: "dealDamage",
  sourceIs: { controller: "you", categories: ["identity"] },
  targetIs: { categories: ["enemy"] },
});

/** "Action: the villain attacks you." */
const ATTACK_ME = stubAbility("attack-me.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: you }],
});

const OBSERVERS = [ATTACKS_YOU, ATTACKS_YOU_OPTIONAL, TAKES_OPTIONAL, DEFENDS, YOU_ATTACK, DEALS_OPTIONAL];
const deps: EngineDeps = depsOf(...OBSERVERS, ATTACK_ME);
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const ATTACKER = stubSupport({ id: "attacker", cost: 0, abilities: [ATTACK_ME.ref] });
/** One support per observer, so each test puts in play only the ones it watches. */
const watcher = (ability: (typeof OBSERVERS)[number]) =>
  stubSupport({ id: `watch-${ability.ref.id}`, cost: 0, abilities: [ability.ref] });
const WATCHERS = OBSERVERS.map(watcher);

function setup(watching: readonly (typeof OBSERVERS)[number][], villainRetaliate = false) {
  const villain = stubVillain({
    id: "villain",
    stages: [{ hp: flat(30), atk: 3, sch: 1, keywords: villainRetaliate ? [{ name: "retaliate", value: 1 }] : [] }],
  });
  const scheme = stubMainScheme({
    id: "main",
    stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
  });
  const hero = stubIdentity({
    id: HERO.id,
    hp: 12,
    atk: 2,
    thw: 2,
    def: 1,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
  });
  const supports = [ATTACKER, ...watching.map((ability) => WATCHERS[OBSERVERS.indexOf(ability)]!)];
  let state = gameAtFirstTurn({
    cards: [hero, ATTACKER, ...WATCHERS, BLANK],
    deps,
    villain,
    mainScheme: scheme,
    deck: supports.map((card) => card.id),
    encounter: copiesOf(BLANK.id, 30),
  });
  const placed: InstanceId[] = [];
  for (const card of supports) {
    const put = playerCardIntoPlay(state, card.id);
    state = put.state;
    placed.push(put.id);
  }
  if (mustPlayer(state, P1).identity.form !== "hero")
    state = runWith(deps, state, { type: "changeForm", playerId: P1 });
  return {
    state,
    hero: mustPlayer(state, P1).identity.instanceId,
    villain: activeVillain(state).instanceId,
    attacker: placed[0]!,
  };
}
type Setup = ReturnType<typeof setup>;

/** Takes every optional response offered; declares the hero the defender when `defend`. */
const pickAll =
  (s: Setup, defend: boolean) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") return defend ? [s.hero] : ["decline"];
    if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
    return defaultPick(state);
  };

function villainAttacks(s: Setup, defend = false) {
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: s.attacker,
    abilityId: ATTACK_ME.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  return driveSession(startSession(s.state), deps, [command], pickAll(s, defend));
}

function heroAttacksVillain(s: Setup) {
  const command: Command = {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: s.hero,
    targetInstanceId: s.villain,
  };
  return driveSession(startSession(s.state), deps, [command], pickAll(s, false));
}

/** Where in the log `ability` resolved; -1 if it never did. */
const resolvedAt = (events: readonly GameEvent[], ability: (typeof OBSERVERS)[number]): number =>
  events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === ability.ref.id);

const expectReplays = (session: { log: Parameters<typeof replay>[0]; state: GameState }) => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};

describe("RRG v1.8 p.8-9 'Attack (Enemy Activation)' step 6: forced step 6 abilities before non-forced ones", () => {
  it("a forced 'after the villain attacks you' resolves before an optional 'after your hero takes damage'", () => {
    const s = setup([ATTACKS_YOU, TAKES_OPTIONAL]);
    const { session, events } = villainAttacks(s);
    const forced = resolvedAt(events, ATTACKS_YOU);
    const optional = resolvedAt(events, TAKES_OPTIONAL);
    expect(forced).toBeGreaterThanOrEqual(0);
    expect(optional).toBeGreaterThan(forced);
    // One window: the attack's, with the damage sharing it.
    const step6 = events.filter(
      (e) => e.type === "windowOpened" && e.timing === "response" && e.event.kind === "enemyAttack",
    );
    expect(step6.length).toBeGreaterThan(0);
    for (const window of step6) {
      if (window.type === "windowOpened") expect(window.alsoEvents?.map((e) => e.kind)).toContain("dealDamage");
    }
    expectReplays(session);
  });

  it("a forced 'after your hero defends' resolves before an optional 'after the villain attacks you'", () => {
    const s = setup([DEFENDS, ATTACKS_YOU_OPTIONAL]);
    const { session, events } = villainAttacks(s, true);
    const forced = resolvedAt(events, DEFENDS);
    const optional = resolvedAt(events, ATTACKS_YOU_OPTIONAL);
    expect(forced).toBeGreaterThanOrEqual(0);
    expect(optional).toBeGreaterThan(forced);
    expectReplays(session);
  });
});

describe("RRG v1.8 p.9 'Attack (Player Ability Type)' items 7-8: forced after-attack abilities and retaliate first", () => {
  it("a forced 'after your hero attacks' resolves before an optional 'after you deal damage to an enemy'", () => {
    const s = setup([YOU_ATTACK, DEALS_OPTIONAL]);
    const { session, events } = heroAttacksVillain(s);
    const forced = resolvedAt(events, YOU_ATTACK);
    const optional = resolvedAt(events, DEALS_OPTIONAL);
    expect(forced).toBeGreaterThanOrEqual(0);
    expect(optional).toBeGreaterThan(forced);
    expectReplays(session);
  });

  it("the villain's retaliate damages the hero before an optional 'after you deal damage to an enemy' resolves", () => {
    const s = setup([DEALS_OPTIONAL], true);
    const { session, events } = heroAttacksVillain(s);
    const retaliate = events.findIndex(
      (e) => e.type === "damageDealt" && e.targetInstanceId === s.hero && e.sourceInstanceId === s.villain,
    );
    const optional = resolvedAt(events, DEALS_OPTIONAL);
    expect(retaliate).toBeGreaterThanOrEqual(0);
    expect(optional).toBeGreaterThan(retaliate);
    expectReplays(session);
  });
});
