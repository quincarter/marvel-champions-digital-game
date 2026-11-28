import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { fitOneLine } from "../../shared/fit.js";
import "../mc-menu-grid/mc-menu-grid.js";
import type { McMenuGrid } from "../mc-menu-grid/McMenuGrid.js";
import { McAlertBannerStyles } from "./mc-alert-banner.styles.js";
import type { AlertBannerModel } from "./mc-alert-banner.types.js";

/**
 * # Alert banner
 * A caution-yellow banner with a heading, a detail line and buttons: the update on offer, a downloaded update waiting
 * for a restart, the saves that did not load, the old save's recovery page. The text shrinks to fit its width (a
 * translation can run longer than the English); the buttons are an `mc-menu-grid` and raise its `mc-activate`.
 *
 * @element mc-alert-banner
 * @fires mc-activate - `detail.key`: one of the banner's buttons was tapped.
 */
export class McAlertBanner extends LitElement {
  static override styles = [ThemeStyles, McAlertBannerStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: AlertBannerModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The element drawn for a button's key. */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector<McMenuGrid>("mc-menu-grid")?.elementOf(key) ?? null;
  }

  override updated(): void {
    for (const line of this.renderRoot.querySelectorAll<HTMLElement>(".text")) fitOneLine(line);
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const at = (top: number): string => `left:${m.text.x}px;top:${top}px;width:${m.text.width}px`;
    return html`<div class="box"></div>
      <div class="text heading" style=${at(m.text.y)}>${m.heading}</div>
      <div class="text detail" style=${at(m.text.y + 16)}>${m.detail}</div>
      <mc-menu-grid .items=${m.buttons}></mc-menu-grid>`;
  }
}
