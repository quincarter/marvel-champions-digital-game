import { applyCommand } from "./engine.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { legalActions, type LegalActions } from "./legal.js";
import { mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion } from "./testing/fixtures.js";
import { ALLY, DEFAULT_DECK, giveCard, newGame, run, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const endTurn = (player: PlayerId) => ({ type: "endTurn", playerId: player }) as const;
const toHero = (player: PlayerId = p1) => ({ type: "changeForm", playerId: player }) as const;

function turn(result: LegalActions) {
  if (result.kind !== "turn") throw new Error(`expected a turn, got ${result.kind}`);
  return result;
}
const legalKinds = (result: LegalActions) => turn(result).legal.map((a) => a.action.kind);
const illegalFor = (result: LegalActions, kind: string, instanceId?: InstanceId) =>
  turn(result).illegal.find((a) => a.action.kind === kind && (instanceId === undefined || ("instanceId" in a.action && a.action.instanceId === instanceId)));
const legalFor = (result: LegalActions, kind: string, instanceId?: InstanceId) =>
  turn(result).legal.find((a) => a.action.kind === kind && (instanceId === undefined || ("instanceId" in a.action && a.action.instanceId === instanceId)));

/** Test surgery: the player's hand becomes exactly `ids`; everything else in it goes back on the deck. */
function withHand(state: GameState, player: PlayerId, ids: readonly InstanceId[]): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: [...ids], deck: [...p.hand.filter((id) => !ids.includes(id)), ...p.deck] } : p,
    ),
  };
}

describe("legalActions", () => {
  it("outside the player's own turn it reports what the game is waiting on", () => {
    const start = newGame({ players: 2 });
    expect(legalActions(start, p2)).toEqual({ kind: "notYourTurn", activePlayerId: p1 });
    const atDiscard = run(start, endTurn(p1), endTurn(p2));
    const result = legalActions(atDiscard, p1);
    expect(result.kind).toBe("choice");
    if (result.kind === "choice") expect(result.choice).toBe(atDiscard.pendingChoice);
  });

  it("an alter-ego may change form or end the turn, but not attack, thwart, or recover without damage", () => {
    const result = legalActions(newGame(), p1);
    expect(legalKinds(result)).toEqual(expect.arrayContaining(["changeForm", "endTurn"]));
    expect(illegalFor(result, "basicAttack")?.reason).toBe("wrong_form");
    expect(illegalFor(result, "basicThwart")?.reason).toBe("wrong_form");
    expect(illegalFor(result, "basicRecover")?.reason).toBe("no_valid_target");
    // Resource cards are discarded to pay costs, never played.
    for (const entry of turn(result).illegal.filter((a) => a.action.kind === "playCard")) {
      expect(["card_type_not_playable", "insufficient_resources"]).toContain(entry.reason);
    }
  });

  it("every legal action's example command is accepted, and a play pays with as few cards as possible", () => {
    const { state, id: ally } = giveCard(newGame(), p1, ALLY.id);
    const result = legalActions(state, p1);
    for (const entry of turn(result).legal) {
      expect(applyCommand(state, entry.example).ok).toBe(true);
    }
    const play = legalFor(result, "playCard", ally);
    expect(play?.needsPayment).toBe(true);
    // The ally costs 2 and every stub card is worth 1 resource.
    expect(play?.example.type === "playCard" && play.example.payment).toHaveLength(2);
  });

  it("a card the player can't pay for is illegal with insufficient_resources", () => {
    const given = giveCard(newGame(), p1, ALLY.id);
    const alone = withHand(given.state, p1, [given.id]);
    expect(illegalFor(legalActions(alone, p1), "playCard", given.id)?.reason).toBe("insufficient_resources");
  });

  it("a guard minion blocks attacks on the villain; the minion is the only legal target", () => {
    const guard = stubMinion({ id: "guard", atk: 0, sch: 0, hp: 4, boostIcons: 0, keywords: [{ name: "guard" }] });
    const start = newGame({ extraCards: [guard], encounterDeck: Array.from({ length: 20 }, () => guard.id) });
    const roundTwo = run(settle(run(start, endTurn(p1))), toHero());
    const [minion] = mustPlayer(roundTwo, p1).playArea;
    const attack = legalFor(legalActions(roundTwo, p1), "basicAttack", mustPlayer(roundTwo, p1).identity.instanceId);
    expect(attack?.targets).toEqual([minion]);
    expect(attack?.blockedTargets.map((b) => [b.instanceId, b.reason])).toEqual([[roundTwo.villain.instanceId, "no_valid_target"]]);
    expect(attack?.blockedTargets[0]?.message).toMatch(/guard/);
    expect(legalFor(legalActions(roundTwo, p1), "basicThwart")?.targets).toEqual([roundTwo.mainScheme.instanceId]);
  });

  it("an exhausted hero can't attack again this turn", () => {
    const hero = run(newGame(), toHero());
    const identity = mustPlayer(hero, p1).identity.instanceId;
    const attacked = run(hero, { type: "basicAttack", playerId: p1, attackerInstanceId: identity, targetInstanceId: hero.villain.instanceId });
    expect(illegalFor(legalActions(attacked, p1), "basicAttack", identity)?.reason).toBe("already_exhausted");
    expect(illegalFor(legalActions(attacked, p1), "changeForm")?.reason).toBe("already_changed_form");
  });

  it("interrupt and response events aren't played as actions", () => {
    const dodge = stubAbility("dodge", { trigger: { kind: "response", forced: false, on: { on: "cardPlayed" } }, effects: [] });
    const event = stubEvent({ id: "dodge", cost: 0, abilities: [dodge.ref] });
    const deps = depsOf(dodge);
    const { state, id } = giveCard(newGame({ extraCards: [event], deck: [...DEFAULT_DECK, event.id], deps }), p1, event.id);
    expect(illegalFor(legalActions(state, p1, deps), "playCard", id)?.reason).toBe("card_type_not_playable");
    const played = applyCommand(state, { type: "playCard", playerId: p1, cardInstanceId: id, payment: [], attachToInstanceId: null }, deps);
    expect(played.ok ? null : played.error.code).toBe("card_type_not_playable");
  });
});
