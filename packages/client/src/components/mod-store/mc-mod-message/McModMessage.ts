import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { McModMessageStyles } from "./mc-mod-message.styles.js";
import type { McModMessageProps, ModMessageKind } from "./mc-mod-message.types.js";

/**
 * # Mod Store message
 * A line the store says in place of a list: loading, the catalog could not be reached (with Try again), no packs here, no
 * match; or, as the `offline` banner, an ink strip over the grid saying the list is the saved copy.
 *
 * @element mc-mod-message
 * @fires mc-mod-store - `{ type: "retry" }` on Try again.
 */
export class McModMessage extends ModStoreElement implements McModMessageProps {
  static override styles = [ThemeStyles, McModMessageStyles];

  static override properties: PropertyDeclarations = {
    kind: { type: String, reflect: true },
    text: { type: String },
    retryLabel: { type: String, attribute: "retry-label" },
  };

  declare kind: ModMessageKind;
  declare text: string;
  declare retryLabel: string;

  constructor() {
    super();
    this.kind = "plain";
    this.text = "";
    this.retryLabel = "";
  }

  override render() {
    return html`<span class="text">${this.text}</span> ${
        this.retryLabel
          ? html`<mc-button
              class="retry"
              kind="primary"
              data-stop="retry"
              data-key="retry"
              .label=${this.retryLabel}
              @mc-press=${() => this.emit({ type: "retry" })}
            ></mc-button>`
          : nothing
      }`;
  }

  protected override updated(): void {
    this.emitRendered();
  }
}
