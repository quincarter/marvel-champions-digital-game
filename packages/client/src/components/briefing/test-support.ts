/** Shared helpers for the Briefing element tests: mount an element, and collect the screen's events from it. */
import "@mc/ui";
import type { BriefingDetail, BriefingStepDetail } from "./briefing.types.js";

/** Waits for `element` and the elements under it (through open shadow roots) to finish rendering, a few levels deep. */
export async function settle(element: HTMLElement): Promise<void> {
  for (let level = 0; level < 4; level++) {
    const waiting: Promise<unknown>[] = [];
    const visit = (node: ParentNode): void => {
      for (const child of node.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>("*")) {
        if (child.updateComplete instanceof Promise) waiting.push(child.updateComplete);
        if (child.shadowRoot) visit(child.shadowRoot);
      }
    };
    const self = element as HTMLElement & { updateComplete?: Promise<unknown> };
    if (self.updateComplete instanceof Promise) waiting.push(self.updateComplete);
    if (element.shadowRoot) visit(element.shadowRoot);
    await Promise.all(waiting);
    await Promise.resolve();
  }
}

/** Creates `tag`, assigns `props`, adds it to the page and waits for its first render (and its children's). */
export async function mount<T extends HTMLElement>(tag: string, props: Record<string, unknown> = {}): Promise<T> {
  const element = document.createElement(tag) as T;
  Object.assign(element, props);
  document.body.append(element);
  await settle(element);
  return element;
}

/** Every `mc-briefing` detail `element` raises from now on. */
export function briefingEvents(element: HTMLElement): BriefingDetail[] {
  const seen: BriefingDetail[] = [];
  element.addEventListener("mc-briefing", (event) => seen.push((event as CustomEvent<BriefingDetail>).detail));
  return seen;
}

/** Every `mc-briefing-step` detail `element` raises from now on. */
export function stepEvents(element: HTMLElement): BriefingStepDetail[] {
  const seen: BriefingStepDetail[] = [];
  element.addEventListener("mc-briefing-step", (event) => seen.push((event as CustomEvent<BriefingStepDetail>).detail));
  return seen;
}

/** A keyboard-style press: the `click()` a focus stop Enter does (a pointer-less click, `detail` 0). */
export const press = (target: Element): void => {
  if (target instanceof HTMLElement) target.click();
};

/** Every element matching `selector` under `root`, through open shadow roots. */
export function findAll<E extends Element = HTMLElement>(root: ParentNode, selector: string): E[] {
  const out = [...root.querySelectorAll<E>(selector)];
  const nodes = [...root.querySelectorAll("*")];
  if (root instanceof Element && root.shadowRoot) nodes.unshift(root);
  for (const node of nodes) if (node.shadowRoot) out.push(...findAll<E>(node.shadowRoot, selector));
  return out;
}

/** The first element matching `selector` under `root`, through open shadow roots. */
export const find = <E extends Element = HTMLElement>(root: ParentNode, selector: string): E | null =>
  findAll<E>(root, selector)[0] ?? null;

/** The `[data-stop]` keys under `root`, through open shadow roots, in document order. */
export const stopsOf = (root: Element): string[] =>
  findAll(root, "[data-stop]")
    .map((node) => node.getAttribute("data-stop") ?? "")
    .filter((key) => key !== "");

/** Every word `element` shows, its own shadow tree and the elements it is made of, whitespace collapsed. */
export function wordsOf(element: Element): string {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    let out = "";
    if (node instanceof Element && node.shadowRoot) out += walk(node.shadowRoot);
    for (const child of Array.from(node.childNodes)) out += " " + walk(child);
    return out;
  };
  return walk(element).replace(/\s+/g, " ").trim();
}
