/**
 * NeXt Evolution's (MC40) Briefing and Dossier view models: the per-scenario side-scheme choice (offered rows, a retry's
 * repeated pick, a removed row), what carries in at scenarios 2 to 5, and the six-row table after a full run. Driven
 * through the real runner over the real definition (the box's own named export).
 */
import { NEXT_EVOL_CAMPAIGN_DEFINITION as DEF } from "@mc/cards";
import type { CardId } from "@mc/content";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
} from "@mc/engine";
import { describe, expect, test } from "vitest";
import { CARDS_BY_ID, POOL_CARDS, POOL_VERSION } from "../content/pool.js";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import { campaignLaunchConfig } from "./campaign-step-model.js";
import { briefingViewOf } from "./campaign-briefing-model.js";
import { campaignDossierOverview } from "./campaign-dossier-model.js";
import { sideSchemeOptionLabels } from "./campaign-option-labels.js";
import { sideSchemeBriefingOf, sideSchemeRowsOf, sideSchemeTableOf } from "./campaign-side-scheme-model.js";
import { preconDecks } from "./deck-list-model.js";
import { plainWriteRows } from "./campaign-write-words.js";

const POOL = Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card]));
const cardName = (id: CardId): string => CARDS_BY_ID.get(id as string)?.name ?? (id as string);
const deckNamed = (id: string) => preconDecks(POOL_VERSION).find((deck) => (deck.id as string).includes(id))!;
const SEATS = [deckNamed("cable-leadership"), deckNamed("domino-justice")].map((deck, index) => ({
  seatNumber: index + 1,
  identityCardId: deck.identityCardId,
  deck,
}));
const NODES = ["morlock-siege", "on-the-run", "juggernaut", "mister-sinister", "stryfe"] as const;
const ids = (...list: string[]): readonly CardId[] => list as unknown as readonly CardId[];

function settle<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  pick: (choice: CampaignPendingChoice) => readonly string[],
): { readonly value: T; readonly asked: readonly CampaignPendingChoice[] } {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 64; guard++) {
    const result = step(answers);
    if (result.kind === "done") return { value: result.value, asked };
    asked.push(result.choice);
    const { instructionId, slot, seatNumber } = result.choice;
    answers.push({ instructionId, slot, seatNumber, picked: pick(result.choice) });
  }
  throw new Error("never settled");
}

const taking =
  (title: string) =>
  (choice: CampaignPendingChoice): readonly string[] => [choice.options.includes(title) ? title : choice.options[0]!];
const refuse = (choice: CampaignPendingChoice): readonly string[] => {
  throw new Error(`asked "${choice.slot}" where it must not`);
};

const newLog = (): CampaignLog =>
  createCampaignLog(DEF, {
    id: "next-evol-view",
    seats: SEATS,
    modes: { campaign: { campaignId: DEF.campaignId } },
    poolVersion: POOL_VERSION,
    seed: 11,
  });
const compose = (log: CampaignLog, pick: (choice: CampaignPendingChoice) => readonly string[]) =>
  settle((answers) => resolveBetweenGames(DEF, log, { pool: POOL }, log.modes, answers), pick);
const fold = (composed: CampaignLog, result: CampaignGameResult): CampaignLog =>
  settle(
    (answers) => applyCampaignResult(DEF, composed, result, { at: 1, gameId: "view" }, { pool: POOL }, answers),
    () => [],
  ).value;
const recordOf = (log: CampaignLog): CampaignRecord => ({
  ...log,
  recordSchema: 1,
  name: "NeXt Evolution",
  box: "MC40",
  createdAt: 1,
  updatedAt: 1,
});

type RecordEntry = CampaignGameResult["records"][number];
const result = (nodeId: string, won: boolean, records: readonly RecordEntry[] = []): CampaignGameResult => ({
  nodeId,
  outcome: won ? "won" : "lost",
  records,
  removedFromCampaign: [],
  logWrites: [],
  expiringGrants: [],
});
const listRecord = (
  instructionId: string,
  field: string,
  cardIds: readonly CardId[],
  mode: "set" | "append" = "set",
): RecordEntry => ({
  instructionId,
  write: {
    field,
    seatNumber: null,
    mode,
    ...(mode === "append" ? { distinct: true } : {}),
    value: { kind: "cardList", cardIds },
  },
});
const numberRecord = (instructionId: string, field: string, value: number): RecordEntry => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set", value: { kind: "number", value } },
});

/** Scenario `n` (1-based) composed with `title`, then won with `records`. */
function play(log: CampaignLog, n: number, title: string, records: readonly RecordEntry[] = []): CampaignLog {
  return fold(compose(log, taking(title)).value, result(NODES[n - 1]!, true, records));
}
const earn = (n: number, ...environments: string[]): RecordEntry =>
  listRecord(`mc40.s${n}.victory.environment`, "environmentsEarned", ids(...environments), "append");

const ROWS = [
  ["Establish Safehouse", "40191a", "40191b", "40201"],
  ["Mission Prep", "40193a", "40193b", "40200"],
  ["Assemble the Team", "40190a", "40190b", "40199"],
  ["Gear Up", "40192a", "40192b", "40203"],
  ["Practice Maneuvers", "40194a", "40194b", "40198"],
  ["Prepare Defenses", "40195a", "40195b", "40202"],
] as const;
const rowView = (row: (typeof ROWS)[number]) => ({
  name: row[0],
  scheme: { cardId: row[1], name: cardName(row[1] as CardId) },
  environment: { cardId: row[2], name: cardName(row[2] as CardId) },
  encounterCard: { cardId: row[3], name: cardName(row[3] as CardId) },
});
const brief = (log: CampaignLog, pending?: CampaignPendingChoice | null) =>
  sideSchemeBriefingOf({ definition: DEF, record: log, pending: pending ?? null, cardName })!;

describe("the scheme choice in the Briefing", () => {
  test("a fresh run's first briefing offers all six rows, both faces and the encounter card each", () => {
    const log = newLog();
    const first = settle(
      (answers) => resolveBetweenGames(DEF, log, { pool: POOL }, log.modes, answers),
      taking("Gear Up"),
    );
    const pending = first.asked[0]!;
    expect(pending.slot).toBe("scheme");
    const view = brief(log, pending);
    expect(view).toMatchObject({
      nodeId: "morlock-siege",
      scenarioNumber: 1,
      instructionId: "mc40.s1.setup.choose",
      citation: "MC40 p. 9",
      chosen: null,
      repeated: false,
      requiredSetIds: [],
      carryIns: [],
    });
    expect(view.offered).toEqual(ROWS.map(rowView));
    expect(view.offered.map((row) => row.name)).toEqual(pending.options);
    expect(view.offered[0]).toEqual({
      name: "Establish Safehouse",
      scheme: { cardId: "40191a", name: "Establish Safehouse" },
      environment: { cardId: "40191b", name: "Safehouse Established" },
      encounterCard: { cardId: "40201", name: "Vanisher" },
    });
  });

  test("once picked, the pick is shown with its encounter card carried in", () => {
    const composed = compose(newLog(), taking("Mission Prep")).value;
    const view = brief(composed);
    expect(view.chosen).toEqual(rowView(ROWS[1]));
    expect(view.repeated).toBe(false);
    expect(view.offered).toEqual(ROWS.map(rowView));
    expect(view.carryIns).toEqual([
      {
        key: "field:encounterCards",
        title: "Encounter cards added: 1",
        detail: "All shuffled into the deck.",
        cards: [{ cardId: "40200", name: cardName("40200" as CardId) }],
      },
    ]);
    const full = briefingViewOf(recordOf(composed), cardName, 1, DEF, [...NODES]);
    expect(full?.sideScheme).toEqual(view);
  });

  test("a retry repeats the pick: shown, not asked", () => {
    const composed = compose(newLog(), taking("Mission Prep")).value;
    const lost = fold(composed, result("morlock-siege", false));
    const retried = compose(lost, refuse);
    expect(retried.asked).toEqual([]);
    const view = brief(retried.value);
    expect(view.chosen).toEqual(rowView(ROWS[1]));
    expect(view.repeated).toBe(true);
    expect(view.offered).toEqual([]);
  });

  test("a row removed at a win is not offered again (scenario 2)", () => {
    // Gear Up chosen for #1 and not defeated: struck from the sheet and removed from the campaign.
    const after1 = play(newLog(), 1, "Gear Up", [earn(1)]);
    const log = after1;
    expect(sideSchemeTableOf(log, DEF, cardName)!.rows.map((row) => [row.name, row.state, row.struck])).toEqual([
      ["Establish Safehouse", "open", false],
      ["Mission Prep", "open", false],
      ["Assemble the Team", "open", false],
      ["Gear Up", "removed", true],
      ["Practice Maneuvers", "open", false],
      ["Prepare Defenses", "open", false],
    ]);
    const first = settle(
      (answers) => resolveBetweenGames(DEF, log, { pool: POOL }, log.modes, answers),
      taking("Mission Prep"),
    );
    const scheme = first.asked.find((choice) => choice.slot === "scheme")!;
    const view = brief(log, scheme);
    expect(view.scenarioNumber).toBe(2);
    expect(view.offered.map((row) => row.name)).toEqual([
      "Establish Safehouse",
      "Mission Prep",
      "Assemble the Team",
      "Practice Maneuvers",
      "Prepare Defenses",
    ]);
    expect(view.offered.map((row) => row.name)).toEqual(scheme.options);
  });

  test("labels the options with the environment each earns", () => {
    const labels = sideSchemeOptionLabels(sideSchemeRowsOf(DEF, cardName));
    expect([...labels]).toEqual([
      ["Establish Safehouse", "Establish Safehouse → Safehouse Established"],
      ["Mission Prep", "Mission Prep → Mission Prepped"],
      ["Assemble the Team", "Assemble the Team → Team Assembled"],
      ["Gear Up", "Gear Up → Geared Up"],
      ["Practice Maneuvers", "Practice Maneuvers → Practiced Maneuvers"],
      ["Prepare Defenses", "Prepare Defenses → Prepared Defenses"],
    ]);
  });
});

describe("what carries in", () => {
  const MARAUDERS = ids("40070a", "40071a");
  const MORLOCK_ALLIES = 3;
  const run1 = () =>
    play(newLog(), 1, "Assemble the Team", [
      listRecord("mc40.s1.victory.marauders", "maraudersDefeated", MARAUDERS),
      numberRecord("mc40.s1.victory.morlocks", "morlocksSaved", MORLOCK_ALLIES),
      earn(1, "40190b"),
    ]);

  test("scenario 2: Marauders out, Morlock searches, the earned environment, the encounter cards", () => {
    const view = brief(compose(run1(), taking("Mission Prep")).value);
    expect(view.scenarioNumber).toBe(2);
    expect(view.carryIns.map((row) => [row.key, row.title, row.detail])).toEqual([
      [
        "field:maraudersDefeated",
        `Marauders out: ${cardName("40070a" as CardId)}, ${cardName("40071a" as CardId)}`,
        "Removed from the game first.",
      ],
      ["field:morlocksSaved", "Morlocks saved: 3", "Each lets a player search their deck."],
      ["field:environmentsEarned", "Environments earned: 1", "Each is put into play."],
      ["field:encounterCards", "Encounter cards added: 2", "All shuffled into the deck."],
    ]);
    expect(view.carryIns[2]!.cards).toEqual([{ cardId: "40190b", name: "Team Assembled" }]);
    expect(view.carryIns[3]!.cards.map((card) => card.cardId)).toEqual(["40199", "40200"]);
  });

  test("scenario 3: Black Tom is a fixed set, and the facedown deal is named", () => {
    const view = brief(
      compose(play(run1(), 2, "Mission Prep", [earn(2, "40190b", "40193b")]), taking("Gear Up")).value,
    );
    expect(view.scenarioNumber).toBe(3);
    expect(view.requiredSetIds).toEqual(["black_tom_cassidy"]);
    expect(view.carryIns.map((row) => [row.key, row.title])).toEqual([
      ["field:environmentsEarned", "Environments earned: 2"],
      ["deal:mc40.s3.setup.black-tom", "Black Tom deal"],
      ["field:encounterCards", "Encounter cards added: 3"],
    ]);
  });

  test("the launch config carries the required set as a fixed modular set, and only where one is required", () => {
    const first = compose(run1(), taking("Mission Prep")).value;
    expect(campaignLaunchConfig(DEF, first).modularSetIds).toBeUndefined();
    const third = compose(play(run1(), 2, "Mission Prep", [earn(2, "40190b", "40193b")]), taking("Gear Up")).value;
    expect(campaignLaunchConfig(DEF, third).modularSetIds).toEqual(["black_tom_cassidy"]);
  });

  test("scenarios 4 and 5: Hope Summers's damage from the scenario before", () => {
    const after3 = play(
      play(play(newLog(), 1, "Assemble the Team", [earn(1, "40190b")]), 2, "Mission Prep", [earn(2, "40193b")]),
      3,
      "Gear Up",
      [numberRecord("mc40.s3.victory.hope", "hopeDamage3", 2), earn(3, "40192b")],
    );
    const four = brief(compose(after3, taking("Practice Maneuvers")).value);
    expect(four.scenarioNumber).toBe(4);
    expect(four.carryIns.map((row) => [row.key, row.title, row.detail])).toEqual([
      ["field:environmentsEarned", "Environments earned: 3", "Each is put into play."],
      ["field:hopeDamage3", "Hope Summers: 2 damage", "Place it on her, or as threat."],
      ["field:encounterCards", "Encounter cards added: 4", "All shuffled into the deck."],
    ]);
    const after4 = play(after3, 4, "Practice Maneuvers", [
      numberRecord("mc40.s4.victory.hope", "hopeDamage4", 1),
      earn(4, "40194b"),
    ]);
    const five = brief(compose(after4, taking("Prepare Defenses")).value);
    expect(five.scenarioNumber).toBe(5);
    expect(five.carryIns.map((row) => [row.key, row.title])).toEqual([
      ["field:environmentsEarned", "Environments earned: 4"],
      ["field:hopeDamage4", "Hope Summers: 1 damage"],
      ["field:encounterCards", "Encounter cards added: 5"],
    ]);
  });
});

describe("the Dossier's table", () => {
  test("a fresh run: six open rows and the tallies at zero", () => {
    const table = sideSchemeTableOf(newLog(), DEF, cardName)!;
    expect(table.label).toBe("Campaign Player Side Schemes");
    expect(table.rows.map((row) => [row.name, row.state, row.struck, row.scenarioNumber, row.encounterAdded])).toEqual(
      ROWS.map((row) => [row[0], "open", false, null, false]),
    );
  });

  test("after a full run: earned and removed rows, who each was chosen for, and the tallies", () => {
    let log = play(newLog(), 1, "Assemble the Team", [
      listRecord("mc40.s1.victory.marauders", "maraudersDefeated", ids("40070a", "40071a")),
      numberRecord("mc40.s1.victory.morlocks", "morlocksSaved", 4),
      earn(1, "40190b"),
    ]);
    log = play(log, 2, "Mission Prep", [earn(2, "40190b", "40193b")]);
    log = play(log, 3, "Gear Up", [
      numberRecord("mc40.s3.victory.hope", "hopeDamage3", 2),
      earn(3, "40190b", "40193b"),
    ]);
    log = play(log, 4, "Practice Maneuvers", [
      numberRecord("mc40.s4.victory.hope", "hopeDamage4", 1),
      earn(4, "40190b", "40193b", "40194b"),
    ]);
    log = play(log, 5, "Prepare Defenses");
    const table = sideSchemeTableOf(log, DEF, cardName)!;
    expect(table.rows.map((row) => [row.name, row.state, row.struck, row.scenarioNumber, row.encounterAdded])).toEqual([
      ["Establish Safehouse", "open", false, null, false],
      ["Mission Prep", "earned", false, 2, true],
      ["Assemble the Team", "earned", false, 1, true],
      ["Gear Up", "removed", true, 3, true],
      ["Practice Maneuvers", "earned", false, 4, true],
      // Stryfe is the last scenario: its Victory records no environment, so its pick stays "chosen".
      ["Prepare Defenses", "chosen", false, 5, true],
    ]);
    expect(table.tallies.map((tally) => [tally.key, tally.value])).toEqual([
      ["maraudersDefeated", `${cardName("40070a" as CardId)}, ${cardName("40071a" as CardId)}`],
      ["morlocksSaved", "4 of 4"],
      ["environmentsEarned", "3 of 6"],
      ["encounterCards", "5"],
      ["hopeDamage3", "2"],
      ["hopeDamage4", "1"],
    ]);
    const overview = campaignDossierOverview(
      { ...log, name: "NeXt Evolution" },
      DEF,
      (id) => cardName(id as CardId),
      cardName,
    );
    expect(overview.sideSchemes).toEqual(table);
    // The panel's own fields are not repeated as world rows.
    expect(overview.world.map((row) => row.id)).toEqual([]);
  });
});

describe("log lines", () => {
  const rows = (field: string, value: Parameters<typeof plainWriteRows>[1]) =>
    plainWriteRows(field, value, null, cardName)?.map((row) => row.headline);
  test("a few words for each record", () => {
    expect(rows("sideSchemeScenario2", { kind: "choice", option: "Mission Prep" })).toEqual(["Scheme: Mission Prep"]);
    expect(rows("sideSchemes", { kind: "strikeList", struck: ["Mission Prep"] })).toEqual([]);
    expect(rows("environmentsEarned", { kind: "cardList", cardIds: ids("40190b") })).toEqual([
      "Earned: Team Assembled",
    ]);
    expect(rows("encounterCards", { kind: "cardList", cardIds: ids("40199") })).toEqual([
      `Added: ${cardName("40199" as CardId)}`,
    ]);
    expect(rows("morlocksSaved", { kind: "number", value: 1 })).toEqual(["1 Morlock saved"]);
    expect(rows("morlocksSaved", { kind: "number", value: 3 })).toEqual(["3 Morlocks saved"]);
    expect(rows("hopeDamage3", { kind: "number", value: 2 })).toEqual(["Hope Summers: 2 damage"]);
  });
});
