import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import { raiseBriefing } from "../briefing.types.js";
import "../mc-briefing-watch-toggle/mc-briefing-watch-toggle.js";
import { McBriefingActionBarStyles } from "./mc-briefing-action-bar.styles.js";
import type { ActionBarModel } from "./mc-briefing-action-bar.types.js";

/**
 * # Briefing action bar
 * The ink bar at the foot: EDIT DECKS (a phone DECKS) and the one red OPEN ISSUE button. Beside the buttons on a wide screen (a
 * phone has the watch strip above its bar instead) it says why Open waits in red words (a deck setup would refuse, a call still to
 * answer) or, with nothing to say, holds the "Let people watch this game" toggle. Open stays in place, dimmed, while it cannot be
 * pressed, and is a focus stop (`open`) only when it can: the pad primary goes forward only when it can. Edit decks is always a
 * stop (`edit-decks`).
 *
 * @element mc-briefing-action-bar
 * @prop model - `ActionBarModel`.
 * @attr phone - Two equal buttons across the bar, the reason and the toggle on the strip above it.
 * @fires mc-briefing - `{ type: "edit-decks" }`, `{ type: "open" }` and `{ type: "watch" }`.
 */
export class McBriefingActionBar extends LitElement {
  static override styles = [ThemeStyles, McBriefingActionBarStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: ActionBarModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
    new BriefingRelay(this);
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const beside = this.phone
      ? nothing
      : m.reason
        ? html`<p class="reason">${m.reason}</p>`
        : m.watch
          ? html`<mc-briefing-watch-toggle
              class="watch"
              onink
              .stop=${"watch"}
              .label=${m.watch.label}
              ?checked=${m.watch.on}
            ></mc-briefing-watch-toggle>`
          : nothing;
    return html`<div class="beside">${beside}</div>
      <mc-button
        class="edit"
        kind="onInk"
        display
        data-stop="edit-decks"
        .label=${m.editLabel}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          raiseBriefing(this, { type: "edit-decks" });
        }}
      ></mc-button>
      <mc-hint-button
        class="open"
        kind="primary"
        display
        data-stop=${m.canOpen ? "open" : nothing}
        ?disabled=${!m.canOpen}
        .label=${m.openLabel}
        .glyph=${m.canOpen && !this.phone ? m.openGlyph : null}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          if (m.canOpen) raiseBriefing(this, { type: "open" });
        }}
      ></mc-hint-button>`;
  }
}
