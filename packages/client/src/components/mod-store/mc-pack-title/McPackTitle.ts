import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import "../mc-pack-state-chip/mc-pack-state-chip.js";
import { McPackTitleStyles } from "./mc-pack-title.styles.js";
import type { McPackTitleProps, PackTitleModel } from "./mc-pack-title.types.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";

/**
 * # Pack title
 * A pack page's title block, beside its pictures: the name in display type, the byline, the meta line ("Hero pack ·
 * v1.0.0 · 1.2 MB", two lines at most) and the state chip.
 *
 * @element mc-pack-title
 */
export class McPackTitle extends LitElement implements McPackTitleProps {
  static override styles = [ThemeStyles, McPackTitleStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    pack: { attribute: false },
  };

  declare size: ModStoreSize;
  declare pack: PackTitleModel | null;

  constructor() {
    super();
    this.size = "wide";
    this.pack = null;
  }

  override render() {
    const t = this.pack;
    if (!t) return html``;
    return html`<div class="name">${t.name}</div>
      <div class="byline">${t.byline}</div>
      <div class="meta">${t.meta}</div>
      <mc-pack-state-chip .text=${t.chip} ?solid=${t.solid}></mc-pack-state-chip>`;
  }
}
