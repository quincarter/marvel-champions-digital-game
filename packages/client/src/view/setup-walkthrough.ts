/**
 * Setup deal & mulligan (W3, docs/phase4-screen-gaps.md §3 — D06, P13, L05).
 *
 * The dedicated screen shown once, before round 1, in place of the generic
 * pending-choice sheet: villain and main scheme placed, starting threat,
 * setup cards revealed, obligations shuffled in, opening hands, mulligan.
 * Every fact here is read off live `GameState` — the checklist, the current
 * decider, each seat's hand — except two things the engine's *state* only
 * ever shows the *result* of, never the path there: which encounter card was
 * revealed most recently, and how many cards a seat that has already
 * resolved its mulligan actually discarded. Those two live in
 * `SetupWalkthroughLog`, a small accumulator over the same `GameEvent`
 * stream `view/log-lines.ts` already turns into the log — folded forward one
 * command's `events` at a time by the scene, the same way `LogState` is.
 *
 * **Composition** (docs/design-reference.md's `ScreensDesktop_05–06`,
 * `ScreensPhone_02` P13, `ScreensTablet_02–03` L05): an ink void ground
 * throughout. A header bar names the screen and "Step N of M"; below it a
 * row of checklist chips — green check for done, red fill for the step in
 * progress, grey outline for what's still ahead. Desktop and tablet-portrait
 * split the body: a paper-toned "YOUR OPENING HAND — <hero>" panel (full
 * cards, each with its own mulligan toggle, "Mulligan N"/"Keep all N" below
 * it) beside "OTHER SEATS" (kept/still-deciding status cards) on the left,
 * and a persistent sidebar on the right carrying "SETUP CARD REVEALED" (the
 * most recently revealed encounter card, full rules text) over "SETUP LOG"
 * (`view/log-lines.ts`'s own numbered-beat wording). Phone stacks the same
 * five groups in one column, sidebar folded under the body. **Tablet
 * landscape (L05) is a different composition, not a narrower version of the
 * same one**: one column per seat, every seat's hand visible at once — the
 * deciding seat's own column carries the toggles and the commit row: "all
 * four seats mulligan on one screen" is the point of that layout, so this
 * module's `seats[].hand` is what it reads for every seat, not only the one
 * deciding.
 *
 * "Why this matters" (P13) is out of scope — §4 hasn't settled advice text.
 */

import type { AnyCard } from "@mc/content";
import {
  activeVillain,
  cardOf,
  getPlayer,
  playerOrder,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import type { ArtSource } from "../art/art-source.js";
import { deckAspect, handCardView, schemePanel, type HandCardView } from "./board-model.js";
import { inspectModel } from "./inspect-model.js";
import { appendEvents, emptyLog, type LogLine, type LogState } from "./log-lines.js";
import { playerName } from "./names.js";

export type SetupStepState = "done" | "current" | "pending";

export interface SetupChecklistItem {
  readonly key: "placed" | "threat" | "revealed" | "mulligan" | "firstPlayer";
  readonly label: string;
  readonly state: SetupStepState;
}

export type SetupSeatState = "deciding" | "kept" | "mulliganed" | "waiting";

export interface SetupSeatStatus {
  readonly playerId: PlayerId;
  readonly name: string;
  /** "Aggression · obligation Ritual Combat shuffled in", or "" when neither is known. */
  readonly subtitle: string;
  readonly state: SetupSeatState;
  /** "Deciding", "Kept 6 · ready", "Mulliganed 2 · redrawing", "Still deciding". */
  readonly statusLabel: string;
  readonly handSize: number;
  /** Cards actually discarded so far, once resolved; null while still deciding or waiting. */
  readonly mulliganedCount: number | null;
  /** This seat's current hand, full information — every seat's hand is already dealt (RRG 1.8 Appendix II step 14) and one human plays every seat, so nothing here is hidden from the operator. */
  readonly hand: readonly HandCardView[];
}

export interface SetupRevealedCard {
  readonly instanceId: InstanceId;
  readonly name: string;
  readonly typeLine: string;
  readonly rulesText: string;
  readonly art: ArtSource | null;
}

export interface SetupWalkthroughView {
  readonly stepLabel: string;
  readonly checklist: readonly SetupChecklistItem[];
  readonly villainName: string;
  readonly mainSchemeName: string;
  readonly startingThreat: number;
  /** The seat the engine is asking to mulligan right now, or null once every seat has answered. */
  readonly decidingPlayerId: PlayerId | null;
  /** Every seat, in the engine's own order (`playerOrder`) — the order seats are actually asked in. */
  readonly seats: readonly SetupSeatStatus[];
  readonly revealedCard: SetupRevealedCard | null;
  readonly setupLog: readonly LogLine[];
  /** True once `state.step.phase` has left "setup" — the scene's own signal to hand off to the Board. */
  readonly complete: boolean;
}

/** The accumulator: what happened along the way, since the engine's state alone only ever shows where things ended up. */
export interface SetupWalkthroughLog {
  readonly log: LogState;
  /** Every `encounterCardRevealed` instance seen so far, in order; the panel shows the last one. */
  readonly revealedInstanceIds: readonly InstanceId[];
  /** How many cards each seat actually discarded for its mulligan, once that seat's `resolveChoice` has landed. */
  readonly mulliganedCounts: Readonly<Partial<Record<PlayerId, number>>>;
}

export const emptySetupWalkthroughLog = (): SetupWalkthroughLog => ({
  log: emptyLog(),
  revealedInstanceIds: [],
  mulliganedCounts: {},
});

/**
 * Folds one command's `events` onto the accumulator. Safe to call with every
 * command's events while the setup scene is alive, including the very first
 * (which is where every Core scenario's villain/scheme placement and any
 * setup-triggered reveal actually happens) — `appendEvents` already skips
 * whatever isn't player-readable, and a `cardDiscardedFromHand` with no
 * mulligan in play would be a defect elsewhere, not here.
 */
export function advanceSetupWalkthroughLog(
  accumulator: SetupWalkthroughLog,
  events: readonly GameEvent[],
  state: GameState,
  perspectiveId: PlayerId | null,
  deps: EngineDeps,
): SetupWalkthroughLog {
  const log = appendEvents(accumulator.log, events, state, perspectiveId, deps);
  const revealedInstanceIds = [
    ...accumulator.revealedInstanceIds,
    ...events.filter((event): event is Extract<GameEvent, { type: "encounterCardRevealed" }> => event.type === "encounterCardRevealed").map((event) => event.instanceId),
  ];
  const discardedByPlayer = new Map<PlayerId, number>();
  for (const event of events) {
    if (event.type !== "cardDiscardedFromHand") continue;
    discardedByPlayer.set(event.playerId, (discardedByPlayer.get(event.playerId) ?? 0) + 1);
  }
  const mulliganedCounts = discardedByPlayer.size === 0 ? accumulator.mulliganedCounts : { ...accumulator.mulliganedCounts, ...Object.fromEntries(discardedByPlayer) };
  return { log, revealedInstanceIds, mulliganedCounts };
}

/** The setup steps this screen tracks, in the order `GameStep`'s own "setup" kinds run. */
const SETUP_STEP_ORDER = ["drawStartingHands", "mulligan", "playerSetupAbilities"] as const;

function stateFor(state: GameState, stepKind: (typeof SETUP_STEP_ORDER)[number]): SetupStepState {
  if (state.step.phase !== "setup") return "done";
  const current = SETUP_STEP_ORDER.indexOf(state.step.kind as (typeof SETUP_STEP_ORDER)[number]);
  const target = SETUP_STEP_ORDER.indexOf(stepKind);
  if (current < 0) return "done";
  if (current > target) return "done";
  if (current === target) return "current";
  return "pending";
}

function checklistOf(state: GameState, deps: EngineDeps, revealedCount: number): readonly SetupChecklistItem[] {
  const scheme = schemePanel(state, state.mainScheme.instanceId, deps, true);
  return [
    { key: "placed", label: "Villain & main scheme placed", state: "done" },
    { key: "threat", label: `${scheme.threat} starting threat`, state: "done" },
    { key: "revealed", label: `Setup cards revealed — ${revealedCount}`, state: stateFor(state, "drawStartingHands") },
    { key: "mulligan", label: "Opening hands — mulligan", state: stateFor(state, "mulligan") },
    { key: "firstPlayer", label: "First player token", state: stateFor(state, "playerSetupAbilities") },
  ];
}

/** RRG 1.8 Appendix II step 4: each hero's own obligation card, shuffled into the encounter deck. Read straight off the printed identity, the same field S3's `view/encounter-preview.ts` reads (no engine re-derivation). */
function obligationNoteOf(state: GameState, playerId: PlayerId, cardsById: ReadonlyMap<string, AnyCard>): string | null {
  const player = getPlayer(state, playerId);
  if (!player) return null;
  const identity = cardOf(state, player.identity.instanceId);
  if (!identity || identity.type !== "hero_identity") return null;
  const obligation = cardsById.get(identity.obligationCardId as string);
  return obligation ? `obligation ${obligation.name} shuffled in` : null;
}

function seatStatusOf(state: GameState, accumulator: SetupWalkthroughLog, deps: EngineDeps, cardsById: ReadonlyMap<string, AnyCard>, playerId: PlayerId): SetupSeatStatus {
  const player = getPlayer(state, playerId);
  const step = state.step;
  const stillDeciding = step.phase === "setup" && step.kind === "mulligan" && step.remainingPlayerIds.includes(playerId);
  const isCurrent = state.pendingChoice?.prompt.kind === "mulligan" && state.pendingChoice.playerId === playerId;
  const mulliganed = accumulator.mulliganedCounts[playerId] ?? 0;

  const seatState: SetupSeatState = isCurrent ? "deciding" : stillDeciding ? "waiting" : mulliganed > 0 ? "mulliganed" : "kept";
  const handSize = player?.hand.length ?? 0;
  const statusLabel: string =
    seatState === "deciding"
      ? "Deciding"
      : seatState === "waiting"
        ? "Still deciding"
        : seatState === "mulliganed"
          ? `Mulliganed ${mulliganed} · redrawing`
          : `Kept ${handSize} · ready`;

  const aspect = deckAspect(state, playerId);
  const subtitle = [aspect ? aspect.charAt(0).toUpperCase() + aspect.slice(1) : null, obligationNoteOf(state, playerId, cardsById)].filter((part): part is string => part !== null).join(" · ");

  return {
    playerId,
    name: playerName(state, playerId),
    subtitle,
    state: seatState,
    statusLabel,
    handSize,
    mulliganedCount: seatState === "waiting" || seatState === "deciding" ? null : mulliganed,
    hand: player ? player.hand.map((id) => handCardView(state, id, playerId, deps)) : [],
  };
}

function revealedCardOf(state: GameState, accumulator: SetupWalkthroughLog, deps: EngineDeps): SetupRevealedCard | null {
  const instanceId = accumulator.revealedInstanceIds.at(-1);
  if (instanceId === undefined) return null;
  // Any perspective reads the same thing here: a revealed encounter card is public to the whole table
  // (RRG 1.8 "Reveal"), so `firstPlayerId` is a neutral, always-valid viewer rather than "whoever is deciding".
  const model = inspectModel(state, instanceId, null, state.firstPlayerId, deps);
  return { instanceId, name: model.name, typeLine: model.typeLine, rulesText: model.rulesText, art: model.art };
}

export function setupWalkthroughViewOf(state: GameState, accumulator: SetupWalkthroughLog, deps: EngineDeps, cardsById: ReadonlyMap<string, AnyCard>): SetupWalkthroughView {
  const revealedCount = accumulator.revealedInstanceIds.length;
  const checklist = checklistOf(state, deps, revealedCount);
  const currentIndex = checklist.findIndex((item) => item.state === "current");
  const doneCount = checklist.filter((item) => item.state === "done").length;
  const stepIndex = currentIndex >= 0 ? currentIndex : doneCount;
  const stepLabel = `Step ${Math.min(stepIndex + 1, checklist.length)} of ${checklist.length}`;

  const villainName = cardOf(state, activeVillain(state).instanceId)?.name ?? "the villain";
  const mainSchemeName = cardOf(state, state.mainScheme.instanceId)?.name ?? "the main scheme";
  const startingThreat = schemePanel(state, state.mainScheme.instanceId, deps, true).threat;

  const seats = playerOrder(state).map((player) => seatStatusOf(state, accumulator, deps, cardsById, player.playerId));
  const decidingPlayerId = state.pendingChoice?.prompt.kind === "mulligan" ? state.pendingChoice.playerId : null;

  return {
    stepLabel,
    checklist,
    villainName,
    mainSchemeName,
    startingThreat,
    decidingPlayerId,
    seats,
    revealedCard: revealedCardOf(state, accumulator, deps),
    setupLog: accumulator.log.lines,
    complete: state.step.phase !== "setup",
  };
}
