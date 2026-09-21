/**
 * Showing a price the card does not print.
 *
 * Steve Rogers' Living Legend takes 1 off the first ally played each round, and it reaches the whole table. A
 * Spider-Man player holding Mockingbird therefore sees a card printing 3 and a payment bar counting to 2, with
 * nothing anywhere saying why — the report that started this. These three surfaces are the answer: the chip the
 * hand draws over the card's own cost pip (`HandCardView.cost` vs `currentCost`), the sentence on the payment
 * bar, and the "cost right now" line on the Inspect sheet. All three name the card responsible.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { WAVE1_DEPS } from "@mc/cards";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel } from "./board-model.js";
import { inspectModel } from "./inspect-model.js";
import { beginPayment, paymentView } from "./payment-model.js";

/** Spider-Man beside Captain America, who starts as Steve Rogers, so Living Legend is live from turn one. */
const SPIDER_MAN_AND_CAP: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "cap-leadership" }],
  seed: 11,
};

const MOCKINGBIRD = "01083";

let state: GameState;
let me: PlayerId;
let mockingbird: InstanceId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(SPIDER_MAN_AND_CAP);
  for (let step = 0; step < 10 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const started = store.state.game!;
  me = store.state.perspectiveId!;
  // Deal Mockingbird into the Spider-Man player's hand rather than hoping for her: the discount, not the draw,
  // is what's under test.
  const player = started.players.find((seat) => seat.playerId === me)!;
  const fromDeck = player.deck.find((id) => (started.instances[id]?.cardId as string) === MOCKINGBIRD);
  if (!fromDeck) throw new Error("Mockingbird is not in the Spider-Man precon");
  mockingbird = fromDeck;
  state = {
    ...started,
    players: started.players.map((seat) =>
      seat.playerId === me
        ? { ...seat, deck: seat.deck.filter((id) => id !== fromDeck), hand: [...seat.hand, fromDeck] }
        : seat,
    ),
  };
});

describe("a cost the table changed", () => {
  test("the hand carries both numbers and names Steve Rogers by the face that is up", () => {
    const card = boardModel(state, me, WAVE1_DEPS).hand.find((entry) => entry.instanceId === mockingbird)!;
    expect(card.name).toBe("Mockingbird");
    expect(card.cost).toBe(3);
    expect(card.currentCost).toBe(2);
    // Not "Captain America": Living Legend is printed on the alter-ego side, and that is the side face up.
    expect(card.costSources).toEqual(["Steve Rogers"]);
  });

  test("a card nothing is modifying reports the same number twice and blames nobody", () => {
    const untouched = boardModel(state, me, WAVE1_DEPS).hand.find(
      (entry) => entry.instanceId !== mockingbird && entry.cost !== null,
    )!;
    expect(untouched.currentCost).toBe(untouched.cost);
    expect(untouched.costSources).toEqual([]);
  });

  test("the payment bar explains its own denominator", () => {
    const payment = beginPayment(state, me, { kind: "playCard", instanceId: mockingbird }, null, WAVE1_DEPS)!;
    const view = paymentView(state, me, payment, "Mockingbird", WAVE1_DEPS);
    expect(view.required).toBe(2);
    expect(view.priceNote).toBe("Steve Rogers: 3 → 2");
  });

  test("Inspect says it too, and says nothing for a card at its printed price", () => {
    expect(inspectModel(state, mockingbird, null, me, WAVE1_DEPS).priceNote).toBe("Steve Rogers: 3 → 2");
    const villain = state.players.find((seat) => seat.playerId !== me)!.identity.instanceId;
    expect(inspectModel(state, villain, null, me, WAVE1_DEPS).priceNote).toBeNull();
  });
});
