/**
 * The faceup top card of a deck (Magik, 45030a) as the board model carries it, against a real Magik game: shown only
 * in hero form, priced by the engine with the deck-top source, refused with a reason once used this phase, and public
 * to the other seats' rows.
 */

import { describe, expect, test } from "vitest";
import { legalActions, type Command, type GameState, type PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { MECHANIC_TRYIT_CONFIGS, MECHANIC_TRYIT_PLAYER_ID } from "../guide/mechanic-tryit-config.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel } from "./board-model.js";

const P: PlayerId = MECHANIC_TRYIT_PLAYER_ID;

async function newStore(config: SessionConfig): Promise<SessionStore> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(config);
  for (let choice = store.state.game!.pendingChoice; choice; choice = store.state.game!.pendingChoice) {
    await store.resolveChoice(choice.minSelections > 0 ? [choice.options[0]!.optionId] : []);
  }
  return store;
}

async function magik() {
  const store = await newStore(MECHANIC_TRYIT_CONFIGS.magik.config);
  const state = (): GameState => store.state.game!;
  const dispatch = async (command: Command): Promise<void> => {
    if (!(await store.dispatch(command))) throw new Error(`refused: ${store.state.error ?? "?"}`);
  };
  const model = () => boardModel(state(), P, POOL_DEPS, legalActions(state(), P, POOL_DEPS));
  const me = () => state().players.find((p) => p.playerId === P)!;
  const handId = (code: string) => me().hand.find((id) => state().instances[id]!.cardId === code)!;
  return { dispatch, model, state, me, handId };
}

describe("the deck panel's faceup top card", () => {
  test("alter-ego form: the deck is facedown and the model carries no top card", async () => {
    const t = await magik();
    expect(t.me().identity.form).toBe("alterEgo");
    expect(t.model().myDeckTop).toBeNull();
    expect(t.model().myPiles.deck).toBe(t.me().deck.length);
  });

  test("hero form: Colossus shows, priced 1 less by the engine, and is playable", async () => {
    const t = await magik();
    await t.dispatch({ type: "changeForm", playerId: P });
    const top = t.model().myDeckTop!;
    expect(top.card.name).toBe("Colossus");
    expect(top.card.instanceId).toBe(t.me().deck[0]);
    expect(top.card.cost).toBe(3);
    expect(top.card.currentCost).toBe(2);
    expect(top.card.costSources).toEqual(["Magik"]);
    expect(top.playable).toBe(true);
    expect(top.reason).toBeNull();
    // The count stays: the shown card is still in the deck.
    expect(t.model().myPiles.deck).toBe(t.me().deck.length);
  });

  test("after the play the next card shows, refused with a reason (already played from the top this phase)", async () => {
    const t = await magik();
    await t.dispatch({ type: "changeForm", playerId: P });
    const colossus = t.me().deck[0]!;
    await t.dispatch({
      type: "playCard",
      playerId: P,
      cardInstanceId: colossus,
      payment: [{ fromHand: t.handId("45043") }, { fromHand: t.handId("45044") }],
      attachToInstanceId: null,
    });
    const next = t.model().myDeckTop!;
    expect(next.card.instanceId).toBe(t.me().deck[0]);
    expect(next.card.instanceId).not.toBe(colossus);
    expect(next.playable).toBe(false);
    expect(next.reason).toBe("you have already played the top card of your deck this phase");
    expect(next.tag).toBe("used");
  });

  test("without legal actions the top card is not playable (no green strip that does nothing)", async () => {
    const t = await magik();
    await t.dispatch({ type: "changeForm", playerId: P });
    const top = boardModel(t.state(), P, POOL_DEPS, null).myDeckTop!;
    expect(top.playable).toBe(false);
  });

  test("flipping back to alter-ego returns the card back", async () => {
    const t = await magik();
    await t.dispatch({ type: "changeForm", playerId: P });
    expect(t.model().myDeckTop).not.toBeNull();
    // A form change is once per round: end the turn, play the villain phase out, flip again in round 2.
    await t.dispatch({ type: "endTurn", playerId: P });
    for (let guard = 0; guard < 40 && t.state().round < 2; guard++) {
      const choice = t.state().pendingChoice;
      if (!choice) break;
      await t.dispatch({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.minSelections > 0 ? [choice.options[0]!.optionId] : [],
      });
    }
    expect(t.state().round).toBe(2);
    await t.dispatch({ type: "changeForm", playerId: P });
    expect(t.me().identity.form).toBe("alterEgo");
    expect(t.model().myDeckTop).toBeNull();
  });

  test("a hero with nothing showing (Spider-Man) has no top card", async () => {
    const store = await newStore({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 3,
    });
    const state = store.state.game!;
    const id = state.players[0]!.playerId;
    const model = boardModel(state, id, POOL_DEPS, null);
    expect(model.myDeckTop).toBeNull();
    expect(model.team).toEqual([]);
  });
});
