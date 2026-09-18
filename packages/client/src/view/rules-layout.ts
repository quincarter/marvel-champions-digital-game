/**
 * Rules Reference's own layout (docs/phase4-screen-gaps.md §3 "W4"): header,
 * a three-way tab strip (Glossary / Villain phase / Card list), a search field
 * (Glossary only), and a scrolling body underneath.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import { overlayPanelLayout } from "./overlay-layout.js";

export type RulesTab = "glossary" | "villainPhase" | "cardList";

/**
 * Fidelity pass, 2026-09-17: was 56, which only left room for "‹ Back" and
 * the "Rules reference" title — the "Filtered to what's on your table"
 * caption below them (`scenes/rules.ts`) had nowhere to go but directly
 * behind the Back button, which then visually clipped it. Tall enough for
 * all three lines.
 */
const HEADER_HEIGHT = 66;
const TABS_HEIGHT = hit.target;
const SEARCH_HEIGHT = hit.target;
const GAP = 8;

export interface RulesLayout {
  readonly panel: Rect;
  readonly header: Rect;
  readonly tabs: Rect;
  /** Zero-height (nothing drawn there) outside the glossary tab. */
  readonly search: Rect;
  readonly body: Rect;
}

export function rulesLayout(bounds: Rect, activeTab: RulesTab): RulesLayout {
  const { panel, header, body: below } = overlayPanelLayout(bounds, HEADER_HEIGHT, 0);
  const tabs: Rect = { x: below.x, y: below.y + GAP, width: below.width, height: TABS_HEIGHT };
  const showSearch = activeTab === "glossary";
  const search: Rect = { x: below.x, y: tabs.y + tabs.height + GAP, width: below.width, height: showSearch ? SEARCH_HEIGHT : 0 };
  const bodyTop = showSearch ? search.y + search.height + GAP : tabs.y + tabs.height + GAP;
  const body: Rect = { x: below.x, y: bodyTop, width: below.width, height: Math.max(0, below.y + below.height - bodyTop) };
  return { panel, header, tabs, search, body };
}
