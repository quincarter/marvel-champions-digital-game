/**
 * The Briefing's "easier start" toggle (owner decision, docs/phase7-wave8.md section 4.1 row 85: "Add it as a Briefing
 * toggle in the campaign, defaulting to off so the standard campaign setup remains unchanged"; standalone play already
 * has it on Table setup, Q12).
 *
 * **The client never decides where it applies.** `offersEasierStart` (`@mc/cards`) does: Apocalypse, standard mode. This
 * module asks it about the game the composed issue would launch (`campaignLaunchConfig`), so the toggle shows on the
 * Apocalypse node (issue #3) only, and only in standard mode.
 *
 * **Where the choice lives.** Not in the attempt (the engine's, and thrown away by "change my answer"): on the stored
 * record as `CampaignRecord.easierStartNodeId`, the node it was switched on for. That survives the deck-edit round trip
 * (a discarded attempt is composed again), and `CampaignService` drops it when the game is folded, so a retry of the
 * node starts with it off again. `withEasierStart` is the one place it reaches the game.
 */
import { offersEasierStart } from "@mc/cards";
import type { SessionConfig } from "../engine/host.js";
import type { CampaignRecord } from "../engine/campaign-storage.js";

/** What the Briefing draws for the toggle. */
export interface EasierStartBriefing {
  readonly on: boolean;
  /** The toggle's name: a few words. */
  readonly name: string;
  /** One short line of state under the name. */
  readonly meta: string;
}

/** Whether the game `config` launches offers the easier start (the cards package's own answer). */
export const offersEasierStartIn = (config: Pick<SessionConfig, "scenarioId" | "difficulty">): boolean =>
  offersEasierStart(config.scenarioId, config.difficulty === "expert" ? "expert" : "standard");

/** Whether the record's composed issue has the easier start switched on (it is stored for exactly the node it was set on). */
export const easierStartIsOn = (record: Pick<CampaignRecord, "attempt" | "easierStartNodeId">): boolean =>
  record.attempt !== undefined && record.easierStartNodeId === record.attempt.nodeId;

/** The toggle for the Briefing: null unless the composed issue offers it. */
export function easierStartBriefingOf(
  record: Pick<CampaignRecord, "attempt" | "easierStartNodeId">,
  config: Pick<SessionConfig, "scenarioId" | "difficulty">,
): EasierStartBriefing | null {
  if (!record.attempt || !offersEasierStartIn(config)) return null;
  const on = easierStartIsOn(record);
  return {
    on,
    name: "Easier start: begin at Apocalypse (I)",
    meta: on ? "On · begins at stage I" : "Off · begins at stage II",
  };
}

/** `config` with the record's easier start applied: unchanged unless it is on and the game offers it. */
export function withEasierStart(
  config: SessionConfig,
  record: Pick<CampaignRecord, "attempt" | "easierStartNodeId">,
): SessionConfig {
  return easierStartIsOn(record) && offersEasierStartIn(config) ? { ...config, easierStart: true } : config;
}
