import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { onActivate, onTap } from "../../shared/tap.js";
import { tipPlacement, tipWidthFor, type TipRect } from "../../shared/tip-placement.js";
import { McTipPlateStyles } from "./mc-tip-plate.styles.js";
import type { McTipPlateProps } from "./mc-tip-plate.types.js";

const NO_BOX: TipRect = { x: 0, y: 0, width: 0, height: 0 };

/**
 * # Tip plate
 * A short tip on a card-coloured plate, placed beside an anchor inside a viewport (`tipPlacement`): below the anchor,
 * above where there is no room below, clamped inside the viewport and wrapped to its width. It is positioned in its
 * offset parent's coordinates, so put it in a `position: relative` page. It takes the press on it (a tap raises
 * `mc-tip-dismiss`), so nothing under it is pressed.
 *
 * @element mc-tip-plate
 * @attr text - The tip's words.
 * @prop anchor - What it explains (`TipRect`); null hides the plate.
 * @prop viewport - The box to stay inside.
 * @fires mc-tip-dismiss - A tap on the plate.
 */
export class McTipPlate extends LitElement implements McTipPlateProps {
  static override styles = [ThemeStyles, McTipPlateStyles];

  static override properties: PropertyDeclarations = {
    text: { type: String },
    anchor: { attribute: false },
    viewport: { attribute: false },
  };

  declare text: string;
  declare anchor: TipRect | null;
  declare viewport: TipRect;
  #stopTap: (() => void) | null = null;
  #stopActivate: (() => void) | null = null;

  constructor() {
    super();
    this.text = "";
    this.anchor = null;
    this.viewport = NO_BOX;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const dismiss = (): void => {
      this.dispatchEvent(new CustomEvent("mc-tip-dismiss", { detail: {}, bubbles: true, composed: true }));
    };
    this.#stopTap = onTap(this, dismiss);
    this.#stopActivate = onActivate(this, dismiss);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopTap?.();
    this.#stopTap = null;
    this.#stopActivate?.();
    this.#stopActivate = null;
  }

  override render() {
    return html`${this.text}`;
  }

  /** Wraps to its width, then reads its own height and sits where `tipPlacement` says; hidden until it has. */
  protected override updated(): void {
    this.toggleAttribute("hidden", this.anchor === null);
    if (!this.anchor || this.viewport.width === 0) return;
    const width = tipWidthFor(this.viewport);
    this.style.width = `${width}px`;
    const { panel } = tipPlacement(this.anchor, this.offsetHeight, this.viewport, width);
    this.style.left = `${panel.x}px`;
    this.style.top = `${panel.y}px`;
    this.setAttribute("placed", "");
  }
}
