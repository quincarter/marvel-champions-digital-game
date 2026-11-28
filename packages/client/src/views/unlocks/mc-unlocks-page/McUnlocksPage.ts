import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import "../../../components/unlocks/mc-unlocks-guide/mc-unlocks-guide.js";
import "../../../components/unlocks/mc-unlocks-list/mc-unlocks-list.js";
import "../../../components/unlocks/mc-unlocks-points/mc-unlocks-points.js";
import "../../../components/unlocks/mc-unlocks-switches/mc-unlocks-switches.js";
import type { McUnlocksGuide } from "../../../components/unlocks/mc-unlocks-guide/McUnlocksGuide.js";
import type { McUnlocksList } from "../../../components/unlocks/mc-unlocks-list/McUnlocksList.js";
import {
  UNLOCKS_EVENT,
  type UnlocksEventDetail,
  type UnlocksPageModel,
} from "../../../components/unlocks/unlocks.types.js";
import { McUnlocksPageStyles } from "./mc-unlocks-page.styles.js";

/**
 * # Unlocks (page)
 * Settings ▸ Unlocks as one element that composes sections and holds no state: the ink `mc-top-bar` (Back, the title, and
 * the door to "How it works" in its end slot), then either the champion points, the two switches and the list, or the
 * guide text. The scene mounts it, sets `model` and hears `mc-unlocks`.
 *
 * Needs `@mc/ui` defined (`mc-top-bar`, `mc-switch-row`, `mc-hint-button`).
 *
 * @element mc-unlocks-page
 * @prop model - `UnlocksPageModel`.
 * @attr phone - Set from the model.
 * @fires mc-unlocks - Any section's `UnlocksEventDetail`.
 */
export class McUnlocksPage extends LitElement {
  static override styles = [ThemeStyles, McUnlocksPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: UnlocksPageModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
    new FeatureRelay<UnlocksEventDetail>(this, UNLOCKS_EVENT);
  }

  protected override willUpdate(): void {
    this.phone = this.model?.phone ?? false;
  }

  /** The scrolling element on show: the list's, or the guide's. */
  get scroller(): HTMLElement | null {
    return this.#guide?.scroller ?? this.#list?.scroller ?? null;
  }

  /** Scrolls a guide section to the top (a Settings search result). */
  showGuideSection(index: number): void {
    this.#guide?.showSection(index);
  }

  /** Brings a row into view. */
  showRow(id: string): void {
    this.#list?.rowElement(id)?.scrollIntoView({ block: "nearest" });
  }

  get #list(): McUnlocksList | null {
    return this.renderRoot.querySelector("mc-unlocks-list");
  }

  get #guide(): McUnlocksGuide | null {
    return this.renderRoot.querySelector("mc-unlocks-guide");
  }

  #say(detail: UnlocksEventDetail): void {
    this.dispatchEvent(new CustomEvent<UnlocksEventDetail>(UNLOCKS_EVENT, { detail, bubbles: true, composed: true }));
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-top-bar
        class="bar"
        .heading=${m.bar.title}
        .backLabel=${m.bar.backLabel}
        .backGlyph=${m.bar.backGlyph}
        ?compact=${m.phone}
        @mc-press=${() => this.#say({ type: "back" })}
      >
        <mc-hint-button
          slot="end"
          kind="onInk"
          data-stop="guide"
          hug
          .label=${m.door.label}
          .glyph=${m.door.glyph}
          @mc-press=${(event: Event) => {
            // The door sits in the bar's slot: its press is not the bar's Back.
            event.stopPropagation();
            this.#say({ type: "guide" });
          }}
        ></mc-hint-button>
      </mc-top-bar>
      <div class="body">
        <div class="content">
          ${
            m.guide
              ? html`<mc-unlocks-guide .sections=${m.sections}></mc-unlocks-guide>`
              : html`<mc-unlocks-points .heading=${m.points.title} .detail=${m.points.detail}></mc-unlocks-points>
                  <mc-unlocks-switches .all=${m.all} .printAndPlay=${m.printAndPlay}></mc-unlocks-switches>
                  <mc-unlocks-list .rows=${m.rows}></mc-unlocks-list>`
          }
        </div>
      </div>`;
  }
}
