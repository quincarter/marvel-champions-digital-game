/**
 * "X activates against you" (docs/phase7-wave5.md §4.1 Q67, the user's decision, 2026-09-27): `EffectSpec
 * enemyActivation` attacks the player if their identity is in hero form and schemes against them if it is in alter-ego
 * form, read when the effect resolves, the way the villain phase activates an enemy (RRG 1.8 "Activation", p. 6: "Some
 * card abilities can also cause enemies to attack or scheme. These are also considered activations"). A stun cancels
 * only the attack and confusion only the scheme (RRG 1.8 "Stun", "Confused"). A trigger on `["enemyAttack",
 * "enemyScheme"]` ("when X activates against you") fires on either. Synthetic cards throughout.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState, StatusCounts } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const one = { kind: "const", value: 1 } as const;

/** "The villain activates against you. Each boost card turned faceup during that activation gets +1 boost icon." */
const ACTIVATES: EffectSpec = {
  kind: "enemyActivation",
  enemies: { kind: "named", name: "villain" },
  against: { kind: "controller" },
  boostIconsEach: one,
  atkBonus: { kind: "const", value: 10 },
  schBonus: { kind: "const", value: 20 },
};
const RETORT_ABILITY = stubAbility("retort.action", def({ trigger: { kind: "action" }, effects: [ACTIVATES] }));
/** "Forced Interrupt: When the villain activates against you, deal 1 damage to the villain." */
const WATCH_ABILITY = stubAbility(
  "watch.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: ["enemyAttack", "enemyScheme"], playerIs: "controller", usesAttackedPlayer: true },
    },
    effects: [{ kind: "dealDamage", target: { kind: "named", name: "villain" }, amount: one }],
  }),
);

const RETORT = stubSupport({ id: "retort", cost: 0, abilities: [RETORT_ABILITY.ref] });
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_ABILITY.ref] });
/** Every encounter card has exactly 1 boost icon and no Boost ability. */
const ONE = stubTreachery({ id: "one", boostIcons: 1 });

const deps: EngineDeps = depsOf(RETORT_ABILITY, WATCH_ABILITY);

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const use = (id: InstanceId): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: id,
  abilityId: RETORT_ABILITY.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

interface Setup {
  readonly state: GameState;
  readonly retort: InstanceId;
  readonly villain: InstanceId;
  readonly hero: InstanceId;
  readonly scheme: InstanceId;
}

/** Villain ATK 1, SCH 1; undefended attacks (default pick declines). The game starts in alter-ego form. */
function setup(form: "hero" | "alterEgo", statuses: Partial<StatusCounts> = {}, watching = false): Setup {
  const extra = watching ? [RETORT, WATCH] : [RETORT];
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 1, sch: 1 }] }),
    mainScheme: stubMainScheme({
      id: "scheme",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [ONE, ...extra],
    deck: [...extra.map((c) => c.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(ONE.id, 20),
    deps,
  });
  const given = giveCards(state, p1, ...extra.map((c) => c.id));
  const ids = given.ids as readonly InstanceId[];
  let ready = runWith(deps, given.state, ...ids.map(play));
  if (form === "hero") ready = runWith(deps, ready, { type: "changeForm", playerId: p1 });
  const villain = Object.values(ready.instances).find((i) => i.cardId === "villain")!;
  ready = {
    ...ready,
    instances: {
      ...ready.instances,
      [villain.instanceId]: { ...villain, statuses: { ...villain.statuses, ...statuses } },
    },
  };
  expect(mustPlayer(ready, p1).identity.form).toBe(form);
  return {
    state: ready,
    retort: ids[0]!,
    villain: villain.instanceId,
    hero: mustPlayer(ready, p1).identity.instanceId,
    scheme: ready.mainScheme!.instanceId,
  };
}

const run = (s: Setup) => driveSession(startSession(s.state), deps, [use(s.retort)], defaultPick);
const flips = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "boostCardFlipped" ? [e.boostIcons] : []));
const kinds = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "attackResolved" || e.type === "schemeResolved" ? [e.type] : []));

describe("enemyActivation — 'X activates against you' by the player's form (§4.1 Q67)", () => {
  it("hero form: the villain attacks, with atkBonus and the +1 boost icon; no scheme", () => {
    const s = setup("hero");
    const damage = s.state.instances[s.hero]!.damage;
    const threat = s.state.instances[s.scheme]!.threat;
    const { session, events } = run(s);
    expect(kinds(events)).toEqual(["attackResolved"]);
    expect(flips(events)).toEqual([2]);
    // ATK 1 + 10 + (1 + 1) boost icons, undefended; schBonus is not read by an attack.
    expect(session.state.instances[s.hero]!.damage).toBe(damage + 13);
    expect(session.state.instances[s.scheme]!.threat).toBe(threat);
  });

  it("alter-ego form: the villain schemes, with schBonus and the +1 boost icon; no attack", () => {
    const s = setup("alterEgo");
    const damage = s.state.instances[s.hero]!.damage;
    const threat = s.state.instances[s.scheme]!.threat;
    const { session, events } = run(s);
    expect(kinds(events)).toEqual(["schemeResolved"]);
    expect(flips(events)).toEqual([2]);
    // SCH 1 + 20 + (1 + 1) boost icons; atkBonus is not read by a scheme.
    expect(session.state.instances[s.scheme]!.threat).toBe(threat + 23);
    expect(session.state.instances[s.hero]!.damage).toBe(damage);
  });

  it("a stunned villain against a hero discards the stun instead of attacking (RRG 1.8 'Stun')", () => {
    const s = setup("hero", { stunned: 1 });
    const damage = s.state.instances[s.hero]!.damage;
    const { session, events } = run(s);
    expect(kinds(events)).toEqual([]);
    expect(flips(events)).toEqual([]);
    expect(session.state.instances[s.villain]!.statuses.stunned).toBe(0);
    expect(session.state.instances[s.hero]!.damage).toBe(damage);
  });

  it("a stunned villain against an alter-ego still schemes and keeps its stun", () => {
    const s = setup("alterEgo", { stunned: 1 });
    const { session, events } = run(s);
    expect(kinds(events)).toEqual(["schemeResolved"]);
    expect(session.state.instances[s.villain]!.statuses.stunned).toBe(1);
  });

  it("a confused villain against an alter-ego discards the confusion instead of scheming (RRG 1.8 'Confused')", () => {
    const s = setup("alterEgo", { confused: 1 });
    const threat = s.state.instances[s.scheme]!.threat;
    const { session, events } = run(s);
    expect(kinds(events)).toEqual([]);
    expect(session.state.instances[s.villain]!.statuses.confused).toBe(0);
    expect(session.state.instances[s.scheme]!.threat).toBe(threat);
  });

  it("a confused villain against a hero still attacks and keeps its confusion", () => {
    const s = setup("hero", { confused: 1 });
    const { session, events } = run(s);
    expect(kinds(events)).toEqual(["attackResolved"]);
    expect(session.state.instances[s.villain]!.statuses.confused).toBe(1);
  });
});

describe("'When X activates against you' — on enemyAttack or enemyScheme", () => {
  for (const form of ["hero", "alterEgo"] as const) {
    it(`fires on the ${form === "hero" ? "attack" : "scheme"} (${form} form)`, () => {
      const s = setup(form, {}, true);
      const villainDamage = s.state.instances[s.villain]!.damage;
      const { session, events } = run(s);
      const fired = events.filter((e) => e.type === "abilityResolved" && e.abilityId === WATCH_ABILITY.ref.id);
      expect(fired).toHaveLength(1);
      expect(session.state.instances[s.villain]!.damage).toBe(villainDamage + 1);
    });
  }
});

describe("replay", () => {
  for (const form of ["hero", "alterEgo"] as const) {
    it(`replays deep-equal (${form})`, () => {
      const s = setup(form, {}, true);
      const { session } = run(s);
      const replayed = replay(session.log, deps);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(session.state);
    });
  }
});
