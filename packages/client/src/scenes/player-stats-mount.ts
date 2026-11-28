/**
 * Mounts Your stats' page element as the scene's panel and wires what it says and what hovers over it: its typed events,
 * the focus stops' rendered signal, the focus of a part reaching the route, and the card hover popover and Inspect for
 * the card pictures.
 */
import type Phaser from "phaser";
import { CardEvents } from "../dom/card-events.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { bindStopFocus } from "../dom/element-stops.js";
import type { PictureLeases } from "../dom/picture-leases.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { STATS_RENDERED, type StatsEventDetail } from "../components/player-stats/shared/stats-events.types.js";
import { SCENES } from "./keys.js";
import { UNDER_STATS } from "./player-stats-state.js";

export type StatsPage = MountedElement<HTMLElementTagNameMap["mc-player-stats-page"]>;

export interface MountedStats {
  readonly page: StatsPage;
  readonly hover: HoverPreview;
  readonly cards: CardEvents;
  /** Undoes the focus binding. */
  readonly unbind: () => void;
}

export function mountStatsPage(
  scene: Phaser.Scene,
  options: {
    readonly overlay: boolean;
    readonly pictures: PictureLeases;
    readonly heard: (detail: StatsEventDetail) => void;
    readonly rendered: () => void;
    readonly focused: (key: string) => void;
  },
): MountedStats {
  const { width, height } = scene.scale.gameSize;
  const page = mountElement(scene, "mc-player-stats-page", { x: 0, y: 0, width, height });
  const { element, region } = page;
  element.addEventListener("mc-player-stats", (event) => options.heard(event.detail));
  element.addEventListener(STATS_RENDERED, options.rendered);
  // A pack scan that fails to load reads its file again (`mc-image-error` from a picture with a retry key).
  options.pictures.watch(element);
  const unbind = bindStopFocus(element, options.focused);
  const cards = new CardEvents(region);
  cards.onInspect = (cardId, face) =>
    scene.scene.launch(SCENES.inspect, { card: { cardId, face: face ?? { kind: "front" } } });
  // The hover popover is drawn in the canvas, so its box is left out of the panel; the picture raises the events.
  const hover = new HoverPreview(scene, {
    cardIds: () => cards.hovered(),
    // Over Pause or Settings, those, and whatever they were open over, run under the stats; none of them is over it.
    area: (pointer) => screenHoverArea(scene, pointer, { beneath: options.overlay ? UNDER_STATS : [] }),
  });
  region.forwardMouseMoves(() => hover.suppress());
  region.setHoles(() => {
    const popover = hover.shownRect;
    return popover ? [popover] : [];
  });
  return { page, hover, cards, unbind };
}
