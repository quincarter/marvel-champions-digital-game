/**
 * The words and small decisions behind the global win rates on screen: the one-time ask, the Settings row, the "You /
 * Everyone" source on Your stats and the deck builder, and the notes each state of a load gets. Pure: no Phaser, no
 * storage and no network (`global-stats/` holds those).
 */
import type { GlobalStats } from "@mc/sync-worker/global-protocol";
import type { GlobalLoad } from "../global-stats/global-stats-client.js";
import { globalSectionsOf } from "../global-stats/global-stats-model.js";
import type { GlobalConsent } from "../global-stats/global-consent.js";
import type { StatsNames, StatsSection } from "./player-stats-model.js";
import type { StatsTab, StatsTabEntry } from "./player-stats-layout.js";

/** Settings, spelled with the on-screen labels (tab "More", row "Save data", this row). */
export const GLOBAL_ROW_TITLE = "Share anonymous game results";

/** The Settings row's one line of detail: the state first, then what it does. */
export const globalRowDetail = (consent: GlobalConsent): string =>
  `${consent === "on" ? "On" : "Off"}. Sends the result of each game you finish from now on, with no name or account.`;
export const globalRowButton = (consent: GlobalConsent): string => (consent === "on" ? "Turn off" : "Turn on");
export const GLOBAL_ROW_FAILED = "Could not save this choice on this device.";

export type StatsSource = "you" | "everyone";
export const SOURCE_LABELS: Readonly<Record<StatsSource, string>> = { you: "You", everyone: "Everyone" };

/** The Your stats tabs that can show everyone's numbers, and the global section each reads. */
const GLOBAL_SECTION_OF: Partial<Record<StatsTab, string>> = {
  heroes: "global:heroes",
  villains: "global:villains",
  encounter: "global:encounter",
};
export const hasGlobalSource = (tab: StatsTab): boolean => GLOBAL_SECTION_OF[tab] !== undefined;

/** The tabs Everyone has, always, whatever games the player has of their own. */
export const GLOBAL_TABS: readonly StatsTabEntry[] = [
  { id: "heroes", label: "Heroes" },
  { id: "villains", label: "Villains" },
  { id: "encounter", label: "Encounter" },
];

/** The tab row for `source`: Everyone's three, or the player's own tabs (`statsTabsOf`). */
export const statsTabsFor = (source: StatsSource, own: readonly StatsTabEntry[]): readonly StatsTabEntry[] =>
  source === "everyone" ? GLOBAL_TABS : own;

/** Which source and tab Your stats is on, and the You tab to return to after a visit to Everyone. */
export interface SourceState {
  readonly source: StatsSource;
  readonly tab: StatsTab;
  readonly cameFrom: StatsTab | null;
}

/**
 * Chooses `to`. Everyone from a tab it lacks goes to Villains and remembers where it came from; You goes back to that
 * tab if the player still has it, else Overview.
 */
export function switchSource(state: SourceState, to: StatsSource, ownTabs: readonly StatsTab[]): SourceState {
  if (to === state.source) return settleSource(state);
  if (to === "everyone") return settleSource({ source: "everyone", tab: state.tab, cameFrom: state.tab });
  const back = state.cameFrom !== null && ownTabs.includes(state.cameFrom) ? state.cameFrom : "overview";
  return { source: "you", tab: back, cameFrom: null };
}

/** Everyone on a tab it has no data for (kept from an earlier visit) moves to Villains. */
export function settleSource(state: SourceState): SourceState {
  if (state.source === "everyone" && !hasGlobalSource(state.tab))
    return { source: "everyone", tab: "villains", cameFrom: state.cameFrom ?? state.tab };
  return state;
}

export const SHARE_LABEL = "Share my games";
export const SHARE_LINE =
  "Shares each game you finish from now on: the villain, heroes, deck and result. No name or account.";
export const SHARING_ON_LABEL = "Sharing on";

/** A load that has not answered yet, beside the answers. */
export type GlobalState = { readonly kind: "idle" } | { readonly kind: "reading" } | GlobalLoad<GlobalStats>;

export const NOTE_READING = "Reading everyone's games…";
export const NOTE_UNAVAILABLE = "Everyone's numbers aren't available right now.";
export const NOTE_STALE = "From earlier: everyone's numbers can't be refreshed right now.";
export const NOTE_EMPTY = "Rows appear once a villain, hero or set has 20 shared games.";
/** `NOTE_EMPTY` with how many games are shared so far, when that is known (`null`: it is not). */
export const emptyNoteOf = (games: number | null): string =>
  games === null ? NOTE_EMPTY : `${NOTE_EMPTY} ${games} ${games === 1 ? "game" : "games"} shared so far.`;
export const NOTE_FILTERS = "Your filters apply to You only. Everyone is not filtered.";

export interface GlobalTabView {
  /** Notes drawn above the rows, in order. */
  readonly notes: readonly string[];
  /** The tab's rows; empty while there are none to draw. */
  readonly section: StatsSection | null;
}

/** What Everyone shows on `tab` for this load state. `filtered`: the You filters are set (they do not apply here). */
export function globalTabViewOf(
  state: GlobalState,
  tab: StatsTab,
  names: StatsNames,
  filtered: boolean,
): GlobalTabView {
  const lead = filtered ? [NOTE_FILTERS] : [];
  switch (state.kind) {
    case "idle":
    case "reading":
      return { notes: [...lead, NOTE_READING], section: null };
    case "unavailable":
      return { notes: [...lead, NOTE_UNAVAILABLE], section: null };
    case "none":
      return { notes: [...lead, emptyNoteOf(null)], section: null };
    case "ready": {
      const id = GLOBAL_SECTION_OF[tab];
      const section = globalSectionsOf(state.data, names).find((s) => s.id === id) ?? null;
      const notes = [
        ...lead,
        ...(state.stale ? [NOTE_STALE] : []),
        ...(section ? [] : [emptyNoteOf(state.data.games)]),
      ];
      return { notes, section };
    }
  }
}

/** The deck builder's "Against" source. */
export type AgainstSource = "yours" | "everyone";
export const AGAINST_LABELS: Readonly<Record<AgainstSource, string>> = { yours: "Your decks", everyone: "Everyone" };
export const AGAINST_NOTE_READING = "Reading everyone's decks…";
export const AGAINST_NOTE_NONE = "Rows appear once this villain has 20 shared games.";
/** Where sharing is turned on when the deck builder's block has no room for the button. */
export const AGAINST_NOTE_SHARE_IN_SETTINGS = "Sharing is off. Turn it on in Settings > More > Save data.";
/** Your decks has no villain faced yet. */
export const AGAINST_NOTE_FINISH = "Finish a game to see your decks here. Everyone works now.";
export const AGAINST_NOTE_UNAVAILABLE = "Everyone's numbers aren't available right now.";
export const AGAINST_NOTE_STALE = "From earlier: can't be refreshed right now.";
