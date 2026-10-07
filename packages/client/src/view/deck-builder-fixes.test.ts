import { describe, expect, test } from "vitest";
import { deckFromStarterDeck, type Deck, type HeroIdentityCard } from "@mc/content";
import { validateDeck } from "@mc/engine";
import { POOL_CARDS, POOL_STARTER_DECKS, POOL_VERSION } from "../content/pool.js";
import { aspectName } from "./aspect-stamp.js";
import {
  browsablePool,
  identityOptions,
  newDeck,
  poolRowNote,
  poolTypeLine,
  removeCard,
} from "./deck-builder-model.js";
import { deckCountText, deckStatsOf } from "./deck-stats.js";
import { deckAspectsText } from "./deck-title.js";

const hero = (id: string): HeroIdentityCard => identityOptions(POOL_CARDS).find((c) => (c.id as string) === id)!;
const ids = (cards: readonly { id: unknown }[]): string[] => cards.map((c) => c.id as string);
const card = (id: string) => POOL_CARDS.find((c) => (c.id as string) === id)!;
const NOW = "2026-10-06T00:00:00.000Z";

describe("F1: an identity's off-aspect rule (the engine's per-card rule)", () => {
  const cable = hero("40001a");
  test("Cable's Leadership list offers player side schemes of any aspect, and no off-aspect event", () => {
    const list = ids(browsablePool(POOL_CARDS, cable, ["leadership"], {}));
    for (const id of ["40019", "40020", "44024"]) expect(list).toContain(id);
    expect(
      browsablePool(POOL_CARDS, cable, ["leadership"], {}).filter(
        (c) => c.type === "event" && "aspect" in c && c.aspect === "aggression",
      ),
    ).toEqual([]);
  });
  test("a card allowed only by the rule says why; an ordinary one says nothing", () => {
    expect(poolRowNote(card("40019"), cable, ["leadership"])).toBe("Cable: any aspect");
    expect(poolRowNote(card("40019"), cable, ["aggression"])).toBeNull();
  });
  test("another hero gets no such allowance", () => {
    expect(ids(browsablePool(POOL_CARDS, hero("40037a"), ["justice"], {}))).not.toContain("40019");
  });
  test("every card offered is one validateDeck lets a deck hold in some quantity", () => {
    const base = newDeck(cable, POOL_CARDS, "x", POOL_VERSION, NOW);
    const inSet = new Set(base.cards.map((l) => l.cardId as string));
    for (const c of browsablePool(POOL_CARDS, cable, ["leadership"], {}).filter((x) => !inSet.has(x.id as string))) {
      const deck: Deck = { ...base, aspects: ["leadership"], cards: [...base.cards, { cardId: c.id, quantity: 1 }] };
      const verdict = validateDeck(deck, POOL_CARDS);
      const refusals = verdict.ok ? [] : verdict.problems.filter((p) => p.cardIds.includes(c.id));
      expect(
        refusals.map((p) => p.code),
        c.name,
      ).toEqual([]);
    }
  });
});

describe("F2: cards that can never be deck cards are not browsable", () => {
  test("X-23's Linked Specialists", () => {
    const x23 = hero("43001a");
    const list = ids(browsablePool(POOL_CARDS, x23, ["aggression"], {}));
    for (const id of ["43034", "43035", "43036", "43037"]) expect(list).not.toContain(id);
  });
});

describe("F4: held cards stay listed when the deck refuses them", () => {
  const deadpool = hero("44001a");
  test("a 'Pool card under Aggression is listed only while the deck holds it", () => {
    expect(ids(browsablePool(POOL_CARDS, deadpool, ["aggression"], { text: "Barely" }))).not.toContain("44017");
    const held = new Set(["44017"]);
    const list = browsablePool(POOL_CARDS, deadpool, ["aggression"], { text: "Barely" }, "default", [], held);
    expect(ids(list)).toContain("44017");
    expect(poolRowNote(card("44017"), deadpool, ["aggression"])).toBe("not allowed in this deck");
  });
  test("removing it takes the line away", () => {
    const base = newDeck(deadpool, POOL_CARDS, "x", POOL_VERSION, NOW);
    const deck: Deck = { ...base, cards: [...base.cards, { cardId: card("44017").id, quantity: 1 }] };
    expect(removeCard(deck, card("44017").id).cards.some((l) => (l.cardId as string) === "44017")).toBe(false);
  });
});

describe("F3: the counted size", () => {
  test("Psylocke's precon lists 42 and counts 40", () => {
    const starter = POOL_STARTER_DECKS.find((s) => (s.identityCardId as string) === "41001a")!;
    const deck = deckFromStarterDeck(starter, POOL_VERSION);
    const stats = deckStatsOf(deck, POOL_CARDS);
    expect(stats.totalCards).toBe(42);
    expect(stats.countedCards).toBe(40);
    expect(deckCountText(stats)).toBe("40 cards + 2 permanent");
    const verdict = validateDeck(deck, POOL_CARDS);
    expect(verdict.ok).toBe(true);
  });
  test("a deck with no permanent cards reads plain", () => {
    expect(deckCountText({ countedCards: 40, permanentCards: 0 })).toBe("40 cards");
  });
});

describe("F6: a per player cost", () => {
  test("Break Time says per player; a plain cost says cost", () => {
    expect(poolTypeLine(card("44046"))).toBe("event · 3 per player");
    expect(poolTypeLine(card("44017"))).toMatch(/^event · cost \d$/);
  });
});

describe("F7 and F8", () => {
  test("a deck header leads with its aspects, with the apostrophe", () => {
    expect(deckAspectsText({ aspects: ["pool"] })).toBe("'POOL · ");
    expect(deckAspectsText({ aspects: [] })).toBe("");
  });
  test("the aspect's name is 'Pool", () => {
    expect(aspectName("pool")).toBe("'Pool");
    expect(aspectName("justice")).toBe("Justice");
  });
});

describe("F5: search reads traits and type, name matches first", () => {
  test("S.H.I.E.L.D. and Soldier find cards by trait", () => {
    const justice = hero("01001a");
    expect(ids(browsablePool(POOL_CARDS, justice, ["justice"], { text: "S.H.I.E.L.D." }))).toContain("08011");
    const soldiers = browsablePool(POOL_CARDS, hero("01029a"), ["leadership"], { text: "Soldier" });
    expect(soldiers.length).toBeGreaterThan(0);
    expect(ids(soldiers)).toContain("01030");
    expect(
      soldiers.every(
        (c) =>
          c.name.toLowerCase().includes("soldier") ||
          ("traits" in c && c.traits.some((t) => String(t).toLowerCase().includes("soldier"))),
      ),
    ).toBe(true);
  });
  test("a name match comes before a trait-only match", () => {
    const list = browsablePool(POOL_CARDS, hero("01001a"), ["justice"], { text: "Agent" });
    const firstTraitOnly = list.findIndex((c) => !c.name.toLowerCase().includes("agent"));
    const lastName = list.map((c) => c.name.toLowerCase().includes("agent")).lastIndexOf(true);
    if (firstTraitOnly >= 0) expect(lastName).toBeLessThan(firstTraitOnly);
  });
});
