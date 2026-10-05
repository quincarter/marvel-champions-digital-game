/**
 * MC32's Log, Overview and Heroes tabs (QA wave 6): a hidden field is never listed, a role reads as its name, a
 * Future Past card in the victory display is shown as removed (MC32 p. 7: "Remove each Future Past card in the
 * victory display from the campaign") rather than as an addition, and The World never repeats a label as its own
 * description.
 */
import { describe, expect, it } from "vitest";
import {
  createCampaignLog,
  type CampaignHistoryEntry,
  type CampaignLog,
  type CampaignStepTrace,
  type LogWrite,
} from "@mc/engine";
import { campaignDefinitionOf } from "@mc/cards";
import { cardId } from "@mc/content";
import { campaignDossierHero, campaignDossierLog, campaignDossierOverview } from "./campaign-dossier-model.js";

const DEFINITION = campaignDefinitionOf("mut_gen")!;
const heroNameOf = (id: string): string => ({ colossus: "Colossus", shadowcat: "Shadowcat" })[id] ?? id;
const names: Record<string, string> = { bastion: "Bastion", nimrod: "Nimrod", nano: "Nano-Sentinel Tech" };
const cardName = (id: string): string => names[id] ?? id;

const step = (instructionId: string, extra: Partial<CampaignStepTrace>): CampaignStepTrace => ({
  instructionId,
  text: "A long printed instruction sentence that must not repeat on every row.",
  citation: "MC32 p. 7",
  kind: "record",
  writes: [],
  choices: [],
  removedFromCampaign: [],
  grants: [],
  ...extra,
});

const write = (field: string, seatNumber: number | null, value: LogWrite["value"], mode: LogWrite["mode"] = "set") =>
  ({ field, seatNumber, mode, value }) as LogWrite;

function record(): CampaignLog & { readonly name: string } {
  const seat = (seatNumber: number, id: string) => ({
    seatNumber,
    identityCardId: cardId(id),
    deck: { identityCardId: cardId(id), aspects: [], cards: [] },
  });
  const base = createCampaignLog(DEFINITION, {
    id: "mut-gen-dossier-test",
    poolVersion: "test",
    modes: { campaign: { campaignId: DEFINITION.campaignId } },
    seats: [seat(1, "colossus"), seat(2, "shadowcat")],
    seed: 1,
  });
  const entry: CampaignHistoryEntry = {
    nodeId: "sabretooth",
    modes: base.modes,
    outcome: "won",
    gameId: null,
    logBefore: { ...base, seats: base.seats } as unknown as CampaignHistoryEntry["logBefore"],
    at: 1,
    steps: [
      step("roles", {
        writes: [
          write("role", 1, { kind: "choice", option: "brawler" }),
          write("rolesTaken", null, { kind: "strikeList", struck: ["brawler", "commander"] }),
          write("role", 2, { kind: "choice", option: "commander" }),
        ],
      }),
      step("future-past", {
        writes: [
          write("futurePast", null, { kind: "cardList", cardIds: [cardId("bastion"), cardId("nimrod")] }, "append"),
          write("futurePastVictoryDisplay", null, { kind: "cardList", cardIds: [cardId("nano")] }),
        ],
      }),
      step("remove", { kind: "betweenGames", removedFromCampaign: [{ cardId: cardId("nano") }] }),
    ],
  };
  return {
    ...base,
    name: "Mutant Genesis",
    history: [entry],
    position: { ...base.position, resolved: { sabretooth: "completed" } },
  };
}

describe("MC32 Log tab", () => {
  const section = campaignDossierLog(record(), DEFINITION, cardName, heroNameOf).sections[0]!;
  const headlines = section.entries.map((entry) => entry.headline);

  it("never lists a hidden field's bookkeeping row", () => {
    expect(DEFINITION.logFields.find((field) => field.id === "rolesTaken")?.hidden).toBe(true);
    expect(headlines.some((line) => /struck|taken \(working\)|roles taken/i.test(line))).toBe(false);
    expect(section.entries.some((entry) => /rolesTaken/.test(entry.key))).toBe(false);
  });

  it("names a role the way the briefing does, not as a raw id", () => {
    expect(headlines).toContain("Colossus took the Brawler role.");
    expect(headlines).toContain("Shadowcat took the Commander role.");
    expect(headlines.some((line) => /brawler role →/.test(line))).toBe(false);
  });

  it("shows recorded Future Past cards as recorded and victory-display cards as removed, in short rows", () => {
    expect(headlines).toContain("Recorded: Bastion, Nimrod");
    expect(headlines).toContain("Nano-Sentinel Tech removed from the campaign");
    expect(headlines.some((line) => line.startsWith("+ "))).toBe(false);
    const recorded = section.entries.find((entry) => entry.headline.startsWith("Recorded"))!;
    expect(recorded.detail).toBe("Joins later encounter decks.");
    for (const entry of section.entries) expect(entry.detail).not.toMatch(/printed instruction sentence/);
    expect(recorded.citation).toBe("MC32 p. 7");
  });
});

describe("MC32 Overview and Heroes tabs", () => {
  it("The World never repeats a label as its own description or prints a page ref", () => {
    const overview = campaignDossierOverview(record(), DEFINITION, heroNameOf, cardName);
    expect(overview.world.length).toBeGreaterThan(0);
    for (const row of overview.world) {
      expect(row.when).not.toContain(row.label);
      expect(row.when).not.toMatch(/MC32 p\./);
    }
    expect(overview.world.find((row) => row.id === "frightenedPolice")?.when).toMatch(/role upgrade/i);
    // Cards waiting in the victory display are removal bookkeeping, not a world fact.
    expect(overview.world.some((row) => row.id === "futurePastVictoryDisplay")).toBe(false);
  });

  it("shows each hero's role on both tabs", () => {
    const withRoles = record();
    const roled = {
      ...withRoles,
      seats: withRoles.seats.map((seat, index) => ({
        ...seat,
        fields: { ...seat.fields, role: { kind: "choice" as const, option: index === 0 ? "brawler" : "commander" } },
      })),
    };
    const overview = campaignDossierOverview(roled, DEFINITION, heroNameOf, cardName);
    expect(overview.seats[0]!.rows.find((row) => row.label === "Role")?.value).toBe("Brawler");
    expect(overview.seats[1]!.rows.find((row) => row.label === "Role")?.value).toBe("Commander");
    const hero = campaignDossierHero(roled, DEFINITION, 1, () => undefined)!;
    expect(hero.stats.find((stat) => stat.label === "Role")?.value).toBe("Brawler");
  });
});
