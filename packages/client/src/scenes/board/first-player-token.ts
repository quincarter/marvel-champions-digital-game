/**
 * The first player token on the table: always on the first player's identity card (its top left corner, like the
 * physical token set down on it), and flown to the next first player when it passes (`view/first-player-token-motion.ts`).
 *
 * Every Board draw clears the display list (`motion.ts`'s own file comment), so the flight is kept as data with a
 * start time and each draw re-creates the token partway along. While something covers the table (the villain phase
 * walkthrough, the round debrief) the token waits on the seat it was on, so the pass is seen when the table is.
 */
import type Phaser from "phaser";
import type { PlayerId } from "@mc/engine";
import { appSession } from "../../session.js";
import {
  FirstPlayerTokenView,
  ensureFirstPlayerTokenTexture,
  flyFirstPlayerToken,
} from "../../ui/first-player-token.js";
import type { FirstPlayerTokenMotion } from "../../settings.js";
import { effectiveTokenMotion, tokenMotionDurationMs, type Point } from "../../view/first-player-token-motion.js";
import { clampedProgress } from "../../view/motion-math.js";
import type { Rect } from "../../view/layout.js";

/** Above the table's panels and the hand, under the phase band (1150) and anything an overlay scene draws. */
const TOKEN_DEPTH = 900;

interface Flight {
  readonly from: Point;
  readonly to: PlayerId;
  readonly style: FirstPlayerTokenMotion;
  readonly startMs: number;
}

/** A seat's row in Other heroes (much wider than tall), rather than an identity card or panel. */
function isSeatRow(anchor: Rect): boolean {
  return anchor.width > anchor.height * 2;
}

/** A row with room for the token on its name line, in place of the old "1st player" label (`zones.ts#drawLiveSeat`). */
const ROW_TOKEN_MIN_HEIGHT = 40;

/** The token's size on an anchor: a third of a card's short side, or most of a seat row's name line; never too small to see. */
export function boardTokenSize(anchor: Rect): number {
  if (isSeatRow(anchor)) return Math.round(Math.min(34, Math.max(22, anchor.height * 0.6)));
  return Math.round(Math.min(52, Math.max(30, Math.min(anchor.width, anchor.height) * 0.34)));
}

/**
 * Where the token sits on its anchor: over a card's top left corner, like the physical token set down on it; on a seat
 * row at the right of its name line, where "1st player" was written; on a one-line row (too short for that) over its
 * left edge.
 */
export function boardTokenSpot(anchor: Rect, size: number): Point {
  if (!isSeatRow(anchor)) return { x: anchor.x + size * 0.42, y: anchor.y + size * 0.42 };
  if (anchor.height < ROW_TOKEN_MIN_HEIGHT) return { x: anchor.x, y: anchor.y + anchor.height / 2 };
  return { x: anchor.x + anchor.width - size / 2 - 6, y: anchor.y + size / 2 + 3 };
}

export class BoardFirstPlayerToken {
  /** The seat the token rests on (or last rested on, mid-flight), and where it was drawn for it. */
  #holder: PlayerId | null = null;
  #lastSpot: Point | null = null;
  #flight: Flight | null = null;
  #view: FirstPlayerTokenView | null = null;

  /** Dev e2e hook: who holds the token, where it is flying, and where it is drawn right now. */
  debugState(): { holder: PlayerId | null; flyingTo: PlayerId | null; x: number; y: number } | null {
    const body = this.#view?.active ? this.#view.body : null;
    return body ? { holder: this.#holder, flyingTo: this.#flight?.to ?? null, x: body.x, y: body.y } : null;
  }

  /** True while a pass to `firstPlayerId` waits for the table to come back into view. */
  waiting(firstPlayerId: PlayerId): boolean {
    return this.#holder !== null && this.#holder !== firstPlayerId && this.#flight === null;
  }

  reset(): void {
    this.#holder = null;
    this.#lastSpot = null;
    this.#flight = null;
  }

  /**
   * Draws the token for `firstPlayerId`. `anchorOf` is where a seat's identity card is on this frame (null when it
   * isn't drawn, as on a phone tab that hides it); `fallback` is where the token goes when its seat has no card on
   * screen, so it is never off the table.
   */
  draw(
    scene: Phaser.Scene,
    firstPlayerId: PlayerId,
    anchorOf: (playerId: PlayerId) => Rect | null,
    fallback: Rect,
    covered: boolean,
  ): void {
    ensureFirstPlayerTokenTexture(scene);
    const now = scene.time.now;
    const spotOf = (playerId: PlayerId): { readonly at: Point; readonly size: number } => {
      const anchor = anchorOf(playerId);
      if (anchor) {
        const size = boardTokenSize(anchor);
        return { at: boardTokenSpot(anchor, size), size };
      }
      const size = Math.round(Math.min(40, Math.max(28, fallback.height - 6)));
      return { at: { x: fallback.x + fallback.width / 2, y: fallback.y + fallback.height / 2 }, size };
    };

    if (this.#holder === null) this.#holder = firstPlayerId;
    // A pass starts its flight only once the table is in view, from wherever the token was last drawn.
    if (this.#holder !== firstPlayerId && !covered && this.#flight?.to !== firstPlayerId) {
      const from = this.#lastSpot ?? spotOf(this.#holder).at;
      this.#flight = { from, to: firstPlayerId, style: effectiveTokenMotion(appSession().settings), startMs: now };
    }
    const resting = this.#flight ? this.#flight.to : this.#holder;
    const target = spotOf(covered && !this.#flight ? this.#holder : resting);

    const view = new FirstPlayerTokenView(scene, target.at, target.size).setDepth(TOKEN_DEPTH);
    this.#view = view;
    const flight = this.#flight;
    if (!flight) {
      this.#lastSpot = target.at;
      return;
    }
    const durationMs = tokenMotionDurationMs(flight.style, flight.from, target.at);
    const progress = clampedProgress(now - flight.startMs, durationMs);
    const land = (): void => {
      if (this.#flight !== flight) return;
      this.#flight = null;
      this.#holder = flight.to;
      this.#lastSpot = target.at;
    };
    flyFirstPlayerToken(scene, view, flight.from, target.at, flight.style, { startProgress: progress, onLanded: land });
  }
}
