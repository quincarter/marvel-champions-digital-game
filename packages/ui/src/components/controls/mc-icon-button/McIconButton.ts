import { html, nothing, svg, type PropertyDeclarations, type SVGTemplateResult } from "lit";
import type { ControlGlyph } from "../../../shared/popup.types.js";
import { McPress } from "../../../shared/press/McPress.js";
import "../../mc-glyph/mc-glyph.js";
import { McIconButtonStyles } from "./mc-icon-button.styles.js";
import type { McIconName } from "./mc-icon-button.types.js";

const ICONS: Readonly<Record<McIconName, SVGTemplateResult>> = {
  globe: svg`<g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4.5" ry="9"/><path d="M3 12h18M12 3v18"/></g>`,
  bug: svg`<g fill="currentColor" stroke="currentColor" stroke-width="1.6"><ellipse cx="12" cy="14" rx="4.6" ry="6.2"/><circle cx="12" cy="6.5" r="2.4"/><path fill="none" d="M10.6 4.6 8.6 2.4M13.4 4.6l2-2.2M7.4 12H3.6M7.6 15 4 16.6M7.8 18l-3 2.4M16.6 12h3.8M16.4 15l3.6 1.6M16.2 18l3 2.4"/><path fill="none" stroke="var(--ib-fill)" d="M12 10.5V20"/></g>`,
  note: svg`<g fill="currentColor"><ellipse cx="7" cy="18" rx="3.5" ry="2.6"/><ellipse cx="17" cy="16" rx="3.5" ry="2.6"/><path d="M9.6 17V6.2L19.4 4v12h-2V7.6l-5.8 1.2V17z"/></g>`,
  moon: svg`<path fill="currentColor" d="M20.5 14.2A9 9 0 1 1 9.8 3.5a7.2 7.2 0 0 0 10.7 10.7z"/>`,
  sun: svg`<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></g>`,
  store: svg`<g fill="currentColor" stroke="currentColor" stroke-width="1.6"><path d="M3 3h18v6H3z"/><path fill="var(--ib-fill)" d="M7.5 3h3v6h-3zM13.5 3h3v6h-3z"/><path fill="none" d="M5 9v12h14V9"/><path d="M10 21v-6h4v6z"/></g>`,
  discord: svg`<g fill="currentColor"><path d="M3 12C3 7 6 4 12 4s9 3 9 8v4c0 1-.6 2-1.6 2H4.6C3.6 18 3 17 3 16z"/><rect x="5" y="16" width="4" height="5"/><rect x="15" y="16" width="4" height="5"/><ellipse cx="8.8" cy="12.6" rx="1.7" ry="2.4" fill="var(--ib-fill)"/><ellipse cx="15.2" cy="12.6" rx="1.7" ry="2.4" fill="var(--ib-fill)"/></g>`,
};

/**
 * # Icon button
 * A square (or, with a short `label`, a little wider) chrome button: a picture on ink with a paper rim, paper while a
 * mouse rests on it or the thing it opens is open (`lit`). A tap raises `mc-pressed` with its `action`; the focus route
 * presses it through `click()`. The key or pad `glyph` hangs under it while it has focus. Size comes from
 * `--icon-button-size` (and `--icon-button-width` for a wide one).
 *
 * @element mc-icon-button
 * @attr icon - The picture.
 * @attr label - Short words beside it.
 * @attr name - Assistive text and tooltip.
 * @attr lit - Drawn as hovered.
 * @attr badge - A count hung on the top right corner ("3").
 * @prop glyph - The hung press glyph.
 * @fires mc-pressed - `PressDetail`.
 */
export class McIconButton extends McPress {
  static override styles = McIconButtonStyles;

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    icon: { type: String, reflect: true },
    label: { type: String },
    name: { type: String },
    lit: { type: Boolean, reflect: true },
    badge: { type: String },
    glyph: { attribute: false },
  };

  declare icon: McIconName;
  declare label: string;
  declare name: string;
  declare lit: boolean;
  declare badge: string;
  declare glyph: ControlGlyph | null;

  constructor() {
    super();
    this.icon = "globe";
    this.label = "";
    this.name = "";
    this.lit = false;
    this.badge = "";
    this.glyph = null;
  }

  protected override willUpdate(): void {
    if (this.name) this.setAttribute("aria-label", this.name);
  }

  override render() {
    const glyph = this.glyph;
    return html`<div class="box" title=${this.name}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[this.icon]}</svg>
        ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
        ${this.badge ? html`<span class="badge">${this.badge}</span>` : nothing}
      </div>
      ${
        glyph
          ? html`<mc-glyph
              .specs=${glyph.specs}
              .height=${glyph.height}
              .ground=${glyph.ground}
              .openness=${glyph.openness}
              ?still=${glyph.still ?? false}
            ></mc-glyph>`
          : nothing
      }`;
  }
}
