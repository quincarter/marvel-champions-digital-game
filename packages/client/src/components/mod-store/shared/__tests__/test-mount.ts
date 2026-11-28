/** Helpers of the Mod Store elements' tests (happy-dom): mount an element with properties, and hear what it says. */
import type { ModStoreEventDetail } from "../mod-store-events.types.js";

interface Updating extends HTMLElement {
  readonly updateComplete: Promise<unknown>;
}

/** Makes `tag` with `props` set, adds it to the document and waits for it (and what it drew) to settle. */
export async function mount<E extends Updating>(tag: string, props: Record<string, unknown> = {}): Promise<E> {
  const element = document.createElement(tag) as E;
  Object.assign(element, props);
  document.body.append(element);
  await element.updateComplete;
  await Promise.resolve();
  return element;
}

/** Everything the element says as `mc-mod-store`, in order. */
export function hear(element: HTMLElement): ModStoreEventDetail[] {
  const heard: ModStoreEventDetail[] = [];
  element.addEventListener("mc-mod-store", (event) => heard.push(event.detail));
  return heard;
}

/** The part of an element's shadow DOM that carries `data-stop="key"`. */
export function stop<T extends HTMLElement = HTMLElement>(element: HTMLElement, key: string): T {
  const found = element.shadowRoot?.querySelector<T>(`[data-stop="${key}"]`);
  if (!found) throw new Error(`no stop ${key}`);
  return found;
}

/** What an `mc-button` raises on a tap (the element tests do not run a pointer). */
export const press = (target: HTMLElement): void => {
  target.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
};
