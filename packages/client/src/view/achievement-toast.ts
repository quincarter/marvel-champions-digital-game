/**
 * The "Achievement unlocked" popup as plain data (docs/achievements.md, "Unlock popup"): which achievements are new
 * since the popup last looked, what each popup says, where it sits and how far through its animation it is. The scene
 * (`scenes/achievement-toast.ts`) only draws what this returns.
 *
 * The popup is a gold trophy badge that pops in, then a bar that opens out of it with the achievement's name and what
 * it earned, held for the Settings ▸ More ▸ Achievements time and folded away again. Two or more at once stack into one
 * popup that opens on a tap into a list (`toastListLayout`), with Collapse and Dismiss; what opened in Extras gets the
 * same popup on its own beat, after the achievements' (the owner, 2026-10-20).
 */
import type { AchievementPopupPlace } from "../settings.js";
import type { Rect } from "./layout.js";

/** What one popup says. */
export interface AchievementToast {
  /** What it announces: the achievement sound or the Extras sting plays with it. */
  readonly kind: "achievement" | "extra";
  /** What the badge shows: the trophy for achievements, a note for songs, a star for any other Extras. */
  readonly badge: "trophy" | "music" | "star";
  /** The small caps line over the name. */
  readonly heading: string;
  readonly title: string;
  /** What it earned: "+25 points", "Joke pack", a stack's total, or nothing (an extra). */
  readonly reward: string;
  /** A stack's lines, one per item, shown when the popup is tapped open; empty for a single popup. */
  readonly items: readonly ToastLine[];
}

/** One line of an opened stack. */
export interface ToastLine {
  readonly title: string;
  readonly detail: string;
}

/** The part of an achievement the popup reads (`AchievementDef`). */
export interface AchievementToastSource {
  readonly id: string;
  readonly name: string;
  readonly points: number;
  readonly rewardPackId?: string;
}

/** The part of a newly opened Extras entry the popup reads (`view/extras-news.ts`). */
export interface ExtrasToastSource {
  readonly title: string;
  /** What kind of thing it is, "New song earned" (`extrasNewsHeadline` of the item alone). */
  readonly label: string;
  /** A song (the Extras jukebox): a popup of songs only wears a note on its badge. */
  readonly music?: boolean;
}

/**
 * The ids newly earned since `seen`, in `earned`'s order, and the set to remember next. A null `seen` (nothing stored
 * yet: a first run) announces nothing and only records what is already earned, so an existing player is not greeted
 * with every achievement at once. Ids once seen stay seen, so a save deleted and earned again never repeats one.
 */
export function newAchievementsOf(
  seen: ReadonlySet<string> | null,
  earned: readonly string[],
): { readonly fresh: readonly string[]; readonly remember: ReadonlySet<string> } {
  const remember = new Set(seen ?? []);
  for (const id of earned) remember.add(id);
  if (seen === null) return { fresh: [], remember };
  return { fresh: earned.filter((id) => !seen.has(id)), remember };
}

const rewardOf = (source: AchievementToastSource): string =>
  source.points > 0 ? `+${source.points} points` : source.rewardPackId ? "Joke pack" : "Earned";

/** What a stack's bar asks for, the press that opens it. */
export const STACK_PROMPT = "Tap to see them all";

/**
 * The popup for a batch of new achievements (the owner, 2026-10-20): one alone names itself; two or more stack into
 * one popup, counted, that opens on a tap to list them all. Never a run of popups one after another.
 */
export function achievementToastsOf(sources: readonly AchievementToastSource[]): readonly AchievementToast[] {
  if (sources.length === 0) return [];
  if (sources.length === 1) {
    const only = sources[0]!;
    return [
      {
        kind: "achievement",
        badge: "trophy",
        heading: "Achievement unlocked",
        title: only.name,
        reward: rewardOf(only),
        items: [],
      },
    ];
  }
  const points = sources.reduce((sum, source) => sum + source.points, 0);
  return [
    {
      kind: "achievement",
      badge: "trophy",
      heading: `${sources.length} achievements unlocked`,
      title: STACK_PROMPT,
      reward: points > 0 ? `+${points} points` : "",
      items: sources.map((source) => ({ title: source.name, detail: rewardOf(source) })),
    },
  ];
}

/**
 * The popup for what just opened in Extras, the same way: one names itself under its kind ("New song earned"); two or
 * more stack ("5 extras in the vault"). It follows the achievements' popup, on its own beat.
 */
export function extrasToastsOf(sources: readonly ExtrasToastSource[]): readonly AchievementToast[] {
  if (sources.length === 0) return [];
  const badge = sources.every((source) => source.music === true) ? "music" : "star";
  if (sources.length === 1) {
    const only = sources[0]!;
    return [{ kind: "extra", badge, heading: only.label, title: only.title, reward: "", items: [] }];
  }
  return [
    {
      kind: "extra",
      badge,
      heading: `${sources.length} extras in the vault`,
      title: STACK_PROMPT,
      reward: "",
      items: sources.map((source) => ({ title: source.title, detail: source.label })),
    },
  ];
}

/** The sample Settings shows when the player picks a time, a position or a size. */
export function sampleAchievementToast(seconds: number): AchievementToast {
  return {
    kind: "achievement",
    badge: "trophy",
    heading: "Achievement unlocked",
    title: "Popup preview",
    reward: `${seconds} s here`,
    items: [],
  };
}

/** An opened stack: a panel in the middle of the screen listing its lines, with Collapse and Dismiss under them. */
export interface ToastListLayout {
  readonly panel: Rect;
  readonly heading: Rect;
  /** One row per line that fits, top to bottom. */
  readonly rows: readonly Rect[];
  /** Lines that didn't fit, counted on a last row ("and 3 more"); 0 when all fit. */
  readonly more: number;
  readonly moreRow: Rect | null;
  readonly collapse: Rect;
  readonly dismiss: Rect;
}

const LIST_ROW = 40;
const LIST_HEADING = 44;
const LIST_BUTTONS = 64;

/** Where an opened stack of `count` lines draws on a `width` x `height` screen. */
export function toastListLayout(count: number, width: number, height: number, phone: boolean): ToastListLayout {
  const margin = phone ? 12 : 24;
  const panelWidth = Math.min(520, width - 2 * margin);
  const room = Math.max(LIST_ROW, height - 2 * margin - LIST_HEADING - LIST_BUTTONS - 16);
  const fit = Math.max(1, Math.floor(room / LIST_ROW));
  const shown = count <= fit ? count : fit - 1;
  const more = count - shown;
  const rowsHeight = (shown + (more > 0 ? 1 : 0)) * LIST_ROW;
  const panelHeight = LIST_HEADING + rowsHeight + 16 + LIST_BUTTONS;
  const panel = {
    x: Math.round((width - panelWidth) / 2),
    y: Math.round((height - panelHeight) / 2),
    width: panelWidth,
    height: panelHeight,
  };
  const inner = { x: panel.x + 16, width: panel.width - 32 };
  const rows = Array.from({ length: shown }, (_, i) => ({
    x: inner.x,
    y: panel.y + LIST_HEADING + i * LIST_ROW,
    width: inner.width,
    height: LIST_ROW,
  }));
  const moreRow =
    more > 0
      ? { x: inner.x, y: panel.y + LIST_HEADING + shown * LIST_ROW, width: inner.width, height: LIST_ROW }
      : null;
  const buttonY = panel.y + panel.height - LIST_BUTTONS + 10;
  const buttonWidth = (inner.width - 12) / 2;
  return {
    panel,
    heading: { x: inner.x, y: panel.y + 12, width: inner.width, height: LIST_HEADING - 12 },
    rows,
    more,
    moreRow,
    collapse: { x: inner.x, y: buttonY, width: buttonWidth, height: 44 },
    dismiss: { x: inner.x + buttonWidth + 12, y: buttonY, width: buttonWidth, height: 44 },
  };
}

/** The popup's height at medium size: slimmer in the title bar, where it has to fit the screens' top strip. */
export function achievementToastHeight(place: AchievementPopupPlace): number {
  return place === "titleBar" ? 48 : 72;
}

/**
 * Where the open popup sits on a `width` x `height` screen: centered across it, in the top bar (`titleBar`), just under
 * it (`top`), in the middle, or along the bottom edge, drawn at `scale` (Settings' popup size, `achievementPopupScale`).
 * Never wider than the screen less a margin either side.
 */
export function achievementToastRect(
  place: AchievementPopupPlace,
  width: number,
  height: number,
  phone: boolean,
  scale = 1,
): Rect {
  const margin = phone ? 8 : 16;
  const h = Math.round(achievementToastHeight(place) * scale);
  // Small only shrinks the height and the type: the bar keeps its width, so the words still fit on one line.
  const w = Math.min(Math.round((place === "titleBar" ? 380 : 460) * Math.max(1, scale)), width - 2 * margin);
  const x = Math.round((width - w) / 2);
  let y: number;
  switch (place) {
    case "titleBar":
      y = 6;
      break;
    case "top":
      y = phone ? 64 : 76;
      break;
    case "bottom":
      y = height - margin - h - (phone ? 8 : 16);
      break;
    default:
      y = Math.round((height - h) / 2);
  }
  return { x, y, width: w, height: h };
}

/** The badge pops in, the bar opens out of it; at the end the bar folds back and the badge shrinks away. */
export const TOAST_POP_MS = 260;
export const TOAST_OPEN_MS = 360;
export const TOAST_CLOSE_MS = 300;
export const TOAST_SHRINK_MS = 200;

/** One moment of the popup: the badge's scale, how far the bar is open (0 to 1), and the whole popup's alpha. */
export interface ToastFrame {
  readonly badgeScale: number;
  readonly open: number;
  readonly alpha: number;
  readonly done: boolean;
}

const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/**
 * The popup `elapsedMs` into a showing that lasts `totalMs` (the Settings time). The animation sits inside that time,
 * so the popup is gone when the time is up; whatever is left after the moves is the hold. Reduced motion shows it open
 * the whole time, with no moves.
 */
export function toastFrameAt(elapsedMs: number, totalMs: number, reducedMotion: boolean): ToastFrame {
  if (elapsedMs >= totalMs) return { badgeScale: 0, open: 0, alpha: 0, done: true };
  if (reducedMotion) return { badgeScale: 1, open: 1, alpha: 1, done: false };
  const moves = TOAST_POP_MS + TOAST_OPEN_MS + TOAST_CLOSE_MS + TOAST_SHRINK_MS;
  // A time shorter than the moves squeezes them to fit.
  const squeeze = Math.min(1, totalMs / moves);
  const pop = TOAST_POP_MS * squeeze;
  const open = TOAST_OPEN_MS * squeeze;
  const close = TOAST_CLOSE_MS * squeeze;
  const shrink = TOAST_SHRINK_MS * squeeze;
  const closeAt = totalMs - close - shrink;
  const shrinkAt = totalMs - shrink;
  if (elapsedMs < pop) {
    const t = clamp01(elapsedMs / pop);
    return { badgeScale: easeOutBack(t), open: 0, alpha: clamp01(t * 2), done: false };
  }
  if (elapsedMs < pop + open) {
    return { badgeScale: 1, open: easeOutCubic(clamp01((elapsedMs - pop) / open)), alpha: 1, done: false };
  }
  if (elapsedMs < closeAt) return { badgeScale: 1, open: 1, alpha: 1, done: false };
  if (elapsedMs < shrinkAt) {
    return { badgeScale: 1, open: 1 - easeOutCubic(clamp01((elapsedMs - closeAt) / close)), alpha: 1, done: false };
  }
  const t = clamp01((elapsedMs - shrinkAt) / shrink);
  return { badgeScale: 1 - t, open: 0, alpha: 1 - t, done: false };
}

/**
 * The popup's outline at a frame: the badge (a circle `rect.height` across) at the left of a bar that opens out to the
 * full `rect`, the pair kept centered while it opens, so the badge starts in the middle and moves left as the bar grows.
 */
export function toastShapeAt(
  rect: Rect,
  open: number,
): { readonly bar: Rect; readonly badge: { readonly cx: number; readonly cy: number; readonly r: number } } {
  const h = rect.height;
  const w = h + clamp01(open) * (rect.width - h);
  const x = rect.x + (rect.width - w) / 2;
  return { bar: { x, y: rect.y, width: w, height: h }, badge: { cx: x + h / 2, cy: rect.y + h / 2, r: h / 2 } };
}
