/**
 * `TargetRef { kind: "activatingEnemy" }`: the enemy whose activation, an attack or a scheme, is in progress (the
 * innermost `enemyAttack` / `enemyScheme` event frame), while it is in play. The Brotherhood boosts in Mansion Attack
 * (`mut_gen` 32132-32135): "[star] Boost: If the villain is [Name], give him an additional boost card for this
 * activation." Ruling, February 28, 2026 (6): "If a Villainous minion activates and draws Pirate Lackey as a boost card
 * (which gives a boost card to the villain while it has 1+ boost cards), does the villain receive a boost card? No.
 * Because the villain is not activating, do not give it a boost card." By analogy (pending default Q82) the extra card
 * goes only to the named villain's own activation, which is what the ref lets a Boost ability (no triggering event)
 * ask. Synthetic cards throughout.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustPlayer } from "./query.js";
import { resolveRef } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE, runWith, withEncounterPiles } from "./testing/scenario.js";
import { minionEngagedWith } from "./testing/wave3.js";

const p1 = playerId("p1");
const ACTIVATING: TargetRef = { kind: "activatingEnemy" };
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const theVillain = { kind: "villain" } as const;
const theMinion = { kind: "each", query: { categories: ["minion"] } } as const;
const you = { kind: "controller" } as const;

/** "Boost: If the villain is Boss, give him an additional boost card for this activation." */
const EXTRA_BOOST = stubAbility("extra.boost", {
  trigger: { kind: "boost" },
  effects: [
    {
      kind: "if",
      condition: { kind: "refMatches", ref: ACTIVATING, query: { categories: ["villain"], name: "Boss" } },
      then: [{ kind: "modifyAttack", extraBoostCards: 1 }],
    },
  ],
});
const EXTRA = stubTreachery({ id: "extra", boostIcons: 1, abilities: [EXTRA_BOOST.ref] });
const ONE = stubTreachery({ id: "one", boostIcons: 1 });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 9, keywords: [{ name: "villainous" }] });

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, { trigger: { kind: "action" }, effects });
const VILLAIN_ATTACKS = action("villain-attacks.action", [{ kind: "enemyAttack", enemies: theVillain, against: you }]);
const VILLAIN_SCHEMES = action("villain-schemes.action", [{ kind: "enemyScheme", enemies: theVillain, against: you }]);
const MINION_ATTACKS = action("minion-attacks.action", [{ kind: "enemyAttack", enemies: theMinion, against: you }]);
const MINION_SCHEMES = action("minion-schemes.action", [{ kind: "enemyScheme", enemies: theMinion, against: you }]);
const ABILITIES = [VILLAIN_ATTACKS, VILLAIN_SCHEMES, MINION_ATTACKS, MINION_SCHEMES] as const;
const SUPPORTS = ABILITIES.map((a) => stubSupport({ id: a.ref.id.split(".")[0]!, cost: 0, abilities: [a.ref] }));

const deps: EngineDeps = depsOf(EXTRA_BOOST, ...ABILITIES);

interface Setup {
  readonly state: GameState;
  readonly supports: readonly InstanceId[];
  readonly villain: InstanceId;
  readonly minion: InstanceId;
  readonly hero: InstanceId;
}

/** Villain `name` (ATK 1, SCH 1), a villainous minion (ATK 1, SCH 1) engaged with p1, the four supports in play,
 * hero form; the encounter deck is EXTRA on top of ONEs. */
function setup(name = "Boss"): Setup {
  const state = newGame({
    villain: stubVillain({ id: "villain", name, stages: [{ hp: flat(30), atk: 1, sch: 1 }] }),
    mainScheme: stubMainScheme({
      id: "main",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [EXTRA, ONE, GOON, ...SUPPORTS],
    deck: [...SUPPORTS.map((s) => s.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: [GOON.id, EXTRA.id, ...copies(ONE.id, 20)],
    deps,
  });
  const given = giveCards(state, p1, ...SUPPORTS.map((s) => s.id));
  const supports = given.ids as readonly InstanceId[];
  const ready = runWith(
    deps,
    given.state,
    { type: "changeForm", playerId: p1 },
    ...supports.map((id): Command => ({
      type: "playCard",
      playerId: p1,
      cardInstanceId: id,
      payment: [],
      attachToInstanceId: null,
    })),
  );
  const engaged = minionEngagedWith(ready, GOON.id);
  const deck = activeEncounterDeck(engaged.state).deck;
  const extra = deck.find((id) => engaged.state.instances[id]?.cardId === EXTRA.id)!;
  const stacked = withEncounterPiles(engaged.state, { deck: [extra, ...deck.filter((id) => id !== extra)] });
  return {
    state: stacked,
    supports,
    villain: Object.values(stacked.instances).find((i) => i.cardId === "villain")!.instanceId,
    minion: engaged.id,
    hero: mustPlayer(stacked, p1).identity.instanceId,
  };
}

const use = (s: Setup, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: s.supports[ABILITIES.indexOf(ability as (typeof ABILITIES)[number])]!,
  abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

function run(s: Setup, commands: readonly Command[]) {
  return driveSession(startSession(s.state), deps, commands, defaultPick);
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const dealtTo = (events: readonly GameEvent[], enemy: InstanceId) =>
  of(events, "boostCardDealt").filter((e) => e.enemyInstanceId === enemy);

describe("activatingEnemy: the enemy whose activation is in progress", () => {
  it("names nothing outside an activation", () => {
    const s = setup();
    const context = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };
    expect(resolveRef(s.state, ACTIVATING, context)).toEqual([]);
  });

  it("names the enemy of the innermost enemyScheme frame, and nothing once it has left play", () => {
    const s = setup();
    const context = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };
    const frame = (enemy: InstanceId) =>
      ({
        frameId: "f-scheme",
        kind: "event",
        event: { kind: "enemyScheme", enemyInstanceId: enemy, playerId: p1 },
        stage: "apply",
        vars: {},
        slots: {},
      }) as never;
    const scheming: GameState = { ...s.state, stack: [frame(s.minion), frame(s.villain), ...s.state.stack] };
    expect(resolveRef(scheming, ACTIVATING, context)).toEqual([s.minion]);
    // `attackingEnemy` keeps naming attacks only.
    expect(resolveRef(scheming, { kind: "attackingEnemy" }, context)).toEqual([]);
    const gone: GameState = {
      ...scheming,
      players: scheming.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== s.minion) })),
    };
    expect(resolveRef(gone, ACTIVATING, context)).toEqual([]);
  });

  it("the named villain attacking: the boost gives him an additional boost card", () => {
    const s = setup();
    const damage = s.state.instances[s.hero]!.damage;
    const { session, events } = run(s, [use(s, VILLAIN_ATTACKS)]);
    expect(dealtTo(events, s.villain)).toHaveLength(2);
    expect(of(events, "boostCardFlipped")).toHaveLength(2);
    expect(session.state.instances[s.hero]!.damage).toBe(damage + 3);
  });

  it("the named villain scheming: the boost gives him an additional boost card", () => {
    const s = setup();
    const scheme = s.state.mainScheme.instanceId;
    const threat = s.state.instances[scheme]!.threat;
    const { session, events } = run(s, [use(s, VILLAIN_SCHEMES)]);
    expect(dealtTo(events, s.villain)).toHaveLength(2);
    expect(session.state.instances[scheme]!.threat).toBe(threat + 3);
  });

  it("near miss: a villainous minion attacking turns the same boost card over and gets nothing extra", () => {
    const s = setup();
    const damage = s.state.instances[s.hero]!.damage;
    const { session, events } = run(s, [use(s, MINION_ATTACKS)]);
    expect(dealtTo(events, s.minion)).toHaveLength(1);
    expect(dealtTo(events, s.villain)).toEqual([]);
    expect(session.state.instances[s.hero]!.damage).toBe(damage + 2);
  });

  it("near miss: a villainous minion scheming gets nothing extra", () => {
    const s = setup();
    const { events } = run(s, [use(s, MINION_SCHEMES)]);
    expect(dealtTo(events, s.minion)).toHaveLength(1);
    expect(dealtTo(events, s.villain)).toEqual([]);
  });

  it("near miss: a villain of another name gets nothing extra", () => {
    const s = setup("Other");
    const { events } = run(s, [use(s, VILLAIN_ATTACKS)]);
    expect(dealtTo(events, s.villain)).toHaveLength(1);
  });

  it("replays deep-equal", () => {
    const s = setup();
    const { session } = run(s, [use(s, MINION_ATTACKS), use(s, VILLAIN_SCHEMES), use(s, VILLAIN_ATTACKS)]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
