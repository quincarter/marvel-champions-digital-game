/**
 * A composed Shadowland scenario on the table (MC65, docs/phase7-shadowland.md section 4.1): the villain the campaign drew
 * is answered as a card (`villainCardId`, the pack's one set holds all six), the composed encounter sets and the campaign
 * input ride along, and the campaign picker refuses Black Flower.
 */
import { describe, expect, test } from "vitest";
import {
  CAMPAIGNS,
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  SHADOWLAND_SCENARIOS,
  WAVE11_ENCOUNTER_SETS,
  type PlayModes,
} from "@mc/content";
import {
  activeVillain,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignLog,
  type GameState,
} from "@mc/engine";
import { campaignDefinitionOf, campaignModularPickProblem } from "@mc/cards";
import { LocalEngineHost } from "../engine/local-host.js";
import { campaignLaunchConfig, campaignStepRows, workingFieldsOf } from "./campaign-step-model.js";
import { campaignLogSheet } from "./campaign-log-model.js";
import { ALL_OPEN, modularCandidatesFor } from "./modular-candidates.js";

const DEF = campaignDefinitionOf("shadowland")!;
const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const SEATS = CORE_STARTER_DECKS.slice(0, 2).map((starter, index) => ({
  seatNumber: index + 1,
  identityCardId: starter.identityCardId,
  deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: [...starter.cards] },
}));
const VILLAIN_IDS = new Set<string>(
  SHADOWLAND_SCENARIOS.find((s) => s.id === "shadows-in-the-night")!.villainOptions!.options.map(
    (o) => o.villainCardId as string,
  ),
);

function composeFirst(): CampaignLog {
  const log = createCampaignLog(DEF, { id: "sl", seats: SEATS, modes: STANDARD, poolVersion: "test", seed: 7 });
  const answers: CampaignChoiceAnswer[] = [];
  for (let round = 0; round < 40; round++) {
    const result = resolveBetweenGames(DEF, log, { pool: PLAYABLE_CARDS }, log.modes, answers);
    if (result.kind === "done") return result.value;
    const c = result.choice;
    answers.push({
      instructionId: c.instructionId,
      slot: c.slot,
      seatNumber: c.seatNumber,
      picked: c.optional ? [] : [c.options[0]!],
    });
  }
  throw new Error("loop");
}

describe("a composed Shadowland scenario's launch", () => {
  const log = composeFirst();
  const config = campaignLaunchConfig(DEF, log);

  test("the drawn villain is answered as a card, never as a set", () => {
    expect(config.scenarioId).toBe("shadows-in-the-night");
    expect(VILLAIN_IDS.has(config.villainCardId!)).toBe(true);
    expect(config.villainSetId).toBeUndefined();
  });

  test("the composed sets and the campaign input ride along", () => {
    expect(config.campaign?.seats).toHaveLength(SEATS.length);
    expect(config.campaignEncounterSets?.deck.length).toBeGreaterThan(0);
    expect(config.campaign?.setAsideCards?.length ?? 0).toBeGreaterThan(0);
  });

  test("the game starts against that villain with the campaign attached", async () => {
    const host = new LocalEngineHost();
    let state: GameState | null = null;
    host.subscribe((update) => {
      state = update.state;
    });
    await host.start(config);
    const started = state!;
    const villain = started.instances[activeVillain(started).instanceId]!;
    expect(villain.cardId as string).toBe(config.villainCardId);
    expect(started.campaign).toBeDefined();
    // 72A: one per player in play under their control, the other copies set aside (four in all).
    const corruption = Object.values(started.instances).filter((i) => (i.cardId as string) === "65072a");
    const inPlay = corruption.filter((i) => i.attachedTo !== null);
    expect(inPlay).toHaveLength(SEATS.length);
    for (const seat of started.players) {
      const mine = inPlay.filter((i) => i.controllerId === seat.playerId);
      expect(mine, String(seat.playerId)).toHaveLength(1);
    }
  });
});

describe("the campaign log sheet", () => {
  const sheetOf = (log: CampaignLog) => campaignLogSheet(DEF, log, (id) => `<${id}>`);
  const idsOf = (sheet: ReturnType<typeof sheetOf>) => [
    ...sheet.shared.map((r) => r.id),
    ...sheet.seats.flatMap((s) => s.fields.map((f) => f.id)),
  ];

  test("shows the printed boxes and none of the working fields", () => {
    const ids = idsOf(sheetOf(composeFirst()));
    for (const shown of ["identity", "recordedCards", "overpowering1", "overpowering2", "removedVillains"])
      expect(ids, shown).toContain(shown);
    for (const hidden of ["identityName", "villain", "candidates", "unrecordable"])
      expect(ids, hidden).not.toContain(hidden);
    expect(ids).not.toContain("remainingHp");
  });

  test("renders the recorded cards, the OVERPOWERING flags and the removed villains", () => {
    const base = composeFirst();
    const log: CampaignLog = {
      ...base,
      shared: { ...base.shared, removedVillains: { kind: "cardList", cardIds: ["65016a", "65017a"] as never } },
      seats: base.seats.map((seat) => ({
        ...seat,
        fields: {
          ...seat.fields,
          recordedCards: { kind: "cardList", cardIds: ["01008", "01009"] as never },
          overpowering1: { kind: "flag", value: true },
          overpowering2: { kind: "flag", value: false },
        },
      })),
    };
    const sheet = sheetOf(log);
    const text = (id: string) => sheet.seats[0]!.fields.find((f) => f.id === id)!.rendered;
    expect(sheet.shared.find((r) => r.id === "removedVillains")!.rendered).toBe("<65016a>, <65017a>");
    expect(text("recordedCards")).toBe("<01008>, <01009>");
    expect(text("overpowering1")).toBe("Yes");
    expect(text("overpowering2")).toBe("No");
    expect(text("identity")).toBe(`<${base.seats[0]!.identityCardId}>`);
  });

  test("an expert campaign adds the remaining hit points", () => {
    const base = composeFirst();
    const expert: CampaignLog = {
      ...base,
      modes: { campaign: { campaignId: DEF.campaignId, expertCampaign: true } },
      seats: base.seats.map((seat) => ({
        ...seat,
        fields: { ...seat.fields, remainingHp: { kind: "number", value: 7 } },
      })),
    };
    const hp = sheetOf(expert).seats[0]!.fields.find((f) => f.id === "remainingHp");
    expect(hp?.rendered).toBe("7");
  });
});

describe("Shadow Labyrinth's drawn villain", () => {
  const labyrinth = (): CampaignLog => {
    const base = createCampaignLog(DEF, { id: "sl2", seats: SEATS, modes: STANDARD, poolVersion: "test", seed: 3 });
    const log = { ...base, position: { ...base.position, nextNodeId: "shadow-labyrinth" } } as CampaignLog;
    const answers: CampaignChoiceAnswer[] = [];
    for (let round = 0; round < 40; round++) {
      const result = resolveBetweenGames(DEF, log, { pool: PLAYABLE_CARDS }, log.modes, answers);
      if (result.kind === "done") return result.value;
      const c = result.choice;
      answers.push({
        instructionId: c.instructionId,
        slot: c.slot,
        seatNumber: c.seatNumber,
        picked: c.optional ? [] : [c.options[0]!],
      });
    }
    throw new Error("loop");
  };

  test("is not named by the Briefing's step rows, though scenario 1's draw is", () => {
    const named = (log: CampaignLog) =>
      campaignStepRows(log.attempt!.steps, (id) => `<${id}>`, undefined, {
        nodeId: log.attempt!.nodeId,
        workingFields: workingFieldsOf(DEF),
      })
        .flatMap((row) => row.effects)
        .join(" | ");
    const second = labyrinth();
    const drawn = second.attempt!.steps.flatMap((step) => step.choices).find((c) => c.slot === "villain")!.picked[0]!;
    expect(named(second)).not.toContain(drawn);
    expect(named(second)).toContain("set aside facedown");
    const first = composeFirst();
    const drawnFirst = first.attempt!.steps.flatMap((step) => step.choices).find((c) => c.slot === "villain")!
      .picked[0]!;
    expect(named(first)).toContain(drawnFirst);
    // The working fields' writes are bookkeeping, not rows.
    expect(named(first)).not.toMatch(/Identity Name|Candidates|Unrecordable/);
  });
});

describe("the campaign modular picker", () => {
  const campaign = CAMPAIGNS.find((c) => (c.id as string) === "shadowland")!;
  const scenario = SHADOWLAND_SCENARIOS.find((s) => s.id === "shadows-in-the-night")!;
  const reason = (candidates: ReturnType<typeof modularCandidatesFor>, id: string) =>
    candidates.find((c) => c.id === id)?.disabledReason;

  test("the box bars Black Flower, and the cards package says why", () => {
    expect(campaign.prohibited?.encounterSetIds).toContain("black_flower");
    expect(campaignModularPickProblem(campaign, scenario, "black_flower", WAVE11_ENCOUNTER_SETS)).toMatch(/Shadowland/);
    expect(campaignModularPickProblem(campaign, scenario, "ninja_swarm", WAVE11_ENCOUNTER_SETS)).toBeNull();
  });

  test("lists Black Flower disabled in the campaign and open standalone", () => {
    const inCampaign = modularCandidatesFor(scenario, ALL_OPEN, WAVE11_ENCOUNTER_SETS, campaign);
    expect(inCampaign.map((c) => c.id)).toContain("black_flower");
    expect(reason(inCampaign, "black_flower")).toMatch(/Shadowland/);
    expect(reason(inCampaign, "black_flower")).not.toContain("black_flower");
    expect(reason(inCampaign, "ninja_swarm")).toBeUndefined();
    const standalone = modularCandidatesFor(scenario, ALL_OPEN, WAVE11_ENCOUNTER_SETS);
    expect(standalone.map((c) => c.id)).toContain("black_flower");
    expect(reason(standalone, "black_flower")).toBeUndefined();
  });
});
