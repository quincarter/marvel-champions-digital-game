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
import type { DifficultySetChoice, EncounterSet, Scenario } from "@mc/content";
import type { CorePlayer } from "@mc/cards";
import type { SessionConfig } from "../engine/host.js";
import type { DeckOption } from "./deck-list-model.js";
import { EMPTY_ROSTER_FILTER, type RosterFilter } from "./roster-filter.js";
import { rollSeed } from "./seed.js";

export type SetupDifficulty = "standard" | "expert" | "extreme";

/** Take your seats' hero-roster sort toggle: grouped by release wave (`cycleShelvesOf`, the default) or one flat A–Z run (`azShelvesOf`). Session-scoped on the draft, same lifetime as `heroFilter` — it survives a trip to Deck check and back, but a fresh draft (a new visit from Title) starts back at the default. */
export type HeroSortMode = "wave" | "az";

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
  /** Default `"wave"`. See `HeroSortMode`'s own doc comment. */
  readonly heroSortMode: HeroSortMode;
  /**
   * The active-seat model (docs/phase4-screen-gaps.md §3, "Reopened — W2b"): which of up to `MAX_SEATS` seat
   * slots the next roster pick targets. `seats` stays compact (no gaps — see that field's own doc comment and
   * `assignToActiveSeat`'s), so an index of `seats.length` names "the one empty seat past the last filled one",
   * never a seat further out. Persisted on the draft (not scene-local state) so it survives a trip to Deck check
   * and back, per the brief.
   */
  readonly activeSeatIndex: number;
  /**
   * Standard II / Expert II (docs/phase7-wave4.md §4 Q5): `null` means the printed default —
   * `SessionConfig.difficultySets`' own doc comment. Only ever set for a scenario whose pack actually has an
   * alternate Standard/Expert set (`alternateDifficultySetsFor`); switching to a scenario that doesn't resets it,
   * the same way `setScenario` already resets `difficulty` when the new scenario drops "extreme".
   */
  readonly difficultySets: DifficultySetChoice | null;
  /**
   * The Hood's own seven-of-nine modular set choice (docs/phase7-wave4.md §2.3, §3.18). `null` means the scenario
   * builder's own default (the pack's first seven in declaration order) — never a random draw the client makes
   * itself, so the same draft always seats the same game.
   */
  readonly setAsideModularSetIds: readonly string[] | null;
  /**
   * Tower Defense's own "Modular Difficulty" (MC21 p. 11, docs/phase7-wave4.md §4 Q4): place the printed
   * recommendation (1/2/3 damage per hero for standard/expert/heroic) on Avengers Tower during setup. Off by
   * default. Meaningless — and never sent (`toSessionConfig`) — for any scenario but Tower Defense, the same way
   * `difficultySets` is scenario-specific; `setScenario` resets it for the same reason.
   */
  readonly towerDefenseSetupDamage: boolean;
}

/** RRG: 1–4 players. */
export const MAX_SEATS = 4;

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
    heroSortMode: "wave",
    activeSeatIndex: 0,
    difficultySets: null,
    setAsideModularSetIds: null,
    towerDefenseSetupDamage: false,
  };
}

/** Standard/expert everywhere; Breakout's own multi-villain challenge (docs/phase7-wave1.md §4.6) adds "extreme". */
export function difficultyOptionsFor(scenario: Scenario | undefined): readonly SetupDifficulty[] {
  return scenario?.multipleVillains ? ["standard", "expert", "extreme"] : ["standard", "expert"];
}

/**
 * Standard II / Expert II (docs/phase7-wave4.md §4 Q5): the scenario's own pack's alternate Standard/Expert sets,
 * if it has any — `RRG 1.8` "Standard Set"/"Expert Set" (pp. 40, 19) name the printed ones every scenario already
 * uses by default, so this is only ever non-empty for a pack that prints a second pair (The Hood, `hood`
 * `standard_ii`/`expert_ii`). Read from `encounterSets` rather than cached, so a wider pool (a later wave's own
 * alternates) needs no change here.
 */
export function alternateDifficultySetsFor(
  scenario: Scenario | undefined,
  encounterSets: readonly EncounterSet[],
): DifficultySetChoice | null {
  if (!scenario) return null;
  const standard = encounterSets.find(
    (set) => set.classification === "standard" && set.packCodes.includes(scenario.packCode),
  )?.id;
  const expert = encounterSets.find(
    (set) => set.classification === "expert" && set.packCodes.includes(scenario.packCode),
  )?.id;
  return standard || expert ? { ...(standard ? { standard } : {}), ...(expert ? { expert } : {}) } : null;
}

/**
 * Picking a new scenario. Resets the difficulty when the new scenario doesn't offer the current one (e.g. leaving
 * Breakout drops "extreme"), and resets the Standard II/Expert II choice and The Hood's own modular set choice —
 * both are scenario-specific, so carrying either into an unrelated scenario would silently misapply it.
 */
export function setScenario(draft: SetupDraft, scenario: Scenario | undefined, scenarioId: string): SetupDraft {
  const difficulty = difficultyOptionsFor(scenario).includes(draft.difficulty) ? draft.difficulty : "standard";
  return {
    ...draft,
    scenarioId,
    difficulty,
    difficultySets: null,
    setAsideModularSetIds: null,
    towerDefenseSetupDamage: false,
  };
}

/** Picking a difficulty for the current scenario. */
export function setDifficulty(draft: SetupDraft, difficulty: SetupDifficulty): SetupDraft {
  return { ...draft, difficulty };
}

export function setModularSetIds(draft: SetupDraft, modularSetIds: readonly string[] | null): SetupDraft {
  return { ...draft, modularSetIds };
}

/** `null` to go back to the printed default (`alternateDifficultySetsFor`'s own doc comment). */
export function setDifficultySets(draft: SetupDraft, difficultySets: DifficultySetChoice | null): SetupDraft {
  return { ...draft, difficultySets };
}

/**
 * The Standard II/Expert II toggle's own on/off: off (`null`) uses `alternateDifficultySetsFor`'s printed
 * default when toggled on, on (a `DifficultySetChoice`) clears back to `null` when toggled off. A single switch
 * rather than choosing "Standard" and "Expert" independently, since a pack with either alternate has printed
 * both together so far (The Hood's own `standard_ii`/`expert_ii`) — a future pack with only one would need its
 * own widget, not this one.
 */
export function toggleDifficultySets(draft: SetupDraft, alternate: DifficultySetChoice | null): SetupDraft {
  return setDifficultySets(draft, draft.difficultySets ? null : alternate);
}

/** Tower Defense's own setup-damage toggle (docs/phase7-wave4.md §4 Q4): a plain on/off, off by default. */
export function toggleTowerDefenseSetupDamage(draft: SetupDraft): SetupDraft {
  return { ...draft, towerDefenseSetupDamage: !draft.towerDefenseSetupDamage };
}

/**
 * Whether the setup screen should offer Tower Defense's own damage toggle at all (docs/phase7-wave4.md §4 Q4):
 * only Tower Defense itself prints the recommendation (`checkScenarioSetupOptions`, `@mc/cards`), and only outside
 * skirmish mode (`towerDefenseSetupDamage` in `@mc/cards`' `mts/tower-defense.ts` refuses `modes.skirmish`). The
 * client has no skirmish-mode picker yet, so the mode half of this check is always true today; it's written out
 * so a future skirmish toggle only needs to pass its own state in, not change this function's shape.
 */
export function hasTowerDefenseSetupDamageOption(scenario: Scenario | undefined, skirmish = false): boolean {
  return (scenario?.id as string | undefined) === "tower-defense" && !skirmish;
}

/**
 * MC21 p. 11's printed recommendation for the mode being played — 1/2/3 damage per hero for standard/expert/
 * heroic. The client has no heroic-mode picker yet (`SetupDifficulty`), so `difficulty === "expert"` is the only
 * way to reach the 2-per-hero row today; kept as a switch (rather than a two-value lookup) so a future heroic
 * toggle only needs a new case here, not a new function.
 */
export function towerDefenseSetupDamagePerHero(difficulty: SetupDifficulty): number {
  switch (difficulty) {
    case "expert":
      return 2;
    default:
      return 1;
  }
}

/** `null` to go back to the scenario builder's own default (The Hood's own first seven, docs/phase7-wave4.md §2.3). */
export function setSetAsideModularSetIds(
  draft: SetupDraft,
  setAsideModularSetIds: readonly string[] | null,
): SetupDraft {
  return { ...draft, setAsideModularSetIds };
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

export function setHeroSortMode(draft: SetupDraft, mode: HeroSortMode): SetupDraft {
  return { ...draft, heroSortMode: mode };
}

/**
 * Drops any seated deck id that no longer resolves to a real option (a saved
 * deck deleted on a trip to the Decks screen), falling back to `fallbackDeckId`
 * if that empties the table — the same fix-up `TitleScene#rebuild` runs today.
 */
export function pruneSeats(
  draft: SetupDraft,
  availableDeckIds: ReadonlySet<string>,
  fallbackDeckId: string,
): SetupDraft {
  const seats = draft.seats.filter((id) => availableDeckIds.has(id));
  const kept = seats.length > 0 ? seats : [fallbackDeckId];
  return { ...draft, seats: kept, activeSeatIndex: Math.min(draft.activeSeatIndex, kept.length) };
}

/** Seats `deckId`, up to `maxSeats` (RRG: 1–4 players). A no-op if it's already seated or the table is full — legality (is this deck blocked?) is the caller's job (`view/seats.ts`), checked before this is called. */
export function addSeat(draft: SetupDraft, deckId: string, maxSeats = MAX_SEATS): SetupDraft {
  if (draft.seats.includes(deckId) || draft.seats.length >= maxSeats) return draft;
  return { ...draft, seats: [...draft.seats, deckId] };
}

/** Removes `deckId`'s seat, unless it's the only one left (a game needs at least one player). */
export function removeSeat(draft: SetupDraft, deckId: string): SetupDraft {
  if (draft.seats.length <= 1) return draft;
  const seats = draft.seats.filter((id) => id !== deckId);
  return { ...draft, seats, activeSeatIndex: Math.min(draft.activeSeatIndex, seats.length) };
}

/**
 * The active-seat model (docs/phase4-screen-gaps.md §3 W2, "Reopened — W2b" — the owner's reported bug that only
 * seat 1 could ever be selected). Exactly one seat is active at a time; clicking, tapping or focus-activating a
 * seat card calls `setActiveSeat`, and choosing a roster card calls `assignToActiveSeat`. Kept as three small pure
 * functions (rather than folded into `addSeat`/`removeSeat`) because they answer a different question — *which*
 * seat a pick lands in — not just "is a deck seated".
 */

/** The one empty seat past the last filled one, or `null` when the table is already full. `seats` stays compact (no gaps), so this is always `seats.length` or nothing — never a seat further out. */
export function nextEmptySeat(draft: SetupDraft, maxSeats = MAX_SEATS): number | null {
  return draft.seats.length < maxSeats ? draft.seats.length : null;
}

/**
 * Whether seat `index` can become the active seat (docs/phase4-screen-gaps.md §3, second W2b pass, item 3): a
 * filled seat, or the *one* empty seat past the last filled one — never an empty seat further out. `seats` can't
 * hold a gap, so clicking a later empty seat card (seat 4, say, with only seat 1 filled) would silently redirect
 * `setActiveSeat`'s own clamp to `nextEmptySeat` (seat 2) instead — a pick then lands somewhere other than the
 * card the player clicked. Marking every seat past `nextEmptySeat` as unselectable (dimmed, "Fill seat N first" —
 * `scenes/seats.ts`) is the chosen fix over "keep it clickable and visibly redirect": it can't happen at all,
 * rather than relying on a player to notice which card actually lit up.
 */
export function seatIsSelectable(draft: SetupDraft, index: number): boolean {
  return index <= draft.seats.length;
}

/**
 * Makes `index` the active seat — a seat card being clicked, tapped, or given focus and activated. Clamped to a
 * seat that actually exists, or to the one empty seat past the end (`nextEmptySeat`): a click on an empty seat
 * card further out than that (there is no such card today — the seat row is fixed at `maxSeats` cards — but a
 * future layout could offer one) still lands on the seat that would actually be filled next, since `seats` cannot
 * hold a gap.
 */
export function setActiveSeat(draft: SetupDraft, index: number, maxSeats = MAX_SEATS): SetupDraft {
  const activeSeatIndex = Math.max(0, Math.min(index, Math.min(draft.seats.length, maxSeats - 1)));
  return { ...draft, activeSeatIndex };
}

/**
 * Assigns `deckId` to the active seat — replacing whatever was there if the active seat is already filled, or
 * filling the one empty seat past the end if it is that. Then the active seat advances to the next empty seat, if
 * there is one (per the brief, this happens whether the pick replaced an occupied seat or filled an empty one —
 * either way the natural next step is "pick for the next open chair"). A no-op if the active seat is somehow past
 * `maxSeats` with the table already full. Legality (is this deck blocked here — already seated elsewhere, a
 * duplicate identity, an illegal deck) is the caller's job, exactly as `addSeat` already documents: `view/seats.ts`
 * computes `blockedBy` and the scene checks it before calling this.
 */
export function assignToActiveSeat(draft: SetupDraft, deckId: string, maxSeats = MAX_SEATS): SetupDraft {
  const index = Math.min(draft.activeSeatIndex, maxSeats - 1);
  let seats: readonly string[];
  if (index < draft.seats.length) {
    seats = draft.seats.map((id, i) => (i === index ? deckId : id));
  } else if (draft.seats.length < maxSeats) {
    seats = [...draft.seats, deckId];
  } else {
    return draft;
  }
  const activeSeatIndex = seats.length < maxSeats ? seats.length : index;
  return { ...draft, seats, activeSeatIndex };
}

/**
 * Clears the seat at `index` (a small ✕ on the seat card, or Backspace/Delete on a focused seat) — never below one
 * seat. Later seats shift down to fill the gap: `seats` is the compact list the engine consumes as player order
 * (seat *position*, not a fixed seat number, is what a deck id occupies), the same compacting `removeSeat` already
 * does by deck id, generalized here to "by position" so an empty seat can be cleared too (`removeSeat` only knows
 * how to remove a deck it can name).
 */
export function clearSeat(draft: SetupDraft, index: number, maxSeats = MAX_SEATS): SetupDraft {
  if (draft.seats.length <= 1 || index < 0 || index >= draft.seats.length) return draft;
  const seats = draft.seats.filter((_, i) => i !== index);
  // Everything after the removed seat shifted down one position with it, so the active seat shifts too when it
  // pointed past the removed one — otherwise it would silently land on a different deck than the player was
  // looking at.
  const shifted = draft.activeSeatIndex > index ? draft.activeSeatIndex - 1 : draft.activeSeatIndex;
  const activeSeatIndex = Math.max(0, Math.min(shifted, Math.min(seats.length, maxSeats - 1)));
  return { ...draft, seats, activeSeatIndex };
}

/**
 * "Play this deck ▸" (W9, docs/phase4-screen-gaps.md §3): seats `deckId` in seat 1, dropping every other seat —
 * the same "one seat to start" shape `initialSetupDraft` itself gives a fresh visit. This is the whole hook a
 * caller outside the setup flow needs to preselect a deck: build (or take) a draft, call this, hand the result to
 * whatever reads `SetupDraft` next. Deliberately not "insert at seat 1, keep the rest" — a deck picked from the
 * Decks screen is a fresh "play this" intent, not an addition to whatever seats happened to be there before.
 */
export function withSeatOne(draft: SetupDraft, deckId: string): SetupDraft {
  return { ...draft, seats: [deckId], activeSeatIndex: 0 };
}

/**
 * Which deck "Deck check ▸" should open (docs/phase4-screen-gaps.md §3, second W2b pass, item 1 — the owner's bug
 * report that the button silently jumped to Table setup): the active seat's own deck when it's filled, or — since
 * the active seat auto-advances to the next empty slot right after a pick — the most recently filled seat
 * otherwise. "Most recently filled" isn't a timestamp this module tracks; it's simply the last entry in `seats`,
 * which is exactly right for the common flow (fill seat 1, active advances to 2, fill 2, active advances to 3,
 * …) and is never wrong in the sense that matters: it always names a real, currently-seated deck, never Table
 * setup. Null only when the table has no seats at all, which `pruneSeats`'s own fallback never actually allows —
 * kept for honesty rather than assumed away, so a caller can still draw "Pick a hero first" instead of a crash.
 * "Play N heroes ▸" is the only control that ever goes to Table setup without checking a deck first.
 */
export function deckCheckDeckId(draft: SetupDraft): string | null {
  if (draft.seats.length === 0) return null;
  const index = draft.activeSeatIndex < draft.seats.length ? draft.activeSeatIndex : draft.seats.length - 1;
  return draft.seats[index] ?? null;
}

/**
 * "Use preconstructed for all seats" (docs/phase4-screen-gaps.md §3 W2, D03):
 * swaps every seated custom/imported deck for its own identity's precon, when
 * one exists in `deckOptions`. A seat whose identity has no precon (or that's
 * already a precon) is left as it is — this never drops a seat or changes
 * *who* is seated, only *which deck* each identity plays.
 */
export function usePreconstructedForAllSeats(draft: SetupDraft, deckOptions: readonly DeckOption[]): SetupDraft {
  const byDeckId = new Map(deckOptions.map((option) => [option.deck.id as string, option]));
  const precons = deckOptions.filter((option) => option.deck.source.kind === "precon");
  const seats = draft.seats.map((deckId) => {
    const seated = byDeckId.get(deckId);
    if (!seated) return deckId;
    const precon = precons.find(
      (option) => (option.deck.identityCardId as string) === (seated.deck.identityCardId as string),
    );
    return precon ? (precon.deck.id as string) : deckId;
  });
  return { ...draft, seats };
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
    ...(draft.difficultySets ? { difficultySets: draft.difficultySets } : {}),
    ...(draft.setAsideModularSetIds ? { setAsideModularSetIds: draft.setAsideModularSetIds } : {}),
    ...(draft.towerDefenseSetupDamage ? { setupOptions: { towerDefenseSetupDamage: true } } : {}),
  };
}
