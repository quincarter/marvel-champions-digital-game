import type { Rect } from "./layout.js";

/** Below this box height a pile can't stack a name chip over a count chip without them overprinting each other. */
export const PILE_STACK_MIN_HEIGHT = 64;

export interface PileChips {
  /** The ink strip the pile's name sits on (over art, so it stays readable). */
  readonly name: Rect;
  /** The ink strip the count sits on. In `row` mode it shares the strip's row with `name`, to its right. */
  readonly count: Rect;
  readonly mode: "stacked" | "row";
}

/**
 * Where an encounter pile's name and count go. A tall box stacks the name chip at the top and the count at the
 * bottom; a short one (the encounter column splits its height among every pile) puts both on one strip along the
 * bottom, name left and count right, so neither is drawn over the other or left floating on bare art.
 */
export function pileChipsOf(box: Rect): PileChips {
  if (box.height >= PILE_STACK_MIN_HEIGHT) {
    return {
      mode: "stacked",
      name: { x: box.x + 3, y: box.y + 3, width: box.width - 6, height: 18 },
      count: { x: box.x + 4, y: box.y + box.height - 26, width: box.width - 8, height: 22 },
    };
  }
  // A compact row (under 20px) centers one strip with the same 2px of frame above and below; a taller one sits on the foot.
  const compactRow = box.height < 20;
  const height = compactRow ? Math.max(10, box.height - 4) : Math.min(22, Math.max(14, box.height - 6));
  const y = compactRow ? box.y + (box.height - height) / 2 : box.y + box.height - 3 - height;
  const countWidth = Math.min(32, Math.round((box.width - 6) * 0.22));
  return {
    mode: "row",
    name: { x: box.x + 3, y, width: box.width - 6 - countWidth, height },
    count: { x: box.x + box.width - 3 - countWidth, y, width: countWidth, height },
  };
}

/** The shortest a pile box may be: one 14px name-and-count strip with a pixel of ground around it. */
export const PILE_MIN_HEIGHT = 16;
/** A pile this tall keeps the art-and-chips look with its own 6px gap; below it the column goes to compact rows. */
export const PILE_ROOMY_HEIGHT = 24;

/**
 * One box per pile in the encounter column. Piles share the column's height; while each gets a roomy slot that is
 * the whole story. A busy scenario (Project Wideawake's second deck makes four) at a short window would squash
 * every slot into a sliver, so below `PILE_ROOMY_HEIGHT` the piles become compact one-line rows of at least
 * `PILE_MIN_HEIGHT`, and when even those do not fit in one column they pair up into a two-column grid.
 */
export function encounterPileSlots(rect: Rect, count: number): readonly Rect[] {
  if (count <= 0) return [];
  const roomy = (rect.height - 6 * (count - 1)) / count;
  if (roomy >= PILE_ROOMY_HEIGHT || count === 1) {
    return Array.from({ length: count }, (_unused, i) => ({
      x: rect.x,
      y: rect.y + i * (roomy + 6),
      width: rect.width,
      height: roomy,
    }));
  }
  const gap = 2;
  const rowHeight = (rect.height - gap * (count - 1)) / count;
  if (rowHeight >= PILE_MIN_HEIGHT) {
    return Array.from({ length: count }, (_unused, i) => ({
      x: rect.x,
      y: rect.y + i * (rowHeight + gap),
      width: rect.width,
      height: rowHeight,
    }));
  }
  const rows = Math.ceil(count / 2);
  const cellHeight = Math.max(PILE_MIN_HEIGHT, (rect.height - gap * (rows - 1)) / rows);
  const cellWidth = (rect.width - gap) / 2;
  return Array.from({ length: count }, (_unused, i) => ({
    x: rect.x + (i % 2) * (cellWidth + gap),
    y: rect.y + Math.floor(i / 2) * (cellHeight + gap),
    width: cellWidth,
    height: cellHeight,
  }));
}

/** The smallest set-aside footer: the count and the names on one line, when the panel is wide enough for that. */
export const SET_ASIDE_FOOTER_HEIGHT = 22;
const FOOTER_GAP = 6;
/** One caption line of the footer, and the padding above and below its lines. */
const FOOTER_LINE_HEIGHT = 13;
const FOOTER_PAD = 9;
/** Roughly how wide one uppercase caption character prints (9 px bold with its letter spacing), a bit high on purpose. */
const FOOTER_CHAR_WIDTH = 7.4;
/** There are only six genre sets, so seven lines is never reached; it keeps a bad width from growing the panel without end. */
const FOOTER_MAX_LINES = 7;

/**
 * The footer's lines: one line when it fits, else the count on the first and the set names wrapped onto as many lines as `width` needs, a name
 * never split ("SET ASIDE 2" / "SITCOM, WESTERN"). Nothing is cut: a player who set aside three genres can read
 * which remain. Names only, a few words each.
 */
export function setAsideLines(count: number, names: readonly string[], width: number): readonly string[] {
  const head = `SET ASIDE ${count}`;
  const capacity = Math.max(8, Math.floor((width - 12) / FOOTER_CHAR_WIDTH));
  const list = count === 0 || names.length === 0 ? "NONE LEFT" : names.join(", ").toUpperCase();
  // A wide panel (the phone's strip) keeps it all on one line: "SET ASIDE 2 · SITCOM, SCI-FI".
  if (`${head} · ${list}`.length <= capacity) return [`${head} · ${list}`];
  if (count === 0 || names.length === 0) return [head, list];
  const lines: string[] = [];
  let current = "";
  names.forEach((name, i) => {
    const token = `${name.toUpperCase()}${i < names.length - 1 ? "," : ""}`;
    if (current && current.length + 1 + token.length > capacity) {
      lines.push(current);
      current = token;
    } else current = current ? `${current} ${token}` : token;
  });
  if (current) lines.push(current);
  return [head, ...lines.slice(0, FOOTER_MAX_LINES - 1)];
}

/** How tall the footer is for `lines` (`setAsideLines`), never below the two-line minimum. */
export function setAsideFooterHeight(lines: readonly string[]): number {
  return Math.max(SET_ASIDE_FOOTER_HEIGHT, FOOTER_PAD + lines.length * FOOTER_LINE_HEIGHT);
}

export interface SetAsideSplit {
  /** The encounter column: whole, so the deck and discard keep the size they have without a footer. */
  readonly encounter: Rect;
  /** The log panel under it, shortened by the footer. Null when the layout shows no log beside the piles. */
  readonly log: Rect | null;
  /** Where the footer goes: the head of the log's space when there is a log, else the foot of the encounter column. */
  readonly footer: Rect;
}

/**
 * Where the set-aside footer (MojoMania's genre sets) sits. The deck and discard are the board's primary encounter
 * information, so the footer takes its height from the log panel beneath them when the layout has one. With no log
 * beside the piles (the phone's Enemies tab) it takes the foot of the encounter strip instead. `height` is the
 * footer's own (`setAsideFooterHeight`), so a longer name list grows the panel instead of being cut.
 */
export function splitSetAside(
  encounter: Rect,
  log: Rect | null,
  height: number = SET_ASIDE_FOOTER_HEIGHT,
): SetAsideSplit {
  const h = height;
  if (log && log.height > h + FOOTER_GAP + 40) {
    return {
      encounter,
      log: { ...log, y: log.y + h + FOOTER_GAP, height: log.height - h - FOOTER_GAP },
      footer: { x: log.x, y: log.y, width: log.width, height: h },
    };
  }
  const piles = { ...encounter, height: Math.max(0, encounter.height - h - FOOTER_GAP) };
  return { encounter: piles, log, footer: { ...encounter, y: encounter.y + piles.height + FOOTER_GAP, height: h } };
}
