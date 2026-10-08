/**
 * The pairing model for `pairCards` (docs/phase7-wave8.md §3.36): one-to-one assignment of the discarded cards to the
 * characters, the engine's own matching and refusal wording, and the option ids to send. Pure functions over a real
 * state's names and a hand-built prompt shaped as the engine builds it.
 */

import { pairOptionId, type ChoiceOption, type GameState, type InstanceId, type PendingChoice } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { cardName } from "./names.js";
import {
  assign,
  beginPairing,
  checkAssign,
  clearPairing,
  maxPairs,
  movesFor,
  pairingView,
  selectionOf,
  unassign,
  withRefusal,
  type PairPrompt,
} from "./pair-cards-model.js";
import { startedRhinoGame } from "./wave8-fixture.js";

let state: GameState;
let ids: InstanceId[];

beforeAll(async () => {
  ({ state } = await startedRhinoGame());
  ids = state.players[0]!.hand.slice(0, 5);
}, 30_000);

const promptOf = (limit = false): PairPrompt => {
  const [c1, c2, c3, a1, a2] = ids as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
  return {
    kind: "pairCards",
    cards: [c1, c2, c3],
    with: [a1, a2],
    // c1 and c3 both print energy, c2 a wild; a1 prints energy, a2 mental.
    icons: { [c1]: ["energy"], [c2]: ["wild"], [c3]: ["energy"], [a1]: ["energy"], [a2]: ["mental"] },
    matching: [pairOptionId(c1, a1), pairOptionId(c3, a1), pairOptionId(c2, a1), pairOptionId(c2, a2)],
    ...(limit ? { limit: { distinctBy: "resourceIcon" as const } } : {}),
    sourceInstanceId: null,
  };
};

const choiceOf = (prompt: PairPrompt): Pick<PendingChoice, "prompt" | "options"> => ({
  prompt,
  options: prompt.cards.flatMap((card) =>
    prompt.with.map((character): ChoiceOption => ({
      optionId: pairOptionId(card, character),
      label: "",
      ref: { kind: "card", instanceId: character },
    })),
  ),
});

const begin = (limit = false) => beginPairing(choiceOf(promptOf(limit)))!;

describe("beginPairing", () => {
  test("only a pairCards choice begins a pairing", () => {
    expect(beginPairing({ prompt: { kind: "orderSpecials" }, options: [] })).toBeNull();
    const started = begin();
    expect(started.pairs).toEqual([]);
    expect(selectionOf(started)).toEqual([]);
    expect(maxPairs(started)).toBe(2);
  });
});

describe("assigning one to one", () => {
  const at = (i: number): InstanceId => ids[i]!;

  test("a pair is sent as <card>><character>, in the prompt's card order", () => {
    let pairing = begin();
    pairing = assign(pairing, at(1), at(4));
    pairing = assign(pairing, at(0), at(3));
    expect(selectionOf(pairing)).toEqual([`${at(0)}>${at(3)}`, `${at(1)}>${at(4)}`]);
  });

  test("assigning a card again moves it, and taking a character takes it from its card", () => {
    let pairing = assign(begin(), at(0), at(3));
    pairing = assign(pairing, at(0), at(4));
    expect(selectionOf(pairing)).toEqual([`${at(0)}>${at(4)}`]);
    pairing = assign(pairing, at(1), at(4));
    expect(selectionOf(pairing)).toEqual([`${at(1)}>${at(4)}`]);
  });

  test("cards and characters may stay unassigned, and unassign puts a card back", () => {
    let pairing = assign(begin(), at(0), at(3));
    expect(pairingView(state, pairing).canConfirm).toBe(true);
    pairing = unassign(pairing, at(0));
    expect(selectionOf(pairing)).toEqual([]);
    expect(pairingView(state, pairing).canConfirm).toBe(true);
    expect(unassign(pairing, at(2))).toBe(pairing);
    expect(selectionOf(clearPairing(assign(begin(), at(0), at(3))))).toEqual([]);
  });

  test("a pair the engine did not offer is not a move", () => {
    const prompt = promptOf();
    const partial = beginPairing({
      prompt,
      options: choiceOf(prompt).options.filter((option) => option.optionId !== pairOptionId(at(0), at(4))),
    })!;
    expect(checkAssign(partial, at(0), at(4))).toEqual({ ok: false, reason: "not a pairing you can make" });
    expect(assign(partial, at(0), at(4))).toBe(partial);
    expect(movesFor(partial, at(0)).map((move) => move.character)).toEqual([at(3)]);
  });
});

describe("matching", () => {
  const at = (i: number): InstanceId => ids[i]!;

  test("moves say which characters match, from the engine's own list", () => {
    expect(movesFor(begin(), at(0))).toEqual([
      { character: at(3), matches: true },
      { character: at(4), matches: false },
    ]);
    // A wild matches any icon.
    expect(movesFor(begin(), at(1)).map((move) => move.matches)).toEqual([true, true]);
  });

  test("the view words each pair as a match or no match and counts who takes part", () => {
    let pairing = assign(begin(), at(0), at(3));
    pairing = assign(pairing, at(2), at(4));
    const view = pairingView(state, pairing);
    expect(view.pairs.map((pair) => pair.label)).toEqual([
      `${cardName(state, at(0))} with ${cardName(state, at(3))}: match`,
      `${cardName(state, at(2))} with ${cardName(state, at(4))}: no match`,
    ]);
    expect(view.pairs.map((pair) => pair.optionId)).toEqual([`${at(0)}>${at(3)}`, `${at(2)}>${at(4)}`]);
    expect(view.characters.map((row) => [row.participates, row.takenBy])).toEqual([
      [true, at(0)],
      [false, at(2)],
    ]);
    expect(view.summary).toBe("1 of 2 take part");
    expect(view.unassignedCards).toEqual([at(1)]);
    expect(view.cards.map((row) => row.assignedTo)).toEqual([at(3), null, at(4)]);
  });

  test("icons are listed for both sides, in words", () => {
    const view = pairingView(state, begin());
    expect(view.cards.map((row) => row.iconWords)).toEqual(["energy", "wild", "energy"]);
    expect(view.characters.map((row) => row.iconWords)).toEqual(["energy", "mental"]);
    const bare = beginPairing(choiceOf({ ...promptOf(), icons: {} }))!;
    expect(pairingView(state, bare).cards[0]!.iconWords).toBe("no icon");
  });
});

describe("the restriction in force", () => {
  const at = (i: number): InstanceId => ids[i]!;

  test("two cards with the same icon cannot go to two characters; the engine's words come back", () => {
    const pairing = assign(begin(true), at(0), at(3));
    const check = checkAssign(pairing, at(2), at(4));
    expect(check).toEqual({
      ok: false,
      reason: "cards with the same resource icon cannot be assigned to more than one character",
    });
    expect(assign(pairing, at(2), at(4))).toBe(pairing);
    // c3 (energy) may only take over c1's character: going to the other would leave two energy cards assigned.
    expect(movesFor(pairing, at(2)).map((move) => move.character)).toEqual([at(3)]);
    expect(movesFor(pairing, at(0)).map((move) => move.character)).toEqual([at(3), at(4)]);
    const view = pairingView(state, pairing);
    expect(view.restriction).toBe("Cards with the same resource icon can't go to more than one character");
    expect(view.cards[2]!.canGoTo).toEqual([at(3)]);
  });

  test("without the restriction the same pair is fine", () => {
    const pairing = assign(begin(false), at(0), at(3));
    expect(checkAssign(pairing, at(2), at(4))).toEqual({ ok: true });
    expect(pairingView(state, pairing).restriction).toBeNull();
  });
});

describe("a refused selection", () => {
  const at = (i: number): InstanceId => ids[i]!;

  test("the engine's message is kept until the assignment changes", () => {
    let pairing = assign(begin(), at(0), at(3));
    pairing = withRefusal(pairing, "cards with the same resource icon cannot be assigned to more than one character");
    expect(pairingView(state, pairing).refusal).toBe(
      "cards with the same resource icon cannot be assigned to more than one character",
    );
    expect(pairingView(state, assign(pairing, at(1), at(4))).refusal).toBeNull();
    expect(pairingView(state, unassign(pairing, at(0))).refusal).toBeNull();
  });
});

describe("a state the engine would refuse", () => {
  test("the view reports the engine's fault and blocks Confirm", () => {
    const prompt = promptOf();
    // Built past the model's own moves: the same card twice, as a stale selection would be.
    const broken = {
      ...beginPairing(choiceOf(prompt))!,
      pairs: [
        { card: ids[0]!, character: ids[3]! },
        { card: ids[0]!, character: ids[4]! },
      ],
    };
    const view = pairingView(state, broken);
    expect(view.fault).toBe("a card is assigned to one character only");
    expect(view.canConfirm).toBe(false);
  });
});
