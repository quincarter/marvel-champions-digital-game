import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { McPackActionsStyles } from "./mc-pack-actions.styles.js";
import type { McPackActionsProps } from "./mc-pack-actions.types.js";
import type { PackAction } from "../../../view/mod-store-model.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";

/**
 * # Pack actions
 * The buttons a pack's state offers (Install, Update, Remove, and Remove's confirm and cancel). A button that cannot be
 * used now stays in place, dimmed, and says why on hover; a press on it does nothing.
 *
 * @element mc-pack-actions
 * @fires mc-mod-store - `{ type: "pack-action", action }`.
 */
export class McPackActions extends ModStoreElement implements McPackActionsProps {
  static override styles = [ThemeStyles, McPackActionsStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    actions: { attribute: false },
  };

  declare size: ModStoreSize;
  declare actions: readonly PackAction[];

  constructor() {
    super();
    this.size = "wide";
    this.actions = [];
  }

  protected override updated(): void {
    this.emitRendered();
  }

  override render() {
    return html`${this.actions.map(
      (action) =>
        html`<mc-button
          kind=${action.kind}
          data-stop=${`action:${action.id}`}
          data-key=${`action:${action.id}`}
          .label=${action.label}
          ?disabled=${!action.enabled}
          .reason=${action.reason ?? ""}
          @mc-press=${() => {
            if (action.enabled) this.emit({ type: "pack-action", action: action.id });
          }}
        ></mc-button>`,
    )}`;
  }
}
