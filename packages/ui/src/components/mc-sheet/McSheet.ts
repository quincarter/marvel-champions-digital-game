import { html, LitElement, nothing, svg, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import "../mc-button/mc-button.js";
import type { McButtonKind } from "../mc-button/McButton.js";
import { McSheetStyles } from "./mc-sheet.styles.js";

/** A box in the sheet's own coordinates (from its top left). */
export interface SheetRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A filled and/or outlined rectangle. A stroke is centered on the box's edge, as Phaser strokes it. */
export interface SheetBox {
  readonly kind: "box";
  readonly rect: SheetRect;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly dashed?: boolean;
  readonly opacity?: number;
}

/** The table felt's dot grid over a box. */
export interface SheetDots {
  readonly kind: "dots";
  readonly rect: SheetRect;
  readonly color: string;
  readonly spacing: number;
  readonly radius: number;
  readonly opacity: number;
}

/** A label or a paragraph. `anchorX` / `anchorY` say which point of it sits at `x`, `y` (Phaser's origin). */
export interface SheetText {
  readonly kind: "text";
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly font: "display" | "body" | "mono";
  /** In px; a size of 12 or less grows on desktop when `small` is set (the client's desktop type bump). */
  readonly size: number;
  readonly small?: boolean;
  readonly weight: number;
  readonly color: string;
  readonly opacity?: number;
  readonly letterSpacing?: number;
  /** Line height in px (wrapped text). */
  readonly lineHeight?: number;
  readonly uppercase?: boolean;
  readonly align?: "left" | "center" | "right";
  readonly anchorX?: number;
  readonly anchorY?: number;
  /** Wraps at this width. */
  readonly wrapWidth?: number;
  /** One line that shrinks to fit this width, as Phaser's `fitText` does. */
  readonly fitWidth?: number;
  /** A key the e2e and focus code can find the text by. */
  readonly key?: string;
}

/** A button: the client's `McButton` skins, pressed by a tap. */
export interface SheetButton {
  readonly kind: "button";
  readonly key: string;
  readonly rect: SheetRect;
  readonly label: string;
  readonly look: McButtonKind;
  readonly selected?: boolean;
  readonly disabled?: string | true;
  readonly framed?: boolean;
  /** A Bangers label. */
  readonly display?: boolean;
  /** The label's px size. */
  readonly size?: number;
}

/** An invisible area a tap presses (a card, a row). */
export interface SheetTap {
  readonly kind: "tap";
  readonly key: string;
  readonly rect: SheetRect;
}

/** A scrolling region: its own nodes, laid out in its content space (`height` tall). */
export interface SheetScroll {
  readonly kind: "scroll";
  readonly key: string;
  readonly rect: SheetRect;
  readonly height: number;
  readonly nodes: readonly SheetNode[];
}

export type SheetNode = SheetBox | SheetDots | SheetText | SheetButton | SheetTap | SheetScroll;

const px = (rect: SheetRect): string =>
  `left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px`;

/**
 * # Sheet
 * A panel drawn from positioned parts: boxes, the dot grid, text, buttons, tap areas and scrolling regions, each at
 * the place the client's tested layout gives it. It is how a Phaser screen made of hand-placed parts (Pause, the
 * menus) moves to the DOM with the same look: the scene builds the same parts it drew before
 * (`client/src/dom/sheet-builder.ts`), and this draws them as HTML. Every press is a tap.
 *
 * @element mc-sheet
 * @fires mc-activate - `detail.key`: a button or tap area was tapped.
 */
export class McSheet extends LitElement {
  static override styles = [ThemeStyles, McSheetStyles];

  static override properties: PropertyDeclarations = {
    nodes: { attribute: false },
  };

  declare nodes: readonly SheetNode[];

  constructor() {
    super();
    this.nodes = [];
  }

  /** The element drawn for a key (a button, a tap area, a keyed text, a scroll region). */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  #activate(key: string): void {
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key }, bubbles: true, composed: true }));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void document.fonts?.ready.then(() => this.requestUpdate());
  }

  override updated(): void {
    // One-line texts shrink to fit their width, as Phaser's `fitText` does.
    for (const text of this.renderRoot.querySelectorAll<HTMLElement>("[data-fit]")) {
      text.style.fontSize = "";
      const width = Number(text.dataset.fit);
      let size = parseFloat(getComputedStyle(text).fontSize);
      while (text.scrollWidth > width && size > 6) {
        size -= 0.5;
        text.style.fontSize = `${size}px`;
      }
    }
  }

  override render() {
    return html`${this.nodes.map((node) => this.#node(node))}`;
  }

  #node(node: SheetNode): unknown {
    switch (node.kind) {
      case "box": {
        const width = node.strokeWidth ?? 0;
        const style = [
          px(node.rect),
          node.fill ? `background:${node.fill}` : "",
          node.stroke && width > 0
            ? `outline:${width}px ${node.dashed ? "dashed" : "solid"} ${node.stroke};outline-offset:${-width / 2}px`
            : "",
          node.opacity !== undefined ? `opacity:${node.opacity}` : "",
        ].join(";");
        return html`<div class="part" style=${style}></div>`;
      }
      case "dots": {
        const id = `dots-${node.spacing}-${node.radius}`;
        return html`<svg class="part" style=${`${px(node.rect)};opacity:${node.opacity}`} aria-hidden="true">
          ${svg`<defs><pattern id=${id} width=${node.spacing} height=${node.spacing} patternUnits="userSpaceOnUse">
            <circle cx=${node.spacing / 2} cy=${node.spacing / 2} r=${node.radius} fill=${node.color}></circle>
          </pattern></defs><rect width="100%" height="100%" fill=${`url(#${id})`}></rect>`}
        </svg>`;
      }
      case "text": {
        const size =
          node.small && node.size <= 12 ? `var(--mc-small-${Math.round(node.size)}, ${node.size}px)` : `${node.size}px`;
        const width =
          node.wrapWidth !== undefined ? `width:${node.wrapWidth}px;white-space:pre-wrap` : "white-space:pre";
        const style = [
          `left:${node.x}px`,
          `top:${node.y}px`,
          `transform:translate(${-(node.anchorX ?? 0) * 100}%, ${-(node.anchorY ?? 0) * 100}%)`,
          `font-family:var(--mc-font-${node.font})`,
          `font-size:${size}`,
          `font-weight:${node.weight}`,
          `color:${node.color}`,
          node.opacity !== undefined ? `opacity:${node.opacity}` : "",
          node.letterSpacing ? `letter-spacing:${node.letterSpacing}px` : "",
          node.lineHeight ? `line-height:${node.lineHeight}px` : "",
          node.uppercase ? "text-transform:uppercase" : "",
          node.align ? `text-align:${node.align}` : "",
          width,
          node.fitWidth !== undefined ? `max-width:${node.fitWidth}px;overflow:hidden` : "",
        ].join(";");
        return html`<span
          class="part text"
          data-key=${node.key ?? nothing}
          data-fit=${node.fitWidth ?? nothing}
          style=${style}
          >${node.text}</span
        >`;
      }
      case "button":
        return html`<mc-button
          class="part"
          data-key=${node.key}
          style=${`${px(node.rect)}${node.size ? `;--mc-button-size:${node.size}px` : ""}`}
          kind=${node.look}
          .label=${node.label}
          ?selected=${node.selected ?? false}
          ?framed=${node.framed ?? false}
          ?display=${node.display ?? false}
          ?disabled=${node.disabled !== undefined}
          .reason=${typeof node.disabled === "string" ? node.disabled : ""}
          @mc-press=${() => this.#activate(node.key)}
        ></mc-button>`;
      case "tap":
        return html`<div
          class="part tap"
          data-key=${node.key}
          style=${px(node.rect)}
          ${tapped(() => this.#activate(node.key))}
        ></div>`;
      case "scroll":
        return html`<div class="part scroller" data-key=${node.key} style=${px(node.rect)}>
          <div class="content" style=${`height:${node.height}px`}>${node.nodes.map((child) => this.#node(child))}</div>
        </div>`;
    }
  }
}
