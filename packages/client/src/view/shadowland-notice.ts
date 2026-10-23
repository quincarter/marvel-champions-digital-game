/**
 * TEMPORARY: the title screen's "Where did the Shadowland content go?" notice bar, which opens
 * `public/shadowland-info.html`. To take it down, set `SHADOWLAND_NOTICE_ON` to false (or delete this file,
 * `ui/shadowland-notice-bar.ts`, `view/shadowland-info-link.ts`, their tests, the page, `e2e/shadowland-notice.spec.ts`
 * and the `noticeBar` lines in `scenes/title.ts` and `view/title-menu-layout.ts`).
 */
import type { Rect } from "./layout.js";

export const SHADOWLAND_NOTICE_ON = true;

/** The bar's height: a slim strip, still a touch-sized target. */
export const NOTICE_BAR_HEIGHT = 40;
/** The heights tried in turn on a screen too short for the full bar (`view/title-menu-layout.ts`). */
export const NOTICE_BAR_HEIGHTS: readonly number[] = [NOTICE_BAR_HEIGHT, 32, 26];

export const SHADOWLAND_NOTICE_TAG = "NOTICE";
export const SHADOWLAND_NOTICE_TEXT = "Where did the Shadowland content go?";
export const SHADOWLAND_NOTICE_LINK = "Read more ↗";
/** The link's label when the bar is too narrow for the whole of it (a small phone). */
export const SHADOWLAND_NOTICE_LINK_SHORT = "↗";

const PAD = 12;
const GAP = 10;
/** Below this much room for the tag and the message together, the link shortens to its arrow. */
const MESSAGE_MIN = 380;

export interface NoticeBarParts {
  /** Where the tag's left edge goes. */
  readonly tagX: number;
  /** The link's label, and where its right edge goes. */
  readonly link: string;
  readonly linkRight: number;
  /** The vertical middle every part is centred on. */
  readonly midY: number;
}

/** How the bar's parts sit inside `bar`, given the width the full link label would take. */
export function noticeBarParts(bar: Rect, fullLinkWidth: number): NoticeBarParts {
  const tagX = bar.x + PAD;
  const linkRight = bar.x + bar.width - PAD;
  return {
    tagX,
    link:
      bar.width - PAD * 2 - fullLinkWidth - GAP < MESSAGE_MIN ? SHADOWLAND_NOTICE_LINK_SHORT : SHADOWLAND_NOTICE_LINK,
    linkRight,
    midY: bar.y + bar.height / 2,
  };
}

/** The gap kept between the tag, the message and the link. */
export const NOTICE_BAR_GAP = GAP;
