/**
 * The one coach card on screen, if any (Guided mode, game tips, the first-run "New to Marvel Champions?"), and
 * which scene asked for it. `scenes/coach.ts` draws whatever is here; a screen puts a card here with
 * `presentCoach` and never touches the overlay itself.
 *
 * Plain module state rather than a scene field because the keyboard needs it too: Phaser runs each scene's
 * keyboard handlers in the order the scenes started, not top to bottom, so the coach overlay can't stop an Escape
 * reaching the screen beneath it. Instead the shared binding (`scenes/board/input.ts#bindKeyboard`) asks
 * `coachKeyFor` first, and only the scene that owns the card gives up its Escape.
 */
import type { Rect } from "../view/layout.js";

export interface CoachAction {
  readonly id: string;
  readonly label: string;
  readonly onClick: () => void;
  /** The forward action (Next, Got it): drawn solid, and what N presses. */
  readonly forward?: boolean;
}

export interface CoachCard {
  /** Identity for redrawing: the overlay redraws only when this changes (or the window resizes). */
  readonly key: string;
  /** Small caps line above the title: "Guided mode · step 2 of 9", "Tip". */
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly warning?: string | null;
  readonly cite?: string | null;
  /** The part of the screen the card is about, outlined; the card sits clear of it. */
  readonly anchor?: Rect | null;
  /** Where the card sits when there's no anchor. */
  readonly corner?: "topRight" | "bottomRight" | "bottomLeft" | "topLeft";
  /** Drawn left to right, secondary ones first; a forward action goes last. */
  readonly actions: readonly CoachAction[];
  /** What Escape does. Without one, Escape is left to the screen. */
  readonly onEscape?: () => void;
  /** The hint line under the buttons ("Esc closes the guide"). */
  readonly hint?: string;
}

export interface CoachPresentation {
  readonly owner: string;
  readonly card: CoachCard;
}

let current: CoachPresentation | null = null;

export function coachPresentation(): CoachPresentation | null {
  return current;
}

export function setCoachPresentation(next: CoachPresentation | null): void {
  current = next;
}

/** Clears the card, but only if `owner` is the scene that put it there: a screen shutting down never clears its successor's card. */
export function clearCoachFor(owner: string): void {
  if (current?.owner === owner) current = null;
}

/**
 * What a key does to the coach for this scene, if anything: Escape runs the card's `onEscape`, N its forward
 * action. Returns true when the coach took the key, so the screen's own binding skips it.
 */
export function coachKeyFor(sceneKey: string, key: string): boolean {
  if (!current || current.owner !== sceneKey) return false;
  const { card } = current;
  if (key === "Escape" && card.onEscape) {
    card.onEscape();
    return true;
  }
  if (key === "n" || key === "N") {
    const forward = card.actions.find((action) => action.forward);
    if (forward) {
      forward.onClick();
      return true;
    }
  }
  return false;
}
