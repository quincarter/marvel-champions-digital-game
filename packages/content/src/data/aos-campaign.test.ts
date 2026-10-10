import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCampaign } from "../schema/index.js";
import {
  AOS_BOARD_MEMBER_LOG,
  AOS_CAMPAIGN,
  AOS_CARDS,
  AOS_ENCOUNTER_SETS,
  AOS_EVIDENCE_COMBINATIONS,
  AOS_SCENARIOS,
  CAMPAIGNS,
} from "./index.js";

// docs/phase7-wave9.md section 8.1 item 28: the MC50 campaign record.

const rulebook = readFileSync(
  new URL("../../../../docs/campaign-modes/markdown/mc50_agents_of_shield.md", import.meta.url),
  "utf8",
);
const flat = rulebook.replace(/\s+/g, " ");

describe("AOS_CAMPAIGN", () => {
  it("validates against the schema and is registered in CAMPAIGNS", () => {
    expect(validateCampaign(AOS_CAMPAIGN).errors).toEqual([]);
    expect(CAMPAIGNS).toContain(AOS_CAMPAIGN);
  });

  it("names the box and pack", () => {
    expect(AOS_CAMPAIGN.id as string).toBe("aos");
    expect(AOS_CAMPAIGN.name).toBe("Agents of S.H.I.E.L.D.");
    expect(AOS_CAMPAIGN.boxCode).toBe("MC50");
    expect(AOS_CAMPAIGN.packCode as string).toBe("aos");
  });

  it("plays the five scenarios in rulebook order, every one an ingested aos scenario", () => {
    const ids = AOS_CAMPAIGN.scenarioIds.map((s) => s as string);
    expect(ids).toEqual(["black-widow", "batroc", "modok", "thunderbolts", "baron-zemo"]);
    expect(AOS_SCENARIOS.map((s) => s.id as string)).toEqual(ids);
    for (const s of AOS_SCENARIOS) expect(s.packCode).toBe(AOS_CAMPAIGN.packCode);
    // MC50 p. 4: "starting with scenario #1 - Black Widow and ending with scenario #5 - Baron Zemo"
    expect(flat).toContain("starting with scenario #1 – Black Widow and ending with scenario");
    const names = AOS_SCENARIOS.map((s) => s.name);
    expect(names).toEqual(["Black Widow", "Batroc", "M.O.D.O.K.", "Thunderbolts", "Baron Zemo"]);
    // MC50 pp. 9, 11, 13, 15 and 19: each scenario's campaign instructions, in this order.
    const at = names.map((n) => flat.search(new RegExp(`Scenario #\\d[^A-Za-z]{1,6}${n.replace(/\./g, "\\.")}`, "i")));
    expect(at.every((i, k) => i >= 0 && (k === 0 || i > at[k - 1]!))).toBe(true);
  });

  it("lists no campaign set (the Executive Board sets must stay playable standalone) and no extras", () => {
    expect(AOS_CAMPAIGN.campaignSetIds).toEqual([]);
    expect(AOS_CAMPAIGN.perSeatSetIds).toBeUndefined();
    expect(AOS_CAMPAIGN.roles).toBeUndefined();
    expect(AOS_CAMPAIGN.prohibited).toBeUndefined();
    const setIds = AOS_ENCOUNTER_SETS.map((s) => s.id as string);
    expect(setIds).toContain("s.h.i.e.l.d._executive_board");
    expect(setIds).toContain("executive_board_evidence");
  });
});

describe("AOS_BOARD_MEMBER_LOG (Q1 and Q11 live here)", () => {
  it("names the three Board Members, each a card that exists and is the combination grid's board member", () => {
    const ids = AOS_BOARD_MEMBER_LOG.boardMemberIds.map((c) => c as string);
    expect(ids).toEqual(["50181a", "50182a", "50183a"]);
    const gridMembers = new Set(AOS_EVIDENCE_COMBINATIONS.map((r) => r.boardMember as string));
    expect([...gridMembers].sort()).toEqual(ids);
    for (const id of ids) {
      const c = AOS_CARDS.find((x) => (x.id as string) === id);
      expect(c, id).toBeDefined();
      expect(c?.type).toBe("environment");
    }
    expect(AOS_CARDS.map((c) => c.id as string)).toEqual(expect.arrayContaining(["50181b", "50182b", "50183b"]));
  });

  it("reads the secret counter key, and holds the owner's current choice (1B, 11B)", () => {
    expect(AOS_BOARD_MEMBER_LOG.counter).toBe("secret");
    expect(AOS_BOARD_MEMBER_LOG.recordFace).toBe(false);
    expect(AOS_BOARD_MEMBER_LOG.secretsStayOnFlip).toBe(false);
  });

  it("is grounded in the rulebook's wording", () => {
    expect(flat).toContain("Record the number of secret counters on each Board Member card in the campaign log.");
    expect(flat).toContain(
      "once a board member flips to its attachment side, it remains an attachment for the rest of the campaign",
    );
    expect(flat).toContain(
      "Place secret counters on each Board Member environment equal to the number of secret counters recorded for that environment in scenario #1.",
    );
  });
});
