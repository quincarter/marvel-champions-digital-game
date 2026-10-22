/**
 * `SHADOWLAND_CAMPAIGN_DEFINITION` (MC65): the definition is well-formed against the real `@mc/content` records, and
 * each
 * node's composition, setup and Victory instructions do what the insert prints (pp. 4 to 6, 9 to 10, 14 to 15, 17, 20),
 * driven through the real runner and real games built from the composed log (`shadowland-testing.ts`). Where a rule
 * needs a
 * finished game, the game is a real one settled through its setup with its outcome overridden to a win (`asWin`, said
 * so)
 * and the facts derived by `campaignResultOf`, with supports and upgrades put into play by state surgery (said so).
 *
 * Covered: the three nodes in order; the identity record and Daredevil's and Elektra's villains removed; the villain
 * draw
 * never offering a removed villain; scenario 1's Setup (Creeping Corruption under every player, the rest aside, Black
 * Flower's
 * other cards shuffled in, +1 threat per hero) and Victory (villain removed, OVERPOWERING, a recorded card); scenario
 * 2's
 * (counters, the recorded card in play, +3 threat per hero); scenario 3's (flags counted, the minions dealt); a loss
 * replayed
 * with no penalty; the expert rules; Black Flower out of the campaign picker; a whole campaign, standard and expert.
 */
import { describe, expect, it, vi } from "vitest";
import {
  PLAYABLE_CARDS,
  SHADOWLAND_CAMPAIGN,
  SHADOWLAND_ENCOUNTER_SETS,
  SHADOWLAND_SCENARIOS,
  WAVE11_ENCOUNTER_SETS,
  cardId,
  type AnyCard,
} from "@mc/content";
import {
  activeEncounterDeck,
  maxHitPoints,
  remainingHitPoints,
  resolveBetweenGames,
  type CampaignInstruction,
  type CampaignLog,
  type CampaignPendingChoice,
  type GameState,
} from "@mc/engine";
import { action } from "../dsl/abilities.js";
import { dealDamage, eachPlayer, forEachPlayer, identityOf, thatPlayer } from "../dsl/index.js";
import { validateDefinition } from "../dsl/validate.js";
import { P1, P2, firstLegal, patchInstance } from "../testing/harness.js";
import { WAVE11_CARDS, WAVE11_DEPS } from "../wave11/index.js";
import { wave11Scenario } from "../wave11/setup.js";
import { campaignModularPickProblem } from "./modular-picks.js";
import { CAMPAIGNS } from "./index.js";
import { SHADOWLAND_CAMPAIGN_DEFINITION, SHADOWLAND_MINIONS, SHADOWLAND_VILLAINS } from "./shadowland.js";
import {
  DAREDEVIL_SEAT,
  EXPERT,
  NODES,
  SEATS,
  SOLO_SEATS,
  STANDARD,
  anywhere,
  DEPS,
  declineAll,
  settleBy,
  asLoss,
  asWin,
  build,
  codeOf,
  compose,
  controlledBy,
  finish,
  inst,
  intoPlay,
  listOf,
  newLog,
  resultOf,
  seatField,
  seatListOf,
  settledStart,
  sharedField,
} from "./shadowland-testing.js";
import { modularPickProblem } from "../modular-pool.js";

vi.setConfig({ testTimeout: 600_000 });

const DEF = SHADOWLAND_CAMPAIGN_DEFINITION;
const [S1, S2, S3] = NODES;
const VILLAIN_IDS = Object.values(SHADOWLAND_VILLAINS);
const CORRUPTION = "corruption";

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

const cardOf = (code: string): AnyCard => PLAYABLE_CARDS.find((card) => (card.id as string) === code)!;

/** Corruption counters on the seat's Creeping Corruption in play (-1 when it has none). */
function counters(state: GameState, seat: number): number {
  const id = [
    ...state.players[seat]!.playArea,
    ...inst(state, state.players[seat]!.identity.instanceId).attachments,
  ].find((candidate) => codeOf(state, candidate).startsWith("65072"));
  return id === undefined ? -1 : (inst(state, id).counters[CORRUPTION] ?? 0);
}

/** A support or upgrade a Core precon holds with a printed cost of at most 2 and a real cost, and one of cost 3 or more. */
function recordableIn(seat: number): { cheap: string; dear: string | undefined } {
  const deck = SEATS[seat]!.deck.cards.map((line) => line.cardId as string);
  const cards = deck.map(cardOf);
  const cheap = cards.find(
    (card) =>
      (card.type === "support" || card.type === "upgrade") &&
      "specialCost" in card === false &&
      "cost" in card &&
      card.cost <= 2,
  );
  const dear = cards.find(
    (card) => (card.type === "support" || card.type === "upgrade") && "cost" in card && card.cost >= 3,
  );
  if (!cheap) throw new Error(`seat ${seat + 1}'s deck holds no cheap support or upgrade`);
  return { cheap: cheap.id as string, dear: dear?.id as string | undefined };
}

/** Two different cheap supports a precon holds (cost 2 or less; supports need no host, unlike Spider-Tracer). */
function cheapIn(seat: number): readonly [string, string] {
  const ids = [
    ...new Set(
      SEATS[seat]!.deck.cards.map((line) => cardOf(line.cardId as string))
        .filter((card) => card.type === "support" && !("specialCost" in card) && "cost" in card && card.cost <= 2)
        .map((card) => card.id as string),
    ),
  ];
  if (ids.length < 2) throw new Error(`seat ${seat + 1}'s deck holds fewer than two cheap supports`);
  return [ids[0]!, ids[1]!];
}

/** Answers the record question for the seats in `who` with `code` (the first offer when the code is not offered). */
const record =
  (who: readonly number[], code?: string) =>
  (choice: CampaignPendingChoice): readonly string[] => {
    if (choice.slot !== "recordedCard" || !who.includes(choice.seatNumber ?? 0)) return [];
    const wanted = code && choice.options.includes(code) ? code : choice.options[0];
    return wanted === undefined ? [] : [wanted];
  };

/** A won game's Victory: the played state as a win, the facts derived from it, applied with `pick`. */
function win(
  composed: CampaignLog,
  state: GameState,
  pick: (choice: CampaignPendingChoice) => readonly string[] = () => [],
): { log: CampaignLog; asked: readonly CampaignPendingChoice[] } {
  return finish(composed, resultOf(composed, asWin(state)), pick);
}

// ---------------------------------------------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------------------------------------------

describe("SHADOWLAND_CAMPAIGN_DEFINITION: structure", () => {
  it("matches the @mc/content campaign record and lists the three scenarios in the insert's order (p. 4)", () => {
    expect(DEF.campaignId).toBe(SHADOWLAND_CAMPAIGN.id);
    expect(DEF.graph.kind).toBe("linear");
    if (DEF.graph.kind !== "linear") return;
    expect(DEF.graph.nodes.map((node) => node.id)).toEqual([...NODES]);
    const known = new Set(SHADOWLAND_SCENARIOS.map((scenario) => scenario.id as string));
    const scenarioIds = DEF.graph.nodes.map((node) => {
      if (node.scenario.kind !== "fixed") throw new Error(`${node.id}: expected a fixed scenario`);
      expect(known.has(node.scenario.scenarioId as string), node.id).toBe(true);
      return node.scenario.scenarioId as string;
    });
    expect(scenarioIds).toEqual(SHADOWLAND_CAMPAIGN.scenarioIds.map((id) => id as string));
  });

  it("is registered in the campaign registry under its own id", () => {
    expect(CAMPAIGNS["shadowland"]).toBe(DEF);
  });

  it("a loss is retried with no penalty: free retry, no defeat instruction anywhere (p. 5)", () => {
    expect(DEF.loss).toEqual({ retry: "free", retryBaseline: "nodeStart", citation: "MC65 pp. 4, 5" });
    if (DEF.graph.kind !== "linear") return;
    for (const node of DEF.graph.nodes) expect(node.defeat, node.id).toBeUndefined();
    expect(DEF.everyNodeSetup).toBeUndefined();
  });

  it("every instruction id is unique, prefixed 'mc65.', and cites 'MC65 p. N'", () => {
    const instructions = allInstructions();
    const ids = instructions.map((instruction) => instruction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const instruction of instructions) {
      expect(instruction.id.startsWith("mc65."), instruction.id).toBe(true);
      expect(instruction.citation, instruction.id).toMatch(/^MC65 p\. \d+$/);
    }
    for (const field of DEF.logFields) expect(field.citation, field.id).toMatch(/^MC65 p\. \d+$/);
  });

  it("every field an instruction reads or writes is declared, and every declared field is used", () => {
    const declared = new Set(DEF.logFields.map((field) => field.id));
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) fieldsIn(instruction.step, referenced);
    for (const instruction of allInstructions()) fieldsIn(instruction.when, referenced);
    // `identity` is written, `remainingHp` is read and written in the expert rules; all are named by an instruction.
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
      [S1]: {
        composition: [
          "mc65.s1.compose.identity",
          "mc65.s1.compose.namesakes",
          `mc65.${S1}.compose.villain`,
          `mc65.${S1}.compose.black-flower`,
        ],
        setup: [`mc65.${S1}.setup.creeping-corruption`, "mc65.s1.setup.threat"],
        victory: [
          "mc65.s1.victory.villain",
          "mc65.s1.victory.overpowering",
          "mc65.s1.victory.candidates",
          "mc65.s1.victory.card",
          "mc65.s1.victory.hp",
        ],
      },
      [S2]: {
        composition: [`mc65.${S2}.compose.villain`, `mc65.${S2}.compose.black-flower`],
        setup: [
          `mc65.${S2}.setup.creeping-corruption`,
          `mc65.${S2}.setup.overpowering`,
          `mc65.${S2}.setup.recorded-cards`,
          "mc65.s2.setup.threat",
          `mc65.${S2}.setup.rejoin`,
          `mc65.${S2}.setup.hp-set`,
          `mc65.${S2}.setup.heal`,
        ],
        victory: [
          "mc65.s2.victory.overpowering",
          "mc65.s2.victory.candidates",
          "mc65.s2.victory.card",
          "mc65.s2.victory.hp",
        ],
      },
      [S3]: {
        composition: ["mc65.s3.compose.minions"],
        setup: [
          `mc65.${S3}.setup.overpowering`,
          `mc65.${S3}.setup.recorded-cards`,
          "mc65.s3.setup.minions",
          `mc65.${S3}.setup.rejoin`,
          `mc65.${S3}.setup.hp-set`,
          `mc65.${S3}.setup.heal`,
        ],
        victory: ["mc65.s3.victory.win"],
      },
    });
  });

  it("declares the log the insert's sheet prints: identity, hit points, two recorded cards, two OVERPOWERING boxes, six villains", () => {
    const byId = new Map(DEF.logFields.map((field) => [field.id, field]));
    expect(byId.get("identity")).toMatchObject({ scope: "perSeat", type: { kind: "cardRef" } });
    expect(byId.get("remainingHp")).toMatchObject({ scope: "perSeat", whenModes: { expertCampaign: true } });
    expect(byId.get("recordedCards")).toMatchObject({ scope: "perSeat", type: { kind: "cardList" } });
    for (const box of ["overpowering1", "overpowering2"])
      expect(byId.get(box), box).toMatchObject({ scope: "perSeat", type: { kind: "flag" } });
    expect(byId.get("removedVillains")).toMatchObject({ scope: "shared", type: { kind: "cardList" } });
    expect(Object.keys(SHADOWLAND_VILLAINS).sort()).toEqual(
      ["Archpriestess", "Daredevil", "Elektra", "Gorgon", "Lady Bullseye", "White Tiger"].sort(),
    );
    for (const [name, id] of Object.entries(SHADOWLAND_VILLAINS)) {
      const card = WAVE11_CARDS.find((candidate) => (candidate.id as string) === id);
      expect(card?.type, name).toBe("villain");
      expect(card?.name, id).toBe(name);
    }
    for (const id of SHADOWLAND_MINIONS)
      expect(WAVE11_CARDS.find((c) => (c.id as string) === id)?.type, id).toBe("minion");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Black Flower and the modular picker (p. 5)
// ---------------------------------------------------------------------------------------------------------------

describe("Black Flower is not a campaign modular pick (p. 5)", () => {
  const sets = [...WAVE11_ENCOUNTER_SETS];
  const scenarios = SHADOWLAND_SCENARIOS;

  it("the campaign record bars it, and nothing else", () => {
    expect(SHADOWLAND_CAMPAIGN.prohibited?.encounterSetIds).toEqual(["black_flower"]);
    expect(SHADOWLAND_ENCOUNTER_SETS.map((set) => set.id as string)).toContain("black_flower");
  });

  it("is refused by the campaign picker at every scenario, and stays a legal pick in a standalone game of the first two", () => {
    for (const scenario of scenarios.slice(0, 2)) {
      expect(modularPickProblem(scenario, "black_flower", sets), `${scenario.id} standalone`).toBeNull();
      expect(campaignModularPickProblem(SHADOWLAND_CAMPAIGN, scenario, "black_flower", sets), scenario.id).toMatch(
        /cannot be a modular set in any scenario while playing the Shadowland campaign/,
      );
      // The other modular sets are still offered: the campaign adds one refusal, it does not take the others away.
      expect(campaignModularPickProblem(SHADOWLAND_CAMPAIGN, scenario, "ninja_swarm", sets), scenario.id).toBeNull();
      expect(campaignModularPickProblem(SHADOWLAND_CAMPAIGN, scenario, "deadly_contraptions", sets) === null).toBe(
        modularPickProblem(scenario, "deadly_contraptions", sets) === null,
      );
    }
    for (const scenario of scenarios)
      expect(
        campaignModularPickProblem(SHADOWLAND_CAMPAIGN, scenario, "black_flower", sets),
        scenario.id,
      ).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Scenario 1: identity, the villain, Setup (pp. 9 to 10)
// ---------------------------------------------------------------------------------------------------------------

describe("scenario 1 composition: the identity is recorded and Daredevil's or Elektra's villain is removed (p. 9)", () => {
  it("records each player's identity (the card, and the printed name the check reads)", () => {
    const { log } = compose(newLog(STANDARD));
    expect(seatField(log, 0, "identity")).toEqual({ kind: "cardRef", cardId: "01001a" });
    expect(seatField(log, 1, "identity")).toEqual({ kind: "cardRef", cardId: "01010a" });
    expect(listOf(log, "removedVillains")).toEqual([]);
  });

  it("a Daredevil identity checks off Daredevil (65013a) and the villain draw can never be him", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const { log, start } = compose(newLog(STANDARD, [DAREDEVIL_SEAT], seed));
      expect(listOf(log, "removedVillains"), `seed ${seed}`).toEqual(["65013a"]);
      expect(
        VILLAIN_IDS.filter((id) => id !== "65013a"),
        `seed ${seed}`,
      ).toContain(start.villain);
      expect(sharedField(log, "villain"), `seed ${seed}`).toEqual({ kind: "cardRef", cardId: start.villain });
    }
  });

  it("an Elektra identity checks off Elektra (65014a), and both together remove both, once however many name them", () => {
    // No Elektra hero is in the pool yet: a stand-in hero named Elektra, sharing Spider-Man's data (the check is by
    // name).
    const spider = PLAYABLE_CARDS.find((card) => (card.id as string) === "01001a")!;
    const elektra = { ...spider, id: cardId("99001a"), name: "Elektra" } as AnyCard;
    const elektraSeat = { ...SEATS[0]!, seatNumber: 2, identityCardId: elektra.id };
    const log = newLog(STANDARD, [DAREDEVIL_SEAT, elektraSeat, { ...DAREDEVIL_SEAT, seatNumber: 3 }], 77);
    const result = compose(log, () => [], { pool: [...WAVE11_CARDS, elektra] });
    expect(listOf(result.log, "removedVillains")).toEqual(["65013a", "65014a"]);
    expect(["65012a", "65015a", "65016a", "65017a"]).toContain(result.start.villain);
  });

  it("the draw offers only the villains not checked off (scenario 1 and scenario 2)", () => {
    const base = newLog(STANDARD);
    for (const node of [S1, S2]) {
      for (const left of VILLAIN_IDS) {
        const removed = VILLAIN_IDS.filter((id) => id !== left);
        let log: CampaignLog = {
          ...base,
          shared: { ...base.shared, removedVillains: { kind: "cardList", cardIds: removed as never } },
          position: { ...base.position, resolved: node === S2 ? { [S1]: "completed" } : {} },
        };
        log = { ...log };
        expect(compose(log).start.villain, `${node} with only ${left} left`).toBe(left);
      }
    }
  });

  it("a replayed scenario draws a new villain (the draw is fresh on each attempt)", () => {
    const base = newLog(STANDARD, SOLO_SEATS, 5);
    const first = compose(base);
    const lost = finish(first.log, { ...resultOf(first.log, asLoss(settledStart(first.log))) });
    const draws = new Set<string | null>([first.start.villain]);
    let log = lost.log;
    for (let attempt = 0; attempt < 12; attempt++) {
      const again = compose(log);
      draws.add(again.start.villain);
      log = finish(again.log, resultOf(again.log, asLoss(settledStart(again.log)))).log;
    }
    expect(draws.size).toBeGreaterThan(1);
  });
});

describe("scenario 1 setup (p. 9)", () => {
  const { log, start } = compose(newLog(STANDARD));

  it("composes the node's game: the villain the draw named, Black Flower's other cards for the deck, four 72A aside", () => {
    expect(start.nodeId).toBe(S1);
    expect(VILLAIN_IDS).toContain(start.villain);
    expect(start.encounterSets.deck).toEqual(["shadowland.black_flower_rest"]);
    expect(start.input.setAsideCards).toEqual(Array.from({ length: 4 }, () => "65072a"));
  });

  it("puts 1 Creeping Corruption (72A) into play under each player, sets the rest aside, shuffles each other Black Flower card in", () => {
    const state = settledStart(log);
    expect(controlledBy(state, 0).filter((code) => code === "65072a")).toHaveLength(1);
    expect(controlledBy(state, 1).filter((code) => code === "65072a")).toHaveLength(1);
    const copies = anywhere(state, "65072a");
    expect(copies).toHaveLength(4);
    const aside = copies.filter((id) => state.encounterSetAside.includes(id));
    expect(aside).toHaveLength(2);
    expect(copies.filter((id) => activeEncounterDeck(state).deck.includes(id))).toHaveLength(0);
    // Each other Black Flower card, once per printed copy (Aka, 65074, two side schemes, two treacheries).
    const deck = activeEncounterDeck(state).deck.map((id) => codeOf(state, id));
    for (const code of ["65073", "65074", "65075", "65076", "65077", "65078"]) expect(deck, code).toContain(code);
    // Corruption starts with no counters.
    expect(counters(state, 0)).toBe(0);
    expect(counters(state, 1)).toBe(0);
  });

  it("places an additional 1[per_hero] threat on the main scheme", () => {
    const state = settledStart(log);
    const alone = build(log, { control: true }).state;
    const base = inst(alone, alone.mainScheme.instanceId).threat;
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(base + 2);
  });

  it("a solo game puts one Creeping Corruption into play and 1 additional threat", () => {
    const solo = compose(newLog(STANDARD, SOLO_SEATS));
    const state = settledStart(solo.log);
    expect(controlledBy(state, 0).filter((code) => code === "65072a")).toHaveLength(1);
    const alone = build(solo.log, { control: true }).state;
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(inst(alone, alone.mainScheme.instanceId).threat + 1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Scenario 1 Victory (pp. 9 to 10)
// ---------------------------------------------------------------------------------------------------------------

describe("scenario 1 Victory (pp. 9 to 10)", () => {
  const first = compose(newLog(STANDARD));
  const played = settledStart(first.log);

  it("checks off the villain used and removes it from the campaign, then the next scenario never draws it", () => {
    const { log } = win(first.log, played);
    expect(listOf(log, "removedVillains")).toEqual([first.start.villain]);
    expect(log.position.resolved[S1]).toBe("completed");
    const second = compose(log);
    expect(second.start.nodeId).toBe(S2);
    expect(second.start.villain).not.toBe(first.start.villain);
    expect(VILLAIN_IDS).toContain(second.start.villain);
  });

  it("records for each player whether their Creeping Corruption has the OVERPOWERING trait", () => {
    // Seat 1's Creeping Corruption flipped (state surgery: the card showing its 72B face), seat 2's not.
    const copy = [
      ...played.players[0]!.playArea,
      ...inst(played, played.players[0]!.identity.instanceId).attachments,
    ].find((id) => codeOf(played, id) === "65072a")!;
    const flipped = patchInstance(played, copy, { flipped: true });
    const { log } = win(first.log, flipped);
    expect(seatField(log, 0, "overpowering1")).toEqual({ kind: "flag", value: true });
    expect(seatField(log, 1, "overpowering1")).toEqual({ kind: "flag", value: false });
    const { log: plain } = win(first.log, played);
    expect(seatField(plain, 0, "overpowering1")).toEqual({ kind: "flag", value: false });
  });

  it("each player may record one support or upgrade they control costing 2 or less, never a card with no cost", () => {
    const { cheap, dear } = recordableIn(0);
    let state = intoPlay(played, P1, cheap);
    if (dear) state = intoPlay(state, P1, dear);
    const result = resultOf(first.log, asWin(state));
    const offered = settle0(first.log, result);
    // The cheap card is offered to seat 1 and the Creeping Corruption (cost "-") never is; nothing is offered to seat
    // 2.
    expect(offered.find((choice) => choice.seatNumber === 1)?.options).toContain(cheap);
    expect(offered.find((choice) => choice.seatNumber === 1)?.options).not.toContain("65072a");
    if (dear) expect(offered.find((choice) => choice.seatNumber === 1)?.options).not.toContain(dear);
    const { log } = finish(first.log, result, record([1], cheap));
    expect(seatListOf(log, 0, "recordedCards")).toEqual([cheap]);
    expect(seatListOf(log, 1, "recordedCards")).toEqual([]);
  });

  it("a player may decline to record anything", () => {
    const { cheap } = recordableIn(0);
    const state = intoPlay(played, P1, cheap);
    const { log } = finish(first.log, resultOf(first.log, asWin(state)), () => []);
    expect(seatListOf(log, 0, "recordedCards")).toEqual([]);
  });

  it("with Creeping Corruption the only upgrade in play, there is nothing to offer", () => {
    const offered = settle0(first.log, resultOf(first.log, asWin(played)));
    expect(offered.filter((choice) => choice.slot === "recordedCard" && choice.options.length > 0)).toEqual([]);
  });
});

/** The record questions a result asks (every option set), answered with nothing. */
function settle0(composed: CampaignLog, result: ReturnType<typeof resultOf>): readonly CampaignPendingChoice[] {
  return finish(composed, result, () => []).asked;
}

// ---------------------------------------------------------------------------------------------------------------
// Scenario 2 (pp. 14 to 15)
// ---------------------------------------------------------------------------------------------------------------

/** A campaign log at scenario 2's start after a won scenario 1, with the given overpowering flags and recorded cards. */
function afterScenarioOne(
  modes = STANDARD,
  seats = SEATS,
  seed = 4242,
  overrides: {
    overpowering?: readonly boolean[];
    recorded?: readonly (readonly string[])[];
    hp?: readonly number[];
  } = {},
): CampaignLog {
  const first = compose(newLog(modes, seats, seed));
  let state = settledStart(first.log);
  const picks: number[] = [];
  seats.forEach((_, index) => {
    const recorded = overrides.recorded?.[index] ?? [];
    for (const code of recorded) state = intoPlay(state, index === 0 ? P1 : P2, code);
    if (recorded.length > 0) picks.push(index + 1);
    if (overrides.overpowering?.[index]) {
      const owner = state.players[index]!;
      const copy = [...owner.playArea, ...inst(state, owner.identity.instanceId).attachments].find(
        (id) => codeOf(state, id) === "65072a",
      )!;
      state = patchInstance(state, copy, { flipped: true });
    }
    if (overrides.hp?.[index] !== undefined) {
      const identity = state.players[index]!.identity.instanceId;
      const max = maxHitPoints(state, identity, WAVE11_DEPS) ?? 0;
      state = patchInstance(state, identity, { damage: max - overrides.hp[index]! });
    }
  });
  return win(first.log, state, record(picks)).log;
}

describe("scenario 2 setup (p. 14)", () => {
  const { cheap } = recordableIn(0);

  it("composes a fresh Creeping Corruption set, a villain not checked off, and no extra instruction without the log", () => {
    const log = afterScenarioOne();
    const second = compose(log);
    expect(second.start.nodeId).toBe(S2);
    expect(second.start.scenarioId).toBe(S2);
    expect(second.start.encounterSets.deck).toEqual(["shadowland.black_flower_rest"]);
    expect(second.start.input.setAsideCards).toEqual(Array.from({ length: 4 }, () => "65072a"));
  });

  it("puts a Creeping Corruption under each player, with no counters when nothing was recorded or OVERPOWERING", () => {
    const state = settledStart(compose(afterScenarioOne()).log);
    expect(counters(state, 0)).toBe(0);
    expect(counters(state, 1)).toBe(0);
  });

  it("each player whose Creeping Corruption had OVERPOWERING in scenario 1 places 1 counter", () => {
    const state = settledStart(compose(afterScenarioOne(STANDARD, SEATS, 4242, { overpowering: [true, false] })).log);
    expect(counters(state, 0)).toBe(1);
    expect(counters(state, 1)).toBe(0);
  });

  it("a player may take their recorded card from their deck into play for 1 more counter, or leave it", () => {
    const log = compose(afterScenarioOne(STANDARD, SEATS, 4242, { recorded: [[cheap], []] })).log;
    expect(seatListOf(log, 0, "recordedCards")).toEqual([cheap]);
    // Taken: the first legal answer of a "choose any number" selection is none, so pick the card.
    const take = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "chooseCards" || choice.options.some((o) => o.label.includes(cardOf(cheap).name)))
        return choice.options
          .filter((o) => o.label.includes(cardOf(cheap).name))
          .slice(0, 1)
          .map((o) => o.optionId);
      return firstLegal(state);
    };
    const taken = settledStart(log, take);
    expect(controlledBy(taken, 0)).toContain(cheap);
    expect(counters(taken, 0)).toBe(1);
    expect(counters(taken, 1)).toBe(0);
    const left = settledStart(log);
    expect(controlledBy(left, 0)).not.toContain(cheap);
    expect(counters(left, 0)).toBe(0);
  });

  it("places an additional 3[per_hero] threat on the main scheme", () => {
    const log = compose(afterScenarioOne()).log;
    const state = settledStart(log);
    const alone = build(log, { control: true }).state;
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(inst(alone, alone.mainScheme.instanceId).threat + 6);
  });

  it("is a Standard campaign: no hit points are set, no heal is offered", () => {
    const log = compose(afterScenarioOne()).log;
    expect(seatField(log, 0, "remainingHp")).toBeUndefined();
    const state = settledStart(log);
    for (const [index, player] of state.players.entries()) {
      const identity = player.identity.instanceId;
      expect(remainingHitPoints(state, identity, WAVE11_DEPS), `seat ${index + 1}`).toBe(
        maxHitPoints(state, identity, WAVE11_DEPS),
      );
    }
  });
});

describe("scenario 2 Victory (p. 15)", () => {
  it("records OVERPOWERING for scenario 2 and a second recorded card; scenario 2's villain is not removed", () => {
    const { cheap } = recordableIn(0);
    const first = afterScenarioOne(STANDARD, SEATS, 4242, { recorded: [[cheap], []] });
    const second = compose(first);
    let state = settledStart(second.log);
    const owner = state.players[1]!;
    const copy = [...owner.playArea, ...inst(state, owner.identity.instanceId).attachments].find(
      (id) => codeOf(state, id) === "65072a",
    )!;
    state = patchInstance(state, copy, { flipped: true });
    const other = recordableIn(1).cheap;
    state = intoPlay(state, P2, other);
    const { log } = win(second.log, state, record([2], other));
    expect(seatField(log, 0, "overpowering2")).toEqual({ kind: "flag", value: false });
    expect(seatField(log, 1, "overpowering2")).toEqual({ kind: "flag", value: true });
    expect(seatListOf(log, 0, "recordedCards")).toEqual([cheap]);
    expect(seatListOf(log, 1, "recordedCards")).toEqual([other]);
    // The villain checked off is scenario 1's alone.
    expect(listOf(log, "removedVillains")).toHaveLength(1);
    expect(log.position.resolved[S2]).toBe("completed");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Scenario 3 (p. 17)
// ---------------------------------------------------------------------------------------------------------------

describe("scenario 3 setup (p. 17)", () => {
  /** A log at scenario 3's start: scenario 1 won, scenario 2 won, with the flags and cards given. */
  function afterScenarioTwo(
    flags: { s1: readonly boolean[]; s2: readonly boolean[] },
    recorded: readonly (readonly string[])[] = [[], []],
    modes = STANDARD,
  ): CampaignLog {
    const one = afterScenarioOne(modes, SEATS, 4242, {
      overpowering: flags.s1,
      recorded: recorded.map((r) => r.slice(0, 1)),
    });
    const two = compose(one);
    let state = settledStart(two.log);
    const picks: number[] = [];
    SEATS.forEach((_, index) => {
      const second = recorded[index]?.[1];
      if (second) {
        state = intoPlay(state, index === 0 ? P1 : P2, second);
        picks.push(index + 1);
      }
      if (flags.s2[index]) {
        const owner = state.players[index]!;
        const copy = [...owner.playArea, ...inst(state, owner.identity.instanceId).attachments].find(
          (id) => codeOf(state, id) === "65072a",
        )!;
        state = patchInstance(state, copy, { flipped: true });
      }
    });
    return win(two.log, state, record(picks, recorded[0]?.[1])).log;
  }

  it("composes the four Dark Protege minions aside and no Creeping Corruption (the stage 1A Setup puts one under each player)", () => {
    const third = compose(afterScenarioTwo({ s1: [false, false], s2: [false, false] }));
    expect(third.start.nodeId).toBe(S3);
    expect(third.start.input.setAsideCards).toEqual(SHADOWLAND_MINIONS);
    expect(third.start.encounterSets.deck).toEqual([]);
    expect(third.start.villain).toBeNull();
  });

  it("deals one of the four minions at random to each player facedown and shuffles the rest into the encounter deck", () => {
    const third = compose(afterScenarioTwo({ s1: [false, false], s2: [false, false] }));
    const state = settledStart(third.log);
    const minions = SHADOWLAND_MINIONS.flatMap((code) => anywhere(state, code));
    expect(minions).toHaveLength(4);
    const deck = activeEncounterDeck(state).deck;
    // Exactly one minion is dealt to each player, and they are two different cards.
    const dealtTo = state.players.map((player) => player.dealtEncounter.filter((id) => minions.includes(id)));
    expect(dealtTo.map((dealt) => dealt.length)).toEqual([1, 1]);
    expect(new Set(dealtTo.flat()).size).toBe(2);
    // The other two are in the encounter deck; none is left set aside.
    const rest = minions.filter((id) => !dealtTo.flat().includes(id));
    expect(rest).toHaveLength(2);
    for (const id of rest) expect(deck).toContain(id);
    expect(minions.filter((id) => state.encounterSetAside.includes(id))).toHaveLength(0);
  });

  it("counts a corruption counter for each earlier scenario the player's Creeping Corruption had OVERPOWERING", () => {
    const cases: readonly [readonly boolean[], readonly boolean[], number, number][] = [
      [[false, false], [false, false], 0, 0],
      [[true, false], [false, true], 1, 1],
      [[true, true], [true, false], 2, 1],
    ];
    for (const [s1, s2, a, b] of cases) {
      const state = settledStart(compose(afterScenarioTwo({ s1, s2 })).log);
      expect([counters(state, 0), counters(state, 1)], JSON.stringify([s1, s2])).toEqual([a, b]);
    }
  });

  it("places no additional threat on the main scheme (none is printed)", () => {
    const log = compose(afterScenarioTwo({ s1: [false, false], s2: [false, false] })).log;
    const state = settledStart(log);
    const alone = build(log, { control: true }).state;
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(inst(alone, alone.mainScheme.instanceId).threat);
  });

  it("a player with two recorded cards may take both (2 counters), one (1) or none (0): a counter for each card put into play", () => {
    const [c1, c2] = cheapIn(0);
    const before = afterScenarioTwo({ s1: [false, false], s2: [false, false] });
    const two: CampaignLog = {
      ...before,
      seats: before.seats.map((seat, index) =>
        index === 0
          ? { ...seat, fields: { ...seat.fields, recordedCards: { kind: "cardList", cardIds: [c1, c2] as never } } }
          : seat,
      ),
    };
    const takes =
      (...codes: string[]) =>
      (state: GameState): readonly string[] => {
        const choice = state.pendingChoice;
        const wanted = choice?.options.filter((o) => codes.some((code) => o.label.includes(cardOf(code).name)));
        return wanted && wanted.length > 0 ? wanted.map((o) => o.optionId) : firstLegal(state);
      };
    // The record is edited before the node is composed: the game reads the log frozen at composition.
    const composed = compose(two).log;
    const both = settledStart(composed, takes(c1, c2));
    expect(controlledBy(both, 0)).toEqual(expect.arrayContaining([c1, c2]));
    expect(counters(both, 0)).toBe(2);
    const one = settledStart(composed, takes(c2));
    expect(controlledBy(one, 0)).toContain(c2);
    expect(controlledBy(one, 0)).not.toContain(c1);
    expect(counters(one, 0)).toBe(1);
    const none = settledStart(composed);
    expect(controlledBy(none, 0)).not.toContain(c1);
    expect(controlledBy(none, 0)).not.toContain(c2);
    expect(counters(none, 0)).toBe(0);
  });

  it("winning the third scenario wins the campaign (p. 17)", () => {
    const third = compose(afterScenarioTwo({ s1: [false, false], s2: [false, false] }));
    const state = settledStart(third.log);
    const { log } = win(third.log, state);
    expect(log.status).toBe("won");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A lost game (p. 5)
// ---------------------------------------------------------------------------------------------------------------

describe("a lost scenario is reset with no penalty (p. 5)", () => {
  it("records nothing and checks off no villain; the same scenario is played again", () => {
    const first = compose(newLog(STANDARD));
    const state = settledStart(first.log);
    const lost = finish(first.log, resultOf(first.log, asLoss(state)));
    expect(lost.log.status).toBe("active");
    expect(lost.log.position.resolved[S1]).toBeUndefined();
    expect(listOf(lost.log, "removedVillains")).toEqual([]);
    expect(seatListOf(lost.log, 0, "recordedCards")).toEqual([]);
    expect(seatField(lost.log, 0, "overpowering1")).toBeUndefined();
    const again = compose(lost.log);
    expect(again.start.nodeId).toBe(S1);
  });

  it("a loss in scenario 2 keeps what scenario 1 recorded and replays scenario 2", () => {
    const { cheap } = recordableIn(0);
    const log = afterScenarioOne(STANDARD, SEATS, 4242, { recorded: [[cheap], []], overpowering: [true, false] });
    const second = compose(log);
    const lost = finish(second.log, resultOf(second.log, asLoss(settledStart(second.log))));
    expect(seatListOf(lost.log, 0, "recordedCards")).toEqual([cheap]);
    expect(seatField(lost.log, 0, "overpowering1")).toEqual({ kind: "flag", value: true });
    expect(listOf(lost.log, "removedVillains")).toHaveLength(1);
    expect(compose(lost.log).start.nodeId).toBe(S2);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Expert campaign (p. 6)
// ---------------------------------------------------------------------------------------------------------------

describe("the expert campaign (p. 6)", () => {
  const damagedTo = (state: GameState, seat: number, hp: number): GameState => {
    const identity = state.players[seat]!.identity.instanceId;
    return patchInstance(state, identity, { damage: (maxHitPoints(state, identity, WAVE11_DEPS) ?? 0) - hp });
  };
  const hpOf = (state: GameState, seat: number) =>
    remainingHitPoints(state, state.players[seat]!.identity.instanceId, WAVE11_DEPS);
  const pickLabel =
    (label: string) =>
    (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      const match = choice?.options.find((o) => o.label.startsWith(label));
      return match ? [match.optionId] : firstLegal(state);
    };

  it("scenario 1 sets no hit points and offers no heal (there is no previous scenario)", () => {
    const state = settledStart(compose(newLog(EXPERT)).log);
    expect(hpOf(state, 0)).toBe(maxHitPoints(state, state.players[0]!.identity.instanceId, WAVE11_DEPS));
  });

  it("records each identity's remaining hit points at Victory, capped at the base value", () => {
    const first = compose(newLog(EXPERT));
    let state = settledStart(first.log);
    state = damagedTo(state, 0, 4);
    const { log } = win(first.log, state);
    expect(seatField(log, 0, "remainingHp")).toEqual({ kind: "number", value: 4 });
    const max = maxHitPoints(state, state.players[1]!.identity.instanceId, WAVE11_DEPS);
    expect(seatField(log, 1, "remainingHp")).toEqual({ kind: "number", value: max });
  });

  it("scenario 2 sets each player's hit points to the record, and a player may deal themself a facedown card to heal to full", () => {
    const log = afterScenarioOne(EXPERT, SEATS, 4242, { hp: [4, 7] });
    expect(seatField(log, 0, "remainingHp")).toEqual({ kind: "number", value: 4 });
    const declined = settledStart(compose(log).log, pickLabel("Decline"));
    expect(hpOf(declined, 0)).toBe(4);
    expect(hpOf(declined, 1)).toBe(7);
    const healed = settledStart(compose(log).log, pickLabel("Heal to full"));
    const max0 = maxHitPoints(healed, healed.players[0]!.identity.instanceId, WAVE11_DEPS);
    expect(hpOf(healed, 0)).toBe(max0);
    // The facedown encounter card is dealt (a card dealt to the player, not yet revealed).
    expect(healed.players[0]!.dealtEncounter?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("a player defeated in a won scenario takes no part in its Victory steps and rejoins by dealing themself a facedown card", () => {
    const first = compose(newLog(EXPERT));
    let state = settledStart(first.log);
    state = damagedTo(state, 0, 6);
    const result = resultOf(first.log, {
      ...asWin(state),
      players: state.players.map((player, index) => ({ ...player, eliminated: index === 1 })),
    });
    expect(result.sittingOut).toEqual([2]);
    const { log } = finish(first.log, result);
    expect(seatField(log, 0, "remainingHp")).toEqual({ kind: "number", value: 6 });
    // The defeated seat has no hit points to record: its record is 0, so it must pay to rejoin.
    expect(seatField(log, 1, "remainingHp")).toEqual({ kind: "number", value: 0 });
    const second = compose(log);
    // Rejoining is asked before the scenario is set up; paying is the facedown card, and the seat starts at full hit
    // points.
    const rejoined = settledStart(second.log, pickLabel("Rejoin and heal to full"));
    expect(rejoined.players).toHaveLength(2);
    expect(hpOf(rejoined, 1)).toBe(maxHitPoints(rejoined, rejoined.players[1]!.identity.instanceId, WAVE11_DEPS));
    expect(rejoined.players[1]!.dealtEncounter.length).toBeGreaterThanOrEqual(1);
    // Or sits the scenario out: the seat leaves the game, which goes on with the one player.
    const sitOut = settledStart(second.log, pickLabel("Sit this scenario out"));
    expect(sitOut.players.filter((player) => !player.eliminated)).toHaveLength(1);
    expect(sitOut.players[1]!.eliminated).toBe(true);
  });
});

describe("the villain reaches the scenario builder", () => {
  it("scenario 1 plays the villain the campaign drew, and scenario 2 sets that villain aside beside Shifting Corridors", () => {
    const first = compose(newLog(STANDARD, SOLO_SEATS, 9));
    const one = settledStart(first.log);
    expect(one.villains.map((villain) => villain.cardId as string)).toEqual([first.start.villain]);
    const second = compose(win(first.log, one).log);
    const two = settledStart(second.log);
    expect(two.villains.map((villain) => villain.cardId as string)).not.toContain(second.start.villain);
    expect(two.chosenVillainId === undefined ? undefined : codeOf(two, two.chosenVillainId)).toBe(second.start.villain);
  });

  it("the campaign villain may be handed over as `villainSetId` (what every campaign caller passes), as the villain card", () => {
    const { log, start } = compose(newLog(STANDARD, SOLO_SEATS, 9));
    const config = wave11Scenario(start.scenarioId!, {
      players: start.input.seats.map((seat) => ({
        identityCardId: seat.identityCardId,
        deck: seat.deck,
        aspects: seat.aspects,
      })),
      seed: start.input.seed,
      modes: log.modes,
      villainSetId: start.villain!,
      modularSetIds: ["ninja_swarm"],
    });
    expect(config.villainChoice?.pick).toBe(start.villain);
    expect(config.villainCardId).toBe(start.villain);
  });

  it("a Daredevil game never meets Daredevil, in scenario 1 or scenario 2", () => {
    for (const seed of [3, 4, 5, 6]) {
      const first = compose(newLog(STANDARD, [DAREDEVIL_SEAT], seed));
      const one = settledStart(first.log);
      expect(
        one.villains.map((villain) => villain.cardId as string),
        `seed ${seed}`,
      ).not.toContain("65013a");
      const second = compose(win(first.log, one).log);
      expect(second.start.villain, `seed ${seed}`).not.toBe("65013a");
    }
  });
});

describe("expert hit points are set before the scenario's own setup damage (ruling June 2, 2026 (3) #2)", () => {
  // Reading flag: RRG 1.8 Appendix II step 13 and insert p. 5 ("set up each scenario as normal, then follow...") would
  // run
  // the set after the scenario's setup. The wave 2 ruling and every other box set the hit points first, so damage a
  // scenario deals in its own setup is not erased; this box follows that precedent.
  it("setup damage dealt by the scenario after the hit point set is kept, on top of the recorded hit points", () => {
    const log = afterScenarioOne(EXPERT, SEATS, 4242, { hp: [4, 7] });
    const damage: CampaignInstruction = {
      id: "test.setup-damage",
      text: "(Test only: damage an identity during scenario setup.)",
      citation: "test",
      step: {
        kind: "inGame",
        window: "afterScenarioSetup",
        effects: [forEachPlayer(eachPlayer, dealDamage(2, identityOf(thatPlayer)))],
      },
    };
    const damaged = { ...DEF, everyNodeSetup: [damage] };
    const composed = settleBy(
      (answers) => resolveBetweenGames(damaged, log, DEPS, log.modes, answers),
      declineAll,
    ).value;
    const decline = (state: GameState): readonly string[] => {
      const match = state.pendingChoice?.options.find((o) => o.label.startsWith("Decline"));
      return match ? [match.optionId] : firstLegal(state);
    };
    const state = settledStart(composed, decline);
    const hp = (seat: number) => remainingHitPoints(state, state.players[seat]!.identity.instanceId, WAVE11_DEPS);
    expect([hp(0), hp(1)]).toEqual([2, 5]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A whole campaign
// ---------------------------------------------------------------------------------------------------------------

describe.each([
  ["standard", STANDARD],
  ["expert", EXPERT],
] as const)("a three-scenario %s campaign, start to finish", (name, modes) => {
  it("updates the log at every Victory: villain removed, OVERPOWERING, recorded cards, hit points, then the campaign is won", () => {
    const expert = name === "expert";
    const one = recordableIn(0);
    const two = recordableIn(1);

    // Scenario 1.
    const c1 = compose(newLog(modes));
    expect(c1.start.nodeId).toBe(S1);
    let state = settledStart(c1.log);
    state = intoPlay(state, P1, one.cheap);
    const copy1 = [
      ...state.players[0]!.playArea,
      ...inst(state, state.players[0]!.identity.instanceId).attachments,
    ].find((id) => codeOf(state, id) === "65072a")!;
    state = patchInstance(state, copy1, { flipped: true });
    if (expert) {
      const identity = state.players[0]!.identity.instanceId;
      state = patchInstance(state, identity, { damage: (maxHitPoints(state, identity, WAVE11_DEPS) ?? 0) - 5 });
    }
    const after1 = win(c1.log, state, record([1], one.cheap)).log;
    expect(listOf(after1, "removedVillains")).toEqual([c1.start.villain]);
    expect(seatField(after1, 0, "overpowering1")).toEqual({ kind: "flag", value: true });
    expect(seatField(after1, 1, "overpowering1")).toEqual({ kind: "flag", value: false });
    expect(seatListOf(after1, 0, "recordedCards")).toEqual([one.cheap]);
    expect(seatField(after1, 0, "remainingHp")).toEqual(expert ? { kind: "number", value: 5 } : undefined);

    // Scenario 2: the recorded card and the flag count, the new villain is another one.
    const c2 = compose(after1);
    expect(c2.start.nodeId).toBe(S2);
    expect(c2.start.villain).not.toBe(c1.start.villain);
    const take = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice;
      const card = choice?.options.find((o) => o.label.includes(cardOf(one.cheap).name));
      if (card) return [card.optionId];
      return expert && choice?.options.some((o) => o.label.startsWith("Decline"))
        ? [choice.options.find((o) => o.label.startsWith("Decline"))!.optionId]
        : firstLegal(s);
    };
    state = settledStart(c2.log, take);
    expect(controlledBy(state, 0)).toContain(one.cheap);
    expect(counters(state, 0)).toBe(2);
    expect(counters(state, 1)).toBe(0);
    if (expert) {
      expect(remainingHitPoints(state, state.players[0]!.identity.instanceId, WAVE11_DEPS)).toBe(5);
    }
    state = intoPlay(state, P2, two.cheap);
    const after2 = win(c2.log, state, record([2], two.cheap)).log;
    expect(seatField(after2, 0, "overpowering2")).toEqual({ kind: "flag", value: false });
    expect(seatListOf(after2, 1, "recordedCards")).toEqual([two.cheap]);
    expect(listOf(after2, "removedVillains")).toEqual([c1.start.villain]);

    // Scenario 3: two counters for seat 1's flag and its card (the flag of scenario 1 only), one for seat 2's card.
    const c3 = compose(after2);
    expect(c3.start.nodeId).toBe(S3);
    const takeBoth = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice;
      const wanted = choice?.options.filter(
        (o) => o.label.includes(cardOf(one.cheap).name) || o.label.includes(cardOf(two.cheap).name),
      );
      if (wanted && wanted.length > 0) return wanted.map((o) => o.optionId).slice(0, choice!.maxSelections);
      return expert && choice?.options.some((o) => o.label.startsWith("Decline"))
        ? [choice.options.find((o) => o.label.startsWith("Decline"))!.optionId]
        : firstLegal(s);
    };
    state = settledStart(c3.log, takeBoth);
    expect(counters(state, 0)).toBe(2);
    expect(counters(state, 1)).toBe(1);
    const done = win(c3.log, state);
    expect(done.log.status).toBe("won");
  });
});
