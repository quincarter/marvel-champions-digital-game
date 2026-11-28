import { html, type PropertyDeclarations } from "lit";
import { McPress } from "../../../shared/press/McPress.js";
import { McChipStyles } from "./mc-chip.styles.js";

/**
 * # Chip
 * A chip or segment: ink fill with paper words when chosen, paper with ink words otherwise (the state is the fill and
 * the words, never colour alone); dimmed and inert when it cannot be pressed (a stepper at its end). A tap raises
 * `mc-pressed` with its `action`. `link` draws it as words only ("Cards ▸").
 *
 * @element mc-chip
 * @attr label - Its words, already translated.
 * @attr selected - Chosen.
 * @attr link - Words only, no box.
 * @attr disabled - Dimmed; a press does nothing.
 * @attr data-stop - Its focus stop's key.
 * @cssprop --chip-fill - The box fill; --chip-color the words; --chip-line the border (a red Deal chip, an ink Reroll).
 * @prop action - What a tap raises.
 * @fires mc-pressed - `PressDetail`.
 */
export class McChip extends McPress {
  static override styles = [McChipStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    label: { type: String },
    selected: { type: Boolean, reflect: true },
    link: { type: Boolean, reflect: true },
  };

  declare label: string;
  declare selected: boolean;
  declare link: boolean;

  constructor() {
    super();
    this.label = "";
    this.selected = false;
    this.link = false;
  }

  override render() {
    return html`<div class="box">${this.label}</div>`;
  }
}
