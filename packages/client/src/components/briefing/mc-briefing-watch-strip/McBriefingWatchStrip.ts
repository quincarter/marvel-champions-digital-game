import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import "../mc-briefing-watch-toggle/mc-briefing-watch-toggle.js";
import type { WatchModel } from "../mc-briefing-watch-toggle/mc-briefing-watch-toggle.types.js";
import { McBriefingWatchStripStyles } from "./mc-briefing-watch-strip.styles.js";

/**
 * # Briefing watch strip
 * The phone strip just above the action bar, on the page paper so the scrolling briefing never runs under it: the red reason Open
 * issue waits (a deck setup would refuse, a call still to answer), as tall as it wraps, or, when there is none, the "Let people
 * watch this game" toggle. The two never show together: a problem outranks the toggle. Nothing when there is neither.
 *
 * @element mc-briefing-watch-strip
 * @attr reason - The reason line, already translated; empty for none.
 * @prop watch - `WatchModel`, or null for no toggle (an issue already on the table).
 * @fires mc-briefing - `{ type: "watch" }`.
 */
export class McBriefingWatchStrip extends LitElement {
  static override styles = [ThemeStyles, McBriefingWatchStripStyles];

  static override properties: PropertyDeclarations = {
    reason: { type: String },
    watch: { attribute: false },
  };

  declare reason: string;
  declare watch: WatchModel | null;

  constructor() {
    super();
    this.reason = "";
    this.watch = null;
    new BriefingRelay(this);
  }

  override render() {
    if (this.reason) return html`<p class="reason">${this.reason}</p>`;
    if (!this.watch) return nothing;
    return html`<mc-briefing-watch-toggle
      .stop=${"watch"}
      .label=${this.watch.label}
      ?checked=${this.watch.on}
    ></mc-briefing-watch-toggle>`;
  }
}
