import { McSheet } from "./McSheet.js";

if (!customElements.get("mc-sheet")) customElements.define("mc-sheet", McSheet);

declare global {
  interface HTMLElementTagNameMap {
    "mc-sheet": McSheet;
  }
}

export { McSheet };
export type {
  SheetBox,
  SheetButton,
  SheetDots,
  SheetGlyph,
  SheetHalftone,
  SheetImage,
  SheetNode,
  SheetPoly,
  SheetQr,
  SheetRect,
  SheetScroll,
  SheetSlider,
  SheetSvg,
  SheetTap,
  SheetText,
  SvgOp,
  SvgStyle,
} from "./McSheet.js";
