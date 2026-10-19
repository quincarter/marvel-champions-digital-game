/**
 * Where the last picked payment card ends up, by what the card being paid for does after it resolves: an event is
 * discarded once its effects resolve (RRG 1.8 "Event", p. 18), so it lands on top of its owner's pile and the last
 * picked card is second. A card that enters play, and an ability's cost, leave the last picked card on top. Real Core
 * Set game; the picks are real hand cards added to the player's hand.
 */
import { CORE_DEPS } from "@mc/cards";
import { cardOf, type GameState, type InstanceId, type PaymentSource, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import {
  beginPayment,
  isCompactTag,
  ON_TOP_NOTE,
  sourceTagText,
  paymentView,
  spentTagText,
  togglePayment,
  underNoteFor,
} from "./payment-model.js";

let base: GameState;
let me: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
    seed: 4,
  });
  base = store.state.game!;
  me = store.state.perspectiveId!;
}, 120_000);

/** The first card of a type in the player's deck, moved into their hand with two more cards to pay with. */
function handWith(type: string): { state: GameState; subject: InstanceId; payers: [InstanceId, InstanceId] } {
  const player = base.players.find((p) => p.playerId === me)!;
  const pool = [...player.deck, ...player.hand];
  const subject = pool.find((id) => {
    const card = cardOf(base, id) as { type?: string; cost?: number } | undefined;
    return card?.type === type && (card.cost ?? 0) > 0;
  })!;
  const payers = pool.filter((id) => id !== subject).slice(0, 2) as [InstanceId, InstanceId];
  const hand = [subject, ...payers];
  const state: GameState = {
    ...base,
    players: base.players.map((p) =>
      p.playerId === me ? { ...p, hand, deck: p.deck.filter((id) => !hand.includes(id)), discard: [] } : p,
    ),
  };
  return { state, subject, payers };
}

function viewOf(state: GameState, subject: InstanceId, payers: readonly InstanceId[]) {
  const opened = beginPayment(state, me, { kind: "playCard", instanceId: subject }, null, CORE_DEPS)!;
  const handSources = payers.map((id): PaymentSource => ({
    optionId: `hand:${id}`,
    kind: "handCard",
    instanceId: id,
    label: "x",
    pool: { physical: 1, mental: 0, energy: 0, wild: 0 },
  }));
  const payment = {
    ...opened,
    query: { ...opened.query, sources: handSources },
    picked: handSources.map((source) => source.optionId),
  };
  return paymentView(state, me, payment, "test", CORE_DEPS);
}

describe("which card the payment order calls 'on top'", () => {
  test("an event lands on top of its owner's pile: no payment card is 'on top', the last picked is under the event", () => {
    const { state, subject, payers } = handWith("event");
    const view = viewOf(state, subject, payers);
    const [first, last] = view.sources;
    expect(view.sources.some((source) => source.onTop)).toBe(false);
    expect(first!.underSubject).toBeNull();
    expect(last!.underSubject).toBe(cardOf(state, subject)!.name);
    expect(spentTagText(last!)).toBe(`spent 2 · under ${cardOf(state, subject)!.name}`);
    expect(spentTagText(last!, true)).toBe("2▼");
    expect(view.orderNote).toBe(underNoteFor(cardOf(state, subject)!.name));
    expect(view.orderNote).not.toContain("Pepper");
  });

  test("a support that enters play leaves the last picked card on top", () => {
    const { state, subject, payers } = handWith("support");
    const view = viewOf(state, subject, payers);
    expect(view.sources.map((source) => source.onTop)).toEqual([false, true]);
    expect(view.sources.every((source) => source.underSubject === null)).toBe(true);
    expect(spentTagText(view.sources[1]!)).toBe("spent 2 · on top");
    expect(spentTagText(view.sources[1]!, true)).toBe("2▲");
    expect(view.orderNote).toBe(ON_TOP_NOTE);
  });

  test("an upgrade that enters play leaves the last picked card on top", () => {
    const { state, subject, payers } = handWith("upgrade");
    const view = viewOf(state, subject, payers);
    expect(view.sources.map((source) => source.onTop)).toEqual([false, true]);
  });

  test("an ability's cost leaves the last picked card on top: the source card is in play, nothing lands on the pile", () => {
    const { state, subject, payers } = handWith("support");
    const opened = beginPayment(state, me, { kind: "playCard", instanceId: subject }, null, CORE_DEPS)!;
    const handSources = payers.map((id): PaymentSource => ({
      optionId: `hand:${id}`,
      kind: "handCard",
      instanceId: id,
      label: "x",
      pool: { physical: 1, mental: 0, energy: 0, wild: 0 },
    }));
    const view = paymentView(
      state,
      me,
      {
        ...opened,
        action: { kind: "useAbility", instanceId: subject, abilityId: "a" as never },
        query: { ...opened.query, sources: handSources },
        picked: handSources.map((source) => source.optionId),
      },
      "test",
      CORE_DEPS,
    );
    expect(view.sources.map((source) => source.onTop)).toEqual([false, true]);
  });

  test("a helper's cards go to the helper's own pile, which the event does not land on: it keeps its own order", () => {
    const { state, subject, payers } = handWith("event");
    const other = base.players.find((p) => p.playerId !== me)!;
    const helperCard = other.hand[0]!;
    const view = viewOf(state, subject, [payers[0], helperCard, payers[1]]);
    const byId = new Map(view.sources.map((source) => [source.instanceId, source] as const));
    // Own pile: the second of two is under the event. Helper pile: the one card is the last for that pile, so on top.
    expect(byId.get(payers[1])!.underSubject).not.toBeNull();
    expect(byId.get(payers[1])!.onTop).toBe(false);
    expect(byId.get(helperCard)!.onTop).toBe(true);
    expect(byId.get(helperCard)!.underSubject).toBeNull();
  });
});

describe("compact tags for a narrow tile", () => {
  test("the number alone, with a marker for the top card", () => {
    expect(spentTagText({ discardOrder: 3, onTop: false }, true)).toBe("3");
    expect(spentTagText({ discardOrder: 3, onTop: true }, true)).toBe("3▲");
    expect(spentTagText({ discardOrder: null, onTop: false }, true)).toBe("spent");
  });

  test("an overpay-only tile says a short word on a narrow tile, and the full words on a wide one", () => {
    const hollywood = { helperName: null, amountNote: null, overpayOnly: true, spendsHandCard: false } as never;
    expect(sourceTagText(hollywood, false)).toBe("overpay only");
    expect(sourceTagText(hollywood, true)).toBe("extra");
    expect(isCompactTag(64)).toBe(true);
    expect(isCompactTag(70)).toBe(true);
    expect(isCompactTag(120)).toBe(false);
  });

  test("togglePayment still orders by pick", () => {
    expect(togglePayment({ picked: ["a"], query: { sources: [] } } as never, "b").picked).toEqual(["a", "b"]);
  });
});
