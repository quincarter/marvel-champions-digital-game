/**
 * What the sections read for this draw, by the engine's and the models' own answers: the issue's view (side scheme, mission,
 * case file) and, from the game the composed issue would launch, the easier-start toggle and the mode rows. The client decides
 * none of it; a record that cannot be launched shows neither.
 */
import { campaignService } from "../../../../session.js";
import type { CampaignRecord } from "../../../../engine/campaign-storage.js";
import { easierStartBriefingOf } from "../../../../view/campaign-easier-start-model.js";
import { issueModeRowsOf } from "../../../../view/campaign-modes-model.js";
import type { BriefingCtx } from "../context.js";
import type { SectionData } from "./sections.types.js";

function launchedOf(record: CampaignRecord): Pick<SectionData, "easier" | "modes"> {
  try {
    const config = campaignService().launchConfig(record);
    return {
      easier: easierStartBriefingOf(record, config),
      modes: issueModeRowsOf(config.scenarioId, record.issueModes ?? {}, config.villainSetId),
    };
  } catch {
    return { easier: null, modes: [] };
  }
}

/** The sections of the composed issue; every one null or empty before an issue is composed. */
export function sectionDataOf(ctx: BriefingCtx): SectionData {
  const record = ctx.state.record;
  const view = ctx.plan?.view ?? null;
  const scheme = view?.sideScheme ?? null;
  const launched = record?.attempt ? launchedOf(record) : { easier: null, modes: [] };
  return {
    scheme,
    mission: view?.missions ?? null,
    shield: view?.shield ?? null,
    easier: launched.easier,
    // Chosen before the issue opens: a game already on the table keeps the modes it was composed under.
    modes: ctx.state.inProgress ? [] : launched.modes,
  };
}
