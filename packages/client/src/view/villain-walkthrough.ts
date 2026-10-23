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

import type { AbilityId, CardId } from "@mc/content";
import { activeAbilityRefs, cardOf, ENEMY_TEAM_CHOICE_INSTRUCTION, ENEMY_TEAM_CHOICE_RULE } from "@mc/engine";
import type {
  FacedownRole,
  ChoiceBehalf,
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
import { facedownUntilLater } from "./facedown-history.js";
import { beatTextWithStatus, logLine } from "./log-lines.js";
import { cardName, numberWord, optionLabelOf, playerName, shortSeatName } from "./names.js";
import { triggerHeadlineOf } from "./trigger-window-context.js";

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

export type WindowTimingName = "interrupt" | "response";

/** The window a pending choice is in: its own `prompt.timing` when it has one, else the interrupt the screen opened for. */
export function windowTimingOf(choice: { readonly prompt: ChoicePrompt }): WindowTimingName {
  const timing = "timing" in choice.prompt ? (choice.prompt as { readonly timing?: string }).timing : undefined;
  return timing === "response" ? "response" : "interrupt";
}

/**
 * "Your interrupt window" / "Your response window", as the overlay heads the inline panel. With more than one seat
 * playing, the seat is named first ("She-Hulk — Your interrupt window"): on a shared screen "your" is whoever holds it.
 */
export const windowTitleOf = (timing: WindowTimingName, seat: string | null = null): string =>
  seat ? `${seat} — Your ${timing} window` : `Your ${timing} window`;

export interface Pause {
  readonly playerId: PlayerId;
  readonly promptKind: string;
  readonly authority: DecisionAuthority;
  /** Which kind of window the decision sits in (`prompt.timing`); an interrupt unless the prompt says otherwise. */
  readonly timing: WindowTimingName;
  /**
   * For an interrupt or response window, what it is about ("The Break In is about to get 1 threat"); otherwise
   * "Auto-advance paused for your decision" and the like, in the design's words.
   */
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
  /**
   * A window about one boost card: a boost-count window (Chaos Control, Scarlet Witch's Crest: "when boost icons on an
   * encounter card would be counted"), whose card's icons are about to be counted, or a window on a boost card being
   * turned faceup (Preemptive Strike), one per boost card. The interrupt panel takes the place of the boost panel while
   * it is open, so it shows this card itself (issue #172), and an attack dealt two boost cards opens two windows that
   * differ only by this card (issue #253). Absent for every other decision.
   */
  readonly countedBoost?: CountedBoost;
}

/** The boost card a window is about (`Pause.countedBoost`). */
export interface CountedBoost {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** The icons its flip reported (0 once cancelled); null when this activation's beats never saw it flip. */
  readonly icons: number | null;
  /** Its icons are about to be counted, or it is being turned faceup. */
  readonly reason: "counting" | "turnedUp";
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
      /**
       * What the enemy was while facedown, when it left play later in the same command (#291): its name and picture
       * are then the Drone's, not the card the state after the command shows faceup in a discard pile.
       */
      readonly enemyFacedownAs?: FacedownRole;
      readonly attackedPlayerId: PlayerId;
      readonly boosts: readonly BoostCardBeat[];
      /**
       * `defenderDeclared`/`defenseDeclined`; null before either has happened. `labeled` is a "(defense)" card played
       * for this attack (Barely a Scratch), which defends without being declared the defender.
       */
      readonly defender: {
        readonly instanceId: InstanceId | null;
        readonly declined: boolean;
        readonly labeled?: true;
      } | null;
      readonly resolved: AttackBreakdown | null;
    }
  | {
      readonly kind: "scheme";
      readonly enemyInstanceId: InstanceId;
      /** As the attack's. */
      readonly enemyFacedownAs?: FacedownRole;
      readonly playerId: PlayerId;
      readonly boosts: readonly BoostCardBeat[];
      readonly resolved: SchemeBreakdown | null;
      /**
       * An activation an effect started (an encounter card's "Wrecker schemes"): the engine announces no `enemyActivated`
       * for it, so its first boost card starts it as a scheme until its resolution says which it was.
       */
      readonly provisional?: true;
    };

/** The active counter moving to another villain (`activeVillainChanged`), as a beat of its own. */
export interface ActiveVillainChange {
  readonly from: InstanceId;
  readonly to: InstanceId;
  readonly reason: Extract<GameEvent, { type: "activeVillainChanged" }>["reason"];
  /** The encounter card being revealed when it moved, when one was; null when a stage or the engine moved it. */
  readonly via: InstanceId | null;
}

export interface WalkthroughBeat {
  readonly id: string;
  readonly text: string;
  /** Set when this beat is where auto-advance stopped. */
  readonly pause: Pause | null;
  /** The activation this beat belongs to, as far as events have described it so far; null outside one. */
  readonly activation: ActivationBeat | null;
  /**
   * The encounter card being revealed when this beat was recorded (its reveal beat and every beat until the next
   * reveal), so beats group per card; null/absent outside the reveal step and before the first reveal.
   */
  readonly encounterInstanceId?: InstanceId | null;
  /** The beat where an activation began: the engine's `enemyActivated`, or, for one an effect started, its first event. */
  readonly startsActivation?: true;
  /** The engine event this beat narrates (absent on a pause beat), so a view can tell a response from narration. */
  readonly eventType?: GameEvent["type"];
  /**
   * Set on the beat that narrates the active counter moving (`activeVillainChanged`): who holds it now, why, and the
   * encounter card being revealed when it moved (Buddy System), so the rail and the recap can give it a beat of its own.
   */
  readonly activeChange?: ActiveVillainChange;
  /** The seat the event is attributable to (its `playerId` / `controllerId`), or null when none is. */
  readonly seatId?: PlayerId | null;
}

/** The seat an event names itself as belonging to, if it does. */
const seatOfEvent = (event: GameEvent): PlayerId | null => {
  if ("playerId" in event && typeof event.playerId === "string") return event.playerId;
  if ("controllerId" in event && typeof event.controllerId === "string") return event.controllerId;
  return null;
};

export type StepStatus = "done" | "active" | "pending";

export interface VillainStepView {
  readonly kind: VillainStepKind;
  /** 1–5, matching the design's "step 3 of 5". */
  readonly number: number;
  readonly title: string;
  readonly beats: readonly WalkthroughBeat[];
  readonly status: StepStatus;
}

/** The encounter cards of this villain phase, read off `cardMoved` (to `dealtEncounter`) and `encounterCardRevealed`. */
export interface EncounterTracking {
  /** Every card dealt this phase, in order (including those dealt by surge or other effects while revealing). */
  readonly dealt: readonly {
    readonly instanceId: InstanceId;
    readonly playerId: PlayerId;
    /** Dealt after the reveal step began (surge and similar), not by the deal step. */
    readonly duringReveal: boolean;
    /**
     * How many beats of the phase came before the deal: the screen knows of the card once its cursor is past that many
     * (issue #386: a surge card was counted on the strip while the card that surges was still facedown). Absent in
     * hand-built fixtures, read as known from the start.
     */
    readonly atBeat?: number;
  }[];
  /** The cards revealed so far, in order. */
  readonly revealed: readonly {
    readonly instanceId: InstanceId;
    readonly cardId: CardId;
    readonly playerId: PlayerId;
  }[];
  /** The card being revealed right now: the last revealed while the reveal step is active; null otherwise. */
  readonly current: { readonly instanceId: InstanceId; readonly cardId: CardId; readonly playerId: PlayerId } | null;
}

export const emptyEncounterTracking = (): EncounterTracking => ({ dealt: [], revealed: [], current: null });

/** Whether the screen, `shown` beats into the phase, has got as far as dealing this card (issue #386). */
export const dealtByBeat = (card: EncounterTracking["dealt"][number], shown: number): boolean =>
  card.atBeat === undefined || card.atBeat < shown;

/**
 * The table as the engine had it partway through the phase (`CommandResult.states`, issue #386): shown once the reveal
 * cursor is past `atBeat` beats, so the table never runs ahead of the rail (a minion a side scheme puts into play, a
 * status card given to the villain, a surge card dealt facedown).
 */
export interface WalkthroughTable {
  readonly atBeat: number;
  readonly game: GameState;
}

export interface Walkthrough {
  readonly round: number;
  readonly encounter: EncounterTracking;
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
  /** The table at moments of the phase, oldest first (`WalkthroughTable`); empty when the host sent none. */
  readonly tables: readonly WalkthroughTable[];
}

export const emptyWalkthrough = (round: number): Walkthrough => ({
  round,
  encounter: emptyEncounterTracking(),
  tables: [],
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
  /** The state as each of these events left it, where the host recorded one (`CommandResult.states`). */
  states: readonly { readonly at: number; readonly state: GameState }[] = [],
): Walkthrough {
  let working = current;
  let tables = [...working.tables];
  const stateAt = new Map(states.map((entry) => [entry.at, entry.state]));
  let beats = working.steps.map((step) => [...step.beats]);
  let activeIndex = working.activeStep === null ? -1 : working.activeStep - 1;
  let pausedAt = working.pausedAt;
  let nextBeatId = working.nextBeatId;
  let complete = working.complete;
  let activation = working.activation;
  /** Set when an event starts an activation, and stamped on the next beat pushed (an event with no wording pushes none). */
  let startsActivation = false;
  let dealt = [...working.encounter.dealt];
  let revealed = [...working.encounter.revealed];
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

  /** The activation in hand is `enemyId`'s and has not resolved yet: the next event about that enemy belongs to it. */
  const ongoing = (enemyId: InstanceId): boolean =>
    activation !== null && activation.enemyInstanceId === enemyId && activation.resolved === null;

  /** Inside the five steps: recording beats. Outside them, events are ignored. */
  const inPhase = (): boolean => activeIndex >= 0 && !complete;

  const beatCount = (): number => beats.reduce((sum, step) => sum + step.length, 0);

  /**
   * Keeps the state event `at` left, if the host recorded one, against the beats pushed so far: it goes up with the
   * next beat (this event's own, when it has wording). Of several events before one beat, the last one's state wins.
   * The phase's opening is kept apart (`atBeat` -1): it is the table before anything of the phase was shown.
   */
  const noteTable = (at: number, opening = false): void => {
    const game = stateAt.get(at);
    if (!game) return;
    const atBeat = opening ? -1 : beatCount();
    if (tables.at(-1)?.atBeat === atBeat) tables[tables.length - 1] = { atBeat, game };
    else tables.push({ atBeat, game });
  };

  const push = (text: string, pause: Pause | null, event?: GameEvent): void => {
    if (!inPhase()) return;
    const revealing = activeIndex === VILLAIN_STEPS.indexOf("revealEncounterCards") ? revealed.at(-1) : undefined;
    beats[activeIndex]!.push({
      id: `beat-${nextBeatId++}`,
      text,
      pause,
      activation,
      encounterInstanceId: revealing?.instanceId ?? null,
      ...(event ? { eventType: event.type, seatId: seatOfEvent(event) } : {}),
      ...(startsActivation ? { startsActivation: true as const } : {}),
      ...(event?.type === "activeVillainChanged"
        ? { activeChange: { from: event.from, to: event.to, reason: event.reason, via: revealing?.instanceId ?? null } }
        : {}),
    });
  };

  for (const [at, event] of events.entries()) {
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
      const opening = !inPhase();
      if (opening) {
        // A fresh villain phase: the screen shows one phase at a time, so the
        // previous round's beats are cleared rather than accumulated. Beat ids
        // keep counting up, so nothing reuses a key across the session.
        round = liveRound;
        working = { ...emptyWalkthrough(round), nextBeatId };
        beats = working.steps.map(() => []);
        complete = false;
        pausedAt = null;
        activation = null;
        dealt = [];
        revealed = [];
        tables = [];
      }
      activeIndex = stepIndex;
      noteTable(at, opening);
      // The enemies' activations are over once their step is: a later step's beats carry only an activation one of
      // its own cards starts (a treachery's "Rhino schemes", #370), never the last attack of step 2.
      if (stepIndex !== VILLAIN_STEPS.indexOf("enemyActivations")) activation = null;
      continue;
    }

    if (!inPhase()) continue;
    noteTable(at);

    if (event.type === "choiceRequested") {
      const pause = pauseFor(event.choice, state, viewer, activation);
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
      case "cardMoved":
        if (event.to.kind === "dealtEncounter") {
          dealt.push({
            instanceId: event.instanceId,
            playerId: event.to.playerId,
            duringReveal: activeIndex >= VILLAIN_STEPS.indexOf("revealEncounterCards"),
            atBeat: beatCount(),
          });
        }
        break;
      case "encounterCardRevealed":
        revealed.push({ instanceId: event.instanceId, cardId: event.cardId, playerId: event.playerId });
        // Each card starts clean: a finished activation from before it is not this card's. One still resolving keeps
        // going (an attack whose effect reveals a card mid-activation). Only in the reveal step: a card a step-2 effect
        // reveals (a stage's "reveal a card") stays with the activation it follows, as the recap groups it.
        if (activeIndex === VILLAIN_STEPS.indexOf("revealEncounterCards") && activation?.resolved !== null) {
          activation = null;
        }
        break;
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
        startsActivation = true;
        break;
      case "boostCardFlipped":
        if (ongoing(event.enemyInstanceId)) {
          activation = {
            ...activation!,
            boosts: [
              ...activation!.boosts,
              { instanceId: event.instanceId, boostIcons: event.boostIcons, cancelled: null },
            ],
          };
        } else {
          // An activation an effect started has no `enemyActivated`: its first boost card begins it, as a scheme until
          // its resolution says which it was.
          activation = {
            kind: "scheme",
            enemyInstanceId: event.enemyInstanceId,
            playerId: revealed.at(-1)?.playerId ?? state.firstPlayerId,
            boosts: [{ instanceId: event.instanceId, boostIcons: event.boostIcons, cancelled: null }],
            resolved: null,
            provisional: true,
          };
          startsActivation = true;
        }
        break;
      case "boostCancelled":
        if (activation) {
          // A card discarded while still facedown (Defiance, issue #348) was never flipped, so it joins the list here,
          // named: the discard pile is public.
          const listed =
            event.scope !== "discarded" || activation.boosts.some((b) => b.instanceId === event.instanceId);
          activation = {
            ...activation,
            boosts: listed
              ? activation.boosts.map((b) => (b.instanceId === event.instanceId ? { ...b, cancelled: event.scope } : b))
              : [...activation.boosts, { instanceId: event.instanceId, boostIcons: 0, cancelled: event.scope }],
          };
        }
        break;
      case "defenderDeclared":
        if (activation?.kind === "attack" && activation.enemyInstanceId === event.attackInstanceId) {
          activation = { ...activation, defender: { instanceId: event.defenderInstanceId, declined: false } };
        }
        break;
      // A "(defense)"-labeled card played during the attack: the attack's defense even though nobody was declared the
      // defender (the engine's own record is `defenseClaimOf`; the play is what the event stream shows).
      case "cardPlayed":
        if (
          activation?.kind === "attack" &&
          !activation.defender?.instanceId &&
          activeAbilityRefs(state, event.instanceId, deps).some(
            (ref) => deps.abilities[ref.id]?.label?.includes("defense") === true,
          )
        ) {
          activation = { ...activation, defender: { instanceId: event.instanceId, declined: false, labeled: true } };
        }
        break;
      case "defenseDeclined":
        if (activation?.kind === "attack" && activation.enemyInstanceId === event.attackInstanceId) {
          activation = { ...activation, defender: { instanceId: null, declined: true } };
        }
        break;
      case "attackResolved": {
        const resolved: AttackBreakdown = {
          targetInstanceId: event.targetInstanceId,
          baseAtk: event.baseAtk,
          boostIcons: event.boostIcons,
          defenseReduction: event.defenseReduction,
          damageDealt: event.damageDealt,
        };
        if (activation?.kind === "attack" && ongoing(event.enemyInstanceId)) {
          activation = { ...activation, resolved };
        } else {
          // An effect's attack (no `enemyActivated`): the seat is whoever's identity it hit, else the revealing seat.
          const hit = state.players.find((seat) => seat.identity.instanceId === event.targetInstanceId);
          const carried = ongoing(event.enemyInstanceId) ? activation!.boosts : [];
          activation = {
            kind: "attack",
            enemyInstanceId: event.enemyInstanceId,
            attackedPlayerId: hit?.playerId ?? revealed.at(-1)?.playerId ?? state.firstPlayerId,
            boosts: carried,
            defender: null,
            resolved,
          };
          if (carried.length === 0) startsActivation = true;
        }
        break;
      }
      case "schemeResolved": {
        const resolved: SchemeBreakdown = {
          schemeInstanceId: event.schemeInstanceId,
          baseSch: event.baseSch,
          boostIcons: event.boostIcons,
          threatBonus: event.threatBonus,
          threatPlaced: event.threatPlaced,
        };
        if (activation?.kind === "scheme" && ongoing(event.enemyInstanceId)) {
          const { provisional: _provisional, ...settled } = activation;
          activation = { ...settled, resolved };
        } else {
          activation = {
            kind: "scheme",
            enemyInstanceId: event.enemyInstanceId,
            playerId: revealed.at(-1)?.playerId ?? state.firstPlayerId,
            boosts: [],
            resolved,
          };
          startsActivation = true;
        }
        break;
      }
      default:
        break;
    }
    if (activation && activation.enemyFacedownAs === undefined) {
      const role = facedownUntilLater(events, at, activation.enemyInstanceId);
      if (role) activation = { ...activation, enemyFacedownAs: role };
    }

    // Everything else reuses the log's wording, so the walkthrough and the log
    // never describe the same beat two different ways.
    const described = logLine(event, state, viewer, deps, false, undefined, { events, at });
    if (described) {
      push(beatTextWithStatus(described), null, event);
      startsActivation = false;
    }
  }

  return {
    round,
    tables,
    encounter: {
      dealt,
      revealed,
      current:
        !complete && activeIndex === VILLAIN_STEPS.indexOf("revealEncounterCards") ? (revealed.at(-1) ?? null) : null,
    },
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
  const who = shortSeatName(state, choice.playerId, viewer);
  switch (choice.authority) {
    // RRG "First Player": an encounter card names a target and several are
    // eligible, so the first player selects on the card's behalf.
    case "firstPlayerTargets":
      return yours ? "As first player, you pick the target" : `${who} picks the target as first player`;
    // RRG "First Player", "Simultaneous Resolution".
    case "firstPlayerOrders":
      return yours ? "As first player, you order these effects" : `${who} orders these effects as first player`;
    // MC56 p. 6 (the grim rule): "the enemy team" is the players, and the first player decides for it.
    case "enemyTeam":
      return yours
        ? "As first player, you choose for the enemy team"
        : `${who} chooses for the enemy team as first player`;
    default:
      if (choice.prompt.kind === "declareDefender") {
        return yours ? "Declare your defender" : `${who} declares a defender`;
      }
      // Wave 7 QA: the sheet said nothing about why it opened. The limit is the prompt's own (Psylocke's is two).
      if (choice.prompt.kind === "discardRestricted") {
        const over = `over the limit of ${numberWord(choice.prompt.limit)} restricted cards`;
        return yours ? `You are ${over}` : `${who} is ${over}`;
      }
      return yours ? "Your decision" : `${who} decides`;
  }
}

/**
 * The line under an attack's breakdown naming who defended, or null when nobody did. RRG "Defend": an ally's DEF never
 * reduces the attack, so a defending ally says so; a "(defense)" card says that it was the defense. Readable from
 * `defenderDeclared` / the labeled play without waiting for the resolved beat.
 */
export function defenderLineOf(state: GameState, activation: ActivationBeat): string | null {
  if (activation.kind !== "attack" || !activation.defender || activation.defender.declined) return null;
  const id = activation.defender.instanceId;
  if (!id) return null;
  if (activation.defender.labeled) return `${cardName(state, id)} defended.`;
  return cardOf(state, id)?.type === "ally" ? `${cardName(state, id)} defended — no DEF reduction.` : null;
}

/** RRG "Peril": no table talk, and nobody else may act while it is open. */
const perilNote = (state: GameState, playerId: PlayerId): string =>
  ` · Peril — only ${playerName(state, playerId)} may decide`;

/**
 * The same decision, worded for the auto-advancing villain-phase screen. Only
 * this screen says "auto-advance paused", because only this screen auto-
 * advances — the overlay uses `decisionLabel` instead.
 */
export function pauseFor(
  choice: ChoiceLike,
  state: GameState,
  viewer: PlayerId | null,
  activation: ActivationBeat | null = null,
): Pause {
  const yours = choice.playerId === viewer;
  const who = shortSeatName(state, choice.playerId, viewer);
  const counted = countedBoostOf(choice, state, activation);
  // What the window is about ("The Break In is about to get 1 threat"), off the prompt's own event: "auto-advance paused
  // for your interrupt" alone left the player deciding on Great Responsibility without the amount or the scheme (#371).
  const about =
    choice.prompt.kind === "chooseTriggers"
      ? triggerHeadlineOf(state, choice.prompt.event, windowTimingOf(choice), viewer ?? choice.playerId)
      : null;
  const base = counted
    ? // Names the boost card: nothing else on screen does while the interrupt panel is up (issue #172), and two boost
      // cards turned up in one attack open two windows alike in everything else (issue #253).
      `${yours ? "Your" : `${who}'s`} ${windowTimingOf(choice)}: ${
        counted.reason === "turnedUp" ? `${counted.name} turned up` : `counting the boost icons on ${counted.name}`
      }${counted.icons === null ? "" : ` (${counted.icons} icon${counted.icons === 1 ? "" : "s"})`}`
    : choice.authority === "player" && choice.prompt.kind !== "declareDefender"
      ? about
        ? yours
          ? about
          : `${about} · ${who}'s ${windowTimingOf(choice)}`
        : // The design canvas's exact phrase for an ordinary interrupt.
          yours
          ? `Auto-advance paused for your ${windowTimingOf(choice)}`
          : `Auto-advance paused for ${who}`
      : `Auto-advance paused — ${lowerFirst(decisionLabel(choice, state, viewer))}`;

  return {
    playerId: choice.playerId,
    promptKind: choice.prompt.kind,
    authority: choice.authority,
    timing: windowTimingOf(choice),
    label: choice.soleDecider ? `${base}${perilNote(state, choice.playerId)}` : base,
    soleDecider: choice.soleDecider,
    offer: offerFor(choice, state),
    ...(counted ? { countedBoost: counted } : {}),
  };
}

/**
 * The boost card a window is about, off the window's own event: a "boost icons would be counted" window
 * (`boostIconsCounting.cardInstanceId`), with the icon count its flip reported in this activation's beats, or a
 * "boost card turned faceup" window (`boostCardTurnedFaceup.boostInstanceId`), with the icons that event announces.
 */
export function countedBoostOf(
  choice: ChoiceLike,
  state: GameState,
  activation: ActivationBeat | null,
): CountedBoost | null {
  if (choice.prompt.kind !== "chooseTriggers") return null;
  const event = choice.prompt.event;
  if (event?.kind === "boostCardTurnedFaceup") {
    const instanceId = event.boostInstanceId;
    return { instanceId, name: cardName(state, instanceId), icons: event.boostIcons, reason: "turnedUp" };
  }
  if (event?.kind !== "boostIconsCounting") return null;
  const instanceId = event.cardInstanceId;
  const beat = activation?.boosts.find((boost) => boost.instanceId === instanceId);
  const icons = beat ? (beat.cancelled === "icons" ? 0 : beat.boostIcons) : null;
  return { instanceId, name: cardName(state, instanceId), icons, reason: "counting" };
}

/**
 * The docked panel's boost line under "happening now": the card a boost-count window is counting, with its icons, while
 * one is open; else the boost cards flipped so far by name; else that one is still facedown.
 */
export function activationBoostLineOf(
  activation: ActivationBeat,
  counted: CountedBoost | null,
  state: GameState,
): string | null {
  if (counted) {
    const icons = counted.icons === null ? "" : ` · ${counted.icons} boost icon${counted.icons === 1 ? "" : "s"}`;
    return counted.reason === "turnedUp" ? `${counted.name} turned up${icons}` : `Counting ${counted.name}${icons}`;
  }
  if (activation.boosts.length > 0) {
    return `Boost: ${activation.boosts.map((boost) => cardName(state, boost.instanceId)).join(", ")}`;
  }
  return activation.resolved ? null : "Boost card facedown · flips after interrupts";
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
  const labels = choice.options.map((option) => optionLabelOf(state, option));
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
  /** Present exactly when `authority` is `enemyTeam`. */
  readonly onBehalfOf?: ChoiceBehalf | undefined;
}

/** The authority tag on a choice sheet's bar: Peril outranks it, since Peril forbids any table talk. */
export function authorityTagOf(choice: Pick<ChoiceLike, "authority" | "soleDecider">): string {
  if (choice.soleDecider) return "PERIL";
  return choice.authority === "enemyTeam" ? "ENEMY TEAM'S CHOICE" : "AUTHORITY: PLAYER";
}

/**
 * What an enemy-team choice shows under its title, from the engine's own strings (never retyped here): who is
 * deciding, whom the team acts against, the instruction, and the grim rule that is the "Why?". Null for every other
 * authority, whose sheets are unchanged.
 */
export interface EnemyTeamNotice {
  readonly tag: string;
  readonly decider: string;
  /** "The enemy team acts against Ana."; null when the effect resolves for no player. */
  readonly against: string | null;
  readonly instruction: string;
  readonly whyTitle: string;
  readonly rule: string;
}

export function enemyTeamNoticeOf(
  choice: ChoiceLike,
  state: GameState,
  viewer: PlayerId | null,
): EnemyTeamNotice | null {
  if (choice.authority !== "enemyTeam") return null;
  const facing = choice.onBehalfOf?.facingPlayerId ?? null;
  return {
    tag: authorityTagOf(choice),
    decider: decisionLabel(choice, state, viewer),
    against:
      facing === null ? null : `The enemy team acts against ${facing === viewer ? "you" : playerName(state, facing)}.`,
    instruction: ENEMY_TEAM_CHOICE_INSTRUCTION,
    whyTitle: "Why?",
    rule: `“${ENEMY_TEAM_CHOICE_RULE}” (rulebook, p. 6)`,
  };
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
 * Where a card offered by a window is played from: a hand, or the top of a deck (Magik's "you may play the top card of
 * your deck as if it was in your hand", the case in issue #253); null for a card in play.
 */
export function offeredFrom(state: GameState, instanceId: InstanceId): "hand" | "deckTop" | null {
  if (state.players.some((player) => player.hand.includes(instanceId))) return "hand";
  if (state.players.some((player) => player.deck[0] === instanceId)) return "deckTop";
  return null;
}

/**
 * What the option's button says. A card in a hand is *played* ("Play Backflip"); an ability on a card already in
 * play — an identity's own, an upgrade's — is *used*, and by its printed name where it has one ("Use Spider-Sense"),
 * since "Play Spider-Man" names something the player cannot do. The verb comes from where the card is, never from
 * the card's type: an ally's in-play response is used, and the same ally in hand would be played.
 */
export function interruptActionLabel(state: GameState, option: InlineInterruptOption): string {
  const name = cardName(state, option.instanceId);
  if (offeredFrom(state, option.instanceId) !== null) return `Play ${name}`;
  const printed = option.abilityId
    ? activeAbilityRefs(state, option.instanceId).find((ref) => ref.id === option.abilityId)?.label
    : null;
  return `Use ${printed || name}`;
}

/**
 * One `chooseTriggers` prompt is ONE multi-select (min 0, max N): every response the player wants from the same
 * condition goes in one answer (RRG 1.8 "Response", p. 36), so a window that offers two or more options cannot answer
 * "just this one" per button without forfeiting the others. With two or more options the buttons become toggles and
 * one control answers; with exactly one option the press stays a one-press answer (`inlineSingle`).
 */
export const inlineSingle = (options: readonly InlineInterruptOption[]): boolean => options.length < 2;

/**
 * How long a newly opened inline window ignores presses. An attack dealt two boost cards opens one window per card, the
 * second drawn the moment the first is answered, with its buttons where the first one's were: a second press on "Let
 * it resolve" (a double press, or a press again because nothing seemed to change) answered the second card's window
 * before the player had seen it (issue #253).
 */
export const INLINE_ARM_MS = 500;

/** The inline window on screen: the decision it was drawn for and when it first appeared. */
export interface InlineShown {
  readonly choiceId: string;
  readonly at: number;
}

/** The window now drawn for `choiceId`: the same window keeps the time it first appeared, a new one starts its own. */
export const inlineShownFor = (shown: InlineShown | null, choiceId: string, now: number): InlineShown =>
  shown?.choiceId === choiceId ? shown : { choiceId, at: now };

/**
 * Whether a press on a window drawn for `drawnFor` answers it: that window is still the open decision (`open`), it is
 * the one on screen, and it has been up for `INLINE_ARM_MS`. A press on a window that has since been answered never
 * answers the next one.
 */
export const inlinePressAnswers = (
  shown: InlineShown | null,
  drawnFor: string,
  open: string | null,
  now: number,
): boolean => shown !== null && shown.choiceId === drawnFor && open === drawnFor && now - shown.at >= INLINE_ARM_MS;

/** Toggles one option in the picks (kept in pick order, which is the order they resolve in); no more than `max`. */
export function toggleInlinePick(picked: readonly string[], optionId: string, max: number): readonly string[] {
  if (picked.includes(optionId)) return picked.filter((id) => id !== optionId);
  return picked.length >= max ? picked : [...picked, optionId];
}

/** The picks that are still on offer (a rebuilt window may have dropped one). */
export const livePicks = (picked: readonly string[], options: readonly InlineInterruptOption[]): readonly string[] =>
  picked.filter((id) => options.some((option) => option.optionId === id));

/** The one control that answers: "Let it resolve" with none picked, "Use Steel Skin" with one, "Use 2" with more. */
export function inlineConfirmLabel(
  state: GameState,
  options: readonly InlineInterruptOption[],
  picked: readonly string[],
): string {
  if (picked.length === 0) return "Let it resolve";
  if (picked.length > 1) return `Use ${picked.length}`;
  const option = options.find((candidate) => candidate.optionId === picked[0]);
  return option ? interruptActionLabel(state, option) : "Use 1";
}

/** An option button's label while the buttons are toggles: its pick number in front once picked ("1 · Use Steel Skin"). */
export function inlinePickLabel(action: string, picked: readonly string[], optionId: string): string {
  const index = picked.indexOf(optionId);
  return index < 0 ? action : `${index + 1} · ${action}`;
}

/**
 * The villain-phase screen's reveal/close pacing (`scenes/villain-phase.ts`'s `#syncTiming`), pulled out as plain
 * functions of the numbers the scene already tracks, so the decision itself is testable without a Phaser scene.
 *
 * `total` can grow between two calls to `advanceReveal` — the engine can hand over the *rest* of a villain phase
 * (a defended attack's damage, the remaining steps, the phase ending) in the very command that resolves the pause
 * the player was looking at, so the screen's reveal cursor can go from "a few beats behind" to "caught up" without
 * any further command ever arriving. That is exactly why `readyToAutoClose` must be re-checked on *every* tick of
 * the reveal timer, not only when a fresh store update lands: a phase that finishes revealing between two store
 * updates — the ordinary case, since nothing else happens on the table until the player's next action — would
 * otherwise sit fully shown and `complete` but never get checked again, and stay open until Skip. Regression: a
 * defended attack that resolved the rest of round 1's villain phase in the same command as the defend choice used
 * to hang exactly this way (found 2026-09-29 against `guide/tutorial-config.ts`'s scripted defend).
 */

/** One more beat shown, capped at `total` — what the reveal timer's own tick advances by. */
export function advanceReveal(revealed: number, total: number): number {
  return Math.min(revealed + 1, total);
}

/** Whether the screen should be starting its close timer: the engine actually left the phase, and every beat it
 * currently knows about has been shown. Depends on nothing but these three numbers — not on whether `revealed`
 * just moved because a store update landed or because the reveal timer ticked — so it must be safe, and correct,
 * to call this again after *either* kind of change. */
export function readyToAutoClose(complete: boolean, revealed: number, total: number): boolean {
  return complete && revealed >= total;
}

/** Where the recap stands against an open decision sheet, and whether the recap takes clicks. */
export interface RecapPlacement {
  /** True when the recap is drawn above the decision sheet (so the sheet is hidden and inert); false when the sheet is above it. */
  readonly recapOnTop: boolean;
  /** True when the recap's own controls (Continue, Skip, the inline answer) take presses. */
  readonly recapTakesInput: boolean;
}

/**
 * The recap against an open decision. While the recap is still narrating a decision that the sheet answers, the sheet
 * is above it and the recap takes no click, so nothing on the recap catches a press meant for the sheet. Once the
 * recap is finished (Continue is showing) it keeps the top and its input whatever decision is open: a response that
 * opens as the player phase begins is already pending behind the last step, and a Continue that did nothing there
 * read as a hung game. Continue closes the recap, and the sheet is then the screen's top. The inline interrupt the
 * recap answers itself also keeps the top.
 */
export function recapPlacementFor(input: {
  readonly pending: boolean;
  readonly inline: boolean;
  readonly finished: boolean;
  /**
   * The docked phase is holding the decision back (the owner's call, 2026-10-14): before the player started the phase,
   * or until they press ANSWER on its notice. The sheet stays hidden under the phase until then.
   */
  readonly held?: boolean;
  /**
   * The decision's sheet is docked in the phase's own panel (#231): the sheet is above the phase but covers only its
   * dock, so the phase's header (EXPAND, HIDE, PEEK AT TABLE) still takes presses beside it.
   */
  readonly docked?: boolean;
}): RecapPlacement {
  if (!input.pending) return { recapOnTop: true, recapTakesInput: true };
  const onTop = input.inline || input.finished || input.held === true;
  return { recapOnTop: onTop, recapTakesInput: onTop || input.docked === true };
}

/**
 * The decision a HIDE press puts away, so the hidden rail does not come straight back for it: the open choice only once
 * the replay has reached it and the player has seen it. Pressed while the engine is parked on a choice the replay has
 * not shown yet, it is none, so that choice brings the rail back when the replay gets there. Remembering it then left
 * the window hidden behind the handle with no prompt and no PLAY NOW tag, read as "my interrupt was never offered".
 */
export function choiceHiddenBy(pendingChoiceId: string | null, decisionDue: boolean): string | null {
  return decisionDue ? pendingChoiceId : null;
}
