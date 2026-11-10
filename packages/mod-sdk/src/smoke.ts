/**
 * Headless smoke games for a pack (docs/custom-content-packs.md §11.2 `mc-pack test`) on the real engine, played by the
 * cards package's greedy driver (`playToOutcome`, what the sample packs' own tests and the precon e2e tests use):
 *
 * - the pack's hero precons against a Core scenario;
 * - each of the pack's scenarios, with a base precon (`SMOKE_BASE_DECK`) and the scenario's recommended modular set;
 * - each of the pack's modular encounter sets, with a base precon at the Core scenario, picked as its modular set.
 *
 * A game fails on an engine error, an illegal command, a game with no
 * outcome inside the command budget (stuck), a prompt left open at the end, or a replay of its log that does not
 * reproduce the same state.
 *
 * Node-only only because of `node:util`'s deep equality; nothing here touches the disk.
 */
import { isDeepStrictEqual } from "node:util";
import { PLAYABLE_DEPS } from "@mc/cards";
import { playToOutcome } from "@mc/cards/testing";
import { CORE_SCENARIOS, type Scenario, type StarterDeck } from "@mc/content";
import { createGame, replay, type GameState } from "@mc/engine";
import { gameDepsWithPack, packModularSetChoices, packScenarioRecords, scenarioWithPacks } from "./game.js";
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
  /** The deck seated: a pack precon's id, or the base precon's. */
  readonly deck: string;
  /** The scenario played: a Core scenario's id or one of the pack's. */
  readonly scenario: string;
  /** The pack's modular set picked at the scenario in this game, when the game is about one. */
  readonly modularSet?: string;
  /** `"expert"` for a pack scenario's expert-mode game; absent is standard. */
  readonly difficulty?: "expert";
  readonly seed: number;
  readonly ok: boolean;
  /** `win (villainDefeated)`, `loss (mainSchemeCompleted)`, ...; absent when the game failed before it ended. */
  readonly outcome?: string;
  readonly rounds: number;
  readonly commands: number;
  /** Why the game failed. */
  readonly error?: string;
  /** The pack's own cards played, or revealed from its encounter sets, in this game. */
  readonly packCardsPlayed: readonly string[];
}

export interface SmokeResult {
  readonly ok: boolean;
  readonly scenario: string;
  readonly games: readonly SmokeGame[];
  /** Not failures: what the run could not cover (a hero with no deck, no pack card played). */
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
  const deps = gameDepsWithPack(PLAYABLE_DEPS, pack);
  const packDecks: readonly StarterDeck[] = pack.decks ?? [];
  // One plan per kind of game: who sits, at which scenario, with which modular pick.
  interface Plan {
    readonly name: string;
    readonly deck?: StarterDeck;
    readonly scenario: string;
    readonly modularSet?: string;
    readonly difficulty?: "expert";
    /** The modular sets to pick; absent is the scenario's recommendation. */
    readonly modularSetIds?: readonly string[];
  }
  const plans: Plan[] = packDecks.map((deck) => ({ name: String(deck.id), deck, scenario }));
  if (plans.length === 0 && pack.cards.some((card) => card.type === "hero_identity"))
    notes.push("the pack has a hero but no deck in decks/: add its precon so mc-pack test can play it");
  const ownScenarios: readonly Scenario[] = packScenarioRecords([pack]);
  for (const record of ownScenarios) {
    plans.push({ name: SMOKE_BASE_DECK, scenario: String(record.id) });
    plans.push({ name: SMOKE_BASE_DECK, scenario: String(record.id), difficulty: "expert" });
  }
  const baseRecord = CORE_SCENARIOS.find((candidate) => String(candidate.id) === scenario);
  for (const set of baseRecord ? packModularSetChoices(baseRecord, [pack]) : [])
    plans.push({ name: SMOKE_BASE_DECK, scenario, modularSet: String(set.id), modularSetIds: [String(set.id)] });
  if (plans.length === 0) {
    notes.push(
      `the pack has no hero deck, scenario or modular set of its own, so a base precon (${SMOKE_BASE_DECK}) played ` +
        `${scenario} with the pack's cards in the pool`,
    );
    plans.push({ name: SMOKE_BASE_DECK, scenario });
  }

  const open = (plan: Plan, seed: number): GameState => {
    const seat = plan.deck
      ? {
          identityCardId: plan.deck.identityCardId,
          ...(plan.deck.aspects ? { aspects: plan.deck.aspects } : {}),
          deck: plan.deck.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
        }
      : { starterDeckId: SMOKE_BASE_DECK };
    const config = scenarioWithPacks(
      plan.scenario,
      {
        players: [seat],
        seed,
        difficulty: plan.difficulty ?? "standard",
        ...(plan.modularSetIds ? { modularSetIds: plan.modularSetIds } : {}),
      },
      [pack],
    );
    const created = createGame(config, deps);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    return created.state;
  };

  const results: SmokeGame[] = [];
  const everPlayed = new Set<string>();
  for (const plan of plans) {
    for (let seed = 1; seed <= games; seed++) {
      let game: SmokeGame;
      try {
        const run = playToOutcome(open(plan, seed), deps, { maxCommands });
        const state = run.session.state;
        const base = {
          deck: plan.name,
          scenario: plan.scenario,
          ...(plan.modularSet ? { modularSet: plan.modularSet } : {}),
          ...(plan.difficulty ? { difficulty: plan.difficulty } : {}),
          seed,
          rounds: run.rounds,
          commands: run.commands,
        };
        const replayed = replay(run.session.log, deps);
        const played = replayed.ok
          ? [
              ...new Set(
                replayed.events.flatMap((e) =>
                  (e.type === "cardPlayed" || e.type === "encounterCardRevealed") && String(e.cardId).startsWith(prefix)
                    ? [String(e.cardId)]
                    : [],
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
          deck: plan.name,
          scenario: plan.scenario,
          ...(plan.modularSet ? { modularSet: plan.modularSet } : {}),
          ...(plan.difficulty ? { difficulty: plan.difficulty } : {}),
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
  if (results.length > 0 && everPlayed.size === 0)
    notes.push("no game played or revealed one of the pack's own cards; try more games (--games)");
  return { ok: results.every((g) => g.ok), scenario, games: results, notes };
}
