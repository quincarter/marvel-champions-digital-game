/** Test helpers for the filters elements (not a test file: Vitest only runs `*.test.ts`). */

/** A real tap on `element`: a pointer press and release in the same place (the tap rule's own shape). */
export function tap(element: Element, at: { x: number; y: number } = { x: 5, y: 5 }): void {
  const init = { bubbles: true, composed: true, clientX: at.x, clientY: at.y, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", init));
  element.dispatchEvent(new PointerEvent("pointerup", init));
}

/** Every `[data-stop]` key under `root`, in document order, through open shadow roots (what the focus route finds). */
export function stopKeys(root: ParentNode): string[] {
  const keys: string[] = [];
  const visit = (node: ParentNode): void => {
    for (const child of node.querySelectorAll<HTMLElement>("*")) {
      if (child.dataset?.stop) keys.push(child.dataset.stop);
      if (child.shadowRoot) visit(child.shadowRoot);
    }
  };
  visit((root as HTMLElement).shadowRoot ?? root);
  return keys;
}

/** The `[data-stop]` part with this key, through open shadow roots; throws when there is none. */
export function stop(root: ParentNode, key: string): HTMLElement {
  const visit = (node: ParentNode): HTMLElement | null => {
    for (const child of node.querySelectorAll<HTMLElement>("*")) {
      if (child.dataset?.stop === key) return child;
      if (child.shadowRoot) {
        const found = visit(child.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  };
  const found = visit((root as HTMLElement).shadowRoot ?? root);
  if (!found) throw new Error(`no stop ${key}`);
  return found;
}

/** Waits until an element and every element drawn inside it has finished rendering (a few passes: parents draw children). */
export async function settle(element: HTMLElement & { updateComplete: Promise<unknown> }): Promise<void> {
  const visit = (node: ParentNode): Promise<unknown>[] =>
    [...node.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>("*")].flatMap((child) => [
      child.updateComplete ?? Promise.resolve(),
      ...(child.shadowRoot ? visit(child.shadowRoot) : []),
    ]);
  for (let pass = 0; pass < 3; pass++) {
    await element.updateComplete;
    await Promise.all(visit(element.shadowRoot!));
  }
}
