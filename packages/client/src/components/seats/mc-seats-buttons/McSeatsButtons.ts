import { html, type PropertyDeclarations } from "lit";
import { SeatsElement } from "../SeatsElement.js";
import type { SeatsButtonModel } from "../seats.types.js";
import { McSeatsButtonsStyles } from "./mc-seats-buttons.styles.js";

/** The focus stop of each button: the keys the specs and the pad route already use. */
const STOPS: Readonly<Record<SeatsButtonModel["action"], string>> = {
  random: "hero-random",
  "game-art": "hero-art",
  preconstructed: "preconstructed",
};

/**
 * # Seats action buttons
 * The plain buttons of the filters row: Random, the hero art switch (Game art / Card art / Promo art) and Use
 * preconstructed. A button that cannot act now is dimmed with its reason as the tooltip, and a press still raises the
 * event: the scene explains why nothing happened, it is not a dead control. The art switch is chosen while the active
 * seat's pick is drawn as game art.
 *
 * @element mc-seats-buttons
 * @prop buttons - The buttons, in order (`SeatsButtonModel`).
 * @fires mc-seats - `{ type: "action", action }`: `random`, `game-art` or `preconstructed`.
 */
export class McSeatsButtons extends SeatsElement {
  static override styles = [McSeatsButtonsStyles];

  static override properties: PropertyDeclarations = { buttons: { attribute: false } };

  declare buttons: readonly SeatsButtonModel[];

  constructor() {
    super();
    this.buttons = [];
  }

  /** A press on the button of `action` (an `mc-button` taps and clicks itself, so none carries `data-action`). */
  protected override act(action: string): void {
    const found = this.buttons.find((button) => button.action === action);
    if (found) this.emit({ type: "action", action: found.action });
  }

  override render() {
    return this.buttons.map(
      (button) =>
        html`<mc-button
          kind="quiet"
          data-stop=${STOPS[button.action]}
          .label=${button.label}
          .reason=${button.disabled ?? ""}
          ?disabled=${button.disabled !== null}
          pressable
          ?selected=${button.selected}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.act(button.action);
          }}
        ></mc-button>`,
    );
  }
}
