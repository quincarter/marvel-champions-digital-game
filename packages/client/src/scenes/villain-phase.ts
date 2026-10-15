/**
 * The villain phase, drawn as the design's auto-advancing walkthrough
 * (PLAN.md Phase 4, "villain phase as a walkthrough"; docs/phase4-screen-gaps.md
 * §3 "W7").
 *
 * ---------------------------------------------------------------------------
 * COMPOSITION (D11, P09, L02 — docs/design-reference.md)
 * ---------------------------------------------------------------------------
 * A full-bleed ink panel, not a centered card. Desktop and tablet landscape:
 * header (title + Skip), subtitle, the five-step strip, then a two-column
 * split down to the footer — a wide main column ("happening now"'s
 * breakdown, the boost cards it revealed, and "queued this phase") beside a
 * narrower rail (the main-scheme threat callout, then the phase log). Phone
 * collapses the step strip to one compact line and stacks every section in
 * one column instead. `view/villain-phase-layout.ts` owns the actual
 * geometry; this scene only reads it.
 *
 * ---------------------------------------------------------------------------
 * BOARD CONTRACT (read this before wiring the launch call)
 * ---------------------------------------------------------------------------
 * The Board scene launches this overlay exactly once per villain phase, passing the game from before the
 * command that began it as `VillainPhaseLaunchData`:
 *
 *   if (
 *     !this.scene.isActive(SCENES.villainPhase) &&
 *     state.lastEvents.some((e) => e.type === "stepChanged" && e.to.phase === "villain" && e.to.kind === "placeThreat")
 *   ) {
 *     this.scene.launch(SCENES.villainPhase, { before });
 *   }
 *
 * That is the *only* thing Board needs to do. Why this exact condition:
 *  - `placeThreat` is step one, so this event fires exactly once per villain
 *    phase — never on the later within-phase step changes (enemyActivations,
 *    dealEncounterCards, ...), which would otherwise re-open a walkthrough the
 *    player already skipped (see "Skip", below).
 *  - The `isActive` guard is load-bearing and must not be dropped. `launch` is
 *    NOT a no-op on an already-running scene in Phaser 4.2.1: it queues
 *    `SceneManager.start`, which for a scene in RUNNING..SLEEPING calls
 *    `sys.shutdown()` and then `sys.start()` — a full restart that would throw
 *    away this scene's accumulated beats and reveal cursor mid-phase. `run()`
 *    is no safer: a RUNNING scene falls through its sleeping/paused branches to
 *    the same `start()`. With the step-one condition above the guard is belt
 *    and braces today, but it is what makes the condition safe to loosen.
 *  - Everything else — reading the round, accumulating beats across the
 *    several `dispatch` calls one villain phase can span (a mid-phase pause
 *    means the phase resumes in a *later* command with its own `lastEvents`),
 *    noticing the phase ended, and closing itself — happens inside this scene
 *    by subscribing to the store directly. Board is told nothing back.
 *
 * COEXISTENCE WITH THE PENDING-CHOICE OVERLAY (`scenes/choice.ts`)
 * ---------------------------------------------------------------------------
 * Both overlays run in parallel over Board and may be open at once — most of
 * this screen's pauses *are* an open `PendingChoice`. `ChoiceOverlay` is
 * normally the one that actually collects the answer; this screen only
 * narrates, and shows the same "Auto-advance paused ..." label the choice
 * sheet also has available (`decisionLabel`/`pauseFor` share their
 * reasoning). Whenever a `pendingChoice` is open and `ChoiceOverlay` is
 * running, this scene keeps the choice sheet ordered above itself (checked
 * every frame — see `#orderAgainstChoice` for why a per-update check was not
 * enough), so the thing the player must act on is never hidden behind the
 * thing that's just narrating.
 *
 * The one exception is the inline interrupt window (D11/P09/L02,
 * `inlineInterruptFor`): when the open choice is the viewer's own
 * `chooseTriggers` and there is something legal to interrupt with, this
 * screen draws that card and its own "Play"/"Let it resolve" controls
 * *itself*, dispatching through `resolveChoice` exactly as the choice sheet
 * would (same option ids, same call) — so the log reads no differently
 * whichever surface answered it. In that one case this scene brings *itself*
 * to the top instead of the choice sheet, so its own buttons are the ones
 * that receive the click; the choice sheet is still running underneath
 * (unchanged, and still reachable the moment this screen closes) but this
 * panel's own background covers it, the same way any two full-bleed overlays
 * would.
 *
 * SKIP / DISMISS
 * ---------------------------------------------------------------------------
 * A villain phase the player has already read should not be a wall (PLAN.md).
 * "Skip" (button, top right) and Esc (or B on a pad) both fade this panel out and then call
 * `this.scene.stop()` (`#close`, `ui/transitions.ts`'s `OverlayMotion`) and do nothing else —
 * Board's own state is untouched, the actual game keeps
 * running underneath exactly as it would with this screen open. Because the
 * launch condition only fires on step one, skipping mid-phase does not get
 * this screen re-opened by a later step change in the same phase.
 *
 * FINISHING: THE HELD-OPEN RECAP (#117)
 * ---------------------------------------------------------------------------
 * This scene watches the same store Board does. Once the walkthrough reports `complete` and every beat it knows
 * about has been revealed, it draws the recap instead of the walkthrough panel (`ui/villain-recap-panel.ts`,
 * `view/villain-recap.ts`; mockups D3/T3/P4): what changed, then every card of the five steps in the order it
 * happened, with an AUTO-ADVANCE toggle, FULL LOG (opens Pause, which holds the game log) and START PLAYER PHASE.
 * What happens next is `settings.villainAutoAdvance` (`#syncTiming`):
 *  - "off" (default): nothing closes the recap on a timer; the player presses Start player phase (or Hide/Esc).
 *  - "afterPause": the recap closes itself after `VILLAIN_RECAP_PAUSE_MS`.
 *  - "on": no recap at all; the last beat gets one beat interval (`villainBeatIntervalMs`) and the screen closes.
 * Beats are revealed one per `villainBeatIntervalMs(villainBeatSpeed)`. The "before" half of the "what changed"
 * tiles is the game Board handed over at launch (`VillainPhaseLaunchData`). Because a whole phase can (and often
 * does) finish revealing between two store updates, `#syncTiming` re-checks from the reveal timer's own tick the
 * moment it catches up, not only from a fresh store update (a pre-2026-09-29 version hung there). Similarly, if
 * `state.game` disappears or the game ends (`state.game.outcome`), the scene stops itself without waiting to be told.
 *
 * ---------------------------------------------------------------------------
 * REDUCED MOTION
 * ---------------------------------------------------------------------------
 * The whole reason this screen exists is that the engine can hand over an
 * entire five-step phase in one burst (`view/villain-walkthrough.ts`), so
 * normally beats are revealed one at a time on a readable timer
 * (`view/villain-phase-reveal.ts`). Under reduced motion there is no timer:
 * every beat currently known is shown the instant it arrives, and the player
 * reads at their own pace rather than a timer's — "no travel/animation; the
 * beats still appear and the player can step through" is satisfied because
 * nothing is gated behind a wait, only behind the player's own reading speed
 * and the Skip/Continue controls, which work identically either way.
 */

import Phaser from "phaser";
import { addPressShield } from "../ui/press-shield.js";
import { cardOf, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { POOL_DEPS } from "../content/pool.js";
import { accent, border, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { bindHoldTarget } from "../ui/hold-target.js";
import { textStyle } from "../ui/theme.js";
import { McButton, fitText, label, paintPanel } from "../ui/widgets.js";
import { inspectModel } from "../view/inspect-model.js";
import type { FormFactor, Rect } from "../view/layout.js";
import { formFactorFor, isTabbed } from "../view/layout.js";
import { drawGuideStrip, GUIDE_STRIP_HEIGHT } from "../ui/guide-strip.js";
import { abilityFaceOf } from "../view/board-model.js";
import { cardName, seatName } from "../view/names.js";
import { abilityFirst, sourceCardPanelFor } from "../view/choice-source-panel.js";
import { triggerLabel } from "../view/inspect-model.js";
import { SOURCE_STRIP_HEIGHT, sourceStripPlacement } from "../view/choice-source-panel-layout.js";
import { drawSourceCardPanel } from "../ui/source-card-panel.js";
import {
  encounterHoldAt,
  revealOf,
  stepCaptionOf,
  type Reveal,
  type RevealedStep,
} from "../view/villain-phase-reveal.js";
import { villainPhaseLayout } from "../view/villain-phase-layout.js";
import { boostCardsLayout } from "../view/villain-phase-boosts.js";
import { interruptCardsLayout } from "../view/villain-phase-interrupts.js";
import { mainSchemeCalloutOf, type MainSchemeCallout } from "../view/villain-main-scheme.js";
import { queuedActivationsOf, type QueuedSeat } from "../view/villain-queue.js";
import { teamStatusOf, type TeamStatusRow } from "../view/villain-team-status.js";
import {
  advanceReveal,
  decisionLabel,
  appendWalkthrough,
  emptyWalkthrough,
  defenderLineOf,
  inlineInterruptFor,
  inlineConfirmLabel,
  inlinePickLabel,
  inlineSingle,
  interruptActionLabel,
  livePicks,
  toggleInlinePick,
  readyToAutoClose,
  recapPlacementFor,
  type ActivationBeat,
  type RecapPlacement,
  type InlineInterruptOption,
  type Pause,
  type StepStatus,
  type Walkthrough,
  windowTitleOf,
} from "../view/villain-walkthrough.js";
import { villainPhaseFocusOrder, villainRailFocusOrder } from "../view/screen-focus.js";
import { appSession } from "../session.js";
import type { SessionState } from "../store/session-store.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { BoardScene } from "./board.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion, slideIn, slideOut } from "../ui/transitions.js";
import { HoverPreview, hoverCardsOf, isMousePointer, resetHoverCards } from "../ui/card-hover-preview.js";
import { villainHoverArea } from "../view/card-hover.js";
import { slideOffset, villainSlideEdge, type VillainReview } from "../view/villain-review.js";
import { RECAP_SCROLL_SLOTS, drawVillainRecapPanel } from "../ui/villain-recap-panel.js";
import { villainRecapOf } from "../view/villain-recap.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { VILLAIN_RECAP_PAUSE_MS, cardSizeFactor, villainBeatIntervalMs } from "../settings.js";
import { villainDockWidthFor, villainPresentationFor, type VillainDockKind } from "../view/villain-dock.js";
import {
  villainBandLayout,
  villainPeekLayout,
  villainRailLayout,
  villainTabLayout,
} from "../view/villain-rail-layout.js";
import { encounterStripOf, type EncounterStrip } from "../view/villain-encounter-strip.js";
import { villainHandTagsOf } from "../view/villain-hand-tags.js";
import { SEAT_AVATAR_READY } from "../ui/seat-avatar.js";
import {
  abilityName,
  drawInterruptAnswer,
  drawVillainRailPanel,
  type RailBody,
  type RailGate,
} from "../ui/villain-rail-panel.js";

/** What Board hands over when it opens the walkthrough: the game as it stood before the command that began the phase. */
export interface VillainPhaseLaunchData {
  readonly before: GameState | null;
  /** Reopen a finished phase's recap for review from the Board's drawer handle (`view/villain-review.ts`). */
  readonly review?: VillainReview;
}

const totalBeatsOf = (walkthrough: Walkthrough): number =>
  walkthrough.steps.reduce((sum, step) => sum + step.beats.length, 0);

/** "Klaw attacks Captain Marvel" / "Klaw schemes against Black Panther" — read straight off the activation the events named. */
function activationHeadline(activation: ActivationBeat, state: GameState, viewer: PlayerId | null): string {
  const enemy = cardName(state, activation.enemyInstanceId);
  return activation.kind === "attack"
    ? `${enemy} attacks ${seatName(state, activation.attackedPlayerId, viewer)}`
    : `${enemy} schemes against ${seatName(state, activation.playerId, viewer)}`;
}

/** Which seat the current activation is aimed at ("SEAT 3 · TARGETED", L02) — null outside an activation. */
function activationTargetOf(activation: ActivationBeat | null): PlayerId | null {
  if (!activation) return null;
  return activation.kind === "attack" ? activation.attackedPlayerId : activation.playerId;
}

/** "Black Panther — Klaw activates · Weapons Runner activates (will be cancelled by stun)". */
function queuedSeatLine(seat: QueuedSeat, state: GameState, viewer: PlayerId | null): string {
  const parts = seat.activations.map((a) => {
    const name = cardName(state, a.instanceId);
    return a.cancelledBy ? `${name} (will be cancelled by ${a.cancelledBy})` : name;
  });
  return `${seatName(state, seat.playerId, viewer)} — ${parts.join(" · ")}`;
}

interface BreakdownCell {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}

/** `base + boost − defense = damage`, or `SCH + boost (± threat mod) = threat` — every number `resolved`'s own. */
function breakdownOf(
  activation: ActivationBeat,
): { readonly cells: readonly BreakdownCell[]; readonly ops: readonly string[] } | null {
  const boostLabel = `BOOST${activation.boosts.length > 1 ? ` ×${activation.boosts.length}` : ""}`;
  if (activation.kind === "attack") {
    const r = activation.resolved;
    if (!r) return null;
    return {
      cells: [
        { label: "BASE", value: String(r.baseAtk) },
        { label: boostLabel, value: String(r.boostIcons) },
        { label: "DEFENSE", value: String(r.defenseReduction) },
        { label: "DAMAGE", value: String(r.damageDealt), emphasis: true },
      ],
      ops: ["+", "−", "="],
    };
  }
  const r = activation.resolved;
  if (!r) return null;
  const cells: BreakdownCell[] = [
    { label: "SCH", value: String(r.baseSch) },
    { label: boostLabel, value: String(r.boostIcons) },
  ];
  const ops: string[] = ["+"];
  if (r.threatBonus !== 0) {
    cells.push({ label: "THREAT MOD", value: `${r.threatBonus > 0 ? "+" : "−"}${Math.abs(r.threatBonus)}` });
    ops.push(r.threatBonus > 0 ? "+" : "−");
  }
  cells.push({ label: "THREAT", value: String(r.threatPlaced), emphasis: true });
  ops.push("=");
  return { cells, ops };
}

/** The breakdown as one line for the docked rail: "ATK 2 + BOOST 1 − DEFENSE 3 = DAMAGE 0". */
function breakdownLineOf(activation: ActivationBeat): string | null {
  const breakdown = breakdownOf(activation);
  if (!breakdown) return null;
  return breakdown.cells
    .map((cell, i) => `${cell.label} ${cell.value}${i < breakdown.ops.length ? ` ${breakdown.ops[i]}` : ""}`)
    .join(" ");
}

/** Below this height the inline interrupt panel lays out sideways (`#drawInterrupt`). */
const INTERRUPT_SHORT_PANEL = 300;

export class VillainPhaseOverlay extends Phaser.Scene {
  #walkthrough: Walkthrough = emptyWalkthrough(1);
  #revealed = 0;
  #version = -2;
  #latest: SessionState | null = null;
  #unsubscribe: (() => void) | null = null;
  #revealTimer: Phaser.Time.TimerEvent | null = null;
  #closeTimer: Phaser.Time.TimerEvent | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  /** The game before the phase began, for the recap's "what changed" tiles. */
  #before: GameState | null = null;
  /** One scroll position per recap steps region, kept across redraws. */
  #recapScrolls: VariableListScroll[] = Array.from({ length: RECAP_SCROLL_SLOTS }, () => new VariableListScroll());
  #hover: HoverPreview | null = null;
  /** When the docked phase began sliding in, for a redraw mid-slide (`ui/transitions.ts#slideIn`). */
  #slideStartedAt: number | null = null;
  /** Reopened from the Board's drawer handle: a finished phase's recap, read-only, with Close. */
  #review: VillainReview | null = null;
  /** HIDE ▸ on the docked rail: the table takes the whole width and the phase keeps a handle to come back. */
  #hidden = false;
  /** The decision open when the player hid the rail; a new one of their own brings the rail back. */
  #hiddenChoice: string | null = null;
  /** How the phase was drawn last (`view/villain-dock.ts`), for the debug hook and the dump. */
  #presentation: VillainDockKind | "hidden" = "full";
  /**
   * START VILLAIN PHASE has been pressed (the owner's call, 2026-10-14): with Auto-advance off, the docked phase opens
   * on its five steps and waits for the player before anything plays (`#gateEligible`).
   */
  #started = false;
  /** Decisions the player chose to answer from the phase's notice (ANSWER ▸): their sheet may come up. */
  #answered = new Set<string>();
  /** When each held decision's notice first appeared, for its slide in. */
  #noticeShownAt = new Map<string, number>();
  /** PEEK AT TABLE on a phone or tablet in portrait (P3): the board's tabs show, the phase keeps a banner. */
  #peeking = false;
  /** Encounter cards the player has moved past under "Hold encounter cards" (`#heldCard`). */
  #released = new Set<string>();

  constructor() {
    super({ key: SCENES.villainPhase });
  }

  create(data?: VillainPhaseLaunchData): void {
    this.#motion = new OverlayMotion();
    this.#before = data?.before ?? null;
    this.#recapScrolls.forEach((scroll) => scroll.reset());
    this.#walkthrough = emptyWalkthrough(1);
    this.#revealed = 0;
    this.#version = -2;
    this.#hidden = false;
    this.#hiddenChoice = null;
    this.#presentation = "full";
    this.#released = new Set();
    this.#peeking = false;
    this.#slideStartedAt = null;
    this.#started = false;
    this.#answered = new Set();
    this.#noticeShownAt = new Map();
    this.#review = data?.review ?? null;
    if (this.#review) {
      // A finished phase, read back: everything shown, nothing paced, nothing more to collect.
      this.#walkthrough = this.#review.walkthrough;
      this.#revealed = totalBeatsOf(this.#walkthrough);
      this.#before = this.#review.before;
    }

    const { store } = appSession();
    this.#unsubscribe = store.subscribe((state) => this.#onState(state));
    const onResize = (): void => this.#draw();
    // A boost card's scan is requested lazily and may not have arrived on the
    // first draw; without this the panel stays blank until something else
    // happens to redraw the scene.
    const artOff = cardArt(this).onArrived(() => this.#draw());
    // A hero picture for a seat's avatar (`ui/seat-avatar.ts`) arrives the same way.
    this.events.on(SEAT_AVATAR_READY, onResize);
    /**
     * The resize listener MUST be removed on shutdown.
     *
     * `this.scale` is the *game's* emitter, not the scene's, so it outlives
     * every scene and keeps whatever is registered on it. An overlay that is
     * launched and stopped on every decision therefore added a listener per
     * open, each closure retaining a dead scene and, through it, the game
     * state, the view models and the card-art textures — a heap that reached
     * 3.5 GB in one session. It also crashed: a resize would eventually reach
     * a torn-down scene and draw into systems that no longer exist.
     */
    this.scale.on("resize", onResize, this);
    // Keyboard and pad: Tab to Continue or Skip, Enter presses, Escape skips.
    // The choice sheet collects answers over this screen, and Inspect can open
    // over both; while either is up it owns input — Escape used to skip the
    // walkthrough from under an open decision.
    this.#route = new FocusRoute(this, {
      blocked: () =>
        (this.scene.isActive(SCENES.choice) && !this.#placement().recapOnTop) || this.scene.isActive(SCENES.inspect),
      onCancel: () => this.#skip(),
    });

    // The desktop hover popover over the phase's own cards (the enemy, the revealed card, the interrupt card, the
    // recap's thumbnails), as on the table: the cards' rects are noted as they are drawn (`noteHoverCard`).
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cards: () => hoverCardsOf(this),
      area: (pointer) => {
        const { width, height } = this.scale.gameSize;
        const overlays = Object.values(SCENES).filter(
          (key) =>
            key !== SCENES.board &&
            key !== SCENES.music &&
            key !== SCENES.villainPhase &&
            key !== SCENES.choice &&
            this.scene.isActive(key),
        );
        return villainHoverArea({
          formFactor: formFactorFor(width, height),
          mouse: isMousePointer(pointer),
          scale: appSession().settings.cardHoverScale,
          overlays,
          viewport: { x: 0, y: 0, width, height },
        });
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#hover?.destroy();
      this.#hover = null;
      // Give the table its whole width and its own hand tags back, whatever closed the phase.
      this.#boardScene()?.setVillainDock(null);
      this.#boardScene()?.setVillainHandTags(null);
      this.scale.off("resize", onResize, this);
      this.events.off(SEAT_AVATAR_READY, onResize);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      artOff();
      this.#revealTimer?.remove();
      this.#revealTimer = null;
      this.#closeTimer?.remove();
      this.#closeTimer = null;
      // Clear the headless click-through hook with the scene — otherwise a script that polls
      // `__mcVillainPhaseDebug` after this overlay closes would keep reading the last frame's rects.
      if (import.meta.env.DEV) delete (window as unknown as { __mcVillainPhaseDebug?: unknown }).__mcVillainPhaseDebug;
    });
  }

  #skip(): void {
    this.#close();
  }

  /** The live Board scene, when one is running underneath — mirrors `scenes/inspect.ts`'s own `#boardScene`
   * (guided mode G7c: this is where the guide rail's own reserved width and the bottom guide strip's content
   * come from — `docs/guided-mode.md` §4 "Left for G7"). */
  #boardScene(): BoardScene | null {
    if (!this.scene.isActive(SCENES.board)) return null;
    return this.scene.get(SCENES.board) as BoardScene;
  }

  #close(): void {
    if (this.#motion.leaving) return;
    this.#tuckAway();
    const { width, height } = this.scale.gameSize;
    const edge = villainSlideEdge(formFactorFor(width, height));
    // Docked or recap: back out the way it came. A peek banner or the hidden handle just fades.
    const slides = this.#presentation !== "peek" && this.#presentation !== "hidden";
    this.#motion.exit(
      this,
      () => {
        this.#boardScene()?.setVillainDock(null);
        this.#boardScene()?.setVillainHandTags(null);
        this.scene.stop();
      },
      undefined,
      slides
        ? (done) =>
            slideOut(this, slideOffset(edge, { x: 0, y: 0, width, height }, { x: 0, y: 0, width, height }), done)
        : undefined,
    );
  }

  /** A finished phase, closing: kept for review on the Board's drawer handle through the next player phase. */
  #tuckAway(): void {
    const game = this.#latest?.game;
    if (this.#review || !game || !this.#walkthrough.complete) return;
    appSession().villainReview = {
      round: this.#walkthrough.round,
      walkthrough: this.#walkthrough,
      before: this.#before,
      after: game,
      viewer: this.#latest?.perspectiveId ?? null,
    };
  }

  /** The hand's tags for the board: what the open window offers is PLAY NOW. */
  #handTags(game: GameState, viewer: PlayerId | null): ReturnType<typeof villainHandTagsOf> {
    // Before START nothing is on offer yet: the window is not shown.
    const choice = this.#walkthrough.pausedAt && !this.#waitingToStart() ? game.pendingChoice : null;
    const offered = choice ? (inlineInterruptFor(choice, viewer) ?? []) : [];
    return villainHandTagsOf(game, viewer, POOL_DEPS, new Set(offered.map((option) => option.instanceId)));
  }

  /** PEEK AT TABLE ▾ / BACK ▴ (P3). */
  #setPeeking(peeking: boolean): void {
    this.#peeking = peeking;
    this.#draw();
  }

  /** HIDE ▸: undock and keep only a handle; the handle brings the rail back. */
  #setHidden(hidden: boolean): void {
    this.#hidden = hidden;
    this.#hiddenChoice = hidden ? (this.#latest?.game?.pendingChoice?.choiceId ?? null) : null;
    this.#draw();
  }

  /** The options picked so far in the inline window, in pick order, for the decision they belong to. */
  #picks: readonly string[] = [];
  #picksFor: string | null = null;

  /** Submits an inline interrupt answer exactly as the choice overlay would (`resolveChoice`) — an empty selection is "let it resolve". */
  #resolve(selectedOptionIds: readonly string[]): void {
    void appSession().store.resolveChoice(selectedOptionIds);
  }

  #onState(state: SessionState): void {
    if (!state.game || state.game.outcome) {
      // No game, or the game just ended: Game Over owns the screen from here.
      this.#close();
      return;
    }
    if (this.#review) {
      // The review reads its own snapshot; the live game only decides whether it may stay open.
      this.#latest = state;
      this.#draw();
      return;
    }

    if (state.version !== this.#version) {
      this.#version = state.version;
      const before = totalBeatsOf(this.#walkthrough);
      this.#walkthrough = appendWalkthrough(
        this.#walkthrough,
        state.lastEvents,
        state.game,
        state.perspectiveId,
        POOL_DEPS,
      );
      const after = totalBeatsOf(this.#walkthrough);
      // A fresh villain phase clears the previous one's beats (the walkthrough
      // shows one phase at a time) — the reveal cursor follows suit.
      if (after < before) {
        this.#revealed = 0;
        this.#released = new Set();
      }
    }

    this.#latest = state;
    this.#syncTiming();

    // The pending-choice overlay normally wins the top z-order so the thing
    // the player must act on is never hidden behind the thing that's just
    // narrating — except the one case this screen answers inline itself
    // (see the class doc comment), where this screen stays on top instead so
    // its own "Play"/"Let it resolve" controls are the ones that get the
    // click.
    this.#orderAgainstChoice();

    this.#draw();
  }

  /**
   * Keeps the decision sheet and this walkthrough in the right order, checked
   * every frame rather than only when the state changes.
   *
   * It used to run once per store update, and only "if the choice sheet is
   * active". But the Board *launches* that sheet from the same store update,
   * and Phaser starts a launched scene on the next frame — so whenever this
   * scene's subscriber ran first, the sheet was not active yet, the claim was
   * skipped, and nothing came along to retry it: the engine was now waiting on
   * the very decision that sat, unreachable, underneath this screen until the
   * player hit Skip. A per-frame check has no such window. It only moves a
   * scene when the order is actually wrong, and it moves the sheet to *just
   * above this one* rather than to the top, so an Inspect the player opened
   * over the sheet stays over it.
   */
  #orderAgainstChoice(): void {
    const state = this.#latest;
    const choice = state?.game?.pendingChoice;
    if (!state || !choice || !this.scene.isActive(SCENES.choice)) return;
    const manager = this.scene.manager;
    const mine = manager.getIndex(SCENES.villainPhase);
    const theirs = manager.getIndex(SCENES.choice);
    // The one decision this screen answers itself (see the class doc comment), and a finished recap with its
    // Continue showing, keep *this* screen on top, so its own buttons take the click.
    const inline = this.#placement().recapOnTop;
    if (inline && mine < theirs) this.scene.moveAbove(SCENES.choice, SCENES.villainPhase);
    else if (!inline && theirs < mine) this.scene.moveAbove(SCENES.villainPhase, SCENES.choice);
  }

  override update(): void {
    this.#orderAgainstChoice();
    // While the choice sheet owns the decision (every pause except the inline interrupt this screen answers itself),
    // the walkthrough takes no clicks at all: it is only narrating, the sheet is drawn over it, and nothing on it may
    // be the thing that catches a click meant for the sheet. A leaving walkthrough is already off (`OverlayMotion`).
    if (!this.#motion.leaving) this.input.enabled = !this.#choiceOwnsInput();
  }

  /** True while an open decision is being answered on the choice sheet rather than on this screen. */
  #choiceOwnsInput(): boolean {
    if (!this.scene.isActive(SCENES.choice)) return false;
    return !this.#placement().recapTakesInput;
  }

  /** Where this screen stands against the open decision (`recapPlacementFor`): a finished recap keeps its Continue live. */
  #placement(): RecapPlacement {
    const state = this.#latest;
    const choice = state?.game?.pendingChoice;
    return recapPlacementFor({
      pending: !!choice,
      inline: !!choice && !!state && inlineInterruptFor(choice, state.perspectiveId) !== null,
      finished: readyToAutoClose(this.#walkthrough.complete, this.#revealed, totalBeatsOf(this.#walkthrough)),
      held: this.#heldChoiceId() !== null,
    });
  }

  /**
   * Whether this phase waits on the player (the owner's call, 2026-10-14): docked beside the table, with Auto-advance
   * off. Then it opens on START VILLAIN PHASE, and a decision someone has to make (a revealed card's choice, a defender)
   * comes up as a notice with ANSWER instead of a sheet jumping over the cards. Full screen, a review, a tutorial's
   * guide strip, or Auto-advance on run as before.
   */
  #gateEligible(): boolean {
    if (this.#review) return false;
    const settings = appSession().settings;
    if (settings.villainAutoAdvance !== "off") return false;
    const { width, height } = this.scale.gameSize;
    const formFactor = formFactorFor(width, height);
    if (isTabbed(formFactor) && this.#boardScene()?.guideStripContent()) return false;
    const kind = villainPresentationFor({
      formFactor,
      dockTable: settings.villainDockTable,
      recap: false,
      peeking: false,
    });
    return kind !== "full";
  }

  #waitingToStart(): boolean {
    return !this.#started && this.#gateEligible();
  }

  /** The open decision the phase is holding back (its sheet hidden under the phase), or null. */
  #heldChoiceId(): string | null {
    const state = this.#latest;
    const choice = state?.game?.pendingChoice;
    if (!state || !choice || !this.#gateEligible()) return null;
    if (!this.#started) return choice.choiceId;
    // The player's own interrupt is answered on the panel itself; anything else waits for ANSWER.
    if (inlineInterruptFor(choice, state.perspectiveId) !== null) return null;
    return this.#answered.has(choice.choiceId) ? null : choice.choiceId;
  }

  /** START VILLAIN PHASE: the beats start playing and any decision already open gets its notice. */
  #start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#syncTiming();
    this.#draw();
  }

  /** ANSWER ▸ on a held decision's notice: its sheet comes up over the phase (`#orderAgainstChoice`). */
  #answer(choiceId: string): void {
    this.#answered.add(choiceId);
    this.#orderAgainstChoice();
    this.#draw();
  }

  /**
   * The gate the docked phase draws where its interrupt window goes: START before the phase begins, or a held
   * decision's notice. Null when neither waits.
   */
  #gate(game: GameState, viewer: PlayerId | null, subject: InstanceId | null): RailGate | null {
    if (this.#waitingToStart()) return { kind: "start", onPress: () => this.#start() };
    const id = this.#heldChoiceId();
    const choice = game.pendingChoice;
    if (id === null || !choice) return null;
    const who = seatName(game, choice.playerId, viewer);
    const about = subject ? cardName(game, subject) : "The villain phase";
    return {
      kind: "decision",
      title: `${about} · ${who === "You" ? "your decision" : `${who} decides`}`,
      text: decisionLabel(choice, game, viewer),
      cardInstanceId: subject,
      onPress: () => this.#answer(id),
    };
  }

  /** For the Ctrl+Shift+D diagnostic dump (`ui/debug-dump.ts`). */
  debugState(): Record<string, unknown> {
    return {
      leaving: this.#motion.leaving,
      choiceOwnsInput: this.#choiceOwnsInput(),
      revealed: this.#revealed,
      pausedAt: this.#walkthrough.pausedAt?.label ?? null,
      complete: this.#walkthrough.complete,
      total: totalBeatsOf(this.#walkthrough),
      hasRevealTimer: this.#revealTimer !== null,
      hasCloseTimer: this.#closeTimer !== null,
      reducedMotion: appSession().settings.reducedMotion,
      presentation: this.#presentation,
    };
  }

  #syncTiming(): void {
    // A review never paces or closes itself: the player opened it and closes it.
    if (this.#review) return;
    // Nothing plays before START VILLAIN PHASE.
    if (this.#waitingToStart()) {
      this.#revealTimer?.remove();
      this.#revealTimer = null;
      this.#revealed = 0;
      return;
    }
    const reducedMotion = appSession().settings.reducedMotion;
    const total = totalBeatsOf(this.#walkthrough);

    if (reducedMotion) {
      this.#revealTimer?.remove();
      this.#revealTimer = null;
      this.#revealed = total;
    } else if (this.#revealed < total && !this.#revealTimer) {
      this.#revealTimer = this.time.addEvent({
        delay: villainBeatIntervalMs(appSession().settings.villainBeatSpeed),
        loop: true,
        callback: () => {
          const currentTotal = totalBeatsOf(this.#walkthrough);
          // Held on a revealed encounter card until the player presses Next card: nothing moves, nothing redraws.
          if (this.#heldCard() !== null) return;
          this.#revealed = advanceReveal(this.#revealed, currentTotal);
          this.#draw();
          if (this.#revealed >= currentTotal) {
            this.#revealTimer?.remove();
            this.#revealTimer = null;
            // Catching up here is time-driven, not a store update, so nothing else is about to call
            // `#syncTiming` again on its own: without this, a phase that finished revealing between two
            // store updates (the common case — nothing happens on the table again until the player's next
            // action) would sit fully shown and `complete`, but never arm the close timer below, and stay
            // open until Skip. Regression: a defended attack that resolved the whole rest of the villain
            // phase in one command used to hang exactly this way.
            this.#syncTiming();
          }
        },
      });
    }

    /**
     * What happens once the phase is complete and every beat is shown (`settings.villainAutoAdvance`):
     *  - "off" (default): nothing. The recap stays up until the player starts the player phase (#117).
     *  - "afterPause": the recap closes itself after `VILLAIN_RECAP_PAUSE_MS`.
     *  - "on": no recap; the last beat gets one beat interval to be read, then the screen closes.
     * Reduced motion never auto-closes, whatever the setting.
     *
     * With no reveal timer the whole phase appears at once, so a close timer would give the player who asked for
     * less motion the *least* time to read it. The only ways out are the ones the player drives: Start player
     * phase, Hide (Skip), or Esc.
     */
    const mode = appSession().settings.villainAutoAdvance;
    const delay =
      mode === "on"
        ? villainBeatIntervalMs(appSession().settings.villainBeatSpeed)
        : mode === "afterPause"
          ? VILLAIN_RECAP_PAUSE_MS
          : null;
    if (!reducedMotion && delay !== null && readyToAutoClose(this.#walkthrough.complete, this.#revealed, total)) {
      this.#closeTimer ??= this.time.delayedCall(delay, () => this.#close());
    } else {
      this.#closeTimer?.remove();
      this.#closeTimer = null;
    }
  }

  /**
   * The encounter card the reveal cursor is held on ("Hold encounter cards", S1), or null. Only where the phase is
   * docked, which is where its Next card button is drawn; never under reduced motion (nothing is paced there), and
   * never while a decision is open, which the panel shows whatever the cursor says.
   */
  #heldCard(): string | null {
    const settings = appSession().settings;
    if (!settings.holdEncounterCards || settings.reducedMotion || this.#walkthrough.pausedAt) return null;
    if (this.#presentation === "full" || this.#presentation === "hidden") return null;
    const beats = this.#walkthrough.steps.flatMap((step) => step.beats);
    return encounterHoldAt(beats, this.#revealed, this.#released);
  }

  /** Next card: release the held card and show the next beat at once. */
  #nextCard(): void {
    const held = this.#heldCard();
    if (held === null) return;
    this.#released.add(held);
    this.#revealed = advanceReveal(this.#revealed, totalBeatsOf(this.#walkthrough));
    this.#syncTiming();
    this.#draw();
  }

  /** True when the finished phase is shown as the held-open recap rather than the walkthrough panel. */
  #recapShowing(reveal: Reveal): boolean {
    if (this.#review) return true;
    if (!(this.#walkthrough.complete && reveal.caughtUp)) return false;
    // "on" skips the recap, except under reduced motion where nothing may close on a timer.
    return appSession().settings.villainAutoAdvance !== "on" || appSession().settings.reducedMotion;
  }

  /** The recap's AUTO-ADVANCE toggle: OFF to "afterPause", anything else back to "off". Saved like any setting. */
  #toggleAutoAdvance(): void {
    const settings = appSession().settings;
    appSession().settings = {
      ...settings,
      villainAutoAdvance: settings.villainAutoAdvance === "off" ? "afterPause" : "off",
    };
    this.#syncTiming();
    this.#draw();
  }

  /** FULL LOG: the board's full game log lives in Pause, so this opens Pause over the recap. */
  #openFullLog(): void {
    if (this.scene.isActive(SCENES.pause)) return;
    this.scene.launch(SCENES.pause);
  }

  /** Every draw empties the card rects the hover popover reads, draws, then lets the popover rebuild where the pointer is. */
  #draw(): void {
    resetHoverCards(this);
    this.#drawNow();
    this.#hover?.onDraw();
  }

  #drawNow(): void {
    // Already fading out (Skip, Continue, Esc, or the auto-close timer) — a
    // beat arriving mid-fade must not redraw the panel out from under the tween.
    if (this.#motion.leaving) return;
    const state = this.#latest;
    if (!state?.game) return;
    const game = state.game;
    const viewer = state.perspectiveId;
    // `inspectModel` wants a real seat; every render past setup has one, and
    // the rare moment it doesn't (no perspective assigned yet) falls back to
    // whoever's actually deciding right now rather than throwing.
    const viewerId: PlayerId = viewer ?? game.firstPlayerId;

    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const formFactor = formFactorFor(width, height);
    const phone = formFactor === "phone";
    const reveal = revealOf(this.#walkthrough, this.#revealed);
    const boostCount = reveal.current?.activation?.boosts.length ?? 0;

    // Guided mode G7c (`docs/guided-mode.md` §4 "Left for G7"): on desktop/tablet landscape this full-bleed panel
    // used to draw straight over Board's own guide rail, hiding lesson 4's copy entirely — so it leaves the
    // rail's own reserved width clear instead of covering it (`BoardScene.guideRailWidth`). On a tabbed layout
    // there's no rail to leave room for, but there's also no room for the full callout — a compact bottom strip
    // (`ui/guide-strip.ts`) takes a fixed slice of the *height* instead, inside this same panel rather than a
    // separate overlay on top of it.
    const boardScene = this.#boardScene();
    const guideRailWidth = boardScene?.guideRailWidth() ?? 0;
    const guideStrip = isTabbed(formFactor) ? (boardScene?.guideStripContent() ?? null) : null;
    const stripHeight = guideStrip ? GUIDE_STRIP_HEIGHT : 0;
    const bounds: Rect = { x: guideRailWidth, y: 0, width: width - guideRailWidth, height: height - stripHeight };
    const layout = villainPhaseLayout(bounds, formFactor, boostCount);
    const pausedInline =
      this.#walkthrough.pausedAt && game.pendingChoice && inlineInterruptFor(game.pendingChoice, viewer);

    // Docked beside the table (D1/D2) unless the recap is up, the player turned the docked table off, or this form
    // factor's docked shape is not drawn yet; then the full-screen panel below.
    const recapNow = !pausedInline && this.#recapShowing(reveal);
    const kind = villainPresentationFor({
      formFactor,
      dockTable: appSession().settings.villainDockTable,
      // A tutorial's bottom guide strip lives inside the full-screen panel on a tabbed layout, so a lesson keeps it.
      recap: recapNow || guideStrip !== null,
      peeking: this.#peeking,
    });
    // The hand stays in view beside every docked shape, so it says when each card can answer (#129, #138).
    const docked = kind !== "full" && !(this.#hidden && (kind === "rail" || kind === "band"));
    boardScene?.setVillainHandTags(docked ? this.#handTags(game, viewer) : null);
    if ((kind === "rail" || kind === "band") && boardScene) {
      const inlineChoice = pausedInline ? (game.pendingChoice?.choiceId ?? null) : null;
      // A new decision of the player's own brings a hidden rail back: its answer controls live on the rail.
      if (this.#hidden && inlineChoice !== null && inlineChoice !== this.#hiddenChoice) {
        this.#hidden = false;
        this.#hiddenChoice = null;
      }
      if (this.#hidden) {
        boardScene.setVillainDock(null);
        this.#drawHiddenHandle(width);
        return;
      }
      boardScene.setVillainDock(kind, kind === "rail" ? villainDockWidthFor(width) : 0);
      const panel = boardScene.villainDockRects()?.panel;
      if (panel) {
        this.#drawRail(kind, panel, reveal, game, viewer, viewerId);
        return;
      }
    }
    if ((kind === "tab" || kind === "peek") && boardScene) {
      boardScene.setVillainDock(kind);
      const rects = boardScene.villainDockRects();
      if (rects?.footer && kind === "tab" && rects.panel) {
        this.#drawRail("tab", rects.panel, reveal, game, viewer, viewerId, rects.footer);
        return;
      }
      if (rects?.footer && kind === "peek") {
        this.#drawPeek(rects.footer, rects.banner ?? rects.footer, reveal, game, viewer, viewerId);
        return;
      }
    }
    boardScene?.setVillainDock(null);
    this.#presentation = "full";

    const scrim = this.add.graphics();
    scrim.fillStyle(surface.ink.hex, 0.7).fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    // A Graphics scrim takes no pointer, and Phaser routes a press to the scene beneath unless an interactive object
    // of this scene is under it. So every step (not only the ones whose buttons happen to sit there) lays one
    // interactive zone over everything it covers, the way Inspect, Hold on and End-turn confirm do; the strip and
    // the panel's own controls are drawn after it and take their own presses first. The Board's guide rail, left
    // clear on purpose, stays live.
    addPressShield(this, { x: bounds.x, y: 0, width: bounds.width, height });
    const panelsFrom = this.children.list.length;

    if (recapNow) {
      // A review shows the phase as it ended, not the table as it is now.
      if (this.#review) this.#drawRecap(bounds, formFactor, this.#review.after, this.#review.viewer);
      else this.#drawRecap(bounds, formFactor, game, viewer);
      this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
      return;
    }

    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    g.lineStyle(border.object, surface.paper.hex, 1);
    g.strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);

    // Header: title, skip control.
    const title = this.add
      .text(
        layout.title.x,
        layout.title.y,
        `VILLAIN PHASE — ROUND ${this.#walkthrough.round}`,
        textStyle({ ...typeRole.screenTitle }, accent.heroRed.hex),
      )
      .setOrigin(0, 0)
      .setLetterSpacing(1);
    fitText(title, layout.title.width, phone ? 22 : 34);

    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "Skip",
        type: typeRole.label,
        rect: layout.skip,
        onClick: () => this.#skip(),
      }),
    );

    label(
      this,
      layout.subtitle.x,
      layout.subtitle.y,
      this.#subtitle(reveal),
      typeRole.label,
      surface.paper.hex,
      ink.secondary,
    );

    if (!phone) this.#drawStepStrip(layout.stepStrip, reveal.steps);
    else this.#drawStepLine(layout.stepLine, reveal.steps);

    // `this.#walkthrough.pausedAt`, not `reveal.current?.pause`: the engine's own `game.pendingChoice` and this
    // are set together the instant `choiceRequested` arrives (`appendWalkthrough`), but the *reveal* cursor
    // paces beats onto the screen over time for the narration's benefit and can still be a beat or two behind on
    // the very same frame. Gating the interrupt panel on the cursor left the panel undrawn — and its "Play"/"Let
    // it resolve" buttons unbuilt — for as long as the cursor took to catch up, while `#orderAgainstChoice`
    // (keyed off `game.pendingChoice` directly, the same as here) had already put this scene on top of and taking
    // input over `ChoiceOverlay`, hiding its already-correct answer controls underneath an unfinished panel. A
    // phone Spider-Sense prompt during a busy villain-phase beat sequence could sit that way for over a second on
    // the first frame it appeared, tappable only once the cursor happened to catch up on its own.
    const pause = this.#walkthrough.pausedAt;
    const inline = pause && game.pendingChoice ? inlineInterruptFor(game.pendingChoice, viewer) : null;

    const stops = new Map<string, FocusStop>([["skip", { rect: layout.skip, activate: () => this.#skip() }]]);
    let finished: boolean;

    if (inline) {
      // The inline interrupt window takes over the whole main column (and, on
      // phone, the rail too — P09's "full-bleed interrupt") rather than
      // fighting the breakdown/queued layout for room it doesn't have.
      const mergedBottom = phone ? layout.phaseLog.y + layout.phaseLog.height : layout.queued.y + layout.queued.height;
      const merged: Rect = {
        x: layout.happeningNow.x,
        y: layout.happeningNow.y,
        width: layout.happeningNow.width,
        height: mergedBottom - layout.happeningNow.y,
      };
      this.#drawInterrupt(
        merged,
        inline,
        game,
        viewerId,
        pause!,
        formFactor,
        stops,
        // `this.#walkthrough.activation`, not `reveal.current?.activation`: the same reveal-cursor lag as `pause`
        // above (`this.#walkthrough.pausedAt`'s own comment) left this panel's source-card strip missing on the
        // first frame even once that fix showed the panel itself and its buttons.
        this.#walkthrough.activation,
      );
      if (!phone) {
        // L02's own point: the team rail stays legible behind the interrupt.
        this.#drawTeamStatus(
          layout.teamStatus,
          teamStatusOf(game, POOL_DEPS, activationTargetOf(reveal.current?.activation ?? null)),
          viewer,
        );
        this.#drawMainScheme(layout.mainScheme, mainSchemeCalloutOf(game, POOL_DEPS));
        this.#drawPhaseLog(layout.phaseLog, reveal);
      }
      // On a short viewport the footer's row falls inside the interrupt panel. All it would say while a decision is
      // open is "Waiting on the decision above.", so there it gives way rather than being drawn under the buttons.
      const footerClear = layout.footer.y >= merged.y + merged.height || layout.footer.x >= merged.x + merged.width;
      finished = footerClear ? this.#drawFooter(layout.footer, reveal) : false;
    } else {
      this.#drawHappeningNow(layout.happeningNow, reveal, game, viewer);
      this.#drawBoosts(layout.boosts, reveal.current?.activation ?? null, game, viewerId, formFactor);
      this.#drawQueued(layout.queued, queuedActivationsOf(game, POOL_DEPS), game, viewer);
      this.#drawTeamStatus(
        layout.teamStatus,
        teamStatusOf(game, POOL_DEPS, activationTargetOf(reveal.current?.activation ?? null)),
        viewer,
      );
      this.#drawMainScheme(layout.mainScheme, mainSchemeCalloutOf(game, POOL_DEPS));
      this.#drawPhaseLog(layout.phaseLog, reveal);
      finished = this.#drawFooter(layout.footer, reveal);
    }

    // Last, so the focus ring sits over the button it frames.
    if (finished) stops.set("continue", { rect: layout.footer, activate: () => this.#close() });

    // The bottom guide strip (guided mode G7c), drawn last so it sits over everything else this frame put down —
    // and its own controls registered as focus stops (§3.10, §7 accessibility fix), after Skip, so Tab/arrows and
    // Enter/A can reach Skip this step/Stop tutorial/Got it, not just Escape (which already skipped this screen's
    // own step before this fix).
    const guideStripRects = guideStrip
      ? drawGuideStrip(this, { x: 0, y: height - stripHeight, width, height: stripHeight }, guideStrip)
      : null;
    if (guideStripRects) {
      stops.set("guide-skip", { rect: guideStripRects.skip, activate: () => guideStrip!.onSkip() });
      stops.set("guide-stop", { rect: guideStripRects.stop, activate: () => guideStrip!.onStop() });
      if (guideStripRects.primary) {
        stops.set("guide-primary", { rect: guideStripRects.primary, activate: () => guideStrip!.onPrimary?.() });
      }
    }
    this.#route?.set(
      villainPhaseFocusOrder(
        finished,
        inline?.map((o) => o.optionId) ?? [],
        guideStrip ? { hasPrimary: Boolean(guideStrip.onPrimary) } : undefined,
      ),
      stops,
    );

    // Headless click-through hook only (never referenced by product code) — mirrors `scenes/board.ts`'s own
    // `__mcBoardDebug`, so a script can find the footer "Continue" button's real screen rect instead of a
    // hardcoded pixel guess or re-deriving `villainPhaseLayout`'s own math.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcVillainPhaseDebug?: unknown }).__mcVillainPhaseDebug = {
        continueRect: () => (finished ? layout.footer : null),
        skipRect: () => layout.skip,
      };
    }

    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
  }

  /** The held-open recap (D3/T3/P4): `ui/villain-recap-panel.ts` paints it; this wires it to the scene. */
  #drawRecap(bounds: Rect, formFactor: FormFactor, game: GameState, viewer: PlayerId | null): void {
    const recap = villainRecapOf(this.#walkthrough, this.#before, game, viewer, POOL_DEPS);
    const { layout, stops } = drawVillainRecapPanel(this, {
      bounds,
      formFactor,
      recap,
      game,
      autoAdvance: appSession().settings.villainAutoAdvance,
      scrolls: this.#recapScrolls,
      buttons: this.#buttons,
      onHide: () => this.#skip(),
      onFullLog: () => this.#openFullLog(),
      onToggle: () => this.#toggleAutoAdvance(),
      onStart: () => this.#close(),
      ...(this.#review ? { ctaLabel: "Close" } : {}),
    });
    // The recap is finished by definition, so Start player phase is first in the route.
    this.#route?.set(villainPhaseFocusOrder(true, [], undefined, true), stops);
    if (import.meta.env.DEV) {
      (window as unknown as { __mcVillainPhaseDebug?: unknown }).__mcVillainPhaseDebug = {
        continueRect: () => layout.cta,
        skipRect: () => layout.hide,
      };
    }
  }

  #subtitle(reveal: Reveal): string {
    if (this.#walkthrough.pausedAt) return this.#walkthrough.pausedAt.label;
    if (this.#walkthrough.complete && reveal.caughtUp) return "Villain phase complete.";
    return "Auto-advancing · Esc or Skip to jump back to the table.";
  }

  #drawStepStrip(rect: Rect, steps: readonly RevealedStep[]): void {
    const gap = 6;
    const chipWidth = (rect.width - gap * (steps.length - 1)) / steps.length;
    steps.forEach((step, index) => {
      const chip: Rect = { x: rect.x + index * (chipWidth + gap), y: rect.y, width: chipWidth, height: rect.height };
      const { fill, textColor, textAlpha } = stepChipColors(step.revealStatus);

      const cg = this.add.graphics();
      cg.fillStyle(fill, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
      cg.lineStyle(border.control, surface.paper.hex, step.revealStatus === "pending" ? 0.3 : 1);
      cg.strokeRect(chip.x, chip.y, chip.width, chip.height);

      const heading = this.add
        .text(
          chip.x + 8,
          chip.y + 6,
          `${step.number} · ${step.title}`,
          textStyle({ ...typeRole.rowTitle, size: 11 }, textColor, textAlpha),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(chip.width - 16)
        .setMaxLines(2);

      // The caption gets the lines the heading leaves, never fewer than one: at 768px wide the heading wraps to two
      // lines, and a two-line caption anchored to the chip's foot was drawn straight over it.
      const preview =
        stepCaptionOf(step.beats, this.#walkthrough.pausedAt !== null) || (step.revealStatus === "pending" ? "—" : "");
      const caption = this.add
        .text(chip.x + 8, chip.y + chip.height - 8, preview, textStyle(typeRole.label, textColor, textAlpha))
        .setOrigin(0, 1)
        .setWordWrapWidth(chip.width - 16);
      const lineHeight = caption.height / Math.max(1, caption.getWrappedText(preview).length);
      const room = chip.y + chip.height - 8 - (heading.y + heading.height + 3);
      const lines = caption.getWrappedText(preview);
      const maxLines = Math.max(1, Math.floor(room / lineHeight));
      // A cut caption says it was cut; the full sentence is the subtitle above the strip and the phase log.
      if (lines.length > maxLines) caption.setText(`${lines.slice(0, maxLines).join(" ").trimEnd()}…`);
      caption.setMaxLines(maxLines);
    });
  }

  /** Phone's compact one-line stand-in for the step strip — five bordered chips don't fit at 390px. */
  #drawStepLine(rect: Rect, steps: readonly RevealedStep[]): void {
    const activeIndex = steps.findIndex((step) => step.revealStatus === "active");
    const doneCount = steps.filter((step) => step.revealStatus === "done").length;
    const stepNumber = activeIndex >= 0 ? activeIndex + 1 : Math.min(steps.length, Math.max(1, doneCount));
    const current = steps[stepNumber - 1];
    label(
      this,
      rect.x,
      rect.y,
      `Step ${stepNumber} of ${steps.length} — ${current?.title ?? ""}`,
      typeRole.label,
      surface.paper.hex,
      ink.body,
    );
  }

  /**
   * "Happening now": the activation the current beat belongs to, as a
   * headline plus the base/boost/defense/damage (or SCH/boost/threat)
   * breakdown once it has actually resolved — every number read off
   * `activation.resolved`, never recomputed. Falls back to the plain
   * pause/narration text outside an activation (step 1, 3-5, or before the
   * phase has produced anything yet).
   */
  #drawHappeningNow(rect: Rect, reveal: Reveal, state: GameState, viewer: PlayerId | null): void {
    const pause = reveal.current?.pause ?? null;
    const activation = reveal.current?.activation ?? null;

    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(border.object, pause ? signal.caution.hex : surface.ink.hex, 1);
    g.strokeRect(rect.x, rect.y, rect.width, rect.height);

    label(
      this,
      rect.x + 14,
      rect.y + 12,
      pause ? "Auto-advance paused" : "Happening now",
      typeRole.label,
      pause ? signal.caution.hex : accent.heroRed.hex,
      1,
    );

    if (pause) {
      const bodyText = this.add
        .text(
          rect.x + 14,
          rect.y + 30,
          reveal.current?.text ?? "",
          textStyle({ ...typeRole.barTitle, size: 22 }, surface.ink.hex),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 28)
        .setMaxLines(2);
      if (pause.offer) {
        this.add
          .text(
            rect.x + 14,
            rect.y + 30 + bodyText.height + 4,
            pause.offer,
            textStyle(typeRole.body, surface.ink.hex, ink.secondary),
          )
          .setOrigin(0, 0)
          .setWordWrapWidth(rect.width - 28)
          .setMaxLines(2);
      }
      label(
        this,
        rect.x + 14,
        rect.y + rect.height - 18,
        pause.soleDecider
          ? "Peril — nobody else may act until this is answered."
          : "The pending-choice sheet has the answer controls.",
        typeRole.label,
        surface.ink.hex,
        ink.secondary,
      );
      return;
    }

    if (!activation) {
      const body = reveal.current?.text ?? (reveal.total === 0 ? "The villain phase is starting…" : "");
      this.add
        .text(rect.x + 14, rect.y + 30, body, textStyle({ ...typeRole.barTitle, size: 22 }, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 28)
        .setMaxLines(3);
      return;
    }

    const headline = this.add
      .text(
        rect.x + 14,
        rect.y + 30,
        activationHeadline(activation, state, viewer).toUpperCase(),
        textStyle({ ...typeRole.barTitle, size: 22 }, surface.ink.hex),
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width - 28)
      .setMaxLines(1);
    fitText(headline, rect.width - 28, 22);

    let cursorY = rect.y + 30 + headline.height + 8;
    const breakdown = breakdownOf(activation);
    if (breakdown) {
      cursorY += this.#drawBreakdownRow(rect.x + 14, cursorY, rect.width - 28, breakdown);
    } else {
      const narration = this.add
        .text(
          rect.x + 14,
          cursorY,
          reveal.current?.text ?? "",
          textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 28)
        .setMaxLines(2);
      cursorY += narration.height + 4;
    }

    const defenderLine = defenderLineOf(state, activation);
    if (defenderLine) {
      label(
        this,
        rect.x + 14,
        Math.min(cursorY, rect.y + rect.height - 16),
        defenderLine,
        typeRole.label,
        surface.ink.hex,
        ink.secondary,
      );
    }
  }

  /** Returns the vertical room the row used, so the caller can stack something under it. */
  #drawBreakdownRow(
    x: number,
    y: number,
    width: number,
    breakdown: { readonly cells: readonly BreakdownCell[]; readonly ops: readonly string[] },
  ): number {
    const { cells, ops } = breakdown;
    const opWidth = 22;
    const cellWidth = Math.max(1, (width - opWidth * ops.length) / cells.length);
    let cx = x;
    cells.forEach((cell, i) => {
      label(this, cx, y, cell.label, typeRole.label, surface.ink.hex, ink.secondary);
      const valueText = this.add
        .text(
          cx,
          y + 15,
          cell.value,
          textStyle({ ...typeRole.barTitle, size: 24 }, cell.emphasis ? accent.heroRed.hex : surface.ink.hex),
        )
        .setOrigin(0, 0);
      fitText(valueText, cellWidth - 4, 24);
      cx += cellWidth;
      if (i < ops.length) {
        this.add
          .text(
            cx + opWidth / 2,
            y + 19,
            ops[i]!,
            textStyle({ ...typeRole.barTitle, size: 18 }, surface.ink.hex, ink.secondary),
          )
          .setOrigin(0.5, 0);
        cx += opWidth;
      }
    });
    return 48;
  }

  /**
   * The boost cards this activation has revealed so far — face up, per
   * `boostCardFlipped` (D11/L02): each card's own scan on the left
   * (`view/villain-phase-boosts.ts` sizes it, as tall as the panel allows),
   * the same name/icon-count/rules-text column the panel always had to its
   * right, unchanged — the text stays for accessibility (colorblind-safe,
   * readable without the scan, and the fallback when a scan is missing).
   * Tapping or holding/right-clicking the art opens Inspect for that card,
   * the table's usual card gesture (`ui/hold-target.ts`).
   */
  #drawBoosts(
    rect: Rect,
    activation: ActivationBeat | null,
    state: GameState,
    viewerId: PlayerId,
    formFactor: FormFactor,
  ): void {
    const boosts = activation?.boosts ?? [];
    if (boosts.length === 0 || rect.height <= 0) return;

    const { slots, overflow } = boostCardsLayout(rect, boosts.length, formFactor);

    slots.forEach((slot, i) => {
      const boost = boosts[i]!;
      const cg = this.add.graphics();
      paintPanel(cg, slot.card, "card", "rest");

      if (slot.art.width > 0 && slot.art.height > 0) {
        const artFill = this.add.graphics();
        artFill.fillStyle(surface.parchment.hex, 1).fillRect(slot.art.x, slot.art.y, slot.art.width, slot.art.height);
        const key = cardArt(this).request(this, artFor(cardOf(state, boost.instanceId), { kind: "front" }));
        const art = drawArt(this, key, slot.art);
        if (!art) {
          this.add
            .text(
              slot.art.x + slot.art.width / 2,
              slot.art.y + slot.art.height / 2,
              "no scan",
              textStyle(typeRole.label, surface.ink.hex, ink.meta),
            )
            .setOrigin(0.5);
        }

        const zone = this.add
          .zone(slot.art.x, slot.art.y, slot.art.width, slot.art.height)
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });
        const openInspect = (): void => {
          this.scene.launch(SCENES.inspect, { instanceId: boost.instanceId });
        };
        bindHoldTarget(this, zone, { key: boost.instanceId as string, onTap: openInspect, onInspect: openInspect });
      }

      if (slot.text.width <= 0) return;
      const { x: textX, y: textY, width: textWidth } = slot.text;
      label(this, textX, textY, `BOOST CARD ${i + 1}`, typeRole.label, surface.ink.hex, ink.label);
      const model = inspectModel(state, boost.instanceId, null, viewerId, POOL_DEPS);
      const nameText = this.add
        .text(
          textX,
          textY + 14,
          model.name.toUpperCase(),
          textStyle({ ...typeRole.rowTitle, size: 13 }, surface.ink.hex),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(textWidth)
        .setMaxLines(1);
      fitText(nameText, textWidth, 13);

      const status =
        boost.cancelled === "icons"
          ? "Icons cancelled — 0 added."
          : boost.cancelled === "discarded"
            ? "Discarded instead — not applied."
            : boost.cancelled === "ability"
              ? `${boost.boostIcons} icon${boost.boostIcons === 1 ? "" : "s"} · Boost ability cancelled.`
              : `${boost.boostIcons} icon${boost.boostIcons === 1 ? "" : "s"}.`;
      const statusText = this.add
        .text(
          textX,
          nameText.y + nameText.height + 2,
          status,
          textStyle(typeRole.label, surface.ink.hex, ink.secondary),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(textWidth)
        .setMaxLines(1);

      this.add
        .text(textX, statusText.y + statusText.height + 2, model.rulesText, textStyle(typeRole.body, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(textWidth)
        .setMaxLines(
          Math.max(0, Math.floor((slot.card.y + slot.card.height - (statusText.y + statusText.height + 2)) / 14)),
        );
    });

    if (overflow > 0) {
      label(
        this,
        rect.x + rect.width - 70,
        rect.y + rect.height - 14,
        `+${overflow} more`,
        typeRole.label,
        surface.ink.hex,
        ink.secondary,
      );
    }
  }

  /** "Queued this phase" (S5.8/§3 W7): the engine's own order, straight off `queuedActivationsOf`. */
  #drawQueued(rect: Rect, seats: readonly QueuedSeat[], state: GameState, viewer: PlayerId | null): void {
    if (rect.height <= 0) return;
    label(this, rect.x, rect.y, "QUEUED THIS PHASE", typeRole.label, surface.paper.hex, ink.label);
    const top = rect.y + 18;

    if (seats.length === 0) {
      this.add
        .text(
          rect.x,
          top,
          "Nothing else queued this phase.",
          textStyle(typeRole.body, surface.paper.hex, ink.secondary),
        )
        .setOrigin(0, 0);
      return;
    }

    const rowHeight = 20;
    const rows = Math.max(0, Math.floor((rect.height - 18) / rowHeight));
    seats.slice(0, rows).forEach((seat, i) => {
      const y = top + i * rowHeight;
      this.add
        .text(
          rect.x,
          y,
          queuedSeatLine(seat, state, viewer),
          textStyle(typeRole.body, surface.paper.hex, ink.secondary),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width)
        .setMaxLines(1);
    });
    if (seats.length > rows) {
      label(
        this,
        rect.x,
        top + rows * rowHeight,
        `+${seats.length - rows} more seat${seats.length - rows === 1 ? "" : "s"}`,
        typeRole.label,
        surface.paper.hex,
        ink.meta,
      );
    }
  }

  /**
   * "TEAM STATUS" (L02, tablet only — zero height everywhere else, so this is
   * a no-op on desktop and phone): every seat's HP, with whoever the current
   * activation targets picked out, the same way a Team tab row would.
   */
  #drawTeamStatus(rect: Rect, rows: readonly TeamStatusRow[], viewer: PlayerId | null): void {
    if (rect.height <= 0) return;
    label(this, rect.x, rect.y, "TEAM STATUS", typeRole.label, surface.paper.hex, ink.label);

    const rowHeight = 44;
    const top = rect.y + 18;
    const rows_ = Math.max(0, Math.floor((rect.height - 18) / rowHeight));
    rows.slice(0, rows_).forEach((row, i) => {
      const y = top + i * rowHeight;
      const g = this.add.graphics();
      g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, y, rect.width, rowHeight - 6);
      g.lineStyle(border.control, row.targeted ? accent.heroRed.hex : surface.ink.hex, row.targeted ? 2 : 1);
      g.strokeRect(rect.x, y, rect.width, rowHeight - 6);

      const seat = row.seat;
      const isYou = seat.playerId === viewer;
      const heading = row.targeted ? "TARGETED" : isYou ? "YOU" : null;
      label(
        this,
        rect.x + 8,
        y + 4,
        heading ? `${seat.name.toUpperCase()} · ${heading}` : seat.name.toUpperCase(),
        typeRole.label,
        surface.ink.hex,
        row.targeted ? accent.heroRed.hex : ink.secondary,
      );

      if (seat.eliminated) {
        label(
          this,
          rect.x + 8,
          y + 18,
          seat.sittingOut ? "Sitting out" : "Defeated",
          typeRole.label,
          surface.ink.hex,
          ink.secondary,
        );
        return;
      }
      if (!seat.hp) return;
      const barWidth = rect.width - 16 - 44;
      const barY = y + 22;
      // `signal.heal` fills proportional to *remaining* HP, matching `McHpPlate`'s own meter (`board/zones.ts`).
      const ratio = seat.hp.max > 0 ? Math.max(0, Math.min(1, seat.hp.current / seat.hp.max)) : 0;
      const bg = this.add.graphics();
      bg.fillStyle(surface.ink.hex, 0.15).fillRect(rect.x + 8, barY, barWidth, 8);
      bg.fillStyle(signal.heal.hex, 1).fillRect(rect.x + 8, barY, barWidth * ratio, 8);
      label(
        this,
        rect.x + 8 + barWidth + 6,
        barY - 3,
        `${seat.hp.current}/${seat.hp.max}`,
        typeRole.label,
        surface.ink.hex,
        ink.secondary,
      );
    });
  }

  /** The main-scheme threat callout ("11 / 12 threat — one more and the scenario is lost"): rail top on wide layouts, a slim banner on phone. */
  #drawMainScheme(rect: Rect, callout: MainSchemeCallout): void {
    if (rect.height <= 0) return;
    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(border.object, surface.ink.hex, 1);
    g.strokeRect(rect.x, rect.y, rect.width, rect.height);

    label(this, rect.x + 12, rect.y + 8, "MAIN SCHEME", typeRole.label, surface.ink.hex, ink.label);
    const lineText = this.add
      .text(
        rect.x + 12,
        rect.y + 22,
        callout.line.toUpperCase(),
        textStyle({ ...typeRole.barTitle, size: 20 }, surface.ink.hex),
      )
      .setOrigin(0, 0);
    fitText(lineText, rect.width - 24, 20);

    if (callout.panel.target !== null && callout.panel.meterMax) {
      const barY = rect.y + 22 + lineText.height + 4;
      const barWidth = rect.width - 24;
      const ratio = Math.min(1, callout.panel.threat / callout.panel.meterMax);
      const bg = this.add.graphics();
      bg.fillStyle(surface.ink.hex, 0.15).fillRect(rect.x + 12, barY, barWidth, 8);
      bg.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x + 12, barY, barWidth * ratio, 8);
    }

    if (callout.warning) {
      this.add
        .text(rect.x + 12, rect.y + rect.height - 16, callout.warning, textStyle(typeRole.label, accent.heroRed.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 24)
        .setMaxLines(1);
    }
  }

  #drawPhaseLog(rect: Rect, reveal: Reveal): void {
    if (rect.height <= 0) return;
    label(this, rect.x, rect.y, "PHASE LOG", typeRole.label, surface.paper.hex, ink.label);

    const rowHeight = 18;
    const top = rect.y + 16;
    const rows = Math.max(0, Math.floor((rect.height - 16) / rowHeight));
    const all = reveal.steps.flatMap((step) => step.beats.map((beat) => ({ step, beat })));
    // The most recent entry is already the "happening now" beat; the log is
    // everything before it, most recent first.
    const history = all
      .slice(0, Math.max(0, all.length - 1))
      .reverse()
      .slice(0, rows);

    // A long line wraps (two lines at most) instead of being cut mid-name; rows stack by their real height.
    let y = top;
    for (const entry of history) {
      if (y + rowHeight > rect.y + rect.height) break;
      label(this, rect.x, y, `${entry.step.number}.`, typeRole.label, surface.paper.hex, ink.meta);
      const line = this.add
        .text(rect.x + 18, y, entry.beat.text, textStyle(typeRole.body, surface.paper.hex, ink.secondary))
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 24)
        .setMaxLines(2);
      y += Math.max(rowHeight, line.height + 4);
    }
  }

  /**
   * The inline interrupt window (D11/P09/L02): the viewer's own legal
   * interrupt(s), shown as real cards with a play button, plus "Let it
   * resolve" — both dispatch through `#resolve`, the same `resolveChoice`
   * the full choice sheet would use for the same option ids.
   */
  #drawInterrupt(
    rect: Rect,
    options: readonly InlineInterruptOption[],
    state: GameState,
    viewerId: PlayerId,
    pause: Pause,
    formFactor: FormFactor,
    stops: Map<string, FocusStop>,
    activation: ActivationBeat | null,
  ): void {
    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(border.object, signal.caution.hex, 1);
    g.strokeRect(rect.x, rect.y, rect.width, rect.height);

    label(
      this,
      rect.x + 14,
      rect.y + 12,
      windowTitleOf(pause.timing).toUpperCase(),
      typeRole.label,
      surface.ink.hex,
      ink.label,
    );
    // A short panel (a phone on its side) has no height to stack a two-line title, the cards and a full-width
    // "Let it resolve" — the cards were left a sliver and their text ran under both buttons. There the title takes
    // one line and the resolve button stands beside the cards instead of under them.
    const short = rect.height < INTERRUPT_SHORT_PANEL;

    // What this window is actually about — the enemy attacking or scheming, so the player isn't left staring at
    // "your interrupt window" with no idea which activation it belongs to. Normally `#drawHappeningNow` says this,
    // but it doesn't draw at all while this panel is up (`#draw`'s own `inline` branch) — and `activation` is a more
    // precise answer than a `chooseTriggers` window frame's own candidate would be (that names one of the player's
    // *own* interruptible cards, not the thing being interrupted; see `view/choice-source-panel.ts`'s own comment on
    // why the villain phase sources this from the walkthrough's tracked activation instead). Skipped on the
    // shortest panel (a phone on its side) — there is no height to spare there even for a compact strip.
    let bodyTop = rect.y + 28;
    if (activation && !short) {
      // The same height `scenes/choice.ts` reserves for its own strip: a thumbnail any shorter reads as a
      // featureless colored square rather than a recognizable card (found reading a screenshot at this scale —
      // 52px tall left a ~26×36px thumbnail, too small to show anything more than a tint).
      const strip = sourceStripPlacement({
        x: rect.x + 14,
        y: bodyTop,
        width: rect.width - 28,
        // Taller than the choice sheet's strip: this one carries a headline and a whole Forced Response.
        height: SOURCE_STRIP_HEIGHT + 24,
      });
      const sourcePanel = sourceCardPanelFor(
        state,
        activation.enemyInstanceId,
        viewerId,
        POOL_DEPS,
        activationHeadline(activation, state, viewerId),
      );
      drawSourceCardPanel(this, strip, sourcePanel, () =>
        this.scene.launch(SCENES.inspect, { instanceId: activation.enemyInstanceId }),
      );
      bodyTop = strip.strip.y + strip.strip.height + 8;
    }

    const bodyText = this.add
      .text(
        rect.x + 14,
        bodyTop,
        pause.label,
        textStyle({ ...typeRole.barTitle, size: short ? 14 : 18 }, surface.ink.hex),
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width - 28)
      .setMaxLines(short ? 1 : 2);

    const resolveHeight = hit.primary;
    const cardsTop = bodyText.y + bodyText.height + (short ? 8 : 12);
    const besideWidth = short ? Math.round((rect.width - 28) * 0.3) : 0;
    const cardsArea: Rect = short
      ? {
          x: rect.x + 14,
          y: cardsTop,
          width: rect.width - 28 - besideWidth - 12,
          height: Math.max(0, rect.y + rect.height - 12 - cardsTop),
        }
      : {
          x: rect.x + 14,
          y: cardsTop,
          width: rect.width - 28,
          height: Math.max(0, rect.y + rect.height - 12 - resolveHeight - 12 - cardsTop),
        };
    const slots = interruptCardsLayout(cardsArea, options.length, formFactor, hit.target);

    // Two or more optional triggers are one multi-select: the buttons toggle and one control answers.
    const multi = !inlineSingle(options);
    const picks = this.#livePicksFor(state, options);
    const toggle = (optionId: string): void => this.#togglePick(state, options, optionId);

    options.forEach((option, i) => {
      const slot = slots[i];
      if (!slot) return;
      // The side that prints the ability on offer (an identity's alter-ego interrupt shows the alter-ego), else the live one.
      const face = abilityFaceOf(state, option.instanceId, option.abilityId);
      const model = inspectModel(state, option.instanceId, null, viewerId, POOL_DEPS, { face });
      const cg = this.add.graphics();
      paintPanel(cg, slot.card, "card", "rest");

      if (slot.art.width > 0 && slot.art.height > 0) {
        const artFill = this.add.graphics();
        artFill.fillStyle(surface.parchment.hex, 1).fillRect(slot.art.x, slot.art.y, slot.art.width, slot.art.height);
        const key = cardArt(this).request(this, artFor(cardOf(state, option.instanceId), face));
        if (!drawArt(this, key, slot.art)) {
          this.add
            .text(
              slot.art.x + slot.art.width / 2,
              slot.art.y + slot.art.height / 2,
              "no scan",
              textStyle(typeRole.label, surface.ink.hex, ink.meta),
            )
            .setOrigin(0.5);
        }
        const zone = this.add
          .zone(slot.art.x, slot.art.y, slot.art.width, slot.art.height)
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });
        const openInspect = (): void => {
          this.scene.launch(SCENES.inspect, { instanceId: option.instanceId });
        };
        bindHoldTarget(this, zone, { key: `interrupt:${option.optionId}`, onTap: openInspect, onInspect: openInspect });
      }

      const { x: textX, y: textY, width: textWidth, height: textHeight } = slot.text;
      const nameText = this.add
        .text(textX, textY, model.name, textStyle({ ...typeRole.rowTitle, size: 16 }, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(textWidth)
        .setMaxLines(1);
      fitText(nameText, textWidth, 16);
      const typeText = this.add
        .text(
          textX,
          textY + nameText.height + 2,
          model.typeLine,
          textStyle(typeRole.label, surface.ink.hex, ink.secondary),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(textWidth)
        .setMaxLines(1);
      const rulesTop = typeText.y + typeText.height + 6;
      // `setMaxLines(0)` means "no limit" to Phaser, not "no lines": with no room, the text is not drawn at all.
      const rulesLines = Math.floor((textY + textHeight - rulesTop) / 15);
      if (rulesLines >= 1) {
        // The ability on offer first (`abilityFirst`), and a pointer at the card when the text is cut.
        const trigger = option.abilityId ? POOL_DEPS.abilities[option.abilityId]?.trigger : undefined;
        const rulesText = trigger ? abilityFirst(model.rulesText, triggerLabel(trigger)) : model.rulesText;
        const rules = this.add
          .text(textX, rulesTop, rulesText, textStyle(typeRole.body, surface.ink.hex))
          .setOrigin(0, 0)
          .setWordWrapWidth(textWidth);
        if (rules.getWrappedText(rulesText).length > rulesLines) {
          const shown = Math.max(1, rulesLines - 1);
          rules.setMaxLines(shown);
          label(
            this,
            textX,
            rulesTop + shown * 15,
            "Tap the card to read it all",
            typeRole.label,
            surface.ink.hex,
            ink.label,
          );
        }
      }
      if (typeText.y + typeText.height > textY + textHeight) typeText.setVisible(false);

      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: multi
            ? inlinePickLabel(interruptActionLabel(state, option), picks, option.optionId)
            : interruptActionLabel(state, option),
          type: typeRole.label,
          rect: slot.button,
          onClick: () => (multi ? toggle(option.optionId) : this.#resolve([option.optionId])),
        }),
      );
      stops.set(`interrupt:${option.optionId}`, {
        rect: slot.button,
        activate: () => (multi ? toggle(option.optionId) : this.#resolve([option.optionId])),
      });
    });

    const resolveRect: Rect = short
      ? {
          x: rect.x + rect.width - 14 - besideWidth,
          y: cardsArea.y + cardsArea.height - resolveHeight,
          width: besideWidth,
          height: resolveHeight,
        }
      : { x: rect.x + 14, y: rect.y + rect.height - 12 - resolveHeight, width: rect.width - 28, height: resolveHeight };
    this.#buttons.push(
      new McButton(this, {
        kind: multi && picks.length > 0 ? "primary" : "secondary",
        label: multi ? inlineConfirmLabel(state, options, picks) : "Let it resolve",
        type: typeRole.barTitle,
        rect: resolveRect,
        onClick: () => this.#resolve(multi ? picks : []),
      }),
    );
    stops.set("resolve", { rect: resolveRect, activate: () => this.#resolve(multi ? picks : []) });
  }

  /** The options picked so far in the inline window, reset when the decision changes. */
  #livePicksFor(state: GameState, options: readonly InlineInterruptOption[]): readonly string[] {
    const choiceId = state.pendingChoice?.choiceId ?? null;
    if (this.#picksFor !== choiceId) {
      this.#picksFor = choiceId;
      this.#picks = [];
    }
    return livePicks(this.#picks, options);
  }

  #togglePick(state: GameState, options: readonly InlineInterruptOption[], optionId: string): void {
    const maxPicks = state.pendingChoice?.maxSelections ?? options.length;
    this.#picks = toggleInlinePick(this.#livePicksFor(state, options), optionId, maxPicks);
    this.#draw();
  }

  /**
   * The docked rail (D1/D2), or the band across the villain row on a tablet in landscape (T1): the table and the hand
   * stay live beside or below it. The press shield covers
   * the panel only, so the table keeps its presses, and there is no scrim: the table is there to be read.
   */
  #drawRail(
    kind: "rail" | "band" | "tab",
    panel: Rect,
    reveal: Reveal,
    game: GameState,
    viewer: PlayerId | null,
    viewerId: PlayerId,
    footer: Rect | null = null,
  ): void {
    this.#presentation = kind;
    const pause = this.#walkthrough.pausedAt;
    let inline = pause && game.pendingChoice ? inlineInterruptFor(game.pendingChoice, viewer) : null;
    const strip = this.#encounterStrip(reveal, game, viewer);
    const revealing = reveal.steps[3]?.revealStatus === "active" && strip !== null && strip.tiles.length > 0;
    const subject = (revealing ? strip?.current : null) ?? this.#walkthrough.activation?.enemyInstanceId ?? null;
    // Before START, even the player's own interrupt waits: the gate takes the window's place.
    const gate = this.#gate(game, viewer, subject);
    if (gate?.kind === "start") inline = null;
    const input = {
      panel,
      revealing,
      interruptOptions: inline?.length ?? (gate ? 1 : 0),
      cardScale: cardSizeFactor(appSession().settings.cardSize),
    };
    const layout =
      kind === "rail"
        ? villainRailLayout(input)
        : kind === "band"
          ? villainBandLayout(input)
          : villainTabLayout({ ...input, footer: footer ?? panel });

    addPressShield(this, panel);
    // On a phone the answer takes the action bar's place: the bar underneath must not take the press.
    if (kind === "tab" && footer && (inline || gate)) addPressShield(this, footer);
    const panelsFrom = this.children.list.length;

    const active = reveal.steps.find((step) => step.revealStatus === "active");
    const subtitle =
      gate?.kind === "start"
        ? "Waiting for you to start"
        : pause
          ? pause.label
          : this.#walkthrough.complete && reveal.caughtUp
            ? "Villain phase complete."
            : active
              ? `Step ${active.number} of ${reveal.steps.length} · ${active.title}`
              : "The villain phase is starting…";

    const current = revealing ? strip.current : null;
    const body: RailBody = current
      ? {
          kind: "reveal",
          instanceId: current,
          footnote: `Dealt to ${strip!.tiles.find((tile) => tile.instanceId === current)?.seat ?? "you"}`,
        }
      : this.#happeningBody(reveal, game, viewer, inline !== null);

    const all = reveal.steps.flatMap((step) => step.beats.map((beat) => ({ step: step.number, text: beat.text })));
    const log = all.slice(0, Math.max(0, all.length - 1)).reverse();

    const stops = drawVillainRailPanel(this, {
      layout,
      game,
      viewerId,
      round: this.#walkthrough.round,
      subtitle,
      steps: reveal.steps,
      paused: pause !== null,
      strip: revealing ? strip : null,
      body,
      interrupt:
        inline && pause
          ? {
              options: inline,
              pause,
              picks: this.#livePicksFor(game, inline),
              onPick: (optionId) => this.#togglePick(game, inline, optionId),
              onResolve: (ids) => this.#resolve(ids),
            }
          : null,
      gate,
      onGateDrawn: (objects) => this.#slideNotice(objects, panel),
      log,
      onNext: this.#heldCard() !== null ? () => this.#nextCard() : null,
      autoAdvance: appSession().settings.villainAutoAdvance,
      buttons: this.#buttons,
      onSkip: () => this.#skip(),
      onHide: () => (kind === "tab" ? this.#setPeeking(true) : this.#setHidden(true)),
      onToggle: () => this.#toggleAutoAdvance(),
      onInspect: (instanceId) => this.scene.launch(SCENES.inspect, { instanceId }),
    });

    this.#route?.set(villainRailFocusOrder(inline?.map((o) => o.optionId) ?? [], stops.has("next")), stops);
    if (import.meta.env.DEV) {
      (window as unknown as { __mcVillainPhaseDebug?: unknown }).__mcVillainPhaseDebug = {
        continueRect: () => null,
        skipRect: () => layout.skip,
        hideRect: () => layout.hide,
        peekRect: () => (kind === "tab" ? layout.hide : null),
        panelRect: () => panel,
        presentation: () => this.#presentation,
        useRect: () => layout.interrupt?.use ?? null,
        nextRect: () => stops.get("next")?.rect ?? null,
        resolveRect: () => (inline ? (layout.interrupt?.resolve ?? null) : null),
        startRect: () => stops.get("start")?.rect ?? null,
        answerRect: () => stops.get("answer")?.rect ?? null,
      };
    }
    // Slides in from its edge as the phase begins (the right on desktop, the top on a tablet in landscape, the bottom
    // on a phone or a tablet in portrait); a redraw mid-slide picks up where it had got to.
    const objects = this.children.list.slice(panelsFrom);
    this.#motion.enter(this, { scrim: [], panels: [] });
    this.#slideStartedAt ??= this.time.now;
    const { width, height } = this.scale.gameSize;
    const edge = villainSlideEdge(formFactorFor(width, height));
    const viewport: Rect = { x: 0, y: 0, width, height };
    slideIn(this, objects, slideOffset(edge, panel, viewport), this.time.now - this.#slideStartedAt);
  }

  /** "Happening now" on the rail: the activation (the live one while paused, so the window never names a stale beat), else the latest narration. */
  #happeningBody(reveal: Reveal, game: GameState, viewer: PlayerId | null, paused: boolean): RailBody {
    const activation = paused ? this.#walkthrough.activation : (reveal.current?.activation ?? null);
    if (!activation) {
      return {
        kind: "happening",
        enemyInstanceId: null,
        headline: reveal.current?.text ?? (reveal.total === 0 ? "The villain phase is starting…" : ""),
        text: "",
        boostLine: null,
      };
    }
    const boosts = activation.boosts.map((boost) => cardName(game, boost.instanceId));
    const breakdown = breakdownLineOf(activation);
    const defender = defenderLineOf(game, activation);
    return {
      kind: "happening",
      enemyInstanceId: activation.enemyInstanceId,
      headline: activationHeadline(activation, game, viewer),
      text: [breakdown ?? (paused ? "" : (reveal.current?.text ?? "")), defender ?? ""].filter(Boolean).join(" "),
      boostLine:
        boosts.length > 0
          ? `Boost: ${boosts.join(", ")}`
          : activation.resolved
            ? null
            : "Boost card facedown · flips after interrupts",
    };
  }

  /** The encounter cards of this phase as far as the screen has shown them; null before any was dealt. */
  #encounterStrip(reveal: Reveal, game: GameState, viewer: PlayerId | null): EncounterStrip | null {
    const encounter = this.#walkthrough.encounter;
    if (encounter.dealt.length === 0 && encounter.revealed.length === 0) return null;
    const shown = reveal.steps.flatMap((step) => step.beats.map((beat) => beat.encounterInstanceId ?? null));
    return encounterStripOf(
      encounter,
      shown,
      viewer,
      (instanceId) => cardName(game, instanceId),
      (playerId) => seatName(game, playerId, viewer),
    );
  }

  /**
   * Peeking at the table (P3): the board and its tabs are the player's; the phase keeps a banner over the bottom of
   * the board with what it waits on and BACK, and, when the decision is the player's own, its two answers in the
   * action bar's place.
   */
  #drawPeek(
    footer: Rect,
    banner: Rect,
    reveal: Reveal,
    game: GameState,
    viewer: PlayerId | null,
    viewerId: PlayerId,
  ): void {
    this.#presentation = "peek";
    const layout = villainPeekLayout(banner);
    const pause = this.#walkthrough.pausedAt;
    let inline = pause && game.pendingChoice ? inlineInterruptFor(game.pendingChoice, viewer) : null;
    const peekStrip = this.#encounterStrip(reveal, game, viewer);
    const gate = this.#gate(game, viewer, peekStrip?.current ?? this.#walkthrough.activation?.enemyInstanceId ?? null);
    if (gate?.kind === "start") inline = null;
    addPressShield(this, layout.banner);
    if (inline || gate) addPressShield(this, footer);
    const panelsFrom = this.children.list.length;
    const stops = new Map<string, FocusStop>();

    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(
      layout.banner.x,
      layout.banner.y,
      layout.banner.width,
      layout.banner.height,
    );
    g.lineStyle(border.object, signal.caution.hex, 1);
    g.strokeRect(layout.banner.x, layout.banner.y, layout.banner.width, layout.banner.height);

    const strip = this.#encounterStrip(reveal, game, viewer);
    const active = reveal.steps.find((step) => step.revealStatus === "active");
    const position = active?.kind === "revealEncounterCards" && strip?.position ? strip.position : null;
    const heading = [
      "Villain phase",
      active ? `Step ${active.number}` : null,
      position ? `${position.index} of ${position.total}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    // What the phase waits on (the revealed card or the attacking enemy) and the card the player would answer with.
    const subject =
      position && strip?.current ? strip.current : (this.#walkthrough.activation?.enemyInstanceId ?? null);
    const option = inline?.[0] ?? null;
    const thumbOf = option?.instanceId ?? subject;
    if (thumbOf) {
      const fill = this.add.graphics();
      fill
        .fillStyle(surface.paper.hex, 1)
        .fillRect(layout.thumb.x, layout.thumb.y, layout.thumb.width, layout.thumb.height);
      const art = inspectModel(game, thumbOf, null, viewerId, POOL_DEPS).art;
      drawArt(this, cardArt(this).request(this, art), layout.thumb);
      const frame = this.add.graphics();
      frame.lineStyle(border.object, signal.caution.hex, 1);
      frame.strokeRect(layout.thumb.x, layout.thumb.y, layout.thumb.width, layout.thumb.height);
      // Inspectable like every other card the phase shows: tap, hold or right-click.
      const zone = this.add
        .zone(layout.thumb.x, layout.thumb.y, layout.thumb.width, layout.thumb.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const open = (): void => {
        this.scene.launch(SCENES.inspect, { instanceId: thumbOf });
      };
      bindHoldTarget(this, zone, { key: `peek:${thumbOf}`, onTap: open, onInspect: open });
    }
    const textX = thumbOf ? layout.text.x : layout.thumb.x;
    const textWidth = layout.text.x + layout.text.width - textX;
    const headingText = label(
      this,
      textX,
      layout.text.y,
      heading,
      { ...typeRole.label, size: 11 },
      signal.caution.hex,
      1,
    );
    fitText(headingText, textWidth, 11);
    const line =
      gate?.kind === "start"
        ? "The villain phase waits for you to start it"
        : gate?.kind === "decision"
          ? gate.title.replace(/ · /, ": ")
          : inline
            ? `${subject ? cardName(game, subject) : "The villain phase"} waits on your answer`
            : (reveal.current?.text ?? "The villain phase is running.");
    const main = this.add
      .text(textX, layout.text.y + 20, line, textStyle({ ...typeRole.rowTitle, size: 16 }, surface.paper.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(textWidth)
      .setMaxLines(2);
    if (option) {
      const detail = label(
        this,
        textX,
        main.y + main.height + 6,
        `${abilityName(game, option)} · ${game.players.some((p) => p.hand.includes(option.instanceId)) ? "from your hand" : "in play"}`,
        { ...typeRole.label, size: 10 },
        surface.paper.hex,
        ink.secondary,
      );
      fitText(detail, textWidth, 10);
    }

    const back = (): void => this.#setPeeking(false);
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Back ▴",
        type: typeRole.label,
        rect: layout.back,
        onClick: back,
      }),
    );
    stops.set("back", { rect: layout.back, activate: back });

    if (gate) {
      const rect: Rect = {
        x: footer.x + 8,
        y: footer.y + 6,
        width: footer.width - 16,
        height: Math.max(hit.target, footer.height - 12),
      };
      const ground = this.add.graphics();
      ground.fillStyle(surface.ink.hex, 1).fillRect(footer.x, footer.y, footer.width, footer.height);
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: gate.kind === "start" ? "Start villain phase ▸" : "Answer ▸",
          type: { ...typeRole.barTitle, size: 22 },
          rect,
          tint: { fill: signal.caution.hex, ink: surface.ink.hex },
          onClick: gate.onPress,
        }),
      );
      stops.set(gate.kind === "start" ? "start" : "answer", { rect, activate: gate.onPress });
    } else if (inline && pause) {
      const resolveWidth = Math.round((footer.width - 24) * 0.38);
      const height = Math.max(hit.target, footer.height - 12);
      drawInterruptAnswer(
        this,
        {
          use: { x: footer.x + 8, y: footer.y + 6, width: footer.width - 24 - resolveWidth, height },
          resolve: { x: footer.x + footer.width - 8 - resolveWidth, y: footer.y + 6, width: resolveWidth, height },
        },
        game,
        {
          options: inline,
          pause,
          picks: this.#livePicksFor(game, inline),
          onPick: (optionId) => this.#togglePick(game, inline, optionId),
          onResolve: (ids) => this.#resolve(ids),
        },
        this.#buttons,
        stops,
        { thumb: true },
      );
    }

    this.#route?.set(
      [
        ...villainRailFocusOrder(inline?.map((o) => o.optionId) ?? []).filter(
          (key) => key !== "start" && key !== "answer",
        ),
        "start",
        "answer",
        "back",
      ],
      stops,
    );
    if (import.meta.env.DEV) {
      (window as unknown as { __mcVillainPhaseDebug?: unknown }).__mcVillainPhaseDebug = {
        continueRect: () => null,
        skipRect: () => null,
        backRect: () => layout.back,
        presentation: () => this.#presentation,
        useRect: () => stops.get(`interrupt:${inline?.[0]?.optionId}`)?.rect ?? stops.get("confirm")?.rect ?? null,
        resolveRect: () => stops.get("resolve")?.rect ?? null,
        startRect: () => stops.get("start")?.rect ?? null,
        answerRect: () => stops.get("answer")?.rect ?? null,
      };
    }
    this.#motion.enter(this, { scrim: [], panels: this.children.list.slice(panelsFrom) });
  }

  /** A held decision's notice slides in from the panel's right edge the first time it is drawn, like a notification. */
  #slideNotice(objects: readonly Phaser.GameObjects.GameObject[], panel: Rect): void {
    const id = this.#heldChoiceId();
    if (id === null || !this.#started) return;
    const shownAt = this.#noticeShownAt.get(id) ?? this.time.now;
    this.#noticeShownAt.set(id, shownAt);
    slideIn(this, objects, { dx: panel.width, dy: 0 }, this.time.now - shownAt);
  }

  /** The rail while hidden: a handle at the table's right edge that brings it back. */
  #drawHiddenHandle(width: number): void {
    this.#presentation = "hidden";
    const rect: Rect = { x: width - 16 - 220, y: 72, width: 220, height: hit.target };
    const show = (): void => this.#setHidden(false);
    this.#buttons.push(
      new McButton(this, { kind: "onInk", label: "◂ Villain phase", type: typeRole.label, rect, onClick: show }),
    );
    this.#route?.set(["show"], new Map([["show", { rect, activate: show }]]));
    if (import.meta.env.DEV) {
      (window as unknown as { __mcVillainPhaseDebug?: unknown }).__mcVillainPhaseDebug = {
        continueRect: () => null,
        skipRect: () => null,
        showRect: () => rect,
        presentation: () => this.#presentation,
      };
    }
    this.#motion.enter(this, { scrim: [], panels: this.children.list.slice() });
  }

  /** Returns true when the phase is over and Continue is showing. */
  #drawFooter(rect: Rect, reveal: Reveal): boolean {
    const done = this.#walkthrough.complete && reveal.caughtUp;
    const paused = this.#walkthrough.pausedAt !== null;

    if (done) {
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Continue",
          type: typeRole.barTitle,
          rect,
          onClick: () => this.#close(),
        }),
      );
      return true;
    }

    label(
      this,
      rect.x,
      rect.y + rect.height / 2 - 6,
      paused ? "Waiting on the decision above." : "Auto-advancing…",
      typeRole.label,
      surface.paper.hex,
      ink.meta,
    );
    return false;
  }
}

function stepChipColors(status: StepStatus): { fill: number; textColor: number; textAlpha: number } {
  switch (status) {
    case "done":
      return { fill: signal.heal.hex, textColor: surface.paper.hex, textAlpha: 1 };
    case "active":
      return { fill: accent.heroRed.hex, textColor: surface.paper.hex, textAlpha: 1 };
    default:
      return { fill: surface.ink.hex, textColor: surface.paper.hex, textAlpha: ink.disabled };
  }
}
