/**
 * What the answered side-scheme choice leaves on the Briefing (NeXt Evolution, MC40 p. 7): the chosen row with its cards as
 * pictures (each opens Inspect and answers nothing), "Same as last time" when a retry repeats it, what carries in from the log,
 * and the encounter sets the issue fixes. The picker itself is a call (`calls/side-scheme-call.ts`).
 */
import { campaignCardsById } from "../../../../../content/campaign-pool.js";
import { t } from "../../../../../i18n/translate.js";
import { accent, signal, surface, typeRole } from "../../../../../tokens.js";
import { bangers } from "../../../../../ui/campaign-chrome.js";
import { pickRowLayout, sideSchemePickCards } from "../../../../../view/campaign-briefing-model.js";
import type { SideSchemeRow } from "../../../../../view/campaign-side-scheme-model.js";
import { drawPickCards } from "../../calls/pick-art.js";
import { drawRuleHeading } from "../../handled.js";
import { drawKicker } from "../parts/kicker.js";
import { drawCarryIn } from "./carry-in.js";
import type { SideSchemeEvents, SideSchemeInput } from "./side-scheme.types.js";

/** The settled section shows when a scheme is chosen or the node fixes sets. */
export const hasSideScheme = (scheme: SideSchemeInput["scheme"]): boolean =>
  scheme.chosen !== null || scheme.requiredSetIds.length > 0;

function drawChosen(input: SideSchemeInput, row: SideSchemeRow, top: number): number {
  const { ctx, b, col, scheme } = input;
  const cards = sideSchemePickCards(row, (id) => campaignCardsById().get(id)?.type);
  const heading = (row.environment ? `${row.name} → ${row.environment.name}` : row.name).toLocaleUpperCase();
  const size = col.phone ? 20 : 22;
  const title = b.measure(heading, bangers(size), { fitWidth: col.width - 28 });
  const marker = scheme.repeated ? t("briefing.scheme.same") : null;
  const markerHeight = marker ? 2 + b.measure(marker.toLocaleUpperCase(), typeRole.label, {}).height : 0;
  // The heading is the row's title line; the pictures sit under it, as on a stacked picker row with no Pick.
  const layout = pickRowLayout(
    col.width,
    cards.map((card) => card.shape),
    { withPick: false, titleHeight: title.height + markerHeight, stacked: true },
  );
  const box = { x: col.x, y: top, width: col.width, height: layout.height };
  b.box(box, { fill: surface.card.hex });
  b.box(box, { stroke: surface.ink.hex, strokeWidth: 2 });
  b.box({ x: col.x, y: top, width: 6, height: layout.height }, { fill: signal.heal.hex });
  b.text(col.x + 16, top + 8, heading, bangers(size), { color: surface.ink.hex, fitWidth: col.width - 28 });
  if (marker) drawKicker(b, col.x + 16, top + 8 + title.height + 2, marker, signal.cost.hex);
  drawPickCards(ctx, b, col, { x: col.x + 4, y: top }, cards, layout, "scheme-chosen");
  return top + layout.height + 12;
}

function drawFixedSets(input: SideSchemeInput, top: number): number {
  const { b, col, scheme, setNameOf } = input;
  const height = 44;
  b.box({ x: col.x, y: top, width: col.width, height }, { fill: surface.parchment.hex });
  b.box({ x: col.x, y: top, width: col.width, height }, { stroke: surface.ink.hex, strokeWidth: 2 });
  drawKicker(b, col.x + 12, top + 8, t("briefing.scheme.fixed"), accent.heroRed.hex);
  b.text(col.x + 12, top + 24, scheme.requiredSetIds.map(setNameOf).join(", "), typeRole.rowTitle, {
    size: 14,
    color: surface.ink.hex,
    fitWidth: col.width - 24,
  });
  return top + height + 8;
}

/** Draws the section from `top`; returns its bottom. */
export function drawSideScheme(input: SideSchemeInput, events: SideSchemeEvents): number {
  const { b, col, scheme } = input;
  let y = drawRuleHeading(b, col.x, input.top, col.width, t("briefing.scheme.heading"));
  if (scheme.chosen) y = drawChosen(input, scheme.chosen, y);
  for (const carry of scheme.carryIns) y = drawCarryIn({ ...input, top: y, carry }, events) + 8;
  if (scheme.requiredSetIds.length > 0) y = drawFixedSets(input, y);
  return y;
}
