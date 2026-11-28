import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { onTap, ThemeStyles } from "@mc/ui";
import { pressOf } from "../scenario-select.types.js";
import "../mc-scenario-record/mc-scenario-record.js";
import "../mc-scenario-set-block/mc-scenario-set-block.js";
import "../mc-scenario-stage/mc-scenario-stage.js";
import "../mc-scenario-stats/mc-scenario-stats.js";
import { McScenarioPickedStyles } from "./mc-scenario-picked.styles.js";
import type { ScenarioPickedModel } from "./mc-scenario-picked.types.js";

/**
 * # Scenario picked
 * The ink "scenario stages" panel for the picked scenario: a box per stage (the one this difficulty plays is bright), the
 * played record and the encounter and modular sets. A wide screen shows it open as a side column. A narrow one makes it a
 * disclosure: shut it is one bar (the `stages-toggle` stop), open it is a sheet over the list with the stat strip inside,
 * rising from that same bar so opening and closing never moves what was tapped.
 *
 * @element mc-scenario-picked
 * @prop model - `ScenarioPickedModel`.
 * @attr wide - The side column's arrangement (set by the page).
 * @fires mc-scenario-select - `{ type: "press", key: "stages-toggle" }`.
 */
export class McScenarioPicked extends LitElement {
  static override styles = [ThemeStyles, McScenarioPickedStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    wide: { type: Boolean, reflect: true },
  };

  declare model: ScenarioPickedModel | null;
  declare wide: boolean;
  #bar: HTMLElement | null = null;
  #stopTap: (() => void) | null = null;

  constructor() {
    super();
    this.model = null;
    this.wide = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopTap?.();
    this.#stopTap = null;
    this.#bar = null;
  }

  protected override updated(): void {
    const bar = this.renderRoot.querySelector<HTMLElement>("button.bar");
    if (bar === this.#bar) return;
    this.#stopTap?.();
    this.#bar = bar;
    this.#stopTap = bar ? onTap(bar, () => this.#press()) : null;
  }

  #press(): void {
    pressOf(this, "stages-toggle")(new Event("mc-press"));
  }

  #details(m: ScenarioPickedModel) {
    return html`
      ${m.note ? html`<p class="note">${m.note}</p>` : nothing}
      <div class="stages">
        ${repeat(
          m.stages,
          (stage) => stage.name,
          (stage) =>
            html`<mc-scenario-stage
              .name=${stage.name}
              .stats=${stage.stats}
              ?current=${stage.current}
            ></mc-scenario-stage>`,
        )}
      </div>
      ${
        m.record
          ? html`<hr />
              <mc-scenario-record
                .label=${m.record.label}
                .tally=${m.record.tally}
                .subline=${m.record.subline}
                .tone=${m.record.tone}
              ></mc-scenario-record>`
          : nothing
      }
      ${repeat(
        m.sets,
        (set) => set.heading,
        (set) => html`<mc-scenario-set-block .heading=${set.heading} .value=${set.value}></mc-scenario-set-block>`,
      )}
    `;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    if (!m.picked) {
      return this.wide
        ? html`<div class="body">
            <h2 class="heading">${m.heading}</h2>
            <p class="note">${m.emptyText}</p>
          </div>`
        : html`<div class="bar empty">
            <span class="heading">${m.heading}</span><span class="hint">${m.emptyHint}</span>
          </div>`;
    }
    if (!m.collapsible) {
      return html`<div class="body">
        <h2 class="heading">${m.heading}</h2>
        ${this.#details(m)}
      </div>`;
    }
    return html`
      ${
        m.open
          ? html`<div class="sheet scroller">
              <mc-scenario-stats .cells=${m.stats}></mc-scenario-stats>
              ${this.#details(m)}
            </div>`
          : nothing
      }
      <button
        type="button"
        class="bar"
        data-stop="stages-toggle"
        aria-expanded=${m.open ? "true" : "false"}
        @click=${(event: MouseEvent) => {
          if (event.detail === 0) this.#press();
        }}
      >
        <span class="heading">${m.heading}</span>
        ${m.open ? nothing : html`<span class="summary">${m.summary}</span>`}
        <span class="arrow" aria-hidden="true">${m.open ? "▾" : "▴"}</span>
      </button>
    `;
  }
}
