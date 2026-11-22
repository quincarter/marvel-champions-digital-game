/**
 * Dynamic Duo's payment note (issue #966): "Search your deck and discard pile for a Team-Up card and an ally named by
 * that card's Team-Up keyword." With every Team-Up card in hand, the search finds nothing unless one of them pays for
 * Dynamic Duo (a paid card is discarded before the effect resolves, RRG 1.8 "Event", p. 18), and the bar says so until
 * one is picked. A real solo Luke Cage game, its precon's two Team-Up cards (Power Man and Iron Fist, Unbreakable Bond)
 * dealt to the opening hand.
 */
import { describe, expect, test } from "vitest";
import { legalActions, type GameState, type InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { SessionStore } from "../store/session-store.js";
import { nextTurn } from "../store/dev-game-steps.js";
import { beginPayment, paymentView, searchNoteOf, togglePayment } from "./payment-model.js";

const DYNAMIC_DUO = "62022";
const POWER_MAN_AND_IRON_FIST = "62023";
const UNBREAKABLE_BOND = "62024";

const codeOf = (state: GameState, id: InstanceId): string => state.instances[id]!.cardId as string;

async function lukeCageTurn(): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "luke-cage-leadership" }],
    seed: 4,
    stack: { players: { 0: [DYNAMIC_DUO as never, POWER_MAN_AND_IRON_FIST as never, UNBREAKABLE_BOND as never] } },
  });
  await nextTurn(store);
  return store.state.game!;
}

describe("a search that finds nothing unless a card in hand pays for it", () => {
  test("Dynamic Duo names the Team-Up card in hand until it is picked to pay", async () => {
    const state = await lukeCageTurn();
    const me = state.players[0]!;
    const legal = legalActions(state, me.playerId, POOL_DEPS);
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const play = legal.legal.find(
      (entry) => entry.action.kind === "playCard" && codeOf(state, entry.action.instanceId) === DYNAMIC_DUO,
    );
    if (!play || play.action.kind !== "playCard") throw new Error("Dynamic Duo is not playable");
    const payment = beginPayment(state, me.playerId, play.action, null, POOL_DEPS)!;
    const teamUp = me.hand.find((id) => codeOf(state, id) === POWER_MAN_AND_IRON_FIST)!;
    const bond = me.hand.find((id) => codeOf(state, id) === UNBREAKABLE_BOND)!;
    expect([...payment.searchFindable!].sort()).toEqual([teamUp, bond].sort());
    const note =
      /^(Power Man and Iron Fist and Unbreakable Bond|Unbreakable Bond and Power Man and Iron Fist) are in your hand: pay with one so Dynamic Duo can find it$/;
    expect(searchNoteOf(state, payment)).toMatch(note);
    expect(paymentView(state, me.playerId, payment, "x", POOL_DEPS).searchNote).toMatch(note);

    // Picking another card leaves the note up; picking a Team-Up card takes it down.
    const other = payment.query.sources.find(
      (source) => source.kind === "handCard" && source.instanceId !== teamUp && source.instanceId !== bond,
    )!;
    expect(searchNoteOf(state, togglePayment(payment, other.optionId))).toMatch(note);
    const withTeamUp = payment.query.sources.find(
      (source) => source.kind === "handCard" && source.instanceId === teamUp,
    )!;
    expect(searchNoteOf(state, togglePayment(payment, withTeamUp.optionId))).toBeNull();
  }, 120_000);

  test("a card with no search has no note", async () => {
    const state = await lukeCageTurn();
    const me = state.players[0]!;
    const legal = legalActions(state, me.playerId, POOL_DEPS);
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const play = legal.legal.find(
      (entry) =>
        entry.action.kind === "playCard" &&
        entry.needsPayment &&
        codeOf(state, entry.action.instanceId) !== DYNAMIC_DUO,
    );
    if (!play || play.action.kind !== "playCard") throw new Error("nothing else to pay for");
    const payment = beginPayment(state, me.playerId, play.action, null, POOL_DEPS)!;
    expect(payment.searchFindable).toBeUndefined();
    expect(searchNoteOf(state, payment)).toBeNull();
  }, 120_000);
});
