/**
 * The Board's motion: state-change beats floating off a card, and ghosts of
 * cards traveling between zones.
 *
 * Both are held as data with a start time rather than as game objects, because
 * every Board draw clears the display list. Each draw re-creates whatever is
 * still live, already partway through, at its anchor's current position.
 */

import type Phaser from "phaser";
import { cardOf, getPlayer, type GameEvent, type InstanceId, type PlayerId, type ZoneId } from "@mc/engine";
import { artFor, CARD_BACKS, type ArtSource } from "../../art/art-source.js";
import { drawArt } from "../../art/card-art.js";
import { appSession } from "../../session.js";
import { accent, motion, signal, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { onTap } from "../../ui/tap.js";
import { fitText, hatchRect } from "../../ui/widgets.js";

/** How long a table announcement holds once it is on screen. */
const BANNER_MS = 3600;

/** A band crossing the table: the phase/round band, or a hero's level-up band. */
type WipeStyle = "phase" | "levelUp";

/** One band on its way across the table (`#playWipe`). */
interface WipeEntry {
  readonly caption: string;
  /** When the band starts to slide in — later than it landed, for the opening band (`wipeTimingFor`), and moved
   * on to the moment the table is uncovered if an overlay was over it when its time came (`drawPhaseWipe`). */
  startedAt: number;
  readonly holdMs: number;
  /** Its time came while an overlay covered the table, and it hasn't been on screen yet. */
  deferred: boolean;
  /** The durable record of this band (`debugPhaseBandLog`). */
  readonly log: PhaseBandLogEntry;
}

/** A level-up band holds longer than a phase band: it is the hero's moment, and her card just changed under it. */
const LEVEL_UP_HOLD_MS = 2000;

const WIPE_COLORS: Record<
  WipeStyle,
  {
    readonly ground: number;
    /** A hatch over the ground, or none. */
    readonly hatch: number | null;
    /** The top and bottom edges, in segments that repeat these colors in order. */
    readonly stripes: readonly number[];
    readonly title: number;
    readonly stroke: number;
    readonly heightScale: number;
  }
> = {
  phase: {
    ground: surface.ink.hex,
    hatch: null,
    stripes: [accent.heroRed.hex],
    title: surface.paper.hex,
    stroke: accent.heroRed.hex,
    heightScale: 1,
  },
  // Ironheart's armor: crimson and magenta plates, gold trim and the cyan glow of her repulsors, on a night-sky band.
  levelUp: {
    ground: 0x1d1240,
    hatch: 0xe0338a,
    stripes: [accent.heroRed.hex, signal.caution.hex, 0x2fc7e8, 0xe0338a],
    title: signal.caution.hex,
    stroke: 0xe0338a,
    heightScale: 1.25,
  },
};
import { beatsFrom, type Beat } from "../../view/beats.js";
import { faceOf } from "../../view/board-model.js";
import { dealtPileParts } from "../../view/dealt-pile.js";
import { exhaustMotionsFrom, type ExhaustDirection } from "../../view/exhaust-motion.js";
import { defeatFlashesFrom, hpTicksFrom, type HpTick } from "../../view/hp-motion.js";
import type { BoardLayout, Rect } from "../../view/layout.js";
import { clampedProgress, lerp } from "../../view/motion-math.js";
import {
  PHASE_POP_MS,
  PHASE_WIPE_HOLD_MS,
  PHASE_WIPE_REDUCED_MS,
  phaseTransitionFrom,
  wipeTimingFor,
  wipeFrame,
  type PhaseTransition,
} from "../../view/phase-wipe.js";
import { statusGhostsFrom, statusStampsFrom, type StatusName } from "../../view/status-motion.js";
import { threatTicksFrom, type ThreatTick } from "../../view/threat-motion.js";
import { DRAW_SPREAD_MAX_MS, handArrivalsFrom, travelsFrom, type Travel } from "../../view/travel.js";
import { pileKey, type BoardFrame } from "./context.js";

/** A status pip/tag just stamped on or fading off — `character-panel.ts` reads this to animate in place. */
export interface StatusStampState {
  readonly progress: number;
  readonly remainingMs: number;
}

/** A status still fading off after `statusRemoved`, with which status it was. */
export interface StatusGhostState extends StatusStampState {
  readonly status: StatusName;
}

/** A card-shaped panel's exhaust turn in progress. */
export interface ExhaustMotionState {
  readonly direction: ExhaustDirection;
  readonly progress: number;
  readonly remainingMs: number;
}

/** An HP counting tween in progress. */
export interface HpTickState {
  readonly tick: HpTick;
  readonly progress: number;
  readonly remainingMs: number;
}

/** A Hero Red border flash in progress. */
export interface DefeatFlashState {
  readonly progress: number;
  readonly remainingMs: number;
}

/** A threat meter counting tween in progress. */
export interface ThreatTickState {
  readonly tick: ThreatTick;
  readonly progress: number;
  readonly remainingMs: number;
}

/** How long the band is on screen from its start: slide in + hold + slide out (`view/phase-wipe.ts#wipeFrame`), or
 * the reduced-motion caption's own hold, stretched the same way for a longer-holding band. */
function wipeTotalMs(holdMs: number): number {
  return appSession().settings.reducedMotion
    ? PHASE_WIPE_REDUCED_MS + (holdMs - PHASE_WIPE_HOLD_MS)
    : motion.phaseWipeMs * 2 + holdMs;
}

/** One phase/round band in `Motion.debugPhaseBandLog`. */
export interface PhaseBandLogEntry {
  readonly caption: string;
  wasDeferred: boolean;
  played: boolean;
}

export class BoardMotion {
  readonly #scene: Phaser.Scene;
  /** Beats still floating, with when each started, so a redraw doesn't kill them. */
  #beats: { readonly beat: Beat; readonly startedAt: number }[] = [];
  /**
   * `cardMoved` events from the most recently landed *fresh* state, waiting
   * for the one draw that can turn them into travels — the first draw after
   * they land is the only point that has both this frame's hit rects ("where a
   * card is now") and the frame before it ("where a card was"). Consumed and
   * cleared by `startTravels`.
   */
  #pendingMoves: readonly GameEvent[] = [];
  /**
   * Hand cards whose ghost has not landed yet, by when it does: their slot stays empty until then (`isArriving`), so a
   * drawn card is seen to come from the deck rather than to be there already. Set when the command lands, before the
   * first draw that could show them, and tightened to the real landing time by `startTravels`.
   */
  #arriving = new Map<InstanceId, number>();
  /** The last clock reading `needsRedraw` looked at: a ghost starting or landing between two readings wants a redraw. */
  #lastWake = 0;
  /** A draw whose ghost could not be placed let its card go: the hand redraws once so the slot is not left empty. */
  #wakeNow = false;
  /** Travels still in flight, with when each started — the same trick as beats, so a redraw mid-flight re-derives the ghost's position instead of losing it. */
  #travels: { readonly travel: Travel; readonly startedAt: number }[] = [];

  /**
   * Full-table announcements ("SPIDER-MAN IS DOWN"), oldest first. Unlike a
   * beat, one only starts its clock once it is actually on screen: a hero is
   * usually defeated in the villain phase, under the walkthrough overlay, and
   * a banner that timed out behind it would be the silence it exists to end.
   */
  #banners: { readonly title: string; readonly detail: string; shownAt: number | null }[] = [];
  #bannerPoll: Phaser.Time.TimerEvent | null = null;

  /** The phase/round band, and the round-chip pop / toggle fade it also drives (`drawPhaseWipe`, `roundChipScale`, `toggleFadeAlpha`). */
  #phaseTransition: (WipeEntry & { readonly transition: PhaseTransition }) | null = null;
  /** Every band that was queued, kept for the e2e: a band is on screen for a moment, a record is not. */
  readonly #bandLog: PhaseBandLogEntry[] = [];
  /** False until the first state has landed: that one's band is the game's opening band. */
  #landed = false;
  /** The pending "start the delayed band" call, so a redraw inside the delay replaces it rather than doubling it. */
  #wipeStart: Phaser.Time.TimerEvent | null = null;
  /**
   * A hero's own level-up band (Ironheart's Level Up!, `view/level-up-banner.ts`): the phase band's slide, in its
   * `levelUp` colors. A slot of its own, so it never replaces a phase band or drives the round chip and phase toggle.
   */
  #levelUp: WipeEntry | null = null;
  #levelUpStart: Phaser.Time.TimerEvent | null = null;
  /** A status pip/tag freshly stamped on, by card then by status, so more than one status on the same card each animate on their own clock. */
  #statusStamps = new Map<InstanceId, Map<StatusName, number>>();
  /** Ghosts of statuses just removed, by card. A card can lose more than one status in the same batch (Toughness cancelling a status-causing attack, an effect clearing several at once). */
  #statusGhosts = new Map<InstanceId, { readonly status: StatusName; readonly startedAt: number }[]>();
  /** A card-shaped panel's exhaust turn in progress, by card. */
  #exhaustMotions = new Map<InstanceId, { readonly direction: ExhaustDirection; readonly startedAt: number }>();
  /** An HP counting tween in progress, by card. */
  #hpTicks = new Map<InstanceId, { readonly tick: HpTick; readonly startedAt: number }>();
  /** A defeat border flash in progress, by card. */
  #defeatFlashes = new Map<InstanceId, number>();
  /** A threat meter counting tween in progress, by scheme. */
  #threatTicks = new Map<InstanceId, { readonly tick: ThreatTick; readonly startedAt: number }>();

  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
  }

  /**
   * A new game on the same Board: Phaser reuses the scene instance, and with it this one, so the next game's first
   * state is its opening band again (`#landed`), and nothing timed in the last game carries over into it.
   */
  /**
   * True while the round/phase band (`drawPhaseWipe`) is queued, sliding or holding on screen — guided mode G5c
   * reads this before showing the spotlight/tag, so a lesson step's ring never appears under (or fights) the
   * band that is itself announcing the very phase the step is about (`docs/guided-mode.md` §4 G4c "For G5c").
   *
   * Computed fresh from the wall clock every call, **not** from whether `#phaseTransition` has been nulled out
   * yet — that only happens as a side effect of `drawPhaseWipe` actually being called again, which only happens
   * inside `BoardScene#draw`. A caller polling this every frame to notice the band clearing on its own timer
   * (`BoardGuideMount.pollBanner`) would otherwise deadlock: nothing re-triggers a redraw once the band visually
   * finishes, so `#phaseTransition` would sit stale forever and `isTransitioning()` would never flip back to
   * `false` on its own. Found in browser verification: lesson 5's spotlight never appeared after round 2 began,
   * because the round-2 band's own `#phaseTransition` never got cleared without some *other*, unrelated redraw.
   */
  isTransitioning(): boolean {
    return this.#wipeRunning(this.#phaseTransition) || this.#wipeRunning(this.#levelUp);
  }

  #wipeRunning(entry: WipeEntry | null): boolean {
    if (!entry) return false;
    if (entry.deferred) return true; // Waiting for the table to be uncovered, still to play.
    const elapsed = this.#scene.time.now - entry.startedAt;
    if (elapsed < 0) return true; // Queued to start (the opening band's own delay, `wipeTimingFor`).
    return elapsed < wipeTotalMs(entry.holdMs);
  }

  /** Debug-only (`__mcBoardDebug.phaseBand`, e2e): the band's caption, whether it's being held for an overlay,
   * and how long it has been playing (negative while queued). `null` with no band. */
  debugPhaseBand(): { readonly caption: string; readonly deferred: boolean; readonly elapsedMs: number } | null {
    const entry = this.#phaseTransition;
    if (!entry) return null;
    return {
      caption: entry.caption,
      deferred: entry.deferred,
      elapsedMs: this.#scene.time.now - entry.startedAt,
    };
  }

  /** Debug-only (`__mcBoardDebug.phaseBandLog`, e2e): every band queued so far, whether it was held behind an overlay
   * and whether it has since been on screen. A durable record, so a test need not catch the band mid-flight. */
  debugPhaseBandLog(): readonly PhaseBandLogEntry[] {
    return this.#bandLog.map((entry) => ({ ...entry }));
  }

  reset(): void {
    this.#beats = [];
    this.#pendingMoves = [];
    this.#travels = [];
    this.#arriving.clear();
    this.#banners = [];
    this.#bannerPoll?.remove();
    this.#bannerPoll = null;
    this.#phaseTransition = null;
    this.#landed = false;
    this.#wipeStart?.remove();
    this.#wipeStart = null;
    this.#levelUp = null;
    this.#levelUpStart?.remove();
    this.#levelUpStart = null;
    this.#statusStamps.clear();
    this.#statusGhosts.clear();
    this.#exhaustMotions.clear();
    this.#hpTicks.clear();
    this.#defeatFlashes.clear();
    this.#threatTicks.clear();
  }

  announce(title: string, detail: string): void {
    this.#banners.push({ title, detail, shownAt: null });
  }

  /**
   * Draws the oldest announcement across the table, or — while something is
   * covering the table (`visible` false) — checks back shortly so it appears
   * the moment the table is uncovered. A tap anywhere dismisses it early.
   */
  drawBanners(area: Rect, visible: boolean, redraw: () => void): void {
    const scene = this.#scene;
    const now = scene.time.now;
    this.#banners = this.#banners.filter((banner) => banner.shownAt === null || now - banner.shownAt < BANNER_MS);
    const banner = this.#banners[0];
    if (!banner) return;
    if (!visible) {
      if (this.#bannerPoll !== null) return;
      this.#bannerPoll = scene.time.delayedCall(400, () => {
        this.#bannerPoll = null;
        redraw();
      });
      return;
    }
    const firstShow = banner.shownAt === null;
    if (firstShow) {
      banner.shownAt = now;
      scene.time.delayedCall(BANNER_MS + 20, redraw);
    }

    const height = Math.max(110, Math.min(170, area.height * 0.28));
    const band: Rect = { x: area.x, y: area.y + (area.height - height) / 2, width: area.width, height };
    const g = scene.add.graphics().setDepth(1100);
    g.fillStyle(surface.ink.hex, 0.55).fillRect(area.x, area.y, area.width, area.height);
    g.fillStyle(surface.ink.hex, 0.97).fillRect(band.x, band.y, band.width, band.height);
    hatchRect(g, band, accent.heroRed.hex, 0.22, 18, 6);
    g.fillStyle(accent.heroRed.hex, 1)
      .fillRect(band.x, band.y, band.width, 6)
      .fillRect(band.x, band.y + band.height - 6, band.width, 6);

    const title = scene.add
      .text(band.x + band.width / 2, band.y + band.height * 0.42, banner.title.toUpperCase(), {
        ...textStyle(typeRole.screenTitle, surface.paper.hex),
        stroke: cssOf(accent.heroRed.hex),
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setLetterSpacing(2)
      .setDepth(1101);
    fitText(title, band.width - 48, typeRole.screenTitle.size);
    scene.add
      .text(
        band.x + band.width / 2,
        band.y + band.height * 0.78,
        `${banner.detail} · tap to continue`,
        textStyle(typeRole.emphasis, surface.paper.hex),
      )
      .setOrigin(0.5)
      .setDepth(1101);

    // Over the whole table, so a tap anywhere dismisses rather than acting on
    // a card the banner is covering. A tap, not a bare release: a swipe that ends here dismisses nothing.
    const dismiss = scene.add
      .zone(area.x, area.y, area.width, area.height)
      .setOrigin(0, 0)
      .setDepth(1102)
      .setInteractive();
    onTap(dismiss, () => {
      banner.shownAt = -Infinity;
      redraw();
    });

    if (firstShow && !appSession().settings.reducedMotion) {
      scene.tweens.add({
        targets: title,
        scale: { from: 1.35, to: title.scale },
        alpha: { from: 0, to: 1 },
        duration: 260,
        ease: "Back.easeOut",
      });
    }
  }

  /**
   * A fresh state landed. Starts its beats now — reduced motion still gets the
   * beat, it just doesn't travel (`drawBeats`) — and holds its moves for the
   * next draw. Also starts every other timed motion this batch of events
   * carries: the phase/round band, a status stamp or ghost, an exhaust turn,
   * an HP or threat count, a defeat flash.
   */
  land(events: readonly GameEvent[]): void {
    const now = this.#scene.time.now;
    this.#beats = beatsFrom(events).map((beat) => ({ beat, startedAt: now }));
    this.#pendingMoves = events;
    this.#holdDrawnCards(events, now);

    const transition = phaseTransitionFrom(events);
    if (transition) {
      const timing = wipeTimingFor(!this.#landed, motion.screenFadeMs);
      const log: PhaseBandLogEntry = { caption: transition.caption, wasDeferred: false, played: false };
      this.#bandLog.push(log);
      this.#phaseTransition = {
        transition,
        caption: transition.caption,
        startedAt: now + timing.delayMs,
        holdMs: timing.holdMs,
        deferred: false,
        log,
      };
    }
    this.#landed = true;

    for (const stamp of statusStampsFrom(events)) {
      const byStatus = this.#statusStamps.get(stamp.instanceId) ?? new Map<StatusName, number>();
      byStatus.set(stamp.status, now);
      this.#statusStamps.set(stamp.instanceId, byStatus);
      // A status re-given the instant it stopped fading is no longer a ghost — it's back.
      const ghosts = this.#statusGhosts.get(stamp.instanceId);
      if (ghosts)
        this.#statusGhosts.set(
          stamp.instanceId,
          ghosts.filter((ghost) => ghost.status !== stamp.status),
        );
    }
    for (const ghost of statusGhostsFrom(events)) {
      const list = this.#statusGhosts.get(ghost.instanceId) ?? [];
      this.#statusGhosts.set(ghost.instanceId, [
        ...list.filter((entry) => entry.status !== ghost.status),
        { status: ghost.status, startedAt: now },
      ]);
    }

    for (const exhaust of exhaustMotionsFrom(events))
      this.#exhaustMotions.set(exhaust.instanceId, { direction: exhaust.direction, startedAt: now });
    for (const tick of hpTicksFrom(events)) this.#hpTicks.set(tick.instanceId, { tick, startedAt: now });
    for (const id of defeatFlashesFrom(events)) this.#defeatFlashes.set(id, now);
    for (const tick of threatTicksFrom(events)) this.#threatTicks.set(tick.schemeInstanceId, { tick, startedAt: now });
  }

  /** The status pip/tag at `instanceId` for `status`, if it was just given and is still within its stamp window. */
  statusStamp(instanceId: InstanceId, status: StatusName): StatusStampState | null {
    if (appSession().settings.reducedMotion) return null;
    const byStatus = this.#statusStamps.get(instanceId);
    const startedAt = byStatus?.get(status);
    if (startedAt === undefined) return null;
    const elapsed = this.#scene.time.now - startedAt;
    if (elapsed >= motion.statusStampMs) {
      byStatus!.delete(status);
      return null;
    }
    return { progress: clampedProgress(elapsed, motion.statusStampMs), remainingMs: motion.statusStampMs - elapsed };
  }

  /** Ghosts of statuses this card just lost, still fading — the real pip is already gone from `panel.statuses`. */
  statusGhosts(instanceId: InstanceId): readonly StatusGhostState[] {
    if (appSession().settings.reducedMotion) return [];
    const list = this.#statusGhosts.get(instanceId);
    if (!list || list.length === 0) return [];
    const now = this.#scene.time.now;
    const live = list.filter((ghost) => now - ghost.startedAt < motion.statusStampMs);
    if (live.length !== list.length) this.#statusGhosts.set(instanceId, live);
    return live.map((ghost) => ({
      status: ghost.status,
      progress: clampedProgress(now - ghost.startedAt, motion.statusStampMs),
      remainingMs: motion.statusStampMs - (now - ghost.startedAt),
    }));
  }

  /** A card-shaped panel's exhaust turn in progress, if any. */
  exhaustMotion(instanceId: InstanceId): ExhaustMotionState | null {
    if (appSession().settings.reducedMotion) return null;
    const entry = this.#exhaustMotions.get(instanceId);
    if (!entry) return null;
    const elapsed = this.#scene.time.now - entry.startedAt;
    if (elapsed >= motion.exhaustTurnMs) {
      this.#exhaustMotions.delete(instanceId);
      return null;
    }
    return {
      direction: entry.direction,
      progress: clampedProgress(elapsed, motion.exhaustTurnMs),
      remainingMs: motion.exhaustTurnMs - elapsed,
    };
  }

  /** An HP counting tween in progress for this card, if any. */
  hpTick(instanceId: InstanceId): HpTickState | null {
    if (appSession().settings.reducedMotion) return null;
    const entry = this.#hpTicks.get(instanceId);
    if (!entry) return null;
    const elapsed = this.#scene.time.now - entry.startedAt;
    if (elapsed >= motion.damageMs) {
      this.#hpTicks.delete(instanceId);
      return null;
    }
    return {
      tick: entry.tick,
      progress: clampedProgress(elapsed, motion.damageMs),
      remainingMs: motion.damageMs - elapsed,
    };
  }

  /** A Hero Red border flash for a character just defeated, if this panel is still the one being drawn. */
  defeatFlash(instanceId: InstanceId): DefeatFlashState | null {
    if (appSession().settings.reducedMotion) return null;
    const startedAt = this.#defeatFlashes.get(instanceId);
    if (startedAt === undefined) return null;
    const duration = motion.damageMs * 1.5;
    const elapsed = this.#scene.time.now - startedAt;
    if (elapsed >= duration) {
      this.#defeatFlashes.delete(instanceId);
      return null;
    }
    return { progress: clampedProgress(elapsed, duration), remainingMs: duration - elapsed };
  }

  /** The threat meter's counting tween in progress for this scheme, if any. */
  threatTick(schemeInstanceId: InstanceId): ThreatTickState | null {
    if (appSession().settings.reducedMotion) return null;
    const entry = this.#threatTicks.get(schemeInstanceId);
    if (!entry) return null;
    const elapsed = this.#scene.time.now - entry.startedAt;
    if (elapsed >= motion.threatMs) {
      this.#threatTicks.delete(schemeInstanceId);
      return null;
    }
    return {
      tick: entry.tick,
      progress: clampedProgress(elapsed, motion.threatMs),
      remainingMs: motion.threatMs - elapsed,
    };
  }

  /**
   * The chrome's round chip pop, if the round just changed to `round`: pops
   * 1.25 -> 1 over `PHASE_POP_MS`. Null once it's settled (draw the chip at
   * its resting scale) or under reduced motion. Returns progress/remaining
   * rather than a bare scale — like every other motion here, `chrome.ts`
   * schedules its own tween for what's left, so the pop keeps animating
   * between the (infrequent) redraws that recompute it.
   */
  roundChipPop(round: number): StatusStampState | null {
    if (appSession().settings.reducedMotion) return null;
    const entry = this.#phaseTransition;
    if (!entry || entry.transition.round === null || entry.transition.round !== round) return null;
    // The opening band starts late (`wipeTimingFor`); until it does, the pop is simply at its beginning.
    const elapsed = Math.max(0, this.#scene.time.now - entry.startedAt);
    if (elapsed >= PHASE_POP_MS) return null;
    return { progress: clampedProgress(elapsed, PHASE_POP_MS), remainingMs: PHASE_POP_MS - elapsed };
  }

  /**
   * The phase toggle's active-side fade-in, if the phase just turned to
   * `phase`: fades 0 -> 1 over `PHASE_POP_MS`. Null once settled, for the
   * side that isn't newly active, and under reduced motion.
   */
  toggleFade(phase: "player" | "villain"): StatusStampState | null {
    if (appSession().settings.reducedMotion) return null;
    const entry = this.#phaseTransition;
    if (!entry || entry.transition.to !== phase) return null;
    // The opening band starts late (`wipeTimingFor`); until it does, the pop is simply at its beginning.
    const elapsed = Math.max(0, this.#scene.time.now - entry.startedAt);
    if (elapsed >= PHASE_POP_MS) return null;
    return { progress: clampedProgress(elapsed, PHASE_POP_MS), remainingMs: PHASE_POP_MS - elapsed };
  }

  /**
   * The full-width band that wipes across the table when the phase or round
   * turns: a slide in, a hold, a slide out, all recomputed from the
   * transition's own start time so a redraw mid-flight resumes rather than
   * restarts. Non-blocking — nothing here is ever made interactive, so a tap
   * during the wipe reaches whatever it would have reached anyway — and drawn
   * at a high depth so it always reads over the table.
   *
   * Reduced motion drops the slide entirely: the band appears in place,
   * holds for `PHASE_WIPE_REDUCED_MS`, and disappears — the same "keep the
   * information, drop the movement" rule every other motion in this file
   * follows.
   */
  drawPhaseWipe(area: Rect, isCovered: () => boolean): void {
    this.#playWipe("phase", area, isCovered);
    this.#playWipe("levelUp", area, isCovered);
  }

  /**
   * Queues a hero's level-up band (`caption`: "IRONHEART LEVELS UP! · VERSION 2 OF 3"). It plays once any phase band
   * already on screen has gone, so the two never share the table, and it holds a little longer than a phase band.
   */
  announceLevelUp(caption: string): void {
    const now = this.#scene.time.now;
    const phase = this.#phaseTransition;
    const after = phase && !phase.deferred ? phase.startedAt + wipeTotalMs(phase.holdMs) : now;
    const log: PhaseBandLogEntry = { caption, wasDeferred: false, played: false };
    this.#bandLog.push(log);
    this.#levelUp = { caption, startedAt: Math.max(now, after), holdMs: LEVEL_UP_HOLD_MS, deferred: false, log };
  }

  /** One band's slide in, hold and slide out (see `drawPhaseWipe`), for the phase band or the level-up band. */
  #playWipe(slot: WipeStyle, area: Rect, isCovered: () => boolean): void {
    const current = (): WipeEntry | null => (slot === "phase" ? this.#phaseTransition : this.#levelUp);
    const clear = (): void => {
      if (slot === "phase") this.#phaseTransition = null;
      else this.#levelUp = null;
    };
    const setTimer = (timer: Phaser.Time.TimerEvent | null): void => {
      if (slot === "phase") this.#wipeStart = timer;
      else this.#levelUpStart = timer;
    };
    const covered = isCovered();
    const entry = current();
    if (!entry) return;
    const scene = this.#scene;
    const reduced = appSession().settings.reducedMotion;

    (slot === "phase" ? this.#wipeStart : this.#levelUpStart)?.remove();
    setTimer(null);
    if (entry.deferred && !covered) {
      // The overlay just went: the band plays now, from its start, rather than having spent itself unseen.
      entry.deferred = false;
      entry.startedAt = scene.time.now;
      entry.log.played = true;
    }
    const elapsed = scene.time.now - entry.startedAt;
    if (covered && elapsed >= 0 && !entry.deferred && elapsed < wipeTotalMs(entry.holdMs)) {
      // Its time came under an overlay (the villain phase walkthrough stays up into the next player phase until
      // the player continues or skips it). Hold it, checking back, so ROUND N · PLAYER PHASE plays in full once
      // it's gone — however far it had got underneath: on a slow machine the first draw that sees the overlay can
      // land well after the band started.
      entry.deferred = true;
      entry.log.wasDeferred = true;
    }
    if (!entry.deferred && elapsed >= 0 && !entry.log.wasDeferred) entry.log.played = true;
    if (entry.deferred) {
      setTimer(
        scene.time.delayedCall(250, () => {
          setTimer(null);
          if (current() === entry) this.#playWipe(slot, area, isCovered);
        }),
      );
      return;
    }
    if (elapsed < 0) {
      // Not yet: the opening band waits for the Board to be on screen. Nothing else will redraw the table at that
      // moment, so the band starts itself — unless a redraw gets here first, which re-arms this.
      setTimer(
        scene.time.delayedCall(-elapsed, () => {
          setTimer(null);
          if (current() === entry) this.#playWipe(slot, area, isCovered);
        }),
      );
      return;
    }

    if (reduced) {
      // The plain caption holds as much longer as the sliding band does.
      const reducedMs = PHASE_WIPE_REDUCED_MS + (entry.holdMs - PHASE_WIPE_HOLD_MS);
      if (elapsed >= reducedMs) {
        clear();
        return;
      }
      const container = this.#drawWipeBand(area, entry.caption, slot, area.x);
      scene.time.delayedCall(reducedMs - elapsed, () => container.destroy());
      return;
    }

    const frame = wipeFrame(elapsed, motion.phaseWipeMs, entry.holdMs);
    if (!frame) {
      clear();
      return;
    }

    const startX =
      frame.stage === "in"
        ? lerp(-area.width, 0, frame.progress)
        : frame.stage === "out"
          ? lerp(0, area.width, frame.progress)
          : 0;
    const container = this.#drawWipeBand(area, entry.caption, slot, area.x + startX);

    const slideOut = (): void => {
      if (!container.active) return;
      scene.tweens.add({
        targets: container,
        x: area.x + area.width,
        duration: motion.phaseWipeMs,
        ease: "Quad.easeIn",
      });
    };

    if (frame.stage === "in") {
      scene.tweens.add({
        targets: container,
        x: area.x,
        duration: frame.remainingMs,
        ease: "Quad.easeOut",
        onComplete: () => scene.time.delayedCall(entry.holdMs, slideOut),
      });
    } else if (frame.stage === "hold") {
      scene.time.delayedCall(frame.remainingMs, slideOut);
    } else {
      scene.tweens.add({
        targets: container,
        x: area.x + area.width,
        duration: frame.remainingMs,
        ease: "Quad.easeIn",
      });
    }
  }

  /** The band's own graphics and caption, as one container positioned at `(x, centeredY)`. */
  #drawWipeBand(area: Rect, caption: string, style: WipeStyle, x: number): Phaser.GameObjects.Container {
    const scene = this.#scene;
    const colors = WIPE_COLORS[style];
    const height = Math.max(64, Math.min(96, area.height * 0.16)) * colors.heightScale;
    const y = area.y + (area.height - height) / 2;

    const g = scene.add.graphics();
    g.fillStyle(colors.ground, 0.96).fillRect(0, 0, area.width, height);
    if (colors.hatch !== null) hatchRect(g, { x: 0, y: 0, width: area.width, height }, colors.hatch, 0.3, 18, 6);
    // The edge stripes: one color, or a repeating run of colored segments.
    const segments = colors.stripes.length === 1 ? 1 : Math.max(1, Math.ceil(area.width / 64));
    const segment = area.width / segments;
    for (let i = 0; i < segments; i++) {
      g.fillStyle(colors.stripes[i % colors.stripes.length]!, 1)
        .fillRect(i * segment, 0, segment, 5)
        .fillRect(i * segment, height - 5, segment, 5);
    }
    const text = scene.add
      .text(area.width / 2, height / 2, caption, {
        ...textStyle(typeRole.screenTitle, colors.title),
        stroke: cssOf(colors.stroke),
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setLetterSpacing(2);
    fitText(text, area.width - 64, typeRole.screenTitle.size);
    if (style === "levelUp" && !appSession().settings.reducedMotion) {
      // Her outline runs through the band's colors while it crosses, like a power surge.
      scene.tweens.addCounter({
        from: 0,
        to: colors.stripes.length * 4,
        duration: LEVEL_UP_HOLD_MS + motion.phaseWipeMs,
        onUpdate: (tween) => {
          const at = Math.floor(tween.getValue() ?? 0) % colors.stripes.length;
          if (text.active) text.setStroke(cssOf(colors.stripes[at]!), 5);
        },
      });
    }

    return scene.add.container(x, y, [g, text]).setDepth(style === "levelUp" ? 1160 : 1150);
  }

  /**
   * Holds each card drawn into the player's hand out of its slot until its ghost lands. The latest a ghost can land is
   * known now (the draw's whole spread plus one flight), which is all the first draw needs; `startTravels` replaces it
   * with the real time, or lets the card go if no ghost could be placed. Nothing is held under reduced motion.
   */
  #holdDrawnCards(events: readonly GameEvent[], now: number): void {
    const perspectiveId = appSession().store.state.perspectiveId;
    if (perspectiveId === null || appSession().settings.reducedMotion) return;
    for (const instanceId of handArrivalsFrom(events, perspectiveId))
      this.#arriving.set(instanceId, now + DRAW_SPREAD_MAX_MS + motion.cardDrawMs);
  }

  /** Whether this hand card is still in flight from the deck: the hand leaves its slot empty and the ghost fills it. */
  isArriving(instanceId: InstanceId): boolean {
    const landsAt = this.#arriving.get(instanceId);
    return landsAt !== undefined && landsAt > this.#scene.time.now && !appSession().settings.reducedMotion;
  }

  /**
   * Whether a ghost started or landed since the last look, so the board redraws to start it or to show the card it was
   * carrying. Ghosts are redrawn from their own clock (`renderTravels`) but nothing else asks for that redraw.
   */
  needsRedraw(): boolean {
    const now = this.#scene.time.now;
    const last = this.#lastWake;
    this.#lastWake = now;
    if (this.#wakeNow) {
      this.#wakeNow = false;
      return true;
    }
    const crossed = (at: number): boolean => at > last && at <= now;
    for (const [instanceId, landsAt] of this.#arriving) {
      if (landsAt <= now) this.#arriving.delete(instanceId);
    }
    return this.#travels.some(
      ({ travel, startedAt }) =>
        crossed(startedAt + travel.delayMs) || crossed(startedAt + travel.delayMs + travelMs(travel)),
    );
  }

  /**
   * Consumes the pending moves (if this is the first draw since they landed)
   * and turns them into travels, using `previous` for "where a card was" and
   * `current` for "where it is now". A no-op — cheaply, since nothing is
   * pending — on every redraw the command didn't cause (resize, focus
   * movement, a tab switch).
   */
  startTravels(previous: BoardFrame, current: BoardFrame, layout: BoardLayout): void {
    if (this.#pendingMoves.length === 0) return;
    const events = this.#pendingMoves;
    this.#pendingMoves = [];

    const perspectiveId = appSession().store.state.perspectiveId;
    if (perspectiveId === null) return;

    const anchorBefore = (instanceId: InstanceId, zone: ZoneId): Rect | null =>
      previous.hitRects.get(instanceId) ?? pileAnchor(zone, layout, perspectiveId, previous);
    // A card dealt facedown flies to its player's pile even when it is already in play by now (dealt and revealed in
    // one command): the pile's place, never the card's.
    const anchorAfter = (instanceId: InstanceId, zone: ZoneId): Rect | null =>
      zone.kind === "dealtEncounter"
        ? pileAnchor(zone, layout, perspectiveId, current)
        : (current.hitRects.get(instanceId) ?? pileAnchor(zone, layout, perspectiveId, current));
    // Only a scan already on the GPU — never a fresh request, which would ask the network for a card just to
    // decorate a 220ms ghost that will usually finish before the fetch does. `scene.textures.exists` is exactly
    // the same check `card-art.ts`'s own `request()` makes before it would otherwise queue a load.
    const artOf = (instanceId: InstanceId): ArtSource | null => {
      const state = appSession().store.state.game;
      if (!state) return null;
      const source = artFor(cardOf(state, instanceId), faceOf(state, instanceId));
      return source && this.#scene.textures.exists(source.key) ? source : null;
    };

    const now = this.#scene.time.now;
    const travels = travelsFrom(events, anchorBefore, anchorAfter, artOf);
    this.#travels.push(...travels.map((travel) => ({ travel, startedAt: now })));
    this.#lastWake = now;
    for (const travel of travels) {
      if (this.#arriving.has(travel.instanceId))
        this.#arriving.set(travel.instanceId, now + travel.delayMs + travelMs(travel));
    }
    // A card held for a ghost that could not be drawn (its slot is off screen, a teammate's hand) is let go now.
    const flown = new Set(travels.map((travel) => travel.instanceId));
    for (const instanceId of handArrivalsFrom(events, perspectiveId)) {
      if (!flown.has(instanceId) && this.#arriving.delete(instanceId)) {
        this.#wakeNow = true;
      }
    }
  }

  /**
   * Floats each live beat off its anchor. A beat whose anchor is off screen —
   * a hidden phone tab, a card that has since left play — is simply not drawn;
   * the tab badge is what reports those.
   */
  drawBeats(hitRects: ReadonlyMap<InstanceId, Rect>): void {
    const scene = this.#scene;
    const now = scene.time.now;
    const reduced = appSession().settings.reducedMotion;
    const lifetime = reduced ? motion.damageMs : motion.damageMs * 2.4;
    this.#beats = this.#beats.filter((entry) => now - entry.startedAt < lifetime);

    this.#beats.forEach(({ beat, startedAt }, index) => {
      const rect = hitRects.get(beat.anchor);
      if (!rect) return;
      const elapsed = now - startedAt;
      const remaining = lifetime - elapsed;

      const text = scene.add
        .text(rect.x + rect.width / 2, rect.y + rect.height / 2 - elapsed / 14, beat.text, {
          ...textStyle(typeRole.stat, BEAT_COLORS[beat.tone]),
          // A stroke is the only way a number stays readable over card art.
          stroke: cssOf(surface.ink.hex),
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(1000 + index);

      if (reduced) {
        // Held still, then gone: the information without the movement.
        scene.time.delayedCall(remaining, () => text.destroy());
        return;
      }
      scene.tweens.add({
        targets: text,
        y: text.y - 26,
        alpha: { from: 1, to: 0 },
        duration: remaining,
        ease: "Quad.easeOut",
        onComplete: () => text.destroy(),
      });
    });
  }

  /** A draw's rects as of this frame: the slot it is flying to and the deck it leaves, where either is drawn. */
  #retargeted(travel: Travel, live: BoardFrame, perspectiveId: PlayerId | null): Travel {
    const to = live.hitRects.get(travel.instanceId) ?? travel.to;
    const from =
      (perspectiveId !== null ? live.pileRects.get(pileKey("deck", perspectiveId)) : undefined) ?? travel.from;
    return { ...travel, from, to };
  }

  /**
   * Draws every live travel as a ghost panel morphing from its "from" rect to
   * its "to" rect, then lets it go. Reduced motion drops the flight entirely —
   * the real card already sits at its destination, drawn moments ago by the
   * rest of the draw — the same "keep the information, drop the movement"
   * rule `drawBeats` follows.
   *
   * Every travel is redrawn from its own elapsed time on every draw, the same
   * trick `drawBeats` uses: the draw's `destroyChildren(scene)` destroys last
   * frame's ghost along with everything else, so this recreates it already
   * partway along its path rather than snapping it back to `from`.
   */
  renderTravels(live: BoardFrame): void {
    const scene = this.#scene;
    const perspectiveId = appSession().store.state.perspectiveId;
    const now = scene.time.now;
    this.#travels = this.#travels.filter(
      (entry) => now - entry.startedAt < entry.travel.delayMs + travelMs(entry.travel),
    );
    if (appSession().settings.reducedMotion) return;

    for (const { travel: planned, startedAt } of this.#travels) {
      // A draw is aimed at where its slot and its deck are *now*: the hand moves when the villain phase docks beside
      // the table, and a ghost flown to the slot's old place would land beside the card it carries.
      const travel = planned.draw ? this.#retargeted(planned, live, perspectiveId) : planned;
      // A draw waits its turn in the line: its card is still on the deck, and its slot stays empty meanwhile.
      const elapsed = now - startedAt - travel.delayMs;
      if (elapsed < 0) continue;
      const duration = travelMs(travel);
      const remaining = duration - elapsed;
      if (remaining <= 0) continue;
      const progress = elapsed / duration;

      const fromCenter = { x: travel.from.x + travel.from.width / 2, y: travel.from.y + travel.from.height / 2 };
      const toCenter = { x: travel.to.x + travel.to.width / 2, y: travel.to.y + travel.to.height / 2 };
      const scaleTo = { x: travel.to.width / travel.from.width, y: travel.to.height / travel.from.height };
      const halfW = travel.from.width / 2;
      const halfH = travel.from.height / 2;

      // The card's own face when it's already on hand, so a travel reads as
      // "that card" rather than as a generic parchment tile; the plain
      // rectangle is the fallback for everything else — see `view/travel.ts`.
      // A draw comes off the top of a facedown deck, so it flies as the card back; its face shows once it lands.
      // A facedown deal is the encounter card back, whatever the card turned out to be.
      const backArt = travel.facedown ? CARD_BACKS.encounter : CARD_BACKS.player;
      const backKey = (travel.draw || travel.facedown) && this.#scene.textures.exists(backArt.key) ? backArt.key : null;
      const image =
        (backKey ?? travel.art?.key)
          ? drawArt(
              scene,
              (backKey ?? travel.art?.key)!,
              { x: -halfW, y: -halfH, width: travel.from.width, height: travel.from.height },
              { fit: "cover" },
            )
          : null;
      const ghost = scene.add.graphics();
      if (!image)
        ghost
          .fillStyle(surface.parchment.hex, travel.draw || travel.facedown ? 1 : 0.55)
          .fillRect(-halfW, -halfH, travel.from.width, travel.from.height);
      ghost.lineStyle(3, accent.heroRed.hex, 0.85).strokeRect(-halfW, -halfH, travel.from.width, travel.from.height);

      const container = scene.add.container(
        lerp(fromCenter.x, toCenter.x, progress),
        lerp(fromCenter.y, toCenter.y, progress),
        [...(image ? [image] : []), ghost],
      );
      container.setScale(lerp(1, scaleTo.x, progress), lerp(1, scaleTo.y, progress));
      container.setDepth(900);

      scene.tweens.add({
        targets: container,
        x: toCenter.x,
        y: toCenter.y,
        scaleX: scaleTo.x,
        scaleY: scaleTo.y,
        duration: remaining,
        ease: "Quad.easeOut",
        onComplete: () => container.destroy(),
      });
    }
  }
}

/** How long one travel's flight runs: a draw takes a beat longer than a card moving between two zones. */
function travelMs(travel: Travel): number {
  return travel.draw ? motion.cardDrawMs : motion.cardMoveMs;
}

/**
 * The coarser rect a whole zone gets when no specific card is drawn there —
 * the encounter deck box, the enemies band, the hand banner a card is about
 * to leave or just arrived from. `attachment`/`boost` resolve to their host's
 * own rect, so an upgrade reads as flying onto the card it attached to.
 *
 * A pile drawn as its own box — your deck and discard beside the hand, the
 * encounter deck and discard — resolves to that box (`frame.pileRects`), so a
 * drawn card flies out of your deck and a discarded one lands on your discard.
 * Zones this board never draws resolve to `null`, and a move to or from one of
 * those has no travel (see `view/travel.ts`'s file comment).
 */
function pileAnchor(zone: ZoneId, layout: BoardLayout, perspectiveId: PlayerId, frame: BoardFrame): Rect | null {
  switch (zone.kind) {
    case "encounterDeck":
    case "encounterDiscard":
      return frame.pileRects.get(pileKey(zone.kind)) ?? layout.zones.encounter;
    case "villainArea":
      return layout.zones.enemies;
    // Facedown cards dealt to a player sit in a small pile on their identity card or team row (`dealt-pile.ts`). A deal
    // flown on a frame that did not draw the pile (it was revealed in the same command) lands where the pile would be.
    case "dealtEncounter": {
      const drawn = frame.pileRects.get(pileKey("dealt", zone.playerId));
      if (drawn) return drawn;
      const game = appSession().store.state.game;
      const identity = game ? getPlayer(game, zone.playerId)?.identity.instanceId : undefined;
      const anchor = identity ? frame.hitRects.get(identity) : undefined;
      const mine = zone.playerId === perspectiveId;
      if (anchor) {
        const kind = mine ? (layout.compactPlayerRow === true ? "compact" : "wide") : "seat";
        return dealtPileParts(anchor, kind)?.rect ?? anchor;
      }
      return mine ? layout.zones.me : layout.zones.team;
    }
    case "deck":
    case "discard":
      if (zone.playerId !== perspectiveId) return layout.zones.team;
      return frame.pileRects.get(pileKey(zone.kind, zone.playerId)) ?? layout.zones.hand;
    case "hand":
      return zone.playerId === perspectiveId ? layout.zones.hand : layout.zones.team;
    case "playArea":
      return zone.playerId === perspectiveId ? layout.zones.playArea : layout.zones.team;
    case "identity":
      return zone.playerId === perspectiveId ? layout.zones.me : layout.zones.team;
    // A separate deck (Doctor Strange's Invocation deck) is drawn as its own
    // box beside the play area whenever the identity has one (`zones.ts`'s
    // `drawSeparateDecks`), so a card leaving or landing there flies to that
    // box the same way a player's own deck/discard does — falling back to
    // the play area only for a draw where it wasn't on screen (a hidden
    // phone tab).
    case "separateDeck":
    case "separateDiscard":
      return zone.playerId === perspectiveId
        ? (frame.pileRects.get(pileKey(zone.kind, zone.playerId, zone.name)) ?? layout.zones.playArea)
        : layout.zones.team;
    // Tucked (Open the Dark Dimension holding the Invocation deck's top card,
    // Highway Robbery holding a hand card): out of play and never drawn as
    // its own card, but the scheme or character holding it *is* drawn, so a
    // card flies onto its host the same way an attachment or a boost does.
    case "tucked":
    case "attachment":
    case "boost":
      return frame.hitRects.get(zone.hostInstanceId) ?? null;
    default:
      return null;
  }
}

/** Each beat speaks in the signal that already means that thing everywhere else. */
const BEAT_COLORS: Record<Beat["tone"], number> = {
  damage: accent.heroRed.hex,
  heal: signal.heal.hex,
  threat: accent.heroRed.hex,
  status: signal.caution.hex,
  defeat: surface.paper.hex,
};
