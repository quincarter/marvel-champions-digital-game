import { cardId, trait, type EvidenceCombination } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  accusationWrongGuesses,
  accuse,
  accusedWrong,
  action,
  addCounters,
  chosenPlayer,
  each,
  firstPlayer,
  flipCard,
  identifyMole,
  ifThen,
  theAccused,
  theMole,
} from "./index.js";
import { validateDefinition } from "./validate.js";

/**
 * docs/phase7-wave9.md §3.29 (b): the accusation. `accuse` (MC50 p. 19: "choosing a combination of means, motive, and
 * opportunity that has not been crossed out"), `identifyMole` ("take the evidence cards from the A.I.M. envelope and
 * find the board member associated with the combination"), and what a script reads afterward: `theAccused`, `theMole`,
 * `accusationWrongGuesses`, `accusedWrong`.
 */
const row = (means: string, motive: string, opportunity: string, boardMember: string): EvidenceCombination => ({
  means: cardId(means),
  motive: cardId(motive),
  opportunity: cardId(opportunity),
  boardMember: cardId(boardMember),
});
const GRID = [row("m1", "v1", "o1", "a"), row("m1", "v1", "o2", "b"), row("m2", "v1", "o1", "a")];

describe("§3.29 (b) accusation builders", () => {
  it("accuse asks the first player by default, or the player named, over the grid as given", () => {
    expect(accuse(GRID)).toEqual({ kind: "accuse", player: firstPlayer, grid: GRID });
    expect(accuse(GRID, chosenPlayer("who"))).toEqual({ kind: "accuse", player: chosenPlayer("who"), grid: GRID });
  });

  it("identifyMole names the hidden pile and the grid", () => {
    expect(identifyMole("sealed", GRID)).toEqual({ kind: "identifyMole", hidden: "sealed", grid: GRID });
  });

  it("the accused and the mole are query fragments; the wrong guesses a value; accusedWrong a predicate", () => {
    expect(each(theAccused)).toEqual({ kind: "each", query: { accusation: "accused" } });
    expect(each(theMole)).toEqual({ kind: "each", query: { accusation: "mole" } });
    expect(accusationWrongGuesses).toEqual({ kind: "accusationWrongGuesses" });
    expect(accusedWrong).toEqual({ kind: "accusedWrong" });
  });
});

describe("§3.29 (b) accusation validation", () => {
  it("the accusation, the comparison with its two penalties, and a later flip of the mole validate", () => {
    expect(validateDefinition(action(accuse(GRID)))).toEqual([]);
    const compare = action(
      identifyMole("sealed", GRID),
      addCounters("secret", accusationWrongGuesses, each({ trait: trait("SUSPECT") })),
      ifThen(accusedWrong, addCounters("secret", 3, each(theAccused))),
    );
    expect(validateDefinition(compare)).toEqual([]);
    expect(validateDefinition(action(flipCard(each(theMole), { keepCounters: ["secret"] })))).toEqual([]);
  });

  it("a grid with no rows, or with two rows of the same three cards, is rejected for both effects", () => {
    const twice = [...GRID, row("m1", "v1", "o1", "b")];
    for (const build of [accuse, (grid: readonly EvidenceCombination[]) => identifyMole("sealed", grid)]) {
      const kind = build(GRID).kind;
      expect(validateDefinition(action(build([]))).join("\n")).toContain(`${kind}: the grid has no rows`);
      expect(validateDefinition(action(build(twice))).join("\n")).toContain(
        `${kind}: two rows of the grid have the same means, motive and opportunity`,
      );
    }
  });

  it("identifyMole with no pile name is rejected", () => {
    expect(validateDefinition(action(identifyMole("", GRID))).join("\n")).toContain(
      "identifyMole: the pile has no name",
    );
  });
});
