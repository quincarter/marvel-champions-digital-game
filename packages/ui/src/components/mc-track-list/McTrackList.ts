import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-track-row/mc-track-row.js";
import { McTrackListStyles } from "./mc-track-list.styles.js";
import type { TrackListModel } from "./mc-track-list.types.js";

/**
 * # Track list
 * The earned songs, one `mc-track-row` each, scrolling natively inside its box. The scroll position stays across a
 * redraw (the rows are updated in place, not remade), so a song change does not send the list back to the top.
 *
 * @element mc-track-list
 * @fires mc-activate - `detail.key`: a row was tapped (from `mc-track-row`).
 */
export class McTrackList extends LitElement {
  static override styles = [ThemeStyles, McTrackListStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: TrackListModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The scrolling element: the stick scrolls it, and a focused row is scrolled into view in it. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  /** The row for a key (`song:<id>`), or null. */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`mc-track-row[data-key="${key}"]`);
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    if (m.tracks.length === 0) return html`<p class="empty">${m.empty}</p>`;
    return html`<div class="scroller list">
      ${m.tracks.map((track) => html`<mc-track-row data-key=${track.key} .model=${track}></mc-track-row>`)}
    </div>`;
  }
}
