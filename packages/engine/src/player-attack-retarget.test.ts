/**
 * docs/phase7-wave7.md §3.66: a player's attack redirected to a friendly character (`EffectSpec retargetAttack` with
 * `attack: "player"`), and the named-resource-type comparison (`TargetQuery.printedResourceNamed`). Synthetic cards
 * shaped like "Forced Interrupt: When you attack an enemy, … change the target of this attack to a friendly character
 * of your choice."
 *
 * Sources: RRG 1.8 "Attack (Player Ability Type)" (p. 10); "Target" (p. 43) and ruling Mar 19, 2026 (2): a target that
 * cannot take damage is not a valid target; "'Friendly'" (p. 21); "Overkill" (p. 31); "Piercing" (p. 32); "Retaliate
 * X" (p. 38); "Consequential Damage" (p. 13); "Wild Resource" (p. 48). Owner decision §4.1 Q40 = B.
 */

import type { AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { type EffectContext, matchesQuery } from "./select.js";
import type { EffectSpec, PlayerRef, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubResource, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const named = (name: string): TargetRef => ({ kind: "named", name });
const attacked: PlayerRef = { kind: "attackedPlayer" };
const record = (counterType: string, amount: ValueSpec = n(1)): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "mainScheme" },
  counterType,
  amount,
});
const FRIENDLY: TargetQuery = { categories: ["identity", "ally"], canTakeAttackInProgress: "player" };
const ENEMY: TargetQuery = { categories: ["enemy"] };

/** "Forced Interrupt: When you attack an enemy, change the target of this attack to a friendly character of your choice." */
const mirage = (id: string, on: Partial<EventPattern>, character?: TargetRef) =>
  stubAbility(`${id}.forced-interrupt`, {
    trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller", targetIs: ENEMY, ...on } },
    effects: [
      ...(character
        ? []
        : [{ kind: "chooseTarget", slot: "new", chooser: { kind: "controller" }, query: FRIENDLY } as const]),
      { kind: "retargetAttack", attack: "player", character: character ?? slot("new") },
      // "The attacked player" is an enemy attack's (docs/phase7-wave7.md §3.32): nobody here, so a hand of 0 cards.
      record("probed"),
      record("attackedHand", { kind: "handCount", player: attacked }),
    ],
  } satisfies AbilityDefinition);
const MIRAGE = mirage("mirage", {});
/** Only an ally's attack, so a hero's attack with an ally's attack nested in it is moved at the inner one alone. */
const ALLY_MIRAGE = mirage("ally-mirage", { sourceIs: { categories: ["ally"] } });
/** "… change the target of this attack to the Ward" (which cannot take damage): no choice to filter it out. */
const WARD_MIRAGE = mirage("ward-mirage", {}, named("ward"));

const response = (id: string, counterType: string, on: Partial<EventPattern>) =>
  stubAbility(`room.${id}`, {
    trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller", ...on } },
    effects: [record(counterType)],
  } satisfies AbilityDefinition);
/** "After you attack", "after you attack and defeat an enemy", and the attack's bare `defeated` result. */
const AFTER_ATTACK = response("after-attack", "afterAttack", {});
const AFTER_DEFEAT_ENEMY = response("after-defeat-enemy", "defeatedEnemy", {
  targetIs: ENEMY,
  requireResults: { defeated: 1 },
});
const AFTER_DEFEAT_ANY = response("after-defeat-any", "defeatedAny", { requireResults: { defeated: 1 } });

/** "Hero Action (attack): Deal 5 damage to a minion. This attack gains piercing and overkill." */
const BLAST_ACTION = stubAbility("blast.action", {
  trigger: { kind: "action", form: "hero" },
  label: ["attack"],
  effects: [
    { kind: "chooseTarget", slot: "m", chooser: { kind: "controller" }, query: { categories: ["minion"] } },
    { kind: "attack", target: slot("m"), amount: n(5), keywords: ["piercing", "overkill"] },
  ],
} satisfies AbilityDefinition);
/** "Forced Interrupt: When your hero attacks an enemy, the Pal deals 3 damage to that enemy as an attack." */
const TAG_ALONG = stubAbility("tag.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "attack", playerIs: "controller", sourceIs: { categories: ["identity"] }, targetIs: ENEMY },
  },
  effects: [{ kind: "attack", attacker: named("pal"), target: { kind: "eventTarget" }, amount: n(3) }],
} satisfies AbilityDefinition);
const WARD_RULE = stubAbility("ward.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotTakeDamage", target: { self: true } }] },
  effects: [],
} satisfies AbilityDefinition);

const GOON = stubMinion({
  id: "goon",
  atk: 1,
  sch: 0,
  hp: 4,
  boostIcons: 0,
  keywords: [{ name: "retaliate", value: 1 }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const ally = (id: string, extra: Partial<Parameters<typeof stubAlly>[0]> = {}) => ({
  ...stubAlly({ id, cost: 0, atk: 2, thw: 1, hp: 3, consequentialAttack: 1, ...extra }),
  name: id,
});
const PAL = ally("pal", { hp: 6 });
const SPIKE = ally("spike", { hp: 5, keywords: [{ name: "retaliate", value: 1 }] });
const SHIELD = ally("shield");
const WARD = ally("ward", { abilities: [WARD_RULE.ref] });
const BLAST = stubEvent({ id: "blast", cost: 0, abilities: [BLAST_ACTION.ref] });
const ROOM = stubSupport({
  id: "room",
  cost: 0,
  abilities: [AFTER_ATTACK.ref, AFTER_DEFEAT_ENEMY.ref, AFTER_DEFEAT_ANY.ref],
});
const TAG = stubSupport({ id: "tag", cost: 0, abilities: [TAG_ALONG.ref] });
const veil = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
const VEIL = veil("veil", MIRAGE);
const ALLY_VEIL = veil("ally-veil", ALLY_MIRAGE);
const WARD_VEIL = veil("ward-veil", WARD_MIRAGE);
const FIST = stubResource({ id: "fist", icons: 0, produces: { physical: 1 } });
const JOKER = stubResource({ id: "joker", icons: 0, produces: { wild: 1 } });

const deps: EngineDeps = depsOf(
  MIRAGE,
  ALLY_MIRAGE,
  WARD_MIRAGE,
  AFTER_ATTACK,
  AFTER_DEFEAT_ENEMY,
  AFTER_DEFEAT_ANY,
  BLAST_ACTION,
  TAG_ALONG,
  WARD_RULE,
);
const CARDS: readonly AnyCard[] = [
  GOON,
  BLANK,
  PAL,
  SPIKE,
  SHIELD,
  WARD,
  BLAST,
  ROOM,
  TAG,
  VEIL,
  ALLY_VEIL,
  WARD_VEIL,
  FIST,
  JOKER,
];

interface Table {
  readonly state: GameState;
  readonly goon: InstanceId;
  readonly room: InstanceId;
  readonly hero: (player?: PlayerId) => InstanceId;
}

/** Two players in hero form on P1's turn, the Goon (4 hit points, retaliate 1) engaged with P1, P1's Room in play. */
function table(...inPlay: readonly (readonly [AnyCard, PlayerId])[]): Table & { readonly ids: readonly InstanceId[] } {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    players: 2,
    deck: CARDS.filter((card) => card !== GOON && card !== BLANK).map((card) => card.id),
    encounter: [GOON.id, ...copiesOf(BLANK.id, 30)],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const goon = minionEngagedWith(heroes, GOON.id, P1);
  const room = playerCardIntoPlay(goon.state, ROOM.id, P1);
  let state = room.state;
  const ids: InstanceId[] = [];
  for (const [card, player] of inPlay) {
    const placed = playerCardIntoPlay(state, card.id, player);
    state = placed.state;
    ids.push(placed.id);
  }
  return {
    state,
    goon: goon.id,
    room: room.id,
    ids,
    hero: (player = P1) => mustPlayer(state, player).identity.instanceId,
  };
}

const withTough = (state: GameState, id: InstanceId): GameState => {
  const instance = mustInstance(state, id);
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...instance, statuses: { ...instance.statuses, tough: 1 } } },
  };
};
const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const counter = (state: GameState, counterType: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters[counterType] ?? 0;
const basicAttack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const retargets = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "playerAttackRetargeted" }> => e.type === "playerAttackRetargeted",
  );

/** Every character an attack was made against, in order (the `characterAttacked` events as they were initiated). */
const attackedCharacters = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "characterAttacked"
      ? [e.event.targetInstanceId]
      : [],
  );

/** Runs the commands, answering the "friendly character of your choice" prompt with `newTarget` and recording what it offered. */
function run(t: Table, commands: readonly Command[], newTarget: InstanceId | null = null) {
  const offered: InstanceId[][] = [];
  const pick = (state: GameState): readonly string[] => {
    const options = (state.pendingChoice?.options ?? []).map((o) => o.optionId as InstanceId);
    if (!options.includes(t.hero(P1)) && !options.includes(t.hero(P2))) return defaultPick(state);
    offered.push(options);
    return newTarget ? [newTarget] : defaultPick(state);
  };
  const driven = driveSession(startSession(t.state), deps, commands, pick);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events, offered };
}

function playBlast(t: Table): { readonly table: Table; readonly command: Command } {
  const given = giveCard(t.state, P1, BLAST.id);
  return {
    table: { ...t, state: given.state },
    command: { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  };
}

describe("§3.66 a hero's basic attack redirected to a friendly character", () => {
  it("to a friendly ally: it takes the hero's 2 ATK; the enemy takes nothing and its retaliate does not answer", () => {
    const t = table([VEIL, P1], [PAL, P1]);
    const pal = t.ids[1]!;
    const { state, events, offered } = run(t, [basicAttack(t.hero(), t.goon)], pal);
    expect(damageOn(state, pal)).toBe(2);
    expect(damageOn(state, t.goon)).toBe(0);
    // The Goon's retaliate 1 hangs off being attacked (RRG 1.8 "Retaliate X", p. 38), and it was not.
    expect(damageOn(state, t.hero())).toBe(0);
    expect(mustInstance(state, t.hero()).exhausted).toBe(true);
    expect(retargets(events)).toEqual([
      {
        type: "playerAttackRetargeted",
        attackerInstanceId: t.hero(),
        fromInstanceId: t.goon,
        targetInstanceId: pal,
        playerId: P1,
      },
    ]);
    // Any friendly character: both heroes, the attacker included, and the ally.
    expect(offered).toHaveLength(1);
    expect([...offered[0]!].sort()).toEqual([t.hero(P1), t.hero(P2), pal].sort());
    expect(attackedCharacters(events)).toEqual([pal]);
  });

  it("to another player's hero: that hero takes 2", () => {
    const t = table([VEIL, P1]);
    const { state } = run(t, [basicAttack(t.hero(), t.goon)], t.hero(P2));
    expect(damageOn(state, t.hero(P2))).toBe(2);
    expect(damageOn(state, t.hero(P1))).toBe(0);
    expect(damageOn(state, t.goon)).toBe(0);
  });

  it("to the attacker itself: the hero deals its 2 ATK to itself", () => {
    const t = table([VEIL, P1]);
    const { state } = run(t, [basicAttack(t.hero(), t.goon)], t.hero(P1));
    expect(damageOn(state, t.hero(P1))).toBe(2);
    expect(damageOn(state, t.goon)).toBe(0);
  });

  it("an ally attacker moved onto itself takes its 2 ATK and its 1 consequential damage", () => {
    const t = table([VEIL, P1], [PAL, P1]);
    const pal = t.ids[1]!;
    const { state } = run(t, [basicAttack(pal, t.goon)], pal);
    expect(damageOn(state, pal)).toBe(2 + 1);
    expect(damageOn(state, t.goon)).toBe(0);
  });

  it("the new target's retaliate answers the attacker; a tough status card absorbs an attack without piercing", () => {
    const t = table([VEIL, P1], [SPIKE, P2]);
    const spike = t.ids[1]!;
    const hit = run(t, [basicAttack(t.hero(), t.goon)], spike);
    expect(damageOn(hit.state, spike)).toBe(2);
    expect(damageOn(hit.state, t.hero())).toBe(1);
    const tough = run({ ...t, state: withTough(t.state, spike) }, [basicAttack(t.hero(), t.goon)], spike);
    expect(damageOn(tough.state, spike)).toBe(0);
    expect(mustInstance(tough.state, spike).statuses.tough).toBe(0);
    // Still attacked, so its retaliate still answers (RRG 1.8 "Retaliate X", p. 38).
    expect(damageOn(tough.state, t.hero())).toBe(1);
  });

  it("the attacked player is nobody: a player's attack is not an enemy attack", () => {
    const t = table([VEIL, P1]);
    const { state } = run(t, [basicAttack(t.hero(), t.goon)], t.hero(P2));
    expect(counter(state, "probed")).toBe(1);
    expect(mustPlayer(state, P1).hand.length).toBeGreaterThan(0);
    expect(mustPlayer(state, P2).hand.length).toBeGreaterThan(0);
    expect(counter(state, "attackedHand")).toBe(0);
  });
});

describe("§3.66 an event's attack redirected: same damage, keywords and source", () => {
  it("without the redirect the 5 damage defeats the 4-hit-point Goon and 'defeat an enemy' is heard", () => {
    const { table: t, command } = playBlast(table());
    const { state, events } = run(t, [command]);
    expect(retargets(events)).toEqual([]);
    expect(counter(state, "afterAttack")).toBe(1);
    expect(counter(state, "defeatedEnemy")).toBe(1);
    // Overkill: the minion's 1 excess goes to the villain (RRG 1.8 "Overkill", p. 31).
    expect(damageOn(state, villainOf(state))).toBe(1);
  });

  it("onto another player's tough ally: piercing discards the tough card and 5 damage defeats it, 2 excess to its controller's hero", () => {
    const placed = table([VEIL, P1], [SHIELD, P2]);
    const shield = placed.ids[1]!;
    const { table: t, command } = playBlast({ ...placed, state: withTough(placed.state, shield) });
    const { state, events } = run(t, [command], shield);
    expect(mustPlayer(state, P2).discard).toContain(shield);
    // RRG 1.8 "Overkill" (p. 31): "deal any damage on that ally beyond its hit points to the identity of the player
    // who controls the ally" (5 damage, 3 hit points). Nothing reaches the villain: no minion was defeated.
    expect(damageOn(state, t.hero(P2))).toBe(2);
    expect(damageOn(state, t.hero(P1))).toBe(0);
    expect(damageOn(state, villainOf(state))).toBe(0);
    expect(damageOn(state, t.goon)).toBe(0);
    expect(retargets(events)).toMatchObject([{ attackerInstanceId: t.hero(P1), targetInstanceId: shield }]);
    // The spill is the attack's damage, not an attack against that hero (RRG 1.8 "Overkill", p. 31).
    expect(attackedCharacters(events)).toEqual([shield]);
  });

  it("'after you attack' is heard; 'after you attack and defeat an enemy' is not when the friendly target is defeated", () => {
    const placed = table([VEIL, P1], [SHIELD, P1]);
    const shield = placed.ids[1]!;
    const { table: t, command } = playBlast(placed);
    const { state } = run(t, [command], shield);
    expect(mustPlayer(state, P1).discard).toContain(shield);
    expect(damageOn(state, t.hero(P1))).toBe(2);
    expect(counter(state, "afterAttack")).toBe(1);
    expect(counter(state, "defeatedEnemy")).toBe(0);
    // The attack's own `defeated` result counts the ally: a pattern that names no enemy still hears it.
    expect(counter(state, "defeatedAny")).toBe(1);
  });

  it("onto a tough hero: piercing discards the tough card, the hero takes 5, and an identity's excess goes nowhere", () => {
    const placed = table([VEIL, P1]);
    const hurt: GameState = {
      ...placed.state,
      instances: {
        ...placed.state.instances,
        [placed.hero(P2)]: { ...mustInstance(placed.state, placed.hero(P2)), damage: 7 },
      },
    };
    const { table: t, command } = playBlast({ ...placed, state: withTough(hurt, placed.hero(P2)) });
    const { state } = run(t, [command], t.hero(P2));
    expect(mustInstance(state, t.hero(P2)).statuses.tough).toBe(0);
    // 10 hit points, 7 damage already: 5 more is 2 beyond them, and RRG 1.8 "Overkill" (p. 31) names only allies
    // and minions.
    expect(damageOn(state, t.hero(P2))).toBe(12);
    expect(damageOn(state, t.hero(P1))).toBe(0);
    expect(damageOn(state, villainOf(state))).toBe(0);
    expect(damageOn(state, t.goon)).toBe(0);
  });
});

describe("§3.66 the innermost player attack is the one moved", () => {
  it("an ally's attack nested in the hero's is moved; the hero's own attack still hits the enemy", () => {
    const t = table([ALLY_VEIL, P1], [TAG, P1], [PAL, P1]);
    const pal = t.ids[2]!;
    const { state, events } = run(t, [basicAttack(t.hero(), t.goon)], t.hero(P2));
    expect(retargets(events)).toMatchObject([
      { attackerInstanceId: pal, fromInstanceId: t.goon, targetInstanceId: t.hero(P2) },
    ]);
    expect(damageOn(state, t.hero(P2))).toBe(3);
    // The hero's 2 ATK, and the Goon's retaliate 1 for it.
    expect(damageOn(state, t.goon)).toBe(2);
    expect(damageOn(state, t.hero(P1))).toBe(1);
  });
});

describe("§3.66 a character that cannot take damage is not a valid new target (RRG 1.8 'Target', p. 43)", () => {
  it("is not offered", () => {
    const t = table([VEIL, P1], [WARD, P1], [PAL, P1]);
    const [, ward, pal] = t.ids;
    const { state, offered } = run(t, [basicAttack(t.hero(), t.goon)], pal!);
    expect(offered).toHaveLength(1);
    expect(offered[0]).not.toContain(ward);
    expect([...offered[0]!].sort()).toEqual([t.hero(P1), t.hero(P2), pal!].sort());
    expect(damageOn(state, pal!)).toBe(2);
  });

  it("named outright, the attack keeps its target", () => {
    const t = table([WARD_VEIL, P1], [WARD, P1]);
    const ward = t.ids[1]!;
    const { state, events } = run(t, [basicAttack(t.hero(), t.goon)]);
    expect(retargets(events)).toEqual([]);
    expect(damageOn(state, ward)).toBe(0);
    expect(damageOn(state, t.goon)).toBe(2);
    expect(damageOn(state, t.hero())).toBe(1);
  });

  it("nothing matches with no player attack in its interrupt window", () => {
    const t = table([PAL, P1]);
    const context: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
    expect(matchesQuery(t.state, t.ids[0]!, { categories: ["ally"] }, context)).toBe(true);
    expect(matchesQuery(t.state, t.ids[0]!, FRIENDLY, context)).toBe(false);
  });
});

describe("§3.66 the named resource type (`printedResourceNamed`; §4.1 Q40 = B)", () => {
  const t = table();
  const context: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
  const inDeck = (card: AnyCard): InstanceId => {
    const id = mustPlayer(t.state, P1).deck.find((candidate) => t.state.instances[candidate]?.cardId === card.id);
    if (!id) throw new Error(`no ${card.id} in the deck`);
    return id;
  };
  const has = (card: AnyCard, type: "physical" | "mental" | "energy" | "wild", wild: "ownType" | "anyType") =>
    matchesQuery(t.state, inDeck(card), { printedResourceNamed: { type, wild } }, context);

  it("wild: 'anyType': a printed wild icon matches whichever type was named", () => {
    expect(has(JOKER, "physical", "anyType")).toBe(true);
    expect(has(JOKER, "mental", "anyType")).toBe(true);
    expect(has(JOKER, "energy", "anyType")).toBe(true);
    expect(has(JOKER, "wild", "anyType")).toBe(true);
    // A typed icon is still only its own type.
    expect(has(FIST, "physical", "anyType")).toBe(true);
    expect(has(FIST, "mental", "anyType")).toBe(false);
    expect(has(FIST, "wild", "anyType")).toBe(false);
  });

  it("wild: 'ownType': a printed wild icon is only wild (RRG 1.8 'Wild Resource', p. 48), as `printedResource` reads it", () => {
    expect(has(JOKER, "physical", "ownType")).toBe(false);
    expect(has(JOKER, "wild", "ownType")).toBe(true);
    expect(has(FIST, "physical", "ownType")).toBe(true);
    expect(has(FIST, "wild", "ownType")).toBe(false);
    expect(matchesQuery(t.state, inDeck(JOKER), { printedResource: "physical" }, context)).toBe(false);
  });
});
