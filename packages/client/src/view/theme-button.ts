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

/** The short tab the toggle hangs from the top edge as, centred: it clears a title set below it (`topBarThemePlan`). */
export function themeTabSlot(screen: { readonly width: number }): Rect {
  return { x: Math.round(screen.width / 2 - 17), y: 0, width: 34, height: 20 };
}

/** Space kept between the toggle and the words of a top bar. */
const THEME_CLEARANCE = 6;

/**
 * Where the toggle goes for a top bar whose words (back label, chip, title, tag) span `textLeft` to `textRight` and are
 * `textHeight` tall, centred in a bar `barHeight` tall: the toggle must never sit on them. When its floating slot
 * (`floatingThemeSlot`) clears the words it stays (`slot` null); otherwise it hangs from the top edge as a short tab
 * and the words drop by `drop` px to sit under it, never past the bar's foot. Pure, so the no-overlap rule is tested.
 */
export function topBarThemePlan(args: {
  readonly width: number;
  readonly barHeight: number;
  readonly textLeft: number;
  readonly textRight: number;
  readonly textHeight: number;
}): { readonly slot: Rect | null; readonly drop: number } {
  const { width, barHeight, textLeft, textRight, textHeight } = args;
  const top = barHeight / 2 - textHeight / 2;
  const bottom = barHeight / 2 + textHeight / 2;
  const clears = (slot: Rect): boolean =>
    textRight + THEME_CLEARANCE <= slot.x ||
    textLeft >= slot.x + slot.width + THEME_CLEARANCE ||
    top >= slot.y + slot.height + THEME_CLEARANCE;
  if (clears(floatingThemeSlot({ width }))) return { slot: null, drop: 0 };
  const tab = themeTabSlot({ width });
  const wanted = tab.y + tab.height + THEME_CLEARANCE - top;
  const room = Math.max(0, barHeight - 2 - bottom);
  const drop = Math.max(0, Math.min(wanted, room));
  // When the words cannot drop far enough for the whole tab, the tab is drawn shorter (never under 12px) so it still
  // ends above them; the toggle's own hit area stays at least a touch target (`scenes/theme-button.ts`).
  const height = Math.min(tab.height, top + drop - THEME_CLEARANCE);
  if (height < 12) return { slot: null, drop: 0 };
  return { slot: { ...tab, height }, drop };
}

/** The toggle's press area: a touch target wide and at least 32px tall, even where it is drawn as a short tab. */
export function themeHitRect(slot: Rect): Rect {
  const width = Math.max(slot.width, 44);
  return { x: slot.x - (width - slot.width) / 2, y: slot.y, width, height: Math.max(slot.height, 32) };
}

/**
 * The same rule for the words of a bar or heading drawn in a panel (`mc-sheet`), where the toggle's whole press area
 * is cut out of the panel (`dom/chrome-holes.ts`), not just the tab drawn in it: text under that area is cut off. The
 * words start `textTop` px down, are `textHeight` tall and span `textLeft` to `textRight`; `barHeight` (omit for a
 * heading on the page) is the bar they must stay inside. They keep clear of the press area by dropping below it when the
 * bar has the room (`drop`), else by ending before it (`maxRight`: fit the words to that edge). `slot` is where the
 * toggle goes (null: it floats where it does).
 */
export function sheetThemePlan(args: {
  readonly width: number;
  readonly textLeft: number;
  readonly textRight: number;
  readonly textTop: number;
  readonly textHeight: number;
  readonly barHeight?: number;
}): { readonly slot: Rect | null; readonly drop: number; readonly maxRight: number | null } {
  const { width, textLeft, textRight, textTop, textHeight, barHeight } = args;
  const floating = themeHitRect(floatingThemeSlot({ width }));
  // Beside the press area the words may end right at its edge (it is a cut-out, not a drawn frame); under it they keep a gap.
  const clears =
    textRight <= floating.x ||
    textLeft >= floating.x + floating.width ||
    textTop >= floating.y + floating.height + THEME_CLEARANCE;
  if (clears) return { slot: null, drop: 0, maxRight: null };
  const tab = themeTabSlot({ width });
  const press = themeHitRect(tab);
  const wanted = Math.max(0, press.y + press.height + THEME_CLEARANCE - textTop);
  const room = barHeight === undefined ? Infinity : barHeight - 2 - (textTop + textHeight);
  if (wanted <= room) return { slot: tab, drop: wanted, maxRight: null };
  return { slot: tab, drop: 0, maxRight: press.x - THEME_CLEARANCE };
}
