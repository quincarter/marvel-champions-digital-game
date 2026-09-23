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

async function settleWith(
  step: (answers: readonly CampaignChoiceAnswer[]) => Promise<CampaignStepResult>,
  answerFor: (choice: CampaignPendingChoice) => CampaignChoiceAnswer,
): Promise<CampaignRecord> {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 48; guard++) {
    const result = await step(answers);
    if (result.kind === "done") return result.record;
    answers.push(answerFor(result.choice));
  }
  throw new Error("the campaign asked more than 48 questions in one step");
}

const settle = (step: (answers: readonly CampaignChoiceAnswer[]) => Promise<CampaignStepResult>) =>
  settleWith(step, autoAnswer);

async function playIssueWith(
  service: CampaignService,
  record: CampaignRecord,
  outcome: "win" | "loss",
  answerFor: (choice: CampaignPendingChoice) => CampaignChoiceAnswer,
): Promise<CampaignRecord> {
  const composed = await settleWith((answers) => service.compose(record, answers), answerFor);
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  const started = await core.start(service.launchConfig(composed));
  if (outcome === "loss") {
    const conceded = core.dispatch({ type: "concede", playerId: started.snapshot.state.firstPlayerId });
    if (!conceded.ok) throw new Error(conceded.error.message);
    const saved = core.save();
    return settleWith((answers) => service.fold(composed, saved, answers), answerFor);
  }
  const won: GameState = {
    ...started.snapshot.state,
    cardPool: started.cardPool,
    outcome: { result: "win", reason: "villainDefeated" },
  };
  return settleWith((answers) => service.foldState(composed, won, [], answers), answerFor);
}

const playIssue = (service: CampaignService, record: CampaignRecord, outcome: "win" | "loss") =>
  playIssueWith(service, record, outcome, autoAnswer);

export type GmwRunStop = "fresh" | "afterIssue1" | "afterIssue2" | "expertAfterIssue1";

/**
 * The Market's own choices default to "decline" under `autoAnswer` (every `choose` slot in
 * `marketShoppingSetup`, `packages/cards/src/campaigns/gmw.ts`, is optional). For a fixture that should show real
 * purchases in the Dossier/Deck edit screens, this instead takes the *first* offered card at every affordable
 * tier — never a named card (the shape of `THE_MARKET`'s pool is data this file has no business hard-coding).
 */
function gmwAutoAnswer(choice: CampaignPendingChoice): CampaignChoiceAnswer {
  if (choice.slot.startsWith("market-") && choice.optional && choice.options.length > 0) {
    return {
      instructionId: choice.instructionId,
      slot: choice.slot,
      seatNumber: choice.seatNumber,
      picked: choice.options.slice(0, 1),
    };
  }
  return autoAnswer(choice);
}

const playGmwIssue = (service: CampaignService, record: CampaignRecord, outcome: "win" | "loss") =>
  playIssueWith(service, record, outcome, gmwAutoAnswer);

/**
 * The Galaxy's Most Wanted (MC16), Groot and Rocket Raccoon: `"afterIssue1"` reaches the Market with units unspent
 * (issue 1's own victory grants units but nothing has been composed against issue 2 yet — the Market's own
 * `choose`/`spend`/`grantCard` loop is issue 2's *setup*, run the next time this record is composed). `"afterIssue2"`
 * plays through to issue 2 as well, taking the cheapest affordable Market card each visit
 * (`gmwAutoAnswer`), so the Dossier and Deck edit screens have real purchases and campaign cards to show.
 * `"expertAfterIssue1"` starts the run in expert mode: `packages/client/src/view/campaign-deck-edit-model.ts`'s
 * `frozenNonCampaignCardsOf` needs a history entry for scenario 1, which only exists once it has been played.
 */
export async function seedGmwRun(
  service: CampaignService,
  stop: GmwRunStop = "afterIssue1",
  options: { readonly expertCampaign?: boolean } = {},
): Promise<CampaignRecord> {
  const decks = preconDecks(POOL_VERSION);
  const deck = (hero: string) => {
    const found = decks.find((candidate) => (candidate.id as string).includes(hero));
    if (!found) throw new Error(`no precon for ${hero}`);
    return { identityCardId: found.identityCardId, deck: found };
  };
  let record = await service.start({
    campaignId: "gmw",
    seats: [deck("groot"), deck("rocket-raccoon")],
    expertCampaign: options.expertCampaign ?? stop === "expertAfterIssue1",
    poolVersion: POOL_VERSION,
    seed: 1616,
  });
  if (stop === "fresh") return record;
  record = await playGmwIssue(service, record, "win");
  if (stop === "afterIssue1" || stop === "expertAfterIssue1") return record;
  record = await playGmwIssue(service, record, "win");
  return record;
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
