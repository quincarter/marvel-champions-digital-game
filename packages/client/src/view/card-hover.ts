/**
 * The card hover popover's rules (desktop mouse only): when it may show, how big the card is drawn, where it sits
 * against the pointer, and which words describe the card's state beside it. Pure and tested; `scenes/board/hover-preview.ts`
 * draws what this decides. It reads state and never changes it: the popover takes no input.
 */
import { cardHoverFactor, type CardHoverScale } from "../settings.js";
import type { FormFactor, Rect } from "./layout.js";

/** How long the pointer rests on a card before the popover opens, so sweeping across the table flashes nothing. */
export const HOVER_DELAY_MS = 300;
/** Gap between the pointer and the popover's near edge. */
export const HOVER_CURSOR_OFFSET = 22;
/** The popover never comes closer than this to the edge of its area. */
export const HOVER_MARGIN = 8;
/** A tiny on-table chip is never blown up to less than this wide, or "3x" of a thumbnail would still be unreadable. */
export const HOVER_MIN_WIDTH = 220;

export interface HoverGate {
  readonly formFactor: FormFactor;
  /** The pointer is a mouse (or pen), not a finger: a touch has long-press Inspect instead. */
  readonly mouse: boolean;
  readonly scale: CardHoverScale;
  /** Keys of every scene running over the Board, Board itself excluded. */
  readonly overlays: readonly string[];
  /** The scene key of the villain phase, so the one overlay allowed to coexist can be told from the rest. */
  readonly villainPhaseKey: string;
  /** Where the docked villain phase panel draws (`Board.villainDockRects().panel`); null when it is not docked. */
  readonly dockPanel: Rect | null;
  readonly viewport: Rect;
}

/**
 * The area the popover may use, or null when it must not show at all.
 *
 * Off on every form factor but desktop, for a touch pointer, with the setting off, and whenever any overlay is up over
 * the table. The one exception is the villain phase while docked beside the table: the table stays live, and the
 * popover keeps to the table's side of the panel.
 */
export function hoverArea(gate: HoverGate): Rect | null {
  if (gate.formFactor !== "desktop" || !gate.mouse || cardHoverFactor(gate.scale) === null) return null;
  const villain = gate.overlays.includes(gate.villainPhaseKey);
  const others = gate.overlays.filter((key) => key !== gate.villainPhaseKey);
  if (others.length > 0) return null;
  if (!villain) return gate.viewport;
  const panel = gate.dockPanel;
  if (!panel) return null;
  const right = Math.min(gate.viewport.x + gate.viewport.width, panel.x);
  return right > gate.viewport.x ? { ...gate.viewport, width: right - gate.viewport.x } : null;
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function overlapRatio(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  return inter / (a.width * a.height + b.width * b.height - inter);
}

/**
 * The card under the pointer. `topmost` is the bounds of the topmost interactive thing at the pointer (null when
 * nothing interactive is there): a card only counts when that is its own tap target, so a card with a button, a
 * sheet or another card drawn over it is not hovered through it. Where several cards' rects hold the point (a
 * stack, a chip inside a panel), the one the topmost thing is shaped like wins.
 */
export function hoverCandidateAt<Id>(
  x: number,
  y: number,
  hitRects: ReadonlyMap<Id, Rect>,
  topmost: Rect | null,
): Id | null {
  if (!topmost) return null;
  let best: Id | null = null;
  let bestRatio = 0.6;
  for (const [id, rect] of hitRects) {
    if (!rectContains(rect, x, y)) continue;
    const ratio = overlapRatio(rect, topmost);
    if (ratio > bestRatio) {
      best = id;
      bestRatio = ratio;
    }
  }
  return best;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * The popover card's size: the scan fitted into the card's on-table rect, times the setting, never under
 * `HOVER_MIN_WIDTH` wide and never larger than the area (less its margins). `aspect` is the scan's width over height;
 * without one the on-table rect's own shape stands in.
 */
export function hoverCardSize(
  cardRect: Rect,
  aspect: number | null,
  scale: CardHoverScale,
  area: Rect,
  margin: number = HOVER_MARGIN,
): Size {
  const factor = cardHoverFactor(scale) ?? 1;
  const ratio = aspect !== null && aspect > 0 ? aspect : cardRect.width / Math.max(1, cardRect.height);
  const baseWidth = Math.min(cardRect.width, cardRect.height * ratio);
  let width = Math.max(HOVER_MIN_WIDTH, baseWidth * factor);
  let height = width / ratio;
  const maxWidth = Math.max(1, area.width - margin * 2);
  const maxHeight = Math.max(1, area.height - margin * 2);
  const fit = Math.min(1, maxWidth / width, maxHeight / height);
  width *= fit;
  height *= fit;
  return { width, height };
}

/**
 * Where the popover's top-left goes: beside the pointer on the right with a gap, flipped to the left when it would
 * run off, centered on the pointer vertically, then clamped inside the area. The clamp is the last word, so nothing
 * ever leaves the area; when it can't clear the pointer on either side it simply stays inside.
 */
export function hoverPlacement(
  cursor: { readonly x: number; readonly y: number },
  size: Size,
  area: Rect,
  offset: number = HOVER_CURSOR_OFFSET,
  margin: number = HOVER_MARGIN,
): { readonly x: number; readonly y: number } {
  const left = area.x + margin;
  const right = area.x + area.width - margin;
  const top = area.y + margin;
  const bottom = area.y + area.height - margin;
  let x = cursor.x + offset;
  if (x + size.width > right) x = cursor.x - offset - size.width;
  let y = cursor.y - size.height / 2;
  x = Math.max(left, Math.min(x, Math.max(left, right - size.width)));
  y = Math.max(top, Math.min(y, Math.max(top, bottom - size.height)));
  return { x, y };
}

export interface HoverStateInput {
  readonly exhausted: boolean;
  /** `InspectModel.damageNote`: "3/5 damage" against a card's own threshold. */
  readonly damageNote: string | null;
  readonly damage: number;
  /** `InspectModel.threatNote`. */
  readonly threatNote: string | null;
  readonly threat: number;
  readonly counterNote: string | null;
  readonly statuses: { readonly stunned: number; readonly confused: number; readonly tough: number };
  readonly attachments: number;
}

/** The state beside the popover card, one plain phrase each (never colour alone), in the order a player scans them. */
export function hoverStateLines(state: HoverStateInput): string[] {
  const lines: string[] = [];
  if (state.exhausted) lines.push("Exhausted");
  const damage = state.damageNote ?? (state.damage > 0 ? `${state.damage} damage` : null);
  if (damage) lines.push(damage);
  const threat = state.threatNote ?? (state.threat > 0 ? `${state.threat} threat` : null);
  if (threat) lines.push(threat);
  if (state.counterNote) lines.push(state.counterNote);
  for (const [name, count] of [
    ["Stunned", state.statuses.stunned],
    ["Confused", state.statuses.confused],
    ["Tough", state.statuses.tough],
  ] as const) {
    if (count > 0) lines.push(count > 1 ? `${name} ×${count}` : name);
  }
  if (state.attachments > 0) lines.push(`${state.attachments} attached`);
  return lines;
}
