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
 *
 * Wave 9's six heroes are listed the same way, two decks each (fetched 2026-10-10, `../wave9/fixtures/decklists/
 * <hero>-<aspect>.json`; `../wave9/custom-decks-marvelcdb.test.ts` documents them and plays each at a wave 9 scenario).
 *
 * The same fixtures are the community-deck catalog a client recommends from (`./community-decks.ts`). The last two
 * blocks here keep the two in step: every catalog deck this file's table does not name (waves 5 to 7, whose own
 * tests play them in their own wave's pool, and any later fixture) gets the same three proofs against the playable
 * pool, and every catalog deck is one this file proved.
 *
 * The decks are dealt round-robin over `DECKLIST_PARTS` test files (`./marvelcdb-decklists-<part>.test.ts`), which
 * run in parallel: as one file they took 13 to 17 minutes on a CI runner (2026-10-16). CI runs them in jobs of their
 * own (scripts/ci-test-plan.mjs).
 */
import { createGame, replay, validateDeck } from "@mc/engine";
import { PLAYABLE_CARDS, parseMarvelCdbDeckJsonText, type CoreAspect, type DeckContents } from "@mc/content";
import { describe, expect, test } from "vitest";
import { playToOutcome } from "../testing/driver.js";
import { communityDecks, type CommunityDeck } from "./community-decks.js";
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

const WAVE9_FIXTURES = (import.meta as unknown as ImportMetaEnv).glob("../wave9/fixtures/decklists/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const WAVE10_FIXTURES = (import.meta as unknown as ImportMetaEnv).glob("../wave10/fixtures/decklists/*.json", {
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
  wave9Fixture?: string,
  wave10Fixture?: string,
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
  ["Maria Hill", "50001a", 47248, ["justice"], "", "maria-hill-justice"],
  ["Maria Hill", "50001a", 47008, ["leadership"], "", "maria-hill-leadership"],
  ["Nick Fury", "50034a", 47451, ["aggression"], "", "nick-fury-aggression"],
  ["Nick Fury", "50034a", 47480, ["justice"], "", "nick-fury-justice"],
  ["Black Panther", "51001a", 49281, ["protection"], "", "black-panther-protection"],
  ["Black Panther", "51001a", 49532, ["justice"], "", "black-panther-justice"],
  ["Silk", "52001a", 49979, ["leadership"], "", "silk-leadership"],
  ["Silk", "52001a", 49367, ["justice"], "", "silk-justice"],
  ["Falcon", "53001a", 51319, ["leadership"], "", "falcon-leadership"],
  ["Falcon", "53001a", 51168, ["pool"], "", "falcon-pool"],
  ["Winter Soldier", "54001a", 53541, ["pool"], "", "winter-soldier-pool"],
  ["Winter Soldier", "54001a", 51222, ["aggression"], "", "winter-soldier-aggression"],
  ["Tigra", "56001a", 55436, ["protection"], "", "", "tigra-protection"],
  ["Hulkling", "56029a", 55325, ["leadership"], "", "", "hulkling-leadership"],
  ["Wonder Man", "58001a", 60267, ["leadership"], "", "", "wonder-man-leadership"],
  ["Hercules", "59001a", 59846, ["aggression"], "", "", "hercules-aggression"],
];

/** The Core villains, rotated so the games don't all run against one. */
const SCENARIOS = ["rhino", "klaw", "ultron"] as const;

const WAVE8_FIXTURE_OF = new Map(DECKLISTS.filter((row) => row[4]).map((row) => [row[2], row[4]!]));
const WAVE9_FIXTURE_OF = new Map(DECKLISTS.filter((row) => row[5]).map((row) => [row[2], row[5]!]));

const WAVE10_FIXTURE_OF = new Map(DECKLISTS.filter((row) => row[6]).map((row) => [row[2], row[6]!]));

const parse = (id: number) => {
  const wave10 = WAVE10_FIXTURE_OF.get(id);
  const wave8 = WAVE8_FIXTURE_OF.get(id);
  const wave9 = WAVE9_FIXTURE_OF.get(id);
  const text = wave10
    ? WAVE10_FIXTURES[`../wave10/fixtures/decklists/${wave10}.json`]
    : wave9
      ? WAVE9_FIXTURES[`../wave9/fixtures/decklists/${wave9}.json`]
      : wave8
        ? WAVE8_FIXTURES[`../wave8/fixtures/decklists/${wave8}.json`]
        : FIXTURES[`./fixtures/marvelcdb-decklist-${id}.json`];
  if (text === undefined) throw new Error(`no fixture for decklist ${id}`);
  const result = parseMarvelCdbDeckJsonText(text, PLAYABLE_CARDS);
  if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
  return result;
};

/** A seeded greedy game at a Core villain reaches an outcome, and its log replays to the same state. */
function playsAndReplays(contents: DeckContents, scenario: (typeof SCENARIOS)[number]): void {
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
}

const TABLE_IDS = new Set(DECKLISTS.map((row) => row[2]));
/** Catalog decks the table above does not name. */
const REST_OF_CATALOG: readonly CommunityDeck[] = communityDecks().filter((deck) => !TABLE_IDS.has(deck.marvelcdbId));

/** How many test files share the decks; each `marvelcdb-decklists-<part>.test.ts` passes its part, 1 to `DECKLIST_PARTS`. */
export const DECKLIST_PARTS = 4;
/** Deck `index` (the table's rows, then the rest of the catalog) runs in part `index % DECKLIST_PARTS + 1`. */
const inPart = (index: number, part: number) => index % DECKLIST_PARTS === part - 1;

/** Declares this part's decks; the catalog checks run in part 1. */
export function marvelcdbDecklists(part: number): void {
  describe.each(
    DECKLISTS.map(
      ([hero, identity, id, aspects], index) =>
        [hero, identity, id, aspects, SCENARIOS[index % SCENARIOS.length]!] as const,
    ).filter((_, index) => inPart(index, part)),
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
      playsAndReplays(parse(id).contents, scenario);
    }, 120_000);
  });

  describe.each(
    REST_OF_CATALOG.map(
      (deck, index) => [deck.heroName, deck.marvelcdbId, deck, SCENARIOS[index % SCENARIOS.length]!] as const,
    ).filter((_, index) => inPart(DECKLISTS.length + index, part)),
  )("%s: community deck %i", (_hero, _id, deck, scenario) => {
    test("is legal under validateDeck against the playable pool", () => {
      expect(validateDeck(deck.contents, PLAYABLE_CARDS)).toEqual({ ok: true });
    });

    test(`plays a seeded greedy game against ${scenario} that replays deep-equal`, () => {
      playsAndReplays(deck.contents, scenario);
    }, 120_000);
  });

  if (part === 1)
    describe("the community-deck catalog", () => {
      test("lists every decklist in the table above, with the contents this file proved", () => {
        const catalog = new Map(communityDecks().map((deck) => [deck.marvelcdbId, deck]));
        for (const [hero, identity, id] of DECKLISTS) {
          const entry = catalog.get(id);
          expect(entry, `${hero}'s decklist ${id} is in the catalog`).toBeDefined();
          expect(entry!.identityCardId).toBe(identity);
          expect(entry!.contents).toEqual(parse(id).contents);
        }
      });

      test("has no deck this file did not prove", () => {
        const proved = new Set([...TABLE_IDS, ...REST_OF_CATALOG.map((deck) => deck.marvelcdbId)]);
        expect(communityDecks().filter((deck) => !proved.has(deck.marvelcdbId))).toEqual([]);
      });
    });
}
