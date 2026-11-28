/** A real tap on `element` for a test: a pointer press and release in the same place (the tap rule's own shape). */
export function tap(element: Element, at: { x: number; y: number } = { x: 5, y: 5 }): void {
  const init = { bubbles: true, composed: true, clientX: at.x, clientY: at.y, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", init));
  element.dispatchEvent(new PointerEvent("pointerup", init));
}

/** The keys an element's `mc-activate` reported, in order. */
export function activations(host: Element): string[] {
  const keys: string[] = [];
  host.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
  return keys;
}
