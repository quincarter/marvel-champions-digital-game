/**
 * Owner ruling 2026-10-06 (docs/phase7-wave7.md §4.1, Cypher 41013: "After Cypher attacks and damages a confused enemy,
 * draw 1 card"): a killing blow on a confused enemy still triggers it. "The attack did damage it while it was confused;
 * defeat doesn't erase that triggering condition."
 *
 * As built: a `dealDamage` event's target snapshot (`TargetSnapshot`) carries the status cards the target held as the
 * damage was dealt, and an attack's damage to the character it attacks hands that snapshot to the `attack` event
 * (`attack.targetAsDamaged`). A response's top-level `hasStatus` / `hasAnyStatus` clauses read the snapshot; an
 * interrupt (before any damage) and an attack that dealt its target no damage read the live card.
 *
 * Sources: RRG 1.8 "Response" (p. 38): a response resolves after its triggering condition; "Status Cards" (p. 41);
 * "Tough" (p. 44); "In Play and Out of Play" (p. 23): a defeated minion's status cards leave play with it.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { cardsInPlay } from "./select.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, StatusName, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const self: TargetRef = { kind: "self" };
const MINION: TargetQuery = { categories: ["minion"] };
const theMinion: TargetRef = { kind: "each", query: MINION };
const one = { kind: "const", value: 1 } as const;
const bump = (counterType: string): EffectSpec => ({ kind: "addCounters", target: self, counterType, amount: one });

/** "Forced Response: After you attack [and damage] an enemy matching `targetIs`, place a counter here." */
const afterAttack = (counter: string, targetIs: TargetQuery, damages: boolean) =>
  stubAbility(
    `watch.${counter}`,
    def({
      trigger: {
        kind: "response",
        forced: true,
        on: { on: "attack", playerIs: "controller", targetIs, ...(damages ? { requireResults: { damage: 1 } } : {}) },
      },
      effects: [bump(counter)],
    }),
  );
const HIT_CONFUSED = afterAttack("hitConfused", { ...MINION, hasStatus: "confused" }, true);
const HIT_STUNNED = afterAttack("hitStunned", { ...MINION, hasStatus: "stunned" }, true);
const HIT_ANY_STATUS = afterAttack("hitAnyStatus", { ...MINION, hasAnyStatus: true }, true);
const HIT_NO_STATUS = afterAttack("hitNoStatus", { ...MINION, hasAnyStatus: false }, true);
const ATTACKED_CONFUSED = afterAttack("attackedConfused", { ...MINION, hasStatus: "confused" }, false);
const ATTACKED_TOUGH = afterAttack("attackedTough", { ...MINION, hasStatus: "tough" }, false);
/** "Forced Interrupt: When you attack a confused enemy": before any damage, so it reads the card as it is. */
const WHEN_ATTACK_CONFUSED = stubAbility(
  "watch.whenConfused",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "attack", playerIs: "controller", targetIs: { ...MINION, hasStatus: "confused" } },
    },
    effects: [bump("whenConfused")],
  }),
);
/** "Forced Response: After a confused minion takes damage": the damage event's own snapshot. */
const DAMAGED_CONFUSED = stubAbility(
  "watch.damagedConfused",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "dealDamage", targetIs: { ...MINION, hasStatus: "confused" }, requireResults: { amount: 1 } },
    },
    effects: [bump("damagedConfused")],
  }),
);
const WATCHES = [
  HIT_CONFUSED,
  HIT_STUNNED,
  HIT_ANY_STATUS,
  HIT_NO_STATUS,
  ATTACKED_CONFUSED,
  ATTACKED_TOUGH,
  WHEN_ATTACK_CONFUSED,
  DAMAGED_CONFUSED,
];
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: WATCHES.map((w) => w.ref) });

const event = (id: string, effects: readonly EffectSpec[], label?: "attack") => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action", ...(label ? { label: [label] } : {}) },
    effects,
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const strike = (amount: number): EffectSpec => ({
  kind: "attack",
  target: theMinion,
  amount: { kind: "const", value: amount },
});
/** "(attack): Deal N damage to an enemy." */
const STRIKE_1 = event("strike-1", [strike(1)], "attack");
const STRIKE_5 = event("strike-5", [strike(5)], "attack");
/** "(attack): Confuse an enemy. Deal 5 damage to it.": the status is given by the attack's own ability, before damage. */
const DAZE_STRIKE = event(
  "daze-strike",
  [{ kind: "giveStatus", target: theMinion, status: "confused" }, strike(5)],
  "attack",
);
/** "(attack): Discard a confused status card from an enemy. Deal 5 damage to it.": gone before the damage. */
const CLEAR_STRIKE = event(
  "clear-strike",
  [{ kind: "removeStatus", target: theMinion, status: "confused" }, strike(5)],
  "attack",
);
/** "Deal 5 damage to an enemy.": damage that is no attack. */
const ZAP_5 = event("zap-5", [{ kind: "dealDamage", target: theMinion, amount: { kind: "const", value: 5 } }]);
const EVENTS = [STRIKE_1, STRIKE_5, DAZE_STRIKE, CLEAR_STRIKE, ZAP_5];

const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 4 });
const deps: EngineDeps = depsOf(...WATCHES, ...EVENTS.map((e) => e.ability));

const COUNTERS = [
  "hitConfused",
  "hitStunned",
  "hitAnyStatus",
  "hitNoStatus",
  "attackedConfused",
  "attackedTough",
  "whenConfused",
  "damagedConfused",
] as const;
type Counts = Partial<Record<(typeof COUNTERS)[number], number>>;

interface Table {
  readonly state: GameState;
  readonly watch: InstanceId;
  readonly goon: InstanceId;
}

/** p1 in hero form with the watcher in play and a goon engaged, holding these status cards. */
function table(statuses: readonly StatusName[] = []): Table {
  const start = gameAtFirstTurn({
    deps,
    cards: [WATCH, GOON, ...EVENTS.map((e) => e.card)],
    deck: [WATCH.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
    encounter: [GOON.id, ...copiesOf(TREACHERY.id, 29)],
  });
  const watched = playerCardIntoPlay(start, WATCH.id);
  const engaged = minionEngagedWith(watched.state, GOON.id);
  const held = { stunned: 0, confused: 0, tough: 0 };
  for (const status of statuses) held[status] = 1;
  const state: GameState = {
    ...engaged.state,
    players: engaged.state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: {
      ...engaged.state.instances,
      [engaged.id]: { ...mustInstance(engaged.state, engaged.id), statuses: held },
    },
  };
  return { state, watch: watched.id, goon: engaged.id };
}

function play(t: Table, card: string) {
  const given = giveCard(t.state, P1, card);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return runCommands(given.state, deps, command);
}
function basicAttack(t: Table) {
  const attacker = t.state.players[0]!.identity.instanceId;
  return runCommands(t.state, deps, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: attacker,
    targetInstanceId: t.goon,
  });
}

const counts = (state: GameState, t: Table): Counts => {
  const counters = mustInstance(state, t.watch).counters;
  return Object.fromEntries(COUNTERS.flatMap((name) => ((counters[name] ?? 0) > 0 ? [[name, counters[name]]] : [])));
};
const inPlay = (state: GameState, t: Table): boolean => cardsInPlay(state).includes(t.goon);
const resolved = <K extends "attack" | "dealDamage">(events: readonly GameEvent[], kind: K) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === kind
      ? [e.event as Extract<typeof e.event, { kind: K }>]
      : [],
  );

function expectReplays(result: ReturnType<typeof play>): void {
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

describe("an attack's response reads its target's status cards as the attack damaged it", () => {
  it("a killing blow on a confused enemy: it was confused as the attack damaged it", () => {
    const t = table(["confused"]);
    const after = play(t, STRIKE_5.card.id);
    expect(inPlay(after.state, t)).toBe(false);
    expect(mustInstance(after.state, t.goon).statuses.confused).toBe(0);
    expect(counts(after.state, t)).toEqual({
      whenConfused: 1,
      hitConfused: 1,
      hitAnyStatus: 1,
      attackedConfused: 1,
      damagedConfused: 1,
    });
    expect(resolved(after.events, "attack")[0]?.targetAsDamaged?.statuses).toEqual({
      stunned: 0,
      confused: 1,
      tough: 0,
    });
    expectReplays(after);
  });

  it("a blow it survives reads the same", () => {
    const t = table(["confused"]);
    const after = play(t, STRIKE_1.card.id);
    expect(inPlay(after.state, t)).toBe(true);
    expect(counts(after.state, t)).toEqual({
      whenConfused: 1,
      hitConfused: 1,
      hitAnyStatus: 1,
      attackedConfused: 1,
      damagedConfused: 1,
    });
  });

  it("a basic attack carries the snapshot as an ability's attack does", () => {
    const t = table(["confused", "stunned"]);
    const weakened: Table = {
      ...t,
      state: {
        ...t.state,
        instances: { ...t.state.instances, [t.goon]: { ...mustInstance(t.state, t.goon), damage: 3 } },
      },
    };
    const after = basicAttack(weakened);
    expect(inPlay(after.state, t)).toBe(false);
    expect(counts(after.state, t)).toEqual({
      whenConfused: 1,
      hitConfused: 1,
      hitStunned: 1,
      hitAnyStatus: 1,
      attackedConfused: 1,
      damagedConfused: 1,
    });
    expectReplays(after);
  });

  it("an enemy with no status card, defeated: only 'no status card' matches", () => {
    const t = table();
    const after = play(t, STRIKE_5.card.id);
    expect(inPlay(after.state, t)).toBe(false);
    expect(counts(after.state, t)).toEqual({ hitNoStatus: 1 });
    expect(resolved(after.events, "attack")[0]?.targetAsDamaged?.statuses).toEqual({
      stunned: 0,
      confused: 0,
      tough: 0,
    });
  });

  it("a confused status card the attack's own ability gives before its damage counts", () => {
    const t = table();
    const after = play(t, DAZE_STRIKE.card.id);
    expect(inPlay(after.state, t)).toBe(false);
    // The interrupt window opened as the attack began, after the status card was given by the earlier effect.
    expect(counts(after.state, t)).toEqual({
      whenConfused: 1,
      hitConfused: 1,
      hitAnyStatus: 1,
      attackedConfused: 1,
      damagedConfused: 1,
    });
    expectReplays(after);
  });

  it("a confused status card discarded before the attack's damage does not count", () => {
    const t = table(["confused"]);
    const after = play(t, CLEAR_STRIKE.card.id);
    expect(inPlay(after.state, t)).toBe(false);
    expect(counts(after.state, t)).toEqual({ hitNoStatus: 1 });
  });

  it("a tough status card absorbs the damage: no damage result, and the card is read as it took the attack", () => {
    const t = table(["confused", "tough"]);
    const after = play(t, STRIKE_5.card.id);
    expect(mustInstance(after.state, t.goon)).toMatchObject({ damage: 0, statuses: { confused: 1, tough: 0 } });
    // Nothing was damaged, so no "attacks and damages" response; "attacks a tough enemy" reads the tough card the
    // attack used up, and "attacks a confused enemy" the card still there.
    expect(counts(after.state, t)).toEqual({ whenConfused: 1, attackedConfused: 1, attackedTough: 1 });
    expect(resolved(after.events, "attack")[0]?.targetAsDamaged?.statuses).toEqual({
      stunned: 0,
      confused: 1,
      tough: 1,
    });
    expectReplays(after);
  });

  it("damage that is no attack stamps the damage event, not an attack", () => {
    const t = table(["confused"]);
    const after = play(t, ZAP_5.card.id);
    expect(inPlay(after.state, t)).toBe(false);
    expect(counts(after.state, t)).toEqual({ damagedConfused: 1 });
    expect(resolved(after.events, "attack")).toEqual([]);
    expect(resolved(after.events, "dealDamage")[0]?.targetAsDamaged?.statuses).toEqual({
      stunned: 0,
      confused: 1,
      tough: 0,
    });
  });

  it("the interrupt window reads the live card: the attack event carries no snapshot yet", () => {
    const t = table(["confused"]);
    const after = play(t, STRIKE_5.card.id);
    const pending = after.events.flatMap((e) =>
      e.type === "windowOpened" && e.timing === "interrupt" && e.event.kind === "attack" ? [e.event] : [],
    );
    expect(pending).toHaveLength(1);
    expect(pending[0]).not.toHaveProperty("targetAsDamaged");
  });
});
