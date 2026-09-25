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

import type { AbilityId } from "@mc/content";
import { activeAbilityRefs } from "@mc/engine";
import type {
  ChoiceOption,
  ChoicePrompt,
  DecisionAuthority,
  EngineDeps,
  GameEvent,
  GameState,
  InstanceId,
  PendingChoice,
  PlayerId,
} from "@mc/engine";
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

/** One boost card revealed during the activation this beat belongs to (`boostCardFlipped`/`boostCancelled`). */
export interface BoostCardBeat {
  readonly instanceId: InstanceId;
  /** From the *unmodified* flip; `cancelled` says whether the icons still count. */
  readonly boostIcons: number;
  /** Set once a `boostCancelled` names this card — "icons" (the icons don't count) or "ability" (its Boost text didn't fire). */
  readonly cancelled: "icons" | "ability" | "discarded" | null;
}

/** `attackResolved`'s own terms, once the activation actually resolves. */
export interface AttackBreakdown {
  readonly targetInstanceId: InstanceId;
  readonly baseAtk: number;
  readonly boostIcons: number;
  readonly defenseReduction: number;
  readonly damageDealt: number;
}

/** `schemeResolved`'s own terms. */
export interface SchemeBreakdown {
  readonly schemeInstanceId: InstanceId;
  readonly baseSch: number;
  readonly boostIcons: number;
  readonly threatBonus: number;
  readonly threatPlaced: number;
}

/**
 * The activation the current step is walking, built up one event at a time —
 * "happening now" reads whichever snapshot is stamped on the beat it is
 * currently showing, so a boost card that has flipped but whose activation
 * hasn't resolved yet is already visible, and the breakdown itself only
 * appears once `attackResolved`/`schemeResolved` actually arrives. Every
 * number is copied off the event that reported it — nothing here is computed.
 */
export type ActivationBeat =
  | {
      readonly kind: "attack";
      readonly enemyInstanceId: InstanceId;
      readonly attackedPlayerId: PlayerId;
      readonly boosts: readonly BoostCardBeat[];
      /** `defenderDeclared`/`defenseDeclined`; null before either has happened. */
      readonly defender: { readonly instanceId: InstanceId | null; readonly declined: boolean } | null;
      readonly resolved: AttackBreakdown | null;
    }
  | {
      readonly kind: "scheme";
      readonly enemyInstanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly boosts: readonly BoostCardBeat[];
      readonly resolved: SchemeBreakdown | null;
    };

export interface WalkthroughBeat {
  readonly id: string;
  readonly text: string;
  /** Set when this beat is where auto-advance stopped. */
  readonly pause: Pause | null;
  /** The activation this beat belongs to, as far as events have described it so far; null outside one. */
  readonly activation: ActivationBeat | null;
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
  /**
   * The activation currently being walked, so it survives across the several
   * `appendWalkthrough` calls one activation can span (a defend choice pauses
   * mid-attack; the boosts and the resolution arrive in a later command).
   */
  readonly activation: ActivationBeat | null;
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
  activation: null,
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
  deps: EngineDeps,
): Walkthrough {
  let working = current;
  let beats = working.steps.map((step) => [...step.beats]);
  let activeIndex = working.activeStep === null ? -1 : working.activeStep - 1;
  let pausedAt = working.pausedAt;
  let nextBeatId = working.nextBeatId;
  let complete = working.complete;
  let activation = working.activation;
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
    beats[activeIndex]!.push({ id: `beat-${nextBeatId++}`, text, pause, activation });
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
        activation = null;
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
    // The activation accumulator: built up one event at a time so "happening
    // now" can show a boost card the moment it flips, well before the
    // activation itself resolves. Stamped onto every beat pushed after it
    // changes (`push` reads the closed-over `activation`), so a beat always
    // carries the activation exactly as it stood when that beat was recorded.
    switch (event.type) {
      case "enemyActivated":
        activation =
          event.activation === "attack"
            ? {
                kind: "attack",
                enemyInstanceId: event.enemyInstanceId,
                attackedPlayerId: event.playerId,
                boosts: [],
                defender: null,
                resolved: null,
              }
            : {
                kind: "scheme",
                enemyInstanceId: event.enemyInstanceId,
                playerId: event.playerId,
                boosts: [],
                resolved: null,
              };
        break;
      case "boostCardFlipped":
        if (activation && activation.enemyInstanceId === event.enemyInstanceId) {
          activation = {
            ...activation,
            boosts: [
              ...activation.boosts,
              { instanceId: event.instanceId, boostIcons: event.boostIcons, cancelled: null },
            ],
          };
        }
        break;
      case "boostCancelled":
        if (activation) {
          activation = {
            ...activation,
            boosts: activation.boosts.map((b) =>
              b.instanceId === event.instanceId ? { ...b, cancelled: event.scope } : b,
            ),
          };
        }
        break;
      case "defenderDeclared":
        if (activation?.kind === "attack" && activation.enemyInstanceId === event.attackInstanceId) {
          activation = { ...activation, defender: { instanceId: event.defenderInstanceId, declined: false } };
        }
        break;
      case "defenseDeclined":
        if (activation?.kind === "attack" && activation.enemyInstanceId === event.attackInstanceId) {
          activation = { ...activation, defender: { instanceId: null, declined: true } };
        }
        break;
      case "attackResolved":
        if (activation?.kind === "attack" && activation.enemyInstanceId === event.enemyInstanceId) {
          activation = {
            ...activation,
            resolved: {
              targetInstanceId: event.targetInstanceId,
              baseAtk: event.baseAtk,
              boostIcons: event.boostIcons,
              defenseReduction: event.defenseReduction,
              damageDealt: event.damageDealt,
            },
          };
        }
        break;
      case "schemeResolved":
        if (activation?.kind === "scheme" && activation.enemyInstanceId === event.enemyInstanceId) {
          activation = {
            ...activation,
            resolved: {
              schemeInstanceId: event.schemeInstanceId,
              baseSch: event.baseSch,
              boostIcons: event.boostIcons,
              threatBonus: event.threatBonus,
              threatPlaced: event.threatPlaced,
            },
          };
        }
        break;
      default:
        break;
    }

    // Everything else reuses the log's wording, so the walkthrough and the log
    // never describe the same beat two different ways.
    const described = logLine(event, state, viewer, deps);
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
    activation,
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

/** One of the viewer's own cards or in-play abilities, offered by an open `chooseTriggers` window. */
export interface InlineInterruptOption {
  readonly optionId: string;
  readonly instanceId: InstanceId;
  /** The ability on offer, when the option is one (an identity's or an in-play card's own interrupt); null for a bare card. */
  readonly abilityId: AbilityId | null;
}

/**
 * The inline interrupt window (D11/P09/L02): when an optional interrupt or
 * response is open and it is *this* viewer's own decision, the walkthrough can
 * show each of their legal cards right there, with "Let it resolve" beside it,
 * instead of only narrating that a pause happened.
 *
 * Only `chooseTriggers` qualifies — every other prompt kind is either a
 * required decision with no "let it resolve" (a defend, an ordering) or not
 * the viewer's own card to play. Null whenever there is nothing of the
 * viewer's own to interrupt with, so the walkthrough falls back to the plain
 * narration (`pauseFor`) exactly as before.
 *
 * `optionId` is submitted through the same `resolveChoice([optionId])` the
 * choice overlay would use for the same option, and an empty selection
 * (`resolveChoice([])`) is "let it resolve" — `chooseTriggers` is always
 * parked with `minSelections: 0` (`resolve/window.ts`) for exactly that
 * reason. Nothing here invents a new answer shape.
 */
export function inlineInterruptFor(
  choice: PendingChoice,
  viewer: PlayerId | null,
): readonly InlineInterruptOption[] | null {
  if (choice.prompt.kind !== "chooseTriggers" || choice.playerId !== viewer) return null;
  const options = choice.options.flatMap((option) =>
    option.ref.kind === "card" || option.ref.kind === "ability"
      ? [
          {
            optionId: option.optionId,
            instanceId: option.ref.instanceId,
            abilityId: option.ref.kind === "ability" ? option.ref.abilityId : null,
          },
        ]
      : [],
  );
  return options.length > 0 ? options : null;
}

/**
 * What the option's button says. A card in a hand is *played* ("Play Backflip"); an ability on a card already in
 * play — an identity's own, an upgrade's — is *used*, and by its printed name where it has one ("Use Spider-Sense"),
 * since "Play Spider-Man" names something the player cannot do. The verb comes from where the card is, never from
 * the card's type: an ally's in-play response is used, and the same ally in hand would be played.
 */
export function interruptActionLabel(state: GameState, option: InlineInterruptOption): string {
  const name = cardName(state, option.instanceId);
  if (state.players.some((player) => player.hand.includes(option.instanceId))) return `Play ${name}`;
  const printed = option.abilityId
    ? activeAbilityRefs(state, option.instanceId).find((ref) => ref.id === option.abilityId)?.label
    : null;
  return `Use ${printed || name}`;
}
