/**
 * The Gift count on the board (docs/phase7-wave10-client.md 5.3). A real Hercules game from the cards package's own deck
 * builder; the Gift upgrades are put into play the way the cards package's tests do (taken out of the Gift deck and
 * attached to his identity under his control) and Appeal to Athena is put into his play area. The expected numbers are
 * what the cards' own tests assert (events.test.ts: "with %i Gift cards it costs 3 minus that"; "Appeal to Athena in
 * play: ... still leave the cost at 3").
 */
import { cardOf, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { WAVE10_DEPS } from "@mc/cards";
import { beforeAll, describe, expect, test } from "vitest";
import { boardModel, handCardView } from "./board-model.js";
import { giftCountOf, giftReaderNote, giftSeatNote } from "./gift-count.js";
import { heroPackGame } from "./hero-pack-fixture.js";

const DEPS = WAVE10_DEPS;
let game: GameState;
let me: PlayerId;

beforeAll(() => {
  game = heroPackGame("hercules");
  me = game.players[0]!.playerId;
}, 120_000);

const codeOf = (state: GameState, id: InstanceId): string => state.instances[id]!.cardId as string;
const find = (state: GameState, code: string): InstanceId =>
  Object.keys(state.instances).find((id) => codeOf(state, id as InstanceId) === code) as InstanceId;

/** `n` Gift upgrades out of the Gift deck and into play on his identity. */
function withGifts(state: GameState, n: number): GameState {
  const seat = state.players[0]!;
  const taken = seat.separateDecks.Gift!.deck.slice(0, n);
  const identity = seat.identity.instanceId;
  const instances = { ...state.instances };
  for (const id of taken) {
    instances[id] = { ...instances[id]!, attachedTo: identity, faceup: true, exhausted: false, controllerId: me };
  }
  instances[identity] = { ...instances[identity]!, attachments: [...instances[identity]!.attachments, ...taken] };
  return {
    ...state,
    instances,
    players: state.players.map((entry, at) =>
      at === 0
        ? {
            ...entry,
            separateDecks: {
              ...entry.separateDecks,
              Gift: {
                ...entry.separateDecks.Gift!,
                deck: entry.separateDecks.Gift!.deck.filter((x) => !taken.includes(x)),
              },
            },
          }
        : entry,
    ),
  } as GameState;
}

/** Appeal to Athena (59035) in his play area, as the engine leaves it when it is dealt to him. */
function withAppeal(state: GameState): GameState {
  const id = find(state, "59035");
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: null } },
    players: state.players.map((entry, at) => (at === 0 ? { ...entry, playArea: [...entry.playArea, id] } : entry)),
  } as GameState;
}

/** `code` first in the hand. */
function inHand(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = find(state, code);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((entry, at) =>
        at === 0
          ? {
              ...entry,
              hand: [id, ...entry.hand.filter((x) => x !== id)],
              deck: entry.deck.filter((x) => x !== id),
              discard: entry.discard.filter((x) => x !== id),
            }
          : entry,
      ),
    } as GameState,
  };
}

describe("the Gift count is the engine's value for the seat", () => {
  test.each([0, 1, 2, 3])("%i Gift cards controlled", (n) => {
    expect(giftCountOf(withGifts(game, n), me, DEPS)).toBe(n);
  });

  test("Appeal to Athena in play reads 0 whatever he controls, and the note says why", () => {
    const state = withAppeal(withGifts(game, 2));
    expect(giftCountOf(state, me, DEPS)).toBe(0);
    expect(giftSeatNote(state, me, DEPS)).toBe(
      "Gift cards counted: 0 (2 in play; Appeal to Athena counts them as none)",
    );
  });

  test("the seat note is plain when nothing takes cards out of the count", () => {
    expect(giftSeatNote(withGifts(game, 2), me, DEPS)).toBe("Gift cards counted: 2");
    expect(giftSeatNote(game, me, DEPS)).toBe("Gift cards counted: 0");
  });

  test("a game with no Gift deck has no note", () => {
    const plain = { ...game, players: game.players.map((seat) => ({ ...seat, separateDecks: {} })) } as GameState;
    expect(giftSeatNote(plain, me, DEPS)).toBeNull();
  });
});

describe("it rides on his identity and on the cards that read it", () => {
  test("the identity panel carries the note", () => {
    const model = boardModel(withGifts(game, 1), me, DEPS);
    expect(model.me.effects).toContain("Gift cards counted: 1");
  });

  test.each([
    ["59009", "The Gift of Battle"],
    ["59011", "Wisdom of Athena"],
    ["59010", "Son of Zeus"],
  ])("%s %s in hand: the note and the price agree with the count", (code, name) => {
    const { state, id } = inHand(withGifts(game, 2), code);
    expect(cardOf(state, id)!.name).toBe(name);
    const card = handCardView(state, id, me, DEPS);
    expect(card.countNote).toBe("Counts Gift cards you control: 2");
    // Price: printed cost less one per Gift card counted (Son of Zeus does not scale).
    if (code !== "59010") expect(card.currentCost).toBe(card.cost! - 2);
  });

  test("with Appeal to Athena the same cards read 0 and cost the printed price", () => {
    const { state, id } = inHand(withAppeal(withGifts(game, 2)), "59009");
    const card = handCardView(state, id, me, DEPS);
    expect(card.countNote).toBe("Counts Gift cards you control: 0");
    expect(card.currentCost).toBe(card.cost);
  });

  test("a card that does not read the count has no note", () => {
    const state = withGifts(game, 2);
    const other = state.players[0]!.hand.find((id) => giftReaderNote(state, id, me, DEPS) === null)!;
    expect(handCardView(state, other, me, DEPS).countNote).toBeNull();
  });

  test("Olympus in play carries it too", () => {
    const olympus = find(game, "59012");
    const state = withGifts(
      {
        ...game,
        instances: { ...game.instances, [olympus]: { ...game.instances[olympus]!, faceup: true, controllerId: me } },
        players: game.players.map((entry, at) =>
          at === 0
            ? {
                ...entry,
                playArea: [...entry.playArea, olympus],
                hand: entry.hand.filter((x) => x !== olympus),
                deck: entry.deck.filter((x) => x !== olympus),
              }
            : entry,
        ),
      } as GameState,
      3,
    );
    const panel = boardModel(state, me, DEPS).myPlayArea.find((entry) => entry.instanceId === olympus);
    expect(panel?.countNote).toBe("Counts Gift cards you control: 3");
  });
});
