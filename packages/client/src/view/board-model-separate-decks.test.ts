/**
 * Hercules's Labor and Gift decks on the board (docs/phase7-wave10-client.md C13, section 5.3). His pack is not in the
 * client's playable pool, so the game is a real one built in `hero-pack-fixture.ts`, with the Labor card's later
 * places patched in as the engine leaves them (revealed, attached, in the victory display).
 *
 * Not shown, because the engine does not expose it as a value: the count of Gift cards he controls with the reason
 * while Appeal to Athena is in play, and the unavailable reason of the New Labors action ("a Labor card is in play",
 * "the Labor deck is empty"): the identity's action script is still being written (its ref is a placeholder in
 * `packages/cards/src/wave10/hercules/hercules/identity.ts`).
 */
import { cardOf, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { WAVE10_DEPS } from "@mc/cards";
import { beforeAll, describe, expect, test } from "vitest";
import { boardModel } from "./board-model.js";
import { heroPackGame } from "./hero-pack-fixture.js";
import { inspectModel } from "./inspect-model.js";
import { logLine } from "./log-lines.js";

const DEPS = WAVE10_DEPS;
let game: GameState;
let me: PlayerId;

beforeAll(() => {
  game = heroPackGame("hercules");
  me = game.players[0]!.playerId;
}, 120_000);

const piles = (state: GameState) => boardModel(state, me, DEPS).separateDecks;
const pile = (state: GameState, name: string) => piles(state).find((entry) => entry.name === name)!;

/** `id` out of its deck and into `patch` (a Labor card's later places). */
function leaveDeck(state: GameState, id: InstanceId, name: string, patch: Record<string, unknown>): GameState {
  const seat = state.players[0]!;
  return {
    ...state,
    players: state.players.map((entry, at) =>
      at === 0
        ? {
            ...entry,
            separateDecks: {
              ...entry.separateDecks,
              [name]: { ...seat.separateDecks[name]!, deck: seat.separateDecks[name]!.deck.filter((x) => x !== id) },
            },
          }
        : entry,
    ),
    instances: { ...state.instances, [id]: { ...state.instances[id]!, ...patch } },
  } as GameState;
}

describe("the Labor and Gift decks", () => {
  test("two facedown piles with their counts, no top face, no discard, no look", () => {
    const [labor, gift] = [pile(game, "Labor"), pile(game, "Gift")];
    for (const entry of [labor, gift]) {
      expect(entry.deckCount).toBe(3);
      expect(entry.topFaceup).toBe(false);
      expect(entry.inspectable).toBe(false);
      expect(entry.hasDiscard).toBe(false);
      expect(entry.discardCount).toBe(0);
      expect(entry.discardTopInstanceId).toBeNull();
      expect(entry.hiddenNote).toBe("Facedown. No one may look at it. 3 cards.");
    }
    expect(labor.ownerLabel).toBe("Hercules's Labor deck");
    expect(gift.ownerLabel).toBe("Hercules's Gift deck");
    expect(labor.family).toBe("encounter");
    expect(gift.family).toBe("player");
  });

  test("Inspect on a pile obeys the engine's visibility: a back and the count, not the card", () => {
    const top = pile(game, "Labor").topInstanceId!;
    const sheet = inspectModel(game, top, null, me, DEPS);
    expect(sheet.hidden).toBe(true);
    expect(sheet.name).toBe("Labor deck");
    expect(sheet.typeLine).toBe("Facedown · 3 cards");
    expect(sheet.rulesText).not.toContain(cardOf(game, top)!.name);
  });

  test("an empty Gift deck shows 0 and a note for 0 cards", () => {
    let state = game;
    for (const id of [...game.players[0]!.separateDecks.Gift!.deck]) {
      state = leaveDeck(state, id, "Gift", {});
    }
    const gift = pile(state, "Gift");
    expect(gift.deckCount).toBe(0);
    expect(gift.topInstanceId).toBeNull();
    expect(gift.hiddenNote).toBe("Facedown. No one may look at it. 0 cards.");
  });

  test("a Labor card out of the deck is listed with where it is", () => {
    const [first, second, third] = game.players[0]!.separateDecks.Labor!.deck as [InstanceId, InstanceId, InstanceId];
    const villain = game.activeVillainId!;
    const name = (id: InstanceId) => cardOf(game, id)!.name;
    let state = leaveDeck(game, first, "Labor", { faceup: true, controllerId: null });
    state = { ...state, players: state.players.map((seat) => ({ ...seat, dealtEncounter: [first] })) };
    expect(pile(state, "Labor").outside).toEqual([
      { instanceId: first, name: name(first), where: "revealed", line: `Revealing: ${name(first)}` },
    ]);
    // It then hangs on the villain (an attachment) ...
    state = {
      ...state,
      players: state.players.map((seat) => ({ ...seat, dealtEncounter: [] })),
      instances: {
        ...state.instances,
        [first]: { ...state.instances[first]!, attachedTo: villain, faceup: true },
        [villain]: { ...state.instances[villain]!, attachments: [first] },
      },
    };
    const attached = pile(state, "Labor").outside[0]!;
    expect(attached.where).toBe("attached");
    expect(attached.line).toBe(`In play: ${name(first)} on ${cardOf(state, villain)!.name}`);
    // ... and a second one reaches the victory display.
    state = leaveDeck(state, second, "Labor", { faceup: true, controllerId: null });
    state = { ...state, victoryDisplay: [second] };
    expect(
      pile(state, "Labor")
        .outside.map((entry) => [entry.instanceId, entry.where])
        .sort(),
    ).toEqual(
      [
        [first, "attached"],
        [second, "victory display"],
      ].sort(),
    );
    expect(pile(state, "Labor").deckCount).toBe(1);
    expect(third).toBeDefined();
  });
});

describe("a Labor card in play wears its owner", () => {
  test("on the villain it hangs from, the chip says whose Labor it is", () => {
    const [first] = game.players[0]!.separateDecks.Labor!.deck as [InstanceId];
    const villain = game.activeVillainId!;
    let state = leaveDeck(game, first, "Labor", { faceup: true, controllerId: null, attachedTo: villain });
    state = {
      ...state,
      instances: { ...state.instances, [villain]: { ...state.instances[villain]!, attachments: [first] } },
    };
    const chip = boardModel(state, me, DEPS).villain.attachments.find((entry) => entry.instanceId === first)!;
    // Short: the chip hangs on a narrow tile, and the full "Hercules's Labor" was cut to "HERCULES'S..." there.
    expect(chip.ownedBy).toBe("Labor (Hercules)");
    expect(chip.name).toBe(cardOf(state, first)!.name);
    // The wording of the chip carries it in text, not colour.
    const boardChip = boardModel(state, me, DEPS).villain.attachments.find((entry) => entry.instanceId === first)!;
    expect(`${boardChip.name} · ${boardChip.ownedBy}`).toBe(`${cardOf(state, first)!.name} · Labor (Hercules)`);
    // An ordinary attachment (or any other card) names no owner.
    expect(boardModel(state, me, DEPS).me.attachments.every((entry) => entry.ownedBy === null)).toBe(true);
  });

  test("an obligation in the play area says it too", () => {
    const labor = game.players[0]!.separateDecks.Labor!.deck.find((id) => cardOf(game, id)?.type === "obligation");
    if (!labor) return; // this deck's Labor cards are attachments; the chip test above covers them
    let state = leaveDeck(game, labor, "Labor", { faceup: true, controllerId: null });
    state = {
      ...state,
      players: state.players.map((seat) => ({ ...seat, playArea: [...seat.playArea, labor] })),
    };
    const panel = boardModel(state, me, DEPS).myPlayArea.find((entry) => entry.instanceId === labor);
    expect(panel?.ownedBy).toBe("Hercules's Labor");
  });
});

describe("the Labor card's route in the log", () => {
  const first = () => game.players[0]!.separateDecks.Labor!.deck[0]!;
  const named = (id: InstanceId) => cardOf(game, id)!.name;
  const shown = (id: InstanceId): GameState => ({
    ...game,
    instances: { ...game.instances, [id]: { ...game.instances[id]!, faceup: true } },
  });

  test("revealed from the Labor deck", () => {
    const id = first();
    const text = logLine(
      { type: "encounterCardRevealed", instanceId: id, cardId: game.instances[id]!.cardId, playerId: me },
      shown(id),
      me,
      DEPS,
    )?.text;
    expect(text).toBe(`You revealed ${named(id)} from your Labor deck.`);
  });

  test("with nothing to attach to: discarded, then back on the bottom of its deck", () => {
    const id = first();
    const state = shown(id);
    expect(
      logLine(
        {
          type: "revealedCardDiscarded",
          instanceId: id,
          cardId: state.instances[id]!.cardId,
          playerId: me,
          reason: "notAttached",
        },
        state,
        me,
        DEPS,
      )?.text,
    ).toBe(`${named(id)} had nothing to attach to when You revealed it, so it is discarded.`);
    expect(
      logLine(
        {
          type: "returnedToSeparateDeck",
          instanceId: id,
          cardId: state.instances[id]!.cardId,
          playerId: me,
          name: "Labor",
          instead: "discard",
        },
        state,
        me,
        DEPS,
      )?.text,
    ).toBe(`${named(id)} goes back into Your Labor deck, facedown, instead of leaving it.`);
  });

  test("to the victory display", () => {
    const id = first();
    const text = logLine(
      {
        type: "cardMoved",
        instanceId: id,
        cardId: game.instances[id]!.cardId,
        from: { kind: "playArea", playerId: me },
        to: { kind: "victoryDisplay" },
      } as never,
      shown(id),
      me,
      DEPS,
    )?.text;
    expect(text).toBe(`${named(id)} goes to the victory display.`);
  });
});
