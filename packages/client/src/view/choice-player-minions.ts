/**
 * The minions engaged with each player, shown on a choose-a-player row (issue #911, Quin 2026-11-20): Multi-Gun's
 * "Choose a player. Deal 1 damage to each minion engaged with that player." reads better with each seat's minions in
 * view. Each picture opens the card hover on a desktop, with the minion's hit points, damage and statuses. Plain data
 * and geometry here; `scenes/choice.ts` draws it.
 */
import { minionsEngagedWith, type ChoiceRef, type GameState, type InstanceId } from "@mc/engine";
import type { Rect } from "./layout.js";

/** Gap between two minion pictures, and between the strip and the row's label. */
export const MINION_STRIP_GAP = 4;
/** The largest a minion picture gets; a short row draws them smaller. */
export const MINION_THUMB_MAX = 40;

/** The minions engaged with the player a row names, in table order; none for a row that names no player. */
export function playerRowMinions(game: GameState, ref: ChoiceRef): readonly InstanceId[] {
  return ref.kind === "player" ? minionsEngagedWith(game, ref.playerId) : [];
}

export interface MinionStrip {
  /** One square per minion drawn, right-aligned in the row. */
  readonly thumbs: readonly Rect[];
  /** Minions there was no room for, said as "+N" after the last picture. */
  readonly more: number;
  /** Where "+N" goes, when `more` > 0. */
  readonly moreRect: Rect | null;
  /** The width the strip takes from the row's right end (0 with no minion). */
  readonly width: number;
}

/** Width of the "+N" label's slot. */
const MORE_WIDTH = 28;

/**
 * The strip of `count` minion pictures at the right end of `row`, at most `maxWidth` wide. Pictures that don't fit are
 * counted in `more`.
 */
export function minionStripOf(row: Rect, count: number, maxWidth: number): MinionStrip {
  if (count <= 0 || maxWidth <= 0) return { thumbs: [], more: 0, moreRect: null, width: 0 };
  const side = Math.max(0, Math.min(MINION_THUMB_MAX, row.height - 12));
  if (side <= 0) return { thumbs: [], more: count, moreRect: null, width: 0 };
  const step = side + MINION_STRIP_GAP;
  const fitAll = Math.floor((maxWidth - MINION_STRIP_GAP) / step);
  const shown = fitAll >= count ? count : Math.max(0, Math.floor((maxWidth - MINION_STRIP_GAP - MORE_WIDTH) / step));
  const more = count - shown;
  const width = MINION_STRIP_GAP + shown * step + (more > 0 ? MORE_WIDTH : 0);
  const right = row.x + row.width;
  const y = row.y + (row.height - side) / 2;
  const left = right - width + MINION_STRIP_GAP;
  const thumbs = Array.from({ length: shown }, (_, i): Rect => ({ x: left + i * step, y, width: side, height: side }));
  const moreRect = more > 0 ? { x: left + shown * step, y: row.y, width: MORE_WIDTH, height: row.height } : null;
  return { thumbs, more, moreRect, width };
}
