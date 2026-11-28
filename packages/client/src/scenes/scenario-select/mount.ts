/** Mounts Choose a scenario's page element in a `DomRegion` and wires what the scene hears from it. */
import type Phaser from "phaser";
import "../../views/scenario-select/mc-scenario-select-page/mc-scenario-select-page.js";
import type { McScenarioSelectPage } from "../../views/scenario-select/mc-scenario-select-page/mc-scenario-select-page.js";
import {
  SCENARIO_SELECT_EVENT,
  type ScenarioSelectDetail,
} from "../../components/scenario-select/scenario-select.types.js";
import { refreshPackArt } from "../../art/pack-art.js";
import { CardEvents } from "../../dom/card-events.js";
import type { DomRegion } from "../../dom/dom-region.js";
import { mountElement } from "../../dom/element-region.js";
import { bindStopFocus } from "../../dom/element-stops.js";
import type { HoverPreview } from "../../ui/card-hover-preview.js";
import type { Rect } from "../../view/layout.js";

export interface MountDeps {
  /** What the page raised (not called once the screen is leaving). */
  readonly onSelect: (detail: ScenarioSelectDetail) => void;
  readonly leaving: () => boolean;
  /** The route follows a native button that took focus. */
  readonly focusKey: (key: string) => void;
  readonly hover: () => HoverPreview | null;
}

export interface MountedPage {
  readonly region: DomRegion<McScenarioSelectPage>;
  readonly element: McScenarioSelectPage;
  readonly cards: CardEvents;
}

export function mountScenarioPage(scene: Phaser.Scene, rect: Rect, deps: MountDeps): MountedPage {
  const { region, element } = mountElement(scene, "mc-scenario-select-page", rect);
  element.addEventListener(SCENARIO_SELECT_EVENT, (event) => {
    // Leaving already: a second tap must not act.
    if (!deps.leaving()) deps.onSelect(event.detail);
  });
  // A pack picture's blob URL went stale before its lazy image loaded: read it again, once.
  element.addEventListener("mc-image-error", (event) => {
    const { key, src } = (event as CustomEvent<{ key?: string; src: string | null }>).detail;
    if (key) refreshPackArt(key, src ?? undefined);
  });
  // A native button took focus (a screen reader, Tab): the route follows. A pointer press is the screen's own tap.
  let pressing = false;
  element.addEventListener(
    "pointerdown",
    () => {
      pressing = true;
      setTimeout(() => (pressing = false), 0);
    },
    true,
  );
  bindStopFocus(element, (key) => {
    if (!pressing) deps.focusKey(key);
  });
  // The hover popover follows Phaser's pointer, which only hears the mouse over the canvas; the popover itself is
  // drawn in the canvas, so its box is left out of the panel. Inspect is the tile's own hold (`mc-inspect`).
  region.forwardMouseMoves(() => deps.hover()?.suppress());
  region.setHoles(() => {
    const popover = deps.hover()?.shownRect;
    return popover ? [popover] : [];
  });
  return { region, element, cards: new CardEvents(region) };
}
