import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { tapped } from "../../../shared/tapped.js";
import { TIP_ARROW, tipPlacement, tipWidthFor } from "../../mc-tip-plate/tip-placement.js";
import { McTermTipStyles } from "./mc-term-tip.styles.js";
import { TERM_LINK_EVENT, type McTermTipProps, type TermTipPlace } from "./mc-term-tip.types.js";

/**
 * # Term tip
 * A glossary definition on an ink plate under (or over) the word it explains: the term's name, one definition and a
 * caution-ruled link to the rules glossary, with an arrow at the word. It has no backdrop: the text that holds it closes it
 * (the mouse leaving word and plate, a tap elsewhere), so a tap outside reaches whatever is under it. Placement follows
 * `tipPlacement` in the screen's own pixels, drawn from where this element sits (put it inside a `position: relative` box
 * with no clipping between it and the page); it measures on every update, a resize and a scroll.
 *
 * Mount it only while a term is open.
 *
 * @element mc-term-tip
 * @prop anchor - The word the tip points at.
 * @attr heading - The term's name, already translated.
 * @attr body - The definition (with its source), already translated.
 * @attr link-label - The glossary link's words.
 * @attr link-stop - The link's focus stop key (`data-stop`).
 * @fires mc-term-link - A tap, or Enter on its stop, on the link.
 */
export class McTermTip extends LitElement implements McTermTipProps {
  static override styles = [McTermTipStyles];

  static override properties: PropertyDeclarations = {
    anchor: { attribute: false },
    heading: { type: String },
    body: { type: String },
    linkLabel: { type: String, attribute: "link-label" },
    linkStop: { type: String, attribute: "link-stop" },
    place: { state: true },
  };

  declare anchor: Element | null;
  declare heading: string;
  declare body: string;
  declare linkLabel: string;
  declare linkStop: string;
  declare place: TermTipPlace | null;

  constructor() {
    super();
    this.anchor = null;
    this.heading = "";
    this.body = "";
    this.linkLabel = "";
    this.linkStop = "";
    this.place = null;
  }

  readonly #relayout = (): void => this.#measure();

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("resize", this.#relayout);
    window.addEventListener("scroll", this.#relayout, true);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.#relayout);
    window.removeEventListener("scroll", this.#relayout, true);
  }

  protected override updated(): void {
    this.#measure();
  }

  /** Settles the plate where `tipPlacement` says, as offsets from this element's own corner. */
  #measure(): void {
    const plate = this.renderRoot.querySelector<HTMLElement>(".plate");
    const target = this.anchor?.getBoundingClientRect();
    if (!plate || !target) return;
    const origin = this.getBoundingClientRect();
    const screen = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    const width = tipWidthFor(screen.width);
    const laid = tipPlacement(
      { x: target.x, y: target.y, width: target.width, height: target.height },
      plate.offsetHeight,
      screen,
      width,
    );
    const next: TermTipPlace = {
      x: laid.panel.x - origin.x,
      y: laid.panel.y - origin.y,
      width,
      arrowX: laid.arrowX - laid.panel.x - TIP_ARROW,
      above: laid.above,
      arrow: laid.arrow,
    };
    const was = this.place;
    if (
      !was ||
      was.x !== next.x ||
      was.y !== next.y ||
      was.width !== next.width ||
      was.arrowX !== next.arrowX ||
      was.above !== next.above ||
      was.arrow !== next.arrow
    )
      this.place = next;
  }

  readonly #link = (): void => {
    this.dispatchEvent(new CustomEvent(TERM_LINK_EVENT, { bubbles: true, composed: true }));
  };

  /** Enter on the focused stop is `click()` with no pointer behind it (`detail` 0); a pointer press goes through `tapped`. */
  readonly #click = (event: MouseEvent): void => {
    if (event.detail === 0) this.#link();
  };

  override render() {
    const place = this.place;
    const box = place
      ? { left: `${place.x}px`, top: `${place.y}px`, width: `${place.width}px` }
      : { left: "0px", top: "0px", width: `${tipWidthFor(window.innerWidth)}px`, visibility: "hidden" };
    return html`<div class="plate" data-above=${place?.above ? "true" : "false"} style=${styleMap(box)}>
      ${place?.arrow ? html`<span class="arrow" style=${styleMap({ left: `${place.arrowX}px` })}></span>` : nothing}
      <h3 class="heading">${this.heading}</h3>
      <p class="body">${this.body}</p>
      <button
        type="button"
        class="link"
        tabindex="-1"
        data-stop=${this.linkStop || nothing}
        ${tapped(this.#link)}
        @click=${this.#click}
      >
        ${this.linkLabel}
      </button>
    </div>`;
  }
}
