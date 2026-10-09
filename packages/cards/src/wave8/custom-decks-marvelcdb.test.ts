/**
 * Wave 8 definition-of-done 4b, "A real MarvelCDB decklist per new hero" (docs/wave-definition-of-done.md,
 * docs/custom-deck-testing.md "The pieces"): one real public MarvelCDB decklist per new hero, imported with the existing
 * importer, legal under `validateDeck`, and played by the seeded greedy driver through the wave 8 scenario builder with a
 * deep-equal replay.
 *
 * Fixtures: `fixtures/decklists/<hero>.json`, each FETCHED (not composed) on 2026-10-08 from
 * `GET https://marvelcdb.com/api/public/decklist/<id>.json` (re-serialized with two-space indent; the only field changed
 * is `description_md`, emptied to keep third-party prose out of the repo and under the importer's 20,000-character cap).
 * Each is the first (most-liked) public decklist in that list for its hero, and each imports in full against the
 * playable pool with every card scripted (no decklist had to be skipped). The decks draw on earlier packs too (Core and
 * waves 1 to 7), which is why the game below widens the card pool.
 *
 * | Hero         | Decklist                                                          | Aspect     |
 * | ------------ | ----------------------------------------------------------------- | ---------- |
 * | Bishop       | 37204 "Resource Tutor" (marvelcdb.com/decklist/view/37204)        | Justice    |
 * | Magik        | 37117 "Devil May Scry!" (.../view/37117)                          | Protection |
 * | Iceman       | 38626 "Iceman - Ice To Meet You All" (.../view/38626)             | Leadership |
 * | Jubilee      | 40621 "Rush Hour" (.../view/40621)                                | Justice    |
 * | Nightcrawler | 42268 "No Allies No Problem" (.../view/42268)                     | Protection |
 * | Magneto      | 43978 "Magneto Was Right [GMW Expert Campaign]" (.../view/43978)  | Justice    |
 *
 * The game is built with `wave8Scenario` and the game's card pool widened to `PLAYABLE_CARDS` (the wave 8 pool is Core
 * plus the five wave 8 packs only; a public decklist draws on every earlier pack), as `rulings.qa.test.ts` does.
 *
 * Finding (fixed in the importer, pinned below): MarvelCDB decklists never list Iceman's six set-aside Frostbite (46002; the card sits in the
 * separate `iceman_frostbite` card set, `hero_special`, quantity 6), so a real Iceman decklist imports and then fails
 * `validateDeck` with `identity_set_mismatch` (RRG 1.8 Appendix I "Deck Customization", p. 50: "the exact quantity of
 * each card included in that identity set must be included"). Compare Psylocke's Psi-Knife (41002a), which MarvelCDB does
 * list. The importer therefore adds any identity-set card entirely absent from the slots, at its set quantity, with an
 * `identity_set_filled` note.
 */
import { describe, expect, it, test } from "vitest";
import { createGame, replay, validateDeck } from "@mc/engine";
import { PLAYABLE_CARDS, cardId, parseMarvelCdbDeckJsonText, type CoreAspect, type DeckContents } from "@mc/content";
import { playToOutcome } from "../testing/driver.js";
import { WAVE8_DEPS, wave8Scenario } from "./index.js";

// `import.meta.glob` (Vite/vitest's static-file loader) rather than `node:fs`: `@mc/cards`'s tsconfig has no `node` types.
interface ImportMetaEnv {
  readonly glob: (pattern: string, opts: object) => unknown;
}
const FIXTURES = (import.meta as unknown as ImportMetaEnv).glob("./fixtures/decklists/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const fixtureText = (hero: string): string => {
  const text = FIXTURES[`./fixtures/decklists/${hero}.json`];
  if (text === undefined) throw new Error(`no fixture for ${hero}`);
  return text;
};

const HEROES = [
  {
    hero: "bishop",
    name: "Bishop",
    identity: "45001a",
    decklist: 37204,
    aspects: ["justice"],
    scenario: "unus",
    seed: 81,
  },
  {
    hero: "magik",
    name: "Magik",
    identity: "45030a",
    decklist: 37117,
    aspects: ["protection"],
    scenario: "dark-beast",
    seed: 82,
  },
  {
    hero: "iceman",
    name: "Iceman",
    identity: "46001a",
    decklist: 38626,
    aspects: ["leadership"],
    scenario: "unus",
    seed: 83,
  },
  {
    hero: "jubilee",
    name: "Jubilee",
    identity: "47001a",
    decklist: 40621,
    aspects: ["justice"],
    scenario: "en-sabah-nur",
    seed: 84,
  },
  {
    hero: "nightcrawler",
    name: "Nightcrawler",
    identity: "48001a",
    decklist: 42268,
    aspects: ["protection"],
    scenario: "unus",
    seed: 85,
  },
  {
    hero: "magneto",
    name: "Magneto",
    identity: "49001a",
    decklist: 43978,
    aspects: ["justice"],
    scenario: "dark-beast",
    seed: 86,
  },
] as const;

const ids = new Set(PLAYABLE_CARDS.map((card) => card.id as string));

/** Iceman's six set-aside Frostbite line, which MarvelCDB decklists omit and the importer adds (see the file header). */
const FROSTBITE = { cardId: cardId("46002"), quantity: 6 } as const;

describe.each(HEROES)("$name: MarvelCDB decklist $decklist", (entry) => {
  const parse = () => {
    const result = parseMarvelCdbDeckJsonText(fixtureText(entry.hero), PLAYABLE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    return result;
  };
  /** The imported deck (Iceman's six Frostbite, which a real MarvelCDB list never carries, are added by the importer). */
  const playable = (): DeckContents => parse().contents;

  test("the fixture is the served decklist, with the description emptied", () => {
    const raw = JSON.parse(fixtureText(entry.hero)) as { id: number; description_md: string; hero_code: string };
    expect(raw.id).toBe(entry.decklist);
    expect(raw.hero_code).toBe(entry.identity);
    expect(raw.description_md).toBe("");
  });

  test("imports against the playable pool, every code resolved to a card of the pool (reprints included)", () => {
    const result = parse();
    expect(result.contents.identityCardId).toBe(entry.identity);
    expect(result.heroName).toBe(entry.name);
    expect(result.contents.aspects).toEqual(entry.aspects);
    for (const line of result.contents.cards) expect(ids.has(line.cardId as string), line.cardId as string).toBe(true);
    // The served list holds MarvelCDB codes; a reprint (a different code with `duplicate_of_code`) is merged into the
    // original's id, so the imported lines never outnumber the served slots.
    const served = JSON.parse(fixtureText(entry.hero)) as { slots: Record<string, number> };
    const servedTotal = Object.values(served.slots).reduce((n, q) => n + q, 0);
    // Plus the identity-set cards the importer fills in (Iceman's six Frostbite), which the served list never carries.
    const addedByImporter = (result.notes ?? [])
      .filter((n) => n.code === "identity_set_filled")
      .reduce((n, note) => n + (result.contents.cards.find((l) => l.cardId === note.cardIds?.[0])?.quantity ?? 0), 0);
    expect(addedByImporter).toBe(entry.hero === "iceman" ? 6 : 0);
    expect(result.contents.cards.reduce((n, l) => n + l.quantity, 0)).toBe(servedTotal + addedByImporter);
  });

  test("the deck keeps the hero's own signature cards and is legal under validateDeck", () => {
    const deck = playable();
    // The hero pack's own cards are in it: 5 to 17 of the identity set, whatever the aspect.
    const ownCards = deck.cards.filter((l) => l.cardId.startsWith(entry.identity.slice(0, 2)));
    expect(ownCards.length).toBeGreaterThan(0);
    expect(validateDeck(deck, PLAYABLE_CARDS)).toEqual({ ok: true });
  });

  test("plays a seeded greedy game that ends in an outcome or the command cap, and replays deep-equal", () => {
    const contents = playable();
    const config = wave8Scenario(entry.scenario, {
      seed: entry.seed,
      players: [
        {
          identityCardId: contents.identityCardId,
          deck: contents.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
          aspects: contents.aspects as readonly CoreAspect[],
        },
      ],
    });
    const created = createGame({ ...config, cards: PLAYABLE_CARDS }, WAVE8_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE8_DEPS, { maxCommands: 4000 });
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    // Either the game ended (win or loss) or the command cap stopped a still-running game.
    expect(result.outcome !== null || result.commands >= 4000).toBe(true);
    const replayed = replay(result.session.log, WAVE8_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});

describe("Iceman: a real MarvelCDB decklist omits the six set-aside Frostbite (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
  const imported = (): DeckContents => {
    const result = parseMarvelCdbDeckJsonText(fixtureText("iceman"), PLAYABLE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    return result.contents;
  };

  it("the importer adds the six Frostbite the served decklist lacks, and says so", () => {
    const served = JSON.parse(fixtureText("iceman")) as { slots: Record<string, number> };
    expect(served.slots["46002"]).toBeUndefined();
    const result = parseMarvelCdbDeckJsonText(fixtureText("iceman"), PLAYABLE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.contents.cards.find((l) => l.cardId === FROSTBITE.cardId)).toEqual(FROSTBITE);
    expect(result.notes?.filter((n) => n.code === "identity_set_filled").map((n) => n.cardIds)).toEqual([["46002"]]);
  });

  // A public Iceman decklist, as MarvelCDB serves it, is a legal deck once imported (the six Frostbite are Permanent and
  // come with the identity, docs/phase7-wave8.md section 3.61 and section 7.2 "Deckbuilding").
  it("the imported decklist is legal as served", () => {
    expect(validateDeck(imported(), PLAYABLE_CARDS)).toEqual({ ok: true });
  });

  it("a decklist that states a wrong Frostbite quantity is not corrected, so it still fails", () => {
    const served = JSON.parse(fixtureText("iceman")) as { slots: Record<string, number> };
    const text = JSON.stringify({ ...served, slots: { ...served.slots, "46002": 4 } });
    const result = parseMarvelCdbDeckJsonText(text, PLAYABLE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.notes?.some((n) => n.code === "identity_set_filled") ?? false).toBe(false);
    const verdict = validateDeck(result.contents, PLAYABLE_CARDS);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.problems.map((p) => p.code)).toEqual(["identity_set_mismatch"]);
  });
});
