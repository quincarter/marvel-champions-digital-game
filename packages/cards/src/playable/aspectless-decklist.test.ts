/**
 * Issue #639: a MarvelCDB decklist of only its hero's identity set and basic cards records no aspect (`meta: "{}"`),
 * and has none to record. "Back to the Basics" (decklist 68313, Miles Morales), fetched unmodified from
 * `GET https://marvelcdb.com/api/public/decklist/68313.json` on 2026-11-03, imports with no aspect chosen, is legal
 * under `validateDeck`, and plays a seeded greedy game to an outcome that replays deep-equal. Its fixture sits outside
 * `fixtures/` so the community-deck catalog does not start recommending it.
 */
import { createGame, replay, validateDeck } from "@mc/engine";
import { PLAYABLE_CARDS, parseMarvelCdbDeckJsonText } from "@mc/content";
import { expect, test } from "vitest";
import { playToOutcome } from "../testing/driver.js";
import { PLAYABLE_DEPS, playableScenario } from "./index.js";

// `import.meta.glob` with `?raw` rather than `node:fs`: `@mc/cards`'s tsconfig carries no `node` types.
interface ImportMetaEnv {
  readonly glob: (pattern: string, opts: object) => unknown;
}
const FIXTURE = (
  (import.meta as unknown as ImportMetaEnv).glob("./aspectless/*.json", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>
)["./aspectless/marvelcdb-decklist-68313.json"]!;

test("Back to the Basics (MarvelCDB 68313) imports with no aspect, is legal, and plays to an outcome", () => {
  const result = parseMarvelCdbDeckJsonText(FIXTURE, PLAYABLE_CARDS);
  if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
  expect(result.contents.identityCardId).toBe("27030a");
  expect(result.contents.aspects).toEqual([]);
  const verdict = validateDeck(result.contents, PLAYABLE_CARDS);
  expect(verdict.ok ? [] : verdict.problems).toEqual([]);

  const config = playableScenario("rhino", {
    seed: 2026,
    players: [
      {
        identityCardId: result.contents.identityCardId,
        deck: result.contents.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
        aspects: [],
      },
    ],
  });
  const created = createGame(config, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const played = playToOutcome(created.state, PLAYABLE_DEPS);
  expect(played.outcome).not.toBeNull();
  const replayed = replay(played.session.log, PLAYABLE_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(played.session.state);
});
