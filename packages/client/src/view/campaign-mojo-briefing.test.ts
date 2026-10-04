/**
 * MojoMania's Briefing, issue by issue: the genre-set call as the player sees it (question, tiles, checked-off rule),
 * the placeholders before the calls are answered, the "Handled for you" list and the Decks after, the default cast,
 * and the plain-words copy for the choices raised in play and on the Aftermath. Pure: it composes through the same
 * `CampaignService` the scene does and reads the view models the scene draws.
 */
import { describe, expect, test } from "vitest";
import { MOJO_CAMPAIGN_DEFINITION } from "@mc/cards";
import type { CampaignChoiceAnswer, CampaignPendingChoice } from "@mc/engine";
import {
  CARDS_BY_ID,
  POOL_CARDS,
  POOL_DEPS,
  POOL_ENCOUNTER_SETS,
  POOL_SCENARIOS,
  POOL_VERSION,
} from "../content/pool.js";
import { MemoryCampaignStorage, type CampaignRecord } from "../engine/campaign-storage.js";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedMojoRun } from "../campaign/dev-fixtures.js";
import { issueStoryFor, storyFor } from "../campaign/story.js";
import { briefingViewOf } from "./campaign-briefing-model.js";
import {
  isModularSetChoice,
  modularCallSourceOf,
  modularPickTotalOf,
  modularPicksRowOf,
  modularSetCallOf,
  waitingNoteOf,
  type ModularSetCallView,
} from "./campaign-modular-call-model.js";
import { preconRosterOf } from "./campaign-roster-model.js";
import { cardCountForSet, descriptorForSet } from "./modular-sets.js";

const POOL = Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card]));
const SET_NAMES = new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name]));
const KNOWN: ReadonlySet<string> = new Set(SET_NAMES.keys());
const cardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;

const service = () => {
  let clock = 1_000;
  return new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: POOL },
    engineDeps: POOL_DEPS,
    now: () => (clock += 1),
    newId: () => "mojo-briefing",
  });
};

const nodeOf = (record: CampaignRecord) =>
  MOJO_CAMPAIGN_DEFINITION.graph.nodes.find((node) => node.id === record.position.nextNodeId)!;

/** The call the scene would draw for `pending`, given the answers so far. */
function callOf(
  record: CampaignRecord,
  pending: CampaignPendingChoice,
  answers: readonly CampaignChoiceAnswer[],
): ModularSetCallView {
  const node = nodeOf(record);
  const source = modularCallSourceOf(
    pending,
    [...(node.composition ?? []), ...node.setup],
    MOJO_CAMPAIGN_DEFINITION.logFields,
    record.shared,
  )!;
  const scenarioId = node.scenario.kind === "fixed" ? (node.scenario.scenarioId as string) : null;
  return modularSetCallOf({
    pending,
    answers,
    universe: source.universe,
    checkedOff: source.checkedOff,
    scenario: POOL_SCENARIOS.find((scenario) => (scenario.id as string) === scenarioId),
    seatCount: record.seats.length,
    setNameOf: (id) => SET_NAMES.get(id) ?? id,
    cardCountOf: (id) => cardCountForSet(id, CARDS_BY_ID),
    descriptorOf: (id) => descriptorForSet(id, CARDS_BY_ID),
  });
}

/** Asks for each pending choice, answering the first option, and returns every call view along the way. */
async function walk(svc: CampaignService, record: CampaignRecord) {
  const answers: CampaignChoiceAnswer[] = [];
  const calls: ModularSetCallView[] = [];
  for (let guard = 0; guard < 12; guard++) {
    const result = await svc.compose(record, answers);
    if (result.kind === "done") return { record: result.record, calls, answers };
    if (isModularSetChoice(result.choice, KNOWN)) calls.push(callOf(record, result.choice, answers));
    const { instructionId, slot, seatNumber } = result.choice;
    answers.push({ instructionId, slot, seatNumber, picked: [result.choice.options[0]!] });
  }
  throw new Error("composition never finished");
}

describe("MojoMania's default cast", () => {
  test("seats 1 and 2 are Gambit and Rogue, 3 and 4 are empty", () => {
    const seats = preconRosterOf(storyFor("mojo")!.castIdentityIds as never, POOL_VERSION);
    expect(seats.map((deck) => deck?.identityCardId ?? null)).toEqual(["37001a", "38001a", null, null]);
  });
});

describe("issue #1's genre-set call", () => {
  test("asks one question, offers all six sets with a card count and type, and says nothing is checked off", async () => {
    const svc = service();
    const record = await svc.start({
      campaignId: "mojo",
      seats: preconRosterOf(["37001a", "38001a"] as never, POOL_VERSION).flatMap((deck) =>
        deck ? [{ identityCardId: deck.identityCardId, deck }] : [],
      ),
      poolVersion: POOL_VERSION,
      seed: 5,
    });
    const first = await svc.compose(record);
    if (first.kind !== "pending") throw new Error("expected the genre-set pick");
    expect(isModularSetChoice(first.choice, KNOWN)).toBe(true);
    const call = callOf(record, first.choice, []);
    expect(call.question).toBe("Choose this issue's genre set.");
    expect(call.explain).toMatch(/shuffled into the encounter deck/);
    expect(call.whatIs).toMatch(/genre set is a themed pack/);
    expect(call.rule).toMatch(/Nothing is checked off yet/);
    expect(call.tiles.map((tile) => tile.name)).toEqual(["Crime", "Fantasy", "Horror", "Sci-Fi", "Sitcom", "Western"]);
    expect(call.tiles.every((tile) => tile.available && tile.status === "open")).toBe(true);
    expect(call.tiles[0]!.detail).toBe("6 cards · side schemes");
    for (const tile of call.tiles) expect(tile.detail).toMatch(/^\d+ cards/);
  });

  test("the waiting panels say what they wait on, in words", () => {
    expect(waitingNoteOf("handled", "asking", "genre-set pick")).toBe(
      "Waiting on your genre-set pick below. What setup does for you shows here once you answer.",
    );
    expect(waitingNoteOf("decks", "asking", "genre-set pick")).toMatch(/Each hero's deck shows here/);
    expect(waitingNoteOf("handled", "composing", null)).toBe("Setting up this issue…");
    expect(waitingNoteOf("decks", "asking", null)).toMatch(/Waiting on your call below/);
  });

  test("a composed issue lists the authored notes, the picks and both decks, with no internal text", async () => {
    const svc = service();
    const seats = preconRosterOf(["37001a", "38001a"] as never, POOL_VERSION).flatMap((deck) =>
      deck ? [{ identityCardId: deck.identityCardId, deck }] : [],
    );
    const signed = await svc.start({ campaignId: "mojo", seats, poolVersion: POOL_VERSION, seed: 5 });
    const { record, calls, answers } = await walk(svc, signed);
    expect(calls).toHaveLength(1);
    const story = issueStoryFor("mojo", "magog")!;
    const view = briefingViewOf(
      record,
      cardName as never,
      1,
      MOJO_CAMPAIGN_DEFINITION,
      MOJO_CAMPAIGN_DEFINITION.graph.nodes.map((node) => node.id),
      undefined,
      undefined,
      "Gambit",
      story.briefingNotes,
    )!;
    expect(view.handled.map((row) => row.title)).toEqual(story.briefingNotes!.map((note) => note.title));
    expect(view.decks.map((row) => row.heroName)).toEqual(["Gambit", "Rogue"]);
    expect(view.decks.map((row) => row.aspectLabel)).toEqual(["JUSTICE", "PROTECTION"]);
    const picks = modularPicksRowOf(record.attempt!.steps, KNOWN, (id) => ({
      name: SET_NAMES.get(id) ?? id,
      detail: "x",
    }));
    expect(picks?.title).toBe(`Genre set you chose: ${SET_NAMES.get(answers[0]!.picked[0]!)}`);
    for (const row of [...view.handled, picks!]) expect(`${row.title} ${row.detail}`).not.toMatch(/Not printed|\(Not/);
  });
});

describe("issues #2 and #3", () => {
  test("issue #2 asks for three picks, marks each chosen set, and shows the set issue #1 used as checked off", async () => {
    const svc = service();
    const record = await seedMojoRun(svc, "afterIssue1");
    const { calls } = await walk(svc, record);
    expect(calls.map((call) => call.question)).toEqual([
      "Choose genre set 1 of 3.",
      "Choose genre set 2 of 3.",
      "Choose genre set 3 of 3.",
    ]);
    const first = calls[0]!;
    const crime = first.tiles.find((tile) => tile.id === "crime")!;
    expect(crime).toMatchObject({ status: "checkedOff", available: false });
    expect(crime.statusLabel).toBe("CHECKED OFF · UNAVAILABLE");
    expect(first.rule).toMatch(/can't be chosen again/);
    expect(calls[2]!.tiles.filter((tile) => tile.status === "chosen").map((tile) => tile.statusLabel)).toEqual([
      "CHOSEN · PICK 1",
      "CHOSEN · PICK 2",
    ]);
    // Six sets, one checked off, two chosen: three are left to pick, and only an offered set can be picked.
    expect(calls[2]!.tiles.filter((tile) => tile.available)).toHaveLength(3);
  });

  test("issue #3 asks 1 + one per hero and says the picks are set aside", async () => {
    const svc = service();
    const record = await seedMojoRun(svc, "afterIssue2");
    const { calls } = await walk(svc, record);
    expect(calls).toHaveLength(3);
    expect(calls[0]!.question).toBe("Choose genre set 1 of 3.");
    expect(calls[0]!.explain).toMatch(/set aside until setup brings them in/);
  });

  test("when no unchecked set is left a checked-off one is offered, and the tile says it may be reused", async () => {
    const svc = service();
    const record = await seedMojoRun(svc, "afterIssue2");
    // Issue #3's fifth pick of a 4-hero table would run out; here: a two-seat table has fixed picks, so build the
    // state directly: every set struck except one that was just chosen.
    const pending = {
      instructionId: "mojo.s3.setup.modular-sets",
      slot: "checked3",
      seatNumber: null,
      text: "x",
      citation: "x",
      chooser: "group",
      options: ["crime", "fantasy"],
      count: 1,
      optional: false,
    } as CampaignPendingChoice;
    const call = modularSetCallOf({
      pending,
      answers: [
        { instructionId: pending.instructionId, slot: "set1", seatNumber: null, picked: ["horror"] },
        { instructionId: pending.instructionId, slot: "set2", seatNumber: null, picked: ["western"] },
      ],
      universe: ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"],
      checkedOff: ["crime", "fantasy", "sci-fi", "sitcom"],
      scenario: POOL_SCENARIOS.find((scenario) => (scenario.id as string) === "mojo"),
      seatCount: record.seats.length,
      setNameOf: (id) => SET_NAMES.get(id) ?? id,
      cardCountOf: () => 6,
      descriptorOf: () => null,
    });
    expect(call.rule).toMatch(/may be reused/);
    expect(call.tiles.find((tile) => tile.id === "crime")).toMatchObject({ status: "reusable", available: true });
    expect(call.tiles.find((tile) => tile.id === "sci-fi")).toMatchObject({ status: "checkedOff", available: false });
    expect(call.pickNumber).toBe(3);
    expect(call.tiles.find((tile) => tile.id === "crime")!.detail).toBe("6 cards");
  });

  test("a scenario's pick count follows its content: 1, 3, then 1 + one per hero", () => {
    const totals = ["magog", "spiral", "mojo"].map((id) =>
      modularPickTotalOf(
        POOL_SCENARIOS.find((scenario) => (scenario.id as string) === id),
        2,
      ),
    );
    expect(totals).toEqual([1, 3, 3]);
    expect(
      modularPickTotalOf(
        POOL_SCENARIOS.find((scenario) => (scenario.id as string) === "mojo"),
        4,
      ),
    ).toBe(5);
    expect(modularPickTotalOf(undefined, 2)).toBeNull();
  });
});

describe("a choice that is not a modular-set pick is left to the generic call", () => {
  test("an optional card pick and a role pick are not detected", () => {
    const base = { instructionId: "i", slot: "s", seatNumber: 1, text: "", citation: "", chooser: "eachSeat" } as const;
    expect(isModularSetChoice({ ...base, options: ["16001"], count: 1, optional: true }, KNOWN)).toBe(false);
    expect(isModularSetChoice({ ...base, options: [], count: 1, optional: false }, KNOWN)).toBe(false);
    // A pick that merely shares an id with an encounter set (MC32's roles) has no log field to read its sets from.
    const role = { ...base, options: ["brawler"], count: 1, optional: false };
    expect(modularCallSourceOf(role, [], MOJO_CAMPAIGN_DEFINITION.logFields, {})).toBeNull();
  });
});
