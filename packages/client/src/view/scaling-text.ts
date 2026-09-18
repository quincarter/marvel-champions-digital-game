/**
 * Wording a printed `ScalingValue` ("10 threat", "1 per player") for a screen
 * that has to show it before a player count is chosen — Scenario select's
 * detail panel (docs/phase4-screen-gaps.md §3 W2) shows a stage's HP or a main
 * scheme's starting threat before "Take your seats" has fixed how many
 * players there'll be, so it can't call `@mc/engine`'s `scale(value,
 * playerCount)` yet. Once seats are chosen, Table setup's "the game you'll
 * get" (`view/table-setup-preview.ts`) uses `scale` directly instead of this.
 *
 * `formatScaling({ base: 10, perPlayer: 1 })` → `"10 (+1 per player)"`;
 * `formatScaling({ base: 0, perPlayer: 3 })` → `"3 per player"`;
 * `formatScaling({ base: 12, perPlayer: 0 })` → `"12"`.
 */
import type { ScalingValue } from "@mc/content";

export function formatScaling(value: ScalingValue): string {
  if (value.perPlayer === 0) return `${value.base}`;
  if (value.base === 0) return `${value.perPlayer} per player`;
  return `${value.base} (+${value.perPlayer} per player)`;
}
