/**
 * `AOA_CAMPAIGN_DEFINITION` (Age of Apocalypse, MC45): the definition is well-formed against the real `@mc/content`
 * records, and the campaign does what the rulebook prints, driven through the real runner.
 *
 * Two kinds of evidence. Between games, a finished game's facts are stand-ins (`resultOf`: the records
 * `campaignResultOf` would derive), which is `mut_gen.test.ts`'s technique. Inside a game, the composed log starts a
 * real game of the node's scenario (`build`), settled to the point the test reads. Two tests derive the result from a
 * real game's state and events; those say what they substitute.
 *
 * The numbered tests are docs/phase7-wave8.md §3.45's eight, followed by its "to verify" items and two whole campaigns.
 */
import { describe, expect, it, vi } from "vitest";
import { AOA_CAMPAIGN, AOA_SCENARIOS, CAMPAIGNS as CONTENT_CAMPAIGNS, cardId, type PlayModes } from "@mc/content";
import {
  campaignResultOf,
  grantDeckSizesOf,
  remainingHitPoints,
  traitsOf,
  validateDeck,
  type CampaignDefinition,
  type CampaignInstruction,
  type CampaignLog,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { action } from "../dsl/abilities.js";
import { validateDefinition } from "../dsl/validate.js";
import { firstLegal, type Picker } from "../testing/harness.js";
import { MISSION_RULES, PROFESSOR_X_CANNOT_ENTER_PLAY } from "../wave8/aoa/campaign/mission-rules.js";
import { WAVE8_CARDS, WAVE8_DEPS } from "../wave8/index.js";
import { AOA_CAMPAIGN_DEFINITION, AOA_DEFEATED, AOA_MISSIONS, AOA_NOT_DEFEATED, AOA_OVERSEERS } from "./aoa.js";
import {
  DEPS,
  EXPERT,
  NODES,
  SEATS,
  STANDARD,
  anywhere,
  apply,
  atAllySearch,
  build,
  codeOf,
  compose,
  declineAll,
  drawOf,
  firstTurn,
  inDeck,
  missionOf,
  newLog,
  overseerOf,
  playNode,
  resultOf,
  seatFor,
  setAsideCodes,
  settled,
  stepOf,
  struckOf,
  optionOf,
  typeOf,
  type Pick,
} from "./aoa-testing.js";
import { CAMPAIGNS } from "./index.js";

vi.setConfig({ testTimeout: 120_000 });

const DEF = AOA_CAMPAIGN_DEFINITION;
const [LIBERATE, EVACUATE, SABOTAGE, FIND] = AOA_MISSIONS.map((row) => row.name) as [string, string, string, string];
const MISSION_NAMES = AOA_MISSIONS.map((row) => row.name);
const OVERSEER_NAMES = AOA_OVERSEERS.map((overseer) => overseer.name);
const PROTECT = "Protect the Professor";
const SUGAR_MAN = "Sugar Man";

const MISSION_TEAM = "45171a";
const ALLIES = ["45172", "45173", "45174", "45175"];
const DESPERATE_MEASURES = "45176";
const SEA_WALL = "45177";
const PANICKED_REFUGEES = "45178";
const PRELATES = ["45179b", "45180b", "45181b", "45182b", "45183b"];

const nodes = DEF.graph.nodes;
const everyInstruction = (): readonly CampaignInstruction[] => [
  ...(DEF.everyNodeSetup ?? []),
  ...nodes.flatMap((node) => [...(node.composition ?? []), ...node.setup, ...node.victory, ...(node.defeat ?? [])]),
];

/** The first seed of 1 to 400 the predicate holds for: a test names the draw it needs, not a number. */
function seedWhere(what: string, holds: (seed: number) => boolean): number {
  for (let seed = 1; seed <= 400; seed++) if (holds(seed)) return seed;
  throw new Error(`no seed of 1 to 400 where ${what}`);
}
const firstMission = (seed: number, modes: PlayModes = STANDARD): string => missionOf(compose(newLog(modes, seed)).log);
/** A log whose scenario 1 drew `mission`. */
const logDrawing = (mission: string, modes: PlayModes = STANDARD): CampaignLog =>
  newLog(
    modes,
    seedWhere(`scenario 1 draws ${mission}`, (seed) => firstMission(seed, modes) === mission),
  );

const rewardFirst: Pick = (choice) => (choice.slot === "reward" ? [choice.options[0]!] : declineAll(choice));
const cardOf = (id: string) => WAVE8_CARDS.find((card) => (card.id as string) === id);
const countIn = (list: readonly string[], id: string): number => list.filter((entry) => entry === id).length;
const grantsOf = (log: CampaignLog, seat: number) => log.seats[seat]!.grants;
const removedIds = (log: CampaignLog): readonly string[] => log.removedFromCampaign.map((face) => face.cardId);
const results = (log: CampaignLog) =>
  Object.fromEntries(AOA_MISSIONS.map((row) => [row.name, optionOf(log, row.resultField)]));

// ---------------------------------------------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------------------------------------------

describe("AOA_CAMPAIGN_DEFINITION: structure", () => {
  it("matches the @mc/content record: five nodes in MC45's fixed order, each a real scenario", () => {
    expect(DEF.campaignId).toBe(AOA_CAMPAIGN.id);
    expect(DEF.version).toBe("1");
    expect(DEF.graph.kind).toBe("linear");
    expect(nodes.map((node) => node.id)).toEqual([...NODES]);
    const known = new Set(AOA_SCENARIOS.map((scenario) => scenario.id as string));
    const scenarioIds = nodes.map((node) => {
      if (node.scenario.kind !== "fixed") throw new Error(`${node.id}: expected a fixed scenario`);
      expect(known.has(node.scenario.scenarioId as string), node.id).toBe(true);
      return node.scenario.scenarioId as string;
    });
    expect(scenarioIds).toEqual(AOA_CAMPAIGN.scenarioIds.map((id) => id as string));
  });

  it("a lost scenario is retried free from the node's start (MC45 p. 4); no node prints a DEFEAT block", () => {
    expect(DEF.loss).toEqual({ retry: "free", retryBaseline: "nodeStart", citation: "MC45 p. 4" });
    for (const node of nodes) expect(node.defeat, node.id).toBeUndefined();
  });

  it("elimination is the expert campaign's rule (MC45 p. 20), with no free rejoin: the heal is the price", () => {
    expect(DEF.elimination).toMatchObject({ citation: "MC45 p. 20", whenModes: { expertCampaign: true } });
    expect(DEF.elimination?.rejoinAtPrintedHitPoints).toBeUndefined();
  });

  it("every instruction id is unique, prefixed 'mc45.', and cites 'MC45 p. N'; so does every log field", () => {
    const ids = everyInstruction().map((instruction) => instruction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const instruction of everyInstruction()) {
      expect(instruction.id.startsWith("mc45."), instruction.id).toBe(true);
      expect(instruction.citation, instruction.id).toMatch(/^MC45 p\. \d+$/);
    }
    for (const field of DEF.logFields) expect(field.citation, field.id).toMatch(/^MC45 p\. \d+$/);
  });

  it("the log: two strike lists, this scenario's draw, four result fields, expert hit points", () => {
    const types = Object.fromEntries(DEF.logFields.map((field) => [field.id, field.type]));
    expect(types.missions).toEqual({ kind: "strikeList", options: MISSION_NAMES });
    expect(types.overseers).toEqual({ kind: "strikeList", options: OVERSEER_NAMES });
    expect(types.currentMission).toEqual({ kind: "choice", options: [...MISSION_NAMES, PROTECT] });
    expect(types.currentOverseer).toEqual({ kind: "choice", options: OVERSEER_NAMES });
    for (const field of ["resultLiberate", "resultEvacuate", "resultSabotage", "resultFind"]) {
      expect(types[field], field).toEqual({ kind: "choice", options: [AOA_DEFEATED, AOA_NOT_DEFEATED] });
    }
    const hp = DEF.logFields.find((field) => field.id === "remainingHp");
    expect(hp).toMatchObject({ scope: "perSeat", whenModes: { expertCampaign: true } });
    expect(MISSION_NAMES).toEqual([
      "Liberate the Seattle Core",
      "Evacuate Survivors",
      "Sabotage the Sea Wall",
      "Find Lost Mutants",
    ]);
    expect(OVERSEER_NAMES).toEqual(["Mister Sinister", "The Shadow King", "Abyss", "Sugar Man", "Mikhail Rasputin"]);
  });

  it("every field an instruction reads or writes is declared, and every declared field is used", () => {
    const fieldsIn = (value: unknown, found: Set<string>): void => {
      if (Array.isArray(value)) value.forEach((item) => fieldsIn(item, found));
      else if (value !== null && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.field === "string") found.add(record.field);
        Object.values(record).forEach((item) => fieldsIn(item, found));
      }
    };
    const referenced = new Set<string>();
    for (const instruction of everyInstruction()) {
      fieldsIn(instruction.step, referenced);
      fieldsIn(instruction.when, referenced);
    }
    const declared = new Set(DEF.logFields.map((field) => field.id));
    for (const field of referenced) expect(declared.has(field), field).toBe(true);
    for (const field of declared) expect(referenced.has(field), `${field} is never read or written`).toBe(true);
  });

  it("every named mission, Overseer and campaign card is the card of that name in the pool", () => {
    for (const row of AOA_MISSIONS) expect(cardOf(row.cardId)?.name, row.cardId).toBe(row.name);
    for (const overseer of AOA_OVERSEERS) {
      const card = cardOf(overseer.cardId);
      expect(card?.name, overseer.cardId).toBe(overseer.name);
      expect(card && "traits" in card ? card.traits : [], overseer.cardId).toContain("OVERSEER");
    }
    expect(cardOf("45170a")?.name).toBe(PROTECT);
    expect(cardOf(MISSION_TEAM)?.name).toBe("Mission Team");
    expect(ALLIES.map((id) => cardOf(id)?.type)).toEqual(["ally", "ally", "ally", "ally"]);
    expect(cardOf(DESPERATE_MEASURES)).toMatchObject({ name: "Desperate Measures", quantityInSet: 4 });
    expect(cardOf(SEA_WALL)?.name).toBe("North American Sea Wall");
    expect(cardOf(PANICKED_REFUGEES)).toMatchObject({ name: "Panicked Refugees", quantityInSet: 4 });
  });

  it("every in-game instruction passes the DSL validator, and the definition round-trips through JSON", () => {
    for (const instruction of everyInstruction()) {
      if (instruction.step.kind !== "inGame") continue;
      expect(validateDefinition(action(...instruction.step.effects)), instruction.id).toEqual([]);
    }
    expect(JSON.parse(JSON.stringify(DEF))).toEqual(DEF);
  });

  it("the Mission Rules are scenario rules of every node; scenario 5 adds 'Professor X cannot enter play'", () => {
    for (const node of nodes.slice(0, 4)) expect(node.scenarioRuleSpecs, node.id).toEqual([...MISSION_RULES]);
    expect(nodes[4]!.scenarioRuleSpecs).toEqual([...MISSION_RULES, PROFESSOR_X_CANNOT_ENTER_PLAY]);
  });

  it("lists the block once for every scenario and each scenario's own bullets, in printed order", () => {
    expect((DEF.everyNodeSetup ?? []).map((instruction) => instruction.id)).toEqual([
      "mc45.setup.age-of-apocalypse",
      "mc45.setup.mission",
      "mc45.setup.protect-the-professor",
      "mc45.setup.liberate",
      "mc45.setup.evacuate.cards",
      "mc45.setup.evacuate",
      "mc45.setup.sabotage.cards",
      "mc45.setup.sabotage",
      "mc45.setup.find",
      "mc45.setup.overseer",
      "mc45.setup.mission-team",
      "mc45.setup.mission-area",
      "mc45.setup.carried.desperate-measures",
      "mc45.setup.carried.panicked-refugees.cards",
      "mc45.setup.carried.panicked-refugees",
      "mc45.setup.carried.sea-wall.cards",
      "mc45.setup.carried.sea-wall",
      "mc45.setup.ally-search",
      "mc45.setup.ally-search.expert",
    ]);
    const expert = (n: number) => [`mc45.s${n}.setup.hp-set`, `mc45.s${n}.setup.heal`];
    expect(nodes.map((node) => node.setup.map((instruction) => instruction.id))).toEqual([
      ["mc45.s1.setup.identity"],
      expert(2),
      ["mc45.s3.setup.prelate", ...expert(3)],
      expert(4),
      ["mc45.s5.setup.professor-x", ...expert(5)],
    ]);
    const victory = (n: number) => [
      `mc45.s${n}.victory.overseer-record`,
      ...AOA_MISSIONS.map((row) => `mc45.s${n}.victory.${row.id}.record`),
      `mc45.s${n}.victory.strike-mission`,
      ...AOA_MISSIONS.flatMap((row) => [
        `mc45.s${n}.victory.${row.id}.defeated`,
        `mc45.s${n}.victory.${row.id}.not-defeated`,
      ]),
      `mc45.s${n}.victory.strike-overseer`,
      `mc45.s${n}.victory.hp`,
    ];
    expect(nodes.map((node) => node.victory.map((instruction) => instruction.id))).toEqual([
      victory(1),
      victory(2),
      victory(3),
      victory(4),
      ["mc45.s5.victory.record", "mc45.s5.victory.saved", "mc45.s5.victory.failed"],
    ]);
  });

  it("the rewards are granted counted toward deck size (§4.1 Q25), and the two draws are per attempt (Q22 = B)", () => {
    const found: Record<string, unknown>[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value !== null && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (record.kind === "grantCard" || record.kind === "random") found.push(record);
        Object.values(record).forEach(walk);
      }
    };
    everyInstruction().forEach((instruction) => walk(instruction.step));
    const grants = found.filter((op) => op.kind === "grantCard");
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) expect(grant.deckSize).toBe("counted");
    const draws = found.filter((op) => op.kind === "random");
    expect(draws.map((draw) => draw.slot)).toEqual(["mission", "overseer"]);
    for (const draw of draws) expect(draw.perAttempt).toBe(true);
  });

  it("is listed: the cards registry and the content list both name the campaign", () => {
    expect(CAMPAIGNS.aoa).toBe(DEF);
    expect(CONTENT_CAMPAIGNS.some((campaign) => campaign.id === AOA_CAMPAIGN.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// §3.45's eight tests
// ---------------------------------------------------------------------------------------------------------------

describe("AOA campaign §3.45 (1): the four missions of the log", () => {
  /** Scenarios 1 to 4, each won with its mission not defeated; the missions drawn, in order. */
  function fourWins(seed: number) {
    let log = newLog(STANDARD, seed);
    const drawn: string[] = [];
    for (let n = 0; n < 4; n++) {
      const played = playNode(log);
      drawn.push(missionOf(played.composed.log));
      log = played.log;
    }
    return { log, drawn };
  }

  it("scenarios 1 to 4 draw four different missions, on every seed tried", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { drawn } = fourWins(seed);
      expect([...drawn].sort(), `seed ${seed}`).toEqual([...MISSION_NAMES].sort());
    }
  });

  it("the same seed with no loss draws the same order, and seeds differ in their order", () => {
    expect(fourWins(4242).drawn).toEqual(fourWins(4242).drawn);
    expect(fourWins(4242).log).toEqual(fourWins(4242).log);
    const orders = new Set(Array.from({ length: 40 }, (_, index) => fourWins(index + 1).drawn.join(" > ")));
    expect(orders.size).toBeGreaterThan(5);
  });

  it("after four wins `missions` has four struck names, in the order played, and four result fields are set", () => {
    const { log, drawn } = fourWins(4242);
    expect(struckOf(log, "missions")).toEqual(drawn);
    expect(results(log)).toEqual(Object.fromEntries(MISSION_NAMES.map((name) => [name, AOA_NOT_DEFEATED])));
    expect(log.position.nextNodeId).toBe("en-sabah-nur");
    expect(log.status).toBe("active");
  });

  it("each draw is traced as random, attempt 1, and the fifth scenario does not draw", () => {
    const { log } = fourWins(4242);
    const first = compose(newLog(STANDARD, 4242)).log;
    expect(drawOf(first, "mc45.setup.mission")).toMatchObject({ random: true, attempt: 1 });
    expect(drawOf(first, "mc45.setup.overseer")).toMatchObject({ random: true, attempt: 1 });
    expect(stepOf(first, "mc45.setup.protect-the-professor")?.skipped).toBe("condition");
    const fifth = compose(log).log;
    expect(stepOf(fifth, "mc45.setup.mission")?.skipped).toBe("condition");
    expect(stepOf(fifth, "mc45.setup.protect-the-professor")?.skipped).toBeUndefined();
    expect(missionOf(fifth)).toBe(PROTECT);
    expect(struckOf(fifth, "missions")).toHaveLength(4);
  });
});

describe("AOA campaign §3.45 (2): Evacuate Survivors, drawn in scenario 2", () => {
  /** A log that has won scenario 1 and whose scenario 2 draws Evacuate Survivors, composed. */
  function evacuateSecond() {
    const seed = seedWhere("scenario 2 draws Evacuate Survivors", (candidate) => {
      const first = playNode(newLog(STANDARD, candidate));
      return missionOf(compose(first.log).log) === EVACUATE;
    });
    return compose(playNode(newLog(STANDARD, seed)).log);
  }

  it("its Setup cell: one copy for each player is set aside and shuffled into each deck", () => {
    const second = evacuateSecond();
    expect(second.start.nodeId).toBe("four-horsemen");
    expect(countIn(second.start.input.setAsideCards ?? [], PANICKED_REFUGEES)).toBe(2);
    const state = settled(build(second.log).state, atAllySearch);
    expect([inDeck(state, 0, PANICKED_REFUGEES), inDeck(state, 1, PANICKED_REFUGEES)]).toEqual([1, 1]);
    expect(anywhere(state, PANICKED_REFUGEES)).toHaveLength(2);
    // An encounter card in a player's deck: the scenario still owns it.
    for (const id of anywhere(state, PANICKED_REFUGEES)) expect(state.instances[id]!.ownerId).toBeNull();
  });

  it("not defeated: scenarios 3, 4 and 5 each start with 1 Panicked Refugees in each deck (2 in the game)", () => {
    let log = apply(evacuateSecond().log, resultOf(evacuateSecond().log, { missionDefeated: false })).log;
    expect(optionOf(log, "resultEvacuate")).toBe(AOA_NOT_DEFEATED);
    expect(removedIds(log)).not.toContain(PANICKED_REFUGEES);
    // "Neither card is in the seat's deck list between games" (§2.14): the copies are the scenario's.
    for (const seat of log.seats) expect(seat.deck.cards.some((line) => line.cardId === PANICKED_REFUGEES)).toBe(false);
    for (const nodeId of ["apocalypse", "dark-beast", "en-sabah-nur"]) {
      const composed = compose(log);
      expect(composed.start.nodeId).toBe(nodeId);
      expect(composed.start.input.instructions.map((i) => i.instructionId)).toContain(
        "mc45.setup.carried.panicked-refugees",
      );
      const state = settled(build(composed.log).state, atAllySearch);
      expect([inDeck(state, 0, PANICKED_REFUGEES), inDeck(state, 1, PANICKED_REFUGEES)], nodeId).toEqual([1, 1]);
      expect(anywhere(state, PANICKED_REFUGEES), nodeId).toHaveLength(2);
      log = apply(composed.log, resultOf(composed.log)).log;
    }
  });

  it("defeated: the four copies are removed from the campaign and each seat holds one granted upgrade", () => {
    const second = evacuateSecond();
    const done = apply(second.log, resultOf(second.log, { missionDefeated: true }), rewardFirst);
    expect(optionOf(done.log, "resultEvacuate")).toBe(AOA_DEFEATED);
    expect(removedIds(done.log)).toContain(PANICKED_REFUGEES);
    expect(done.asked.map((choice) => [choice.slot, choice.seatNumber, choice.optional])).toEqual([
      ["reward", 1, true],
      ["reward", 2, true],
    ]);
    // "An upgrade from any aspect": upgrades only, of an aspect (basic is not one, §4.1 Q24), several aspects offered.
    for (const choice of done.asked) {
      const offered = choice.options.map((id) => cardOf(id)!);
      expect(offered.length).toBeGreaterThan(10);
      for (const card of offered) {
        expect(card.type, card.id).toBe("upgrade");
        expect("aspect" in card ? card.aspect : undefined, card.id).not.toBe("basic");
      }
      expect(new Set(offered.map((card) => ("aspect" in card ? card.aspect : ""))).size).toBeGreaterThan(1);
    }
    for (const seat of [0, 1]) {
      expect(grantsOf(done.log, seat)).toHaveLength(1);
      const [grant] = grantsOf(done.log, seat);
      expect(grant).toMatchObject({ permanence: "campaign", deckSize: "counted", grantedAtNodeId: "four-horsemen" });
      expect(cardOf(grant!.cardId)?.type).toBe("upgrade");
      expect(done.log.seats[seat]!.deck.cards.find((line) => line.cardId === grant!.cardId)?.quantity).toBe(1);
    }
    // Scenarios 3 to 5 carry no Panicked Refugees: nothing is set aside and no instruction resolves.
    const third = compose(done.log);
    expect(third.start.input.setAsideCards ?? []).not.toContain(PANICKED_REFUGEES);
    expect(stepOf(third.log, "mc45.setup.carried.panicked-refugees")?.skipped).toBe("condition");
    // The granted upgrade is a legal card of the deck the next game is built from.
    const state = settled(build(third.log).state, atAllySearch);
    expect(anywhere(state, PANICKED_REFUGEES)).toHaveLength(0);
    expect(anywhere(state, grantsOf(done.log, 0)[0]!.cardId)).not.toHaveLength(0);
  });

  it("a player may decline the upgrade: no grant, and the mission is still recorded as defeated", () => {
    const second = evacuateSecond();
    const done = apply(second.log, resultOf(second.log, { missionDefeated: true }), declineAll);
    expect(done.asked).toHaveLength(2);
    expect(done.log.seats.map((seat) => seat.grants)).toEqual([[], []]);
    expect(optionOf(done.log, "resultEvacuate")).toBe(AOA_DEFEATED);
  });
});

describe("AOA campaign §3.45 (3): Liberate the Seattle Core, defeated in scenario 1", () => {
  const acceptSeat1: Pick = (choice) =>
    choice.slot === "desperateMeasures" && choice.seatNumber === 1 ? [DESPERATE_MEASURES] : declineAll(choice);

  it("its Setup cell sets the four copies of Desperate Measures aside for the game", () => {
    const first = compose(logDrawing(LIBERATE));
    expect(countIn(first.start.input.setAsideCards ?? [], DESPERATE_MEASURES)).toBe(4);
    const state = firstTurn(build(first.log).state);
    expect(countIn(setAsideCodes(state), DESPERATE_MEASURES)).toBe(4);
  });

  it("in scenario 2 each player is offered 1 Desperate Measures; one accepts: 1 copy in that deck, none in the other", () => {
    const won = playNode(logDrawing(LIBERATE), { missionDefeated: true });
    expect(optionOf(won.log, "resultLiberate")).toBe(AOA_DEFEATED);
    expect(removedIds(won.log)).not.toContain(DESPERATE_MEASURES);
    const second = compose(won.log, acceptSeat1);
    expect(second.asked.map((choice) => [choice.slot, choice.seatNumber, choice.options, choice.optional])).toEqual([
      ["desperateMeasures", 1, [DESPERATE_MEASURES], true],
      ["desperateMeasures", 2, [DESPERATE_MEASURES], true],
    ]);
    const [one, two] = second.start.input.seats;
    expect([countIn(one!.deck, DESPERATE_MEASURES), countIn(two!.deck, DESPERATE_MEASURES)]).toEqual([1, 0]);
    expect(one!.grantDeckSizes).toEqual([{ cardId: DESPERATE_MEASURES, deckSize: "counted" }]);
    expect(two!.grantDeckSizes).toBeUndefined();
    const state = settled(build(second.log).state, atAllySearch);
    expect([inDeck(state, 0, DESPERATE_MEASURES), inDeck(state, 1, DESPERATE_MEASURES)]).toEqual([1, 0]);
    expect(anywhere(state, DESPERATE_MEASURES)).toHaveLength(1);
  });

  it("the copy is for that game: gone from the deck list afterward, and offered again at the start of the next", () => {
    const won = playNode(logDrawing(LIBERATE), { missionDefeated: true });
    const second = compose(won.log, acceptSeat1);
    expect(grantsOf(second.log, 0)).toMatchObject([{ cardId: DESPERATE_MEASURES, permanence: "thisGame" }]);
    const after = apply(second.log, resultOf(second.log)).log;
    expect(after.seats.map((seat) => seat.grants)).toEqual([[], []]);
    expect(after.seats[0]!.deck.cards.some((line) => line.cardId === DESPERATE_MEASURES)).toBe(false);
    expect(compose(after).asked.map((choice) => choice.slot)).toEqual(["desperateMeasures", "desperateMeasures"]);
    // A lost scenario 2 is rolled back to its start, and the retry offers it again.
    const lost = apply(second.log, resultOf(second.log, { won: false })).log;
    expect(lost.seats.map((seat) => seat.grants)).toEqual([[], []]);
    expect(compose(lost).asked.map((choice) => choice.slot)).toEqual(["desperateMeasures", "desperateMeasures"]);
  });

  it("not defeated: every copy is removed from the campaign and no later scenario offers one", () => {
    const won = playNode(logDrawing(LIBERATE), { missionDefeated: false });
    expect(optionOf(won.log, "resultLiberate")).toBe(AOA_NOT_DEFEATED);
    expect(removedIds(won.log)).toContain(DESPERATE_MEASURES);
    const second = compose(won.log);
    expect(second.asked).toEqual([]);
    expect(stepOf(second.log, "mc45.setup.carried.desperate-measures")?.skipped).toBe("condition");
  });
});

describe("AOA campaign §3.45 (4): Find Lost Mutants", () => {
  it("its Setup cell sets the four campaign allies aside for the game", () => {
    const first = compose(logDrawing(FIND));
    for (const ally of ALLIES) expect(countIn(first.start.input.setAsideCards ?? [], ally), ally).toBe(1);
    const state = firstTurn(build(first.log).state);
    expect(setAsideCodes(state).filter((code) => ALLIES.includes(code))).toEqual(ALLIES);
  });

  it("defeated: two seats pick different allies; the two unpicked are simply unused", () => {
    const first = compose(logDrawing(FIND));
    const done = apply(first.log, resultOf(first.log, { missionDefeated: true }), rewardFirst);
    expect(done.asked.map((choice) => [choice.seatNumber, choice.options])).toEqual([
      [1, ALLIES],
      // The first seat's ally is taken: each is one card (`excludeGranted`).
      [2, ALLIES.slice(1)],
    ]);
    expect(done.log.seats.map((seat) => seat.grants.map((grant) => grant.cardId))).toEqual([["45172"], ["45173"]]);
    for (const seat of [0, 1]) {
      expect(grantsOf(done.log, seat)[0]).toMatchObject({ permanence: "campaign", deckSize: "counted" });
    }
    expect(optionOf(done.log, "resultFind")).toBe(AOA_DEFEATED);
    for (const ally of ALLIES) expect(removedIds(done.log), ally).not.toContain(ally);
    // The allies are in the decks the next game is built from, and that game accepts them.
    const second = compose(done.log);
    const state = settled(build(second.log).state, atAllySearch);
    expect([inDeck(state, 0, "45172"), inDeck(state, 1, "45173")]).toEqual([1, 1]);
    expect([...anywhere(state, "45174"), ...anywhere(state, "45175")]).toEqual([]);
  });

  it("the second seat cannot be given the first seat's ally", () => {
    const first = compose(logDrawing(FIND));
    const same: Pick = (choice) => (choice.slot === "reward" ? ["45172"] : declineAll(choice));
    expect(() => apply(first.log, resultOf(first.log, { missionDefeated: true }), same)).toThrow(
      /not one of its options/,
    );
  });

  it("not defeated: all four are removed from the campaign, and nobody is asked", () => {
    const first = compose(logDrawing(FIND));
    const done = apply(first.log, resultOf(first.log, { missionDefeated: false }));
    expect(done.asked).toEqual([]);
    expect(optionOf(done.log, "resultFind")).toBe(AOA_NOT_DEFEATED);
    expect(removedIds(done.log)).toEqual(ALLIES);
    expect(done.log.seats.map((seat) => seat.grants)).toEqual([[], []]);
  });
});

describe("AOA campaign §3.45 (5): a defeated Overseer", () => {
  const sugarManFirst = (): CampaignLog =>
    newLog(
      STANDARD,
      seedWhere("scenario 1 draws Sugar Man", (seed) => overseerOf(compose(newLog(STANDARD, seed)).log) === SUGAR_MAN),
    );

  it("Sugar Man defeated in a won scenario 1: he is struck, and scenarios 2 to 5 never draw him", () => {
    let seeds = 0;
    for (let seed = 1; seed <= 200 && seeds < 12; seed++) {
      if (overseerOf(compose(newLog(STANDARD, seed)).log) !== SUGAR_MAN) continue;
      seeds++;
      let log = playNode(newLog(STANDARD, seed), { overseerDefeated: true }).log;
      expect(struckOf(log, "overseers")).toEqual([SUGAR_MAN]);
      for (let n = 2; n <= 5; n++) {
        const played = playNode(log, { missionDefeated: true });
        expect(overseerOf(played.composed.log), `seed ${seed}, scenario ${n}`).not.toBe(SUGAR_MAN);
        expect(OVERSEER_NAMES).toContain(overseerOf(played.composed.log));
        log = played.log;
      }
    }
    expect(seeds).toBe(12);
  });

  it("not defeated in a won scenario 1: he is not struck and stays available", () => {
    const log = playNode(sugarManFirst(), { overseerDefeated: false }).log;
    expect(struckOf(log, "overseers")).toEqual([]);
  });

  it("defeated in a lost scenario 1: nothing is struck, and the retry has all five Overseers and all four missions", () => {
    const first = compose(sugarManFirst());
    const lost = apply(first.log, resultOf(first.log, { won: false, overseerDefeated: true, missionDefeated: true }));
    expect(struckOf(lost.log, "overseers")).toEqual([]);
    expect(struckOf(lost.log, "missions")).toEqual([]);
    expect(results(lost.log)).toEqual(Object.fromEntries(MISSION_NAMES.map((name) => [name, undefined])));
    expect(lost.log.position.nextNodeId).toBe("unus");
    // What a retry can draw: over the seeds whose first attempt had Sugar Man, every Overseer (he among them) and
    // every mission turns up.
    const overseers = new Set<string>();
    const missions = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      const attempt = compose(newLog(STANDARD, seed));
      if (overseerOf(attempt.log) !== SUGAR_MAN) continue;
      const retry = compose(apply(attempt.log, resultOf(attempt.log, { won: false })).log);
      overseers.add(overseerOf(retry.log));
      missions.add(missionOf(retry.log));
    }
    expect([...overseers].sort()).toEqual([...OVERSEER_NAMES].sort());
    expect([...missions].sort()).toEqual([...MISSION_NAMES].sort());
  });
});

describe("AOA campaign §3.45 (6): scenario 5 and Protect the Professor", () => {
  function toFifth(seed = 4242): CampaignLog {
    let log = newLog(STANDARD, seed);
    for (let n = 0; n < 4; n++) log = playNode(log, { missionDefeated: true }, { after: rewardFirst }).log;
    return log;
  }

  it("won with Protect the Professor defeated: the campaign is won", () => {
    const fifth = compose(toFifth());
    expect(fifth.start.nodeId).toBe("en-sabah-nur");
    expect(missionOf(fifth.log)).toBe(PROTECT);
    expect(fifth.start.input.setAsideCards).toContain("45170a");
    const done = apply(fifth.log, resultOf(fifth.log, { missionDefeated: true })).log;
    expect(done.status).toBe("won");
    expect(done.position.nextNodeId).toBeNull();
    expect(done.position.resolved["en-sabah-nur"]).toBe("completed");
  });

  it("won with it still on its a face: the campaign is lost (MC45 p. 20)", () => {
    const fifth = compose(toFifth());
    const done = apply(fifth.log, resultOf(fifth.log, { missionDefeated: false })).log;
    expect(done.status).toBe("lost");
    expect(done.position.nextNodeId).toBeNull();
    expect(done.history.at(-1)).toMatchObject({ nodeId: "en-sabah-nur", outcome: "won" });
    const ran = done.history.at(-1)!.steps.filter((step) => step.instructionId.startsWith("mc45.s5.victory"));
    expect(ran.map((step) => [step.instructionId, step.skipped])).toEqual([
      ["mc45.s5.victory.record", undefined],
      ["mc45.s5.victory.saved", "condition"],
      ["mc45.s5.victory.failed", undefined],
    ]);
  });

  it("lost because the mission failed (the game is lost): the node is retried, the same mission and a new Overseer draw", () => {
    const fifth = compose(toFifth());
    const lost = apply(fifth.log, resultOf(fifth.log, { won: false })).log;
    expect(lost.status).toBe("active");
    expect(lost.position.nextNodeId).toBe("en-sabah-nur");
    const retry = compose(lost);
    expect(missionOf(retry.log)).toBe(PROTECT);
    expect(drawOf(retry.log, "mc45.setup.overseer")).toMatchObject({ random: true, attempt: 2 });
    expect(apply(retry.log, resultOf(retry.log, { missionDefeated: true })).log.status).toBe("won");
  });

  it("an expert campaign is not lost by losing scenario 5 either: the box prints no such sentence", () => {
    let log = newLog(EXPERT, 4242);
    for (let n = 0; n < 4; n++) log = playNode(log, { hp: { 1: 12, 2: 10 } }).log;
    const fifth = compose(log);
    const lost = apply(fifth.log, resultOf(fifth.log, { won: false })).log;
    expect(lost.status).toBe("active");
    expect(lost.position.nextNodeId).toBe("en-sabah-nur");
  });
});

describe("AOA campaign §3.45 (7): the expert campaign", () => {
  const isHeal = (state: GameState): boolean =>
    state.pendingChoice?.prompt.kind === "chooseOption" &&
    state.pendingChoice.options.some((option) => option.label.startsWith("Heal to full"));
  const healPick =
    (accept: boolean): Picker =>
    (state) => {
      if (!isHeal(state)) return firstLegal(state);
      const wanted = state.pendingChoice!.options.find((option) =>
        accept ? option.label.startsWith("Heal to full") : option.label === "Decline",
      );
      return [wanted!.optionId];
    };
  const hpOf = (state: GameState, seat: number): number =>
    remainingHitPoints(state, state.players[seat]!.identity.instanceId, WAVE8_DEPS) ?? Number.NaN;
  const missionThreat = (state: GameState): number => {
    const [mission] = state.scenarioPlayAreas?.mission?.cards ?? [];
    return state.instances[mission as InstanceId]!.threat;
  };
  /** One answer to the open choice. */
  const step = (state: GameState, pick: Picker): GameState => {
    const choice = state.pendingChoice!;
    return settled(state, (s) => s.pendingChoice?.choiceId !== choice.choiceId, pick);
  };

  it("hit points are recorded after a win, capped by the record itself, and not in a standard campaign", () => {
    const expert = playNode(newLog(EXPERT), { hp: { 1: 4, 2: 10 } }).log;
    expect(expert.seats.map((seat) => seat.fields.remainingHp)).toEqual([
      { kind: "number", value: 4 },
      { kind: "number", value: 10 },
    ]);
    const standard = playNode(newLog(STANDARD), { hp: { 1: 4, 2: 10 } });
    expect(standard.log.seats.map((seat) => seat.fields.remainingHp)).toEqual([undefined, undefined]);
    expect(stepOf(standard.composed.log, "mc45.setup.ally-search.expert")?.skipped).toBe("modes");
    expect(standard.log.history[0]!.steps.find((s) => s.instructionId === "mc45.s1.victory.hp")?.skipped).toBe("modes");
  });

  it("a seat recorded at 4 of 12 starts scenario 2 at 4 hit points; paying, it is at 12 and the mission at 10 + 3 = 13", () => {
    const first = playNode(newLog(EXPERT), { hp: { 1: 4, 2: 10 } }).log;
    const second = compose(first);
    expect(second.start.input.instructions.map((instruction) => instruction.instructionId).slice(-3)).toEqual([
      "mc45.setup.ally-search.expert",
      "mc45.s2.setup.hp-set",
      "mc45.s2.setup.heal",
    ]);
    // Seat 1 (Captain Marvel, 12 hit points) is asked first, at the hit points the log recorded.
    const asked = settled(build(second.log).state, isHeal);
    expect(asked.pendingChoice!.playerId).toBe(asked.players[0]!.playerId);
    expect(asked.pendingChoice!.options.map((option) => option.label)).toEqual(["Heal to full · +3 threat", "Decline"]);
    expect([hpOf(asked, 0), hpOf(asked, 1)]).toEqual([4, 10]);
    expect(missionThreat(asked)).toBe(10);
    // Paying: full hit points, and three threat on the mission. Seat 2, recorded at its full 10, is asked next.
    const paid = step(asked, healPick(true));
    expect(hpOf(paid, 0)).toBe(12);
    expect(missionThreat(paid)).toBe(13);
    expect(isHeal(paid)).toBe(true);
    expect(paid.pendingChoice!.playerId).toBe(paid.players[1]!.playerId);
    const declined = step(paid, healPick(false));
    expect([hpOf(declined, 0), hpOf(declined, 1)]).toEqual([12, 10]);
    expect(missionThreat(declined)).toBe(13);
  });

  it("declining keeps the recorded hit points and places no threat; two players paying is 10 + 3 + 3 = 16", () => {
    const first = playNode(newLog(EXPERT), { hp: { 1: 4, 2: 7 } }).log;
    const asked = settled(build(compose(first).log).state, isHeal);
    const neither = step(step(asked, healPick(false)), healPick(false));
    expect([hpOf(neither, 0), hpOf(neither, 1), missionThreat(neither)]).toEqual([4, 7, 10]);
    const both = step(step(asked, healPick(true)), healPick(true));
    expect([hpOf(both, 0), hpOf(both, 1), missionThreat(both)]).toEqual([12, 10, 16]);
  });

  it("a seat eliminated in a won scenario 1 made no pick in its Defeated cell, has no record, and must pay", () => {
    // Scenario 1's mission must be one whose Defeated cell asks each player: Find Lost Mutants.
    const first = compose(logDrawing(FIND, EXPERT));
    const done = apply(
      first.log,
      resultOf(first.log, { missionDefeated: true, hp: { 1: 4 }, sittingOut: [2] }),
      rewardFirst,
    );
    expect(done.asked.map((choice) => [choice.slot, choice.seatNumber])).toEqual([["reward", 1]]);
    expect(done.log.seats.map((seat) => seat.grants.length)).toEqual([1, 0]);
    expect(done.log.seats.map((seat) => seat.fields.remainingHp)).toEqual([{ kind: "number", value: 4 }, undefined]);
    // The shared strike and the result belong to the team and still happen.
    expect(struckOf(done.log, "missions")).toEqual([FIND]);
    expect(optionOf(done.log, "resultFind")).toBe(AOA_DEFEATED);

    // Scenario 2: seat 1 is offered the heal and declines; seat 2 is not asked, pays 3 threat and is at full.
    const asked = settled(build(compose(done.log).log).state, isHeal);
    expect(asked.pendingChoice!.playerId).toBe(asked.players[0]!.playerId);
    expect(missionThreat(asked)).toBe(10);
    const after = step(asked, healPick(false));
    expect(isHeal(after)).toBe(false);
    expect([hpOf(after, 0), hpOf(after, 1)]).toEqual([4, 10]);
    expect(missionThreat(after)).toBe(13);
  });

  it("the ally search offers only an ally that shares a trait with the player's hero; a deck with none finds nothing", () => {
    const heroTraits = (state: GameState, seat: number): readonly string[] => {
      const identity = state.cardPool[state.players[seat]!.identity.cardId];
      return identity?.type === "hero_identity" ? identity.hero.traits : [];
    };
    const offeredAt = (state: GameState): readonly InstanceId[] =>
      state.pendingChoice!.options.map((option) => option.optionId as InstanceId);
    const alliesInDeck = (state: GameState, seat: number): readonly InstanceId[] =>
      state.players[seat]!.deck.filter((id) => typeOf(state, id) === "ally");
    const shares = (state: GameState, seat: number, id: InstanceId): boolean =>
      traitsOf(state, id, WAVE8_DEPS).some((trait) => heroTraits(state, seat).includes(trait));

    // Standard: every ally of the deck is offered, whatever its traits.
    const standard = settled(build(compose(newLog(STANDARD)).log).state, atAllySearch);
    expect([...offeredAt(standard)].sort()).toEqual([...alliesInDeck(standard, 0)].sort());
    expect(alliesInDeck(standard, 0).some((id) => !shares(standard, 0, id))).toBe(true);

    // Expert: the identity is on its alter-ego side, and only the allies sharing a trait with the hero side are offered.
    const expert = settled(build(compose(newLog(EXPERT)).log).state, atAllySearch);
    expect(expert.players[0]!.identity.form).toBe("alterEgo");
    const offered = offeredAt(expert);
    expect(expert.pendingChoice!.playerId).toBe(expert.players[0]!.playerId);
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.length).toBeLessThan(alliesInDeck(expert, 0).length);
    expect([...offered].sort()).toEqual(
      alliesInDeck(expert, 0)
        .filter((id) => shares(expert, 0, id))
        .sort(),
    );
    // Seat 2's turn: asked only if its deck holds such an ally; either way the starting hands come out at hand size.
    const next = step(expert, firstLegal);
    const seatTwoHas = alliesInDeck(expert, 1).some((id) => shares(expert, 1, id));
    expect(atAllySearch(next) && next.pendingChoice!.playerId === next.players[1]!.playerId).toBe(seatTwoHas);
    const begun = firstTurn(next);
    expect(begun.players.map((player) => player.hand.length)).toEqual([6, 6]);
  });
});

describe("AOA campaign §3.45 (8): a retried scenario draws again (§4.1 Q22 = B)", () => {
  const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);

  interface Attempt {
    readonly mission: string;
    readonly overseer: string;
    readonly seed: number;
  }
  const attemptOf = (log: CampaignLog): Attempt => ({
    mission: missionOf(log),
    overseer: overseerOf(log),
    seed: log.attempt!.input.seed,
  });
  /** Scenario 1 lost `losses` times: every attempt's draw, the last one still open. */
  function play(definition: CampaignDefinition, seed: number, losses: number) {
    let composed = compose(newLog(STANDARD, seed, SEATS, definition), declineAll, definition).log;
    const attempts = [attemptOf(composed)];
    for (let i = 0; i < losses; i++) {
      const lost = apply(composed, resultOf(composed, { won: false }), declineAll, definition).log;
      composed = compose(lost, declineAll, definition).log;
      attempts.push(attemptOf(composed));
    }
    return { log: composed, attempts };
  }
  /** The same definition with `perAttempt` taken off both draws: the runner's behavior before the flag. */
  const REPEATING: CampaignDefinition = JSON.parse(
    JSON.stringify(DEF, (key, value: unknown) => (key === "perAttempt" ? undefined : value)),
  ) as CampaignDefinition;

  it("200 seeds, scenario 1 lost once: every retry draws 1 of the 4 unstruck missions and 1 of the 5 Overseers", () => {
    for (const seed of SEEDS) {
      const { log, attempts } = play(DEF, seed, 1);
      expect(MISSION_NAMES).toContain(attempts[1]!.mission);
      expect(OVERSEER_NAMES).toContain(attempts[1]!.overseer);
      expect(struckOf(log, "missions")).toEqual([]);
      expect(struckOf(log, "overseers")).toEqual([]);
      expect(drawOf(log, "mc45.setup.mission")).toMatchObject({ random: true, attempt: 2 });
      expect(drawOf(log, "mc45.setup.overseer")).toMatchObject({ random: true, attempt: 2 });
    }
  });

  it("a fresh draw, not one that excludes the last: some retries have a different mission and some the same", () => {
    const runs = SEEDS.map((seed) => play(DEF, seed, 1).attempts);
    const sameMission = runs.filter(([first, retry]) => first!.mission === retry!.mission).length;
    const sameOverseer = runs.filter(([first, retry]) => first!.overseer === retry!.overseer).length;
    expect(sameMission).toBeGreaterThan(0);
    expect(sameMission).toBeLessThan(SEEDS.length);
    expect(sameOverseer).toBeGreaterThan(0);
    expect(sameOverseer).toBeLessThan(SEEDS.length);
    expect(new Set(runs.map(([, retry]) => retry!.mission))).toEqual(new Set(MISSION_NAMES));
    expect(new Set(runs.map(([, retry]) => retry!.overseer))).toEqual(new Set(OVERSEER_NAMES));
  });

  it("the retry's game is set up for its own draw: the cards set aside are the new mission's and the new Overseer's", () => {
    const seed = seedWhere("the retry draws another mission and another Overseer", (candidate) => {
      const [first, retry] = play(DEF, candidate, 1).attempts;
      return first!.mission !== retry!.mission && first!.overseer !== retry!.overseer;
    });
    const { log, attempts } = play(DEF, seed, 1);
    const mission = AOA_MISSIONS.find((row) => row.name === attempts[1]!.mission)!;
    const overseer = AOA_OVERSEERS.find((entry) => entry.name === attempts[1]!.overseer)!;
    const firstMissionCard = AOA_MISSIONS.find((row) => row.name === attempts[0]!.mission)!.cardId;
    const setAside = log.attempt!.input.setAsideCards ?? [];
    expect(setAside).toContain(mission.cardId);
    expect(setAside).toContain(overseer.cardId);
    expect(setAside).not.toContain(firstMissionCard);
    const state = firstTurn(build(log).state);
    expect((state.scenarioPlayAreas?.mission?.cards ?? []).map((id) => codeOf(state, id))).toEqual([
      mission.cardId,
      overseer.cardId,
    ]);
  });

  it("replaying each log reproduces both attempts' draws and both game seeds; a second loss draws a third time", () => {
    let thirdDiffers = 0;
    for (const seed of SEEDS) {
      const once = play(DEF, seed, 2);
      const again = play(DEF, seed, 2);
      expect(again.attempts).toEqual(once.attempts);
      expect(again.log).toEqual(once.log);
      expect(new Set(once.attempts.map((attempt) => attempt.seed)).size).toBe(3);
      expect(drawOf(once.log, "mc45.setup.mission")?.attempt).toBe(3);
      if (once.attempts[2]!.mission !== once.attempts[1]!.mission) thirdDiffers++;
      // The history holds each earlier attempt's draw and its game seed: read back from the log alone.
      expect(
        once.log.history.map((entry) => [
          entry.steps.find((s) => s.instructionId === "mc45.setup.mission")?.choices[0]?.picked[0],
          entry.steps.find((s) => s.instructionId === "mc45.setup.overseer")?.choices[0]?.picked[0],
          entry.seed,
        ]),
      ).toEqual(once.attempts.slice(0, 2).map((attempt) => [attempt.mission, attempt.overseer, attempt.seed]));
    }
    expect(thirdDiffers).toBeGreaterThan(0);
    expect(thirdDiffers).toBeLessThan(SEEDS.length);
  });

  it("with perAttempt off (a fixture definition): all 200 retries repeat the first draw, and first attempts agree", () => {
    for (const seed of SEEDS) {
      const [first, retry] = play(REPEATING, seed, 1).attempts;
      expect(retry!.mission).toBe(first!.mission);
      expect(retry!.overseer).toBe(first!.overseer);
      // A node's first attempt is the plain draw, so the flag changes nothing until a scenario is replayed.
      expect(play(DEF, seed, 0).attempts[0]).toEqual(first);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// §3.45 "To verify"
// ---------------------------------------------------------------------------------------------------------------

describe("AOA campaign §3.45: to verify", () => {
  it("a later setup instruction's `when` reads the field an earlier instruction of the same list wrote", () => {
    for (const row of AOA_MISSIONS) {
      const composed = compose(logDrawing(row.name)).log;
      expect(stepOf(composed, "mc45.setup.mission")?.writes).toEqual([
        {
          field: "currentMission",
          seatNumber: null,
          mode: "set",
          value: { kind: "choice", option: row.name },
        },
      ]);
      // Only the drawn mission's Setup cell resolved; the other three are traced as skipped by their condition.
      const cells = { liberate: LIBERATE, evacuate: EVACUATE, sabotage: SABOTAGE, find: FIND };
      for (const [id, name] of Object.entries(cells)) {
        expect(stepOf(composed, `mc45.setup.${id}`)?.skipped, `${row.name}: ${id}`).toBe(
          name === row.name ? undefined : "condition",
        );
      }
    }
  });

  it("`setAsideCards` copies Panicked Refugees by seat count: 1, 2 and 3 players", () => {
    const three = [...SEATS, seatFor("core-she-hulk-aggression", 3)];
    for (const seats of [SEATS.slice(0, 1), SEATS, three]) {
      const seed = seedWhere(
        "scenario 1 draws Evacuate Survivors",
        (candidate) => missionOf(compose(newLog(STANDARD, candidate, seats)).log) === EVACUATE,
      );
      const first = compose(newLog(STANDARD, seed, seats));
      expect(countIn(first.start.input.setAsideCards ?? [], PANICKED_REFUGEES)).toBe(seats.length);
      const state = settled(build(first.log).state, atAllySearch);
      expect(seats.map((_, seat) => inDeck(state, seat, PANICKED_REFUGEES))).toEqual(seats.map(() => 1));
      expect(anywhere(state, PANICKED_REFUGEES)).toHaveLength(seats.length);
    }
  });

  it("Sabotage the Sea Wall: its Setup cell, and the carried row after a win with it not defeated, shuffle the Sea Wall into the encounter deck", () => {
    const inEncounterDeck = (state: GameState): number =>
      Object.values(state.encounterDecks).reduce(
        (total, piles) => total + piles.deck.filter((id) => codeOf(state, id) === SEA_WALL).length,
        0,
      );
    const first = compose(logDrawing(SABOTAGE));
    const state = settled(build(first.log).state, atAllySearch);
    expect(inEncounterDeck(state)).toBe(1);
    expect(anywhere(state, SEA_WALL)).toHaveLength(1);

    const notDefeated = apply(first.log, resultOf(first.log, { missionDefeated: false })).log;
    expect(optionOf(notDefeated, "resultSabotage")).toBe(AOA_NOT_DEFEATED);
    const second = settled(build(compose(notDefeated).log).state, atAllySearch);
    expect(inEncounterDeck(second)).toBe(1);

    const defeated = apply(first.log, resultOf(first.log, { missionDefeated: true }), rewardFirst);
    expect(removedIds(defeated.log)).toContain(SEA_WALL);
    for (const choice of defeated.asked) {
      for (const id of choice.options) expect(cardOf(id)?.type, id).toBe("support");
    }
    expect(defeated.log.seats.map((seat) => cardOf(seat.grants[0]!.cardId)?.type)).toEqual(["support", "support"]);
    expect(anywhere(settled(build(compose(defeated.log).log).state, atAllySearch), SEA_WALL)).toEqual([]);
  });

  it("scenario 3: the campaign's set-aside Overseer exists before the scenario's own setup, so its Prelate is removed from the game and four are left", () => {
    // Two campaigns reaching scenario 3 with different Overseers drawn for it.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60 && seen.size < 2; seed++) {
      let log = newLog(STANDARD, seed);
      for (let n = 0; n < 2; n++) log = playNode(log).log;
      const third = compose(log);
      const overseer = AOA_OVERSEERS.find((entry) => entry.name === overseerOf(third.log))!;
      if (seen.has(overseer.name)) continue;
      seen.add(overseer.name);
      expect(third.start.nodeId).toBe("apocalypse");
      expect(third.start.input.instructions[0]).toMatchObject({
        instructionId: "mc45.s3.setup.prelate",
        window: "beforeScenarioSetup",
      });
      const prelate = overseer.cardId.replace("a", "b");
      const state = firstTurn(build(third.log).state);
      const removed = state.removedFromGame.map((id) => codeOf(state, id));
      expect(removed, overseer.name).toEqual([prelate]);
      // Four Prelates are in the game: the scenario revealed one and three are still set aside.
      const others = PRELATES.filter((code) => code !== prelate);
      expect(setAsideCodes(state).filter((code) => PRELATES.includes(code))).toHaveLength(3);
      for (const code of others) expect(anywhere(state, code), code).toHaveLength(1);
      // The Overseer itself is in the mission area, on its Overseer face.
      expect((state.scenarioPlayAreas?.mission?.cards ?? []).map((id) => codeOf(state, id))).toContain(overseer.cardId);
    }
    expect(seen.size).toBe(2);
  });

  it("scenario 3 with an Overseer struck from the log: its Prelate is in the game (ruling April 30, 2026, Ruling 4 (2))", () => {
    const log1 = newLog(STANDARD, 4242);
    const first = playNode(log1, { overseerDefeated: true });
    const struck = AOA_OVERSEERS.find((entry) => entry.name === overseerOf(first.composed.log))!;
    const third = compose(playNode(first.log).log);
    expect(struckOf(third.log, "overseers")).toEqual([struck.name]);
    expect(overseerOf(third.log)).not.toBe(struck.name);
    const state = firstTurn(build(third.log).state);
    expect(anywhere(state, struck.cardId.replace("a", "b"))).toHaveLength(1);
    expect(state.removedFromGame.map((id) => codeOf(state, id))).not.toContain(struck.cardId.replace("a", "b"));
  });

  it("the rewards and the deck-size rule: counted toward both limits, read through `grantDeckSizesOf`", () => {
    const first = compose(logDrawing(FIND));
    const done = apply(first.log, resultOf(first.log, { missionDefeated: true }), rewardFirst).log;
    const seat = done.seats[0]!;
    const rules = grantDeckSizesOf(seat.grants);
    expect(rules).toEqual([{ cardId: "45172", deckSize: "counted" }]);
    const context = (grantDeckSizes: typeof rules | undefined) => ({
      campaign: {
        campaignId: DEF.campaignId as string,
        campaignSetIds: AOA_CAMPAIGN.campaignSetIds.map((id) => id as string),
        identityCardId: seat.identityCardId as string,
        grantedCardIds: seat.grants.map((grant) => grant.cardId as string),
        ...(grantDeckSizes ? { grantDeckSizes } : {}),
      },
    });
    const problemsOf = (deck: typeof seat.deck, grantDeckSizes: typeof rules | undefined): readonly string[] => {
      const verdict = validateDeck(deck, DEPS.pool, context(grantDeckSizes));
      return verdict.ok ? [] : verdict.problems.map((problem) => problem.code);
    };
    // The Core precon is 40 cards: with the ally it is 41 and legal.
    expect(problemsOf(seat.deck, rules)).toEqual([]);
    // One ordinary card short: 39 + the reward is 40 and legal (the follow-up to Q25); exempt, it would be 39.
    const ofAspect = (id: string, aspect: string): boolean => {
      const found = cardOf(id);
      return found !== undefined && "aspect" in found && found.aspect === aspect;
    };
    const line = seat.deck.cards.find((entry) => ofAspect(entry.cardId, "leadership") && entry.quantity > 1)!;
    const short = {
      ...seat.deck,
      cards: seat.deck.cards.map((entry) => (entry === line ? { ...entry, quantity: entry.quantity - 1 } : entry)),
    };
    expect(problemsOf(short, rules)).toEqual([]);
    expect(problemsOf(short, undefined)).toContain("deck_size");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Whole campaigns
// ---------------------------------------------------------------------------------------------------------------

describe("AOA campaign: a whole standard campaign on one seed", () => {
  const asWin = (state: GameState): GameState => ({
    ...state,
    players: state.players.map((player) => ({ ...player, eliminated: false })),
    outcome: { result: "win", reason: "villainDefeated" },
  });
  const missionArea = (state: GameState): readonly string[] =>
    (state.scenarioPlayAreas?.mission?.cards ?? []).map((id) => codeOf(state, id));

  /**
   * Plays scenarios 1 to 4 on seed 4242, each a real game set up and settled to the first player phase, then finished
   * by a stand-in result with the mission defeated and the Overseer not.
   */
  function fourScenarios() {
    let log = newLog(STANDARD, 4242);
    const seen: { node: string; mission: string; overseer: string }[] = [];
    for (let n = 1; n <= 4; n++) {
      const composed = compose(log, (choice) =>
        choice.slot === "desperateMeasures" ? [DESPERATE_MEASURES] : declineAll(choice),
      );
      const mission = AOA_MISSIONS.find((row) => row.name === missionOf(composed.log))!;
      const overseer = AOA_OVERSEERS.find((entry) => entry.name === overseerOf(composed.log))!;
      seen.push({ node: composed.start.nodeId, mission: mission.name, overseer: overseer.name });

      const state = firstTurn(build(composed.log).state);
      expect(state.outcome, composed.start.nodeId).toBeNull();
      expect(missionArea(state), composed.start.nodeId).toEqual([mission.cardId, overseer.cardId]);
      // The mission starts at 5 threat for each player, the Overseer undamaged and engaged with nobody.
      const [missionId, overseerId] = state.scenarioPlayAreas!.mission!.cards as [InstanceId, InstanceId];
      expect(state.instances[missionId]!.threat).toBe(10);
      expect(state.instances[overseerId]).toMatchObject({ damage: 0, engagedWith: null });
      // Mission Team is the first player's, ready.
      const first = state.players.find((player) => player.playerId === state.firstPlayerId)!;
      expect(first.playArea.map((id) => codeOf(state, id))).toContain(MISSION_TEAM);
      expect(state.instances[anywhere(state, MISSION_TEAM)[0]!]).toMatchObject({ exhausted: false });
      // The ally search counted toward the starting hands: each player holds their hand size, not one more.
      expect(state.players.map((player) => player.hand.length)).toEqual([6, 6]);
      // The Mission Rules are the game's scenario rules; "Professor X cannot enter play" is not, before scenario 5.
      expect(state.scenarioRules.rules).toEqual(expect.arrayContaining([...MISSION_RULES]));
      expect(state.scenarioRules.rules).not.toContainEqual(PROFESSOR_X_CANNOT_ENTER_PLAY);
      // The Age of Apocalypse set is in the game: two Agents of Apocalypse and two Worldwide Crises.
      expect([anywhere(state, "45164").length, anywhere(state, "45165").length]).toEqual([2, 2]);

      log = apply(composed.log, resultOf(composed.log, { missionDefeated: true }), rewardFirst).log;
    }
    return { log, seen };
  }

  /** Scenario 5 as a real game at its first player phase, with the events of its setup. */
  function fifthGame(log: CampaignLog) {
    const composed = compose(log, (choice) =>
      choice.slot === "desperateMeasures" ? [DESPERATE_MEASURES] : declineAll(choice),
    );
    const built = build(composed.log);
    const state = firstTurn(built.state);
    return { composed, state, events: built.events };
  }

  it("five scenarios to a win: every mission played once, every Defeated cell resolved, Protect the Professor defeated", () => {
    const { log, seen } = fourScenarios();
    expect(seen.map((entry) => entry.node)).toEqual(NODES.slice(0, 4));
    expect(seen.map((entry) => entry.mission).sort()).toEqual([...MISSION_NAMES].sort());
    expect(struckOf(log, "missions")).toEqual(seen.map((entry) => entry.mission));
    expect(struckOf(log, "overseers")).toEqual([]);
    expect(results(log)).toEqual(Object.fromEntries(MISSION_NAMES.map((name) => [name, AOA_DEFEATED])));
    // Each seat holds an upgrade (Evacuate), a support (Sabotage) and a campaign ally (Find), all for the campaign.
    for (const seat of log.seats) {
      expect(seat.grants.map((grant) => cardOf(grant.cardId)?.type).sort()).toEqual(["ally", "support", "upgrade"]);
      for (const grant of seat.grants) expect(grant).toMatchObject({ permanence: "campaign", deckSize: "counted" });
    }
    expect([...removedIds(log)].sort()).toEqual([SEA_WALL, PANICKED_REFUGEES]);

    const { composed, state, events } = fifthGame(log);
    expect(composed.start.nodeId).toBe("en-sabah-nur");
    expect(missionArea(state)[0]).toBe("45170a");
    expect(state.scenarioRules.rules).toEqual(
      expect.arrayContaining([...MISSION_RULES, PROFESSOR_X_CANNOT_ENTER_PLAY]),
    );
    // Liberate was defeated, and both players took their copy of Desperate Measures for this game.
    expect(anywhere(state, DESPERATE_MEASURES)).toHaveLength(2);
    for (const id of anywhere(state, DESPERATE_MEASURES)) expect(state.instances[id]!.ownerId).not.toBeNull();

    // The result is derived from the real game. Two substitutions: the outcome is set to a win, and the mission's
    // defeat is the event a defeated mission emits (`mission-outcomes.test.ts` proves the card emits it).
    const [missionId] = state.scenarioPlayAreas!.mission!.cards as [InstanceId];
    const defeat: GameEvent = { type: "schemeDefeated", instanceId: missionId, cardId: cardId("45170a") };
    const result = campaignResultOf(DEF, composed.log, asWin(state), [...events, defeat], WAVE8_DEPS);
    expect(result.outcome).toBe("won");
    expect(result.records).toEqual([
      {
        instructionId: "mc45.s5.victory.record",
        write: { field: "missionDefeated", seatNumber: null, mode: "set", value: { kind: "flag", value: true } },
      },
    ]);
    const done = apply(composed.log, result).log;
    expect(done.status).toBe("won");
    expect(done.history.map((entry) => [entry.nodeId, entry.outcome])).toEqual(NODES.map((id) => [id, "won"]));
    expect(JSON.parse(JSON.stringify(done))).toEqual(done);
  });

  it("the same campaign, scenario 5 won with Protect the Professor still on its a face: the campaign is lost", () => {
    const { log } = fourScenarios();
    const { composed, state, events } = fifthGame(log);
    // Derived from the real game with only the outcome set to a win: no defeat event exists, so "was not defeated".
    const result = campaignResultOf(DEF, composed.log, asWin(state), events, WAVE8_DEPS);
    expect(result.records.map((record) => record.write.value)).toEqual([{ kind: "flag", value: false }]);
    const done = apply(composed.log, result).log;
    expect(done.status).toBe("lost");
    expect(done.history.at(-1)).toMatchObject({ nodeId: "en-sabah-nur", outcome: "won" });
  });

  it("the same campaign, scenario 5 lost: the campaign goes on, and the retry is a fresh game of scenario 5", () => {
    const { log } = fourScenarios();
    const { composed, state, events } = fifthGame(log);
    const lostGame: GameState = { ...state, outcome: { result: "loss", reason: "allPlayersDefeated" } };
    const result = campaignResultOf(DEF, composed.log, lostGame, events, WAVE8_DEPS);
    expect(result).toMatchObject({ outcome: "lost", records: [] });
    const lost = apply(composed.log, result).log;
    expect(lost.status).toBe("active");
    expect(lost.position.nextNodeId).toBe("en-sabah-nur");
    // The rewards of scenarios 1 to 4 are kept; this game's Desperate Measures is offered again.
    expect(lost.seats.map((seat) => seat.grants.length)).toEqual([3, 3]);
    const retry = fifthGame(lost);
    expect(retry.composed.asked.map((choice) => choice.slot)).toEqual(["desperateMeasures", "desperateMeasures"]);
    expect(retry.composed.log.attempt!.input.seed).not.toBe(composed.log.attempt!.input.seed);
    expect(retry.state.step.phase).toBe("player");
  });

  it("a real game of scenarios 1 to 4 won on the mission's a face derives 'not defeated' and no Overseer strike", () => {
    const composed = compose(newLog(STANDARD, 4242));
    const built = build(composed.log);
    const state = firstTurn(built.state);
    const result = campaignResultOf(DEF, composed.log, asWin(state), built.events, WAVE8_DEPS);
    expect(result.records.map((record) => [record.instructionId, record.write.value])).toEqual([
      ["mc45.s1.victory.overseer-record", { kind: "flag", value: false }],
      ...AOA_MISSIONS.map((row) => [`mc45.s1.victory.${row.id}.record`, { kind: "flag", value: false }]),
    ]);
    const done = apply(composed.log, result).log;
    const mission = AOA_MISSIONS.find((row) => row.name === missionOf(composed.log))!;
    expect(optionOf(done, mission.resultField)).toBe(AOA_NOT_DEFEATED);
    expect(struckOf(done, "missions")).toEqual([mission.name]);
    expect(struckOf(done, "overseers")).toEqual([]);
    expect(done.position.nextNodeId).toBe("four-horsemen");
  });
});
