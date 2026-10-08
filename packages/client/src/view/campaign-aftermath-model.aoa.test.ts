/**
 * Age of Apocalypse's rewards on the Aftermath (MC45 p. 24): the whole-collection picks (an upgrade or a support from
 * any aspect) read as the picker and are never exclusive; Find Lost Mutants' four campaign allies stay a short column.
 * Built from the real definition, the real pool and a real composed attempt.
 */
import { describe, expect, it } from "vitest";
import { AOA_CAMPAIGN_DEFINITION as DEF } from "@mc/cards";
import { cardId, type CardId } from "@mc/content";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
} from "@mc/engine";
import { CARDS_BY_ID, POOL_CARDS } from "../content/pool.js";
import { preconDecks } from "./deck-list-model.js";
import { POOL_VERSION } from "../content/pool.js";
import {
  COLLECTION_PICK_FLOOR,
  isCollectionPick,
  postFoldDestination,
  startAftermathGroup,
  type AftermathOption,
} from "./campaign-aftermath-model.js";

const POOL = { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) };
const MISSIONS = ["Liberate the Seattle Core", "Evacuate Survivors", "Sabotage the Sea Wall", "Find Lost Mutants"];

function composed(seed: number): CampaignLog {
  const deck = preconDecks(POOL_VERSION).find((candidate) => (candidate.id as string).includes("bishop"))!;
  const log = createCampaignLog(DEF, {
    id: `aoa-aftermath-${seed}`,
    seats: [
      {
        seatNumber: 1,
        identityCardId: deck.identityCardId,
        deck: { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards },
      },
    ],
    modes: { campaign: { campaignId: DEF.campaignId } },
    poolVersion: POOL_VERSION,
    seed,
  });
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 32; guard++) {
    const result = resolveBetweenGames(DEF, log, POOL, log.modes, answers);
    if (result.kind === "done") return result.value;
    answers.push({ ...result.choice, picked: result.choice.optional ? [] : result.choice.options.slice(0, 1) });
  }
  throw new Error("never settled");
}

const won = (log: CampaignLog): CampaignGameResult => {
  const mission = (log.shared.currentMission as { option: string }).option;
  const flag = (instructionId: string, field: string, value: boolean) => ({
    instructionId,
    write: { field, seatNumber: null, mode: "set" as const, value: { kind: "flag" as const, value } },
  });
  const rows = ["liberate", "evacuate", "sabotage", "find"];
  return {
    nodeId: "unus",
    outcome: "won",
    records: [
      flag("mc45.s1.victory.overseer-record", "overseerDefeated", false),
      ...rows.map((row, index) =>
        flag(`mc45.s1.victory.${row}.record`, "missionDefeated", MISSIONS[index] === mission),
      ),
    ],
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
  };
};

/** The reward prompt a won scenario 1 raises for the first seat, for the first seed whose mission is `mission`. */
function rewardPrompt(mission: string): CampaignPendingChoice {
  for (let seed = 1; seed < 80; seed++) {
    const log = composed(seed);
    if ((log.shared.currentMission as { option: string }).option !== mission) continue;
    const result = applyCampaignResult(DEF, log, won(log), { at: 1, gameId: "g" }, POOL, []);
    if (result.kind === "pending") return result.choice;
  }
  throw new Error(`no seed draws ${mission}`);
}

const optionOf = (id: CardId): AftermathOption =>
  ({ cardId: id, name: CARDS_BY_ID.get(id as string)?.name ?? id }) as never;

describe("Age of Apocalypse rewards on the Aftermath", () => {
  it("an upgrade or support from any aspect is the search picker, offered a hundred or so cards and never exclusive", () => {
    for (const mission of ["Evacuate Survivors", "Sabotage the Sea Wall"]) {
      const choice = rewardPrompt(mission);
      expect(choice.slot).toBe("reward");
      expect(choice.optional).toBe(true);
      expect(choice.options.length, mission).toBeGreaterThanOrEqual(COLLECTION_PICK_FLOOR);
      expect(isCollectionPick(choice.slot, choice.options.length)).toBe(true);
      const group = startAftermathGroup(choice, [{ seatNumber: 1, heroName: "Bishop" }], (id) => optionOf(cardId(id)));
      expect(group.noExclusivity).toBe(true);
    }
  });

  it("Find Lost Mutants' four campaign allies stay a short column, one copy each for the table", () => {
    const choice = rewardPrompt("Find Lost Mutants");
    expect(choice.options).toHaveLength(4);
    expect(isCollectionPick(choice.slot, choice.options.length)).toBe(false);
    const group = startAftermathGroup(choice, [{ seatNumber: 1, heroName: "Bishop" }], (id) => optionOf(cardId(id)));
    expect(group.noExclusivity).toBe(false);
  });

  it("no other box's slot becomes the picker (Sinister Motives' own and every other slot keep their column)", () => {
    expect(isCollectionPick("aspectAdvantage", 3)).toBe(true);
    expect(isCollectionPick("tech", 200)).toBe(false);
    expect(isCollectionPick("shieldTech", 200)).toBe(false);
  });
});

describe("where a folded win goes", () => {
  it("a won campaign is the Finale, a lost one (the last scenario won, the Professor not saved) the campaign-lost screen", () => {
    expect(postFoldDestination("won")).toBe("finale");
    expect(postFoldDestination("lost")).toBe("campaignLost");
    expect(postFoldDestination("active")).toBe("summary");
  });
});
