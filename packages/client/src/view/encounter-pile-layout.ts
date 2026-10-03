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
  const height = Math.min(22, Math.max(14, box.height - 6));
  const y = box.y + box.height - 3 - height;
  const countWidth = Math.min(32, Math.round((box.width - 6) * 0.22));
  return {
    mode: "row",
    name: { x: box.x + 3, y, width: box.width - 6 - countWidth, height },
    count: { x: box.x + box.width - 3 - countWidth, y, width: countWidth, height },
  };
}

/** The one-line set-aside footer: "SET ASIDE 1 · SITCOM". */
export const SET_ASIDE_FOOTER_HEIGHT = 22;
const FOOTER_GAP = 6;

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
 * information, so the footer takes its one line from the log panel beneath them when the layout has one. With no log
 * beside the piles (the phone's Enemies tab) it takes the foot of the encounter strip instead.
 */
export function splitSetAside(encounter: Rect, log: Rect | null): SetAsideSplit {
  const h = SET_ASIDE_FOOTER_HEIGHT;
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

/**
 * The footer's single line: the count is always kept, the names are cut to `nameChars` characters with an ellipsis.
 * "SET ASIDE 2 · CRIME, SCI-FI", "SET ASIDE 1 · SITCOM", "SET ASIDE 0 · NONE LEFT".
 */
export function setAsideLine(count: number, names: readonly string[], nameChars = 99): string {
  const head = `SET ASIDE ${count}`;
  const list = count === 0 || names.length === 0 ? "none left" : names.join(", ");
  const cut = list.length > nameChars ? `${list.slice(0, Math.max(1, nameChars - 1)).trimEnd()}…` : list;
  return `${head} · ${cut}`.toUpperCase();
}
