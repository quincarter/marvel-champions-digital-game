/**
 * A "(defense)"-labeled ability used during an enemy attack that has no defender (owner ruling 2026-10-06,
 * docs/phase7-wave7.md §4.1). RRG 1.8 "Defend, Defense" (pp. 14-15): "When a player initiates a triggered ability
 * labeled as a defense … during an enemy attack, that player's identity becomes the defender and is considered to have
 * defended the attack if there is not already a defender", and "Resolving a defense-labeled ability is not a basic
 * defense and does not cause a hero to reduce the amount of damage dealt by that hero's DEF. That hero can still be
 * declared the defender of the attack during the 'Declare Defender' step or by another card ability."
 *
 * So the label alone never subtracts DEF, in either ordering:
 *  - used before step 2 (an interrupt to the attack): the hero is the defender, and step 2 still offers that hero,
 *    and only that hero, a basic defense. Exhausting there is what subtracts DEF; declining leaves DEF out.
 *  - used after step 2 was declined (an interrupt to the attack's damage): the hero becomes the defender, step 2 has
 *    passed and is not offered again, and DEF is never subtracted.
 *
 * Synthetic cards: the villain's ATK is 3, every boost card has 1 boost icon, each hero's DEF is 2. An undefended
 * attack therefore deals 4 and a basic defense leaves 2. The markers are damage on the villain: retaliate 1, "after
 * you defend" 10, "when you defend" 100, "after the villain attacks you" 1000 (each hero's own copy). Threat on the
 * main scheme marks the two "undefended" readers: 1 from the boost card as it is turned up (step 3), 5 from the
 * response after the attack.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubIdentity, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, seatIdentities } from "./testing/scenario.js";
import { copiesOf, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const ability = (id: string, definition: AbilityDefinition) => stubAbility(id, definition);
const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain = { kind: "named", name: "villain" } as const;
const theAlly = { kind: "named", name: "bodyguard" } as const;
const yourHero = { categories: ["hero"], controller: "you" } as const;
const yourIdentity = { categories: ["identity"], controller: "you" } as const;
const hitVillain = (amount: number) => ({ kind: "dealDamage", target: theVillain, amount: n(amount) }) as const;
const threat = (amount: number) =>
  ({ kind: "placeThreat", target: { kind: "mainScheme" }, amount: n(amount) }) as const;

/** "Interrupt (defense): When the villain attacks you, …" — before the Declare Defender step. */
const EARLY = ability("early.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
  },
  label: ["defense"],
  effects: [],
});
/** "Interrupt (defense): When an enemy attacks, …" — any player's attack, before the Declare Defender step. */
const EARLY_ANY = ability("early-any.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack" } },
  label: ["defense"],
  effects: [],
});
/** "Interrupt (defense): When you would take damage from an attack, prevent 1 of that damage." — after step 2. */
const LATE = ability("late.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "dealDamage", fromAttack: true, targetIs: yourIdentity },
  },
  label: ["defense"],
  effects: [{ kind: "preventDamage", amount: n(1) }],
});
/** "Interrupt (defense): When a character would take damage from an attack, …" — whoever takes it. */
const LATE_ANY = ability("late-any.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", fromAttack: true } },
  label: ["defense"],
  effects: [],
});
const AFTER_YOU_DEFEND = ability("after-you-defend.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "defended", targetIs: yourHero } },
  effects: [hitVillain(10)],
});
const WHEN_YOU_DEFEND = ability("when-you-defend.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "defended", targetIs: yourHero } },
  effects: [hitVillain(100)],
});
const AFTER_ATTACKS_YOU = ability("after-attacks-you.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "characterAttacked", targetIs: yourHero } },
  effects: [hitVillain(1000)],
});
/** "Forced Response: After the villain makes an undefended attack, place 5 threat on the main scheme." */
const AFTER_UNDEFENDED = ability("after-undefended.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "enemyAttack", requireResults: { undefended: 1 } } },
  effects: [threat(5)],
});
const ATTACK_ABILITY = ability("attack.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "controller" } }],
});
/** "Boost: If this attack is undefended, place 1 threat on the main scheme." */
const UNDEFENDED_BOOST = ability("undefended.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "if", condition: { kind: "currentAttack", key: "undefended", atLeast: 1 }, then: [threat(1)] }],
});
/** The redirect's shape: "Boost: The villain attacks [the ally] instead." */
const REDIRECT_BOOST = ability("redirect.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "retargetAttack", character: theAlly }],
});

const support = (id: string, stub: typeof EARLY) => stubSupport({ id, cost: 0, abilities: [stub.ref] });
const CARDS = {
  early: support("early", EARLY),
  earlyAny: support("early-any", EARLY_ANY),
  late: support("late", LATE),
  lateAny: support("late-any", LATE_ANY),
  afterYouDefend: support("after-you-defend", AFTER_YOU_DEFEND),
  whenYouDefend: support("when-you-defend", WHEN_YOU_DEFEND),
  afterAttacksYou: support("after-attacks-you", AFTER_ATTACKS_YOU),
  afterUndefended: support("after-undefended", AFTER_UNDEFENDED),
} as const;
type CardKey = keyof typeof CARDS;
const ATTACKER = support("attacker", ATTACK_ABILITY);
const BODYGUARD = stubAlly({ id: "bodyguard", cost: 0, atk: 1, thw: 1, hp: 3 });
const ICON = stubTreachery({ id: "icon", boostIcons: 1, starIcon: true, abilities: [UNDEFENDED_BOOST.ref] });
const REDIRECT = stubTreachery({ id: "redirect", boostIcons: 1, starIcon: true, abilities: [REDIRECT_BOOST.ref] });
const hero = (retaliate: boolean) =>
  stubIdentity({
    id: "hero",
    hp: 30,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    ...(retaliate ? { heroKeywords: [{ name: "retaliate", value: 1 }] as const } : {}),
  });

const deps: EngineDeps = depsOf(
  EARLY,
  EARLY_ANY,
  LATE,
  LATE_ANY,
  AFTER_YOU_DEFEND,
  WHEN_YOU_DEFEND,
  AFTER_ATTACKS_YOU,
  AFTER_UNDEFENDED,
  ATTACK_ABILITY,
  UNDEFENDED_BOOST,
  REDIRECT_BOOST,
);

interface Options {
  /** Supports in the first player's play area. */
  readonly p1?: readonly CardKey[];
  /** Supports in the second player's play area: makes it a two-player game. */
  readonly p2?: readonly CardKey[];
  readonly ally?: boolean;
  readonly overkill?: boolean;
  readonly retaliate?: boolean;
  readonly heroExhausted?: boolean;
  readonly boost?: typeof ICON;
}

function setup(options: Options) {
  const villain = stubVillain({
    id: "villain",
    stages: [{ hp: flat(9000), atk: 3, sch: 1, ...(options.overkill ? { keywords: [{ name: "overkill" }] } : {}) }],
  });
  const scheme = stubMainScheme({
    id: "main",
    stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(0) }],
  });
  const identities = seatIdentities(hero(options.retaliate ?? false), options.p2 ? 2 : 1);
  const all = Object.values(CARDS);
  const deck: readonly CardId[] = [...DEFAULT_DECK, ATTACKER.id, BODYGUARD.id, ...all.map((card) => card.id)];
  const created = createGame(
    {
      seed: 21,
      cards: [
        ...DEFAULT_CARDS.filter((card) => card.type !== "hero_identity"),
        ...identities,
        villain,
        scheme,
        ...all,
        ATTACKER,
        BODYGUARD,
        ICON,
        REDIRECT,
      ],
      villainCardId: villain.id,
      mainSchemeCardId: scheme.id,
      encounterDeck: copiesOf((options.boost ?? ICON).id, 30),
      players: identities.map((identity) => ({ identityCardId: identity.id, deck })),
    },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  let state = driveSession(startSession(created.state), deps).session.state;
  const attacker = playerCardIntoPlay(state, ATTACKER.id);
  state = attacker.state;
  for (const key of options.p1 ?? []) state = playerCardIntoPlay(state, CARDS[key].id, P1).state;
  for (const key of options.p2 ?? []) state = playerCardIntoPlay(state, CARDS[key].id, P2).state;
  let ally: InstanceId | null = null;
  if (options.ally) {
    const put = playerCardIntoPlay(state, BODYGUARD.id);
    state = put.state;
    ally = put.id;
  }
  // Test surgery, before the session starts: every hero in hero form.
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const heroOf = (player: PlayerId) => mustPlayer(state, player).identity.instanceId;
  if (options.heroExhausted) {
    const id = heroOf(P1);
    state = { ...state, instances: { ...state.instances, [id]: { ...mustInstance(state, id), exhausted: true } } };
  }
  return {
    state,
    attacker: attacker.id,
    hero: heroOf(P1),
    hero2: options.p2 ? heroOf(P2) : null,
    ally,
    villain: activeVillain(state).instanceId,
  };
}
type Setup = ReturnType<typeof setup>;

const attack = (s: Setup): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: s.attacker,
  abilityId: ATTACK_ABILITY.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

/** Runs the attack, answering each Declare Defender prompt with `defender` (default: decline), and records the prompts. */
function run(s: Setup, defender: InstanceId | null = null) {
  const prompts: string[][] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "declareDefender") return defaultPick(state);
    prompts.push(choice.options.map((o) => o.optionId));
    return [defender ?? "decline"];
  };
  const { session, events } = driveSession(startSession(s.state), deps, [attack(s)], pick);
  return { session, state: session.state, events, prompts };
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
const damageOf = (state: GameState, id: InstanceId) => state.instances[id]?.damage ?? 0;
const threatOf = (state: GameState) => state.instances[state.mainScheme.instanceId]?.threat ?? 0;
const resolved = (events: readonly GameEvent[]) => {
  const [only, ...rest] = of(events, "attackResolved");
  if (!only || rest.length > 0) throw new Error("expected exactly one attackResolved");
  return only;
};

describe("a (defense) ability used before the Declare Defender step (RRG 1.8 pp. 14-15)", () => {
  it("makes the hero the defender; step 2 then offers only that hero a basic defense, and declining applies no DEF", () => {
    const s = setup({ p1: ["early", "afterYouDefend", "afterUndefended"], ally: true });
    const { state, events, prompts } = run(s);
    // "While a hero is defending against an attack, other friendly characters cannot defend": the ready ally is out.
    expect(prompts).toEqual([["decline", s.hero]]);
    expect(defenses(events)).toEqual([{ defender: s.hero, basic: false }]);
    expect(resolved(events)).toMatchObject({ targetInstanceId: s.hero, defenseReduction: 0, damageDealt: 4 });
    expect(damageOf(state, s.hero)).toBe(4);
    expect(mustInstance(state, s.hero).exhausted).toBe(false);
    // Defended, so "after you defend" resolves (10) and neither "undefended" reader does.
    expect(damageOf(state, s.villain)).toBe(10);
    expect(threatOf(state)).toBe(0);
  });

  it("the same hero may still exhaust at step 2: DEF applies because of that basic defense, and it is one defense", () => {
    const s = setup({ p1: ["early", "afterYouDefend", "afterUndefended"] });
    const { state, events, prompts } = run(s, s.hero);
    expect(prompts).toEqual([["decline", s.hero]]);
    expect(resolved(events)).toMatchObject({ targetInstanceId: s.hero, defenseReduction: 2, damageDealt: 2 });
    expect(damageOf(state, s.hero)).toBe(2);
    expect(mustInstance(state, s.hero).exhausted).toBe(true);
    expect(threatOf(state)).toBe(0);
    // Owner ruling 2026-10-06: "it is still one defender / attack-defense state, not two separate defenses". The
    // defense is announced once, as the ability makes the hero the defender; the basic defense at step 2 adds DEF to
    // it. So a forced "after you defend" resolves once (10), and the step is still logged as a declared defender.
    expect(defenses(events)).toEqual([{ defender: s.hero, basic: false }]);
    expect(of(events, "defenderDeclared")).toHaveLength(1);
    expect(damageOf(state, s.villain)).toBe(10);
  });

  it("an exhausted hero is the defender with no prompt at all, and takes the whole attack", () => {
    const s = setup({ p1: ["early", "afterYouDefend", "afterUndefended"], ally: true, heroExhausted: true });
    const { state, events, prompts } = run(s);
    expect(prompts).toEqual([]);
    expect(defenses(events)).toEqual([{ defender: s.hero, basic: false }]);
    expect(resolved(events)).toMatchObject({ targetInstanceId: s.hero, defenseReduction: 0, damageDealt: 4 });
    expect(damageOf(state, s.hero)).toBe(4);
    expect(damageOf(state, s.villain)).toBe(10);
    expect(threatOf(state)).toBe(0);
  });

  it("'when you defend' interrupts and 'after the villain attacks you' responses read the hero", () => {
    const s = setup({ p1: ["early", "whenYouDefend", "afterAttacksYou"], retaliate: true });
    const { state, events } = run(s);
    expect(defenses(events)).toEqual([{ defender: s.hero, basic: false }]);
    // When you defend 100, after the villain attacks you 1000, retaliate 1.
    expect(damageOf(state, s.villain)).toBe(1101);
    expect(damageOf(state, s.hero)).toBe(4);
  });

  it("another player's (defense) ability makes that player's hero the defender and the attack's target", () => {
    const s = setup({
      p2: ["earlyAny", "afterYouDefend", "afterAttacksYou"],
      p1: ["afterAttacksYou"],
      retaliate: true,
    });
    const { state, events, prompts } = run(s);
    // Only the hero already defending may still make a basic defense.
    expect(prompts).toEqual([["decline", s.hero2]]);
    expect(defenses(events)).toEqual([{ defender: s.hero2, basic: false }]);
    expect(resolved(events)).toMatchObject({ targetInstanceId: s.hero2, defenseReduction: 0, damageDealt: 4 });
    expect(damageOf(state, s.hero)).toBe(0);
    expect(damageOf(state, s.hero2!)).toBe(4);
    // The second player's "after you defend" (10) and "after the villain attacks you" (1000), and its retaliate (1);
    // the first player's "attacks you" response does not resolve.
    expect(damageOf(state, s.villain)).toBe(1011);
  });
});

describe("a (defense) ability used after the Declare Defender step was declined (owner ruling 2026-10-06)", () => {
  it("makes the hero the defender, subtracts no DEF, and step 2 is not offered again", () => {
    const s = setup({ p1: ["late", "afterYouDefend", "afterUndefended"] });
    const { state, events, prompts } = run(s);
    expect(prompts).toEqual([["decline", s.hero]]);
    expect(of(events, "defenseDeclined")).toHaveLength(1);
    expect(defenses(events)).toEqual([{ defender: s.hero, basic: false }]);
    // ATK 3 + 1 boost icon dealt with no DEF; the ability's own "prevent 1" leaves 3.
    expect(resolved(events)).toMatchObject({ targetInstanceId: s.hero, defenseReduction: 0, damageDealt: 4 });
    expect(damageOf(state, s.hero)).toBe(3);
    expect(mustInstance(state, s.hero).exhausted).toBe(false);
    expect(damageOf(state, s.villain)).toBe(10);
  });

  it("the attack was undefended while its boost card was turned up (step 3), and is defended once it has resolved", () => {
    const s = setup({ p1: ["late", "afterUndefended"] });
    const { state } = run(s);
    // The boost card's "if this attack is undefended" placed 1; the response to an undefended attack placed nothing.
    expect(threatOf(state)).toBe(1);
  });

  it("control: with no (defense) ability the declined attack is undefended throughout", () => {
    const s = setup({ p1: ["afterYouDefend", "afterUndefended"] });
    const { state, events } = run(s);
    expect(defenses(events)).toEqual([]);
    expect(damageOf(state, s.hero)).toBe(4);
    expect(damageOf(state, s.villain)).toBe(0);
    expect(threatOf(state)).toBe(6);
  });

  it("'when you defend', 'after the villain attacks you' and retaliate read the hero as the defender", () => {
    const s = setup({ p1: ["late", "whenYouDefend", "afterAttacksYou"], retaliate: true });
    const { state, events } = run(s);
    expect(defenses(events)).toEqual([{ defender: s.hero, basic: false }]);
    expect(damageOf(state, s.villain)).toBe(1101);
    expect(damageOf(state, s.hero)).toBe(3);
  });

  it("a hero who made a basic defense and then uses a (defense) ability: DEF applies once, one defense", () => {
    const s = setup({ p1: ["late", "afterYouDefend", "afterUndefended"] });
    const { state, events, prompts } = run(s, s.hero);
    expect(prompts).toEqual([["decline", s.hero]]);
    expect(defenses(events)).toEqual([{ defender: s.hero, basic: true }]);
    // ATK 3 + 1 boost icon − DEF 2 = 2 dealt, 1 of it prevented.
    expect(resolved(events)).toMatchObject({ targetInstanceId: s.hero, defenseReduction: 2, damageDealt: 2 });
    expect(damageOf(state, s.hero)).toBe(1);
    expect(damageOf(state, s.villain)).toBe(10);
    expect(threatOf(state)).toBe(0);
  });
});

describe("a (defense) ability while another character is already defending (RRG 1.8 p. 15)", () => {
  it("your ally defends: your hero does not become the defender, and overkill spills to it", () => {
    const s = setup({ p1: ["lateAny", "afterYouDefend"], ally: true, overkill: true });
    const { state, events } = run(s, s.ally);
    expect(defenses(events)).toEqual([{ defender: s.ally, basic: true }]);
    expect(resolved(events)).toMatchObject({ targetInstanceId: s.ally, defenseReduction: 0, damageDealt: 4 });
    // 4 damage into a 3-hit-point defending ally: 1 excess to its controller's identity (RRG "Overkill", p. 31).
    expect(cardsInPlay(state)).not.toContain(s.ally);
    expect(damageOf(state, s.hero)).toBe(1);
    expect(damageOf(state, s.villain)).toBe(0);
  });

  it("another player's hero made a basic defense: a different player's (defense) ability is not resolved at all", () => {
    const s = setup({ p1: ["lateAny", "afterYouDefend"], p2: ["afterYouDefend"] });
    const { state, events } = run(s, s.hero2);
    // "While a player is defending, other players cannot defend against that same attack" (p. 14): the first
    // player's forced "(defense)" interrupt to the damage is not initiated (`defense-cross-player.test.ts`).
    expect(of(events, "abilityResolved").filter((e) => e.abilityId === LATE_ANY.ref.id)).toEqual([]);
    expect(defenses(events)).toEqual([{ defender: s.hero2, basic: true }]);
    expect(resolved(events)).toMatchObject({ targetInstanceId: s.hero2, defenseReduction: 2, damageDealt: 2 });
    expect(damageOf(state, s.hero2!)).toBe(2);
    expect(damageOf(state, s.hero)).toBe(0);
    // Only the second player's "after you defend".
    expect(damageOf(state, s.villain)).toBe(10);
  });
});

describe("a redirect of the attack after a (defense) ability made the hero the defender", () => {
  it("does not retarget: the hero stays the defender and takes the attack", () => {
    const s = setup({ p1: ["early"], ally: true, heroExhausted: true, boost: REDIRECT });
    const { state, events } = run(s);
    expect(of(events, "attackRetargeted")).toEqual([]);
    expect(resolved(events)).toMatchObject({ targetInstanceId: s.hero, defenseReduction: 0, damageDealt: 4 });
    expect(damageOf(state, s.hero)).toBe(4);
    expect(cardsInPlay(state)).toContain(s.ally);
  });

  it("control: with no defender the same redirect moves the attack onto the ally", () => {
    const s = setup({ ally: true, heroExhausted: true, boost: REDIRECT });
    const { state, events } = run(s);
    expect(of(events, "attackRetargeted")).toHaveLength(1);
    expect(resolved(events)).toMatchObject({ targetInstanceId: s.ally, damageDealt: 4 });
    expect(damageOf(state, s.hero)).toBe(0);
  });
});

describe("replay determinism", () => {
  const cases: readonly (readonly [string, Options, "decline" | "hero"])[] = [
    ["before step 2, declined", { p1: ["early", "afterYouDefend", "afterUndefended"], ally: true }, "decline"],
    ["before step 2, basic defense", { p1: ["early", "afterYouDefend"] }, "hero"],
    [
      "after declining",
      { p1: ["late", "whenYouDefend", "afterAttacksYou", "afterUndefended"], retaliate: true },
      "decline",
    ],
    ["another player's ability", { p2: ["earlyAny", "afterYouDefend"], p1: ["afterAttacksYou"] }, "decline"],
  ];
  it.each(cases)("%s: the log replays to the same state", (_name, options, answer) => {
    const s = setup(options);
    const { session } = run(s, answer === "hero" ? s.hero : null);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
