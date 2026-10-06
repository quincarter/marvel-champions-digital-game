/**
 * The two limits between players on defending one enemy attack, and the one-defense rule (owner rulings 2026-10-06,
 * docs/phase7-wave7.md §4.1). RRG 1.8 "Defend, Defense" (pp. 14-15):
 *  - "Only one player at a time can defend against an enemy attack. While a player is defending, other players cannot
 *    defend against that same attack." A player whose ally defends is defending, and so is one who resolves a defense
 *    ability: "If a player defends against an enemy attack that targets a different player (either by defending with
 *    a character they control or by resolving a defense ability), the defending player becomes the new target".
 *  - "Once a player resolves a defense-labeled ability during an enemy attack, other players cannot resolve
 *    defense-labeled abilities for that same attack."
 *  - Neither binds the player concerned: "The defending player may resolve any number of defense abilities during an
 *    enemy attack", and "Defense-labeled abilities can be played during an attack by a player whose ally is defending
 *    that attack. In that case, the player's identity does not become the defender."
 *
 * Synthetic cards: the villain's ATK is 3 and every boost card has 1 boost icon, so an attack deals 4, or 2 through a
 * hero's DEF of 2. The markers are damage on the villain: the "(defense)" event Shield 1 per play ("when an enemy
 * attacks"), the "(defense)" event Block 10 per play ("when a character would take damage from an attack"), the
 * unlabeled support Watch 100 for each of those two windows, each hero's own forced "after you defend" 1000.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { defenseBarFor, defenseClaimOf } from "./defense-claim.js";
import { type GameSession, replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { type InstanceId, type PlayerId, playerId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCards, seatIdentities } from "./testing/scenario.js";
import { copiesOf, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";
import { choiceExclusions } from "./why-not.js";

const P3: PlayerId = playerId("p3");
const ability = (id: string, definition: AbilityDefinition) => stubAbility(id, definition);
const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain = { kind: "named", name: "villain" } as const;
const yourHero = { categories: ["hero"], controller: "you" } as const;
const yourIdentity = { kind: "identityOf", player: { kind: "controller" } } as const;
const hitVillain = (amount: number) => ({ kind: "dealDamage", target: theVillain, amount: n(amount) }) as const;
const whenAnEnemyAttacks = { on: "enemyAttack" } as const;
const whenAttackDamage = { on: "dealDamage", fromAttack: true } as const;

/** "Interrupt (defense): When an enemy attacks, deal 1 damage to the villain." — an event, before step 2. */
const SHIELD = ability("shield.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: whenAnEnemyAttacks },
  label: ["defense"],
  effects: [hitVillain(1)],
});
/** "Interrupt (defense): When a character would take damage from an attack, deal 10 damage to the villain." */
const BLOCK = ability("block.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: whenAttackDamage },
  label: ["defense"],
  effects: [hitVillain(10)],
});
/** Unlabeled, so never barred: it gets another player a prompt in the same two windows. */
const WATCH_ATTACK = ability("watch.attack-interrupt", {
  trigger: { kind: "interrupt", forced: false, on: whenAnEnemyAttacks },
  effects: [hitVillain(100)],
});
const WATCH_DAMAGE = ability("watch.damage-interrupt", {
  trigger: { kind: "interrupt", forced: false, on: whenAttackDamage },
  effects: [hitVillain(100)],
});
/** "Forced Interrupt (defense): When an enemy attacks, deal 1 damage to the villain." — two players' copies collide. */
const GUARD = ability("guard.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: whenAnEnemyAttacks },
  label: ["defense"],
  effects: [hitVillain(1)],
});
/** Unlabeled "Forced Interrupt: When an enemy attacks, declare your hero the defender." — before step 2. */
const DECLARE_EARLY = ability("declare-early.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: whenAnEnemyAttacks },
  effects: [{ kind: "declareDefender", character: yourIdentity }],
});
/** The same as the attack's damage is about to be dealt: another player's hero stepping in late. */
const DECLARE_LATE = ability("declare-late.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: whenAttackDamage },
  effects: [{ kind: "declareDefender", character: yourIdentity }],
});
const AFTER_YOU_DEFEND = ability("after-you-defend.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "defended", targetIs: yourHero } },
  effects: [hitVillain(1000)],
});
const attackAbility = (id: string, against: PlayerId) =>
  ability(id, {
    trigger: { kind: "action" },
    effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "id", playerId: against } }],
  });
const ATTACK_P1 = attackAbility("attack-p1.action", P1);
const ATTACK_P2 = attackAbility("attack-p2.action", P2);

const SUPPORTS = {
  watch: stubSupport({ id: "watch", cost: 0, abilities: [WATCH_ATTACK.ref, WATCH_DAMAGE.ref] }),
  guard: stubSupport({ id: "guard", cost: 0, abilities: [GUARD.ref] }),
  declareEarly: stubSupport({ id: "declare-early", cost: 0, abilities: [DECLARE_EARLY.ref] }),
  declareLate: stubSupport({ id: "declare-late", cost: 0, abilities: [DECLARE_LATE.ref] }),
  afterYouDefend: stubSupport({ id: "after-you-defend", cost: 0, abilities: [AFTER_YOU_DEFEND.ref] }),
} as const;
const EVENTS = {
  shield: stubEvent({ id: "shield", cost: 0, abilities: [SHIELD.ref] }),
  block: stubEvent({ id: "block", cost: 0, abilities: [BLOCK.ref] }),
} as const;
type SupportKey = keyof typeof SUPPORTS;
type EventKey = keyof typeof EVENTS;
const ATTACKER = stubSupport({ id: "attacker", cost: 0, abilities: [ATTACK_P1.ref, ATTACK_P2.ref] });
const BODYGUARD = stubAlly({ id: "bodyguard", cost: 0, atk: 1, thw: 1, hp: 6 });
const ICON = stubTreachery({ id: "icon", boostIcons: 1 });
const HERO = stubIdentity({ id: "hero", hp: 30, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 });

const deps: EngineDeps = depsOf(
  SHIELD,
  BLOCK,
  WATCH_ATTACK,
  WATCH_DAMAGE,
  GUARD,
  DECLARE_EARLY,
  DECLARE_LATE,
  AFTER_YOU_DEFEND,
  ATTACK_P1,
  ATTACK_P2,
);

interface Seat {
  readonly hand?: readonly EventKey[];
  readonly play?: readonly SupportKey[];
  readonly ally?: boolean;
}

/** A game at the first player's turn, every hero in hero form with "after you defend" in play. */
function setup(...seats: readonly Seat[]) {
  const villain = stubVillain({ id: "villain", stages: [{ hp: flat(90000), atk: 3, sch: 1 }] });
  const scheme = stubMainScheme({
    id: "main",
    stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(0) }],
  });
  const identities = seatIdentities(HERO, seats.length);
  const players = [P1, P2, P3].slice(0, seats.length);
  const cards = [...Object.values(SUPPORTS), ...Object.values(EVENTS), ATTACKER, BODYGUARD];
  const deck: readonly CardId[] = [...DEFAULT_DECK, ...cards.flatMap((card) => [card.id, card.id])];
  const created = createGame(
    {
      seed: 21,
      cards: [
        ...DEFAULT_CARDS.filter((card) => card.type !== "hero_identity"),
        ...identities,
        villain,
        scheme,
        ICON,
      ].concat(cards),
      villainCardId: villain.id,
      mainSchemeCardId: scheme.id,
      encounterDeck: copiesOf(ICON.id, 30),
      players: identities.map((identity) => ({ identityCardId: identity.id, deck })),
    },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  let state = driveSession(startSession(created.state), deps).session.state;
  const attacker = playerCardIntoPlay(state, ATTACKER.id);
  state = attacker.state;
  const hands: Record<string, readonly InstanceId[]> = {};
  const allies: Record<string, InstanceId | null> = {};
  seats.forEach((seat, index) => {
    const player = players[index]!;
    // Test surgery: the opening hand is put back under the deck, so the hand holds only the cards under test.
    state = {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [], deck: [...p.deck, ...p.hand] } : p)),
    };
    for (const key of ["afterYouDefend", ...(seat.play ?? [])] as const)
      state = playerCardIntoPlay(state, SUPPORTS[key].id, player).state;
    allies[player] = null;
    if (seat.ally) {
      const put = playerCardIntoPlay(state, BODYGUARD.id, player);
      state = put.state;
      allies[player] = put.id;
    }
    const given = giveCards(state, player, ...(seat.hand ?? []).map((key) => EVENTS[key].id));
    state = given.state;
    hands[player] = given.ids;
  });
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  return {
    state,
    attacker: attacker.id,
    villain: activeVillain(state).instanceId,
    hero: (player: PlayerId) => mustPlayer(state, player).identity.instanceId,
    /** The player's events under test, in the order `hand` listed them. */
    hand: (player: PlayerId) => hands[player] ?? [],
    ally: (player: PlayerId) => allies[player] ?? null,
  };
}
type Setup = ReturnType<typeof setup>;

const attack = (s: Setup, against: PlayerId = P1): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: s.attacker,
  abilityId: (against === P1 ? ATTACK_P1 : ATTACK_P2).ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

interface Plan {
  /** The cards each player triggers or plays whenever a window offers them, by card id. Default: nothing. */
  readonly picks?: Readonly<Record<string, readonly string[]>>;
  /** The answer to the Declare Defender step. Default: no defense. */
  readonly defender?: InstanceId | null;
  /** Reverses the first player's order of simultaneous forced abilities. */
  readonly reverseOrder?: boolean;
  /** Stops with this choice open instead of answering it. */
  readonly stopAt?: (state: GameState) => boolean;
}
interface Prompt {
  readonly player: PlayerId;
  readonly kind: string;
  /** The offered cards by card id (`decline` for "No defense"). */
  readonly offered: readonly string[];
}

const cardIdOf = (state: GameState, id: string): string => state.instances[id as InstanceId]?.cardId ?? id;

/** Applies `commands`, answering every choice by `plan` and recording the trigger and defender prompts. */
function drive(from: GameSession | Setup, commands: readonly Command[], plan: Plan = {}) {
  let session = "log" in from ? from : startSession(from.state);
  const events: GameEvent[] = [];
  const prompts: Prompt[] = [];
  const apply = (command: Command): void => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
  };
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice!;
    const offered = choice.options.map((o) => ("instanceId" in o.ref ? cardIdOf(state, o.ref.instanceId) : o.optionId));
    if (choice.prompt.kind === "declareDefender") {
      prompts.push({ player: choice.playerId, kind: "declareDefender", offered });
      // A defender exhausted by an earlier attack in the same run is no longer offered: that attack is declined.
      const defender = plan.defender ?? "decline";
      return [choice.options.some((o) => o.optionId === defender) ? defender : "decline"];
    }
    if (choice.prompt.kind === "chooseTriggers") {
      prompts.push({ player: choice.playerId, kind: "chooseTriggers", offered });
      const wanted = plan.picks?.[choice.playerId] ?? [];
      return choice.options.filter((_, index) => wanted.includes(offered[index]!)).map((o) => o.optionId);
    }
    if (choice.prompt.kind === "orderTriggers" && plan.reverseOrder)
      return choice.options.map((o) => o.optionId).reverse();
    return defaultPick(state);
  };
  const settle = (): boolean => {
    for (let guard = 0; session.state.pendingChoice; guard++) {
      if (guard > 100) throw new Error("choices did not settle");
      if (plan.stopAt?.(session.state)) return false;
      const choice = session.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      });
    }
    return true;
  };
  for (const command of commands) {
    apply(command);
    if (!settle()) break;
  }
  return { session, state: session.state, events, prompts };
}

/** Tries to answer the open choice with `optionId`, which it does not list. */
function force(session: GameSession, optionId: string) {
  const choice = session.state.pendingChoice!;
  const result = sessionApply(
    session,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: [optionId] },
    deps,
  );
  if (result.ok) throw new Error(`${optionId} was accepted`);
  return { code: result.error.code, message: result.error.message };
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** Every defense announced, in order. */
const defenses = (events: readonly GameEvent[]) =>
  of(events, "triggerEvent").flatMap((e) =>
    e.phase === "initiated" && e.event.kind === "defended"
      ? [{ defender: e.event.defenderInstanceId, basic: e.event.basic }]
      : [],
  );
const resolvedBy = (events: readonly GameEvent[], stub: typeof SHIELD) =>
  of(events, "abilityResolved")
    .filter((e) => e.abilityId === stub.ref.id)
    .map((e) => e.controllerId);
const attacksResolved = (events: readonly GameEvent[]) =>
  of(events, "attackResolved").map((e) => ({
    target: e.targetInstanceId,
    def: e.defenseReduction,
    dealt: e.damageDealt,
  }));
const damageOf = (state: GameState, id: InstanceId) => state.instances[id]?.damage ?? 0;
const handIds = (state: GameState, player: PlayerId) => mustPlayer(state, player).hand.map((id) => cardIdOf(state, id));
const promptsOf = (prompts: readonly Prompt[], player: PlayerId, kind = "chooseTriggers") =>
  prompts.filter((p) => p.player === player && p.kind === kind).map((p) => p.offered);
const isTriggerPromptFor = (player: PlayerId, nth = 1) => {
  let seen = 0;
  let last: string | null = null;
  return (state: GameState): boolean => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "chooseTriggers" || choice.playerId !== player) return false;
    if (choice.choiceId !== last) seen++;
    last = choice.choiceId;
    return seen === nth;
  };
};
const ALL = ["shield", "block", "watch"] as const;

describe("once a player resolves a (defense) ability, other players cannot for that attack (RRG 1.8 p. 15)", () => {
  it("the first player's (defense) event closes the attack to the second player's (defense) cards", () => {
    const s = setup({ hand: ["shield"] }, { hand: ["shield", "block"], play: ["watch"] });
    const { state, events, prompts } = drive(s, [attack(s)], { picks: { p1: ALL, p2: ALL } });
    expect(promptsOf(prompts, P1)).toEqual([["shield"]]);
    // In the window the first player answered first, then in the damage window: only the unlabeled support.
    expect(promptsOf(prompts, P2)).toEqual([["watch"], ["watch"]]);
    expect(resolvedBy(events, SHIELD)).toEqual([P1]);
    expect(resolvedBy(events, BLOCK)).toEqual([]);
    expect(handIds(state, P2)).toEqual(["shield", "block"]);
    expect(defenses(events)).toEqual([{ defender: s.hero(P1), basic: false }]);
    expect(attacksResolved(events)).toEqual([{ target: s.hero(P1), def: 0, dealt: 4 }]);
    expect(damageOf(state, s.hero(P1))).toBe(4);
    // Shield 1, Watch 100 + 100, the first player's "after you defend" 1000.
    expect(damageOf(state, s.villain)).toBe(1201);
  });

  it("a forced command for the barred card is refused with the reason, and the choice explains it", () => {
    const s = setup({ hand: ["shield"] }, { hand: ["shield", "block"], play: ["watch"] });
    const [shield, block] = s.hand(P2);
    const picks = { p1: ALL, p2: ALL };
    // The second player's first prompt: the first player's Shield is picked and still queued.
    const first = drive(s, [attack(s)], { picks, stopAt: isTriggerPromptFor(P2) });
    expect(choiceExclusions(first.state, deps)).toEqual([{ instanceId: shield, reason: "anotherPlayerUsedDefense" }]);
    expect(force(first.session, `${shield}:${SHIELD.ref.id}`)).toEqual({
      code: "invalid_choice",
      message: "another player already used a defense card for this attack",
    });
    // The second, in the damage window: the first player's hero is the defender.
    const second = drive(s, [attack(s)], { picks, stopAt: isTriggerPromptFor(P2, 2) });
    expect(defenseClaimOf(second.state)).toEqual({ defendingPlayerId: P1, labeledPlayerId: P1 });
    expect(defenseBarFor(second.state, P1)).toBeNull();
    expect(defenseBarFor(second.state, P2)).toBe("anotherPlayerDefending");
    expect(choiceExclusions(second.state, deps)).toEqual([{ instanceId: block, reason: "anotherPlayerDefending" }]);
    expect(force(second.session, `${block}:${BLOCK.ref.id}`)).toEqual({
      code: "invalid_choice",
      message: "another player is defending this attack",
    });
    // An option id that is nobody's card keeps the plain refusal.
    expect(force(second.session, "nothing").message).toBe("nothing is not an option");
  });

  it("the same player may resolve any number of (defense) abilities for the attack", () => {
    const s = setup({ hand: ["shield", "shield", "block"] }, { hand: ["block"] });
    const { state, events, prompts } = drive(s, [attack(s)], { picks: { p1: ALL, p2: ALL } });
    expect(promptsOf(prompts, P1)).toEqual([["shield", "shield"], ["block"]]);
    expect(promptsOf(prompts, P2)).toEqual([]);
    expect(resolvedBy(events, SHIELD)).toEqual([P1, P1]);
    expect(resolvedBy(events, BLOCK)).toEqual([P1]);
    // Three defense abilities, one defense: announced once, "after you defend" once.
    expect(defenses(events)).toEqual([{ defender: s.hero(P1), basic: false }]);
    expect(damageOf(state, s.villain)).toBe(1012);
    expect(handIds(state, P1)).toEqual([]);
    expect(handIds(state, P2)).toEqual(["block"]);
  });

  it("three players: the second player's (defense) event closes the attack to the first and the third", () => {
    const s = setup(
      { hand: ["shield", "block"] },
      { hand: ["shield"] },
      { hand: ["shield", "block"], play: ["watch"] },
    );
    const { state, events, prompts } = drive(s, [attack(s)], { picks: { p2: ALL, p3: ALL } });
    // The first player is asked first and passes; after the second player's pick the third is not offered a Shield.
    expect(promptsOf(prompts, P1)).toEqual([["shield"]]);
    expect(promptsOf(prompts, P2)).toEqual([["shield"]]);
    expect(promptsOf(prompts, P3)).toEqual([["watch"], ["watch"]]);
    expect(resolvedBy(events, SHIELD)).toEqual([P2]);
    expect(resolvedBy(events, BLOCK)).toEqual([]);
    // The second player's hero is the defender and the target; step 2 offers the attacked player only that hero.
    expect(promptsOf(prompts, P1, "declareDefender")).toEqual([["decline", HERO.id + "-p2"]]);
    expect(defenses(events)).toEqual([{ defender: s.hero(P2), basic: false }]);
    expect(attacksResolved(events)).toEqual([{ target: s.hero(P2), def: 0, dealt: 4 }]);
    expect([P1, P2, P3].map((p) => damageOf(state, s.hero(p)))).toEqual([0, 4, 0]);
    expect(damageOf(state, s.villain)).toBe(1201);
    expect(handIds(state, P1)).toEqual(["shield", "block"]);
    expect(handIds(state, P3)).toEqual(["shield", "block"]);
  });

  it.each([
    ["in the first player's order", false, P1],
    ["in the reverse order", true, P2],
  ] as const)(
    "two players' forced (defense) abilities for one attack: only the first ordered resolves (%s)",
    (_name, reverseOrder, winner) => {
      const s = setup({ play: ["guard"] }, { play: ["guard"] });
      const { state, events } = drive(s, [attack(s)], { reverseOrder });
      expect(resolvedBy(events, GUARD)).toEqual([winner]);
      expect(defenses(events)).toEqual([{ defender: s.hero(winner), basic: false }]);
      expect(attacksResolved(events)).toEqual([{ target: s.hero(winner), def: 0, dealt: 4 }]);
      expect(damageOf(state, s.villain)).toBe(1001);
    },
  );
});

describe("while a player is defending, other players cannot defend that attack (RRG 1.8 p. 14)", () => {
  it("the first player's hero makes a basic defense: the second player's (defense) card is not offered", () => {
    const s = setup({}, { hand: ["block"], play: ["watch"] });
    const plan = { picks: { p2: ALL }, defender: s.hero(P1) };
    const { state, events, prompts } = drive(s, [attack(s)], plan);
    expect(promptsOf(prompts, P2)).toEqual([["watch"], ["watch"]]);
    expect(resolvedBy(events, BLOCK)).toEqual([]);
    expect(handIds(state, P2)).toEqual(["block"]);
    expect(attacksResolved(events)).toEqual([{ target: s.hero(P1), def: 2, dealt: 2 }]);
    expect(damageOf(state, s.villain)).toBe(1200);
    const stopped = drive(s, [attack(s)], { ...plan, stopAt: isTriggerPromptFor(P2, 2) });
    expect(defenseClaimOf(stopped.state)).toEqual({ defendingPlayerId: P1, labeledPlayerId: null });
    const [block] = s.hand(P2);
    expect(choiceExclusions(stopped.state, deps)).toEqual([{ instanceId: block, reason: "anotherPlayerDefending" }]);
    expect(force(stopped.session, `${block}:${BLOCK.ref.id}`).message).toBe("another player is defending this attack");
  });

  it("another player's hero is not declared the defender by a card effect either", () => {
    const s = setup({}, { play: ["declareLate"] });
    const { state, events } = drive(s, [attack(s)], { defender: s.hero(P1) });
    expect(resolvedBy(events, DECLARE_LATE)).toEqual([P2]);
    expect(defenses(events)).toEqual([{ defender: s.hero(P1), basic: true }]);
    expect(attacksResolved(events)).toEqual([{ target: s.hero(P1), def: 2, dealt: 2 }]);
    expect(damageOf(state, s.hero(P1))).toBe(2);
    expect(damageOf(state, s.hero(P2))).toBe(0);
    expect(damageOf(state, s.villain)).toBe(1000);
  });

  it("a (defense) ability made the first player's hero the defender: no other player's character can be declared", () => {
    const s = setup({ hand: ["shield"], ally: true }, { ally: true });
    const stopAt = (state: GameState) => state.pendingChoice?.prompt.kind === "declareDefender";
    const { state, session } = drive(s, [attack(s)], { picks: { p1: ALL }, stopAt });
    expect(state.pendingChoice?.options.map((o) => o.optionId)).toEqual(["decline", s.hero(P1)]);
    // The first player's own ally: one defender per attack. The second player's characters: another player defends.
    expect(choiceExclusions(state, deps)).toEqual([
      { instanceId: s.ally(P1), reason: "defenderAlreadyDeclared" },
      { instanceId: s.hero(P2), reason: "anotherPlayerDefending" },
      { instanceId: s.ally(P2), reason: "anotherPlayerDefending" },
    ]);
    expect(force(session, s.hero(P2))).toEqual({
      code: "invalid_choice",
      message: "another player is defending this attack",
    });
    expect(force(session, s.ally(P1)!).message).toBe(`${s.ally(P1)} is not an option`);
  });

  it("a player whose ally is defending is defending: their own (defense) card is allowed, and nobody else's", () => {
    const s = setup({ hand: ["block"], ally: true }, { hand: ["block"], play: ["watch"] });
    const plan = { picks: { p1: ALL, p2: ALL }, defender: s.ally(P1) };
    const { state, events, prompts } = drive(s, [attack(s)], plan);
    expect(promptsOf(prompts, P1)).toEqual([["block"]]);
    expect(promptsOf(prompts, P2)).toEqual([["watch"], ["watch"]]);
    expect(resolvedBy(events, BLOCK)).toEqual([P1]);
    // "In that case, the player's identity does not become the defender": the ally stays it, and takes the attack.
    expect(defenses(events)).toEqual([{ defender: s.ally(P1), basic: true }]);
    expect(attacksResolved(events)).toEqual([{ target: s.ally(P1), def: 0, dealt: 4 }]);
    expect(damageOf(state, s.ally(P1)!)).toBe(4);
    expect(damageOf(state, s.hero(P1))).toBe(0);
    // Block 10 and Watch 100 + 100; no hero defended, so no "after you defend".
    expect(damageOf(state, s.villain)).toBe(210);
    expect(handIds(state, P2)).toEqual(["block"]);
    const stopped = drive(s, [attack(s)], { ...plan, stopAt: isTriggerPromptFor(P2, 2) });
    expect(defenseClaimOf(stopped.state)?.defendingPlayerId).toBe(P1);
    expect(defenseBarFor(stopped.state, P2)).toBe("anotherPlayerDefending");
  });

  it("the first player's hero defends an attack against the second player: the attacked player's (defense) card is out", () => {
    const s = setup({ hand: ["block"] }, { hand: ["block"], play: ["watch"] });
    const { state, events, prompts } = drive(s, [attack(s, P2)], {
      picks: { p1: ALL, p2: ALL },
      defender: s.hero(P1),
    });
    // The attacked player decides step 2, and chose the other player's hero.
    expect(promptsOf(prompts, P2, "declareDefender")).toEqual([["decline", HERO.id + "-p2", HERO.id]]);
    expect(promptsOf(prompts, P1)).toEqual([["block"]]);
    expect(promptsOf(prompts, P2)).toEqual([["watch"], ["watch"]]);
    expect(resolvedBy(events, BLOCK)).toEqual([P1]);
    // "The defending player becomes the new target of that attack."
    expect(attacksResolved(events)).toEqual([{ target: s.hero(P1), def: 2, dealt: 2 }]);
    expect(damageOf(state, s.hero(P1))).toBe(2);
    expect(damageOf(state, s.hero(P2))).toBe(0);
    expect(handIds(state, P2)).toEqual(["block"]);
    expect(damageOf(state, s.villain)).toBe(1210);
  });

  it("the attacked player's (defense) card before step 2 keeps the attack: the helper's hero is not offered", () => {
    const s = setup({}, { hand: ["shield"] });
    const stopAt = (state: GameState) => state.pendingChoice?.prompt.kind === "declareDefender";
    const { state, session } = drive(s, [attack(s, P2)], { picks: { p2: ALL }, stopAt });
    expect(state.pendingChoice?.playerId).toBe(P2);
    expect(state.pendingChoice?.options.map((o) => o.optionId)).toEqual(["decline", s.hero(P2)]);
    expect(choiceExclusions(state, deps)).toEqual([{ instanceId: s.hero(P1), reason: "anotherPlayerDefending" }]);
    expect(force(session, s.hero(P1)).message).toBe("another player is defending this attack");
  });
});

describe("the record ends with the attack", () => {
  it("the next attack starts clean: the other player may use a (defense) card for it", () => {
    const s = setup({ hand: ["shield"] }, { hand: ["shield"] });
    const first = drive(s, [attack(s)], { picks: { p1: ALL, p2: ALL } });
    expect(resolvedBy(first.events, SHIELD)).toEqual([P1]);
    expect(promptsOf(first.prompts, P2)).toEqual([]);
    expect(defenseClaimOf(first.state)).toBeNull();
    expect(defenseBarFor(first.state, P2)).toBeNull();
    const second = drive(first.session, [attack(s)], { picks: { p1: ALL, p2: ALL } });
    expect(promptsOf(second.prompts, P2)).toEqual([["shield"]]);
    expect(resolvedBy(second.events, SHIELD)).toEqual([P2]);
    expect(defenses(second.events)).toEqual([{ defender: s.hero(P2), basic: false }]);
    expect(attacksResolved(second.events)).toEqual([{ target: s.hero(P2), def: 0, dealt: 4 }]);
    expect(defenseClaimOf(second.state)).toBeNull();
  });
});

describe("a (defense) ability and a basic defense by the same hero are one defense (owner ruling 2026-10-06)", () => {
  it("the prompt path: the label announces the defense, exhausting at step 2 adds DEF and announces nothing", () => {
    const s = setup({ hand: ["shield"] });
    const { state, events } = drive(s, [attack(s)], { picks: { p1: ALL }, defender: s.hero(P1) });
    expect(defenses(events)).toEqual([{ defender: s.hero(P1), basic: false }]);
    expect(of(events, "defenderDeclared")).toHaveLength(1);
    expect(mustInstance(state, s.hero(P1)).exhausted).toBe(true);
    expect(attacksResolved(events)).toEqual([{ target: s.hero(P1), def: 2, dealt: 2 }]);
    // Shield 1 and "after you defend" once.
    expect(damageOf(state, s.villain)).toBe(1001);
  });

  it.each([
    ["the label first", false, false],
    ["the declaration first", true, true],
  ] as const)(
    "the effect path, 'declare your hero the defender', agrees: one announcement, DEF applied (%s)",
    (_name, reverseOrder, basic) => {
      const s = setup({ play: ["guard", "declareEarly"] });
      const { state, events, prompts } = drive(s, [attack(s)], { reverseOrder });
      expect(resolvedBy(events, GUARD)).toEqual([P1]);
      expect(resolvedBy(events, DECLARE_EARLY)).toEqual([P1]);
      // Announced by whichever made the hero the defender; the other adds to the same defense.
      expect(defenses(events)).toEqual([{ defender: s.hero(P1), basic }]);
      // A hero already making a basic defense leaves step 2 nothing to declare.
      expect(promptsOf(prompts, P1, "declareDefender")).toEqual([]);
      expect(attacksResolved(events)).toEqual([{ target: s.hero(P1), def: 2, dealt: 2 }]);
      expect(damageOf(state, s.villain)).toBe(1001);
    },
  );
});

describe("replay determinism", () => {
  const cases: readonly (readonly [string, readonly Seat[], PlayerId, "decline" | "p1Hero" | "p1Ally"])[] = [
    [
      "a (defense) event bars the other player",
      [{ hand: ["shield"] }, { hand: ["shield", "block"], play: ["watch"] }],
      P1,
      "decline",
    ],
    [
      "an ally defends",
      [
        { hand: ["block"], ally: true },
        { hand: ["block"], play: ["watch"] },
      ],
      P1,
      "p1Ally",
    ],
    ["defending for another player", [{ hand: ["block"] }, { hand: ["block"], play: ["watch"] }], P2, "p1Hero"],
    [
      "three players",
      [{ hand: ["shield"] }, { hand: ["shield"] }, { hand: ["block"], play: ["watch"] }],
      P1,
      "decline",
    ],
    ["two forced abilities", [{ play: ["guard"] }, { play: ["guard"] }], P1, "decline"],
    ["label then basic defense", [{ hand: ["shield"] }], P1, "p1Hero"],
  ];
  it.each(cases)("%s: the log replays to the same state", (_name, seats, against, answer) => {
    const s = setup(...seats);
    const defender = answer === "p1Hero" ? s.hero(P1) : answer === "p1Ally" ? s.ally(P1) : null;
    const { session } = drive(s, [attack(s, against), attack(s, against)], {
      picks: { p1: ALL, p2: ALL, p3: ALL },
      defender,
    });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
