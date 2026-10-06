import { describe, expect, test } from "vitest";
import { CORE_CARDS } from "../data/core/cards.js";
import { CORE_STARTER_DECKS } from "../data/core/starterDecks.js";
import { SM_CARDS } from "../data/sm/cards.js";
import { PLAYABLE_CARDS } from "../data/index.js";
import type { DeckContents } from "../schema/decks.js";
import { cardId } from "../schema/ids.js";
import { parseDecklistText } from "./from-text.js";
import { exportDecklistText } from "./to-text.js";

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
    expect(parseDecklistText("", CORE_CARDS)).toEqual({
      ok: false,
      problems: [expect.objectContaining({ code: "invalid_input" })],
    });
    expect(parseDecklistText("   \n\n  ", CORE_CARDS)).toEqual({
      ok: false,
      problems: [expect.objectContaining({ code: "invalid_input" })],
    });
  });

  test("oversized paste is refused before it is walked", () => {
    const result = parseDecklistText("x".repeat(30_000), CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]!.code).toBe("oversized_input");
  });

  test("a duplicated card line totals rather than overwrites", () => {
    const text = "Hero: Spider-Man (01001a)\nAspect: Justice\n1x Web-Shooter\n1x Web-Shooter\n";
    const result = parseDecklistText(text, CORE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    const webShooter = result.contents.cards.find((c) => c.cardId === "01008");
    expect(webShooter?.quantity).toBeGreaterThanOrEqual(1);
  });

  test("paste import resolves a reprint by name fine when the pool only has the original", () => {
    // This importer matches by printed title, not by code, so it needs no reprint-code table *when the pool it's
    // checked against doesn't itself carry the reprint's own code as a separate entry*: a decklist naming a card
    // MarvelCDB also reprints elsewhere (e.g. "Energy"/"Genius"/"Strength"/"Avengers Mansion"/"Surveillance Team",
    // each reprinted in later packs per CATALOG_REPRINTS) resolves against CORE_CARDS above with no special
    // handling, because CORE_CARDS has only the one, original-titled entry.
    const text = "Hero: Spider-Man\nAspect: Justice\n1x Energy\n";
    const result = parseDecklistText(text, CORE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.cards).toEqual([{ cardId: "01088", quantity: 1 }]);
  });

  test("paste import counts a reprint the pool keeps under the same name as the original card", () => {
    // Sinister Motives' own ingestion (sm/cards.ts) keeps each printed reprint as its own AnyCard entry, so
    // SM_CARDS has two cards named "Young Love": 27019 and its in-cycle reprint 27050 (CATALOG_REPRINTS
    // "27050": "27019"). A pasted name can't say which print it means, so it resolves to the original, the same
    // card the MarvelCDB JSON import resolves the reprint's code to.
    const text = "Hero: Spider-Man\nAspect: Basic\n1x Young Love\n";
    const result = parseDecklistText(text, SM_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.contents.cards).toContainEqual({ cardId: "27019", quantity: 1 });
  });

  test("a nonsense quantity on an otherwise well-formed line fails loudly", () => {
    // A negative leading quantity is still recognized as a card line (so it can be rejected specifically) rather than silently skipped.
    const text = "Hero: Spider-Man\nAspect: Justice\n-2 Web-Shooter\n";
    const result = parseDecklistText(text, CORE_CARDS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.code === "invalid_quantity")).toBe(true);
  });

  describe("quantity forms, titles and unreadable lines", () => {
    const parse = (body: string) => {
      const result = parseDecklistText(`Hero: Spider-Man\nAspect: Justice\n${body}\n`, CORE_CARDS);
      if (!result.ok) throw new Error(JSON.stringify(result.problems));
      return result;
    };
    const qty = (body: string) => parse(body).contents.cards.map((c) => c.quantity);

    test("Name, 1 Name, 1x Name and Name x1 are all one copy", () => {
      for (const line of ["Energy", "1 Energy", "1x Energy", "Energy x1", "  energy  "]) {
        expect(qty(line), line).toEqual([1]);
      }
    });

    test("blank lines, comments, section headers and summaries are skipped without a warning", () => {
      const result = parse(
        "\n# My notes\n// more\nBasic (3)\nHero cards\nAspect cards:\n\n2x Energy\nDeck Size: 40\nTotal Cards: 2\n-----",
      );
      expect(result.notes).toBeUndefined();
      expect(result.contents.cards).toEqual([{ cardId: "01088", quantity: 2 }]);
    });

    test("a line that cannot be read is reported by its line number and the rest still imports", () => {
      const result = parse("2x Energy\nenergyy???\nEnergy (2)");
      expect(result.contents.cards).toEqual([{ cardId: "01088", quantity: 2 }]);
      expect(result.notes?.map((n) => n.message)).toEqual([
        "Could not read line 4: energyy???",
        "Could not read line 5: Energy (2)",
      ]);
    });

    test("the decklist's own name comes from a Name: line or an unrecognized first line", () => {
      expect(parse("1 Energy").deckName).toBeNull();
      expect(
        parseDecklistText("Stolen Thunder!\nHero: Spider-Man\nAspect: Justice\n1 Energy", CORE_CARDS),
      ).toMatchObject({
        ok: true,
        deckName: "Stolen Thunder!",
      });
      expect(
        parseDecklistText("Hero: Spider-Man\nName: Web Heads\nAspect: Justice\n1 Energy", CORE_CARDS),
      ).toMatchObject({
        ok: true,
        deckName: "Web Heads",
      });
    });
  });
});

describe("same-titled cards (Deadpool's pool: wave 7 QA finding 1)", () => {
  const entries = (cards: readonly { cardId: string; quantity: number }[]) =>
    Object.fromEntries(cards.map((c) => [c.cardId, c.quantity]));
  const parse = (text: string) => parseDecklistText(text, PLAYABLE_CARDS);
  const ok = (text: string) => {
    const result = parse(text);
    if (!result.ok) throw new Error(JSON.stringify(result.problems.map((p) => p.message)));
    return result;
  };

  test("a code suffix picks the card: Deadpool's ally 'Cable' beside the hero Cable", () => {
    const result = ok("Hero: Deadpool\nAspect: Pool\n1x Cable (44002)\n");
    expect(entries(result.contents.cards)).toEqual({ "44002": 1 });
  });

  test("a pack suffix picks the card when the pack tells them apart, and the code form is case-insensitive", () => {
    expect(entries(ok("Hero: Deadpool\nAspect: Pool\n1x Cable (Deadpool)\n").contents.cards)).toEqual({ "44002": 1 });
    expect(entries(ok("Hero: Deadpool\nAspect: Pool\n1x Web-Shooter (SM)\n").contents.cards)).toEqual({ "27039": 1 });
    expect(entries(ok("Hero: Deadpool\nAspect: Pool\n1x Web-Shooter (01008)\n").contents.cards)).toEqual({
      "01008": 1,
    });
  });

  test("a pack name that picks nothing falls back to the bare title, as pasted MarvelCDB text would", () => {
    const result = ok("Hero: Spider-Man (01001a)\nAspect: Justice\n2x Web-Shooter (Core Set)\n");
    expect(entries(result.contents.cards)).toEqual({ "01008": 2 });
  });

  test("a bare title naming the deck's own hero identity is not a deck card: 'Hulk' the ally in a Hulk-free list", () => {
    const result = ok("Hero: Spider-Man (01001a)\nAspect: Aggression\n1x Hulk\n");
    expect(entries(result.contents.cards)).toEqual({ "01050": 1 });
  });

  test("a bare title is resolved by the cards legal for this hero: Web-Shooter is Spider-Man's own", () => {
    expect(entries(ok("Hero: Spider-Man (01001a)\nAspect: Justice\n2x Web-Shooter\n").contents.cards)).toEqual({
      "01008": 2,
    });
    expect(entries(ok("Hero: Spider-Man\nAspect: Justice\n1x Backflip\n1x Web-Shooter\n").contents.cards)).toEqual({
      "01008": 1,
      "01003": 1,
    });
  });

  test("an encounter card sharing a title with a player card is not a candidate: Mind Scan", () => {
    const result = ok("Hero: Cable\nAspect: Leadership\n1x Mind Scan\n");
    expect(entries(result.contents.cards)).toEqual({ "40003": 1 });
  });

  test("a title that really cannot be told apart is refused, naming the candidates and how to write it", () => {
    const result = parse("Hero: Spider-Man (01001a)\nAspect: Justice\n1x Hawkeye\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const [problem] = result.problems;
    expect(problem!.code).toBe("ambiguous_card_name");
    expect(problem!.message).toContain("Hawkeye (01066)");
    expect(problem!.message).toContain("Hawkeye (03012)");
    expect(problem!.message).toContain("Hawkeye (04011)");
    expect(problem!.message).not.toContain("04001a");
    expect(problem!.message).toContain("with its code");
  });

  test("the suggested spelling then imports", () => {
    expect(entries(ok("Hero: Spider-Man (01001a)\nAspect: Justice\n1x Hawkeye (03012)\n").contents.cards)).toEqual({
      "03012": 1,
    });
  });

  test("two heroes sharing a name: refused with both codes unless the list or a suffix settles it", () => {
    const refused = parse("Hero: Spider-Man\nAspect: Justice\n1x Hawkeye (03012)\n");
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.problems[0]!.message).toContain("Spider-Man (01001a)");
    expect(refused.problems[0]!.message).toContain("Spider-Man (27030a)");
    expect(ok("Hero: Spider-Man (27030a)\nAspect: Justice\n1x Hawkeye (03012)\n").contents.identityCardId).toBe(
      "27030a",
    );
    expect(ok("Hero: Spider-Man\nAspect: Justice\n1x Backflip\n").contents.identityCardId).toBe("01001a");
  });

  test("a bare and a suffixed line for the same card add up", () => {
    const result = ok("Hero: Spider-Man (01001a)\nAspect: Justice\n1x Web-Shooter\n1x Web-Shooter (01008)\n");
    expect(entries(result.contents.cards)).toEqual({ "01008": 2 });
  });

  describe("export then import gives back the identical deck", () => {
    const deckOf = (identity: string, aspects: string[], lines: Record<string, number>): DeckContents => ({
      identityCardId: cardId(identity),
      aspects: aspects as DeckContents["aspects"],
      cards: Object.entries(lines).map(([id, quantity]) => ({ cardId: cardId(id), quantity })),
    });
    const COLLISIONS: readonly [string, DeckContents][] = [
      ["Cable (Deadpool's ally; hero Cable exists)", deckOf("44001a", ["pool"], { "44002": 1, "44046": 1 })],
      ["Hulk (ally; hero Hulk exists)", deckOf("01001a", ["aggression"], { "01050": 2, "01008": 2 })],
      ["Hawkeye (three allies and a hero)", deckOf("01001a", ["leadership"], { "01066": 1, "03012": 1, "04011": 1 })],
      ["Web-Shooter (two heroes' own)", deckOf("27030a", ["justice"], { "27039": 2 })],
      ["Mind Scan (event and treachery)", deckOf("40001a", ["leadership"], { "40003": 2 })],
      ["Captain Marvel (ally in two aspects)", deckOf("01001a", ["leadership"], { "23013": 1, "04032": 1 })],
      [
        "Spider-Man (basic allies in four packs)",
        deckOf("01040a", ["protection"], { "13019": 1, "27017": 1, "31022": 1, "27011": 1 }),
      ],
    ];
    test.each(COLLISIONS)("%s", (_label, deck) => {
      const text = exportDecklistText(deck, PLAYABLE_CARDS);
      const result = ok(text);
      expect(result.contents.identityCardId).toBe(deck.identityCardId);
      expect(result.contents.aspects).toEqual(deck.aspects);
      expect(entries(result.contents.cards)).toEqual(entries(deck.cards));
    });

    test("only a title that needs help gets a suffix; the rest stay bare", () => {
      const text = exportDecklistText(deckOf("44001a", ["pool"], { "44002": 1, "44046": 1 }), PLAYABLE_CARDS);
      expect(text.split("\n")).toEqual(["Hero: Deadpool", "Aspect: Pool", "1x Break Time", "1x Cable"]);
    });
  });
});
