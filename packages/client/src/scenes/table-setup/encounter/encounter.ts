/**
 * The encounter deck section ("the encounter deck you're building"): Composition (the obligations row in red), What's in
 * there and the parchment nemesis panel on wide; one bordered panel on the phone. Read-only: it draws `EncounterInput`.
 */
import type { Rect } from "../../../view/layout.js";
import { accent, ink, surface, typeRole } from "../../../tokens.js";
import { PANEL_HEADER_HEIGHT, PANEL_PAD, PANEL_ROW_HEIGHT } from "../../../view/table-setup-layout.js";
import type { CompositionRow } from "../../../view/table-setup-preview.js";
import { t } from "../../../i18n/translate.js";
import { heading, inset, labelText, type Frame } from "../shared/frame.js";
import type { EncounterInput } from "./encounter.types.js";

/** One count row: its label (red for obligations) at the left, the number at the right. */
function countRow(f: Frame, row: CompositionRow, x: number, y: number, width: number, pad: number): void {
  const color = row.red ? accent.heroRed.hex : surface.ink.hex;
  f.b.text(x + pad, y, row.label, typeRole.body, { color, fitWidth: width - 60, maxLines: 1 });
  f.b.text(
    x + width - pad,
    y,
    row.shown ?? String(row.count),
    { ...typeRole.emphasis, weight: 700 },
    {
      color,
      origin: [1, 0],
    },
  );
}

function panelGround(f: Frame, rect: Rect, fill: number, title: string): void {
  f.b.box(rect, { fill });
  f.b.box(inset(rect, 0.75), { stroke: surface.ink.hex, strokeWidth: 1.5, alpha: ink.disabled });
  labelText(f.b, rect.x + 10, rect.y + 8, title, surface.ink.hex);
}

/** Where the wide and tablet-portrait layouts put the section's parts. */
export interface EncounterLayout {
  readonly header: Rect;
  readonly composition: Rect;
  readonly whatsInThere: Rect;
  readonly nemesis: Rect;
  /** How many rows (or lines) each panel can show. */
  readonly budgets: readonly [number, number, number];
}

/** The whole section on a wide screen or a tablet in portrait. */
export function drawEncounter(f: Frame, input: EncounterInput, layout: EncounterLayout, body: number): void {
  const h = layout.header;
  heading(
    f.b,
    h.x,
    h.y,
    h.width,
    t("tableSetup.encounter"),
    body,
    t("tableSetup.encounterCount", { n: input.deckSize }).toUpperCase(),
  );
  const list = (rect: Rect, title: string, rows: readonly CompositionRow[], budget: number): void => {
    // Below its own header's height a panel reads as a stray sliver: left out.
    if (rect.height < PANEL_HEADER_HEIGHT + 4) return;
    panelGround(f, rect, surface.card.hex, title);
    let y = rect.y + PANEL_HEADER_HEIGHT + 4;
    const shown = rows.slice(0, budget);
    for (const row of shown) {
      countRow(f, row, rect.x, y, rect.width, 10);
      y += PANEL_ROW_HEIGHT;
    }
    const hidden = rows.length - shown.length;
    if (hidden > 0 && y + PANEL_ROW_HEIGHT <= rect.y + rect.height)
      labelText(f.b, rect.x + 10, y, t("tableSetup.more", { n: hidden }), surface.ink.hex, { alpha: ink.meta });
  };
  list(layout.composition, t("tableSetup.composition"), input.composition, layout.budgets[0]);
  list(layout.whatsInThere, t("tableSetup.whatsInThere"), input.whatsInThere, layout.budgets[1]);
  const rect = layout.nemesis;
  if (rect.height < PANEL_HEADER_HEIGHT + 4) return;
  panelGround(f, rect, surface.parchment.hex, t("tableSetup.nemesisHeld"));
  const top = rect.y + PANEL_HEADER_HEIGHT + 4;
  const nemesis = input.nemesis;
  if (!nemesis) {
    if (layout.budgets[2] > 0)
      f.b.text(rect.x + 10, top, t("tableSetup.nemesisNone"), typeRole.body, {
        color: surface.ink.hex,
        alpha: ink.meta,
        wrapWidth: rect.width - 20,
      });
    return;
  }
  if (layout.budgets[2] > 1)
    f.b.text(rect.x + 10, top, nemesis.sentence, typeRole.body, {
      color: surface.ink.hex,
      wrapWidth: rect.width - 20,
      maxLines: Math.max(1, layout.budgets[2] - 1),
    });
  const foot = rect.y + rect.height - PANEL_PAD - 12;
  if (foot > top)
    labelText(f.b, rect.x + 10, foot, t("tableSetup.standby", { n: nemesis.totalCards }), surface.ink.hex);
}

/** One of the section's phone rows, by the layout's row id; true when the id was one of its own. */
export function drawCompactEncounter(f: Frame, input: EncounterInput, id: string, rect: Rect): boolean {
  if (id === "header:encounter") {
    heading(f.b, rect.x, rect.y + 2, rect.width, t("tableSetup.encounterShort"), surface.ink.hex);
    return true;
  }
  if (id !== "encounterPanel") return false;
  f.b.box(rect, { fill: surface.card.hex });
  f.b.box(inset(rect, 1.25), { stroke: surface.ink.hex, strokeWidth: 2.5 });
  let y = rect.y + PANEL_PAD;
  const rows = (list: readonly CompositionRow[]): void => {
    for (const row of list) {
      countRow(f, row, rect.x, y, rect.width, 12);
      y += PANEL_ROW_HEIGHT;
    }
  };
  rows(input.composition);
  if (input.composition.length > 0 && input.whatsInThere.length > 0) {
    f.b.box(
      { x: rect.x + 12, y: y + 3, width: rect.width - 24, height: 1 },
      { fill: surface.ink.hex, alpha: ink.disabled },
    );
    y += 6;
  }
  rows(input.whatsInThere);
  if (input.nemesis)
    labelText(f.b, rect.x + 12, y + 4, t("tableSetup.standby", { n: input.nemesis.totalCards }), surface.ink.hex, {
      alpha: ink.meta,
    });
  return true;
}
