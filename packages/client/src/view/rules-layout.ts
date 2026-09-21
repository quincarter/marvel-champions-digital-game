/**
 * Rules Reference's own layout (docs/phase4-screen-gaps.md §3 "W4").
 *
 * **Full screen, not a centered sheet (owner feedback, 2026-09-18).** The previous shape reused
 * `overlay-layout.ts`'s centered card, the same shape Pause and Settings use for a short menu —
 * which for this screen's actual job (a browsable glossary grid with art, a whole tab of card
 * thumbnails) read as "a narrow column with Pause peeking out on both sides", and its own DOM
 * search field showed through from underneath before `ui/widgets.ts`'s `McTextInput` fix. This
 * screen now claims the *entire* viewport like Decks & Collection does (`view/decks-layout.ts`):
 * an ink chrome band (Back, the Bangers title, the scope caption/toggle) spanning edge to edge,
 * then a paper body with the tab strip, the glossary's own search field, and whichever tab's
 * content underneath — no side margins on the chrome, `MARGIN`-px ones on everything below it.
 *
 * D13's own desktop tile draws the glossary as a grid of individually bordered entry cards next
 * to a `Paused` sheet, not as this screen's own dedicated full page — there is no canvas drawing
 * this exact composition at three sizes the way most other W4 screens have, so this layout is
 * this pass's own design over the tokens/widgets already in place, following D13's entry-card
 * language rather than reproducing its two-column "peek at Pause" arrangement.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

export type RulesTab = "glossary" | "villainPhase" | "cardList";

const CHROME_TITLE_HEIGHT = 56;
/** The scope caption/toggle row under the title — always reserved, even with no game (a static caption still draws there). */
const CHROME_SCOPE_HEIGHT = 36;
const TABS_HEIGHT = hit.target;
const SEARCH_HEIGHT = hit.target;
const GAP = 8;
/** Horizontal breathing room for everything under the edge-to-edge ink chrome. */
const MARGIN = 16;

export interface RulesLayout {
  /** The full ink chrome band (title row + scope row), edge to edge. */
  readonly chrome: Rect;
  readonly header: Rect;
  readonly scope: Rect;
  readonly tabs: Rect;
  /** Zero-height (nothing drawn there) outside the glossary tab. */
  readonly search: Rect;
  readonly body: Rect;
}

export function rulesLayout(bounds: Rect, activeTab: RulesTab): RulesLayout {
  const header: Rect = { x: bounds.x, y: bounds.y, width: bounds.width, height: CHROME_TITLE_HEIGHT };
  const contentX = bounds.x + MARGIN;
  const contentWidth = Math.max(0, bounds.width - MARGIN * 2);
  // Inset like every row under the chrome (`tabs`/`search`/`body`), not edge to edge like the ink
  // chrome band itself — the previous full-width scope row let its own "ON YOUR TABLE" pill sit
  // flush against the viewport's own right edge with zero gutter (found on a 390px phone in a real
  // headless-Chrome pass: the pill's own right edge landed exactly on the last on-screen pixel).
  const scope: Rect = { x: contentX, y: header.y + header.height, width: contentWidth, height: CHROME_SCOPE_HEIGHT };
  const chrome: Rect = { x: bounds.x, y: bounds.y, width: bounds.width, height: header.height + scope.height };

  const tabs: Rect = { x: contentX, y: chrome.y + chrome.height + GAP, width: contentWidth, height: TABS_HEIGHT };
  const showSearch = activeTab === "glossary";
  const search: Rect = {
    x: contentX,
    y: tabs.y + tabs.height + GAP,
    width: contentWidth,
    height: showSearch ? SEARCH_HEIGHT : 0,
  };
  const bodyTop = showSearch ? search.y + search.height + GAP : tabs.y + tabs.height + GAP;
  const body: Rect = {
    x: contentX,
    y: bodyTop,
    width: contentWidth,
    height: Math.max(0, bounds.y + bounds.height - bodyTop - MARGIN),
  };
  return { chrome, header, scope, tabs, search, body };
}
