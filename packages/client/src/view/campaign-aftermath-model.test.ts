import { describe, expect, test } from "vitest";
import { GMW_CAMPAIGN_DEFINITION, TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import type { CardId } from "@mc/content";
import type {
  CampaignChoiceAnswer,
  CampaignHistoryEntry,
  CampaignPendingChoice,
  GameState,
  LogFieldDef,
} from "@mc/engine";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedDesignRun, seedGmwRun } from "../campaign/dev-fixtures.js";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { preconDecks } from "./deck-list-model.js";
import {
  advanceAftermathGroup,
  aftermathColumns,
  aftermathLogTags,
  aftermathOptionOf,
  aftermathStamp,
  answerFor,
  answerForPending,
  continuesGroup,
  decideForSeat,
  nextIssueRaisesMarket,
  offersAnswer,
  readyToCommit,
  startAftermathGroup,
  type AftermathChoiceGroup,
} from "./campaign-aftermath-model.js";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

const issueNumberOf = (nodeId: string): number =>
  TRORS_CAMPAIGN_DEFINITION.graph.kind === "linear"
    ? TRORS_CAMPAIGN_DEFINITION.graph.nodes.findIndex((node) => node.id === nodeId) + 1
    : 0;

describe("campaign-aftermath-model", () => {
  test("a real fold, driven entirely through the model: seat 2 is never offered seat 1's confirmed pick", async () => {
    const svc = service();
    const decks = preconDecks();
    const deckFor = (hero: string) => {
      const found = decks.find((candidate) => (candidate.id as string).includes(hero));
      if (!found) throw new Error(`no precon for ${hero}`);
      return { identityCardId: found.identityCardId, deck: found };
    };
    const record = await svc.start({
      campaignId: "trors",
      seats: [deckFor("hawkeye"), deckFor("spider-woman")],
      poolVersion: "test",
      seed: 1,
    });
    const composeResult = await svc.compose(record);
    if (composeResult.kind !== "done") throw new Error("expected issue #1 setup to need no answers");
    const composed = composeResult.record;
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(svc.launchConfig(composed));
    const won: GameState = {
      ...started.snapshot.state,
      cardPool: started.cardPool,
      outcome: { result: "win", reason: "villainDefeated" },
    };

    const seats = composed.seats.map((seat) => ({
      seatNumber: seat.seatNumber,
      heroName: CARDS_BY_ID.get(seat.identityCardId as string)?.name ?? `Seat ${seat.seatNumber}`,
    }));

    let group: AftermathChoiceGroup | null = null;
    const answers: CampaignChoiceAnswer[] = [];
    const realPrompts: CampaignPendingChoice[] = [];
    for (let guard = 0; guard < 16; guard++) {
      const result = await svc.foldState(composed, won, [], answers);
      if (result.kind === "done") {
        expect(result.record.status).toBe("active");
        expect(realPrompts).toHaveLength(2); // one TECH prompt per seat
        // Seat 2's prompt must never re-offer whatever seat 1 actually took.
        expect(realPrompts[1]!.options).not.toContain(answers[0]!.picked[0]);
        return;
      }
      const pending = result.choice;
      realPrompts.push(pending);
      if (!group || !continuesGroup(group, pending)) {
        group = startAftermathGroup(pending, seats, (cardId) => aftermathOptionOf(cardId, CARDS_BY_ID));
      }
      const seatNumber = pending.seatNumber ?? seats[0]!.seatNumber;
      group = decideForSeat(group, seatNumber, { kind: "picked", cardId: pending.options[0]! as CardId });
      const answer = answerFor(group, seatNumber);
      expect(offersAnswer(pending, answer)).toBe(true);
      answers.push(answer);
      group = advanceAftermathGroup(group, seatNumber, null) ?? group;
    }
    throw new Error("the campaign asked more than 16 questions");
  });

  test("startAftermathGroup + aftermathColumns: seat 2's guessed options mark seat 1's local pick as taken", () => {
    const pending: CampaignPendingChoice = {
      instructionId: "mc10.s1.victory.tech",
      slot: "tech",
      seatNumber: 1,
      text: "Each player chooses one of the TECH upgrades…",
      citation: "MC10 p. 5",
      chooser: "eachSeat",
      options: ["04155", "04156", "04157", "04158"],
      count: 1,
      optional: false,
    };
    const seats = [
      { seatNumber: 1, heroName: "Hawkeye" },
      { seatNumber: 2, heroName: "Spider-Woman" },
    ];
    let group = startAftermathGroup(pending, seats, (cardId) => aftermathOptionOf(cardId, CARDS_BY_ID));
    expect(group.catalog.map((option) => option.name)).toEqual([
      "Adrenal Stims",
      "Tactical Scanner",
      "Emergency Teleporter",
      "Laser Cannon",
    ]);
    group = decideForSeat(group, 1, { kind: "picked", cardId: "04156" as CardId });
    const columns = aftermathColumns(group, (seatNumber) => seats.find((s) => s.seatNumber === seatNumber)!.heroName);
    const [hawkeye, spiderWoman] = columns;
    expect(hawkeye!.status).toBe("current");
    expect(hawkeye!.rows.find((row) => row.option.cardId === "04156")!.selected).toBe(true);
    expect(spiderWoman!.status).toBe("pending");
    const takenRow = spiderWoman!.rows.find((row) => row.option.cardId === "04156")!;
    expect(takenRow.takenByHeroName).toBe("Hawkeye");
    expect(readyToCommit(group)).toBe(false);
  });

  test("decideForSeat refuses a card another seat already holds, and refuses declining a mandatory choice", () => {
    const pending: CampaignPendingChoice = {
      instructionId: "x",
      slot: "s",
      seatNumber: 1,
      text: "t",
      citation: "c",
      chooser: "eachSeat",
      options: ["a", "b"],
      count: 1,
      optional: false,
    };
    const seats = [
      { seatNumber: 1, heroName: "A" },
      { seatNumber: 2, heroName: "B" },
    ];
    let group = startAftermathGroup(pending, seats, (id) => ({ cardId: id, name: id as string, effect: "" }));
    group = decideForSeat(group, 1, { kind: "picked", cardId: "a" as CardId });
    const blocked = decideForSeat(group, 2, { kind: "picked", cardId: "a" as CardId });
    expect(blocked).toBe(group); // unchanged: "a" is taken
    const declined = decideForSeat(group, 2, { kind: "declined" });
    expect(declined).toBe(group); // unchanged: this choice isn't optional
  });

  test("offersAnswer rejects a pick the real pending choice doesn't offer", () => {
    const pending: CampaignPendingChoice = {
      instructionId: "x",
      slot: "s",
      seatNumber: 2,
      text: "t",
      citation: "c",
      chooser: "eachSeat",
      options: ["b"],
      count: 1,
      optional: false,
    };
    expect(offersAnswer(pending, { instructionId: "x", slot: "s", seatNumber: 2, picked: ["b"] })).toBe(true);
    expect(offersAnswer(pending, { instructionId: "x", slot: "s", seatNumber: 2, picked: ["a"] })).toBe(false);
  });

  test("aftermathStamp reads issue #2's delay-counter victory write as a LOGGED tag", async () => {
    const record = await seedDesignRun(service(), "afterIssue2");
    const stamp = aftermathStamp(record, "absorbing-man", issueNumberOf);
    expect(stamp.issueNumber).toBe(2);
    expect(stamp.loggedTag).toMatch(/^LOGGED · \d+ DELAY COUNTERS$/);
  });

  test("aftermathStamp on issue #1 (no shared numeric victory write) has no tag", async () => {
    const record = await seedDesignRun(service(), "afterIssue1");
    const stamp = aftermathStamp(record, "crossbones", issueNumberOf);
    expect(stamp.loggedTag).toBeNull();
  });
});

describe("committing picks made up front (the Aftermath screen's own order)", () => {
  test("both seats pick first, then the commit loop answers each seat the engine asks for, and the run advances", async () => {
    const svc = service();
    const decks = preconDecks();
    const deckFor = (hero: string) => {
      const found = decks.find((candidate) => (candidate.id as string).includes(hero));
      if (!found) throw new Error(`no precon for ${hero}`);
      return { identityCardId: found.identityCardId, deck: found };
    };
    const record = await svc.start({
      campaignId: "trors",
      seats: [deckFor("hawkeye"), deckFor("spider-woman")],
      poolVersion: "test",
      seed: 1,
    });
    const composeResult = await svc.compose(record);
    if (composeResult.kind !== "done") throw new Error("expected issue #1 setup to need no answers");
    const composed = composeResult.record;
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(svc.launchConfig(composed));
    const won: GameState = {
      ...started.snapshot.state,
      cardPool: started.cardPool,
      outcome: { result: "win", reason: "villainDefeated" },
    };
    const seats = composed.seats.map((seat) => ({ seatNumber: seat.seatNumber, heroName: `Seat ${seat.seatNumber}` }));

    const first = await svc.foldState(composed, won, [], []);
    if (first.kind !== "pending") throw new Error("expected the TECH choice");
    let group = startAftermathGroup(first.choice, seats, (cardId) => aftermathOptionOf(cardId, CARDS_BY_ID));
    // The design's picks, both made before anything is sent: seat 1 Tactical Scanner, seat 2 Emergency Teleporter.
    group = decideForSeat(group, 1, { kind: "picked", cardId: "04156" as CardId });
    group = decideForSeat(group, 2, { kind: "picked", cardId: "04157" as CardId });
    expect(readyToCommit(group)).toBe(true);

    // The scene's commit loop: peek, answer the seat the engine is asking about, advance with that same prompt.
    const answers: CampaignChoiceAnswer[] = [];
    for (let guard = 0; guard < 4; guard++) {
      const peek = await svc.foldState(composed, won, [], answers);
      if (peek.kind === "done") {
        expect(peek.record.position.nextNodeId).toBe("absorbing-man");
        expect(peek.record.seats.map((seat) => seat.grants.map((grant) => grant.cardId))).toEqual([
          ["04156"],
          ["04157"],
        ]);
        return;
      }
      const answer = answerForPending(group, peek.choice);
      expect(answer.seatNumber).toBe(peek.choice.seatNumber);
      expect(offersAnswer(peek.choice, answer)).toBe(true);
      answers.push(answer);
      group = advanceAftermathGroup(group, answer.seatNumber!, peek.choice) ?? group;
    }
    throw new Error("the commit loop never finished the fold");
  });
});

describe("aftermathLogTags", () => {
  const fields: readonly LogFieldDef[] = [
    { id: "units", label: "Unspent Units", scope: "perSeat", type: { kind: "number", min: 0 }, citation: "test" },
    {
      id: "powerStoneControl",
      label: "Power Stone Control",
      scope: "shared",
      type: { kind: "cardRef" },
      citation: "test",
    },
    { id: "evasionCounters", label: "Evasion Counters", scope: "shared", type: { kind: "number" }, citation: "test" },
    {
      id: "headhunterDefeated",
      label: "Headhunter Defeated?",
      scope: "shared",
      type: { kind: "number" },
      citation: "test",
    },
    { id: "secretPlan", label: "Secret Plan", scope: "shared", type: { kind: "flag" }, hidden: true, citation: "t" },
  ];
  const grootIdentityId = [...CARDS_BY_ID.entries()].find(([, card]) => card.name === "Groot")?.[0] as
    | string
    | undefined;
  if (!grootIdentityId) throw new Error("expected the real pool to carry a card named Groot");

  function entryOf(steps: CampaignHistoryEntry["steps"]): { readonly history: readonly CampaignHistoryEntry[] } {
    return {
      history: [
        {
          nodeId: "nebula",
          modes: {},
          outcome: "won",
          gameId: null,
          logBefore: {} as CampaignHistoryEntry["logBefore"],
          steps,
          at: 0,
        },
      ],
    };
  }

  test("stacks the tile's own three tags, POWER STONE and EVASION COUNTER logged, UNIT last", () => {
    const log = entryOf([
      {
        instructionId: "mc16.s4.victory.units",
        text: "",
        citation: "",
        kind: "record",
        writes: [
          { field: "units", seatNumber: 1, mode: "add", value: { kind: "number", value: 1 } },
          { field: "units", seatNumber: 2, mode: "add", value: { kind: "number", value: 1 } },
        ],
        choices: [],
        removedFromCampaign: [],
        grants: [],
      },
      {
        instructionId: "mc16.s4.victory.headhunter",
        text: "",
        citation: "",
        kind: "record",
        writes: [{ field: "headhunterDefeated", seatNumber: null, mode: "add", value: { kind: "number", value: 0 } }],
        choices: [],
        removedFromCampaign: [],
        grants: [],
      },
      {
        instructionId: "mc16.s4.victory.power-stone",
        text: "",
        citation: "",
        kind: "record",
        writes: [
          {
            field: "powerStoneControl",
            seatNumber: null,
            mode: "set",
            value: { kind: "cardRef", cardId: grootIdentityId as CardId },
          },
          { field: "evasionCounters", seatNumber: null, mode: "set", value: { kind: "number", value: 1 } },
        ],
        choices: [],
        removedFromCampaign: [],
        grants: [],
      },
    ]);
    expect(aftermathLogTags(log, "nebula", fields, CARDS_BY_ID)).toEqual([
      { text: "LOGGED · POWER STONE: GROOT", kind: "logged" },
      { text: "LOGGED · 1 EVASION COUNTER", kind: "logged" },
      { text: "+1 UNIT EACH", kind: "each" },
    ]);
  });

  test("a zero shared number never tags (headhunter not in play), and a hidden field never tags", () => {
    const log = entryOf([
      {
        instructionId: "i",
        text: "",
        citation: "",
        kind: "record",
        writes: [
          { field: "headhunterDefeated", seatNumber: null, mode: "add", value: { kind: "number", value: 0 } },
          { field: "secretPlan", seatNumber: null, mode: "set", value: { kind: "flag", value: true } },
        ],
        choices: [],
        removedFromCampaign: [],
        grants: [],
      },
    ]);
    expect(aftermathLogTags(log, "nebula", fields, CARDS_BY_ID)).toEqual([]);
  });

  test("a skipped step's writes never tag, and unequal per-seat totals never produce an EACH tag", () => {
    const log = entryOf([
      {
        instructionId: "skipped",
        text: "",
        citation: "",
        kind: "record",
        skipped: "condition",
        writes: [{ field: "evasionCounters", seatNumber: null, mode: "set", value: { kind: "number", value: 9 } }],
        choices: [],
        removedFromCampaign: [],
        grants: [],
      },
      {
        instructionId: "uneven",
        text: "",
        citation: "",
        kind: "record",
        writes: [
          { field: "units", seatNumber: 1, mode: "add", value: { kind: "number", value: 2 } },
          { field: "units", seatNumber: 2, mode: "add", value: { kind: "number", value: 1 } },
        ],
        choices: [],
        removedFromCampaign: [],
        grants: [],
      },
    ]);
    expect(aftermathLogTags(log, "nebula", fields, CARDS_BY_ID)).toEqual([]);
  });

  test("no history entry for the node returns no tags", () => {
    expect(aftermathLogTags({ history: [] }, "nebula", fields, CARDS_BY_ID)).toEqual([]);
  });
});

describe("nextIssueRaisesMarket", () => {
  test("MC16's own scenario graph: issue 2's setup is the Market, issue 1's own setup is not", () => {
    expect(nextIssueRaisesMarket(GMW_CAMPAIGN_DEFINITION, "brotherhood-of-badoon")).toBe(true);
  });

  test("the last node has nothing next", () => {
    const lastId = GMW_CAMPAIGN_DEFINITION.graph.nodes.at(-1)!.id;
    expect(nextIssueRaisesMarket(GMW_CAMPAIGN_DEFINITION, lastId)).toBe(false);
  });

  test("a node with no Market next (TRoRS has none)", () => {
    expect(nextIssueRaisesMarket(TRORS_CAMPAIGN_DEFINITION, TRORS_CAMPAIGN_DEFINITION.graph.nodes[0]!.id)).toBe(false);
  });
});

describe("aftermathLogTags, against a real GMW fold", () => {
  test("issue #4 (nebula)'s own real history entry produces the shared per-seat UNIT tag", async () => {
    const svc = new CampaignService({
      storage: new MemoryCampaignStorage(),
      campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
      engineDeps: POOL_DEPS,
    });
    const record = await seedGmwRun(svc, "finished");
    const tags = aftermathLogTags(record, "nebula", GMW_CAMPAIGN_DEFINITION.logFields, CARDS_BY_ID);
    // A substituted win (`dev-fixtures.ts`'s `playIssueWith`) never puts anything in a real victory display, so the
    // Power Stone/evasion-counter facts stay at their zero/unset defaults and don't tag (see `loggedTagFor`'s own
    // doc comment) — the one fact every win still writes for real is each seat's own "Unspent Units" gain, whatever
    // it actually comes out to be against the substituted state's own encounter deck contribution.
    expect(tags).toHaveLength(1);
    expect(tags[0]?.kind).toBe("each");
    expect(tags[0]?.text).toMatch(/^\+\d+ UNITS? EACH$/);
  }, 30_000);
});
