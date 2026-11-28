import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles, type McListRowModel } from "@mc/ui";
import { ExtrasElement } from "../shared/ExtrasElement.js";
import { ExtrasRelay } from "../shared/extras-relay.js";
import "../mc-extras-track/mc-extras-track.js";
import { McExtrasTracksStyles } from "./mc-extras-tracks.styles.js";
import type { ExtrasTrackItem, McExtrasTracksProps } from "./mc-extras-tracks.types.js";

/**
 * # Extras tracks
 * The Music tab's songs, one row each, scrolling natively. Every song is a focus stop (`tile:<id>`), earned or not (a
 * locked row opens nothing but says what opens it).
 *
 * @element mc-extras-tracks
 * @fires mc-extras - `{ type: "tile", id }`.
 */
export class McExtrasTracks extends ExtrasElement implements McExtrasTracksProps {
  static override styles = [ThemeStyles, McExtrasTracksStyles];

  static override properties: PropertyDeclarations = {
    tracks: { attribute: false },
    empty: { type: String },
  };

  declare tracks: readonly ExtrasTrackItem[];
  declare empty: string;

  constructor() {
    super();
    this.tracks = [];
    this.empty = "";
    new ExtrasRelay(this);
  }

  /** The scrolling element: the stick moves it, and a focused row scrolls into view in it. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  override render() {
    if (this.tracks.length === 0) {
      return this.empty ? html`<mc-empty-state message=${this.empty}></mc-empty-state>` : nothing;
    }
    return html`<div class="scroller">
      ${repeat(
        this.tracks,
        (track) => track.id,
        (track) =>
          html`<mc-extras-track
            data-stop=${`tile:${track.id}`}
            .model=${track.row as McListRowModel}
            .action=${{ type: "tile", id: track.id }}
          ></mc-extras-track>`,
      )}
    </div>`;
  }
}
