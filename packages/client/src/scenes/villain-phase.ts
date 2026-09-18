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
 * The Board scene must launch this overlay with a bare, payload-free call,
 * exactly once per villain phase:
 *
 *   if (
 *     !this.scene.isActive(SCENES.villainPhase) &&
 *     state.lastEvents.some((e) => e.type === "stepChanged" && e.to.phase === "villain" && e.to.kind === "placeThreat")
 *   ) {
 *     this.scene.launch(SCENES.villainPhase);
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
 *    by subscribing to the store directly. Board passes nothing and is told
 *    nothing back.
 *
 * COEXISTENCE WITH THE PENDING-CHOICE OVERLAY (`scenes/choice.ts`)
 * ---------------------------------------------------------------------------
 * Both overlays run in parallel over Board and may be open at once — most of
 * this screen's pauses *are* an open `PendingChoice`. `ChoiceOverlay` is
 * normally the one that actually collects the answer; this screen only
 * narrates, and shows the same "Auto-advance paused ..." label the choice
 * sheet also has available (`decisionLabel`/`pauseFor` share their
 * reasoning). Whenever a `pendingChoice` is open and `ChoiceOverlay` is
 * running, this scene calls `this.scene.bringToTop(SCENES.choice)` on every
 * state update, so the thing the player must act on is never hidden behind
 * the thing that's just narrating.
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
 * "Skip" (button, top right) and Esc (or B on a pad) both call `this.scene.stop()` and do
 * nothing else — Board's own state is untouched, the actual game keeps
 * running underneath exactly as it would with this screen open. Because the
 * launch condition only fires on step one, skipping mid-phase does not get
 * this screen re-opened by a later step change in the same phase.
 *
 * SELF-CLOSING
 * ---------------------------------------------------------------------------
 * This scene watches the same store Board does. Once the walkthrough reports
 * `complete` and every beat it knows about has been revealed, the screen shows
 * a "Continue" button and, at normal motion, also closes itself after a short
 * pause — so an unattended screen doesn't sit there forever, but a player who
 * wants the last word can still act on it before the timer does. Under reduced
 * motion there is no such timer (see REDUCED MOTION below). Similarly, if `state.game`
 * disappears or the game ends (`state.game.outcome`), the scene stops itself
 * without waiting to be told.
 *
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
import { cardOf, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { accent, border, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton, fitText, label, paintPanel } from "../ui/widgets.js";
import { inspectModel } from "../view/inspect-model.js";
import type { Rect } from "../view/layout.js";
import { formFactorFor } from "../view/layout.js";
import { cardName, seatName } from "../view/names.js";
import { revealOf, type Reveal, type RevealedStep } from "../view/villain-phase-reveal.js";
import { villainPhaseLayout } from "../view/villain-phase-layout.js";
import { mainSchemeCalloutOf, type MainSchemeCallout } from "../view/villain-main-scheme.js";
import { queuedActivationsOf, type QueuedSeat } from "../view/villain-queue.js";
import { teamStatusOf, type TeamStatusRow } from "../view/villain-team-status.js";
import {
  appendWalkthrough,
  emptyWalkthrough,
  inlineInterruptFor,
  type ActivationBeat,
  type InlineInterruptOption,
  type Pause,
  type StepStatus,
  type Walkthrough,
} from "../view/villain-walkthrough.js";
import { villainPhaseFocusOrder } from "../view/screen-focus.js";
import { appSession } from "../session.js";
import type { SessionState } from "../store/session-store.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

/** How often a new beat is revealed while auto-advancing at normal motion. */
const REVEAL_INTERVAL_MS = 550;
/**
 * How long the finished screen waits before closing itself, at normal motion.
 *
 * Long enough to read the last beat that just landed: beats arrive every
 * `REVEAL_INTERVAL_MS`, so a tail shorter than a beat or two would take the
 * final one off the screen faster than the player was reading the ones before
 * it. Under reduced motion the screen does not auto-close at all — see
 * `#syncTiming`.
 */
const AUTO_CLOSE_DELAY_MS = 2600;

const totalBeatsOf = (walkthrough: Walkthrough): number => walkthrough.steps.reduce((sum, step) => sum + step.beats.length, 0);

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
function breakdownOf(activation: ActivationBeat): { readonly cells: readonly BreakdownCell[]; readonly ops: readonly string[] } | null {
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

  constructor() {
    super({ key: SCENES.villainPhase });
  }

  create(): void {
    this.#walkthrough = emptyWalkthrough(1);
    this.#revealed = 0;
    this.#version = -2;

    const { store } = appSession();
    this.#unsubscribe = store.subscribe((state) => this.#onState(state));
    const onResize = (): void => this.#draw();
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
      blocked: () => this.scene.isActive(SCENES.choice) || this.scene.isActive(SCENES.inspect),
      onCancel: () => this.#skip(),
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#revealTimer?.remove();
      this.#revealTimer = null;
      this.#closeTimer?.remove();
      this.#closeTimer = null;
    });
  }

  #skip(): void {
    this.scene.stop();
  }

  /** Submits an inline interrupt answer exactly as the choice overlay would (`resolveChoice`) — an empty selection is "let it resolve". */
  #resolve(selectedOptionIds: readonly string[]): void {
    void appSession().store.resolveChoice(selectedOptionIds);
  }

  #onState(state: SessionState): void {
    if (!state.game || state.game.outcome) {
      // No game, or the game just ended: Game Over owns the screen from here.
      this.scene.stop();
      return;
    }

    if (state.version !== this.#version) {
      this.#version = state.version;
      const before = totalBeatsOf(this.#walkthrough);
      this.#walkthrough = appendWalkthrough(this.#walkthrough, state.lastEvents, state.game, state.perspectiveId, POOL_DEPS);
      const after = totalBeatsOf(this.#walkthrough);
      // A fresh villain phase clears the previous one's beats (the walkthrough
      // shows one phase at a time) — the reveal cursor follows suit.
      if (after < before) this.#revealed = 0;
    }

    this.#latest = state;
    this.#syncTiming();

    // The pending-choice overlay normally wins the top z-order so the thing
    // the player must act on is never hidden behind the thing that's just
    // narrating — except the one case this screen answers inline itself
    // (see the class doc comment), where this screen stays on top instead so
    // its own "Play"/"Let it resolve" controls are the ones that get the
    // click.
    if (state.game.pendingChoice && this.scene.isActive(SCENES.choice)) {
      const inline = inlineInterruptFor(state.game.pendingChoice, state.perspectiveId);
      if (inline) this.scene.bringToTop();
      else this.scene.bringToTop(SCENES.choice);
    }

    this.#draw();
  }

  #syncTiming(): void {
    const reducedMotion = appSession().settings.reducedMotion;
    const total = totalBeatsOf(this.#walkthrough);

    if (reducedMotion) {
      this.#revealTimer?.remove();
      this.#revealTimer = null;
      this.#revealed = total;
    } else if (this.#revealed < total && !this.#revealTimer) {
      this.#revealTimer = this.time.addEvent({
        delay: REVEAL_INTERVAL_MS,
        loop: true,
        callback: () => {
          const currentTotal = totalBeatsOf(this.#walkthrough);
          this.#revealed = Math.min(this.#revealed + 1, currentTotal);
          this.#draw();
          if (this.#revealed >= currentTotal) {
            this.#revealTimer?.remove();
            this.#revealTimer = null;
          }
        },
      });
    }

    const caughtUp = this.#revealed >= total;
    /**
     * Reduced motion never auto-closes.
     *
     * With no reveal timer the whole phase appears at once, so a close timer
     * would give the player who asked for less motion the *least* time to read
     * it — the screen would land complete and vanish a moment later. That is
     * the opposite of this scene's stated reduced-motion contract ("the player
     * reads at their own pace rather than a timer's"), so the only ways out
     * here are the ones the player drives: Continue, Skip, or Esc.
     */
    if (this.#walkthrough.complete && caughtUp && !reducedMotion) {
      this.#closeTimer ??= this.time.delayedCall(AUTO_CLOSE_DELAY_MS, () => this.scene.stop());
    } else {
      this.#closeTimer?.remove();
      this.#closeTimer = null;
    }
  }

  #draw(): void {
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
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const formFactor = formFactorFor(width, height);
    const phone = formFactor === "phone";
    const layout = villainPhaseLayout({ x: 0, y: 0, width, height }, formFactor);

    const scrim = this.add.graphics();
    scrim.fillStyle(surface.ink.hex, 0.7).fillRect(0, 0, width, height);

    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    g.lineStyle(border.object, surface.paper.hex, 1);
    g.strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);

    const reveal = revealOf(this.#walkthrough, this.#revealed);

    // Header: title, skip control.
    const title = this.add
      .text(layout.title.x, layout.title.y, `VILLAIN PHASE — ROUND ${this.#walkthrough.round}`, textStyle({ ...typeRole.screenTitle }, accent.heroRed.hex))
      .setOrigin(0, 0)
      .setLetterSpacing(1);
    fitText(title, layout.title.width, phone ? 22 : 34);

    this.#buttons.push(new McButton(this, { kind: "onInk", label: "Skip", type: typeRole.label, rect: layout.skip, onClick: () => this.#skip() }));

    label(this, layout.subtitle.x, layout.subtitle.y, this.#subtitle(reveal), typeRole.label, surface.paper.hex, ink.secondary);

    if (!phone) this.#drawStepStrip(layout.stepStrip, reveal.steps);
    else this.#drawStepLine(layout.stepLine, reveal.steps);

    const pause = reveal.current?.pause ?? null;
    const inline = pause && game.pendingChoice ? inlineInterruptFor(game.pendingChoice, viewer) : null;

    const stops = new Map<string, FocusStop>([["skip", { rect: layout.skip, activate: () => this.#skip() }]]);
    let finished: boolean;

    if (inline) {
      // The inline interrupt window takes over the whole main column (and, on
      // phone, the rail too — P09's "full-bleed interrupt") rather than
      // fighting the breakdown/queued layout for room it doesn't have.
      const mergedBottom = phone ? layout.phaseLog.y + layout.phaseLog.height : layout.queued.y + layout.queued.height;
      const merged: Rect = { x: layout.happeningNow.x, y: layout.happeningNow.y, width: layout.happeningNow.width, height: mergedBottom - layout.happeningNow.y };
      this.#drawInterrupt(merged, inline, game, viewerId, pause!, stops);
      if (!phone) {
        // L02's own point: the team rail stays legible behind the interrupt.
        this.#drawTeamStatus(layout.teamStatus, teamStatusOf(game, POOL_DEPS, activationTargetOf(reveal.current?.activation ?? null)), viewer);
        this.#drawMainScheme(layout.mainScheme, mainSchemeCalloutOf(game, POOL_DEPS));
        this.#drawPhaseLog(layout.phaseLog, reveal);
      }
      finished = this.#drawFooter(layout.footer, reveal);
    } else {
      this.#drawHappeningNow(layout.happeningNow, reveal, game, viewer);
      this.#drawBoosts(layout.boosts, reveal.current?.activation ?? null, game, viewerId);
      this.#drawQueued(layout.queued, queuedActivationsOf(game, POOL_DEPS), game, viewer);
      this.#drawTeamStatus(layout.teamStatus, teamStatusOf(game, POOL_DEPS, activationTargetOf(reveal.current?.activation ?? null)), viewer);
      this.#drawMainScheme(layout.mainScheme, mainSchemeCalloutOf(game, POOL_DEPS));
      this.#drawPhaseLog(layout.phaseLog, reveal);
      finished = this.#drawFooter(layout.footer, reveal);
    }

    // Last, so the focus ring sits over the button it frames.
    if (finished) stops.set("continue", { rect: layout.footer, activate: () => this.scene.stop() });
    this.#route?.set(villainPhaseFocusOrder(finished, inline?.map((o) => o.optionId) ?? []), stops);
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
        .text(chip.x + 8, chip.y + 6, `${step.number} · ${step.title}`, textStyle({ ...typeRole.rowTitle, size: 11 }, textColor, textAlpha))
        .setOrigin(0, 0)
        .setWordWrapWidth(chip.width - 16);
      fitText(heading, chip.width - 16, 11);

      const preview = step.beats[step.beats.length - 1]?.text ?? (step.revealStatus === "pending" ? "—" : "");
      this.add
        .text(chip.x + 8, chip.y + chip.height - 8, preview, textStyle(typeRole.label, textColor, textAlpha))
        .setOrigin(0, 1)
        .setWordWrapWidth(chip.width - 16);
    });
  }

  /** Phone's compact one-line stand-in for the step strip — five bordered chips don't fit at 390px. */
  #drawStepLine(rect: Rect, steps: readonly RevealedStep[]): void {
    const activeIndex = steps.findIndex((step) => step.revealStatus === "active");
    const doneCount = steps.filter((step) => step.revealStatus === "done").length;
    const stepNumber = activeIndex >= 0 ? activeIndex + 1 : Math.min(steps.length, Math.max(1, doneCount));
    const current = steps[stepNumber - 1];
    label(this, rect.x, rect.y, `Step ${stepNumber} of ${steps.length} — ${current?.title ?? ""}`, typeRole.label, surface.paper.hex, ink.body);
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

    label(this, rect.x + 14, rect.y + 12, pause ? "Auto-advance paused" : "Happening now", typeRole.label, pause ? signal.caution.hex : accent.heroRed.hex, 1);

    if (pause) {
      const bodyText = this.add
        .text(rect.x + 14, rect.y + 30, reveal.current?.text ?? "", textStyle({ ...typeRole.barTitle, size: 22 }, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 28)
        .setMaxLines(2);
      if (pause.offer) {
        this.add
          .text(rect.x + 14, rect.y + 30 + bodyText.height + 4, pause.offer, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
          .setOrigin(0, 0)
          .setWordWrapWidth(rect.width - 28)
          .setMaxLines(2);
      }
      label(
        this,
        rect.x + 14,
        rect.y + rect.height - 18,
        pause.soleDecider ? "Peril — nobody else may act until this is answered." : "The pending-choice sheet has the answer controls.",
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
      .text(rect.x + 14, rect.y + 30, activationHeadline(activation, state, viewer).toUpperCase(), textStyle({ ...typeRole.barTitle, size: 22 }, surface.ink.hex))
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
        .text(rect.x + 14, cursorY, reveal.current?.text ?? "", textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 28)
        .setMaxLines(2);
      cursorY += narration.height + 4;
    }

    // RRG "Defend": an ally's DEF never reduces the attack — "readable from
    // `defenderDeclared`" without waiting for the resolved beat.
    if (activation.kind === "attack" && activation.defender && !activation.defender.declined && activation.defender.instanceId) {
      const defenderId = activation.defender.instanceId;
      if (cardOf(state, defenderId)?.type === "ally") {
        label(this, rect.x + 14, Math.min(cursorY, rect.y + rect.height - 16), `${cardName(state, defenderId)} defended — no DEF reduction.`, typeRole.label, surface.ink.hex, ink.secondary);
      }
    }
  }

  /** Returns the vertical room the row used, so the caller can stack something under it. */
  #drawBreakdownRow(x: number, y: number, width: number, breakdown: { readonly cells: readonly BreakdownCell[]; readonly ops: readonly string[] }): number {
    const { cells, ops } = breakdown;
    const opWidth = 22;
    const cellWidth = Math.max(1, (width - opWidth * ops.length) / cells.length);
    let cx = x;
    cells.forEach((cell, i) => {
      label(this, cx, y, cell.label, typeRole.label, surface.ink.hex, ink.secondary);
      const valueText = this.add
        .text(cx, y + 15, cell.value, textStyle({ ...typeRole.barTitle, size: 24 }, cell.emphasis ? accent.heroRed.hex : surface.ink.hex))
        .setOrigin(0, 0);
      fitText(valueText, cellWidth - 4, 24);
      cx += cellWidth;
      if (i < ops.length) {
        this.add
          .text(cx + opWidth / 2, y + 19, ops[i]!, textStyle({ ...typeRole.barTitle, size: 18 }, surface.ink.hex, ink.secondary))
          .setOrigin(0.5, 0);
        cx += opWidth;
      }
    });
    return 48;
  }

  /** The boost cards this activation has revealed so far — face up, per `boostCardFlipped` (D11/L02). */
  #drawBoosts(rect: Rect, activation: ActivationBeat | null, state: GameState, viewerId: PlayerId): void {
    const boosts = activation?.boosts ?? [];
    if (boosts.length === 0 || rect.height <= 0) return;

    const gap = 10;
    const maxShown = Math.min(boosts.length, rect.width > 480 ? 3 : 2);
    const cardWidth = (rect.width - gap * (maxShown - 1)) / maxShown;

    boosts.slice(0, maxShown).forEach((boost, i) => {
      const cardRect: Rect = { x: rect.x + i * (cardWidth + gap), y: rect.y, width: cardWidth, height: rect.height };
      const cg = this.add.graphics();
      paintPanel(cg, cardRect, "card", "rest");

      label(this, cardRect.x + 10, cardRect.y + 6, `BOOST CARD ${i + 1}`, typeRole.label, surface.ink.hex, ink.label);
      const model = inspectModel(state, boost.instanceId, null, viewerId, POOL_DEPS);
      const nameText = this.add
        .text(cardRect.x + 10, cardRect.y + 20, model.name.toUpperCase(), textStyle({ ...typeRole.rowTitle, size: 13 }, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(cardRect.width - 20)
        .setMaxLines(1);
      fitText(nameText, cardRect.width - 20, 13);

      const status =
        boost.cancelled === "icons"
          ? "Icons cancelled — 0 added."
          : boost.cancelled === "ability"
            ? `${boost.boostIcons} icon${boost.boostIcons === 1 ? "" : "s"} · Boost ability cancelled.`
            : `${boost.boostIcons} icon${boost.boostIcons === 1 ? "" : "s"}.`;
      const statusText = this.add
        .text(cardRect.x + 10, cardRect.y + 20 + nameText.height + 2, status, textStyle(typeRole.label, surface.ink.hex, ink.secondary))
        .setOrigin(0, 0)
        .setWordWrapWidth(cardRect.width - 20)
        .setMaxLines(1);

      this.add
        .text(cardRect.x + 10, statusText.y + statusText.height + 2, model.rulesText, textStyle(typeRole.body, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(cardRect.width - 20)
        .setMaxLines(Math.max(0, Math.floor((cardRect.height - (statusText.y + statusText.height + 2 - cardRect.y)) / 14)));
    });

    if (boosts.length > maxShown) {
      label(this, rect.x + rect.width - 70, rect.y + rect.height - 14, `+${boosts.length - maxShown} more`, typeRole.label, surface.ink.hex, ink.secondary);
    }
  }

  /** "Queued this phase" (S5.8/§3 W7): the engine's own order, straight off `queuedActivationsOf`. */
  #drawQueued(rect: Rect, seats: readonly QueuedSeat[], state: GameState, viewer: PlayerId | null): void {
    if (rect.height <= 0) return;
    label(this, rect.x, rect.y, "QUEUED THIS PHASE", typeRole.label, surface.paper.hex, ink.label);
    const top = rect.y + 18;

    if (seats.length === 0) {
      this.add
        .text(rect.x, top, "Nothing else queued this phase.", textStyle(typeRole.body, surface.paper.hex, ink.secondary))
        .setOrigin(0, 0);
      return;
    }

    const rowHeight = 20;
    const rows = Math.max(0, Math.floor((rect.height - 18) / rowHeight));
    seats.slice(0, rows).forEach((seat, i) => {
      const y = top + i * rowHeight;
      this.add
        .text(rect.x, y, queuedSeatLine(seat, state, viewer), textStyle(typeRole.body, surface.paper.hex, ink.secondary))
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width)
        .setMaxLines(1);
    });
    if (seats.length > rows) {
      label(this, rect.x, top + rows * rowHeight, `+${seats.length - rows} more seat${seats.length - rows === 1 ? "" : "s"}`, typeRole.label, surface.paper.hex, ink.meta);
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
      label(this, rect.x + 8, y + 4, heading ? `${seat.name.toUpperCase()} · ${heading}` : seat.name.toUpperCase(), typeRole.label, surface.ink.hex, row.targeted ? accent.heroRed.hex : ink.secondary);

      if (seat.eliminated) {
        label(this, rect.x + 8, y + 18, "Defeated", typeRole.label, surface.ink.hex, ink.secondary);
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
      label(this, rect.x + 8 + barWidth + 6, barY - 3, `${seat.hp.current}/${seat.hp.max}`, typeRole.label, surface.ink.hex, ink.secondary);
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
      .text(rect.x + 12, rect.y + 22, callout.line.toUpperCase(), textStyle({ ...typeRole.barTitle, size: 20 }, surface.ink.hex))
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
    const history = all.slice(0, Math.max(0, all.length - 1)).reverse().slice(0, rows);

    history.forEach((entry, index) => {
      const y = top + index * rowHeight;
      label(this, rect.x, y, `${entry.step.number}.`, typeRole.label, surface.paper.hex, ink.meta);
      this.add
        .text(rect.x + 18, y, entry.beat.text, textStyle(typeRole.body, surface.paper.hex, ink.secondary))
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 24)
        .setMaxLines(1);
    });
  }

  /**
   * The inline interrupt window (D11/P09/L02): the viewer's own legal
   * interrupt(s), shown as real cards with a play button, plus "Let it
   * resolve" — both dispatch through `#resolve`, the same `resolveChoice`
   * the full choice sheet would use for the same option ids.
   */
  #drawInterrupt(rect: Rect, options: readonly InlineInterruptOption[], state: GameState, viewerId: PlayerId, pause: Pause, stops: Map<string, FocusStop>): void {
    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(border.object, signal.caution.hex, 1);
    g.strokeRect(rect.x, rect.y, rect.width, rect.height);

    label(this, rect.x + 14, rect.y + 12, "YOUR INTERRUPT WINDOW", typeRole.label, surface.ink.hex, ink.label);
    const bodyText = this.add
      .text(rect.x + 14, rect.y + 28, pause.label, textStyle({ ...typeRole.barTitle, size: 18 }, surface.ink.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width - 28)
      .setMaxLines(2);

    const resolveHeight = hit.primary;
    let cardY = rect.y + 28 + bodyText.height + 12;
    const roomForCards = Math.max(0, rect.y + rect.height - 12 - resolveHeight - 12 - cardY);
    const cardHeight = Math.max(80, Math.min(150, roomForCards / Math.max(1, options.length) - 10));

    for (const option of options) {
      const model = inspectModel(state, option.instanceId, null, viewerId, POOL_DEPS);
      const cardRect: Rect = { x: rect.x + 14, y: cardY, width: rect.width - 28, height: cardHeight };
      const cg = this.add.graphics();
      paintPanel(cg, cardRect, "card", "rest");

      const nameText = this.add
        .text(cardRect.x + 12, cardRect.y + 10, model.name, textStyle({ ...typeRole.rowTitle, size: 16 }, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(cardRect.width - 200);
      fitText(nameText, cardRect.width - 200, 16);
      this.add
        .text(cardRect.x + 12, cardRect.y + 10 + nameText.height + 2, model.typeLine, textStyle(typeRole.label, surface.ink.hex, ink.secondary))
        .setOrigin(0, 0);
      this.add
        .text(cardRect.x + 12, cardRect.y + 10 + nameText.height + 20, model.rulesText, textStyle(typeRole.body, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(cardRect.width - 24)
        .setMaxLines(Math.max(1, Math.floor((cardHeight - 40) / 15)));

      const buttonWidth = Math.min(180, cardRect.width - 24);
      const buttonRect: Rect = { x: cardRect.x + cardRect.width - buttonWidth - 12, y: cardRect.y + cardRect.height - hit.target - 8, width: buttonWidth, height: hit.target };
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: `Play ${model.name}`,
          type: typeRole.label,
          rect: buttonRect,
          onClick: () => this.#resolve([option.optionId]),
        }),
      );
      stops.set(`interrupt:${option.optionId}`, { rect: buttonRect, activate: () => this.#resolve([option.optionId]) });

      cardY += cardHeight + 10;
    }

    const resolveRect: Rect = { x: rect.x + 14, y: rect.y + rect.height - 12 - resolveHeight, width: rect.width - 28, height: resolveHeight };
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "Let it resolve", type: typeRole.barTitle, rect: resolveRect, onClick: () => this.#resolve([]) }));
    stops.set("resolve", { rect: resolveRect, activate: () => this.#resolve([]) });
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
          onClick: () => this.scene.stop(),
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
