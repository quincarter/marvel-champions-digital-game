/** The first element under `root` (through the open shadow roots) that matches `selector`, or null. */
export function deepQuery<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T | null {
  const own = root.querySelector<T>(selector);
  if (own) return own;
  for (const node of root.querySelectorAll("*")) {
    const inside = node.shadowRoot ? deepQuery<T>(node.shadowRoot, selector) : null;
    if (inside) return inside;
  }
  return null;
}
