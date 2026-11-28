import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { hintGlyphOf } from "../../../dom/hint-glyph.js";
import { trophyRoomEvent } from "../../../components/trophy-room/shared/trophy-room-events.types.js";
import type { McTrophyList } from "../../../components/trophy-room/mc-trophy-list/McTrophyList.js";
import "../../../components/trophy-room/mc-trophy-filters/mc-trophy-filters.js";
import "../../../components/trophy-room/mc-trophy-list/mc-trophy-list.js";
import "../../../components/trophy-room/mc-trophy-rank/mc-trophy-rank.js";
import "../../../components/trophy-room/mc-trophy-sheet/mc-trophy-sheet.js";
import { McTrophyRoomPageStyles } from "./mc-trophy-room-page.styles.js";
import type { TrophyRoomPageModel } from "./mc-trophy-room-page.types.js";

/**
 * # Trophy Room (page)
 * The whole screen as one element that only composes sections and holds no state: the ink top bar (Back, the title and
 * "Your stats" in its end slot), the rank header, the filters bar and the list of families and achievements, and, over
 * everything while one is open, the achievement's sheet. The scene mounts it in a `DomRegion`, sets `model` and listens
 * for `mc-trophy-room` (`TrophyRoomEventDetail`).
 *
 * Needs `@mc/ui` defined (`mc-top-bar`, `mc-hint-button`).
 *
 * @element mc-trophy-room-page
 * @prop model - `TrophyRoomPageModel`.
 * @attr phone - Set from the model: the phone's bar, gutters and cards.
 * @fires mc-trophy-room - Any section's `TrophyRoomEventDetail`.
 */
export class McTrophyRoomPage extends LitElement {
  static override styles = [ThemeStyles, McTrophyRoomPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: TrophyRoomPageModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
  }

  protected override willUpdate(): void {
    this.phone = this.model?.phone ?? false;
  }

  /** The list's scrolling box. */
  get listScroller(): HTMLElement | null {
    return this.renderRoot.querySelector<McTrophyList>("mc-trophy-list")?.scroller ?? null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`
      <mc-top-bar
        class="bar"
        .heading=${m.bar.title}
        .backLabel=${m.bar.backLabel}
        .backGlyph=${hintGlyphOf(m.bar.backGlyph)}
        ?compact=${m.phone}
        @mc-press=${() => this.dispatchEvent(trophyRoomEvent({ type: "back" }))}
      >
        <mc-hint-button
          slot="end"
          class="stats"
          kind="onInk"
          display
          data-stop="stats"
          data-key="stats"
          .label=${m.stats.label}
          .glyph=${hintGlyphOf(m.stats.glyph)}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.dispatchEvent(trophyRoomEvent({ type: "stats" }));
          }}
        ></mc-hint-button>
      </mc-top-bar>
      <div class="body">
        <mc-trophy-rank ?phone=${m.phone} .model=${m.header}></mc-trophy-rank>
        <mc-trophy-filters .model=${m.filters}></mc-trophy-filters>
        <mc-trophy-list class="list" ?phone=${m.phone} .model=${m.list}></mc-trophy-list>
      </div>
      ${m.sheet ? html`<mc-trophy-sheet .model=${m.sheet}></mc-trophy-sheet>` : nothing}
    `;
  }
}
