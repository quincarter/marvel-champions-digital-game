/**
 * `PlayerRef attackedPlayer { attacker?, initiated? }`: the "you" of an enemy's constant "While [this enemy] is
 * attacking you, he gets +X ATK, where X is the number of cards in your hand." A constant has no event and an enemy
 * no controller, so the ref reads the attack in progress on the stack. Synthetic cards only.
 *
 * Sources and the readings pinned here:
 * - RRG 1.8 "Defend, Defense" (p. 16): "If a player defends against an enemy attack that targets a different player
 *   …, the defending player becomes the new target of that attack"; "Any constant or boost abilities that refer to
 *   'you' refer to the defending player." Owner ruling 2026-10-09 (docs/phase7-wave8.md §4.1 row 93): follow the RRG.
 *   So the bonus reads the hand of the player the attack was initiated against until a defender is declared (step 2,
 *   p. 9), and the defending player's from then on, which is the hand the damage step (step 4) reads. An undefended
 *   attack, or one the attacked player's own character defends, reads the attacked player's.
 * - `initiated: true` names the player the attack was initiated against, whoever defends (p. 8; the "you" of "When
 *   [enemy] attacks you", p. 16).
 * - RRG 1.8 "Attacks Against Allies" (p. 10): "The player who controls the ally is considered the attacked player".
 * - Owner decisions docs/phase7-wave7.md §4.1 Q5 = A and Q16 = A: once an effect moves the attack onto another
 *   player's ally (`retargetAttack`), that ally's controller is the attacked player.
 */
import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import { evaluate, resolvePlayers, resolveValue, type EffectContext } from "./select.js";
import type { EffectSpec, PlayerRef, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCards, RESOURCE } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const you: PlayerRef = { kind: "controller" };
const self: TargetRef = { kind: "self" };
const villain: TargetRef = { kind: "villain" };
const named = (name: string): TargetRef => ({ kind: "named", name });
/** The attacked player of the innermost attack, and of the attack a given character is making. */
const attacked: PlayerRef = { kind: "attackedPlayer" };
const attackedBy = (attacker: TargetRef): PlayerRef => ({ kind: "attackedPlayer", attacker });
/** The player the villain's attack was initiated against, whoever defends it. */
const initiatedByVillain: PlayerRef = { kind: "attackedPlayer", attacker: { kind: "villain" }, initiated: true };
const cardsInHand = (player: PlayerRef): ValueSpec => ({ kind: "handCount", player });

/** "While [this enemy] is attacking you, he gets +X ATK, where X is the number of cards in your hand." */
const rage = (id: string) =>
  stubAbility(`${id}.constant`, {
    trigger: {
      kind: "constant",
      modifiers: [{ stat: "atk", amount: cardsInHand(attackedBy(self)), target: { self: true } }],
    },
    effects: [],
  } satisfies AbilityDefinition);
const BOSS_RAGE = rage("boss");
const GRUNT_RAGE = rage("grunt");
const HOUND_RAGE = rage("hound");
/** "While [this enemy] is attacking a player with at least 4 cards in hand, it gets +2 ATK." */
const BULLY_RULE = stubAbility("bully.constant", {
  trigger: {
    kind: "constant",
    modifiers: [
      {
        stat: "atk",
        amount: 2,
        target: { self: true },
        while: { kind: "compare", left: cardsInHand(attackedBy(self)), op: "atLeast", right: n(4) },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);

const record = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "mainScheme" },
  counterType,
  amount,
});
/** "Forced Interrupt: When the villain attacks, this minion attacks the player it is engaged with." A nested attack. */
const HOUND_JOINS = stubAbility("hound.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [{ kind: "enemyAttack", enemies: self }],
} satisfies AbilityDefinition);
/** Records, as this minion's own attack is initiated, what each reading of "the attacked player" gives. */
const HOUND_PROBE = stubAbility("hound.probe", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
  effects: [
    record("probed", n(1)),
    record("villainAtk", { kind: "stat", of: villain, stat: "atk" }),
    record("innermost", cardsInHand(attacked)),
    record("byVillain", cardsInHand(attackedBy(villain))),
    record("bySelf", cardsInHand(attackedBy(self))),
  ],
} satisfies AbilityDefinition);
/** "Boost:" records both readings once the defender is declared (step 3 follows step 2, RRG 1.8 p. 9). */
const TELL_BOOST = stubAbility("tell.boost", {
  trigger: { kind: "boost" },
  effects: [
    record("told", n(1)),
    record("defending", cardsInHand(attackedBy(villain))),
    record("initiated", cardsInHand(initiatedByVillain)),
  ],
} satisfies AbilityDefinition);
/** Records what "the attacked player" gives while a player's own attack is in progress. */
const WATCH_PROBE = stubAbility("watch.probe", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", sourceIs: { categories: ["identity"] } } },
  effects: [
    record("probed", n(1)),
    record("innermost", cardsInHand(attacked)),
    record("byVillain", cardsInHand(attackedBy(villain))),
  ],
} satisfies AbilityDefinition);
/** "Forced Interrupt: When the villain attacks, he attacks the Wall instead." */
const SNARE_RULE = stubAbility("snare.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [{ kind: "retargetAttack", character: named("wall") }],
} satisfies AbilityDefinition);

const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(40), atk: 1, sch: 1, abilities: [BOSS_RAGE.ref] }] });
const SCHEME = stubMainScheme({
  id: "plot",
  stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(0) }],
});
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 0, hp: 9, boostIcons: 0, abilities: [GRUNT_RAGE.ref] });
const HOUND = stubMinion({
  id: "hound",
  atk: 1,
  sch: 0,
  hp: 9,
  boostIcons: 0,
  abilities: [HOUND_RAGE.ref, HOUND_JOINS.ref, HOUND_PROBE.ref],
});
const BULLY = stubMinion({ id: "bully", atk: 1, sch: 0, hp: 9, boostIcons: 0, abilities: [BULLY_RULE.ref] });
const SNARE = stubSideScheme({ id: "snare", startingThreat: 5, abilities: [SNARE_RULE.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const TELL = stubTreachery({ id: "tell", boostIcons: 0, abilities: [TELL_BOOST.ref] });
/** Allies with enough hit points to take a whole attack, so the damage dealt is the attacker's ATK. */
const WALL = stubAlly({ id: "wall", cost: 0, atk: 1, thw: 1, hp: 30 });
const POST = stubAlly({ id: "post", cost: 0, atk: 1, thw: 1, hp: 30 });
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_PROBE.ref] });

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
const others: PlayerRef = { kind: "others", of: you };
const eachMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };
/** "The villain attacks you." */
const ATTACK_ME = action("attack-me", [{ kind: "enemyAttack", enemies: villain, against: you }]);
/** "The villain attacks each other player." */
const ATTACK_OTHER = action("attack-other", [{ kind: "enemyAttack", enemies: villain, against: others }]);
/** "The villain attacks the Wall." */
const ATTACK_WALL = action("attack-wall", [{ kind: "enemyAttack", enemies: villain, targetCharacter: named("wall") }]);
/** "The villain attacks you. Then, each minion attacks the player it is engaged with." */
const ATTACK_BOTH = action("attack-both", [
  { kind: "enemyAttack", enemies: villain, against: you },
  { kind: "enemyAttack", enemies: eachMinion },
]);
/** "Each minion attacks the player it is engaged with." */
const MINIONS_ATTACK = action("minions-attack", [{ kind: "enemyAttack", enemies: eachMinion }]);
const ACTIONS = [ATTACK_ME, ATTACK_OTHER, ATTACK_WALL, ATTACK_BOTH, MINIONS_ATTACK] as const;
const BUTTONS = ACTIONS.map((a) => stubSupport({ id: a.ref.id.split(".")[0]!, cost: 0, abilities: [a.ref] }));

const deps: EngineDeps = depsOf(
  BOSS_RAGE,
  GRUNT_RAGE,
  HOUND_RAGE,
  BULLY_RULE,
  HOUND_JOINS,
  HOUND_PROBE,
  WATCH_PROBE,
  SNARE_RULE,
  TELL_BOOST,
  ...ACTIONS,
);

/** P1's hand (2 cards) and P2's (5): every number below tells the two hands apart. */
const HAND = { p1: 2, p2: 5 } as const;

/**
 * Two players in hero form on P1's turn, P1 holding 2 cards and P2 holding 5, each with a 30-hit-point ally in play
 * (P1's Post, P2's Wall). Test surgery, done before the session starts.
 */
function table(boostCard: CardId = BLANK.id): GameState {
  const base = gameAtFirstTurn({
    cards: [BOSS, SCHEME, GRUNT, HOUND, BULLY, SNARE, BLANK, TELL, WALL, POST, WATCH, ...BUTTONS],
    deps,
    players: 2,
    villain: BOSS,
    mainScheme: SCHEME,
    deck: [WALL.id, POST.id, WATCH.id, ...BUTTONS.map((b) => b.id)],
    encounter: [GRUNT.id, GRUNT.id, HOUND.id, BULLY.id, SNARE.id, ...copiesOf(boostCard, 30)],
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
  const p1 = giveCards(allies, P1, ...copiesOf(RESOURCE.id, HAND.p1)).state;
  const state = giveCards(p1, P2, ...copiesOf(RESOURCE.id, HAND.p2)).state;
  expect(mustPlayer(state, P1).hand).toHaveLength(HAND.p1);
  expect(mustPlayer(state, P2).hand).toHaveLength(HAND.p2);
  expect(state.step).toMatchObject({ phase: "player", activePlayerId: P1 });
  return state;
}

/** One of the action supports in `player`'s play area, and the command that uses it. */
function button(state: GameState, ability: StubAbility, player: PlayerId = P1) {
  const card = BUTTONS[ACTIONS.indexOf(ability as (typeof ACTIONS)[number])]!;
  const placed = playerCardIntoPlay(state, card.id, player);
  const command: Command = {
    type: "useAbility",
    playerId: player,
    cardInstanceId: placed.id,
    abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  return { state: placed.state, command };
}

const heroOf = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
const cardOf = (state: GameState, card: CardId): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card && i.faceup)!.instanceId;
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const atkOf = (state: GameState, id: InstanceId): number | null | undefined => characterProfile(state, id, deps)?.atk;
const damageTo = (events: readonly GameEvent[], id: InstanceId): readonly number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));
const recorded = (state: GameState, counterType: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters[counterType] ?? 0;

/** Answers every Declare Defender prompt with `defender` (an instance, or "decline"), noting who was asked. */
const defending =
  (defender: (state: GameState) => string, askedOf: PlayerId[] = []) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "declareDefender") return defaultPick(state);
    askedOf.push(choice.playerId);
    return [defender(state)];
  };

function use(
  state: GameState,
  ability: StubAbility,
  pick: (state: GameState) => readonly string[] = defaultPick,
  player: PlayerId = P1,
) {
  const placed = button(state, ability, player);
  const run = driveSession(startSession(placed.state), deps, [placed.command], pick);
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.session.state);
  return { before: placed.state, state: run.session.state, events: run.events };
}

const contextOf = (state: GameState, selfInstanceId: InstanceId | null, player: PlayerId | null): EffectContext => ({
  selfInstanceId,
  controllerId: player,
  event: null,
  bindings: {},
  deps,
});

describe("PlayerRef attackedPlayer: the villain's '+X ATK while attacking you, X from your hand'", () => {
  it("undefended: printed ATK 1 plus the attacked player's 2 cards", () => {
    const result = use(table(), ATTACK_ME);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([1 + HAND.p1]);
    expect(damageTo(result.events, heroOf(result.state, P2))).toEqual([]);
  });

  it("the attacked player's own hero defends: 1 + 2 - DEF 2", () => {
    const result = use(
      table(),
      ATTACK_ME,
      defending((s) => heroOf(s, P1)),
    );
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([1]);
  });

  it("ANOTHER player's hero defends: the defending player's 5 cards, not the attacked player's 2", () => {
    const askedOf: PlayerId[] = [];
    const result = use(
      table(),
      ATTACK_ME,
      defending((s) => heroOf(s, P2), askedOf),
    );
    expect(askedOf).toEqual([P1]);
    expect(mustInstance(result.state, heroOf(result.state, P2)).exhausted).toBe(true);
    // 1 + 5 - DEF 2. Read from the attacked player's hand it would be 1 + 2 - 2 = 1.
    expect(damageTo(result.events, heroOf(result.state, P2))).toEqual([1 + HAND.p2 - 2]);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([]);
  });

  it("an ally of another player defends: its controller is the target player, so the ally takes 1 + 5", () => {
    const result = use(
      table(),
      ATTACK_ME,
      defending((s) => cardOf(s, WALL.id)),
    );
    expect(damageTo(result.events, cardOf(result.state, WALL.id))).toEqual([1 + HAND.p2]);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([]);
  });

  it("the attacked player's own ally defends: 1 + 2", () => {
    const result = use(
      table(),
      ATTACK_ME,
      defending((s) => cardOf(s, POST.id)),
    );
    expect(damageTo(result.events, cardOf(result.state, POST.id))).toEqual([1 + HAND.p1]);
  });

  it("an attack on the other player reads that player's 5 cards, and the first player's 2 when their hero defends", () => {
    const undefended = use(table(), ATTACK_OTHER);
    expect(damageTo(undefended.events, heroOf(undefended.state, P2))).toEqual([1 + HAND.p2]);
    const askedOf: PlayerId[] = [];
    const defended = use(
      table(),
      ATTACK_OTHER,
      defending((s) => heroOf(s, P1), askedOf),
    );
    expect(askedOf).toEqual([P2]);
    expect(damageTo(defended.events, heroOf(defended.state, P1))).toEqual([1 + HAND.p1 - 2]);
  });

  it("at the boost step the ref names the defending player, and `initiated` the player first attacked", () => {
    const told = (pick?: (state: GameState) => string) => {
      const result = use(table(TELL.id), ATTACK_ME, pick ? defending(pick) : defaultPick);
      expect(recorded(result.state, "told")).toBe(1);
      return [recorded(result.state, "defending"), recorded(result.state, "initiated")];
    };
    expect(told()).toEqual([HAND.p1, HAND.p1]);
    expect(told((s) => heroOf(s, P1))).toEqual([HAND.p1, HAND.p1]);
    expect(told((s) => cardOf(s, POST.id))).toEqual([HAND.p1, HAND.p1]);
    expect(told((s) => heroOf(s, P2))).toEqual([HAND.p2, HAND.p1]);
    expect(told((s) => cardOf(s, WALL.id))).toEqual([HAND.p2, HAND.p1]);
  });

  it("the bonus is gone outside the attack: ATK 1 before and after", () => {
    const start = table();
    expect(atkOf(start, villainOf(start))).toBe(1);
    const result = use(start, ATTACK_ME);
    expect(atkOf(result.state, villainOf(result.state))).toBe(1);
  });
});

describe("PlayerRef attackedPlayer: an attack against an ally is against its controller (RRG 1.8 p. 10)", () => {
  it("'the villain attacks the Wall', used by P1: P2 controls the Wall, so P2's 5 cards", () => {
    const askedOf: PlayerId[] = [];
    const result = use(
      table(),
      ATTACK_WALL,
      defending(() => "decline", askedOf),
    );
    expect(askedOf).toEqual([P2]);
    expect(damageTo(result.events, cardOf(result.state, WALL.id))).toEqual([1 + HAND.p2]);
  });

  it("P1's hero defends that attack: P1 is the defending player (1 + 2 - DEF 2)", () => {
    const result = use(
      table(),
      ATTACK_WALL,
      defending((s) => heroOf(s, P1)),
    );
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([1 + HAND.p1 - 2]);
    expect(damageTo(result.events, cardOf(result.state, WALL.id))).toEqual([]);
  });

  it("retargetAttack (Q16 = A): an attack on P1 moved onto P2's Wall reads P2's 5 cards", () => {
    const snared = encounterCardInVillainArea(table(), SNARE.id, 5).state;
    const askedOf: PlayerId[] = [];
    const result = use(
      snared,
      ATTACK_ME,
      defending(() => "decline", askedOf),
    );
    expect(result.events.filter((e) => e.type === "attackRetargeted")).toEqual([
      {
        type: "attackRetargeted",
        enemyInstanceId: villainOf(snared),
        targetInstanceId: cardOf(snared, WALL.id),
        playerId: P2,
      },
    ]);
    expect(askedOf).toEqual([P2]);
    expect(damageTo(result.events, cardOf(result.state, WALL.id))).toEqual([1 + HAND.p2]);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([]);
  });

  it("retargetAttack, then the first player's hero defends: P1's 2 cards (1 + 2 - DEF 2)", () => {
    const snared = encounterCardInVillainArea(table(), SNARE.id, 5).state;
    const result = use(
      snared,
      ATTACK_ME,
      defending((s) => heroOf(s, P1)),
    );
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([1 + HAND.p1 - 2]);
  });
});

describe("PlayerRef attackedPlayer: each attacker reads its own attack", () => {
  it("a minion's attack works the same: its engaged player's hand, or the defending player's", () => {
    const engaged = minionEngagedWith(table(), GRUNT.id, P1);
    const undefended = use(engaged.state, MINIONS_ATTACK);
    expect(damageTo(undefended.events, heroOf(undefended.state, P1))).toEqual([1 + HAND.p1]);
    const defended = use(
      engaged.state,
      MINIONS_ATTACK,
      defending((s) => heroOf(s, P2)),
    );
    expect(damageTo(defended.events, heroOf(defended.state, P2))).toEqual([1 + HAND.p2 - 2]);
    expect(atkOf(defended.state, engaged.id)).toBe(1);
  });

  it("two enemies attacking in sequence: the villain reads P1's hand, then the minion reads P2's", () => {
    const engaged = minionEngagedWith(table(), GRUNT.id, P2);
    const result = use(engaged.state, ATTACK_BOTH);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([1 + HAND.p1]);
    expect(damageTo(result.events, heroOf(result.state, P2))).toEqual([1 + HAND.p2]);
    const attacks = result.events.flatMap((e) => (e.type === "damageDealt" ? [e.targetInstanceId] : []));
    expect(attacks).toEqual([heroOf(result.state, P1), heroOf(result.state, P2)]);
  });

  it("two minions engaged with different players attack in turn: 1 + 2 and 1 + 5", () => {
    const first = minionEngagedWith(table(), GRUNT.id, P1);
    const second = minionEngagedWith(first.state, GRUNT.id, P2);
    const result = use(second.state, MINIONS_ATTACK);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([1 + HAND.p1]);
    expect(damageTo(result.events, heroOf(result.state, P2))).toEqual([1 + HAND.p2]);
  });

  it("a nested attack: inside the villain's attack on P1, a minion's attack on P2 reads P2, and the villain still P1", () => {
    const engaged = minionEngagedWith(table(), HOUND.id, P2);
    const result = use(engaged.state, ATTACK_ME);
    // The minion's attack is made while the villain's is still being initiated: the villain's ATK is its 1 + 2.
    expect(recorded(result.state, "probed")).toBe(1);
    expect(recorded(result.state, "villainAtk")).toBe(1 + HAND.p1);
    // No attacker named: the innermost attack, the minion's on P2. Named: that attacker's own.
    expect(recorded(result.state, "innermost")).toBe(HAND.p2);
    expect(recorded(result.state, "bySelf")).toBe(HAND.p2);
    expect(recorded(result.state, "byVillain")).toBe(HAND.p1);
    // The inner attack resolves first, then the outer one, each with its own target's hand.
    expect(damageTo(result.events, heroOf(result.state, P2))).toEqual([1 + HAND.p2]);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([1 + HAND.p1]);
    const order = result.events.flatMap((e) => (e.type === "damageDealt" ? [e.targetInstanceId] : []));
    expect(order).toEqual([heroOf(result.state, P2), heroOf(result.state, P1)]);
  });

  it("in a `while` condition: '+2 ATK while attacking a player with at least 4 cards in hand'", () => {
    const onP1 = minionEngagedWith(table(), BULLY.id, P1);
    expect(atkOf(onP1.state, onP1.id)).toBe(1);
    // P1 holds 2: no bonus, until P2 (5 cards) defends with an ally and is the player attacked.
    expect(damageTo(use(onP1.state, MINIONS_ATTACK).events, heroOf(onP1.state, P1))).toEqual([1]);
    const p2Defends = use(
      onP1.state,
      MINIONS_ATTACK,
      defending((s) => cardOf(s, WALL.id)),
    );
    expect(damageTo(p2Defends.events, cardOf(p2Defends.state, WALL.id))).toEqual([3]);
    // P2 holds 5: the bonus applies, and is lost when P1 (2 cards) defends.
    const onP2 = minionEngagedWith(table(), BULLY.id, P2);
    expect(damageTo(use(onP2.state, MINIONS_ATTACK).events, heroOf(onP2.state, P2))).toEqual([3]);
    const p1Defends = use(
      onP2.state,
      MINIONS_ATTACK,
      defending((s) => cardOf(s, POST.id)),
    );
    expect(damageTo(p1Defends.events, cardOf(p1Defends.state, POST.id))).toEqual([1]);
  });
});

describe("PlayerRef attackedPlayer: nobody when no enemy attack is in progress", () => {
  it("with nothing on the stack it names no player, and a value over it is 0", () => {
    const state = table();
    const context = contextOf(state, villainOf(state), null);
    expect(state.stack).toEqual([]);
    expect(resolvePlayers(state, attacked, context)).toEqual([]);
    expect(resolvePlayers(state, attackedBy(self), context)).toEqual([]);
    expect(resolvePlayers(state, initiatedByVillain, context)).toEqual([]);
    expect(resolveValue(state, cardsInHand(attacked), context, deps)).toBe(0);
    expect(resolveValue(state, cardsInHand(attackedBy(self)), context, deps)).toBe(0);
    expect(evaluate(state, { kind: "compare", left: cardsInHand(attacked), op: "atLeast", right: n(1) }, context)).toBe(
      false,
    );
  });

  it("a player's own attack has no attacked player", () => {
    const watching = playerCardIntoPlay(table(), WATCH.id, P1).state;
    const run = driveSession(
      startSession(watching),
      deps,
      [
        {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: heroOf(watching, P1),
          targetInstanceId: villainOf(watching),
        },
      ],
      defaultPick,
    );
    expect(recorded(run.session.state, "probed")).toBe(1);
    expect(recorded(run.session.state, "innermost")).toBe(0);
    expect(recorded(run.session.state, "byVillain")).toBe(0);
    expect(mustInstance(run.session.state, villainOf(watching)).damage).toBe(2);
  });
});
