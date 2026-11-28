/** Shared helpers for the Scenario select element tests: mount an element, and collect the screen's events from it. */
import "@mc/ui";
import type { ScenarioSelectDetail } from "./scenario-select.types.js";

/** Creates `tag`, assigns `props`, adds it to the page and waits for its first render. */
export async function mount<T extends HTMLElement & { updateComplete: Promise<boolean> }>(
  tag: string,
  props: Record<string, unknown> = {},
): Promise<T> {
  const element = document.createElement(tag) as T;
  Object.assign(element, props);
  document.body.append(element);
  await element.updateComplete;
  return element;
}

/** Every `mc-scenario-select` detail `element` raises from now on. */
export function selectEvents(element: HTMLElement): ScenarioSelectDetail[] {
  const seen: ScenarioSelectDetail[] = [];
  element.addEventListener("mc-scenario-select", (event) =>
    seen.push((event as CustomEvent<ScenarioSelectDetail>).detail),
  );
  return seen;
}

/** A keyboard-style press: the `click()` a focus stop's Enter does (`detail` 0). */
export const press = (target: Element): void => {
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 0 }));
};

/** A tap: press and release on the same spot (`shared/tap.ts`). */
export function tap(target: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0, pointerType: "touch" };
  target.dispatchEvent(new PointerEvent("pointerdown", at));
  target.dispatchEvent(new PointerEvent("pointerup", at));
}

export const inner = <E extends Element>(element: Element, selector: string): E | null =>
  element.shadowRoot?.querySelector<E>(selector) ?? null;
