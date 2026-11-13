/**
 * The replay transport's pure parts (issue #693): where its controls sit in the bar the board gives it, how the seek bar
 * maps a pointer to a position, the round markers, the position label, the speeds, the jump-to-moment targets and the
 * autoplay clock. `scenes/replay-transport.ts` draws and wires them; nothing here touches Phaser or the engine.
 */
import type { Rect } from "./layout.js";
import type { ReplayMoment } from "./replay-cursor.js";

export const SPEEDS = [1, 2, 4] as const;
export type ReplaySpeed = (typeof SPEEDS)[number];

/** The pause between two commands at 1x: long enough to read what the last one did. */
export const STEP_INTERVAL_MS = 1200;

export function nextSpeed(speed: ReplaySpeed): ReplaySpeed {
  return SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
}

export function stepDelayMs(speed: ReplaySpeed): number {
  return STEP_INTERVAL_MS / speed;
}

/** The round the replay is in after `position` commands: the latest moment at or before it. */
export function roundAt(moments: readonly ReplayMoment[], position: number, fallback = 1): number {
  let round = fallback;
  for (const moment of moments) {
    if (moment.commandIndex > position) break;
    round = moment.round;
  }
  return round;
}

/** The target of "previous moment": the last one before here, else the start. */
export function previousMoment(moments: readonly ReplayMoment[], position: number): number {
  let target = 0;
  for (const moment of moments) {
    if (moment.commandIndex >= position) break;
    target = moment.commandIndex;
  }
  return target;
}

/** The target of "next moment": the first one after here, else the end. */
export function nextMoment(moments: readonly ReplayMoment[], position: number, length: number): number {
  for (const moment of moments) if (moment.commandIndex > position) return Math.min(moment.commandIndex, length);
  return length;
}

export interface SeekMarker {
  /** 0..1 along the track. */
  readonly fraction: number;
  readonly commandIndex: number;
  /** A round start is drawn tall, a phase start short. */
  readonly major: boolean;
  readonly label: string;
}

/** A tick on the seek bar for each round start (tall) and phase start (short). Position 0 and the end carry none. */
export function seekMarkers(moments: readonly ReplayMoment[], length: number): readonly SeekMarker[] {
  if (length <= 0) return [];
  return moments
    .filter((moment) => moment.commandIndex > 0 && moment.commandIndex < length)
    .map((moment) => ({
      fraction: moment.commandIndex / length,
      commandIndex: moment.commandIndex,
      major: moment.kind === "round" || moment.kind === "start",
      label: moment.label,
    }));
}

/** The seek bar's position for a pointer at `x` over a track starting at `trackX` and `trackWidth` wide. */
export function positionAtX(x: number, trackX: number, trackWidth: number, length: number): number {
  if (length <= 0 || trackWidth <= 0) return 0;
  const fraction = Math.max(0, Math.min(1, (x - trackX) / trackWidth));
  return Math.round(fraction * length);
}

export function fractionOf(position: number, length: number): number {
  return length <= 0 ? 0 : Math.max(0, Math.min(1, position / length));
}

export function positionLabel(
  position: number,
  length: number,
  moments: readonly ReplayMoment[],
  fallbackRound: number,
): { readonly round: number; readonly at: number; readonly total: number } {
  return { round: roundAt(moments, position, 1) || fallbackRound, at: position, total: length };
}

export type BannerKind = "failure" | "diverged" | "otherBuild";

/** What the one-line banner says about the replay, most serious first; null for a replay that plays as it was played. */
export function bannerOf(info: {
  readonly otherBuild: boolean;
  readonly divergedAt: number | null;
  readonly failure: { readonly commandIndex: number } | null;
}): { readonly kind: BannerKind; readonly n: number } | null {
  // Commands are numbered from 1 on screen; the engine's indexes are 0-based.
  if (info.failure) return { kind: "failure", n: info.failure.commandIndex + 1 };
  if (info.divergedAt !== null) return { kind: "diverged", n: info.divergedAt };
  if (info.otherBuild) return { kind: "otherBuild", n: 0 };
  return null;
}

/** The scrub repeat for a held d-pad or stick: how many commands to move at `heldMs` since it was pressed, or 0 for none yet. */
export function scrubSteps(heldMs: number, lastMs: number): number {
  if (lastMs < 0) return 1;
  const interval = heldMs > 1500 ? 40 : heldMs > 700 ? 70 : 140;
  if (heldMs < 350) return 0;
  const since = heldMs - lastMs;
  if (since < interval) return 0;
  return heldMs > 1500 ? 3 : 1;
}

export interface AutoPlay {
  readonly playing: boolean;
  readonly elapsedMs: number;
}

export const STOPPED: AutoPlay = { playing: false, elapsedMs: 0 };

export interface AutoPlayContext {
  readonly speed: ReplaySpeed;
  /** A step or seek is in flight, or the board is still animating or narrating the last one. */
  readonly waiting: boolean;
  readonly position: number;
  readonly length: number;
}

/**
 * One frame of the autoplay clock. It counts only while nothing is waited on, so the next command never starts under
 * the animation or the villain phase walkthrough of the last, and fires one step when the interval has run out.
 * Reaching the end stops it.
 */
export function tickAutoPlay(
  state: AutoPlay,
  deltaMs: number,
  context: AutoPlayContext,
): { readonly state: AutoPlay; readonly step: boolean } {
  if (!state.playing) return { state, step: false };
  if (context.position >= context.length) return { state: STOPPED, step: false };
  if (context.waiting) return { state: { playing: true, elapsedMs: 0 }, step: false };
  const elapsedMs = state.elapsedMs + deltaMs;
  if (elapsedMs < stepDelayMs(context.speed)) return { state: { playing: true, elapsedMs }, step: false };
  return { state: { playing: true, elapsedMs: 0 }, step: true };
}

/** Starting at the end plays from the start, as a video does. */
export function playFrom(position: number, length: number): { readonly restart: boolean } {
  return { restart: length > 0 && position >= length };
}

export type TransportControl =
  | "start"
  | "prevMoment"
  | "back"
  | "play"
  | "forward"
  | "nextMoment"
  | "end"
  | "speed"
  | "export"
  | "exportLog"
  | "exit";

export interface TransportLayout {
  readonly kind: "row" | "stacked";
  readonly controls: ReadonlyMap<TransportControl, Rect>;
  /** The seek bar's pointer target (taller than the track it draws). */
  readonly seek: Rect;
  /** The thin track drawn inside `seek`. */
  readonly track: Rect;
  readonly label: Rect;
  /** Whether the label is the short form. */
  readonly shortLabel: boolean;
  /** Where the one-line banner goes: just above the bar. */
  readonly banner: Rect;
}

const BUTTON = 40;
const GAP = 4;
const PAD = 8;
const TRACK_HEIGHT = 8;

/**
 * The bar's controls in the rect the board's action bar zone gives (`view/layout.ts`: 56 tall on a wide table, 96 where
 * the table is tall and the bar stacks into two rows). A wide bar is one row; a narrow one drops Start / End (Home and
 * End on a keyboard still go there) and shortens words.
 */
export function transportLayout(bar: Rect, bannerHeight = 22): TransportLayout {
  const controls = new Map<TransportControl, Rect>();
  const banner: Rect = { x: bar.x, y: bar.y - bannerHeight, width: bar.width, height: bannerHeight };
  const stacked = bar.height >= 88;
  if (stacked) {
    const rowHeight = Math.floor((bar.height - PAD) / 2);
    const top = bar.y + 3;
    const bottom = top + rowHeight + 2;
    const size = Math.min(44, Math.floor((bar.width - 2 * PAD - 52 - 6 * GAP) / 5));
    let x = bar.x + PAD;
    for (const id of ["prevMoment", "back", "play", "forward", "nextMoment"] as const) {
      controls.set(id, { x, y: top, width: size, height: rowHeight });
      x += size + GAP;
    }
    controls.set("speed", { x, y: top, width: 52, height: rowHeight });
    const label: Rect = {
      x: x + 52 + 6,
      y: top,
      width: Math.max(0, bar.x + bar.width - PAD - (x + 52 + 6)),
      height: rowHeight,
    };
    const exitWidth = 60;
    const exportWidth = 74;
    const right = bar.x + bar.width - PAD;
    controls.set("exit", { x: right - exitWidth, y: bottom, width: exitWidth, height: rowHeight });
    controls.set("export", {
      x: right - exitWidth - GAP - exportWidth,
      y: bottom,
      width: exportWidth,
      height: rowHeight,
    });
    controls.set("exportLog", {
      x: right - exitWidth - 2 * GAP - exportWidth - 66,
      y: bottom,
      width: 66,
      height: rowHeight,
    });
    const seekX = bar.x + PAD;
    const seekRight = (controls.get("exportLog") as Rect).x - 8;
    const seek: Rect = { x: seekX, y: bottom, width: Math.max(40, seekRight - seekX), height: rowHeight };
    return {
      kind: "stacked",
      controls,
      seek,
      track: trackOf(seek),
      label,
      shortLabel: true,
      banner,
    };
  }

  const compact = bar.width < 820;
  const y = bar.y + Math.floor((bar.height - BUTTON) / 2);
  let x = bar.x + PAD;
  const left = compact
    ? (["prevMoment", "back", "play", "forward", "nextMoment"] as const)
    : (["start", "prevMoment", "back", "play", "forward", "nextMoment", "end"] as const);
  for (const id of left) {
    controls.set(id, { x, y, width: BUTTON, height: BUTTON });
    x += BUTTON + GAP;
  }
  const exitWidth = compact ? 52 : 64;
  const exportWidth = compact ? 72 : 112;
  const logWidth = compact ? 64 : 96;
  const speedWidth = 52;
  const labelWidth = compact ? 96 : 156;
  let rx = bar.x + bar.width - PAD;
  rx -= exitWidth;
  controls.set("exit", { x: rx, y, width: exitWidth, height: BUTTON });
  rx -= GAP + exportWidth;
  controls.set("export", { x: rx, y, width: exportWidth, height: BUTTON });
  rx -= GAP + logWidth;
  controls.set("exportLog", { x: rx, y, width: logWidth, height: BUTTON });
  rx -= GAP + speedWidth;
  controls.set("speed", { x: rx, y, width: speedWidth, height: BUTTON });
  rx -= GAP + labelWidth;
  const label: Rect = { x: rx, y, width: labelWidth, height: BUTTON };
  const seek: Rect = { x: x + 6, y, width: Math.max(40, rx - 10 - (x + 6)), height: BUTTON };
  return { kind: "row", controls, seek, track: trackOf(seek), label, shortLabel: compact, banner };
}

function trackOf(seek: Rect): Rect {
  return {
    x: seek.x + 6,
    y: seek.y + Math.floor((seek.height - TRACK_HEIGHT) / 2),
    width: seek.width - 12,
    height: TRACK_HEIGHT,
  };
}
