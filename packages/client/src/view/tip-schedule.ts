/**
 * Guided mode's opportunistic-tip pacing (G10e part 2, `docs/guided-mode.md` §4 G10e "Part 2 (display)"): a pure
 * reducer that decides *when* a candidate from `guide-tips.ts#tipsFor` is actually allowed to surface, on top of
 * that module's own "once each" rule. Kept free of Phaser and of `@mc/engine` deps (only `GameEvent`/`GameStep`
 * types) so the pacing rules are Vitest-tested as plain data in, data out — the board's own mount
 * (`scenes/board/tip-mount.ts`) is the only thing that turns an emitted `Tip` into a drawn widget.
 *
 * **The four pacing rules this owns** (the brief's own list):
 *  - **At most one tip per player turn.** `shownThisTurn` resets on every `turnStarted` event for a new
 *    `(round, playerId)` pair; once a tip has been emitted for the current turn, no other candidate surfaces until
 *    the next one starts.
 *  - **The opening-turn hold.** No tip at all during the very first turn `advance` ever sees (round 1's first
 *    player, `handSizeDiffers` and `acceleration` are true from frame one per the brief) until that same turn has
 *    produced at least one non-bookkeeping event — `hasActionEvent`'s own list is exactly the housekeeping event
 *    types a turn always starts with regardless of what the player does (`turnStarted` itself, the round/step
 *    wrapper events, and the very first deck shuffle). This hold applies only to that one opening turn, never
 *    reapplied on a later one — once the opening turn has ended (a different turn key is seen), `firstTurnKey` is
 *    left alone so the check trivially always passes from then on.
 *  - **Suppressed while a lesson step is on screen, or an overlay is up.** The caller passes `context.blocked` —
 *    computed from `BoardGuideMount`'s own "is a lesson step currently showing" plus whatever overlay-open check
 *    the board already has for its own input gating — no tip is ever emitted on a blocked call, though turn/action
 *    tracking still advances underneath it so pacing stays correct once the block lifts.
 *  - **The tutorial's own suppressed ids**, via `context.suppress` — passed straight through to `tipsFor`. This
 *    module has no opinion on *which* ids those are (`guide/tutorial-tip-suppression.ts` owns that list).
 *
 * **What this module does *not* decide**: whether a candidate exists at all (`tipsFor`'s own job, including the
 * "once each" `seenTips` filter) or how it's drawn. `advance` calls `tipsFor` once per non-blocked call and returns
 * whatever it found, wrapped in this module's own pacing gate.
 */
import type { EngineDeps, GameEvent } from "@mc/engine";
import type { GuidePrefs } from "../guide/guide-prefs.js";
import { tipsFor, type Tip } from "./guide-tips.js";
import type { LessonObservation } from "./lesson-model.js";

/** Event types every turn/round boundary produces regardless of what the player actually does — seeing only these
 * in a turn's own event batch means "nothing has happened on this turn yet" for the opening-turn hold. */
const BOOKKEEPING_EVENT_TYPES: ReadonlySet<GameEvent["type"]> = new Set([
  "gameCreated",
  "stepChanged",
  "roundStarted",
  "turnStarted",
  "turnEnded",
  "deckShuffled",
  "deckStacked",
]);

function hasActionEvent(events: readonly GameEvent[]): boolean {
  return events.some((event) => !BOOKKEEPING_EVENT_TYPES.has(event.type));
}

/** `(round, playerId)` as a plain string key — null while the game isn't in an ordinary player turn (the villain
 * phase, setup, between rounds), when there's nothing to pace tips against. */
function turnKeyOf(observation: LessonObservation): string | null {
  const step = observation.game.step;
  if (step.phase !== "player" || step.kind !== "turn") return null;
  return `${observation.game.round}:${step.activePlayerId}`;
}

export interface TipScheduleState {
  readonly turnKey: string | null;
  readonly shownThisTurn: boolean;
  /** The very first turn key this scheduler ever saw — the opening-turn hold only ever applies while `turnKey`
   * still equals this. `null` before the first `advance` call has seen a player turn at all. */
  readonly firstTurnKey: string | null;
  /** Whether the opening turn (`firstTurnKey`) has produced a non-bookkeeping event yet. Irrelevant, and never
   * read, once `turnKey !== firstTurnKey`. */
  readonly firstTurnActed: boolean;
  /** Tips whose trigger fired while a call was blocked (the villain-phase overlay), oldest first. An event-driven tip
   * (`situation:effectDefender`, `situation:energyAbsorption`) is built from the batch's `lastEvents`, which the next
   * call no longer carries, so it is held here and shown on the first open call that may show a tip. */
  readonly pending: readonly Tip[];
}

const MAX_PENDING = 3;

export const initialTipScheduleState: TipScheduleState = {
  turnKey: null,
  shownThisTurn: false,
  firstTurnKey: null,
  firstTurnActed: false,
  pending: [],
};

export interface TipScheduleContext {
  /** No tip may show right now: an overlay is up, or a lesson step's own callout is already on screen
   * (`docs/guided-mode.md` §4 G10e "None while a scripted lesson step is active"). */
  readonly blocked: boolean;
  /** Tip ids to never show for this call — the tutorial's own suppressed ids while a guided run is active, empty
   * in an ordinary game (`tipsFor`'s own `suppress` parameter). */
  readonly suppress: readonly string[];
}

export interface TipScheduleResult {
  readonly state: TipScheduleState;
  /** The tip to show this call, or `null` — pacing held it back, nothing new fired, or the call was blocked. */
  readonly tip: Tip | null;
}

/**
 * Feeds one store observation to the scheduler. Call on every session-store update the board already sees
 * (mirroring `GuideController#onObservation`'s own contract) — turn/action tracking updates on *every* call,
 * blocked or not, so a turn that starts while an overlay is up (villain phase, a choice) is still tracked
 * correctly once the overlay clears.
 */
export function advance(
  state: TipScheduleState,
  observation: LessonObservation,
  deps: EngineDeps,
  prefs: GuidePrefs,
  context: TipScheduleContext,
): TipScheduleResult {
  const turnKey = turnKeyOf(observation);
  // The very call that first establishes a turn key (leaving setup, or a later turn's own `turnStarted`) can carry
  // a batch dominated by setup/round bookkeeping that has nothing to do with the player's own move (a mulligan
  // decline's batch, in a real game, also drew the opening hand and resolved setup abilities — all real,
  // non-bookkeeping events by `hasActionEvent`'s own list, but not "the player has taken one action" in the turn
  // the hold is about) — found in browser verification: a tip fired the instant round 1's player phase began,
  // riding along on the very same batch that declined the mulligan. So the action check below only ever runs on a
  // call whose turn key was *already* current — never on the transition call itself.
  const isNewTurn = turnKey !== state.turnKey;

  let next = state;
  if (isNewTurn) {
    next = {
      turnKey,
      shownThisTurn: false,
      firstTurnKey: state.firstTurnKey ?? turnKey,
      firstTurnActed: state.firstTurnKey === null ? false : state.firstTurnActed,
      pending: state.pending,
    };
  }
  if (
    !isNewTurn &&
    turnKey !== null &&
    turnKey === next.firstTurnKey &&
    !next.firstTurnActed &&
    hasActionEvent(observation.lastEvents)
  ) {
    next = { ...next, firstTurnActed: true };
  }

  const fresh = tipsFor(observation, deps, prefs, context.suppress)[0] ?? null;
  const stillWanted = (tip: Tip) => !prefs.seenTips.includes(tip.id) && !context.suppress.includes(tip.id);
  const pending = next.pending.filter(stillWanted);

  if (context.blocked) {
    // Remember what fired under the overlay: its events are gone by the time the overlay clears.
    const held =
      fresh && !pending.some((tip) => tip.id === fresh.id) ? [...pending, fresh].slice(-MAX_PENDING) : pending;
    return { state: { ...next, pending: held }, tip: null };
  }
  next = { ...next, pending };
  if (next.shownThisTurn) return { state: next, tip: null };
  if (turnKey !== null && turnKey === next.firstTurnKey && !next.firstTurnActed) return { state: next, tip: null };

  const candidate = pending[0] ?? fresh;
  if (!candidate) return { state: next, tip: null };
  return {
    state: { ...next, shownThisTurn: true, pending: pending.filter((tip) => tip.id !== candidate.id) },
    tip: candidate,
  };
}
