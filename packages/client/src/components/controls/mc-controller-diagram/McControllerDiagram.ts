import { layoutGlyph, measureGlyphText, svgOpTemplate, type SvgOp } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { font } from "../../../tokens.js";
import { MIN_DIAGRAM_FONT, type ControllerDiagram } from "../../../view/controller-diagram.js";
import { McControllerDiagramStyles } from "./mc-controller-diagram.styles.js";

const BODY_MEASURE = (label: string, size: number): number =>
  measureGlyphText(label, size, `"${font.body}", sans-serif`);

/**
 * # Controller diagram
 * The Controls screen's controller drawing: its shapes and labels as one inline SVG (the labels stay text nodes, so a
 * screen reader and a find-in-page read them) scaled to the element's width, and each button's picture as an `mc-glyph`
 * laid over the drawing where the shape's label box is. A label never draws smaller than 8px on screen, and a stroke
 * never thinner than one pixel. When the drawing's picture fails to load it says so in words.
 *
 * @element mc-controller-diagram
 * @prop diagram - `ControllerDiagram` (view/controller-diagram.ts): the ops, the glyphs and the viewBox.
 */
export class McControllerDiagram extends LitElement {
  static override styles = [McControllerDiagramStyles];

  static override properties: PropertyDeclarations = {
    diagram: { attribute: false },
    scale: { state: true },
    failed: { state: true },
  };

  declare diagram: ControllerDiagram | null;
  /** Screen pixels per drawing unit, from the element's width. */
  declare scale: number;
  declare failed: boolean;
  #resize: ResizeObserver | null = null;

  constructor() {
    super();
    this.diagram = null;
    this.scale = 1;
    this.failed = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver === "undefined") return;
    this.#resize = new ResizeObserver(() => this.#measure());
    this.#resize.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  protected override willUpdate(): void {
    const box = this.diagram?.viewBox;
    if (box) this.style.setProperty("--aspect", `${box[0]} / ${box[1]}`);
  }

  protected override updated(): void {
    this.#measure();
  }

  #measure(): void {
    const width = this.clientWidth;
    const box = this.diagram?.viewBox[0] ?? 0;
    if (width > 0 && box > 0 && Math.abs(this.scale - width / box) > 0.001) this.scale = width / box;
  }

  /** A label never draws smaller than `MIN_DIAGRAM_FONT` on screen, nor a stroke thinner than one pixel. */
  #scaled(op: SvgOp): SvgOp {
    if (op.k === "text") return { ...op, size: Math.max(op.size, MIN_DIAGRAM_FONT / this.scale) };
    if ("stroke" in op && op.stroke !== undefined) return { ...op, sw: Math.max(op.sw ?? 1, 1 / this.scale) };
    return op;
  }

  override render() {
    const diagram = this.diagram;
    if (!diagram) return nothing;
    const [width, height] = diagram.viewBox;
    const hasImage = diagram.ops.some((op) => op.k === "image");
    return html`<div class="frame">
      <svg viewBox=${`0 0 ${width} ${height}`} data-key="controller" aria-hidden="true">
        ${diagram.ops.map((op) => svgOpTemplate(this.#scaled(op), () => (this.failed = true)))}
      </svg>
      ${diagram.glyphs.map((glyph) => this.#glyph(glyph))}
      ${
        this.failed && hasImage && diagram.missing
          ? html`<div class="missing"><span>${diagram.missing}</span></div>`
          : nothing
      }
    </div>`;
  }

  #glyph(glyph: ControllerDiagram["glyphs"][number]) {
    const scale = this.scale;
    const laid = layoutGlyph([glyph.spec], glyph.height * scale, BODY_MEASURE);
    const fit = Math.min(1, (glyph.maxWidth * scale) / laid.fullWidth);
    const height = glyph.height * scale * fit;
    const width = layoutGlyph([glyph.spec], height, BODY_MEASURE).fullWidth;
    return html`<mc-glyph
      class="glyph"
      style=${styleMap({ left: `${glyph.x * scale - width / 2}px`, top: `${glyph.y * scale - height / 2}px` })}
      .specs=${[glyph.spec]}
      .height=${height}
      ground="paper"
      still
    ></mc-glyph>`;
  }
}
