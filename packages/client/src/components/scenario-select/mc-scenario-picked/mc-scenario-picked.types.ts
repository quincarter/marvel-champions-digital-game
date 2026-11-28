import type { ScenarioRecordTone } from "../mc-scenario-record/mc-scenario-record.types.js";
import type { ScenarioStatCell } from "../mc-scenario-stats/mc-scenario-stats.types.js";

export interface ScenarioStageModel {
  /** "I · KLAW". */
  readonly name: string;
  /** "SCH 2 · HP 12 · ATK 3". */
  readonly stats: string;
  /** The stage this difficulty plays. */
  readonly current: boolean;
}

export interface ScenarioRecordModel {
  readonly label: string;
  readonly tally: string;
  readonly subline: string;
  readonly tone: ScenarioRecordTone;
}

export interface ScenarioSetModel {
  readonly heading: string;
  readonly value: string;
}

/** What the ink stages panel shows about the picked scenario: its stages, its record and its sets. */
export interface ScenarioPickedModel {
  /** "SCENARIO STAGES". */
  readonly heading: string;
  /** Nothing is picked yet: the panel says what it will show (`emptyText` wide, `emptyHint` on the narrow bar). */
  readonly picked: boolean;
  readonly emptyText: string;
  readonly emptyHint: string;
  /** Narrow: the panel is a disclosure whose bar is the `stages-toggle` stop. Wide: always open, no bar. */
  readonly collapsible: boolean;
  readonly open: boolean;
  /** The bar's summary while shut ("KLAW I–II"). */
  readonly summary: string;
  /** "+2 more villains: ...", or empty. */
  readonly note: string;
  readonly stages: readonly ScenarioStageModel[];
  readonly record: ScenarioRecordModel | null;
  readonly sets: readonly ScenarioSetModel[];
  /** The stat strip inside the open narrow sheet; a wide screen draws it under the shelves instead. */
  readonly stats: readonly ScenarioStatCell[];
}
