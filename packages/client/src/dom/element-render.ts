/**
 * Resolves once `element` and every custom element inside it (open shadow roots included) has rendered, so a scene that
 * has just set a model can read its `[data-stop]` parts (`focusStopsOf`). A parent's render creates its children, which
 * render a microtask later, so this walks until a pass finds nothing left to wait for.
 */
export async function renderDeep(element: HTMLElement): Promise<void> {
  for (let pass = 0; pass < 4; pass++) {
    const pending: Promise<unknown>[] = [];
    const visit = (node: ParentNode): void => {
      for (const child of node.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>("*")) {
        if (child.updateComplete) pending.push(child.updateComplete);
        if (child.shadowRoot) visit(child.shadowRoot);
      }
    };
    const root = element as HTMLElement & { updateComplete?: Promise<unknown> };
    if (root.updateComplete) pending.push(root.updateComplete);
    if (root.shadowRoot) visit(root.shadowRoot);
    visit(element);
    const before = pending.length;
    await Promise.all(pending);
    if (before === 0) return;
  }
}
