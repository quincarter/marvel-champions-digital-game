/**
 * "One real MarvelCDB decklist per hero" for every hero from Core through wave 4 (`docs/custom-deck-testing.md`,
 * "Earlier waves (Core–wave 4)"; wave 5's heroes have their own `custom-deck.test.ts`). Each saved public decklist,
 * unmodified, imports through `from-marvelcdb-json` against the playable pool, is legal under `validateDeck`, and
 * plays a seeded greedy game to an outcome that replays deep-equal.
 *
 * Fixtures: `fixtures/marvelcdb-decklist-<id>.json`, each fetched unmodified from
 * `GET https://marvelcdb.com/api/public/decklist/<id>.json` on 2026-10-01 (user approval to fetch recorded in PR 88).
 * Each hero's pick is its most-liked public decklist on MarvelCDB whose cards are all in the playable pool, except
 * Doctor Strange's, which the user chose (`docs/custom-deck-testing.md`, "Decklists to use").
 *
 * Wave 8's six heroes are listed too, from the fixtures their own wave keeps
 * (`../wave8/fixtures/decklists/<hero>.json`, fetched 2026-10-08; `../wave8/custom-decks-marvelcdb.test.ts` documents
 * them and plays each at a wave 8 scenario). Here each sits at a Core villain through `playableScenario`.
 */
import { createGame, replay, validateDeck } from "@mc/engine";
import { PLAYABLE_CARDS, parseMarvelCdbDeckJsonText, type CoreAspect } from "@mc/content";
import { describe, expect, test } from "vitest";
import { playToOutcome } from "../testing/driver.js";
import { PLAYABLE_DEPS, playableScenario } from "./index.js";

// `import.meta.glob` (Vite/vitest's own static-file loader) rather than `node:fs`: `@mc/cards`'s tsconfig carries no
// `node` types (the same pattern as `../wave5/nova/custom-deck.test.ts`).
interface ImportMetaEnv {
  readonly glob: (pattern: string, opts: object) => unknown;
}
const FIXTURES = (import.meta as unknown as ImportMetaEnv).glob("./fixtures/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const WAVE8_FIXTURES = (import.meta as unknown as ImportMetaEnv).glob("../wave8/fixtures/decklists/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/**
 * Hero identity → MarvelCDB decklist id, its name on MarvelCDB, and its chosen aspect(s). A fifth entry names the
 * fixture of a wave that keeps its own (`../wave8/fixtures/decklists/<name>.json`).
 */
const DECKLISTS: readonly (readonly [
  hero: string,
  identity: string,
  id: number,
  aspects: readonly string[],
  wave8Fixture?: string,
])[] = [
  ["Spider-Man", "01001a", 103, ["leadership"]],
  ["Captain Marvel", "01010a", 577, ["leadership"]],
  ["She-Hulk", "01019a", 543, ["leadership"]],
  ["Iron Man", "01029a", 113, ["aggression"]],
  ["Black Panther", "01040a", 449, ["leadership"]],
  ["Captain America", "03001a", 482, ["protection"]],
  ["Hawkeye", "04001a", 10940, ["aggression"]],
  ["Spider-Woman", "04031a", 3314, ["aggression", "justice"]],
  ["Ms. Marvel", "05001a", 11130, ["protection"]],
  ["Thor", "06001a", 1081, ["justice"]],
  ["Black Widow", "08001a", 10156, ["justice"]],
  ["Doctor Strange", "09001a", 1771, ["leadership"]],
  ["Hulk", "10001a", 6252, ["justice"]],
  ["Ant-Man", "12001a", 5063, ["justice"]],
  ["Wasp", "13001a", 6768, ["protection"]],
  ["Quicksilver", "14001a", 6898, ["aggression"]],
  ["Scarlet Witch", "15001a", 7692, ["justice"]],
  ["Groot", "16001a", 11201, ["protection"]],
  ["Rocket Raccoon", "16029a", 11315, ["justice"]],
  ["Star-Lord", "17001a", 13649, ["leadership"]],
  ["Gamora", "18001a", 12273, ["aggression"]],
  ["Drax", "19001a", 10588, ["protection"]],
  ["Venom", "20001a", 11340, ["justice"]],
  ["Spectrum", "21001a", 13617, ["aggression"]],
  // MarvelCDB records two of Adam Warlock's four aspects; the importer fills in the rest from the deck's cards.
  ["Adam Warlock", "21031a", 13922, ["aggression", "justice", "leadership", "protection"]],
  ["Nebula", "22001a", 12837, ["justice"]],
  ["War Machine", "23001a", 14191, ["leadership"]],
  ["Valkyrie", "25001a", 15163, ["leadership"]],
  ["Vision", "26001a", 16623, ["protection"]],
  ["Bishop", "45001a", 37204, ["justice"], "bishop"],
  ["Magik", "45030a", 37117, ["protection"], "magik"],
  ["Iceman", "46001a", 38626, ["leadership"], "iceman"],
  ["Jubilee", "47001a", 40621, ["justice"], "jubilee"],
  ["Nightcrawler", "48001a", 42268, ["protection"], "nightcrawler"],
  ["Magneto", "49001a", 43978, ["justice"], "magneto"],
];

/** The Core villains, rotated so the games don't all run against one. */
const SCENARIOS = ["rhino", "klaw", "ultron"] as const;

const WAVE8_FIXTURE_OF = new Map(DECKLISTS.filter((row) => row[4]).map((row) => [row[2], row[4]!]));

const parse = (id: number) => {
  const wave8 = WAVE8_FIXTURE_OF.get(id);
  const text = wave8
    ? WAVE8_FIXTURES[`../wave8/fixtures/decklists/${wave8}.json`]
    : FIXTURES[`./fixtures/marvelcdb-decklist-${id}.json`];
  if (text === undefined) throw new Error(`no fixture for decklist ${id}`);
  const result = parseMarvelCdbDeckJsonText(text, PLAYABLE_CARDS);
  if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
  return result;
};

describe.each(
  DECKLISTS.map(
    ([hero, identity, id, aspects], index) =>
      [hero, identity, id, aspects, SCENARIOS[index % SCENARIOS.length]!] as const,
  ),
)("%s: MarvelCDB decklist %s/%i", (hero, identity, id, aspects, scenario) => {
  test("imports against the playable pool", () => {
    const result = parse(id);
    expect(result.contents.identityCardId).toBe(identity);
    expect([...result.contents.aspects].sort()).toEqual([...aspects].sort());
    expect(result.heroName).toBe(hero);
  });

  test("is legal under validateDeck", () => {
    expect(validateDeck(parse(id).contents, PLAYABLE_CARDS)).toEqual({ ok: true });
  });

  test(`plays a seeded greedy game against ${scenario} that replays deep-equal`, () => {
    const { contents } = parse(id);
    const config = playableScenario(scenario, {
      seed: 2026,
      players: [
        {
          identityCardId: contents.identityCardId,
          deck: contents.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
          aspects: contents.aspects as readonly CoreAspect[],
        },
      ],
    });
    const created = createGame(config, PLAYABLE_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, PLAYABLE_DEPS);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, PLAYABLE_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
