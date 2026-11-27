import type { MenuButton } from "../mc-menu-button/mc-menu-button.types.js";

/** The buttons a menu grid draws, each at its own rect in the grid's coordinates (a row, or half of one). */
export interface MenuGridModel {
  readonly items: readonly MenuButton[];
}
