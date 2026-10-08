/**
 * Missions and Overseers on the Briefing and the Dossier (MC45 pp. 5, 14, 24), against the real definition, the real
 * pool and a real composed attempt: the draw, a retry's new draw (`CampaignChoiceRecord.attempt`), the Prelate absent
 * in scenario 3 (`mc45.s3.setup.prelate`), and the four rows as the sheet prints them.
 */
import { describe, expect, it } from "vitest";
import { AOA_CAMPAIGN_DEFINITION as DEF, AOA_MISSIONS, AOA_OVERSEERS } from "@mc/cards";
import {
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignHistoryEntry,
  type CampaignLog,
} from "@mc/engine";
import { POOL_CARDS, POOL_VERSION } from "../content/pool.js";
import { preconDecks } from "./deck-list-model.js";
import { briefingViewOf } from "./campaign-briefing-model.js";
import { DECK_NOTE_EXEMPT, DECK_NOTE_REWARD, grantsCountTowardDeckSize } from "./campaign-briefing-model.js";
import { campaignDossierOverview } from "./campaign-dossier-model.js";
import { aftermathLogTags } from "./campaign-aftermath-model.js";
import { plainWriteRows } from "./campaign-write-words.js";
import { hasMissions, missionResultWordsOf, missionBriefingOf, missionTableOf } from "./campaign-mission-model.js";
import { campaignDefinitionOf } from "@mc/cards";

const POOL = { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) };

function fresh(seed: number): CampaignLog {
  const deck = preconDecks(POOL_VERSION).find((candidate) => (candidate.id as string).includes("bishop"))!;
  return createCampaignLog(DEF, {
    id: `aoa-mission-${seed}`,
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
}

function compose(log: CampaignLog): CampaignLog {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 32; guard++) {
    const result = resolveBetweenGames(DEF, log, POOL, log.modes, answers);
    if (result.kind === "done") return result.value;
    answers.push({ ...result.choice, picked: result.choice.optional ? [] : result.choice.options.slice(0, 1) });
  }
  throw new Error("never settled");
}

const optionOf = (log: CampaignLog, field: string): string => {
  const value = log.shared[field];
  return value?.kind === "choice" ? value.option : "";
};

/** What a lost game leaves: the attempt's steps in history, the log back at the node's start (MC45 p. 4, free retry). */
function lose(composed: CampaignLog): CampaignLog {
  const attempt = composed.attempt!;
  const entry: CampaignHistoryEntry = {
    nodeId: attempt.nodeId,
    modes: attempt.modes,
    outcome: "lost",
    gameId: null,
    logBefore: attempt.logBefore,
    steps: attempt.steps,
    at: 1,
  };
  const { attempt: _spent, ...rest } = composed;
  return {
    ...rest,
    shared: attempt.logBefore.shared,
    hidden: attempt.logBefore.hidden,
    position: attempt.logBefore.position,
    rng: attempt.logBefore.rng,
    history: [...composed.history, entry],
  };
}

describe("the Briefing's mission section", () => {
  it("names the drawn mission and Overseer, with their card ids and the mission's Setup in a few words", () => {
    const composed = compose(fresh(5));
    const brief = missionBriefingOf(composed, DEF)!;
    expect(brief.nodeId).toBe("unus");
    expect(brief.attempt).toBe(1);
    expect(brief.mission?.name).toBe(optionOf(composed, "currentMission"));
    expect(AOA_MISSIONS.map((row) => row.name)).toContain(brief.mission!.name);
    expect(brief.mission!.setup.length).toBeGreaterThan(0);
    expect(AOA_OVERSEERS.map((overseer) => overseer.name)).toContain(brief.overseer!.name);
    expect(brief.prelateAbsent).toBeNull();
    expect(brief.earlier).toEqual([]);
    expect(brief.fixed).toBe(false);
  });

  it("is on the BriefingView, and is null for a box without missions and before anything is composed", () => {
    const composed = compose(fresh(5));
    const view = briefingViewOf(
      { ...composed, recordSchema: 1, name: "x", box: "MC45", createdAt: 0, updatedAt: 0 } as never,
      (id) => id as string,
      1,
      DEF,
      ["unus"],
    );
    expect(view?.missions?.mission?.name).toBe(optionOf(composed, "currentMission"));
    expect(missionBriefingOf(fresh(5), DEF)).toBeNull();
    const trors = campaignDefinitionOf("trors")!;
    expect(hasMissions(trors)).toBe(false);
    expect(missionBriefingOf(composed, trors)).toBeNull();
    expect(missionTableOf(composed, trors)).toBeNull();
  });

  it("a lost attempt's draw is listed, and the retry draws again (a new mission and Overseer on some seeds)", () => {
    let redrawn = false;
    for (let seed = 1; seed <= 40; seed++) {
      const first = compose(fresh(seed));
      const second = compose(lose(first));
      const brief = missionBriefingOf(second, DEF)!;
      expect(brief.attempt).toBe(2);
      expect(brief.earlier).toEqual([
        { attempt: 1, mission: optionOf(first, "currentMission"), overseer: optionOf(first, "currentOverseer") },
      ]);
      const differs =
        optionOf(second, "currentMission") !== optionOf(first, "currentMission") ||
        optionOf(second, "currentOverseer") !== optionOf(first, "currentOverseer");
      redrawn ||= differs;
    }
    expect(redrawn).toBe(true);
  });

  it("scenario 3 names the Prelate absent from the game, the one on the reverse of that game's Overseer", () => {
    const base = fresh(9);
    const atThree: CampaignLog = {
      ...base,
      position: {
        ...base.position,
        nextNodeId: "apocalypse",
        resolved: { unus: "completed", "four-horsemen": "completed" },
      },
    };
    const composed = compose(atThree);
    const brief = missionBriefingOf(composed, DEF)!;
    expect(brief.nodeId).toBe("apocalypse");
    expect(brief.prelateAbsent).toBe(`${optionOf(composed, "currentOverseer")} (Prelate)`);
    // Scenarios 1 and 2 say nothing about a Prelate.
    expect(missionBriefingOf(compose(fresh(9)), DEF)!.prelateAbsent).toBeNull();
  });

  it("scenario 5's mission is the fixed Protect the Professor, not a draw", () => {
    const base = fresh(3);
    const atFive: CampaignLog = {
      ...base,
      position: {
        ...base.position,
        nextNodeId: "en-sabah-nur",
        resolved: {
          unus: "completed",
          "four-horsemen": "completed",
          apocalypse: "completed",
          "dark-beast": "completed",
        },
      },
    };
    const brief = missionBriefingOf(compose(atFive), DEF)!;
    expect(brief.mission?.name).toBe("Protect the Professor");
    expect(brief.fixed).toBe(true);
  });
});

describe("the Dossier's mission table", () => {
  const unplayed = (): CampaignLog => fresh(2);

  it("lists the four rows and five Overseers as available, with each Setup in a few words", () => {
    const table = missionTableOf(unplayed(), DEF)!;
    expect(table.missions.map((row) => row.name)).toEqual(AOA_MISSIONS.map((row) => row.name));
    expect(table.missions.every((row) => row.state === "available" && row.stateWord === "AVAILABLE")).toBe(true);
    expect(table.overseers.map((row) => row.name)).toEqual(AOA_OVERSEERS.map((row) => row.name));
    expect(table.overseers.every((row) => row.state === "available")).toBe(true);
  });

  it("marks the drawn mission and Overseer while an attempt is composed", () => {
    const composed = compose(unplayed());
    const table = missionTableOf(composed, DEF)!;
    expect(table.missions.filter((row) => row.state === "drawn").map((row) => row.name)).toEqual([
      optionOf(composed, "currentMission"),
    ]);
    expect(table.overseers.filter((row) => row.state === "drawn").map((row) => row.name)).toEqual([
      optionOf(composed, "currentOverseer"),
    ]);
  });

  it("reads each result as the sheet prints it: Defeated is the reward, Not Defeated the penalty (MC45 p. 24)", () => {
    const base = unplayed();
    const flag = (option: string) => ({ kind: "choice" as const, option });
    const log: CampaignLog = {
      ...base,
      shared: {
        ...base.shared,
        resultLiberate: flag("notDefeated"),
        resultEvacuate: flag("defeated"),
        resultSabotage: flag("notDefeated"),
        resultFind: flag("defeated"),
        overseers: { kind: "strikeList", struck: ["Abyss"] },
      },
    };
    const table = missionTableOf(log, DEF)!;
    const row = (name: string) => table.missions.find((candidate) => candidate.name === name)!;
    expect(row("Liberate the Seattle Core")).toMatchObject({
      state: "notDefeated",
      stateWord: "NOT DEFEATED",
      detail: "Desperate Measures is gone.",
    });
    expect(row("Evacuate Survivors")).toMatchObject({
      state: "defeated",
      detail: "Panicked Refugees gone · each player takes an upgrade.",
    });
    expect(row("Sabotage the Sea Wall").detail).toBe("Sea Wall in every encounter deck.");
    expect(row("Find Lost Mutants").detail).toBe("Each player takes a campaign ally.");
    expect(table.overseers.find((overseer) => overseer.name === "Abyss")).toMatchObject({
      state: "defeated",
      stateWord: "DEFEATED",
    });
    // The rulebook's own sentences ride along for Inspect, in the sheet's three columns.
    expect(row("Evacuate Survivors").printed.setup).toMatch(/Panicked Refugees/);
    expect(row("Evacuate Survivors").printed.defeated).toMatch(/upgrade from any aspect/);
    expect(row("Evacuate Survivors").printed.notDefeated).toMatch(/must shuffle a copy of Panicked Refugees/);
  });
});

describe("the Dossier overview", () => {
  it("carries the mission table and keeps the raw strike lists and result fields out of the world box", () => {
    const composed = compose(fresh(2));
    const overview = campaignDossierOverview({ ...composed, name: "Age of Apocalypse" }, DEF, (id) => id);
    expect(overview.missions?.missions).toHaveLength(4);
    const ids = overview.world.map((row) => row.id);
    for (const hidden of ["missions", "overseers", "resultLiberate", "resultEvacuate", "resultSabotage", "resultFind"])
      expect(ids).not.toContain(hidden);
    // The working fields the generic views skip are not world rows either.
    for (const working of ["currentMission", "currentOverseer", "missionDefeated", "overseerDefeated"])
      expect(ids).not.toContain(working);
  });
});

describe("the Briefing's deck note", () => {
  it("says a reward is not one of the 40 and is one of the 50 for this box (owner decision, 2026-10-08) and keeps the pinned-card line for the others", () => {
    expect(grantsCountTowardDeckSize(DEF)).toBe(true);
    expect(grantsCountTowardDeckSize(campaignDefinitionOf("trors"))).toBe(false);
    const composed = compose(fresh(2));
    const record = { ...composed, recordSchema: 1, name: "x", box: "MC45", createdAt: 0, updatedAt: 0 } as never;
    expect(briefingViewOf(record, (id) => id as string, 1, DEF, ["unus"])?.deckNote).toBe(DECK_NOTE_REWARD);
    expect(DECK_NOTE_REWARD).toBe(
      "Tap a deck to edit it. Decks can change now; hero can't. A reward isn't one of your 40 cards, but it is one of your 50.",
    );
    const trors = campaignDefinitionOf("trors")!;
    expect(DECK_NOTE_EXEMPT).toMatch(/don't count toward deck size/);
    expect(grantsCountTowardDeckSize(trors)).toBe(false);
  });
});

describe("a mission result in words", () => {
  it("reads defeated and not defeated as the sheet does, and ignores every other field", () => {
    expect(missionResultWordsOf("resultEvacuate", "notDefeated")).toEqual({
      name: "Evacuate Survivors",
      result: "not defeated",
      detail: "Panicked Refugees in every deck.",
    });
    expect(missionResultWordsOf("resultFind", "defeated")?.result).toBe("defeated");
    expect(missionResultWordsOf("role", "brawler")).toBeNull();
    expect(missionResultWordsOf("resultFind", "something-else")).toBeNull();
  });

  it("the Dossier's Log row and the Aftermath's tag use those words, not the stored id", () => {
    const value = { kind: "choice" as const, option: "notDefeated" };
    expect(plainWriteRows("resultSabotage", value, null, (id) => id as string)).toEqual([
      { headline: "Sabotage the Sea Wall: not defeated", detail: "Sea Wall in every encounter deck." },
    ]);
    const field = DEF.logFields.find((candidate) => candidate.id === "resultSabotage")!;
    const history = [
      {
        nodeId: "unus",
        steps: [
          {
            instructionId: "x",
            skipped: undefined,
            kind: "record",
            writes: [{ field: "resultSabotage", seatNumber: null, mode: "set", value }],
            choices: [],
            removedFromCampaign: [],
            grants: [],
          },
        ],
      },
    ] as never;
    const tags = aftermathLogTags({ history }, "unus", [field], new Map());
    expect(tags.map((tag) => tag.text)).toEqual(["LOGGED · SABOTAGE THE SEA WALL: NOT DEFEATED"]);
  });
});
