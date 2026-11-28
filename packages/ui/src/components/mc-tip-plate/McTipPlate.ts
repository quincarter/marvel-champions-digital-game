import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import { McTipPlateStyles } from "./mc-tip-plate.styles.js";
import { TIP_ARROW, tipPlacement, tipWidthFor, type TipPlacement } from "./tip-placement.js";

/**
 * # Tip plate
 * An aspect's tip on an ink plate: its name, tagline and one-line tip, a caution rule and a link to its lesson, with an
 * arrow toward the control it explains. It covers the screen with a transparent backdrop so it sits over everything and a
 * tap anywhere else shuts it: that tap lands on the backdrop, never on the control beneath. Placement follows
 * `tipPlacement` (below the anchor, above where there is no room, clamped inside the screen), measured in the host's own
 * box, so a transformed ancestor does not move it.
 *
 * Mount it only while the tip is open: it measures on connect and again on a resize or a scroll.
 *
 * @element mc-tip-plate
 * @prop anchor - The element the tip points at (a chip's "i"); null puts the plate at the middle of the screen.
 * @attr heading - The aspect's name, already translated.
 * @attr tagline - The line under the name.
 * @attr body - The short tip.
 * @attr link-label - The lesson link's words ("Aspects ▸").
 * @attr link-reason - Why the link is not live ("Coming soon"), shown beside it; empty with a live link.
 * @attr link-available - The link is live (a press raises `mc-tip-link`).
 * @attr link-stop - The link's focus stop key (`data-stop`).
 * @fires mc-tip-link - A tap, or Enter on its stop, on the live link.
 * @fires mc-tip-hover - A mouse entered or left the plate itself: `detail.over`.
 * @fires mc-tip-close - A tap on the backdrop (anywhere that is not the plate).
 */
export class McTipPlate extends LitElement {
  static override styles = [ThemeStyles, McTipPlateStyles];

  static override properties: PropertyDeclarations = {
    anchor: { attribute: false },
    heading: { type: String },
    tagline: { type: String },
    body: { type: String },
    linkLabel: { type: String, attribute: "link-label" },
    linkReason: { type: String, attribute: "link-reason" },
    linkAvailable: { type: Boolean, attribute: "link-available" },
    linkStop: { type: String, attribute: "link-stop" },
    placement: { state: true },
  };

  declare anchor: Element | null;
  declare heading: string;
  declare tagline: string;
  declare body: string;
  declare linkLabel: string;
  declare linkReason: string;
  declare linkAvailable: boolean;
  declare linkStop: string;
  declare placement: TipPlacement | null;

  constructor() {
    super();
    this.anchor = null;
    this.heading = "";
    this.tagline = "";
    this.body = "";
    this.linkLabel = "";
    this.linkReason = "";
    this.linkAvailable = false;
    this.linkStop = "";
    this.placement = null;
  }

  readonly #relayout = (): void => this.#place();

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
    this.#place();
  }

  /** Measures the screen (this host fills it), the anchor and the plate, and settles the plate where `tipPlacement` says. */
  #place(): void {
    const plate = this.renderRoot.querySelector<HTMLElement>(".plate");
    if (!plate) return;
    const screen = this.getBoundingClientRect();
    const target = this.anchor?.getBoundingClientRect();
    const anchor = target
      ? { x: target.x - screen.x, y: target.y - screen.y, width: target.width, height: target.height }
      : { x: screen.width / 2, y: screen.height / 2, width: 0, height: 0 };
    const width = tipWidthFor(screen.width);
    const height = plate.offsetHeight;
    const next = tipPlacement(anchor, height, { x: 0, y: 0, width: screen.width, height: screen.height }, width);
    const was = this.placement;
    if (
      !was ||
      was.panel.x !== next.panel.x ||
      was.panel.y !== next.panel.y ||
      was.panel.width !== next.panel.width ||
      was.panel.height !== next.panel.height ||
      was.arrowX !== next.arrowX ||
      was.above !== next.above ||
      was.arrow !== next.arrow
    )
      this.placement = next;
  }

  /** A mouse resting on the plate (not the backdrop): the screen keeps the tip open while it does. */
  #hover(event: PointerEvent, over: boolean): void {
    if (event.pointerType !== "mouse") return;
    this.dispatchEvent(new CustomEvent("mc-tip-hover", { detail: { over }, bubbles: true, composed: true }));
  }

  #close = (): void => {
    this.dispatchEvent(new CustomEvent("mc-tip-close", { bubbles: true, composed: true }));
  };

  #link = (): void => {
    if (this.linkAvailable) this.dispatchEvent(new CustomEvent("mc-tip-link", { bubbles: true, composed: true }));
  };

  /** Enter on the focused stop is `click()` with no pointer behind it (`detail` 0); a pointer press goes through `tapped`. */
  #click = (event: MouseEvent): void => {
    if (event.detail === 0) this.#link();
  };

  override render() {
    const p = this.placement;
    const place = p
      ? { left: `${p.panel.x}px`, top: `${p.panel.y}px`, width: `${p.panel.width}px` }
      : {
          left: "0px",
          top: "0px",
          width: `${tipWidthFor(this.getBoundingClientRect().width || 300)}px`,
          visibility: "hidden",
        };
    const arrow = p && p.arrow ? { left: `${p.arrowX - p.panel.x - TIP_ARROW}px` } : null;
    return html`<div class="backdrop" aria-hidden="true" ${tapped(this.#close)}></div>
      <div
        class="plate"
        data-above=${p?.above ? "true" : "false"}
        style=${styleMap(place)}
        @pointerenter=${(e: PointerEvent) => this.#hover(e, true)}
        @pointerleave=${(e: PointerEvent) => this.#hover(e, false)}
      >
        ${arrow ? html`<span class="arrow" style=${styleMap(arrow)}></span>` : nothing}
        <h3 class="heading">${this.heading}</h3>
        <p class="tagline">${this.tagline}</p>
        <p class="body">${this.body}</p>
        ${
          this.linkAvailable
            ? html`<button
                type="button"
                class="link"
                tabindex="-1"
                data-stop=${this.linkStop || nothing}
                ${tapped(this.#link)}
                @click=${this.#click}
              >
                ${this.linkLabel}
              </button>`
            : html`<span class="link off">${this.linkLabel}${this.linkReason ? ` · ${this.linkReason}` : ""}</span>`
        }
      </div>`;
  }
}
