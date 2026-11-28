/**
 * A column of the page as `Column` (`context.ts`): a scroller of the panel (the phone's page, the wide layout's left
 * column or its coloured right pane) or a fixed block of it. It turns a block's content coordinates into screen
 * coordinates by the scroller's scroll now, so a focus stop, a hover card or a reveal follows the scroll.
 */
import type { Rect } from "../../../view/layout.js";
import { clipHoverRect, type HoverCardIdRect } from "../../../view/card-hover.js";
import { revealDelta } from "../../../view/focus-list.js";
import type { BriefingCtx, Column } from "./context.js";

export function makeColumn(
  ctx: BriefingCtx,
  options: {
    readonly x: number;
    readonly width: number;
    readonly phone: boolean;
    readonly view: Rect;
    /** The scroller's panel key; null for a column that does not scroll. */
    readonly scrollKey: string | null;
  },
): Column {
  const { view, scrollKey } = options;
  const scrolled = (): number => (scrollKey ? (ctx.scroller(scrollKey)?.scrollTop ?? 0) : 0);
  const origin = scrollKey ? 0 : view.y;
  const onScreen = (content: Rect): Rect => ({
    ...content,
    y: scrollKey ? view.y + content.y - scrolled() : content.y,
  });
  return {
    x: options.x,
    width: options.width,
    phone: options.phone,
    scrollKey,
    view,
    origin,
    onScreen,
    reveal(content) {
      const scroller = scrollKey ? ctx.scroller(scrollKey) : null;
      if (!scroller) return;
      scroller.scrollTop += revealDelta(onScreen(content), view);
    },
    control(key, content, activate, extra = {}) {
      ctx.actions.set(key, activate);
      ctx.stops.set(key, {
        rect: () => onScreen(content),
        view,
        activate,
        ensureVisible: () => this.reveal(content),
        ...extra,
      });
    },
    hover(slot, cardId, content) {
      ctx.hoverCards.set(slot, (): HoverCardIdRect | null => {
        const clipped = clipHoverRect(onScreen(content), view);
        return clipped ? { ...clipped, cardId } : null;
      });
    },
  };
}
