import { ThemeStyles } from "@mc/ui";
import { html, LitElement, type PropertyDeclarations } from "lit";
import { McLobbyFrameStyles } from "./mc-lobby-frame.styles.js";

/**
 * # Lobby frame
 * A lobby panel's parchment box with its ink border and an optional capitalised heading; its content fills the rest and
 * scrolls inside it (the panels bring their own native scroll region). `floating` is the opaque chat panel: a comic-panel
 * drop shadow and a heavier border, so nothing under it shows through.
 *
 * @element mc-lobby-frame
 * @attr heading - The panel's title, already translated; none when empty (a tabbed layout: the tab says it).
 * @attr floating - The floating chat's heavier border and shadow.
 * @slot - The panel's content.
 * @slot end - What sits at the heading's right end (Close, Pop out).
 */
export class McLobbyFrame extends LitElement {
  static override styles = [ThemeStyles, McLobbyFrameStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    floating: { type: Boolean, reflect: true },
  };

  declare heading: string;
  declare floating: boolean;

  constructor() {
    super();
    this.heading = "";
    this.floating = false;
  }

  override render() {
    const head = this.heading !== "";
    return html`${
        head
          ? html`<div class="head">
              <h2>${this.heading}</h2>
              <slot name="end"></slot>
            </div>`
          : html`<slot name="end"></slot>`
      }
      <div class="body"><slot></slot></div>`;
  }
}
