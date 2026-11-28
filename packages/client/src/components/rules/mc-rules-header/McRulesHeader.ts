import { html, type PropertyDeclarations } from "lit";
import { fitOneLine, ThemeStyles, type HintGlyph } from "@mc/ui";
import { RulesElement } from "../shared/RulesElement.js";
import "../mc-rules-scope/mc-rules-scope.js";
import { McRulesHeaderStyles } from "./mc-rules-header.styles.js";
import type { McRulesHeaderProps } from "./mc-rules-header.types.js";
import type { McRulesScopeProps } from "../mc-rules-scope/mc-rules-scope.types.js";

/**
 * # Rules header
 * The ink chrome band across the top: Back (with its Cancel glyph on a keyboard or pad), the title, and under them the
 * scope row (`mc-rules-scope`). Back is the focus stop `back`.
 *
 * @element mc-rules-header
 * @fires mc-rules - `{ type: "back" }` (and the scope row's `scope`).
 */
export class McRulesHeader extends RulesElement implements McRulesHeaderProps {
  static override styles = [ThemeStyles, McRulesHeaderStyles];

  static override properties: PropertyDeclarations = {
    backLabel: { type: String, attribute: "back-label" },
    heading: { type: String },
    backGlyph: { attribute: false },
    titleDrop: { type: Number, attribute: "title-drop" },
    titleMax: { type: Number, attribute: "title-max" },
    caption: { type: String },
    toggle: { attribute: false },
  };

  declare backLabel: string;
  declare heading: string;
  declare backGlyph: HintGlyph | null;
  declare titleDrop: number;
  declare titleMax: number;
  declare caption: string;
  declare toggle: McRulesScopeProps["toggle"];

  constructor() {
    super();
    this.backLabel = "";
    this.heading = "";
    this.backGlyph = null;
    this.titleDrop = 0;
    this.titleMax = 0;
    this.caption = "";
    this.toggle = null;
  }

  /** The title ends before the dark mode tab (`title-max`) and shrinks to fit the room it has, as the top bar's does. */
  protected override updated(): void {
    const title = this.renderRoot.querySelector<HTMLElement>(".title");
    if (!title) return;
    title.style.maxWidth = "";
    // The dark mode tab hangs from the top centre: a narrow title stops before it.
    const centre = this.clientWidth < 600 ? this.clientWidth / 2 - 26 : 0;
    const stop = Math.min(...[this.titleMax, centre].filter((limit) => limit > 0), Infinity);
    if (Number.isFinite(stop)) {
      const room = stop - (title.getBoundingClientRect().left - this.getBoundingClientRect().left);
      title.style.maxWidth = `${Math.max(40, room)}px`;
    }
    fitOneLine(title);
  }

  override render() {
    return html`<div class="title-row">
        <mc-hint-button
          class="back"
          kind="onInk"
          display
          hug
          data-stop="back"
          .label=${this.backLabel}
          .glyph=${this.backGlyph}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.emit({ type: "back" });
          }}
        ></mc-hint-button>
        <span class="title" style=${`--drop:${this.titleDrop}px`}>${this.heading}</span>
      </div>
      <mc-rules-scope .caption=${this.caption} .toggle=${this.toggle}></mc-rules-scope>`;
  }
}
