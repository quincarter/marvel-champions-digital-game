/**
 * Dev e2e hook for Your stats (`window.__mcStatsDebug`; never referenced by product code): which card the hover popover
 * shows and where, the card pictures on screen, the Matchups grid's cursor, pan and readout, and the backdrop's texture.
 */
import type { MountedElement } from "../dom/element-region.js";
import type { HoverPreview } from "../ui/card-hover-preview.js";
import type { StatsBackdrop } from "./player-stats-backdrop.js";
import { collectCardPictures, mem } from "./player-stats-state.js";

type Page = MountedElement<HTMLElementTagNameMap["mc-player-stats-page"]>;

export function installStatsDebug(deps: {
  readonly page: () => Page | null;
  readonly hover: () => HoverPreview | null;
  readonly backdrop: () => StatsBackdrop;
}): void {
  (window as unknown as { __mcStatsDebug?: unknown }).__mcStatsDebug = {
    hoverShown: () => deps.hover()?.shownKey ?? null,
    hoverRect: () => deps.hover()?.shownRect ?? null,
    hoverCards: () => {
      const mounted = deps.page();
      return mounted
        ? collectCardPictures(mounted.element).map(({ cardId, element }) => ({
            cardId,
            ...mounted.region.rectOf(element),
          }))
        : [];
    },
    grid: () => {
      const grid = deps.page()?.element.grid;
      const scroller = grid?.scroller;
      return grid && scroller
        ? {
            pan: { x: scroller.scrollLeft, y: scroller.scrollTop },
            cursor: grid.cursor,
            readout: grid.readout,
            counts: mem.counts,
          }
        : null;
    },
    backdrop: () => deps.backdrop().drawn,
  };
}
