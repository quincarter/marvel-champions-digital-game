import type { MenuButton } from "../mc-menu-button/mc-menu-button.types.js";

/**
 * A caution-yellow banner: two lines of text and its buttons (an update, a notice about saves). Everything is placed by
 * the client's layout, in the banner's own coordinates.
 */
export interface AlertBannerModel {
  /** The short heading, in capitals ("UPDATE AVAILABLE"). */
  readonly heading: string;
  /** The line under it ("Version 1.2.0"). */
  readonly detail: string;
  /** Where the two lines start and how wide they run before they shrink to fit. */
  readonly text: { readonly x: number; readonly y: number; readonly width: number };
  /** The action buttons, then the close button, each at its rect inside the banner. */
  readonly buttons: readonly MenuButton[];
}
