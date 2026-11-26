/**
 * An enemy attack whose target player is eliminated partway through ends (`endedByTargetElimination`,
 * `resolve/enemy-activation.ts`). Synthetic cards only.
 *
 * RRG 1.8 "Player Elimination" (p. 34): "If a player is eliminated in the middle of an attack, that attack ends", and
 * "Eliminated players no longer participate in the game". FFG ruling (RRG 1.0-1.4 rulings, "Expansion card questions
 * part 5", question 3, scenario 4): "if a defending hero was defeated during the boost card step … the attack will not
 * deal any damage at the end because the target player was eliminated".
 *
 * Issue #1012 §1 (game d635a07d): Crossbones' Machine Gun interrupt eliminated Quicksilver as Crossbones attacked him;
 * the eliminated player was then asked to declare a defender, picked the other player's ally, and the attack dealt it
 * damage.
 *
 * p. 34 says "a player": any player's elimination mid-attack ends it, a third player's included (rules-expert, #1012),
 * and so does one in the interrupt window of the attack's own damage, after the procedure has queued it.
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { Command } from "../commands.js";
import { createCtx } from "../ctx.js";
import { applyCommand, replay, startSession } from "../engine.js";
import { runFlow } from "../flow.js";
import type { GameEvent } from "../events.js";
import { playerId, type InstanceId, type PlayerId } from "../ids.js";
import { locateCard, mustInstance, mustPlayer } from "../query.js";
import type { EffectSpec } from "../spec.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility, type StubAbility } from "../testing/abilities.js";
import { driveSession } from "../testing/drive.js";
import { stubAlly, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "../testing/fixtures.js";
import { defaultPick, settle, settleUntil } from "../testing/scenario.js";
import { eliminatePlayer } from "./defeat.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "../testing/wave3.js";

const KILL = 99;
const P3: PlayerId = playerId("p3");
const killHeroOf = (player: PlayerId): EffectSpec => ({
  kind: "dealDamage",
  target: { kind: "identityOf", player: { kind: "id", playerId: player } },
  amount: { kind: "const", value: KILL },
});
const villainAttacksYou = stubAbility("attack-me.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: { kind: "controller" } }],
});
/** "Action: The villain attacks each player." (Two attacks pushed in one batch, the first against P1.) */
const villainAttacksEach = stubAbility("attack-each.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: { kind: "each" } }],
});
/** "Action: The villain attacks you. That attack gains overkill." */
const villainOverkillsYou = stubAbility("overkill-me.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "enemyAttack", enemies: { kind: "villain" }, against: { kind: "controller" }, keywords: ["overkill"] },
  ],
});
/** "Forced Response: After the villain attacks, deal 1 damage to the villain." (An after-attack response to watch.) */
const RECOIL = stubAbility("recoil.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } }],
});
/** "Forced Interrupt: When the villain attacks, deal 99 damage to the attacked character." (Machine Gun's place.) */
const GUNFIRE = stubAbility("gunfire.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [{ kind: "dealDamage", target: { kind: "eventTarget" }, amount: { kind: "const", value: KILL } }],
});
/** "Forced Interrupt: When the villain attacks, deal 99 damage to the third player's hero." */
const SNIPE_THIRD = stubAbility("snipe-third.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [killHeroOf(P3)],
});
/** "Forced Interrupt: When an ally would take damage from an attack, deal 99 damage to the first player's hero." */
const ALLY_HIT = stubAbility("ally-hit.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "dealDamage", targetIs: { categories: ["ally"] }, fromAttack: true },
  },
  effects: [killHeroOf(P1)],
});
/** "Forced Interrupt: When the villain's attack reaches its damage step, deal 99 damage to the first player's hero." */
const DAMAGE_STEP_HIT = stubAbility("damage-step-hit.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "enemyAttackDamageStep", sourceIs: { categories: ["villain"] } },
  },
  effects: [killHeroOf(P1)],
});
/** "Boost: Deal 99 damage to the third player's hero." */
const THIRD_BOOST = stubAbility("third.boost", { trigger: { kind: "boost" }, effects: [killHeroOf(P3)] });
/** "Boost: Deal 99 damage to P1's hero." (P1 by seat, not "the first player", which passes on as P1 is eliminated.) */
const P1_BOOST = stubAbility("p1.boost", { trigger: { kind: "boost" }, effects: [killHeroOf(P1)] });

/** "Forced Interrupt: When an ally would take damage from an attack, deal 99 damage to the third player's hero." */
const ALLY_HIT_THIRD = stubAbility("ally-hit-third.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "dealDamage", targetIs: { categories: ["ally"] }, fromAttack: true },
  },
  effects: [killHeroOf(P3)],
});
/** "The villain's attacks deal indirect damage." (Starshark's rule, on the villain.) */
const INDIRECT_RULE = stubAbility("indirect.constant", {
  trigger: { kind: "constant", rules: [{ kind: "attacksDealIndirectDamage", attacker: { self: true } }] },
  effects: [],
});
/** "Divide damage from the villain's attack among each character the attacked player controls as evenly as possible." */
const EVENLY_RULE = stubAbility("evenly.constant", {
  trigger: { kind: "constant", rules: [{ kind: "attacksDividedEvenly", attacker: { self: true } }] },
  effects: [],
});

/** "Boost: Deal 99 damage to your hero." ("You" is the defending player, RRG 1.8 "Defend, Defense", p. 16.) */
const AMBUSH_BOOST = stubAbility("ambush.boost", {
  trigger: { kind: "boost" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "controller" } },
      amount: { kind: "const", value: KILL },
    } satisfies EffectSpec,
  ],
});

/** "Boost: Deal 99 damage to the first player's hero." (P1, the attacked player, whoever defends.) */
const STRAFE_BOOST = stubAbility("strafe.boost", {
  trigger: { kind: "boost" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "firstPlayer" } },
      amount: { kind: "const", value: KILL },
    } satisfies EffectSpec,
  ],
});

const SCHEME = stubMainScheme({
  id: "plot",
  stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 1 });
const AMBUSH = stubTreachery({ id: "ambush", boostIcons: 1, abilities: [AMBUSH_BOOST.ref] });
const STRAFE = stubTreachery({ id: "strafe", boostIcons: 1, abilities: [STRAFE_BOOST.ref] });
const THIRD = stubTreachery({ id: "third", boostIcons: 1, abilities: [THIRD_BOOST.ref] });
const P1_KILL = stubTreachery({ id: "p1-kill", boostIcons: 1, abilities: [P1_BOOST.ref] });
/** P2's ally, which P1 could declare as the defender of an attack against P1 (the d635a07d Gambit). */
const WALL = stubAlly({ id: "wall", cost: 0, atk: 1, thw: 1, hp: 30 });
/** P1's 1-hit-point ally, defending so an overkill attack spills onto P1's hero. */
const TWIG = stubAlly({ id: "twig", cost: 0, atk: 1, thw: 1, hp: 1 });
const BUTTON = stubSupport({
  id: "attack-me",
  cost: 0,
  abilities: [villainAttacksYou.ref, villainAttacksEach.ref, villainOverkillsYou.ref],
});

const deps: EngineDeps = depsOf(
  villainAttacksYou,
  GUNFIRE,
  AMBUSH_BOOST,
  STRAFE_BOOST,
  SNIPE_THIRD,
  ALLY_HIT,
  DAMAGE_STEP_HIT,
  THIRD_BOOST,
  P1_BOOST,
  villainAttacksEach,
  villainOverkillsYou,
  RECOIL,
  ALLY_HIT_THIRD,
  INDIRECT_RULE,
  EVENLY_RULE,
);

interface TableOptions {
  readonly interrupt: boolean;
  readonly boost: "blank" | "ambush" | "strafe" | "third" | "p1";
  /** Another forced interrupt on the villain, beside the Gunfire. */
  readonly villainAbility?: StubAbility;
  readonly players?: 2 | 3;
  /** The button's action used (the villain attacks you, by default). */
  readonly action?: StubAbility;
  /** The villain's ATK (3 by default). */
  readonly atk?: number;
  /** P1 also has the 1-hit-point Twig in play. */
  readonly twig?: boolean;
  /** The villain's attacks deal indirect damage, or are divided evenly. */
  readonly damage?: "indirect" | "evenly";
}

/**
 * Two players in hero form on P1's turn; P2 has the Wall in play and P1 the support whose action has the villain
 * attack P1. `interrupt` puts the Gunfire on the villain; `boost` is the encounter deck's only card.
 */
function table(options: TableOptions) {
  const abilities = [
    ...(options.interrupt ? [GUNFIRE.ref] : []),
    ...(options.villainAbility ? [options.villainAbility.ref] : []),
    ...(options.damage === "indirect" ? [INDIRECT_RULE.ref] : options.damage === "evenly" ? [EVENLY_RULE.ref] : []),
  ];
  const villain = stubVillain({
    id: "boss",
    stages: [{ hp: flat(40), atk: options.atk ?? 3, sch: 1, abilities }],
  });
  const boostCard = { blank: BLANK, ambush: AMBUSH, strafe: STRAFE, third: THIRD, p1: P1_KILL }[options.boost];
  const base = gameAtFirstTurn({
    cards: [villain, SCHEME, BLANK, AMBUSH, STRAFE, THIRD, P1_KILL, WALL, BUTTON, TWIG],
    deps,
    players: options.players ?? 2,
    villain,
    mainScheme: SCHEME,
    deck: [WALL.id, BUTTON.id, TWIG.id],
    encounter: copiesOf(boostCard.id, 30),
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const wall = playerCardIntoPlay(heroes, WALL.id, P2);
  const button = playerCardIntoPlay(wall.state, BUTTON.id, P1);
  const twig = options.twig ? playerCardIntoPlay(button.state, TWIG.id, P1) : null;
  const state = twig?.state ?? button.state;
  expect(state.step).toMatchObject({ phase: "player", activePlayerId: P1 });
  return { state, wall: wall.id, button: button.id, twig: twig?.id ?? null };
}

/** Indirect damage assigned to the Twig first (its 1 point), the rest to the identity. */
function twigFirst(state: GameState, twig: InstanceId): readonly string[] {
  const choice = state.pendingChoice!;
  const mine = (id: string) => id.startsWith(`${twig}#`);
  const sorted = [...choice.options].sort((a, b) => Number(mine(b.optionId)) - Number(mine(a.optionId)));
  return sorted.slice(0, choice.minSelections).map((option) => option.optionId);
}

/** Uses the button; Declare Defender is answered by `defend` (an instance id, or "decline"). */
function attack(options: TableOptions, defend: (state: GameState) => string = () => "decline") {
  const start = table(options);
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: start.button,
    abilityId: (options.action ?? villainAttacksYou).ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  const pick = (state: GameState): readonly string[] =>
    state.pendingChoice?.prompt.kind === "declareDefender"
      ? [defend(state)]
      : state.pendingChoice?.prompt.kind === "assignIndirectDamage" && start.twig
        ? twigFirst(state, start.twig)
        : defaultPick(state);
  const run = driveSession(startSession(start.state), deps, [command], pick);
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.session.state);
  return { state: run.session.state, events: run.events, wall: start.wall, twig: start.twig };
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const defenderPrompts = (events: readonly GameEvent[]) =>
  of(events, "choiceRequested").filter((e) => e.choice.prompt.kind === "declareDefender");
const heroOf = (state: GameState, player: typeof P1): InstanceId => mustPlayer(state, player).identity.instanceId;
const wallOf = (state: GameState): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === WALL.id && i.faceup)!.instanceId;

describe("an enemy attack whose target player is eliminated ends (RRG 1.8 'Player Elimination', p. 34)", () => {
  it("eliminated in the attack's interrupt window: no boost card, nobody asked to defend, no damage (#1012)", () => {
    const { state, events, wall } = attack({ interrupt: true, boost: "blank" }, wallOf);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(defenderPrompts(events)).toEqual([]);
    expect(of(events, "boostCardDealt")).toEqual([]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "playerEliminated" }]);
    expect(mustInstance(state, wall).damage).toBe(0);
    expect(mustInstance(state, wall).exhausted).toBe(false);
    expect(mustPlayer(state, P2).eliminated).toBe(false);
    expect(state.outcome).toBeNull();
    expect(state.pendingChoice?.playerId ?? P2).not.toBe(P1);
  });

  it("the defending hero is eliminated by a boost ability: the attack deals no damage and its boost card is discarded", () => {
    const { state, events } = attack({ interrupt: false, boost: "ambush" }, (s) => heroOf(s, P1));
    expect(of(events, "defenderDeclared")).toMatchObject([{ defenderInstanceId: heroOf(state, P1) }]);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "playerEliminated" }]);
    // The only damage dealt is the boost ability's; the attack's own is never dealt.
    expect(of(events, "damageDealt").map((e) => e.amount)).toEqual([KILL]);
    const boss = Object.values(state.instances).find((i) => i.cardId === "boss")!;
    expect(boss.boostCards).toEqual([]);
    const [given] = of(events, "boostCardDealt");
    expect(locateCard(state, given!.instanceId)).toMatchObject({ kind: "encounterDiscard" });
    expect(state.outcome).toBeNull();
  });

  // RRG p. 34 says "a player": the attacked player's elimination ends the attack even once the other player's ally has
  // defended it and that player has become its target (rules-expert, #1012).
  it("the attacked player is eliminated after another player's ally defended: the attack ends and the ally takes nothing", () => {
    const { state, events, wall } = attack({ interrupt: false, boost: "strafe" }, wallOf);
    expect(of(events, "defenderDeclared")).toMatchObject([{ defenderInstanceId: wall }]);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "playerEliminated" }]);
    expect(mustInstance(state, wall).damage).toBe(0);
  });

  it("control: without the elimination the attacked player is asked, may defend with the other player's ally, and it takes the damage", () => {
    const { state, events, wall } = attack({ interrupt: false, boost: "blank" }, wallOf);
    const [prompt] = defenderPrompts(events);
    expect(prompt?.choice.playerId).toBe(P1);
    expect(of(events, "activationSkipped")).toEqual([]);
    expect(mustInstance(state, wall).damage).toBe(4);
    expect(mustPlayer(state, P1).eliminated).toBe(false);
  });

  it("a third player eliminated in the attack's interrupt window ends it: nobody is asked to defend, no damage", () => {
    const { state, events } = attack({ interrupt: false, boost: "blank", villainAbility: SNIPE_THIRD, players: 3 });
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P3 }]);
    expect(defenderPrompts(events)).toEqual([]);
    expect(of(events, "boostCardDealt")).toEqual([]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "playerEliminated" }]);
    expect(mustInstance(state, heroOf(state, P1)).damage).toBe(0);
    expect([P1, P2].map((p) => mustPlayer(state, p).eliminated)).toEqual([false, false]);
    expect(state.outcome).toBeNull();
  });

  it("a third player eliminated by a boost ability after another player's ally defended: the ally takes nothing", () => {
    const { state, events, wall } = attack({ interrupt: false, boost: "third", players: 3 }, wallOf);
    expect(of(events, "defenderDeclared")).toMatchObject([{ defenderInstanceId: wall }]);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P3 }]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "playerEliminated" }]);
    expect(mustInstance(state, wall).damage).toBe(0);
    expect(mustInstance(state, heroOf(state, P1)).damage).toBe(0);
  });

  it("control: three players and nobody eliminated, the defending ally takes the damage", () => {
    const { state, events, wall } = attack({ interrupt: false, boost: "blank", players: 3 }, wallOf);
    expect(of(events, "playerEliminated")).toEqual([]);
    expect(mustInstance(state, wall).damage).toBe(4);
  });

  // The damage step's own interrupt window (`enemyAttackDamageStep`): the procedure has not yet dealt anything.
  it("the attacked player eliminated at the damage step, before the damage is queued: the defending ally takes nothing", () => {
    const { state, events, wall } = attack(
      { interrupt: false, boost: "blank", villainAbility: DAMAGE_STEP_HIT },
      wallOf,
    );
    expect(of(events, "defenderDeclared")).toMatchObject([{ defenderInstanceId: wall }]);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "playerEliminated" }]);
    expect(of(events, "attackResolved")).toEqual([]);
    expect(mustInstance(state, wall).damage).toBe(0);
  });

  // The interrupt window of the attack's damage itself ("when … would take damage"): the procedure has queued it.
  it("the attacked player eliminated in the damage's own interrupt window: the queued damage to the ally is not dealt", () => {
    const { state, events, wall } = attack({ interrupt: false, boost: "blank", villainAbility: ALLY_HIT }, wallOf);
    expect(of(events, "defenderDeclared")).toMatchObject([{ defenderInstanceId: wall }]);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "playerEliminated" }]);
    expect(mustInstance(state, wall).damage).toBe(0);
    // Nothing was attacked: no retaliate, no "after … is attacked".
    const resolved = of(events, "triggerEvent").filter((e) => e.phase === "resolved");
    expect(resolved.some((e) => e.event.kind === "characterAttacked")).toBe(false);
    expect(mustPlayer(state, P2).eliminated).toBe(false);
    expect(state.outcome).toBeNull();
  });

  // Only the attack in the middle ends ("that attack", p. 34): one queued behind it in the same batch, not yet begun,
  // resolves against its own player.
  it("two attacks pushed in one batch: the first one's elimination of P1 leaves the second, against P2, to resolve", () => {
    const { state, events } = attack({ interrupt: false, boost: "p1", action: villainAttacksEach });
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "playerEliminated" }]);
    // The second attack: the villain's ATK 3 and its boost card's 1 icon, undefended, to P2's hero.
    expect(of(events, "attackResolved")).toMatchObject([{ targetInstanceId: heroOf(state, P2), damageDealt: 4 }]);
    expect(mustInstance(state, heroOf(state, P2)).damage).toBe(4);
    expect(mustPlayer(state, P2).eliminated).toBe(false);
    expect(state.outcome).toBeNull();
  });
});

/**
 * Pins: an attack whose own damage eliminates a player has already dealt it. Nothing is taken back, and what follows
 * the damage (the attacked character, the attack's response window) still resolves (RRG 1.8 "Attack (Enemy
 * Activation)", p. 9, steps 4-6; "Player Elimination", p. 34, ends what is left of an attack, not what it has done).
 */
describe("an attack whose own damage eliminates a player has dealt that damage", () => {
  const attackedNamed = (events: readonly GameEvent[], id: InstanceId) =>
    of(events, "triggerEvent").some(
      (e) => e.phase === "resolved" && e.event.kind === "characterAttacked" && e.event.targetInstanceId === id,
    );
  const villainDamage = (state: GameState) => Object.values(state.instances).find((i) => i.cardId === "boss")!.damage;

  it("undefended: the hero takes it, is attacked, and 'after the villain attacks' resolves", () => {
    const start = table({ interrupt: false, boost: "blank", villainAbility: RECOIL, atk: KILL });
    const hero = heroOf(start.state, P1);
    const { state, events } = attack({ interrupt: false, boost: "blank", villainAbility: RECOIL, atk: KILL });
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(of(events, "activationSkipped")).toEqual([]);
    expect(of(events, "attackResolved")).toMatchObject([{ targetInstanceId: hero, damageDealt: KILL + 1 }]);
    expect(of(events, "damageDealt").some((e) => e.targetInstanceId === hero && e.amount > 0)).toBe(true);
    expect(attackedNamed(events, hero)).toBe(true);
    expect(villainDamage(state)).toBe(1);
    expect(mustPlayer(state, P2).eliminated).toBe(false);
    expect(mustInstance(state, heroOf(state, P2)).damage).toBe(0);
    expect(state.outcome).toBeNull();
  });

  it("an overkill spill from P1's defending ally onto P1's hero: the spill is dealt and the ally was still attacked", () => {
    const options: TableOptions = {
      interrupt: false,
      boost: "blank",
      villainAbility: RECOIL,
      atk: KILL,
      action: villainOverkillsYou,
      twig: true,
    };
    const twig = table(options).twig;
    expect(twig).not.toBeNull();
    const { state, events } = attack(options, () => twig!);
    const hero = heroOf(state, P1);
    expect(of(events, "defenderDeclared")).toMatchObject([{ defenderInstanceId: twig }]);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(of(events, "activationSkipped")).toEqual([]);
    expect(of(events, "damageDealt").some((e) => e.targetInstanceId === hero && e.amount > 0)).toBe(true);
    expect(attackedNamed(events, twig!)).toBe(true);
    expect(villainDamage(state)).toBe(1);
    expect(mustPlayer(state, P2).eliminated).toBe(false);
    expect(state.outcome).toBeNull();
  });
});

/**
 * An attack whose damage is handed to an effect that assigns it (indirect, Starshark; divided evenly, Bombshell) is
 * still that attack (RRG 1.8 "Player Elimination", p. 34; "Indirect Damage", p. 24: assigned, then "resolved
 * simultaneously"). An elimination before the shares are dealt ends it: none is dealt, nobody is asked to assign any
 * more. Once they are dealt, they stay dealt.
 */
describe("an enemy attack whose damage is assigned (indirect, divided evenly) ends with a player's elimination", () => {
  const resolvedAttacked = (events: readonly GameEvent[]) =>
    of(events, "triggerEvent").filter((e) => e.phase === "resolved" && e.event.kind === "characterAttacked");

  it("indirect: a third player eliminated in a share's interrupt window: no share is dealt, nothing is attacked", () => {
    const { state, events, twig } = attack({
      interrupt: false,
      boost: "blank",
      damage: "indirect",
      twig: true,
      villainAbility: ALLY_HIT_THIRD,
      players: 3,
    });
    expect(of(events, "choiceRequested").some((e) => e.choice.prompt.kind === "assignIndirectDamage")).toBe(true);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P3 }]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "playerEliminated" }]);
    // The Twig's share's window eliminated P3; the hero's share, assigned with it, is not dealt either.
    expect(mustInstance(state, twig!).damage).toBe(0);
    expect(mustInstance(state, heroOf(state, P1)).damage).toBe(0);
    expect(resolvedAttacked(events)).toEqual([]);
    expect([P1, P2].map((p) => mustPlayer(state, p).eliminated)).toEqual([false, false]);
    expect(state.outcome).toBeNull();
  });

  it("divided evenly: a third player eliminated in a share's interrupt window: no share is dealt", () => {
    const { state, events, twig } = attack({
      interrupt: false,
      boost: "blank",
      damage: "evenly",
      twig: true,
      villainAbility: ALLY_HIT_THIRD,
      players: 3,
    });
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P3 }]);
    expect(of(events, "activationSkipped")).toMatchObject([{ activation: "attack", reason: "playerEliminated" }]);
    expect(mustInstance(state, twig!).damage).toBe(0);
    expect(mustInstance(state, heroOf(state, P1)).damage).toBe(0);
    expect(resolvedAttacked(events)).toEqual([]);
  });

  it("control: the same indirect attack with nobody eliminated deals both shares", () => {
    const { state, events, twig } = attack({
      interrupt: false,
      boost: "blank",
      damage: "indirect",
      twig: true,
      players: 3,
    });
    expect(of(events, "playerEliminated")).toEqual([]);
    expect(mustInstance(state, heroOf(state, P1)).damage).toBe(3);
    // The Twig's 1 point defeated it.
    expect(locateCard(state, twig!)).toMatchObject({ kind: "discard" });
  });

  it("indirect, already dealt: shares that eliminate P1 as they resolve stay dealt, and the attack finishes", () => {
    const { state, events } = attack({
      interrupt: false,
      boost: "blank",
      damage: "indirect",
      twig: true,
      atk: KILL,
      villainAbility: RECOIL,
    });
    const hero = heroOf(state, P1);
    expect(of(events, "playerEliminated")).toMatchObject([{ playerId: P1 }]);
    expect(of(events, "activationSkipped")).toEqual([]);
    expect(of(events, "damageDealt").some((e) => e.targetInstanceId === hero && e.amount > 0)).toBe(true);
    expect(
      resolvedAttacked(events).map((e) => e.event.kind === "characterAttacked" && e.event.targetInstanceId),
    ).toEqual([hero]);
    expect(Object.values(state.instances).find((i) => i.cardId === "boss")!.damage).toBe(1);
    expect(mustPlayer(state, P2).eliminated).toBe(false);
    expect(state.outcome).toBeNull();
  });

  /** The indirect attack on P1, stopped at P1's assignment of its 4 damage. */
  function atAssignment(players: 2 | 3) {
    const start = table({ interrupt: false, boost: "blank", damage: "indirect", twig: true, players });
    const used = applyCommand(
      start.state,
      {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: start.button,
        abilityId: villainAttacksYou.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
        payment: [],
      },
      deps,
    );
    if (!used.ok) throw new Error(used.error.message);
    const state = settleUntil(used.state, "assignIndirectDamage", deps);
    expect(state.pendingChoice).toMatchObject({ playerId: P1, prompt: { kind: "assignIndirectDamage", amount: 4 } });
    return { state, twig: start.twig! };
  }

  // A safeguard: no rule eliminates a player while this assignment choice is open (a lone concede refuses while a
  // choice is pending), so these call eliminatePlayer on the paused state directly.
  it("indirect, mid-assignment: a player eliminated while P1 is assigning withdraws the choice; nothing is dealt", () => {
    const { state, twig } = atAssignment(3);
    const ctx = createCtx(state, deps);
    eliminatePlayer(ctx, P3);
    expect(ctx.state.pendingChoice).toBeNull();
    runFlow(ctx);
    expect(ctx.state.pendingChoice?.prompt.kind).not.toBe("assignIndirectDamage");
    const after = settle(ctx.state, defaultPick, deps);
    expect(ctx.events.filter((e) => e.type === "activationSkipped")).toMatchObject([
      { activation: "attack", reason: "playerEliminated" },
    ]);
    expect(mustInstance(after, twig).damage).toBe(0);
    expect(mustInstance(after, heroOf(after, P1)).damage).toBe(0);
    expect(after.outcome).toBeNull();
  });

  it("indirect, mid-assignment: the assigning player eliminated is left with no choice", () => {
    const { state } = atAssignment(2);
    const ctx = createCtx(state, deps);
    eliminatePlayer(ctx, P1);
    runFlow(ctx);
    expect(ctx.state.pendingChoice?.playerId ?? null).not.toBe(P1);
    expect(ctx.state.outcome).toBeNull();
  });
});
