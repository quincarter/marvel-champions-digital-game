/**
 * A Fear No Evil issue starts the game the Briefing composed: the villain it recorded (MC60 p. 9 step 5), not the
 * scenario's default Hammerhead, and at Protection Racket one main scheme per seat (the owner, 2026-10-21: Open issue
 * failed there, and every issue played Hammerhead).
 */
import { describe, expect, test } from "vitest";
import { CORE_STARTER_DECKS, PLAYABLE_CARDS, type PlayModes } from "@mc/content";
import {
  activeVillain,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignLog,
  type GameState,
} from "@mc/engine";
import { campaignDefinitionOf } from "@mc/cards";
import { LocalEngineHost } from "../engine/local-host.js";
import { campaignLaunchConfig } from "./campaign-step-model.js";

const DEF = campaignDefinitionOf("fne")!;
const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const SEATS = CORE_STARTER_DECKS.slice(0, 2).map((starter, index) => ({
  seatNumber: index + 1,
  identityCardId: starter.identityCardId,
  deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: [...starter.cards] },
}));

/** Composes the first issue: a later playthrough (a random villain), at `scenario` when the draw offers it. */
function compose(scenario: string, seed: number): CampaignLog | null {
  const log = createCampaignLog(DEF, { id: "fne-l", seats: SEATS, modes: STANDARD, poolVersion: "test", seed });
  const answers: CampaignChoiceAnswer[] = [];
  for (let round = 0; round < 40; round++) {
    const result = resolveBetweenGames(DEF, log, { pool: PLAYABLE_CARDS }, log.modes, answers);
    if (result.kind === "done") return result.value.attempt?.nodeId === scenario ? result.value : null;
    const c = result.choice;
    const picked =
      c.slot === "playthrough" ? "Not the first playthrough" : (c.options.find((o) => o === scenario) ?? c.options[0]!);
    answers.push({ instructionId: c.instructionId, slot: c.slot, seatNumber: c.seatNumber, picked: [picked] });
  }
  throw new Error("loop");
}

/** The first seed whose issue lands on `scenario` with a villain other than Hammerhead. */
function composedAt(scenario: string): CampaignLog {
  for (let seed = 1; seed < 200; seed++) {
    const log = compose(scenario, seed);
    const villain = log?.shared[`villain.${scenario}`];
    if (log && villain && JSON.stringify(villain).includes('"hammerhead"') === false) return log;
  }
  throw new Error(`no seed composes ${scenario} against a villain other than Hammerhead`);
}

async function started(log: CampaignLog): Promise<GameState> {
  const host = new LocalEngineHost();
  let state: GameState | null = null;
  host.subscribe((update) => {
    state = update.state;
  });
  await host.start(campaignLaunchConfig(DEF, log));
  return state!;
}

describe("a composed Fear No Evil issue on the table", () => {
  test("Protection Racket with two seats opens, one main scheme each, against the recorded villain", async () => {
    const log = composedAt("protection-racket");
    const config = campaignLaunchConfig(DEF, log);
    const recorded = JSON.stringify(log.shared["villain.protection-racket"]);
    expect(config.villainSetId).toBeDefined();
    expect(recorded).toContain(`"${config.villainSetId}"`);
    expect(config.mainSchemePicks).toHaveLength(2);
    expect(new Set(config.mainSchemePicks).size).toBe(2);

    const state = await started(log);
    expect(1 + (state.extraMainSchemes?.length ?? 0)).toBe(2);
    const villainSet = state.cardPool[state.instances[activeVillain(state).instanceId]!.cardId]!;
    expect(JSON.stringify(villainSet)).toContain(`"${config.villainSetId}"`);
    expect(villainSet.name).not.toBe("Hammerhead");
  });

  test("a one-scheme issue sends its villain and no main scheme picks", () => {
    const log = composedAt("art-museum-heist");
    const config = campaignLaunchConfig(DEF, log);
    expect(JSON.stringify(log.shared["villain.art-museum-heist"])).toContain(`"${config.villainSetId}"`);
    expect(config.mainSchemePicks).toBeUndefined();
  });
});
