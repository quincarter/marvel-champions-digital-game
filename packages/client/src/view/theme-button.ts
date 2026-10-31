/**
 * The dark mode toggle (#459, `scenes/theme-button.ts`): the pure parts. A moon while the screens are light (a tap goes
 * dark), a sun while they are dark (a tap goes light), so the button shows where it takes you, as a light switch does.
 *
 * It is on every screen. Where a screen's top bar keeps the chrome cluster (the table and Title: Report, music,
 * language), it joins that cluster just left of the language button. Every other screen gets it at the top centre,
 * which the screens' own top bars leave clear (their titles sit left, their step counts and actions right). Popups
 * (Pause, Inspect, a confirm) cover their screen's top bar, so it hides under them (`floatsOver`).
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

/** Overlays that are a whole page of their own, with their own top bar: the toggle floats on them as on a screen. */
const PAGE_OVERLAYS: ReadonlySet<string> = new Set(["RulesOverlay", "SetCardsOverlay"]);

/**
 * Whether the toggle floats over `key`, the topmost running screen or overlay. Every other overlay is a popup over its
 * screen, and the toggle hides under it rather than sit on the popup's scrim or its title (#514); dark mode is still a
 * row in Settings.
 */
export function floatsOver(key: string): boolean {
  return PAGE_OVERLAYS.has(key) || !/(Overlay|Sheet)$/.test(key);
}

/** Which icon it draws: where a tap goes. */
export function themeIconOf(scheme: ColorScheme): "moon" | "sun" {
  return scheme === "light" ? "moon" : "sun";
}
