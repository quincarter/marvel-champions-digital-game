import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles, type PressEvent } from "@mc/ui";
import { MusicElement } from "../shared/MusicElement.js";
import { McTrackListStyles } from "./mc-track-list.styles.js";
import type { McTrackListProps, TrackListItem } from "./mc-track-list.types.js";

/**
 * # Track list
 * The earned songs, one `mc-track-row` each, scrolling natively inside its box. The scroll position stays across a
 * redraw (the rows are updated in place, not remade), so a song change does not send the list back to the top.
 *
 * @element mc-track-list
 * @attr empty - What to say in place of the list while there are no songs.
 * @fires mc-music - `{ type: "press", key: "song:<id>" }` when a row is tapped.
 */
export class McTrackList extends MusicElement implements McTrackListProps {
  static override styles = [ThemeStyles, McTrackListStyles];

  static override properties: PropertyDeclarations = {
    tracks: { attribute: false },
    empty: { type: String },
  };

  declare tracks: readonly TrackListItem[];
  declare empty: string;

  constructor() {
    super();
    this.tracks = [];
    this.empty = "";
  }

  /** The scrolling element: the stick scrolls it, and a focused row is scrolled into view in it. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  /** A row's press is the list's `mc-music` press for that song; the row's own event goes no further. */
  #onPressed = (event: PressEvent): void => {
    event.stopPropagation();
    const { action } = event.detail;
    if (typeof action === "string") this.press(action);
  };

  override render() {
    if (this.tracks.length === 0) return html`<p class="empty">${this.empty}</p>`;
    return html`<div class="scroller list" @mc-pressed=${this.#onPressed}>
      ${this.tracks.map(
        (track) =>
          html`<mc-track-row
            .stop=${track.key}
            .action=${track.key}
            .heading=${track.title}
            .where=${track.where}
            ?playing=${track.playing}
          ></mc-track-row>`,
      )}
    </div>`;
  }
}
