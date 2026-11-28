import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations, type TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import { LOBBY_EVENT, type LobbyEvent } from "../room-lobby.types.js";
import { LOBBY_STOP } from "../room-lobby.stops.js";
import "../mc-lobby-button/mc-lobby-button.js";
import { McLobbySettingsStyles } from "./mc-lobby-settings.styles.js";
import { showsItem, type LobbySettingsItem, type LobbySettingsModel } from "./mc-lobby-settings.types.js";

/**
 * # Lobby settings
 * The room's settings in one natively scrolling column (`list:settings`): groups under a rule-headed title, each a run of
 * rows. A toggle is the host's ON/OFF row (a guest reads the state, never a dead button); a choice is the host's press card
 * with its detail under it (everyone else reads only the chosen one); the mode is a small box of pictures with the host's
 * Change; a mod line says Have / Missing with the Mod Store when missing; and plain words. Every press is a typed command
 * the model carries, raised as `mc-room-lobby` (`setting`, `mod-store`) through the section's `FeatureRelay`. Words come
 * from the model; nothing here knows the room.
 *
 * @element mc-lobby-settings
 * @prop model - The settings (`LobbySettingsModel`).
 * @fires mc-room-lobby - `LobbyEvent`.
 */
export class McLobbySettings extends LitElement {
  static override styles = [ThemeStyles, McLobbySettingsStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: LobbySettingsModel | null;

  constructor() {
    super();
    new FeatureRelay<LobbyEvent>(this, LOBBY_EVENT);
    this.model = null;
  }

  /** The scrolling column (`list:settings`): the pad's stick scrolls it and the scene keeps its position. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".list");
  }

  #item(item: LobbySettingsItem): TemplateResult | typeof nothing {
    if (!showsItem(item)) return nothing;
    switch (item.kind) {
      case "toggle":
        return html`<mc-switch-row
          onpaper
          .stop=${item.stop}
          title-text=${item.title}
          detail=${item.detail}
          state=${item.on ? item.onLabel : item.offLabel}
          ?on=${item.on}
          ?readonly=${!item.pressable}
          .action=${item.command}
        ></mc-switch-row>`;
      case "choice":
        return item.pressable
          ? html`<mc-press-card .stop=${item.stop} ?selected=${item.selected} .action=${item.command}>
              <div class="pick-title">${item.title}</div>
              <div class="pick-detail">${item.detail}</div>
            </mc-press-card>`
          : html`<div class="plain-choice">
              <div class="pick-title">${item.title}</div>
              <div class="pick-detail">${item.detail}</div>
            </div>`;
      case "mode":
        return html`<div class="mode">
          <div class="pictures">
            ${item.pictures.map((picture) => html`<mc-card-art .picture=${picture} .frame=${1}></mc-card-art>`)}
          </div>
          <div class="mode-text">
            <div class="mode-title">${item.title}</div>
            <div class="mode-tagline">${item.tagline}</div>
          </div>
          ${item.change ? html`<mc-lobby-button .model=${item.change}></mc-lobby-button>` : nothing}
        </div>`;
      case "mod":
        return html`<div class="mod">
          <span class="mod-name">${item.name}</span>
          <span class="mod-state">${item.state}</span>
          ${item.store ? html`<mc-lobby-button .model=${item.store}></mc-lobby-button>` : nothing}
        </div>`;
      case "text":
        return html`<p class="text" ?data-bold=${item.bold === true}>${item.text}</p>`;
    }
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`${m.title ? html`<h2 class="title">${m.title}</h2>` : nothing}
      <div class="list scroller" tabindex="-1" data-key=${LOBBY_STOP.list("settings")}>
        ${
          m.loading !== null
            ? html`<p class="loading">${m.loading}</p>`
            : html`${m.readOnly ? html`<p class="note">${m.readOnly}</p>` : nothing}
              ${repeat(
                m.groups,
                (group) => group.id,
                (group) =>
                  html`<section class="group">
                    ${group.heading ? html`<mc-section-heading .label=${group.heading}></mc-section-heading>` : nothing}
                    ${group.items.map((item) => this.#item(item))}
                  </section>`,
              )}`
        }
      </div>`;
  }
}
