/**
 * Waits until a page of custom elements has finished rendering: its own update, then its children's (which only exist, or
 * only changed, once their parent rendered), through open shadow roots, a few levels deep. A scene calls it after setting a
 * page's properties and before it reads the page's focus stops or rects (`dom/element-stops.ts`).
 */
const LEVELS = 4;

interface Updating extends Element {
  readonly updateComplete: Promise<unknown>;
}

const isUpdating = (element: Element): element is Updating =>
  "updateComplete" in element && (element as { updateComplete?: unknown }).updateComplete instanceof Promise;

/** Every element under `root` that has an update in flight to wait for, shadow roots included. */
function updatingUnder(root: ParentNode, into: Promise<unknown>[]): void {
  const visit = (node: ParentNode): void => {
    for (const element of node.querySelectorAll("*")) {
      if (isUpdating(element)) into.push(element.updateComplete);
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  };
  if (root instanceof Element) {
    if (isUpdating(root)) into.push(root.updateComplete);
    if (root.shadowRoot) visit(root.shadowRoot);
  }
  visit(root);
}

export async function settleElements(root: ParentNode): Promise<void> {
  for (let level = 0; level < LEVELS; level++) {
    const waiting: Promise<unknown>[] = [];
    updatingUnder(root, waiting);
    if (waiting.length === 0) return;
    await Promise.all(waiting);
  }
}
