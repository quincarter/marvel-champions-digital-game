/**
 * Headless smoke games for a pack (docs/custom-content-packs.md §11.2 `mc-pack test`): the pack's precons played on
 * the real engine by the cards package's greedy driver (`playToOutcome`, what the sample pack's own test and the
 * precon e2e tests use), against a Core scenario. A game fails on an engine error, an illegal command, a game with no
 * outcome inside the command budget (stuck), a prompt left open at the end, or a replay of its log that does not
 * reproduce the same state.
 *
 * Node-only only because of `node:util`'s deep equality; nothing here touches the disk.
 */
import { isDeepStrictEqual } from "node:util";
import { PLAYABLE_DEPS, coreScenario } from "@mc/cards";
import { playToOutcome } from "@mc/cards/testing";
import { CORE_SCENARIOS, PLAYABLE_CARDS, type StarterDeck } from "@mc/content";
import { createGame, replay, type GameState } from "@mc/engine";
import { cardPoolWithPack, gameDepsWithPack } from "./game.js";
import type { PackInput } from "./validate.js";

/** The base precon a pack with no hero deck of its own is played with. */
export const SMOKE_BASE_DECK = "core-spider-man-justice";
export const SMOKE_SCENARIOS: readonly string[] = CORE_SCENARIOS.map((s) => String(s.id));

export interface SmokeOptions {
  /** Games per deck, seeded 1..games. Default 3. */
  readonly games?: number;
  /** A Core scenario id (`rhino`, `klaw`, `ultron`). Default `rhino`. */
  readonly scenario?: string;
  /** The driver's command budget per game; a game that runs past it is stuck. Default 4000. */
  readonly maxCommands?: number;
  /** Called after each game, for progress output. */
  readonly onGame?: (game: SmokeGame) => void;
}

export interface SmokeGame {
  readonly deck: string;
  readonly seed: number;
  readonly ok: boolean;
  /** `win (villainDefeated)`, `loss (mainSchemeCompleted)`, ...; absent when the game failed before it ended. */
  readonly outcome?: string;
  readonly rounds: number;
  readonly commands: number;
  /** Why the game failed. */
  readonly error?: string;
  /** The pack's own cards played in this game. */
  readonly packCardsPlayed: readonly string[];
}

export interface SmokeResult {
  readonly ok: boolean;
  readonly scenario: string;
  readonly games: readonly SmokeGame[];
  /** Not failures: what the run could not cover (a pack with no deck of its own, no pack card played). */
  readonly notes: readonly string[];
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Plays `options.games` headless games per deck the pack can field. Never throws for a broken pack. */
export function smokeTestPack(pack: PackInput, options: SmokeOptions = {}): SmokeResult {
  const games = options.games ?? 3;
  const scenario = options.scenario ?? "rhino";
  const maxCommands = options.maxCommands ?? 4000;
  if (!Number.isInteger(games) || games < 1) throw new Error("games must be a whole number of at least 1");
  if (!SMOKE_SCENARIOS.includes(scenario))
    throw new Error(`unknown scenario "${scenario}" (one of ${SMOKE_SCENARIOS.join(", ")})`);

  const prefix = `x.${pack.manifest.id}.`;
  const notes: string[] = [];
  const pool = cardPoolWithPack(PLAYABLE_CARDS, pack);
  const deps = gameDepsWithPack(PLAYABLE_DEPS, pack);
  const packDecks: readonly StarterDeck[] = pack.decks ?? [];
  const seats: { readonly name: string; readonly deck?: StarterDeck }[] = packDecks.map((deck) => ({
    name: String(deck.id),
    deck,
  }));
  if (seats.length === 0) {
    if (pack.cards.some((card) => card.type === "hero_identity"))
      notes.push("the pack has a hero but no deck in decks/: add its precon so mc-pack test can play it");
    else
      notes.push(
        `the pack has no deck of its own, so a base precon (${SMOKE_BASE_DECK}) played ${scenario} with the pack's ` +
          "cards in the pool; the pack's own scenarios are not played yet",
      );
    seats.push({ name: SMOKE_BASE_DECK });
  }

  const open = (deck: StarterDeck | undefined, seed: number): GameState => {
    const config = coreScenario(scenario, {
      players: [{ starterDeckId: SMOKE_BASE_DECK }],
      seed,
      difficulty: "standard",
      modularSetIds: [],
      cardPool: pool,
    });
    const players = deck
      ? [
          {
            identityCardId: deck.identityCardId,
            ...(deck.aspects ? { aspects: deck.aspects } : {}),
            deck: deck.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
          },
        ]
      : config.players;
    const created = createGame({ ...config, players }, deps);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    return created.state;
  };

  const results: SmokeGame[] = [];
  const everPlayed = new Set<string>();
  for (const seat of seats) {
    for (let seed = 1; seed <= games; seed++) {
      let game: SmokeGame;
      try {
        const run = playToOutcome(open(seat.deck, seed), deps, { maxCommands });
        const state = run.session.state;
        const base = { deck: seat.name, seed, rounds: run.rounds, commands: run.commands };
        const replayed = replay(run.session.log, deps);
        const played = replayed.ok
          ? [
              ...new Set(
                replayed.events.flatMap((e) =>
                  e.type === "cardPlayed" && String(e.cardId).startsWith(prefix) ? [String(e.cardId)] : [],
                ),
              ),
            ]
          : [];
        let error: string | undefined;
        if (run.outcome === null) error = `stuck: no outcome after ${run.commands} commands (round ${run.rounds})`;
        else if (state.pendingChoice !== null) error = "a prompt was still open when the game ended";
        else if (!replayed.ok) error = `the game's log does not replay: ${replayed.error.message}`;
        else if (!isDeepStrictEqual(replayed.state, state)) error = "the game's log replays to a different state";
        game = {
          ...base,
          ok: error === undefined,
          ...(run.outcome ? { outcome: `${run.outcome.result} (${run.outcome.reason})` } : {}),
          ...(error !== undefined ? { error } : {}),
          packCardsPlayed: played,
        };
      } catch (caught) {
        game = {
          deck: seat.name,
          seed,
          ok: false,
          rounds: 0,
          commands: 0,
          error: errorText(caught),
          packCardsPlayed: [],
        };
      }
      for (const code of game.packCardsPlayed) everPlayed.add(code);
      results.push(game);
      options.onGame?.(game);
    }
  }
  if (packDecks.length > 0 && everPlayed.size === 0)
    notes.push("no game played one of the pack's own cards; try more games (--games)");
  return { ok: results.every((g) => g.ok), scenario, games: results, notes };
}
