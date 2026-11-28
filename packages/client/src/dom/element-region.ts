/**
 * Mounts a page element (a Lit custom element that is the whole screen, or a panel of it) as a scene's `DomRegion`
 * content: `const { region, element } = mountElement(this, "mc-table-setup-page", rect)`. The scene sets properties on
 * the element and listens for its events; the region keeps it with its scene (shown, hidden, faded, stacked). Layout is
 * the element's own CSS (flex, grid, native scroll containers): the scene only says how big the region is.
 */
import type Phaser from "phaser";
import type { Rect } from "../view/layout.js";
import { DomRegion } from "./dom-region.js";

export interface MountedElement<E extends HTMLElement> {
  readonly region: DomRegion<E>;
  readonly element: E;
}

export function mountElement<K extends keyof HTMLElementTagNameMap>(
  scene: Phaser.Scene,
  tag: K,
  rect: Rect,
  options: { readonly overlay?: boolean; readonly shownUnder?: readonly string[]; readonly passive?: boolean } = {},
): MountedElement<HTMLElementTagNameMap[K]> {
  const element = document.createElement(tag);
  const region = new DomRegion(scene, element, rect, options);
  return { region, element };
}
