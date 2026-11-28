import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McStatTileStyles } from "./mc-stat-tile.styles.js";
import type { McStatTileProps } from "./mc-stat-tile.types.js";

/**
 * # Stat tile
 * One boxed count. Sized by its parent (a flex row of equal cells): see `mc-stat-tiles`.
 *
 * @element mc-stat-tile
 * @attr text - The words in the box.
 */
export class McStatTile extends LitElement implements McStatTileProps {
  static override styles = [ThemeStyles, McStatTileStyles];

  static override properties: PropertyDeclarations = { text: { type: String } };

  declare text: string;

  constructor() {
    super();
    this.text = "";
  }

  override render() {
    return html`${this.text}`;
  }
}
