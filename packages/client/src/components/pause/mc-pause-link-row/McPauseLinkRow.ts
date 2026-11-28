import { McPress } from "@mc/ui";
import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import type { TextRange } from "../../../view/settings-search-line.js";
import type { PauseLinkInput } from "../pause.types.js";
import { McPauseLinkRowStyles } from "./mc-pause-link-row.styles.js";

/** `text` with the matched ranges wrapped in `<mark>` (an underline and a tint: the match is never colour alone). */
export function marked(text: string, ranges: readonly TextRange[] | undefined) {
  if (!ranges || ranges.length === 0) return text;
  const parts = [];
  let at = 0;
  for (const { start, end } of ranges) {
    if (start < at || end > text.length || end <= start) continue;
    if (start > at) parts.push(text.slice(at, start));
    parts.push(html`<mark>${text.slice(start, end)}</mark>`);
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

/**
 * # Pause link row
 * A row that opens something: a Quick reference row (a title over its detail, with a chevron), a compact cell that shares
 * the Reference toggle's line (Music, Report, Controls: its title alone), or a search result (the title with what matched
 * marked, the place it was found, the detail, a chevron). A tap raises the row's action; a row with no target yet is dimmed
 * and does nothing.
 *
 * @element mc-pause-link-row
 * @prop row - The row (`PauseLinkInput`).
 * @attr variant - panel | compact | result (reflected from the row).
 * @fires mc-pressed - `PressDetail`, with the row's `PauseEventDetail` as its action.
 */
export class McPauseLinkRow extends McPress {
  static override styles = McPauseLinkRowStyles;

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    row: { attribute: false },
    variant: { type: String, reflect: true },
  };

  declare row: PauseLinkInput | null;
  declare variant: PauseLinkInput["variant"];

  constructor() {
    super();
    this.row = null;
    this.variant = "panel";
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has("row") || !this.row) return;
    this.stop = this.row.stop;
    this.action = this.row.action;
    this.disabled = this.row.disabled ?? false;
    this.variant = this.row.variant;
  }

  override render() {
    const row = this.row;
    if (!row) return nothing;
    if (row.variant === "compact") return html`<div class="box"><span class="title">${row.title}</span></div>`;
    const chevron = row.disabled ? nothing : html`<span class="chev" aria-hidden="true">›</span>`;
    if (row.variant === "result")
      return html`<div class="box">
        <div class="text">
          <div class="top">
            <span class="title">${marked(row.title, row.titleRanges)}</span>
            ${row.place ? html`<span class="place">${row.place}</span>` : nothing}
          </div>
          <span class="detail">${marked(row.detail, row.detailRanges)}</span>
        </div>
        ${chevron}
      </div>`;
    return html`<div class="box">
      <div class="text">
        <span class="title">${row.title}</span>
        <span class="detail">${row.detail}</span>
      </div>
      ${chevron}
    </div>`;
  }
}
