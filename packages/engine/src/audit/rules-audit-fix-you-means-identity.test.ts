/**
 * Audit fix `you-means-identity`: "After [enemy] attacks and damages you" checks the attacked player's identity (RRG 1.8
 * "You, Your", p. 49; FFG rulings 225.1 and 226, July 18, 2024), so a defending ally's damage is not heard, and an
 * overkill spill onto the identity is (ruling January 11, 2026 (2): each damaged character is its own condition), once.
 * The response here is Green Goblin's shape (02014, an encounter card with no controller), on a stub villain.
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "../abilities.js";
import { playerId } from "../ids.js";
import { mustInstance } from "../query.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { runCommandsPicking } from "../testing/drive.js";
import { stubAlly, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "../testing/fixtures.js";
import { defaultPick, giveCard, newGame, payFor, RESOURCE, runWith, settleUntil } from "../testing/scenario.js";

const p1 = playerId("p1");
/** "Forced Response: After Green Goblin attacks and damages you, place 1 threat on the main scheme" (as a counter). */
const GOBLIN = stubAbility("goblin.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: {
      on: "enemyAttack",
      sourceIs: { categories: ["villain"] },
      playerIs: "controller",
      usesAttackedPlayer: true,
      requireResults: { damage: 1 },
      youAreIdentity: true,
    },
  },
  effects: [
    { kind: "addCounters", target: { kind: "mainScheme" }, counterType: "goblin", amount: { kind: "const", value: 1 } },
  ],
} as AbilityDefinition);
const VILLAIN = stubVillain({
  id: "villain",
  stages: [{ hp: flat(200), atk: 4, sch: 1, abilities: [GOBLIN.ref] }],
});
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** 3 hit points against the villain's 4 ATK: defending, it is defeated with 1 damage beyond its hit points. */
const FRAIL = stubAlly({ id: "frail", cost: 2, atk: 1, thw: 1, hp: 3, resources: 1 });
/** 6 hit points: it takes the whole attack. */
const STURDY = stubAlly({ id: "sturdy", cost: 2, atk: 1, thw: 1, hp: 6, resources: 1 });
const GRANT = stubAbility("western.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "attackKeywords", keywords: ["overkill"], attacker: { categories: ["enemy"] } }],
  },
  effects: [],
});
const WESTERN = stubSupport({ id: "western", cost: 0, abilities: [GRANT.ref] });
const deps: EngineDeps = depsOf(GOBLIN, GRANT);

/** The villain attacks p1 once; returns how often the response resolved and the identity's damage. */
function villainAttacks(opts: {
  readonly ally: "frail" | "sturdy";
  readonly defend: boolean;
  readonly overkill: boolean;
}): {
  readonly responses: number;
  readonly identityDamage: number;
} {
  const allyCard = opts.ally === "frail" ? FRAIL : STURDY;
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [BLANK, FRAIL, STURDY, WESTERN],
    encounterDeck: Array.from({ length: 12 }, () => BLANK.id),
    deck: [...Array.from({ length: 18 }, () => RESOURCE.id), allyCard.id, WESTERN.id],
    deps,
  });
  const ally = giveCard(start, p1, allyCard.id);
  let state = runWith(
    deps,
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
  if (opts.overkill) {
    const rule = giveCard(state, p1, WESTERN.id);
    state = runWith(deps, rule.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: rule.id,
      payment: [],
      attachToInstanceId: null,
    });
  }
  state = settleUntil(runWith(deps, state, { type: "endTurn", playerId: p1 }), "declareDefender", deps);
  const pick = (s: GameState): readonly string[] => {
    if (s.pendingChoice?.prompt.kind !== "declareDefender") return defaultPick(s);
    if (opts.defend && s.pendingChoice.options.some((o) => o.optionId === ally.id)) return [ally.id as string];
    return s.pendingChoice.options.some((o) => o.optionId === "decline") ? ["decline"] : defaultPick(s);
  };
  const { state: after } = runCommandsPicking(state, deps, pick);
  const identity = after.players.find((p) => p.playerId === p1)!.identity.instanceId;
  return {
    responses: mustInstance(after, after.mainScheme.instanceId).counters["goblin"] ?? 0,
    identityDamage: mustInstance(after, identity).damage,
  };
}

describe("'After [villain] attacks and damages you': 'you' is the identity (RRG 1.8 p. 49; rulings 225.1/226)", () => {
  it("nobody defends: the identity is damaged and the response resolves once", () => {
    const run = villainAttacks({ ally: "sturdy", defend: false, overkill: false });
    expect(run.identityDamage).toBeGreaterThan(0);
    expect(run.responses).toBe(1);
  });

  it("an ally defends and takes all the damage: the identity is not damaged, the response does not resolve", () => {
    const run = villainAttacks({ ally: "sturdy", defend: true, overkill: false });
    expect(run.identityDamage).toBe(0);
    expect(run.responses).toBe(0);
  });

  it("an ally defends and overkill spills onto the identity: the response resolves once, for the identity only", () => {
    // Ruling January 11, 2026 (2): the ally and the identity are each a condition; only the identity is "you".
    const run = villainAttacks({ ally: "frail", defend: true, overkill: true });
    expect(run.identityDamage).toBe(1);
    expect(run.responses).toBe(1);
  });
});
