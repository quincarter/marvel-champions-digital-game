import { PRESS_EVENT, type PressDetail } from "@mc/ui";
import { html, LitElement, type PropertyDeclarations, type PropertyValues } from "lit";
import type { LobbyButtonModel, LobbyEvent } from "../room-lobby.types.js";
import { McLobbyButtonStyles } from "./mc-lobby-button.styles.js";
import { meaningOf } from "./mc-lobby-button.types.js";

/**
 * # Lobby button
 * The one button every part of the room lobby presses with. It takes the typed `command` a tap raises (as `mc-pressed`, which
 * the section's `FeatureRelay` turns into `mc-room-lobby`) and stamps `data-meaning` (the command, its target and its look), so
 * the scene can drop a press armed for another meaning when the same stop changes under a finger (Ask became Leave).
 *
 * A button that cannot be used stays in place, dimmed. With a `reason` a press on it raises `{ type: "blocked", reason }` (the
 * footer says why); without one it does nothing. `data-stop` is on the inner `mc-button`, so Enter on the stop presses it.
 *
 * @element mc-lobby-button
 * @prop command - The event a press raises (`LobbyEvent`).
 * @prop model - Sets every property from a `LobbyButtonModel`.
 * @attr label - The words, already translated.
 * @attr kind - primary | secondary | quiet | onInk.
 * @attr selected - On / chosen.
 * @attr enabled - False dims it (the default is true).
 * @attr reason - Why it is off, when a press should say so.
 * @attr stop - The `data-stop` key.
 * @attr aria - The accessible name when the label is a symbol.
 * @attr display - A Bangers label.
 * @cssprop --mc-lobby-button-height - The button's height (44px).
 * @cssprop --mc-lobby-button-size - The label's size (12px, 22px for `display`).
 * @fires mc-pressed - `{ action: LobbyEvent, hold: false }` for a tap on an enabled button, or the `blocked` event.
 */
export class McLobbyButton extends LitElement {
  static override styles = [McLobbyButtonStyles];

  static override properties: PropertyDeclarations = {
    command: { attribute: false },
    label: { type: String },
    kind: { type: String, reflect: true },
    selected: { type: Boolean, reflect: true },
    enabled: { type: Boolean, reflect: true },
    reason: { type: String },
    stop: { type: String },
    aria: { type: String },
    display: { type: Boolean, reflect: true },
  };

  declare command: LobbyEvent | null;
  declare label: string;
  declare kind: LobbyButtonModel["kind"];
  declare selected: boolean;
  declare enabled: boolean;
  declare reason: string;
  declare stop: string;
  declare aria: string;
  declare display: boolean;

  constructor() {
    super();
    this.command = null;
    this.label = "";
    this.kind = "secondary";
    this.selected = false;
    this.enabled = true;
    this.reason = "";
    this.stop = "";
    this.aria = "";
    this.display = false;
  }

  set model(model: LobbyButtonModel) {
    this.command = model.command;
    this.label = model.label;
    this.kind = model.kind;
    this.selected = model.selected === true;
    this.enabled = model.enabled !== false;
    this.reason = model.reason ?? "";
    this.stop = model.stop;
    this.aria = model.aria ?? "";
    this.display = model.display === true;
  }

  protected override willUpdate(_changed: PropertyValues): void {
    this.setAttribute("data-meaning", meaningOf(this.command, this.kind, this.label, this.enabled, this.reason));
    this.setAttribute("data-meaning-stop", this.stop);
  }

  #press = (event: Event): void => {
    event.stopPropagation();
    const action: LobbyEvent | null = this.enabled
      ? this.command
      : this.reason !== ""
        ? { type: "blocked", reason: this.reason }
        : null;
    if (action === null) return;
    this.dispatchEvent(
      new CustomEvent<PressDetail>(PRESS_EVENT, { detail: { action, hold: false }, bubbles: true, composed: true }),
    );
  };

  override render() {
    return html`<mc-button
      data-stop=${this.stop}
      data-key=${this.stop}
      aria-label=${this.aria || this.label}
      .kind=${this.kind}
      .label=${this.label}
      .reason=${this.reason}
      .display=${this.display}
      ?selected=${this.selected}
      ?disabled=${!this.enabled}
      ?pressable=${!this.enabled && this.reason !== ""}
      @mc-press=${this.#press}
    ></mc-button>`;
  }
}
