/**
 * The title screen's release notice bar, which opens the current release report (`public/releases/<version>/`). Point
 * `RELEASE_NOTICE_VERSION` at each new report; to take the bar down, set `RELEASE_NOTICE_ON` to false.
 */
import type { Rect } from "./layout.js";

export const RELEASE_NOTICE_ON = true;
/** The release whose report the bar opens. */
export const RELEASE_NOTICE_VERSION = "v0.40.0";

/** The bar's height: a slim strip, still a touch-sized target. */
export const NOTICE_BAR_HEIGHT = 40;
/** The heights tried in turn on a screen too short for the full bar (`view/title-menu-layout.ts`). */
export const NOTICE_BAR_HEIGHTS: readonly number[] = [NOTICE_BAR_HEIGHT, 32, 26];

export const RELEASE_NOTICE_TAG = "NEW";
export const RELEASE_NOTICE_TEXT = `What's new in ${RELEASE_NOTICE_VERSION}`;
export const RELEASE_NOTICE_LINK = "Read more ↗";
/** The link's label when the bar is too narrow for the whole of it (a small phone). */
export const RELEASE_NOTICE_LINK_SHORT = "↗";

const PAD = 12;
const GAP = 10;
/** Below this much room for the tag and the message together, the link shortens to its arrow. */
const MESSAGE_MIN = 240;

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
    link: bar.width - PAD * 2 - fullLinkWidth - GAP < MESSAGE_MIN ? RELEASE_NOTICE_LINK_SHORT : RELEASE_NOTICE_LINK,
    linkRight,
    midY: bar.y + bar.height / 2,
  };
}

/** The gap kept between the tag, the message and the link. */
export const NOTICE_BAR_GAP = GAP;
