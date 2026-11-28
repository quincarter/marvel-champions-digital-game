import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import type { MissionBriefing } from "../../../view/campaign-mission-model.js";
import { sectionTextIn } from "../shared/section-text.js";
import "../mc-briefing-kicker/mc-briefing-kicker.js";
import "../mc-briefing-mission-row/mc-briefing-mission-row.js";
import type { MissionRowModel } from "../mc-briefing-mission-row/mc-briefing-mission-row.types.js";
import { McBriefingMissionStyles } from "./mc-briefing-mission.styles.js";

/** The rows this scenario drew, in the words of the player language. */
export function missionRowsOf(mission: MissionBriefing): readonly MissionRowModel[] {
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

/**
 * # Briefing mission
 * The Briefing mission section (Age of Apocalypse, MC45 p. 5): this scenario drawn mission and Overseer, which Prelate is absent in
 * scenario 3, a retry earlier draws and the penalties carried over. Plain drawing over `MissionBriefing`
 * (`view/campaign-mission-model.ts`); the Inspect chip opens the card, and nothing here decides what was drawn.
 *
 * @element mc-briefing-mission
 * @prop mission - `MissionBriefing`.
 * @fires mc-briefing - `{ type: "inspect", cardId, name }`.
 */
export class McBriefingMission extends LitElement {
  static override styles = [ThemeStyles, McBriefingMissionStyles];

  static override properties: PropertyDeclarations = {
    mission: { attribute: false },
  };

  declare mission: MissionBriefing | null;

  constructor() {
    super();
    this.mission = null;
  }

  override render() {
    const mission = this.mission;
    if (!mission) return nothing;
    const text = sectionTextIn();
    return html`<mc-section-heading .label=${t("briefing.mission.heading").toLocaleUpperCase()}></mc-section-heading>
      ${mission.attempt > 1 ? html`<mc-briefing-kicker tone="cost" .text=${t("briefing.mission.attempt", { number: mission.attempt })}></mc-briefing-kicker>` : nothing}
      ${missionRowsOf(mission).map((row) => html`<mc-briefing-mission-row .row=${row}></mc-briefing-mission-row>`)}
      ${mission.earlier.map((draw) => {
        const drew = [draw.mission, draw.overseer].filter((word): word is string => word !== null).join(" · ");
        return html`<p class="note">${t("briefing.mission.drew", { number: draw.attempt, cards: drew })}</p>`;
      })}
      ${
        mission.carried.length > 0
          ? html`<mc-briefing-kicker tone="cost" .text=${t("briefing.mission.carried")}></mc-briefing-kicker>
              ${mission.carried.map((line) => html`<p class="note">${text.carried(line)}</p>`)}`
          : nothing
      }`;
  }
}
