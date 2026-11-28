import { staleKeys } from "../../dom/stale-presses.js";

/** What each lobby button's `data-meaning` says, by its stop, with its element (through the open shadow roots under `root`). */
export function lobbyMeanings(root: ParentNode): Map<string, { readonly meaning: string; readonly element: Element }> {
  const found = new Map<string, { readonly meaning: string; readonly element: Element }>();
  const walk = (node: ParentNode): void => {
    for (const element of node.querySelectorAll("*")) {
      const meaning = element instanceof HTMLElement ? element.dataset.meaning : undefined;
      const stop = element instanceof HTMLElement ? element.dataset.meaningStop : undefined;
      if (meaning !== undefined && stop) found.set(stop, { meaning, element });
      if (element.shadowRoot) walk(element.shadowRoot);
    }
  };
  walk(root);
  return found;
}

/**
 * The buttons whose meaning changed since `before`: a press armed for the old command must do nothing (the scene calls
 * `cancelPressesWithin` on each element). A button that is new, or gone, is not stale.
 */
export function staleLobbyButtons(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, { readonly meaning: string; readonly element: Element }>,
): Element[] {
  const now = new Map([...after].map(([stop, { meaning }]) => [stop, meaning] as const));
  return staleKeys(before, now).flatMap((stop) => {
    const element = after.get(stop)?.element;
    return element ? [element] : [];
  });
}
