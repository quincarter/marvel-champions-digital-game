/**
 * The minions engaged with each player, shown on a choose-a-player row (issue #911, Quin 2026-11-20): Multi-Gun's
 * "Choose a player. Deal 1 damage to each minion engaged with that player." reads better with each seat's minions in
 * view. Several minions overlap as a fanned stack with a count badge, the last one on top; each picture opens the card
 * hover on a desktop over the part of it that shows, with the minion's hit points, damage and statuses. Plain data and
 * geometry here; `scenes/choice.ts` draws it.
 */
import { minionsEngagedWith, type ChoiceRef, type GameState, type InstanceId } from "@mc/engine";
import type { Rect } from "./layout.js";

/** Gap between the strip and the row's label or right edge. */
export const MINION_STRIP_GAP = 4;
/** The largest a minion picture gets; a short row draws them smaller. */
export const MINION_THUMB_MAX = 40;
/** How much of each picture under the top one still shows, as a share of its width. */
export const MINION_FAN_SHOW = 0.4;
/** The fewest pixels of a covered picture that show, so it can still be hovered. */
const MIN_SLIVER = 10;

/** The minions engaged with the player a row names, in table order; none for a row that names no player. */
export function playerRowMinions(game: GameState, ref: ChoiceRef): readonly InstanceId[] {
  return ref.kind === "player" ? minionsEngagedWith(game, ref.playerId) : [];
}

export interface MinionStrip {
  /** Each picture drawn, bottom of the stack first; the last is on top and fully shown. */
  readonly thumbs: readonly Rect[];
  /** The part of each picture that shows (its hover and press area), in the same order. */
  readonly visible: readonly Rect[];
  /** Minions in the stack, for the count badge (shown at 2 or more). */
  readonly count: number;
  /** Where the count badge sits: the top picture's upper right corner. Null under 2 minions. */
  readonly badge: Rect | null;
  /** The width the strip takes from the row's right end (0 with no minion). */
  readonly width: number;
}

const BADGE_SIZE = 18;

/**
 * The stack of `count` minion pictures at the right end of `row`, never wider than `maxWidth`. The pictures fan from
 * left to right, each covered one showing `MINION_FAN_SHOW` of its width; with too many to fan in `maxWidth` the
 * slivers narrow down to `MIN_SLIVER`, and past that only the first minions are drawn (`thumbs` is shorter than
 * `count`) while the badge still says how many there are (code review, #911).
 */
export function minionStripOf(row: Rect, count: number, maxWidth: number): MinionStrip {
  const none: MinionStrip = { thumbs: [], visible: [], count: 0, badge: null, width: 0 };
  if (count <= 0 || maxWidth <= 0) return none;
  const side = Math.max(0, Math.min(MINION_THUMB_MAX, row.height - 12, maxWidth - 2 * MINION_STRIP_GAP));
  if (side <= 0) return none;
  const room = maxWidth - 2 * MINION_STRIP_GAP - side;
  const shown = 1 + Math.min(count - 1, Math.floor(room / MIN_SLIVER));
  const step = shown > 1 ? Math.min(Math.round(side * MINION_FAN_SHOW), Math.floor(room / (shown - 1))) : 0;
  const stackWidth = side + step * (shown - 1);
  const width = stackWidth + 2 * MINION_STRIP_GAP;
  const left = row.x + row.width - MINION_STRIP_GAP - stackWidth;
  const y = row.y + (row.height - side) / 2;
  const thumbs = Array.from({ length: shown }, (_, i): Rect => ({ x: left + i * step, y, width: side, height: side }));
  const visible = thumbs.map((thumb, i): Rect => (i < shown - 1 ? { ...thumb, width: step } : thumb));
  const top = thumbs[shown - 1]!;
  const badge =
    count > 1 ? { x: top.x + top.width - BADGE_SIZE + 4, y: top.y - 4, width: BADGE_SIZE, height: BADGE_SIZE } : null;
  return { thumbs, visible, count, badge, width };
}
