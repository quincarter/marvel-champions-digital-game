import { svg, type SVGTemplateResult } from "lit";
import type { SvgOp } from "./sheet.types.js";

/**
 * One drawn shape of a drawing (`SvgOp`) as an SVG template: the one renderer `mc-sheet` and `mc-controller-diagram`
 * share. `onImageError` hears an `image` op whose picture failed to load (the part says it is missing).
 */
export function svgOpTemplate(op: SvgOp, onImageError?: (href: string) => void): SVGTemplateResult {
  if (op.k === "text") {
    return svg`<text x=${op.x} y=${op.y} text-anchor=${op.anchor} fill=${op.fill} fill-opacity=${op.alpha ?? 1}
        font-size=${op.size} font-weight=${op.weight} letter-spacing=${op.spacing ?? 0}
        font-family=${`var(--mc-font-${op.font})`}>${op.text}</text>`;
  }
  if (op.k === "image") {
    return svg`<image href=${op.href} x=${op.x} y=${op.y} width=${op.w} height=${op.h} @error=${() =>
      onImageError?.(op.href)}></image>`;
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
