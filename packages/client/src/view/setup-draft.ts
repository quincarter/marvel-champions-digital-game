/**
 * S2 (docs/phase4-screen-gaps.md §2): the setup choices that today live as
 * private fields on `TitleScene` — scenario, difficulty, modular sets, seats
 * (a deck per seat), first player, seed, and the two roster search queries —
 * collected into one plain, serializable object with a pure update API.
 * `scenes/title.ts` is the only screen that reads and writes it today; W2
 * splits Scenario select / Take your seats / Table setup into their own
 * screens later, and they'll share this same object.
 *
 * **No per-villain version field** (removed 2026-09-17, PLAN.md's "Wrecker
 * can't be played from Title"): Breakout's difficulty buttons alone decide
 * every villain's version now (standard = A, expert = B, extreme = A with B
 * underneath), so there is no separate choice for a draft to hold. The row
 * that let a player override one villain confused "which villain" with
 * "which crew are we playing", pushed Start game off-screen, and had
 * unclickable chips at some sizes. `SessionConfig.villainVersions` stays on
 * the engine side for a future "advanced" option; `toSessionConfig` below
 * simply never sends it.
 *
 * **What's deliberately *not* in `SetupDraft`:**
 * - **The seed field's raw text.** `draft.seed` is the last value that parsed
 *   as a legal seed; the text a player is mid-typing (which can be empty, or
 *   momentarily not a number) is transient input-validation state, not a
 *   setup *choice* — `view/seed.ts`'s own doc comment draws this same line.
 *   The scene keeps that buffer itself, same as today.
 * - **Which decks/scenarios exist, and whether a seat is blocked.** Those
 *   come from `@mc/content`/`view/deck-list-model.ts`/`view/seats.ts`, not
 *   from a setup choice — this module takes them as read-only inputs
 *   (`Scenario | undefined`, `DeckOption[]`) wherever a choice needs to be
 *   validated against them, and never caches its own copy.
 *
 * `toSessionConfig` is the one place that turns a draft into the existing
 * `SessionConfig` shape (`engine/host.ts`) — the same shape `TitleScene`
 * builds by hand today, byte for byte (`setup-draft.test.ts`'s round-trip
 * test), because `SessionConfig` is also the save shape and Phase 5's future
 * network shape.
 */
import type { Scenario } from "@mc/content";
import type { CorePlayer } from "@mc/cards";
import type { SessionConfig } from "../engine/host.js";
import { EMPTY_ROSTER_FILTER, type RosterFilter } from "./roster-filter.js";
import { rollSeed } from "./seed.js";

export type SetupDifficulty = "standard" | "expert" | "extreme";

export interface SetupDraft {
  readonly scenarioId: string;
  readonly difficulty: SetupDifficulty;
  /** `null` = the scenario's own recommended modular set(s) (`Scenario.recommendedModularSetIds`), the same default `SessionConfig.modularSetIds` documents. */
  readonly modularSetIds: readonly string[] | null;
  /** Deck ids (`Deck.id`), one per seat, 1–4 — a single namespace covering precons, saved and imported decks alike. */
  readonly seats: readonly string[];
  /** `null` = the engine's own default (seat 0). */
  readonly firstPlayerIndex: number | null;
  readonly seed: number;
  readonly scenarioFilter: RosterFilter;
  readonly heroFilter: RosterFilter;
}

export interface InitialSetupDraftOptions {
  readonly scenarioId: string;
  readonly seatDeckId: string;
  readonly seed: number;
}

/** A fresh draft — Title's own defaults on first load: standard difficulty, one seat, no filter, a rolled seed. */
export function initialSetupDraft(options: InitialSetupDraftOptions): SetupDraft {
  return {
    scenarioId: options.scenarioId,
    difficulty: "standard",
    modularSetIds: null,
    seats: [options.seatDeckId],
    firstPlayerIndex: null,
    seed: options.seed,
    scenarioFilter: EMPTY_ROSTER_FILTER,
    heroFilter: EMPTY_ROSTER_FILTER,
  };
}

/** Standard/expert everywhere; Breakout's own multi-villain challenge (docs/phase7-wave1.md §4.6) adds "extreme". */
export function difficultyOptionsFor(scenario: Scenario | undefined): readonly SetupDifficulty[] {
  return scenario?.multipleVillains ? ["standard", "expert", "extreme"] : ["standard", "expert"];
}

/**
 * Picking a new scenario. Resets the difficulty when the new scenario doesn't
 * offer the current one (e.g. leaving Breakout drops "extreme").
 */
export function setScenario(draft: SetupDraft, scenario: Scenario | undefined, scenarioId: string): SetupDraft {
  const difficulty = difficultyOptionsFor(scenario).includes(draft.difficulty) ? draft.difficulty : "standard";
  return { ...draft, scenarioId, difficulty };
}

/** Picking a difficulty for the current scenario. */
export function setDifficulty(draft: SetupDraft, difficulty: SetupDifficulty): SetupDraft {
  return { ...draft, difficulty };
}

export function setModularSetIds(draft: SetupDraft, modularSetIds: readonly string[] | null): SetupDraft {
  return { ...draft, modularSetIds };
}

export function setFirstPlayerIndex(draft: SetupDraft, firstPlayerIndex: number | null): SetupDraft {
  return { ...draft, firstPlayerIndex };
}

export function setSeed(draft: SetupDraft, seed: number): SetupDraft {
  return { ...draft, seed };
}

export function rerollSeed(draft: SetupDraft): SetupDraft {
  return { ...draft, seed: rollSeed() };
}

export function setScenarioFilter(draft: SetupDraft, filter: RosterFilter): SetupDraft {
  return { ...draft, scenarioFilter: filter };
}

export function clearScenarioFilter(draft: SetupDraft): SetupDraft {
  return { ...draft, scenarioFilter: EMPTY_ROSTER_FILTER };
}

export function setHeroFilter(draft: SetupDraft, filter: RosterFilter): SetupDraft {
  return { ...draft, heroFilter: filter };
}

export function clearHeroFilter(draft: SetupDraft): SetupDraft {
  return { ...draft, heroFilter: EMPTY_ROSTER_FILTER };
}

/**
 * Drops any seated deck id that no longer resolves to a real option (a saved
 * deck deleted on a trip to the Decks screen), falling back to `fallbackDeckId`
 * if that empties the table — the same fix-up `TitleScene#rebuild` runs today.
 */
export function pruneSeats(draft: SetupDraft, availableDeckIds: ReadonlySet<string>, fallbackDeckId: string): SetupDraft {
  const seats = draft.seats.filter((id) => availableDeckIds.has(id));
  return { ...draft, seats: seats.length > 0 ? seats : [fallbackDeckId] };
}

/** Seats `deckId`, up to `maxSeats` (RRG: 1–4 players). A no-op if it's already seated or the table is full — legality (is this deck blocked?) is the caller's job (`view/seats.ts`), checked before this is called. */
export function addSeat(draft: SetupDraft, deckId: string, maxSeats = 4): SetupDraft {
  if (draft.seats.includes(deckId) || draft.seats.length >= maxSeats) return draft;
  return { ...draft, seats: [...draft.seats, deckId] };
}

/** Removes `deckId`'s seat, unless it's the only one left (a game needs at least one player). */
export function removeSeat(draft: SetupDraft, deckId: string): SetupDraft {
  if (draft.seats.length <= 1) return draft;
  return { ...draft, seats: draft.seats.filter((id) => id !== deckId) };
}

/**
 * "Play this deck ▸" (W9, docs/phase4-screen-gaps.md §3): seats `deckId` in seat 1, dropping every other seat —
 * the same "one seat to start" shape `initialSetupDraft` itself gives a fresh visit. This is the whole hook a
 * caller outside the setup flow needs to preselect a deck: build (or take) a draft, call this, hand the result to
 * whatever reads `SetupDraft` next. Deliberately not "insert at seat 1, keep the rest" — a deck picked from the
 * Decks screen is a fresh "play this" intent, not an addition to whatever seats happened to be there before.
 */
export function withSeatOne(draft: SetupDraft, deckId: string): SetupDraft {
  return { ...draft, seats: [deckId] };
}

/**
 * The draft as the `SessionConfig` `EngineSessionCore.start`/`resume` take —
 * the same shape, and the same optional-field omissions, `TitleScene#start`
 * builds by hand today: no `modularSetIds`/`firstPlayerIndex` unless set.
 * `players` is resolved by the caller (`view/deck-seat.ts`'s
 * `corePlayerFromDeck`, or a precon's own `{ starterDeckId }`), since that
 * resolution needs the deck pool this module doesn't hold.
 *
 * Never sends `villainVersions` (Breakout's per-villain A/B override,
 * `SessionConfig`'s own doc comment): Title's difficulty buttons alone drive
 * it now (standard = every villain version A, expert = every villain B,
 * extreme = A in play with B underneath — the Wrecking Crew insert's own
 * "Adjustable Difficulty"), and the engine already defaults every villain to
 * `difficulty`'s uniform version when `villainVersions` is omitted
 * (`packages/cards/src/wave1/setup.ts` `buildMultiVillain`'s own
 * `defaultVersion`), so there is nothing this field needs to say. The field
 * itself stays on `SessionConfig` and in the engine for a future "advanced"
 * option to use.
 */
export function toSessionConfig(draft: SetupDraft, players: readonly CorePlayer[]): SessionConfig {
  return {
    scenarioId: draft.scenarioId,
    difficulty: draft.difficulty,
    players,
    seed: draft.seed,
    ...(draft.modularSetIds ? { modularSetIds: draft.modularSetIds } : {}),
    ...(draft.firstPlayerIndex !== null ? { firstPlayerIndex: draft.firstPlayerIndex } : {}),
  };
}
