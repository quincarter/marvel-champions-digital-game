/**
 * S4 (docs/phase4-screen-gaps.md §2): win/loss records derived from
 * `GameStorage.list()` — per scenario (and per difficulty within it) for W2's
 * Scenario select record line, and per deck for W9's Decks & Collection
 * per-deck record. Pure: takes the list `GameStorage.list()` already returned
 * rather than touching storage itself, so it's plain TypeScript with Vitest
 * tests, no engine/`@mc/cards`/`@mc/content` change.
 *
 * **Which statuses count, and why** (`SaveStatus`, `engine/game-storage.ts`):
 * - `won` / `lost` are results: they count as a win or a loss, and as a
 *   played game.
 * - `abandoned` (today: a game superseded by starting a new one, since
 *   `GameStorage.create` retires any still-`active` game; later also
 *   Concede, per docs/phase4-screen-gaps.md §4) is **not** a win or a loss —
 *   the scenario was never resolved — but it *is* a played game and a real
 *   "last played" moment: the player sat down and made moves, so hiding it
 *   from "games played" would quietly under-report how much a scenario or
 *   deck was actually played.
 * - `incompatible` counts as **none of the above** — not a win, loss, played
 *   game, or last-played candidate. `session-core.ts`'s `resume` only ever
 *   marks a still-`active` save `incompatible` (a finished `won`/`lost` game
 *   is never resumed, so its result is never overwritten); an `incompatible`
 *   save is therefore always a game that was in progress and never reached a
 *   result under this build. Its `round`/`outcome` describe a log that no
 *   longer replays, not a trustworthy achievement — kept only so the log can
 *   still be exported (`game-storage.ts`'s own doc comment), not as a record
 *   row.
 * - `active` (the one game currently in progress, if any) is excluded too:
 *   it hasn't concluded, so it has no result yet and no final round count.
 *   Once it ends, its own `SaveMeta` row flips to `won`/`lost`/`abandoned`
 *   and is picked up then — there is no double count, since each game is one
 *   `SaveMeta` row updated in place, never accumulated.
 *
 * So "played" here always means `status === "won" || "lost" || "abandoned"`.
 *
 * **Best clear.** `SaveMeta.round` is the round the game's log stands at —
 * for a `won` save, the round the villain was defeated on. "Fewest rounds
 * among wins" is computed only over `won` saves; a `lost`/`abandoned` save's
 * `round` never counts toward it, whatever number it happens to hold.
 * Difficulty (`SessionConfig.difficulty`: `"standard" | "expert" |
 * "extreme"`, which also carries Breakout's own multi-villain "extreme" —
 * `host.ts`'s own doc comment) is a real difference in achievement, so every
 * count is kept both per difficulty (`byDifficulty`) and summed (`combined`)
 * — a screen can show either without this module guessing which one it
 * wants.
 *
 * **Deck attribution.** A deck key is namespaced by *how* the seat is
 * attributable, so a precon id and a custom deck-storage id can never
 * collide even if their raw strings coincided: `{ kind: "starter",
 * starterDeckId }` for a `{ starterDeckId }` seat, `{ kind: "custom", deckId
 * }` for a custom seat that carries `deckId` (`CorePlayer`,
 * `packages/cards/src/core/setup.ts`; landed 2026-09-17, see
 * docs/phase4-screen-gaps.md §2 S4). A custom seat with no `deckId` at
 * all — every seat in a save written before that field existed — is
 * **unattributed**: it contributes to no deck's record, by construction
 * (there is no key to file it under), but the game it's in still counts
 * fully in its scenario's record above. `unattributedGameCount` and
 * `unattributedSeatCount` (over "played" games only, the same scope as
 * everything else here) exist so a screen can say "3 games not shown here —
 * played before deck tracking" instead of silently under-reporting a deck's
 * count. A `deckId` that no longer resolves to a stored deck (the deck was
 * since deleted, or this list is being read against different deck storage
 * than it was written from) is the caller's problem, not this module's: it
 * still keys a `DeckRecord` by that id, resolving the id against live deck
 * storage — or saying it no longer resolves — is for whatever reads
 * `decks` here.
 *
 * **A game with N seats credits each *distinct* deck once, not once per
 * seat.** Two seats playing the same deck (if that's even legal) still only
 * add one win/loss/played to that deck's record for that game — the game
 * happened once.
 */
import type { CorePlayer } from "@mc/cards";
import type { SessionConfig } from "../engine/host.js";
import type { SaveMeta, SaveStatus } from "../engine/game-storage.js";

export type Difficulty = SessionConfig["difficulty"];

const DIFFICULTIES: readonly Difficulty[] = ["standard", "expert", "extreme"];

/** One scenario's (or one difficulty within it) win/loss tally. */
export interface ScenarioTally {
  readonly wins: number;
  readonly losses: number;
  /** `status` is `won`, `lost` or `abandoned` — see this module's doc comment. */
  readonly gamesPlayed: number;
  /** Fewest `round` among `won` games in scope, or `null` when there are no wins yet. */
  readonly bestClearRounds: number | null;
}

export interface ScenarioRecord {
  readonly scenarioId: string;
  /** Present only for a difficulty this scenario has actually been played at. */
  readonly byDifficulty: Readonly<Partial<Record<Difficulty, ScenarioTally>>>;
  /** The same tally summed across every difficulty played. */
  readonly combined: ScenarioTally;
}

/** A deck's namespaced identity — see this module's doc comment on why the two kinds can never collide. */
export type DeckKey = { readonly kind: "starter"; readonly starterDeckId: string } | { readonly kind: "custom"; readonly deckId: string };

/** A stable string form of `DeckKey`, safe to use as a `Map`/object key or a list `key` prop. */
export function deckKeyToString(key: DeckKey): string {
  return key.kind === "starter" ? `starter:${key.starterDeckId}` : `custom:${key.deckId}`;
}

export interface DeckRecord {
  readonly key: DeckKey;
  readonly wins: number;
  readonly losses: number;
  readonly gamesPlayed: number;
  /** `updatedAt` of the most recent played game this deck was seated in, or `null` if never played. */
  readonly lastPlayedAt: number | null;
}

export interface ResultsHistory {
  /** One row per scenario id that has at least one played game. */
  readonly scenarios: readonly ScenarioRecord[];
  /** One row per distinct deck key seen across every played game. */
  readonly decks: readonly DeckRecord[];
  /** Played games with at least one seat this module can't attribute to a deck (see doc comment). */
  readonly unattributedGameCount: number;
  /** The sum of unattributed seats across every played game — always ≥ `unattributedGameCount`. */
  readonly unattributedSeatCount: number;
}

const PLAYED_STATUSES: ReadonlySet<SaveStatus> = new Set<SaveStatus>(["won", "lost", "abandoned"]);

function emptyTally(): ScenarioTally {
  return { wins: 0, losses: 0, gamesPlayed: 0, bestClearRounds: null };
}

function foldInto(tally: ScenarioTally, meta: SaveMeta): ScenarioTally {
  const wins = tally.wins + (meta.status === "won" ? 1 : 0);
  const losses = tally.losses + (meta.status === "lost" ? 1 : 0);
  const gamesPlayed = tally.gamesPlayed + 1;
  const bestClearRounds =
    meta.status === "won" ? (tally.bestClearRounds === null ? meta.round : Math.min(tally.bestClearRounds, meta.round)) : tally.bestClearRounds;
  return { wins, losses, gamesPlayed, bestClearRounds };
}

/** The seat's deck key, or `null` when it's an unattributed custom seat (see doc comment). */
function keyOfSeat(seat: CorePlayer): DeckKey | null {
  if ("starterDeckId" in seat) return { kind: "starter", starterDeckId: seat.starterDeckId };
  return seat.deckId ? { kind: "custom", deckId: seat.deckId } : null;
}

interface MutableDeckRecord {
  wins: number;
  losses: number;
  gamesPlayed: number;
  lastPlayedAt: number | null;
}

/** Every distinct `DeckKey` string a played game's seats resolve to, plus how many seats didn't resolve. */
function seatKeysOf(meta: SaveMeta): { readonly keys: ReadonlySet<string>; readonly unattributedSeats: number } {
  const keys = new Set<string>();
  let unattributedSeats = 0;
  for (const seat of meta.config.players) {
    const key = keyOfSeat(seat);
    if (key) keys.add(deckKeyToString(key));
    else unattributedSeats += 1;
  }
  return { keys, unattributedSeats };
}

/** `saves` is whatever `GameStorage.list()` returned — order doesn't matter, and the input isn't mutated. */
export function resultsHistoryOf(saves: readonly SaveMeta[]): ResultsHistory {
  const played = saves.filter((meta) => PLAYED_STATUSES.has(meta.status));

  const scenarioTallies = new Map<string, { byDifficulty: Map<Difficulty, ScenarioTally>; combined: ScenarioTally }>();
  const deckKeys = new Map<string, DeckKey>();
  const deckTallies = new Map<string, MutableDeckRecord>();
  let unattributedGameCount = 0;
  let unattributedSeatCount = 0;

  for (const meta of played) {
    const scenarioId = meta.config.scenarioId;
    let scenario = scenarioTallies.get(scenarioId);
    if (!scenario) {
      scenario = { byDifficulty: new Map(), combined: emptyTally() };
      scenarioTallies.set(scenarioId, scenario);
    }
    const difficulty = meta.config.difficulty;
    scenario.byDifficulty.set(difficulty, foldInto(scenario.byDifficulty.get(difficulty) ?? emptyTally(), meta));
    scenario.combined = foldInto(scenario.combined, meta);

    const { keys, unattributedSeats } = seatKeysOf(meta);
    if (unattributedSeats > 0) {
      unattributedGameCount += 1;
      unattributedSeatCount += unattributedSeats;
    }
    for (const seat of meta.config.players) {
      const key = keyOfSeat(seat);
      if (!key) continue;
      const keyString = deckKeyToString(key);
      deckKeys.set(keyString, key);
    }
    for (const keyString of keys) {
      const deck = deckTallies.get(keyString) ?? { wins: 0, losses: 0, gamesPlayed: 0, lastPlayedAt: null };
      deck.wins += meta.status === "won" ? 1 : 0;
      deck.losses += meta.status === "lost" ? 1 : 0;
      deck.gamesPlayed += 1;
      deck.lastPlayedAt = deck.lastPlayedAt === null ? meta.updatedAt : Math.max(deck.lastPlayedAt, meta.updatedAt);
      deckTallies.set(keyString, deck);
    }
  }

  // Sorted by key rather than left in Map-insertion order, so the result doesn't depend on what
  // order `saves` arrived in — `results-history.test.ts`'s shuffle test checks this directly.
  const scenarios: ScenarioRecord[] = [...scenarioTallies.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([scenarioId, entry]) => ({
      scenarioId,
      byDifficulty: Object.fromEntries(
        DIFFICULTIES.filter((difficulty) => entry.byDifficulty.has(difficulty)).map((difficulty) => [difficulty, entry.byDifficulty.get(difficulty)!]),
      ) as Readonly<Partial<Record<Difficulty, ScenarioTally>>>,
      combined: entry.combined,
    }));

  const decks: DeckRecord[] = [...deckTallies.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([keyString, tally]) => ({
      key: deckKeys.get(keyString)!,
      ...tally,
    }));

  return { scenarios, decks, unattributedGameCount, unattributedSeatCount };
}
