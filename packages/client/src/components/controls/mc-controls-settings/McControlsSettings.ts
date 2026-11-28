import type { McSegmentOption } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import { CONTROLS_EVENT, type ControlsEventDetail, type ControlsSettingRow } from "../controls.types.js";
import { McControlsSettingsStyles } from "./mc-controls-settings.styles.js";

/**
 * # Controls settings
 * The settings rows on the ink, straight from the generic row elements: a choice row is `mc-segments` with a heading
 * (the pad's labels, the glyph source, the keyboard hand; stops `row:<id>:<value>`), a switch row is `mc-switch-row`
 * (the Switch layout and the hints; stop `row:<id>`, dimmed and inert when the platform sets it), and Hint size is
 * `mc-volume-slider` with a heading and a live preview (stop `row:hintSize`; its - and + are `hint-size:down` and
 * `hint-size:up`). Turning the hints off dims Hint size but leaves it adjustable.
 *
 * @element mc-controls-settings
 * @prop rows - `ControlsSettingRow[]`.
 * @fires mc-controls - `choose`, `toggle`, `hint-slide` and `hint-step`.
 */
export class McControlsSettings extends LitElement {
  static override styles = [McControlsSettingsStyles];

  static override properties: PropertyDeclarations = {
    rows: { attribute: false },
  };

  declare rows: readonly ControlsSettingRow[];

  constructor() {
    super();
    this.rows = [];
    new FeatureRelay<ControlsEventDetail>(this, CONTROLS_EVENT);
  }

  #say(detail: ControlsEventDetail): void {
    this.dispatchEvent(new CustomEvent<ControlsEventDetail>(CONTROLS_EVENT, { detail, bubbles: true, composed: true }));
  }

  #row(row: ControlsSettingRow) {
    if (row.kind === "choice") {
      const options: McSegmentOption[] = row.options.map((option) => ({
        stop: `row:${row.id}:${option.value}`,
        label: option.label,
        selected: option.selected,
        action: { type: "choose", row: row.id, value: option.value } satisfies ControlsEventDetail,
      }));
      return html`<mc-segments
        .heading=${row.heading}
        .detail=${row.detail}
        ?dimmed=${row.dimmed}
        .options=${options}
      ></mc-segments>`;
    }
    if (row.kind === "toggle") {
      return html`<mc-switch-row
        .stop=${`row:${row.id}`}
        .titleText=${row.title}
        .detail=${row.detail}
        .state=${row.state}
        ?on=${row.on}
        ?unavailable=${row.locked}
        .action=${{ type: "toggle", row: row.id } satisfies ControlsEventDetail}
      ></mc-switch-row>`;
    }
    return html`<mc-volume-slider
      data-stop=${`row:${row.id}`}
      data-key="hint-size"
      .heading=${row.heading}
      .detail=${row.detail}
      ?dimmed=${row.dimmed}
      .value=${row.value}
      .label=${row.label}
      down-stop="hint-size:down"
      up-stop="hint-size:up"
      @mc-slide=${(event: CustomEvent<{ share: number }>) => {
        event.stopPropagation();
        this.#say({ type: "hint-slide", share: event.detail.share });
      }}
      @mc-step=${(event: CustomEvent<{ direction: -1 | 1 }>) => {
        event.stopPropagation();
        this.#say({ type: "hint-step", direction: event.detail.direction });
      }}
    >
      <span slot="preview" class="preview">
        ${row.preview.map(
          (glyph) =>
            html`<mc-glyph .specs=${[glyph.spec]} .height=${glyph.height} ground="ink" still></mc-glyph>`,
        )}
      </span>
    </mc-volume-slider>`;
  }

  override render() {
    return this.rows.length === 0 ? nothing : html`${this.rows.map((row) => this.#row(row))}`;
  }
}
