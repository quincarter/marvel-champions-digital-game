/**
 * The "you" of a "Boost" ability, and of a constant ability while an enemy attacks. Synthetic cards only.
 *
 * RRG 1.8 "Defend, Defense" (the entry begins on p. 15; these sentences are on p. 16): "If a player defends against an
 * enemy attack that targets a different player (either by defending with a character they control or by resolving a
 * defense ability), the defending player becomes the new target of that attack." "Any constant or boost abilities
 * that refer to 'you' refer to the defending player." p. 15: "When an ally defends an attack, that ally becomes the
 * target character for that attack, and its controller becomes the target player for that attack." Owner ruling
 * 2026-10-09 (docs/phase7-wave8.md §4.1 row 93): follow the RRG.
 *
 * Timing: "Attack (Enemy Activation)" (p. 9) declares the defender at step 2 and turns the boost cards up at step 3,
 * so a boost ability always resolves with the defense known. Nobody defending leaves the attacked player the target.
 * A scheme has no defender ("Scheme (Enemy Activation)", p. 39): its boost card's "you" is the player the enemy is
 * scheming against.
 */
import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { defendPreview } from "./defend-preview.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, PlayerRef, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEnvironment,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCards, RESOURCE } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const you: PlayerRef = { kind: "controller" };
const others: PlayerRef = { kind: "others", of: you };
const villain: TargetRef = { kind: "villain" };
const yourHero: TargetRef = { kind: "identityOf", player: you };
const cardsInHand = (player: PlayerRef): ValueSpec => ({ kind: "handCount", player });
const record = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "mainScheme" },
  counterType,
  amount,
});

/** "Boost: Deal 1 damage to you." It also notes how many cards "your hand" holds. No boost icons. */
const STING_BOOST = stubAbility("sting.boost", {
  trigger: { kind: "boost" },
  effects: [
    record("stung", n(1)),
    record("yourHand", cardsInHand(you)),
    { kind: "dealDamage", target: yourHero, amount: n(1) },
  ],
} satisfies AbilityDefinition);
const STING = stubTreachery({ id: "sting", boostIcons: 0, abilities: [STING_BOOST.ref] });
/** "This card gets +2 boost icons if you have at least 4 cards in your hand." A constant on the boost card itself. */
const GREED_CONSTANT = stubAbility("greed.constant", {
  trigger: {
    kind: "constant",
    modifiers: [
      {
        stat: "boostIcons",
        amount: 2,
        target: { self: true },
        while: { kind: "compare", left: cardsInHand(you), op: "atLeast", right: n(4) },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
const GREED = stubTreachery({ id: "greed", boostIcons: 0, abilities: [GREED_CONSTANT.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** An environment nobody controls: "While the villain is attacking you, he gets +1 ATK for each card in your hand." */
const HAZE_CONSTANT = stubAbility("haze.constant", {
  trigger: {
    kind: "constant",
    modifiers: [
      {
        stat: "atk",
        amount: cardsInHand({ kind: "attackedPlayer", attacker: villain }),
        target: { categories: ["villain"] },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
const HAZE = stubEnvironment({ id: "haze", boostIcons: 0, abilities: [HAZE_CONSTANT.ref] });

const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(40), atk: 3, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "plot",
  stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(0) }],
});
/** Allies with enough hit points to take a whole attack: P1's Post, P2's Wall. */
const WALL = stubAlly({ id: "wall", cost: 0, atk: 1, thw: 1, hp: 30 });
const POST = stubAlly({ id: "post", cost: 0, atk: 1, thw: 1, hp: 30 });

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
/** "The villain attacks you." */
const ATTACK_ME = action("attack-me", [{ kind: "enemyAttack", enemies: villain, against: you }]);
/** "The villain schemes against each other player." */
const SCHEME_OTHER = action("scheme-other", [{ kind: "enemyScheme", enemies: villain, against: others }]);
const ACTIONS = [ATTACK_ME, SCHEME_OTHER] as const;
const BUTTONS = ACTIONS.map((a) => stubSupport({ id: a.ref.id.split(".")[0]!, cost: 0, abilities: [a.ref] }));

const deps: EngineDeps = depsOf(STING_BOOST, GREED_CONSTANT, HAZE_CONSTANT, ...ACTIONS);

/** P1's hand (2 cards) and P2's (5): every number below tells the two hands apart. */
const HAND = { p1: 2, p2: 5 } as const;

/**
 * Two players in hero form (DEF 2) on P1's turn, P1 holding 2 cards and P2 holding 5, each with a 30-hit-point ally
 * (P1's Post, P2's Wall). Every card of the encounter deck is `boostCard`. Test surgery, before the session starts.
 */
function table(boostCard: CardId, environment = false): GameState {
  const base = gameAtFirstTurn({
    cards: [BOSS, SCHEME, STING, GREED, BLANK, HAZE, WALL, POST, ...BUTTONS],
    deps,
    players: 2,
    villain: BOSS,
    mainScheme: SCHEME,
    deck: [WALL.id, POST.id, ...BUTTONS.map((b) => b.id)],
    encounter: [...(environment ? [HAZE.id] : []), ...copiesOf(boostCard, 30)],
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
  const board = environment ? encounterCardInVillainArea(emptied, HAZE.id).state : emptied;
  const allies = playerCardIntoPlay(playerCardIntoPlay(board, POST.id, P1).state, WALL.id, P2);
  const p1 = giveCards(allies.state, P1, ...copiesOf(RESOURCE.id, HAND.p1)).state;
  const state = giveCards(p1, P2, ...copiesOf(RESOURCE.id, HAND.p2)).state;
  expect(mustPlayer(state, P1).hand).toHaveLength(HAND.p1);
  expect(mustPlayer(state, P2).hand).toHaveLength(HAND.p2);
  expect(state.step).toMatchObject({ phase: "player", activePlayerId: P1 });
  return state;
}

const heroOf = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
const cardOf = (state: GameState, card: CardId): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card && i.faceup)!.instanceId;
const damageTo = (events: readonly GameEvent[], id: InstanceId): readonly number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));
const recorded = (state: GameState, counterType: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters[counterType] ?? 0;

type Defender = (state: GameState) => string;
const decline: Defender = () => "decline";

/** P1 uses `ability`; every Declare Defender prompt is answered with `defender`. The run must replay. */
function use(state: GameState, ability: StubAbility, defender: Defender = decline) {
  const card = BUTTONS[ACTIONS.indexOf(ability as (typeof ACTIONS)[number])]!;
  const placed = playerCardIntoPlay(state, card.id, P1);
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: placed.id,
    abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  const askedOf: PlayerId[] = [];
  const previews: NonNullable<ReturnType<typeof defendPreview>>[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind !== "declareDefender") return defaultPick(current);
    askedOf.push(choice.playerId);
    previews.push(defendPreview(current, deps) ?? []);
    return [defender(current)];
  };
  const run = driveSession(startSession(placed.state), deps, [command], pick);
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.session.state);
  return { state: run.session.state, events: run.events, askedOf, previews };
}

describe("'Boost: Deal 1 damage to you.' during an attack: 'you' is the defending player (RRG 1.8 p. 16)", () => {
  it("nobody defends: the attacked player takes the boost's 1, then the attack's 3", () => {
    const result = use(table(STING.id), ATTACK_ME);
    expect(result.askedOf).toEqual([P1]);
    expect(recorded(result.state, "stung")).toBe(1);
    expect(recorded(result.state, "yourHand")).toBe(HAND.p1);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([1, 3]);
    expect(damageTo(result.events, heroOf(result.state, P2))).toEqual([]);
  });

  it("the attacked player's own hero defends: they take the boost's 1, then 3 - DEF 2", () => {
    const result = use(table(STING.id), ATTACK_ME, (s) => heroOf(s, P1));
    expect(recorded(result.state, "yourHand")).toBe(HAND.p1);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([1, 1]);
    expect(damageTo(result.events, heroOf(result.state, P2))).toEqual([]);
  });

  it("the attacked player's own ally defends: 'you' is still them, and the ally takes the attack", () => {
    const result = use(table(STING.id), ATTACK_ME, (s) => cardOf(s, POST.id));
    expect(recorded(result.state, "yourHand")).toBe(HAND.p1);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([1]);
    expect(damageTo(result.events, cardOf(result.state, POST.id))).toEqual([3]);
  });

  it("ANOTHER player's hero defends: the boost's 1 is theirs, and the attacked player takes nothing", () => {
    const result = use(table(STING.id), ATTACK_ME, (s) => heroOf(s, P2));
    // The attacked player still decides the defense.
    expect(result.askedOf).toEqual([P1]);
    expect(recorded(result.state, "stung")).toBe(1);
    expect(recorded(result.state, "yourHand")).toBe(HAND.p2);
    expect(damageTo(result.events, heroOf(result.state, P2))).toEqual([1, 1]);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([]);
  });

  it("another player's ALLY defends: its controller is 'you' (p. 15), their hero takes the boost's 1", () => {
    const result = use(table(STING.id), ATTACK_ME, (s) => cardOf(s, WALL.id));
    expect(recorded(result.state, "yourHand")).toBe(HAND.p2);
    expect(damageTo(result.events, heroOf(result.state, P2))).toEqual([1]);
    expect(damageTo(result.events, cardOf(result.state, WALL.id))).toEqual([3]);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([]);
  });

  it("a scheme has no defender: 'you' is the player the villain schemes against", () => {
    const result = use(table(STING.id), SCHEME_OTHER);
    expect(result.askedOf).toEqual([]);
    expect(recorded(result.state, "stung")).toBe(1);
    expect(recorded(result.state, "yourHand")).toBe(HAND.p2);
    expect(damageTo(result.events, heroOf(result.state, P2))).toEqual([1]);
    expect(damageTo(result.events, heroOf(result.state, P1))).toEqual([]);
  });
});

describe("a boost card's own constant 'if you have at least 4 cards in your hand': the defending player's hand", () => {
  it("counts no icons for the attacked player (2 cards), undefended or defended by their own hero", () => {
    expect(damageTo(use(table(GREED.id), ATTACK_ME).events, heroOf(table(GREED.id), P1))).toEqual([3]);
    const own = use(table(GREED.id), ATTACK_ME, (s) => heroOf(s, P1));
    expect(damageTo(own.events, heroOf(own.state, P1))).toEqual([1]);
  });

  it("counts 2 icons when another player (5 cards) defends, with a hero or an ally", () => {
    const hero = use(table(GREED.id), ATTACK_ME, (s) => heroOf(s, P2));
    expect(hero.events.filter((e) => e.type === "boostCardFlipped").map((e) => e.boostIcons)).toEqual([2]);
    expect(damageTo(hero.events, heroOf(hero.state, P2))).toEqual([3 + 2 - 2]);
    const ally = use(table(GREED.id), ATTACK_ME, (s) => cardOf(s, WALL.id));
    expect(damageTo(ally.events, cardOf(ally.state, WALL.id))).toEqual([3 + 2]);
  });

  it("the defend prompt's boost range is each option's own defending player's", () => {
    const result = use(table(GREED.id), ATTACK_ME);
    const [preview] = result.previews;
    const boostOf = (optionId: string) => {
      const option = preview!.find((o) => o.optionId === optionId)!;
      return [option.targetPlayerId, option.boost.min, option.boost.max];
    };
    expect(boostOf("decline")).toEqual([P1, 0, 0]);
    expect(boostOf(heroOf(result.state, P1))).toEqual([P1, 0, 0]);
    expect(boostOf(cardOf(result.state, POST.id))).toEqual([P1, 0, 0]);
    expect(boostOf(heroOf(result.state, P2))).toEqual([P2, 2, 2]);
    expect(boostOf(cardOf(result.state, WALL.id))).toEqual([P2, 2, 2]);
  });
});

describe("a constant nobody controls, 'While the villain is attacking you, +1 ATK per card in your hand'", () => {
  it("nobody defends, or the attacked player's own character does: the attacked player's 2 cards", () => {
    const undefended = use(table(BLANK.id, true), ATTACK_ME);
    expect(damageTo(undefended.events, heroOf(undefended.state, P1))).toEqual([3 + HAND.p1]);
    const hero = use(table(BLANK.id, true), ATTACK_ME, (s) => heroOf(s, P1));
    expect(damageTo(hero.events, heroOf(hero.state, P1))).toEqual([3 + HAND.p1 - 2]);
    const ally = use(table(BLANK.id, true), ATTACK_ME, (s) => cardOf(s, POST.id));
    expect(damageTo(ally.events, cardOf(ally.state, POST.id))).toEqual([3 + HAND.p1]);
  });

  it("another player's hero or ally defends: the defending player's 5 cards", () => {
    const hero = use(table(BLANK.id, true), ATTACK_ME, (s) => heroOf(s, P2));
    expect(damageTo(hero.events, heroOf(hero.state, P2))).toEqual([3 + HAND.p2 - 2]);
    const ally = use(table(BLANK.id, true), ATTACK_ME, (s) => cardOf(s, WALL.id));
    expect(damageTo(ally.events, cardOf(ally.state, WALL.id))).toEqual([3 + HAND.p2]);
  });

  it("the defend prompt previews each option with the ATK the damage step will read", () => {
    const result = use(table(BLANK.id, true), ATTACK_ME);
    const [preview] = result.previews;
    const atkOf = (optionId: string) => preview!.find((o) => o.optionId === optionId)!.baseAtk;
    expect(atkOf("decline")).toBe(3 + HAND.p1);
    expect(atkOf(heroOf(result.state, P1))).toBe(3 + HAND.p1);
    expect(atkOf(heroOf(result.state, P2))).toBe(3 + HAND.p2);
    expect(atkOf(cardOf(result.state, WALL.id))).toBe(3 + HAND.p2);
    const p2Hero = preview!.find((o) => o.optionId === heroOf(result.state, P2))!;
    expect(p2Hero.bands.map((band) => band.damageDealt)).toEqual([3 + HAND.p2 - 2]);
  });
});
