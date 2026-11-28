/**
 * The player-side-scheme call (NeXt Evolution, MC40 p. 7): one row per offered scheme with its cards as pictures (the scheme, the
 * environment it earns, the encounter card it brings) and a PICK button that answers with the row's name. A picture opens
 * Inspect and answers nothing, so reading a card can never record the choice. A stacked row is headed by its label ("Mission
 * Prep → Mission Prepped"); a wide row names each card beside its picture instead.
 */
import { campaignCardsById } from "../../../../content/campaign-pool.js";
import { t } from "../../../../i18n/translate.js";
import { ink, surface, typeRole } from "../../../../tokens.js";
import { pickRowLayout, sideSchemePickCards, type PickCard } from "../../../../view/campaign-briefing-model.js";
import { sideSchemeOptionLabels } from "../../../../view/campaign-option-labels.js";
import type { SideSchemeRow } from "../../../../view/campaign-side-scheme-model.js";
import type { Rect } from "../../../../view/layout.js";
import type { CallInput, CallKind } from "./calls.types.js";
import { drawPickCards } from "./pick-art.js";

type SchemeKind = Extract<CallKind, { kind: "sideScheme" }>;

const ROW_GAP = 8;

/** The cards a side-scheme row shows. */
export const schemeCardsOf = (row: SideSchemeRow): readonly PickCard[] =>
  sideSchemePickCards(row, (id) => campaignCardsById().get(id)?.type);

/** Draws the picker from `top` and returns its bottom. */
export function drawSideSchemeCall(input: CallInput, top: number, kind: SchemeKind): number {
  const { ctx, b, col } = input;
  let y = top;
  y +=
    b.text(col.x, y, t("briefing.call.scheme.prompt"), typeRole.rowTitle, {
      color: surface.ink.hex,
      wrapWidth: col.width,
    }).height + 2;
  y +=
    b.text(col.x, y, t("briefing.call.scheme.note"), typeRole.body, {
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: col.width,
    }).height + 10;
  const labels = sideSchemeOptionLabels(kind.scheme.offered);
  const pickWidth = col.phone ? 84 : 96;
  for (const row of kind.scheme.offered) {
    const cards = schemeCardsOf(row);
    const layout = pickRowLayout(
      col.width,
      cards.map((card) => card.shape),
      { pickWidth },
    );
    const box: Rect = { x: col.x, y, width: col.width, height: layout.height };
    b.box(box, { fill: surface.card.hex });
    b.box(box, { stroke: surface.ink.hex, strokeWidth: 2 });
    if (layout.title) {
      b.text(
        col.x + layout.title.x,
        y + layout.title.y + layout.title.height / 2,
        labels.get(row.name) ?? row.name,
        typeRole.rowTitle,
        {
          size: 14,
          color: surface.ink.hex,
          origin: [0, 0.5],
          wrapWidth: layout.title.width,
        },
      );
    }
    drawPickCards(ctx, b, col, { x: col.x, y }, cards, layout, `call-scheme:${row.name}`);
    if (layout.pick) {
      const rect: Rect = { ...layout.pick, x: col.x + layout.pick.x, y: y + layout.pick.y };
      const key = `call-option:${row.name}`;
      b.button({ key, rect, label: t("briefing.call.pick"), look: "primary", type: typeRole.label });
      col.control(key, rect, () => ctx.answer([row.name]));
      ctx.obstacles.push(rect);
    }
    y += layout.height + ROW_GAP;
  }
  return y;
}
