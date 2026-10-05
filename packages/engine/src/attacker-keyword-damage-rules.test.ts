/**
 * docs/phase7-wave7.md §3.30: damage rules that read who or what is attacking. Synthetic cards shaped like the three
 * printed wordings:
 *
 * 1. "The villain cannot take damage unless the attacker or attack has the [FLY] trait, or the attack has ranged."
 *    (`cannotTakeDamage` with `exceptAttacker`, `exceptAttackCard`, `exceptAttackKeyword`)
 * 2. "Reduce the amount of damage this minion takes from each attack by 1 unless the attacker has the [TINY] trait."
 *    (`reduceDamageTaken` with `fromAttack` and `exceptAttacker`)
 * 3. "This villain ignores the retaliate keyword while attacking a non-[FLY] character." (`characterIgnores` with
 *    `"retaliate"` and `against`)
 *
 * Sources. §4.1 Q17 = A: damage with no attack behind it (a non-attack event or ability, retaliate, indirect damage)
 * has neither an attacker nor an attack, so the first wording blocks it. "The attack has the trait" is the trait on
 * the card whose ability makes the attack (an attack event, an upgrade's attack ability), as distinct from the
 * attacking character's: the RRG gives an attack no traits of its own, only cards have them (RRG 1.8 "Traits", p. 45).
 * RRG 1.8 "'Cannot'" (p. 11): absolute, so it comes before a tough status card, which replaces damage the character
 * "would take" (RRG 1.8 "Tough", p. 44; "Damage", p. 14, step 2) and is not used; piercing discards none (RRG 1.8
 * "Piercing", p. 32, the engine's reading kept from before ruling January 17, 2026 (3)). RRG 1.8 "Overkill" (p. 31):
 * the spill is "damage from an attack", and excess is measured on damage taken (user decision 2026-09-25, setting
 * aside February 8, 2026 - Ruling 2's "heals 3"). RRG 1.8 "Ranged" (p. 36), "Retaliate X" (p. 38), "Ignore" (p. 23).
 * RRG 1.8 "Target" (p. 43): a character that cannot take the damage is no valid target of a basic attack or of an
 * ability that only deals it damage.
 */

import { flat, trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { characterIgnores } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMinion,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const FLY = trait("FLY");
const TINY = trait("TINY");
// The default test hero's printed ATK (`testing/scenario.ts`).
const HERO_ATK = 2;

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const theMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };
const anyIdentity: TargetQuery = { categories: ["identity"] };
const constant = (id: string, parts: Omit<Extract<AbilityDefinition["trigger"], { kind: "constant" }>, "kind">) =>
  stubAbility(id, { trigger: { kind: "constant", ...parts }, effects: [] } satisfies AbilityDefinition);
const rules = (id: string, ...list: readonly RuleSpec[]) => constant(id, { rules: list });

/** The first wording's three exceptions, on whatever `target` names. */
const unlessFlyingOrRanged = (target: TargetQuery): RuleSpec => ({
  kind: "cannotTakeDamage",
  target,
  exceptAttacker: { trait: FLY },
  exceptAttackCard: { trait: FLY },
  exceptAttackKeyword: "ranged",
});
const OUT_OF_REACH = rules("out-of-reach.constant", unlessFlyingOrRanged({ self: true }));
/** The same rule on a player's identity, to aim retaliate and indirect damage at it. */
const SHELTER = rules("shelter.constant", unlessFlyingOrRanged(anyIdentity));
/** The same rule on a minion, for an overkill attack that is blocked. */
const HOVERING = rules("hovering.constant", unlessFlyingOrRanged({ self: true }));
/** The second wording. */
const SHRINKING = rules("shrinking.constant", {
  kind: "reduceDamageTaken",
  target: { self: true },
  amount: 1,
  fromAttack: true,
  exceptAttacker: { trait: TINY },
});
/** The third wording. */
const BOMBARD = rules("bombard.constant", {
  kind: "characterIgnores",
  target: { self: true },
  ignores: ["guard", "retaliate"],
  against: { withoutTrait: FLY },
});
/** A player's character that ignores retaliate against anyone. */
const SLIPPERY = rules("slippery.constant", {
  kind: "characterIgnores",
  target: anyIdentity,
  ignores: ["retaliate"],
});
const WINGS = constant("wings.constant", { traitGrants: [{ trait: FLY, target: anyIdentity }] });
const SMALL = constant("small.constant", { traitGrants: [{ trait: TINY, target: anyIdentity }] });
const THORNS = constant("thorns.constant", {
  keywordGrants: [{ keyword: { name: "retaliate", value: 1 }, target: anyIdentity }],
});
/** "Your basic attacks gain ranged": ranged granted to the attack, not printed on the attacker. */
const BOW = rules("bow.constant", { kind: "attackKeywords", keywords: ["ranged"], basicOnly: true });
/** Counts every retaliate ignored, whoever ignored it. */
const WATCH = stubAbility("watch.response", {
  trigger: { kind: "response", forced: true, on: { on: "keywordIgnored", eventIs: { ignored: ["retaliate"] } } },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "ignored", amount: n(1) }],
});
/** "Action (attack): Deal 2 damage to the villain", on an upgrade. */
const LAUNCHER_ATTACK = stubAbility("launcher.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "attack", target: theVillain, amount: n(2) }],
});

type Ref = StubAbility["ref"];
const villain = (id: string, abilities: readonly Ref[], keywords: readonly { name: "ranged" }[] = []) =>
  stubVillain({ id, stages: [{ hp: flat(40), atk: 2, sch: 1, abilities, keywords }] });
const PLAIN_V = villain("plain-villain", []);
const REACH_V = villain("reach-villain", [OUT_OF_REACH.ref]);
const BOMBARD_V = villain("bombard-villain", [BOMBARD.ref]);
const RANGED_BOMBARD_V = villain("ranged-bombard-villain", [BOMBARD.ref], [{ name: "ranged" }]);
const VILLAINS = [PLAIN_V, REACH_V, BOMBARD_V, RANGED_BOMBARD_V];

const support = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
const SHELTER_S = support("shelter", SHELTER);
const WINGS_S = support("wings", WINGS);
const SMALL_S = support("small", SMALL);
const THORNS_S = support("thorns", THORNS);
const BOW_S = support("bow", BOW);
const WATCH_S = support("watch", WATCH);
const SLIPPERY_S = support("slippery", SLIPPERY);
const RECORDER = stubSupport({ id: "recorder", cost: 0 });
const FLY_LAUNCHER = stubUpgrade({ id: "fly-launcher", traits: [FLY], cost: 0, abilities: [LAUNCHER_ATTACK.ref] });
const PLAIN_LAUNCHER = stubUpgrade({ id: "plain-launcher", cost: 0, abilities: [LAUNCHER_ATTACK.ref] });
const SUPPORTS = [SHELTER_S, WINGS_S, SMALL_S, THORNS_S, BOW_S, WATCH_S, SLIPPERY_S, RECORDER];

const FLY_ALLY = stubAlly({ id: "fly-ally", traits: [FLY], cost: 0, atk: 2, thw: 1, hp: 4 });
const PLAIN_ALLY = stubAlly({ id: "plain-ally", cost: 0, atk: 2, thw: 1, hp: 4 });
const RANGED_ALLY = stubAlly({ id: "ranged-ally", cost: 0, atk: 2, thw: 1, hp: 4, keywords: [{ name: "ranged" }] });
const ALLIES = [FLY_ALLY, PLAIN_ALLY, RANGED_ALLY];

const DUMMY = stubMinion({ id: "dummy", atk: 1, sch: 1, boostIcons: 0, hp: 3 });
const HOVERER = stubMinion({ id: "hoverer", atk: 1, sch: 1, boostIcons: 0, hp: 3, abilities: [HOVERING.ref] });
const SHRINKER = stubMinion({ id: "shrinker", atk: 1, sch: 1, boostIcons: 0, hp: 3, abilities: [SHRINKING.ref] });
const BIG_SHRINKER = stubMinion({
  id: "big-shrinker",
  atk: 1,
  sch: 1,
  boostIcons: 0,
  hp: 10,
  abilities: [SHRINKING.ref],
});
const SPIKY = stubMinion({
  id: "spiky",
  atk: 1,
  sch: 1,
  boostIcons: 0,
  hp: 9,
  keywords: [{ name: "retaliate", value: 2 }],
});
const MINIONS = [DUMMY, HOVERER, SHRINKER, BIG_SHRINKER, SPIKY];
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const actionEvent = (id: string, effects: readonly EffectSpec[], traits: readonly (typeof FLY)[] = []) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: { ...stubEvent({ id, cost: 0, abilities: [ability.ref] }), traits }, ability };
};
const attackVillain = (amount: number, extra: Partial<Extract<EffectSpec, { kind: "attack" }>> = {}): EffectSpec[] => [
  { kind: "attack", target: theVillain, amount: n(amount), ...extra },
];
const recordExcess: EffectSpec = {
  kind: "addCounters",
  target: { kind: "each", query: { categories: ["support"], name: "recorder" } },
  counterType: "excess",
  amount: { kind: "var", name: "hit.excessDealt" },
};
const attackMinion = (amount: number, extra: Partial<Extract<EffectSpec, { kind: "attack" }>> = {}): EffectSpec[] => [
  { kind: "attack", target: theMinion, amount: n(amount), bind: "hit", ...extra },
  recordExcess,
];
const PLAIN_ATTACK = actionEvent("plain-attack", attackVillain(2));
const FLY_ATTACK = actionEvent("fly-attack", attackVillain(2), [FLY]);
const RANGED_ATTACK = actionEvent("ranged-attack", attackVillain(2, { keywords: ["ranged"] }));
const PIERCING_ATTACK = actionEvent("piercing-attack", attackVillain(2, { keywords: ["piercing"] }));
const ZAP = actionEvent("zap", [{ kind: "dealDamage", target: theVillain, amount: n(2) }]);
const FLY_ZAP = actionEvent("fly-zap", [{ kind: "dealDamage", target: theVillain, amount: n(2) }], [FLY]);
const SPREAD = actionEvent("spread", [{ kind: "dealIndirectDamage", to: { kind: "controller" }, amount: n(3) }]);
const SMASH = actionEvent("smash", attackMinion(6, { overkill: true }));
const FLY_SMASH = actionEvent("fly-smash", attackMinion(6, { overkill: true }), [FLY]);
const RANGED_SMASH = actionEvent("ranged-smash", attackMinion(6, { overkill: true, keywords: ["ranged"] }));
const TINY_SMASH = actionEvent("tiny-smash", attackMinion(6, { overkill: true }), [TINY]);
const JAB = actionEvent("jab", attackMinion(3));
const TAP = actionEvent("tap", attackMinion(1));
const MINION_ZAP = actionEvent("minion-zap", [{ kind: "dealDamage", target: theMinion, amount: n(3) }]);
const PROVOKE = actionEvent("provoke", [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "controller" } }]);
const EVENTS = [
  PLAIN_ATTACK,
  FLY_ATTACK,
  RANGED_ATTACK,
  PIERCING_ATTACK,
  ZAP,
  FLY_ZAP,
  SPREAD,
  SMASH,
  FLY_SMASH,
  RANGED_SMASH,
  TINY_SMASH,
  JAB,
  TAP,
  MINION_ZAP,
  PROVOKE,
];

const deps: EngineDeps = depsOf(
  OUT_OF_REACH,
  SHELTER,
  HOVERING,
  SHRINKING,
  BOMBARD,
  SLIPPERY,
  WINGS,
  SMALL,
  THORNS,
  BOW,
  WATCH,
  LAUNCHER_ATTACK,
  ...EVENTS.map((e) => e.ability),
);

type InPlay = (typeof SUPPORTS)[number] | (typeof ALLIES)[number] | typeof FLY_LAUNCHER;
interface Table {
  readonly state: GameState;
  /** The cards put into play, in the order asked. */
  readonly ids: readonly InstanceId[];
  readonly minion: InstanceId | null;
  readonly hero: InstanceId;
  readonly villain: InstanceId;
}

/** Hero form, `inPlay` under the player's control, `minion` engaged, blank boost cards. */
function table(
  v: (typeof VILLAINS)[number],
  inPlay: readonly InPlay[] = [],
  minion: (typeof MINIONS)[number] | null = null,
): Table {
  const playerCards = [...SUPPORTS, ...ALLIES, FLY_LAUNCHER, PLAIN_LAUNCHER, ...EVENTS.map((e) => e.card)];
  const base = gameAtFirstTurn({
    cards: [...VILLAINS, ...MINIONS, BLANK, ...playerCards],
    deps,
    villain: v,
    encounter: [...MINIONS.flatMap((m) => copiesOf(m.id, 2)), ...copiesOf(BLANK.id, 20)],
    deck: playerCards.flatMap((c) => copiesOf(c.id as CardId, 2)),
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const ids: InstanceId[] = [];
  for (const card of inPlay) {
    const placed = playerCardIntoPlay(state, card.id);
    state = placed.state;
    ids.push(placed.id);
  }
  let minionId: InstanceId | null = null;
  if (minion) {
    const engaged = minionEngagedWith(state, minion.id);
    state = engaged.state;
    minionId = engaged.id;
  }
  return {
    state,
    ids,
    minion: minionId,
    hero: mustPlayer(state, P1).identity.instanceId,
    villain: state.villains[0]!.instanceId,
  };
}
const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const withTough = (state: GameState, id: InstanceId): GameState => {
  const instance = mustInstance(state, id);
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...instance, statuses: { ...instance.statuses, tough: 1 } } },
  };
};
const basicAttack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const blocked = (events: readonly GameEvent[], target: InstanceId) =>
  events.filter(
    (e) => e.type === "damagePrevented" && e.targetInstanceId === target && e.reason === "cannotTakeDamage",
  );
const play = (t: Table, event: (typeof EVENTS)[number]) => playFree(t.state, deps, event.card.id);

describe("§3.30 'cannot take damage unless the attacker or attack has the trait, or the attack has ranged'", () => {
  it("a basic attack by a hero with the trait damages; one without it is no valid attack (RRG 1.8 'Target', p. 43)", () => {
    const flying = table(REACH_V, [WINGS_S]);
    const after = runCommands(flying.state, deps, basicAttack(flying.hero, flying.villain));
    expect(damageOn(after.state, flying.villain)).toBe(HERO_ATK);

    const grounded = table(REACH_V);
    const refused = applyCommand(grounded.state, basicAttack(grounded.hero, grounded.villain), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
  });

  it("an attack made through a card without the trait, by a hero without it, deals 0, logged as 'cannot take damage'", () => {
    const t = table(REACH_V);
    const after = play(t, PLAIN_ATTACK);
    expect(damageOn(after.state, t.villain)).toBe(0);
    expect(blocked(after.events, t.villain)).toEqual([
      { type: "damagePrevented", targetInstanceId: t.villain, amount: 2, reason: "cannotTakeDamage" },
    ]);
  });

  it("'the attack has the trait': an attack event with the trait damages, from a hero without it", () => {
    const t = table(REACH_V);
    const after = play(t, FLY_ATTACK);
    expect(damageOn(after.state, t.villain)).toBe(2);
    expect(blocked(after.events, t.villain)).toEqual([]);
  });

  it("'the attack has the trait': an upgrade's attack ability counts with the upgrade's trait, and not without it", () => {
    const use = (upgrade: InstanceId): Command => ({
      type: "useAbility",
      playerId: P1,
      cardInstanceId: upgrade,
      abilityId: LAUNCHER_ATTACK.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
      payment: [],
    });
    const flying = table(REACH_V, [FLY_LAUNCHER]);
    expect(damageOn(runCommands(flying.state, deps, use(flying.ids[0]!)).state, flying.villain)).toBe(2);
    const plain = table(REACH_V, [PLAIN_LAUNCHER]);
    expect(damageOn(runCommands(plain.state, deps, use(plain.ids[0]!)).state, plain.villain)).toBe(0);
  });

  it("the attacker's trait counts whatever card makes the attack: a hero with it playing a plain attack event", () => {
    const t = table(REACH_V, [WINGS_S]);
    expect(damageOn(play(t, PLAIN_ATTACK).state, t.villain)).toBe(2);
  });

  it("an attack with ranged damages: printed on an ally, granted to an event's attack, granted to basic attacks", () => {
    const ally = table(REACH_V, [RANGED_ALLY]);
    expect(damageOn(runCommands(ally.state, deps, basicAttack(ally.ids[0]!, ally.villain)).state, ally.villain)).toBe(
      2,
    );

    const event = table(REACH_V);
    expect(damageOn(play(event, RANGED_ATTACK).state, event.villain)).toBe(2);

    const bow = table(REACH_V, [BOW_S]);
    expect(damageOn(runCommands(bow.state, deps, basicAttack(bow.hero, bow.villain)).state, bow.villain)).toBe(
      HERO_ATK,
    );
  });

  it("an ally with the trait damages with its basic attack; an ally without it cannot make the attack", () => {
    const flying = table(REACH_V, [FLY_ALLY]);
    const after = runCommands(flying.state, deps, basicAttack(flying.ids[0]!, flying.villain));
    expect(damageOn(after.state, flying.villain)).toBe(2);

    const plain = table(REACH_V, [PLAIN_ALLY]);
    const refused = applyCommand(plain.state, basicAttack(plain.ids[0]!, plain.villain), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
  });

  // §4.1 Q17: damage with no attack behind it meets none of the exceptions, the card's trait included, so the villain
  // is no valid target of an ability that only deals it damage (RRG 1.8 "Target", p. 43).
  it("non-attack damage is blocked, even from a card with the trait or a hero with it (Q17)", () => {
    expect(() => play(table(REACH_V), ZAP)).toThrow(/no valid target/);
    expect(() => play(table(REACH_V), FLY_ZAP)).toThrow(/no valid target/);
    expect(() => play(table(REACH_V, [WINGS_S]), ZAP)).toThrow(/no valid target/);
    // Without the rule the same event deals its 2.
    const open = table(PLAIN_V);
    expect(damageOn(play(open, ZAP).state, open.villain)).toBe(2);
  });

  it("retaliate is blocked (Q17): a sheltered hero with the trait takes none of a minion's retaliate 2", () => {
    const sheltered = table(PLAIN_V, [SHELTER_S, WINGS_S], SPIKY);
    const after = runCommands(sheltered.state, deps, basicAttack(sheltered.hero, sheltered.minion!));
    expect(damageOn(after.state, sheltered.minion!)).toBe(HERO_ATK);
    expect(damageOn(after.state, sheltered.hero)).toBe(0);
    expect(blocked(after.events, sheltered.hero)).toEqual([
      { type: "damagePrevented", targetInstanceId: sheltered.hero, amount: 2, reason: "cannotTakeDamage" },
    ]);
    // Without the rule the retaliate lands.
    const open = table(PLAIN_V, [WINGS_S], SPIKY);
    expect(damageOn(runCommands(open.state, deps, basicAttack(open.hero, open.minion!)).state, open.hero)).toBe(2);
  });

  it("indirect damage is blocked (Q17): none can be assigned to the sheltered hero", () => {
    const sheltered = table(PLAIN_V, [SHELTER_S, WINGS_S]);
    const after = play(sheltered, SPREAD);
    expect(damageOn(after.state, sheltered.hero)).toBe(0);
    expect(after.events.filter((e) => e.type === "damageDealt")).toEqual([]);
    const open = table(PLAIN_V);
    expect(damageOn(play(open, SPREAD).state, open.hero)).toBe(3);
  });

  it("piercing does not get around it, and discards no tough status card (RRG 1.8 'Piercing', p. 32)", () => {
    const t = table(REACH_V);
    const after = playFree(withTough(t.state, t.villain), deps, PIERCING_ATTACK.card.id);
    expect(damageOn(after.state, t.villain)).toBe(0);
    expect(mustInstance(after.state, t.villain).statuses.tough).toBe(1);
  });

  // RRG 1.8 "'Cannot'" (p. 11) is absolute; "Tough" (p. 44) replaces damage the character "would take", and it would
  // take none. An attack that gets through uses the card as usual ("Damage", p. 14, step 2).
  it("blocked damage does not spend a tough status card; damage that gets through does", () => {
    const t = table(REACH_V);
    const tough = withTough(t.state, t.villain);
    const stopped = playFree(tough, deps, PLAIN_ATTACK.card.id);
    expect(mustInstance(stopped.state, t.villain).statuses.tough).toBe(1);
    expect(stopped.events.filter((e) => e.type === "damagePrevented")).toEqual([
      { type: "damagePrevented", targetInstanceId: t.villain, amount: 2, reason: "cannotTakeDamage" },
    ]);
    const through = playFree(tough, deps, FLY_ATTACK.card.id);
    expect(mustInstance(through.state, t.villain).statuses.tough).toBe(0);
    expect(damageOn(through.state, t.villain)).toBe(0);
  });

  it("overkill from a blocked attack does not spill: the minion takes nothing, so nothing is excess", () => {
    const t = table(PLAIN_V, [RECORDER], HOVERER);
    const after = play(t, SMASH);
    expect(damageOn(after.state, t.minion!)).toBe(0);
    expect(damageOn(after.state, t.villain)).toBe(0);
    expect(after.events.filter((e) => e.type === "overkillSpilled")).toEqual([]);
    expect(mustInstance(after.state, t.ids[0]!).counters["excess"] ?? 0).toBe(0);
  });

  // RRG 1.8 "Overkill" (p. 31): the spill "is considered damage from an attack", so it is read with that attack's
  // attacker, card and keywords: 6 against 3 hit points spills 3.
  it("an overkill spill onto the villain is that attack's damage: blocked, or through by the event's trait or ranged", () => {
    const plain = table(REACH_V, [RECORDER], DUMMY);
    const stopped = play(plain, SMASH);
    expect(damageOn(stopped.state, plain.villain)).toBe(0);
    expect(blocked(stopped.events, plain.villain)).toEqual([
      { type: "damagePrevented", targetInstanceId: plain.villain, amount: 3, reason: "cannotTakeDamage" },
    ]);
    const byTrait = table(REACH_V, [RECORDER], DUMMY);
    expect(damageOn(play(byTrait, FLY_SMASH).state, byTrait.villain)).toBe(3);
    const byRanged = table(REACH_V, [RECORDER], DUMMY);
    expect(damageOn(play(byRanged, RANGED_SMASH).state, byRanged.villain)).toBe(3);
  });
});

describe("§3.30 'reduce the damage taken from each attack by 1 unless the attacker has the trait'", () => {
  // RRG 1.8 "Overkill" (p. 31): excess is measured on damage taken, and "excess damage dealt" is the overkill value
  // (user decision 2026-09-25; February 8, 2026 - Ruling 2 counted 3 dealt).
  it("6 against 3 hit points: 5 taken, 2 excess, 2 spilled", () => {
    const t = table(PLAIN_V, [RECORDER], SHRINKER);
    const after = play(t, SMASH);
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", targetInstanceId: t.minion!, amount: 5 }),
    );
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: "overkillSpilled", fromInstanceId: t.minion!, amount: 2 }),
    );
    expect(damageOn(after.state, t.villain)).toBe(2);
    expect(mustInstance(after.state, t.ids[0]!).counters["excess"]).toBe(2);
  });

  it("an attacker with the excepting trait takes no reduction: 6 taken, 3 excess", () => {
    const t = table(PLAIN_V, [RECORDER, SMALL_S], SHRINKER);
    const after = play(t, SMASH);
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", targetInstanceId: t.minion!, amount: 6 }),
    );
    expect(damageOn(after.state, t.villain)).toBe(3);
    expect(mustInstance(after.state, t.ids[0]!).counters["excess"]).toBe(3);
  });

  it("'the attacker has the trait' is the character's: the trait on the attack's event does not except it", () => {
    const t = table(PLAIN_V, [RECORDER], SHRINKER);
    const after = play(t, TINY_SMASH);
    expect(damageOn(after.state, t.villain)).toBe(2);
    expect(mustInstance(after.state, t.ids[0]!).counters["excess"]).toBe(2);
  });

  it("two attacks in a turn each reduce: 3 and 3 are 2 and 2", () => {
    const t = table(PLAIN_V, [RECORDER], BIG_SHRINKER);
    const first = play(t, JAB);
    expect(damageOn(first.state, t.minion!)).toBe(2);
    const second = playFree(first.state, deps, JAB.card.id);
    expect(damageOn(second.state, t.minion!)).toBe(4);
  });

  it("damage that is not from an attack is not reduced ('from each attack')", () => {
    const t = table(PLAIN_V, [RECORDER], BIG_SHRINKER);
    expect(damageOn(play(t, MINION_ZAP).state, t.minion!)).toBe(3);
  });

  it("an attack reduced to 0 damages and defeats nothing, logged as reduced", () => {
    const t = table(PLAIN_V, [RECORDER], SHRINKER);
    const after = play(t, TAP);
    expect(damageOn(after.state, t.minion!)).toBe(0);
    expect(after.events.filter((e) => e.type === "damagePrevented")).toEqual([
      { type: "damagePrevented", targetInstanceId: t.minion!, amount: 1, reason: "reduced" },
    ]);
    expect(after.events.filter((e) => e.type === "characterDefeated")).toEqual([]);
    expect(mustInstance(after.state, t.ids[0]!).counters["excess"] ?? 0).toBe(0);
  });
});

describe("§3.30 'ignores the retaliate keyword while attacking a non-[trait] character'", () => {
  const ignoredCount = (state: GameState, watch: InstanceId) => mustInstance(state, watch).counters["ignored"] ?? 0;

  it("retaliate does not hit the ignoring attacker, and the ignore is announced once", () => {
    const t = table(BOMBARD_V, [THORNS_S, WATCH_S]);
    const after = play(t, PROVOKE);
    // The villain's ATK 2, undefended, with a blank boost card.
    expect(damageOn(after.state, t.hero)).toBe(2);
    expect(damageOn(after.state, t.villain)).toBe(0);
    expect(ignoredCount(after.state, t.ids[1]!)).toBe(1);
  });

  it("against a character with the trait the rule does not hold: retaliate 1 lands, nothing is announced", () => {
    const t = table(BOMBARD_V, [THORNS_S, WATCH_S, WINGS_S]);
    const after = play(t, PROVOKE);
    expect(damageOn(after.state, t.villain)).toBe(1);
    expect(ignoredCount(after.state, t.ids[1]!)).toBe(0);
  });

  // Wave 6 §4.1 Q6: announced only when the keyword would otherwise have applied.
  it("nothing is announced when there was no retaliate to ignore, or the attack's ranged already ignored it", () => {
    const none = table(BOMBARD_V, [WATCH_S]);
    expect(ignoredCount(play(none, PROVOKE).state, none.ids[0]!)).toBe(0);

    const ranged = table(RANGED_BOMBARD_V, [THORNS_S, WATCH_S]);
    const after = play(ranged, PROVOKE);
    expect(damageOn(after.state, ranged.villain)).toBe(0);
    expect(ignoredCount(after.state, ranged.ids[1]!)).toBe(0);
  });

  it("without the rule the same attack takes the retaliate", () => {
    const t = table(PLAIN_V, [THORNS_S, WATCH_S]);
    const after = play(t, PROVOKE);
    expect(damageOn(after.state, t.villain)).toBe(1);
    expect(ignoredCount(after.state, t.ids[1]!)).toBe(0);
  });

  it("a player's character can ignore it too: no retaliate 2 from the minion it attacks, announced once", () => {
    const t = table(PLAIN_V, [SLIPPERY_S, WATCH_S], SPIKY);
    const after = runCommands(t.state, deps, basicAttack(t.hero, t.minion!));
    expect(damageOn(after.state, t.minion!)).toBe(HERO_ATK);
    expect(damageOn(after.state, t.hero)).toBe(0);
    expect(ignoredCount(after.state, t.ids[1]!)).toBe(1);
  });

  it("a rule with `against` waives only retaliate: guard is read with no attacked character", () => {
    const t = table(BOMBARD_V);
    expect(characterIgnores(t.state, deps, t.villain, "guard")).toBe(false);
    expect(characterIgnores(t.state, deps, t.villain, "retaliate", false, t.hero)).toBe(true);
    expect(characterIgnores(t.state, deps, t.villain, "retaliate")).toBe(false);
  });
});
