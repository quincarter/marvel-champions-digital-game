import { renderNow } from "../../dom/dom-region.js";

/**
 * Renders every Lit element under `root` (shadow roots included) now, parents first, so a page and the sections it composes
 * are drawn in the same frame and the focus stops can be read off them at once instead of a microtask later.
 */
export function renderTree(root: ParentNode | null): void {
  if (!root) return;
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    renderNow(element);
    if (element.shadowRoot) renderTree(element.shadowRoot);
  }
}
