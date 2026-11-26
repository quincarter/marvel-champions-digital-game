import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { onTap } from "../../shared/tap.js";
import { tapped } from "../../shared/tapped.js";
import "../mc-button/mc-button.js";
import type { McButtonKind } from "../mc-button/McButton.js";
import { McSettingsBodyStyles } from "./mc-settings-body.styles.js";

/** A box in the body's content space: `x` from the body's left edge, `y` from the top of its scrolling content. */
export interface BodyRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A button on a row: a switch ("ON" / "OFF"), a door ("Open ▸"), Apply. */
export interface BodyButton {
  readonly kind: "button";
  readonly key: string;
  readonly rect: BodyRect;
  readonly label: string;
  readonly look: McButtonKind;
  readonly selected?: boolean;
  /** The inner paper frame of a switch that is on. */
  readonly framed?: boolean;
  /** Unavailable, with the reason a tooltip gives. */
  readonly disabled?: string | true;
}

/** One cell of a segmented control or a tile row: an option, chosen or not. */
export interface BodyCell {
  readonly kind: "cell";
  readonly key: string;
  readonly rect: BodyRect;
  readonly label: string;
  /** A second line under the label (a tile); without one the label is centered, in capitals. */
  readonly detail?: string;
  readonly selected: boolean;
  /** The chosen cell's fill: paper (a segment) or caution yellow (a tile, the guide level). */
  readonly fill: "paper" | "caution";
}

/** A dropdown field: the value shown, and a ▼. */
export interface BodyField {
  readonly kind: "field";
  readonly key: string;
  readonly rect: BodyRect;
  readonly label: string;
}

export type BodyControl = BodyButton | BodyCell | BodyField;

/** One row: its title and detail at the top left, and its controls where the client's layout placed them. */
export interface BodyRow {
  readonly key: string;
  readonly rect: BodyRect;
  readonly title?: string;
  readonly detail?: string;
  /** How wide the detail wraps; the row's width when absent. */
  readonly detailWidth?: number;
  /** A detail saying why the row can't be used now: dimmer. */
  readonly detailDim?: boolean;
  /** A press anywhere on the row (not on a control) presses this key, as the row's own switch does. */
  readonly rowKey?: string;
  readonly controls: readonly BodyControl[];
}

export interface BodyHeading {
  readonly rect: BodyRect;
  readonly title: string;
}

/** An open dropdown list (the Resolution field's): its options over the rows, and a tap anywhere else closes it. */
export interface BodyList {
  readonly rect: BodyRect;
  readonly rowHeight: number;
  readonly options: readonly { readonly key: string; readonly label: string; readonly selected: boolean }[];
  /** The key a tap outside the list sends. */
  readonly closeKey: string;
}

export interface SettingsBodyModel {
  /** The content's whole height, so the list scrolls exactly as far as the rows go. */
  readonly height: number;
  readonly headings: readonly BodyHeading[];
  readonly rows: readonly BodyRow[];
  readonly list?: BodyList;
}

const px = (rect: BodyRect): string => `left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px`;

/**
 * # Settings body
 * The scrolling body of the Settings overlay: section headings and rows on the overlay's ink panel, placed exactly
 * where the client's tested layout (`view/settings-layout.ts`) puts them. Each row is a title, a detail and its
 * controls: a switch or door button, a segmented control, tiles, a dropdown field. Every control is pressed only by a
 * tap; the client decides what each key does.
 *
 * @element mc-settings-body
 * @fires mc-activate - `detail.key`: a control (or a row, for its own switch) was tapped.
 */
export class McSettingsBody extends LitElement {
  static override styles = [ThemeStyles, McSettingsBodyStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: SettingsBodyModel;
  readonly #untap = new Map<Element, () => void>();

  constructor() {
    super();
    this.model = { height: 0, headings: [], rows: [] };
  }

  /** The scrolling element: the scene pages it, scrolls it with the stick and keeps a focused control in view. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  /** The element drawn for a row's own key or a control's key, for the focus ring. */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  #activate(key: string): void {
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key }, bubbles: true, composed: true }));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Labels are fitted to their cells by measuring: measure again once the web fonts are in.
    void document.fonts?.ready.then(() => this.requestUpdate());
  }

  override updated(): void {
    // A long label ("Standard", "Extra large") on a narrow segment shrinks to fit its cell, as Phaser's `fitText` does.
    for (const label of this.renderRoot.querySelectorAll<HTMLElement>(".cell:not([data-detail]) .label")) {
      label.style.fontSize = "";
      let size = parseFloat(getComputedStyle(label).fontSize);
      while (label.scrollWidth > label.clientWidth && size > 7) {
        size -= 0.5;
        label.style.fontSize = `${size}px`;
      }
    }
    // Rows that press their own switch take a tap anywhere on them that isn't on a control.
    const live = new Set<Element>();
    for (const element of this.renderRoot.querySelectorAll<HTMLElement>("[data-row-key]")) {
      live.add(element);
      if (this.#untap.has(element)) continue;
      this.#untap.set(
        element,
        // The row's controls are drawn beside it, not inside it, so a tap here is never also a control's.
        onTap(element, () => this.#activate(element.dataset.rowKey!)),
      );
    }
    for (const [element, stop] of this.#untap)
      if (!live.has(element)) {
        stop();
        this.#untap.delete(element);
      }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const stop of this.#untap.values()) stop();
    this.#untap.clear();
  }

  override render() {
    const { model } = this;
    return html`<div class="scroller">
      <div class="content" style=${`height:${model.height}px`}>
        ${model.headings.map(
          (heading) =>
            html`<div class="heading" style=${px(heading.rect)}>
              <h3>${heading.title}</h3>
              <span class="rule"></span>
            </div>`,
        )}
        ${repeat(
          model.rows,
          (row) => row.key,
          (row) => this.#row(row),
        )}
        ${model.list ? this.#list(model.list, model.height) : nothing}
      </div>
    </div>`;
  }

  /** The open dropdown: a backdrop over the rows that closes it, and its options in a box (scrolling past eight). */
  #list(list: BodyList, height: number) {
    return html`<div
        class="backdrop"
        style=${`height:${height}px`}
        ${tapped(() => this.#activate(list.closeKey))}
      ></div>
      <div class="list scroller" style=${px(list.rect)}>
        ${repeat(
          list.options,
          (option) => option.key,
          (option) =>
            html`<mc-button
              class="option"
              data-key=${option.key}
              style=${`height:${list.rowHeight}px`}
              kind=${option.selected ? "secondary" : "quiet"}
              .label=${option.label}
              ?selected=${option.selected}
              @mc-press=${() => this.#activate(option.key)}
            ></mc-button>`,
        )}
      </div>`;
  }

  #row(row: BodyRow) {
    return html`<div
        class="row"
        data-key=${row.key}
        data-row-key=${row.rowKey ?? nothing}
        ?data-tappable=${row.rowKey !== undefined}
        style=${px(row.rect)}
      >
        ${row.title ? html`<p class="title">${row.title}</p>` : nothing}
        ${
          row.detail
            ? html`<p class="detail" ?data-dim=${row.detailDim} style=${`width:${row.detailWidth ?? row.rect.width}px`}>
                ${row.detail}
              </p>`
            : nothing
        }
      </div>
      ${repeat(
        row.controls,
        (control) => control.key,
        (control) => this.#control(control, row.rect),
      )}`;
  }

  /** A control, placed in content space (its rect is absolute, as the row's is). */
  #control(control: BodyControl, _row: BodyRect) {
    if (control.kind === "button")
      return html`<mc-button
        class="control"
        data-key=${control.key}
        style=${px(control.rect)}
        kind=${control.look}
        .label=${control.label}
        ?selected=${control.selected ?? false}
        ?framed=${control.framed ?? false}
        ?disabled=${control.disabled !== undefined}
        .reason=${typeof control.disabled === "string" ? control.disabled : ""}
        @mc-press=${() => this.#activate(control.key)}
      ></mc-button>`;
    if (control.kind === "field")
      return html`<div
        class="field control"
        data-key=${control.key}
        style=${px(control.rect)}
        ${tapped(() => this.#activate(control.key))}
      >
        <span class="value">${control.label}</span><span class="arrow">▼</span>
      </div>`;
    return html`<div
      class="cell control"
      data-key=${control.key}
      data-fill=${control.fill}
      ?data-selected=${control.selected}
      ?data-detail=${control.detail !== undefined}
      style=${px(control.rect)}
      ${tapped(() => this.#activate(control.key))}
    >
      <span class="label">${control.label}</span>
      ${control.detail !== undefined ? html`<span class="cell-detail">${control.detail}</span>` : nothing}
    </div>`;
  }
}
