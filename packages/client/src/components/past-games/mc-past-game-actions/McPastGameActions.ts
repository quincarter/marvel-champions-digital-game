import { ThemeStyles } from "@mc/ui";
import { html, nothing, type PropertyDeclarations } from "lit";
import { PastGamesElement } from "../shared/PastGamesElement.js";
import { McPastGameActionsStyles } from "./mc-past-game-actions.styles.js";
import type { McPastGameActionsProps, PastGameActionButton } from "./mc-past-game-actions.types.js";

/**
 * # Past game actions
 * A game's four actions: Watch (the primary one, full width) over Share link, Export and Log. Each is a stop,
 * `action:<watch|share|export|log>`; while one runs they are all dimmed and press nothing.
 *
 * Needs `@mc/ui` defined (`mc-button`).
 *
 * @element mc-past-game-actions
 * @prop actions - The buttons, Watch first (`PastGameActionButton`).
 * @attr game-id - The game they act on.
 * @attr busy - Something is running.
 * @fires mc-past-games - `{ type: "action", id, action }`.
 */
export class McPastGameActions extends PastGamesElement implements McPastGameActionsProps {
  static override styles = [ThemeStyles, McPastGameActionsStyles];

  static override properties: PropertyDeclarations = {
    gameId: { type: String, attribute: "game-id" },
    actions: { attribute: false },
    busy: { type: Boolean, reflect: true },
  };

  declare gameId: string;
  declare actions: readonly PastGameActionButton[];
  declare busy: boolean;

  constructor() {
    super();
    this.gameId = "";
    this.actions = [];
    this.busy = false;
  }

  #button(button: PastGameActionButton, primary: boolean) {
    return html`<mc-button
      class=${primary ? "watch" : ""}
      kind=${primary ? "primary" : "secondary"}
      data-stop=${`action:${button.action}`}
      data-key=${`action:${button.action}`}
      ?plain=${!primary}
      ?disabled=${this.busy}
      .label=${button.label}
      @mc-press=${(event: Event) => {
        event.stopPropagation();
        this.emit({ type: "action", id: this.gameId, action: button.action });
      }}
    ></mc-button>`;
  }

  override render() {
    const [first, ...rest] = this.actions;
    if (!first) return nothing;
    return html`${this.#button(first, true)}
      <div class="rest">${rest.map((button) => this.#button(button, false))}</div>`;
  }
}
