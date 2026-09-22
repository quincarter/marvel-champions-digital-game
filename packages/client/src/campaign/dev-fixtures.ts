/**
 * Campaign runs in a known state, for screenshots, screen development and tests — never reachable from the UI.
 *
 * `seedDesignRun` reproduces the design canvases' own story (`Campaign - *.dc.html`): Hawkeye and Spider-Woman,
 * issue #1 won on the first try (Hawkeye takes Emergency Teleporter, Spider-Woman Tactical Scanner), issue #2 lost
 * once and then won (Hawkeye takes Upgrade Attack, Spider-Woman Upgrade Thwart), with issue #3 up next. `"finished"`
 * carries on through all five issues so the Finale has a won run to show.
 *
 * Each game is a real game started through `EngineSessionCore` and folded through the real runner; only the
 * verdict of a "won" game is substituted, exactly as `@mc/cards`' `trors.test.ts` does, because nothing here can
 * play a scenario to a win.
 */
import type { CampaignChoiceAnswer, CampaignPendingChoice, GameState } from "@mc/engine";
import { POOL_VERSION } from "../content/pool.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { preconDecks } from "../view/deck-list-model.js";
import type { CampaignService, CampaignStepResult } from "./campaign-service.js";

export type DesignRunStop = "fresh" | "issue1Composed" | "afterIssue1" | "afterIssue2" | "lostIssue3" | "finished";

/** MC10's TECH (p. 5) and "Basic" Condition (p. 7) upgrades, by what the design's heroes took. */
const DESIGN_PICKS: Readonly<Record<string, Readonly<Record<number, readonly string[]>>>> = {
  tech: { 1: ["04157"], 2: ["04156"] },
  basic: { 1: ["04160a"], 2: ["04159a"] },
};

/** The design's pick where it has one; otherwise decline anything optional and take the first option. */
function autoAnswer(choice: CampaignPendingChoice): CampaignChoiceAnswer {
  const scripted = DESIGN_PICKS[choice.slot]?.[choice.seatNumber ?? 0];
  const picked = scripted?.every((id) => choice.options.includes(id))
    ? scripted
    : choice.optional
      ? []
      : choice.options.slice(0, choice.count);
  return { instructionId: choice.instructionId, slot: choice.slot, seatNumber: choice.seatNumber, picked };
}

async function settle(
  step: (answers: readonly CampaignChoiceAnswer[]) => Promise<CampaignStepResult>,
): Promise<CampaignRecord> {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 32; guard++) {
    const result = await step(answers);
    if (result.kind === "done") return result.record;
    answers.push(autoAnswer(result.choice));
  }
  throw new Error("the campaign asked more than 32 questions in one step");
}

async function playIssue(
  service: CampaignService,
  record: CampaignRecord,
  outcome: "win" | "loss",
): Promise<CampaignRecord> {
  const composed = await settle((answers) => service.compose(record, answers));
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  const started = await core.start(service.launchConfig(composed));
  if (outcome === "loss") {
    const conceded = core.dispatch({ type: "concede", playerId: started.snapshot.state.firstPlayerId });
    if (!conceded.ok) throw new Error(conceded.error.message);
    const saved = core.save();
    return settle((answers) => service.fold(composed, saved, answers));
  }
  const won: GameState = {
    ...started.snapshot.state,
    cardPool: started.cardPool,
    outcome: { result: "win", reason: "villainDefeated" },
  };
  return settle((answers) => service.foldState(composed, won, [], answers));
}

/** Stores a run at `stop` and returns it. Each call makes a new run. */
export async function seedDesignRun(
  service: CampaignService,
  stop: DesignRunStop = "afterIssue2",
  options: { readonly expertCampaign?: boolean } = {},
): Promise<CampaignRecord> {
  const decks = preconDecks(POOL_VERSION);
  const deck = (hero: string) => {
    const found = decks.find((candidate) => (candidate.id as string).includes(hero));
    if (!found) throw new Error(`no precon for ${hero}`);
    return { identityCardId: found.identityCardId, deck: found };
  };
  let record = await service.start({
    campaignId: "trors",
    seats: [deck("hawkeye"), deck("spider-woman")],
    expertCampaign: options.expertCampaign ?? false,
    poolVersion: POOL_VERSION,
    seed: 2026,
  });
  if (stop === "fresh") return record;
  if (stop === "issue1Composed") return settle((answers) => service.compose(record, answers));
  record = await playIssue(service, record, "win");
  if (stop === "afterIssue1") return record;
  record = await playIssue(service, record, "loss");
  record = await playIssue(service, record, "win");
  if (stop === "afterIssue2") return record;
  if (stop === "lostIssue3") return playIssue(service, record, "loss");
  while (record.status === "active") record = await playIssue(service, record, "win");
  return record;
}
