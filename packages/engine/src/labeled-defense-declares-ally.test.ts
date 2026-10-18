/**
 * A "(defense)"-labeled ability that declares another character the defender. RRG 1.8 FAQ "Mutant Protectors (#17)"
 * (p. 63): "When a player plays Mutant Protectors, that player becomes the target of the enemy attack and the X-Men
 * ally put into play becomes the defender. If the defending ally leaves play before damage is dealt for the attack,
 * the player's hero becomes the defender and can trigger 'after you defend' responses after the attack resolves.
 * (This is not a basic defense, and the villain's attack is not reduced by the hero's DEF.)"
 *
 * Synthetic cards: the villain's ATK is 3, each boost card has 1 boost icon, the hero's DEF is 2, the ally has 3 hit
 * points.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, resolvePending, RESOURCE, runWith, settle, settleUntil } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ability = (id: string, definition: AbilityDefinition) => stubAbility(id, definition);
const theVillain = { kind: "named", name: "villain" } as const;
const theAlly = { kind: "named", name: "bodyguard" } as const;
const yourIdentity = { kind: "identityOf", player: { kind: "controller" } } as const;
const yourHero = { categories: ["hero"], controller: "you" } as const;
const whenAttacked = { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true } as const;
const one = { kind: "const", value: 1 } as const;

/** Mutant Protectors's shape: "Interrupt (defense): When an enemy attacks, exhaust [the ally] and declare it the defender." */
const PROTECTORS = ability("protectors.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: whenAttacked },
  label: ["defense"],
  effects: [{ kind: "declareDefender", character: theAlly, exhaust: true }],
});
/** Shieldmaiden's shape: "Interrupt (defense): When an enemy attacks, declare your hero the defender." */
const SHIELD = ability("shield.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: whenAttacked },
  label: ["defense"],
  effects: [{ kind: "declareDefender", character: yourIdentity }],
});
/** "Forced Response: After your hero defends against an attack, deal 1 damage to the villain." */
const AFTER_YOU_DEFEND = ability("after-you-defend.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "defended", targetIs: yourHero } },
  effects: [{ kind: "dealDamage", target: theVillain, amount: one }],
});
/** "Action: the villain attacks you." */
const ATTACK_ABILITY = ability("attack.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "controller" } }],
});
/** "Boost: Deal 5 damage to [the ally]." */
const CRUSH = ability("crush.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "dealDamage", target: theAlly, amount: { kind: "const", value: 5 } }],
});

const support = (id: string, stub: typeof ATTACK_ABILITY) => stubSupport({ id, cost: 0, abilities: [stub.ref] });
const CARDS = {
  protectors: support("protectors", PROTECTORS),
  shield: support("shield", SHIELD),
  afterYouDefend: support("after-you-defend", AFTER_YOU_DEFEND),
} as const;
const ATTACKER = support("attacker", ATTACK_ABILITY);
const BODYGUARD = stubAlly({ id: "bodyguard", cost: 0, atk: 1, thw: 1, hp: 3 });
const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });
const CRUSHER = stubTreachery({ id: "crusher", boostIcons: 1, starIcon: true, abilities: [CRUSH.ref] });

const deps: EngineDeps = depsOf(PROTECTORS, SHIELD, AFTER_YOU_DEFEND, ATTACK_ABILITY, CRUSH);

interface Options {
  readonly inPlay: readonly (keyof typeof CARDS)[];
  readonly ally?: boolean;
  readonly boost?: typeof ONE_ICON;
}

function setup(options: Options) {
  const villain = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 3, sch: 1 }] });
  const scheme = stubMainScheme({
    id: "main",
    stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
  });
  const supports = options.inPlay.map((key) => CARDS[key]);
  const boost = options.boost ?? ONE_ICON;
  let state = gameAtFirstTurn({
    cards: [...Object.values(CARDS), ATTACKER, BODYGUARD, ONE_ICON, CRUSHER],
    deps,
    villain,
    mainScheme: scheme,
    deck: [ATTACKER.id, BODYGUARD.id, ...supports.map((card) => card.id)],
    encounter: copiesOf(boost.id, 30),
  });
  const attacker = playerCardIntoPlay(state, ATTACKER.id);
  state = attacker.state;
  for (const card of supports) state = playerCardIntoPlay(state, card.id).state;
  let ally: InstanceId | null = null;
  if (options.ally !== false) {
    const put = playerCardIntoPlay(state, BODYGUARD.id);
    state = put.state;
    ally = put.id;
  }
  if (mustPlayer(state, P1).identity.form !== "hero")
    state = runWith(deps, state, { type: "changeForm", playerId: P1 });
  const hero = mustPlayer(state, P1).identity.instanceId;
  return { state, attacker: attacker.id, hero, ally, villain: activeVillain(state).instanceId };
}
type Setup = ReturnType<typeof setup>;

const attack = (s: Setup): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: s.attacker,
  abilityId: ATTACK_ABILITY.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});
const defendingWith =
  (id: InstanceId) =>
  (state: GameState): readonly string[] =>
    state.pendingChoice?.prompt.kind === "declareDefender" ? [id] : defaultPick(state);
const run = (s: Setup, pick = defaultPick) => driveSession(startSession(s.state), deps, [attack(s)], pick);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** Every defense announced, in order. */
const defenses = (events: readonly GameEvent[]) =>
  of(events, "triggerEvent").flatMap((e) =>
    e.phase === "initiated" && e.event.kind === "defended"
      ? [{ defender: e.event.defenderInstanceId, basic: e.event.basic }]
      : [],
  );
const damageOf = (state: GameState, id: InstanceId) => state.instances[id]?.damage ?? 0;

describe("RRG 1.8 FAQ 'Mutant Protectors (#17)' (p. 63): a (defense) ability that declares an ally the defender", () => {
  it("only the ally is announced as the defender: the hero's 'after you defend' does not trigger", () => {
    const s = setup({ inPlay: ["protectors", "afterYouDefend"] });
    const { session, events } = run(s);
    expect(defenses(events)).toEqual([{ defender: s.ally, basic: false }]);
    expect(of(events, "attackResolved")).toEqual([
      expect.objectContaining({ targetInstanceId: s.ally, defenseReduction: 0, damageDealt: 4 }),
    ]);
    expect(of(events, "cardExhausted")).toContainEqual(expect.objectContaining({ instanceId: s.ally }));
    expect(damageOf(session.state, s.hero)).toBe(0);
    expect(damageOf(session.state, s.villain)).toBe(0);
    // The ally (3 hit points) took the 4 damage and was defeated.
    expect(cardsInPlay(session.state)).not.toContain(s.ally);
  });

  it("the defending ally leaves play before damage: the hero becomes the defender, not a basic defense (no DEF)", () => {
    const s = setup({ inPlay: ["protectors", "afterYouDefend"], boost: CRUSHER });
    const { session, events } = run(s);
    expect(defenses(events)).toEqual([
      { defender: s.ally, basic: false },
      { defender: s.hero, basic: false },
    ]);
    expect(of(events, "defenderLeftPlay")).toEqual([
      {
        type: "defenderLeftPlay",
        enemyInstanceId: s.villain,
        defenderInstanceId: s.ally,
        targetInstanceId: s.hero,
        heroDefends: true,
      },
    ]);
    // ATK 3 + 1 boost icon, not reduced by the hero's DEF 2.
    expect(of(events, "attackResolved")).toEqual([
      expect.objectContaining({ targetInstanceId: s.hero, defenseReduction: 0, damageDealt: 4 }),
    ]);
    expect(damageOf(session.state, s.hero)).toBe(4);
  });

  it("the hero's 'after you defend' response triggers, after the attack resolves", () => {
    const s = setup({ inPlay: ["protectors", "afterYouDefend"], boost: CRUSHER });
    const { session, events } = run(s);
    expect(damageOf(session.state, s.villain)).toBe(1);
    const resolved = events.findIndex((e) => e.type === "attackResolved");
    const answered = events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === s.villain);
    expect(resolved).toBeGreaterThan(-1);
    expect(answered).toBeGreaterThan(resolved);
  });

  it("control (RRG 1.8 p. 9 step 5): an ally declared at the defender prompt that leaves play leaves the attack undefended", () => {
    const s = setup({ inPlay: ["afterYouDefend"], boost: CRUSHER });
    const { session, events } = run(s, defendingWith(s.ally!));
    expect(defenses(events)).toEqual([{ defender: s.ally, basic: true }]);
    expect(of(events, "defenderLeftPlay")).toEqual([
      { type: "defenderLeftPlay", enemyInstanceId: s.villain, defenderInstanceId: s.ally, targetInstanceId: s.hero },
    ]);
    expect(damageOf(session.state, s.hero)).toBe(4);
    expect(damageOf(session.state, s.villain)).toBe(0);
  });

  it("with no character to declare, the label makes the hero the defender as before", () => {
    const s = setup({ inPlay: ["protectors", "afterYouDefend"], ally: false });
    const { session, events } = run(s);
    expect(defenses(events)).toEqual([{ defender: s.hero, basic: false }]);
    expect(damageOf(session.state, s.hero)).toBe(4);
    expect(damageOf(session.state, s.villain)).toBe(1);
  });

  it("RRG 1.8 'Defend, Defense' (p. 15): an ability that declares the hero itself announces one defense, a basic one", () => {
    const s = setup({ inPlay: ["shield", "afterYouDefend"] });
    const { session, events } = run(s);
    expect(defenses(events)).toEqual([{ defender: s.hero, basic: false }]);
    // "That hero is considered to be making a basic defense": DEF 2 comes off ATK 3 + 1 boost icon.
    expect(of(events, "attackResolved")).toEqual([
      expect.objectContaining({ targetInstanceId: s.hero, defenseReduction: 2, damageDealt: 2 }),
    ]);
    expect(damageOf(session.state, s.villain)).toBe(1);
  });

  it("replays to the same state", () => {
    const s = setup({ inPlay: ["protectors", "afterYouDefend"], boost: CRUSHER });
    const { session } = run(s);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

/**
 * RRG 1.8 "Defend, Defense" (p. 15): "While a hero is defending against an attack, other friendly characters cannot
 * defend against that attack" and the same for a defending ally. FFG ruling, Alex, Jul 19, 2023 (post-RRG 1.5 #49):
 * "since your hero is already defending the attack, the ally put into play with Mutant Protectors cannot defend that
 * attack. (The rules of defending are strict on this; once one character defends, only that character can defend the
 * attack unless that character leaves play before the attack finishes.)" The engine bars only another
 * PLAYER's characters (`defenseBarFor`); a second declaration by the same player replaces the defender
 * (`declareDefenderByEffect`, `resolve/enemy-activation.ts`).
 */
describe("a second character declared the defender of an attack that already has one (same player)", () => {
  const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
  const ALLY_A = stubAlly({ id: "ally-a", cost: 0, atk: 1, thw: 1, hp: 9 });
  const ALLY_B = stubAlly({ id: "ally-b", cost: 0, atk: 1, thw: 1, hp: 9 });
  const declare = (id: string, name: string) =>
    stubAbility(id, {
      trigger: {
        kind: "interrupt",
        forced: true,
        on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
      },
      label: ["defense"],
      effects: [{ kind: "declareDefender", character: { kind: "each", query: { categories: ["ally"], name } } }],
    });
  // "Hero Interrupt (defense): When an enemy attacks you, declare an ally you control the defender" (Mutant Protectors' shape).
  const DECLARE_A = declare("declare-a", ALLY_A.name);
  const DECLARE_B = declare("declare-b", ALLY_B.name);
  const CARD_A = stubSupport({ id: "card-a", cost: 0, abilities: [DECLARE_A.ref] });
  const CARD_B = stubSupport({ id: "card-b", cost: 0, abilities: [DECLARE_B.ref] });
  // "Hero Interrupt (defense): When an enemy attacks you, ..." with no further text: the label alone makes the hero the defender.
  const GUARD = stubAbility("guard", {
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
    },
    label: ["defense"],
    effects: [],
  });
  const GUARD_CARD = stubSupport({ id: "guard", cost: 0, abilities: [GUARD.ref] });
  const deps = depsOf(DECLARE_A, DECLARE_B, GUARD);

  function stage(cards: readonly (typeof CARD_A | typeof GUARD_CARD)[]) {
    const scheme = stubMainScheme({
      id: "scheme",
      stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
    });
    const start = newGame({
      villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 4, sch: 0 }] }),
      mainScheme: scheme,
      extraCards: [BLANK, ALLY_A, ALLY_B, CARD_A, CARD_B, GUARD_CARD],
      deck: [
        ...copiesOf(ALLY_A.id, 2),
        ...copiesOf(ALLY_B.id, 2),
        ...cards.map((c) => c.id),
        ...copiesOf(RESOURCE.id, 8),
      ],
      encounterDeck: copiesOf(BLANK.id, 20),
      deps,
    });
    const given = giveCards(start, P1, ALLY_A.id, ALLY_B.id, ...cards.map((c) => c.id));
    const [allyA, allyB, ...rest] = given.ids as InstanceId[];
    const playCard = (id: InstanceId): Command => ({
      type: "playCard",
      playerId: P1,
      cardInstanceId: id,
      payment: [],
      attachToInstanceId: null,
    });
    const inPlay = runWith(
      deps,
      given.state,
      { type: "changeForm", playerId: P1 },
      playCard(allyA!),
      playCard(allyB!),
      ...rest.map(playCard),
      { type: "endTurn", playerId: P1 },
    );
    return { inPlay, allyA: allyA!, allyB: allyB!, rest };
  }

  /** Orders the two forced interrupts `first`, `second`, then declines any defender prompt. */
  function finish(t: ReturnType<typeof stage>, order: readonly string[]): GameState {
    const ordering = settleUntil(t.inPlay, "orderTriggers", deps);
    expect(ordering.pendingChoice?.prompt.kind).toBe("orderTriggers");
    const ordered = resolvePending(ordering, order, deps);
    return settle(ordered, undefined, deps);
  }

  it.fails("Mutant Protectors twice: the first ally declared stays the defender (FFG ruling Jul 19, 2023, post-RRG 1.5 #49)", () => {
    const t = stage([CARD_A, CARD_B]);
    const [cardA, cardB] = t.rest as [InstanceId, InstanceId];
    const after = finish(t, [`${cardA}:declare-a`, `${cardB}:declare-b`]);
    const hurt = (id: InstanceId) => mustInstance(after, id).damage;
    // Actual: ally B took the attack (the second declaration replaced the defender); ally A took nothing.
    expect(hurt(t.allyA)).toBe(4);
    expect(hurt(t.allyB)).toBe(0);
  });

  it.fails("a (defense) ability makes the hero the defender, then an ally is declared: the hero stays (post-RRG 1.5 #49 item 4)", () => {
    const t = stage([GUARD_CARD, CARD_A]);
    const [guardId, cardA] = t.rest as [InstanceId, InstanceId];
    const after = finish(t, [`${guardId}:guard`, `${cardA}:declare-a`]);
    const hero = mustPlayer(after, P1).identity.instanceId;
    // Actual: ally A is the defender and takes the 4; the hero, already defending, should have taken it.
    expect(mustInstance(after, t.allyA).damage).toBe(0);
    expect(mustInstance(after, hero).damage).toBe(4);
  });
});
