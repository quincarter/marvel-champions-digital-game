import { McPress } from "@mc/ui";
import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { McTrophyTileStyles } from "./mc-trophy-tile.styles.js";
import type { McTrophyTileProps, TrophyTileModel } from "./mc-trophy-tile.types.js";
import "../mc-trophy-state/mc-trophy-state.js";

/**
 * # Trophy tile
 * One achievement as a card that is itself the control (`McPress`: a tap, never the lift that ends a swipe, or the route's
 * Enter, raises `mc-pressed` with the `action` the list gave it, which opens its sheet). EARNED is a solid ink card with
 * paper words, LOCKED parchment with an outline, SOON dimmed; the state is a word and a mark as well as a look. It shows
 * the name, what it takes (two lines, three on a phone; the sheet has all of it), the state, its reward and a progress bar
 * with its count while it is tracked.
 *
 * Needs `@mc/ui` defined (`mc-progress-bar`). Focus stop: `row:<id>` (set by the list through `data-stop`).
 *
 * @element mc-trophy-tile
 * @prop model - The achievement (`TrophyTileModel`).
 * @attr state - Reflected from the model: earned | locked | untracked.
 * @fires mc-pressed - `PressDetail`, with the list's `action`.
 */
export class McTrophyTile extends McPress implements McTrophyTileProps {
  static override styles = [McTrophyTileStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    model: { attribute: false },
    state: { type: String, reflect: true },
    earned: { type: Boolean, reflect: true },
  };

  declare model: TrophyTileModel | null;
  declare state: TrophyTileModel["state"] | "";
  declare earned: boolean;

  constructor() {
    super();
    this.model = null;
    this.state = "";
    this.earned = false;
  }

  protected override willUpdate(): void {
    this.state = this.model?.state ?? "";
    this.earned = this.model?.state === "earned";
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const m = this.model;
    if (m) this.setAttribute("aria-label", `${m.name}, ${m.stateLabel}`);
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="card">
      <div class="top">
        <div class="text">
          <div class="name">${m.name}</div>
          <div class="detail">${m.detail}</div>
        </div>
        <div class="side">
          <mc-trophy-state .state=${m.state} .label=${m.stateLabel}></mc-trophy-state>
          ${m.reward ? html`<div class="reward">${m.reward}</div>` : nothing}
        </div>
      </div>
      ${
        m.progress
          ? html`<div class="progress">
              <mc-progress-bar .fraction=${m.progress.fraction} .label=${m.progressLabel}></mc-progress-bar>
              <span class="count">${m.progressLabel}</span>
            </div>`
          : nothing
      }
    </div>`;
  }
}
