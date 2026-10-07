import { describe, expect, it } from "vitest";
import type { CardId, Deck } from "@mc/content";
import { CARDS_BY_ID } from "../content/pool.js";
import { preconDecks } from "./deck-list-model.js";
import {
  applyDeckSwaps,
  conflictNoticeOf,
  nameConflictsOf,
  sheetSubtitle,
  unresolvedConflicts,
  withKept,
  withSwap,
} from "./name-conflicts.js";

const decks = preconDecks();
const precon = (id: string): Deck => {
  const found = decks.find((d) => (d.id as string) === `precon:${id}`);
  if (!found) throw new Error(`no precon ${id}`);
  return found;
};
const withCard = (deck: Deck, cardId: string): Deck => ({
  ...deck,
  cards: [...deck.cards, { cardId: cardId as CardId, quantity: 1 }],
});
const ON = { sameNameHeroAllyConflict: true } as const;
const linesOf = (seats: readonly Deck[], rules?: typeof ON): string[] =>
  nameConflictsOf(
    seats.map((deck) => ({ deck })),
    CARDS_BY_ID,
    rules,
  ).map((c) => c.line);

describe("nameConflictsOf", () => {
  const colossus = precon("colossus-protection");
  const shadowcat = precon("shadowcat-aggression");

  it("Colossus + Shadowcat: with the table rule each deck's ally of the other is listed", () => {
    expect(linesOf([colossus, shadowcat], ON)).toEqual([
      "Colossus's deck: Shadowcat (Kitty Pryde) ally · Shadowcat is seated",
      "Shadowcat's deck: Colossus (Piotr Rasputin) ally · Colossus is seated",
    ]);
  });

  it("with the option off both clashes are listed: FFG's own rule makes each one", () => {
    // The basic Colossus ally prints the subtitle "Piotr Rasputin", the hero's alter-ego title (RRG 1.8 "Unique Icon").
    const found = nameConflictsOf([{ deck: colossus }, { deck: shadowcat }], CARDS_BY_ID);
    expect(found.map((c) => c.line)).toEqual([
      "Colossus's deck: Shadowcat (Kitty Pryde) ally · Shadowcat is seated",
      "Shadowcat's deck: Colossus (Piotr Rasputin) ally · Colossus is seated",
    ]);
    expect(found.map((c) => c.byTableRule)).toEqual([false, false]);
  });

  it("marks a card that belongs to the hero's own set: it can only be kept, not replaced", () => {
    const found = nameConflictsOf([{ deck: colossus }, { deck: shadowcat }], CARDS_BY_ID, ON);
    // Colossus's deck holds the Shadowcat ally as one of his identity cards; Shadowcat's holds a basic Colossus ally.
    expect(found.map((c) => [c.cardName, c.identitySpecific])).toEqual([
      ["Shadowcat (Kitty Pryde)", true],
      ["Colossus (Piotr Rasputin)", false],
    ]);
  });

  it("marks a clash that exists only by the table rule", () => {
    // Colossus + Shadowcat clash by FFG's rule alone, on or off.
    const both = nameConflictsOf([{ deck: colossus }, { deck: shadowcat }], CARDS_BY_ID, ON);
    expect(both.map((c) => [c.seat, c.cardName, c.byTableRule])).toEqual([
      [1, "Shadowcat (Kitty Pryde)", false],
      [2, "Colossus (Piotr Rasputin)", false],
    ]);
    expect(both[1]).toMatchObject({ deckId: "precon:shadowcat-aggression", againstSeat: 1, copies: 1 });
    // The Valkyrie ally (06012, no subtitle) beside the Valkyrie hero is the table rule's own pair.
    const thor = precon("thor-aggression");
    const valkyrie = precon("valkyrie-aggression");
    const found = nameConflictsOf([{ deck: thor }, { deck: valkyrie }], CARDS_BY_ID, ON);
    // (Valkyrie's own deck holds the Thor (Odinson) ally, which FFG's rule refuses beside Thor.)
    expect(found.map((c) => [c.seat, c.cardId, c.cardName, c.byTableRule])).toEqual([
      [1, "06012", "Valkyrie", true],
      [2, "25013", "Thor (Odinson)", false],
    ]);
    expect(found[0]).toMatchObject({ deckId: thor.id, againstSeat: 2, copies: 1 });
    const off = nameConflictsOf([{ deck: thor }, { deck: valkyrie }], CARDS_BY_ID);
    expect(off.map((c) => [c.seat, c.cardId, c.byTableRule])).toEqual([[2, "25013", false]]);
  });

  it("a deck's clash with its own identity is not listed", () => {
    expect(linesOf([withCard(colossus, "32048")], ON)).toEqual([]);
    expect(linesOf([colossus], ON)).toEqual([]);
  });

  it("the Miles Morales Spider-Man ally does not clash with Spider-Man (Peter Parker), even with the option", () => {
    const peter = precon("core-spider-man-justice");
    const peterWithMilesAlly = withCard(peter, "13019");
    const peterClash = linesOf([peterWithMilesAlly, precon("core-iron-man-aggression")], ON);
    expect(peterClash).toEqual([]);
  });

  it("Spider-Man (Miles Morales) with Peter's cards clashes with the Peter Parker ally", () => {
    const miles = precon("spider-man-morales");
    const peter = precon("core-spider-man-justice");
    expect(linesOf([miles, peter])).toContain(
      "Spider-Man (Miles Morales)'s deck: Spider-Man (Peter Parker) ally · Spider-Man (Peter Parker) is seated",
    );
  });

  it("a T'Challa-subtitled Black Panther ally clashes with Black Panther (T'Challa), and not with Shuri", () => {
    const tChalla = precon("core-black-panther-protection");
    const warMachine = precon("war-machine-leadership");
    expect(linesOf([tChalla, warMachine])).toContain(
      "War Machine's deck: Black Panther (T'Challa) ally · Black Panther (T'Challa) is seated",
    );
  });

  it("the option lists a bare ally against its hero for Valkyrie, Ironheart, Colossus and other bare-named allies", () => {
    const thor = precon("thor-aggression");
    const valkyrie = precon("valkyrie-aggression");
    expect(linesOf([thor, valkyrie], ON)).toContain("Thor's deck: Valkyrie ally · Valkyrie is seated");
    expect(linesOf([thor, valkyrie])).not.toContain("Thor's deck: Valkyrie ally · Valkyrie is seated");
    const wasp = precon("wsp-aggression");
    const ironheart = precon("ironheart-leadership");
    expect(linesOf([wasp, ironheart], ON)).toContain("Wasp's deck: Ironheart ally · Ironheart is seated");
  });

  it("covers the guardian heroes and their bare allies, in both directions", () => {
    const groot = precon("groot-protection");
    const rocket = precon("rocket-raccoon-aggression");
    expect(linesOf([groot, rocket])).toEqual([
      "Groot's deck: Rocket Raccoon ally · Rocket Raccoon is seated",
      "Rocket Raccoon's deck: Groot ally · Groot is seated",
    ]);
    const drax = precon("drax-protection");
    const gamora = precon("gamora-aggression");
    const nebula = precon("nebula-justice");
    expect(linesOf([gamora, drax])).toEqual([
      "Gamora's deck: Drax ally · Drax is seated",
      "Drax's deck: Gamora ally · Gamora is seated",
    ]);
    expect(linesOf([nebula, gamora])).toContain("Nebula's deck: Gamora ally · Gamora is seated");
    expect(linesOf([precon("star-lord-leadership"), precon("adam-warlock-all-aspects")])).toContain(
      "Star-Lord's deck: Adam Warlock ally · Adam Warlock is seated",
    );
    expect(linesOf([precon("core-captain-marvel-leadership"), precon("vision-protection")])).toContain(
      "Captain Marvel's deck: Vision ally · Vision is seated",
    );
  });

  it("covers three- and four-seat tables", () => {
    const three = linesOf([precon("groot-protection"), precon("rocket-raccoon-aggression"), colossus]);
    expect(three).toHaveLength(2);
    // Off, FFG's rule alone still lists the Colossus ally against the Colossus hero at a four-seat table.
    const fourOff = linesOf([colossus, shadowcat, precon("wolverine-aggression"), precon("storm-leadership")]);
    expect(fourOff).toContain("Shadowcat's deck: Colossus (Piotr Rasputin) ally · Colossus is seated");
    const four = linesOf([colossus, shadowcat, precon("wolverine-aggression"), precon("storm-leadership")], ON);
    expect(four).toContain("Shadowcat's deck: Colossus (Piotr Rasputin) ally · Colossus is seated");
    expect(four).toContain("Shadowcat's deck: Wolverine (Logan) ally · Wolverine is seated");
    expect(four.every((line) => line.includes("is seated"))).toBe(true);
  });

  it("reads an imported or built deck exactly like a precon", () => {
    const built: Deck = {
      ...withCard(precon("core-iron-man-aggression"), "32048"),
      id: "built-1" as Deck["id"],
      source: { kind: "userBuilt", createdAt: "2026-10-03" },
    };
    const found = nameConflictsOf([{ deck: built }, { deck: colossus }], CARDS_BY_ID, ON);
    expect(found.map((c) => [c.deckId, c.cardName])).toEqual([["built-1", "Colossus (Piotr Rasputin)"]]);
  });
});

describe("answering a conflict", () => {
  const colossus = precon("colossus-protection");
  const shadowcat = precon("shadowcat-aggression");
  const found = nameConflictsOf([{ deck: colossus }, { deck: shadowcat }], CARDS_BY_ID, ON);

  it("keeps a card as a resource once", () => {
    const kept = withKept(withKept([], { deckId: "precon:shadowcat-aggression", cardId: "32048" }), {
      deckId: "precon:shadowcat-aggression",
      cardId: "32048",
    });
    expect(kept).toHaveLength(1);
    expect(unresolvedConflicts(found, kept).map((c) => c.cardName)).toEqual(["Shadowcat (Kitty Pryde)"]);
  });

  it("a swap takes every copy of the card out of that deck only, and leaves the saved deck alone", () => {
    const saved = JSON.stringify(shadowcat);
    const swapped = applyDeckSwaps(shadowcat, [{ deckId: "precon:shadowcat-aggression", from: "32048", to: "01032" }]);
    expect(swapped.cards.some((e) => (e.cardId as string) === "32048")).toBe(false);
    expect(JSON.stringify(shadowcat)).toBe(saved);
    expect(applyDeckSwaps(colossus, [{ deckId: "precon:shadowcat-aggression", from: "32048", to: "01032" }])).toBe(
      colossus,
    );
    const after = nameConflictsOf([{ deck: colossus }, { deck: swapped }], CARDS_BY_ID, ON);
    expect(after.map((c) => c.cardName)).toEqual(["Shadowcat (Kitty Pryde)"]);
  });

  it("a replacement joins an existing entry's copies and a later swap of the same card wins", () => {
    const base = withCard(shadowcat, "32048");
    const copies = (deck: Deck, id: string): number =>
      deck.cards.filter((e) => (e.cardId as string) === id).reduce((n, e) => n + e.quantity, 0);
    const lines = copies(base, "32048");
    const swapped = applyDeckSwaps(base, [{ deckId: "precon:shadowcat-aggression", from: "32048", to: "32002" }]);
    expect(copies(swapped, "32002")).toBe(copies(base, "32002") + lines);
    const swaps = withSwap(withSwap([], { deckId: "d", from: "a", to: "b" }), { deckId: "d", from: "a", to: "c" });
    expect(swaps).toEqual([{ deckId: "d", from: "a", to: "c" }]);
  });

  it("words the notice by count", () => {
    expect(conflictNoticeOf(1)).toBe("1 card can't be played with these heroes");
    expect(conflictNoticeOf(2)).toBe("2 cards can't be played with these heroes");
  });
});

describe("the sheet's instruction matches what its rows offer", () => {
  it("only heroes' own cards: it never promises a Replace", () => {
    expect(sheetSubtitle([true, true])).not.toMatch(/replace/i);
    expect(sheetSubtitle([true, true])).toMatch(/resource/);
  });
  it("a mix says both, and all replaceable keeps the short line", () => {
    expect(sheetSubtitle([true, false])).toMatch(/Replace a card.*own cards can only be kept/);
    expect(sheetSubtitle([false, false])).toBe("Replace each one, or keep it to spend as a resource.");
  });
});
