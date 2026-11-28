import type { SheetRect } from "../../shared/sheet.types.js";
import type { MenuButton } from "../mc-menu-button/mc-menu-button.types.js";

/**
 * A feature panel with a comic caption box look: a halftone header band with a Bangers title, a one-line pitch, an
 * optional "N live" chip, optional decoration, and a row of buttons. Every part is placed by the client's layout, in the
 * panel's own coordinates (its top left is 0, 0).
 */
export interface PromoPanelModel {
  /** False while the feature can't be used (offline): the band and the decoration dim, the buttons are unavailable. */
  readonly available: boolean;
  /** The ink header band the title sits on; a 3px ink rule runs under it. */
  readonly band: SheetRect;
  readonly title: {
    readonly rect: SheetRect;
    /** In capitals, with a line break for a two-line title. */
    readonly text: string;
    readonly size: number;
    readonly lines: 1 | 2;
  };
  /** The "N live" chip: a paper chip with a green dot (never the dot alone: the count carries the meaning). */
  readonly live: { readonly rect: SheetRect; readonly text: string; readonly align: "left" | "right" } | null;
  readonly pitch: { readonly rect: SheetRect; readonly text: string; readonly size: number };
  /** A table of four seats joined by a line, the first filled (you): decoration for spare room. */
  readonly seats: SheetRect | null;
  readonly buttons: readonly MenuButton[];
}
