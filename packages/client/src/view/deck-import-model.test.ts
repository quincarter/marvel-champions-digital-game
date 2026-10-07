import { describe, expect, test } from "vitest";
import {
  CORE_CARDS,
  CORE_POOL_VERSION,
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  cardId,
  deckFromStarterDeck,
  deckId,
  type Deck,
} from "@mc/content";
import {
  exportDecklistText,
  importFromMarvelCdbResponseText,
  MARVELCDB_FIELD_PLACEHOLDER,
  importFromPasteText,
  type ImportEnv,
  uniqueDeckName,
} from "./deck-import-model.js";

const env: ImportEnv = {
  pool: CORE_CARDS,
  poolVersion: CORE_POOL_VERSION,
  now: () => "2026-09-13T00:00:00.000Z",
  newId: () => "fixed-id",
};

const spiderMan = CORE_STARTER_DECKS[0]!;

const PASTE_TEXT = [
  "Hero: Spider-Man",
  "Aspect: Justice",
  ...spiderMan.cards.map(({ cardId, quantity }) => `${quantity}x ${nameOf(cardId as string)}`),
].join("\n");

function nameOf(code: string): string {
  const names: Record<string, string> = {
    "01002": "Black Cat",
    "01003": "Backflip",
    "01004": "Enhanced Spider-Sense",
    "01005": "Swinging Web Kick",
    "01006": "Aunt May",
    "01007": "Spider-Tracer",
    "01008": "Web-Shooter",
    "01009": "Webbed Up",
    "01058": "Daredevil",
    "01059": "Jessica Jones",
    "01060": "For Justice!",
    "01061": "Great Responsibility",
    "01062": "The Power of Justice",
    "01063": "Interrogation Room",
    "01064": "Surveillance Team",
    "01065": "Heroic Intuition",
    "01083": "Mockingbird",
    "01084": "Nick Fury",
    "01085": "Emergency",
    "01086": "First Aid",
    "01087": "Haymaker",
    "01088": "Energy",
    "01089": "Genius",
    "01090": "Strength",
    "01091": "Avengers Mansion",
    "01092": "Helicarrier",
    "01093": "Tenacity",
  };
  const name = names[code];
  if (!name) throw new Error(`test fixture missing a name for ${code}`);
  return name;
}

describe("an imported deck's name", () => {
  const json = (name: string | undefined) =>
    JSON.stringify({
      ...(name === undefined ? {} : { name }),
      hero_code: spiderMan.identityCardId,
      hero_name: "Spider-Man",
      meta: '{"aspect":"justice"}',
      slots: Object.fromEntries(spiderMan.cards.map(({ cardId, quantity }) => [cardId, quantity])),
    });
  const ref = { kind: "decklist", id: "1" } as const;

  test("uses the decklist's own name, falling back to <Hero> (imported)", () => {
    const own = importFromMarvelCdbResponseText(json("Stolen Thunder!"), ref, null, env);
    if (!own.ok) throw new Error(JSON.stringify(own.problems));
    expect(own.deck.name).toBe("Stolen Thunder!");
    const bare = importFromMarvelCdbResponseText(json(undefined), ref, null, env);
    if (!bare.ok) throw new Error(JSON.stringify(bare.problems));
    expect(bare.deck.name).toBe("Spider-Man (imported)");
  });

  test("a pasted list's title line names the deck, and a name already in the store gets a suffix", () => {
    const titled = importFromPasteText(`Web Heads\n${PASTE_TEXT}`, {
      ...env,
      existingNames: ["Web Heads", "web heads (2)"],
    });
    if (!titled.ok) throw new Error(JSON.stringify(titled.problems));
    expect(titled.deck.name).toBe("Web Heads (3)");
    expect(uniqueDeckName("Fresh", ["Web Heads"])).toBe("Fresh");
  });

  test("lines the paste could not read come back as warnings by line", () => {
    const result = importFromPasteText(`${PASTE_TEXT}\nwhat is this???`, env);
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.warnings).toEqual([`Could not read line ${PASTE_TEXT.split("\n").length + 1}: what is this???`]);
  });
});

describe("importFromPasteText", () => {
  test("builds a Deck with a userBuilt-shaped `imported` source, id and pool version from the env", () => {
    const result = importFromPasteText(PASTE_TEXT, env);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.deck.id).toBe("fixed-id");
    expect(result.deck.identityCardId).toBe(spiderMan.identityCardId);
    expect(result.deck.poolVersion).toBe(CORE_POOL_VERSION);
    expect(result.deck.source).toEqual({
      kind: "imported",
      site: "marvelcdb",
      marvelcdbDeckId: null,
      url: null,
      importedAt: env.now(),
    });
    expect(result.deck.name).toContain("Spider-Man");
  });

  test("a bad paste fails with the content package's own problems, untouched", () => {
    const result = importFromPasteText("not a decklist", env);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.length).toBeGreaterThan(0);
  });
});

describe("importFromMarvelCdbResponseText", () => {
  const REAL_RESPONSE = JSON.stringify({
    id: 1,
    name: "Black Panther - Protection - Starter Deck",
    hero_code: "01040a",
    hero_name: "Black Panther",
    slots: Object.fromEntries(
      CORE_STARTER_DECKS.find((d) => d.name.startsWith("Black Panther"))!.cards.map((c) => [c.cardId, c.quantity]),
    ),
    meta: '{"aspect":"protection"}',
  });

  test("records the MarvelCDB id and url in the deck's source", () => {
    const result = importFromMarvelCdbResponseText(
      REAL_RESPONSE,
      { kind: "decklist", id: "1" },
      "https://marvelcdb.com/decklist/view/1/x",
      env,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.deck.source).toEqual({
      kind: "imported",
      site: "marvelcdb",
      marvelcdbDeckId: "1",
      url: "https://marvelcdb.com/decklist/view/1/x",
      importedAt: env.now(),
    });
    expect(result.deck.name).toContain("Black Panther");
  });

  test("MarvelCDB's actual empty-body 'not found' response fails with a specific problem, not a crash", () => {
    const result = importFromMarvelCdbResponseText("", { kind: "decklist", id: "999999999" }, null, env);
    expect(result.ok).toBe(false);
  });
});

/** By cardId, so a round trip's re-derived quantities (import re-splits an exported name+total back across codes) can be compared regardless of line order. */
const byCardId = (cards: readonly { readonly cardId: string; readonly quantity: number }[]) =>
  [...cards].sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0));

describe("exportDecklistText: the exact inverse of importFromPasteText", () => {
  test.each(CORE_STARTER_DECKS.map((starter) => [starter.name, starter] as const))(
    "%s round-trips through export/import",
    (_name, starter) => {
      const deck = deckFromStarterDeck(starter, CORE_POOL_VERSION);
      const text = exportDecklistText(deck, CORE_CARDS);

      const reimported = importFromPasteText(text, env);
      if (!reimported.ok) throw new Error(`${starter.name}: ${JSON.stringify(reimported.problems, null, 2)}`);

      expect(reimported.deck.identityCardId).toBe(deck.identityCardId);
      expect([...reimported.deck.aspects].sort()).toEqual([...deck.aspects].sort());
      expect(byCardId(reimported.deck.cards)).toEqual(byCardId(deck.cards));
    },
  );

  describe("titles shared by several cards (wave 7 QA finding 1)", () => {
    const poolEnv: ImportEnv = { ...env, pool: PLAYABLE_CARDS };
    const deckOf = (identity: string, aspects: string[], lines: Record<string, number>): Deck => ({
      id: deckId("d"),
      name: "fixture",
      identityCardId: cardId(identity),
      aspects: aspects as Deck["aspects"],
      cards: Object.entries(lines).map(([id, quantity]) => ({ cardId: cardId(id), quantity })),
      poolVersion: "v",
      source: { kind: "userBuilt", createdAt: "2026-10-06T00:00:00.000Z" },
      updatedAt: "2026-10-06T00:00:00.000Z",
    });
    test.each([
      ["Deadpool's ally Cable beside the hero", deckOf("44001a", ["pool"], { "44002": 1, "44046": 2 })],
      ["Hulk the ally beside the hero", deckOf("01001a", ["aggression"], { "01050": 2 })],
      ["Hawkeye, three allies", deckOf("01001a", ["leadership"], { "01066": 1, "03012": 1, "04011": 1 })],
      ["Web-Shooter of the second Spider-Man", deckOf("27030a", ["justice"], { "27039": 2 })],
    ])("%s round-trips by code where the title alone cannot say", (_label, deck) => {
      const text = exportDecklistText(deck, PLAYABLE_CARDS);
      const reimported = importFromPasteText(text, poolEnv);
      if (!reimported.ok) throw new Error(JSON.stringify(reimported.problems.map((p) => p.message)));
      expect(reimported.deck.identityCardId).toBe(deck.identityCardId);
      expect(byCardId(reimported.deck.cards)).toEqual(byCardId(deck.cards));
    });

    test("writes the code in parentheses only where needed, and accepts the pool as a record too", () => {
      const deck = deckOf("44001a", ["pool"], { "44002": 1, "44046": 2 });
      const asRecord = Object.fromEntries(PLAYABLE_CARDS.map((card) => [card.id, card]));
      expect(exportDecklistText(deck, asRecord as never).split("\n")).toEqual([
        "Hero: Deadpool",
        "Aspect: Pool",
        "2x Break Time",
        "1x Cable",
      ]);
      const hulk = exportDecklistText(deckOf("01001a", ["aggression"], { "01050": 2 }), PLAYABLE_CARDS);
      expect(hulk).toContain("2x Hulk");
      const hawk = exportDecklistText(deckOf("01001a", ["leadership"], { "01066": 1, "03012": 1 }), PLAYABLE_CARDS);
      expect(hawk).toContain("1x Hawkeye (01066)");
      expect(hawk).toContain("1x Hawkeye (03012)");
    });

    test("a truly ambiguous bare title is refused with the candidates named", () => {
      const result = importFromPasteText("Hero: Spider-Man (01001a)\nAspect: Justice\n1x Hawkeye\n", poolEnv);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.problems[0]!.code).toBe("ambiguous_card_name");
      expect(result.problems[0]!.message).toContain("Hawkeye (03012)");
    });
  });

  test("skips a card id the given pool doesn't resolve, rather than throwing", () => {
    const starter = CORE_STARTER_DECKS[0]!;
    const deck = deckFromStarterDeck(starter, CORE_POOL_VERSION);
    const withGhost = {
      ...deck,
      cards: [...deck.cards, { cardId: "99999" as (typeof deck.cards)[number]["cardId"], quantity: 1 }],
    };
    const text = exportDecklistText(withGhost, CORE_CARDS);
    expect(text).not.toContain("99999");
  });
});

describe("MARVELCDB_FIELD_PLACEHOLDER", () => {
  test("fits the phone's link field (about 320 px of mono text at 7.2 px a character) with room to spare", () => {
    expect(MARVELCDB_FIELD_PLACEHOLDER.length * 7.2).toBeLessThanOrEqual(280);
  });
});
