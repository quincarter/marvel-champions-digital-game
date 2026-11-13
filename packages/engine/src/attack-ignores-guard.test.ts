/**
 * "This attack ignores guard" (`EffectSpec attack.ignores`): one attack that a guard minion engaged with its player does
 * not stop, for the whole of it, from the choice of its enemy to its end. Shaped on Hammer Throw (community pack
 * `throg-ptt`): "Hero Action (attack/thwart): … deal 4 damage to an enemy … This attack ignores guard".
 *
 * Sources: the card text; RRG 1.8 "Ignore" (p. 23), "Guard" (p. 21: "that player cannot use cards they control to attack
 * a villain without this keyword"), "Attack (Player Ability Type)" (p. 10), "Target" (p. 43: "A target that cannot be
 * attacked is not a valid target for an attack-labeled ability").
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { canAttack } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMainScheme, stubMinion, stubSupport, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard, newGame, RESOURCE, runWith, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn: Command = { type: "endTurn", playerId: p1 };
const toHero: Command = { type: "changeForm", playerId: p1 };

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(50), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
const BODYGUARD = stubMinion({ id: "bodyguard", atk: 0, sch: 0, hp: 9, boostIcons: 0, keywords: [{ name: "guard" }] });

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
/** "Hero Action (attack): Deal 4 damage to an enemy. This attack ignores guard." */
const THROW = event(
  "throw",
  [chooseEnemy, { kind: "attack", target: enemy, amount: n(4), ignores: ["guard"] }],
  "attack",
);
/** The same attack without the waiver. */
const STRIKE = event("strike", [chooseEnemy, { kind: "attack", target: enemy, amount: n(4) }], "attack");
/** "Hero Action (attack): Deal 3 damage to the villain. This attack ignores guard." A named target. */
const BOLT = event(
  "bolt",
  [{ kind: "attack", target: { kind: "villain" }, amount: n(3), ignores: ["guard"] }],
  "attack",
);
/** "Hero Action (attack): Deal 3 damage to the villain." */
const PLAIN_BOLT = event("plain-bolt", [{ kind: "attack", target: { kind: "villain" }, amount: n(3) }], "attack");
/** "Hero Action (attack): Deal 2 damage to the villain. Deal 2 damage to the villain. This attack ignores guard." */
const VOLLEY = event(
  "volley",
  [
    { kind: "dealDamage", target: { kind: "villain" }, amount: n(2) },
    { kind: "attack", target: { kind: "villain" }, amount: n(2), ignores: ["guard"] },
  ],
  "attack",
);
/** An ally's unlabeled "Action: This ally attacks the villain for 1. This attack ignores guard." */
const LUNGE_ABILITY = stubAbility("buddy.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "attack", target: { kind: "villain" }, amount: n(1), attacker: { kind: "self" }, ignores: ["guard"] },
  ],
});
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [LUNGE_ABILITY.ref] });
/** "After you ignore guard": 1 damage to that minion, so the announcement is seen. */
const WATCH_ABILITY = stubAbility("watch.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "keywordIgnored", eventIs: { ignored: "guard" }, playerIs: "controller" },
  },
  effects: [{ kind: "dealDamage", target: { kind: "eventTarget" }, amount: n(1) }],
});
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_ABILITY.ref] });
/** "Your hero ignores the guard keyword" (Evasive Maneuvering's shape, `characterIgnores`). */
const EVASIVE_ABILITY = stubAbility("evasive.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "characterIgnores", target: { categories: ["hero"], controller: "you" }, ignores: ["guard"] }],
  },
  effects: [],
});
const EVASIVE = stubSupport({ id: "evasive", cost: 0, abilities: [EVASIVE_ABILITY.ref] });

const EVENTS = [THROW, STRIKE, BOLT, PLAIN_BOLT, VOLLEY];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability), LUNGE_ABILITY, WATCH_ABILITY, EVASIVE_ABILITY);

interface Table {
  readonly state: GameState;
  readonly hero: InstanceId;
  readonly villain: InstanceId;
  readonly guard: InstanceId;
}

const play = (card: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
});

/**
 * P1's second turn in hero form, with the guard minion the first villain phase engaged; `watch` and `evasive` in play
 * when asked.
 */
function table(opts: { readonly watch?: boolean; readonly evasive?: boolean } = {}): Table {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [BODYGUARD, BUDDY, WATCH, EVASIVE, ...EVENTS.map((e) => e.card)],
    encounterDeck: Array.from({ length: 12 }, () => BODYGUARD.id),
    deck: [
      ...Array.from({ length: 18 }, () => RESOURCE.id),
      BUDDY.id,
      WATCH.id,
      EVASIVE.id,
      ...EVENTS.map((e) => e.card.id),
    ],
    deps,
  });
  let state = settle(runWith(deps, start, toHero, endTurn), undefined, deps);
  for (const support of [...(opts.watch ? [WATCH] : []), ...(opts.evasive ? [EVASIVE] : [])]) {
    const given = giveCard(state, p1, support.id);
    state = runWith(deps, given.state, play(given.id));
  }
  const guard = mustPlayer(state, p1).playArea.find((id) => state.instances[id]?.cardId === BODYGUARD.id);
  if (!guard) throw new Error("no guard minion engaged");
  return {
    state,
    hero: mustPlayer(state, p1).identity.instanceId,
    villain: activeVillain(state).instanceId,
    guard,
  };
}

/** Plays `card` for 0, picking `pick` at its enemy choice: the engine's answer, the enemies offered, the end state. */
function attempt(at: Table, card: (typeof EVENTS)[number], pick?: InstanceId) {
  const given = giveCard(at.state, p1, card.card.id);
  const result = applyCommand(given.state, play(given.id), deps);
  if (!result.ok) return { ok: false as const, code: result.error.code };
  const choice = result.state.pendingChoice;
  const offered = choice?.prompt.kind === "chooseTarget" ? choice.options.map((o) => o.optionId) : [];
  const picker = (state: GameState): readonly string[] => {
    const pending = state.pendingChoice;
    if (pick && pending?.prompt.kind === "chooseTarget" && pending.options.some((o) => o.optionId === pick))
      return [pick];
    return defaultPick(state);
  };
  const state = settle(result.state, picker, deps);
  return { ok: true as const, offered, state };
}
const damage = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;

describe("an attack that ignores guard (`attack.ignores`; RRG 1.8 'Ignore', p. 23, 'Guard', p. 21)", () => {
  it("the control: with a guard minion engaged, the attack offers only the minion", () => {
    const at = table();
    const r = attempt(at, STRIKE);
    if (!r.ok) throw new Error(r.code);
    expect(r.offered).toEqual([at.guard]);
    expect(damage(r.state, at.villain)).toBe(0);
  });

  it("its enemy may be chosen past the guard minion, and the villain takes its damage", () => {
    const at = table();
    const r = attempt(at, THROW, at.villain);
    if (!r.ok) throw new Error(r.code);
    expect([...r.offered].sort()).toEqual([at.villain, at.guard].sort());
    expect(damage(r.state, at.villain)).toBe(4);
    expect(damage(r.state, at.guard)).toBe(0);
  });

  it("a named villain is a valid target, so the ability can be initiated; without the waiver it cannot", () => {
    const at = table();
    expect(attempt(at, PLAIN_BOLT)).toMatchObject({ ok: false, code: "no_valid_target" });
    const r = attempt(at, BOLT);
    if (!r.ok) throw new Error(r.code);
    expect(damage(r.state, at.villain)).toBe(3);
  });

  it("the waiver is the ability's whole attack: a damage instruction before its `attack` is not skipped", () => {
    const at = table();
    const r = attempt(at, VOLLEY);
    if (!r.ok) throw new Error(r.code);
    expect(damage(r.state, at.villain)).toBe(4);
  });

  it("it lasts for that attack only: the hero still cannot attack the villain afterwards", () => {
    const at = table();
    const r = attempt(at, THROW, at.villain);
    if (!r.ok) throw new Error(r.code);
    expect(canAttack(r.state, at.hero, at.villain, deps)).toBe(false);
    const next = attempt({ ...at, state: r.state }, STRIKE);
    if (!next.ok) throw new Error(next.code);
    expect(next.offered).toEqual([at.guard]);
  });

  it("an ally's unlabeled attack that ignores guard hits the villain", () => {
    const at = table();
    const given = giveCard(at.state, p1, BUDDY.id);
    const withAlly = runWith(deps, given.state, play(given.id));
    const used = runWith(deps, withAlly, {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: given.id,
      abilityId: LUNGE_ABILITY.ref.id,
      payment: [],
    });
    expect(damage(settle(used, undefined, deps), at.villain)).toBe(1);
  });

  it("'after you ignore guard' answers it once the attack is over, naming the guard minion", () => {
    const at = table({ watch: true });
    const r = attempt(at, THROW, at.villain);
    if (!r.ok) throw new Error(r.code);
    expect(damage(r.state, at.villain)).toBe(4);
    expect(damage(r.state, at.guard)).toBe(1);
  });

  it("the same announcement for a hero that ignores guard and attacks with an '(attack)' ability (regression)", () => {
    // The attack's frame was rewritten from a copy read before its ignored guard was recorded, so an "(attack)"
    // ability's attack (it waits for its ability, RRG 1.8 p. 10) never announced it; a basic attack did.
    const at = table({ watch: true, evasive: true });
    const r = attempt(at, PLAIN_BOLT);
    if (!r.ok) throw new Error(r.code);
    expect(damage(r.state, at.villain)).toBe(3);
    expect(damage(r.state, at.guard)).toBe(1);
  });

  it("an attack on the guard minion itself ignores nothing", () => {
    const at = table({ watch: true });
    const r = attempt(at, THROW, at.guard);
    if (!r.ok) throw new Error(r.code);
    expect(damage(r.state, at.guard)).toBe(4);
  });
});
