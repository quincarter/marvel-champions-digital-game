/**
 * Where the villain phase sits against the table (the 2026-10-14 redesign, `artifacts/design-screenshots/villain-phase/`,
 * issues #117, #128, #129, #138).
 *
 * The old walkthrough covered the whole screen, so the table and the hand vanished exactly when the player had to
 * decide whether to spend a card on an interrupt. The redesign keeps them in view:
 *  - **rail** (desktop, D1/D2): the phase docks on the right, under the chrome band; the table and hand lay themselves
 *    out in what is left (`LayoutOptions.villainDock`).
 *  - **band** (tablet landscape, T1): the phase takes the villain band; the hero, play area and hand stay below.
 *  - **tab** (phone and tablet portrait, P1/P2/T2): the phase takes everything between the chrome and the hand, and its
 *    own buttons sit where the action bar is, at the thumb.
 *  - **peek** (P3): the player looks at the table while the phase waits; the phase keeps only a banner over the action
 *    bar with its decision and a way back.
 *  - **full**: the old full-screen panel, kept for "Show the table beside it" off (S1) and for the phone in landscape,
 *    which has no room beside or below the table.
 * The recap (D3/T3/P4) is always full screen.
 *
 * Pure: `scenes/board.ts` turns the request into rectangles off its own layout, and `scenes/villain-phase.ts` draws
 * into them.
 */
import type { BoardLayout, FormFactor, Rect } from "./layout.js";

export type VillainDockKind = "rail" | "band" | "tab" | "peek" | "full";

/** The docked shapes the Board lays itself out around; `full` needs nothing from it. */
export type VillainDockRequest = Exclude<VillainDockKind, "full">;

export interface VillainPresentationInput {
  readonly formFactor: FormFactor;
  /** S1 "Show the table beside it". */
  readonly dockTable: boolean;
  /** The recap is showing (the phase is over and has been read out). */
  readonly recap: boolean;
  /** The player is peeking at the table (P3), on a tabbed layout. */
  readonly peeking: boolean;
}

export function villainPresentationFor(input: VillainPresentationInput): VillainDockKind {
  if (input.recap || !input.dockTable) return "full";
  switch (input.formFactor) {
    case "desktop":
      return "rail";
    case "tabletLandscape":
      return "band";
    case "phone":
    case "tabletPortrait":
      return input.peeking ? "peek" : "tab";
    default:
      return "full";
  }
}

/** The docked rail's width on desktop: about a third of the screen, as D1 draws it, within readable bounds. */
export function villainDockWidthFor(viewportWidth: number): number {
  return Math.round(Math.min(600, Math.max(440, viewportWidth * 0.33)));
}

export interface VillainDockRects {
  /** Where the phase panel draws; null while peeking. */
  readonly panel: Rect | null;
  /** The thumb strip for the phase's own buttons on tabbed layouts (the action bar's place); null elsewhere. */
  readonly footer: Rect | null;
  /**
   * Where the peek banner sits (P3): under the chrome and the board's tab rail, so the hand stays in view (the owner
   * found the first version, over the action bar, covering the hand). Null outside peek.
   */
  readonly banner: Rect | null;
}

/** The peek banner's height. */
export const PEEK_BANNER_HEIGHT = 112;

/**
 * The rectangles for `request`, read off the layout the Board drew with it (`rail` must have been laid out with
 * `villainDock: dockWidth`). The panel always starts under the chrome band, which stays the Board's.
 */
export function villainDockRects(
  request: VillainDockRequest,
  layout: BoardLayout,
  dockWidth: number,
): VillainDockRects {
  const { viewport, zones } = layout;
  const chrome = zones.chrome;
  const top = chrome ? chrome.y + chrome.height : viewport.y;
  const bottom = viewport.y + viewport.height;
  const hand = zones.hand;
  switch (request) {
    case "rail":
      return {
        panel: { x: viewport.x + viewport.width - dockWidth, y: top, width: dockWidth, height: bottom - top },
        footer: null,
        banner: null,
      };
    case "band": {
      // Down to the player band: the hero and the play area are what the player answers with.
      const playerTop = Math.min(zones.me?.y ?? bottom, zones.playArea?.y ?? bottom, hand?.y ?? bottom);
      const left = Math.min(zones.me?.x ?? viewport.x, hand?.x ?? viewport.x);
      return {
        panel: { x: left, y: top, width: viewport.x + viewport.width - left, height: Math.max(0, playerTop - 8 - top) },
        footer: null,
        banner: null,
      };
    }
    case "tab":
    case "peek": {
      const x = hand?.x ?? viewport.x;
      const width = hand?.width ?? viewport.width;
      const handTop = hand?.y ?? bottom;
      const tabs = zones.tabs;
      const bannerTop = tabs ? tabs.y + tabs.height + 8 : top + 8;
      return {
        panel: request === "tab" ? { x, y: top, width, height: Math.max(0, handTop - top) } : null,
        footer: zones.actionBar ?? null,
        banner:
          request === "peek"
            ? { x: x + 8, y: bannerTop, width: Math.max(0, width - 16), height: PEEK_BANNER_HEIGHT }
            : null,
      };
    }
  }
}
