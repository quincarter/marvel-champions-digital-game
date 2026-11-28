/**
 * Wires the card events a panel's pictures raise (`@mc/ui` `watchCard`: `mc-card-hover`, `mc-card-hover-end`,
 * `mc-card-inspect`) to the card hover popover and to Inspect, once for a scene: the panel names neither.
 *
 *   const cards = new CardEvents(region);          // after the region is mounted
 *   new HoverPreview(scene, { cardIds: () => cards.hovered(), ... });
 *   cards.onInspect = (cardId, face) => scene.scene.launch(SCENES.inspect, { card: { cardId, face } });
 */
import type { HoverCardIdRect } from "../view/card-hover.js";
import { hoverSlotOf } from "../view/card-hover.js";
import type { CardHoverDetail, CardRef } from "@mc/ui";

/** What `CardEvents` needs of the region: the page element and a viewport-box-to-game-coordinates conversion. */
export interface CardEventsRegion {
  readonly element: HTMLElement;
  rectOf(target: Element): { x: number; y: number; width: number; height: number };
}

export class CardEvents {
  readonly #region: CardEventsRegion;
  #current: { readonly cardId: string; readonly face: unknown; readonly rect: HoverCardIdRect } | null = null;
  /** Called with the card to inspect (a press-and-hold on a picture); the scene opens Inspect. */
  onInspect: (cardId: string, face: unknown) => void = () => undefined;
  /**
   * Adds what the popover needs for a picture whose card no pool has (the Mod Store before an install: the card record, the
   * picture to show); called as the hovered picture is read, so it sees the scene's current state.
   */
  enrich: (rect: HoverCardIdRect) => HoverCardIdRect = (rect) => rect;

  constructor(region: CardEventsRegion) {
    this.#region = region;
    const el = region.element;
    el.addEventListener("mc-card-hover", this.#enter);
    el.addEventListener("mc-card-hover-end", this.#leave);
    el.addEventListener("mc-card-inspect", this.#inspect);
  }

  readonly #enter = (event: CustomEvent<CardHoverDetail>): void => {
    const target = event.composedPath()[0];
    if (!(target instanceof Element)) return;
    const box = this.#region.rectOf(target);
    const { cardId, face } = event.detail;
    this.#current = {
      cardId,
      face,
      rect: { ...box, cardId, through: true, ...(face ? { face: face as never } : {}) },
    };
  };

  readonly #leave = (event: CustomEvent<{ cardId: string }>): void => {
    if (this.#current?.cardId === event.detail.cardId) this.#current = null;
  };

  readonly #inspect = (event: CustomEvent<CardRef>): void => this.onInspect(event.detail.cardId, event.detail.face);

  /** The hovered picture, for `HoverPreviewDeps.cardIds` (empty while the mouse is on no card picture). */
  hovered(): ReadonlyMap<string, HoverCardIdRect> {
    return this.#current
      ? new Map([[hoverSlotOf(this.#current.cardId, "panel"), this.enrich(this.#current.rect)]])
      : new Map();
  }

  destroy(): void {
    const el = this.#region.element;
    el.removeEventListener("mc-card-hover", this.#enter);
    el.removeEventListener("mc-card-hover-end", this.#leave);
    el.removeEventListener("mc-card-inspect", this.#inspect);
  }
}
