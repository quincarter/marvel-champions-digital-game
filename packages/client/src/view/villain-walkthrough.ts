/**
 * The villain phase, replayed as the design's five-step walkthrough.
 *
 * The engine runs a whole villain phase inside one command, so the auto-
 * advancing screen in `Screens - Desktop` can't be driven by asking the engine
 * "what step are you on" — it has to be reconstructed from that command's
 * `GameEvent` stream (PLAN.md Phase 4, "villain phase as a walkthrough"). This
 * module does exactly that, and nothing else: no rules, no engine calls.
 *
 * Where the engine parked a `PendingChoice`, the walkthrough stops and labels
 * why that player is the one deciding, using `PendingChoice.authority`. That is
 * the whole point of the tag — Phase 3 established that the villain never
 * chooses, so every pause here is a player's decision made on the encounter
 * side's behalf, and the screen should say which rule put it there
 * (docs/phase3-encounter-ai.md).
 */

import type { ChoiceOption, ChoicePrompt, DecisionAuthority, GameEvent, GameState, PlayerId } from "@mc/engine";
import { logLine } from "./log-lines.js";
import { cardName, playerName, seatName } from "./names.js";

/** The engine's own villain-phase steps, in RRG order. */
export const VILLAIN_STEPS = [
  "placeThreat",
  "enemyActivations",
  "dealEncounterCards",
  "revealEncounterCards",
  "passFirstPlayer",
] as const;

export type VillainStepKind = (typeof VILLAIN_STEPS)[number];

const STEP_TITLES: Record<VillainStepKind, string> = {
  placeThreat: "Place threat",
  enemyActivations: "Villain and minions activate",
  dealEncounterCards: "Deal encounter cards",
  revealEncounterCards: "Reveal encounter cards",
  passFirstPlayer: "Pass the first player token",
};

export interface Pause {
  readonly playerId: PlayerId;
  readonly promptKind: string;
  readonly authority: DecisionAuthority;
  /** "Auto-advance paused for your interrupt", in the design's words. */
  readonly label: string;
  /** RRG "Peril": only this player may decide, and nobody else may act. */
  readonly soleDecider: boolean;
  /**
   * What the pause is actually offering, straight off `PendingChoice.options`
   * — never invented here. Blank only when the engine parked no options at all.
   * The pending-choice sheet still owns collecting the answer; this is the
   * walkthrough saying, before that sheet is even read, what there is to
   * decide (a defend, an interrupt, a card) so the pause never reads as an
   * unexplained wall.
   */
  readonly offer: string;
}

export interface WalkthroughBeat {
  readonly id: string;
  readonly text: string;
  /** Set when this beat is where auto-advance stopped. */
  readonly pause: Pause | null;
}

export type StepStatus = "done" | "active" | "pending";

export interface VillainStepView {
  readonly kind: VillainStepKind;
  /** 1–5, matching the design's "step 3 of 5". */
  readonly number: number;
  readonly title: string;
  readonly beats: readonly WalkthroughBeat[];
  readonly status: StepStatus;
}

export interface Walkthrough {
  readonly round: number;
  readonly steps: readonly VillainStepView[];
  /** The step the walkthrough is showing, 1–5, or null once the phase is done. */
  readonly activeStep: number | null;
  /** Set while the phase is stopped waiting on a decision. */
  readonly pausedAt: Pause | null;
  readonly complete: boolean;
  readonly nextBeatId: number;
}

export const emptyWalkthrough = (round: number): Walkthrough => ({
  round,
  steps: VILLAIN_STEPS.map((kind, index) => ({
    kind,
    number: index + 1,
    title: STEP_TITLES[kind],
    beats: [],
    status: "pending",
  })),
  activeStep: null,
  pausedAt: null,
  complete: false,
  nextBeatId: 1,
});

/**
 * Folds one command's events onto the walkthrough. Events from outside the
 * villain phase are ignored, so the Board scene can hand it every update
 * without first deciding which phase it is in.
 */
export function appendWalkthrough(
  current: Walkthrough,
  events: readonly GameEvent[],
  state: GameState,
  viewer: PlayerId | null,
): Walkthrough {
  let working = current;
  let beats = working.steps.map((step) => [...step.beats]);
  let activeIndex = working.activeStep === null ? -1 : working.activeStep - 1;
  let pausedAt = working.pausedAt;
  let nextBeatId = working.nextBeatId;
  let complete = working.complete;
  /**
   * The round this phase belongs to, frozen when the phase starts.
   *
   * It cannot simply track `roundStarted`, because the engine can hand over a
   * whole villain phase *and* the start of the next round in one command: round
   * 1's villain phase arrives alongside `roundStarted(2)`, and reading the last
   * one seen labels it "Round 2". Nor can it read `state.round`, which is the
   * state *after* the command and has already moved on for the same reason.
   * So: start from the round the command began in (the post-command round, less
   * the rounds this command started), follow `roundStarted` as the events walk
   * past, and freeze at the moment the phase opens.
   */
  let round = working.round;
  let liveRound = state.round - events.reduce((n, event) => n + (event.type === "roundStarted" ? 1 : 0), 0);

  /** Inside the five steps: recording beats. Outside them, events are ignored. */
  const inPhase = (): boolean => activeIndex >= 0 && !complete;

  const push = (text: string, pause: Pause | null): void => {
    if (!inPhase()) return;
    beats[activeIndex]!.push({ id: `beat-${nextBeatId++}`, text, pause });
  };

  for (const event of events) {
    if (event.type === "roundStarted") {
      liveRound = event.round;
      continue;
    }

    if (event.type === "stepChanged") {
      if (event.to.phase !== "villain") {
        // Left the phase entirely: the next player phase, or game over.
        if (inPhase()) complete = true;
        continue;
      }
      const stepIndex = VILLAIN_STEPS.indexOf(event.to.kind as VillainStepKind);
      if (stepIndex < 0) {
        // A villain step outside the walkthrough's five (`endOfRound`).
        if (inPhase()) complete = true;
        continue;
      }
      if (!inPhase()) {
        // A fresh villain phase: the screen shows one phase at a time, so the
        // previous round's beats are cleared rather than accumulated. Beat ids
        // keep counting up, so nothing reuses a key across the session.
        round = liveRound;
        working = { ...emptyWalkthrough(round), nextBeatId };
        beats = working.steps.map(() => []);
        complete = false;
        pausedAt = null;
      }
      activeIndex = stepIndex;
      continue;
    }

    if (!inPhase()) continue;

    if (event.type === "choiceRequested") {
      const pause = pauseFor(event.choice, state, viewer);
      pausedAt = pause;
      push(pause.label, pause);
      continue;
    }
    if (event.type === "choiceResolved") {
      pausedAt = null;
      continue;
    }
    // Everything else reuses the log's wording, so the walkthrough and the log
    // never describe the same beat two different ways.
    const described = logLine(event, state, viewer);
    if (described) push(described.text, null);
  }

  return {
    round,
    steps: working.steps.map((step, index) => ({
      ...step,
      beats: beats[index]!,
      status: statusOf(index, activeIndex, complete),
    })),
    activeStep: activeIndex < 0 ? null : activeIndex + 1,
    pausedAt: complete ? null : pausedAt,
    complete,
    nextBeatId,
  };
}

function statusOf(index: number, activeIndex: number, complete: boolean): StepStatus {
  // Before the phase starts, nothing has run; once it ends, everything has.
  if (activeIndex < 0) return complete ? "done" : "pending";
  if (complete) return "done";
  if (index < activeIndex) return "done";
  return index === activeIndex ? "active" : "pending";
}

/**
 * Whose decision this is, as a standalone sentence — used by the choice overlay,
 * which can be open in any phase. `authority` is the rule that decided *who*
 * answers: Phase 3's whole point is that the encounter side never chooses for
 * itself, so a decision made on its behalf should say which rule put it there.
 */
export function decisionLabel(choice: ChoiceLike, state: GameState, viewer: PlayerId | null): string {
  const yours = choice.playerId === viewer;
  const who = seatName(state, choice.playerId, viewer);
  switch (choice.authority) {
    // RRG "First Player": an encounter card names a target and several are
    // eligible, so the first player selects on the card's behalf.
    case "firstPlayerTargets":
      return yours ? "As first player, you pick the target" : `${who} picks the target as first player`;
    // RRG "First Player", "Simultaneous Resolution".
    case "firstPlayerOrders":
      return yours ? "As first player, you order these effects" : `${who} orders these effects as first player`;
    default:
      if (choice.prompt.kind === "declareDefender") {
        return yours ? "Declare your defender" : `${who} declares a defender`;
      }
      return yours ? "Your decision" : `${who} decides`;
  }
}

/** RRG "Peril": no table talk, and nobody else may act while it is open. */
const perilNote = (state: GameState, playerId: PlayerId): string =>
  ` · Peril — only ${playerName(state, playerId)} may decide`;

/**
 * The same decision, worded for the auto-advancing villain-phase screen. Only
 * this screen says "auto-advance paused", because only this screen auto-
 * advances — the overlay uses `decisionLabel` instead.
 */
export function pauseFor(choice: ChoiceLike, state: GameState, viewer: PlayerId | null): Pause {
  const yours = choice.playerId === viewer;
  const who = seatName(state, choice.playerId, viewer);
  const base =
    choice.authority === "player" && choice.prompt.kind !== "declareDefender"
      ? // The design canvas's exact phrase for an ordinary interrupt.
        yours
        ? "Auto-advance paused for your interrupt"
        : `Auto-advance paused for ${who}`
      : `Auto-advance paused — ${lowerFirst(decisionLabel(choice, state, viewer))}`;

  return {
    playerId: choice.playerId,
    promptKind: choice.prompt.kind,
    authority: choice.authority,
    label: choice.soleDecider ? `${base}${perilNote(state, choice.playerId)}` : base,
    soleDecider: choice.soleDecider,
    offer: offerFor(choice, state),
  };
}

/**
 * What a paused decision is offering, in the same terms an answer sheet would
 * show a card by. For a defend it names the attack first (attacker → target),
 * because "declare your defender" alone doesn't say which enemy or who it's
 * hitting; everything else lists the options the engine actually parked
 * (`PendingChoice.options`), capped so a wide "choose target" doesn't run off
 * the panel.
 */
function offerFor(choice: ChoiceLike, state: GameState): string {
  const context =
    choice.prompt.kind === "declareDefender"
      ? `${cardName(state, choice.prompt.attack.enemyInstanceId)} → ${cardName(state, choice.prompt.attack.targetCharacterInstanceId)}. `
      : "";
  const labels = choice.options.map((option) => option.label);
  if (labels.length === 0) return context.trim();
  const shown = labels.slice(0, 4);
  const rest = labels.length - shown.length;
  return `${context}Options: ${shown.join(", ")}${rest > 0 ? ` (+${rest} more)` : ""}.`;
}

/** The fields both labelers read off a `PendingChoice`. */
interface ChoiceLike {
  readonly playerId: PlayerId;
  readonly prompt: ChoicePrompt;
  readonly authority: DecisionAuthority;
  readonly soleDecider: boolean;
  readonly options: readonly ChoiceOption[];
}

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
