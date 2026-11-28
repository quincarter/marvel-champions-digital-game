import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles, glyphLabelShift, type ControlGlyph } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { McModNoticeStyles } from "./mc-mod-notice.styles.js";
import type { McModNoticeProps, ModNoticeLineModel } from "./mc-mod-notice.types.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";
import type { ModNoticeAnswer } from "../../../view/mod-notice.js";

/**
 * # Mod notice (the first-run dialog)
 * The heads-up about mods, over a dimmed store: Deadpool and Spider-Man, a round portrait each with a speech bubble, take
 * turns warning that mods carry risk. Two buttons answer it: "Report a problem" and "Got it". The backdrop takes every
 * press so nothing under it is touched; the scene remembers the answer, and "Report a problem" then opens the report
 * tool. A portrait that has not loaded says the speaker's initial.
 *
 * @element mc-mod-notice
 * @fires mc-mod-store - `{ type: "notice", answer }` with `close` or `report`.
 */
export class McModNotice extends ModStoreElement implements McModNoticeProps {
  static override styles = [ThemeStyles, McModNoticeStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    lines: { attribute: false },
    buttons: { attribute: false },
    closeGlyph: { attribute: false },
  };

  declare size: ModStoreSize;
  declare lines: readonly ModNoticeLineModel[];
  declare buttons: readonly { readonly id: ModNoticeAnswer; readonly label: string }[];
  /** The Activate glyph hung on "Got it" while a keyboard or pad is in use. */
  declare closeGlyph: ControlGlyph | undefined;

  constructor() {
    super();
    this.size = "wide";
    this.lines = [];
    this.buttons = [];
    this.closeGlyph = undefined;
  }

  protected override updated(): void {
    this.emitRendered();
  }

  #speaker(line: ModNoticeLineModel, index: number) {
    // On a wide screen the second speaker is mirrored: portrait at the right, the bubble's tail pointing right.
    const side = this.size === "wide" && index === 1 ? "right" : "left";
    return html`<div class="speaker ${side}">
      <div class="portrait" aria-hidden="true">
        <mc-picture-tile
          letter
          .frame=${0}
          ground="ink"
          .picture=${{
            src: line.portrait.src,
            missing: line.speaker.charAt(0),
            ...(line.portrait.focus ? { cover: line.portrait.focus } : {}),
          }}
        ></mc-picture-tile>
      </div>
      <div class="bubble">
        <div class="who">${line.speaker}</div>
        <div class="said">${line.text}</div>
      </div>
    </div>`;
  }

  override render() {
    if (this.lines.length === 0) return nothing;
    return html`<div class="backdrop">
      <div class="stack" role="dialog" aria-modal="true">
        ${this.lines.map((line, index) => this.#speaker(line, index))}
        <div class="buttons">
          ${this.buttons.map((button) => {
            const close = button.id === "close";
            return html`<div
              class="ctl"
              style=${styleMap({ "--mc-label-shift": `${glyphLabelShift(close ? this.closeGlyph : undefined)}px` })}
            >
              <mc-button
                kind=${close ? "primary" : "secondary"}
                data-stop=${button.id}
                data-key=${button.id}
                .label=${button.label}
                @mc-press=${() => this.emit({ type: "notice", answer: button.id })}
              ></mc-button>
              ${close ? html`<mc-glyph-hint .glyph=${this.closeGlyph}></mc-glyph-hint>` : nothing}
            </div>`;
          })}
        </div>
      </div>
    </div>`;
  }
}
