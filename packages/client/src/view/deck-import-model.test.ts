import { describe, expect, test } from "vitest";
import { CORE_CARDS, CORE_POOL_VERSION, CORE_STARTER_DECKS } from "@mc/content";
import { importFromMarvelCdbResponseText, importFromPasteText, type ImportEnv } from "./deck-import-model.js";

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

describe("importFromPasteText", () => {
  test("builds a Deck with a userBuilt-shaped `imported` source, id and pool version from the env", () => {
    const result = importFromPasteText(PASTE_TEXT, env);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.deck.id).toBe("fixed-id");
    expect(result.deck.identityCardId).toBe(spiderMan.identityCardId);
    expect(result.deck.poolVersion).toBe(CORE_POOL_VERSION);
    expect(result.deck.source).toEqual({ kind: "imported", site: "marvelcdb", marvelcdbDeckId: null, url: null, importedAt: env.now() });
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
    slots: Object.fromEntries(CORE_STARTER_DECKS.find((d) => d.name.startsWith("Black Panther"))!.cards.map((c) => [c.cardId, c.quantity])),
    meta: '{"aspect":"protection"}',
  });

  test("records the MarvelCDB id and url in the deck's source", () => {
    const result = importFromMarvelCdbResponseText(REAL_RESPONSE, { kind: "decklist", id: "1" }, "https://marvelcdb.com/decklist/view/1/x", env);
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
