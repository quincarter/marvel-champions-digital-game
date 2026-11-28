/**
 * Shrinks a one-line element's font until its text fits its box, down to the caption floor, as the client's Phaser
 * `fitText` does. The element must clip its overflow (`overflow: hidden`, `white-space: nowrap`) so `scrollWidth` reports
 * the text's own width; what still does not fit at the floor is cut with an ellipsis by the stylesheet.
 */
export function fitOneLine(element: HTMLElement): void {
  element.style.fontSize = "";
  if (element.clientWidth === 0) return;
  const style = getComputedStyle(element);
  const floor = parseFloat(style.getPropertyValue("--mc-small-8")) || 8;
  let size = parseFloat(style.fontSize);
  while (element.scrollWidth > element.clientWidth && size > floor) {
    size = Math.max(floor, size - 0.5);
    element.style.fontSize = `${size}px`;
  }
}

/** Shrinks a wrapped text block one step at a time until it fits its box's height (down to `floor` px). */
export function fitBlock(element: HTMLElement, floor = 9): void {
  element.style.fontSize = "";
  if (element.clientHeight === 0) return;
  let size = parseFloat(getComputedStyle(element).fontSize);
  while (element.scrollHeight > element.clientHeight && size > floor) {
    size -= 1;
    element.style.fontSize = `${size}px`;
  }
}
