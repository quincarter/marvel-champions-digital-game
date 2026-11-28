import { css, html, nothing, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { onTap } from "./tap.js";
import type { ActivateDetail, ControlGlyph, PopupButton, SlideDetail, StepDetail } from "./popup.types.js";

/** Raises `mc-activate` for the control `key` from `host`. */
export function activate(host: HTMLElement, key: string): void {
  host.dispatchEvent(
    new CustomEvent<ActivateDetail>("mc-activate", { detail: { key }, bubbles: true, composed: true }),
  );
}

export function slide(host: HTMLElement, detail: SlideDetail): void {
  host.dispatchEvent(new CustomEvent<SlideDetail>("mc-slide", { detail, bubbles: true, composed: true }));
}

export function step(host: HTMLElement, detail: StepDetail): void {
  host.dispatchEvent(new CustomEvent<StepDetail>("mc-step", { detail, bubbles: true, composed: true }));
}

/** Calls `handler` on a tap on `element` (the tap rule: press and release on it, nothing scrolled between). */
export function tapOn(element: Element | null | undefined, handler: () => void): (() => void) | null {
  return element instanceof HTMLElement ? onTap(element, handler) : null;
}

/** The glyph hung under a control (`right` edge on the control's), or nothing. */
export function hungGlyph(glyph: ControlGlyph | undefined): TemplateResult | typeof nothing {
  if (!glyph) return nothing;
  return html`<mc-glyph
    class=${glyph.place === "left" ? "hang left" : "hang"}
    .specs=${glyph.specs}
    .height=${glyph.height}
    .ground=${glyph.ground}
    .openness=${glyph.openness}
    ?still=${glyph.still ?? false}
  ></mc-glyph>`;
}

/** How far an inside glyph slides the word over to make room (the glyph is open and beside the word). */
function labelShift(glyph: ControlGlyph | undefined): number {
  if (!glyph || glyph.place === "left" || glyph.openness <= 0 || glyph.width === undefined) return 0;
  return Math.round(glyph.width / 2 + 4);
}

/** A popup button: an `mc-button` that reports its press as `mc-activate`, with its glyph hung under it. */
export function popupButton(host: HTMLElement, button: PopupButton, glyph?: ControlGlyph): TemplateResult {
  return html`<div class="ctl">
    <mc-button
      data-stop=${button.key}
      style=${styleMap({ "--mc-label-shift": `${labelShift(glyph)}px` })}
      kind=${button.kind}
      .label=${button.label}
      ?selected=${button.selected ?? false}
      ?disabled=${button.disabled !== undefined}
      .reason=${button.disabled ?? ""}
      @mc-press=${() => activate(host, button.key)}
    ></mc-button
    >${hungGlyph(glyph)}
  </div>`;
}

/** Styles for a popup button's wrapper and its hung glyph. */
export const PopupPartStyles = css`
  .ctl {
    position: relative;
    min-width: 0;
    height: 100%;
  }
  .ctl mc-button {
    height: 100%;
    --mc-button-size: 12px;
  }
  .hang {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 3;
    pointer-events: none;
  }
  .hang.left {
    left: auto;
    right: calc(100% + 6px);
  }
`;
