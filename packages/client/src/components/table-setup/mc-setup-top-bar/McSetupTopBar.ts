import { glyphLabelShift, type ControlGlyph } from "@mc/ui";
import { html, LitElement, type PropertyDeclarations } from "lit";
import { t } from "../../../i18n/translate.js";
import type { SetupMode } from "../shared/setup-events.types.js";
import { SetupRelay } from "../shared/setup-relay.js";
import { McSetupTopBarStyles } from "./mc-setup-top-bar.styles.js";

/**
 * # Setup top bar
 * The ink bar of Set up the table: Back (a boxed button; a plain arrow on a phone), the Bangers title and "Step 4 of 4".
 * The dark mode tab hangs from the top centre of the screen: the scene asks the shared rule where it goes and tells the
 * bar how far to drop the title (`title-drop`) and where it must end (`title-max`, px, 0 for no limit).
 *
 * @element mc-setup-top-bar
 * @attr mode - wide | phone.
 * @attr title-drop - How far the title drops under the dark mode tab, in px.
 * @attr title-max - The width the title may take, in px (0: no limit).
 * @fires mc-setup - `back`.
 */
export class McSetupTopBar extends LitElement {
  static override styles = McSetupTopBarStyles;

  static override properties: PropertyDeclarations = {
    mode: { type: String, reflect: true },
    titleDrop: { type: Number, attribute: "title-drop" },
    titleMax: { type: Number, attribute: "title-max" },
    backGlyph: { attribute: false },
  };

  declare mode: SetupMode;
  declare titleDrop: number;
  declare titleMax: number;
  /** The Cancel glyph on Back while a keyboard or pad is in use (a phone has none). */
  declare backGlyph: ControlGlyph | undefined;

  constructor() {
    super();
    this.mode = "wide";
    this.titleDrop = 0;
    this.titleMax = 0;
    this.backGlyph = undefined;
    new SetupRelay(this);
  }

  override render() {
    const phone = this.mode === "phone";
    const title = `--drop:${this.titleDrop}px;${this.titleMax > 0 ? `--max:${this.titleMax}px` : ""}`;
    return html`<div class="ctl" style=${`--mc-label-shift:${glyphLabelShift(this.backGlyph)}px`}>
        <mc-chip
          class="back"
          .stop=${"back"}
          label=${phone ? "◂" : t("tableSetup.back")}
          aria-label=${t("tableSetup.back")}
          .action=${{ type: "back" } as const}
        ></mc-chip>
        <mc-glyph-hint .glyph=${phone ? undefined : this.backGlyph}></mc-glyph-hint>
      </div>
      <div class="title" style=${title}>${t("tableSetup.title")}</div>
      <div class="step label">${t(phone ? "tableSetup.stepShort" : "tableSetup.step")}</div>`;
  }
}
