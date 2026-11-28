/**
 * What Your stats remembers while the app runs, and the small pure helpers its scene shares: the tab and hero the player
 * last looked at, the filter chips' choice, whose numbers are on show, the Matchups choices and each grid's cursor. Kept
 * across visits like the tab, so a return finds the screen as it was left.
 */
import { specsForShortcuts } from "../ui/glyph-hints.js";
import type { ControlSpecs } from "../dom/control-glyphs.js";
import { layerTriggerGlyph } from "../view/input-glyph-model.js";
import type { StatsSource } from "../view/global-stats-ui.js";
import type { MatchupKind, MatchupView } from "../view/matchup-grid.js";
import type { StatsFilter, StatsFilterOptions } from "../view/player-stats-model.js";
import type { StatsTab } from "../view/player-stats-tabs.js";
import type { StatsFilterName } from "../components/player-stats/shared/stats-events.types.js";
import { SCENES } from "./keys.js";

/** How the stats were opened: a screen to go back to, or an overlay to close. */
export interface PlayerStatsData {
  /** The scene that opened the stats. Absent: the Trophy Room. */
  readonly from?: string;
  /** Opened over `from` (Settings, Pause): Back closes the stats instead of changing screen. */
  readonly overlay?: boolean;
  /** The tab to open on (a deck's "Open in Your stats" opens Cards by hero). Absent: the last one looked at. */
  readonly tab?: StatsTab;
  /** On Cards by hero, the hero to show (an identity card id). */
  readonly heroId?: string;
  /** What Back hands the screen it returns to (the Decks screen's selected deck). */
  readonly backData?: object;
}

export const mem: {
  tab: StatsTab;
  hero: number;
  /** The filter chips' choice. */
  filter: StatsFilter;
  /** Whose numbers the Heroes, Villains and Encounter tabs show. */
  source: StatsSource;
  /** The You tab Everyone was chosen from, which You returns to. */
  cameFrom: StatsTab | null;
  /** Cards and Cards by hero without each hero's own cards. */
  hideSignature: boolean;
  /** On a phone the filter chips fold behind one "Filters" chip, so the tabs and the stats keep the screen. */
  filtersOpen: boolean;
  /** The Matchups tab's choices: which grid, and how it shows. */
  grid: MatchupKind;
  counts: boolean;
  played: boolean;
  flipped: boolean;
  view: MatchupView;
} = {
  tab: "overview",
  hero: 0,
  filter: {},
  source: "you",
  cameFrom: null,
  hideSignature: false,
  filtersOpen: false,
  grid: "heroes",
  counts: false,
  played: true,
  flipped: false,
  view: "heat",
};

/** Each grid keeps its own cursor, a flipped one apart from the other. */
const cursors = new Map<string, { row: number; column: number }>();
export const gridKey = (): string => `${mem.grid}:${mem.flipped}`;
export const cursorOf = (): { row: number; column: number } => cursors.get(gridKey()) ?? { row: 0, column: 0 };
export const setCursor = (cursor: { row: number; column: number }): void => void cursors.set(gridKey(), cursor);

/** The next of `options` after `current`, or the first (undefined: All) after the last. */
function stepOf<T>(options: readonly T[], current: T | undefined): T | undefined {
  const at = current === undefined ? -1 : options.indexOf(current);
  return at + 1 < options.length ? options[at + 1] : undefined;
}

/** The filter a chip press asks for: the one steps to the next hero, villain or difficulty; Clear puts every one back. */
export function nextFilterOf(
  options: StatsFilterOptions,
  filter: StatsFilter,
  which: Exclude<StatsFilterName, "toggle">,
): StatsFilter {
  if (which === "clear") return {};
  if (which === "hero")
    return {
      ...filter,
      hero: stepOf(
        options.heroes.map((h) => h.id),
        filter.hero,
      ),
    };
  if (which === "villain") return { ...filter, villain: stepOf(options.villains, filter.villain) };
  return { ...filter, difficulty: stepOf(options.difficulties, filter.difficulty) };
}

/** A pad's LT or RT glyph; nothing on a keyboard, which has no triggers. */
export const triggerSpecs =
  (trigger: "lt" | "rt"): ControlSpecs =>
  (set, snapshot) => {
    if (set !== "pad") return null;
    const glyph = layerTriggerGlyph(trigger, snapshot.state, snapshot.settings);
    return glyph ? [glyph] : null;
  };

/** The glyph for the You / Everyone switch: a plain press of View on a pad, Shift+B (Shift+N) on a keyboard. */
export const sourceSwitchSpecs: ControlSpecs = (set, snapshot) =>
  specsForShortcuts([set === "pad" ? "peek" : "log"], snapshot);

/** Covering scenes that can be running under the stats overlay, never over it (`screenHoverArea`'s `beneath`). */
export const UNDER_STATS: readonly string[] = [
  SCENES.pause,
  SCENES.settings,
  SCENES.choice,
  SCENES.inspect,
  SCENES.villainPhase,
  SCENES.roundDebrief,
  SCENES.rules,
  SCENES.endTurnConfirm,
  SCENES.pileView,
  SCENES.deckLeft,
  SCENES.schemeFan,
  SCENES.evidence,
  SCENES.campaignBeat,
  SCENES.teamUpInfo,
  SCENES.holdOn,
];

/** Every element under `root`, through open shadow roots, that is a card's picture (`data-card-id`), in document order. */
export function collectCardPictures(root: ParentNode): { cardId: string; element: HTMLElement }[] {
  const found: { cardId: string; element: HTMLElement }[] = [];
  const visit = (node: ParentNode): void => {
    for (const element of node.querySelectorAll<HTMLElement>("*")) {
      const cardId = element.dataset?.cardId;
      if (cardId) found.push({ cardId, element });
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  };
  if (root instanceof HTMLElement && root.shadowRoot) visit(root.shadowRoot);
  return found;
}
