/**
 * The "Achievement unlocked" popup as plain data (docs/achievements.md, "Unlock popup"): which achievements are new
 * since the popup last looked, what each popup says, where it sits and how far through its animation it is. The scene
 * (`scenes/achievement-toast.ts`) only draws what this returns.
 *
 * The popup is a gold trophy badge that pops in, then a bar that opens out of it with the achievement's name and what
 * it earned, held for the Settings ▸ More ▸ Achievements time and folded away again. More than
 * `ACHIEVEMENT_TOAST_BATCH` at once (a save-data import, a first launch after an update that adds achievements) come as
 * one summary popup rather than a long queue.
 */
import type { AchievementPopupPlace } from "../settings.js";
import type { Rect } from "./layout.js";

/** The most achievements shown one popup each; more than this at once get one summary popup. */
export const ACHIEVEMENT_TOAST_BATCH = 4;

/** What one popup says. */
export interface AchievementToast {
  /** The small caps line over the name. */
  readonly heading: string;
  readonly title: string;
  /** What it earned: "+25 points", "Joke pack", or a summary's total. */
  readonly reward: string;
}

/** The part of an achievement the popup reads (`AchievementDef`). */
export interface AchievementToastSource {
  readonly id: string;
  readonly name: string;
  readonly points: number;
  readonly rewardPackId?: string;
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

/** The popups for a batch of new achievements: one each up to `ACHIEVEMENT_TOAST_BATCH`, otherwise one summary. */
export function achievementToastsOf(sources: readonly AchievementToastSource[]): readonly AchievementToast[] {
  if (sources.length <= ACHIEVEMENT_TOAST_BATCH) {
    return sources.map((source) => ({ heading: "Achievement unlocked", title: source.name, reward: rewardOf(source) }));
  }
  const points = sources.reduce((sum, source) => sum + source.points, 0);
  return [
    {
      heading: `${sources.length} achievements unlocked`,
      title: "See them in the Trophy Room",
      reward: points > 0 ? `+${points} points` : "Earned",
    },
  ];
}

/** The sample Settings shows when the player picks a time or a position. */
export function sampleAchievementToast(seconds: number): AchievementToast {
  return { heading: "Achievement unlocked", title: "Popup preview", reward: `${seconds} s here` };
}

/** The popup's height: slimmer in the title bar, where it has to fit the screens' top strip. */
export function achievementToastHeight(place: AchievementPopupPlace): number {
  return place === "titleBar" ? 48 : 72;
}

/**
 * Where the open popup sits on a `width` x `height` screen: centered across it, in the top bar (`titleBar`), just under
 * it (`top`), in the middle, or along the bottom edge. Never wider than the screen less a margin either side.
 */
export function achievementToastRect(
  place: AchievementPopupPlace,
  width: number,
  height: number,
  phone: boolean,
): Rect {
  const margin = phone ? 8 : 16;
  const h = achievementToastHeight(place);
  const w = Math.min(place === "titleBar" ? 380 : 460, width - 2 * margin);
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
