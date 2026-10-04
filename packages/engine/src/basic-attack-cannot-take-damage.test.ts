/**
 * A basic attack cannot target an enemy that cannot take damage from it.
 *
 * RRG 1.8 "Target" (p. 43): "A target that 'cannot take damage' is not a valid target for an ability or game function
 * whose only effect on that target is to deal it damage." Ruling Mar 19, 2026 (2): "Basic powers are game functions,
 * but the rule that a target that cannot take damage is not a valid target applies equally to basic powers."
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
import { stubAlly, stubMainScheme, stubMinion, stubSupport, stubVillain } from "./testing/fixtures.js";
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
/** "The villain cannot take damage from allies." */
const BOUNCER_RULE = constantRule("bouncer", {
  kind: "cannotTakeDamage",
  target: { categories: ["villain"] },
  fromSource: { categories: ["ally"] },
});
const DRAGNET = stubSupport({ id: "dragnet", cost: 0, abilities: [DRAGNET_RULE.ref] });
const BOUNCER = stubSupport({ id: "bouncer", cost: 0, abilities: [BOUNCER_RULE.ref] });
const deps: EngineDeps = depsOf(DRAGNET_RULE, BOUNCER_RULE);

interface Table {
  readonly state: GameState;
  readonly hero: InstanceId;
  readonly ally: InstanceId;
  readonly villain: InstanceId;
  readonly minion: InstanceId;
}

/** P1's second turn in hero form: an ally in play, a minion engaged, and `support` in play when given. */
function table(support?: typeof DRAGNET): Table {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [THUG, BUDDY, DRAGNET, BOUNCER],
    encounterDeck: Array.from({ length: 12 }, () => THUG.id),
    deck: [...Array.from({ length: 18 }, () => RESOURCE.id), BUDDY.id, DRAGNET.id, BOUNCER.id],
    deps,
  });
  const play = (state: GameState, card: string) => {
    const given = giveCard(state, p1, card);
    const played = runWith(deps, given.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    return { state: played, id: given.id };
  };
  // The first villain phase engages a minion; the ally and the support are played on the second turn.
  const second = settle(runWith(deps, start, toHero, endTurn), undefined, deps);
  const ally = play(second, BUDDY.id);
  const state = support ? play(ally.state, support.id).state : ally.state;
  const player = mustPlayer(state, p1);
  const minion = player.playArea.find((id) => state.instances[id]?.cardId === THUG.id);
  if (!minion) throw new Error("no minion engaged");
  return {
    state,
    hero: player.identity.instanceId,
    ally: ally.id,
    villain: activeVillain(state).instanceId,
    minion,
  };
}

const attack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: p1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

/** What `legalActions` says about `attacker`'s basic attack: the targets offered and the targets blocked. */
function offered(at: Table, attacker: InstanceId) {
  const actions = legalActions(at.state, p1, deps);
  if (actions.kind !== "turn") throw new Error("not P1's turn");
  const isAttack = (action: { kind: string; instanceId?: InstanceId }) =>
    action.kind === "basicAttack" && action.instanceId === attacker;
  const legal = actions.legal.find((entry) => isAttack(entry.action));
  const illegal = actions.illegal.find((entry) => isAttack(entry.action));
  return {
    targets: legal?.targets ?? [],
    blocked: (legal?.blockedTargets ?? illegal?.blockedTargets ?? []).map((b) => [b.instanceId, b.reason]),
  };
}

describe("a basic attack against an enemy that cannot take damage (RRG 1.8 p. 43; ruling Mar 19, 2026 (2))", () => {
  it("the control: with no such rule the villain and the minion are both legal targets, and the villain takes damage", () => {
    const at = table();
    expect([...offered(at, at.hero).targets].sort()).toEqual([at.villain, at.minion].sort());
    const after = settle(runWith(deps, at.state, attack(at.hero, at.villain)), undefined, deps);
    expect(mustInstance(after, at.villain).damage).toBeGreaterThan(0);
  });

  it("the command is refused, and nothing is paid: the attacker stays ready", () => {
    const at = table(DRAGNET);
    for (const attacker of [at.hero, at.ally]) {
      const result = applyCommand(at.state, attack(attacker, at.villain), deps);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("no_valid_target");
      expect(mustInstance(at.state, attacker).exhausted).toBe(false);
    }
  });

  it("legal actions do not offer that target, and say why; a minion that can take damage is still offered", () => {
    const at = table(DRAGNET);
    for (const attacker of [at.hero, at.ally]) {
      const { targets, blocked } = offered(at, attacker);
      expect(targets).toEqual([at.minion]);
      expect(blocked).toEqual([[at.villain, "no_valid_target"]]);
    }
    const after = settle(runWith(deps, at.state, attack(at.hero, at.minion)), undefined, deps);
    expect(mustInstance(after, at.minion).damage).toBeGreaterThan(0);
  });

  it("a rule scoped by source is asked of the attacker: 'cannot take damage from allies' stops only the ally", () => {
    const at = table(BOUNCER);
    expect(offered(at, at.ally).targets).toEqual([at.minion]);
    expect(applyCommand(at.state, attack(at.ally, at.villain), deps).ok).toBe(false);
    expect([...offered(at, at.hero).targets].sort()).toEqual([at.villain, at.minion].sort());
    const after = settle(runWith(deps, at.state, attack(at.hero, at.villain)), undefined, deps);
    expect(mustInstance(after, at.villain).damage).toBeGreaterThan(0);
  });
});
