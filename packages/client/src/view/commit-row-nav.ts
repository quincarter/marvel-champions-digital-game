/**
 * The opening hand's commit row (Mulligan / Keep) sits under only the leftmost cards, so the spatial cone from a card
 * further right finds nothing. These two steps make Down from any card reach the nearer commit button and Up from
 * either button return to the card Down left from. Pure over rects: the scene calls them before the generic arrow step.
 */
import type { Rect } from "./layout.js";

export const COMMIT_KEYS = ["confirm", "decline"] as const;

/** The commit button whose centre is nearest `card`'s (ties go to Mulligan), or null with no commit rect. */
export function nearestCommit(card: Rect, rectOf: (key: string) => Rect | undefined): "confirm" | "decline" | null {
  const mid = card.x + card.width / 2;
  let best: { key: "confirm" | "decline"; gap: number } | null = null;
  for (const key of COMMIT_KEYS) {
    const rect = rectOf(key);
    if (!rect) continue;
    const gap = Math.abs(rect.x + rect.width / 2 - mid);
    if (!best || gap < best.gap) best = { key, gap };
  }
  return best?.key ?? null;
}

/** Down from a hand card: the commit button to focus, or null when this is not that case. */
export function commitStepDown(
  focus: string | null,
  rectOf: (key: string) => Rect | undefined,
): "confirm" | "decline" | null {
  if (!focus?.startsWith("option:")) return null;
  const card = rectOf(focus);
  return card ? nearestCommit(card, rectOf) : null;
}

/** Up from a commit button: the card it came from while that is still in the route, else null. */
export function commitStepUp(focus: string | null, cameFrom: string | null, route: readonly string[]): string | null {
  if (focus !== "confirm" && focus !== "decline") return null;
  return cameFrom !== null && route.includes(cameFrom) ? cameFrom : null;
}
