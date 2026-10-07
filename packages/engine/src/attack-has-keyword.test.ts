/**
 * docs/phase7-wave7.md §3.59 and §3.69: a trigger on an attack that has a keyword (`EventPattern.attackHas`), and
 * "(Max 1 per attack.)" on an event played from hand (`AbilityLimit.per: "triggeringEvent"`, wave 5 §3.14). Synthetic
 * cards shaped like the two printed wordings:
 *
 * 1. an upgrade's "Hero Interrupt: When you make a ranged attack, … this attack deals additional damage";
 * 2. an event's "Hero Interrupt: When your hero makes an attack that has a keyword (overkill, piercing, or ranged),
 *    that attack deals 2 additional damage. (Max 1 per attack.)"
 *
 * Sources. RRG 1.8 "Ranged" (p. 36), "Piercing" (p. 32), "Overkill" (p. 31): each is "an attack with the … keyword",
 * so the keyword may come from the attacking character, the card making the attack or a grant to the attack
 * (`attackKeywordsOf`). Several keywords in the filter are any-of ("a keyword (overkill, piercing, or ranged)").
 *
 * When: the attack's interrupt window reads its candidates once, as it opens (docs/phase7-wave6.md §3.79; RRG 1.8
 * "Triggering Condition", p. 45). A keyword the attack already has then counts, one granted before the attack was
 * declared included; a keyword another interrupt of that window grants does not trigger the ability afterwards.
 *
 * Who: "you" / "your hero" is the player's identity (RRG 1.8 "You, Your", p. 49), so an ally's attack is not heard
 * unless the card names "a character you control".
 *
 * "Max 1 per attack": RRG 1.8 "Max, Maximum" (p. 28): the words "impose a maximum across all copies of a card (by
 * title) for all players", and "'Max 1 per [instance]' restricts the number of times an ability can be triggered by a
 * single instance of a triggering effect across all copies of the card with the maximum". One copy per attack, whoever
 * holds the others; each attack is its own instance. "If a card with a maximum is canceled, the card is still counted
 * toward the maximum."
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { candidatesFor } from "./resolve/triggers.js";
import type { AttackKeyword, EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSupport, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard, giveCards, RESOURCE, resolvePending } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

// The default test hero's printed ATK (`testing/scenario.ts`).
const HERO_ATK = 2;
const n = (value: number) => ({ kind: "const", value }) as const;
const yourIdentity: TargetQuery = { categories: ["identity"], controller: "you" };
const anyIdentity: TargetQuery = { categories: ["identity"] };
const ANY_KEYWORD: readonly AttackKeyword[] = ["overkill", "piercing", "ranged"];

/** "When you make an attack that has one of `has`": your identity's attack, basic or by an ability. */
const youAttackWith = (has: readonly AttackKeyword[]): EventPattern => ({
  on: "attack",
  sourceIs: yourIdentity,
  attackHas: has,
});
const interrupt = (
  id: string,
  on: EventPattern,
  effects: readonly EffectSpec[],
  more: Partial<AbilityDefinition> = {},
) => stubAbility(id, { trigger: { kind: "interrupt", forced: false, on }, effects, ...more });
const extra = (amount: number): EffectSpec => ({ kind: "modifyAttack", extraDamage: n(amount) });
const constant = (id: string, parts: Omit<Extract<AbilityDefinition["trigger"], { kind: "constant" }>, "kind">) =>
  stubAbility(id, { trigger: { kind: "constant", ...parts }, effects: [] } satisfies AbilityDefinition);

/** "Hero Interrupt: When you make a ranged attack, this attack deals 3 additional damage." */
const SHARP = interrupt("sharp.interrupt", youAttackWith(["ranged"]), [extra(3)]);
/** The same for "a character you control". */
const WIDE = interrupt(
  "wide.interrupt",
  { on: "attack", playerIs: "controller", sourceIs: { controller: "you" }, attackHas: ["ranged"] },
  [extra(3)],
);
/** "When your hero makes an attack that has a keyword (overkill, piercing, or ranged), … 2 additional damage." */
const TRIO = interrupt("trio.interrupt", youAttackWith(ANY_KEYWORD), [extra(2)]);
/** "Interrupt: When you attack, that attack gains ranged." */
const GRANT = interrupt("grant.interrupt", { on: "attack", playerIs: "controller", sourceIs: yourIdentity }, [
  { kind: "modifyAttack", keywords: ["ranged"] },
]);
const perAttack = { count: 1, period: "phase", per: "triggeringEvent" } as const;
/** The second wording, an event: "(Max 1 per attack.)". */
const FORCE = interrupt("force.interrupt", youAttackWith(ANY_KEYWORD), [extra(2)], { limit: perAttack });
/** The same limit on "when a hero makes an attack that has a keyword": any player may answer any hero's attack. */
const ANYONE = interrupt(
  "anyone.interrupt",
  { on: "attack", sourceIs: anyIdentity, attackHas: ANY_KEYWORD },
  [extra(2)],
  {
    limit: perAttack,
  },
);
/** A different card with the same trigger and no maximum, costing 1. */
const OTHER = interrupt("other.interrupt", youAttackWith(ANY_KEYWORD), [extra(1)]);
/** "Interrupt: When you attack, deal 1 damage to the villain as an attack": an attack made inside an attack. */
const ECHO = interrupt("echo.interrupt", { on: "attack", playerIs: "controller", sourceIs: yourIdentity }, [
  { kind: "attack", target: { kind: "villain" }, amount: n(1) },
]);
/** "Forced Interrupt: When a force is played, cancel its effects." */
const NOPE = stubAbility("nope.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardBeingPlayed", targetIs: { name: "force" } } },
  effects: [{ kind: "cancelTriggeringEvent" }],
});

const RANGED_HERO = constant("ranged-hero.constant", {
  keywordGrants: [{ keyword: { name: "ranged" }, target: anyIdentity }],
});
const PIERCING_HERO = constant("piercing-hero.constant", {
  keywordGrants: [{ keyword: { name: "piercing" }, target: anyIdentity }],
});
/** "Your basic attacks gain ranged." */
const BOW = constant("bow.constant", { rules: [{ kind: "attackKeywords", keywords: ["ranged"], basicOnly: true }] });

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attackVillain = (more: Partial<Extract<EffectSpec, { kind: "attack" }>> = {}): readonly EffectSpec[] => [
  { kind: "attack", target: { kind: "villain" }, amount: n(2), ...more },
];
const PLAIN_ATTACK = action("plain-attack", attackVillain());
const RANGED_ATTACK = action("ranged-attack", attackVillain({ keywords: ["ranged"] }));
const PIERCING_ATTACK = action("piercing-attack", attackVillain({ keywords: ["piercing"] }));
const OVERKILL_ATTACK = action("overkill-attack", attackVillain({ overkill: true }));
/** "Your next basic attack gains ranged." */
const AIM = action("aim", [
  {
    kind: "grantKeywordUntil",
    keyword: { name: "ranged" },
    target: { kind: "each", query: anyIdentity },
    until: { kind: "nextBasicPower", powers: ["attack"] },
  },
]);
const ACTIONS = [PLAIN_ATTACK, RANGED_ATTACK, PIERCING_ATTACK, OVERKILL_ATTACK, AIM];

const support = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
const SHARP_S = support("sharp", SHARP);
const WIDE_S = support("wide", WIDE);
const TRIO_S = support("trio", TRIO);
const GRANT_S = support("grant", GRANT);
const ECHO_S = support("echo", ECHO);
const NOPE_S = support("nope", NOPE);
const RANGED_HERO_S = support("ranged-hero", RANGED_HERO);
const PIERCING_HERO_S = support("piercing-hero", PIERCING_HERO);
const BOW_S = support("bow", BOW);
const SUPPORTS = [SHARP_S, WIDE_S, TRIO_S, GRANT_S, ECHO_S, NOPE_S, RANGED_HERO_S, PIERCING_HERO_S, BOW_S];
const RANGED_ALLY = stubAlly({ id: "ranged-ally", cost: 0, atk: 2, thw: 1, hp: 4, keywords: [{ name: "ranged" }] });
const FORCE_E = stubEvent({ id: "force", cost: 0, abilities: [FORCE.ref] });
const ANYONE_E = stubEvent({ id: "anyone", cost: 0, abilities: [ANYONE.ref] });
const OTHER_E = stubEvent({ id: "other", cost: 1, abilities: [OTHER.ref] });
const VILLAIN = stubVillain({ id: "sturdy-villain", stages: [{ hp: flat(60), atk: 1, sch: 0 }] });

const deps: EngineDeps = depsOf(
  SHARP,
  WIDE,
  TRIO,
  GRANT,
  FORCE,
  ANYONE,
  OTHER,
  ECHO,
  NOPE,
  RANGED_HERO,
  PIERCING_HERO,
  BOW,
  ...ACTIONS.map((a) => a.ability),
);

type InPlay = (typeof SUPPORTS)[number] | typeof RANGED_ALLY;
interface Table {
  readonly state: GameState;
  /** The cards put into play, in the order asked. */
  readonly ids: readonly InstanceId[];
  readonly hero: InstanceId;
  readonly villain: InstanceId;
}

/** Every player in hero form with none of the test's cards in hand, `inPlay` under the first player's control. */
function table(inPlay: readonly InPlay[] = [], players: 1 | 2 = 1): Table {
  const playerCards = [...SUPPORTS, RANGED_ALLY, FORCE_E, ANYONE_E, OTHER_E, ...ACTIONS.map((a) => a.card)];
  const base = gameAtFirstTurn({
    cards: [VILLAIN, ...playerCards],
    deps,
    villain: VILLAIN,
    players,
    deck: playerCards.flatMap((c) => copiesOf(c.id as CardId, 3)),
  });
  // The opening hand holds none of these cards: a test hands out exactly the ones it means to offer.
  const dealt = (id: InstanceId) => playerCards.some((card) => card.id === base.instances[id]?.cardId);
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" },
      hand: p.hand.filter((id) => !dealt(id)),
      deck: [...p.deck, ...p.hand.filter(dealt)],
    })),
  };
  const ids: InstanceId[] = [];
  for (const card of inPlay) {
    const placed = playerCardIntoPlay(state, card.id);
    state = placed.state;
    ids.push(placed.id);
  }
  return {
    state,
    ids,
    hero: mustPlayer(state, P1).identity.instanceId,
    villain: state.villains[0]!.instanceId,
  };
}

const basicAttack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const playCard = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
/** Triggers everything offered, in the order offered. */
const pickAll = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  return choice?.prompt.kind === "chooseTriggers" ? choice.options.map((o) => o.optionId) : defaultPick(state);
};
const drive = (state: GameState, ...commands: readonly Command[]) =>
  runCommandsPicking(state, deps, pickAll, ...commands);
const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const resolved = (events: readonly GameEvent[], ability: StubAbility): number =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === ability.ref.id).length;
/** The abilities offered in the interrupt windows of player attacks, one list per window opened. */
const offered = (events: readonly GameEvent[]): readonly (readonly string[])[] =>
  events.flatMap((e) =>
    e.type === "windowOpened" && e.timing === "interrupt" && e.event.kind === "attack"
      ? [e.candidates.map((c) => c.abilityId as string)]
      : [],
  );
const copiesIn = (state: GameState, zone: "hand" | "discard", card: { readonly id: CardId }, player: PlayerId = P1) =>
  mustPlayer(state, player)[zone].filter((id) => mustInstance(state, id).cardId === card.id).length;
const optionFor = (id: InstanceId, ability: StubAbility): string => `${id}:${ability.ref.id}`;

describe("§3.59 'When you make a ranged attack' (`EventPattern.attackHas`)", () => {
  it("is offered for the hero's basic attack when the hero has ranged; replay deep-equal", () => {
    const t = table([SHARP_S, RANGED_HERO_S]);
    const after = drive(t.state, basicAttack(t.hero, t.villain));
    expect(offered(after.events)).toEqual([[SHARP.ref.id]]);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK + 3);
    const replayed = replay(after.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after.session.state);
  });

  it("is offered when the card making the attack gives it ranged, and not for the same attack without it", () => {
    const t = table([SHARP_S]);
    const ranged = giveCard(t.state, P1, RANGED_ATTACK.card.id);
    const withRanged = drive(ranged.state, playCard(ranged.id));
    expect(offered(withRanged.events)).toEqual([[SHARP.ref.id]]);
    expect(damageOn(withRanged.state, t.villain)).toBe(2 + 3);

    const plain = giveCard(t.state, P1, PLAIN_ATTACK.card.id);
    const without = drive(plain.state, playCard(plain.id));
    expect(offered(without.events)).toEqual([]);
    expect(damageOn(without.state, t.villain)).toBe(2);
  });

  it("is offered when a constant rule gives the hero's basic attacks ranged", () => {
    const t = table([SHARP_S, BOW_S]);
    const after = drive(t.state, basicAttack(t.hero, t.villain));
    expect(offered(after.events)).toEqual([[SHARP.ref.id]]);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK + 3);
  });

  it("is offered when ranged was granted to the hero's next basic attack before it was declared", () => {
    const t = table([SHARP_S]);
    const aim = giveCard(t.state, P1, AIM.card.id);
    const after = drive(aim.state, playCard(aim.id), basicAttack(t.hero, t.villain));
    expect(offered(after.events)).toEqual([[SHARP.ref.id]]);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK + 3);
  });

  it("is not offered for an attack without ranged", () => {
    const t = table([SHARP_S, PIERCING_HERO_S]);
    const after = drive(t.state, basicAttack(t.hero, t.villain));
    expect(offered(after.events)).toEqual([]);
    expect(resolved(after.events, SHARP)).toBe(0);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK);
  });

  it("'you' is your identity: an ally's ranged attack is not heard", () => {
    const t = table([SHARP_S, RANGED_ALLY]);
    const after = drive(t.state, basicAttack(t.ids[1]!, t.villain));
    expect(offered(after.events)).toEqual([]);
    expect(damageOn(after.state, t.villain)).toBe(2);
  });

  it("'a character you control' hears the ally's ranged attack", () => {
    const t = table([WIDE_S, RANGED_ALLY]);
    const after = drive(t.state, basicAttack(t.ids[1]!, t.villain));
    expect(offered(after.events)).toEqual([[WIDE.ref.id]]);
    expect(damageOn(after.state, t.villain)).toBe(2 + 3);
  });

  it("ranged gained from another interrupt of the same attack comes too late to trigger it", () => {
    const t = table([SHARP_S, GRANT_S]);
    const after = drive(t.state, basicAttack(t.hero, t.villain));
    expect(offered(after.events)).toEqual([[GRANT.ref.id]]);
    expect(resolved(after.events, GRANT)).toBe(1);
    expect(resolved(after.events, SHARP)).toBe(0);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK);
  });
});

describe("§3.69 'an attack that has a keyword (overkill, piercing, or ranged)': any one of them", () => {
  it.each([
    ["piercing", PIERCING_ATTACK],
    ["ranged", RANGED_ATTACK],
    ["overkill", OVERKILL_ATTACK],
  ] as const)("an attack with only %s is heard", (_keyword, attack) => {
    const t = table([TRIO_S]);
    const given = giveCard(t.state, P1, attack.card.id);
    const after = drive(given.state, playCard(given.id));
    expect(offered(after.events)).toEqual([[TRIO.ref.id]]);
    expect(damageOn(after.state, t.villain)).toBe(2 + 2);
  });

  it("an attack with none of them is not", () => {
    const t = table([TRIO_S]);
    const given = giveCard(t.state, P1, PLAIN_ATTACK.card.id);
    const after = drive(given.state, playCard(given.id));
    expect(offered(after.events)).toEqual([]);
    expect(damageOn(after.state, t.villain)).toBe(2);
  });
});

describe("§3.69 '(Max 1 per attack.)' on an event played from hand", () => {
  it("two copies chosen for one attack: one is played, the other stays in hand", () => {
    const t = table([PIERCING_HERO_S]);
    const given = giveCards(t.state, P1, FORCE_E.id, FORCE_E.id);
    const after = drive(given.state, basicAttack(t.hero, t.villain));
    expect(offered(after.events)).toEqual([[FORCE.ref.id, FORCE.ref.id]]);
    expect(resolved(after.events, FORCE)).toBe(1);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK + 2);
    expect(copiesIn(after.state, "discard", FORCE_E)).toBe(1);
    expect(copiesIn(after.state, "hand", FORCE_E)).toBe(1);
    const replayed = replay(after.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after.session.state);
  });

  it("the copy left over can be played in the next attack of the same turn", () => {
    const t = table([PIERCING_HERO_S]);
    const given = giveCards(t.state, P1, FORCE_E.id, FORCE_E.id);
    const attack = giveCard(given.state, P1, PLAIN_ATTACK.card.id);
    const after = drive(attack.state, basicAttack(t.hero, t.villain), playCard(attack.id));
    expect(offered(after.events)).toEqual([[FORCE.ref.id, FORCE.ref.id], [FORCE.ref.id]]);
    expect(resolved(after.events, FORCE)).toBe(2);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK + 2 + 2 + 2);
    expect(copiesIn(after.state, "discard", FORCE_E)).toBe(2);
  });

  it("mid-attack, a second copy is no longer a candidate; a different card still is, and is played", () => {
    const t = table([PIERCING_HERO_S]);
    const given = giveCards(t.state, P1, FORCE_E.id, FORCE_E.id, OTHER_E.id, RESOURCE.id);
    const [first, second, other, resource] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    let pause: GameState | null = null;
    const pick = (state: GameState): readonly string[] => {
      const kind = state.pendingChoice?.prompt.kind;
      if (kind === "chooseTriggers")
        return [optionFor(first, FORCE), optionFor(other, OTHER), optionFor(second, FORCE)];
      if (kind !== "payForCard") return defaultPick(state);
      pause = state;
      return [`hand:${resource}`];
    };
    const after = runCommandsPicking(given.state, deps, pick, basicAttack(t.hero, t.villain));
    // The first copy has resolved and the other card's payment is being asked.
    const paused = pause as GameState | null;
    if (!paused) throw new Error("the other card's payment was never asked");
    const attack = paused.stack.find((f) => f.kind === "event" && f.event.kind === "attack");
    if (attack?.kind !== "event") throw new Error("no attack on the stack");
    const candidates = candidatesFor(paused, deps, attack.event, "interrupt", false).map((c) => c.instanceId);
    expect(candidates).toEqual([other]);
    // Naming the second copy again in an answer does not play it.
    expect(() => resolvePending(paused, [optionFor(second, FORCE)], deps)).toThrow();
    expect(resolved(after.events, FORCE)).toBe(1);
    expect(resolved(after.events, OTHER)).toBe(1);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK + 2 + 1);
    expect(mustPlayer(after.state, P1).hand).toContain(second);
  });

  it("a copy whose effects are canceled still counts toward the maximum (RRG 1.8 'Max, Maximum', p. 28)", () => {
    const t = table([PIERCING_HERO_S, NOPE_S]);
    const given = giveCards(t.state, P1, FORCE_E.id, FORCE_E.id);
    const after = drive(given.state, basicAttack(t.hero, t.villain));
    expect(resolved(after.events, FORCE)).toBe(0);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK);
    expect(copiesIn(after.state, "discard", FORCE_E)).toBe(1);
    expect(copiesIn(after.state, "hand", FORCE_E)).toBe(1);
  });

  it("an attack made inside an identical attack is its own attack: a copy for each", () => {
    const t = table([PIERCING_HERO_S, ECHO_S]);
    const given = giveCards(t.state, P1, FORCE_E.id, FORCE_E.id, FORCE_E.id);
    const [first, second, third] = given.ids as [InstanceId, InstanceId, InstanceId];
    const echo = optionFor(t.ids[1]!, ECHO);
    // The basic attack's window, then the first echo's (a copy, then an echo inside it), then the second echo's.
    const answers = [[echo], [optionFor(first, FORCE), echo], [optionFor(second, FORCE)]];
    let asked = 0;
    const pick = (state: GameState): readonly string[] =>
      state.pendingChoice?.prompt.kind === "chooseTriggers" ? (answers[asked++] ?? []) : defaultPick(state);
    const after = runCommandsPicking(given.state, deps, pick, basicAttack(t.hero, t.villain));
    expect(asked).toBe(3);
    expect(resolved(after.events, FORCE)).toBe(2);
    expect(resolved(after.events, ECHO)).toBe(2);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK + (1 + 2) + (1 + 2));
    expect(mustPlayer(after.state, P1).hand).toContain(third);
  });

  it("two players: the maximum is across all players, so one copy answers a hero's attack between them", () => {
    const t = table([PIERCING_HERO_S], 2);
    const mine = giveCard(t.state, P1, ANYONE_E.id);
    const theirs = giveCard(mine.state, P2, ANYONE_E.id);
    const after = drive(theirs.state, basicAttack(t.hero, t.villain));
    expect(offered(after.events)).toEqual([[ANYONE.ref.id, ANYONE.ref.id]]);
    expect(resolved(after.events, ANYONE)).toBe(1);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK + 2);
    expect(copiesIn(after.state, "discard", ANYONE_E, P1)).toBe(1);
    expect(mustPlayer(after.state, P2).hand).toContain(theirs.id);
  });

  it("two players: 'your hero' is not the other player's, whose copy is not offered for your attack", () => {
    const t = table([PIERCING_HERO_S], 2);
    const mine = giveCard(t.state, P1, FORCE_E.id);
    const theirs = giveCard(mine.state, P2, FORCE_E.id);
    const after = drive(theirs.state, basicAttack(t.hero, t.villain));
    expect(offered(after.events)).toEqual([[FORCE.ref.id]]);
    expect(damageOn(after.state, t.villain)).toBe(HERO_ATK + 2);
    expect(mustPlayer(after.state, P2).hand).toContain(theirs.id);
  });
});
