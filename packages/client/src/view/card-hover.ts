/**
 * The card hover popover's rules (desktop mouse only): when it may show, how big the card is drawn, where it sits
 * against the pointer, and which words describe the card's state beside it. Pure and tested; `ui/card-hover-preview.ts`
 * draws what this decides. It reads state and never changes it: the popover takes no input.
 */
import { cardHoverFactor, type CardHoverScale } from "../settings.js";
import type { CardFace } from "../art/art-source.js";
import type { FormFactor, Rect } from "./layout.js";

/** How long the pointer rests on a card before the popover opens, so sweeping across the table flashes nothing. */
export const HOVER_DELAY_MS = 300;
/** Gap between the pointer and the popover's near edge. */
export const HOVER_CURSOR_OFFSET = 22;
/** The popover never comes closer than this to the edge of its area. */
export const HOVER_MARGIN = 8;

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

/**
 * The villain phase's own cards (the enemy, the revealed encounter card, the interrupt card, the recap's thumbnails):
 * the same desktop-and-mouse rule, and nothing over the phase. The choice sheet does not count: while it is above the
 * phase the phase takes no input, and while it is under the phase it is hidden. The popover may use the whole screen.
 */
export function villainHoverArea(gate: {
  readonly formFactor: FormFactor;
  readonly mouse: boolean;
  readonly scale: CardHoverScale;
  /** Keys of every scene running over the villain phase that is not the choice sheet. */
  readonly overlays: readonly string[];
  readonly viewport: Rect;
}): Rect | null {
  if (gate.formFactor !== "desktop" || !gate.mouse || cardHoverFactor(gate.scale) === null) return null;
  return gate.overlays.length > 0 ? null : gate.viewport;
}

/**
 * A card shown at least this tall on the table is readable as it is: no popover (the owner, 2026-10-14, on the hero
 * card, "HUGE on desktop as a full sized card"). The same goes for the villain phase's revealed card.
 */
export const HOVER_SKIP_HEIGHT = 230;

/** Whether a card drawn at `onTable` is small enough to be worth a larger copy. */
export function hoverWorthShowing(onTable: Rect): boolean {
  return onTable.height < HOVER_SKIP_HEIGHT;
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

/**
 * A plain card on a deck screen (no game, no instance) noted for the popover. `through` marks a card shown inside a
 * host that is itself the tap target: a pool grid cell inside a list that handles the tap by pointer position (no
 * interactive object at all), or a deck row's thumbnail inside the row's own button. Its popover opens when nothing
 * interactive is under the pointer, or when the topmost interactive thing is a host holding the whole card.
 */
export interface HoverCardIdRect extends Rect {
  /** The card shown. The map is keyed by a unique slot (`hoverSlotOf`), not by card id: one hero fills several deck rows. */
  readonly cardId: string;
  /** The face to show when it is not the card's default (`defaultFaceFor`): a villain stage, a scheme's B side. */
  readonly face?: CardFace;
  readonly through?: boolean;
}

/** A slot key for one place a card is drawn: stable across redraws and scrolls when `where` is (a row index, a grid index). */
export const hoverSlotOf = (cardId: string, where: string | number): string => `${cardId}@${where}`;

/** The popover's own key for a plain-card slot: it must never equal an instance id, so the two share one pending/shown slot. */
const CARD_KEY_PREFIX = "card-id:";
export const hoverKeyOfCardId = (slot: string): string => `${CARD_KEY_PREFIX}${slot}`;
/** The slot a `hoverKeyOfCardId` key names, or null for an instance key. */
export const slotOfHoverKey = (key: string): string | null =>
  key.startsWith(CARD_KEY_PREFIX) ? key.slice(CARD_KEY_PREFIX.length) : null;

/**
 * The part of a card's rect that is inside the viewport of the scrolling list (or region) it sits in, or null when none
 * of it is: a card scrolled out of the list's window, or only its overscan row, has no popover, and the pointer is
 * only "over" the part the player can see.
 */
export function clipHoverRect(rect: Rect, viewport: Rect): Rect | null {
  const x = Math.max(rect.x, viewport.x);
  const y = Math.max(rect.y, viewport.y);
  const right = Math.min(rect.x + rect.width, viewport.x + viewport.width);
  const bottom = Math.min(rect.y + rect.height, viewport.y + viewport.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

/**
 * The indexes of a uniform-row list's rows with any pixel inside its viewport, given its scroll `offset`: what a list
 * walks to build its on-screen card rects on each pointer move without visiting all of a large pool. Half-open.
 */
export function visibleRowRange(
  offset: number,
  rowHeight: number,
  viewHeight: number,
  count: number,
): { readonly start: number; readonly end: number } {
  if (rowHeight <= 0 || count <= 0 || viewHeight <= 0) return { start: 0, end: 0 };
  const start = Math.max(0, Math.floor(offset / rowHeight));
  const end = Math.min(count, Math.ceil((offset + viewHeight) / rowHeight));
  return { start, end: Math.max(start, end) };
}

/** Whether a `through` card may be hovered under the topmost interactive bounds: nothing there, or a host that holds it. */
export function hoverThroughHost(card: Rect, topmost: Rect | null, slack = 2): boolean {
  if (!topmost) return true;
  return (
    topmost.x <= card.x + slack &&
    topmost.y <= card.y + slack &&
    topmost.x + topmost.width >= card.x + card.width - slack &&
    topmost.y + topmost.height >= card.y + card.height - slack
  );
}

/**
 * The slot of the plain card under the pointer. Cards that are their own tap target follow `hoverCandidateAt`'s shape rule; `through`
 * cards (see `HoverCardIdRect`) are allowed to sit under their host's zone or under no zone at all.
 */
export function hoverCardIdAt(
  x: number,
  y: number,
  cards: ReadonlyMap<string, HoverCardIdRect>,
  topmost: Rect | null,
): string | null {
  const own = new Map<string, Rect>();
  for (const [id, rect] of cards) if (!rect.through) own.set(id, rect);
  const found = hoverCandidateAt(x, y, own, topmost);
  if (found !== null) return found;
  for (const [id, rect] of cards) {
    if (rect.through && rectContains(rect, x, y) && hoverThroughHost(rect, topmost)) return id;
  }
  return null;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * The long side of the card the setting multiplies: a desktop hand card's height. Every card blows up to the same
 * size whatever it is drawn at on the table (the owner, 2026-10-14: the villain and the hero came up far larger than
 * a hand card at the same setting, because their on-table size was what got multiplied).
 */
export const HOVER_BASE_LONG_SIDE = 168;

/**
 * The popover card's size: a card whose long side is `HOVER_BASE_LONG_SIDE` times the setting, in the scan's shape
 * (a sideways scheme's long side is its width), never larger than the area less its margins. `aspect` is the scan's
 * width over height; without one the on-table rect's own shape stands in.
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
  const longSide = HOVER_BASE_LONG_SIDE * factor;
  let width = ratio >= 1 ? longSide : longSide * ratio;
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
