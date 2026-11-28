import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import "../../../components/controls/mc-controls-diagram/mc-controls-diagram.js";
import "../../../components/controls/mc-controls-list/mc-controls-list.js";
import "../../../components/controls/mc-controls-settings/mc-controls-settings.js";
import "../../../components/controls/mc-controls-status/mc-controls-status.js";
import {
  CONTROLS_EVENT,
  type ControlsEventDetail,
  type ControlsPageModel,
  type ControlsTabId,
} from "../../../components/controls/controls.types.js";
import { McControlsPageStyles } from "./mc-controls-page.styles.js";

/**
 * # Controls (page)
 * Settings ▸ Controls as one element that composes sections and holds no state: the ink `mc-top-bar`, the tab rail (the
 * controller and the keyboard) with the pad status line, then one natively scrolling body: the controller drawing and its
 * caption, the settings rows, the lists of what each button or key does, and the Remap buttons (dashed, disabled and
 * saying why until remapping lands). The scene mounts it, sets `model` and hears `mc-controls`.
 *
 * Needs `@mc/ui` defined (`mc-top-bar`, `mc-tab-rail`, `mc-segments`, `mc-switch-row`, `mc-volume-slider`, `mc-glyph`,
 * `mc-section-heading`, `mc-button`).
 *
 * @element mc-controls-page
 * @prop model - `ControlsPageModel`.
 * @attr phone - Set from the model.
 * @fires mc-controls - Any section's `ControlsEventDetail`.
 */
export class McControlsPage extends LitElement {
  static override styles = [ThemeStyles, McControlsPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: ControlsPageModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
    new FeatureRelay<ControlsEventDetail>(this, CONTROLS_EVENT);
  }

  protected override willUpdate(): void {
    this.phone = this.model?.phone ?? false;
  }

  /** The scrolling body (the stick and the Page keys move it). */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".body");
  }

  #say(detail: ControlsEventDetail): void {
    this.dispatchEvent(new CustomEvent<ControlsEventDetail>(CONTROLS_EVENT, { detail, bubbles: true, composed: true }));
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-top-bar
        class="bar"
        .heading=${m.bar.title}
        .backLabel=${m.bar.backLabel}
        .backGlyph=${m.bar.backGlyph}
        ?compact=${m.phone}
        @mc-press=${() => this.#say({ type: "back" })}
      ></mc-top-bar>
      <div class="tabs">
        <mc-tab-rail
          .tabs=${m.tabs}
          .selected=${m.tab}
          prefix="tab:"
          @mc-activate=${(event: CustomEvent<{ id: string }>) => {
            event.stopPropagation();
            this.#say({ type: "tab", id: event.detail.id as ControlsTabId });
          }}
        ></mc-tab-rail>
        <mc-controls-status .connected=${m.status.connected} .text=${m.status.text}></mc-controls-status>
      </div>
      <div class="body" data-key="controls-body">
        <div class="content">
          ${m.diagram ? html`<mc-controls-diagram .input=${m.diagram}></mc-controls-diagram>` : nothing}
          <mc-controls-settings .rows=${m.settings}></mc-controls-settings>
          <mc-controls-list .sections=${m.sections}></mc-controls-list>
          <div class="footer">
            ${m.footer.labels.map(
              (label, index) =>
                html`<mc-button
                  kind="quiet"
                  data-key=${`footer:${index}`}
                  .label=${label}
                  disabled
                  .reason=${m.footer.reason}
                ></mc-button>`,
            )}
          </div>
        </div>
      </div>`;
  }
}
