/**
 * An ∞-hit-point villain face reads as the printed infinity symbol, never the literal word "Infinity" a bare
 * `String(value)`/template literal would produce (docs/phase7-wave3.md §3.1: the Collector's back face, "flip this
 * card, then set Collector's hit point dial to his printed hit points" — the front's finite dial, the back's own
 * ∞). `remainingHitPoints`/`maxHitPoints` (`@mc/engine`) genuinely return `Infinity` for that face; it survives
 * structured clone, so every reader of the two functions needs to know this, not only the character panel.
 *
 * Every formatter here is pure and total: `Infinity` in, "∞" out, everything else unchanged — used both by plain
 * text (`view/*.ts`) and by widgets/scenes that also need a fill ratio for a health bar (`ui/widgets.ts`,
 * `scenes/board/*.ts`).
 */

/** "12/22", or "∞" once `max` is (docs/phase7-wave3.md §3.1: `current` is always `Infinity` too, on that face — see this module's own docblock). */
export function hpFraction(current: number, max: number): string {
  return max === Infinity ? "∞" : `${current}/${max}`;
}

/** A bare HP number in a sentence ("with 14 hit points left") — "∞" once it is. */
export function hpNumber(value: number): string {
  return value === Infinity ? "∞" : String(value);
}

/** A health bar's fill, 0–1. An infinite pool always reads full — there is no "how much of infinity is used up". */
export function hpRatio(current: number, max: number): number {
  if (max === Infinity) return 1;
  return max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
}
