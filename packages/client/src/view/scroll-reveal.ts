/**
 * How far a scroll region has to move to bring an item fully into view: negative scrolls up, positive scrolls down,
 * 0 when it already shows. An item taller than the viewport lines its top up. `margin` keeps a little air around it.
 * Used by a screen that draws its content eagerly into a `McScrollRegion` and gives each control a focus stop
 * (`FocusStop.ensureVisible`), where the region has no row index to scroll to.
 */
export function revealDelta(
  viewport: { readonly top: number; readonly bottom: number },
  item: { readonly top: number; readonly bottom: number },
  margin = 8,
): number {
  if (item.top < viewport.top + margin) return item.top - viewport.top - margin;
  if (item.bottom > viewport.bottom - margin) {
    if (item.bottom - item.top > viewport.bottom - viewport.top - margin * 2) return item.top - viewport.top - margin;
    return item.bottom - viewport.bottom + margin;
  }
  return 0;
}
