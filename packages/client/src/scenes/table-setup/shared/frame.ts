/**
 * What every section of Set up the table shares while it is drawn into one sheet: the builder, the registry of presses
 * (an action and a focus stop per control, the card pictures the hover popover reads) and the few drawing primitives
 * every card, chip and heading uses. It holds no screen state: a section is handed what it shows and the events it raises.
 */
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import type { PackLeases } from "../../../art/pack-art.js";
import type { FocusStop } from "../../focus-route.js";
import type { Rect } from "../../../view/layout.js";
import { accent, ink, surface, typeRole, type TypeSpec } from "../../../tokens.js";
import type { FaceRef } from "../../../view/civil-war-builder-art.js";

/** A card picture the hover popover (and hold-Y zoom) can enlarge, found by its key in the sheet. */
export interface HoverFace {
  readonly key: string;
  readonly cardId: string;
  readonly face?: FaceRef["face"];
  /** The scroller the picture moves in (its viewport clips the hover), or null. */
  readonly scroll: string | null;
}

/** The presses and pictures one draw registered; the scene reads them back to wire the sheet and the focus route. */
export class Registry {
  readonly actions = new Map<string, () => void>();
  readonly inspects = new Map<string, () => void>();
  readonly stops = new Map<string, FocusStop>();
  readonly faces: HoverFace[] = [];
  /** A stop's key to the key of the picture hold-Y enlarges. */
  readonly zoom = new Map<string, string>();
  /** The live screen rect of a keyed part of the sheet (null before it is mounted), set by the scene. */
  live: (key: string) => Rect | null = () => null;
  /** Brings a keyed part into view in its scroller. */
  reveal: (key: string) => void = () => undefined;
}

/** What every section draws into: the sheet's builder, the registry of presses and pictures, and the held pictures. */
export interface Frame {
  readonly b: SheetBuilder;
  readonly reg: Registry;
  readonly leases: PackLeases;
  /** The same frame drawing into another builder (a scroller's own). */
  readonly into: (b: SheetBuilder) => Frame;
}

/** A press area at `rect` with its focus stop: a tap does what Enter does. A scroller's parts name it, so the ring follows. */
export function press(
  c: Frame,
  key: string,
  rect: Rect,
  run: () => void,
  o: {
    readonly scroll?: string | undefined;
    readonly inspect?: () => void;
    /** No tap area: the control draws its own (a sheet button). */
    readonly noTap?: boolean;
    /** No focus stop: a second area of a control that has one. */
    readonly noStop?: boolean;
  } = {},
): void {
  if (!o.noTap) c.b.tap(key, rect, o.inspect ? { inspect: true } : {});
  c.reg.actions.set(key, run);
  if (o.inspect) c.reg.inspects.set(key, o.inspect);
  if (o.noStop) return;
  const scroll = o.scroll;
  c.reg.stops.set(key, {
    rect: () => c.reg.live(key) ?? rect,
    activate: run,
    ...(o.inspect ? { inspect: o.inspect } : {}),
    ...(scroll ? { view: () => c.reg.live(scroll) ?? rect, ensureVisible: () => c.reg.reveal(key) } : {}),
  });
}

/** A quiet sheet button with its action and focus stop. */
export function button(
  c: Frame,
  key: string,
  rect: Rect,
  label: string,
  run: () => void,
  o: {
    readonly look?: "quiet" | "onInk" | "primary";
    readonly type?: TypeSpec;
    readonly scroll?: string | undefined;
    readonly disabled?: boolean;
  } = {},
): void {
  c.b.button({
    key,
    rect,
    label,
    look: o.look ?? "quiet",
    type: o.type ?? typeRole.label,
    ...(o.disabled ? { disabled: true } : {}),
  });
  press(c, key, rect, run, { noTap: true, scroll: o.scroll });
}

/** A card's white ground and border: 4px Hero Red when chosen, a thin ink outline otherwise (never a fill). */
export function cardFrame(b: SheetBuilder, rect: Rect, selected: boolean): void {
  b.box(rect, { fill: surface.card.hex });
  if (selected) b.box(inset(rect, 2), { stroke: accent.heroRed.hex, strokeWidth: 4 });
  else b.box(inset(rect, 0.75), { stroke: surface.ink.hex, strokeWidth: 1.5, alpha: ink.label });
}

export const inset = (r: Rect, d: number): Rect => ({
  x: r.x + d,
  y: r.y + d,
  width: r.width - 2 * d,
  height: r.height - 2 * d,
});

/** A Bangers name at `size`, shrunk to `width`. */
export function nameText(
  b: SheetBuilder,
  x: number,
  y: number,
  width: number,
  text: string,
  size: number,
  alpha = 1,
  color: number = surface.ink.hex,
): ReturnType<SheetBuilder["text"]> {
  return b.text(x, y, text, { ...typeRole.sectionHeader, size }, { color, alpha, fitWidth: width, size });
}

/** A small label line (capitals, dimmed). */
export const labelText = (
  b: SheetBuilder,
  x: number,
  y: number,
  text: string,
  color: number,
  o: {
    alpha?: number;
    fitWidth?: number;
    wrapWidth?: number;
    maxLines?: number;
    origin?: readonly [number, number];
  } = {},
) => b.text(x, y, text, typeRole.label, { color, alpha: o.alpha ?? ink.label, ...o });

/** A segment (a difficulty, a chip): ink fill with paper words when chosen, paper with ink words otherwise. */
export function segment(
  b: SheetBuilder,
  rect: Rect,
  label: string,
  selected: boolean,
  size: number,
  enabled = true,
): void {
  b.box(rect, { fill: selected ? surface.ink.hex : surface.card.hex, alpha: enabled ? 1 : 0.5 });
  b.box(inset(rect, 1), { stroke: surface.ink.hex, strokeWidth: 2, alpha: enabled ? 1 : ink.disabled });
  b.text(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    label,
    { ...typeRole.sectionHeader, size },
    {
      color: selected ? surface.paper.hex : surface.ink.hex,
      alpha: enabled ? 1 : ink.disabled,
      origin: [0.5, 0.5],
      fitWidth: rect.width - 8,
      size,
    },
  );
}

/** A checkbox at a row's left edge, vertically centred: `checkedColor` red on the required row, ink on a candidate. */
export function checkbox(b: SheetBuilder, row: Rect, height: number, checked: boolean, checkedColor: number): Rect {
  const box: Rect = { x: row.x + 11, y: row.y + (height - 24) / 2, width: 24, height: 24 };
  b.box(box, { stroke: checkedColor === accent.heroRed.hex ? surface.paper.hex : surface.ink.hex, strokeWidth: 2 });
  if (checked) {
    b.box(inset(box, 2), { fill: checkedColor });
    b.text(
      box.x + 12,
      box.y + 12,
      "✓",
      { ...typeRole.label, size: 13 },
      { color: surface.paper.hex, origin: [0.5, 0.5], size: 13 },
    );
  }
  return box;
}

/** A section heading: Bangers 19, a rule after it, an optional right label (the heading shrinks, never overlaps it). */
export function heading(
  b: SheetBuilder,
  x: number,
  y: number,
  width: number,
  text: string,
  color: number,
  right?: string,
): void {
  let rightWidth = 0;
  if (right) {
    const r = labelText(b, x + width, y + 11, right, color, { origin: [1, 0.5] } as never);
    rightWidth = r.width + 14;
  }
  const room = Math.max(10, width - rightWidth - (right ? 10 : 0));
  const title = b.text(x, y, text, typeRole.barTitle, { color, size: 19, fitWidth: room });
  const ruleX = x + Math.min(title.width, room) + 10;
  const ruleEnd = x + width - rightWidth;
  if (ruleX < ruleEnd) b.box({ x: ruleX, y: y + 8, width: ruleEnd - ruleX, height: 3 }, { fill: color });
}
