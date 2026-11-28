import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import "../../../components/extras/mc-extras-doors/mc-extras-doors.js";
import "../../../components/extras/mc-extras-tabs/mc-extras-tabs.js";
import "../../../components/extras/mc-extras-player/mc-extras-player.js";
import "../../../components/extras/mc-extras-shelf/mc-extras-shelf.js";
import "../../../components/extras/mc-extras-track/mc-extras-track.js";
import "../../../components/extras/mc-extras-tracks/mc-extras-tracks.js";
import type { McExtrasShelf } from "../../../components/extras/mc-extras-shelf/McExtrasShelf.js";
import type { McExtrasTracks } from "../../../components/extras/mc-extras-tracks/McExtrasTracks.js";
import type { PlayerProgress } from "../../../components/extras/mc-extras-player/mc-extras-player.types.js";
import { extrasEvent } from "../../../components/extras/shared/extras-events.types.js";
import { McExtrasPageStyles } from "./mc-extras-page.styles.js";
import type { ExtrasPageModel } from "./mc-extras-page.types.js";

/**
 * # Extras (page)
 * The whole Extras screen as one element that only composes: the ink top bar, the two doors and the tab rail (the doors
 * over the rail on a phone, beside it on a wide screen), then the tab's body: a shelf of picture tiles, or for Music the
 * player over the song rows. The scene mounts it in a `DomRegion`, sets `model` and listens for `mc-extras`.
 *
 * @element mc-extras-page
 * @prop model - `ExtrasPageModel`.
 * @prop progress - Reads how far into the song it is (the Music tab's bar).
 * @fires mc-extras - `ExtrasEventDetail`, from any section.
 */
export class McExtrasPage extends LitElement {
  static override styles = [ThemeStyles, McExtrasPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    progress: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: ExtrasPageModel | null;
  declare progress: (() => PlayerProgress | null) | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.progress = null;
    this.phone = false;
  }

  protected override willUpdate(): void {
    this.phone = this.model?.phone ?? false;
  }

  /** The body's scrolling element, the shelf grid or the song list: the stick and paging move it, a tab keeps its place. */
  get scroller(): HTMLElement | null {
    return (
      this.renderRoot.querySelector<McExtrasShelf>("mc-extras-shelf")?.scroller ??
      this.renderRoot.querySelector<McExtrasTracks>("mc-extras-tracks")?.scroller ??
      null
    );
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-top-bar
        .heading=${m.bar.title}
        .right=${m.bar.right}
        .backLabel=${m.bar.backLabel}
        .backGlyph=${m.bar.backGlyph}
        .titleDrop=${m.bar.titleDrop}
        .titleMaxRight=${m.bar.titleMaxRight}
        ?compact=${m.phone}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.dispatchEvent(extrasEvent({ type: "back" }));
        }}
      ></mc-top-bar>
      <div class="nav" ?data-stacked=${m.stackDoors}>
        <mc-extras-doors
          ?stacked=${m.stackDoors}
          .trophiesLabel=${m.doors.trophies}
          .creditsLabel=${m.doors.credits}
        ></mc-extras-doors>
        <mc-extras-tabs
          .tabs=${m.tabs.tabs}
          .selected=${m.tabs.selected}
          .size=${m.tabs.size}
          .hint=${m.tabs.hint}
        ></mc-extras-tabs>
      </div>
      <div class="body">
        ${m.player ? html`<mc-extras-player .model=${m.player} .progress=${this.progress}></mc-extras-player>` : nothing}
        ${
          m.shelf
            ? html`<mc-extras-shelf
                .shape=${m.shelf.shape}
                .tiles=${m.shelf.tiles}
                .empty=${m.shelf.empty}
              ></mc-extras-shelf>`
            : nothing
        }
        ${
          m.tracks
            ? html`<mc-extras-tracks .tracks=${m.tracks.tracks} .empty=${m.tracks.empty}></mc-extras-tracks>`
            : nothing
        }
      </div>`;
  }
}

if (!customElements.get("mc-extras-page")) {
  customElements.define("mc-extras-page", McExtrasPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-extras-page": McExtrasPage;
  }
}
