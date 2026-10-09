/**
 * Who "you" is in "[enemy] attacks you" (`EventPattern.usesAttackedPlayer`), by timing. Synthetic cards only.
 *
 * RRG 1.8 "Defend, Defense" (the entry begins on p. 15; these sentences are on p. 16): "If a player defends against an
 * enemy attack that targets a different player (either by defending with a character they control or by resolving a
 * defense ability), the defending player becomes the new target of that attack. Any triggered ability that refers to
 * 'you' refers to the player who was the target of the attack when that ability resolved. (For example, the 'you' in
 * an ability that triggers 'when [enemy] attacks you' refers to the player against whom the attack initiated, while
 * the 'you' in an ability that triggers 'after [enemy] attacks you' refers to the player whose character defended the
 * attack.)" Owner ruling 2026-10-09, docs/phase7-wave8.md §4.1 row 91.
 *
 * - "Defend, Defense" (p. 15): "When an ally defends an attack, that ally becomes the target character for that
 *   attack, and its controller becomes the target player for that attack." So another player's ally defending makes
 *   that ally's controller the "you" of the "after".
 * - "Attack (Enemy Activation)" (p. 8): "Abilities that trigger 'When/After [enemy] attacks you' are resolved
 *   when/after a player is attacked, regardless of which character they control was attacked." A player who defends
 *   with their own ally is still "you".
 * - "Attacks Against Allies" (p. 10): "The player who controls the ally is considered the attacked player."
 */
import type { CardId } from "@mc/content";
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, PlayerRef, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCards, RESOURCE } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const you: PlayerRef = { kind: "controller" };
const self: TargetRef = { kind: "self" };
const villain: TargetRef = { kind: "villain" };
const named = (name: string): TargetRef => ({ kind: "named", name });
const yourHand: ValueSpec = { kind: "handCount", player: you };

/** P1 holds 2 cards and P2 holds 5, so a count of "your hand" names the player an ability resolved for. */
const HAND = { p1: 2, p2: 5 } as const;

const onScheme = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "mainScheme" },
  counterType,
  amount,
});
const onSelf = (counterType: string): EffectSpec => ({ kind: "addCounters", target: self, counterType, amount: n(1) });

/** "[this enemy] attacks you", on the enemy itself. */
const ATTACKS_YOU: EventPattern = {
  on: "enemyAttack",
  selfIs: "source",
  playerIs: "controller",
  usesAttackedPlayer: true,
};
/** "the villain attacks you", on another card. */
const VILLAIN_ATTACKS_YOU: EventPattern = {
  on: "enemyAttack",
  sourceIs: { categories: ["villain"] },
  playerIs: "controller",
  usesAttackedPlayer: true,
};

/** "Forced Interrupt: When Boss attacks you, …" and "Forced Response: After Boss attacks you, …", on the villain. */
const BOSS_WHEN = stubAbility("boss.when", {
  trigger: { kind: "interrupt", forced: true, on: ATTACKS_YOU },
  effects: [onScheme("whenYou", yourHand)],
} satisfies AbilityDefinition);
const BOSS_AFTER = stubAbility("boss.after", {
  trigger: { kind: "response", forced: true, on: ATTACKS_YOU },
  effects: [onScheme("afterYou", yourHand)],
} satisfies AbilityDefinition);
/** A player's own card: "When the villain attacks you, …" and "After the villain attacks you, …". */
const WATCH_WHEN = stubAbility("watch.when", {
  trigger: { kind: "interrupt", forced: true, on: VILLAIN_ATTACKS_YOU },
  effects: [onSelf("warned")],
} satisfies AbilityDefinition);
const WATCH_AFTER = stubAbility("watch.after", {
  trigger: { kind: "response", forced: true, on: VILLAIN_ATTACKS_YOU },
  effects: [onSelf("heard")],
} satisfies AbilityDefinition);
/** An encounter card nobody controls: "Response: After the villain attacks you, …", optional, so somebody is asked. */
const BLADE_AFTER = stubAbility("blade.after", {
  trigger: { kind: "response", forced: false, on: VILLAIN_ATTACKS_YOU },
  effects: [onScheme("bladeYou", yourHand)],
} satisfies AbilityDefinition);

const BOSS = stubVillain({
  id: "boss",
  stages: [{ hp: flat(40), atk: 1, sch: 1, abilities: [BOSS_WHEN.ref, BOSS_AFTER.ref] }],
});
const SCHEME = stubMainScheme({
  id: "plot",
  stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(0) }],
});
const BLADE = stubSideScheme({ id: "blade", startingThreat: 5, abilities: [BLADE_AFTER.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const WALL = stubAlly({ id: "wall", cost: 0, atk: 1, thw: 1, hp: 30 });
const POST = stubAlly({ id: "post", cost: 0, atk: 1, thw: 1, hp: 30 });
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_WHEN.ref, WATCH_AFTER.ref] });

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
/** "The villain attacks you." */
const ATTACK_ME = action("attack-me", [{ kind: "enemyAttack", enemies: villain, against: you }]);
/** "The villain attacks the Post." (the first player's ally) */
const ATTACK_POST = action("attack-post", [{ kind: "enemyAttack", enemies: villain, targetCharacter: named("post") }]);
const ACTIONS = [ATTACK_ME, ATTACK_POST] as const;
const BUTTONS = ACTIONS.map((a) => stubSupport({ id: a.ref.id.split(".")[0]!, cost: 0, abilities: [a.ref] }));

const deps: EngineDeps = depsOf(BOSS_WHEN, BOSS_AFTER, WATCH_WHEN, WATCH_AFTER, BLADE_AFTER, ...ACTIONS);

/**
 * Two players in hero form on P1's turn, P1 holding 2 cards and P2 holding 5; each has a Watch and a 30-hit-point
 * ally in play (P1's Post, P2's Wall), and the Blade is in the villain's area. Test surgery.
 */
function table(): { state: GameState; watch: Record<"p1" | "p2", InstanceId> } {
  const base = gameAtFirstTurn({
    cards: [BOSS, SCHEME, BLADE, BLANK, WALL, POST, WATCH, ...BUTTONS],
    deps,
    players: 2,
    villain: BOSS,
    mainScheme: SCHEME,
    deck: [WALL.id, POST.id, WATCH.id, ...BUTTONS.map((b) => b.id)],
    encounter: [BLADE.id, ...copiesOf(BLANK.id, 30)],
  });
  const emptied: GameState = {
    ...base,
    players: base.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" },
      hand: [],
      discard: [...p.discard, ...p.hand],
    })),
  };
  const allies = playerCardIntoPlay(playerCardIntoPlay(emptied, POST.id, P1).state, WALL.id, P2).state;
  const watch1 = playerCardIntoPlay(allies, WATCH.id, P1);
  const watch2 = playerCardIntoPlay(watch1.state, WATCH.id, P2);
  const blade = encounterCardInVillainArea(watch2.state, BLADE.id, 5).state;
  const p1 = giveCards(blade, P1, ...copiesOf(RESOURCE.id, HAND.p1)).state;
  const state = giveCards(p1, P2, ...copiesOf(RESOURCE.id, HAND.p2)).state;
  expect(mustPlayer(state, P1).hand).toHaveLength(HAND.p1);
  expect(mustPlayer(state, P2).hand).toHaveLength(HAND.p2);
  expect(state.step).toMatchObject({ phase: "player", activePlayerId: P1 });
  return { state, watch: { p1: watch1.id, p2: watch2.id } };
}

const heroOf = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
const cardOf = (state: GameState, card: CardId): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card && i.faceup)!.instanceId;
const recorded = (state: GameState, counterType: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters[counterType] ?? 0;
const counter = (state: GameState, id: InstanceId, counterType: string): number =>
  mustInstance(state, id).counters[counterType] ?? 0;

/**
 * Uses `ability` from a support in P1's play area. Declare Defender is answered with `defender` (an instance, or
 * "decline"); the Blade's optional response is taken by whoever is asked, and `asked` notes who that was.
 */
function attack(ability: StubAbility, defender: (state: GameState) => string = () => "decline") {
  const start = table();
  const card = BUTTONS[ACTIONS.indexOf(ability as (typeof ACTIONS)[number])]!;
  const placed = playerCardIntoPlay(start.state, card.id, P1);
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: placed.id,
    abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  const asked: PlayerId[] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") return [defender(state)];
    if (choice?.prompt.kind === "chooseTriggers") {
      const blade = choice.options.filter((o) => o.optionId.includes(BLADE_AFTER.ref.id)).map((o) => o.optionId);
      if (blade.length > 0) {
        asked.push(choice.playerId);
        return blade;
      }
    }
    return defaultPick(state);
  };
  const run = driveSession(startSession(placed.state), deps, [command], pick);
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.session.state);
  const state = run.session.state;
  return {
    state,
    asked,
    /** Whose hand each of the villain's own abilities and the Blade counted: the player it resolved for. */
    when: recorded(state, "whenYou"),
    after: recorded(state, "afterYou"),
    blade: recorded(state, "bladeYou"),
    /** Which player's Watch answered each timing. */
    warned: { p1: counter(state, start.watch.p1, "warned"), p2: counter(state, start.watch.p2, "warned") },
    heard: { p1: counter(state, start.watch.p1, "heard"), p2: counter(state, start.watch.p2, "heard") },
  };
}

describe("'[enemy] attacks you': the attacked player when it begins, the defending player after it", () => {
  it("nobody defends: both timings are the attacked player", () => {
    const result = attack(ATTACK_ME);
    expect(result.when).toBe(HAND.p1);
    expect(result.after).toBe(HAND.p1);
    expect(result.blade).toBe(HAND.p1);
    expect(result.asked).toEqual([P1]);
    expect(result.warned).toEqual({ p1: 1, p2: 0 });
    expect(result.heard).toEqual({ p1: 1, p2: 0 });
  });

  it("the attacked player's own hero defends: both timings are still that player", () => {
    const result = attack(ATTACK_ME, (s) => heroOf(s, P1));
    expect(mustInstance(result.state, heroOf(result.state, P1)).exhausted).toBe(true);
    expect(result.when).toBe(HAND.p1);
    expect(result.after).toBe(HAND.p1);
    expect(result.asked).toEqual([P1]);
    expect(result.warned).toEqual({ p1: 1, p2: 0 });
    expect(result.heard).toEqual({ p1: 1, p2: 0 });
  });

  it("the attacked player's own ally defends: still that player (RRG p. 8)", () => {
    const result = attack(ATTACK_ME, (s) => cardOf(s, POST.id));
    expect(mustInstance(result.state, cardOf(result.state, POST.id)).damage).toBe(1);
    expect(result.when).toBe(HAND.p1);
    expect(result.after).toBe(HAND.p1);
    expect(result.asked).toEqual([P1]);
    expect(result.heard).toEqual({ p1: 1, p2: 0 });
  });

  it("another player's hero defends: 'when' was the attacked player, 'after' is the defending player (RRG p. 16)", () => {
    const result = attack(ATTACK_ME, (s) => heroOf(s, P2));
    expect(mustInstance(result.state, heroOf(result.state, P2)).exhausted).toBe(true);
    // The villain's own abilities: the interrupt counted P1's hand, the response P2's.
    expect(result.when).toBe(HAND.p1);
    expect(result.after).toBe(HAND.p2);
    // An encounter card's optional "after … attacks you" is offered to, and resolves for, the defending player.
    expect(result.asked).toEqual([P2]);
    expect(result.blade).toBe(HAND.p2);
    // The players' own cards: the attacked player's "when" and the defending player's "after", and no others.
    expect(result.warned).toEqual({ p1: 1, p2: 0 });
    expect(result.heard).toEqual({ p1: 0, p2: 1 });
  });

  it("another player's ally defends: its controller is the 'you' of the 'after' (RRG p. 15)", () => {
    const result = attack(ATTACK_ME, (s) => cardOf(s, WALL.id));
    expect(mustInstance(result.state, cardOf(result.state, WALL.id)).damage).toBe(1);
    expect(result.when).toBe(HAND.p1);
    expect(result.after).toBe(HAND.p2);
    expect(result.asked).toEqual([P2]);
    expect(result.blade).toBe(HAND.p2);
    expect(result.warned).toEqual({ p1: 1, p2: 0 });
    expect(result.heard).toEqual({ p1: 0, p2: 1 });
  });

  it("an attack against an ally, undefended: its controller is the attacked player at both timings (RRG p. 10)", () => {
    const result = attack(ATTACK_POST);
    expect(mustInstance(result.state, cardOf(result.state, POST.id)).damage).toBe(1);
    expect(result.when).toBe(HAND.p1);
    expect(result.after).toBe(HAND.p1);
    expect(result.asked).toEqual([P1]);
    expect(result.warned).toEqual({ p1: 1, p2: 0 });
    expect(result.heard).toEqual({ p1: 1, p2: 0 });
  });

  it("an attack against an ally that another player's hero defends: the defending player after it", () => {
    const result = attack(ATTACK_POST, (s) => heroOf(s, P2));
    expect(mustInstance(result.state, cardOf(result.state, POST.id)).damage).toBe(0);
    expect(result.when).toBe(HAND.p1);
    expect(result.after).toBe(HAND.p2);
    expect(result.asked).toEqual([P2]);
    expect(result.heard).toEqual({ p1: 0, p2: 1 });
  });
});
