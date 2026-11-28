import { surface, typeRole } from "../../../tokens.js";
import { bangers } from "../../../ui/campaign-chrome.js";
import { caseOf } from "../../../ui/theme.js";
import { SheetBuilder } from "../../../dom/sheet-builder.js";

const TAG_TILT = -0.04;
const TAG_FILL = 0xf2b01e;

/** A rectangle's corners turned by `angle` radians about its own center. */
function turnedCorners(cx: number, cy: number, width: number, height: number, angle: number): [number, number][] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (
    [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [width / 2, height / 2],
      [-width / 2, height / 2],
    ] as const
  ).map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
}

/**
 * A box name split into two roughly-balanced lines by word count ("The Rise of Red Skull" → "THE RISE" / "OF RED
 * SKULL") — tries every split point and keeps whichever leaves the two lines closest in length. A one-word name
 * (or an empty one) returns an empty second line.
 */
export function balancedTwoLines(name: string): readonly [string, string] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [name, ""];
  let best = { at: 1, score: Number.POSITIVE_INFINITY };
  for (let at = 1; at < words.length; at++) {
    const a = words.slice(0, at).join(" ");
    const b = words.slice(at).join(" ");
    const score = Math.abs(a.length - b.length);
    if (score < best.score) best = { at, score };
  }
  return [words.slice(0, best.at).join(" "), words.slice(best.at).join(" ")];
}

/** The tilted yellow tag ("A story in five issues") — turned about its own center, not the world origin, so a
 * small angle reads as a local tilt in place rather than shifting the whole tag toward (0,0). */
export function drawTag(b: SheetBuilder, x: number, bottomY: number, text: string): void {
  const type = { ...typeRole.emphasis, size: 12 };
  const label = text.toLocaleUpperCase();
  const width = b.measure(label, type, { letterSpacing: 0.5 }).width + 20;
  const height = 26;
  const cx = x + width / 2;
  const cy = bottomY - height / 2;
  b.poly(turnedCorners(cx, cy, width, height, TAG_TILT), { fill: TAG_FILL });
  b.text(cx, cy, label, type, {
    color: surface.ink.hex,
    letterSpacing: 0.5,
    origin: [0.5, 0.5],
    angle: (TAG_TILT * 180) / Math.PI,
  });
}

/** The box chip: the code and "Campaign box" in a 1.5px paper outline. */
export function drawChip(b: SheetBuilder, x: number, y: number, text: string, alignRightTo?: number): void {
  const label = caseOf(typeRole.label, text.toLocaleUpperCase());
  const width = b.measure(label, typeRole.label, { letterSpacing: 1 }).width + 20;
  const left = alignRightTo === undefined ? x : alignRightTo - width;
  b.box({ x: left + 0.5, y: y + 0.5, width: width - 1, height: 25 }, { stroke: surface.paper.hex, strokeWidth: 1.5 });
  b.text(left + 10, y + 6, label, typeRole.label, { color: surface.paper.hex, letterSpacing: 1 });
}

/**
 * The huge two-line Bangers title ("THE RISE / OF RED SKULL"): split the box name into two roughly-balanced
 * lines by word count, then size both to fit — big enough to nearly fill the space given it (the tile draws it
 * at ~45% of the panel's own height on desktop; over the art's bottom edge on phone), never past the given
 * width. `anchor: "bottom"` reads `y` as where the block's own bottom edge should land (the phone composition,
 * where the title sits just above the blurb rather than growing down from a fixed top). Returns the block's
 * total height.
 */
export function drawBalancedTitle(
  b: SheetBuilder,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  name: string,
  anchor: "top" | "bottom" = "top",
): number {
  const [line1, line2] = balancedTwoLines(name);
  const lineHeight = 0.86;
  const startSize = Math.min(96, maxHeight / (line2 ? 2 * lineHeight : lineHeight));
  const first = line1.toLocaleUpperCase();
  const second = line2.toLocaleUpperCase();
  // Both lines take the size the wider one needs (the width a Bangers line takes is linear in its size).
  let size = startSize;
  for (const line of [first, second]) {
    if (!line) continue;
    const width = b.measure(line, bangers(startSize, lineHeight)).width;
    if (width > maxWidth) size = Math.min(size, Math.floor((startSize * maxWidth) / width));
  }
  const spec = bangers(size, lineHeight);
  const firstHeight = b.measure(first, spec).height;
  const secondHeight = second ? b.measure(second, spec).height : 0;
  const total = firstHeight + secondHeight;
  const top = anchor === "bottom" ? y - total : y;
  b.text(x, top, first, spec, { color: surface.paper.hex, fitWidth: maxWidth });
  if (second) b.text(x, top + firstHeight, second, spec, { color: surface.paper.hex, fitWidth: maxWidth });
  return total;
}
