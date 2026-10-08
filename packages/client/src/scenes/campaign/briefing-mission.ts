/**
 * The Briefing's mission section (Age of Apocalypse, MC45 p. 5), drawn: this scenario's drawn mission and Overseer,
 * which Prelate is absent in scenario 3, and a retry's earlier draws. Plain drawing over `MissionBriefing`
 * (`view/campaign-mission-model.ts`); the Inspect chip opens the card, the scene owns the launch and the redraw.
 */
import { cardId } from "@mc/content";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
import { bangers, ruleHeading } from "../../ui/campaign-chrome.js";
import { textStyle } from "../../ui/theme.js";
import { McButton, fitText, label } from "../../ui/widgets.js";
import type { MissionBriefing } from "../../view/campaign-mission-model.js";
import type { SideSchemeDrawContext } from "./briefing-side-scheme.js";

const ROW_HEIGHT = 58;

/** One labeled row: a kind word, the card's name, a short line beneath and an Inspect chip. Returns its bottom edge. */
function drawRow(
  ctx: SideSchemeDrawContext,
  top: number,
  row: { readonly kind: string; readonly name: string; readonly detail: string; readonly cardId: string | null },
  key: string,
): number {
  const { scene, rect, phone } = ctx;
  const g = scene.add.graphics();
  g.fillStyle(0xfffaf0, 1).fillRect(rect.x, top, rect.width, ROW_HEIGHT);
  g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, top, rect.width, ROW_HEIGHT);
  g.fillStyle(signal.heal.hex, 1).fillRect(rect.x, top, 6, ROW_HEIGHT);
  const chipWidth = row.cardId ? 92 : 0;
  const textWidth = rect.width - 28 - (chipWidth ? chipWidth + 8 : 0);
  label(scene, rect.x + 16, top + 6, row.kind, typeRole.label, accent.heroRed.hex, 1);
  const title = scene.add
    .text(rect.x + 16, top + 20, row.name.toUpperCase(), textStyle(bangers(phone ? 18 : 20), surface.ink.hex))
    .setOrigin(0, 0);
  fitText(title, textWidth, phone ? 18 : 20);
  if (row.detail) {
    const detail = scene.add
      .text(rect.x + 16, top + 42, row.detail, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setOrigin(0, 0)
      .setFontSize(11);
    fitText(detail, textWidth, 11);
  }
  if (row.cardId) {
    const chip = {
      x: rect.x + rect.width - 12 - chipWidth,
      y: top + (ROW_HEIGHT - 34) / 2,
      width: chipWidth,
      height: 34,
    };
    const open = (): void => ctx.inspect({ cardId: cardId(row.cardId!), name: row.name });
    ctx.buttons.push(
      new McButton(scene, { kind: "quiet", label: "Inspect", type: typeRole.label, rect: chip, onClick: open }),
    );
    ctx.stops.set(`mission-${key}`, { rect: chip, activate: open });
  }
  return top + ROW_HEIGHT;
}

/** Draws the section below `top` and returns its bottom edge. */
export function drawMissionBriefing(ctx: SideSchemeDrawContext, top: number, brief: MissionBriefing): number {
  const { scene, rect } = ctx;
  let y = ruleHeading(scene, rect.x, top, rect.width, "This scenario", surface.ink.hex, 20) + 2;
  if (brief.attempt > 1) {
    y +=
      label(scene, rect.x, y, `Attempt ${brief.attempt} · drawn again`, typeRole.label, signal.cost.hex, 1).height + 6;
  }
  if (brief.mission) {
    y = drawRow(
      ctx,
      y,
      {
        kind: brief.fixed ? "MISSION" : "MISSION DRAWN",
        name: brief.mission.name,
        detail: brief.mission.setup,
        cardId: brief.mission.cardId,
      },
      "mission",
    );
    y += 8;
  }
  if (brief.overseer) {
    y = drawRow(
      ctx,
      y,
      {
        kind: "OVERSEER DRAWN",
        name: brief.overseer.name,
        detail: brief.prelateAbsent ? `Absent this game: ${brief.prelateAbsent}.` : "In the mission area.",
        cardId: brief.overseer.cardId,
      },
      "overseer",
    );
    y += 8;
  }
  for (const draw of brief.earlier) {
    const text = [draw.mission, draw.overseer].filter((word): word is string => word !== null).join(" · ");
    const line = scene.add
      .text(rect.x, y, `Attempt ${draw.attempt} drew ${text}`, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setOrigin(0, 0)
      .setFontSize(12);
    fitText(line, rect.width, 12);
    y += line.height + 4;
  }
  return y;
}
