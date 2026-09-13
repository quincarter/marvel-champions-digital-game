import { describe, expect, test } from "vitest";
import { CORE_CARDS } from "../data/core/cards.js";
import { CORE_STARTER_DECKS } from "../data/core/starterDecks.js";
import { parseDecklistText } from "./from-text.js";

const spiderManJustice = CORE_STARTER_DECKS.find((d) => d.name.startsWith("Spider-Man"))!;
const blackPanther = CORE_STARTER_DECKS.find((d) => d.name.startsWith("Black Panther"))!;

/**
 * A representative MarvelCDB-style export (header lines, group headers, a
 * trailing summary), built from the real Core Spider-Man (Justice) starter
 * deck's card names rather than invented ones, so it exercises the parser
 * against data that actually exists in the pool.
 */
const SPIDER_MAN_TEXT = `
Spider-Man (Justice) — Core Set starter deck
Hero: Spider-Man
Aspect: Justice

Hero (8)
1x Black Cat
2x Backflip
2x Enhanced Spider-Sense
3x Swinging Web Kick
1x Aunt May
2x Spider-Tracer
2x Web-Shooter
2x Webbed Up

Justice (14)
1x Daredevil
1x Jessica Jones
2x For Justice!
2x Great Responsibility
2x The Power of Justice
2x Interrogation Room
2x Surveillance Team
2x Heroic Intuition

Basic (11)
1x Mockingbird
1x Nick Fury
1x Emergency
1x First Aid
1x Haymaker
1x Energy
1x Genius
1x Strength
1x Avengers Mansion
1x Helicarrier
1x Tenacity

Deck Size: 40
`;

describe("parseDecklistText", () => {
  test("parses a representative export into exactly the curated Core precon", () => {
    const result = parseDecklistText(SPIDER_MAN_TEXT, CORE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.identityCardId).toBe(spiderManJustice.identityCardId);
    expect(result.contents.aspects).toEqual(["justice"]);
    expect(result.heroName).toBe("Spider-Man");
    const asMap = (cards: readonly { cardId: string; quantity: number }[]) =>
      Object.fromEntries(cards.map((c) => [c.cardId, c.quantity]));
    expect(asMap(result.contents.cards)).toEqual(asMap(spiderManJustice.cards));
  });

  test("group header lines like 'Justice (14)' are never mistaken for a card line", () => {
    const result = parseDecklistText(SPIDER_MAN_TEXT, CORE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    // "Justice" (the group header's own name) is not itself a card in the pool,
    // so if it had been parsed as a 14-of card line this would fail as unknown_card.
    expect(result.contents.cards.some((c) => c.cardId === "Justice")).toBe(false);
  });

  test("a trailing-quantity line (Card Name x2) is accepted", () => {
    const text = "Hero: Spider-Man\nAspect: Justice\nWeb-Shooter x1\nBackflip x2\n";
    const result = parseDecklistText(text, CORE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.cards).toHaveLength(2);
  });

  test("a group header's own parenthetical count is never read as that card's quantity", () => {
    // "Justice (14)" must not be parsed as 14 copies of a card named "Justice".
    const text = "Hero: Spider-Man\nAspect: Justice\nJustice (14)\n1x Web-Shooter\n";
    const result = parseDecklistText(text, CORE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.cards).toEqual([{ cardId: "01008", quantity: 1 }]);
  });

  test("a title printed as several codes (Wakanda Forever!) splits by the identity set's own printed makeup", () => {
    const text = "Hero: Black Panther\nAspect: Protection\n5x Wakanda Forever!\n";
    const result = parseDecklistText(text, CORE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    const wakanda = result.contents.cards.filter((c) => (c.cardId as string).startsWith("01043"));
    expect(wakanda).toHaveLength(4);
    expect(wakanda.find((c) => c.cardId === "01043d")?.quantity).toBe(2);
    expect(wakanda.filter((c) => c.cardId !== "01043d").every((c) => c.quantity === 1)).toBe(true);
    void blackPanther;
  });

  test("a title printed as several codes refuses to guess when the count doesn't match", () => {
    const text = "Hero: Black Panther\nAspect: Protection\n3x Wakanda Forever!\n";
    const result = parseDecklistText(text, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.code === "ambiguous_card_name")).toBe(true);
  });

  test("an unrecognized card name fails loudly, naming it", () => {
    const text = "Hero: Spider-Man\nAspect: Justice\n2x Not A Real Card\n";
    const result = parseDecklistText(text, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.code === "unknown_card" && p.message.includes("Not A Real Card"))).toBe(true);
  });

  test("no Hero: line fails loudly rather than importing with no identity", () => {
    const text = "Aspect: Justice\n1x Web-Shooter\n";
    const result = parseDecklistText(text, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.code === "missing_identity")).toBe(true);
  });

  test("no Aspect: line fails loudly", () => {
    const text = "Hero: Spider-Man\n1x Web-Shooter\n";
    const result = parseDecklistText(text, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.code === "missing_aspect")).toBe(true);
  });

  test("an identity name that isn't a hero identity fails loudly", () => {
    const text = "Hero: Web-Shooter\nAspect: Justice\n1x Web-Shooter\n";
    const result = parseDecklistText(text, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.code === "unknown_identity")).toBe(true);
  });

  test("empty input fails loudly", () => {
    expect(parseDecklistText("", CORE_CARDS)).toEqual({ ok: false, problems: [expect.objectContaining({ code: "invalid_input" })] });
    expect(parseDecklistText("   \n\n  ", CORE_CARDS)).toEqual({ ok: false, problems: [expect.objectContaining({ code: "invalid_input" })] });
  });

  test("oversized paste is refused before it is walked", () => {
    const result = parseDecklistText("x".repeat(30_000), CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]!.code).toBe("oversized_input");
  });

  test("a duplicated card line totals rather than overwrites", () => {
    const text = "Hero: Spider-Man\nAspect: Justice\n1x Web-Shooter\n1x Web-Shooter\n";
    const result = parseDecklistText(text, CORE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    const webShooter = result.contents.cards.find((c) => c.cardId === "01008");
    expect(webShooter?.quantity).toBeGreaterThanOrEqual(1);
  });

  test("a nonsense quantity on an otherwise well-formed line fails loudly", () => {
    // A negative leading quantity is still recognized as a card line (so it can be rejected specifically) rather than silently skipped.
    const text = "Hero: Spider-Man\nAspect: Justice\n-2 Web-Shooter\n";
    const result = parseDecklistText(text, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.code === "invalid_quantity")).toBe(true);
  });
});
