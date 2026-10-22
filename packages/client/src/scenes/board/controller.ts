/**
 * The Board's interaction controller: target-select mode, payment mode, and
 * the one route every command takes to the store.
 *
 * It decides nothing the engine owns — every target, price and legality check
 * it acts on came from `legalActions` or `paymentFor` — and it draws nothing:
 * whenever the selection changes it asks the scene to redraw.
 */

import { POOL_DEPS } from "../../content/pool.js";
import type { AbilityId } from "@mc/content";
import type { Command, CostChoices, CostSelection, GameState, InstanceId, LegalAction, PlayerId } from "@mc/engine";
import { paymentFor, tryPayment } from "@mc/engine";
import { appSession } from "../../session.js";
import { abilityLabelOf, abilityShortLabelOf } from "../../view/ability-label.js";
import {
  assaultThwartSuffix,
  powerEntries,
  powerSources,
  type PowerKind,
  type PowerSource,
} from "../../view/attacker-choice.js";
import {
  eventAbilityOptions,
  needsEventAbilityChoice,
  type EventAbilityOption,
} from "../../view/event-ability-choice.js";
import {
  formEntries,
  formSources,
  needsFormChoice,
  paymentSubjectWords,
  type FormSource,
} from "../../view/change-form-choice.js";
import type { BoardModel } from "../../view/board-model.js";
import { characterPanel } from "../../view/board-model.js";
import { costChoicePromptFor, type CostChoicePrompt } from "../../view/cost-choice-model.js";
import type { CostReductionOption } from "../../view/cost-reduction-model.js";
import {
  beginDiscardChoice,
  discardChoiceView as buildDiscardChoiceView,
  toggleDiscardChoice,
  type DiscardChoiceView,
} from "../../view/discard-choice-model.js";
import { beginDividePower, divideCommand, dividePanelOf, tapDivideTarget } from "../../view/divide-power.js";
import { endTurnConfirmOf } from "../../view/end-turn-confirm.js";
import { smallHandSizeConfirmOf } from "../../view/hand-size-note.js";
import {
  advanceInPlayCostChoice,
  beginInPlayCostChoice,
  costChoicesOf,
  inPlayCostChoiceView,
  isLastSlot,
  offeredNow,
  slotAnswered,
  toggleInPlayPick,
  type InPlayCostChoiceView,
} from "../../view/in-play-cost-choice.js";
import { inPlayCostPanelOf, seatOptionsOf, seatPanelOf } from "../../view/pick-panels.js";
import { focusOrder, type FocusTarget } from "../../view/focus.js";
import { undoOf, undoTargetsOf, undoneSummary, UNDO_REASONS, type UndoOffer } from "../../view/undo.js";
import {
  abilityActionsFor,
  legalEntriesOf,
  type BasicAction,
  type Highlights,
  type UsableAbilityAction,
} from "../../view/highlights.js";
import { cardName, seatIdentityName } from "../../view/names.js";
import { thwartStatOptions, type ThwartStatOption } from "../../view/thwart-stat-choice.js";
import {
  allianceHelpersOf,
  beginPayment,
  cardTapOption,
  paymentView,
  setPaymentX,
  toggleCostReduction,
  togglePayment,
  type PaymentState,
  type PaymentView,
} from "../../view/payment-model.js";
import type { PaymentVerdict } from "../../view/payment-verdict.js";
import { targetingPanelOf, type TargetingPanel, type TargetingSource } from "../../view/targeting-panel.js";
import { hintsFor, type Hint, type HintTrigger } from "../../view/guide-hints.js";
import { guidePrefs } from "../../guide/guide-store.js";
import { GuideGateHolder, type GuideGate } from "./guide-gate.js";
import { BASIC_TO_KIND, basicKindOf, retarget, type Selection } from "./selection.js";
import {
  costPickSlot,
  needsPlayAim,
  paymentAimOf,
  playAimPrompt,
  searchedPickFor,
  type SearchedPickView,
} from "../../view/play-aim.js";
import { actionAbilityCost } from "../../view/cost-choice-model.js";
import { refusedAbilityLine } from "../../view/ability-refusal.js";
import {
  consentHelpersOf,
  costHelpPromptsFor,
  costPartDid,
  withCostHelpAnswers,
  withEntryPayers,
  type CostHelpPrompt,
} from "../../view/cost-help-model.js";
import {
  paymentIntoOf,
  playDestinationChoice,
  playInto,
  type PlayDestinationChoice,
  type PlayDestinationOption,
} from "../../view/play-destination.js";

const optionalSelection = (selection: CostSelection | undefined): { readonly costSelection?: CostSelection } =>
  selection ? { costSelection: selection } : {};

/** The scenario play area a hand play is aimed at (`playCard.into`), or undefined for the player's own area. */
const intoOf = (entry: LegalAction): string | undefined =>
  entry.example.type === "playCard" ? entry.example.into?.scenarioPlayArea : undefined;

/** What the controller reads from, and asks of, the scene that owns it. */
export interface BoardControllerHost {
  model(): BoardModel | null;
  marks(): Highlights | null;
  /** Whether the last draw laid the board out as phone tabs. */
  tabbed(): boolean;
  redraw(): void;
  inspect(id: InstanceId): void;
  /**
   * Asks "End your turn? You can still: …" (Settings ▸ "Confirm before ending turn",
   * `view/end-turn-confirm.ts`), and calls `onConfirm` only if the player says End turn.
   */
  /** `title` replaces "End your turn?" (the small-hand-size confirm asks "Are you sure?"). */
  confirmEndTurn(sentence: string, onConfirm: () => void, title?: string): void;
  /**
   * Guided mode's "Hold on!" safety net (`docs/guided-mode.md` §4 G9b, `scenes/hold-on.ts`): shown instead of
   * sending the command `hint` was raised against. Calls exactly one of `onSafe`/`onAnyway` if the player picks
   * that action, or neither on Escape/an outside click — the player just returns to their turn with nothing sent.
   */
  holdOn(hint: Hint, actions: { onSafe: () => void; onAnyway: () => void }): void;
  /** The Team-Up pairs whose ring is on the table now (each a stop at the end of the idle focus route), and what Enter on one does. */
  teamUpKeys?(): readonly string[];
  /** True when the card has a tile or chip on screen right now (it has a focus rect). */
  hasTile?(id: InstanceId): boolean;
  openTeamUp?(pairKey: string): void;
}

/** What the "Who attacks?" bar shows: every character that could make the power, in the engine's order. */
export interface SourceChoiceView {
  readonly power: PowerKind;
  readonly sources: readonly PowerSource[];
}

/** What the "Which form?" bar shows: Spectrum's energy/density/mass, Ant-Man/Wasp's Giant form (`view/change-form-choice.js`). */
export interface FormChoiceView {
  readonly sources: readonly FormSource[];
}

/** What the "Which ability?" bar shows: the usable Action abilities of the event being played, in the engine's order. */
export interface AbilityChoiceView {
  readonly subject: string;
  readonly options: readonly EventAbilityOption[];
}

/** What the "Thwart with?" bar shows: who is thwarting, and THW or ATK (The Red House; `view/thwart-stat-choice.ts`). */
export interface ThwartStatChoiceView {
  readonly subject: string;
  readonly options: readonly ThwartStatOption[];
}

/** What the "Where?" bar shows: each place the ally may be played, with what it costs there. */
export type DestinationChoiceView = PlayDestinationChoice;

/** What the "Play it / Decline" bar shows: the free card waiting on a yes. */
export interface PlayConfirmationView {
  readonly subject: string;
}

/**
 * What the alliance-help bar shows (docs/phase7-wave4.md §4 Q10): one helper, asked in turn, to approve the
 * cards of theirs the current payment would spend. `remaining`/`total` are the bar's own "1 of 2" counter.
 */
export interface AllianceHelpView {
  readonly playerId: PlayerId;
  readonly heroName: string;
  readonly cardNames: readonly string[];
  /** The parts of the cost this helper is asked to pay ("the damage"); empty when only cards are used. */
  readonly partNames: readonly string[];
  readonly remaining: number;
  readonly total: number;
}

/**
 * The engine's example `playCard`, sent to `controllerId` instead of whichever
 * seat the example picked. The payer's own seat is spelled as no controller,
 * the way `legalActions` builds it.
 */
function withController(command: Command, controllerId: PlayerId | null): Command {
  if (command.type !== "playCard" || controllerId === null) return command;
  const { controllerId: _example, ...rest } = command;
  return controllerId === command.playerId ? rest : { ...rest, controllerId };
}

/**
 * The targeting panel's source (docs/phase4-screen-gaps.md §3 "W5"): "Photon Blast — deal 5 damage to an enemy" for
 * an ability, or the same shape for a basic action — who's doing it, and its printed stat — plus the card the
 * tablet inspector rail (L06) shows beside the target list. `abilityLabelOf` already carries a card's own name plus
 * its printed cost/label (`view/ability-label.ts`); a basic action has no card of its own, so this reads the
 * attacker's or thwarter's printed ATK/THW off the same `characterPanel` the board's own panels read, and the rail
 * shows that character's own card instead of a card that doesn't exist.
 *
 * Every `ActionRef` kind `BoardController` ever opens target-select mode for — `basicAttack`, `basicThwart`,
 * `useAbility` — names an instance, so this never falls back to a sourceless label in practice; the fallback exists
 * only so this stays total over `ActionRef` without a runtime throw if that ever changes.
 */
function sourceOf(state: GameState, action: LegalAction): TargetingSource {
  const { action: ref } = action;
  if (ref.kind === "basicAttack") {
    return {
      label: `${cardName(state, ref.instanceId)} — Attack${statSuffix(state, ref.instanceId, "ATK")}`,
      name: cardName(state, ref.instanceId),
      instanceId: ref.instanceId,
    };
  }
  if (ref.kind === "basicThwart") {
    return {
      label: `${cardName(state, ref.instanceId)} — Thwart${thwartStat(state, action, ref.instanceId)}`,
      name: cardName(state, ref.instanceId),
      instanceId: ref.instanceId,
    };
  }
  if (ref.kind === "useAbility") {
    // An ability whose cost picks a card (Rogue's friend, the Setting for a Special cost) asks that pick by name.
    const picksForCost = costPickSlot(actionAbilityCost(state, POOL_DEPS, action.example.playerId, ref)) !== null;
    return {
      label: picksForCost
        ? playAimPrompt(state, POOL_DEPS, action)
        : abilityLabelOf(state, ref.instanceId, ref.abilityId, POOL_DEPS),
      name: cardName(state, ref.instanceId),
      instanceId: ref.instanceId,
    };
  }
  // A hand play asking which host or cost pick: the sheet names the card and what is being chosen ("Energy Transfer:
  // choose the character it attaches to"), not a bare "Choose a target" a player cannot tell from an attack's.
  const played = action.action;
  if (played.kind === "playCard") {
    return {
      label: playAimPrompt(state, POOL_DEPS, action),
      name: cardName(state, played.instanceId),
      instanceId: played.instanceId,
    };
  }
  const instanceId = "instanceId" in ref ? ref.instanceId : action.targets[0]!;
  return { label: "Choose a target", name: cardName(state, instanceId), instanceId };
}

function statSuffix(state: GameState, instanceId: InstanceId, label: "ATK" | "THW"): string {
  const value = characterPanel(state, instanceId, POOL_DEPS).stats.find((stat) => stat.label === label)?.value;
  return value && value !== "—" ? ` ${value}` : "";
}

/** " 2", or the assault wording (" 2 · ATK 3 vs assault") when the legal schemes include one with assault. */
function thwartStat(state: GameState, action: LegalAction, id: InstanceId): string {
  const suffix = assaultThwartSuffix(powerSources(state, [action], "thwart", POOL_DEPS)[0]!);
  return suffix === null ? statSuffix(state, id, "THW") : ` ${suffix}`;
}

/** One payment selection a verdict is for: these picks, by this payer, at this game version. */
interface PaymentKey {
  readonly payment: PaymentState;
  readonly playerId: PlayerId;
  readonly version: number;
  /** The state object too: a rewind and a new move can reach the same version with a different game. */
  readonly game: GameState | null;
}

const sameKey = (a: PaymentKey, b: PaymentKey): boolean =>
  a.payment === b.payment && a.playerId === b.playerId && a.version === b.version && a.game === b.game;

/** Two verdicts the bar draws alike: the same Pay readiness, reason and coverage. */
const sameReading = (a: PaymentVerdict, b: PaymentVerdict): boolean =>
  (a.command === null) === (b.command === null) && a.blockedBy === b.blockedBy && a.covered === b.covered;

/** How many verdicts Pay waits through (a reply for a version the game moved past asks again) before giving up. */
const JUDGE_RETRIES = 3;

/** How long a notice beside Undo stays, and the pause after an undo in which another is ignored. */
const UNDO_NOTICE_MS = 3500;
const UNDO_COOLDOWN_MS = 350;

export class BoardController {
  readonly #host: BoardControllerHost;
  #selection: Selection = { kind: "idle" };
  #undoHover = false;
  #undoFocus = false;
  #undoNotice: string | null = null;
  #undoNoticeTimer: ReturnType<typeof setTimeout> | null = null;
  /** True while an undo's rewind is in flight; `#undoSettledAt` is when the last one finished. */
  #undoing = false;
  #undoSettledAt = 0;
  /**
   * Set when the board is showing a replayed state rather than the live
   * session — the minimal safe seam S7 leaves for W4's "jump to a moment"
   * and W8's "watch the replay" (docs/phase4-screen-gaps.md §2), landed ahead
   * of either because wiring a replayed `GameState` through the rest of the
   * board (which reads the live session via `appSession()` in a dozen more
   * places — `hand.ts`, `action-bar.ts`, `motion.ts`, this file) turned out to
   * be a scene-sized job, not a seam; see the doc for what's still open.
   *
   * Every method here that would enter a target/payment/discard/controller-
   * choice mode, or dispatch a command, becomes a no-op while this is set —
   * regardless of what the live session's own `legalActions` say — so a
   * replay screen built on this controller can never act on, or even *look
   * like it could act on*, the game actually being played. `#dispatch` is
   * also guarded on its own, as the one choke point every mutating path
   * already funnels through, so the guarantee holds even if a future caller
   * reaches one of the other guards incorrectly.
   */
  #readOnly: boolean;
  /** The active lesson step's soft gate (§3.10, `guide-gate.ts`), or nothing outside one — see that module's own
   * doc comment, including the "two inert clicks lift it" and Escape-release behavior. Set by G5c's guide
   * controller; every input entry point below checks it the same way it already checks `#readOnly`. */
  readonly #guideGate = new GuideGateHolder();
  /**
   * The engine's verdict on the open payment's picks (issue #258), for one selection: the `PaymentState` (a new object
   * on every pick), the payer and the game version. The worker host judges it off the main thread; until it lands the
   * bar shows the picks and Pay waits for it.
   */
  #verdict: (PaymentKey & { readonly verdict: PaymentVerdict }) | null = null;
  /** The verdict being judged, if any: a newer selection replaces it, and a superseded reply is dropped. */
  #judging: (PaymentKey & { readonly done: Promise<void> }) | null = null;
  /** The last verdict drawn for this payment (same `action` object): the bar keeps it while the next is judged. */
  #shown: { readonly action: PaymentState["action"]; readonly verdict: PaymentVerdict } | null = null;
  /** Pay was pressed and is waiting for its verdict. */
  #committing = false;

  constructor(host: BoardControllerHost, options: { readonly readOnly?: boolean } = {}) {
    this.#host = host;
    this.#readOnly = options.readOnly ?? false;
  }

  get selection(): Selection {
    return this.#selection;
  }

  get readOnly(): boolean {
    return this.#readOnly;
  }

  /** Sets (or clears, with `null`) the current lesson step's soft input gate — "Stop tutorial" calls this with
   * `null` directly. A no-op redraw isn't needed here — the gate only changes what a *future* tap does, never what
   * is currently drawn. */
  setGuideGate(gate: GuideGate | null): void {
    this.#guideGate.set(gate);
  }

  /** Escape's own release (§3.10, owner: "no one should ever feel locked into a tutorial"): lifts the active gate
   * immediately and fires its `onGateReleased`. Returns whether a gate was actually open, so `board.ts`'s own
   * Escape handling knows whether to fall through to its usual cancel/Pause behavior. */
  releaseGuideGate(): boolean {
    return this.#guideGate.release();
  }

  /** Flips read-only mode. A scene switching between a live board and a replayed one calls this rather than rebuilding the controller. */
  setReadOnly(readOnly: boolean): void {
    if (this.#readOnly === readOnly) return;
    this.#readOnly = readOnly;
    this.#selection = { kind: "idle" };
    this.#host.redraw();
  }

  /**
   * Drops any half-made selection without redrawing. For a new state, which
   * redraws anyway: the engine may have changed what is legal, and a stale
   * target would just be rejected.
   */
  reset(): void {
    this.#selection = { kind: "idle" };
  }

  /** Backs out of whatever mode is open, and redraws. */
  cancel(): void {
    this.#selection = { kind: "idle" };
    this.#host.redraw();
  }

  /** The focus route for whatever the board is currently asking for. */
  focusOrder(): readonly FocusTarget[] {
    const model = this.#host.model();
    if (!model) return [];
    const marks = this.#host.marks();
    if (this.#selection.kind === "targeting") {
      return focusOrder({ kind: "targeting", targets: this.#selection.action.targets }, marks);
    }
    if (this.#selection.kind === "paying") {
      return focusOrder(
        {
          kind: "paying",
          sources: this.#selection.payment.query.sources.map((source) => source.instanceId),
          ...(this.#selection.payment.xRange ? { x: true as const } : {}),
        },
        marks,
      );
    }
    if (this.#selection.kind === "choosingDiscard") {
      // Same route shape as "paying": only the candidates are worth stepping through.
      return focusOrder({ kind: "paying", sources: this.#selection.choice.candidates }, marks);
    }
    if (this.#selection.kind === "choosingSource") {
      return focusOrder({ kind: "targeting", targets: this.#selection.sources.map((s) => s.instanceId) }, marks);
    }
    if (this.#selection.kind === "choosingThwartStat") {
      return focusOrder({ kind: "targeting", targets: [this.#selection.schemeId] }, marks);
    }
    if (this.#selection.kind === "choosingInPlayCost") {
      return focusOrder({ kind: "targeting", targets: offeredNow(this.#selection.choice), confirm: true }, marks);
    }
    if (this.#selection.kind === "dividingPower") {
      return focusOrder({ kind: "targeting", targets: this.#selection.choice.action.targets, confirm: true }, marks);
    }
    if (this.#selection.kind === "choosingController") {
      return focusOrder({ kind: "targeting", targets: this.#seatTiles(this.#selection.controllers) }, marks);
    }
    if (
      this.#selection.kind === "choosingAbility" ||
      this.#selection.kind === "choosingDestination" ||
      this.#selection.kind === "choosingSearched"
    ) {
      const { action } = this.#selection.entry;
      return focusOrder({ kind: "targeting", targets: action.kind === "playCard" ? [action.instanceId] : [] }, marks);
    }
    if (this.#selection.kind === "confirmingPlay") {
      // The card itself (Enter on it is "Play it") and the way out, the same two stops targeting offers.
      const { action } = this.#selection.action;
      return focusOrder({ kind: "targeting", targets: action.kind === "playCard" ? [action.instanceId] : [] }, marks);
    }
    return focusOrder(
      {
        kind: "idle",
        hand: model.hand.map((card) => card.instanceId),
        teamUps: this.#host.teamUpKeys?.() ?? [],
        undo: this.undoOffer() !== null,
        ...(this.#host.hasTile ? { tiled: (id: InstanceId) => this.#host.hasTile!(id) } : {}),
      },
      marks,
    );
  }

  /**
   * The targeting panel (docs/phase4-screen-gaps.md §3 "W5"): each legal target's outcome and why every other card
   * in play isn't one, or null outside target-select mode. Built fresh on every call rather than cached on the
   * selection, since a preview must always reflect the state as it is right now (`preview()`'s own doc comment) —
   * cheap enough to do so, at well under a millisecond per candidate target.
   */
  targetingPanel(): TargetingPanel | null {
    const { game, perspectiveId } = appSession().store.state;
    if (!game) return null;
    // Two questions that are answered with tiles but not with a target: which cards pay a cost with a range, and whose
    // play area a card goes to. Same panel, so they read and work the same on every layout.
    if (this.#selection.kind === "choosingInPlayCost") {
      return inPlayCostPanelOf(game, POOL_DEPS, inPlayCostChoiceView(game, POOL_DEPS, this.#selection.choice));
    }
    if (this.#selection.kind === "dividingPower") {
      const { choice } = this.#selection;
      return dividePanelOf(game, POOL_DEPS, choice, sourceOf(game, choice.action));
    }
    if (this.#selection.kind === "choosingController") {
      const { action, controllers } = this.#selection;
      return seatPanelOf(game, action, seatOptionsOf(game, controllers, perspectiveId));
    }
    if (this.#selection.kind !== "targeting") return null;
    const { action } = this.#selection;
    return targetingPanelOf(
      game,
      action,
      sourceOf(game, action),
      (target) => retarget(game, action.example, target),
      POOL_DEPS,
    );
  }

  /** Acts on the focused target, meaning whatever a tap or a press on it would mean right now. */
  activate(focus: FocusTarget): void {
    // Reading what a Team-Up gives the table sends nothing, so it works on a replayed board too.
    if (focus.kind === "teamUp") {
      this.#host.openTeamUp?.(focus.pairKey);
      return;
    }
    if (this.#readOnly) return;
    // The targeting panel's own "Cancel · Esc" control, reached by tab as well as by Escape.
    if (focus.kind === "cancel") {
      this.cancel();
      return;
    }
    if (focus.kind === "confirm") {
      void this.confirmPick();
      return;
    }
    if (focus.kind === "xLess" || focus.kind === "xMore") {
      this.stepX(focus.kind === "xMore" ? 1 : -1);
      return;
    }
    if (focus.kind === "undo") {
      void this.undo();
      return;
    }
    if (focus.kind === "basic") {
      if (!this.#guideGate.allowsAction(focus.action)) {
        this.#guideGate.noteInertClick();
        return;
      }
      if (focus.action === "endTurn") void this.dispatchExample("endTurn");
      else this.chooseBasic(focus.action);
      return;
    }
    if (focus.kind === "card" && !this.#guideGate.allowsCard(focus.instanceId)) {
      this.#guideGate.noteInertClick();
      return;
    }
    // Enter on the card a free play is asking about is the keyboard's "Play it": the bar's buttons are not on the
    // focus route, and the route's other stop is the way out. A *tap* on the card deselects it (`tapInMode`).
    if (this.#selection.kind === "confirmingPlay") {
      const { action } = this.#selection.action;
      if (action.kind === "playCard" && action.instanceId === focus.instanceId) void this.confirmPlay();
      return;
    }
    if (this.tapInMode(focus.instanceId)) return;
    // A card in play with a usable ability, not a hand card: `playCard` only
    // ever looks for a `playCard` entry, so a card that's on the focus route
    // solely because of `usableAbilities` opens the card, whose sheet offers the ability.
    if (this.#host.marks()?.usableAbilities.has(focus.instanceId)) this.onCharacterTap(focus.instanceId);
    else void this.playCard(focus.instanceId, { confirmFree: true });
  }

  /**
   * A tap on a card while a mode is open answers that mode: it spends the card
   * during payment, or aims at it during targeting. Returns false when idle, so
   * the card's own tap behavior can run instead.
   */
  tapInMode(id: InstanceId): boolean {
    if (this.#readOnly) return false;
    // Gated the same way any other card tap is: a mode already open still only answers with an allowed card —
    // reported as "handled" (true) rather than falling through to `onTap`, so a gated card outside the mode's own
    // targets doesn't also try to play itself. Idle falls through to `onTap` (`tapHandCard`/`onCharacterTap`),
    // which gate — and count the inert click — on their own, so this doesn't double-count that tap.
    if (!this.#guideGate.allowsCard(id)) {
      if (this.#selection.kind === "idle") return false;
      this.#guideGate.noteInertClick();
      return true;
    }
    if (this.#selection.kind === "paying") {
      this.#spendByInstance(id);
      return true;
    }
    if (this.#selection.kind === "choosingDiscard") {
      this.toggleDiscardPick(id);
      return true;
    }
    if (this.#selection.kind === "targeting") {
      void this.#commitTarget(id);
      return true;
    }
    if (this.#selection.kind === "choosingInPlayCost") {
      this.toggleInPlayPick(id);
      return true;
    }
    if (this.#selection.kind === "dividingPower") {
      this.tapDivideTarget(id);
      return true;
    }
    if (this.#selection.kind === "choosingController") {
      // A seat's tile is its identity card; picking it is the seat's answer.
      const seat = this.#selection.controllers.find((playerId) => this.#identityOf(playerId) === id);
      if (seat) void this.chooseController(seat);
      return true;
    }
    if (this.#selection.kind === "choosingSource") {
      // Tapping one of the offered characters on the table picks it, the same as its button in the bar.
      this.chooseSource(id);
      return true;
    }
    if (this.#selection.kind === "choosingThwartStat") {
      // A second tap on the scheme puts the thwart back; the bar's buttons are the only way to answer.
      if (this.#selection.schemeId === id) this.cancel();
      return true;
    }
    if (
      this.#selection.kind === "choosingAbility" ||
      this.#selection.kind === "choosingDestination" ||
      this.#selection.kind === "choosingSearched"
    ) {
      // The card being asked about goes back on a second tap; the bar's buttons are the only way to answer.
      const { action } = this.#selection.entry;
      if (action.kind === "playCard" && action.instanceId === id) this.cancel();
      return true;
    }
    if (this.#selection.kind === "confirmingPlay") {
      // A second tap on the card being asked about puts it back — a tap selects, a tap deselects, and only the
      // bar's own "Play it" plays. A tap anywhere else changes nothing.
      const { action } = this.#selection.action;
      if (action.kind === "playCard" && action.instanceId === id) this.cancel();
      return true;
    }
    return false;
  }

  /**
   * Enters target-select mode, or dispatches immediately when the action needs
   * no target. The engine decided both: `targets` came from `legalActions`.
   */
  chooseBasic(action: BasicAction): void {
    if (this.#readOnly) return;
    if (!this.#guideGate.allowsAction(action)) {
      this.#guideGate.noteInertClick();
      return;
    }
    if (action === "attack" || action === "thwart") {
      // More than one character could go — the hero and an ally, say — so who goes (and so in what order their
      // effects land) is the player's pick, not whichever the engine happened to list first.
      const sources = this.powerSourcesFor(action);
      if (sources.length > 1) {
        this.#selection = { kind: "choosingSource", power: action, sources };
        this.#host.redraw();
        return;
      }
    }
    if (action === "changeForm") {
      // A three-or-more-sided identity (Spectrum's energy/density/mass forms, Ant-Man/Wasp's Giant form) offers a
      // distinct `changeForm` entry per destination — which one is the player's call (`view/change-form-choice.ts`).
      const sources = this.formSourcesFor();
      if (needsFormChoice(sources.map((source) => source.entry))) {
        this.#selection = { kind: "choosingForm", sources };
        this.#host.redraw();
        return;
      }
      const entry = this.#legalFor(action);
      if (!entry) return;
      this.#flipEntry(entry, false);
      return;
    }
    const entry = this.#legalFor(action);
    if (!entry) return;
    this.#aim(entry, action);
  }

  /**
   * Flip's own hint check (`docs/guided-mode.md` §4 G9b) before actually aiming — shared by `chooseBasic`'s
   * two-sided fast path and `chooseForm`'s "Which form?" bar answer. `bypassHint` is set only by a hint's own
   * safe action (`#flipSafely`), which has already had this conversation and would otherwise re-trigger itself.
   */
  #flipEntry(entry: LegalAction, bypassHint: boolean): void {
    if (bypassHint) {
      this.#aim(entry, "changeForm");
      return;
    }
    const trigger: HintTrigger = { kind: "flip" };
    const hint = this.#hintsFor(trigger)[0];
    if (hint) {
      this.#host.holdOn(hint, {
        onSafe: () => this.#runHintSafe(hint, trigger),
        onAnyway: () => this.#aim(entry, "changeForm"),
      });
      return;
    }
    this.#aim(entry, "changeForm");
  }

  /** A hint's own "Flip to alter-ego"/flip-back-to-hero safe action: the same flip path, with no further hint
   * check (`#flipEntry`'s own doc comment). */
  #flipSafely(): void {
    const sources = this.formSourcesFor();
    if (needsFormChoice(sources.map((source) => source.entry))) {
      this.#selection = { kind: "choosingForm", sources };
      this.#host.redraw();
      return;
    }
    const entry = this.#legalFor("changeForm");
    if (!entry) return;
    this.#flipEntry(entry, true);
  }

  /** The "Who attacks?" bar's answer (or a tap on that character): that character's attack, aimed next. */
  chooseSource(id: InstanceId): void {
    if (this.#readOnly || this.#selection.kind !== "choosingSource") return;
    const source = this.#selection.sources.find((candidate) => candidate.instanceId === id);
    if (!source) return;
    this.#selection = { kind: "idle" };
    this.#aim(source.entry, basicKindOf(source.entry));
  }

  /** The "Which form?" bar's answer: that destination form's `changeForm`, dispatched straight away (it needs no target). */
  chooseForm(source: FormSource): void {
    if (this.#readOnly || this.#selection.kind !== "choosingForm") return;
    this.#selection = { kind: "idle" };
    this.#flipEntry(source.entry, false);
  }

  /** The characters the "Who attacks?" bar offers, or null when it isn't open. */
  sourceChoice(): SourceChoiceView | null {
    if (this.#selection.kind !== "choosingSource") return null;
    return { power: this.#selection.power, sources: this.#selection.sources };
  }

  /** The forms the "Which form?" bar offers, or null when it isn't open. */
  formChoice(): FormChoiceView | null {
    return this.#selection.kind === "choosingForm" ? { sources: this.#selection.sources } : null;
  }

  /** Every character that could make this basic power right now, with what going costs it. */
  powerSourcesFor(power: PowerKind): readonly PowerSource[] {
    const { game, legal } = appSession().store.state;
    if (!game) return [];
    return powerSources(game, powerEntries(legal?.actions, power), power, POOL_DEPS);
  }

  /** Every legal `changeForm` destination right now, labeled. */
  formSourcesFor(): readonly FormSource[] {
    const { game, legal } = appSession().store.state;
    if (!game) return [];
    return formSources(game, formEntries(legal?.actions), POOL_DEPS);
  }

  /**
   * Dispatches a basic action straight away when it needs no target or has only one, and otherwise enters
   * target-select mode. The prompt names who is acting, since with allies in play "attack" alone doesn't say.
   */
  #aim(entry: LegalAction, action: BasicAction | null): void {
    if (entry.targets.length <= 1) {
      // A change of form with an additional cost (`RuleSpec formChangeCost`, wave 8 §3.63) owes the player the payment
      // decision like any costed action; `entry.example` is only the engine's proof that some payment works.
      if (action === "changeForm" && entry.needsPayment && this.#openPayment(entry, null)) return;
      // The one scheme to thwart may still let the thwart use ATK (The Red House; issue #365): that is a decision.
      const only = entry.targets[0];
      const { game } = appSession().store.state;
      const stats = game && only !== undefined ? thwartStatOptions(game, POOL_DEPS, entry, only) : [];
      if (only !== undefined && stats.length > 1) {
        this.#selection = { kind: "choosingThwartStat", action: entry, schemeId: only, options: stats };
        this.#host.redraw();
        return;
      }
      // A basic power whose own cost discards from hand (Wonder Man, `03014`): which card is the player's choice.
      if (this.#tryOpenDiscardChoice(entry)) return;
      // No target, or one legal target: not a decision; aim and go.
      void this.#dispatch(entry.example);
      return;
    }
    const { game, perspectiveId } = appSession().store.state;
    // A basic power its character may divide (Wasp's Giant face; issue #322): the player places it point by point. A
    // power with a hand discard to choose keeps the one-target flow, which asks for the discard.
    const divide = game ? beginDividePower(game, POOL_DEPS, entry) : null;
    if (game && divide && (perspectiveId === null || !beginDiscardChoice(game, perspectiveId, entry, POOL_DEPS))) {
      this.#selection = { kind: "dividingPower", choice: divide };
      this.#host.redraw();
      return;
    }
    const ref = entry.action;
    const who = game && "instanceId" in ref ? cardName(game, ref.instanceId) : null;
    const prompt = who && action ? `Choose a target for ${who}'s ${action}` : `Choose a target to ${action ?? "act"}`;
    this.#selection = { kind: "targeting", action: entry, prompt };
    this.#host.redraw();
  }

  async #commitTarget(id: InstanceId): Promise<void> {
    if (this.#selection.kind !== "targeting") return;
    const { action, playAs } = this.#selection;
    if (!action.targets.includes(id)) return;
    this.#selection = { kind: "idle" };
    // A hand play that asked which host or cost pick carries on as any play does: its own cost choice, payment, dispatch.
    if (playAs) {
      await this.#playAs(action, playAs.controllerId, false, id);
      return;
    }
    const { game } = appSession().store.state;
    // A scheme that lets the thwart use ATK instead of THW (The Red House; issue #365) asks which, before any cost.
    const stats = game ? thwartStatOptions(game, POOL_DEPS, action, id) : [];
    if (stats.length > 1) {
      this.#selection = { kind: "choosingThwartStat", action, schemeId: id, options: stats };
      this.#host.redraw();
      return;
    }
    await this.#commitAimed(action, id);
  }

  /** The "Thwart with?" bar's answer: the thwart goes on at its scheme with that stat. */
  async chooseThwartStat(useAtk: boolean): Promise<void> {
    if (this.#readOnly || this.#selection.kind !== "choosingThwartStat") return;
    const { action, schemeId, options } = this.#selection;
    if (!options.some((option) => option.useAtk === useAtk)) return;
    this.#selection = { kind: "idle" };
    const { example } = action;
    if (!useAtk || example.type !== "basicThwart") {
      await this.#commitAimed(action, schemeId);
      return;
    }
    await this.#commitAimed({ ...action, example: { ...example, useAtk: true } }, schemeId, true);
  }

  /** The stats the "Thwart with?" bar offers, or null when it isn't open. */
  thwartStatChoice(): ThwartStatChoiceView | null {
    if (this.#selection.kind !== "choosingThwartStat") return null;
    const { game } = appSession().store.state;
    const { action, options } = this.#selection;
    if (!game || action.action.kind !== "basicThwart") return null;
    return { subject: cardName(game, action.action.instanceId), options };
  }

  /** An aimed action from here on: its discard choice, its payment, or straight to the engine. */
  async #commitAimed(action: LegalAction, id: InstanceId, useAtk = false): Promise<void> {
    const { game } = appSession().store.state;
    // A basic power whose own cost discards from hand (Wonder Man, `03014`) asks which card, aimed at this target.
    if (
      game &&
      (action.action.kind === "basicAttack" || action.action.kind === "basicThwart") &&
      this.#tryOpenDiscardChoice({ ...action, example: retarget(game, action.example, id) })
    ) {
      return;
    }
    // An aimed action that also costs something still owes the player the
    // payment decision; only a free one goes straight to the engine.
    if (action.needsPayment && this.#openPayment(action, id)) {
      // The payment builds its command from the action and target alone, so the stat rides on the payment itself.
      if (useAtk && this.#selection.kind === "paying") {
        this.#selection = { kind: "paying", payment: { ...this.#selection.payment, useAtk: true } };
      }
      return;
    }
    await this.#send(game ? retarget(game, action.example, id) : action.example);
  }

  /**
   * What tapping a hand card does.
   *
   * On a tall layout the hand is a row of thumbnails a centimetre wide — too
   * small to read, and far too small to commit a turn on. So a tap there opens
   * the card first and the sheet offers to play it, which is the second step
   * the phone needs and the desktop does not: at desk widths the card is
   * already legible, and a hold still opens the sheet.
   */
  tapHandCard(instanceId: InstanceId): void {
    // Read-only: a tap can still open the card to read it, same as the
    // tabbed layout's own idle behavior below, but never offers to play it.
    if (this.#readOnly || (this.#host.tabbed() && this.#selection.kind === "idle")) {
      this.#host.inspect(instanceId);
      return;
    }
    void this.playCard(instanceId, { confirmFree: true });
  }

  /**
   * Plays a hand card. A card that costs something opens the payment mode
   * rather than spending whatever the engine found first: what you spend is a
   * real decision, and the engine's `example` payment is only a proof that
   * *some* payment works.
   *
   * `confirmFree`: the gesture was a bare tap (or Enter) on the card, so a card with nothing to pay and nothing
   * else to decide asks "Play it / Decline" first rather than resolving under the player's thumb. Inspect's own
   * "Play it" button is already an explicit yes and passes nothing.
   */
  async playCard(instanceId: InstanceId, options: { readonly confirmFree?: boolean } = {}): Promise<void> {
    if (this.#readOnly) return;
    if (!this.#guideGate.allowsCard(instanceId)) {
      this.#guideGate.noteInertClick();
      return;
    }
    const entry = this.#host.marks()?.playable.has(instanceId)
      ? this.#legalEntries().find(
          (candidate) => candidate.action.kind === "playCard" && candidate.action.instanceId === instanceId,
        )
      : undefined;
    if (!entry) return;
    // An event with several usable Action abilities: which one is asked first, before any payment (RRG "Event", p. 18).
    const choice = this.#abilityOptionsFor(entry);
    if (choice.length > 1) {
      this.#selection = { kind: "choosingAbility", entry, options: choice };
      this.#host.redraw();
      return;
    }
    await this.#playEntry(entry, options.confirmFree ?? false);
  }

  #abilityOptionsFor(entry: LegalAction): readonly EventAbilityOption[] {
    const { game } = appSession().store.state;
    return game && needsEventAbilityChoice(entry) ? eventAbilityOptions(game, entry, POOL_DEPS) : [];
  }

  /** The "Which ability?" bar's answer: the play goes on with that ability's own cost, targets and seat. */
  async chooseEventAbility(abilityId: AbilityId): Promise<void> {
    if (this.#readOnly || this.#selection.kind !== "choosingAbility") return;
    const { entry, options } = this.#selection;
    const option = options.find((candidate) => candidate.abilityId === abilityId);
    const { game } = appSession().store.state;
    if (!option || !game || option.command.type !== "playCard") return;
    this.#selection = { kind: "idle" };
    // Each ability has its own price: ask the engine what this one costs rather than reusing the first one's.
    const needsPayment = paymentFor(game, option.command.playerId, entry.action, { abilityId }, POOL_DEPS) !== null;
    await this.#playEntry({ ...entry, example: option.command, needsPayment, abilities: [abilityId] }, false);
  }

  /** The abilities the "Which ability?" bar offers, or null when it isn't open. */
  abilityChoice(): AbilityChoiceView | null {
    if (this.#selection.kind !== "choosingAbility") return null;
    const { game } = appSession().store.state;
    const { action } = this.#selection.entry;
    if (!game || action.kind !== "playCard") return null;
    return { subject: cardName(game, action.instanceId), options: this.#selection.options };
  }

  /** The searched-minion list: the card being played and each minion the search found, with its area, or null. */
  searchedPick(): SearchedPickView | null {
    return this.#selection.kind === "choosingSearched" ? this.#selection.pick : null;
  }

  /** The list's answer: the play goes on with that minion in the cost's slot, as a board pick would. */
  async chooseSearched(instanceId: InstanceId): Promise<void> {
    if (this.#readOnly || this.#selection.kind !== "choosingSearched") return;
    const { entry, pick, controllerId, confirmFree } = this.#selection;
    if (!pick.options.some((option) => option.instanceId === instanceId)) return;
    this.#selection = { kind: "idle" };
    await this.#playAs(entry, controllerId, confirmFree, instanceId);
  }

  /** The "Where?" bar: the ally being played and each place it may go, with its price there, or null when not open. */
  destinationChoice(): DestinationChoiceView | null {
    return this.#selection.kind === "choosingDestination" ? this.#selection.choice : null;
  }

  /** The "Where?" bar's answer: the play goes on aimed at that area, and priced there. */
  async chooseDestination(option: PlayDestinationOption): Promise<void> {
    if (this.#readOnly || this.#selection.kind !== "choosingDestination") return;
    const { entry, choice, target, controllerId, confirmFree } = this.#selection;
    if (!choice.options.some((candidate) => candidate.into === option.into)) return;
    this.#selection = { kind: "idle" };
    await this.#playAs(
      { ...entry, example: playInto(entry.example, option.into) },
      controllerId,
      confirmFree,
      target,
      true,
    );
  }

  async #playEntry(entry: LegalAction, confirmFree: boolean): Promise<void> {
    if (this.#tryOpenCostHelp(entry, { play: { confirmFree } })) return;
    // "Discard X cards from your hand" (Shield Toss, `03006`) is a real
    // decision the engine's `example` only guessed the minimum answer to —
    // see `#tryOpenDiscardChoice`. Checked before the controller picker below
    // since a card could in principle need both; nothing in the pool does yet.
    if (this.#tryOpenDiscardChoice(entry)) return;
    // "Play under any player's control" makes whose card it becomes a real
    // decision, and the engine's `example` had quietly made it for the player
    // (the first seat that could take it). So a choice of seats opens the picker.
    if (entry.controllers && entry.controllers.length > 1) {
      this.#selection = { kind: "choosingController", action: entry, controllers: entry.controllers };
      this.#host.redraw();
      return;
    }
    await this.#playAs(entry, entry.controllers?.[0] ?? null, confirmFree);
  }

  /** "Play it": the free card the board was asking about. */
  async confirmPlay(): Promise<void> {
    if (this.#readOnly || this.#selection.kind !== "confirmingPlay") return;
    const { action, controllerId } = this.#selection;
    this.#selection = { kind: "idle" };
    await this.#dispatch(withController(action.example, controllerId));
  }

  /** The card a free play is waiting on a yes for, or null when nothing is. */
  playConfirmation(): PlayConfirmationView | null {
    if (this.#selection.kind !== "confirmingPlay") return null;
    const { game } = appSession().store.state;
    if (!game) return null;
    const { action } = this.#selection.action;
    return { subject: action.kind === "playCard" ? cardName(game, action.instanceId) : "This card" };
  }

  /** The controller picker's answer: play the card under that seat's control. */
  async chooseController(controllerId: PlayerId): Promise<void> {
    if (this.#readOnly) return;
    if (this.#selection.kind !== "choosingController") return;
    const { action } = this.#selection;
    if (!action.controllers?.includes(controllerId)) return;
    this.#selection = { kind: "idle" };
    await this.#playAs(action, controllerId);
  }

  /** A seat's identity card: the tile that stands for it in the "whose play area?" panel. */
  #identityOf(playerId: PlayerId): InstanceId | null {
    const { game } = appSession().store.state;
    return game?.players.find((seat) => seat.playerId === playerId)?.identity.instanceId ?? null;
  }

  #seatTiles(controllers: readonly PlayerId[]): readonly InstanceId[] {
    const { game, perspectiveId } = appSession().store.state;
    return game ? seatOptionsOf(game, controllers, perspectiveId).map((seat) => seat.identityId) : [];
  }

  /**
   * `target` is the host or cost pick the player made, or null when there was nothing to pick. Several picks the
   * engine lists (an attach cost's hosts, an upgrade's hosts, a hand card a cost chooses) are asked first, as a target
   * pick on the board, never answered by whichever variant `example` happens to be.
   */
  async #playAs(
    entry: LegalAction,
    controllerId: PlayerId | null,
    confirmFree = false,
    target: InstanceId | null = null,
    destinationAsked = false,
  ): Promise<void> {
    const { game } = appSession().store.state;
    if (target === null && needsPlayAim(entry) && game) {
      // A search cost (Hunted): its candidates are in the encounter deck, not on the board, so a list asks.
      const pick = searchedPickFor(game, POOL_DEPS, entry);
      if (pick) {
        this.#selection = { kind: "choosingSearched", entry, pick, controllerId, confirmFree };
        this.#host.redraw();
        return;
      }
      this.#selection = {
        kind: "targeting",
        action: entry,
        prompt: playAimPrompt(game, POOL_DEPS, entry),
        playAs: { controllerId },
      };
      this.#host.redraw();
      return;
    }
    // An ally that may go to the mission area as well as the player's own is asked where, before it is priced: a
    // reduction can read the destination (`view/play-destination.ts`). The engine lists the areas; nothing is guessed.
    let destinationNote: string | null = null;
    if (!destinationAsked && game) {
      const choice = playDestinationChoice(game, POOL_DEPS, entry);
      if (choice?.needsChoice) {
        this.#selection = { kind: "choosingDestination", entry, choice, target, controllerId, confirmFree };
        this.#host.redraw();
        return;
      }
      // Payable only at the mission: no question, the entry already names that area, and the price says why.
      destinationNote = choice?.note ?? null;
    }
    if (this.#tryOpenCostChoice(entry, target, controllerId)) return;
    if (this.#tryOpenInPlayCost(entry, target, controllerId)) return;
    // A pick for a cost that searches the encounter deck (Hunted) is a cost choice, not a host (`view/play-aim.ts`).
    const aim = game ? paymentAimOf(game, POOL_DEPS, entry.action, target) : { target };
    if (
      entry.needsPayment &&
      this.#openPayment(entry, aim.target, controllerId, undefined, aim.costChoices, destinationNote)
    ) {
      return;
    }
    if (confirmFree) {
      this.#selection = { kind: "confirmingPlay", action: entry, controllerId };
      this.#host.redraw();
      return;
    }
    const aimed = target !== null && game ? retarget(game, entry.example, target) : entry.example;
    await this.#send(withController(aimed, controllerId));
  }

  /** Every `useAbility` entry `legalActions` currently lists for one card, in order. */
  usableAbilitiesFor(instanceId: InstanceId): readonly UsableAbilityAction[] {
    const actions = appSession().store.state.legal?.actions;
    return actions ? abilityActionsFor(actions, instanceId) : [];
  }

  /**
   * A tap on a card in play, while idle: opens it in Inspect, and never uses it. A tap used to fire a card's one
   * usable ability on the spot, and since most of those cost "exhaust this card", a stray tap on the hero or an
   * ally exhausted it with no way back — reported from play, more than once. Inspect shows the card's full text
   * and one button per usable ability (`inspectModel.abilities`, `scenes/inspect.ts`), so using one is a
   * deliberate second tap on a button that names it, the same two steps a free hand card already takes.
   */
  onCharacterTap(instanceId: InstanceId): void {
    this.#host.inspect(instanceId);
  }

  /** The Inspect sheet's ability picker reports its pick here; it never dispatches itself. */
  useAbilityById(instanceId: InstanceId, abilityId: AbilityId): void {
    if (this.#readOnly) return;
    const entry = this.usableAbilitiesFor(instanceId).find((candidate) => candidate.action.abilityId === abilityId);
    if (entry) this.#useAbility(entry);
  }

  /**
   * Triggers one action ability, the same three-step machinery `chooseBasic`
   * / `#commitTarget` already use for basic actions: enter target-select mode
   * when the engine lists more than one legal target, open payment when the
   * engine says it costs something, otherwise dispatch its `example` command
   * straight away. Nothing here decides a target, a price, or legality —
   * `legalActions` and `paymentFor` already did.
   */
  #useAbility(entry: UsableAbilityAction): void {
    if (this.#tryOpenCostHelp(entry, "ability")) return;
    if (this.#tryOpenDiscardChoice(entry)) return;
    if (entry.targets.length > 1) {
      const { game } = appSession().store.state;
      const name = game
        ? abilityLabelOf(game, entry.action.instanceId, entry.action.abilityId, POOL_DEPS)
        : "this ability";
      const picksForCost =
        game !== null &&
        costPickSlot(actionAbilityCost(game, POOL_DEPS, entry.example.playerId, entry.action)) !== null;
      this.#selection = {
        kind: "targeting",
        action: entry,
        prompt: game && picksForCost ? playAimPrompt(game, POOL_DEPS, entry) : `Choose a target for ${name}`,
      };
      this.#host.redraw();
      return;
    }
    const target = entry.targets[0] ?? null;
    if (this.#tryOpenCostChoice(entry, target, null)) return;
    if (this.#tryOpenInPlayCost(entry, target, null)) return;
    if (entry.needsPayment && this.#openPayment(entry, target)) return;
    void this.#send(entry.example);
  }

  /**
   * The small "you can do something here" line on a card in play — the one
   * control PLAN.md's Phase 4 open item said the board was missing entirely.
   * Reuses `signal.heal`, the token the palette already spends on "this is a
   * good, legal state" (recover, HP gain, deck-legal), rather than inventing
   * a new one; the leading glyph keeps the affordance readable without color
   * (PLAN.md Phase 4 accessibility, "never color alone"). Hidden mid-decision
   * — while targeting or paying for a *different* action, tapping this card
   * would be intercepted for that instead, and a line promising otherwise
   * would be wrong.
   */
  abilityLine(instanceId: InstanceId): string | null {
    if (this.#readOnly) return null;
    if (this.#selection.kind !== "idle" || !this.#host.marks()?.usableAbilities.has(instanceId)) return null;
    const { game } = appSession().store.state;
    if (!game) return null;
    const abilities = this.usableAbilitiesFor(instanceId);
    if (abilities.length === 0) return null;
    // The card's own name is already on the card, so the line carries the cost —
    // see `abilityShortLabelOf`. "Use" is the fallback for an ability the engine
    // prices at nothing, which is still worth a tap target.
    const text =
      abilities.length === 1
        ? (abilityShortLabelOf(game, instanceId, abilities[0]!.action.abilityId, POOL_DEPS) ?? "use")
        : `${abilities.length} abilities — tap to see`;
    return `▶ ${text}`;
  }

  /**
   * Why an ability on this card cannot be used right now, one line each, for the abilities the engine refused because a
   * printed condition is unmet (New Labors of Hercules with a Labor card in play). The card's own strips carry them.
   */
  refusedAbilityLines(instanceId: InstanceId): readonly string[] {
    if (this.#readOnly) return [];
    const ids = this.#host.marks()?.refusedAbilities?.get(instanceId);
    const { game, perspectiveId } = appSession().store.state;
    if (!ids || !game || perspectiveId === null) return [];
    return ids.map((id) => refusedAbilityLine(game, instanceId, perspectiveId, id, POOL_DEPS, ids.length > 1));
  }

  /**
   * Enters discard-choice mode for an action whose cost has a real "discard
   * from your hand" decision in it (`view/discard-choice-model.ts`). Returns
   * false when there is nothing to decide — no such cost, or so few hand
   * cards that `legalActions`'s own default is the only legal answer — so
   * the caller falls through to its usual targeting/payment/dispatch path.
   */
  #tryOpenDiscardChoice(entry: LegalAction): boolean {
    const { game, perspectiveId } = appSession().store.state;
    if (!game || perspectiveId === null) return false;
    const choice = beginDiscardChoice(game, perspectiveId, entry, POOL_DEPS);
    if (!choice) return false;
    this.#selection = { kind: "choosingDiscard", choice };
    this.#host.redraw();
    return true;
  }

  /** Adds or removes one hand card from the discard choice. A card not offered, or past its cap, is a no-op. */
  toggleDiscardPick(id: InstanceId): void {
    if (this.#readOnly) return;
    if (this.#selection.kind !== "choosingDiscard") return;
    this.#selection = { kind: "choosingDiscard", choice: toggleDiscardChoice(this.#selection.choice, id) };
    this.#host.redraw();
  }

  /** The discard choice as the engine currently sees it, or null outside that mode. */
  discardChoiceView(): DiscardChoiceView | null {
    if (this.#selection.kind !== "choosingDiscard") return null;
    const { game } = appSession().store.state;
    if (!game) return null;
    return buildDiscardChoiceView(game, this.#selection.choice, POOL_DEPS);
  }

  /**
   * Confirms the discard choice: dispatches the exact command the engine
   * just accepted (`discardChoiceView().command`) — the ability's cost paid
   * with the player's own picks and, in the same command, its effects
   * (Shield Toss's "deal 4 damage to X enemies") begin resolving. A "choose
   * X enemies" decision, if the ability needs one, opens as an ordinary
   * `PendingChoice` afterward — the same generic overlay every other card's
   * `chooseTarget` already uses, nothing new here.
   */
  async commitDiscardChoice(): Promise<void> {
    if (this.#readOnly) return;
    const view = this.discardChoiceView();
    if (!view?.command) return;
    await this.#send(view.command);
  }

  /**
   * Enters payment mode for an action. Returns false when the engine says the
   * action needs no payment after all, so the caller can just dispatch it.
   */
  #openPayment(
    entry: LegalAction,
    target: InstanceId | null,
    controllerId: PlayerId | null = null,
    costSelection?: CostSelection,
    costChoices?: CostChoices,
    destinationNote: string | null = null,
  ): boolean {
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (!game || perspectiveId === null) return false;
    const payment = beginPayment(
      game,
      perspectiveId,
      entry.action,
      target,
      POOL_DEPS,
      controllerId,
      withEntryPayers(entry, costSelection),
      costChoices,
      entry.example.type === "playCard" ? entry.example.abilityId : undefined,
      intoOf(entry),
    );
    if (!payment) return false;
    // A new payment starts with nothing judged: an abandoned one for the same card must not lend it its look.
    this.#shown = null;
    this.#verdict = null;
    this.#judging = null;
    this.#selection = { kind: "paying", payment: destinationNote ? { ...payment, destinationNote } : payment };
    this.#host.redraw();
    return true;
  }

  /**
   * Opens the either/or branch or "up to N" counter picker for an action whose cost has one
   * (docs/phase7-wave3.md §3.32, §3.36; `view/cost-choice-model.ts`). Returns false when there is nothing to ask —
   * no such cost, or only one legal answer — so the caller falls through to its usual payment/dispatch path.
   */
  #tryOpenCostChoice(entry: LegalAction, target: InstanceId | null, controllerId: PlayerId | null): boolean {
    const { game } = appSession().store.state;
    if (!game) return false;
    const prompt = costChoicePromptFor(game, POOL_DEPS, entry);
    if (!prompt) return false;
    this.#selection = { kind: "choosingCostSelection", action: entry, target, controllerId, prompt };
    this.#host.redraw();
    return true;
  }

  /** The branch/counter prompt open right now, or null outside that mode. */
  costChoiceView(): CostChoicePrompt | null {
    return this.#selection.kind === "choosingCostSelection" ? this.#selection.prompt : null;
  }

  /**
   * Opens the picker for a cost with a choice among cards in play (`view/in-play-cost-choice.ts`). False when there is
   * nothing to ask: no such cost, or every pick forced, so the caller goes on to payment as before.
   */
  #tryOpenInPlayCost(
    entry: LegalAction,
    target: InstanceId | null,
    controllerId: PlayerId | null,
    costSelection?: CostSelection,
  ): boolean {
    const { game } = appSession().store.state;
    if (!game) return false;
    const choice = beginInPlayCostChoice(game, POOL_DEPS, entry);
    if (!choice) return false;
    this.#selection = {
      kind: "choosingInPlayCost",
      choice,
      target,
      controllerId,
      ...(costSelection ? { costSelection } : {}),
    };
    this.#host.redraw();
    return true;
  }

  /** Picks or puts back one card of the in-play cost. A card not offered, or one past the cap, is a no-op. */
  toggleInPlayPick(id: InstanceId): void {
    if (this.#readOnly || this.#selection.kind !== "choosingInPlayCost") return;
    const { choice, ...rest } = this.#selection;
    this.#selection = { ...rest, choice: toggleInPlayPick(choice, id) };
    this.#host.redraw();
  }

  /** Places one more point of a divided power on this target, or takes one back once every point is placed. */
  tapDivideTarget(id: InstanceId): void {
    if (this.#readOnly || this.#selection.kind !== "dividingPower") return;
    const { game } = appSession().store.state;
    if (!game) return;
    this.#selection = { kind: "dividingPower", choice: tapDivideTarget(game, POOL_DEPS, this.#selection.choice, id) };
    this.#host.redraw();
  }

  /** The multi-pick footer's Confirm: a divided power is made, or the in-play cost picker moves on. */
  async confirmPick(): Promise<void> {
    if (this.#readOnly) return;
    if (this.#selection.kind !== "dividingPower") return this.confirmInPlayCost();
    const { game } = appSession().store.state;
    const command = game ? divideCommand(game, POOL_DEPS, this.#selection.choice) : null;
    if (!command) return;
    this.#selection = { kind: "idle" };
    await this.#send(command);
  }

  /** The in-play cost picker as the engine's own candidates and the picks so far read, or null outside that mode. */
  inPlayCostView(): InPlayCostChoiceView | null {
    if (this.#selection.kind !== "choosingInPlayCost") return null;
    const { game } = appSession().store.state;
    return game ? inPlayCostChoiceView(game, POOL_DEPS, this.#selection.choice) : null;
  }

  /**
   * Confirm on the in-play cost picker: the next slot of a cost with several, or, on the last, the play continues
   * exactly as any other does, with the picks in place of the engine's default ones: payment when it has one, else
   * the command the engine accepts for them.
   */
  async confirmInPlayCost(): Promise<void> {
    if (this.#readOnly || this.#selection.kind !== "choosingInPlayCost") return;
    const { choice, target, controllerId, costSelection } = this.#selection;
    const { game: current } = appSession().store.state;
    if (!current || !slotAnswered(choice, current, POOL_DEPS)) return;
    if (!isLastSlot(choice)) {
      this.#selection = { ...this.#selection, choice: advanceInPlayCostChoice(choice, current, POOL_DEPS) };
      this.#host.redraw();
      return;
    }
    const costChoices = costChoicesOf(choice);
    const { action } = choice;
    this.#selection = { kind: "idle" };
    if (this.#openPayment(action, target, controllerId, costSelection, costChoices)) return;
    const { game, perspectiveId } = appSession().store.state;
    if (!game || perspectiveId === null) return;
    const attempt = tryPayment(
      game,
      perspectiveId,
      action.action,
      [],
      {
        target,
        ...(controllerId ? { controllerId } : {}),
        ...optionalSelection(withEntryPayers(action, costSelection)),
        costChoices,
        ...paymentIntoOf({ into: intoOf(action) ?? null }),
      },
      POOL_DEPS,
    );
    if (attempt.ok) await this.#send(attempt.command);
    else this.#host.redraw();
  }

  /** Picks an either/or cost's branch, then continues exactly as an ordinary play/ability use would. */
  async chooseCostBranch(branch: number): Promise<void> {
    if (this.#readOnly) return;
    await this.#continueWithCostSelection({ branch });
  }

  /** Picks how many counters an "up to N" cost removes, then continues as usual. */
  async chooseCostCounters(counters: number): Promise<void> {
    if (this.#readOnly) return;
    await this.#continueWithCostSelection({ counters });
  }

  async #continueWithCostSelection(costSelection: CostSelection): Promise<void> {
    if (this.#selection.kind !== "choosingCostSelection") return;
    const { action, target, controllerId } = this.#selection;
    this.#selection = { kind: "idle" };
    if (this.#tryOpenInPlayCost(action, target, controllerId, costSelection)) return;
    if (this.#openPayment(action, target, controllerId, costSelection)) return;
    // Nothing to pay (a free branch, or a fixed cost the engine already sizes) — build the command directly, the
    // same way a free card's own confirm path does, rather than opening a payment mode with nothing to spend.
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (!game || perspectiveId === null) return;
    const attempt = tryPayment(
      game,
      perspectiveId,
      action.action,
      [],
      {
        target,
        ...(controllerId ? { controllerId } : {}),
        ...optionalSelection(withEntryPayers(action, costSelection)),
        ...paymentIntoOf({ into: intoOf(action) ?? null }),
      },
      POOL_DEPS,
    );
    if (attempt.ok) await this.#send(attempt.command);
  }

  /** Tapping a card during payment spends it, if the engine listed it as spendable. */
  #spendByInstance(id: InstanceId): void {
    if (this.#selection.kind !== "paying") return;
    const optionId = cardTapOption(this.#selection.payment, id);
    if (optionId) this.#togglePayment(optionId);
  }

  /**
   * The Inspect overlay's "Use as resource"/"Pay with" button (docs/phase4-screen-gaps.md §3 "W8"): spends a card
   * for the payment currently open, exactly as tapping it on the board during payment mode would. Returns whether
   * a payment was open and this card was one of its sources — Inspect uses that to decide whether the button did
   * anything, since it closes itself either way and has no other way to report failure. No-op, and returns false,
   * outside payment mode or read-only mode: never opens a payment of its own (that's the Board's own tap-to-play
   * path, `playCard`) and never spends a card the engine hasn't already listed as spendable.
   */
  payWithCard(id: InstanceId): boolean {
    if (this.#readOnly || this.#selection.kind !== "paying") return false;
    const optionId = cardTapOption(this.#selection.payment, id);
    if (!optionId) return false;
    this.#togglePayment(optionId);
    return true;
  }

  /**
   * Spends or un-spends one source by its option id. The engine re-judges the
   * whole selection. Public for the payment strip, where a card offering two
   * resource abilities is two tiles and a tap must mean one of them.
   */
  togglePaymentOption(optionId: string): void {
    if (this.#readOnly) return;
    this.#togglePayment(optionId);
  }

  /** Spends or un-spends one source. The engine re-judges the whole selection. */
  #togglePayment(optionId: string): void {
    if (this.#selection.kind !== "paying") return;
    // The view decides what is held (an overpay-only source before the cost is covered), never this scene. It holds
    // it by these picks' own verdict: a tap on one while they are still judged waits for it.
    const view = this.paymentView();
    const source = view?.sources.find((candidate) => candidate.optionId === optionId);
    if (view?.judging && source?.overpayOnly && !source.spent) {
      void this.#toggleWhenJudged(optionId, this.#selection.payment);
      return;
    }
    if (source?.lockedReason) return;
    this.#selection = { kind: "paying", payment: togglePayment(this.#selection.payment, optionId) };
    this.#host.redraw();
  }

  async #toggleWhenJudged(optionId: string, payment: PaymentState): Promise<void> {
    const view = await this.#judgedPaymentView(payment);
    if (view && !view.judging) this.#togglePayment(optionId);
  }

  /** The X picker's minus (-1) and plus (+1): the payment is priced again at the new X, the picked sources kept where valid. */
  stepX(delta: number): void {
    if (this.#readOnly || this.#selection.kind !== "paying") return;
    const { payment } = this.#selection;
    if (payment.x === undefined) return;
    const { game, perspectiveId } = appSession().store.state;
    if (!game || perspectiveId === null) return;
    this.#selection = {
      kind: "paying",
      payment: setPaymentX(game, perspectiveId, payment, payment.x + delta, POOL_DEPS),
    };
    this.#host.redraw();
  }

  /** Names or un-names one `playCostReduction` ability on the play (docs/phase7-wave3.md §3.20). */
  toggleCostReduction(option: CostReductionOption): void {
    if (this.#readOnly || this.#selection.kind !== "paying") return;
    this.#selection = { kind: "paying", payment: toggleCostReduction(this.#selection.payment, option) };
    this.#host.redraw();
  }

  /** The payment as the engine currently sees it, or null outside payment mode. */
  paymentView(): PaymentView | null {
    if (this.#selection.kind !== "paying") return null;
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (!game || perspectiveId === null) return null;
    const { payment } = this.#selection;
    const subject =
      payment.action.kind === "playCard" || payment.action.kind === "useAbility" ? payment.action.instanceId : null;
    const headline = [
      subject ? cardName(game, subject) : paymentSubjectWords(payment.action),
      payment.target ? `→ ${cardName(game, payment.target)}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    const verdict = this.#verdictFor(payment, perspectiveId);
    if (verdict) this.#shown = { action: payment.action, verdict };
    const shown = this.#shown?.action === payment.action ? this.#shown.verdict : null;
    return paymentView(game, perspectiveId, payment, headline, POOL_DEPS, verdict, shown);
  }

  /**
   * The verdict for these exact picks at the current version, or null while it is being judged (and the request for it
   * sent). An in-thread host answers at once.
   */
  #verdictFor(payment: PaymentState, playerId: PlayerId): PaymentVerdict | null {
    const { store } = appSession();
    const { version, game } = store.state;
    const key: PaymentKey = { payment, playerId, version, game };
    if (this.#verdict && sameKey(this.#verdict, key)) return this.#verdict.verdict;
    const now = store.judgePaymentNow(playerId, payment);
    if (now) {
      this.#verdict = { ...key, verdict: now.verdict };
      return now.verdict;
    }
    if (this.#judging && sameKey(this.#judging, key)) return null;
    const done: Promise<void> = store.judgePayment(playerId, payment).then(
      (judged) => {
        if (this.#judging?.done !== done) return;
        this.#judging = null;
        // Judged at another version (the game moved on): the next draw asks again for the version it shows.
        const now = appSession().store.state;
        if (judged.version !== version || now.version !== version || now.game !== game) return;
        this.#verdict = { ...key, verdict: judged.verdict };
        if (this.#selection.kind !== "paying" || this.#selection.payment !== payment) return;
        // The bar already shows the verdict on the picks before; a board redraw is only worth it when this one reads
        // differently (a full redraw is the costliest thing a tap does on a slow tablet).
        const before = this.#shown?.action === payment.action ? this.#shown.verdict : null;
        this.#shown = { action: payment.action, verdict: judged.verdict };
        if (!before || !sameReading(before, judged.verdict)) this.#host.redraw();
      },
      (cause: unknown) => {
        if (this.#judging?.done !== done) return;
        this.#judging = null;
        // Said on the bar rather than left judging: Pay stays off with the reason, and the next pick asks again.
        const message = cause instanceof Error ? cause.message : String(cause);
        const verdict = { command: null, blockedBy: `Couldn't check this payment: ${message}`, covered: false };
        this.#verdict = { ...key, verdict };
        if (this.#selection.kind === "paying" && this.#selection.payment === payment) this.#host.redraw();
      },
    );
    this.#judging = { ...key, done };
    return null;
  }

  /**
   * The payment view once the engine has judged `payment`, the picks on screen when the player pressed: Pay never acts
   * on a verdict for older picks, and null when the picks changed while it waited.
   */
  async #judgedPaymentView(payment: PaymentState): Promise<PaymentView | null> {
    for (let asked = 0; ; asked += 1) {
      if (this.#selection.kind !== "paying" || this.#selection.payment !== payment) return null;
      const view = this.paymentView();
      const pending = this.#judging;
      if (!view?.judging || !pending || asked === JUDGE_RETRIES) return view;
      await pending.done;
    }
  }

  async commitPayment(): Promise<void> {
    if (this.#readOnly) return;
    if (this.#selection.kind !== "paying" || this.#committing) return;
    // One press at a time: a second tap while the first waits for its verdict would raise the Hold on prompt twice.
    this.#committing = true;
    let payment: PaymentView | null;
    try {
      payment = await this.#judgedPaymentView(this.#selection.payment);
    } finally {
      this.#committing = false;
    }
    if (!payment?.command) return;
    const trigger: HintTrigger = { kind: "confirmPayment", payment };
    const hint = this.#hintsFor(trigger)[0];
    if (hint) {
      this.#host.holdOn(hint, {
        // "Change payment": nothing to dispatch — closing the overlay already leaves payment mode open exactly
        // as it was (`#runHintSafe`'s own doc comment), so the player picks different sources on their own.
        onSafe: () => this.#runHintSafe(hint, trigger),
        onAnyway: () => void this.#finishPayment(),
      });
      return;
    }
    await this.#finishPayment();
  }

  /** Payment's own alliance-help check and dispatch, run after guided mode's own hint has already had its say. */
  async #finishPayment(): Promise<void> {
    if (this.#selection.kind !== "paying") return;
    const payment = this.paymentView();
    if (!payment?.command) return;
    // A payment that spends another seat's card (RRG 1.8 "Alliance", p. 6) or hands one of them a part of the cost
    // (`costSelection.paidBy`): each of those players agrees to their own share before the command goes anywhere
    // (docs/phase7-wave4.md §4 Q10). Hot-seat: `allianceHelpersOf`'s own doc comment on why this is a same-device prompt.
    const { command } = payment;
    const withStat: Command =
      this.#selection.payment.useAtk && command.type === "basicThwart" ? { ...command, useAtk: true } : command;
    await this.#send(withStat, this.#selection.payment);
  }

  /**
   * Sends a command, after each other player it takes something from has agreed: their hand or resource cards a
   * payment spends (`allianceHelpersOf`), the cards it names as cost picks, and the parts of the cost handed to them
   * (`consentHelpersOf`). A command that touches only the payer's own things goes straight out.
   */
  async #send(command: Command, payment: PaymentState | null = null): Promise<void> {
    const { game, perspectiveId } = appSession().store.state;
    const helpers =
      game && perspectiveId !== null
        ? consentHelpersOf(game, perspectiveId, command, payment ? allianceHelpersOf(game, perspectiveId, payment) : [])
        : [];
    if (helpers.length === 0) {
      this.#selection = { kind: "idle" };
      await this.#dispatch(command);
      return;
    }
    this.#selection = { kind: "confirmingAllianceHelp", payment, command, helpers, approved: [] };
    this.#host.redraw();
  }

  /** The helper currently being asked, or null outside that mode — `#drawAllianceHelpBar`'s own input. */
  allianceHelpView(): AllianceHelpView | null {
    if (this.#selection.kind !== "confirmingAllianceHelp") return null;
    const { game } = appSession().store.state;
    if (!game) return null;
    const { helpers, approved } = this.#selection;
    const helper = helpers[approved.length];
    if (helper === undefined) return null;
    return {
      playerId: helper.playerId,
      heroName: seatIdentityName(game, helper.playerId),
      cardNames: helper.instanceIds.map((id) => cardName(game, id)),
      partNames: helper.parts.map(costPartDid),
      remaining: helpers.length - approved.length,
      total: helpers.length,
    };
  }

  /** The current helper hands the controller back: their contribution is approved. Sends the command once every helper has approved. */
  async approveAllianceHelp(): Promise<void> {
    if (this.#readOnly || this.#selection.kind !== "confirmingAllianceHelp") return;
    const { payment, command, helpers, approved } = this.#selection;
    const helper = helpers[approved.length];
    if (helper === undefined) return;
    const nextApproved = [...approved, helper.playerId];
    if (nextApproved.length < helpers.length) {
      this.#selection = { kind: "confirmingAllianceHelp", payment, command, helpers, approved: nextApproved };
      this.#host.redraw();
      return;
    }
    this.#selection = { kind: "idle" };
    await this.#dispatch(command);
  }

  /**
   * The current helper says no. RRG 1.8 "Alliance" (p. 6) makes each contribution that player's own choice, so
   * declining doesn't end the play — it returns the payer to payment selection with the same picks, so they can
   * choose different cards to spend instead (docs/phase7-wave4.md §4 Q10). A command with no payment to go back to
   * (an ability with no resource cost, a discard pick) is dropped, and the player starts the use again.
   */
  declineAllianceHelp(): void {
    if (this.#readOnly || this.#selection.kind !== "confirmingAllianceHelp") return;
    const { payment } = this.#selection;
    this.#selection = payment ? { kind: "paying", payment } : { kind: "idle" };
    this.#host.redraw();
  }

  /**
   * Opens the "who pays?" questions of an ability whose cost any player may help pay (`LegalAction.costHelp`). False
   * when there is nothing to ask (no shareable part, or only the user can pay it), so the use goes on as before.
   * The answered entry is what `#playEntry` / `#useAbility` continue with, so the question is asked once.
   */
  #tryOpenCostHelp(
    entry: LegalAction,
    resume: "ability" | { readonly play: { readonly confirmFree: boolean } },
  ): boolean {
    if (!entry.costHelp || this.#helpAnswered.has(entry)) return false;
    const { game } = appSession().store.state;
    if (!game) return false;
    const prompts = costHelpPromptsFor(game, entry, POOL_DEPS);
    if (prompts.length === 0) return false;
    this.#selection = { kind: "choosingCostHelp", entry, prompts, answers: [], resume };
    this.#host.redraw();
    return true;
  }

  /** Entries whose questions are answered: asked once per use, not again at each later step. */
  readonly #helpAnswered = new WeakSet<LegalAction>();

  /** The question open now ("Who takes the damage?") with who can answer it, or null outside that mode. */
  costHelpView(): CostHelpPrompt | null {
    if (this.#selection.kind !== "choosingCostHelp") return null;
    return this.#selection.prompts[this.#selection.answers.length] ?? null;
  }

  /** Answers the open question: `payerId` pays that part. The last answer carries the use on. */
  async chooseCostHelper(payerId: PlayerId): Promise<void> {
    if (this.#readOnly || this.#selection.kind !== "choosingCostHelp") return;
    const { entry, prompts, answers, resume } = this.#selection;
    const prompt = prompts[answers.length];
    if (!prompt || !prompt.options.some((option) => option.playerId === payerId)) return;
    const next = [...answers, [prompt.part, payerId] as const];
    if (next.length < prompts.length) {
      this.#selection = { ...this.#selection, answers: next };
      this.#host.redraw();
      return;
    }
    const answered = withCostHelpAnswers(entry, next);
    this.#helpAnswered.add(answered);
    this.#selection = { kind: "idle" };
    if (resume === "ability") this.#useAbility(answered as UsableAbilityAction);
    else await this.#playEntry(answered, resume.play.confirmFree);
  }

  /**
   * Undo (`view/undo.ts`): what the action bar's Undo button offers right now, or null when it isn't offered at all
   * (someone else's turn, an off-turn seat on show, a choice open). While any selection is open (a payment, a cost
   * choice, the cost-help prompt, the consent walk, an aim, the X stepper, the Hunted sheet, a which-one sheet) it is
   * offered greyed with the reason "finish or cancel what you're doing first": Escape / Cancel closes the selection
   * and only that, so Undo never does both (the QA's F2: Z cancelled a payment and took the move before it back).
   */
  undoOffer(): UndoOffer | null {
    const { game, perspectiveId, commandTrail, offTurnSeat } = appSession().store.state;
    if (!game || !perspectiveId || offTurnSeat !== null) return null;
    const offer = undoOf(commandTrail, game, perspectiveId);
    if (offer && this.#selection.kind !== "idle") return { kind: "unavailable", reason: UNDO_REASONS.selecting };
    return offer;
  }

  /**
   * The line the board draws beside Undo, or null: the notice of a press / Z / an undo just made, else the reason
   * Undo is greyed while the pointer is on it or the keyboard focus is.
   */
  undoWhy(): string | null {
    if (this.#undoNotice) return this.#undoNotice;
    if (!this.#undoHover && !this.#undoFocus) return null;
    const offer = this.undoOffer();
    return offer?.kind === "unavailable" ? offer.reason : null;
  }

  /** The pointer entered or left the Undo button. No redraw: the bar toggles its own label (a redraw would destroy the button under the pointer). */
  setUndoHover(over: boolean): void {
    this.#undoHover = over;
  }

  /** Keyboard focus moved onto or off the Undo button (the board redraws right after). */
  setUndoFocus(on: boolean): void {
    this.#undoFocus = on;
  }

  /** Shows `text` beside Undo for a few seconds. */
  #noteUndo(text: string): void {
    if (this.#undoNoticeTimer !== null) clearTimeout(this.#undoNoticeTimer);
    this.#undoNotice = text;
    this.#undoNoticeTimer = setTimeout(() => {
      this.#undoNoticeTimer = null;
      this.#undoNotice = null;
      this.#host.redraw();
    }, UNDO_NOTICE_MS);
    this.#host.redraw();
  }

  /** Stops the notice timer when the board goes away. */
  dispose(): void {
    if (this.#undoNoticeTimer !== null) clearTimeout(this.#undoNoticeTimer);
    this.#undoNoticeTimer = null;
    this.#undoNotice = null;
  }

  /**
   * Takes back the active hero's last move this turn, when `undoOffer` allows it, and says what it took back
   * ("Undid: played Backflip"). A press (or Z, or Enter) while it is greyed says why instead. One undo at a time: a
   * second press while one is in flight, or in the moment after one, is ignored, so two undos are two deliberate steps.
   */
  async undo(): Promise<void> {
    if (this.#readOnly) return;
    // A guided step teaching one control keeps Undo inert, the same as any other control it doesn't name.
    if (this.#guideGate.current !== null) {
      this.#guideGate.noteInertClick();
      return;
    }
    const offer = this.undoOffer();
    if (!offer) return;
    if (offer.kind === "unavailable") {
      this.#noteUndo(offer.reason);
      return;
    }
    if (this.#undoing || Date.now() < this.#undoSettledAt + UNDO_COOLDOWN_MS) return;
    this.#undoing = true;
    try {
      const { game } = appSession().store.state;
      const what = game ? undoneSummary(offer.command, (id) => cardName(game, id)) : "last move";
      if (await appSession().store.rewindTo(offer.target)) this.#noteUndo(`Undid: ${what}`);
    } finally {
      this.#undoing = false;
      this.#undoSettledAt = Date.now();
    }
  }

  /**
   * Every point Undo could reach by pressing it again and again (`undoTargetsOf`), newest first: the Pause log's
   * "Jump to a moment" offers these and nothing else. Empty whenever Undo itself isn't available.
   */
  undoTargets(): readonly number[] {
    if (this.#readOnly || this.#guideGate.current !== null) return [];
    if (this.undoOffer()?.kind !== "available") return [];
    const { game, perspectiveId, commandTrail } = appSession().store.state;
    if (!game || !perspectiveId) return [];
    return undoTargetsOf(commandTrail, game, perspectiveId);
  }

  /**
   * Undo pressed as many times as it takes to get back to `target` (one of `undoTargets`), in one rewind, with the
   * same notice and the same one-at-a-time guard as Undo. False when `target` isn't reachable or nothing was undone.
   */
  async undoTo(target: number): Promise<boolean> {
    const targets = this.undoTargets();
    const steps = targets.indexOf(target) + 1;
    if (steps === 0) return false;
    if (this.#undoing || Date.now() < this.#undoSettledAt + UNDO_COOLDOWN_MS) return false;
    this.#undoing = true;
    try {
      const offer = this.undoOffer();
      const { game } = appSession().store.state;
      const what =
        steps > 1
          ? `${steps} moves`
          : game && offer?.kind === "available"
            ? undoneSummary(offer.command, (id) => cardName(game, id))
            : "last move";
      if (!(await appSession().store.rewindTo(target))) return false;
      this.#noteUndo(`Undid: ${what}`);
      return true;
    } finally {
      this.#undoing = false;
      this.#undoSettledAt = Date.now();
    }
  }

  async dispatchExample(kind: BasicAction): Promise<void> {
    if (this.#readOnly) return;
    if (!this.#guideGate.allowsAction(kind)) {
      this.#guideGate.noteInertClick();
      return;
    }
    const entry = this.#legalFor(kind);
    if (!entry) return;
    if (kind === "endTurn") {
      const trigger: HintTrigger = { kind: "endTurn" };
      const hint = this.#hintsFor(trigger)[0];
      if (hint) {
        this.#host.holdOn(hint, {
          onSafe: () => this.#runHintSafe(hint, trigger),
          onAnyway: () => void this.#finishEndTurn(kind, entry),
        });
        return;
      }
    }
    await this.#finishEndTurn(kind, entry);
  }

  /**
   * End turn's existing "Confirm before ending turn" check (Settings), run after guided mode's own hint has
   * already had its say — or found nothing to say (`docs/guided-mode.md` §3.5, "Confirm-before-end-turn stays
   * separate" — both can show in sequence, neither replaces the other).
   */
  async #finishEndTurn(kind: BasicAction, entry: LegalAction): Promise<void> {
    if (kind === "endTurn") {
      const { game, legal } = appSession().store.state;
      // A hand size under 4 always asks (issue #150); what's still open asks only with the setting on.
      const smallHand = game && legal ? smallHandSizeConfirmOf(game, legal.playerId, POOL_DEPS) : null;
      const confirm =
        game && legal && appSession().settings.confirmBeforeEndTurn
          ? endTurnConfirmOf(game, legal.actions, legal.playerId)
          : null;
      if (smallHand || confirm) {
        const sentence = [smallHand, confirm?.sentence].filter((part) => part).join("\n\n");
        const send = (): void => void this.#dispatch(entry.example);
        if (smallHand) this.#host.confirmEndTurn(sentence, send, "Are you sure?");
        else this.#host.confirmEndTurn(sentence, send);
        return;
      }
    }
    await this.#dispatch(entry.example);
  }

  /**
   * Every hint `guide-hints.ts#hintsFor` raises for `trigger` right now, most relevant first — empty outside a
   * live game, in read-only mode, or when the guide level/silenced keys say to stay quiet (that filtering is
   * `hintsFor`'s own job, not this controller's).
   */
  #hintsFor(trigger: HintTrigger): readonly Hint[] {
    if (this.#readOnly) return [];
    const { game, perspectiveId, legal } = appSession().store.state;
    if (!game || perspectiveId === null) return [];
    return hintsFor(
      {
        state: game,
        deps: POOL_DEPS,
        playerId: perspectiveId,
        trigger,
        ...(legal?.playerId === perspectiveId ? { legal: legal.actions } : {}),
      },
      guidePrefs(),
    );
  }

  /**
   * A hint's safe action (`docs/guided-mode.md` §4 G9b): "Thwart first" and "Flip to alter-ego"/"Stay in hero
   * form" go through the same controller path the Thwart/Flip buttons do, so the engine — not this switch —
   * still decides targets and legality. `wastedPay`'s safe action has nothing to dispatch: closing the overlay
   * already leaves payment mode open exactly as it was, so the player can change their own picks.
   */
  #runHintSafe(hint: Hint, trigger: HintTrigger): void {
    switch (hint.key) {
      case "schemeFinish":
      case "schemeClose":
        this.chooseBasic("thwart");
        return;
      case "lethal":
        this.#flipSafely();
        return;
      case "flipDanger":
        // "flip" trigger: cancel the flip outright, staying in hero form — nothing to dispatch. "endTurn"
        // trigger: the player is already in alter-ego, so the safe move is flipping back to hero before the
        // villain phase.
        if (trigger.kind === "endTurn") this.#flipSafely();
        return;
      case "wastedPay":
        return;
    }
  }

  /**
   * The one choke point every mutating path above funnels through — guarded
   * on its own, not only at each of those call sites, so read-only mode holds
   * even if a future caller reaches this some other way.
   */
  async #dispatch(command: Command): Promise<void> {
    if (this.#readOnly) return;
    const { store } = appSession();
    const before = store.state.version;
    await store.dispatch(command);
    // A rejection doesn't change the version, so redraw to show the message.
    if (store.state.version === before) this.#host.redraw();
  }

  #legalEntries(): readonly LegalAction[] {
    const { store } = appSession();
    const actions = store.state.legal?.actions;
    return actions ? legalEntriesOf(actions) : [];
  }

  #legalFor(action: BasicAction): LegalAction | undefined {
    const kind = BASIC_TO_KIND[action];
    return this.#legalEntries().find((entry) => entry.action.kind === kind);
  }
}
