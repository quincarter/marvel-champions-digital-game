/**
 * Wave 10 definition-of-done 4b, "A real MarvelCDB decklist per new hero" (docs/wave-definition-of-done.md,
 * docs/custom-deck-testing.md "The pieces"): one real public MarvelCDB decklist for each of the four new heroes (Tigra
 * and Hulkling of the Civil War box, Wonder Man, Hercules), imported with the existing importer, legal under
 * `validateDeck`, and played by the seeded greedy driver through `playableScenario` with a deep-equal replay.
 *
 * Fixtures: `fixtures/decklists/<hero>-<aspect>.json`, each FETCHED (not composed) on 2026-10-13 from
 * `GET https://marvelcdb.com/api/public/decklist/<id>.json` and re-serialized with two-space indent; no field is
 * changed (`description_md` is kept: the Decks screen shows it as the author's notes). Authors are read from each
 * decklist's own page (`marvelcdb.com/decklist/view/<id>`, the author link `/user/profile/<user id>/<name>`).
 *
 * Selection rule (the one wave 9 used, owner 2026-10-10): decks by the preferred MarvelCDB authors first where they fit
 * (every card in the playable pool, legal under `validateDeck`), else the most-liked public decklist that fits. The
 * twelve public decklists the hero search listed for each hero were fetched and every one
 * was checked against the playable pool: 43 of 48 import, are legal and have no unscripted card. Of the other five,
 * three use cards of packs after the Civil War box (codes 60019 to 60038, outside the pool: Tigra 64083 and 65482,
 * Wonder Man 64209) and two import but are illegal under `validateDeck` with `unique_match` (Hercules 59625, Wonder
 * Man 63132); none of those is used here.
 *
 * | Hero       | Decklist (marvelcdb.com/decklist/view/<id>)        | Author (as published) | Aspect     | Likes |
 * | ---------- | -------------------------------------------------- | --------------------- | ---------- | ----- |
 * | Tigra      | 55436 "Face It Tigra, You Just Hit The Jackpot!"   | Web-Warrior Fanatic   | Protection | 26    |
 * | Hulkling   | 55325 "Wiccan is the New Moon Girl (Expert Ronan)" | Web-Warrior Fanatic   | Leadership | 151   |
 * | Wonder Man | 60267 "Free Energy (15 zero cost events ...)"      | Web-Warrior Fanatic   | Leadership | 156   |
 * | Hercules   | 59846 "Tryhard Demigod"                            | Web-Warrior Fanatic   | Aggression | 21    |
 *
 * Wonder Man's list is the useful one for the new deckbuilding rule: a Leadership deck that holds off-aspect events
 * with a printed energy resource (`OffAspectAllowance.printedResource`). Decks are played with `PLAYABLE_CARDS` and
 * `PLAYABLE_DEPS` since a public decklist draws on every earlier pack.
 */
import { describe, expect, test } from "vitest";
import { createGame, replay, validateDeck } from "@mc/engine";
import { PLAYABLE_CARDS, parseMarvelCdbDeckJsonText, type CoreAspect, type DeckContents } from "@mc/content";
import { playToOutcome } from "../testing/driver.js";
import { PLAYABLE_DEPS, playableScenario } from "../playable/index.js";

// `import.meta.glob` (Vite/vitest's static-file loader) rather than `node:fs`: `@mc/cards`'s tsconfig has no `node` types.
interface ImportMetaEnv {
  readonly glob: (pattern: string, opts: object) => unknown;
}
const FIXTURES = (import.meta as unknown as ImportMetaEnv).glob("./fixtures/decklists/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const fixtureText = (file: string): string => {
  const text = FIXTURES[`./fixtures/decklists/${file}.json`];
  if (text === undefined) throw new Error(`no fixture for ${file}`);
  return text;
};

const DECKS = [
  {
    file: "tigra-protection",
    name: "Tigra",
    identity: "56001a",
    decklist: 55436,
    aspects: ["protection"],
    scenario: "batroc",
  },
  {
    file: "hulkling-leadership",
    name: "Hulkling",
    identity: "56029a",
    decklist: 55325,
    aspects: ["leadership"],
    scenario: "modok",
  },
  {
    file: "wonder-man-leadership",
    name: "Wonder Man",
    identity: "58001a",
    decklist: 60267,
    aspects: ["leadership"],
    scenario: "thunderbolts",
  },
  {
    file: "hercules-aggression",
    name: "Hercules",
    identity: "59001a",
    decklist: 59846,
    aspects: ["aggression"],
    scenario: "black-widow",
  },
] as const;

const ids = new Set(PLAYABLE_CARDS.map((card) => card.id as string));

describe.each(DECKS.map((d, i) => ({ ...d, seed: 101 + i })))(
  "$name: MarvelCDB decklist $decklist ($file)",
  (entry) => {
    const parse = () => {
      const result = parseMarvelCdbDeckJsonText(fixtureText(entry.file), PLAYABLE_CARDS);
      if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
      return result;
    };
    const playable = (): DeckContents => parse().contents;

    test("the fixture is the served decklist", () => {
      const raw = JSON.parse(fixtureText(entry.file)) as {
        id: number;
        description_md: string;
        hero_code: string;
      };
      expect(raw.id).toBe(entry.decklist);
      expect(raw.hero_code).toBe(entry.identity);
      expect(raw.description_md.length).toBeGreaterThan(0);
      expect(fixtureText(entry.file).length).toBeLessThan(20_000); // the importer's MAX_IMPORT_TEXT_LENGTH
    });

    test("imports against the playable pool, every code resolved to a card of the pool (reprints included)", () => {
      const result = parse();
      expect(result.contents.identityCardId).toBe(entry.identity);
      expect(result.heroName).toBe(entry.name);
      expect(result.contents.aspects).toEqual(entry.aspects);
      for (const line of result.contents.cards)
        expect(ids.has(line.cardId as string), line.cardId as string).toBe(true);
      // A reprint (a different code with `duplicate_of_code`) merges into the original's id, so the imported lines never
      // outnumber the served slots, and the importer adds nothing for a complete list.
      const served = JSON.parse(fixtureText(entry.file)) as { slots: Record<string, number> };
      const servedTotal = Object.values(served.slots).reduce((n, q) => n + q, 0);
      const added = (result.notes ?? []).filter((n) => n.code === "identity_set_filled");
      expect(added).toEqual([]);
      expect(result.contents.cards.reduce((n, l) => n + l.quantity, 0)).toBe(servedTotal);
    });

    test("the deck keeps the hero's own signature cards and is legal under validateDeck", () => {
      const deck = playable();
      const ownCards = deck.cards.filter((l) => l.cardId.startsWith(entry.identity.slice(0, 2)));
      expect(ownCards.length).toBeGreaterThan(0);
      expect(validateDeck(deck, PLAYABLE_CARDS)).toEqual({ ok: true });
    });

    test(`plays a seeded greedy game against ${entry.scenario} that ends in an outcome and replays deep-equal`, () => {
      const contents = playable();
      const config = playableScenario(entry.scenario, {
        seed: entry.seed,
        players: [
          {
            identityCardId: contents.identityCardId,
            deck: contents.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
            aspects: contents.aspects as readonly CoreAspect[],
          },
        ],
      });
      const created = createGame(config, PLAYABLE_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const result = playToOutcome(created.state, PLAYABLE_DEPS, { maxCommands: 4000 });
      expect(result.rounds).toBeGreaterThanOrEqual(1);
      // Either the game ended (win or loss) or the command cap stopped a still-running game.
      expect(result.outcome !== null || result.commands >= 4000).toBe(true);
      const replayed = replay(result.session.log, PLAYABLE_DEPS);
      expect(replayed.ok).toBe(true);
      if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
    }, 120_000);
  },
);
