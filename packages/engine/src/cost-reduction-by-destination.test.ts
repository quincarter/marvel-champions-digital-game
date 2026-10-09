/**
 * docs/phase7-wave8.md §3.35 part (b): a lasting cost reduction that reads the play's destination
 * (`EffectSpec reduceNextCardCost` with `into` and `anyPlayer`; `LastingEffectBody costReduction.into`).
 *
 * "Reduce the cost of the next ally played to the mission this phase by 2." (RRG 1.8 p. 69, the erratum that added
 * "this phase".) RRG 1.8 "Cost" (p. 13): a cost cannot be reduced below 0. "Lasting Effects" (p. 26): the effect
 * expires at its timing point whether or not it was used. The card says "the next ally played", not "you play": the
 * next ally any player plays into the area uses it. An ally played to a player's own area is priced without it and
 * leaves it waiting. Synthetic cards only.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import { playCostOf } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions, paymentFor } from "./legal.js";
import { locateCard, mustPlayer } from "./query.js";
import { requirementTotal } from "./resources.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMainScheme, stubSideScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard, RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const AREA = "mission";
const INTO = { scenarioPlayArea: AREA } as const;
const THERE = { inScenarioPlayArea: AREA } as const;
const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const find = (name: string): TargetRef => ({ kind: "find", query: { name } });

const ERRAND = stubSideScheme({ id: "errand", startingThreat: 5, boostIcons: 0 });
const schemeThere: Predicate = { kind: "exists", query: { categories: ["sideScheme"], ...THERE } };
const RULES: readonly RuleSpec[] = [
  { kind: "playDestination", cards: { categories: ["ally"] }, area: AREA, while: schemeThere },
];

const SCOUT = stubAlly({ id: "scout", cost: 3, atk: 2, thw: 1, hp: 2 });
const RUNNER = stubAlly({ id: "runner", cost: 2, atk: 1, thw: 1, hp: 2 });
const GUARD = stubAlly({ id: "guard", cost: 1, atk: 1, thw: 1, hp: 2 });

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const OPEN = action(
  "open",
  { kind: "createScenarioPlayArea", name: AREA, closed: true },
  { kind: "putIntoPlay", card: find(ERRAND.name), controller: you, into: INTO },
);
/** "Reduce the cost of the next ally played to the mission this phase by 2." */
const BRIEF = action("brief", {
  kind: "reduceNextCardCost",
  player: you,
  amount: n(2),
  duration: "phase",
  cardFilter: { categories: ["ally"] },
  into: INTO,
  anyPlayer: true,
});
/** "Reduce the cost of the next ally you play to the mission this phase by 2.": the acting player's own. */
const BRIEF_MINE = action("brief-mine", {
  kind: "reduceNextCardCost",
  player: you,
  amount: n(2),
  duration: "phase",
  cardFilter: { categories: ["ally"] },
  into: INTO,
});
const EVENTS = [OPEN, BRIEF, BRIEF_MINE];

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const areaCards = (state: GameState) => state.scenarioPlayAreas?.[AREA]?.cards ?? [];
const reductions = (state: GameState) => state.lastingEffects.filter((e) => e.kind === "costReduction");
const heroForm = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
});
const apply = (state: GameState, ...commands: readonly Command[]) => {
  const { session, events } = driveSession(startSession(state), deps, commands);
  return { state: session.state, events, session };
};
const playFree = (state: GameState, card: { card: { id: CardId } }, player: PlayerId = P1) => {
  const given = giveCard(state, player, card.card.id);
  return apply(given.state, {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  }).state;
};

function start(): GameState {
  const base = gameAtFirstTurn({
    cards: [ERRAND, SCOUT, RUNNER, GUARD, NOISE, ...EVENTS.map((e) => e.card)],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    players: 2,
    encounter: [ERRAND.id, ...copiesOf(NOISE.id, 14)],
    deck: [SCOUT.id, SCOUT.id, RUNNER.id, GUARD.id, ...EVENTS.map((e) => e.card.id)],
    scenarioRuleSpecs: RULES,
  });
  return heroForm(playFree(base, OPEN));
}

/** Plays `card` from `player`'s hand, paying exactly `cost` resource cards, optionally into the area. */
function play(state: GameState, card: CardId, opts: { into?: boolean; cost: number; player?: PlayerId }) {
  const player = opts.player ?? P1;
  const given = giveCard(state, player, card);
  let current = given.state;
  const payment: Payment[] = [];
  const used: InstanceId[] = [];
  for (let i = 0; i < opts.cost; i++) {
    const resource = giveCard(current, player, RESOURCE.id, used);
    current = resource.state;
    used.push(resource.id);
    payment.push({ fromHand: resource.id });
  }
  const command: Command = {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment,
    attachToInstanceId: null,
    ...(opts.into ? { into: INTO } : {}),
  };
  const result = sessionApply(startSession(current), command, deps);
  if (!result.ok) return { ok: false as const, error: result.error, id: given.id };
  const driven = driveSession(result.session, deps);
  return {
    ok: true as const,
    id: given.id,
    state: driven.session.state,
    events: [...result.events, ...driven.events],
    session: driven.session,
  };
}
const mustPlay = (...args: Parameters<typeof play>) => {
  const result = play(...args);
  if (!result.ok) throw new Error(result.error.message);
  return result;
};
/** P1 ends their turn: P2's turn, in the same player phase, in hero form. */
const toP2 = (state: GameState): GameState => heroForm(apply(state, { type: "endTurn", playerId: P1 }).state);

describe("§3.35 (b) a cost reduction for the next card played into an area", () => {
  it("is one lasting effect that names the area and waits for any player", () => {
    const briefed = playFree(start(), BRIEF);
    expect(reductions(briefed)).toMatchObject([
      {
        kind: "costReduction",
        playerId: P1,
        amount: 2,
        into: INTO,
        anyPlayer: true,
        duration: { kind: "endOfPhase" },
      },
    ]);
  });

  it("test 1: the next player plays a cost-3 ally to the area for 1; a second ally to the area that phase costs its printed cost", () => {
    const briefed = toP2(playFree(start(), BRIEF));
    expect(briefed.step.phase).toBe("player");
    expect(reductions(briefed)).toHaveLength(1);
    // Two resources short of 3 is refused at the player's own area and accepted at the area.
    expect(play(briefed, SCOUT.id, { cost: 1, player: P2 }).ok).toBe(false);
    const first = mustPlay(briefed, SCOUT.id, { into: true, cost: 1, player: P2 });
    expect(areaCards(first.state)).toContain(first.id);
    expect(of(first.events, "cardPlayed").find((e) => e.instanceId === first.id)).toMatchObject({ resourcesPaid: 1 });
    expect(reductions(first.state)).toEqual([]);
    expect(of(first.events, "lastingEffectEnded").map((e) => e.reason)).toEqual(["consumed"]);
    // The second ally to the area: full price.
    expect(play(first.state, RUNNER.id, { into: true, cost: 1, player: P2 }).ok).toBe(false);
    const second = mustPlay(first.state, RUNNER.id, { into: true, cost: 2, player: P2 });
    expect(areaCards(second.state)).toContain(second.id);
    const replayed = replay(second.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(second.state);
  });

  it("test 2: an ally played to the player's own area costs full and leaves it waiting; then a cost-2 ally goes to the area for nothing, and a cost-1 ally is not reduced below 0", () => {
    const briefed = playFree(start(), BRIEF);
    expect(play(briefed, SCOUT.id, { cost: 2 }).ok).toBe(false);
    const own = mustPlay(briefed, SCOUT.id, { cost: 3 });
    expect(mustPlayer(own.state, P1).playArea).toContain(own.id);
    expect(reductions(own.state)).toHaveLength(1);
    const there = mustPlay(own.state, RUNNER.id, { into: true, cost: 0 });
    expect(locateCard(there.state, there.id)).toEqual({ kind: "scenarioPlayArea", name: AREA });
    expect(reductions(there.state)).toEqual([]);
    // RRG 1.8 "Cost" (p. 13): never below 0, and the reduction is used whole.
    const cheap = mustPlay(briefed, GUARD.id, { into: true, cost: 0 });
    expect(reductions(cheap.state)).toEqual([]);
    expect(of(cheap.events, "cardPlayed").find((e) => e.instanceId === cheap.id)).toMatchObject({ resourcesPaid: 0 });
  });

  it("test 2: unused at the end of the player phase it is gone, and next round's first ally to the area costs full", () => {
    const briefed = playFree(start(), BRIEF);
    const round = apply(briefed, { type: "endTurn", playerId: P1 }, { type: "endTurn", playerId: P2 });
    expect(round.state.round).toBe(2);
    expect(reductions(round.state)).toEqual([]);
    expect(of(round.events, "lastingEffectEnded").map((e) => e.reason)).toContain("expired");
    const next = heroForm(round.state);
    const first = next.firstPlayerId;
    expect(play(next, SCOUT.id, { into: true, cost: 1, player: first }).ok).toBe(false);
    expect(play(next, SCOUT.id, { into: true, cost: 3, player: first }).ok).toBe(true);
  });

  it("without `anyPlayer` it waits for its own player's play only", () => {
    const briefed = toP2(playFree(start(), BRIEF_MINE));
    expect(reductions(briefed)).toHaveLength(1);
    expect(play(briefed, SCOUT.id, { into: true, cost: 1, player: P2 }).ok).toBe(false);
    const full = mustPlay(briefed, SCOUT.id, { into: true, cost: 3, player: P2 });
    expect(reductions(full.state)).toHaveLength(1);
  });

  it("the price a client reads follows the destination: 3 at home, 1 at the area; a player who can only pay there is offered that play alone", () => {
    const briefed = playFree(start(), BRIEF);
    const given = giveCard(briefed, P1, SCOUT.id);
    expect(playCostOf(given.state, P1, given.id, deps)).toMatchObject({ printed: 3, current: 3, reduction: 0 });
    expect(playCostOf(given.state, P1, given.id, deps, null, AREA)).toMatchObject({
      printed: 3,
      current: 1,
      reduction: 2,
    });
    const action = { kind: "playCard", instanceId: given.id } as const;
    expect(requirementTotal(paymentFor(given.state, P1, action, {}, deps)!.requirement)).toBe(3);
    expect(requirementTotal(paymentFor(given.state, P1, action, { into: AREA }, deps)!.requirement)).toBe(1);

    // A hand of the ally and one resource card: only the play into the area can be paid for.
    const resource = giveCard(given.state, P1, RESOURCE.id);
    const poor: GameState = {
      ...resource.state,
      players: resource.state.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: [given.id, resource.id],
              deck: [...p.deck, ...p.hand.filter((id) => id !== given.id && id !== resource.id)],
            }
          : p,
      ),
    };
    const listed = legalActions(poor, P1, deps);
    if (listed.kind !== "turn") throw new Error(listed.kind);
    const entry = listed.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === given.id);
    expect(entry).toMatchObject({ destinations: [AREA], destinationOnly: true });
    expect(entry?.example).toMatchObject({ into: INTO, payment: [{ fromHand: resource.id }] });
    // With the reduction gone the same hand cannot play it anywhere.
    const plain = legalActions({ ...poor, lastingEffects: [] }, P1, deps);
    if (plain.kind !== "turn") throw new Error(plain.kind);
    expect(plain.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === given.id)).toBe(false);
    // Affordable either way: both plays are offered and the example is the ordinary one.
    const rich = legalActions(given.state, P1, deps);
    if (rich.kind !== "turn") throw new Error(rich.kind);
    const both = rich.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === given.id);
    expect(both?.destinations).toEqual([AREA]);
    expect(both?.destinationOnly).toBeUndefined();
    expect(both?.example).not.toHaveProperty("into");
  });
});
