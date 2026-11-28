/**
 * Dev e2e hook (never referenced by product code): what Set up the table shows right now. Each modular chip with whether
 * it is chosen, the picks in order they were made, the header counts, the summary rows, every control's current rect, and
 * where the first player token rests and is drawn.
 */
import type { FocusStop } from "../focus-route.js";
import type { Rect } from "../../view/layout.js";
import { effectiveModularSetIds } from "../../view/modular-sets.js";
import type { TableModel } from "./model.js";

export interface DevHookInput {
  readonly model: TableModel;
  readonly stops: () => ReadonlyMap<string, FocusStop>;
  /** The rect the modular tiles scroll inside (the grid's panel; on a phone, the page between header and footer). */
  readonly viewport: () => Rect | null;
  readonly watchable: () => boolean;
  readonly hover: () => string | null;
  readonly token: () => unknown;
}

const HOOK = "__mcTableSetupDebug";

export function installDevHook(input: DevHookInput): void {
  if (!import.meta.env.DEV) return;
  const { model: m } = input;
  (window as unknown as Record<string, unknown>)[HOOK] = {
    stops: () =>
      [...input.stops()].map(([key, stop]) => ({
        key,
        ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
      })),
    options: () => m.modularOptions.map((o) => ({ id: o.id, kind: o.kind, name: o.name, selected: o.selected })),
    picks: () => [...effectiveModularSetIds(m.draft, m.scenario)],
    difficulty: () => m.draft.difficulty,
    firstPlayer: () => m.seats.find((s) => s.selected)?.index ?? null,
    modularViewport: input.viewport,
    /** Brings a stop into view in the page's scroller. */
    reveal: (key: string) => input.stops().get(key)?.ensureVisible?.(),
    modularHeader: () => m.modularRight,
    encounterDeckSize: () => m.encounterDeckSize,
    watchable: input.watchable,
    hoverShown: input.hover,
    summary: () => m.summaryRows.map((r) => [r.label, r.value]),
    firstPlayerToken: input.token,
  };
}

export function clearDevHook(): void {
  if (import.meta.env.DEV) delete (window as unknown as Record<string, unknown>)[HOOK];
}
