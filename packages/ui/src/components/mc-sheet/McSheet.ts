import { html, LitElement, nothing, svg, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { graphemesOf } from "../../shared/graphemes.js";
import { tapped } from "../../shared/tapped.js";
import { cancelHold } from "../../shared/tap.js";
import "../mc-aspect-chip/mc-aspect-chip.js";
import "../mc-button/mc-button.js";
import "../mc-glyph/mc-glyph.js";
import "../mc-tab-rail/mc-tab-rail.js";
import "../mc-picture-tile/mc-picture-tile.js";
import "../mc-list-row/mc-list-row.js";
import "../mc-empty-state/mc-empty-state.js";
import { GLYPH_COLLAPSE_MS, GLYPH_EXPAND_MS } from "../mc-glyph/McGlyph.js";
import type { SheetNode, SheetRect, SheetScroll, SheetSlider, SvgOp } from "../../shared/sheet.types.js";
import { McSheetStyles } from "./mc-sheet.styles.js";

/**
 * A part's identity across redraws: its key when it has one (a button, a tap area, a scroller), so a press in flight or a
 * list's scroll stays with its part when parts before it come and go; else its kind and place in the list.
 */
const keyOf = (node: SheetNode, index: number): string =>
  "key" in node && node.key !== undefined ? `${node.kind}:key:${node.key}` : `${node.kind}:${index}`;

/**
 * The room a scrolling region's scrollbar takes beside its parts: 6px (`--mc-scrollbar-width`; Firefox's thin bar is
 * about 8px). The region is drawn this much wider than its rect when its content scrolls, so the gutter comes out of
 * that extra width and the parts keep the rect's width. Without it the gutter cut into the parts' client width, the
 * content overflowed sideways and its right edge hid under the bar.
 */
export const SCROLL_GUTTER = 8;

/** The box a scrolling region is drawn in: its rect, widened by the scrollbar's gutter while its content scrolls. */
export function scrollBox(node: Pick<SheetScroll, "rect" | "height">): SheetRect {
  return node.height > node.rect.height ? { ...node.rect, width: node.rect.width + SCROLL_GUTTER } : node.rect;
}

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
 * @fires mc-inspect - `detail.key`: a tap area with `inspect` was held or right-clicked.
 * @fires mc-image-error - `detail.key` (the image's `retry`), `detail.src`: a picture with `retry` failed to load, once per key until one loads.
 * @fires mc-hover - `detail.key`, `detail.over`: a mouse moved onto or off a tap area with `track`.
 * @fires mc-slide - `detail.key`, `detail.share` (0 to 1 along the track), `detail.commit`: a slider track was tapped or dragged.
 * @fires mc-step - `detail.key`, `detail.direction` (-1 or 1): a slider's minus or plus was tapped.
 */
export class McSheet extends LitElement {
  static override styles = [ThemeStyles, McSheetStyles];

  static override properties: PropertyDeclarations = {
    nodes: { attribute: false },
  };

  declare nodes: readonly SheetNode[];
  /** The pictures that failed to load, so their boxes say `missing` (and keep saying it across redraws). */
  readonly #failed = new Set<string>();
  /** Keys already asked to resolve again; cleared when one of their pictures loads. */
  readonly #retried = new Set<string>();

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

  #hover(key: string, over: boolean, event: PointerEvent): void {
    if (event.pointerType !== "mouse") return;
    this.dispatchEvent(new CustomEvent("mc-hover", { detail: { key, over }, bubbles: true, composed: true }));
  }

  #inspect(key: string): void {
    this.dispatchEvent(new CustomEvent("mc-inspect", { detail: { key }, bubbles: true, composed: true }));
  }

  /**
   * Cancels every press-and-hold still armed (the panel was covered or hidden: nothing may be inspected from it) and
   * every slider gesture under a captured pointer, so a covered or closing panel's slider changes nothing more.
   */
  cancelHolds(): void {
    for (const area of this.renderRoot.querySelectorAll<HTMLElement>(".tap")) cancelHold(area);
    this.cancelSlides();
  }

  /** Ends every slider press still down: its later moves and release raise no `mc-slide`. */
  cancelSlides(): void {
    this.#slides.clear();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void document.fonts?.ready.then(() => this.requestUpdate());
  }

  override updated(): void {
    // One-line texts shrink to fit their width, as Phaser's `fitText` does: smaller down to the floor, then without a
    // closing parenthetical ("Spider-Man (Peter Parker)"), then cut with an ellipsis.
    for (const text of this.renderRoot.querySelectorAll<HTMLElement>("[data-fit]")) {
      // Marked text is a run of Lit-owned fragments and `mark` elements: never write into those. It only shrinks by
      // font size, and the CSS `text-overflow: ellipsis` on the span does any cutting.
      const words =
        text.childElementCount > 0
          ? undefined
          : [...text.childNodes].find((node): node is Text => node.nodeType === Node.TEXT_NODE);
      const full = text.dataset.full ?? words?.data ?? "";
      if (words) words.data = full;
      text.style.fontSize = text.dataset.size ?? "";
      const width = Number(text.dataset.fit);
      const style = getComputedStyle(text);
      let size = parseFloat(style.fontSize);
      // The client's caption floor (8px, grown on desktop like every small size) before the text is cut short.
      const floor = parseFloat(style.getPropertyValue("--mc-small-8")) || 8;
      while (text.scrollWidth > width && size > floor) {
        size = Math.max(floor, size - 0.5);
        text.style.fontSize = `${size}px`;
      }
      if (!words || text.scrollWidth <= width) continue;
      let shown = full;
      const asideless = full.replace(/\s*\([^)]*\)\s*$/, "");
      if (asideless !== full && asideless !== "") {
        shown = asideless;
        words.data = shown;
        if (text.scrollWidth <= width) continue;
      }
      // Cut on grapheme boundaries, never inside an emoji or between a letter and its accent.
      const letters = graphemesOf(shown);
      const head = (length: number): string => `${letters.slice(0, length).join("").trimEnd()}…`;
      let short = 1;
      let long = letters.length - 1;
      let best = 1;
      while (short <= long) {
        const length = (short + long) >> 1;
        words.data = head(length);
        if (text.scrollWidth <= width) {
          best = length;
          short = length + 1;
        } else long = length - 1;
      }
      words.data = head(best);
    }
  }

  override render() {
    return html`${repeat(this.nodes, keyOf, (node) => this.#node(node))}`;
  }

  /** `text` with its marked ranges in `mark` elements, written without whitespace between the parts. */
  #marked(text: string, marks: readonly { readonly start: number; readonly end: number }[]): unknown[] {
    const parts: unknown[] = [];
    let at = 0;
    for (const { start, end } of marks) {
      if (start > at) parts.push(text.slice(at, start));
      parts.push(html`<mark>${text.slice(start, end)}</mark>`);
      at = end;
    }
    if (at < text.length) parts.push(text.slice(at));
    return parts;
  }

  #svgOp(op: SvgOp): unknown {
    if (op.k === "text") {
      return svg`<text x=${op.x} y=${op.y} text-anchor=${op.anchor} fill=${op.fill} fill-opacity=${op.alpha ?? 1}
        font-size=${op.size} font-weight=${op.weight} letter-spacing=${op.spacing ?? 0}
        font-family=${`var(--mc-font-${op.font})`}>${op.text}</text>`;
    }
    if (op.k === "image") {
      return svg`<image href=${op.href} x=${op.x} y=${op.y} width=${op.w} height=${op.h} @error=${() => {
        this.#failed.add(op.href);
        this.requestUpdate();
      }}></image>`;
    }
    const fill = op.fill ?? "none";
    const stroke = op.stroke ?? "none";
    const width = op.sw ?? 1;
    const opacity = op.alpha ?? 1;
    const dash = op.dash ? `${op.dash[0]} ${op.dash[1]}` : "none";
    switch (op.k) {
      case "rect":
        return svg`<rect x=${op.x} y=${op.y} width=${op.w} height=${op.h} rx=${op.rx ?? 0} fill=${fill} stroke=${stroke} stroke-width=${width} stroke-dasharray=${dash} opacity=${opacity}></rect>`;
      case "circle":
        return svg`<circle cx=${op.cx} cy=${op.cy} r=${op.r} fill=${fill} stroke=${stroke} stroke-width=${width} stroke-dasharray=${dash} opacity=${opacity}></circle>`;
      case "line":
        return svg`<line x1=${op.x1} y1=${op.y1} x2=${op.x2} y2=${op.y2} stroke=${stroke} stroke-width=${width} stroke-dasharray=${dash} opacity=${opacity}></line>`;
      case "path":
        return svg`<path d=${op.d} fill=${fill} stroke=${stroke} stroke-width=${width} stroke-dasharray=${dash} opacity=${opacity}></path>`;
    }
  }

  /** The press that is on a slider's track now: where it began, and whether it turned into a drag or the page's scroll. */
  readonly #slides = new Map<string, { x: number; y: number; mode: "none" | "drag" | "scroll"; id: number }>();

  /**
   * The share of the bar a pointer is across, in the page's own pixels whatever the scale. The track's hit box is the
   * bar plus a knob's radius each side, so the bar starts `knob` in from its edge.
   */
  #shareAt(track: HTMLElement, clientX: number, knob: number): number {
    const box = track.getBoundingClientRect();
    const bar = box.width - knob * 2;
    return bar > 0 ? Math.min(1, Math.max(0, (clientX - box.left - knob) / bar)) : 0;
  }

  #emitSlide(key: string, share: number, commit: boolean): void {
    this.dispatchEvent(new CustomEvent("mc-slide", { detail: { key, share, commit }, bubbles: true, composed: true }));
  }

  #step(key: string, direction: -1 | 1): void {
    this.dispatchEvent(new CustomEvent("mc-step", { detail: { key, direction }, bubbles: true, composed: true }));
  }

  #slider(node: SheetSlider): unknown {
    const STEP = 36;
    const PERCENT = 50;
    const KNOB = 9;
    const upX = node.rect.width - PERCENT - STEP;
    const left = STEP + 10 + KNOB;
    const trackWidth = Math.max(0, upX - 10 - KNOB - left);
    const base = node.ground === "ink" ? "var(--mc-fill-paper, #f2ede0)" : "var(--mc-fill-ink, #14110e)";
    const key = node.key;
    const slop = 6;
    const mid = node.rect.height / 2;
    // The track's box is the bar plus a knob's radius each side, so a press on a knob that sits at either end still hits.
    const trackBox = (event: PointerEvent): HTMLElement => event.currentTarget as HTMLElement;
    const down = (event: PointerEvent): void => {
      this.#slides.set(key, { x: event.clientX, y: event.clientY, mode: "none", id: event.pointerId });
      // Held from the press on, so the release is heard wherever it lands and a press that leaves the track ends here.
      trackBox(event).setPointerCapture?.(event.pointerId);
    };
    const move = (event: PointerEvent): void => {
      const press = this.#slides.get(key);
      if (!press || press.id !== event.pointerId) return;
      // A mouse or pen moving with no button down is hovering: its press ended unseen, so nothing it does is a drag.
      if (event.buttons === 0 && event.pointerType !== "touch") {
        this.#slides.delete(key);
        return;
      }
      if (press.mode === "none") {
        const dx = Math.abs(event.clientX - press.x);
        const dy = Math.abs(event.clientY - press.y);
        if (dx <= slop && dy <= slop) return;
        // Up or down is the page's scroll; sideways is this slider's drag.
        press.mode = dy > dx ? "scroll" : "drag";
      }
      if (press.mode === "drag") this.#emitSlide(key, this.#shareAt(trackBox(event), event.clientX, KNOB), false);
    };
    const up = (event: PointerEvent): void => {
      const press = this.#slides.get(key);
      this.#slides.delete(key);
      if (!press || press.id !== event.pointerId || press.mode === "scroll") return;
      if (press.mode === "none") {
        // A tap: press and release both on the track.
        const box = trackBox(event).getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (!inside) return;
      }
      this.#emitSlide(key, this.#shareAt(trackBox(event), event.clientX, KNOB), true);
    };
    const cancel = (): void => {
      this.#slides.delete(key);
    };
    return html`<div
      class="part slider"
      data-key=${key}
      data-share=${node.share}
      style=${`${px(node.rect)}${node.dimmed ? ";opacity:.45" : ""}`}
    >
      <mc-button
        class="part"
        data-key=${`${key}:down`}
        style=${`left:0;top:0;width:${STEP}px;height:${node.rect.height}px`}
        kind="quiet"
        .label=${node.stepLabels[0]}
        @mc-press=${() => this.#step(key, -1)}
      ></mc-button>
      <div
        class="part slider-track"
        data-key=${`${key}:track`}
        style=${`left:${left - KNOB}px;top:0;width:${trackWidth + KNOB * 2}px;height:${node.rect.height}px`}
        @pointerdown=${down}
        @pointermove=${move}
        @pointerup=${up}
        @pointercancel=${cancel}
        @lostpointercapture=${cancel}
      >
        <div
          class="slider-bar"
          style=${`left:${KNOB}px;width:${trackWidth}px;top:${mid - 3}px;background:${base}`}
        ></div>
        <div class="slider-fill" style=${`left:${KNOB}px;width:${trackWidth * node.share}px;top:${mid - 3}px`}></div>
        <div class="slider-knob" style=${`left:${trackWidth * node.share}px;top:${mid - KNOB}px`}></div>
      </div>
      <mc-button
        class="part"
        data-key=${`${key}:up`}
        style=${`left:${upX}px;top:0;width:${STEP}px;height:${node.rect.height}px`}
        kind="quiet"
        .label=${node.stepLabels[1]}
        @mc-press=${() => this.#step(key, 1)}
      ></mc-button>
      <span class="part text slider-label" data-key=${`${key}:label`}>${node.label}</span>
    </div>`;
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
          node.round ? "border-radius:50%" : "",
        ].join(";");
        return html`<div class="part" data-key=${node.key ?? nothing} style=${style}></div>`;
      }
      case "dots": {
        const id = `dots-${node.spacing}-${node.radius}-${node.color.replace(/[^a-z0-9]/gi, "")}`;
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
          node.wrapWidth !== undefined
            ? `width:${node.wrapWidth}px;white-space:pre-wrap;overflow-wrap:anywhere`
            : "white-space:pre";
        const style = [
          `left:${node.x}px`,
          `top:${node.y}px`,
          `transform:translate(${-(node.anchorX ?? 0) * 100}%, ${-(node.anchorY ?? 0) * 100}%)${node.angle ? ` rotate(${node.angle}deg)` : ""}`,
          node.angle ? `transform-origin:${(node.anchorX ?? 0) * 100}% ${(node.anchorY ?? 0) * 100}%` : "",
          node.italic ? "font-style:italic" : "",
          node.strokeColor && node.strokeWidth
            ? `-webkit-text-stroke:${node.strokeWidth}px ${node.strokeColor};paint-order:stroke fill`
            : "",
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
          node.fitWidth !== undefined
            ? `max-width:${node.fitWidth}px;overflow:hidden${node.marks?.length ? ";text-overflow:ellipsis" : ""}`
            : "",
          node.maxLines
            ? `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${node.maxLines};overflow:hidden`
            : "",
        ].join(";");
        return html`<span
          class="part text"
          data-key=${node.key ?? nothing}
          data-fit=${node.fitWidth ?? nothing}
          data-size=${node.fitWidth !== undefined ? size : nothing}
          data-full=${node.fitWidth !== undefined ? node.text : nothing}
          style=${style}
          >${node.marks?.length ? this.#marked(node.text, node.marks) : node.text}</span
        >`;
      }
      case "button":
        return html`<mc-button
          class="part"
          data-key=${node.key}
          style=${`${px(node.rect)}${node.opacity !== undefined ? `;opacity:${node.opacity}` : ""}${node.size ? `;--mc-button-size:${node.size}px` : ""};--mc-label-shift:${node.labelShift ?? 0}px;--mc-label-ms:${node.labelShift ? GLYPH_EXPAND_MS : GLYPH_COLLAPSE_MS}ms`}
          kind=${node.look}
          .label=${node.label}
          ?selected=${node.selected ?? false}
          ?framed=${node.framed ?? false}
          ?display=${node.display ?? false}
          ?plain=${node.plain ?? false}
          ?still=${node.still ?? false}
          ?disabled=${node.disabled !== undefined}
          .reason=${typeof node.disabled === "string" ? node.disabled : ""}
          aria-keyshortcuts=${node.keyshortcuts ?? nothing}
          @mc-press=${() => this.#activate(node.key)}
        ></mc-button>`;
      case "tabRail":
        return html`<mc-tab-rail
          class="part"
          data-key=${node.key ?? nothing}
          style=${px(node.rect)}
          .tabs=${node.tabs}
          .selected=${node.selected}
          .size=${node.size}
          .prefix=${node.prefix ?? "tab:"}
        ></mc-tab-rail>`;
      case "pictureTile":
        return html`<mc-picture-tile
          class="part"
          data-key=${node.key ?? nothing}
          style=${px(node.rect)}
          .model=${node.model}
        ></mc-picture-tile>`;
      case "listRow":
        return html`<mc-list-row
          class="part"
          data-key=${node.key ?? nothing}
          style=${px(node.rect)}
          .model=${node.model}
        ></mc-list-row>`;
      case "emptyState":
        return html`<mc-empty-state
          class="part"
          style=${`left:${node.x}px;top:${node.y}px`}
          .text=${node.text}
          .size=${node.size ?? 14}
        ></mc-empty-state>`;
      case "chip":
        return html`<mc-aspect-chip
          class="part"
          data-key=${node.key ?? nothing}
          style=${`left:${node.x}px;top:${node.y}px`}
          aspect=${node.aspect}
          .label=${node.label}
          .height=${node.height ?? 18}
          .size=${node.size ?? 10}
        ></mc-aspect-chip>`;
      case "glyph":
        return html`<mc-glyph
          class="part"
          data-key=${node.key ?? nothing}
          style=${`left:${node.x}px;top:${node.y - node.height / 2}px${node.opacity !== undefined ? `;opacity:${node.opacity}` : ""}`}
          .specs=${node.specs}
          .height=${node.height}
          .ground=${node.ground}
          .openness=${node.openness}
          ?still=${node.still ?? false}
        ></mc-glyph>`;
      case "image": {
        const gone = node.src === null || this.#failed.has(node.src);
        const style = [
          px(node.rect),
          node.fill ? `background:${node.fill}` : "",
          node.color ? `color:${node.color}` : "",
        ].join(";");
        return html`<div
          class="part image"
          data-key=${node.key ?? nothing}
          data-hover=${node.hover ?? nothing}
          style=${style}
        >
          ${
            gone
              ? node.missing
                ? html`<span class="missing">${node.missing}</span>`
                : nothing
              : html`<img
                  src=${node.src!}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style=${
                    [
                      node.cover
                        ? `object-fit:cover;object-position:${node.cover.x * 100}% ${node.cover.y * 100}%`
                        : "",
                      node.dim ? "filter:grayscale(1);opacity:0.3" : "",
                    ].join(";") || nothing
                  }
                  draggable="false"
                  @load=${() => {
                    if (node.retry !== undefined) this.#retried.delete(node.retry);
                  }}
                  @error=${() => {
                    this.#failed.add(node.src!);
                    if (node.retry !== undefined && !this.#retried.has(node.retry)) {
                      this.#retried.add(node.retry);
                      this.dispatchEvent(
                        new CustomEvent("mc-image-error", {
                          detail: { key: node.retry, src: node.src },
                          bubbles: true,
                          composed: true,
                        }),
                      );
                    }
                    this.requestUpdate();
                  }}
                />`
          }
        </div>`;
      }
      case "halftone": {
        const circles: { x: number; y: number; r: number }[] = [];
        const { step, fade } = node;
        for (let row = 0; row * step < fade; row++) {
          const y = node.rect.height - row * step - step / 2;
          const r = Math.max(0.6, (step / 2) * (1 - (row * step) / fade) * 0.95);
          for (let x = (row % 2 ? step / 2 : 0) + step / 2; x < node.rect.width; x += step) circles.push({ x, y, r });
        }
        return html`<svg class="part" style=${px(node.rect)} aria-hidden="true">
          ${circles.map(
            ({ x, y, r }) =>
              svg`<circle cx=${x} cy=${y} r=${r} fill=${node.color} fill-opacity=${node.opacity}></circle>`,
          )}
        </svg>`;
      }
      case "poly": {
        const points = node.points.map(([x, y]) => `${x},${y}`).join(" ");
        const shape = node.fill
          ? svg`<polygon points=${points} fill=${node.fill} stroke=${node.stroke ?? "none"} stroke-width=${node.strokeWidth ?? 0}></polygon>`
          : svg`<polyline points=${points} fill="none" stroke=${node.stroke ?? "none"} stroke-width=${node.strokeWidth ?? 0}></polyline>`;
        return html`<svg
          class="part poly"
          style="left:0;top:0;width:1px;height:1px;overflow:visible"
          aria-hidden="true"
        >
          ${shape}
        </svg>`;
      }
      case "tap":
        return html`<div
          class="part tap"
          data-key=${node.key}
          data-hover=${node.hover ?? nothing}
          style=${px(node.rect)}
          @pointerenter=${node.track ? (event: PointerEvent) => this.#hover(node.key, true, event) : nothing}
          @pointerleave=${node.track ? (event: PointerEvent) => this.#hover(node.key, false, event) : nothing}
          ${tapped(() => this.#activate(node.key), node.inspect ? () => this.#inspect(node.key) : undefined)}
        ></div>`;
      case "qr": {
        const n = node.rows.length + node.border * 2;
        const path = node.rows
          .flatMap((row, r) =>
            [...row].flatMap((cell, c) => (cell === "1" ? [`M${c + node.border} ${r + node.border}h1v1h-1z`] : [])),
          )
          .join("");
        return html`<svg
          class="part"
          data-key=${node.key ?? nothing}
          style=${px(node.rect)}
          viewBox=${`0 0 ${n} ${n}`}
          shape-rendering="crispEdges"
          aria-hidden="true"
        >
          ${svg`<rect width=${n} height=${n} fill=${node.background}></rect><path d=${path} fill=${node.foreground}></path>`}
        </svg>`;
      }
      case "svg":
        return html`<svg
            class="part"
            data-key=${node.key ?? nothing}
            style=${px(node.rect)}
            viewBox=${`0 0 ${node.viewBox[0]} ${node.viewBox[1]}`}
            aria-hidden="true"
          >
            ${node.ops.map((op) => this.#svgOp(op))}</svg
          >${
            node.missing !== undefined && node.ops.some((op) => op.k === "image" && this.#failed.has(op.href))
              ? html`<div class="part image" style=${px(node.rect)}><span class="missing">${node.missing}</span></div>`
              : nothing
          }`;
      case "slider":
        return this.#slider(node);
      case "scroll":
        return html`<div class="part scroller" data-key=${node.key} style=${px(scrollBox(node))}>
          <div class="content" style=${`height:${node.height}px`}>
            ${repeat(node.nodes, keyOf, (child) => this.#node(child))}
          </div>
        </div>`;
    }
  }
}
