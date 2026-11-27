import { html, nothing, type TemplateResult } from "lit";
import type { TextLine } from "./text-line.types.js";

/** A size as CSS: the small sizes follow the client's desktop type bump. */
export const sizeCss = (size: number): string =>
  size <= 12 ? `var(--mc-small-${Math.round(size)}, ${size}px)` : `${size}px`;

/** A line as a template: a block `height` tall that `fitTextWithin` shrinks to its width. */
export function lineOf(line: TextLine): TemplateResult {
  const style = [
    `font-size:${sizeCss(line.size)}`,
    `height:${line.height}px`,
    `line-height:${line.height}px`,
    `font-weight:${line.weight ?? 400}`,
    line.opacity !== undefined ? `opacity:${line.opacity}` : "",
    line.label ? "text-transform:uppercase;letter-spacing:1.2px" : "",
  ].join(";");
  const floor = line.floor ?? nothing;
  const size = sizeCss(line.size);
  // One line, no whitespace inside the element: its text is what fits.
  return html`<div class="line" data-fit data-size=${size} data-floor=${floor} style=${style}>${line.text}</div>`;
}
