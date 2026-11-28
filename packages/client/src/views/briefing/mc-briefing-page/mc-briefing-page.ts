import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { ThemeStyles } from "@mc/ui";
import "../../../components/briefing/mc-briefing-action-bar/mc-briefing-action-bar.js";
import "../../../components/briefing/mc-briefing-call/mc-briefing-call.js";
import "../../../components/briefing/mc-briefing-decks/mc-briefing-decks.js";
import "../../../components/briefing/mc-briefing-easier-start/mc-briefing-easier-start.js";
import "../../../components/briefing/mc-briefing-handled/mc-briefing-handled.js";
import "../../../components/briefing/mc-briefing-mission/mc-briefing-mission.js";
import "../../../components/briefing/mc-briefing-modes/mc-briefing-modes.js";
import "../../../components/briefing/mc-briefing-pool/mc-briefing-pool.js";
import "../../../components/briefing/mc-briefing-scheme/mc-briefing-scheme.js";
import "../../../components/briefing/mc-briefing-seat-picker/mc-briefing-seat-picker.js";
import "../../../components/briefing/mc-briefing-shield/mc-briefing-shield.js";
import "../../../components/briefing/mc-briefing-speaker/mc-briefing-speaker.js";
import "../../../components/briefing/mc-briefing-watch-strip/mc-briefing-watch-strip.js";
import { BriefingRelay } from "../../../components/briefing/shared/BriefingRelay.js";
import { raiseBriefing } from "../../../components/briefing/briefing.types.js";
import type { McBriefingCall } from "../../../components/briefing/mc-briefing-call/McBriefingCall.js";
import { BriefingResponsive } from "../responsive.styles.js";
import { McBriefingPageStyles } from "./mc-briefing-page.styles.js";
import type { BriefingPageModel } from "./mc-briefing-page.types.js";

/**
 * # Campaign Briefing (page)
 * The whole screen as one element that only composes sections: the box art faded across the page, the ink top bar, the speaker, "From
 * the pool" or "Handled for you", the issue sections (side scheme, mission, case file, easier start), "Your call", the Decks panel
 * on the coloured pane with its paper panel, the modes, the phone strip, the ink action bar and the "which deck?" chooser. The
 * scene mounts it in a `DomRegion`, sets `model`, and listens for `mc-briefing` (a `BriefingDetail`); every control is a `data-stop`
 * the focus route walks. Layout is CSS only, native scrolling.
 *
 * Phone: one scrolling page (the story, then the coloured pane across its foot). Wide: the left column (scrolling on its own) and
 * the right pane. While the call scrolls itself (role-building) the page and the left column do not scroll.
 *
 * @element mc-briefing-page
 * @prop model - `BriefingPageModel`.
 * @attr phone - Set from the model: the phone arrangement.
 * @fires mc-briefing - `BriefingDetail`, from any section.
 */
export class McBriefingPage extends LitElement {
  static override styles = [ThemeStyles, BriefingResponsive, McBriefingPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: BriefingPageModel | null;
  declare phone: boolean;
  #callKey: string | null = null;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
    new BriefingRelay(this);
  }

  protected override willUpdate(): void {
    this.phone = this.model?.phone ?? false;
  }

  protected override updated(changed: PropertyValues): void {
    // A new question reads from the top.
    const key = this.model?.call?.key ?? null;
    if (changed.has("model") && key !== this.#callKey) {
      this.#callKey = key;
      for (const scroller of this.scrollers) scroller.scrollTop = 0;
    }
  }

  /** The scrolling parts the stick and the page keys move, the one a call keeps for itself last. */
  get scrollers(): HTMLElement[] {
    const root = this.renderRoot;
    return [
      root.querySelector<HTMLElement>(".page:not([data-own])"),
      root.querySelector<HTMLElement>(".left:not([data-own])"),
      this.#call?.renderRoot
        .querySelector<HTMLElement>("mc-briefing-role-build")
        ?.shadowRoot?.querySelector<HTMLElement>(".list, .confirm-scroll") ?? null,
      root.querySelector<HTMLElement>(".right .panel"),
    ].filter((one): one is HTMLElement => one !== null);
  }

  /** The scroller the stick and the page keys move now: the page, else the left column, else the call list, else the right pane. */
  get scroller(): HTMLElement | null {
    return this.scrollers[0] ?? null;
  }

  get #call(): McBriefingCall | null {
    return this.renderRoot.querySelector<McBriefingCall>("mc-briefing-call");
  }

  /** A card chosen in the Inspect sheet ("Take this card"): role-building opens its confirm step. */
  takeFromInspect(optionId: string): void {
    this.#call?.takeFromInspect(optionId);
  }

  #issueSections(m: BriefingPageModel) {
    const { scheme, mission, shield, easier } = m.sections;
    return html`${scheme ? html`<mc-briefing-scheme .model=${scheme}></mc-briefing-scheme>` : nothing}
    ${mission ? html`<mc-briefing-mission .mission=${mission}></mc-briefing-mission>` : nothing}
    ${shield ? html`<mc-briefing-shield .model=${shield}></mc-briefing-shield>` : nothing}
    ${easier ? html`<mc-briefing-easier-start ?on=${easier.on}></mc-briefing-easier-start>` : nothing}`;
  }

  #modes(m: BriefingPageModel) {
    return m.sections.modes.length > 0
      ? html`<mc-briefing-modes .rows=${m.sections.modes}></mc-briefing-modes>`
      : nothing;
  }

  /** The speaker, then the pool or the handled rows, then the issue sections and the call: the column both layouts share. */
  #story(m: BriefingPageModel, withMain: boolean) {
    const { plan } = m;
    return html`<div class="story">
      ${
        plan.seatCall
          ? nothing
          : html`${m.speaker ? html`<mc-briefing-speaker ?phone=${m.phone} .model=${m.speaker}></mc-briefing-speaker>` : nothing}
            ${
              plan.hasPool && m.pool
                ? html`<mc-briefing-pool ?phone=${m.phone} .model=${m.pool}></mc-briefing-pool>`
                : html`<mc-briefing-handled .model=${m.handled}></mc-briefing-handled>`
            }
            ${withMain ? html`${this.#issueSections(m)}${m.phone ? this.#modes(m) : nothing}` : nothing}`
      }
      ${m.call ? html`<mc-briefing-call .call=${m.call}></mc-briefing-call>` : m.composing ? html`<p class="composing">${m.composing}</p>` : nothing}
    </div>`;
  }

  /** The Decks panel (or "Handled for you" with a pool). */
  #panelBody(m: BriefingPageModel) {
    return m.plan.hasPool && !m.plan.seatCall
      ? html`<mc-briefing-handled .model=${m.handled}></mc-briefing-handled>`
      : html`<mc-briefing-decks .model=${m.decks}></mc-briefing-decks>`;
  }

  #phone(m: BriefingPageModel) {
    const own = m.plan.callOwnsScroll;
    return html`<div class="page" ?data-own=${own}>
      ${this.#story(m, true)}
      ${
        own
          ? nothing
          : html`<div class="pane">
              ${m.art.picture ? html`<mc-picture-tile class="pane-art" .picture=${m.art.picture} .frame=${0}></mc-picture-tile>` : nothing}
              <div class="panel">${this.#panelBody(m)}</div>
            </div>`
      }
    </div>`;
  }

  #wide(m: BriefingPageModel) {
    const { plan } = m;
    const aside = plan.seatCall ? nothing : html`${plan.hasPool ? nothing : this.#issueSections(m)}${this.#modes(m)}`;
    return html`<div class="columns">
      <div class="left" ?data-own=${plan.callOwnsScroll}>${this.#story(m, plan.hasPool)}</div>
      <div class="right pane">
        ${m.art.picture ? html`<mc-picture-tile class="pane-art" .picture=${m.art.picture} .frame=${0}></mc-picture-tile>` : nothing}
        <div class="panel">${this.#panelBody(m)}${aside}</div>
      </div>
    </div>`;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`${m.art.picture ? html`<mc-picture-tile class="page-art" .picture=${m.art.picture} .frame=${0}></mc-picture-tile>` : nothing}
      <mc-top-bar
        .heading=${m.topBar.title}
        .right=${m.topBar.right}
        .backLabel=${m.topBar.backLabel}
        .backGlyph=${m.topBar.backGlyph}
        .titleDrop=${m.topBar.titleDrop}
        .titleMaxRight=${m.topBar.titleMaxRight}
        ?compact=${m.phone}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          raiseBriefing(this, { type: "back" });
        }}
      ></mc-top-bar>
      <div class="body" style=${`--pane-ground:${m.art.paneGround}`}>${m.phone ? this.#phone(m) : this.#wide(m)}</div>
      ${m.phone && m.strip ? html`<mc-briefing-watch-strip .reason=${m.strip.reason} .watch=${m.strip.watch}></mc-briefing-watch-strip>` : nothing}
      ${m.error ? html`<p class="error">${m.error}</p>` : nothing}
      <mc-briefing-action-bar ?phone=${m.phone} .model=${m.actionBar}></mc-briefing-action-bar>
      ${m.seatPicker ? html`<mc-briefing-seat-picker .model=${m.seatPicker}></mc-briefing-seat-picker>` : nothing}`;
  }
}

if (!customElements.get("mc-briefing-page")) {
  customElements.define("mc-briefing-page", McBriefingPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-page": McBriefingPage;
  }
}
