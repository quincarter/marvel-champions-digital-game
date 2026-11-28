/** Helpers for the deck builder element tests (not a test file: Vitest only runs `*.test.ts`). */
import "@mc/ui";
import type { DeckBuilderEventDetail } from "./deck-builder-events.types.js";

/** Creates `tag`, assigns `props`, adds it to the page and waits for its render (and its children's). */
export async function mount<T extends HTMLElement & { updateComplete: Promise<boolean> }>(
  tag: string,
  props: Record<string, unknown> = {},
): Promise<T> {
  const element = document.createElement(tag) as T;
  Object.assign(element, props);
  document.body.append(element);
  await settle(element);
  return element;
}

/** Every `mc-deck-builder` detail `element` raises from now on. */
export function builderEvents(element: HTMLElement): DeckBuilderEventDetail[] {
  const seen: DeckBuilderEventDetail[] = [];
  element.addEventListener("mc-deck-builder", (event) => seen.push((event as CustomEvent).detail));
  return seen;
}

/** A tap: press and release on the same spot (`shared/tap.ts`). */
export function tap(target: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0, pointerType: "touch" };
  target.dispatchEvent(new PointerEvent("pointerdown", at));
  target.dispatchEvent(new PointerEvent("pointerup", at));
}

/** The route's Enter on a stop: `click()` with no pointer behind it. */
export const press = (target: HTMLElement): void => target.click();

const visit = (node: ParentNode, into: HTMLElement[]): void => {
  for (const child of node.querySelectorAll<HTMLElement>("*")) {
    if (child.dataset?.stop) into.push(child);
    if (child.shadowRoot) visit(child.shadowRoot, into);
  }
};

/** Every `[data-stop]` part under `root`, in document order, through open shadow roots (what the focus route finds). */
export function stops(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = [];
  visit((root as HTMLElement).shadowRoot ?? root, found);
  return found;
}

export const stopKeys = (root: ParentNode): string[] => stops(root).map((part) => part.dataset.stop!);

/** The `[data-stop]` part with this key; throws when there is none. */
export function stop(root: ParentNode, key: string): HTMLElement {
  const found = stops(root).find((part) => part.dataset.stop === key);
  if (!found) throw new Error(`no stop ${key}`);
  return found;
}

/** Waits until an element and every element drawn inside it has finished rendering (parents draw children). */
export async function settle(element: HTMLElement & { updateComplete: Promise<unknown> }): Promise<void> {
  const walk = (node: ParentNode): Promise<unknown>[] =>
    [...node.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>("*")].flatMap((child) => [
      child.updateComplete ?? Promise.resolve(),
      ...(child.shadowRoot ? walk(child.shadowRoot) : []),
    ]);
  for (let pass = 0; pass < 4; pass++) {
    await element.updateComplete;
    if (element.shadowRoot) await Promise.all(walk(element.shadowRoot));
  }
}

export const inner = <E extends Element>(element: Element, selector: string): E | null =>
  element.shadowRoot?.querySelector<E>(selector) ?? null;
