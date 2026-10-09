/**
 * Missions and Overseers (Age of Apocalypse, MC45 pp. 5 and 24) as the Briefing and the Dossier show them.
 *
 * Every scenario draws one [MISSION] side scheme and one [OVERSEER] minion at random from what the log has not struck,
 * and the log sheet keeps four mission rows with a Setup, a Defeated and a Not Defeated cell. The generic log views
 * skip the draw (`currentMission` and `currentOverseer` are `working` fields: the printed sheet has no box for them),
 * so this module reads them explicitly: the draw of the composed attempt, the draws of lost attempts of the same
 * scenario (`CampaignChoiceRecord.attempt`; a retry draws again, owner Q22), which Prelate is absent in scenario 3
 * (`mc45.s3.setup.prelate`, traced in the attempt), and the four rows' results as the sheet prints them.
 *
 * MC45 p. 24 prints the Defeated cell as the reward and the Not Defeated cell as the penalty; the short lines below say
 * what each cell does in a few words, and the rulebook's own sentence stays in Inspect and the step list.
 *
 * Found by shape: a definition whose log has the `missions` and `overseers` strike lists and the `currentMission` and
 * `currentOverseer` working fields. Any other box gets null from every function here. The row data (names, card ids,
 * result fields) is the definition's own, exported by `@mc/cards`; nothing is computed that the engine decides.
 */
import { AOA_DEFEATED, AOA_MISSIONS, AOA_NOT_DEFEATED, AOA_OVERSEERS, AOA_PROTECT_THE_PROFESSOR } from "@mc/cards";
import type { CampaignChoiceRecord, CampaignDefinition, CampaignLog, CampaignStepTrace, LogValue } from "@mc/engine";

/** The instruction that removes the drawn Overseer's Prelate in scenario 3 (MC45 p. 14). */
const PRELATE_INSTRUCTION = "mc45.s3.setup.prelate";

/** True for a definition with the mission and Overseer log fields. */
export function hasMissions(definition: Pick<CampaignDefinition, "logFields">): boolean {
  const ids = new Set(definition.logFields.map((field) => field.id));
  return ["missions", "overseers", "currentMission", "currentOverseer"].every((id) => ids.has(id));
}

export type MissionState = "available" | "drawn" | "defeated" | "notDefeated";

/** What a row's result does, in a few words, per MC45 p. 24 (the Defeated cell rewards, the Not Defeated cell costs). */
const CELL_WORDS: Readonly<Record<string, { readonly defeated: string; readonly notDefeated: string }>> = {
  liberate: {
    defeated: "Each game, a player may add Desperate Measures.",
    notDefeated: "Desperate Measures is gone.",
  },
  evacuate: {
    defeated: "Panicked Refugees gone · each player takes an upgrade.",
    notDefeated: "Panicked Refugees in every deck.",
  },
  sabotage: {
    defeated: "North American Sea Wall gone · each player takes a support.",
    notDefeated: "Sea Wall in every encounter deck.",
  },
  find: {
    defeated: "Each player takes a campaign ally.",
    notDefeated: "The campaign allies are gone.",
  },
};

/** The rows whose Not Defeated cell lasts "for the rest of the campaign" in every later game (MC45 p. 24). */
const CARRIED_ROWS: ReadonlySet<string> = new Set(["evacuate", "sabotage"]);

/** What the row does when it is drawn (its Setup cell), in a few words. */
const SETUP_WORDS: Readonly<Record<string, string>> = {
  liberate: "Desperate Measures is set aside this game.",
  evacuate: "Each player shuffles in a Panicked Refugees.",
  sabotage: "The North American Sea Wall joins the encounter deck.",
  find: "The campaign allies are set aside this game.",
};

/**
 * One mission row's result write in words ("Evacuate Survivors" and "not defeated", with what it did in a few words), or
 * null for any field or value that is not a mission result. The log stores the options `defeated` and `notDefeated`;
 * a screen never shows those ids.
 */
export function missionResultWordsOf(
  field: string,
  option: string,
): { readonly name: string; readonly result: "defeated" | "not defeated"; readonly detail: string } | null {
  const row = AOA_MISSIONS.find((candidate) => candidate.resultField === field);
  if (!row || (option !== AOA_DEFEATED && option !== AOA_NOT_DEFEATED)) return null;
  const defeated = option === AOA_DEFEATED;
  const words = CELL_WORDS[row.id]!;
  return {
    name: row.name,
    result: defeated ? "defeated" : "not defeated",
    detail: defeated ? words.defeated : words.notDefeated,
  };
}

export interface MissionTableRow {
  readonly id: string;
  readonly name: string;
  readonly cardId: string;
  readonly state: MissionState;
  /** The state as a word, never a color alone. */
  readonly stateWord: string;
  /** The line under the name: what the row did (or will do), in a few words. */
  readonly detail: string;
  /** The rulebook's own Setup, Defeated and Not Defeated sentences (MC45 p. 24), for Inspect. */
  readonly printed: { readonly setup: string; readonly defeated: string; readonly notDefeated: string };
}

export interface OverseerTableRow {
  readonly name: string;
  readonly cardId: string;
  readonly state: "available" | "drawn" | "defeated";
  readonly stateWord: string;
}

export interface MissionTable {
  readonly label: string;
  readonly citation: string;
  readonly missions: readonly MissionTableRow[];
  readonly overseersLabel: string;
  readonly overseers: readonly OverseerTableRow[];
}

const STATE_WORD: Readonly<Record<MissionState, string>> = {
  available: "AVAILABLE",
  drawn: "DRAWN THIS ISSUE",
  defeated: "DEFEATED",
  notDefeated: "NOT DEFEATED",
};

const optionOf = (value: LogValue | undefined): string =>
  value?.kind === "choice" && value.option !== "" ? value.option : "";
const struckOf = (value: LogValue | undefined): readonly string[] => (value?.kind === "strikeList" ? value.struck : []);

/**
 * The four mission rows and the five Overseers as the log sheet stands (MC45 p. 24). `attempting` is true while a
 * composed attempt holds a draw not yet played, which marks that row (and Overseer) as drawn.
 */
export function missionTableOf(
  log: Pick<CampaignLog, "shared" | "attempt">,
  definition: Pick<CampaignDefinition, "logFields">,
): MissionTable | null {
  if (!hasMissions(definition)) return null;
  const drawnMission = log.attempt ? optionOf(log.shared.currentMission) : "";
  const drawnOverseer = log.attempt ? optionOf(log.shared.currentOverseer) : "";
  const missionsStruck = struckOf(log.shared.missions);
  const overseersStruck = struckOf(log.shared.overseers);
  const missions = AOA_MISSIONS.map((row): MissionTableRow => {
    const result = optionOf(log.shared[row.resultField]);
    const words = CELL_WORDS[row.id]!;
    const state: MissionState =
      result === AOA_DEFEATED
        ? "defeated"
        : result === AOA_NOT_DEFEATED
          ? "notDefeated"
          : drawnMission === row.name && !missionsStruck.includes(row.name)
            ? "drawn"
            : "available";
    return {
      id: row.id,
      name: row.name,
      cardId: row.cardId as string,
      state,
      stateWord: STATE_WORD[state],
      detail:
        state === "defeated"
          ? words.defeated
          : state === "notDefeated"
            ? words.notDefeated
            : (SETUP_WORDS[row.id] ?? ""),
      printed: { setup: row.setup, defeated: row.defeated, notDefeated: row.notDefeated },
    };
  });
  const overseers = AOA_OVERSEERS.map((overseer): OverseerTableRow => {
    const state = overseersStruck.includes(overseer.name)
      ? "defeated"
      : drawnOverseer === overseer.name
        ? "drawn"
        : "available";
    return {
      name: overseer.name,
      cardId: overseer.cardId as string,
      state,
      stateWord: STATE_WORD[state],
    };
  });
  return {
    label: "Missions",
    citation: "MC45 p. 24",
    missions,
    overseersLabel: "Overseers",
    overseers,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The Briefing
// ---------------------------------------------------------------------------------------------------------------

/** One draw of a scenario attempt: the mission and Overseer that attempt was dealt. */
export interface MissionDraw {
  /** 1 for the first attempt at the scenario. */
  readonly attempt: number;
  readonly mission: string | null;
  readonly overseer: string | null;
}

export interface MissionBriefing {
  readonly nodeId: string;
  /** This attempt's number: 1 for a first try, 2 after one lost game, and so on. */
  readonly attempt: number;
  /** The mission this game starts with: card id, name and its Setup in a few words. */
  readonly mission: { readonly name: string; readonly cardId: string; readonly setup: string } | null;
  readonly overseer: { readonly name: string; readonly cardId: string } | null;
  /** Scenario 3: the Prelate on the reverse of this game's Overseer is out of the game (MC45 p. 14). */
  readonly prelateAbsent: string | null;
  /** The draws of the lost attempts at this scenario, oldest first; empty on a first try. A retry draws again (Q22). */
  readonly earlier: readonly MissionDraw[];
  /**
   * Penalties still in force from earlier missions that were not defeated, in a few words each: the cards they shuffle
   * into every deck or the encounter deck for the rest of the campaign (MC45 p. 24). Empty when none apply.
   */
  readonly carried: readonly string[];
  /** The mission is the scenario's own fixed one (Protect the Professor, MC45 p. 20), not a draw. */
  readonly fixed: boolean;
}

function drawOf(steps: readonly CampaignStepTrace[], slot: "mission" | "overseer"): CampaignChoiceRecord | undefined {
  for (const step of steps) {
    if (step.skipped) continue;
    const choice = step.choices.find((candidate) => candidate.slot === slot && candidate.random);
    if (choice) return choice;
  }
  return undefined;
}

/**
 * The composed attempt's mission and Overseer, which Prelate is absent, and the draws of this scenario's lost attempts.
 * Null for a box without missions, or while nothing is composed.
 */
export function missionBriefingOf(
  record: Pick<CampaignLog, "shared" | "attempt" | "history">,
  definition: Pick<CampaignDefinition, "logFields">,
): MissionBriefing | null {
  const attempt = record.attempt;
  if (!attempt || !hasMissions(definition)) return null;
  const missionName = optionOf(record.shared.currentMission);
  const overseerName = optionOf(record.shared.currentOverseer);
  const row = AOA_MISSIONS.find((candidate) => candidate.name === missionName);
  const mission =
    missionName === ""
      ? null
      : {
          name: missionName,
          cardId: (row?.cardId ?? AOA_PROTECT_THE_PROFESSOR.cardId) as string,
          setup: row ? (SETUP_WORDS[row.id] ?? "") : "Protect the Professor wins the campaign.",
        };
  const overseerRow = AOA_OVERSEERS.find((candidate) => candidate.name === overseerName);
  const overseer = overseerRow ? { name: overseerRow.name, cardId: overseerRow.cardId as string } : null;
  const lost = record.history.filter((entry) => entry.nodeId === attempt.nodeId && entry.outcome !== "won");
  const earlier = lost.map((entry, index): MissionDraw => {
    const mission = drawOf(entry.steps, "mission");
    const overseer = drawOf(entry.steps, "overseer");
    return {
      attempt: mission?.attempt ?? overseer?.attempt ?? index + 1,
      mission: mission?.picked[0] ?? missionNameOfFixedStep(entry.steps),
      overseer: overseer?.picked[0] ?? null,
    };
  });
  const prelateRan = attempt.steps.some((step) => step.instructionId === PRELATE_INSTRUCTION && !step.skipped);
  return {
    nodeId: attempt.nodeId,
    attempt: lost.length + 1,
    mission,
    overseer,
    prelateAbsent: prelateRan && overseer ? `${overseer.name} (Prelate)` : null,
    earlier,
    carried: AOA_MISSIONS.filter(
      (candidate) =>
        CARRIED_ROWS.has(candidate.id) && optionOf(record.shared[candidate.resultField]) === AOA_NOT_DEFEATED,
    ).map((candidate) => CELL_WORDS[candidate.id]!.notDefeated),
    fixed: mission !== null && drawOf(attempt.steps, "mission") === undefined,
  };
}

/** A scenario whose mission is fixed (scenario 5) has no draw to read back from a lost attempt's steps. */
function missionNameOfFixedStep(steps: readonly CampaignStepTrace[]): string | null {
  const fixed = steps.find((step) => step.instructionId === "mc45.setup.protect-the-professor" && !step.skipped);
  return fixed ? AOA_PROTECT_THE_PROFESSOR.name : null;
}
