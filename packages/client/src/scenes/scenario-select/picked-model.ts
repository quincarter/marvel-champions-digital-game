/**
 * What the stages panel and the stat strip of Choose a scenario say about the picked scenario, as the plain models the
 * `mc-scenario-picked` and `mc-scenario-stats` elements take. Read off the scenario detail, so the strip, the panel and the
 * tile cannot disagree.
 */
import { artLanguageNow } from "../../art/art-source.js";
import { t, tPlural } from "../../i18n/translate.js";
import type {
  ScenarioPickedModel,
  ScenarioStageModel,
} from "../../components/scenario-select/mc-scenario-picked/mc-scenario-picked.types.js";
import type { ScenarioStatCell } from "../../components/scenario-select/mc-scenario-stats/mc-scenario-stats.types.js";
import type { ScenarioRecord } from "../../view/results-history.js";
import { formatScaling } from "../../view/scaling-text.js";
import { encounterSetsCellText, type ScenarioDetail } from "../../view/scenario-detail.js";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"] as const;
const roman = (n: number): string => ROMAN[n] ?? String(n);

/** The four cells of the stat strip: label over value. */
export function statCellsOf(detail: ScenarioDetail): readonly ScenarioStatCell[] {
  const lang = artLanguageNow();
  const firstStage = detail.stages[0];
  const accelerating = detail.startingAcceleration.base > 0 || detail.startingAcceleration.perPlayer > 0;
  const accel = accelerating ? t("scenario.accel", { accel: formatScaling(detail.startingAcceleration, lang) }) : "";
  return [
    { label: t("scenario.mainScheme"), value: detail.mainSchemeName },
    {
      label: t("scenario.startingThreat"),
      value: `${t("scenario.threatStart", { threat: formatScaling(detail.startingThreat, lang) })}${accel}`,
    },
    {
      label: t("scenario.foeHp", { foe: detail.foeWord }),
      value: detail.villainIsRandom
        ? t("scenario.varies")
        : detail.stages.map((stage) => formatScaling(stage.hp, lang).split(" ")[0]).join(" · ") ||
          (firstStage ? formatScaling(firstStage.hp, lang) : "—"),
    },
    {
      // The strip's cell is narrow: its own, shorter label in a language that needs one (#390).
      label: t("scenario.encounterSetsCell"),
      value: encounterSetsCellText(detail),
    },
  ];
}

/** The stage range the difficulty plays, so a stage box can read "used now" against "the other mode". */
function stageRangeOf(detail: ScenarioDetail, difficulty: string): readonly [number, number] {
  return difficulty === "standard" ? detail.villainStagesStandard : detail.villainStagesExpert;
}

/** The record line, for the dev e2e hook (the played tally and its sentence). */
export function recordTextOf(record: ScenarioRecord | null): string {
  const played = record !== null && record.combined.gamesPlayed > 0;
  if (!played) return t("scenario.notPlayedDot");
  const tally = `${tPlural("scenario.wins", record.combined.wins)} · ${tPlural("scenario.losses", record.combined.losses)}`;
  return t("scenario.recordLine", { tally, subline: recordSubline(record) ? ` ${recordSubline(record)}.` : "" });
}

function recordSubline(record: ScenarioRecord | null): string | null {
  if (record === null || record.combined.gamesPlayed === 0) return null;
  if (record.combined.bestClearRounds !== null)
    return t("scenario.bestClear", { round: record.combined.bestClearRounds });
  return record.combined.wins > 0 ? null : t("scenario.notBeaten");
}

export interface PickedInput {
  /** Null until a villain is picked. */
  readonly detail: ScenarioDetail | null;
  /** The draft's difficulty: standard reads the standard stages, any other the expert ones. */
  readonly difficulty: string;
  readonly record: ScenarioRecord | null;
  /** A narrow screen's disclosure is open. */
  readonly stagesOpen: boolean;
  /** A narrow screen: the panel is a disclosure. */
  readonly collapsible: boolean;
}

export function pickedModelOf(input: PickedInput): ScenarioPickedModel {
  const { detail, difficulty, record, stagesOpen, collapsible } = input;
  const base = {
    heading: t("scenario.stages"),
    emptyText: t("scenario.pickVillainStages"),
    emptyHint: t("scenario.pickVillain"),
    collapsible,
  };
  if (detail === null) {
    return {
      ...base,
      picked: false,
      open: false,
      summary: "",
      note: "",
      stages: [],
      record: null,
      sets: [],
      stats: [],
    };
  }
  const lang = artLanguageNow();
  const [rangeStart, rangeEnd] = stageRangeOf(detail, difficulty);
  const stages: ScenarioStageModel[] = (detail.villainIsRandom ? detail.stages.slice(0, 1) : detail.stages).map(
    (stage) => {
      const who = detail.villainChoices.length > 0 ? t("scenario.yourVillain") : detail.villainName;
      return {
        name: `${stage.stageLabel ?? roman(stage.stageNumber)} · ${who.toUpperCase()}`,
        stats: detail.villainIsRandom
          ? t("scenario.drawnAtRandom")
          : t("scenario.stageStats", { sch: stage.sch, hp: formatScaling(stage.hp, lang), atk: stage.atk }),
        current: stage.stageNumber >= rangeStart && stage.stageNumber <= rangeEnd,
      };
    },
  );
  const played = record !== null && record.combined.gamesPlayed > 0;
  const beaten = played && record.combined.wins > 0;
  const tally = played
    ? `${tPlural("scenario.wins", record.combined.wins)} · ${tPlural("scenario.losses", record.combined.losses)}`
    : t("scenario.notPlayed");
  return {
    ...base,
    picked: true,
    open: stagesOpen,
    summary: t("scenario.stageSummary", {
      name: detail.displayName.toUpperCase(),
      from: roman(rangeStart),
      to: rangeEnd > rangeStart ? `–${roman(rangeEnd)}` : "",
    }),
    note:
      detail.otherVillainNames.length > 0
        ? t("scenario.more", { count: detail.otherVillainNames.length, names: detail.otherVillainNames.join(", ") })
        : "",
    stages,
    record: {
      label: t("scenario.record"),
      tally,
      subline: recordSubline(record) ?? "",
      tone: beaten ? "beaten" : played ? "played" : "unplayed",
    },
    // "Encounter sets" / "Recommended modular" as label-over-value blocks, matching Take your seats' obligation / nemesis set.
    sets: [
      { heading: t("scenario.encounterSets"), value: detail.fixedEncounterSetNames.join(", ") || t("scenario.none") },
      detail.modularSummary
        ? { heading: t("scenario.modularSets"), value: detail.modularSummary }
        : {
            heading: t("scenario.recommendedModular"),
            value: detail.recommendedModularSetNames.join(", ") || t("scenario.none"),
          },
    ],
    stats: statCellsOf(detail),
  };
}
