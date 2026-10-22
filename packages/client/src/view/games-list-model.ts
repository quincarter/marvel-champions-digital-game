/**
 * The "In-progress games" list (device sync, #276): several games can be in progress at once, so the Title offers
 * Continue for the newest and a list for the rest. Plain data and geometry here; `ui/games-list.ts` draws it.
 *
 * A row says which game it is (`gameLabelOf`), where it was last played (the platform mark), its round and when it
 * was last played. Guided lesson saves never reach this list (`EngineSessionCore.activeSaves`).
 */
import { hit } from "../tokens.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { gameLabelOf, type ContinueLabelNames } from "./continue-label.js";
import type { Rect } from "./layout.js";

/**
 * Whether the title offers the list: when some game in progress is not the one Continue already offers. With one game,
 * Continue is that game; but with Continue on a tutorial (not in the list) and a Rhino game in progress, the list is
 * the only way to Rhino, so it shows even for a single row.
 */
export function shouldShowGamesList(gameIds: readonly string[], continueId: string | null): boolean {
  return gameIds.some((id) => id !== continueId);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Midnight at the start of `at`'s local day. */
const dayStart = (at: number): number => {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** "just now", "5 min ago", "2 h ago", "yesterday", "3 days ago", "2 wk ago", then a short date. */
export function relativeTimeOf(then: number, now: number): string {
  const elapsed = now - then;
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  const days = Math.round((dayStart(now) - dayStart(then)) / DAY);
  if (days <= 0) return `${Math.floor(elapsed / HOUR)} h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 35) return `${Math.floor(days / 7)} wk ago`;
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export interface GamesListNames extends ContinueLabelNames {
  /** A campaign box's display name for a save's `campaignId`, or undefined when unknown. */
  readonly campaignName: (campaignId: string) => string | undefined;
}

export interface GameRow {
  readonly id: string;
  /** "Rhino · Spider-Man": what the game is. */
  readonly title: string;
  /** "Campaign: The Rise of Red Skull" for a campaign game; null for a standalone one. */
  readonly kicker: string | null;
  /** "Round 4 · 2 h ago". */
  readonly detail: string;
  readonly save: SaveMeta;
}

/** One row per save, most recently played first. */
export function gameRowsOf(saves: readonly SaveMeta[], names: GamesListNames, now: number): readonly GameRow[] {
  return [...saves]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((save) => ({
      id: save.id,
      title: gameLabelOf(save.config, names),
      kicker: save.campaignId === null ? null : `Campaign: ${names.campaignName(save.campaignId) ?? save.campaignId}`,
      detail: `Round ${save.round} · ${relativeTimeOf(save.updatedAt, now)}`,
      save,
    }));
}

/** A row's height, and the gap under each. */
export const GAME_ROW_HEIGHT = 68;
export const GAME_ROW_GAP = 8;
const ROW_PAD = 12;
const REMOVE_WIDTH = 88;

export interface GameRowParts {
  /** Room kept clear at the row's left edge for the platform mark. */
  readonly iconInset: number;
  /** The title, kicker and detail lines run in this column. */
  readonly text: Rect;
  /** The Remove control: a touch-sized button at the row's right end. */
  readonly remove: Rect;
}

/** Where the parts of the row at `row` sit. */
export function gameRowParts(row: Rect): GameRowParts {
  const remove: Rect = {
    x: row.x + row.width - ROW_PAD - REMOVE_WIDTH,
    y: row.y + (row.height - hit.target) / 2,
    width: REMOVE_WIDTH,
    height: hit.target,
  };
  const iconInset = ROW_PAD + 28 + 10;
  return {
    iconInset,
    text: { x: row.x + iconInset, y: row.y + 8, width: remove.x - 10 - (row.x + iconInset), height: row.height - 16 },
    remove,
  };
}

/** The list's rows laid down the viewport at scroll offset 0, and the content height they need. */
export function gameRowRects(
  viewport: Rect,
  count: number,
): { readonly rows: readonly Rect[]; readonly height: number } {
  const rows = Array.from({ length: count }, (_, i) => ({
    x: viewport.x,
    y: viewport.y + i * (GAME_ROW_HEIGHT + GAME_ROW_GAP),
    // Room on the right for the scrollbar.
    width: viewport.width - 10,
    height: GAME_ROW_HEIGHT,
  }));
  return { rows, height: Math.max(0, count * (GAME_ROW_HEIGHT + GAME_ROW_GAP) - GAME_ROW_GAP) };
}

export interface RemoveConfirmParts {
  readonly message: Rect;
  readonly keep: Rect;
  readonly remove: Rect;
}

/** The in-page "Remove this game?" question inside `area`: the words above, "Keep it" and "Remove" side by side. */
export function removeConfirmParts(area: Rect): RemoveConfirmParts {
  const buttonY = area.y + area.height - hit.primary;
  const half = (area.width - 12) / 2;
  return {
    message: { x: area.x, y: area.y, width: area.width, height: Math.max(0, buttonY - 12 - area.y) },
    keep: { x: area.x, y: buttonY, width: half, height: hit.primary },
    remove: { x: area.x + half + 12, y: buttonY, width: half, height: hit.primary },
  };
}

export const REMOVE_CONFIRM_TEXT = "Remove this game? It counts as played; you can't resume it.";
