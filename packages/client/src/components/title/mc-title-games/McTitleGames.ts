import { html, LitElement, nothing, svg, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { SvgOp } from "@mc/ui";
import type { TitleGameConfirm, TitleGameRow, TitleGamesInput } from "./mc-title-games.types.js";
import { McTitleGamesStyles } from "./mc-title-games.styles.js";

function drawOp(op: SvgOp) {
  const fill = "fill" in op && op.fill !== undefined ? op.fill : "none";
  const stroke = "stroke" in op && op.stroke !== undefined ? op.stroke : "none";
  const sw = "sw" in op ? (op.sw ?? 1) : 1;
  switch (op.k) {
    case "rect":
      return svg`<rect x=${op.x} y=${op.y} width=${op.w} height=${op.h} fill=${fill} stroke=${stroke} stroke-width=${sw}></rect>`;
    case "circle":
      return svg`<circle cx=${op.cx} cy=${op.cy} r=${op.r} fill=${fill} stroke=${stroke} stroke-width=${sw}></circle>`;
    case "line":
      return svg`<line x1=${op.x1} y1=${op.y1} x2=${op.x2} y2=${op.y2} fill=${fill} stroke=${stroke} stroke-width=${sw}></line>`;
    case "path":
      return svg`<path d=${op.d} fill=${fill} stroke=${stroke} stroke-width=${sw}></path>`;
    default:
      return nothing;
  }
}

/**
 * # Title games panel
 * The In-progress games panel of a wide Title: a heading, then every game as a row with Resume, Watch and Remove, or the
 * "Remove this game?" question in its place. It owns no state: the scene says which game is being asked about, and
 * every control is a focus stop (`game:<id>`, `game-watch:<id>`, `game-remove:<id>`, `remove-keep`, `remove-confirm`).
 *
 * @element mc-title-games
 * @prop input - What it shows (`TitleGamesInput`).
 * @fires mc-press - From a button, keyed by its `data-stop`.
 * @fires mc-pressed - A tap on a row, its `action` the `game:<id>` key.
 */
export class McTitleGames extends LitElement {
  static override styles = McTitleGamesStyles;

  static override properties: PropertyDeclarations = { input: { attribute: false } };

  declare input: TitleGamesInput | null;

  constructor() {
    super();
    this.input = null;
  }

  #row(row: TitleGameRow, enabled: boolean) {
    const blocked = row.needsUpdate !== null;
    return html`<div class="row">
      <mc-hit-area .action=${`game:${row.id}`} ?disabled=${blocked || !enabled}></mc-hit-area>
      ${
        row.icon
          ? html`<div class="icon" role="img" aria-label=${row.icon.label}>
              <svg viewBox=${`0 0 ${row.icon.grid} ${row.icon.grid}`} aria-hidden="true">
                ${row.icon.ops.map(drawOp)}
              </svg>
            </div>`
          : html`<div class="icon"></div>`
      }
      <div>
        <div class="name">${row.title}</div>
        <div class="detail">${row.detail}</div>
      </div>
      <div class="buttons">
        ${
          blocked
            ? html`<div class="needs" data-stop=${`game:${row.id}`}>${row.needsUpdate}</div>`
            : html`<mc-button
                class="resume"
                plain
                kind="primary"
                data-stop=${`game:${row.id}`}
                .label=${row.resume}
                ?disabled=${!enabled}
              ></mc-button>`
        }
        ${
          blocked
            ? nothing
            : html`<mc-button
                plain
                kind="onInk"
                data-stop=${`game-watch:${row.id}`}
                .label=${row.watch}
                ?disabled=${!enabled}
              ></mc-button>`
        }
        <mc-button
          plain
          kind="onInk"
          data-stop=${`game-remove:${row.id}`}
          .label=${row.remove}
          ?disabled=${!enabled}
        ></mc-button>
      </div>
    </div>`;
  }

  #ask(confirm: TitleGameConfirm, enabled: boolean) {
    return html`<div class="ask">
      <div class="name">${confirm.title}</div>
      <div class="message">${confirm.message}</div>
      ${confirm.error ? html`<div class="error">${confirm.error}</div>` : nothing}
      <div class="answers">
        <div class="keep">
          <mc-button
            plain
            kind="onInk"
            data-stop="remove-keep"
            .label=${confirm.keep}
            ?disabled=${!enabled}
          ></mc-button>
          ${confirm.keepGlyph ? html`<mc-glyph-hint .glyph=${confirm.keepGlyph}></mc-glyph-hint>` : nothing}
        </div>
        <mc-button
          class="remove"
          plain
          kind="primary"
          data-stop="remove-confirm"
          .label=${confirm.remove}
          ?disabled=${!enabled}
        ></mc-button>
      </div>
    </div>`;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<div class="heading">
        <span class="text">${input.heading}</span>
        ${input.tag ? html`<span class="tag">${input.tag}</span>` : nothing}
        <span class="hint">${input.hint ? html`<mc-glyph-hint .glyph=${input.hint}></mc-glyph-hint>` : nothing}</span>
      </div>
      ${
        input.confirming
          ? this.#ask(input.confirming, input.enabled)
          : html`<div class="list">
              ${repeat(
                input.rows,
                (row) => row.id,
                (row) => this.#row(row, input.enabled),
              )}
            </div>`
      }`;
  }
}
