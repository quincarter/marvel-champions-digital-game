/**
 * A button in an aspect's own colors (the aspect chips, the precon rows, the card pool's filter chips) as `mc-sheet`
 * parts: a box in the stamp's fill, its name in the stamp's ink, a heavier outline while chosen, and a tap area over it.
 * A tint is a fill, so what is chosen is also said by the outline and a tick, never by the color alone.
 */
import { surface, typeRole, type TypeSpec } from "../tokens.js";
import { caseOf } from "../ui/theme.js";
import type { Rect } from "../view/layout.js";
import type { SheetBuilder } from "./sheet-builder.js";

export interface TintColors {
  readonly fill: number;
  readonly ink: number;
}

export function drawTintButton(
  b: SheetBuilder,
  key: string,
  rect: Rect,
  text: string,
  tint: TintColors,
  options: { readonly selected?: boolean; readonly disabled?: string | true; readonly type?: TypeSpec } = {},
): void {
  const off = options.disabled !== undefined;
  b.box(rect, {
    fill: tint.fill,
    stroke: surface.ink.hex,
    strokeWidth: options.selected ? 5 : 2,
    ...(off ? { alpha: 0.5 } : {}),
  });
  b.text(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    caseOf(options.type ?? typeRole.stamp, text),
    options.type ?? typeRole.stamp,
    {
      color: tint.ink,
      origin: [0.5, 0.5],
      fitWidth: rect.width - 12,
      ...(off ? { alpha: 0.5 } : {}),
    },
  );
  // The tick is its own mark beside the name, so what is chosen is said by the tick and the heavy outline.
  if (options.selected)
    b.text(rect.x + 10, rect.y + rect.height / 2, "✓", typeRole.rowTitle, {
      color: tint.ink,
      origin: [0, 0.5],
      ...(off ? { alpha: 0.5 } : {}),
    });
  b.tap(key, rect);
}
