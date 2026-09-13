/**
 * The villain phase, drawn as the design's auto-advancing walkthrough
 * (PLAN.md Phase 4, "villain phase as a walkthrough").
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
 * this screen's pauses *are* an open `PendingChoice`. `ChoiceOverlay` is the
 * one that actually collects the answer; this screen only narrates. So:
 *  - This screen never renders its own answer controls. When paused, it shows
 *    the same "Auto-advance paused ..." label the choice sheet also has
 *    available (`decisionLabel`/`pauseFor` share their reasoning), and defers.
 *  - Whenever a `pendingChoice` is open and `ChoiceOverlay` is running, this
 *    scene calls `this.scene.bringToTop(SCENES.choice)` on every state update.
 *    That makes the choice sheet win the top z-order regardless of which
 *    overlay Board happened to `launch` more recently, so the thing the player
 *    must act on is never hidden behind the thing that's just narrating.
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
import { accent, border, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton, fitText, label } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { formFactorFor } from "../view/layout.js";
import { revealOf, type Reveal, type RevealedStep } from "../view/villain-phase-reveal.js";
import { appendWalkthrough, emptyWalkthrough, type StepStatus, type Walkthrough } from "../view/villain-walkthrough.js";
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

  #onState(state: SessionState): void {
    if (!state.game || state.game.outcome) {
      // No game, or the game just ended: Game Over owns the screen from here.
      this.scene.stop();
      return;
    }

    if (state.version !== this.#version) {
      this.#version = state.version;
      const before = totalBeatsOf(this.#walkthrough);
      this.#walkthrough = appendWalkthrough(this.#walkthrough, state.lastEvents, state.game, state.perspectiveId);
      const after = totalBeatsOf(this.#walkthrough);
      // A fresh villain phase clears the previous one's beats (the walkthrough
      // shows one phase at a time) — the reveal cursor follows suit.
      if (after < before) this.#revealed = 0;
    }

    this.#latest = state;
    this.#syncTiming();

    // The pending-choice overlay is what actually collects an answer; it must
    // never be hidden behind this screen while one is open.
    if (state.game.pendingChoice && this.scene.isActive(SCENES.choice)) {
      this.scene.bringToTop(SCENES.choice);
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

    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    const margin = phone ? 8 : 28;
    const panel: Rect = { x: margin, y: margin, width: width - margin * 2, height: height - margin * 2 };
    const pad = phone ? 12 : 24;

    const scrim = this.add.graphics();
    scrim.fillStyle(surface.ink.hex, 0.7).fillRect(0, 0, width, height);

    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(panel.x, panel.y, panel.width, panel.height);
    g.lineStyle(border.object, surface.paper.hex, 1);
    g.strokeRect(panel.x, panel.y, panel.width, panel.height);

    const reveal = revealOf(this.#walkthrough, this.#revealed);
    let cursorY = panel.y + pad;

    // Header: title, skip control.
    const skipWidth = 96;
    const title = this.add
      .text(panel.x + pad, cursorY, `VILLAIN PHASE — ROUND ${this.#walkthrough.round}`, textStyle({ ...typeRole.screenTitle }, accent.heroRed.hex))
      .setOrigin(0, 0)
      .setLetterSpacing(1);
    fitText(title, panel.width - pad * 2 - skipWidth - 12, phone ? 22 : 34);

    const skipRect: Rect = { x: panel.x + panel.width - pad - skipWidth, y: cursorY, width: skipWidth, height: hit.target };
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "Skip",
        type: typeRole.label,
        rect: skipRect,
        onClick: () => this.#skip(),
      }),
    );

    cursorY += Math.max(title.height, hit.target) + 6;
    label(this, panel.x + pad, cursorY, this.#subtitle(reveal), typeRole.label, surface.paper.hex, ink.secondary);
    cursorY += 20;

    // Step strip: full chips on wide layouts, a single compact line on phone —
    // five bordered chips at 390px are too narrow to read (Board - Phone's own
    // reasoning for the tab rail applies here too).
    if (!phone) {
      const stripHeight = 58;
      this.#drawStepStrip({ x: panel.x + pad, y: cursorY, width: panel.width - pad * 2, height: stripHeight }, reveal.steps);
      cursorY += stripHeight + 14;
    } else {
      const activeIndex = reveal.steps.findIndex((step) => step.revealStatus === "active");
      const doneCount = reveal.steps.filter((step) => step.revealStatus === "done").length;
      const stepNumber = activeIndex >= 0 ? activeIndex + 1 : Math.min(5, Math.max(1, doneCount));
      const current = reveal.steps[stepNumber - 1];
      label(
        this,
        panel.x + pad,
        cursorY,
        `Step ${stepNumber} of 5 — ${current?.title ?? ""}`,
        typeRole.label,
        surface.paper.hex,
        ink.body,
      );
      cursorY += 20;
    }

    // Happening now / pause banner. Taller than a plain beat needs, because a
    // pause also carries an "Options: ..." line naming what is actually on
    // offer (see `#drawHappeningNow`).
    const nowHeight = phone ? 128 : 168;
    const nowRect: Rect = { x: panel.x + pad, y: cursorY, width: panel.width - pad * 2, height: nowHeight };
    this.#drawHappeningNow(nowRect, reveal);
    cursorY += nowHeight + 12;

    // Phase log: whatever vertical room is left, above the footer.
    const footerHeight = hit.primary + 8;
    const logHeight = panel.y + panel.height - pad - footerHeight - cursorY;
    if (logHeight > 40) {
      this.#drawPhaseLog({ x: panel.x + pad, y: cursorY, width: panel.width - pad * 2, height: logHeight }, reveal);
    }

    // Footer.
    const footerRect: Rect = {
      x: panel.x + pad,
      y: panel.y + panel.height - pad - hit.primary,
      width: panel.width - pad * 2,
      height: hit.primary,
    };
    const finished = this.#drawFooter(footerRect, reveal);

    // Last, so the focus ring sits over the button it frames.
    const stops = new Map<string, FocusStop>([["skip", { rect: skipRect, activate: () => this.#skip() }]]);
    if (finished) stops.set("continue", { rect: footerRect, activate: () => this.scene.stop() });
    this.#route?.set(villainPhaseFocusOrder(finished), stops);
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

  #drawHappeningNow(rect: Rect, reveal: Reveal): void {
    const pause = reveal.current?.pause ?? null;

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

    const body = reveal.current?.text ?? (reveal.total === 0 ? "The villain phase is starting…" : "");
    const bodyText = this.add
      .text(rect.x + 14, rect.y + 30, body, textStyle({ ...typeRole.barTitle, size: 22 }, surface.ink.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width - 28)
      .setMaxLines(pause ? 2 : 3);

    if (pause) {
      // What is actually being offered (the attack it names, the cards it
      // lists) — straight from `pause.offer` (`view/villain-walkthrough.ts`),
      // never invented here. The pending-choice sheet still collects the
      // answer; this only says, before the player opens that sheet, what
      // there is to decide.
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
        pause.soleDecider
          ? "Peril — nobody else may act until this is answered."
          : "The pending-choice sheet has the answer controls.",
        typeRole.label,
        surface.ink.hex,
        ink.secondary,
      );
    }
  }

  #drawPhaseLog(rect: Rect, reveal: Reveal): void {
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
