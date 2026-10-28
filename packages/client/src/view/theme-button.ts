/**
 * The dark mode toggle (#459, `scenes/theme-button.ts`): the pure parts. A moon while the screens are light (a tap goes
 * dark), a sun while they are dark (a tap goes light), so the button shows where it takes you, as a light switch does.
 *
 * It is on every screen. Where a screen's top bar keeps the chrome cluster (the table and Title: Report, music,
 * language), it joins that cluster just left of the language button. Every other screen gets it at the top centre,
 * which the screens' own top bars leave clear (their titles sit left, their step counts and actions right).
 */
import type { ColorScheme } from "./color-scheme.js";
import type { Rect } from "./layout.js";

/** The theme button's slot: square, at the language button's height, just left of it. */
export function themeSlotBeside(language: Rect, gap = 8): Rect {
  const width = language.height;
  return { x: language.x - gap - width, y: language.y, width, height: language.height };
}

/**
 * Where it floats on a screen with no chrome cluster: centred at the top. On a phone, whose top bars fill their width
 * with a Back button, a title and a step count, it hangs from the very top edge as a short tab, above the title's line.
 */
export function floatingThemeSlot(screen: { readonly width: number }): Rect {
  if (screen.width < 600) return { x: Math.round(screen.width / 2 - 17), y: 0, width: 34, height: 20 };
  return { x: Math.round(screen.width / 2 - 19), y: 6, width: 38, height: 30 };
}

/** Which icon it draws: where a tap goes. */
export function themeIconOf(scheme: ColorScheme): "moon" | "sun" {
  return scheme === "light" ? "moon" : "sun";
}

/** What a screen reader or the focus ring's tooltip would say for it. */
export function themeButtonLabel(scheme: ColorScheme): string {
  return scheme === "light" ? "Dark mode: off" : "Dark mode: on";
}
