/**
 * Full QA, piece 10a (docs/phase7-wave8-full-qa.md, "Defects found"): the attack-begin machinery of
 * `resolve/attack-ability.ts` (docs/phase7-wave8.md §4.1 rows 61, 65, 73) against a target changed in the attack's
 * "when you attack" window (`EffectSpec retargetAttack`, docs/phase7-wave7.md §3.66), a moved-damage attack that is
 * never made, the attack in progress while an "(attack)" ability's attack finishes, and the log of a begun attack.
 *
 * Official text: RRG 1.8 "Attack (Player Ability Type)" (p. 10: "resolving that ability is considered to attack the
 * specified target", "An ability labeled as an attack is considered a single attack"), "Labeled Ability" (p. 26),
 * "Retaliate X" (p. 38), "Guard" (p. 21), "Cancel" (p. 11), "Move" and "Heal" (p. 22). What a changed target means
 * for damage dealt by an instruction that resolves after the window is this engine's interpretation, stated in
 * `attack-ability.ts` ("A target changed in the attack's window").
 */

import type { AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import { currentActivationFrameId } from "./stack.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const eachEnemy: TargetRef = { kind: "each", query: { categories: ["enemy"] } };
const record = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "mainScheme" },
  counterType,
  amount: n(1),
});
const FRIENDLY: TargetQuery = { categories: ["identity", "ally"], canTakeAttackInProgress: "player" };
const ENEMY: TargetQuery = { categories: ["enemy"] };
const aMinion: EffectSpec = {
  kind: "chooseTarget",
  slot: "m",
  chooser: { kind: "controller" },
  query: { categories: ["minion"] },
};

/** "Forced Interrupt: When you attack an enemy, change the target of this attack to a friendly character of your choice." */
const MIRAGE = stubAbility("mirage.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller", targetIs: ENEMY } },
  effects: [
    { kind: "chooseTarget", slot: "new", chooser: { kind: "controller" }, query: FRIENDLY },
    { kind: "retargetAttack", attack: "player", character: slot("new") },
  ],
} satisfies AbilityDefinition);
/** "Forced Interrupt: When you attack, cancel that attack." */
const PARRY = stubAbility("parry.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller" } },
  effects: [{ kind: "cancelTriggeringEvent" }],
} satisfies AbilityDefinition);
/** "Forced Response: After you attack, choose an ally. At the end of this attack, place 1 counter." */
const ECHO = stubAbility("echo.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller" } },
  effects: [
    { kind: "chooseTarget", slot: "a", chooser: { kind: "controller" }, query: { categories: ["ally"] } },
    { kind: "atEndOfAttack", effects: [record("ended")] },
  ],
} satisfies AbilityDefinition);

const attackEvent = (id: string, effects: readonly EffectSpec[], label = true) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action", form: "hero" },
    ...(label ? { label: ["attack"] as const } : {}),
    effects,
  } as AbilityDefinition);
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};
/** "Hero Action (attack): Deal 3 damage to a minion." made with an `attack` instruction that is the first to resolve. */
const PLAIN = attackEvent("plain", [aMinion, { kind: "attack", target: slot("m"), amount: n(3) }]);
/** The same with an instruction before the `attack` instruction, so the attack begins with the ability (row 73). */
const BEGUN = attackEvent("begun", [
  aMinion,
  record("x"),
  { kind: "attack", target: slot("m"), amount: n(3), keywords: ["piercing"] },
]);
/** A label-only attack (row 61). */
const LABEL = attackEvent("label", [aMinion, { kind: "dealDamage", target: slot("m"), amount: n(3) }]);
/** "Deal 2 damage to a minion. Deal 1 damage to that minion.": two instances of one attack. */
const TWICE = attackEvent("twice", [
  aMinion,
  { kind: "dealDamage", target: slot("m"), amount: n(2) },
  { kind: "dealDamage", target: slot("m"), amount: n(1) },
]);
/** "Hero Action (attack): Deal 2 damage to each enemy." */
const EACH = attackEvent("each", [{ kind: "dealDamage", target: eachEnemy, amount: n(2) }]);
/** Its enemy is chosen after another instruction, so the attack begins with no target. */
const LATE = attackEvent("late", [record("x"), aMinion, { kind: "attack", target: slot("m"), amount: n(3) }]);
/** "Hero Action (attack): … Move 2 damage from your hero to a minion." after another instruction (a begun attack). */
const MOVE = attackEvent("move", [
  aMinion,
  record("x"),
  { kind: "attack", target: slot("m"), amount: n(2), moveDamageFrom: yourIdentity },
]);
/** "Hero Action: Move 2 damage from your hero to the villain." as an attack by an unlabeled ability. */
const MOVE_VILLAIN = attackEvent(
  "move-villain",
  [{ kind: "attack", target: { kind: "villain" }, amount: n(2), moveDamageFrom: yourIdentity }],
  false,
);
const EVENTS = [PLAIN, BEGUN, LABEL, TWICE, EACH, LATE, MOVE, MOVE_VILLAIN];

const GOON = stubMinion({
  id: "goon",
  atk: 1,
  sch: 0,
  hp: 9,
  boostIcons: 0,
  keywords: [{ name: "retaliate", value: 1 }],
});
const BODYGUARD = stubMinion({ id: "bodyguard", atk: 1, sch: 0, hp: 9, boostIcons: 0, keywords: [{ name: "guard" }] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const ally = (id: string) => ({ ...stubAlly({ id, cost: 0, atk: 2, thw: 1, hp: 6 }), name: id });
const PAL = ally("pal");
const SHIELD = ally("shield");
const support = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
const VEIL = support("veil", MIRAGE);
const WALL = support("wall", PARRY);
const ROOM = support("room", ECHO);

const deps: EngineDeps = depsOf(MIRAGE, PARRY, ECHO, ...EVENTS.map((event) => event.ability));
const PLAYER_CARDS: readonly AnyCard[] = [PAL, SHIELD, VEIL, WALL, ROOM, ...EVENTS.map((event) => event.card)];
const CARDS: readonly AnyCard[] = [GOON, BODYGUARD, BLANK, ...PLAYER_CARDS];

interface Table {
  readonly state: GameState;
  readonly minion: InstanceId;
  readonly hero: InstanceId;
  readonly ids: readonly InstanceId[];
}

/** P1 in hero form on their turn, `minion` engaged with them, and the given cards of theirs in play. */
function table(minion: AnyCard, ...inPlay: readonly AnyCard[]): Table {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    players: 1,
    deck: PLAYER_CARDS.map((card) => card.id),
    encounter: [GOON.id, BODYGUARD.id, ...copiesOf(BLANK.id, 30)],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const engaged = minionEngagedWith(heroes, minion.id, P1);
  let state = engaged.state;
  const ids: InstanceId[] = [];
  for (const card of inPlay) {
    const placed = playerCardIntoPlay(state, card.id, P1);
    state = placed.state;
    ids.push(placed.id);
  }
  return { state, minion: engaged.id, ids, hero: mustPlayer(state, P1 as PlayerId).identity.instanceId };
}

const damaged = (state: GameState, id: InstanceId, damage: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage } },
});
const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const counter = (state: GameState, counterType: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters[counterType] ?? 0;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** Every character an attack was made against, in order. */
const attackedCharacters = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "characterAttacked"
      ? [e.event.targetInstanceId]
      : [],
  );
/** The damage events dealt as part of an attack, as they were initiated. */
const attackDamage = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "dealDamage" && e.event.fromAttack
      ? [e.event]
      : [],
  );

/**
 * Plays `event` from hand. A choice that offers the hero (the "friendly character of your choice") is answered with
 * `newTarget`; every pending choice's state goes to `seen`.
 */
function play(
  t: Table,
  event: { readonly card: AnyCard },
  newTarget: InstanceId | null = null,
  seen: (state: GameState) => void = () => {},
) {
  const given = giveCard(t.state, P1, event.card.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const pick = (state: GameState): readonly string[] => {
    seen(state);
    const options = (state.pendingChoice?.options ?? []).map((o) => o.optionId as InstanceId);
    return newTarget && options.includes(t.hero) ? [newTarget] : defaultPick(state);
  };
  const driven = driveSession(startSession(given.state), deps, [command], pick);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}

describe("a target changed in the attack's window is where the attack's damage goes", () => {
  const shapes = [
    ["an `attack` instruction that resolves first (the plain path)", PLAIN],
    ["an `attack` instruction after another instruction (a begun attack, row 73)", BEGUN],
    ["a damage instruction of a label-only attack (row 61)", LABEL],
  ] as const;

  it.each(shapes)("%s: 3 damage to the ally; the Goon is not attacked and does not retaliate", (_name, event) => {
    const t = table(GOON, VEIL, PAL);
    const pal = t.ids[1]!;
    const { state, events } = play(t, event, pal);
    expect(ofType(events, "playerAttackRetargeted")).toEqual([
      {
        type: "playerAttackRetargeted",
        attackerInstanceId: t.hero,
        fromInstanceId: t.minion,
        targetInstanceId: pal,
        playerId: P1,
      },
    ]);
    expect(damageOn(state, pal)).toBe(3);
    expect(damageOn(state, t.minion)).toBe(0);
    // RRG 1.8 "Retaliate X" (p. 38): after this character is attacked. The Goon was not.
    expect(damageOn(state, t.hero)).toBe(0);
    expect(attackedCharacters(events)).toEqual([pal]);
    // The ally's damage is the attack's: dealt by the hero, as attack damage.
    expect(attackDamage(events)).toMatchObject([{ targetInstanceId: pal, sourceInstanceId: t.hero }]);
  });

  it.each(shapes)("%s: with no retarget the Goon takes 3 and retaliates", (_name, event) => {
    const t = table(GOON, PAL);
    const { state, events } = play(t, event);
    expect(ofType(events, "playerAttackRetargeted")).toEqual([]);
    expect(damageOn(state, t.minion)).toBe(3);
    expect(damageOn(state, t.hero)).toBe(1);
    expect(damageOn(state, t.ids[0]!)).toBe(0);
  });

  it("a begun attack keeps what its `attack` instruction gives it: the ally is dealt piercing damage", () => {
    const t = table(GOON, VEIL, PAL);
    const pal = t.ids[1]!;
    const tough = mustInstance(t.state, pal);
    const state: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [pal]: { ...tough, statuses: { ...tough.statuses, tough: 1 } } },
    };
    const played = play({ ...t, state }, BEGUN, pal);
    expect(mustInstance(played.state, pal).statuses.tough).toBe(0);
    expect(damageOn(played.state, pal)).toBe(3);
  });

  it("every instance the attack aims at the enemy it was moved off goes to the new target, attacked once", () => {
    const t = table(GOON, VEIL, PAL);
    const pal = t.ids[1]!;
    const { state, events } = play(t, TWICE, pal);
    expect(damageOn(state, pal)).toBe(2 + 1);
    expect(damageOn(state, t.minion)).toBe(0);
    expect(damageOn(state, t.hero)).toBe(0);
    expect(attackedCharacters(events)).toEqual([pal]);
  });

  it("'each enemy': only the attack on the enemy the window heard moves; the other enemy is attacked as written", () => {
    const t = table(GOON, VEIL, PAL);
    const pal = t.ids[1]!;
    const villain = activeVillain(t.state).instanceId;
    const { state, events } = play(t, EACH, pal);
    const [moved] = ofType(events, "playerAttackRetargeted");
    expect(moved).toBeDefined();
    const from = moved!.fromInstanceId;
    const other = from === villain ? t.minion : villain;
    expect([villain, t.minion]).toContain(from);
    expect(damageOn(state, pal)).toBe(2);
    expect(damageOn(state, from)).toBe(0);
    expect(damageOn(state, other)).toBe(2);
    expect([...attackedCharacters(events)].sort()).toEqual([pal, other].sort());
    // The Goon retaliates only if it is the one still attacked.
    expect(damageOn(state, t.hero)).toBe(other === t.minion ? 1 : 0);
  });

  it("an attack that began with no target has none to move: the enemy chosen later takes the damage", () => {
    const t = table(GOON, VEIL, PAL);
    const { state, events } = play(t, LATE, t.ids[1]!);
    expect(ofType(events, "playerAttackRetargeted")).toEqual([]);
    expect(damageOn(state, t.ids[1]!)).toBe(0);
    expect(damageOn(state, t.minion)).toBe(3);
    expect(damageOn(state, t.hero)).toBe(1);
  });
});

describe("an attack that moves damage heals its source only when the attack is made", () => {
  it("made: 2 damage moves from the hero to the minion", () => {
    const t = table(GOON);
    const { state } = play({ ...t, state: damaged(t.state, t.hero, 3) }, MOVE);
    expect(damageOn(state, t.minion)).toBe(2);
    // 3, less the 2 moved, plus the Goon's retaliate 1.
    expect(damageOn(state, t.hero)).toBe(3 - 2 + 1);
  });

  it("a begun attack cancelled in its window: nothing is healed off the hero", () => {
    const t = table(GOON, WALL);
    const { state, events } = play({ ...t, state: damaged(t.state, t.hero, 3) }, MOVE);
    expect(damageOn(state, t.hero)).toBe(3);
    expect(damageOn(state, t.minion)).toBe(0);
    expect(ofType(events, "attackTargetSkipped")).toMatchObject([
      { targetInstanceId: t.minion, reason: "attackCancelled" },
    ]);
    // The instruction before the attack still resolved (row 65).
    expect(counter(state, "x")).toBe(1);
  });

  it("every enemy named is guarded: nothing is healed off the hero", () => {
    const t = table(BODYGUARD);
    const { state } = play({ ...t, state: damaged(t.state, t.hero, 3) }, MOVE_VILLAIN);
    expect(damageOn(state, t.hero)).toBe(3);
    expect(damageOn(state, activeVillain(state).instanceId)).toBe(0);
  });
});

describe("an '(attack)' ability's attack is the attack in progress again once it starts to finish", () => {
  it.each([
    ["a begun attack", BEGUN],
    ["a label-only attack", LABEL],
    ["the plain path", PLAIN],
  ] as const)("%s: 'after you attack' and 'at the end of this attack' name it", (_name, event) => {
    const t = table(GOON, ROOM, PAL, SHIELD);
    const windows: { readonly attack: unknown; readonly current: unknown; readonly waiting: unknown }[] = [];
    const { state } = play(t, event, null, (pending) => {
      const options = (pending.pendingChoice?.options ?? []).map((o) => o.optionId as InstanceId);
      // The response's "choose an ally": the two allies and nothing else.
      if (!options.includes(t.ids[1]!) || options.includes(t.minion)) return;
      const attack = pending.stack.find((frame) => frame.kind === "event" && frame.event.kind === "attack");
      windows.push({
        attack: attack?.frameId ?? null,
        current: currentActivationFrameId(pending.stack),
        waiting: attack?.kind === "event" ? attack.attackWaiting : null,
      });
    });
    expect(windows).toHaveLength(1);
    expect(windows[0]!.attack).not.toBeNull();
    expect(windows[0]!.current).toBe(windows[0]!.attack);
    expect(windows[0]!.waiting).toBeUndefined();
    expect(counter(state, "ended")).toBe(1);
  });
});

describe("the log of a begun attack reads from start to finish (row 73)", () => {
  it("one framePushed and one framePopped for its frame, with the take-over recorded between two waits", () => {
    const t = table(GOON);
    const { events } = play(t, BEGUN);
    const begins = events.find(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack" && e.event.begun,
    );
    expect(begins).toBeDefined();
    const [resumed, ...others] = ofType(events, "attackResumed");
    expect(others).toEqual([]);
    expect(resumed).toEqual({
      type: "attackResumed",
      attackFrameId: resumed!.attackFrameId,
      abilityFrameId: resumed!.abilityFrameId,
      attackerInstanceId: t.hero,
      targetInstanceId: t.minion,
      amount: 3,
      overkill: false,
      keywords: ["piercing"],
    });
    const frameId = resumed!.attackFrameId;
    const story = events.flatMap((e) => {
      if (e.type === "framePushed" || e.type === "framePopped") return e.frameId === frameId ? [e.type] : [];
      if (e.type === "attackAwaitsAbility")
        return e.attackFrameId === frameId ? [e.begun ? "attackAwaitsAbility (begun)" : "attackAwaitsAbility"] : [];
      return e.type === "attackResumed" ? [e.type] : [];
    });
    expect(story).toEqual([
      "framePushed",
      "attackAwaitsAbility (begun)",
      "attackResumed",
      "attackAwaitsAbility",
      "framePopped",
    ]);
  });

  it("an attack that does not begin early logs no take-over and waits once", () => {
    const t = table(GOON);
    for (const event of [PLAIN, LABEL]) {
      const { events } = play(t, event);
      expect(ofType(events, "attackResumed")).toEqual([]);
      expect(ofType(events, "attackAwaitsAbility")).toMatchObject([{ attackerInstanceId: t.hero }]);
      expect(ofType(events, "attackAwaitsAbility")[0]!.begun).toBeUndefined();
    }
  });

  it("a retargeted begun attack's take-over names the character it was moved onto", () => {
    const t = table(GOON, VEIL, PAL);
    const { events } = play(t, BEGUN, t.ids[1]!);
    expect(ofType(events, "attackResumed")).toMatchObject([{ targetInstanceId: t.ids[1]!, amount: 3 }]);
  });
});
