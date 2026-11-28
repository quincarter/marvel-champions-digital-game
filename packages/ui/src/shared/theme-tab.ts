/**
 * Where the dark mode toggle's tab is: the one shared source every top bar clears its title from (`mc-top-bar`). The
 * client's theme button publishes its press area here whenever it moves (`setThemeTab`), in the panel layer's px (the
 * same px a panel is laid out in, from the layer's top-left); a bar reads it (`themeTab`) and listens for changes
 * (`onThemeTabChange`). Null while the toggle is hidden (under a pop-up), which is when no bar has anything to clear.
 */
export interface ThemeTabBox {
  readonly left: number;
  readonly right: number;
  /** The press area's lower edge: a title dropped under the tab starts below it. */
  readonly bottom: number;
}

let tab: ThemeTabBox | null = null;
const listeners = new Set<() => void>();

/** The tab's box now, or null while it is hidden. */
export function themeTab(): ThemeTabBox | null {
  return tab;
}

/** Publishes the tab's box (null: hidden). A no-op when it is the box already published. */
export function setThemeTab(box: ThemeTabBox | null): void {
  const same =
    box === tab ||
    (box !== null && tab !== null && box.left === tab.left && box.right === tab.right && box.bottom === tab.bottom);
  if (same) return;
  tab = box;
  for (const listener of [...listeners]) listener();
}

/** Calls `listener` whenever the tab's box changes; returns the function that stops listening. */
export function onThemeTabChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
