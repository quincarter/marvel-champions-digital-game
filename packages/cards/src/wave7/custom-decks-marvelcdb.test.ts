/**
 * Wave 7 definition-of-done 4b, piece 3 (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The pieces"): one
 * real public MarvelCDB decklist per new hero, imported with the existing importer against the wave 7 pool, legal under
 * `validateDeck`, and played by the seeded greedy driver in a scenario the hero's precon is not tied to, with a
 * deep-equal replay.
 *
 * Fixtures: `fixtures/decklists/<hero>.json`, each fetched on 2026-10-05 from
 * `GET https://marvelcdb.com/api/public/decklist/<id>.json` (compact JSON re-serialized; the only field changed is the
 * long `description_md`, emptied to keep third-party prose out of the repo). Each was chosen as the most-liked public
 * decklist for that hero (MarvelCDB `decklists/find?hero=<code>&sort=likes`, the first twelve per hero, 2026-10-05)
 * that imports in full against the wave 7 pool. "Packs" are the packs of the cards the importer resolved (a reprint
 * counts as its original pack), and every one of them is in the wave 7 pool.
 *
 * | Hero     | Decklist                                                   | Aspect     | Packs it needs                                                              |
 * | -------- | ---------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
 * | Cable    | 36270 "I Love Spider-Man" (marvelcdb.com/decklist/view/36270)       | Justice    | core, next_evol, mts, nebu, vision, cyclops, trors, thor, bkw               |
 * | Domino   | 31027 "The Posse Hits the Jackpot!" (.../view/31027)       | Protection | core, next_evol, gmw, sm, wolv, msm, drs                                    |
 * | Psylocke | 32089 "Ten Percent Luck, Twenty Percent Skill" (.../32089) | Aggression | core, next_evol, psylocke, ant, vnm, nova, mut_gen, phoenix, wolv, bkw      |
 * | Angel    | 32096 "On a Wing and a Prayer" (.../view/32096)            | Protection | core, angel, ant, wsp, gmw, ironheart, wolv, rogue, drs                     |
 * | X-23     | 34241 "X-23 - Perfected" (.../view/34241)                  | Protection | core, x23, next_evol, angel, hlk, gmw, drax, mts, sm, mut_gen, cyclops, storm |
 * | Deadpool | 33532 "Resource 'Pool" (.../view/33532)                    | 'Pool      | core, deadpool, wsp, sm, msm                                                |
 */
import { describe, expect, test } from "vitest";
import { createGame, replay, validateDeck } from "@mc/engine";
import { parseMarvelCdbDeckJsonText, type CoreAspect, type DeckContents } from "@mc/content";
import { playToOutcome } from "../testing/driver.js";
import { WAVE7_CARDS } from "./cards.js";
import { WAVE7_DEPS, wave7Scenario } from "./index.js";

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
    hero: "cable",
    name: "Cable",
    identity: "40001a",
    decklist: 36270,
    aspects: ["justice"],
    scenario: "morlock-siege",
    seed: 71,
  },
  {
    hero: "domino",
    name: "Domino",
    identity: "40037a",
    decklist: 31027,
    aspects: ["protection"],
    scenario: "on-the-run",
    seed: 72,
  },
  {
    hero: "psylocke",
    name: "Psylocke",
    identity: "41001a",
    decklist: 32089,
    aspects: ["aggression"],
    scenario: "morlock-siege",
    seed: 73,
  },
  {
    hero: "angel",
    name: "Angel",
    identity: "42001a",
    decklist: 32096,
    aspects: ["protection"],
    scenario: "on-the-run",
    seed: 74,
  },
  {
    hero: "x23",
    name: "X-23",
    identity: "43001a",
    decklist: 34241,
    aspects: ["protection"],
    scenario: "morlock-siege",
    seed: 75,
  },
  {
    hero: "deadpool",
    name: "Deadpool",
    identity: "44001a",
    decklist: 33532,
    aspects: ["pool"],
    scenario: "on-the-run",
    seed: 76,
  },
] as const;

const ids = new Set(WAVE7_CARDS.map((card) => card.id as string));

describe.each(HEROES)("$name: MarvelCDB decklist $decklist", (entry) => {
  const parse = () => {
    const result = parseMarvelCdbDeckJsonText(fixtureText(entry.hero), WAVE7_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    return result;
  };

  test("the fixture is the served decklist, with the description emptied", () => {
    const raw = JSON.parse(fixtureText(entry.hero)) as { id: number; description_md: string; hero_code: string };
    expect(raw.id).toBe(entry.decklist);
    expect(raw.hero_code).toBe(entry.identity);
    expect(raw.description_md).toBe("");
  });

  test("imports against the wave 7 pool, every code resolved to a card of the pool (reprints included)", () => {
    const result = parse();
    expect(result.contents.identityCardId).toBe(entry.identity);
    expect(result.heroName).toBe(entry.name);
    expect(result.contents.aspects).toEqual(entry.aspects);
    for (const line of result.contents.cards) expect(ids.has(line.cardId as string), line.cardId as string).toBe(true);
    // The served list holds MarvelCDB codes; a reprint (a different code with `duplicate_of_code`) is merged into the
    // original's id, so the imported lines never outnumber the served slots.
    const served = JSON.parse(fixtureText(entry.hero)) as { slots: Record<string, number> };
    const servedTotal = Object.values(served.slots).reduce((n, q) => n + q, 0);
    expect(result.contents.cards.reduce((n, l) => n + l.quantity, 0)).toBe(servedTotal);
  });

  test("is legal under validateDeck", () => {
    expect(validateDeck(parse().contents, WAVE7_CARDS)).toEqual({ ok: true });
  });

  test("plays a seeded greedy game that ends in an outcome or the command cap, and replays deep-equal", () => {
    const contents: DeckContents = parse().contents;
    const config = wave7Scenario(entry.scenario, {
      seed: entry.seed,
      players: [
        {
          identityCardId: contents.identityCardId,
          deck: contents.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
          aspects: contents.aspects as readonly CoreAspect[],
        },
      ],
    });
    const created = createGame(config, WAVE7_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE7_DEPS, { maxCommands: 4000 });
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    // Either the game ended (win or loss) or the command cap stopped a still-running game.
    expect(result.outcome !== null || result.commands >= 4000).toBe(true);
    const replayed = replay(result.session.log, WAVE7_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 60_000);
});
