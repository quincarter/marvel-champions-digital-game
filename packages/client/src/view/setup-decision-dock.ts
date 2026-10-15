/**
 * Where a decision that opens while the table is being set up docks, so the setup card and the opening hands stay
 * visible beside it (`scenes/setup-deal.ts`, `scenes/choice.ts` in docked mode).
 *
 * On desktop and tablet-portrait the screen already has a right-hand column: the "Setup card revealed" panel over the
 * setup log. The decision takes the log's place, directly under the revealed card, down to the bottom of the screen.
 * Where that column is too small to hold a decision (a phone folds it under the hand; tablet landscape gives every
 * seat a column) there is no dock and the decision stays today's centered sheet.
 */
import type { Rect } from "./layout.js";
import type { SetupWalkthroughLayout } from "./setup-walkthrough-layout.js";

/** The smallest dock that can hold a headline, a card option and Confirm / Decline. */
export const MIN_DOCK_WIDTH = 340;
export const MIN_DOCK_HEIGHT = 380;

export function setupDecisionDock(layout: SetupWalkthroughLayout, bottom: number, gap: number): Rect | null {
  if (layout.mode !== "focus" || !layout.split) return null;
  const { revealedPanel, logPanel } = layout;
  if (!revealedPanel || !logPanel) return null;
  const top = revealedPanel.y + revealedPanel.height + gap;
  const dock: Rect = { x: revealedPanel.x, y: top, width: revealedPanel.width, height: bottom - top };
  return dock.width >= MIN_DOCK_WIDTH && dock.height >= MIN_DOCK_HEIGHT ? dock : null;
}
