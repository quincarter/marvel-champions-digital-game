/**
 * `NEXT_EVOL_CAMPAIGN_DEFINITION` (NeXt Evolution, MC40): the definition is well-formed against the real `@mc/content`
 * records, and each scenario's campaign setup, log writes and choices do what the rulebook prints
 * (docs/phase7-wave7.md §2.10, §3.40-§3.46).
 *
 * Two techniques, as `mojo.test.ts` and `mut_gen.test.ts`: the runner is driven with stand-in game outcomes (a finished
 * game's facts supplied as `CampaignGameResult.records`), and the setup of each scenario is checked in a real game built
 * from the composed log (`wave7Scenario` plus the campaign input), settled to the first player phase, reading the exact
 * cards in the exact zones. A whole campaign played to its end is `next_evol.qa.test.ts`, not here.
 */
import {
  CORE_STARTER_DECKS,
  NEXT_EVOL_CAMPAIGN,
  WAVE7_SCENARIOS,
  cardId,
  type CardId,
  type DeckContents,
  type PlayModes,
} from "@mc/content";
import {
  applyCampaignResult,
  campaignResultOf,
  maxHitPoints,
  createCampaignLog,
  createGame,
  resolveBetweenGames,
  campaignModularSetIds,
  startGameFromLog,
  validateDeck,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignInstruction,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type DeckContext,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { action } from "../dsl/abilities.js";
import { validateDefinition } from "../dsl/validate.js";
import { firstLegal, settle, type Picker } from "../testing/harness.js";
import { WAVE7_CARDS, WAVE7_DEPS, wave7Scenario } from "../wave7/index.js";
import { cardsOfComposedSets } from "./composed-sets.js";
import { NEXT_EVOL_CAMPAIGN_DEFINITION } from "./next_evol.js";

vi.setConfig({ testTimeout: 120_000 });

const DEF = NEXT_EVOL_CAMPAIGN_DEFINITION;
const DEPS: CampaignDeps = { pool: WAVE7_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: DEF.campaignId, expertCampaign: true } };

const NODES = ["morlock-siege", "on-the-run", "juggernaut", "mister-sinister", "stryfe"] as const;

/** The log sheet's rows (MC40 p. 24): title, scheme (a face), encounter card, environment (b face). */
const ROWS = [
  ["Establish Safehouse", "40191a", "40201", "40191b"],
  ["Mission Prep", "40193a", "40200", "40193b"],
  ["Assemble the Team", "40190a", "40199", "40190b"],
  ["Gear Up", "40192a", "40203", "40192b"],
  ["Practice Maneuvers", "40194a", "40198", "40194b"],
  ["Prepare Defenses", "40195a", "40202", "40195b"],
] as const;

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

const cardByCode = (code: string) => WAVE7_CARDS.find((card) => (card.id as string) === code);

// ---------------------------------------------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------------------------------------------

describe("NEXT_EVOL_CAMPAIGN_DEFINITION: structure", () => {
  it("matches the @mc/content campaign record and lists the five scenarios in MC40's fixed order", () => {
    expect(DEF.campaignId).toBe(NEXT_EVOL_CAMPAIGN.id);
    expect(DEF.graph.kind).toBe("linear");
    if (DEF.graph.kind !== "linear") return;
    expect(DEF.graph.nodes.map((node) => node.id)).toEqual([...NODES]);
    const known = new Set(WAVE7_SCENARIOS.map((scenario) => scenario.id as string));
    const scenarioIds = DEF.graph.nodes.map((node) => {
      if (node.scenario.kind !== "fixed") throw new Error(`${node.id}: expected a fixed scenario`);
      expect(known.has(node.scenario.scenarioId as string), node.id).toBe(true);
      return node.scenario.scenarioId as string;
    });
    expect(scenarioIds).toEqual(NEXT_EVOL_CAMPAIGN.scenarioIds.map((id) => id as string));
  });

  it("every instruction id is unique, prefixed 'mc40.', and cites 'MC40 p. N'", () => {
    const instructions = allInstructions();
    const ids = instructions.map((instruction) => instruction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const instruction of instructions) {
      expect(instruction.id.startsWith("mc40."), instruction.id).toBe(true);
      expect(instruction.citation, instruction.id).toMatch(/^MC40 p\. \d+$/);
    }
    for (const field of DEF.logFields) expect(field.citation, field.id).toMatch(/^MC40 p\. \d+$/);
  });

  it("every field an instruction reads or writes is declared, and every declared field is used", () => {
    const declared = new Set(DEF.logFields.map((field) => field.id));
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) {
      fieldsIn(instruction.step, referenced);
      fieldsIn(instruction.when, referenced);
    }
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

  it("declares the log sheet's boxes (MC40 p. 24) and the six-row pairing matches the card data", () => {
    const byId = Object.fromEntries(DEF.logFields.map((field) => [field.id, field]));
    expect(Object.keys(byId)).toEqual([
      "remainingHp",
      "maraudersDefeated",
      "morlocksSaved",
      "hopeDamage3",
      "hopeDamage4",
      "sideSchemes",
      "sideSchemeScenario1",
      "sideSchemeScenario2",
      "sideSchemeScenario3",
      "sideSchemeScenario4",
      "sideSchemeScenario5",
      "encounterCards",
      "environmentsEarned",
    ]);
    expect(byId.remainingHp).toMatchObject({ scope: "perSeat", whenModes: { expertCampaign: true } });
    expect(byId.morlocksSaved?.type).toEqual({ kind: "number", min: 0, max: 4 });
    const titles = ROWS.map((row) => row[0]);
    expect(byId.sideSchemes?.type).toEqual({ kind: "strikeList", options: titles });
    expect(byId.sideSchemeScenario3?.type).toEqual({ kind: "choice", options: titles });
    for (const [title, scheme, encounter, environment] of ROWS) {
      expect(cardByCode(scheme)?.name, scheme).toBe(title);
      expect(cardByCode(scheme)?.type, scheme).toBe("player_side_scheme");
      expect(cardByCode(scheme)?.otherFaceId, scheme).toBe(environment);
      expect(cardByCode(environment)?.type, environment).toBe("environment");
      expect(cardByCode(environment)?.otherFaceId, environment).toBe(scheme);
      expect(cardByCode(encounter), encounter).toBeDefined();
    }
    expect(NEXT_EVOL_CAMPAIGN.prohibited?.cardIds).toEqual(["40204"]);
  });

  it("lists exactly the printed bullets of each scenario, in printed order", () => {
    if (DEF.graph.kind !== "linear") throw new Error("expected a linear graph");
    const listed = Object.fromEntries(
      DEF.graph.nodes.map((node) => [
        node.id,
        {
          setup: node.setup.map((instruction) => instruction.id),
          victory: node.victory.map((instruction) => instruction.id),
          defeat: (node.defeat ?? []).map((instruction) => instruction.id),
        },
      ]),
    );
    const choose = (n: number) => [
      `mc40.s${n}.setup.choose`,
      `mc40.s${n}.setup.scheme-set-aside`,
      `mc40.s${n}.setup.scheme`,
      `mc40.s${n}.setup.encounter-card-record`,
      `mc40.s${n}.setup.encounter-cards`,
    ];
    const earnedEnvironments = (n: number) => [
      `mc40.s${n}.setup.environments-set-aside`,
      `mc40.s${n}.setup.environments`,
    ];
    const expert = (n: number) => [`mc40.s${n}.setup.hp-set`, `mc40.s${n}.setup.heal`];
    const victory = (n: number, ...first: string[]) => [
      ...first,
      `mc40.s${n}.victory.environment`,
      `mc40.s${n}.victory.removed`,
      `mc40.s${n}.victory.hp`,
    ];
    expect(listed).toEqual({
      "morlock-siege": {
        setup: ["mc40.s1.setup.identity", ...choose(1)],
        victory: victory(1, "mc40.s1.victory.marauders", "mc40.s1.victory.morlocks"),
        defeat: [],
      },
      "on-the-run": {
        setup: [
          "mc40.s2.setup.marauders-removed",
          "mc40.s2.setup.morlocks-saved",
          "mc40.s2.setup.environment-set-aside",
          "mc40.s2.setup.environment",
          ...choose(2),
          ...expert(2),
        ],
        victory: victory(2),
        defeat: [],
      },
      juggernaut: {
        setup: [
          ...earnedEnvironments(3),
          "mc40.s3.setup.momentum",
          "mc40.s3.setup.black-tom",
          ...choose(3),
          ...expert(3),
        ],
        victory: victory(3, "mc40.s3.victory.hope"),
        defeat: [],
      },
      "mister-sinister": {
        setup: [
          ...earnedEnvironments(4),
          "mc40.s4.setup.teleported-away",
          "mc40.s4.setup.hope",
          ...choose(4),
          ...expert(4),
        ],
        victory: victory(4, "mc40.s4.victory.hope"),
        defeat: [],
      },
      stryfe: {
        setup: [
          ...earnedEnvironments(5),
          "mc40.s5.setup.grasp",
          "mc40.s5.setup.hope",
          "mc40.s5.setup.discard-until",
          "mc40.s5.setup.reshuffle",
          ...choose(5),
          ...expert(5),
        ],
        victory: ["mc40.s5.victory.win"],
        defeat: ["mc40.s5.defeat.lose-campaign"],
      },
    });
  });

  it("is a free retry except the expert campaign's Stryfe, and sits eliminated seats out of the Victory steps", () => {
    expect(DEF.loss).toEqual({ retry: "byInstruction", retryBaseline: "nodeStart" });
    expect(DEF.elimination).toMatchObject({ whenModes: { expertCampaign: true }, citation: "MC40 p. 7" });
    if (DEF.graph.kind !== "linear") throw new Error("expected a linear graph");
    expect(DEF.graph.nodes.filter((node) => (node.defeat ?? []).length > 0).map((node) => node.id)).toEqual(["stryfe"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Runner scaffolding
// ---------------------------------------------------------------------------------------------------------------

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = CORE_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no Core starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

/** Spider-Man (Justice) and Captain Marvel (Leadership): the Core precons the other box tests use. */
const SEATS: readonly CampaignSeatSetup[] = [
  seatFor("core-spider-man-justice", 1),
  seatFor("core-captain-marvel-leadership", 2),
];
const SOLO: readonly CampaignSeatSetup[] = [SEATS[0]!];

/** Answers every pending choice with `pick`, recording what was asked. Throws if a step list never settles. */
function settleBy<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  pick: (choice: CampaignPendingChoice) => readonly string[],
): { readonly value: T; readonly asked: readonly CampaignPendingChoice[] } {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 64; guard++) {
    const result = step(answers);
    if (result.kind === "done") return { value: result.value, asked };
    asked.push(result.choice);
    answers.push({
      instructionId: result.choice.instructionId,
      slot: result.choice.slot,
      seatNumber: result.choice.seatNumber,
      picked: pick(result.choice),
    });
  }
  throw new Error("the runner asked for more than 64 choices");
}

/** The scheme the players take at each scenario, by title: the scripts below name theirs; the default is the first offered. */
const first = (choice: CampaignPendingChoice): readonly string[] => [choice.options[0]!];
const taking =
  (...titles: string[]) =>
  (choice: CampaignPendingChoice): readonly string[] => [
    titles.find((title) => choice.options.includes(title)) ?? choice.options[0]!,
  ];

function newLog(modes: PlayModes, seats: readonly CampaignSeatSetup[] = SEATS, seed = 4242): CampaignLog {
  return createCampaignLog(DEF, { id: `next-evol-${seed}`, seats, modes, poolVersion: "qa-test", seed });
}

function compose(log: CampaignLog, pick: (choice: CampaignPendingChoice) => readonly string[] = first) {
  const composed = settleBy((answers) => resolveBetweenGames(DEF, log, DEPS, log.modes, answers), pick);
  return { log: composed.value, asked: composed.asked, start: startGameFromLog(DEF, composed.value) };
}

function finish(composed: CampaignLog, result: CampaignGameResult): CampaignLog {
  return settleBy(
    (answers) => applyCampaignResult(DEF, composed, result, { at: 1_700_000_000_000, gameId: "qa" }, DEPS, answers),
    () => [],
  ).value;
}

function outcome(nodeId: string, won: boolean, extra: Partial<CampaignGameResult> = {}): CampaignGameResult {
  return {
    nodeId,
    outcome: won ? "won" : "lost",
    records: [],
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
    ...extra,
  };
}

type Record_ = CampaignGameResult["records"][number];
const listWrite = (instructionId: string, field: string, ids: readonly string[]): Record_ => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set", value: { kind: "cardList", cardIds: ids as readonly CardId[] } },
});
const appendList = (instructionId: string, field: string, ids: readonly string[]): Record_ => ({
  instructionId,
  write: {
    field,
    seatNumber: null,
    mode: "append",
    distinct: true,
    value: { kind: "cardList", cardIds: ids as readonly CardId[] },
  },
});
const numberWrite = (instructionId: string, field: string, value: number): Record_ => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set", value: { kind: "number", value } },
});
const seatNumber = (instructionId: string, seat: number, value: number): Record_ => ({
  instructionId,
  write: { field: "remainingHp", seatNumber: seat, mode: "set", value: { kind: "number", value } },
});

const ids = (start: ReturnType<typeof compose>["start"]): readonly string[] =>
  start.input.instructions.map((instruction) => instruction.instructionId);
const struck = (log: CampaignLog): readonly string[] => {
  const value = log.shared.sideSchemes;
  return value?.kind === "strikeList" ? value.struck : [];
};
const cardList = (log: CampaignLog, id: string): readonly string[] => {
  const value = log.shared[id];
  return value?.kind === "cardList" ? (value.cardIds as readonly string[]) : [];
};
const choiceOf = (log: CampaignLog, id: string): string | undefined => {
  const value = log.shared[id];
  return value?.kind === "choice" ? value.option : undefined;
};
const numberOf = (log: CampaignLog, id: string): number | undefined => {
  const value = log.shared[id];
  return value?.kind === "number" ? value.value : undefined;
};

// ---------------------------------------------------------------------------------------------------------------
// Real games
// ---------------------------------------------------------------------------------------------------------------

function build(composed: CampaignLog) {
  const start = startGameFromLog(DEF, composed);
  const removed = composed.removedFromCampaign.map((face) => face.cardId);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config = wave7Scenario(start.scenarioId, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: [...seat.deck],
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: composed.modes,
  });
  const created = createGame(
    {
      ...config,
      encounterDeck: [...config.encounterDeck, ...cardsOfComposedSets(WAVE7_CARDS, start.encounterSets.deck, removed)],
      setAside: [
        ...(config.setAside ?? []),
        ...cardsOfComposedSets(WAVE7_CARDS, start.encounterSets.setAside, removed),
      ],
      campaign: start.input,
    },
    WAVE7_DEPS,
  );
  if (!created.ok) throw new Error(`${start.nodeId}: setup failed: ${created.error.message}`);
  return { start, state: created.state, events: created.events };
}

const settled = (composed: CampaignLog, pick: Picker = firstLegal): GameState =>
  settle(build(composed).state, pick, (state) => state.step.phase === "player", WAVE7_DEPS);

const codeOf = (state: GameState, id: InstanceId): string => state.instances[id]!.cardId as string;
const codes = (state: GameState, list: readonly InstanceId[]): string[] => list.map((id) => codeOf(state, id));
const everywhere = (state: GameState, code: string): InstanceId[] =>
  Object.values(state.instances)
    .filter((instance) => (instance.cardId as string) === code)
    .map((instance) => instance.instanceId);
const handOf = (state: GameState, seat: number): string[] => codes(state, state.players[seat]!.hand);

/** Answers a `chooseOption` prompt whose label matches `label`, and everything else as `firstLegal` does. */
const picking =
  (label: RegExp): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseOption") {
      const match = choice.options.find((option) => label.test(option.label ?? ""));
      if (match) return [match.optionId];
    }
    return firstLegal(state);
  };
/** The `chooseOption` prompts a game's setup raised, by label list (the recorded damage-or-threat choice, the expert heals). */
function promptsOf(composed: CampaignLog, pick: Picker = firstLegal): { state: GameState; options: string[][] } {
  const options: string[][] = [];
  const state = settle(
    build(composed).state,
    (current) => {
      const choice = current.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") options.push(choice.options.map((option) => option.label ?? ""));
      return pick(current);
    },
    (current) => current.step.phase === "player",
    WAVE7_DEPS,
  );
  return { state, options };
}

const encounterDeckOf = (state: GameState): InstanceId[] => [
  ...state.encounterDecks[state.encounterDeckOrder[0]!]!.deck,
];
const encounterDiscardOf = (state: GameState): InstanceId[] => [
  ...state.encounterDecks[state.encounterDeckOrder[0]!]!.discard,
];
const deckCodes = (state: GameState): string[] => codes(state, encounterDeckOf(state));
const setAsideCodes = (state: GameState): string[] => codes(state, state.encounterSetAside);
const count = (list: readonly string[], code: string): number => list.filter((entry) => entry === code).length;
const activeVillainCode = (state: GameState): string => {
  const villain = state.villains.find((entry) => entry.instanceId === state.activeVillainId);
  return villain?.cardId as string;
};
const damageOf = (state: GameState, code: string): number | undefined => {
  const id = everywhere(state, code)[0];
  return id === undefined ? undefined : state.instances[id]!.damage;
};
const threatOf = (state: GameState, code: string): number | undefined => {
  const id = everywhere(state, code)[0];
  return id === undefined ? undefined : state.instances[id]!.threat;
};
const countersOf = (state: GameState, code: string): Readonly<Record<string, number>> =>
  state.instances[everywhere(state, code)[0]!]!.counters;

const PRINTED_TOUGH = (state: GameState, id: InstanceId): number => state.instances[id]!.statuses.tough;

/** The standalone game of a scenario, to read what the campaign adds to by difference. */
function standalone(scenario: string, seats = 2): GameState {
  const players = [
    { starterDeckId: "core-spider-man-justice" },
    { starterDeckId: "core-captain-marvel-leadership" },
  ].slice(0, seats);
  const created = createGame(wave7Scenario(scenario, { players, seed: 4242 }), WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (state) => state.step.phase === "player", WAVE7_DEPS);
}

/** What `NEXT_EVOL_CAMPAIGN_DEFINITION` leaves in the log after scenarios 1..n are won with these schemes and earnings. */
const afterWins = (
  modes: PlayModes,
  seats: readonly CampaignSeatSetup[],
  plays: readonly (readonly [string, readonly string[]])[],
) => {
  let log = newLog(modes, seats);
  for (const [index, [title, records]] of plays.entries()) {
    const composed = compose(log, taking(title));
    const n = index + 1;
    log = finish(
      composed.log,
      outcome(NODES[index]!, true, {
        records:
          records.length > 0 ? [appendList(`mc40.s${n}.victory.environment`, "environmentsEarned", records)] : [],
      }),
    );
  }
  return log;
};

// ---------------------------------------------------------------------------------------------------------------
// Scenario 1: Morlock Siege (MC40 p. 9)
// ---------------------------------------------------------------------------------------------------------------

describe("NEXT_EVOL_CAMPAIGN_DEFINITION: scenario 1 (Morlock Siege, MC40 p. 9)", () => {
  it("asks the group to choose among all six schemes, and marks, strikes and records the pick", () => {
    const { log, asked, start } = compose(newLog(STANDARD), taking("Gear Up"));
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ slot: "scheme", chooser: "group", seatNumber: null, count: 1 });
    expect(asked[0]!.options).toEqual(ROWS.map((row) => row[0]));
    expect(choiceOf(log, "sideSchemeScenario1")).toBe("Gear Up");
    expect(struck(log)).toEqual(["Gear Up"]);
    expect(cardList(log, "encounterCards")).toEqual(["40203"]);
    expect(ids(start)).toEqual(["mc40.s1.setup.scheme", "mc40.s1.setup.encounter-cards"]);
    // The chosen a face, what its environment hands out (one Pouches each) and the encounter card, set aside.
    expect([...start.input.setAsideCards!].sort()).toEqual(["40192a", "40196", "40196", "40203"]);
  });

  it.each(ROWS)(
    "%s: its scheme enters play controlled by nobody, 4 per player threat; its encounter card is shuffled in",
    (title, scheme, encounter, environment) => {
      for (const seats of [SOLO, SEATS]) {
        const composed = compose(newLog(STANDARD, seats), taking(title)).log;
        const state = settled(composed);
        const inPlay = state.villainArea.filter((id) => codeOf(state, id) === scheme);
        expect(inPlay, `${title} in play`).toHaveLength(1);
        expect(state.instances[inPlay[0]!]).toMatchObject({
          controllerId: null,
          ownerId: null,
          threat: 4 * seats.length,
        });
        expect(everywhere(state, scheme)).toHaveLength(1);
        expect(everywhere(state, environment), "its environment is not in play yet").toHaveLength(0);
        expect(count(deckCodes(state), encounter)).toBe(1);
        expect(count(deckCodes(state), encounter) + count(setAsideCodes(state), encounter)).toBe(1);
        // No other campaign card is in the game: the five other schemes and their environments are left out.
        const campaignCards = Object.values(state.instances)
          .map((instance) => instance.cardId as string)
          .filter((code) => /^4019\d|^4020[0-3]$/.test(code))
          .sort();
        const supply =
          title === "Gear Up" ? Array(seats.length).fill("40196") : title === "Establish Safehouse" ? ["40197"] : [];
        expect(campaignCards).toEqual([scheme, encounter, ...supply].sort());
      }
    },
  );

  it("Pouches is set aside once per player and the Safehouse once, for the environment that hands them out", () => {
    const gearUp = settled(compose(newLog(STANDARD, SEATS), taking("Gear Up")).log);
    expect(count(setAsideCodes(gearUp), "40196")).toBe(2);
    const safehouse = settled(compose(newLog(STANDARD, SEATS), taking("Establish Safehouse")).log);
    expect(count(setAsideCodes(safehouse), "40197")).toBe(1);
    expect(count(setAsideCodes(safehouse), "40196")).toBe(0);
  });

  it("Victory records the villains under Routed, the Morlocks still in play and the environment in play, in a real won game", () => {
    const composed = compose(newLog(STANDARD, SEATS), taking("Assemble the Team")).log;
    let state = settled(composed);
    const first = state.players[0]!;
    // Stage the finished game: Routed holds three villains, two Morlocks are in play, the scheme has flipped.
    const routed = state.villainArea.find((id) => state.cardPool[state.instances[id]!.cardId]!.name === "Routed")!;
    const under = ["40070a", "40071a", "40072a"].map((code) => everywhere(state, code)[0]!);
    const morlocks = state.encounterSetAside.filter((id) => codeOf(state, id) === "40079").slice(0, 2);
    const scheme = state.villainArea.find((id) => codeOf(state, id) === "40190a")!;
    state = {
      ...state,
      instances: {
        ...state.instances,
        [routed]: { ...state.instances[routed]!, tucked: under },
        [scheme]: { ...state.instances[scheme]!, cardId: cardId("40190b") },
        ...Object.fromEntries(
          morlocks.map((id) => [id, { ...state.instances[id]!, controllerId: first.playerId, ownerId: null }]),
        ),
      },
      encounterSetAside: state.encounterSetAside.filter((id) => !morlocks.includes(id)),
      players: state.players.map((player, index) =>
        index === 0 ? { ...player, playArea: [...player.playArea, ...morlocks] } : player,
      ),
      outcome: { result: "win", reason: "villainDefeated" },
    };
    const result = finishedRecords(composed, state);
    expect(result.get("maraudersDefeated")).toEqual(["40070a", "40071a", "40072a"]);
    expect(result.get("morlocksSaved")).toBe(2);
    expect(result.get("environmentsEarned")).toEqual(["40190b"]);
  });

  it("a won game earns the environment and keeps the scheme; an unearned scheme is removed from the campaign, both faces, but its encounter card stays", () => {
    const composed = compose(newLog(STANDARD), taking("Gear Up")).log;
    const earnedLog = finish(
      composed,
      outcome("morlock-siege", true, {
        records: [appendList("mc40.s1.victory.environment", "environmentsEarned", ["40192b"])],
      }),
    );
    expect(cardList(earnedLog, "environmentsEarned")).toEqual(["40192b"]);
    expect(earnedLog.removedFromCampaign).toEqual([]);
    expect(earnedLog.position.nextNodeId).toBe("on-the-run");

    const unearned = finish(composed, outcome("morlock-siege", true));
    expect(cardList(unearned, "environmentsEarned")).toEqual([]);
    expect(unearned.removedFromCampaign.map((face) => face.cardId as string).sort()).toEqual(["40192a", "40192b"]);
    expect(cardList(unearned, "encounterCards")).toEqual(["40203"]);
    expect(struck(unearned)).toEqual(["Gear Up"]);
    // It "cannot be chosen again": scenario 2 offers the other five, and nothing of it is set aside again.
    const second = compose(unearned, taking("Mission Prep"));
    expect(second.asked[0]!.options).toEqual(ROWS.map((row) => row[0]).filter((title) => title !== "Gear Up"));
    expect(second.start.input.setAsideCards).not.toContain("40192a");
  });

  it("Victory writes the three Marauders, the Morlocks Saved and the Earned box as the sheet's own fields", () => {
    const composed = compose(newLog(STANDARD), taking("Mission Prep")).log;
    const log = finish(
      composed,
      outcome("morlock-siege", true, {
        records: [
          listWrite("mc40.s1.victory.marauders", "maraudersDefeated", ["40070a", "40072a", "40074a"]),
          numberWrite("mc40.s1.victory.morlocks", "morlocksSaved", 3),
          appendList("mc40.s1.victory.environment", "environmentsEarned", ["40193b"]),
        ],
      }),
    );
    expect(cardList(log, "maraudersDefeated")).toEqual(["40070a", "40072a", "40074a"]);
    expect(numberOf(log, "morlocksSaved")).toBe(3);
    expect(cardList(log, "environmentsEarned")).toEqual(["40193b"]);
  });
});

/** The finished game's records of the first instruction of each written field, as the runner would fold them in. */
function finishedRecords(composed: CampaignLog, state: GameState): Map<string, unknown> {
  const result = campaignResultOf(DEF, composed, state, [], WAVE7_DEPS);
  const out = new Map<string, unknown>();
  for (const { write } of result.records) {
    const value = write.value;
    if (value.kind === "cardList") out.set(write.field, [...value.cardIds]);
    else if (value.kind === "number") out.set(write.field, value.value);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// A retry repeats the choice (MC40 p. 7, §3.40)
// ---------------------------------------------------------------------------------------------------------------

describe("NEXT_EVOL_CAMPAIGN_DEFINITION: a retry (MC40 p. 7)", () => {
  const refuse = (choice: CampaignPendingChoice): readonly string[] => {
    throw new Error(`the retry asked "${choice.slot}"`);
  };

  it("replays scenario 1 with the same scheme, asks nothing, and writes the strike, the mark and the card once", () => {
    const first = compose(newLog(STANDARD), taking("Practice Maneuvers"));
    const lost = finish(first.log, outcome("morlock-siege", false));
    expect(lost.position.nextNodeId).toBe("morlock-siege");
    expect(lost.history.at(-1)?.outcome).toBe("lost");
    // The baseline is the node's start: the strike, mark and card of the lost attempt are rolled back ...
    expect(struck(lost)).toEqual([]);
    expect(cardList(lost, "encounterCards")).toEqual([]);
    // ... and written again from the same pick, which is not offered.
    const retry = compose(lost, refuse);
    expect(retry.asked).toEqual([]);
    expect(choiceOf(retry.log, "sideSchemeScenario1")).toBe("Practice Maneuvers");
    expect(struck(retry.log)).toEqual(["Practice Maneuvers"]);
    expect(cardList(retry.log, "encounterCards")).toEqual(["40198"]);
    expect([...retry.start.input.setAsideCards!].sort()).toEqual(["40194a", "40198"]);
    const step = retry.log.attempt?.steps.find((entry) => entry.instructionId === "mc40.s1.setup.choose");
    expect(step?.choices).toEqual([
      expect.objectContaining({ slot: "scheme", picked: ["Practice Maneuvers"], repeated: true }),
    ]);
  });

  it("keeps the same scheme after two losses, and a later scenario's choice is still asked", () => {
    let log = compose(newLog(STANDARD), taking("Mission Prep")).log;
    log = finish(log, outcome("morlock-siege", false));
    log = finish(compose(log, refuse).log, outcome("morlock-siege", false));
    const third = compose(log, refuse);
    expect(choiceOf(third.log, "sideSchemeScenario1")).toBe("Mission Prep");
    const won = finish(
      third.log,
      outcome("morlock-siege", true, {
        records: [appendList("mc40.s1.victory.environment", "environmentsEarned", ["40193b"])],
      }),
    );
    const next = compose(won, taking("Gear Up"));
    expect(next.asked).toHaveLength(1);
    expect(next.asked[0]!.options).not.toContain("Mission Prep");
  });

  it("a scheme defeated in a lost game earns nothing: the retry must defeat it again", () => {
    const first = compose(newLog(STANDARD), taking("Assemble the Team"));
    const lost = finish(
      first.log,
      outcome("morlock-siege", false, {
        // Whatever a lost game's Victory records would have said is never applied.
        records: [appendList("mc40.s1.victory.environment", "environmentsEarned", ["40190b"])],
      }),
    );
    expect(cardList(lost, "environmentsEarned")).toEqual([]);
    expect(lost.removedFromCampaign).toEqual([]);
    const retry = compose(lost, refuse);
    const state = settled(retry.log);
    expect(codes(state, state.villainArea)).toContain("40190a");
    expect(everywhere(state, "40190b")).toEqual([]);
    const won = finish(
      retry.log,
      outcome("morlock-siege", true, {
        records: [appendList("mc40.s1.victory.environment", "environmentsEarned", ["40190b"])],
      }),
    );
    expect(cardList(won, "environmentsEarned")).toEqual(["40190b"]);
  });

  it("a lost scenario 3 repeats scenario 3's scheme, not an earlier one, and keeps the earlier earnings", () => {
    const base = afterWins(STANDARD, SEATS, [
      ["Gear Up", ["40192b"]],
      ["Mission Prep", ["40192b", "40193b"]],
    ]);
    const third = compose(base, taking("Assemble the Team"));
    const lost = finish(third.log, outcome("juggernaut", false));
    expect(lost.position.nextNodeId).toBe("juggernaut");
    expect(cardList(lost, "environmentsEarned")).toEqual(["40192b", "40193b"]);
    expect(struck(lost)).toEqual(["Gear Up", "Mission Prep"]);
    const retry = compose(lost, refuse);
    expect(choiceOf(retry.log, "sideSchemeScenario3")).toBe("Assemble the Team");
    expect(choiceOf(retry.log, "sideSchemeScenario2")).toBe("Mission Prep");
    expect(cardList(retry.log, "encounterCards")).toEqual(["40203", "40200", "40199"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Scenario 2: On the Run (MC40 p. 11)
// ---------------------------------------------------------------------------------------------------------------

/** Scenario 1 won with these villains under Routed, this many Morlocks saved and Gear Up earned. */
function afterSiege(
  seats: readonly CampaignSeatSetup[],
  defeated: readonly string[],
  saved: number,
  seed = 4242,
): CampaignLog {
  const composed = compose(newLog(STANDARD, seats, seed), taking("Gear Up"));
  return finish(
    composed.log,
    outcome("morlock-siege", true, {
      records: [
        listWrite("mc40.s1.victory.marauders", "maraudersDefeated", defeated),
        numberWrite("mc40.s1.victory.morlocks", "morlocksSaved", saved),
        appendList("mc40.s1.victory.environment", "environmentsEarned", ["40192b"]),
      ],
    }),
  );
}

describe("NEXT_EVOL_CAMPAIGN_DEFINITION: scenario 2 (On the Run, MC40 p. 11)", () => {
  it("removes each recorded villain from the game before 1A's Setup, whichever mode's face was recorded", () => {
    const recorded = ["40070b", "40071b", "40072a"]; // two expert faces and one standard face; scenario 2 is played standard
    const outTitles = new Set(["Arclight", "Blockbuster", "Chimera"]);
    const remaining = ["Greycrow", "Harpoon", "Riptide", "Vertigo"];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const composed = compose(afterSiege(SEATS, recorded, 0, seed), taking("Mission Prep")).log;
      const start = startGameFromLog(DEF, composed);
      expect(start.input.instructions[0]).toMatchObject({
        instructionId: "mc40.s2.setup.marauders-removed",
        window: "beforeScenarioSetup",
      });
      const state = settled(composed);
      const villain = state.cardPool[activeVillainCode(state) as never]!.name;
      expect(outTitles.has(villain), `seed ${seed} drew ${villain}`).toBe(false);
      seen.add(villain);
      // Both faces of each recorded title, and every other villain, are gone from the game.
      const removed = state.removedFromGame.map((id) => state.cardPool[state.instances[id]!.cardId]!.name);
      for (const title of outTitles) expect(removed, `seed ${seed}`).toContain(title);
    }
    expect([...seen].every((title) => remaining.includes(title))).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
  });

  it("each recorded title's minion stays in the encounter deck", () => {
    const composed = compose(afterSiege(SEATS, ["40070a", "40071a", "40072a"], 0), taking("Mission Prep")).log;
    const state = settled(composed);
    const names = [
      ...deckCodes(state),
      ...codes(
        state,
        state.players.flatMap((player) => [...player.dealtEncounter]),
      ),
      ...codes(state, state.villainArea),
      ...codes(state, state.encounterSetAside),
      // Minions 1B's When Revealed searched out and put into play, engaged with a player.
      ...Object.values(state.instances)
        .filter((instance) => instance.engagedWith !== null)
        .map((instance) => instance.cardId as string),
    ]
      .filter((code) => state.cardPool[code as never]?.type === "minion")
      .map((code) => state.cardPool[code as never]!.name);
    const total = (title: string) => names.filter((name) => name === title).length;
    // The campaign's recorded titles are all still around as minions (Mutant Slayers holds each Marauder minion).
    for (const title of ["Arclight", "Blockbuster", "Chimera"]) expect(total(title), title).toBeGreaterThanOrEqual(1);
  });

  it("each Morlock saved is one search of a player's deck for any card, added to their hand, after mulligans", () => {
    for (const saved of [0, 1, 3]) {
      const composed = compose(afterSiege(SEATS, [], saved), taking("Mission Prep")).log;
      const start = startGameFromLog(DEF, composed);
      expect(ids(start)).toContain("mc40.s2.setup.morlocks-saved");
      expect(
        start.input.instructions.find((entry) => entry.instructionId === "mc40.s2.setup.morlocks-saved")?.window,
      ).toBe("afterMulligans");
      const plain = settled(compose(afterSiege(SEATS, [], 0), taking("Mission Prep")).log);
      // Every search goes to the first option offered: player 1, then the deck's first card.
      const state = settled(composed);
      expect(handOf(state, 0).length - handOf(plain, 0).length, `${saved} saved`).toBe(saved);
      expect(handOf(state, 1).length).toBe(handOf(plain, 1).length);
      expect(state.players[0]!.deck.length).toBe(plain.players[0]!.deck.length - saved);
    }
  });

  it("the first player picks the player for each search, so the searches can go to different players", () => {
    const composed = compose(afterSiege(SEATS, [], 2), taking("Mission Prep")).log;
    let toggle = 0;
    const state = settle(
      build(composed).state,
      (current) => {
        const choice = current.pendingChoice;
        if (choice?.prompt.kind === "choosePlayer") {
          expect(choice.playerId, "the first player chooses").toBe(current.firstPlayerId);
          return [choice.options[toggle++ % 2]!.optionId];
        }
        return firstLegal(current);
      },
      (current) => current.step.phase === "player",
      WAVE7_DEPS,
    );
    const plain = settled(compose(afterSiege(SEATS, [], 0), taking("Mission Prep")).log);
    expect(handOf(state, 0).length).toBe(handOf(plain, 0).length + 1);
    expect(handOf(state, 1).length).toBe(handOf(plain, 1).length + 1);
  });

  it("an earned environment enters play with its counter and every enemy then in play gets a tough status card", () => {
    for (const seats of [SOLO, SEATS]) {
      const state = settled(compose(afterSiege(seats, [], 0), taking("Mission Prep")).log);
      expect(state.villainArea.map((id) => codeOf(state, id))).toEqual(expect.arrayContaining(["40192b", "40193a"]));
      expect(countersOf(state, "40192b")).toEqual({ pouch: 1 });
      expect(count(setAsideCodes(state), "40196")).toBe(seats.length); // Pouches, one per player, for its Action
      const enemies = Object.values(state.instances).filter((instance) => {
        const type = state.cardPool[instance.cardId]!.type;
        const inPlay =
          type === "villain" ? instance.instanceId === state.activeVillainId : instance.engagedWith !== null;
        return inPlay && (type === "villain" || type === "minion");
      });
      expect(enemies.length).toBeGreaterThan(0);
      for (const enemy of enemies) expect(PRINTED_TOUGH(state, enemy.instanceId), `${enemy.cardId}`).toBe(1);
    }
  });

  it("with nothing earned there is no environment and no tough status card", () => {
    const won = finish(compose(newLog(STANDARD), taking("Gear Up")).log, outcome("morlock-siege", true));
    const state = settled(compose(won, taking("Mission Prep")).log);
    expect(state.villainArea.map((id) => codeOf(state, id))).not.toContain("40192b");
    for (const instance of Object.values(state.instances)) expect(instance.statuses.tough, instance.cardId).toBe(0);
  });

  it("the encounter deck now holds scenario 1's card and scenario 2's, set aside by the log and shuffled in", () => {
    const state = settled(compose(afterSiege(SEATS, [], 0), taking("Mission Prep")).log);
    expect(count(deckCodes(state), "40203")).toBe(1);
    expect(count(deckCodes(state), "40200")).toBe(1);
    expect(state.villainArea.map((id) => codeOf(state, id))).toContain("40193a");
    expect(state.instances[state.villainArea.find((id) => codeOf(state, id) === "40193a")!]).toMatchObject({
      controllerId: null,
      threat: 8,
    });
  });

  it("Victory marks the campaign environment in play, once, and removes the scheme if it was not defeated", () => {
    const composed = compose(afterSiege(SEATS, [], 0), taking("Mission Prep")).log;
    const earnedBoth = finish(
      composed,
      outcome("on-the-run", true, {
        records: [appendList("mc40.s2.victory.environment", "environmentsEarned", ["40192b", "40193b"])],
      }),
    );
    expect(cardList(earnedBoth, "environmentsEarned")).toEqual(["40192b", "40193b"]);
    const notDefeated = finish(
      composed,
      outcome("on-the-run", true, {
        records: [appendList("mc40.s2.victory.environment", "environmentsEarned", ["40192b"])],
      }),
    );
    expect(cardList(notDefeated, "environmentsEarned")).toEqual(["40192b"]);
    expect(notDefeated.removedFromCampaign.map((face) => face.cardId as string).sort()).toEqual(["40193a", "40193b"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Scenario 3: Juggernaut (MC40 p. 14)
// ---------------------------------------------------------------------------------------------------------------

const BLACK_TOM = "40132";
const WILLOW = "40133";

/** Gear Up and Mission Prep earned in scenarios 1 and 2. */
const afterTwo = (seats: readonly CampaignSeatSetup[], seed = 4242, modes: PlayModes = STANDARD): CampaignLog => {
  let log = newLog(modes, seats, seed);
  log = finish(
    compose(log, taking("Gear Up")).log,
    outcome("morlock-siege", true, {
      records: [appendList("mc40.s1.victory.environment", "environmentsEarned", ["40192b"])],
    }),
  );
  return finish(
    compose(log, taking("Mission Prep")).log,
    outcome("on-the-run", true, {
      records: [appendList("mc40.s2.victory.environment", "environmentsEarned", ["40192b", "40193b"])],
    }),
  );
};

describe("NEXT_EVOL_CAMPAIGN_DEFINITION: scenario 3 (Juggernaut, MC40 p. 14)", () => {
  it("puts each earned environment into play, and 1 momentum counter on Juggernaut for each", () => {
    for (const seats of [SOLO, SEATS]) {
      const base = standalone("juggernaut", seats.length);
      const state = settled(compose(afterTwo(seats), taking("Assemble the Team")).log);
      expect(state.villainArea.map((id) => codeOf(state, id))).toEqual(
        expect.arrayContaining(["40192b", "40193b", "40190a"]),
      );
      expect(countersOf(state, "40192b")).toEqual({ pouch: 1 });
      expect(countersOf(state, "40193b")).toEqual({ prep: 1 });
      expect(countersOf(state, "40118").momentum ?? 0).toBe((countersOf(base, "40118").momentum ?? 0) + 2);
      expect(count(setAsideCodes(state), "40196")).toBe(seats.length);
    }
  });

  it("Black Tom Cassidy and 1 per player Creeping Willow are shuffled together: one is dealt facedown to each player, the rest goes back", () => {
    const toms = new Set<string>();
    for (const seats of [SOLO, SEATS]) {
      for (let seed = 1; seed <= 12; seed++) {
        const state = settled(compose(afterTwo(seats, seed), taking("Assemble the Team")).log);
        const dealt = state.players.map((player) => codes(state, player.dealtEncounter));
        expect(
          dealt.map((cards) => cards.length),
          `seed ${seed}`,
        ).toEqual(seats.map(() => 1));
        for (const [card] of dealt) expect([BLACK_TOM, WILLOW]).toContain(card);
        const together = [...dealt.flat(), ...deckCodes(state)];
        expect(count(together, BLACK_TOM), "Black Tom is in exactly one place").toBe(1);
        expect(count(together, WILLOW), "all four Willows are somewhere").toBe(4);
        // N + 1 cards were taken, N dealt: exactly one is back in the deck, shuffled.
        const back = deckCodes(state).filter((code) => code === BLACK_TOM || code === WILLOW).length;
        expect(back, `seed ${seed}`).toBe(5 - seats.length);
        if (seats === SEATS) toms.add(dealt.flat().includes(BLACK_TOM) ? "dealt" : "back");
        expect(setAsideCodes(state)).not.toContain(BLACK_TOM);
        expect(setAsideCodes(state)).not.toContain(WILLOW);
      }
    }
    expect([...toms].sort()).toEqual(["back", "dealt"]);
  });

  it("with no environment earned, no counter is added and nothing is put into play but the chosen scheme", () => {
    const won = finish(compose(newLog(STANDARD, SEATS), taking("Gear Up")).log, outcome("morlock-siege", true));
    const second = finish(compose(won, taking("Mission Prep")).log, outcome("on-the-run", true));
    const state = settled(compose(second, taking("Assemble the Team")).log);
    expect(countersOf(state, "40118").momentum ?? 0).toBe(countersOf(standalone("juggernaut"), "40118").momentum ?? 0);
    expect(state.villainArea.map((id) => codeOf(state, id)).filter((code) => code.startsWith("4019"))).toEqual([
      "40190a",
    ]);
  });

  it("Victory records the damage on Hope Summers and the environments in play, from a real finished game", () => {
    const composed = compose(afterTwo(SEATS), taking("Assemble the Team")).log;
    let state = settled(composed);
    const hope = everywhere(state, "40130")[0]!;
    const scheme = state.villainArea.find((id) => codeOf(state, id) === "40190a")!;
    state = {
      ...state,
      instances: {
        ...state.instances,
        [hope]: { ...state.instances[hope]!, damage: 2 },
        [scheme]: { ...state.instances[scheme]!, cardId: cardId("40190b") },
      },
      outcome: { result: "win", reason: "villainDefeated" },
    };
    const records = finishedRecords(composed, state);
    expect(records.get("hopeDamage3")).toBe(2);
    expect([...(records.get("environmentsEarned") as string[])].sort()).toEqual(["40190b", "40192b", "40193b"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Scenario 4: Mister Sinister (MC40 p. 16)
// ---------------------------------------------------------------------------------------------------------------

/** Scenarios 1-3 won; Assemble the Team earned in scenario 3; Hope Summers carried this much damage out of scenario 3. */
const afterThree = (
  seats: readonly CampaignSeatSetup[],
  hope: number,
  seed = 4242,
  modes: PlayModes = STANDARD,
): CampaignLog => {
  const log = afterTwo(seats, seed, modes);
  return finish(
    compose(log, taking("Assemble the Team")).log,
    outcome("juggernaut", true, {
      records: [
        numberWrite("mc40.s3.victory.hope", "hopeDamage3", hope),
        appendList("mc40.s3.victory.environment", "environmentsEarned", ["40192b", "40193b", "40190b"]),
      ],
    }),
  );
};

describe("NEXT_EVOL_CAMPAIGN_DEFINITION: scenario 4 (Mister Sinister, MC40 p. 16)", () => {
  it("puts the environments into play and Teleported Away with 1 per player more threat for each", () => {
    for (const seats of [SOLO, SEATS]) {
      const { state, options } = promptsOf(compose(afterThree(seats, 0), taking("Establish Safehouse")).log);
      expect(options, "no damage recorded: nothing to choose").toEqual([]);
      expect(state.villainArea.map((id) => codeOf(state, id))).toEqual(
        expect.arrayContaining(["40192b", "40193b", "40190b", "40146", "40191a"]),
      );
      expect(everywhere(state, "40146")).toHaveLength(1);
      // Printed 3 with hinder 1 per player (entering play), plus 1 per player for each of the three environments.
      expect(threatOf(state, "40146")).toBe(3 + seats.length + 3 * seats.length);
    }
  });

  it("the players choose: the damage recorded for Hope Summers goes on her, or that much threat on Teleported Away", () => {
    const composed = compose(afterThree(SEATS, 2), taking("Establish Safehouse")).log;
    const asDamage = promptsOf(composed, picking(/damage on Hope/));
    expect(asDamage.options).toEqual([
      ["Place that damage on Hope Summers", "Place that much threat on Teleported Away"],
    ]);
    expect(damageOf(asDamage.state, "40130")).toBe(2);
    expect(threatOf(asDamage.state, "40146")).toBe(3 + 2 + 6);
    const asThreat = promptsOf(composed, picking(/threat on Teleported/));
    expect(damageOf(asThreat.state, "40130")).toBe(0);
    expect(threatOf(asThreat.state, "40146")).toBe(3 + 2 + 6 + 2);
  });

  it("the first player enters the group's choice, whoever sits first", () => {
    for (const firstPlayerIndex of [0, 1]) {
      const composed = compose(afterThree(SEATS, 1), taking("Establish Safehouse")).log;
      const start = startGameFromLog(DEF, composed);
      const config = wave7Scenario("mister-sinister", {
        players: start.input.seats.map((seat) => ({
          identityCardId: seat.identityCardId,
          deck: [...seat.deck],
          aspects: seat.aspects,
        })),
        seed: start.input.seed,
        modes: composed.modes,
        firstPlayerIndex,
      });
      const created = createGame({ ...config, campaign: start.input }, WAVE7_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      const deciders: PlayerId[] = [];
      const first = created.state.firstPlayerId;
      settle(
        created.state,
        (state) => {
          if (state.pendingChoice?.prompt.kind === "chooseOption") deciders.push(state.pendingChoice.playerId);
          return firstLegal(state);
        },
        (state) => state.step.phase === "player",
        WAVE7_DEPS,
      );
      expect(deciders, `first player ${firstPlayerIndex}`).toEqual([first]);
    }
  });

  it("Victory records the damage on Hope Summers for scenario 5", () => {
    const composed = compose(afterThree(SEATS, 1), taking("Establish Safehouse")).log;
    const log = finish(
      composed,
      outcome("mister-sinister", true, {
        records: [
          numberWrite("mc40.s4.victory.hope", "hopeDamage4", 2),
          appendList("mc40.s4.victory.environment", "environmentsEarned", ["40192b", "40193b", "40190b", "40191b"]),
        ],
      }),
    );
    expect(numberOf(log, "hopeDamage3")).toBe(1);
    expect(numberOf(log, "hopeDamage4")).toBe(2);
    expect(cardList(log, "environmentsEarned")).toEqual(["40192b", "40193b", "40190b", "40191b"]);
    expect(log.position.nextNodeId).toBe("stryfe");
  });

  it("Victory records Hope Summers's damage from a real finished game", () => {
    const composed = compose(afterThree(SEATS, 1), taking("Establish Safehouse")).log;
    const state = settled(composed, picking(/damage on Hope/));
    const hope = everywhere(state, "40130")[0]!;
    const won: GameState = {
      ...state,
      instances: { ...state.instances, [hope]: { ...state.instances[hope]!, damage: 2 } },
      outcome: { result: "win", reason: "villainDefeated" },
    };
    expect(finishedRecords(composed, won).get("hopeDamage4")).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Scenario 5: Stryfe (MC40 p. 18)
// ---------------------------------------------------------------------------------------------------------------

const afterFour = (
  seats: readonly CampaignSeatSetup[],
  hope3: number,
  hope4: number,
  seed = 4242,
  modes: PlayModes = STANDARD,
): CampaignLog => {
  const log = afterThree(seats, hope3, seed, modes);
  return finish(
    compose(log, taking("Establish Safehouse")).log,
    outcome("mister-sinister", true, {
      records: [
        numberWrite("mc40.s4.victory.hope", "hopeDamage4", hope4),
        appendList("mc40.s4.victory.environment", "environmentsEarned", ["40192b", "40193b", "40190b", "40191b"]),
      ],
    }),
  );
};

describe("NEXT_EVOL_CAMPAIGN_DEFINITION: scenario 5 (Stryfe, MC40 p. 18)", () => {
  it("puts the four environments into play, 1 per player threat on Stryfe's Grasp for each, and all five encounter cards in the deck", () => {
    for (const seats of [SOLO, SEATS]) {
      const base = standalone("stryfe", seats.length);
      const { state, options } = promptsOf(compose(afterFour(seats, 0, 0), taking("Practice Maneuvers")).log);
      expect(options).toEqual([]);
      expect(state.villainArea.map((id) => codeOf(state, id))).toEqual(
        expect.arrayContaining(["40192b", "40193b", "40190b", "40191b", "40194a", "40168a"]),
      );
      expect(threatOf(state, "40168a")).toBe(threatOf(base, "40168a")! + 4 * seats.length);
      const deck = [
        ...deckCodes(state),
        ...codes(
          state,
          state.players.flatMap((player) => player.dealtEncounter),
        ),
      ];
      for (const card of ["40203", "40200", "40199", "40201", "40198"]) {
        expect(
          count(deck, card) +
            Object.values(state.instances).filter((i) => i.cardId === card && i.engagedWith !== null).length,
          card,
        ).toBe(1);
      }
    }
  });

  it("the players choose: the damage recorded in scenario 4 goes on Hope Summers, or that much threat on Stryfe's Grasp", () => {
    const composed = compose(afterFour(SEATS, 0, 1), taking("Practice Maneuvers")).log;
    const asDamage = promptsOf(composed, picking(/damage on Hope/));
    expect(asDamage.options).toEqual([
      ["Place that damage on Hope Summers", "Place that much threat on Stryfe's Grasp"],
    ]);
    const asThreat = promptsOf(composed, picking(/threat on Stryfe/));
    expect(damageOf(asDamage.state, "40130")).toBe(1);
    expect(damageOf(asThreat.state, "40130")).toBe(0);
    expect(threatOf(asThreat.state, "40168a")).toBe(threatOf(asDamage.state, "40168a")! + 1);
  });

  it("each player discards from the encounter deck until a minion or a PSIONIC attachment and reveals it; the discard pile is then shuffled back in", () => {
    for (const seats of [SOLO, SEATS]) {
      const base = standalone("stryfe", seats.length);
      const state = settled(compose(afterFour(seats, 0, 0), taking("Practice Maneuvers")).log);
      expect(encounterDiscardOf(state), "the discard pile was shuffled back into the deck").toEqual([]);
      // One card revealed per player, each a minion in play or a PSIONIC attachment attached somewhere.
      const revealed = (game: GameState): number =>
        Object.values(game.instances).filter((instance) => {
          const card = game.cardPool[instance.cardId]!;
          return (
            (card.type === "minion" && instance.engagedWith !== null) ||
            (card.type === "attachment" &&
              instance.attachedTo !== null &&
              "traits" in card &&
              card.traits.includes("PSIONIC" as never))
          );
        }).length;
      expect(revealed(state) - revealed(base)).toBe(seats.length);
      // Five encounter cards were added, the revealed ones left the deck, and every discarded card came back.
      expect(encounterDeckOf(state).length).toBe(encounterDeckOf(base).length + 5 - seats.length);
    }
  });

  it("in expert mode Stryfe II's own When Revealed comes first, then the campaign's reveal: two cards for each player", () => {
    const expertMode: PlayModes = { expert: true, campaign: { campaignId: DEF.campaignId } };
    const log = afterFour(SEATS, 0, 0, 4242, expertMode);
    const state = settled(compose(log, taking("Practice Maneuvers")).log);
    const created = createGame(
      wave7Scenario("stryfe", {
        players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
        seed: 4242,
        modes: { expert: true },
      }),
      WAVE7_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const base = settle(created.state, firstLegal, (current) => current.step.phase === "player", WAVE7_DEPS);
    const attached = (game: GameState): number =>
      Object.values(game.instances).filter(
        (instance) => game.cardPool[instance.cardId]!.type === "attachment" && instance.attachedTo !== null,
      ).length;
    const minions = (game: GameState): number =>
      Object.values(game.instances).filter(
        (instance) => game.cardPool[instance.cardId]!.type === "minion" && instance.engagedWith !== null,
      ).length;
    // Each player ends with one more minion or attachment than the expert scenario alone gives them.
    expect(attached(state) + minions(state) - (attached(base) + minions(base))).toBe(2);
    expect(encounterDiscardOf(state)).toEqual([]);
  });

  it("Victory wins the campaign; a lost game only retries in a standard campaign", () => {
    const composed = compose(afterFour(SEATS, 0, 0), taking("Practice Maneuvers")).log;
    const won = finish(composed, outcome("stryfe", true));
    expect(won.status).toBe("won");
    expect(won.position.nextNodeId).toBeNull();
    const lost = finish(composed, outcome("stryfe", false));
    expect(lost.status).toBe("active");
    expect(lost.position.nextNodeId).toBe("stryfe");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The expert campaign (MC40 p. 7, §3.46)
// ---------------------------------------------------------------------------------------------------------------

const HEAL_TOKEN = "Heal to full · +1 acceleration token";
const HEAL_CARD = "Heal to full · +1 facedown card";

/** Scenarios 1..`count` won in an expert campaign; seat 1 recorded `hp1` and seat 2 `hp2` after each. */
function expertAfter(count: number, hp1: number, hp2: number, seed = 4242): CampaignLog {
  let log = newLog(EXPERT, SEATS, seed);
  for (const [index, node] of NODES.slice(0, count).entries()) {
    const n = index + 1;
    log = finish(
      compose(log, taking(ROWS[index]![0])).log,
      outcome(node, true, {
        records: [seatNumber(`mc40.s${n}.victory.hp`, 1, hp1), seatNumber(`mc40.s${n}.victory.hp`, 2, hp2)],
      }),
    );
  }
  return log;
}

const identityDamage = (state: GameState, seat: number): number =>
  state.instances[state.players[seat]!.identity.instanceId]!.damage;
const maxHp = (state: GameState, seat: number): number =>
  maxHitPoints(state, state.players[seat]!.identity.instanceId, WAVE7_DEPS)!;
const tokens = (state: GameState): number => state.mainScheme.accelerationTokens;

describe("NEXT_EVOL_CAMPAIGN_DEFINITION: the expert campaign (MC40 p. 7)", () => {
  it("a standard campaign has none of the expert instructions; an expert one has them from scenario 2 on", () => {
    const standard = afterTwo(SEATS);
    for (const prefix of ["mc40.s3.setup.hp-set", "mc40.s3.setup.heal"])
      expect(ids(compose(standard, taking("Assemble the Team")).start)).not.toContain(prefix);
    const expert = expertAfter(2, 6, 0);
    expect(ids(compose(expert, taking("Assemble the Team")).start)).toEqual(
      expect.arrayContaining(["mc40.s3.setup.hp-set", "mc40.s3.setup.heal"]),
    );
    expect(ids(compose(newLog(EXPERT), taking("Gear Up")).start)).not.toContain("mc40.s1.setup.hp-set");
    // Victory records the hit points only in an expert campaign.
    const composed = compose(newLog(STANDARD), taking("Gear Up")).log;
    const state = { ...settled(composed), outcome: { result: "win", reason: "villainDefeated" } } as GameState;
    expect(
      campaignResultOf(DEF, composed, state, [], WAVE7_DEPS).records.some(
        (entry) => entry.write.field === "remainingHp",
      ),
    ).toBe(false);
    const expertComposed = compose(newLog(EXPERT), taking("Gear Up")).log;
    const expertState = {
      ...settled(expertComposed),
      outcome: { result: "win", reason: "villainDefeated" },
    } as GameState;
    expect(
      campaignResultOf(DEF, expertComposed, expertState, [], WAVE7_DEPS)
        .records.filter((entry) => entry.write.field === "remainingHp")
        .map((entry) => entry.write.seatNumber),
    ).toEqual([1, 2]);
  });

  it("records each remaining hit point total after a win, and a defeated player records nothing", () => {
    const composed = compose(newLog(EXPERT), taking("Gear Up")).log;
    let state = settled(composed);
    const identity = state.players[0]!.identity.instanceId;
    state = {
      ...state,
      instances: { ...state.instances, [identity]: { ...state.instances[identity]!, damage: 4 } },
      players: state.players.map((player, index) => (index === 1 ? { ...player, eliminated: true } : player)),
      outcome: { result: "win", reason: "villainDefeated" },
    };
    const remaining = maxHp(state, 0) - 4;
    const records = campaignResultOf(DEF, composed, state, [], WAVE7_DEPS).records.filter(
      (entry) => entry.write.field === "remainingHp",
    );
    expect(records.map((entry) => [entry.write.seatNumber, entry.write.value])).toEqual([
      [1, { kind: "number", value: remaining }],
    ]);
    const log = finish(composed, outcome("morlock-siege", true, { records }));
    expect(log.seats.map((seat) => seat.fields.remainingHp)).toEqual([{ kind: "number", value: remaining }, undefined]);
  });

  it("scenario 2 sets each player's hit points to the recorded value; a defeated player must pay the token to rejoin", () => {
    const composed = compose(expertAfter(1, 6, 0), taking("Mission Prep")).log;
    const asked: string[][] = [];
    const state = settle(
      build(composed).state,
      (current) => {
        const choice = current.pendingChoice;
        if (choice?.prompt.kind === "chooseOption") {
          asked.push(choice.options.map((option) => option.label ?? ""));
          expect(choice.playerId, "the player deciding their own heal").toBe(current.players[0]!.playerId);
          return [choice.options.find((option) => option.label === "Decline")!.optionId];
        }
        return firstLegal(current);
      },
      (current) => current.step.phase === "player",
      WAVE7_DEPS,
    );
    // Seat 1 is asked and declines; seat 2 (recorded 0) is not offered "Decline": the token is the price of rejoining.
    expect(asked).toEqual([[HEAL_TOKEN, "Decline"]]);
    expect(identityDamage(state, 0)).toBe(maxHp(state, 0) - 6);
    expect(identityDamage(state, 1)).toBe(0);
    expect(tokens(state)).toBe(1);
    const healed = settled(composed, picking(/Heal to full/));
    expect(identityDamage(healed, 0)).toBe(0);
    expect(tokens(healed)).toBe(2);
  });

  it("scenarios 3 and 5 heal with a facedown encounter card instead", () => {
    for (const [count, node, scheme] of [
      [2, "juggernaut", "Assemble the Team"],
      [4, "stryfe", "Practice Maneuvers"],
    ] as const) {
      const composed = compose(count === 2 ? expertAfter(2, 6, 0) : expertAfter(4, 6, 0), taking(scheme)).log;
      expect(startGameFromLog(DEF, composed).nodeId).toBe(node);
      const asked: string[][] = [];
      const declined = settle(
        build(composed).state,
        (current) => {
          const choice = current.pendingChoice;
          if (choice?.prompt.kind === "chooseOption") {
            asked.push(choice.options.map((option) => option.label ?? ""));
            return [choice.options.find((option) => option.label === "Decline")!.optionId];
          }
          return firstLegal(current);
        },
        (current) => current.step.phase === "player",
        WAVE7_DEPS,
      );
      expect(
        asked.filter((labels) => labels.includes(HEAL_CARD)),
        node,
      ).toEqual([[HEAL_CARD, "Decline"]]);
      expect(identityDamage(declined, 0), node).toBe(maxHp(declined, 0) - 6);
      expect(identityDamage(declined, 1), node).toBe(0);
      expect(tokens(declined), "no acceleration token in a facedown-card scenario").toBe(0);
      const healed = settled(composed, picking(/Heal to full/));
      expect(identityDamage(healed, 0), node).toBe(0);
      const dealt = (state: GameState, seat: number) => state.players[seat]!.dealtEncounter.length;
      // The heal's card is dealt on top of the card Black Tom (scenario 3) or nothing (scenario 5).
      expect(dealt(healed, 0), node).toBe(dealt(declined, 0) + 1);
      expect(dealt(healed, 1), `${node}: seat 2 pays either way`).toBe(dealt(declined, 1));
    }
  });

  it("scenarios 4 offers the token again; losing Stryfe loses the campaign in an expert campaign only", () => {
    const four = compose(expertAfter(3, 6, 6), taking("Establish Safehouse"));
    expect(ids(four.start)).toEqual(expect.arrayContaining(["mc40.s4.setup.hp-set", "mc40.s4.setup.heal"]));
    const composed = compose(expertAfter(4, 6, 6), taking("Practice Maneuvers")).log;
    const lost = finish(composed, outcome("stryfe", false));
    expect(lost.status).toBe("lost");
    expect(lost.position.nextNodeId).toBeNull();
    const standard = finish(
      compose(afterFour(SEATS, 0, 0), taking("Practice Maneuvers")).log,
      outcome("stryfe", false),
    );
    expect(standard.status).toBe("active");
    // An expert campaign's other scenarios only retry.
    const retried = finish(compose(expertAfter(1, 6, 6), taking("Mission Prep")).log, outcome("on-the-run", false));
    expect(retried.status).toBe("active");
    expect(retried.position.nextNodeId).toBe("on-the-run");
  });

  it("a lost scenario keeps the recorded hit points of the last win, so the retry sets them again", () => {
    const log = expertAfter(1, 6, 3);
    const lost = finish(compose(log, taking("Mission Prep")).log, outcome("on-the-run", false));
    expect(lost.seats.map((seat) => seat.fields.remainingHp)).toEqual([
      { kind: "number", value: 6 },
      { kind: "number", value: 3 },
    ]);
    const retry = compose(lost, () => {
      throw new Error("the retry asked");
    });
    expect(ids(retry.start)).toContain("mc40.s2.setup.hp-set");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Campaign cards only inside the campaign (MC40 p. 6)
// ---------------------------------------------------------------------------------------------------------------

describe("NEXT_EVOL_CAMPAIGN_DEFINITION: campaign cards and the prohibited card (MC40 p. 6)", () => {
  const starter = CORE_STARTER_DECKS.find((deck) => (deck.id as string) === "core-spider-man-justice")!;
  const deckWith = (code: string, quantity = 1): DeckContents => ({
    identityCardId: starter.identityCardId,
    aspects: starter.aspects,
    cards: [...starter.cards, { cardId: cardId(code), quantity }],
  });
  const context = (granted: readonly string[] = []): DeckContext => ({
    campaign: {
      campaignId: DEF.campaignId,
      campaignSetIds: NEXT_EVOL_CAMPAIGN.campaignSetIds.map((id) => id as string),
      identityCardId: starter.identityCardId as string,
      grantedCardIds: granted,
      prohibitedCardIds: (NEXT_EVOL_CAMPAIGN.prohibited?.cardIds ?? []).map((id) => id as string),
    },
  });
  const problems = (deck: DeckContents, ctx?: DeckContext): string[] => {
    const verdict = validateDeck(deck, WAVE7_CARDS, ctx);
    return verdict.ok ? [] : verdict.problems.map((problem) => problem.code);
  };

  it("Pouches and the Safehouse are refused in any deck outside the campaign, and in the campaign unless it granted them", () => {
    for (const code of ["40196", "40197"]) {
      expect(problems(deckWith(code)), code).toContain("campaign_card");
      expect(problems(deckWith(code), context()), code).toContain("campaign_card_not_granted");
      expect(problems(deckWith(code), context([code])), code).not.toContain("campaign_card_not_granted");
    }
  });

  it("the Hope Summers ally (40204) cannot be in a player deck while playing the campaign, but can outside it", () => {
    expect(problems(deckWith("40204"), context())).toContain("campaign_prohibited_card");
    expect(problems(deckWith("40204"))).not.toContain("campaign_prohibited_card");
    expect(problems(deckWith("40204"))).not.toContain("campaign_card");
  });

  it("a campaign seat's deck never holds a campaign card: they enter a game only by instruction", () => {
    const composed = compose(newLog(STANDARD, SEATS), taking("Gear Up")).log;
    const start = startGameFromLog(DEF, composed);
    for (const seat of start.input.seats) {
      expect(seat.deck.map((id) => id as string).filter((id) => /^4019\d|^4020[0-4]/.test(id))).toEqual([]);
    }
  });

  it("a standalone game of each scenario has no campaign card in it", () => {
    for (const scenario of NODES) {
      const state = standalone(scenario, 2);
      const found = Object.values(state.instances)
        .map((instance) => instance.cardId as string)
        .filter((id) => /^4019\d|^4020[0-3]/.test(id));
      expect(found, scenario).toEqual([]);
    }
  });
});

describe("NEXT_EVOL_CAMPAIGN_DEFINITION: Black Tom Cassidy is required in scenario 3 (MC40 p. 14)", () => {
  // MC40 p. 14: "The Black Tom Cassidy set can be removed from this scenario and/or added to other scenarios when using
  // the scenario customization rules, but it is required when playing Juggernaut in campaign mode." The node names the
  // set (`requiredModularSetIds`), not `composeEncounterSets`: composing it into the deck would shuffle the set in
  // twice beside the builder's own recommended pick.
  const juggernautGame = (modularSetIds: readonly string[] | undefined) => {
    const composed = compose(
      afterWins(STANDARD, SEATS, [
        ["Gear Up", []],
        ["Mission Prep", []],
      ]),
      taking("Assemble the Team"),
    ).log;
    const start = startGameFromLog(DEF, composed);
    const config = wave7Scenario("juggernaut", {
      players: start.input.seats.map((seat) => ({
        identityCardId: seat.identityCardId,
        deck: [...seat.deck],
        aspects: seat.aspects,
      })),
      seed: start.input.seed,
      modes: composed.modes,
      ...(modularSetIds ? { modularSetIds } : {}),
    });
    return { start, created: createGame({ ...config, campaign: start.input }, WAVE7_DEPS) };
  };
  const recommended = WAVE7_SCENARIOS.find((scenario) => scenario.id === "juggernaut")!.recommendedModularSetIds;

  it("only scenario 3's node names a required modular set, and its start hands it to the builder", () => {
    for (const node of DEF.graph.nodes) {
      expect(node.requiredModularSetIds ?? [], node.id).toEqual(node.id === "juggernaut" ? ["black_tom_cassidy"] : []);
    }
    const { start } = juggernautGame(undefined);
    expect(start.requiredModularSetIds).toEqual(["black_tom_cassidy"]);
    expect(start.input.requiredModularSetIds).toEqual(["black_tom_cassidy"]);
  });

  it("a campaign Juggernaut cannot be built without the Black Tom Cassidy set", () => {
    const { created } = juggernautGame(["bomb_scare"]);
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.code).toBe("invalid_setup");
    expect(created.error.message).toContain("black_tom_cassidy");
  });

  it("the builder's modular sets through campaignModularSetIds: Black Tom Cassidy once by default, and added to another pick", () => {
    const { start } = juggernautGame(undefined);
    // Juggernaut's one recommended set is Black Tom Cassidy itself (40121a Contents), so the default is that one set.
    expect(campaignModularSetIds(start, recommended)).toEqual(["black_tom_cassidy"]);
    expect(campaignModularSetIds(start, recommended, ["black_tom_cassidy"])).toEqual(["black_tom_cassidy"]);
    expect(campaignModularSetIds(start, recommended, ["bomb_scare"])).toEqual(["black_tom_cassidy", "bomb_scare"]);
    for (const picked of [undefined, ["bomb_scare"]]) {
      const { created } = juggernautGame(campaignModularSetIds(start, recommended, picked));
      expect(created.ok, String(picked)).toBe(true);
      if (!created.ok) continue;
      const copies = (code: string) =>
        Object.values(created.state.instances).filter((instance) => (instance.cardId as string) === code).length;
      expect(copies("40132"), String(picked)).toBe(1); // Black Tom Cassidy
      expect(copies("40133"), String(picked)).toBe(4); // Creeping Willow
    }
  });
});
