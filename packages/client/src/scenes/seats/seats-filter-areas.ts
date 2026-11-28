/**
 * The filter chips' fold and the filters and the list as two areas of the route (`view/focus-areas.ts`): Y (or the Filters
 * button) while a controller is in use shows the chips or folds them away; Y and B move focus between the two areas.
 */
import type Phaser from "phaser";
import { AreaJump, type FocusAreas } from "../../view/focus-areas.js";
import type { FocusRoute } from "../focus-route.js";
import { PadFilters } from "../pad-filters.js";

export class FilterAreas {
  readonly pad: PadFilters;
  readonly #jump = new AreaJump();
  /** The areas of the last build's route order. */
  areas: FocusAreas = { filters: [], entry: null, list: [] };
  /** Whether the last build folded the chips, so Y knows whether it opens or folds them. */
  folded = false;

  constructor(scene: Phaser.Scene, onChange: () => void) {
    this.pad = new PadFilters(scene, onChange);
    this.pad.reset();
  }

  /** Opening moves focus to the first chip, remembering the tile it left; folding from a chip returns to the list. */
  toggle(route: FocusRoute | null, rebuild: () => void, afterRender: () => Promise<void>): void {
    const focus = route?.focused ?? null;
    const opening = this.folded;
    const onChip = focus?.startsWith("hero-chip") ?? false;
    this.pad.toggle();
    rebuild();
    // The ring follows a pad or keyboard user; a mouse press leaves focus alone (no ring appears for it).
    if (focus === null && !this.pad.padMode) return;
    void afterRender().then(() => {
      const target = opening ? this.#jump.toFilters(focus, this.areas) : onChip ? this.#jump.toList(this.areas) : null;
      if (target !== null) route?.focusKey(target);
    });
  }

  /** Y toggles focus between the filters and the list; B from the list goes to the filters and scrolls the list to its start. */
  jump(
    route: FocusRoute | null,
    fromBack: boolean,
    scroller: HTMLElement | null,
    rebuild: () => void,
    afterRender: () => Promise<void>,
  ): void {
    const go = (): void => {
      const focus = route?.focused ?? null;
      const target = fromBack ? this.#jump.toFilters(focus, this.areas) : this.#jump.toggle(focus, this.areas);
      if (target === null) return;
      if (fromBack) scroller?.scrollTo({ top: 0 });
      route?.focusKey(target);
    };
    // B from the list with the chips folded opens them first, so there is a row to land on (the route has them once drawn).
    if (!this.folded) return go();
    this.pad.open();
    rebuild();
    void afterRender().then(go);
  }
}
