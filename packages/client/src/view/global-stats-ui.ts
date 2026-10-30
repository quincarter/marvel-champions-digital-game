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
import type { StatsTab } from "./player-stats-layout.js";

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

/** A load that has not answered yet, beside the answers. */
export type GlobalState = { readonly kind: "idle" } | { readonly kind: "reading" } | GlobalLoad<GlobalStats>;

export const NOTE_READING = "Reading everyone's games…";
export const NOTE_UNAVAILABLE = "Everyone's numbers aren't available right now.";
export const NOTE_STALE = "From earlier: everyone's numbers can't be refreshed right now.";
export const NOTE_EMPTY = "Not enough games yet: a row needs 20.";
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
      return { notes: [...lead, NOTE_EMPTY], section: null };
    case "ready": {
      const id = GLOBAL_SECTION_OF[tab];
      const section = globalSectionsOf(state.data, names).find((s) => s.id === id) ?? null;
      const notes = [...lead, ...(state.stale ? [NOTE_STALE] : []), ...(section ? [] : [NOTE_EMPTY])];
      return { notes, section };
    }
  }
}

/** The deck builder's "Against" source. */
export type AgainstSource = "yours" | "everyone";
export const AGAINST_LABELS: Readonly<Record<AgainstSource, string>> = { yours: "Your decks", everyone: "Everyone" };
export const AGAINST_NOTE_READING = "Reading everyone's decks…";
export const AGAINST_NOTE_NONE = "Not enough games against this villain yet.";
export const AGAINST_NOTE_UNAVAILABLE = "Everyone's numbers aren't available right now.";
export const AGAINST_NOTE_STALE = "From earlier: can't be refreshed right now.";
