/**
 * The platform mark on a saved game (device sync, #276): a small monochrome icon and its text label, so a Continue row
 * (and any list that mixes games from several linked devices) says where each game was last played.
 *
 * Pure data: the label and the icon as a list of strokes and fills on a 24 x 24 grid. The scene draws them with
 * Graphics (`ui/play-platform-icon.ts`), the way `ui/music-icon.ts` draws its mark, so they sit the same on every
 * device font and need no image. No trademarked logos: generic glyphs (globe, window panes, laptop, terminal, phone).
 * A save without a `lastPlayedOn` (older saves) has no mark.
 */
import type { LastPlayedOn } from "../engine/game-storage.js";
import { isPlayPlatform, type PlayPlatform } from "../platform/play-platform.js";
import type { Rect } from "./layout.js";

/** The icon grid: every shape is given in 0..24 on both axes. */
export const ICON_GRID = 24;

export type IconShape =
  | { readonly kind: "ring"; readonly cx: number; readonly cy: number; readonly r: number; readonly w: number }
  | {
      readonly kind: "ellipse";
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
      readonly w: number;
    }
  | {
      readonly kind: "line";
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly w: number;
    }
  | {
      readonly kind: "box";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly w: number;
    }
  | {
      readonly kind: "fillBox";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    }
  | { readonly kind: "dot"; readonly cx: number; readonly cy: number; readonly r: number };

const GLOBE: readonly IconShape[] = [
  { kind: "ring", cx: 12, cy: 12, r: 10, w: 2 },
  { kind: "ellipse", cx: 12, cy: 12, rx: 4.5, ry: 10, w: 1.6 },
  { kind: "line", x1: 2, y1: 12, x2: 22, y2: 12, w: 1.6 },
  { kind: "line", x1: 4, y1: 7, x2: 20, y2: 7, w: 1.4 },
  { kind: "line", x1: 4, y1: 17, x2: 20, y2: 17, w: 1.4 },
];

const WINDOW_PANES: readonly IconShape[] = [
  { kind: "fillBox", x: 2.5, y: 3.5, width: 8.5, height: 8 },
  { kind: "fillBox", x: 13, y: 3.5, width: 8.5, height: 8 },
  { kind: "fillBox", x: 2.5, y: 13, width: 8.5, height: 8 },
  { kind: "fillBox", x: 13, y: 13, width: 8.5, height: 8 },
];

// A laptop whose screen carries a looped-square mark (the command key's outline), not any maker's logo.
const LAPTOP: readonly IconShape[] = [
  { kind: "box", x: 4, y: 3.5, width: 16, height: 12, w: 2 },
  { kind: "fillBox", x: 1.5, y: 18, width: 21, height: 2.5 },
  { kind: "box", x: 9.5, y: 7, width: 5, height: 5, w: 1.4 },
  { kind: "dot", cx: 8.7, cy: 6.2, r: 1.2 },
  { kind: "dot", cx: 15.3, cy: 6.2, r: 1.2 },
  { kind: "dot", cx: 8.7, cy: 12.8, r: 1.2 },
  { kind: "dot", cx: 15.3, cy: 12.8, r: 1.2 },
];

const TERMINAL: readonly IconShape[] = [
  { kind: "box", x: 2, y: 4, width: 20, height: 16, w: 2 },
  { kind: "line", x1: 6, y1: 9, x2: 10, y2: 12, w: 2 },
  { kind: "line", x1: 10, y1: 12, x2: 6, y2: 15, w: 2 },
  { kind: "line", x1: 12.5, y1: 15.5, x2: 18, y2: 15.5, w: 2 },
];

// Two phones: a punch-hole camera on Android, a top notch on iOS.
const ANDROID_PHONE: readonly IconShape[] = [
  { kind: "box", x: 6.5, y: 1.5, width: 11, height: 21, w: 2 },
  { kind: "dot", cx: 12, cy: 5, r: 1.2 },
  { kind: "line", x1: 10, y1: 19, x2: 14, y2: 19, w: 1.6 },
];

const IOS_PHONE: readonly IconShape[] = [
  { kind: "box", x: 6.5, y: 1.5, width: 11, height: 21, w: 2 },
  { kind: "line", x1: 9.5, y1: 4.5, x2: 14.5, y2: 4.5, w: 2.4 },
  { kind: "dot", cx: 12, cy: 19, r: 1.3 },
];

const ICONS: Readonly<Record<PlayPlatform, readonly IconShape[]>> = {
  web: GLOBE,
  windows: WINDOW_PANES,
  macos: LAPTOP,
  linux: TERMINAL,
  android: ANDROID_PHONE,
  ios: IOS_PHONE,
};

const NAMES: Readonly<Record<PlayPlatform, string>> = {
  web: "a browser",
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iOS",
};

export interface PlayPlatformMark {
  readonly platform: PlayPlatform;
  /** The accessible text: "Played on Windows", "Played on Windows (Desk PC)", "Played in a browser". */
  readonly label: string;
  readonly shapes: readonly IconShape[];
}

/** The mark for a save's `lastPlayedOn`, or null for a save with none (older saves): no icon, no label. */
export function playPlatformMarkOf(lastPlayedOn: LastPlayedOn | undefined): PlayPlatformMark | null {
  const shapes = lastPlayedOn && isPlayPlatform(lastPlayedOn.platform) ? ICONS[lastPlayedOn.platform] : undefined;
  if (!lastPlayedOn || !shapes) return null;
  const device = typeof lastPlayedOn.device === "string" ? lastPlayedOn.device.trim() : "";
  const base = `${lastPlayedOn.platform === "web" ? "Played in" : "Played on"} ${NAMES[lastPlayedOn.platform]}`;
  return { platform: lastPlayedOn.platform, label: device ? `${base} (${device})` : base, shapes };
}

/** Space around the icon, and the largest it is drawn. */
const EDGE = 14;
const GAP = 8;
const MAX_SIZE = 28;

export interface PlayPlatformSlot {
  /** Where the 24 x 24 icon grid is drawn (square). */
  readonly box: Rect;
  /** Room to keep clear at the control's left edge so its label centers in what is left (`McButtonOptions.labelInset`). */
  readonly labelInset: number;
}

/** Where a mark sits inside a control's `rect`: at its left edge, centered vertically, never past the control's height. */
export function playPlatformSlotIn(rect: Rect): PlayPlatformSlot {
  const size = Math.max(16, Math.min(MAX_SIZE, rect.height - 2 * EDGE + 8));
  return {
    box: { x: rect.x + EDGE, y: rect.y + (rect.height - size) / 2, width: size, height: size },
    labelInset: EDGE + size + GAP,
  };
}
