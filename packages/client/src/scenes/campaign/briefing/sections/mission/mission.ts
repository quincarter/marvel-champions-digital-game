/**
 * The Briefing's mission section (Age of Apocalypse, MC45 p. 5): this scenario's drawn mission and Overseer, which Prelate is
 * absent in scenario 3, a retry's earlier draws and the penalties carried over. It is plain drawing over `MissionBriefing`
 * (`view/campaign-mission-model.ts`); the Inspect chip opens the card, and nothing here decides what was drawn.
 */
import { t } from "../../../../../i18n/translate.js";
import { signal } from "../../../../../tokens.js";
import { drawRuleHeading } from "../../handled.js";
import { drawKicker, drawNote } from "../parts/kicker.js";
import { sectionTextIn } from "../section-text.js";
import { drawMissionRow } from "./mission-row.js";
import type { MissionEvents, MissionInput, MissionRowModel } from "./mission.types.js";

const ROW_GAP = 8;

/** The rows the draw makes, in the words of the player's language. */
export function missionRowsOf({ mission }: Pick<MissionInput, "mission">): readonly MissionRowModel[] {
  const text = sectionTextIn();
  const rows: MissionRowModel[] = [];
  if (mission.mission) {
    rows.push({
      key: "mission",
      kind: t(mission.fixed ? "briefing.mission.fixed" : "briefing.mission.drawn"),
      name: mission.mission.name,
      detail: text.missionSetup(mission.mission.setup),
      cardId: mission.mission.cardId,
    });
  }
  if (mission.overseer) {
    rows.push({
      key: "overseer",
      kind: t("briefing.mission.overseer"),
      name: mission.overseer.name,
      detail: mission.prelateAbsent
        ? t("briefing.mission.absent", { prelate: mission.prelateAbsent })
        : t("briefing.mission.inArea"),
      cardId: mission.overseer.cardId,
    });
  }
  return rows;
}

/** Draws the section from `top`; returns its bottom. */
export function drawMission(input: MissionInput, events: MissionEvents): number {
  const { b, col, mission } = input;
  const text = sectionTextIn();
  let y = drawRuleHeading(b, col.x, input.top, col.width, t("briefing.mission.heading"));
  if (mission.attempt > 1) {
    y += drawKicker(b, col.x, y, t("briefing.mission.attempt", { number: mission.attempt }), signal.cost.hex) + 6;
  }
  for (const row of missionRowsOf(input)) y = drawMissionRow({ ...input, top: y }, row, events) + ROW_GAP;
  for (const draw of mission.earlier) {
    const drew = [draw.mission, draw.overseer].filter((word): word is string => word !== null).join(" · ");
    y = drawNote(b, col.x, y, col.width, t("briefing.mission.drew", { number: draw.attempt, cards: drew }));
  }
  if (mission.carried.length > 0) {
    y += 4;
    y += drawKicker(b, col.x, y, t("briefing.mission.carried"), signal.cost.hex) + 4;
    for (const line of mission.carried) y = drawNote(b, col.x, y, col.width, text.carried(line));
  }
  return y;
}
