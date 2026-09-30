/**
 * "One real MarvelCDB decklist per new hero" (docs/wave-definition-of-done.md §4b, docs/custom-deck-testing.md
 * "The pieces"): a saved public decklist, unmodified, imports through `from-marvelcdb-json`, is legal under
 * `validateDeck`, and plays a seeded greedy game to a real outcome that replays deep-equal — proving SP//dr's cards
 * outside her own precon, the way a player who built this deck and imported it from MarvelCDB actually would.
 *
 * Fixture: `fixtures/marvelcdb-decklist-22071.json`, fetched unmodified from
 * `GET https://marvelcdb.com/api/public/decklist/22071.json` on 2026-09-28 (user approval to fetch from
 * marvelcdb.com recorded 2026-09-27, docs/custom-deck-testing.md).
 *
 * "SP//dr Suit Aggression" — https://marvelcdb.com/decklist/view/22071/sp-dr-suit-aggression-1.0, by LeahLorenna,
 * published 2022-08-22. An Aggression build (not the `spdr-protection` precon).
 */
import { describe, expect, test } from "vitest";
import { createGame, replay, validateDeck } from "@mc/engine";
import { parseMarvelCdbDeckJsonText, type CoreAspect, type DeckContents } from "@mc/content";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE5_CARDS } from "../cards.js";
import { wave5Scenario } from "../setup.js";
import { WAVE5_DEPS } from "../testing.js";

// `import.meta.glob` (Vite/vitest's own static-file loader, `../../wave4/coverage.test.ts`'s own
// `ImportMetaEnv`/`?raw` precedent) rather than `node:fs`: `@mc/cards`'s tsconfig carries no `node` types.
interface ImportMetaEnv {
  readonly glob: (pattern: string, opts: object) => unknown;
}
const FIXTURE_TEXT = (
  (import.meta as unknown as ImportMetaEnv).glob("./fixtures/*.json", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>
)["./fixtures/marvelcdb-decklist-22071.json"]!;

describe("SP//dr: a real MarvelCDB decklist", () => {
  test("imports against the wave 5 pool", () => {
    const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE5_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.identityCardId).toBe("31001a"); // SP//dr's identity card.
    expect(result.contents.aspects).toEqual(["aggression"]);
    expect(result.heroName).toBe("SP//dr Suit");
  });

  test("is legal under validateDeck", () => {
    const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE5_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(validateDeck(result.contents, WAVE5_CARDS)).toEqual({ ok: true });
  });

  test("plays a seeded greedy game to an outcome that replays deep-equal", () => {
    const parsed = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE5_CARDS);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems, null, 2));
    const contents: DeckContents = parsed.contents;
    const config = wave5Scenario("rhino", {
      seed: 2026,
      players: [
        {
          identityCardId: contents.identityCardId,
          deck: contents.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
          aspects: contents.aspects as readonly CoreAspect[],
        },
      ],
    });
    const created = createGame(config, WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE5_DEPS);
    console.info(
      `[wave5 custom-deck] Rhino — SP//dr (marvelcdb 22071): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE5_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
