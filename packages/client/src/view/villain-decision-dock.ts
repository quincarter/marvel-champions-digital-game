/**
 * A decision answered beside the table during the villain phase (#231): a revealed card's "choose one" (Hydra Bomber),
 * a target, an order. The docked phase keeps a header row of its own (which phase this is, a way to see the whole
 * table, and EXPAND for the full-screen sheet) and hands the rest of its panel to the choice sheet
 * (`view/choice-dock.ts`), which draws there without a scrim, so the table beside it stays readable.
 *
 * Pure: `scenes/villain-phase.ts` draws the header and publishes `sheet` as the choice dock.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

export type VillainDecisionDockKind = "rail" | "band" | "tab";

export interface VillainDecisionDockLayout {
  readonly title: Rect;
  /** EXPAND: the full-screen sheet over the phase, as ANSWER brought up before. */
  readonly expand: Rect;
  /** HIDE ▸ (rail, band) or PEEK AT TABLE ▾ (tab): the whole table, with a way back to the decision. */
  readonly tuck: Rect;
  /** Where the choice sheet docks. */
  readonly sheet: Rect;
}

const PAD = 12;
const GAP = 8;

/**
 * `footer` is the phone's thumb strip (the action bar's place, `VillainDockRects.footer`): on the tab the controls go
 * there, as the phase's own phone buttons do, and the sheet takes the whole panel. A header under the chrome sat where
 * the "Now playing" toast slides in, which covered PEEK AT TABLE whenever a track started.
 */
export function villainDecisionDockLayout(
  panel: Rect,
  kind: VillainDecisionDockKind,
  footer: Rect | null = null,
): VillainDecisionDockLayout {
  if (kind === "tab" && footer) {
    const y = footer.y + 6;
    const height = Math.max(hit.target, footer.height - 12);
    const inner = footer.width - PAD * 2 - GAP;
    const tuckWidth = Math.round(inner * 0.6);
    const tuck: Rect = { x: footer.x + PAD, y, width: tuckWidth, height };
    const expand: Rect = { x: tuck.x + tuckWidth + GAP, y, width: inner - tuckWidth, height };
    return { title: { x: panel.x, y: panel.y, width: 0, height: 0 }, expand, tuck, sheet: panel };
  }
  const narrow = panel.width < 520;
  const tuckWidth = kind === "tab" ? (narrow ? 132 : 170) : 112;
  const expandWidth = narrow ? 104 : 120;
  const top = panel.y + PAD;
  const right = panel.x + panel.width - PAD;
  const tuck: Rect = { x: right - tuckWidth, y: top, width: tuckWidth, height: hit.target };
  const expand: Rect = { x: tuck.x - GAP - expandWidth, y: top, width: expandWidth, height: hit.target };
  const title: Rect = {
    x: panel.x + PAD,
    y: top,
    width: Math.max(0, expand.x - GAP - (panel.x + PAD)),
    height: hit.target,
  };
  const sheetTop = top + hit.target + GAP;
  const sheet: Rect = {
    x: panel.x,
    y: sheetTop,
    width: panel.width,
    height: Math.max(0, panel.y + panel.height - sheetTop),
  };
  return { title, expand, tuck, sheet };
}

/** The tuck control's label: the rail and the band hide beside the table; a phone's tab peeks at it. */
export function villainDecisionTuckLabel(kind: VillainDecisionDockKind): string {
  return kind === "tab" ? "Peek at table ▾" : "Hide ▸";
}

/**
 * Whether a decision of this kind docks in the phase's panel. A defend has its own docked panel; the accusation grid
 * (Baron Zemo), the mulligan and a real-world fact the players report keep the full-screen sheet they are laid out for.
 */
export function dockableDecision(kind: string): boolean {
  return !UNDOCKED.has(kind);
}

const UNDOCKED: ReadonlySet<string> = new Set(["declareDefender", "accuse", "mulligan", "reportFact"]);

/** An option that names a card (a target, a card to pick): a decision made on cards needs the wide rail. */
export function decisionOptionIsCard(refKind: string): boolean {
  return refKind === "card" || refKind === "ability";
}
