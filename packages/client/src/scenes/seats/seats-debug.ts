/**
 * Dev e2e hook (never referenced by product code): the screen's facts and every control's current rect, by focus key.
 * The specs read it through `window.__mcSeatsDebug`; it exists only in a dev build.
 */
import type Phaser from "phaser";
import type { SeatInsights } from "../../view/seat-recommendations.js";
import type { SetupDraft } from "../../view/setup-draft.js";
import type { ShelfDrillState } from "../../view/shelf-drill.js";
import type { FocusStop } from "../focus-route.js";
import type { SeatsBook } from "./seats-book.js";

export interface SeatsDebugSource {
  readonly draft: () => SetupDraft;
  readonly book: SeatsBook;
  readonly drill: () => ShelfDrillState;
  readonly folded: () => ReadonlySet<string>;
  readonly stops: () => ReadonlyMap<string, FocusStop>;
  readonly roster: () => HTMLElement | null;
  readonly insights: () => SeatInsights;
  readonly hover: (deckId: string | null) => void;
  readonly decksOpen: () => boolean;
}

/** Every hero tile's picture box (an `mc-picture-tile`), through the open shadow roots under `root`. */
function pictureTiles(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.shadowRoot) found.push(...pictureTiles(root.shadowRoot));
  for (const node of root.querySelectorAll<HTMLElement>("*")) {
    if (node.localName === "mc-picture-tile") found.push(node);
    if (node.shadowRoot) found.push(...pictureTiles(node.shadowRoot));
  }
  return found;
}

export function installSeatsDebug(_scene: Phaser.Scene, source: SeatsDebugSource): void {
  if (!import.meta.env.DEV) return;
  (window as unknown as { __mcSeatsDebug?: unknown }).__mcSeatsDebug = {
    folded: () => [...source.folded()],
    seats: () => [...source.draft().seats],
    unseatable: () =>
      source.book
        .deckOptions()
        .filter((o) => !o.seatable)
        .map((o) => o.deck.id as string),
    activeSeat: () => source.draft().activeSeatIndex,
    decksOpen: () => source.decksOpen(),
    drilledPack: () => source.drill().packId,
    listRect: () => {
      const rect = source.roster()?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    },
    recommended: () => source.insights().recommended.map((r) => ({ deckId: r.deckId, reason: r.reason })),
    pairs: () => source.insights().pairs.map((p) => p.label),
    hover: (deckId: string | null) => source.hover(deckId),
    stops: () =>
      [...source.stops()].map(([key, stop]) => ({
        key,
        ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
      })),
    hoverCards: () => pictureTiles(source.roster() ?? document.body).length,
    heroPictures: () => {
      const root = source.roster();
      return (root ? pictureTiles(root) : []).map((tile) => {
        const img = tile.shadowRoot?.querySelector("img") ?? null;
        return {
          src: img?.getAttribute("src") ?? null,
          loaded: img ? img.complete && img.naturalWidth > 0 : false,
          width: img?.naturalWidth ?? 0,
        };
      });
    },
  };
}
