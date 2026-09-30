/**
 * Keeps a scrolling container's own interactive zones from answering a tap once they've scrolled
 * outside its viewport, or from answering the pointerup that ends a drag rather than a tap.
 *
 * `McVirtualList`/`McVariableList`/`McScrollRegion` all mask their content visually (`setMask`,
 * `ui/rex.ts`), but a Phaser mask is paint-only — it hides pixels, not hit areas. Two distinct bugs
 * follow from that, both fixed here rather than in every row's own widget (`McCardTile`,
 * `McButton`, a plain `Zone`), because a row can hold any of them, nested arbitrarily inside
 * `Container`s:
 *
 * - **Out-of-viewport rows stay clickable.** A row (or, for `McScrollRegion`, any piece of content)
 *   positioned above or below its own list is invisible but still fully hit-testable wherever it
 *   landed. On a screen with tall rows (the Rules reference glossary's own entry cards, several
 *   hundred px once wrapped) a single row of overscan can land squarely on completely unrelated UI
 *   — the tab bar, in the bug report `clipRowInteractivity` exists to fix: scrolled to the bottom of
 *   the Glossary, tapping "Villain phase" instead opened Inspect on a card thumbnail parked under
 *   the tab bar.
 * - **A drag's own release still fires whatever it ends on.** `McButton`'s own `suppressClick`
 *   option covers this for callers that remember to wire it up, but a plain `Zone` (the How to play
 *   hub's lesson/aspect/reference rows) has no such option, and a scroll gesture that ends on top of
 *   a row must never read as a tap on it. Rather than push `suppressClick` onto every row's own
 *   widget, the scrolling container disables every row's interactivity for the duration of a drag
 *   that's passed the tap threshold — Phaser's input plugin already refuses to dispatch `pointerup`
 *   to an object whose `input.enabled` is false at hit-test time, so a row disabled *before* the
 *   release simply never sees it, tap-vs-drag decided once, in one place.
 *
 * Both walk whatever object graph they're given and toggle each interactive object's own
 * `input.enabled` flag, which Phaser's input plugin already checks before hit-testing. That's
 * cheaper than `disableInteractive()`/`setInteractive()` (no hit-area rebuild) and is safe to call
 * on every scroll tick, which is exactly how often a row's own visibility and a drag's own state can
 * change.
 */
import type Phaser from "phaser";

interface MaybeInteractive {
  readonly input?: { enabled: boolean } | null;
  readonly list?: readonly Phaser.GameObjects.GameObject[];
}

/** Enables/disables `obj`'s own interactivity, and recurses into a `Container`'s children. */
export function setInteractiveEnabled(obj: Phaser.GameObjects.GameObject, enabled: boolean): void {
  const anyObj = obj as unknown as MaybeInteractive;
  if (anyObj.input) anyObj.input.enabled = enabled;
  if (anyObj.list) for (const child of anyObj.list) setInteractiveEnabled(child, enabled);
}

/** Same, over a whole list of top-level objects (a scroll container's own content). */
export function setAllInteractiveEnabled(objects: readonly Phaser.GameObjects.GameObject[], enabled: boolean): void {
  for (const obj of objects) setInteractiveEnabled(obj, enabled);
}

/**
 * Enables `objects`' own interactive zones (and any nested inside a `Container`) only while the row
 * they belong to is at least partly inside a viewport `viewportHeight` px tall — `rowTop`/`rowHeight`
 * already in that viewport's own coordinates (0 = its top), which is exactly what `ListScroll`'s and
 * `VariableListScroll`'s own `rowTop()` return — and while `dragSuppressed` (a drag past the tap
 * threshold, currently in progress) isn't holding every row disabled regardless of position.
 */
export function clipRowInteractivity(
  objects: readonly Phaser.GameObjects.GameObject[],
  rowTop: number,
  rowHeight: number,
  viewportHeight: number,
  dragSuppressed: boolean,
): void {
  const visible = !dragSuppressed && rowTop + rowHeight > 0 && rowTop < viewportHeight;
  setAllInteractiveEnabled(objects, visible);
}
