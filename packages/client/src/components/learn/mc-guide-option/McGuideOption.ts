import { McPress } from "@mc/ui";
import { html, nothing, type PropertyDeclarations } from "lit";
import { McGuideOptionStyles } from "./mc-guide-option.styles.js";
import type { GuideOptionModel } from "./mc-guide-option.types.js";

/**
 * # Guide option
 * One guide level the first-run chooser offers (Learn as you play, Hints only, No guide) as a radio card: a radio dot, its
 * name and one line, a RECOMMENDED stamp on the guide's pick, and a slot under the words (the lesson chips). The chosen
 * card says so three ways: a filled dot, a heavy red outline and `aria-checked`, so it never rests on colour alone. The card
 * is a focus stop `option:<value>`; a tap raises `{ type: "option", value }`.
 *
 * @element mc-guide-option
 * @prop model - The card (`GuideOptionModel`).
 * @slot - Under the words: the lesson chips.
 * @fires mc-pressed - `PressDetail` whose action is `{ type: "option", value }`.
 */
export class McGuideOption extends McPress {
  static override styles = [McGuideOptionStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    model: { attribute: false },
    selected: { type: Boolean, reflect: true },
  };

  declare model: GuideOptionModel | null;
  declare selected: boolean;

  constructor() {
    super();
    this.model = null;
    this.selected = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "radio");
  }

  protected override willUpdate(): void {
    const option = this.model;
    this.selected = option?.selected ?? false;
    this.setAttribute("aria-checked", this.selected ? "true" : "false");
    if (option) {
      this.stop = `option:${option.value}`;
      this.action = { type: "option", value: option.value };
    }
  }

  override render() {
    const option = this.model;
    if (!option) return nothing;
    return html`<div class=${option.recommended ? "frame tagged" : "frame"}>
      <span class="radio" ?data-on=${option.selected} aria-hidden="true"></span>
      <div class="text">
        <div class="title">${option.label}</div>
        <div class="body">${option.body}</div>
        <slot></slot>
      </div>
      ${option.recommended ? html`<mc-stamp class="tag" tone="red" label=${option.recommendedLabel}></mc-stamp>` : nothing}
    </div>`;
  }
}
