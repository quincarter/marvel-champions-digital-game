/**
 * The villain phase tucked away for review (the owner's request, 2026-10-14): once the recap closes into the player
 * phase, the round's villain phase stays one press away, on a drawer handle at the table's edge, until the next villain
 * phase replaces it. Pressing it brings the same recap back over the table, read-only, with Close.
 *
 * Pure: the snapshot the recap needs (the phase's walkthrough, the game before it and after it), and the rules for
 * when the Board shows the handle and which way the docked phase slides.
 */
import type { GameState, PlayerId } from "@mc/engine";
import type { FormFactor, Rect } from "./layout.js";
import type { Walkthrough } from "./villain-walkthrough.js";

export interface VillainReview {
  /** The round whose villain phase this was. */
  readonly round: number;
  readonly walkthrough: Walkthrough;
  /** The game before the phase began (the recap's "before" numbers). */
  readonly before: GameState | null;
  /** The game when the recap closed (its "after" numbers): the review shows the phase as it ended, not the table now. */
  readonly after: GameState;
  readonly viewer: PlayerId | null;
}

/** The handle shows in the player phase of the round right after the reviewed one, and nowhere else. */
export function showReviewHandle(review: VillainReview | null, game: GameState | null): boolean {
  if (!review || !game || game.outcome) return false;
  return game.step.phase === "player" && game.round === review.round + 1;
}

export type SlideEdge = "right" | "top" | "bottom";

/** Where the docked phase comes from and goes back to: the rail's right edge, the band's top, the tab's bottom. */
export function villainSlideEdge(formFactor: FormFactor): SlideEdge {
  switch (formFactor) {
    case "desktop":
      return "right";
    case "tabletLandscape":
      return "top";
    default:
      return "bottom";
  }
}

/** How far `rect` travels to be fully off `viewport` past `edge`: the slide's offset. */
export function slideOffset(edge: SlideEdge, rect: Rect, viewport: Rect): { readonly dx: number; readonly dy: number } {
  switch (edge) {
    case "right":
      return { dx: viewport.x + viewport.width - rect.x, dy: 0 };
    case "top":
      return { dx: 0, dy: viewport.y - (rect.y + rect.height) };
    case "bottom":
      return { dx: 0, dy: viewport.y + viewport.height - rect.y };
  }
}

/** The drawer handle at the table's right edge, centered on the height between the chrome and the hand. */
export function reviewHandleRect(viewport: Rect, top: number, bottom: number): Rect {
  const width = 30;
  const height = Math.min(200, Math.max(120, (bottom - top) * 0.4));
  return { x: viewport.x + viewport.width - width, y: Math.round((top + bottom - height) / 2), width, height };
}
