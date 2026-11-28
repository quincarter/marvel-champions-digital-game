import type { PictureSource } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McGuideArtStyles } from "./mc-guide-art.styles.js";
import type { GuideArtProps } from "./mc-guide-art.types.js";

/**
 * # Guide art
 * The first-run chooser's picture: the title art cropped to fill its panel over an ink ground with the table's dot grid,
 * an ink scrim so the yellow banner reads over any picture, and the banner ("NEW TO THE FIGHT?") at its foot. The picture
 * is the panel-size copy the build makes, loaded lazily; with none the ink ground and banner stand alone. Decorative: no
 * press, no focus.
 *
 * @element mc-guide-art
 * @prop picture - The title art (`PictureSource`, its `cover` set to centre the crop), or none.
 * @attr heading - The banner's words, already translated.
 * @attr wide - The wide screen's left panel (a lighter scrim, a wider banner).
 * @fires mc-image-error - The picture's URL failed to load.
 */
export class McGuideArt extends LitElement implements GuideArtProps {
  static override styles = [McGuideArtStyles];

  static override properties: PropertyDeclarations = {
    picture: { attribute: false },
    heading: { type: String },
    wide: { type: Boolean, reflect: true },
  };

  declare picture: PictureSource | null;
  declare heading: string;
  declare wide: boolean;

  constructor() {
    super();
    this.picture = null;
    this.heading = "";
    this.wide = false;
  }

  override render() {
    return html`${this.picture ? html`<mc-picture-tile class="pic" .picture=${this.picture} .frame=${0} ground="ink"></mc-picture-tile>` : nothing}
      <div class="scrim"></div>
      <div class="banner"><span class="words">${this.heading}</span></div>`;
  }
}
