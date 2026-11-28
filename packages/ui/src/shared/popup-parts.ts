import { css, html, nothing, type TemplateResult } from "lit";
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
    class="hang"
    .specs=${glyph.specs}
    .height=${glyph.height}
    .ground=${glyph.ground}
    .openness=${glyph.openness}
    ?still=${glyph.still ?? false}
  ></mc-glyph>`;
}

/** A popup button: an `mc-button` that reports its press as `mc-activate`, with its glyph hung under it. */
export function popupButton(host: HTMLElement, button: PopupButton, glyph?: ControlGlyph): TemplateResult {
  return html`<div class="ctl">
    <mc-button
      data-key=${button.key}
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

/** The deep search every popup element's `elementOf` shares: its own part, else a child element that has it. */
export function findKey(root: ShadowRoot | Element, key: string): HTMLElement | null {
  const own = root.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
  if (own) return own;
  for (const child of root.querySelectorAll<HTMLElement & { elementOf?: (key: string) => HTMLElement | null }>("*")) {
    const found = child.elementOf?.(key);
    if (found) return found;
  }
  return null;
}

/** Styles for a popup button's wrapper and its hung glyph. */
export const PopupPartStyles = css`
  .ctl {
    position: relative;
    min-width: 0;
  }
  .ctl mc-button {
    height: 100%;
    --mc-button-size: 12px;
  }
  .hang {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 3;
    pointer-events: none;
  }
`;
