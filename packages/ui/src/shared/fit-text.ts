/**
 * One-line texts shrink to fit their width, as the client's Phaser `fitText` does: smaller down to the caption floor
 * (8px, grown on desktop like every small size), after which the stylesheet cuts them with an ellipsis. Mark a text
 * with `data-fit` (and `data-size`, its own size as CSS, when that is set inline); the element needs a width of its own and `overflow: hidden`.
 */
export function fitTextWithin(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-fit]")) {
    element.style.fontSize = element.dataset.size ?? "";
    const style = getComputedStyle(element);
    const floor = parseFloat(style.getPropertyValue("--mc-small-8")) || 8;
    let size = parseFloat(style.fontSize);
    while (element.scrollWidth > element.clientWidth && size > floor) {
      size = Math.max(floor, size - 0.5);
      element.style.fontSize = `${size}px`;
    }
  }
}
