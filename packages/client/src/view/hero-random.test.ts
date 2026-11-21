import { describe, expect, test } from "vitest";
import type { DeckOption } from "./deck-list-model.js";
import {
  randomHeroCandidatesOf,
  randomHeroDeck,
  searchPending,
  takeableHeroesOf,
  type RandomHeroCandidate,
} from "./hero-random.js";

const option = (
  id: string,
  identity: string,
  extra: { seatable?: boolean; aspects?: string[]; kind?: string } = {},
): DeckOption =>
  ({
    deck: {
      id,
      identityCardId: identity,
      aspects: extra.aspects ?? ["justice"],
      source: { kind: extra.kind ?? "precon" },
    },
    seatable: extra.seatable ?? true,
  }) as unknown as DeckOption;

const none = (): string | null => null;
const ids = (list: readonly RandomHeroCandidate[]): string[] => list.map((c) => c.deckId);

describe("randomHeroCandidatesOf", () => {
  const all = [option("a", "A"), option("b", "B"), option("c", "C")];

  test("everything takeable and shown is a candidate", () => {
    expect(ids(randomHeroCandidatesOf(all, none, { text: "" }, null, undefined))).toEqual(["a", "b", "c"]);
  });

  test("a deck that is not seatable (a not-ready pack's hero, an illegal deck) is never a candidate", () => {
    const decks = [option("a", "A"), option("elektra", "E", { seatable: false })];
    expect(ids(randomHeroCandidatesOf(decks, none, { text: "" }, null, undefined))).toEqual(["a"]);
  });

  test("a deck blocked at this seat (seated elsewhere, locked) is never a candidate", () => {
    const blocked = (id: string) => (id === "b" ? "AT THE TABLE" : null);
    expect(ids(randomHeroCandidatesOf(all, blocked, { text: "" }, null, undefined))).toEqual(["a", "c"]);
  });

  test("the aspect, source and playable-now chips narrow the candidates", () => {
    const decks = [
      option("a", "A", { aspects: ["justice"] }),
      option("b", "B", { aspects: ["aggression"] }),
      option("c", "C", { aspects: ["justice"], kind: "userBuilt" }),
    ];
    expect(ids(randomHeroCandidatesOf(decks, none, { text: "", aspect: "justice" }, null, undefined))).toEqual([
      "a",
      "c",
    ]);
    expect(ids(randomHeroCandidatesOf(decks, none, { text: "", source: "userBuilt" }, null, undefined))).toEqual(["c"]);
    // Blocked decks are already out, so playable-now changes nothing more here.
    const blocked = (id: string) => (id === "a" ? "x" : null);
    expect(ids(randomHeroCandidatesOf(decks, blocked, { text: "", playableOnly: true }, null, undefined))).toEqual([
      "b",
      "c",
    ]);
  });

  test("a search keeps only the decks it ranked", () => {
    const ranking = new Map([["b", 1]]);
    expect(ids(randomHeroCandidatesOf(all, none, { text: "b" }, ranking, undefined, "b"))).toEqual(["b"]);
  });

  // Code review on #916: the text changes before the search worker answers for it.
  test("before the worker answers a first search, Random offers nothing", () => {
    expect(searchPending({ text: "spi" }, null)).toBe(true);
    expect(randomHeroCandidatesOf(all, none, { text: "spi" }, null, undefined, null)).toEqual([]);
  });

  test("switching to another query keeps Random waiting until that query's ranking arrives", () => {
    const forB = new Map([["b", 1]]);
    // The field now reads "c", but the ranking still answers "b".
    expect(searchPending({ text: "c" }, "b")).toBe(true);
    expect(randomHeroCandidatesOf(all, none, { text: "c" }, forB, undefined, "b")).toEqual([]);
    // Then "c" is answered.
    const forC = new Map([["c", 1]]);
    expect(searchPending({ text: "c" }, "c")).toBe(false);
    expect(ids(randomHeroCandidatesOf(all, none, { text: "c" }, forC, undefined, "c"))).toEqual(["c"]);
  });

  test("an empty field is never a pending search", () => {
    expect(searchPending({ text: "" }, null)).toBe(false);
    expect(searchPending({ text: "  " }, "spi")).toBe(false);
  });

  test("a tested community deck is a candidate only while the list is narrowed to TESTED", () => {
    const decks = [option("a", "A"), option("community:1", "A", { kind: "imported" })];
    expect(ids(randomHeroCandidatesOf(decks, none, { text: "" }, null, undefined))).toEqual(["a"]);
    expect(ids(randomHeroCandidatesOf(decks, none, { text: "", source: "tested" }, null, undefined))).toEqual([
      "community:1",
    ]);
  });

  test("the active seat's own hero, under any of its decks, is left out so a press changes it", () => {
    const decks = [option("a1", "A"), option("a2", "A", { kind: "userBuilt" }), option("b", "B")];
    expect(ids(randomHeroCandidatesOf(decks, none, { text: "" }, null, "A"))).toEqual(["b"]);
  });

  test("nothing qualifying gives no candidates, and Random seats nothing", () => {
    const candidates = randomHeroCandidatesOf([option("a", "A")], none, { text: "" }, null, "A");
    expect(candidates).toEqual([]);
    expect(randomHeroDeck(candidates, () => 0)).toBeNull();
  });
});

describe("takeableHeroesOf", () => {
  test("keeps the deck a search or chip hides, flagged not shown, for Recommended to weigh", () => {
    const decks = [option("a", "A", { aspects: ["justice"] }), option("b", "B", { aspects: ["aggression"] })];
    const list = takeableHeroesOf(decks, none, { text: "", aspect: "justice" }, null);
    expect(list.map((e) => [e.option.deck.id, e.shown])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });
});

const deck = (deckId: string, identityCardId: string, precon = true): RandomHeroCandidate => ({
  deckId,
  identityCardId,
  precon,
});

describe("randomHeroDeck", () => {
  test("nothing on offer picks nothing", () => {
    expect(randomHeroDeck([], () => 0.5)).toBeNull();
  });

  test("picks a hero by the random value and never one outside the candidates", () => {
    const candidates = [deck("a", "A"), deck("b", "B"), deck("c", "C")];
    expect(randomHeroDeck(candidates, () => 0)).toBe("a");
    expect(randomHeroDeck(candidates, () => 0.5)).toBe("b");
    expect(randomHeroDeck(candidates, () => 0.999999)).toBe("c");
    for (let i = 0; i < 30; i++) expect(["a", "b", "c"]).toContain(randomHeroDeck(candidates, Math.random));
  });

  test("a value of exactly 1 (a bad source) still lands on a candidate", () => {
    expect(randomHeroDeck([deck("a", "A"), deck("b", "B")], () => 1)).toBe("b");
  });

  test("a hero with many decks is no likelier than one with a single deck", () => {
    const candidates = [deck("a1", "A"), deck("a2", "A"), deck("a3", "A"), deck("b", "B")];
    expect(randomHeroDeck(candidates, () => 0.6)).toBe("b");
  });

  test("a hero's precon is seated in preference to its other decks", () => {
    const candidates = [deck("mine", "A", false), deck("precon", "A", true), deck("other", "A", false)];
    expect(randomHeroDeck(candidates, () => 0.9)).toBe("precon");
  });

  test("a hero with only its own decks seats one of them", () => {
    const candidates = [deck("mine", "A", false), deck("other", "A", false)];
    expect(randomHeroDeck(candidates, () => 0)).toBe("mine");
    expect(randomHeroDeck(candidates, () => 0.9)).toBe("other");
  });
});
