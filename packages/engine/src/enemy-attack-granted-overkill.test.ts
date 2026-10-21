/**
 * An enemy attack reads an overkill granted to the attack by a constant `attackKeywords` rule ("Each enemy attack gains
 * overkill", Wild Wild Mojo, `mojo` 39066), the same as one the enemy has itself or one `modifyAttack` gave the attack.
 *
 * RRG 1.8 "Overkill" (p. 31): "If an ally is defeated by an attack with the overkill keyword, deal any damage on that
 * ally beyond its hit points to the identity of the player who controls the ally." The keyword belongs to the attack,
 * so the enemy making it does not have the keyword.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { defendPreview } from "./defend-preview.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard, newGame, payFor, RESOURCE, runWith, settleUntil } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn: Command = { type: "endTurn", playerId: p1 };
const toHero: Command = { type: "changeForm", playerId: p1 };

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(200), atk: 4, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** 3 hit points against the villain's 4 ATK: defending defeats it with 1 damage beyond its hit points. */
const BUDDY = stubAlly({ id: "buddy", cost: 2, atk: 1, thw: 1, hp: 3, resources: 1 });

const grant = (id: string, attacker: TargetQuery) =>
  stubAbility(`${id}.constant`, {
    trigger: { kind: "constant", rules: [{ kind: "attackKeywords", keywords: ["overkill"], attacker }] },
    effects: [],
  });
/** "Each enemy attack gains overkill." */
const EACH_ENEMY = grant("western", { categories: ["enemy"] });
/** "Each minion attack gains overkill.": the villain's attack is not one. */
const EACH_MINION = grant("posse", { categories: ["minion"] });
const WESTERN = stubSupport({ id: "western", cost: 0, abilities: [EACH_ENEMY.ref] });
const POSSE = stubSupport({ id: "posse", cost: 0, abilities: [EACH_MINION.ref] });
const deps: EngineDeps = depsOf(EACH_ENEMY, EACH_MINION);

/** Parked on the defend prompt of the villain's attack: the ally in play, and `support` too when given. */
function atDefense(support?: typeof WESTERN): { state: GameState; ally: InstanceId; hero: InstanceId } {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [BLANK, BUDDY, WESTERN, POSSE],
    encounterDeck: Array.from({ length: 12 }, () => BLANK.id),
    deck: [...Array.from({ length: 18 }, () => RESOURCE.id), BUDDY.id, WESTERN.id, POSSE.id],
    deps,
  });
  const ally = giveCard(start, p1, BUDDY.id);
  let state = runWith(deps, ally.state, toHero, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: ally.id,
    payment: payFor(ally.state, p1, 2),
    attachToInstanceId: null,
  });
  if (support) {
    const given = giveCard(state, p1, support.id);
    state = runWith(deps, given.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
  }
  state = settleUntil(runWith(deps, state, endTurn), "declareDefender", deps);
  return { state, ally: ally.id, hero: mustPlayer(state, p1).identity.instanceId };
}

/** The ally defends the villain's attack; returns what spilled and the damage left on the hero. */
function defended(support?: typeof WESTERN) {
  const at = atDefense(support);
  const pick = (state: GameState) =>
    state.pendingChoice?.prompt.kind === "declareDefender" &&
    state.pendingChoice.options.some((o) => o.optionId === at.ally)
      ? [at.ally as string]
      : defaultPick(state);
  const { state, events } = runCommandsPicking(at.state, deps, pick);
  const spills = events.filter(
    (e): e is Extract<GameEvent, { type: "overkillSpilled" }> => e.type === "overkillSpilled",
  );
  return { at, state, spills, heroDamage: mustInstance(state, at.hero).damage };
}

describe("an overkill granted to enemy attacks by a constant rule (RRG 1.8 p. 31)", () => {
  it("the control: without the rule, the damage beyond a defeated ally's hit points is lost", () => {
    const { state, at, spills, heroDamage } = defended();
    expect(mustPlayer(state, p1).playArea).not.toContain(at.ally);
    expect(spills).toEqual([]);
    expect(heroDamage).toBe(0);
  });

  it("with the rule, the villain's attack spills it onto the ally's controller's identity", () => {
    const { state, at, spills, heroDamage } = defended(WESTERN);
    expect(mustPlayer(state, p1).playArea).not.toContain(at.ally);
    expect(spills).toEqual([{ type: "overkillSpilled", fromInstanceId: at.ally, toInstanceId: at.hero, amount: 1 }]);
    expect(heroDamage).toBe(1);
    // The attack has the keyword; the enemy making it does not.
    expect(hasKeyword(state, activeVillain(state).instanceId, "overkill", deps)).toBe(false);
  });

  it("the rule's `attacker` scopes it: a grant to minion attacks leaves the villain's attack without overkill", () => {
    const { spills, heroDamage } = defended(POSSE);
    expect(spills).toEqual([]);
    expect(heroDamage).toBe(0);
  });

  it("the defend preview shows the same spill before the defender is chosen", () => {
    const bandsFor = (support?: typeof WESTERN) => {
      const at = atDefense(support);
      const option = defendPreview(at.state, deps)?.find((o) => o.defenderInstanceId === at.ally);
      if (!option) throw new Error("no preview for the ally");
      return option.bands.map((band) => [band.overkillToInstanceId === at.hero, band.overkillAmount]);
    };
    expect(bandsFor()).toEqual([[false, 0]]);
    expect(bandsFor(WESTERN)).toEqual([[true, 1]]);
    expect(bandsFor(POSSE)).toEqual([[false, 0]]);
  });
});

/**
 * Ruling January 11, 2026 (2) (`marvel-champions-rulings-post-rrg-1-7.md`): "if Jigsaw attacks with overkill and damages
 * both an ally and an identity, his Forced Response triggers twice" (and Captain Marvel's "attacks and defeats" for an
 * ally and an identity). The engine resolves "after [enemy] attacks and damages ..." once per attack.
 */
/** Toad's shape (32076): "Forced Response: After [this enemy] attacks and damages a character you control, ..." */
const TOAD = stubAbility("toad.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "enemyAttack", requireResults: { damage: 1 } },
  },
  effects: [
    { kind: "addCounters", target: { kind: "mainScheme" }, counterType: "toad", amount: { kind: "const", value: 1 } },
  ],
} as AbilityDefinition);
/** One support carries both: the overkill grant (Wild Wild Mojo's shape) and the response, which listens to any enemy's attack. */
const WESTERN_TOAD = stubSupport({ id: "western-toad", cost: 0, abilities: [EACH_ENEMY.ref, TOAD.ref] });
const toadDeps: EngineDeps = depsOf(EACH_ENEMY, TOAD);

describe("'After [enemy] attacks and damages ...' with overkill damaging an ally and the identity (ruling Jan 11, 2026 (2))", () => {
  function overkillAttack(): number {
    const start = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [BLANK, BUDDY, WESTERN_TOAD],
      encounterDeck: Array.from({ length: 12 }, () => BLANK.id),
      deck: [...Array.from({ length: 18 }, () => RESOURCE.id), BUDDY.id, WESTERN_TOAD.id],
      deps: toadDeps,
    });
    const ally = giveCard(start, p1, BUDDY.id);
    let state = runWith(
      toadDeps,
      ally.state,
      { type: "changeForm", playerId: p1 },
      {
        type: "playCard",
        playerId: p1,
        cardInstanceId: ally.id,
        payment: payFor(ally.state, p1, 2),
        attachToInstanceId: null,
      },
    );
    const rule = giveCard(state, p1, WESTERN_TOAD.id);
    state = runWith(toadDeps, rule.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: rule.id,
      payment: [],
      attachToInstanceId: null,
    });
    state = settleUntil(runWith(toadDeps, state, { type: "endTurn", playerId: p1 }), "declareDefender", toadDeps);
    const pick = (s: GameState): readonly string[] =>
      s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === ally.id)
        ? [ally.id as string]
        : defaultPick(s);
    const { state: after } = runCommandsPicking(state, toadDeps, pick);
    return mustInstance(after, after.mainScheme.instanceId).counters["toad"] ?? 0;
  }

  it("the villain's attack damages the ally (3) and, by overkill, the identity (1): the response resolves twice", () => {
    // Before the fix: once (the attack event was announced once, whoever it damaged).
    expect(overkillAttack()).toBe(2);
  });
});

/** "Forced Response: After [enemy] attacks and defeats a character, ...": a defeat-gated response to any enemy's attack. */
const DEFEATS = stubAbility("defeats.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "enemyAttack", requireResults: { defeated: 1 } },
  },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "mainScheme" },
      counterType: "defeats",
      amount: { kind: "const", value: 1 },
    },
  ],
} as AbilityDefinition);
const WESTERN_DEFEATS = stubSupport({ id: "western-defeats", cost: 0, abilities: [EACH_ENEMY.ref, DEFEATS.ref] });
const defeatDeps: EngineDeps = depsOf(EACH_ENEMY, DEFEATS);

describe("'After [enemy] attacks and defeats ...' with overkill defeating an ally and the identity (ruling Jan 11, 2026 (2))", () => {
  // The same ruling's Captain Marvel answer: overkill defeating both an ally and an identity "triggers for both
  // instances". Two players, so the game goes on once p1's identity is defeated; the support is p2's, so it stays in
  // play when p1 is eliminated.
  it("the villain's attack defeats p1's ally and, by overkill, p1's identity (1 hit point left): the response resolves twice", () => {
    const p2 = playerId("p2");
    const start = newGame({
      players: 2,
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [BLANK, BUDDY, WESTERN_DEFEATS],
      encounterDeck: Array.from({ length: 12 }, () => BLANK.id),
      deck: [...Array.from({ length: 18 }, () => RESOURCE.id), BUDDY.id, WESTERN_DEFEATS.id],
      deps: defeatDeps,
    });
    const ally = giveCard(start, p1, BUDDY.id);
    let state = runWith(
      defeatDeps,
      ally.state,
      { type: "changeForm", playerId: p1 },
      {
        type: "playCard",
        playerId: p1,
        cardInstanceId: ally.id,
        payment: payFor(ally.state, p1, 2),
        attachToInstanceId: null,
      },
      { type: "endTurn", playerId: p1 },
    );
    const rule = giveCard(state, p2, WESTERN_DEFEATS.id);
    state = runWith(defeatDeps, rule.state, {
      type: "playCard",
      playerId: p2,
      cardInstanceId: rule.id,
      payment: [],
      attachToInstanceId: null,
    });
    const hero = mustPlayer(state, p1).identity.instanceId;
    state = { ...state, instances: { ...state.instances, [hero]: { ...mustInstance(state, hero), damage: 9 } } };
    state = settleUntil(runWith(defeatDeps, state, { type: "endTurn", playerId: p2 }), "declareDefender", defeatDeps);
    const pick = (s: GameState): readonly string[] =>
      s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === ally.id)
        ? [ally.id as string]
        : defaultPick(s);
    const { state: after } = runCommandsPicking(state, defeatDeps, pick);
    expect(after.players.find((seat) => seat.playerId === p1)?.eliminated).toBe(true);
    expect(mustInstance(after, after.mainScheme.instanceId).counters["defeats"] ?? 0).toBe(2);
  });
});
