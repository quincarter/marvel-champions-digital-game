/**
 * The attack in progress as a Preparation reads it, and the villain's Forced Interrupt (docs/phase7-wave9.md §3.4).
 * Synthetic cards shaped like Black Widow's villain card and her set's Preparation abilities: "Prevent all damage from
 * this attack", "put this card into play engaged with you; resolve this attack against it instead", and the response
 * that reads whether a Preparation resolved.
 *
 * MC50 rulebook p. 9: "When a hero or ally attacks Black Widow (including with attack-labeled abilities), before that
 * attack is resolved, Black Widow's ability removes threat from the main scheme. If no threat is removed, then the rest
 * of her ability does not resolve. Otherwise, the attacking player discards the top card of the encounter deck and
 * resolves any 'Preparation' ability on the discarded card before resolving the attack. Damage dealt to Black Widow
 * that does not come from an attack does not trigger her 'Forced Interrupt.'" RRG 1.8 "Prevent" (p. 35); "Attack
 * (Player Ability Type)" (p. 10): "An ability labeled as an attack is considered a single attack, even if that attack
 * deals multiple instances of damage"; "Retaliate X" (p. 38); "Crisis Icon" (p. 14): "Abilities on encounter cards are
 * not affected by the crisis icon"; "Stun, Stunned" (p. 41); "Guard" (p. 21). Ruling January 17, 2026 - Ruling 2:
 * "A.I.M. Grunt is now being attacked by Arm Block, taking the 3 damage." Owner decision §4.1 Q4 = A: "this attack"
 * in a Preparation, when the attack has several targets, is the whole attack.
 */

import type { AnyCard } from "@mc/content";
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import { GRANTED_BY_SLOT, labeledResolvedVar, type AbilityDefinition, type EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import { attackPreventedVars } from "./stack.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubAttachment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const self: TargetRef = { kind: "self" };
const mainScheme: TargetRef = { kind: "mainScheme" };
/** "The attacking character": the source of the attack the Preparation resolves in, and of the attack that ended. */
const attacker: TargetRef = { kind: "eventSource" };
const record = (counterType: string, amount: ValueSpec = n(1)): EffectSpec => ({
  kind: "addCounters",
  target: mainScheme,
  counterType,
  amount,
});
const PREVENTED = attackPreventedVars("prevented");
const preparationResolved: Predicate = {
  kind: "eventResultAtLeast",
  key: labeledResolvedVar("preparation"),
  amount: 1,
};

// --- The villain ---------------------------------------------------------------------------------------------------

/**
 * "Forced Interrupt: When a character attacks [this villain], remove 1 threat from the main scheme. If threat was
 * removed this way, the attacking player discards the top card of the encounter deck and resolves each 'Preparation'
 * ability on that card."
 */
const WIDOW_INTERRUPT = stubAbility("widow.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", selfIs: "target" } },
  effects: [
    { kind: "removeThreat", target: mainScheme, amount: n(1), bind: "removed" },
    {
      kind: "if",
      condition: { kind: "varAtLeast", name: "removed.amount", amount: 1 },
      then: [
        { kind: "discardEncounterCards", count: n(1), bind: "top" },
        { kind: "resolveSpecials", of: slot("top"), trigger: "preparation", bind: "prep" },
      ],
    },
  ],
} satisfies AbilityDefinition);
/** The villain has retaliate 1 (as with her Gauntlet attached). */
const WIDOW_RETALIATE = stubAbility("widow.constant", {
  trigger: {
    kind: "constant",
    keywordGrants: [{ keyword: { name: "retaliate", value: 1 }, target: { self: true } }],
  },
  effects: [],
} satisfies AbilityDefinition);
/**
 * "Response: After [this villain] is attacked, if no 'Preparation' ability was resolved, [mark it]" (the Gauntlet's
 * condition, read off the attack that just finished).
 */
const WIDOW_NO_PREPARATION = stubAbility("widow.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "attack", selfIs: "target" } },
  effects: [
    {
      kind: "if",
      condition: { kind: "not", of: preparationResolved },
      then: [record("noPreparation")],
      otherwise: [record("preparationResolved")],
    },
  ],
} satisfies AbilityDefinition);
const WIDOW = stubVillain({
  id: "widow",
  stages: [
    {
      hp: flat(30),
      atk: 2,
      sch: 1,
      abilities: [WIDOW_INTERRUPT.ref, WIDOW_RETALIATE.ref, WIDOW_NO_PREPARATION.ref],
    },
  ],
});
const WEB = stubMainScheme({
  id: "web",
  stages: [{ startingThreat: flat(4), targetThreat: flat(90), acceleration: flat(1) }],
});

// --- The encounter cards -------------------------------------------------------------------------------------------

/** "Preparation: Prevent all damage from this attack. After this attack, deal that much damage to the attacking character." */
const ACRO_PREPARATION = stubAbility("acro.preparation", {
  trigger: { kind: "preparation" },
  effects: [
    { kind: "modifyAttack", preventAllDamage: true, bind: "prevented" },
    {
      kind: "atEndOfAttack",
      effects: [
        { kind: "dealDamage", target: attacker, amount: { kind: "eventResult", key: PREVENTED.amount } },
        record("preventedFlag", { kind: "eventResult", key: PREVENTED.prevented }),
        record("preventedAmount", { kind: "eventResult", key: PREVENTED.amount }),
        record("preventedTotal", { kind: "eventResult", key: PREVENTED.total }),
      ],
    },
  ],
} satisfies AbilityDefinition);
const ACRO = stubTreachery({ id: "acro", boostIcons: 0, abilities: [ACRO_PREPARATION.ref] });

/** "Preparation: Put this card into play engaged with you. Resolve this attack against this card instead." */
const GRUNT_PREPARATION = stubAbility("grunt.preparation", {
  trigger: { kind: "preparation" },
  effects: [
    { kind: "putIntoPlay", card: self, controller: { kind: "controller" } },
    { kind: "retargetAttack", attack: "player", character: self },
  ],
} satisfies AbilityDefinition);
const GRUNT = stubMinion({
  id: "grunt",
  atk: 1,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [{ name: "guard" }],
  abilities: [GRUNT_PREPARATION.ref],
});

/** "Preparation: Place 1 threat on the main scheme." */
const OPS_PREPARATION = stubAbility("ops.preparation", {
  trigger: { kind: "preparation" },
  effects: [{ kind: "placeThreat", target: mainScheme, amount: n(1) }],
} satisfies AbilityDefinition);
const OPS = stubTreachery({ id: "ops", boostIcons: 0, abilities: [OPS_PREPARATION.ref] });

/**
 * "Attach to [the villain]. Each encounter card without a printed 'Preparation' ability gains 'Preparation: Prevent
 * all damage from this attack. Then, discard Goggles.'" (`RuleSpec grantsLabeledAbility`, §3.3)
 */
const GOGGLES_GRANTED = stubAbility("goggles.granted-preparation", {
  trigger: { kind: "preparation" },
  effects: [
    { kind: "modifyAttack", preventAllDamage: true, bind: "prevented" },
    { kind: "discardFromPlay", target: slot(GRANTED_BY_SLOT) },
  ],
} satisfies AbilityDefinition);
const GOGGLES_CONSTANT = stubAbility("goggles.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "grantsLabeledAbility",
        label: "preparation",
        to: "encounterCardsWithoutPrinted",
        abilityId: GOGGLES_GRANTED.ref.id,
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
const GOGGLES = stubAttachment({
  id: "goggles",
  name: "Goggles",
  attachesTo: { kind: "villain" },
  abilities: [GOGGLES_CONSTANT.ref],
});

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const CRISIS = stubSideScheme({ id: "crisis", startingThreat: 3, icons: ["crisis"] });
const GOON = stubMinion({
  id: "goon",
  atk: 1,
  sch: 0,
  hp: 6,
  boostIcons: 0,
  keywords: [{ name: "retaliate", value: 1 }],
});

// --- The player's cards --------------------------------------------------------------------------------------------

const ENEMY = { categories: ["enemy"] } as const;
/** "Hero Action (attack): Deal 5 damage to an enemy." (no `attack` effect: a label-only attack) */
const BLAST_ACTION = stubAbility("blast.action", {
  trigger: { kind: "action", form: "hero" },
  label: ["attack"],
  effects: [
    { kind: "chooseTarget", slot: "enemy", chooser: { kind: "controller" }, query: { categories: ["villain"] } },
    { kind: "dealDamage", target: slot("enemy"), amount: n(5) },
  ],
} satisfies AbilityDefinition);
/** "Hero Action (attack): Deal 3 damage to the villain and to each minion." (one attack, two instructions) */
const SWEEP_ACTION = stubAbility("sweep.action", {
  trigger: { kind: "action", form: "hero" },
  label: ["attack"],
  effects: [
    { kind: "dealDamage", target: { kind: "villain" }, amount: n(3) },
    { kind: "dealDamage", target: { kind: "each", query: { categories: ["minion"] } }, amount: n(3) },
  ],
} satisfies AbilityDefinition);
/** "Hero Action (attack): Attack each enemy for 3." (an `attack` effect: one `attack` event per enemy) */
const VOLLEY_ACTION = stubAbility("volley.action", {
  trigger: { kind: "action", form: "hero" },
  label: ["attack"],
  effects: [{ kind: "attack", target: { kind: "each", query: ENEMY }, amount: n(3) }],
} satisfies AbilityDefinition);
/** "Hero Action (attack): [Mark the scheme.] Attack the villain for 4." (the attack begins before its `attack` instruction) */
const JAB_ACTION = stubAbility("jab.action", {
  trigger: { kind: "action", form: "hero" },
  label: ["attack"],
  effects: [record("jabbed"), { kind: "attack", target: { kind: "villain" }, amount: n(4) }],
} satisfies AbilityDefinition);
/** "Hero Action: Deal 4 damage to the villain." (no attack label) */
const ZAP_ACTION = stubAbility("zap.action", {
  trigger: { kind: "action", form: "hero" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(4) }],
} satisfies AbilityDefinition);
/** "After you attack" / "After you attack and deal damage" (the attack's `damage` result). */
const AFTER_ATTACK = stubAbility("room.after-attack", {
  trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller" } },
  effects: [record("afterAttack")],
} satisfies AbilityDefinition);
const AFTER_DAMAGE = stubAbility("room.after-damage", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "attack", playerIs: "controller", requireResults: { damage: 1 } },
  },
  effects: [record("afterDamage")],
} satisfies AbilityDefinition);

const BLAST = stubEvent({ id: "blast", cost: 0, abilities: [BLAST_ACTION.ref] });
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [SWEEP_ACTION.ref] });
const VOLLEY = stubEvent({ id: "volley", cost: 0, abilities: [VOLLEY_ACTION.ref] });
const JAB = stubEvent({ id: "jab", cost: 0, abilities: [JAB_ACTION.ref] });
const ZAP = stubEvent({ id: "zap", cost: 0, abilities: [ZAP_ACTION.ref] });
const ROOM = stubSupport({ id: "room", cost: 0, abilities: [AFTER_ATTACK.ref, AFTER_DAMAGE.ref] });
const PAL = stubAlly({ id: "pal", cost: 0, atk: 3, thw: 1, hp: 6, consequentialAttack: 1 });

const deps: EngineDeps = depsOf(
  WIDOW_INTERRUPT,
  WIDOW_RETALIATE,
  WIDOW_NO_PREPARATION,
  ACRO_PREPARATION,
  GRUNT_PREPARATION,
  OPS_PREPARATION,
  GOGGLES_GRANTED,
  GOGGLES_CONSTANT,
  BLAST_ACTION,
  SWEEP_ACTION,
  VOLLEY_ACTION,
  JAB_ACTION,
  ZAP_ACTION,
  AFTER_ATTACK,
  AFTER_DAMAGE,
);
const PLAYER_CARDS: readonly AnyCard[] = [BLAST, SWEEP, VOLLEY, JAB, ZAP, ROOM, PAL];
const ENCOUNTER_CARDS: readonly AnyCard[] = [ACRO, GRUNT, OPS, GOGGLES, BLANK, CRISIS, GOON];

interface Options {
  /** The card on top of the encounter deck. */
  readonly top: AnyCard;
  /** The Goon (6 hit points, retaliate 1) is engaged with the player. */
  readonly goon?: boolean;
  /** The Goggles are attached to the villain. */
  readonly goggles?: boolean;
  /** A side scheme with a crisis icon is in play. */
  readonly crisis?: boolean;
  /** Threat on the main scheme (4 as the game starts). */
  readonly threat?: number;
}

/** One player in hero form (ATK 2) on their turn, the Room in play, `top` on top of the encounter deck. */
function table(options: Options) {
  let state = gameAtFirstTurn({
    cards: [...PLAYER_CARDS, ...ENCOUNTER_CARDS],
    deps,
    villain: WIDOW,
    mainScheme: WEB,
    deck: PLAYER_CARDS.map((card) => card.id),
    encounter: [ACRO.id, GRUNT.id, OPS.id, GOGGLES.id, CRISIS.id, GOON.id, ...copiesOf(BLANK.id, 20)],
  });
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const villain = state.activeVillainId!;
  let goon: InstanceId | null = null;
  let goggles: InstanceId | null = null;
  if (options.goon) {
    const placed = minionEngagedWith(state, GOON.id, P1);
    [state, goon] = [placed.state, placed.id];
  }
  if (options.goggles) {
    const placed = encounterCardInVillainArea(state, GOGGLES.id);
    goggles = placed.id;
    state = {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== goggles),
      instances: {
        ...placed.state.instances,
        [goggles]: { ...mustInstance(placed.state, goggles), attachedTo: villain },
        [villain]: { ...mustInstance(placed.state, villain), attachments: [goggles] },
      },
    };
  }
  if (options.crisis) state = encounterCardInVillainArea(state, CRISIS.id, 3).state;
  state = onTopOfEncounterDeck(state, options.top.id);
  const top = activeEncounterDeck(state).deck[0]!;
  const room = playerCardIntoPlay(state, ROOM.id, P1);
  state = room.state;
  const main = state.mainScheme.instanceId;
  if (options.threat !== undefined) {
    state = {
      ...state,
      instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat: options.threat } },
    };
  }
  return { state, top, villain, goon, goggles, main, hero: mustPlayer(state, P1).identity.instanceId };
}
type Table = ReturnType<typeof table>;

const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const threatOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
const counter = (state: GameState, counterType: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters[counterType] ?? 0;
const discarded = (state: GameState, id: InstanceId): boolean => locateCard(state, id)?.kind === "encounterDiscard";
const basicAttack = (attackerId: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attackerId,
  targetInstanceId: target,
});
const resolvedAbilities = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));
const preventions = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "damagePrevented" ? [[e.targetInstanceId, e.amount, e.reason]] : []));
/** Every character an attack was made against, in order. */
const attackedCharacters = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "characterAttacked"
      ? [e.event.targetInstanceId]
      : [],
  );

/** Runs the commands with the default choices, and checks the log replays to the same state. */
function run(state: GameState, ...commands: readonly Command[]) {
  const driven = driveSession(startSession(state), deps, commands);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}

/** Plays `card` from hand for 0. */
function play(t: Table, card: AnyCard) {
  const given = giveCard(t.state, P1, card.id);
  return run(given.state, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

/** `card` in play under the player's control. */
function withInPlay(t: Table, card: AnyCard): Table & { readonly placed: InstanceId } {
  const placed = playerCardIntoPlay(t.state, card.id, P1);
  return { ...t, state: placed.state, placed: placed.id };
}

describe("§3.4 the villain's Forced Interrupt to a player's attack", () => {
  it("a basic attack (ATK 2), the main scheme at 4: 1 threat removed, one card discarded, its Preparation, then 2 damage", () => {
    const t = table({ top: OPS });
    const { state, events } = run(t.state, basicAttack(t.hero, t.villain));

    // 4 - 1 removed by the villain, + 1 placed by the discarded card's Preparation.
    expect(threatOn(state, t.main)).toBe(4);
    expect(events.filter((e) => e.type === "threatRemoved")).toHaveLength(1);
    expect(discarded(state, t.top)).toBe(true);
    expect(resolvedAbilities(events)).toContain("ops.preparation");
    expect(damageOn(state, t.villain)).toBe(2);
    // The villain was attacked: retaliate 1. The response reads that a Preparation resolved during the attack.
    expect(damageOn(state, t.hero)).toBe(1);
    expect(counter(state, "preparationResolved")).toBe(1);
    expect(counter(state, "noPreparation")).toBe(0);
    // The removal is the villain's, not a thwart.
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "thwart")).toBe(false);
  });

  it("with a crisis icon in play: the same (RRG 1.8 p. 14, encounter card abilities are not affected by it)", () => {
    const t = table({ top: OPS, crisis: true });
    const { state } = run(t.state, basicAttack(t.hero, t.villain));

    expect(threatOn(state, t.main)).toBe(4);
    expect(discarded(state, t.top)).toBe(true);
    expect(damageOn(state, t.villain)).toBe(2);
    expect(counter(state, "preparationResolved")).toBe(1);
  });

  it("the main scheme at 0: no threat removed, nothing discarded, the attack deals 2, and no Preparation was resolved", () => {
    const t = table({ top: OPS, threat: 0 });
    const { state, events } = run(t.state, basicAttack(t.hero, t.villain));

    expect(threatOn(state, t.main)).toBe(0);
    expect(activeEncounterDeck(state).deck[0]).toBe(t.top);
    expect(resolvedAbilities(events)).not.toContain("ops.preparation");
    expect(damageOn(state, t.villain)).toBe(2);
    // Offered after retaliate has resolved: the hero's retaliate damage is logged before the response resolves.
    expect(counter(state, "noPreparation")).toBe(1);
    expect(counter(state, "preparationResolved")).toBe(0);
    const retaliated = events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === t.hero);
    const responded = events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === WIDOW_NO_PREPARATION.ref.id,
    );
    expect(retaliated).toBeGreaterThan(-1);
    expect(responded).toBeGreaterThan(retaliated);
  });

  it("a discarded card with no Preparation: threat removed, the card discarded, 0 resolved", () => {
    const t = table({ top: BLANK });
    const { state } = run(t.state, basicAttack(t.hero, t.villain));

    expect(threatOn(state, t.main)).toBe(3);
    expect(discarded(state, t.top)).toBe(true);
    expect(damageOn(state, t.villain)).toBe(2);
    expect(counter(state, "noPreparation")).toBe(1);
  });

  it("a stunned hero 'attacks': the stunned card is discarded, the main scheme keeps its threat, no card is discarded", () => {
    const t = table({ top: OPS });
    const hero = mustInstance(t.state, t.hero);
    const stunned: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [t.hero]: { ...hero, statuses: { ...hero.statuses, stunned: 1 } } },
    };
    const { state } = run(stunned, basicAttack(t.hero, t.villain));

    expect(mustInstance(state, t.hero).statuses.stunned).toBe(0);
    expect(threatOn(state, t.main)).toBe(4);
    expect(activeEncounterDeck(state).deck[0]).toBe(t.top);
    expect(damageOn(state, t.villain)).toBe(0);
    expect(damageOn(state, t.hero)).toBe(0);
  });

  it("an event that deals her 4 damage without the attack label: no trigger", () => {
    const t = table({ top: OPS });
    const { state } = play(t, ZAP);

    expect(damageOn(state, t.villain)).toBe(4);
    expect(threatOn(state, t.main)).toBe(4);
    expect(activeEncounterDeck(state).deck[0]).toBe(t.top);
    expect(damageOn(state, t.hero)).toBe(0);
  });

  it("an attack event (a label-only attack) triggers it before its damage", () => {
    const t = table({ top: OPS });
    const { state } = play(t, BLAST);

    expect(threatOn(state, t.main)).toBe(4);
    expect(discarded(state, t.top)).toBe(true);
    expect(damageOn(state, t.villain)).toBe(5);
    expect(damageOn(state, t.hero)).toBe(1);
    expect(counter(state, "preparationResolved")).toBe(1);
  });
});

describe("§3.4 `modifyAttack { preventAllDamage, bind }` on a player's attack", () => {
  it("a hero's basic attack (ATK 2): 0 dealt; the attack still attacked; 'that much' (2) is dealt to the attacker after it", () => {
    const t = table({ top: ACRO });
    const { state, events } = run(t.state, basicAttack(t.hero, t.villain));

    expect(damageOn(state, t.villain)).toBe(0);
    expect(preventions(events)).toEqual([[t.villain, 2, "effect"]]);
    // Attacked, so retaliate 1 answers; then the 2 the attack would have dealt.
    expect(attackedCharacters(events)).toEqual([t.villain]);
    expect(damageOn(state, t.hero)).toBe(1 + 2);
    // "After you attack" answers; "after you attack and deal damage" does not: the attack's `damage` result is 0.
    expect(counter(state, "afterAttack")).toBe(1);
    expect(counter(state, "afterDamage")).toBe(0);
    // What the bind reported, read at the end of the attack.
    expect(counter(state, "preventedFlag")).toBe(1);
    expect(counter(state, "preventedAmount")).toBe(2);
    expect(counter(state, "preventedTotal")).toBe(2);
    expect(counter(state, "preparationResolved")).toBe(1);
  });

  it("without the Preparation the same attack deals 2 and 'after you attack and deal damage' answers", () => {
    const t = table({ top: BLANK });
    const { state } = run(t.state, basicAttack(t.hero, t.villain));

    expect(damageOn(state, t.villain)).toBe(2);
    expect(counter(state, "afterAttack")).toBe(1);
    expect(counter(state, "afterDamage")).toBe(1);
  });

  it("a 5-damage attack event: 0 dealt, and the attacker takes 5", () => {
    const t = table({ top: ACRO });
    const { state, events } = play(t, BLAST);

    expect(damageOn(state, t.villain)).toBe(0);
    expect(preventions(events)).toEqual([[t.villain, 5, "effect"]]);
    expect(damageOn(state, t.hero)).toBe(1 + 5);
    expect(counter(state, "afterAttack")).toBe(1);
    expect(counter(state, "afterDamage")).toBe(0);
    expect(counter(state, "preventedAmount")).toBe(5);
    expect(counter(state, "preventedTotal")).toBe(5);
  });

  it("an ally's basic attack (ATK 3): 0 dealt; the ally takes retaliate 1, its consequential 1, and the 3", () => {
    const t = withInPlay(table({ top: ACRO }), PAL);
    const { state } = run(t.state, basicAttack(t.placed, t.villain));

    expect(damageOn(state, t.villain)).toBe(0);
    expect(damageOn(state, t.placed)).toBe(1 + 1 + 3);
    expect(damageOn(state, t.hero)).toBe(0);
    expect(counter(state, "preventedAmount")).toBe(3);
  });

  it("the attacking ally has left play by the end of the attack: 'that much damage' is dealt to nobody", () => {
    const t = withInPlay(table({ top: ACRO }), PAL);
    const pal = mustInstance(t.state, t.placed);
    // 4 of its 6 hit points gone: retaliate 1 and its consequential 1 defeat it before the attack ends.
    const hurt: GameState = { ...t.state, instances: { ...t.state.instances, [t.placed]: { ...pal, damage: 4 } } };
    const { state } = run(hurt, basicAttack(t.placed, t.villain));

    expect(locateCard(state, t.placed)?.kind).toBe("discard");
    expect(damageOn(state, t.villain)).toBe(0);
    expect(damageOn(state, t.hero)).toBe(0);
    expect(counter(state, "preventedAmount")).toBe(3);
  });
});

describe("§3.4, Q4 = A: an attack with several targets is prevented whole", () => {
  it("one attack, two damage instructions (3 to the villain, 3 to each minion): every instance is prevented", () => {
    const t = table({ top: ACRO, goon: true });
    const { state, events } = play(t, SWEEP);

    expect(damageOn(state, t.villain)).toBe(0);
    expect(damageOn(state, t.goon!)).toBe(0);
    expect(preventions(events)).toEqual([
      [t.villain, 3, "effect"],
      [t.goon, 3, "effect"],
    ]);
    // Both were attacked: retaliate 1 from each. Then "that much": the 3 it would have dealt the villain, not 6.
    expect(attackedCharacters(events)).toEqual([t.villain, t.goon]);
    expect(damageOn(state, t.hero)).toBe(1 + 1 + 3);
    expect(counter(state, "preventedAmount")).toBe(3);
    expect(counter(state, "preventedTotal")).toBe(6);
    expect(counter(state, "afterDamage")).toBe(0);
  });

  it("without the Preparation the same attack deals 3 to each", () => {
    const t = table({ top: BLANK, goon: true });
    const { state } = play(t, SWEEP);

    expect(damageOn(state, t.villain)).toBe(3);
    expect(damageOn(state, t.goon!)).toBe(3);
    expect(damageOn(state, t.hero)).toBe(1 + 1);
  });

  it("an `attack` effect against each enemy (one event per enemy): the other enemy's damage is prevented with the villain's", () => {
    const t = table({ top: ACRO, goon: true });
    const { state, events } = play(t, VOLLEY);

    expect(damageOn(state, t.villain)).toBe(0);
    expect(damageOn(state, t.goon!)).toBe(0);
    expect(preventions(events)).toEqual([
      [t.villain, 3, "effect"],
      [t.goon, 3, "effect"],
    ]);
    expect(damageOn(state, t.hero)).toBe(1 + 1 + 3);
    expect(counter(state, "preventedAmount")).toBe(3);
    expect(counter(state, "preventedTotal")).toBe(6);
  });
});

describe("§3.4 `retargetAttack` onto a minion a Preparation put into play", () => {
  it("a 3-damage ally attack: the Grunt (5 hit points, guard) is engaged with the attacker with 3 damage; the villain takes 0 and does not retaliate", () => {
    const t = withInPlay(table({ top: GRUNT }), PAL);
    const { state, events } = run(t.state, basicAttack(t.placed, t.villain));

    expect(mustInstance(state, t.top).engagedWith).toBe(P1);
    expect(mustPlayer(state, P1).playArea).toContain(t.top);
    expect(damageOn(state, t.top)).toBe(3);
    expect(damageOn(state, t.villain)).toBe(0);
    expect(attackedCharacters(events)).toEqual([t.top]);
    // No retaliate from the villain: only the ally's consequential 1.
    expect(damageOn(state, t.placed)).toBe(1);
    expect(events.filter((e) => e.type === "playerAttackRetargeted")).toEqual([
      {
        type: "playerAttackRetargeted",
        attackerInstanceId: t.placed,
        fromInstanceId: t.villain,
        targetInstanceId: t.top,
        playerId: P1,
      },
    ]);
    // The attack is no longer against the villain, so its "after [this villain] is attacked" does not answer.
    expect(counter(state, "noPreparation") + counter(state, "preparationResolved")).toBe(0);
    expect(counter(state, "afterDamage")).toBe(1);
  });

  it("a 5-damage attack event: the Grunt takes the 5 and is defeated; the villain takes 0", () => {
    const t = table({ top: GRUNT });
    const { state, events } = play(t, BLAST);

    // Its own guard does not stop the attack made against it (RRG 1.8 "Guard", p. 21: the villain is not attacked).
    expect(discarded(state, t.top)).toBe(true);
    expect(events.some((e) => e.type === "damageDealt" && e.targetInstanceId === t.top && e.amount === 5)).toBe(true);
    expect(attackedCharacters(events)).toEqual([t.top]);
    expect(damageOn(state, t.villain)).toBe(0);
    expect(damageOn(state, t.hero)).toBe(0);
  });

  it("an attack that began before its `attack` instruction (4 damage): the Grunt takes the 4; the villain takes 0", () => {
    const t = table({ top: GRUNT });
    const { state, events } = play(t, JAB);

    expect(counter(state, "jabbed")).toBe(1);
    expect(damageOn(state, t.top)).toBe(4);
    expect(attackedCharacters(events)).toEqual([t.top]);
    expect(damageOn(state, t.villain)).toBe(0);
    expect(damageOn(state, t.hero)).toBe(0);
  });

  it("the same attacks with a prevention instead: the begun attack's 4 is prevented and reported", () => {
    const t = table({ top: ACRO });
    const { state } = play(t, JAB);

    expect(damageOn(state, t.villain)).toBe(0);
    expect(damageOn(state, t.hero)).toBe(1 + 4);
    expect(counter(state, "preventedAmount")).toBe(4);
  });
});

describe("§3.4 a granted Preparation (§3.3) that prevents all damage: the attack deals 0", () => {
  it("a card that prints none, with the Goggles on the villain: the attack deals 0 and the Goggles are discarded", () => {
    const t = table({ top: BLANK, goggles: true });
    const { state, events } = run(t.state, basicAttack(t.hero, t.villain));

    expect(resolvedAbilities(events)).toContain("goggles.granted-preparation");
    expect(damageOn(state, t.villain)).toBe(0);
    expect(preventions(events)).toEqual([[t.villain, 2, "effect"]]);
    expect(discarded(state, t.goggles!)).toBe(true);
    expect(mustInstance(state, t.villain).attachments).toEqual([]);
    expect(damageOn(state, t.hero)).toBe(1);
    expect(counter(state, "preparationResolved")).toBe(1);
    expect(counter(state, "afterDamage")).toBe(0);
  });

  it("a card that prints its own: the Goggles' is not gained and the attack deals 2", () => {
    const t = table({ top: OPS, goggles: true });
    const { state } = run(t.state, basicAttack(t.hero, t.villain));

    expect(damageOn(state, t.villain)).toBe(2);
    expect(mustInstance(state, t.villain).attachments).toEqual([t.goggles]);
  });
});
