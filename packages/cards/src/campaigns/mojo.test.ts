/**
 * `MOJO_CAMPAIGN_DEFINITION` (MojoMania): the definition is well-formed against the real `@mc/content` records, and each
 * node's setup and Victory instructions do what the insert prints (insert pp. 4-5, 9, 13-14, 17), driven through the
 * real runner. Where a rule needs the game, a real game is built from the composed log (`mojo-testing.ts`) and settled
 * through its setup; a finished game's facts are either supplied as `CampaignGameResult.records` (stand-ins, said so) or
 * derived by `campaignResultOf` from a real state with supports and upgrades put into play by surgery (said so).
 * `mojo.qa.test.ts` plays the three scenarios start to finish.
 *
 * Covered: the three nodes in order, retry with no penalty, the bullets pinned; scenario 1's setup (Longshot shuffled in,
 * one genre set) and Victory (Longshot recorded by printed id, the set checked off, the support or upgrade within the
 * cap, a dash cost never offered); scenario 2's setup (checked-off sets refused, Longshot's two branches, the recorded
 * card put into play with threat equal to its cost); scenario 3's setup (the fallback only when too few sets remain,
 * threat equal to the summed cost); the expert rules.
 */
import { describe, expect, it } from "vitest";
import { MOJO_CAMPAIGN, MOJO_ENCOUNTER_SETS, MOJO_SCENARIOS } from "@mc/content";
import {
  campaignResultOf,
  maxHitPoints,
  remainingHitPoints,
  type CampaignInstruction,
  type CampaignLog,
  type CampaignPendingChoice,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { action } from "../dsl/abilities.js";
import { validateDefinition } from "../dsl/validate.js";
import { P1, P2, firstLegal, patchInstance, settle } from "../testing/harness.js";
import { WAVE6_DEPS } from "../wave6/index.js";
import { MOJO_CAMPAIGN_DEFINITION, MOJO_GENRE_SETS, mojoCheckedOffSets, mojoModularSetPicks } from "./mojo.js";
import {
  EXPERT,
  SEATS,
  SOLO_SEATS,
  STANDARD,
  anywhere,
  asWin,
  bareResult,
  build,
  codeOf,
  compose,
  controlledBy,
  finish,
  flagRecord,
  inst,
  intoPlay,
  newLog,
  numberRecord,
  printedCost,
  recordedOf,
  seatList,
  seatNumberRecord,
  settledStart,
  sharedField,
  struckOf,
} from "./mojo-testing.js";

const DEF = MOJO_CAMPAIGN_DEFINITION;
const NODES = ["magog", "spiral", "mojo"] as const;

function allInstructions(): readonly CampaignInstruction[] {
  const graph = DEF.graph;
  if (graph.kind !== "linear") throw new Error("expected a linear graph");
  return graph.nodes.flatMap((node) => [
    ...(node.composition ?? []),
    ...node.setup,
    ...node.victory,
    ...(node.defeat ?? []),
  ]);
}

function fieldsIn(value: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) fieldsIn(item, found);
  } else if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.field === "string") found.add(record.field);
    for (const v of Object.values(record)) fieldsIn(v, found);
  }
  return found;
}

// ---------------------------------------------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------------------------------------------

describe("MOJO_CAMPAIGN_DEFINITION: structure", () => {
  it("matches the @mc/content campaign record and lists the three scenarios in the insert's order (p. 4)", () => {
    expect(DEF.campaignId).toBe(MOJO_CAMPAIGN.id);
    expect(DEF.graph.kind).toBe("linear");
    if (DEF.graph.kind !== "linear") return;
    expect(DEF.graph.nodes.map((node) => node.id)).toEqual([...NODES]);
    const known = new Set(MOJO_SCENARIOS.map((scenario) => scenario.id as string));
    const scenarioIds = DEF.graph.nodes.map((node) => {
      if (node.scenario.kind !== "fixed") throw new Error(`${node.id}: expected a fixed scenario`);
      expect(known.has(node.scenario.scenarioId as string), node.id).toBe(true);
      return node.scenario.scenarioId as string;
    });
    expect(scenarioIds).toEqual(MOJO_CAMPAIGN.scenarioIds.map((id) => id as string));
  });

  it("a loss is retried with no penalty: free retry, no defeat instruction anywhere (p. 4)", () => {
    expect(DEF.loss).toEqual({ retry: "free", retryBaseline: "nodeStart", citation: "MojoMania insert p. 4" });
    if (DEF.graph.kind !== "linear") return;
    for (const node of DEF.graph.nodes) expect(node.defeat, node.id).toBeUndefined();
    expect(DEF.everyNodeSetup).toBeUndefined();
  });

  it("every instruction id is unique, prefixed 'mojo.', and cites 'MojoMania insert p. N'", () => {
    const instructions = allInstructions();
    const ids = instructions.map((instruction) => instruction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const instruction of instructions) {
      expect(instruction.id.startsWith("mojo."), instruction.id).toBe(true);
      expect(instruction.citation, instruction.id).toMatch(/^MojoMania insert p\. \d+$/);
    }
    for (const field of DEF.logFields) expect(field.citation, field.id).toMatch(/^MojoMania insert p\. \d+$/);
  });

  it("every field an instruction reads or writes is declared, and every declared field is used", () => {
    const declared = new Set(DEF.logFields.map((field) => field.id));
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) fieldsIn(instruction.step, referenced);
    for (const instruction of allInstructions()) fieldsIn(instruction.when, referenced);
    for (const field of referenced) expect(declared.has(field), field).toBe(true);
    for (const field of declared) expect(referenced.has(field), `${field} is never read or written`).toBe(true);
  });

  it("every in-game instruction passes the DSL validator and the definition round-trips through JSON", () => {
    for (const instruction of allInstructions()) {
      if (instruction.step.kind !== "inGame") continue;
      expect(validateDefinition(action(...instruction.step.effects)), instruction.id).toEqual([]);
    }
    expect(JSON.parse(JSON.stringify(DEF))).toEqual(DEF);
  });

  it("names no campaign set and no role, and the six genre sets are real ordinary modular sets", () => {
    expect(MOJO_CAMPAIGN.campaignSetIds).toEqual([]);
    expect(MOJO_CAMPAIGN.roles).toBeUndefined();
    const byId = new Map(MOJO_ENCOUNTER_SETS.map((set) => [set.id as string, set]));
    for (const set of MOJO_GENRE_SETS) {
      expect(byId.get(set), set).toBeDefined();
      expect(byId.get(set)?.extraModular, set).toBeFalsy();
      expect(byId.get(set)?.campaignSpecific, set).toBeFalsy();
    }
    // Longshot is the one-card extra set: composed by the campaign, never one of the six checkboxes.
    expect(byId.get("longshot")?.extraModular).toBe(true);
    expect(MOJO_GENRE_SETS as readonly string[]).not.toContain("longshot");
  });

  it("lists exactly the printed bullets of each scenario, in printed order", () => {
    if (DEF.graph.kind !== "linear") throw new Error("expected a linear graph");
    const listed = Object.fromEntries(
      DEF.graph.nodes.map((node) => [
        node.id,
        {
          composition: (node.composition ?? []).map((instruction) => instruction.id),
          setup: node.setup.map((instruction) => instruction.id),
          victory: node.victory.map((instruction) => instruction.id),
        },
      ]),
    );
    expect(listed).toEqual({
      magog: {
        composition: ["mojo.s1.composition.longshot", "mojo.s1.composition.sets"],
        setup: ["mojo.s1.setup.identity", "mojo.s1.setup.longshot"],
        victory: [
          "mojo.s1.victory.longshot",
          "mojo.s1.victory.modular-set",
          "mojo.s1.victory.candidates",
          "mojo.s1.victory.card",
          "mojo.s1.victory.hp",
        ],
      },
      spiral: {
        composition: ["mojo.s2.composition.longshot"],
        setup: [
          "mojo.s2.setup.modular-sets",
          "mojo.s2.setup.longshot",
          "mojo.s2.setup.recorded-card",
          "mojo.s2.setup.hp-set",
          "mojo.s2.setup.heal",
        ],
        victory: [
          "mojo.s2.victory.longshot",
          "mojo.s2.victory.modular-sets",
          "mojo.s2.victory.candidates",
          "mojo.s2.victory.card",
          "mojo.s2.victory.hp",
        ],
      },
      mojo: {
        composition: ["mojo.s3.composition.longshot"],
        setup: [
          "mojo.s3.setup.modular-sets",
          "mojo.s3.setup.longshot",
          "mojo.s3.setup.recorded-cards",
          "mojo.s3.setup.hp-set",
          "mojo.s3.setup.heal",
        ],
        victory: ["mojo.s3.victory.win"],
      },
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Staging helpers for the runner tests
// ---------------------------------------------------------------------------------------------------------------

// Spider-Man's deck (seat 1): Aunt May (support, cost 1), Surveillance Team (support, 2), Helicarrier (support, 3).
// Captain Marvel's (seat 2): Captain Marvel's Helmet (upgrade, 2), The Triskelion (support, 1), Helicarrier (3).
const AUNT_MAY = "01006";
const SURVEILLANCE_TEAM = "01064";
const HELICARRIER = "01092";
const HELMET = "01016";
const TRISKELION = "01073";
/** Milano (16142): a support that prints a dash for its cost. */
const MILANO = "16142";

it("the staging cards cost what these tests say they do", () => {
  expect([AUNT_MAY, SURVEILLANCE_TEAM, HELICARRIER, HELMET, TRISKELION].map(printedCost)).toEqual([1, 2, 3, 2, 1]);
});

interface S1Facts {
  readonly longshot?: boolean;
  readonly booing?: boolean;
  readonly low?: readonly (readonly string[])[];
  readonly high?: readonly (readonly string[])[];
  readonly dash?: readonly (readonly string[])[];
  readonly hp?: readonly number[];
}

/** A won scenario 1 whose derived facts are given (stand-ins: `campaignResultOf` reads them from a real state elsewhere). */
function s1Win(facts: S1Facts) {
  const seats = [1, 2];
  return bareResult("magog", true, [
    flagRecord("mojo.s1.victory.longshot", "longshotInPlay", facts.longshot ?? false),
    flagRecord("mojo.s1.victory.candidates", "championBooing", facts.booing ?? false),
    ...seats.flatMap((seat) => [
      seatList("mojo.s1.victory.candidates", "candidatesLow", seat, facts.low?.[seat - 1] ?? []),
      seatList("mojo.s1.victory.candidates", "candidatesHigh", seat, facts.high?.[seat - 1] ?? []),
      seatList("mojo.s1.victory.candidates", "dashCosts", seat, facts.dash?.[seat - 1] ?? []),
    ]),
    ...(facts.hp ? facts.hp.map((hp, i) => seatNumberRecord("mojo.s1.victory.hp", "remainingHp", i + 1, hp)) : []),
  ]);
}

/** Answers the recorded-card choice with the card each seat is planned to record; everything else is declined. */
const recording =
  (plan: Readonly<Record<number, string>>) =>
  (choice: CampaignPendingChoice): readonly string[] =>
    choice.slot === "recordedCard" && plan[choice.seatNumber ?? 0] ? [plan[choice.seatNumber ?? 0]!] : [];

/** A log that has won scenario 1 (the first genre set, "crime"), recording the planned cards, and not yet composed for 2. */
function afterScenario1(
  facts: S1Facts,
  plan: Readonly<Record<number, string>> = {},
  modes = STANDARD,
  seats = SEATS,
): CampaignLog {
  const composed = compose(newLog(modes, seats)).log;
  return finish(composed, s1Win(facts), recording(plan)).log;
}

interface S2Facts {
  readonly longshot?: boolean;
  readonly threat?: number;
  readonly players?: number;
  readonly low?: readonly (readonly string[])[];
  readonly high?: readonly (readonly string[])[];
  readonly dash?: readonly (readonly string[])[];
  readonly hp?: readonly number[];
}

/** A won scenario 2 whose derived facts are given. */
function s2Win(facts: S2Facts, seatCount = 2) {
  const seats = Array.from({ length: seatCount }, (_, i) => i + 1);
  return bareResult("spiral", true, [
    flagRecord("mojo.s2.victory.longshot", "longshotInPlay", facts.longshot ?? false),
    numberRecord("mojo.s2.victory.candidates", "mainSchemeThreat", facts.threat ?? 0),
    numberRecord("mojo.s2.victory.candidates", "playersStarted", facts.players ?? seatCount),
    ...seats.flatMap((seat) => [
      seatList("mojo.s2.victory.candidates", "candidatesLow", seat, facts.low?.[seat - 1] ?? []),
      seatList("mojo.s2.victory.candidates", "candidatesHigh", seat, facts.high?.[seat - 1] ?? []),
      seatList("mojo.s2.victory.candidates", "dashCosts", seat, facts.dash?.[seat - 1] ?? []),
    ]),
    ...(facts.hp ? facts.hp.map((hp, i) => seatNumberRecord("mojo.s2.victory.hp", "remainingHp", i + 1, hp)) : []),
  ]);
}

/** A log that has won scenarios 1 and 2 (sets crime, then fantasy, horror, sci-fi checked off), composed for neither. */
function afterScenario2(s1: S1Facts, s2: S2Facts, seats = SEATS, plan1 = {}, plan2 = {}): CampaignLog {
  const log1 = afterScenario1(s1, plan1, STANDARD, seats);
  const composed = compose(log1).log;
  return finish(composed, s2Win(s2, seats.length), recording(plan2)).log;
}

const settledToPlay = (composed: CampaignLog, pick = firstLegal): GameState => settledStart(composed, pick);
const mainThreat = (state: GameState): number => inst(state, state.mainScheme.instanceId).threat;
const labeled =
  (...wanted: readonly string[]) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((option) => wanted.includes(option.label));
    if (hit) return [hit.optionId];
    return firstLegal(state);
  };
/** Takes every card a "take your recorded card(s)" choice offers (the first-legal picker takes none). */
const takingRecorded =
  (...others: readonly string[]) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseCards")
      return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
    return labeled(...others)(state);
  };

// ---------------------------------------------------------------------------------------------------------------
// Scenario 1 - MaGog (insert p. 9)
// ---------------------------------------------------------------------------------------------------------------

describe("MOJO_CAMPAIGN_DEFINITION: scenario 1, MaGog (insert p. 9)", () => {
  it("offers the six genre sets for the scenario's one modular set, picks it, and the sheet starts empty", () => {
    const { log, asked, start } = compose(newLog(STANDARD));
    const picks = asked.filter((choice) => choice.slot === "set1");
    expect(picks.map((choice) => choice.options)).toEqual([[...MOJO_GENRE_SETS]]);
    expect(picks[0]?.count).toBe(1);
    expect(mojoModularSetPicks(log)).toEqual(["crime"]);
    expect(mojoCheckedOffSets(log)).toEqual([]);
    expect(start.nodeId).toBe("magog");
  });

  it("'Shuffle the Longshot ally into the encounter deck': composed set aside, then shuffled in at setup", () => {
    const { log, start } = compose(newLog(STANDARD));
    expect(start.encounterSets.setAside).toEqual(["longshot"]);
    expect(start.encounterSets.deck).toEqual([]);
    expect(start.input.instructions.map((i) => i.instructionId)).toEqual(["mojo.s1.setup.longshot"]);
    const state = settledToPlay(log);
    const [longshot] = anywhere(state, "39071");
    expect(longshot).toBeDefined();
    // In the encounter deck (or already drawn into its discard pile by setup), not set aside and not in play.
    expect(state.encounterSetAside).not.toContain(longshot);
    const piles = Object.values(state.encounterDecks).flatMap((pile) => [...pile.deck, ...pile.discard]);
    expect(piles).toContain(longshot);
    expect(controlledBy(state, 0)).not.toContain("39071");
  });

  it("Victory records whether Longshot is in play, by his printed id: the wolv hero ally of the same name does not count", () => {
    const composed = compose(newLog(STANDARD)).log;
    const built = build(composed);
    let state = settledToPlay(composed);
    // No Longshot in play: the flag is a recorded `false`.
    const none = campaignResultOf(DEF, composed, asWin(state), built.events, WAVE6_DEPS);
    expect(none.records.find((r) => r.write.field === "longshotInPlay")?.write.value).toEqual({
      kind: "flag",
      value: false,
    });
    // The wolv pack's Longshot (35033, a hero ally of the same name) in play is not MojoMania's.
    const other = intoPlay(state, P1, AUNT_MAY, "35033");
    expect(codeOf(other, other.players[0]!.playArea[0]!)).toBe("35033");
    const wrong = campaignResultOf(DEF, composed, asWin(other), built.events, WAVE6_DEPS);
    expect(wrong.records.find((r) => r.write.field === "longshotInPlay")?.write.value).toEqual({
      kind: "flag",
      value: false,
    });
    // The MojoMania Longshot (39071) put into play: recorded as in play.
    const [id] = anywhere(state, "39071");
    state = {
      ...state,
      encounterDecks: Object.fromEntries(
        Object.entries(state.encounterDecks).map(([key, pile]) => [
          key,
          { ...pile, deck: pile.deck.filter((x) => x !== id), discard: pile.discard.filter((x) => x !== id) },
        ]),
      ),
      players: state.players.map((p, i) => (i === 0 ? { ...p, playArea: [...p.playArea, id!] } : p)),
    };
    state = patchInstance(state, id!, { controllerId: P1 });
    const right = campaignResultOf(DEF, composed, asWin(state), built.events, WAVE6_DEPS);
    expect(right.records.find((r) => r.write.field === "longshotInPlay")?.write.value).toEqual({
      kind: "flag",
      value: true,
    });
    const done = finish(composed, right).log;
    expect(sharedField(done, "longshotInPlay")).toEqual({ kind: "flag", value: true });
  });

  it("Victory checks off the set that was used, and only that one", () => {
    const log = afterScenario1({});
    expect(mojoCheckedOffSets(log)).toEqual(["crime"]);
    expect(log.position.resolved.magog).toBe("completed");
    expect(log.position.nextNodeId).toBe("spiral");
  });

  it("a lost game checks off nothing and is retried from the same log with the history kept (p. 4)", () => {
    const composed = compose(newLog(STANDARD)).log;
    const lost = finish(
      composed,
      bareResult("magog", false, [flagRecord("mojo.s1.victory.longshot", "longshotInPlay", true)]),
    );
    expect(mojoCheckedOffSets(lost.log)).toEqual([]);
    expect(sharedField(lost.log, "longshotInPlay")).toBeUndefined();
    expect(lost.log.position.nextNodeId).toBe("magog");
    expect(lost.log.position.resolved.magog).toBeUndefined();
    expect(lost.log.history).toHaveLength(1);
    expect(lost.log.history[0]?.outcome).toBe("lost");
    // The retry composes the same node again, and a win then checks the set off once.
    const retry = compose(lost.log);
    expect(retry.start.nodeId).toBe("magog");
    const won = finish(retry.log, s1Win({}));
    expect(mojoCheckedOffSets(won.log)).toEqual(["crime"]);
    expect(won.log.history.map((entry) => entry.outcome)).toEqual(["lost", "won"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The recorded card (insert pp. 9 and 14)
// ---------------------------------------------------------------------------------------------------------------

describe("MOJO_CAMPAIGN_DEFINITION: the recorded support or upgrade (stand-in candidates)", () => {
  const facts: S1Facts = {
    low: [[AUNT_MAY, SURVEILLANCE_TEAM], [TRISKELION]],
    high: [
      [AUNT_MAY, SURVEILLANCE_TEAM, HELICARRIER],
      [HELMET, TRISKELION],
    ],
    dash: [[], []],
  };

  const asked = (log: CampaignLog, facts: S1Facts, seat: number) => {
    const composed = compose(log).log;
    return finish(composed, s1Win(facts), () => []).asked.find(
      (choice) => choice.slot === "recordedCard" && choice.seatNumber === seat,
    );
  };

  it("a cost-3 card is not offered when the cap is 2 (The Champion on its CHEERING CROWD side)", () => {
    const choice = asked(newLog(STANDARD), { ...facts, booing: false }, 1);
    expect(choice?.options).toEqual([AUNT_MAY, SURVEILLANCE_TEAM]);
    expect(choice?.options).not.toContain(HELICARRIER);
    expect(choice?.optional).toBe(true);
    expect(choice?.count).toBe(1);
  });

  it("and answering with one is refused", () => {
    const composed = compose(newLog(STANDARD)).log;
    expect(() => finish(composed, s1Win({ ...facts, booing: false }), recording({ 1: HELICARRIER }))).toThrow(
      /not one of its options/,
    );
  });

  it("the same card is offered when The Champion is on its BOOING CROWD side (the cap is 3)", () => {
    const choice = asked(newLog(STANDARD), { ...facts, booing: true }, 1);
    expect(choice?.options).toEqual([AUNT_MAY, SURVEILLANCE_TEAM, HELICARRIER]);
    const composed = compose(newLog(STANDARD)).log;
    const done = finish(composed, s1Win({ ...facts, booing: true }), recording({ 1: HELICARRIER, 2: HELMET })).log;
    expect(recordedOf(done, 0)).toEqual([HELICARRIER]);
    expect(recordedOf(done, 1)).toEqual([HELMET]);
  });

  it("each seat is offered its own cards only", () => {
    const choice = asked(newLog(STANDARD), { ...facts, booing: false }, 2);
    expect(choice?.options).toEqual([TRISKELION]);
  });

  it("a card with a dash cost is never offered, even within the cap", () => {
    const withDash: S1Facts = { ...facts, booing: true, dash: [[SURVEILLANCE_TEAM], []] };
    const choice = asked(newLog(STANDARD), withDash, 1);
    expect(choice?.options).toEqual([AUNT_MAY, HELICARRIER]);
    expect(choice?.options).not.toContain(SURVEILLANCE_TEAM);
  });

  it("a player may record nothing, and a seat with nothing to offer records nothing", () => {
    const composed = compose(newLog(STANDARD)).log;
    const declined = finish(composed, s1Win({ ...facts, booing: true }), () => []).log;
    expect(recordedOf(declined, 0)).toEqual([]);
    const none = finish(composed, s1Win({}), () => []).log;
    expect(recordedOf(none, 0)).toEqual([]);
    expect(recordedOf(none, 1)).toEqual([]);
  });

  it("scenario 2's cap is 3 when there is less than ten threat per player on the main scheme, 2 otherwise", () => {
    const s2 = (threat: number, players: number): readonly string[] => {
      const log1 = afterScenario1({});
      const composed = compose(log1).log;
      const choice = finish(composed, s2Win({ ...facts, threat, players }), () => []).asked.find(
        (c) => c.slot === "recordedCard" && c.seatNumber === 1,
      );
      return choice?.options ?? [];
    };
    // Two players: ten per player is 20. 19 is less than ten per player; 20 is not.
    expect(s2(19, 2)).toEqual([AUNT_MAY, SURVEILLANCE_TEAM, HELICARRIER]);
    expect(s2(20, 2)).toEqual([AUNT_MAY, SURVEILLANCE_TEAM]);
    expect(s2(0, 2)).toEqual([AUNT_MAY, SURVEILLANCE_TEAM, HELICARRIER]);
    // One player: 10 is not less than ten per player; 9 is.
    expect(s2(9, 1)).toEqual([AUNT_MAY, SURVEILLANCE_TEAM, HELICARRIER]);
    expect(s2(10, 1)).toEqual([AUNT_MAY, SURVEILLANCE_TEAM]);
    expect(s2(35, 4)).toEqual([AUNT_MAY, SURVEILLANCE_TEAM, HELICARRIER]);
    expect(s2(40, 4)).toEqual([AUNT_MAY, SURVEILLANCE_TEAM]);
  });

  it("scenario 2's record is added to scenario 1's: each player has two recorded cards, in order", () => {
    const log = afterScenario2(
      { ...facts, booing: true },
      { ...facts, threat: 0 },
      SEATS,
      { 1: HELICARRIER, 2: HELMET },
      { 1: AUNT_MAY, 2: TRISKELION },
    );
    expect(recordedOf(log, 0)).toEqual([HELICARRIER, AUNT_MAY]);
    expect(recordedOf(log, 1)).toEqual([HELMET, TRISKELION]);
  });
});

describe("MOJO_CAMPAIGN_DEFINITION: the candidates are read from the real finished game (surgery stages the cards)", () => {
  it("records each seat's own supports and upgrades by cost cap, the dash-cost ones, and The Champion's side", () => {
    const composed = compose(newLog(STANDARD)).log;
    const built = build(composed);
    let state = settledToPlay(composed);
    // Staged: Aunt May (1), Surveillance Team (2), Helicarrier (3) and a dash-cost Milano (a re-printed instance:
    // no precon may hold one) for seat 1; the Helmet upgrade (2) and The Triskelion (1) for seat 2.
    state = intoPlay(state, P1, AUNT_MAY);
    state = intoPlay(state, P1, SURVEILLANCE_TEAM);
    state = intoPlay(state, P1, HELICARRIER);
    state = intoPlay(state, P1, "01007", MILANO);
    state = intoPlay(state, P2, HELMET);
    state = intoPlay(state, P2, TRISKELION);
    const result = campaignResultOf(DEF, composed, asWin(state), built.events, WAVE6_DEPS);
    const value = (field: string, seat: number | null) => {
      const write = result.records.find((r) => r.write.field === field && r.write.seatNumber === seat)?.write.value;
      return write?.kind === "cardList" ? [...write.cardIds].sort() : write;
    };
    expect(value("candidatesLow", 1)).toEqual([AUNT_MAY, MILANO, SURVEILLANCE_TEAM].sort());
    expect(value("candidatesHigh", 1)).toEqual([AUNT_MAY, HELICARRIER, MILANO, SURVEILLANCE_TEAM].sort());
    expect(value("dashCosts", 1)).toEqual([MILANO]);
    expect(value("candidatesLow", 2)).toEqual([HELMET, TRISKELION].sort());
    expect(value("candidatesHigh", 2)).toEqual([HELMET, TRISKELION].sort());
    expect(value("dashCosts", 2)).toEqual([]);
    // The Champion starts on its BOOING CROWD side; flipped, it is on its CHEERING CROWD side.
    expect(value("championBooing", null)).toEqual({ kind: "flag", value: true });
    const champion = Object.values(state.instances).find((i) => codeOf(state, i.instanceId) === "39003a")!;
    const cheering = patchInstance(state, champion.instanceId, { flipped: true });
    const flipped = campaignResultOf(DEF, composed, asWin(cheering), built.events, WAVE6_DEPS);
    expect(flipped.records.find((r) => r.write.field === "championBooing")?.write.value).toEqual({
      kind: "flag",
      value: false,
    });
    // The real record, folded: Milano and the cost-3 card are the ones the choice sorts out.
    const offered = finish(composed, result, () => []).asked.find(
      (c) => c.slot === "recordedCard" && c.seatNumber === 1,
    );
    expect(offered?.options.slice().sort()).toEqual([AUNT_MAY, HELICARRIER, SURVEILLANCE_TEAM].sort());
  });

  it("a card another player controls is not offered, and a supported card that left play is not either", () => {
    const composed = compose(newLog(STANDARD)).log;
    const built = build(composed);
    let state = settledToPlay(composed);
    state = intoPlay(state, P1, AUNT_MAY);
    // Seat 1's Surveillance Team is still in its deck (never played); seat 2 controls only its own Triskelion.
    state = intoPlay(state, P2, TRISKELION);
    const result = campaignResultOf(DEF, composed, asWin(state), built.events, WAVE6_DEPS);
    const low = (seat: number) => {
      const write = result.records.find((r) => r.write.field === "candidatesLow" && r.write.seatNumber === seat)?.write
        .value;
      return write?.kind === "cardList" ? write.cardIds : [];
    };
    expect(low(1)).toEqual([AUNT_MAY]);
    expect(low(2)).toEqual([TRISKELION]);
  });

  it("scenario 2 reads the main scheme's threat and the players who started it", () => {
    const log = afterScenario1({});
    const composed = compose(log).log;
    const built = build(composed);
    const state = settledToPlay(composed);
    const staged = patchInstance(state, state.mainScheme.instanceId, { threat: 17 });
    const result = campaignResultOf(DEF, composed, asWin(staged), built.events, WAVE6_DEPS);
    expect(result.records.find((r) => r.write.field === "mainSchemeThreat")?.write.value).toEqual({
      kind: "number",
      value: 17,
    });
    expect(result.records.find((r) => r.write.field === "playersStarted")?.write.value).toEqual({
      kind: "number",
      value: 2,
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Scenario 2 - Spiral (insert pp. 13-14)
// ---------------------------------------------------------------------------------------------------------------

describe("MOJO_CAMPAIGN_DEFINITION: scenario 2, Spiral setup (insert p. 13)", () => {
  it("checked-off sets cannot be chosen: three picks, none of them crime, all different", () => {
    const log = afterScenario1({});
    const { asked, log: composed } = compose(log);
    const picks = asked.filter((choice) => /^set\d$/.test(choice.slot));
    expect(picks.map((choice) => choice.slot)).toEqual(["set1", "set2", "set3"]);
    for (const pick of picks) expect(pick.options, pick.slot).not.toContain("crime");
    // Each pick offers what the earlier picks left, so the three are different.
    expect(picks.map((pick) => pick.options)).toEqual([
      ["fantasy", "horror", "sci-fi", "sitcom", "western"],
      ["horror", "sci-fi", "sitcom", "western"],
      ["sci-fi", "sitcom", "western"],
    ]);
    expect(mojoModularSetPicks(composed)).toEqual(["fantasy", "horror", "sci-fi"]);
  });

  it("answering with a checked-off set is refused", () => {
    const log = afterScenario1({});
    expect(() => compose(log, (choice) => (choice.slot === "set1" ? ["crime"] : []))).toThrow(/not one of its options/);
  });

  it("Victory checks off every set the scenario used: crime, then the three picked", () => {
    const log = afterScenario2({}, {});
    expect(struckOf(log, "modularSets")).toEqual(["crime", "fantasy", "horror", "sci-fi"]);
    expect(log.position.nextNodeId).toBe("mojo");
  });

  it("Longshot not in play at the end of scenario 1: shuffled into the encounter deck", () => {
    const log = afterScenario1({ longshot: false });
    const { log: composed, start } = compose(log);
    expect(start.encounterSets.setAside).toEqual(["longshot"]);
    const state = settledToPlay(composed);
    const [longshot] = anywhere(state, "39071");
    const piles = Object.values(state.encounterDecks).flatMap((pile) => [...pile.deck, ...pile.discard]);
    expect(piles).toContain(longshot);
    expect(state.pendingChoice).toBeNull();
    for (const seat of [0, 1]) expect(controlledBy(state, seat)).not.toContain("39071");
  });

  it("Longshot in play at the end of scenario 1: the first player may reveal him, and his When Revealed puts him into play (ruling Apr 30, 2026 (3) #1)", () => {
    const log = afterScenario1({ longshot: true });
    const composed = compose(log).log;
    const revealed = settledToPlay(composed, labeled("Reveal Longshot"));
    const [longshot] = anywhere(revealed, "39071");
    expect(inst(revealed, longshot!).controllerId).toBe(P1);
    expect(controlledBy(revealed, 0)).toContain("39071");
    expect(revealed.encounterSetAside).not.toContain(longshot);
    const piles = Object.values(revealed.encounterDecks).flatMap((pile) => [...pile.deck, ...pile.discard]);
    expect(piles).not.toContain(longshot);
  });

  it("... and declining shuffles him into the encounter deck, never leaving him out (owner's decision Q68, 2026-10-03)", () => {
    const log = afterScenario1({ longshot: true });
    const composed = compose(log).log;
    const declined = settledToPlay(composed, labeled("Shuffle him into the encounter deck"));
    const [longshot] = anywhere(declined, "39071");
    expect(controlledBy(declined, 0)).not.toContain("39071");
    expect(controlledBy(declined, 1)).not.toContain("39071");
    expect(declined.encounterSetAside).not.toContain(longshot);
    const piles = Object.values(declined.encounterDecks).flatMap((pile) => [...pile.deck, ...pile.discard]);
    expect(piles).toContain(longshot);
  });

  it("any seat may be the one player who reveals him: seat 2 reveals, and he is in play under seat 2 (owner's decision Q69, 2026-10-03)", () => {
    const log = afterScenario1({ longshot: true });
    const composed = compose(log).log;
    let asked: readonly string[] = [];
    const seat2 = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice && choice.options.some((o) => o.label === "Reveal Longshot")) return labeled("Reveal Longshot")(state);
      if (choice?.options.some((o) => o.label.includes("Player 2") || o.label === P2)) {
        asked = choice.options.map((o) => o.label);
        return [choice.options.find((o) => o.label.includes("Player 2") || o.label === P2)!.optionId];
      }
      return firstLegal(state);
    };
    const revealed = settledToPlay(composed, seat2);
    expect(asked.length).toBe(2);
    const [longshot] = anywhere(revealed, "39071");
    expect(inst(revealed, longshot!).controllerId).toBe(P2);
    expect(controlledBy(revealed, 1)).toContain("39071");
    expect(controlledBy(revealed, 0)).not.toContain("39071");
  });

  it("each player may take their recorded card from any player's deck into play; the threat added equals its cost", () => {
    const facts: S1Facts = { booing: true, high: [[HELICARRIER], [HELMET]], low: [[], [HELMET]] };
    const log = afterScenario1(facts, { 1: HELICARRIER, 2: HELMET });
    expect(recordedOf(log, 0)).toEqual([HELICARRIER]);
    const composed = compose(log).log;
    const declined = settledToPlay(composed);
    const taken = settledToPlay(composed, takingRecorded());
    // Seat 1's Helicarrier (3) and seat 2's Helmet (2) are in play under their controllers; the threat is 3 + 2.
    expect(controlledBy(taken, 0)).toContain(HELICARRIER);
    expect(controlledBy(taken, 1)).toContain(HELMET);
    expect(controlledBy(declined, 0)).not.toContain(HELICARRIER);
    expect(mainThreat(taken) - mainThreat(declined)).toBe(printedCost(HELICARRIER) + printedCost(HELMET));
    expect(mainThreat(taken) - mainThreat(declined)).toBe(5);
  });

  it("... and a player who takes nothing adds no threat", () => {
    const log = afterScenario1({ booing: true, high: [[HELICARRIER], []] }, { 1: HELICARRIER });
    const composed = compose(log).log;
    const declined = settledToPlay(composed);
    const baseline = settledToPlay(compose(afterScenario1({})).log);
    expect(mainThreat(declined)).toBe(mainThreat(baseline));
    expect(controlledBy(declined, 0)).not.toContain(HELICARRIER);
  });

  it("the card is taken from any player's deck: seat 1's recorded card is found even when it is in seat 2's deck only", () => {
    const log = afterScenario1({ booing: true, high: [[HELICARRIER], []] }, { 1: HELICARRIER });
    const composed = compose(log).log;
    // Seat 1's deck holds no Helicarrier (dropped before the game is built); seat 2's holds one.
    const settled = settle(
      build(composed, { dropDeckCards: [[HELICARRIER], []], extraDeckCards: [[SURVEILLANCE_TEAM], []] }).state,
      takingRecorded(),
      (s) => s.step.phase === "player",
      WAVE6_DEPS,
    );
    const heli = controlledBy(settled, 0).filter((code) => code === HELICARRIER);
    expect(heli).toHaveLength(1);
    const played = settled.players[0]!.playArea.find((id) => codeOf(settled, id) === HELICARRIER)!;
    expect(inst(settled, played).ownerId).toBe(P2);
    expect(inst(settled, played).controllerId).toBe(P1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Scenario 3 - Mojo (insert p. 17)
// ---------------------------------------------------------------------------------------------------------------

describe("MOJO_CAMPAIGN_DEFINITION: scenario 3, Mojo setup (insert p. 17)", () => {
  // After scenarios 1 and 2 four genre sets are checked off (crime, fantasy, horror, sci-fi): sitcom and western remain.
  const composeThree = (seats = SEATS) =>
    compose(afterScenario2({}, {}, seats), (choice) =>
      /^(set|checked)\d$/.test(choice.slot) ? [choice.options[0]!] : [],
    );

  it("two players need three sets (1 + 1 per player): two unchecked sets remain, so the third is a checked-off one, offered only then", () => {
    const { asked, log } = composeThree();
    const picks = asked.filter((choice) => /^(set|checked)\d$/.test(choice.slot));
    expect(picks.map((pick) => [pick.slot, pick.options])).toEqual([
      ["set1", ["sitcom", "western"]],
      ["set2", ["western"]],
      // Every unchecked set is chosen: only now are the checked-off sets offered (never an unchecked one).
      ["checked3", ["crime", "fantasy", "horror", "sci-fi"]],
    ]);
    expect(mojoModularSetPicks(log)).toEqual(["sitcom", "western", "crime"]);
    expect(mojoCheckedOffSets(log)).toEqual(["crime", "fantasy", "horror", "sci-fi"]);
  });

  it("one player needs two sets and the two unchecked ones are enough: no checked-off set is offered", () => {
    const { asked, log } = composeThree(SOLO_SEATS);
    const picks = asked.filter((choice) => /^(set|checked)\d$/.test(choice.slot));
    expect(picks.map((pick) => [pick.slot, pick.options])).toEqual([
      ["set1", ["sitcom", "western"]],
      ["set2", ["western"]],
    ]);
    expect(mojoModularSetPicks(log)).toEqual(["sitcom", "western"]);
  });

  it("an unchecked set is always taken before a checked-off one: the third pick cannot be answered with an unchecked set that is gone, nor a picked one", () => {
    const log = afterScenario2({}, {});
    expect(() =>
      compose(log, (choice) =>
        choice.slot === "checked3" ? ["sitcom"] : /^set\d$/.test(choice.slot) ? [choice.options[0]!] : [],
      ),
    ).toThrow(/not one of its options/);
  });

  it("Longshot's branches repeat at scenario 3: revealed when he was in play at the end of scenario 2", () => {
    const log = afterScenario2({}, { longshot: true });
    expect(sharedField(log, "longshotInPlay")).toEqual({ kind: "flag", value: true });
    const composed = compose(log, (choice) => (/^(set|checked)\d$/.test(choice.slot) ? [choice.options[0]!] : [])).log;
    const state = settledToPlay(composed, labeled("Reveal Longshot"));
    expect(controlledBy(state, 0)).toContain("39071");
    // He was not in play at the end of scenario 2: shuffled in.
    const other = afterScenario2({ longshot: true }, { longshot: false });
    expect(sharedField(other, "longshotInPlay")).toEqual({ kind: "flag", value: false });
    const shuffled = settledToPlay(
      compose(other, (choice) => (/^(set|checked)\d$/.test(choice.slot) ? [choice.options[0]!] : [])).log,
    );
    expect(controlledBy(shuffled, 0)).not.toContain("39071");
    const piles = Object.values(shuffled.encounterDecks).flatMap((pile) => [...pile.deck, ...pile.discard]);
    expect(piles).toContain(anywhere(shuffled, "39071")[0]);
  });

  it("each recorded card is taken (scenario 1's and scenario 2's), and the threat added equals the total cost", () => {
    const log = afterScenario2(
      { booing: true, high: [[HELICARRIER], [HELMET]], low: [[], [HELMET]] },
      { threat: 0, high: [[SURVEILLANCE_TEAM], [TRISKELION]], low: [[SURVEILLANCE_TEAM], [TRISKELION]] },
      SEATS,
      { 1: HELICARRIER, 2: HELMET },
      { 1: SURVEILLANCE_TEAM, 2: TRISKELION },
    );
    expect(recordedOf(log, 0)).toEqual([HELICARRIER, SURVEILLANCE_TEAM]);
    expect(recordedOf(log, 1)).toEqual([HELMET, TRISKELION]);
    const composed = compose(log).log;
    const declined = settledToPlay(composed);
    const taken = settledToPlay(composed, takingRecorded());
    expect(controlledBy(taken, 0)).toEqual(expect.arrayContaining([HELICARRIER, SURVEILLANCE_TEAM]));
    expect(controlledBy(taken, 1)).toEqual(expect.arrayContaining([HELMET, TRISKELION]));
    // 3 + 2 + 2 + 1: the total printed cost of the four cards put into play this way.
    expect(mainThreat(taken) - mainThreat(declined)).toBe(8);
  });

  it("a player may take one of two recorded cards: the threat is that card's cost alone", () => {
    const log = afterScenario2(
      { booing: true, high: [[HELICARRIER], []] },
      { threat: 0, high: [[SURVEILLANCE_TEAM], []], low: [[SURVEILLANCE_TEAM], []] },
      SEATS,
      { 1: HELICARRIER },
      { 1: SURVEILLANCE_TEAM },
    );
    const composed = compose(log).log;
    const declined = settledToPlay(composed);
    // Takes only the first card the choice offers.
    const taken = settledToPlay(composed, (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseCards") return choice.options.slice(0, 1).map((o) => o.optionId);
      return firstLegal(state);
    });
    expect(controlledBy(taken, 0).filter((code) => code === HELICARRIER || code === SURVEILLANCE_TEAM)).toHaveLength(1);
    expect([2, 3]).toContain(mainThreat(taken) - mainThreat(declined));
  });

  it("winning scenario 3 wins the campaign", () => {
    const log = afterScenario2({}, {});
    const composed = compose(log).log;
    const won = finish(composed, bareResult("mojo", true)).log;
    expect(won.status).toBe("won");
    expect(won.position.nextNodeId).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Expert campaign (insert p. 5)
// ---------------------------------------------------------------------------------------------------------------

describe("MOJO_CAMPAIGN_DEFINITION: the expert campaign (insert p. 5)", () => {
  it("expert instructions are ignored in a standard campaign: no hit points recorded, no heal offered", () => {
    const log = afterScenario1({ hp: [3, 4] });
    expect(log.seats[0]?.fields.remainingHp).toBeUndefined();
    const { start } = compose(log);
    expect(start.input.instructions.map((i) => i.instructionId)).toEqual([
      "mojo.s2.setup.longshot",
      "mojo.s2.setup.recorded-card",
    ]);
  });

  it("each identity's remaining hit points are recorded after a win, and set (then healed) at the next setup", () => {
    const log = afterScenario1({ hp: [4, 2] }, {}, EXPERT);
    expect(log.seats.map((seat) => seat.fields.remainingHp)).toEqual([
      { kind: "number", value: 4 },
      { kind: "number", value: 2 },
    ]);
    const { start } = compose(log);
    expect(start.input.instructions.map((i) => i.instructionId)).toEqual([
      "mojo.s2.setup.longshot",
      "mojo.s2.setup.recorded-card",
      "mojo.s2.setup.hp-set",
      "mojo.s2.setup.heal",
    ]);
  });

  it("a player may decline the heal and keep the hit points they recorded; accepting deals one facedown encounter card and heals to full", () => {
    const composed = compose(afterScenario1({ hp: [4, 6] }, {}, EXPERT)).log;
    const declined = settledToPlay(composed, labeled("Don't heal"));
    const identity = (state: GameState, seat: number) => state.players[seat]!.identity.instanceId;
    expect(remainingHitPoints(declined, identity(declined, 0), WAVE6_DEPS)).toBe(4);
    expect(remainingHitPoints(declined, identity(declined, 1), WAVE6_DEPS)).toBe(6);
    const healed = settledToPlay(composed, labeled("Heal to full"));
    for (const seat of [0, 1]) {
      expect(remainingHitPoints(healed, identity(healed, seat), WAVE6_DEPS)).toBe(
        maxHitPoints(healed, identity(healed, seat), WAVE6_DEPS),
      );
    }
    // One facedown encounter card each, dealt to themself (the villain phase reveals it); none when declined.
    expect(healed.players.map((p) => p.dealtEncounter.length)).toEqual([1, 1]);
    expect(declined.players.map((p) => p.dealtEncounter.length)).toEqual([0, 0]);
  });

  it("hit points above base are recorded as base (capped), and the recorded value is never above it", () => {
    const composed = compose(newLog(EXPERT)).log;
    const built = build(composed);
    const state = settledToPlay(composed);
    const identity = state.players[0]!.identity.instanceId;
    const base = maxHitPoints(state, identity, WAVE6_DEPS)!;
    // Staged: Spider-Man ends the game with more hit points than his base (a hit point bonus), the second with damage.
    const overbase = {
      ...state,
      instances: {
        ...state.instances,
        [identity]: { ...inst(state, identity), damage: 0 },
        [state.players[1]!.identity.instanceId]: { ...inst(state, state.players[1]!.identity.instanceId), damage: 3 },
      },
    };
    const result = campaignResultOf(DEF, composed, asWin(overbase), built.events, WAVE6_DEPS);
    const hp = (seat: number) =>
      result.records.find((r) => r.write.field === "remainingHp" && r.write.seatNumber === seat)?.write.value;
    expect(hp(1)).toEqual({ kind: "number", value: base });
    expect(hp(2)).toEqual({
      kind: "number",
      value: maxHitPoints(state, state.players[1]!.identity.instanceId, WAVE6_DEPS)! - 3,
    });
  });

  it("a defeated player rejoins by dealing themself the facedown card: recorded 0 hit points, no Decline", () => {
    const composed = compose(afterScenario1({ hp: [5, 0] }, {}, EXPERT)).log;
    const state = build(composed).state;
    // The seat that is not defeated is asked; the defeated seat (0 recorded) is not offered Decline.
    const asked: string[][] = [];
    const settled = settle(
      state,
      (s) => {
        const choice = s.pendingChoice;
        if (choice && choice.options.some((o) => o.label === "Don't heal" || o.label === "Heal to full")) {
          asked.push(choice.options.map((o) => o.label));
        }
        return labeled("Don't heal")(s);
      },
      (s) => s.step.phase === "player",
      WAVE6_DEPS,
    );
    expect(asked).toEqual([["Heal to full", "Don't heal"]]);
    const identity = (seat: number) => settled.players[seat]!.identity.instanceId;
    expect(remainingHitPoints(settled, identity(0), WAVE6_DEPS)).toBe(5);
    expect(remainingHitPoints(settled, identity(1), WAVE6_DEPS)).toBe(maxHitPoints(settled, identity(1), WAVE6_DEPS));
    expect(settled.players.map((p) => p.dealtEncounter.length)).toEqual([0, 1]);
  });

  it("a player defeated in a game their teammates win takes no part in its Victory steps", () => {
    const composed = compose(newLog(EXPERT)).log;
    const built = build(composed);
    const state = settledToPlay(composed);
    const defeated = {
      ...state,
      players: state.players.map((p, i) => (i === 1 ? { ...p, eliminated: true } : p)),
      outcome: { result: "win" as const, reason: "villainDefeated" as const },
    };
    const result = campaignResultOf(DEF, composed, defeated, built.events, WAVE6_DEPS);
    expect(result.sittingOut).toEqual([2]);
    expect(result.records.some((r) => r.write.seatNumber === 2)).toBe(false);
    expect(result.records.some((r) => r.write.seatNumber === 1 && r.write.field === "remainingHp")).toBe(true);
  });

  it("a defeated player rejoins in the next scenario: their recorded hit points are absent, so the heal is forced", () => {
    // Seat 2 sat out scenario 1's Victory: no remainingHp recorded for them at all (read as 0).
    const composed = compose(newLog(EXPERT)).log;
    const result = {
      ...s1Win({ hp: [5] }),
      sittingOut: [2],
    };
    const log = finish(composed, result).log;
    expect(log.seats[0]?.fields.remainingHp).toEqual({ kind: "number", value: 5 });
    expect(log.seats[1]?.fields.remainingHp).toBeUndefined();
    const state = build(compose(log).log).state;
    const seen: string[][] = [];
    const settled = settle(
      state,
      (s) => {
        const choice = s.pendingChoice;
        if (choice?.options.some((o) => o.label === "Don't heal")) seen.push(choice.options.map((o) => o.label));
        return labeled("Don't heal")(s);
      },
      (s) => s.step.phase === "player",
      WAVE6_DEPS,
    );
    expect(seen).toHaveLength(1);
    expect(settled.players.map((p) => p.dealtEncounter.length)).toEqual([0, 1]);
  });
});

describe("modular set helpers", () => {
  it("read the checked-off sets and the scenario's picks from a log, and nothing from a fresh one", () => {
    const fresh = newLog(STANDARD);
    expect(mojoCheckedOffSets(fresh)).toEqual([]);
    expect(mojoModularSetPicks(fresh)).toEqual([]);
  });

  it("a non-card id of the log (the instance of an unrelated seat) never appears among the picks", () => {
    const { log } = compose(newLog(STANDARD));
    expect(mojoModularSetPicks(log).every((set) => (MOJO_GENRE_SETS as readonly string[]).includes(set))).toBe(true);
    const unused: InstanceId[] = [];
    expect(unused).toEqual([]);
  });
});
