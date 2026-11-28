import { ThemeStyles, type McTextField } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import "../../../components/save-data/mc-save-data-actions/mc-save-data-actions.js";
import "../../../components/save-data/mc-save-data-confirm/mc-save-data-confirm.js";
import "../../../components/save-data/mc-save-data-receive/mc-save-data-receive.js";
import "../../../components/save-data/mc-save-data-send/mc-save-data-send.js";
import "../../../components/save-data/mc-save-data-status/mc-save-data-status.js";
import type { McSaveDataReceive } from "../../../components/save-data/mc-save-data-receive/McSaveDataReceive.js";
import { saveDataEvent, type SaveDataPageModel } from "../../../components/save-data/save-data.types.js";
import { McSaveDataPageStyles } from "./mc-save-data-page.styles.js";

/**
 * # Save data (page)
 * Settings ▸ Save data as one element that composes sections and holds no state: the ink `mc-top-bar`, then the step
 * (the six action rows, the replace confirm, Send or Receive) and the status line under it. The body scrolls natively, so
 * a short screen (a phone held sideways) never draws one control over another. The scene mounts it, sets `model` and
 * hears `mc-save-data`.
 *
 * Needs `@mc/ui` defined (`mc-top-bar`, `mc-hint-button`, `mc-stamp`, `mc-qr-code`, `mc-text-field`).
 *
 * @element mc-save-data-page
 * @prop model - `SaveDataPageModel`.
 * @attr phone - Set from the model.
 * @fires mc-save-data - Any section's `SaveDataEventDetail`.
 */
export class McSaveDataPage extends LitElement {
  static override styles = [ThemeStyles, McSaveDataPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: SaveDataPageModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
  }

  protected override willUpdate(): void {
    this.phone = this.model?.phone ?? false;
  }

  /** The code field on the Receive step, for the scene's caret rules. */
  get codeField(): McTextField | null {
    return this.renderRoot.querySelector<McSaveDataReceive>("mc-save-data-receive")?.field ?? null;
  }

  #step(m: SaveDataPageModel) {
    const step = m.step;
    switch (step.kind) {
      case "menu":
        return html`<mc-save-data-actions .input=${step.actions}></mc-save-data-actions>`;
      case "confirm":
        return html`<mc-save-data-confirm .input=${step.confirm}></mc-save-data-confirm>`;
      case "send":
        return html`<mc-save-data-send .input=${step.send}></mc-save-data-send>`;
      case "receive":
        return html`<mc-save-data-receive .input=${step.receive}></mc-save-data-receive>`;
      case "busy":
        return nothing;
    }
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
        @mc-press=${() => this.dispatchEvent(saveDataEvent({ type: "back" }))}
      ></mc-top-bar>
      <div class="body" data-key="body">
        <div class="content">
          ${this.#step(m)} ${m.status ? html`<mc-save-data-status .input=${m.status}></mc-save-data-status>` : nothing}
        </div>
      </div>`;
  }
}
