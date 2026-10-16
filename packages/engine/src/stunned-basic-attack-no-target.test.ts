/**
 * A stunned character may attempt its basic attack with no valid target: the attempt removes the stunned status card.
 *
 * RRG v1.8 p.41 "Stun, Stunned": "A stunned character can attempt to attack or use an attack ability even if it has no
 * valid target for an attack", and a stunned status card resolves as "Forced Interrupt: When this character would
 * attack, remove each stunned status card from it instead." RRG v1.8 p.9 "Attack (Player)" and "Basic Power" (p. 10):
 * the basic power's cost, exhausting, is paid all the same.
 *
 * "No valid target" here is the villain that cannot take damage (RRG 1.8 "Target", p. 43; ruling Mar 19, 2026 (2)) with
 * no minion in play.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubMainScheme, stubMinion, stubSupport, stubUpgrade, stubVillain } from "./testing/fixtures.js";
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
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 3, resources: 1, consequentialAttack: 0 });
const constantRule = (id: string, rule: RuleSpec) =>
  stubAbility(`${id}.constant`, { trigger: { kind: "constant", rules: [rule] }, effects: [] });
/** "The villain cannot take damage." */
const DRAGNET_RULE = constantRule("dragnet", { kind: "cannotTakeDamage", target: { categories: ["villain"] } });
const DRAGNET = stubSupport({ id: "dragnet", cost: 0, abilities: [DRAGNET_RULE.ref] });
/**
 * Vision's Intangible mass form (26002): "Vision cannot attack or defend." The engine's tests cannot import the card
 * scripts, so this is the same rule `26002.intangible-constant` scripts: `cannotAttack` on the host, every enemy.
 */
const INTANGIBLE_RULE = constantRule("intangible", {
  kind: "cannotAttack",
  attacker: { hostOfSelf: true },
  target: { categories: ["enemy"] },
});
const INTANGIBLE = stubUpgrade({ id: "intangible", cost: 0, abilities: [INTANGIBLE_RULE.ref] });
/** "Attached character cannot attack villains": a prohibition scoped to some targets, which a stunned attempt waives. */
const NO_VILLAINS_RULE = constantRule("noVillains", {
  kind: "cannotAttack",
  attacker: { hostOfSelf: true },
  target: { categories: ["villain"] },
});
const NO_VILLAINS = stubUpgrade({ id: "noVillains", cost: 0, abilities: [NO_VILLAINS_RULE.ref] });
/** "Attach to your identity. You cannot make basic attacks." */
const CHARM_RULE = constantRule("charm", {
  kind: "cannotAttack",
  attacker: { hostOfSelf: true },
  target: { categories: ["enemy"] },
  basicOnly: true,
});
const CHARM = stubUpgrade({ id: "charm", cost: 0, abilities: [CHARM_RULE.ref] });
const UPGRADES = [INTANGIBLE, NO_VILLAINS, CHARM];
const deps: EngineDeps = depsOf(DRAGNET_RULE, INTANGIBLE_RULE, NO_VILLAINS_RULE, CHARM_RULE);

interface Table {
  readonly state: GameState;
  readonly hero: InstanceId;
  readonly ally: InstanceId;
  readonly villain: InstanceId;
}

/**
 * P1's second turn in hero form: an ally and the support in play, the engaged minion taken away, `stunned` stunned, and
 * `onHero` attached to the hero in that order (so their rules are in force in that order).
 */
function table(stunned: readonly ("hero" | "ally")[], onHero: readonly (typeof UPGRADES)[number][] = []): Table {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [THUG, BUDDY, DRAGNET, ...UPGRADES],
    encounterDeck: Array.from({ length: 12 }, () => THUG.id),
    deck: [...Array.from({ length: 18 }, () => RESOURCE.id), BUDDY.id, DRAGNET.id, ...UPGRADES.map((u) => u.id)],
    deps,
  });
  const play = (state: GameState, card: string, attachTo: InstanceId | null = null) => {
    const given = giveCard(state, p1, card);
    const played = runWith(deps, given.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: attachTo,
    });
    return { state: played, id: given.id };
  };
  const second = settle(runWith(deps, start, toHero, endTurn), undefined, deps);
  const ally = play(second, BUDDY.id);
  const hero = mustPlayer(second, p1).identity.instanceId;
  let played = play(ally.state, DRAGNET.id).state;
  for (const upgrade of onHero) played = play(played, upgrade.id, hero).state;
  for (const upgrade of onHero) {
    const id = Object.keys(played.instances).find((key) => played.instances[key]?.cardId === upgrade.id);
    if (!id || mustInstance(played, id as InstanceId).attachedTo !== hero) throw new Error(`${upgrade.id} not on hero`);
  }
  const stun = (id: InstanceId, on: boolean) => ({
    ...mustInstance(played, id),
    statuses: { stunned: on ? 1 : 0, confused: 0, tough: 0 },
  });
  const state: GameState = {
    ...played,
    players: played.players.map((p) =>
      p.playerId === p1 ? { ...p, playArea: p.playArea.filter((id) => !isMinionOf(played, id)) } : p,
    ),
    instances: {
      ...played.instances,
      [hero]: stun(hero, stunned.includes("hero")),
      [ally.id]: stun(ally.id, stunned.includes("ally")),
    },
  };
  return { state, hero, ally: ally.id, villain: activeVillain(state).instanceId };
}
const isMinionOf = (state: GameState, id: InstanceId) => state.instances[id]?.cardId === THUG.id;

const attack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: p1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

function offered(state: GameState, attacker: InstanceId) {
  const actions = legalActions(state, p1, deps);
  if (actions.kind !== "turn") throw new Error("not P1's turn");
  const is = (entry: { action: { kind: string; instanceId?: InstanceId } }) =>
    entry.action.kind === "basicAttack" && entry.action.instanceId === attacker;
  return { legal: actions.legal.find(is), illegal: actions.illegal.find(is) };
}

describe("RRG v1.8 p.41: a stunned character attempts a basic attack with no valid target", () => {
  it("the table has no valid target: no minion in play and the villain cannot take damage", () => {
    const at = table([]);
    expect(mustPlayer(at.state, p1).playArea.some((id) => isMinionOf(at.state, id))).toBe(false);
    for (const attacker of [at.hero, at.ally]) {
      const { legal, illegal } = offered(at.state, attacker);
      expect(legal).toBeUndefined();
      expect(illegal?.blockedTargets.map((b) => [b.instanceId, b.reason])).toEqual([[at.villain, "no_valid_target"]]);
    }
  });

  it("a character that is not stunned still cannot attack, and nothing is paid", () => {
    const at = table([]);
    for (const attacker of [at.hero, at.ally]) {
      const result = applyCommand(at.state, attack(attacker, at.villain), deps);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("no_valid_target");
      expect(mustInstance(at.state, attacker).exhausted).toBe(false);
    }
  });

  for (const who of ["hero", "ally"] as const) {
    it(`a stunned ${who} is offered the attempt by legal actions`, () => {
      const at = table([who]);
      const attacker = who === "hero" ? at.hero : at.ally;
      expect(offered(at.state, attacker).legal?.targets).toEqual([at.villain]);
      // The other character, not stunned, is still not offered it.
      expect(offered(at.state, who === "hero" ? at.ally : at.hero).legal).toBeUndefined();
    });

    it(`a stunned ${who}'s attempt exhausts it and removes the stun card, dealing no damage`, () => {
      const at = table([who]);
      const attacker = who === "hero" ? at.hero : at.ally;
      const result = applyCommand(at.state, attack(attacker, at.villain), deps);
      if (!result.ok) throw new Error(result.error.message);
      const after = settle(result.state, undefined, deps);
      expect(mustInstance(after, attacker).exhausted).toBe(true);
      expect(mustInstance(after, attacker).statuses.stunned).toBe(0);
      expect(mustInstance(after, at.villain).damage).toBe(0);
    });
  }
});

/**
 * Only the target is waived. FFG ruling 2023-01-18 (Vision, Intangible): "No attack attempt can be made that removing
 * Stunned would replace"; RRG v1.8 p.11 "'Cannot'": the word is absolute.
 */
describe("FFG ruling 2023-01-18 (Vision, Intangible); RRG v1.8 p.11: a stunned character that cannot attack makes no attempt", () => {
  const refusedAndUntouched = (at: Table, message: string) => {
    expect(offered(at.state, at.hero).legal).toBeUndefined();
    const result = applyCommand(at.state, attack(at.hero, at.villain), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("no_valid_target");
      expect(result.error.message).toBe(message);
    }
    expect(mustInstance(at.state, at.hero).statuses.stunned).toBe(1);
    expect(mustInstance(at.state, at.hero).exhausted).toBe(false);
  };

  it("a stunned hero in Intangible form ('cannot attack') is not offered the attempt and is refused; the stun stays", () => {
    refusedAndUntouched(table(["hero"], [INTANGIBLE]), "intangible: this character cannot attack");
  });

  it("the stunned ally of that player is not bound by the hero's Intangible and still makes its attempt", () => {
    const at = table(["ally"], [INTANGIBLE]);
    expect(offered(at.state, at.ally).legal?.targets).toEqual([at.villain]);
    const after = settle(runWith(deps, at.state, attack(at.ally, at.villain)), undefined, deps);
    expect(mustInstance(after, at.ally).statuses.stunned).toBe(0);
  });

  it("a prohibition scoped to some targets ('cannot attack villains') is waived like any other invalid target", () => {
    const at = table(["hero"], [NO_VILLAINS]);
    expect(offered(at.state, at.hero).legal?.targets).toEqual([at.villain]);
    const after = settle(runWith(deps, at.state, attack(at.hero, at.villain)), undefined, deps);
    expect(mustInstance(after, at.hero).exhausted).toBe(true);
    expect(mustInstance(after, at.hero).statuses.stunned).toBe(0);
  });

  it("'you cannot make basic attacks' is found behind a target-scoped rule in force before it", () => {
    refusedAndUntouched(table(["hero"], [NO_VILLAINS, CHARM]), "charm: you cannot make basic attacks");
  });

  it("a hero that is not stunned is refused in the basic-only rule's name even with the other rule in force first", () => {
    const at = table([], [NO_VILLAINS, CHARM]);
    const result = applyCommand(at.state, attack(at.hero, at.villain), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("charm: you cannot make basic attacks");
  });
});
