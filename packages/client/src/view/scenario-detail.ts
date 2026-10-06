/**
 * Scenario select's detail panel (docs/phase4-screen-gaps.md §3 W2, D02): main
 * scheme, threat per player, villain HP per stage, encounter sets, and a
 * stage-by-stage row — for whichever scenario is currently selected. §4
 * settled this as data only, no blurb: every field here is read straight off
 * `@mc/content`, never invented copy.
 *
 * Threat and HP are shown as printed `ScalingValue`s (`view/scaling-text.ts`),
 * not scaled to a player count: a scenario is chosen before "Take your seats"
 * fixes how many players there'll be, so there is no count yet to scale
 * against. Table setup's own "the game you'll get" (`view/table-setup-preview.ts`)
 * scales these same numbers once seats are chosen.
 *
 * **Multi-villain scenarios** (The Wrecking Crew's Breakout): the stage table
 * describes only `Scenario.villainCardId`'s own card — the first of
 * `multipleVillains.villains` — plus a count of how many more villains join
 * it, rather than a full per-villain breakdown; a fuller multi-villain detail
 * view is left for whoever builds it, not invented here to fill space.
 */
import type { AnyCard, CardId, EncounterSet, ScalingValue, Scenario, VillainStage } from "@mc/content";
import { pooledModularShortSummary, pooledModularSummary } from "./modular-summary.js";
import { formatScaling } from "./scaling-text.js";

export interface StageDetail {
  readonly stageNumber: number;
  /** The Wrecking Crew's version letters ("A"/"B") instead of a roman-numeral stage; null for every other villain (`VillainStage.stageLabel`). */
  readonly stageLabel: string | null;
  readonly hp: ScalingValue;
  readonly atk: number;
  readonly sch: number;
}

export interface ScenarioDetail {
  readonly scenarioName: string;
  readonly packCode: string;
  readonly villainName: string;
  /**
   * True when the opening villain is drawn at random (`Scenario.randomVillainName`: Morlock Siege's shuffled villain
   * deck, On the Run's one Marauder), so `villainCardId`'s own name and numbers are only a placeholder. `villainName`
   * is then that label ("The Marauders") and the screens leave the stage numbers out.
   */
  readonly villainIsRandom: boolean;
  /**
   * The name the setup screens show for the villain side: the villain's own name, or both names joined when a
   * scenario is fought against exactly two villains at once (Tower Defense: "Proxima Midnight / Corvus Glaive"). With
   * three or more villains the scenario's own name stands for them (Breakout, The Sinister Six), since that many names
   * don't fit a shelf card and the lead villain's alone misnames the fight.
   */
  readonly displayName: string;
  /**
   * The shelf tile's title (Scenario select): `displayName`, except a one-villain scenario whose own name is not its
   * villain's (Mansion Attack opens against Avalanche, Project Wideawake against a Sentinel) is titled with the
   * scenario's name, so the tile names the box the player is picking, with the villain on the line beneath
   * (`shelfSubtitleOf`). "Kang" for "Kang (The Conqueror)" is the same name, not a different one.
   */
  readonly tileTitle: string;
  /** True when `tileTitle` is the scenario's name rather than the villain's, so the subtitle leads with the villain. */
  readonly titledByScenario: boolean;
  readonly villainCardId: CardId;
  /** Present only for a multi-villain scenario (Breakout); every other name beside `villainName` that also enters play at setup. */
  readonly otherVillainNames: readonly string[];
  readonly mainSchemeName: string;
  readonly startingThreat: ScalingValue;
  readonly stages: readonly StageDetail[];
  /** Sets always in this scenario's encounter deck (villain set(s), plus Standard/Expert), by display name. */
  readonly fixedEncounterSetNames: readonly string[];
  readonly recommendedModularSetNames: readonly string[];
  /** A pooled scenario's modular sets in words ("1 random genre set"), else null (`pooledModularSummary`). */
  readonly modularSummary: string | null;
  /** `modularSummary` in a few words, for the stat strip's one-line cell (`pooledModularShortSummary`). */
  readonly modularShortSummary: string | null;
  /** How many modular sets setup calls for (`Scenario.modularSetCount`, absent = 1). */
  readonly modularSetCount: number;
  readonly villainStagesStandard: readonly [number, number];
  readonly villainStagesExpert: readonly [number, number];
}

function setName(id: string, sets: ReadonlyMap<string, EncounterSet>): string {
  return sets.get(id)?.name ?? id;
}

/**
 * `cardsById`/`encounterSets` are the app's own pool lookups
 * (`content/pool.ts`'s `CARDS_BY_ID`/`POOL_ENCOUNTER_SETS`) — this module
 * reads them rather than importing `@mc/content`'s raw data itself, so a test
 * can hand it a small fixture pool.
 */
export function scenarioDetailOf(
  scenario: Scenario,
  cardsById: ReadonlyMap<string, AnyCard>,
  encounterSets: readonly EncounterSet[],
): ScenarioDetail {
  const sets = new Map(encounterSets.map((set) => [set.id as string, set]));
  const villain = cardsById.get(scenario.villainCardId as string);
  if (!villain || villain.type !== "villain")
    throw new Error(`scenario ${scenario.id} villain ${scenario.villainCardId} not found`);
  const side = villain.sides.find((s) => s.side === (villain.startingSide ?? "A")) ?? villain.sides[0]!;
  const stages: readonly StageDetail[] = side.stages.map((stage: VillainStage) => ({
    stageNumber: stage.stageNumber,
    stageLabel: stage.stageLabel ?? null,
    hp: stage.hp,
    atk: stage.atk,
    sch: stage.sch,
  }));

  const mainScheme = cardsById.get(scenario.mainSchemeCardId as string);
  if (!mainScheme || mainScheme.type !== "main_scheme")
    throw new Error(`scenario ${scenario.id} main scheme ${scenario.mainSchemeCardId} not found`);
  const firstStage = mainScheme.stages[0]!;

  const otherVillainNames = (scenario.multipleVillains?.villains ?? [])
    .map((v) => v.villainCardId)
    .filter((id) => (id as string) !== (scenario.villainCardId as string))
    .map((id) => cardsById.get(id as string)?.name ?? (id as string));

  const villainIsRandom = scenario.randomVillainName !== undefined;
  const villainName = scenario.randomVillainName ?? side.name;
  const displayName = villainIsRandom
    ? villainName
    : otherVillainNames.length === 1
      ? `${side.name} / ${otherVillainNames[0]}`
      : otherVillainNames.length > 1
        ? scenario.name
        : side.name;
  const norm = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const sameName = norm(scenario.name).includes(norm(side.name)) || norm(side.name).includes(norm(scenario.name));
  const titledByScenario = otherVillainNames.length === 0 && (villainIsRandom || !sameName);
  return {
    scenarioName: scenario.name,
    packCode: scenario.packCode as string,
    villainName,
    villainIsRandom,
    displayName,
    tileTitle: titledByScenario ? scenario.name : displayName,
    titledByScenario,
    villainCardId: scenario.villainCardId,
    otherVillainNames,
    mainSchemeName: mainScheme.name,
    startingThreat: firstStage.startingThreat,
    stages,
    fixedEncounterSetNames: scenario.encounterSetIds.map((id) => setName(id as string, sets)),
    recommendedModularSetNames: scenario.recommendedModularSetIds.map((id) => setName(id as string, sets)),
    modularSummary: pooledModularSummary(scenario),
    modularShortSummary: pooledModularShortSummary(scenario),
    modularSetCount: scenario.modularSetCount ?? 1,
    villainStagesStandard: scenario.villainStages.standard,
    villainStagesExpert: scenario.villainStages.expert,
  };
}

/**
 * The detail panel's own text lines, in draw order — a pure function so a
 * screen's layout can flex its own line budget to this exact count
 * (`view/scenario-select-layout.ts`) *before* a live Phaser scene exists to
 * measure text, the same "count first, lay out second" rule `wrapChipsToRows`
 * already established for chip rows.
 */
export function scenarioDetailLines(detail: ScenarioDetail): readonly string[] {
  const lines: string[] = [];
  lines.push(
    `Villain: ${detail.villainName}${detail.otherVillainNames.length > 0 ? ` + ${detail.otherVillainNames.length} more (${detail.otherVillainNames.join(", ")})` : ""}`,
  );
  lines.push(`Main scheme: ${detail.mainSchemeName} — starting threat ${formatScaling(detail.startingThreat)}`);
  lines.push(
    `Standard: stage ${detail.villainStagesStandard.join("–")} · Expert: stage ${detail.villainStagesExpert.join("–")}`,
  );
  for (const stage of detail.villainIsRandom ? [] : detail.stages) {
    const label = stage.stageLabel ?? `${stage.stageNumber}`;
    lines.push(`  Stage ${label}: ${formatScaling(stage.hp)} HP · ATK ${stage.atk} · SCH ${stage.sch}`);
  }
  lines.push(`Fixed sets: ${detail.fixedEncounterSetNames.join(", ") || "none"}`);
  lines.push(
    detail.modularSummary
      ? `Modular sets: ${detail.modularSummary}`
      : `Recommended modular: ${detail.recommendedModularSetNames.join(", ") || "none"}`,
  );
  return lines;
}

/** Scenario select's "Encounter sets" stat cell: the villain's set and the modular sets, short enough for one line. */
export function encounterSetsCellText(detail: ScenarioDetail): string {
  const modular = detail.modularShortSummary ?? detail.modularSummary ?? detail.recommendedModularSetNames[0] ?? "";
  return `${detail.displayName} · ${modular}`.toUpperCase();
}

const SHELF_ROMAN = ["", "I", "II", "III", "IV", "V", "VI"] as const;
const shelfRoman = (n: number): string => SHELF_ROMAN[n] ?? String(n);

/**
 * The scenario shelf card's second line under its title: "Stages I–III · Masters of Evil", or "Stage I · …" for a
 * one-stage villain. A tile titled with the scenario's name (`ScenarioDetail.tileTitle`) leads with the villain
 * instead: "Avalanche · Stage I · Mystique".
 */
export function shelfSubtitleOf(detail: ScenarioDetail): string {
  const first = detail.stages[0]?.stageNumber ?? 1;
  const last = detail.stages[detail.stages.length - 1]?.stageNumber ?? first;
  const stages = last > first ? `Stages ${shelfRoman(first)}–${shelfRoman(last)}` : `Stage ${shelfRoman(first)}`;
  const setName = detail.modularSummary
    ? (detail.fixedEncounterSetNames[0] ?? "")
    : (detail.recommendedModularSetNames[0] ?? detail.fixedEncounterSetNames[0] ?? "");
  const line = setName ? `${stages} · ${setName}` : stages;
  if (detail.villainIsRandom) return `${detail.villainName} · random`;
  return detail.titledByScenario ? `${detail.villainName} · ${line}` : line;
}
