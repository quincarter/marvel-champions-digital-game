import type { FocusStop } from "../focus-route.js";
import type { Rect } from "../../view/layout.js";
import type { ScenarioTiles } from "./tiles.js";

export interface DebugSources {
  readonly tiles: ScenarioTiles;
  readonly selectedId: () => string | null;
  readonly folded: () => ReadonlySet<string>;
  readonly drilledPack: () => string | null;
  readonly listRect: () => Rect;
  readonly recordText: () => string;
  readonly hoverKey: () => string | null;
  readonly stops: () => ReadonlyMap<string, FocusStop>;
}

/** Dev e2e hook (never referenced by product code): the tiles drawn, the pick, the folds, the open box, the stops and their rects. */
export function installDebugHook(sources: DebugSources): void {
  sources.tiles.debug.clear();
  (window as unknown as { __mcScenarioSelectDebug?: unknown }).__mcScenarioSelectDebug = {
    tiles: () => [...sources.tiles.debug.values()],
    selectedId: sources.selectedId,
    folded: () => [...sources.folded()],
    drilledPack: sources.drilledPack,
    listRect: sources.listRect,
    recordText: sources.recordText,
    hoverKey: sources.hoverKey,
    stops: () =>
      [...sources.stops()].map(([key, stop]) => ({
        key,
        ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
      })),
  };
}
