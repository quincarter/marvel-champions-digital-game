/**
 * An ability's attack cannot target an enemy that cannot take its damage.
 *
 * RRG 1.8 "Target" (pp. 42-43): "A target that 'cannot take damage' is not a valid target for an ability or game
 * function whose only effect on that target is to deal it damage", and "If an ability or game function has multiple
 * effects on its target, the target is valid if at least one of those effects can affect the target." Ruling Mar 19,
 * 2026 (2) applies the first to a basic attack (`basic-attack-cannot-take-damage.test.ts`); this is the same rule for
 * an `attack` effect, judged where every other target is (`resolve/target-validity.ts`).
 *
 * RRG 1.8 "Stun, Stunned" (p. 41): "A stunned character can attempt to attack or use an attack ability even if it has
 * no valid target for an attack."
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubMinion, stubSupport, stubVillain } from "./testing/fixtures.js";
import { giveCard, newGame, RESOURCE, runWith, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn: Command = { type: "endTurn", playerId: p1 };
const toHero: Command = { type: "changeForm", playerId: p1 };

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(50), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 9, boostIcons: 0 });

const n = (value: number) => ({ kind: "const", value }) as const;
const you = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: you };
const enemy: TargetRef = { kind: "slot", slot: "enemy" };
/** "An enemy" your identity may attack (the DSL's `anAttackableEnemy`). */
const chooseEnemy: EffectSpec = {
  kind: "chooseTarget",
  slot: "enemy",
  chooser: you,
  query: { categories: ["enemy"], attackableBy: yourIdentity },
};

const event = (id: string, effects: readonly EffectSpec[], label?: "attack") => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    ...(label ? { label: [label] } : {}),
    effects,
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Hero Action (attack): Deal 3 damage to an enemy." */
const STRIKE = event("strike", [chooseEnemy, { kind: "attack", target: enemy, amount: n(3) }], "attack");
/** "…Deal 3 damage to an enemy and stun it": two effects on the target. */
const STUNNING = event(
  "stunning",
  [
    chooseEnemy,
    { kind: "attack", target: enemy, amount: n(3) },
    { kind: "giveStatus", target: enemy, status: "stunned" },
  ],
  "attack",
);
/** "…Deal 3 damage to an enemy. This attack gains ranged." */
const SHOT = event(
  "shot",
  [chooseEnemy, { kind: "attack", target: enemy, amount: n(3), keywords: ["ranged"] }],
  "attack",
);
/** "…Deal 3 damage to the villain": a named target, no choice. */
const NAMED = event("named", [{ kind: "attack", target: { kind: "villain" }, amount: n(3) }], "attack");
/** "Deal 3 damage to an enemy" that is no attack, for the damage side of the same rule. */
const ZAP = event("zap", [
  { kind: "chooseTarget", slot: "enemy", chooser: you, query: { categories: ["enemy"] } },
  { kind: "dealDamage", target: enemy, amount: n(3) },
]);
const EVENTS = [STRIKE, STUNNING, SHOT, NAMED, ZAP];

const support = (id: string, rule: RuleSpec) => {
  const ability = stubAbility(`${id}.constant`, { trigger: { kind: "constant", rules: [rule] }, effects: [] });
  return { card: stubSupport({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "The villain cannot take damage." */
const SHIELD = support("shield", { kind: "cannotTakeDamage", target: { categories: ["villain"] } });
/** "The villain cannot take damage from events": scoped by the card making the attack. */
const WARD = support("ward", {
  kind: "cannotTakeDamage",
  target: { categories: ["villain"] },
  fromSource: { categories: ["event"] },
});
/** "The villain cannot take damage from heroes": scoped by the attacker. */
const DODGE = support("dodge", {
  kind: "cannotTakeDamage",
  target: { categories: ["villain"] },
  fromSource: { categories: ["hero"] },
});
/** "The villain cannot take damage unless the attack has ranged." */
const ALOFT = support("aloft", {
  kind: "cannotTakeDamage",
  target: { categories: ["villain"] },
  exceptAttackKeyword: "ranged",
});
const SUPPORTS = [SHIELD, WARD, DODGE, ALOFT];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability), ...SUPPORTS.map((s) => s.ability));

interface Table {
  readonly state: GameState;
  readonly hero: InstanceId;
  readonly villain: InstanceId;
  /** The minion engaged with P1; absent when the table was asked for none. */
  readonly minion: InstanceId | null;
}

const play = (card: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
});

/** P1's second turn in hero form, `rule` in play when given, and the minion the first villain phase engaged. */
function table(rule?: (typeof SUPPORTS)[number], opts: { readonly minion?: boolean } = {}): Table {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [THUG, ...EVENTS.map((e) => e.card), ...SUPPORTS.map((s) => s.card)],
    encounterDeck: Array.from({ length: 12 }, () => THUG.id),
    deck: [
      ...Array.from({ length: 18 }, () => RESOURCE.id),
      ...EVENTS.map((e) => e.card.id),
      ...SUPPORTS.map((s) => s.card.id),
    ],
    deps,
  });
  let state = settle(runWith(deps, start, toHero, endTurn), undefined, deps);
  if (rule) {
    const given = giveCard(state, p1, rule.card.id);
    state = runWith(deps, given.state, play(given.id));
  }
  const engaged = mustPlayer(state, p1).playArea.find((id) => state.instances[id]?.cardId === THUG.id);
  if (!engaged) throw new Error("no minion engaged");
  if (opts.minion === false) {
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === p1 ? { ...p, playArea: p.playArea.filter((id) => id !== engaged) } : p,
      ),
    };
  }
  return {
    state,
    hero: mustPlayer(state, p1).identity.instanceId,
    villain: activeVillain(state).instanceId,
    minion: opts.minion === false ? null : engaged,
  };
}

/** Plays `card` for 0: the engine's answer, the enemies its prompt offered (none when it asked nothing), the end state. */
function attempt(at: Table, card: (typeof EVENTS)[number], pick?: InstanceId) {
  const given = giveCard(at.state, p1, card.card.id);
  const legal = legalActions(given.state, p1, deps);
  const offeredToPlay =
    legal.kind === "turn" && legal.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === given.id);
  const result = applyCommand(given.state, play(given.id), deps);
  if (!result.ok)
    return { ok: false as const, code: result.error.code, offeredToPlay, given: given.state, id: given.id };
  const choice = result.state.pendingChoice;
  const offered = choice?.prompt.kind === "chooseTarget" ? choice.options.map((o) => o.optionId) : [];
  const state = settle(result.state, pick ? () => [pick] : undefined, deps);
  return { ok: true as const, offeredToPlay, offered, state };
}
const damage = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const stunned = (state: GameState, id: InstanceId) => mustInstance(state, id).statuses.stunned;
const withStun = (at: Table): Table => ({
  ...at,
  state: {
    ...at.state,
    instances: {
      ...at.state.instances,
      [at.hero]: { ...mustInstance(at.state, at.hero), statuses: { stunned: 1, confused: 0, tough: 0 } },
    },
  },
});

describe("an attack ability against an enemy that cannot take its damage (RRG 1.8 'Target', p. 43)", () => {
  it("the control: with no such rule both enemies are offered, and the villain takes the damage", () => {
    const at = table();
    const r = attempt(at, STRIKE, at.villain);
    if (!r.ok) throw new Error(r.code);
    expect([...r.offered].sort()).toEqual([at.villain, at.minion].sort());
    expect(damage(r.state, at.villain)).toBe(3);
  });

  it("the enemy that cannot take damage is not offered; the one that can is attacked", () => {
    const at = table(SHIELD);
    const r = attempt(at, STRIKE);
    if (!r.ok) throw new Error(r.code);
    expect(r.offeredToPlay).toBe(true);
    expect(r.offered).not.toContain(at.villain);
    expect(damage(r.state, at.villain)).toBe(0);
    expect(damage(r.state, at.minion!)).toBe(3);
  });

  it("with no enemy that can take the damage the ability cannot be initiated: refused, not offered, nothing paid", () => {
    const at = table(SHIELD, { minion: false });
    const r = attempt(at, STRIKE);
    expect(r).toMatchObject({ ok: false, code: "no_valid_target", offeredToPlay: false });
    if (!r.ok) expect(mustPlayer(r.given, p1).hand).toContain(r.id);
  });

  it("an attack with a second effect on its target keeps that target: it is stunned and takes no damage", () => {
    const at = table(SHIELD, { minion: false });
    const r = attempt(at, STUNNING);
    if (!r.ok) throw new Error(r.code);
    expect(damage(r.state, at.villain)).toBe(0);
    expect(stunned(r.state, at.villain)).toBe(1);
  });

  it("a rule scoped by source reads the card making the attack and the attacker", () => {
    for (const rule of [WARD, DODGE]) {
      const at = table(rule);
      const r = attempt(at, STRIKE);
      if (!r.ok) throw new Error(r.code);
      expect(r.offered).not.toContain(at.villain);
      expect(damage(r.state, at.minion!)).toBe(3);
      expect(attempt(table(rule, { minion: false }), STRIKE).ok).toBe(false);
    }
  });

  it("a rule lifted by an attack keyword reads the keywords the effect gives its attack", () => {
    const at = table(ALOFT, { minion: false });
    expect(attempt(at, STRIKE).ok).toBe(false);
    const shot = attempt(at, SHOT);
    if (!shot.ok) throw new Error(shot.code);
    expect(damage(shot.state, at.villain)).toBe(3);
  });

  it("an attack that names its target cannot be initiated while that target cannot take its damage", () => {
    expect(attempt(table(SHIELD), NAMED)).toMatchObject({ ok: false, code: "no_valid_target" });
    const free = table();
    const r = attempt(free, NAMED);
    if (!r.ok) throw new Error(r.code);
    expect(damage(r.state, free.villain)).toBe(3);
  });

  it("damage that is no attack follows the same rule", () => {
    const at = table(SHIELD);
    const r = attempt(at, ZAP);
    if (!r.ok) throw new Error(r.code);
    expect(r.offered).not.toContain(at.villain);
    expect(damage(r.state, at.minion!)).toBe(3);
    expect(attempt(table(SHIELD, { minion: false }), ZAP).ok).toBe(false);
  });

  it("a stunned hero may still use the attack ability with no valid target; the stunned card is discarded (p. 41)", () => {
    const at = withStun(table(SHIELD, { minion: false }));
    const r = attempt(at, STRIKE);
    if (!r.ok) throw new Error(r.code);
    expect(r.offeredToPlay).toBe(true);
    expect(stunned(r.state, at.hero)).toBe(0);
    expect(damage(r.state, at.villain)).toBe(0);
  });
});
