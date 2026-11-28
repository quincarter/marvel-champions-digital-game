import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles, glyphLabelShift, type ControlGlyph } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { McModStoreHeaderStyles } from "./mc-mod-store-header.styles.js";
import type { McModStoreHeaderProps, ModStoreSize } from "./mc-mod-store-header.types.js";

/**
 * # Mod Store header
 * The ink bar over the screen: Back, the title with its BETA tag, how many packs are installed and "About mods" (a "!" on
 * a phone) at the right edge. Back and About carry their pad or keyboard glyph while one is in use. The BETA tag is left
 * out on a phone, where it would run under the dark mode tab at the bar's centre (the caption under the bar says the
 * same).
 *
 * @element mc-mod-store-header
 * @fires mc-mod-store - `{ type: "back" }` and `{ type: "about" }`.
 */
export class McModStoreHeader extends ModStoreElement implements McModStoreHeaderProps {
  static override styles = [ThemeStyles, McModStoreHeaderStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    backLabel: { type: String, attribute: "back-label" },
    heading: { type: String },
    badge: { type: String },
    installedText: { type: String, attribute: "installed-text" },
    aboutLabel: { type: String, attribute: "about-label" },
    backGlyph: { attribute: false },
    aboutGlyph: { attribute: false },
  };

  declare size: ModStoreSize;
  declare backLabel: string;
  declare heading: string;
  declare badge: string;
  declare installedText: string;
  declare aboutLabel: string;
  declare backGlyph: ControlGlyph | undefined;
  declare aboutGlyph: ControlGlyph | undefined;

  constructor() {
    super();
    this.size = "wide";
    this.backLabel = "";
    this.heading = "";
    this.badge = "";
    this.installedText = "";
    this.aboutLabel = "";
    this.backGlyph = undefined;
    this.aboutGlyph = undefined;
  }

  #control(cls: string, stop: string, label: string, glyph: ControlGlyph | undefined, type: "back" | "about") {
    return html`<div
      class="ctl ${cls}${glyph ? " glyph" : ""}"
      style=${styleMap({ "--mc-label-shift": `${glyphLabelShift(glyph)}px` })}
    >
      <mc-button
        kind="onInk"
        display
        data-stop=${stop}
        data-key=${stop}
        .label=${label}
        @mc-press=${() => this.emit({ type })}
      ></mc-button>
      <mc-glyph-hint .glyph=${glyph}></mc-glyph-hint>
    </div>`;
  }

  override render() {
    return html`${this.#control("back", "back", this.backLabel, this.backGlyph, "back")}
      <div class="title" title=${this.heading}>${this.heading}</div>
      ${this.badge ? html`<span class="badge">${this.badge}</span>` : nothing}
      ${this.installedText ? html`<div class="installed">${this.installedText}</div>` : nothing}
      ${this.#control("about", "about", this.aboutLabel, this.aboutGlyph, "about")}`;
  }
}
