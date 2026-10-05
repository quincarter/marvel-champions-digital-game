/**
 * Inspect's header follows the face showing (a flipped double-sided card reads its own traits, not the front's), and a
 * card in a facedown pile reads as the pile and its size.
 */
import { activeEncounterDeck, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { CARDS_BY_ID } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { facedownPileOf, inspectModel } from "./inspect-model.js";
import { thumbSizeFor } from "./inspect-layout.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 12,
};

let state: GameState;
let me: PlayerId;
let anyCard: InstanceId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  state = store.state.game!;
  me = store.state.perspectiveId!;
  anyCard = state.players[0]!.hand[0]!;
});

/** Test surgery: the hand card `anyCard` becomes a copy of `cardId`, face up, showing front or flip side. */
function asCard(cardId: string, flipped: boolean): GameState {
  const card = CARDS_BY_ID.get(cardId)!;
  expect(card).toBeDefined();
  return {
    ...state,
    cardPool: { ...state.cardPool, [cardId]: card },
    instances: { ...state.instances, [anyCard]: { ...state.instances[anyCard]!, cardId: card.id, flipped } },
  } as GameState;
}

describe("Inspect header follows the face showing", () => {
  test.each([
    ["34002a", "Phoenix Force", "RESTRAINED", "UNLEASHED"],
    ["27182a", "Compact Darts", null, "ENHANCED"],
  ])("%s (%s): the flipped face reads its own traits", (id, name, frontTrait, backTrait) => {
    const front = inspectModel(asCard(id, false), anyCard, null, me, CORE_DEPS);
    const back = inspectModel(asCard(id, true), anyCard, null, me, CORE_DEPS);
    if (frontTrait) expect(front.typeLine).toContain(frontTrait);
    expect(back.typeLine).toContain(backTrait);
    if (frontTrait) expect(back.typeLine).not.toContain(frontTrait);
    expect(back.name).toBe(name);
  });
});

describe("a facedown pile in Inspect", () => {
  test("the encounter deck is a pile with its size, not a facedown card", () => {
    const deck = activeEncounterDeck(state).deck;
    const model = inspectModel(state, deck[0]!, null, me, CORE_DEPS);
    expect(model.hidden).toBe(true);
    expect(model.name).toBe("Encounter deck");
    expect(model.typeLine).toBe(`Facedown · ${deck.length} cards`);
  });

  test("a scenario deck is named for itself, singular for one card", () => {
    const id = "weather-1" as InstanceId;
    const withDeck = {
      ...state,
      scenarioDecks: { ...state.scenarioDecks, Weather: { deck: [id], discard: [] } },
      instances: { ...state.instances, [id]: { ...state.instances[anyCard]!, instanceId: id } },
    } as unknown as GameState;
    expect(facedownPileOf(withDeck, id)).toEqual({ name: "Weather deck", count: 1 });
    const model = inspectModel(withDeck, id, null, me, CORE_DEPS);
    expect(model.typeLine).toBe("Facedown · 1 card");
  });

  test("a card in a hand is not a pile", () => {
    expect(facedownPileOf(state, anyCard)).toBeNull();
  });
});

describe("thumbSizeFor", () => {
  test("a portrait scan keeps the portrait box", () => {
    expect(thumbSizeFor({ width: 300, height: 420 })).toEqual({ width: 116, height: 164 });
    expect(thumbSizeFor(null)).toEqual({ width: 116, height: 164 });
  });
  test("a landscape scan gets a box as tall as the card", () => {
    const box = thumbSizeFor({ width: 420, height: 300 });
    expect(box.width).toBe(116);
    expect(box.height).toBe(83);
  });
});
