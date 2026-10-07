/**
 * Structural coverage for `SM_CAMPAIGN_DEFINITION` (docs/campaign-mode-design.md §9.3), modeled on `mts.test.ts`'s
 * own checks. Scenario-by-scenario behavior (which node crossings mark, what each victory instruction records) is
 * exercised through the engine's own `sm-queries.test.ts` (the pattern this file's reputation track reuses) and
 * `packages/engine/src/campaign/runner.test.ts`-style fixtures elsewhere; this file proves the definition itself is
 * well-formed and matches the real, ingested `@mc/content` records it names.
 *
 * The two choice-source shapes this box needed (`CampaignChoiceSource` `values` for node 1's "Deal 3 … That player
 * may choose 1", MC27 p. 22; `excludingTitles` for Community Service's "that does not have its title recorded",
 * MC27 p. 11/13/15) are driven through the real runner at the end of this file, between-games results supplied as
 * `CampaignGameResult.records` directly (`mts.qa.test.ts`'s shape).
 */
import { describe, expect, it } from "vitest";
import {
  SM_CAMPAIGN as SM_CAMPAIGN_RECORD,
  SM_CARDS,
  SM_SCENARIOS,
  SM_STARTER_DECKS,
  type CardId,
  type PlayModes,
} from "@mc/content";
import {
  applyCampaignResult,
  cardsInPlay,
  createCampaignLog,
  createGame,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignInstruction,
  type CampaignLog,
  type CampaignSeatSetup,
  type GameSetupConfig,
  type GameState,
  type LogWrite,
} from "@mc/engine";
import { action } from "../dsl/abilities.js";
import { validateDefinition } from "../dsl/validate.js";
import { firstLegal, settle as settleGame, type Picker } from "../testing/harness.js";
import { WAVE5_CARDS, WAVE5_DEPS, wave5Scenario } from "../wave5/index.js";
import { cardsOfComposedSets } from "./composed-sets.js";
import { SM_CAMPAIGN_DEFINITION } from "./sm.js";

function allInstructions(): readonly CampaignInstruction[] {
  const graph = SM_CAMPAIGN_DEFINITION.graph;
  if (graph.kind !== "linear") throw new Error("expected sm's graph to be linear");
  const perNode = graph.nodes.flatMap((node) => [
    ...(node.composition ?? []),
    ...node.setup,
    ...node.victory,
    ...(node.defeat ?? []),
  ]);
  return [
    ...perNode,
    ...(SM_CAMPAIGN_DEFINITION.everyNodeVictory ?? []),
    ...Object.values(SM_CAMPAIGN_DEFINITION.conditionalInstructions ?? {}),
  ];
}

function fieldsIn(value: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) fieldsIn(item, found);
    return found;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.field === "string") found.add(record.field);
    for (const v of Object.values(record)) fieldsIn(v, found);
  }
  return found;
}

function instructionListIdsIn(value: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) instructionListIdsIn(item, found);
    return found;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (
      record.kind === "appendToList" &&
      record.field === "reputationSetups" &&
      record.value &&
      typeof record.value === "object" &&
      (record.value as { readonly kind?: string }).kind === "const"
    ) {
      found.add((record.value as { readonly value: unknown }).value as string);
    }
    for (const v of Object.values(record)) instructionListIdsIn(v, found);
  }
  return found;
}

describe("SM_CAMPAIGN_DEFINITION", () => {
  it("campaignId matches the @mc/content Campaign record, and the version and loss policy are present", () => {
    expect(SM_CAMPAIGN_DEFINITION.campaignId).toBe(SM_CAMPAIGN_RECORD.id);
    expect(SM_CAMPAIGN_DEFINITION.version).toBe("1");
    expect(SM_CAMPAIGN_DEFINITION.loss).toEqual({ retry: "byInstruction", retryBaseline: "nodeStart" });
  });

  it("is a fully-connected linear graph of 5 uniquely-id'd nodes, in the content record's scenario order", () => {
    const graph = SM_CAMPAIGN_DEFINITION.graph;
    expect(graph.kind).toBe("linear");
    if (graph.kind !== "linear") return;
    const ids = graph.nodes.map((node) => node.id);
    expect(ids).toEqual(["sandman", "venom", "mysterio", "sinister-six", "venom-goblin"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every node's scenario resolves in @mc/content, belongs to the sm pack, and matches the content record's order", () => {
    const graph = SM_CAMPAIGN_DEFINITION.graph;
    if (graph.kind !== "linear") throw new Error("expected a linear graph");
    const byId = new Map(SM_SCENARIOS.map((scenario) => [scenario.id as string, scenario]));
    const scenarioIds = graph.nodes.map((node) => {
      expect(node.scenario.kind, node.id).toBe("fixed");
      if (node.scenario.kind !== "fixed") throw new Error(`${node.id}: expected a fixed scenario`);
      const scenario = byId.get(node.scenario.scenarioId as string);
      expect(scenario, `${node.id}: scenario ${node.scenario.scenarioId} is not registered`).toBeDefined();
      expect(scenario?.packCode, node.id).toBe(SM_CAMPAIGN_RECORD.packCode);
      return node.scenario.scenarioId as string;
    });
    expect(scenarioIds).toEqual(SM_CAMPAIGN_RECORD.scenarioIds.map((id) => id as string));
  });

  it("every instruction id is unique, prefixed 'sm.', and cites 'MC27 p. N'", () => {
    const instructions = allInstructions();
    const ids = instructions.map((instruction) => instruction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const instruction of instructions) {
      expect(instruction.id.startsWith("sm."), instruction.id).toBe(true);
      expect(instruction.citation, instruction.id).toMatch(/^MC27 p\. \d+( \(RRG 1\.8 p\. 67 erratum\))?$/);
    }
  });

  it("every LogFieldDef cites 'MC27 p. N'", () => {
    for (const field of SM_CAMPAIGN_DEFINITION.logFields) {
      expect(field.citation, field.id).toMatch(/^MC27 p\. \d+$/);
    }
  });

  it("every field an instruction reads or writes is declared in logFields", () => {
    const declared = new Set(SM_CAMPAIGN_DEFINITION.logFields.map((field) => field.id));
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) fieldsIn(instruction.step, referenced);
    for (const field of referenced) expect(declared.has(field), field).toBe(true);
  });

  it("every declared LogFieldDef is read or written by at least one instruction (no dead fields)", () => {
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) fieldsIn(instruction.step, referenced);
    for (const field of SM_CAMPAIGN_DEFINITION.logFields) {
      expect(referenced.has(field.id), `${field.id} is never read or written`).toBe(true);
    }
  });

  it("every inGame instruction's effects pass the DSL validator", () => {
    for (const instruction of allInstructions()) {
      if (instruction.step.kind !== "inGame") continue;
      expect(validateDefinition(action(...instruction.step.effects)), instruction.id).toEqual([]);
    }
  });

  it("every reputationSetups id the reputation track can append resolves in conditionalInstructions", () => {
    const appended = instructionListIdsIn(SM_CAMPAIGN_DEFINITION.everyNodeVictory);
    expect(appended.size).toBeGreaterThan(0);
    const declared = new Set(Object.keys(SM_CAMPAIGN_DEFINITION.conditionalInstructions ?? {}));
    for (const id of appended) expect(declared.has(id), id).toBe(true);
    // And every declared conditional instruction is reachable from some node crossing (no dead entries).
    for (const id of declared) expect(appended.has(id), id).toBe(true);
  });

  it("every literal S.H.I.E.L.D. Tech card id the node 13 flip branches on resolves in the sm pool", () => {
    const pool = new Set(SM_CARDS.map((card) => card.id as string));
    const flips = SM_CAMPAIGN_DEFINITION.conditionalInstructions;
    void flips; // node 13's flip is inline in everyNodeVictory, not a conditionalInstruction; checked via ids below.
    const named = new Set<string>();
    for (const instruction of SM_CAMPAIGN_DEFINITION.everyNodeVictory ?? []) {
      const ids = new Set<string>();
      const collect = (value: unknown): void => {
        if (Array.isArray(value)) {
          for (const item of value) collect(item);
          return;
        }
        if (value !== null && typeof value === "object") {
          const record = value as Record<string, unknown>;
          if (record.kind === "setGrantFace" && record.card && typeof record.card === "object") {
            const card = record.card as { readonly kind?: string; readonly value?: unknown };
            if (card.kind === "const") ids.add(card.value as string);
          }
          for (const v of Object.values(record)) collect(v);
        }
      };
      collect(instruction.step);
      for (const id of ids) named.add(id);
    }
    expect(named.size).toBe(8);
    for (const id of named) expect(pool.has(id), id).toBe(true);
  });

  it("lists exactly the printed bullets of each scenario, in printed order", () => {
    const graph = SM_CAMPAIGN_DEFINITION.graph;
    if (graph.kind !== "linear") throw new Error("expected a linear graph");
    const listed = Object.fromEntries(
      graph.nodes.map((node) => [
        node.id,
        {
          composition: (node.composition ?? []).map((instruction) => instruction.id),
          setup: node.setup.map((instruction) => instruction.id),
          victory: node.victory.map((instruction) => instruction.id),
          defeat: (node.defeat ?? []).map((instruction) => instruction.id),
        },
      ]),
    );
    expect(listed).toEqual({
      sandman: {
        composition: ["sm.s1.composition.sets"],
        setup: [
          "sm.s1.setup.public-outcry",
          "sm.s1.setup.smear-campaign",
          "sm.s1.setup.community-service-pick",
          "sm.s1.setup.community-service",
        ],
        victory: ["sm.s1.victory.community-service", "sm.s1.victory.hp"],
        defeat: [],
      },
      venom: {
        composition: ["sm.s2.composition.sets"],
        setup: [
          "sm.s2.setup.public-outcry",
          "sm.s2.setup.smear-campaign",
          "sm.s2.setup.community-service-pick",
          "sm.s2.setup.community-service",
          "sm.s2.setup.hp-set",
          "sm.s2.setup.heal",
          "sm.s2.setup.boost-cards",
        ],
        victory: ["sm.s2.victory.community-service", "sm.s2.victory.hp"],
        defeat: [],
      },
      mysterio: {
        composition: ["sm.s3.composition.sets", "sm.s3.composition.venom"],
        setup: [
          "sm.s3.setup.venom",
          "sm.s3.setup.public-outcry",
          "sm.s3.setup.smear-and-snitches",
          "sm.s3.setup.community-service-pick",
          "sm.s3.setup.community-service",
          "sm.s3.setup.hp-set",
          "sm.s3.setup.heal",
          "sm.s3.setup.shuffle-top-2",
        ],
        victory: ["sm.s3.victory.community-service", "sm.s3.victory.waking-nightmare", "sm.s3.victory.hp"],
        defeat: [],
      },
      "sinister-six": {
        composition: ["sm.s4.composition.sets", "sm.s4.composition.venom"],
        setup: [
          "sm.s4.setup.venom",
          "sm.s4.setup.public-outcry",
          "sm.s4.setup.smear-and-snitches",
          "sm.s4.setup.community-service-pick",
          "sm.s4.setup.community-service",
          "sm.s4.setup.waking-nightmare-threat",
          "sm.s4.setup.hp-set",
          "sm.s4.setup.heal",
        ],
        victory: ["sm.s4.victory.community-service", "sm.s4.victory.last-ones-standing", "sm.s4.victory.hp"],
        defeat: [],
      },
      "venom-goblin": {
        composition: ["sm.s5.composition.sets"],
        setup: [
          "sm.s5.setup.public-outcry",
          "sm.s5.setup.smear-campaign",
          "sm.s5.setup.sinister-assault",
          "sm.s5.setup.hp-set",
          "sm.s5.setup.heal",
          "sm.s5.setup.extra-threat",
        ],
        victory: ["sm.s5.victory.win", "sm.s5.victory.final-score"],
        defeat: ["sm.s5.defeat.lose-campaign"],
      },
    });
  });

  it("round-trips through JSON", () => {
    expect(JSON.parse(JSON.stringify(SM_CAMPAIGN_DEFINITION))).toEqual(SM_CAMPAIGN_DEFINITION);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Driven through the runner: node 1's S.H.I.E.L.D. Tech deal and Community Service's recorded-title exclusion
// ---------------------------------------------------------------------------------------------------------------

const DEPS: CampaignDeps = { pool: WAVE5_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: SM_CAMPAIGN_DEFINITION.campaignId } };
const SHIELD_TECH_IDS = SM_CARDS.filter(
  (card) => "specificTo" in card && (card.specificTo?.encounterSetId as string | undefined) === "shield_tech",
).map((card) => card.id as string);
const COMMUNITY_SERVICE_IDS = ["27176", "27177", "27178", "27179", "27180"];
const NODES = ["sandman", "venom", "mysterio", "sinister-six", "venom-goblin"] as const;

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = SM_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no sm starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

const SEATS: readonly CampaignSeatSetup[] = [seatFor("ghost-spider", 1), seatFor("spider-man-morales", 2)];

const newLog = (seed: number): CampaignLog =>
  createCampaignLog(SM_CAMPAIGN_DEFINITION, {
    id: `sm-${seed}`,
    seats: SEATS,
    modes: STANDARD,
    poolVersion: "test",
    seed,
  });

const won = (nodeId: string, records: CampaignGameResult["records"]): CampaignGameResult => ({
  nodeId,
  outcome: "won",
  records,
  removedFromCampaign: [],
  logWrites: [],
  expiringGrants: [],
});

/** "Record its title in the 'Community Service' section" (MC27 p. 9/11/13/15), as the finished game computed it. */
const recordCommunityService = (scenario: number, ids: readonly string[]) => ({
  instructionId: `sm.s${scenario}.victory.community-service`,
  write: {
    field: "communityService",
    seatNumber: null,
    mode: "append",
    value: { kind: "cardList", cardIds: ids as readonly CardId[] },
  } satisfies LogWrite,
});

/** MC27 p. 22's Conditions, reduced to "1 victory point": marks exactly node 1 from an empty track. */
const oneVictoryPoint = {
  instructionId: "sm.reputation.conditions",
  write: {
    field: "repVictoryPoints",
    seatNumber: null,
    mode: "set",
    value: { kind: "number", value: 1 },
  } satisfies LogWrite,
};

const composed = (log: CampaignLog): CampaignLog => {
  const outcome = resolveBetweenGames(SM_CAMPAIGN_DEFINITION, log, DEPS, log.modes);
  if (outcome.kind !== "done") throw new Error(`unexpected choice ${outcome.choice.slot} before ${log.id}'s game`);
  return outcome.value;
};

/** The Community Service side scheme this scenario's setup drew (the hidden per-scenario `cardRef`). */
const dealtCommunityService = (log: CampaignLog): string | undefined => {
  const value = log.hidden.communityServiceDealt;
  return value?.kind === "cardRef" && value.cardId !== "" ? value.cardId : undefined;
};

const recordedCommunityService = (log: CampaignLog): readonly string[] => {
  const value = log.shared.communityService;
  return value?.kind === "cardList" ? value.cardIds : [];
};

describe("SM_CAMPAIGN_DEFINITION node 1's reward: 'Deal 3 S.H.I.E.L.D. Tech at random to a player' (MC27 p. 22)", () => {
  const KEY = { instructionId: "sm.reputation.mark", slot: "shieldTech" } as const;
  const afterSandman = (answers: readonly CampaignChoiceAnswer[]) =>
    applyCampaignResult(
      SM_CAMPAIGN_DEFINITION,
      composed(newLog(7)),
      won("sandman", [oneVictoryPoint]),
      { at: 0, gameId: "sm-sandman" },
      DEPS,
      answers,
    );

  it("each player is offered exactly the three cards dealt to them, and may keep one", () => {
    const first = afterSandman([]);
    if (first.kind !== "pending") throw new Error("expected seat 1's S.H.I.E.L.D. Tech choice");
    expect(first.choice).toMatchObject({ ...KEY, seatNumber: 1, count: 1, optional: true, citation: "MC27 p. 22" });
    expect(first.choice.options).toHaveLength(3);
    for (const option of first.choice.options) expect(SHIELD_TECH_IDS).toContain(option);
    // Only the dealt three: any of the other five is refused.
    const undealt = SHIELD_TECH_IDS.find((id) => !first.choice.options.includes(id));
    if (!undealt) throw new Error("all eight were dealt");
    expect(() => afterSandman([{ ...KEY, seatNumber: 1, picked: [undealt] }])).toThrow(/not one of its options/);
  });

  it("the kept card is granted and recorded; the other two are returned, and the next player's deal excludes it", () => {
    const first = afterSandman([]);
    if (first.kind !== "pending") throw new Error("expected seat 1's S.H.I.E.L.D. Tech choice");
    const [kept1, ...returned1] = first.choice.options;
    if (!kept1) throw new Error("nothing dealt");
    const second = afterSandman([{ ...KEY, seatNumber: 1, picked: [kept1] }]);
    if (second.kind !== "pending") throw new Error("expected seat 2's S.H.I.E.L.D. Tech choice");
    expect(second.choice.seatNumber).toBe(2);
    expect(second.choice.options).toHaveLength(3);
    expect(second.choice.options).not.toContain(kept1);
    const [kept2] = second.choice.options;
    if (!kept2) throw new Error("nothing dealt");

    const done = afterSandman([
      { ...KEY, seatNumber: 1, picked: [kept1] },
      { ...KEY, seatNumber: 2, picked: [kept2] },
    ]);
    if (done.kind !== "done") throw new Error("unexpected further choice");
    const [seat1, seat2] = done.value.seats;
    expect(seat1?.grants.map((grant) => grant.cardId)).toEqual([kept1]);
    expect(seat1?.fields.shieldTech).toEqual({ kind: "cardRef", cardId: kept1 });
    const seat1Cards = seat1?.deck.cards.map((line) => line.cardId as string) ?? [];
    expect(seat1Cards).toContain(kept1);
    for (const other of returned1) expect(seat1Cards).not.toContain(other);
    expect(seat2?.grants.map((grant) => grant.cardId)).toEqual([kept2]);
    expect(seat2?.fields.shieldTech).toEqual({ kind: "cardRef", cardId: kept2 });
  });

  it("a player who declines is granted nothing and records nothing", () => {
    const done = afterSandman([
      { ...KEY, seatNumber: 1, picked: [] },
      { ...KEY, seatNumber: 2, picked: [] },
    ]);
    if (done.kind !== "done") throw new Error("unexpected further choice");
    for (const seat of done.value.seats) {
      expect(seat.grants).toEqual([]);
      expect(seat.fields.shieldTech).toBeUndefined();
    }
  });

  it("a scenario that marks no node deals nothing", () => {
    const done = applyCampaignResult(
      SM_CAMPAIGN_DEFINITION,
      composed(newLog(7)),
      won("sandman", []),
      { at: 0, gameId: "sm-sandman" },
      DEPS,
    );
    expect(done.kind).toBe("done");
  });
});

describe("SM_CAMPAIGN_DEFINITION Community Service: 'at random that does not have its title recorded' (MC27 p. 11/13/15)", () => {
  /** Plays scenarios 1-4, recording the drawn scheme as defeated where `defeated(n)` says so. */
  const playFour = (seed: number, defeated: (scenario: number) => boolean) => {
    let log = newLog(seed);
    const draws: { readonly drawn: string; readonly recordedBefore: readonly string[] }[] = [];
    for (let scenario = 1; scenario <= 4; scenario++) {
      const ready = composed(log);
      const drawn = dealtCommunityService(ready);
      if (!drawn) throw new Error(`scenario ${scenario} drew no Community Service scheme`);
      draws.push({ drawn, recordedBefore: recordedCommunityService(log) });
      const records = defeated(scenario) ? [recordCommunityService(scenario, [drawn])] : [];
      const applied = applyCampaignResult(
        SM_CAMPAIGN_DEFINITION,
        ready,
        won(NODES[scenario - 1] as string, records),
        { at: scenario, gameId: `sm-${seed}-${scenario}` },
        DEPS,
      );
      if (applied.kind !== "done") throw new Error(`unexpected choice after scenario ${scenario}`);
      log = applied.value;
    }
    return { draws, log };
  };

  it("scenarios 2-4 never draw a recorded title, so four defeated schemes are four different titles", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { draws, log } = playFour(seed, () => true);
      for (const { drawn, recordedBefore } of draws) {
        expect(COMMUNITY_SERVICE_IDS).toContain(drawn);
        expect(recordedBefore, `seed ${seed}`).not.toContain(drawn);
      }
      expect(new Set(draws.map((draw) => draw.drawn)).size, `seed ${seed}`).toBe(4);
      expect(recordedCommunityService(log)).toEqual(draws.map((draw) => draw.drawn));
    }
  });

  it("with three titles recorded (the most the box can reach), scenario 4 draws one of the two left", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { draws } = playFour(seed, () => true);
      const last = draws[3];
      if (!last) throw new Error("scenario 4 did not draw");
      expect(last.recordedBefore).toHaveLength(3);
      const left = COMMUNITY_SERVICE_IDS.filter((id) => !last.recordedBefore.includes(id));
      expect(left).toHaveLength(2);
      expect(left).toContain(last.drawn);
    }
  });

  it("only a recorded (defeated) title is excluded: an undefeated draw can come up again", () => {
    // Nothing recorded, so scenarios 2-4 draw from all five, and across seeds some title repeats.
    const repeated = Array.from({ length: 25 }, (_, at) => playFour(at + 1, () => false)).some(
      ({ draws }) => new Set(draws.map((draw) => draw.drawn)).size < draws.length,
    );
    expect(repeated).toBe(true);
  });

  it("scenario 1 prints no exclusion; scenarios 2-4 print it", () => {
    const graph = SM_CAMPAIGN_DEFINITION.graph;
    if (graph.kind !== "linear") throw new Error("expected a linear graph");
    const picks = graph.nodes.slice(0, 4).map((node) => {
      const pick = node.setup.find((instruction) => instruction.id.endsWith(".community-service-pick"));
      const step = pick?.step;
      if (step?.kind !== "betweenGames") throw new Error(`${node.id}: no between-games pick`);
      const [random] = step.ops;
      return random?.kind === "random" ? random.from.kind : undefined;
    });
    expect(picks).toEqual(["cards", "excludingTitles", "excludingTitles", "excludingTitles"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Driven into a real game: cards brought in from outside the game (file header gap 2, closed)
// ---------------------------------------------------------------------------------------------------------------

const VENOM_ALLY = "27190";
const HELICARRIER = "01092";
const SYMBIOTE_SUIT = "27191";

/** Composes `log`'s next node and builds its real game from `wave5Scenario`, settled to the first player phase. */
/** `trimEncounter` edits the built encounter deck before setup (node 9's "no minion to find" case strips the minions). */
function realGame(
  log: CampaignLog,
  targetNode: string,
  pick: Picker = firstLegal,
  trimEncounter: (ids: readonly CardId[]) => readonly CardId[] = (ids) => ids,
): GameState {
  const ready = composed(log);
  const start = startGameFromLog(SM_CAMPAIGN_DEFINITION, ready);
  if (start.nodeId !== targetNode) throw new Error(`expected to compose ${targetNode}, got ${start.nodeId}`);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config: GameSetupConfig = wave5Scenario(start.scenarioId, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: log.modes,
  });
  const created = createGame(
    {
      ...config,
      encounterDeck: trimEncounter([
        ...config.encounterDeck,
        ...cardsOfComposedSets(WAVE5_CARDS, start.encounterSets.deck),
      ]),
      setAside: [...(config.setAside ?? []), ...cardsOfComposedSets(WAVE5_CARDS, start.encounterSets.setAside)],
      campaign: start.input,
    },
    WAVE5_DEPS,
  );
  if (!created.ok) throw new Error(`${targetNode}: setup failed: ${created.error.message}`);
  return settleGame(created.state, pick, (state) => state.step.phase === "player", WAVE5_DEPS);
}

/** A log that has won the scenarios before `nodeIndex` (0-based), nothing recorded, no node marked. */
function logAt(nodeIndex: number, seed = 11): CampaignLog {
  let log = newLog(seed);
  for (let index = 0; index < nodeIndex; index++) {
    const applied = applyCampaignResult(
      SM_CAMPAIGN_DEFINITION,
      composed(log),
      won(NODES[index] as string, []),
      { at: index, gameId: `sm-${seed}-${index}` },
      DEPS,
    );
    if (applied.kind !== "done") throw new Error(`unexpected choice after ${NODES[index]}`);
    log = applied.value;
  }
  return log;
}

/** Every instance of `id` in the game, and where it is. */
function instancesOf(state: GameState, id: string) {
  const ids = Object.values(state.instances).filter((instance) => (instance.cardId as string) === id);
  const inPlay = cardsInPlay(state);
  const inAnyPlayerDeckZone = (instanceId: string) =>
    state.players.some(
      (player) =>
        player.deck.includes(instanceId as never) ||
        player.hand.includes(instanceId as never) ||
        player.discard.includes(instanceId as never),
    );
  return ids.map((instance) => ({
    instance,
    inPlay: inPlay.includes(instance.instanceId),
    inPlayerDeckZone: inAnyPlayerDeckZone(instance.instanceId),
    setAside: state.encounterSetAside.includes(instance.instanceId),
  }));
}

describe('SM_CAMPAIGN_DEFINITION scenarios 3 and 4: "Put the Venom (190) ally card into play under the first player\'s control" (MC27 p. 13/15)', () => {
  it.each([
    ["mysterio", 2],
    ["sinister-six", 3],
  ] as const)(
    "%s: at round 1 Venom is in play, controlled and owned by the first player, and in no deck",
    (node, index) => {
      const log = logAt(index);
      const start = startGameFromLog(SM_CAMPAIGN_DEFINITION, composed(log));
      expect(start.input.setAsideCards).toEqual([VENOM_ALLY]);

      const state = realGame(log, node);
      expect(state.round).toBe(1);
      const venoms = instancesOf(state, VENOM_ALLY);
      expect(venoms).toHaveLength(1);
      const [venom] = venoms;
      expect(venom?.inPlay).toBe(true);
      expect(venom?.inPlayerDeckZone).toBe(false);
      expect(venom?.instance).toMatchObject({ controllerId: state.firstPlayerId, ownerId: state.firstPlayerId });
      const firstPlayer = state.players.find((player) => player.playerId === state.firstPlayerId);
      expect(firstPlayer?.playArea).toContain(venom?.instance.instanceId);
    },
  );

  it("no other scenario brings Venom (190) in", () => {
    for (const [index, node] of [
      [0, "sandman"],
      [1, "venom"],
      [4, "venom-goblin"],
    ] as const) {
      const start = startGameFromLog(SM_CAMPAIGN_DEFINITION, composed(logAt(index)));
      expect(start.nodeId).toBe(node);
      expect(start.input.setAsideCards).toBeUndefined();
    }
  });
});

describe('SM_CAMPAIGN_DEFINITION nodes 21 and 25\'s rewards: "Each player may search their collection for a Helicarrier / Symbiote Suit … and put it into play under their control" (MC27 p. 22)', () => {
  /** The first scenario's log, with the reputation track's appended "Setup:" ids as nodes 21/25 would leave them. */
  const withReputationSetups = (ids: readonly string[]): CampaignLog => {
    const log = newLog(13);
    return { ...log, shared: { ...log.shared, reputationSetups: { kind: "instructionList", ids } } };
  };

  /** Player 1 takes the offered card; every other player declines ("may"). */
  const p1Takes =
    (slot: string): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === slot) {
        const first = choice.options[0];
        return choice.playerId === state.players[0]?.playerId && first ? [first.optionId] : [];
      }
      return firstLegal(state);
    };

  it.each([
    [21, ["sm.rep.node21.reward.set-aside", "sm.rep.node21.reward"], HELICARRIER, "sm.rep.node21.reward.card"],
    [25, ["sm.rep.node25.reward.set-aside", "sm.rep.node25.reward"], SYMBIOTE_SUIT, "sm.rep.node25.reward.card"],
  ] as const)(
    "marking node %i appends its reward to the next scenario's setup, which puts the card into play",
    (node, ids, card, slot) => {
      // One node short of `node`, then Sandman's 1 victory point marks exactly that node.
      const fresh = newLog(17);
      const nearly = {
        ...fresh,
        shared: { ...fresh.shared, reputation: { kind: "number" as const, value: node - 1 } },
      };
      const applied = applyCampaignResult(
        SM_CAMPAIGN_DEFINITION,
        composed(nearly),
        won("sandman", [oneVictoryPoint]),
        { at: 0, gameId: "sm-sandman" },
        DEPS,
      );
      if (applied.kind !== "done") throw new Error(`unexpected choice ${applied.choice.slot}`);
      expect(applied.value.shared.reputation).toEqual({ kind: "number", value: node });
      const setups = applied.value.shared.reputationSetups;
      expect(setups?.kind === "instructionList" ? setups.ids : []).toEqual(expect.arrayContaining([...ids]));

      const state = realGame(applied.value, "venom", p1Takes(slot));
      const taken = instancesOf(state, card).filter((copy) => copy.inPlay);
      expect(taken).toHaveLength(1);
      expect(taken[0]?.instance).toMatchObject({ controllerId: state.players[0]?.playerId });
    },
  );

  it.each([
    [
      "Helicarrier",
      HELICARRIER,
      ["sm.rep.node21.reward.set-aside", "sm.rep.node21.reward"],
      "sm.rep.node21.reward.card",
    ],
    [
      "Symbiote Suit",
      SYMBIOTE_SUIT,
      ["sm.rep.node25.reward.set-aside", "sm.rep.node25.reward"],
      "sm.rep.node25.reward.card",
    ],
  ] as const)(
    "%s: one copy per player is set aside; the player who takes it has it in play, owned, and no deck holds it",
    (_name, card, ids, slot) => {
      const log = withReputationSetups(ids);
      const start = startGameFromLog(SM_CAMPAIGN_DEFINITION, composed(log));
      expect(start.input.setAsideCards).toEqual([card, card]);

      const state = realGame(log, "sandman", p1Takes(slot));
      expect(state.round).toBe(1);
      const [p1, p2] = state.players;
      if (!p1 || !p2) throw new Error("expected two players");
      const copies = instancesOf(state, card);
      expect(copies).toHaveLength(2);
      for (const copy of copies) expect(copy.inPlayerDeckZone).toBe(false);
      // Player 1 took one: in play under their control and now theirs (RRG 1.8 "Ownership and Control", p. 31).
      const taken = copies.filter((copy) => copy.inPlay);
      expect(taken).toHaveLength(1);
      expect(taken[0]?.instance).toMatchObject({ controllerId: p1.playerId, ownerId: p1.playerId });
      // The support sits in their play area; the upgrade is on their identity, as when it is played.
      const identityAttachments = state.instances[p1.identity.instanceId]?.attachments ?? [];
      expect([...p1.playArea, ...identityAttachments]).toContain(taken[0]?.instance.instanceId);
      expect(taken[0]?.instance.attachedTo).toBe(card === SYMBIOTE_SUIT ? p1.identity.instanceId : null);
      // Player 2 declined ("may"): their copy stays set aside, out of play and owned by nobody.
      const declined = copies.filter((copy) => !copy.inPlay);
      expect(declined).toHaveLength(1);
      expect(declined[0]).toMatchObject({ setAside: true, instance: { ownerId: null, controllerId: null } });
      expect(
        cardsInPlay(state).some(
          (id) => state.instances[id]?.controllerId === p2.playerId && (state.instances[id]?.cardId as string) === card,
        ),
      ).toBe(false);
    },
  );

  it("without the node marked, nothing is set aside and no Helicarrier or Symbiote Suit enters play", () => {
    const log = newLog(13);
    expect(startGameFromLog(SM_CAMPAIGN_DEFINITION, composed(log)).input.setAsideCards).toBeUndefined();
    const state = realGame(log, "sandman");
    expect(instancesOf(state, SYMBIOTE_SUIT)).toEqual([]);
    expect(instancesOf(state, HELICARRIER).some((copy) => copy.inPlay)).toBe(false);
  });
});

describe('SM_CAMPAIGN_DEFINITION node 17\'s penalty: "Setup: The first player must search the encounter deck and discard pile for a scenario-specific side scheme, then reveal it. Place 1[per_hero] threat on that side scheme. (Shuffle.)" (MC27 p. 22)', () => {
  const PENALTY = "sm.rep.node17.penalty";
  const SLOT = "node17scheme";
  const nameOf = (state: GameState, instanceId: string) =>
    state.cardPool[state.instances[instanceId as never]?.cardId as string]?.name;
  const setsOf = (state: GameState, instanceId: string): readonly string[] => {
    const card = state.cardPool[state.instances[instanceId as never]?.cardId as string];
    return card && "encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : [];
  };
  /** Every side scheme in the encounter deck or discard pile right now. */
  const searchableSideSchemes = (state: GameState): readonly string[] =>
    state.encounterDeckOrder
      .flatMap((deckId) => [
        ...(state.encounterDecks[deckId]?.deck ?? []),
        ...(state.encounterDecks[deckId]?.discard ?? []),
      ])
      .filter((id) => state.cardPool[state.instances[id]?.cardId as string]?.type === "side_scheme");

  /** The log of scenario `index` (0-based), with node 17's penalty appended as marking node 17 leaves it. */
  const withPenalty = (index: number): CampaignLog => {
    const log = logAt(index);
    return { ...log, shared: { ...log.shared, reputationSetups: { kind: "instructionList", ids: [PENALTY] } } };
  };

  /** Records node 17's search prompt and answers it with the copy of `pickName` (or the first option). */
  const recordingPicker = (pickName?: string) => {
    const seen: {
      offered: readonly string[];
      searchable: readonly string[];
      chooser: string;
      firstPlayer: string;
      min: number;
      max: number;
      picked?: string;
    }[] = [];
    const pick: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === SLOT) {
        const offered = choice.options.map((option) => option.optionId);
        const picked = offered.find((id) => pickName === undefined || nameOf(state, id) === pickName);
        seen.push({
          offered,
          searchable: searchableSideSchemes(state),
          chooser: choice.playerId,
          firstPlayer: state.firstPlayerId,
          min: choice.minSelections,
          max: choice.maxSelections,
          ...(picked ? { picked } : {}),
        });
        return picked ? [picked] : [];
      }
      return firstLegal(state);
    };
    return { seen, pick };
  };

  // Each pick has no Hinder or When Revealed threat of its own (Joy Ride's Hinder 2[per_hero] would add to the count).
  it.each([
    ["venom", 1, "venom", ["Guard the Bell Tower", "Lashing Out", "Tooth and Nail"], "Lashing Out"],
    ["sinister-six", 3, "sinister_six", ["Brute Force Barricade"], "Brute Force Barricade"],
    ["venom-goblin", 4, "venom_goblin", ["Festering Mass", "Joy Ride"], "Festering Mass"],
  ] as const)(
    "%s: the first player picks among the scenario's own side schemes only; the picked one is revealed with 1[per_hero] threat added",
    (node, index, ownSet, ownNames, pickName) => {
      const { seen, pick } = recordingPicker(pickName);
      const state = realGame(withPenalty(index), node, pick);
      expect(state.round).toBe(1);
      expect(seen).toHaveLength(1);
      const [search] = seen;
      if (!search?.picked) throw new Error(`${node}: nothing to pick`);
      expect(search.chooser).toBe(search.firstPlayer);
      expect({ min: search.min, max: search.max }).toEqual({ min: 1, max: 1 });

      // Exactly the scenario-specific side schemes in the deck and discard pile are offered, every copy of them.
      const offeredNames = new Set(search.offered.map((id) => nameOf(state, id)));
      expect([...offeredNames].sort()).toEqual([...ownNames].sort());
      for (const id of search.offered) expect(setsOf(state, id)).toContain(ownSet);
      // The modular and campaign side schemes in the same deck (Down to Earth's, Goblin Gear's, Guerrilla Tactics',
      // the Community Service draw) are never offered.
      const notOffered = search.searchable.filter((id) => !search.offered.includes(id));
      expect(notOffered.length, `${node}: no non-scenario side scheme was in the deck to exclude`).toBeGreaterThan(0);
      for (const id of notOffered) expect(setsOf(state, id)).not.toContain(ownSet);
      for (const id of notOffered) expect(cardsInPlay(state)).not.toContain(id);

      // "Then reveal it. Place 1[per_hero] threat on that side scheme": in play with its starting threat plus 2.
      const revealed = state.instances[search.picked as never];
      expect(cardsInPlay(state)).toContain(search.picked);
      expect(state.villainArea).toContain(search.picked);
      const card = state.cardPool[revealed?.cardId as string];
      if (card?.type !== "side_scheme") throw new Error("not a side scheme");
      const starting = card.startingThreat.base + card.startingThreat.perPlayer * state.players.length;
      expect(state.players).toHaveLength(2);
      expect(revealed?.threat).toBe(starting + 2);
      // The other copies/schemes stay in the encounter deck or discard pile.
      for (const id of search.offered.filter((other) => other !== search.picked)) {
        expect(cardsInPlay(state)).not.toContain(id);
      }
    },
  );

  it("mysterio: the Mysterio set prints no side scheme, so nothing is offered and nothing is revealed", () => {
    const { seen, pick } = recordingPicker();
    const without = realGame(logAt(2), "mysterio");
    const state = realGame(withPenalty(2), "mysterio", pick);
    expect(state.round).toBe(1);
    expect(seen).toEqual([]);
    // Personal Nightmare's side schemes (and the Community Service draw) are in the deck, and stay there.
    const searchable = searchableSideSchemes(state);
    expect(searchable.length).toBeGreaterThan(0);
    for (const id of searchable) expect(setsOf(state, id)).not.toContain("mysterio");
    const sideSchemesInPlay = (game: GameState) =>
      cardsInPlay(game)
        .filter((id) => game.cardPool[game.instances[id]?.cardId as string]?.type === "side_scheme")
        .map((id) => nameOf(game, id))
        .sort();
    expect(sideSchemesInPlay(state)).toEqual(sideSchemesInPlay(without));
  });

  it("marking node 17 appends the penalty (with the reward) to every remaining scenario's setup", () => {
    const fresh = newLog(17);
    const nearly = { ...fresh, shared: { ...fresh.shared, reputation: { kind: "number" as const, value: 16 } } };
    const answers: CampaignChoiceAnswer[] = [];
    for (let guard = 0; guard < 5; guard++) {
      const applied = applyCampaignResult(
        SM_CAMPAIGN_DEFINITION,
        composed(nearly),
        won("sandman", [oneVictoryPoint]),
        { at: 0, gameId: "sm-sandman" },
        DEPS,
        answers,
      );
      if (applied.kind === "done") {
        expect(applied.value.shared.reputation).toEqual({ kind: "number", value: 17 });
        const setups = applied.value.shared.reputationSetups;
        expect(setups?.kind === "instructionList" ? setups.ids : []).toEqual(["sm.rep.node17.reward", PENALTY]);
        return;
      }
      expect(applied.choice.slot).toBe("planningAhead");
      const [first] = applied.choice.options;
      if (!first) throw new Error("no Planning Ahead option");
      answers.push({
        instructionId: applied.choice.instructionId,
        slot: applied.choice.slot,
        seatNumber: applied.choice.seatNumber,
        picked: [first],
      } as CampaignChoiceAnswer);
    }
    throw new Error("node 17's choices did not settle");
  });
});

describe('SM_CAMPAIGN_DEFINITION node 9\'s penalty: "Setup: In player order, each player must search the encounter deck and discard pile for a minion, then put that minion into play engaged with themself. (Shuffle.) For each player who did not put a minion into play this way, deal that player 1 facedown encounter card." (MC27 p. 22)', () => {
  const PENALTY = "sm.rep.node9.penalty";
  const SLOT = "node9minion";
  const SINISTER_SIX = 3;
  const nameOf = (state: GameState, instanceId: string) =>
    state.cardPool[state.instances[instanceId as never]?.cardId as string]?.name;
  const isMinion = (id: string) => WAVE5_CARDS.find((card) => (card.id as string) === id)?.type === "minion";
  const typeOf = (state: GameState, instanceId: string) =>
    state.cardPool[state.instances[instanceId as never]?.cardId as string]?.type;
  const searchableMinions = (state: GameState): readonly string[] =>
    state.encounterDeckOrder
      .flatMap((deckId) => [
        ...(state.encounterDecks[deckId]?.deck ?? []),
        ...(state.encounterDecks[deckId]?.discard ?? []),
      ])
      .filter((id) => typeOf(state, id) === "minion");
  const withPenalty = (index: number): CampaignLog => {
    const log = logAt(index);
    return { ...log, shared: { ...log.shared, reputationSetups: { kind: "instructionList", ids: [PENALTY] } } };
  };

  /** Records each seat's search prompt (with the setup instruction its frame names) and takes the first minion. */
  const recordingPicker = () => {
    const seen: {
      chooser: string;
      offered: readonly string[];
      searchable: readonly string[];
      min: number;
      max: number;
      instruction: unknown;
      picked: string;
    }[] = [];
    const pick: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === SLOT) {
        const offered = choice.options.map((option) => option.optionId);
        const frame = state.stack.find((candidate) => candidate.frameId === choice.frameId);
        const picked = offered[0];
        if (!picked) throw new Error("node 9's search offered nothing");
        seen.push({
          chooser: choice.playerId,
          offered,
          searchable: searchableMinions(state),
          min: choice.minSelections,
          max: choice.maxSelections,
          instruction: frame?.kind === "effects" ? frame.instruction : undefined,
          picked,
        });
        return [picked];
      }
      return firstLegal(state);
    };
    return { seen, pick };
  };

  it("sinister-six: in player order each player must take a minion found (exactly 1, never 0) and it enters play engaged with them; nobody is dealt a card", () => {
    const { seen, pick } = recordingPicker();
    const without = realGame(logAt(SINISTER_SIX), "sinister-six");
    const state = realGame(withPenalty(SINISTER_SIX), "sinister-six", pick);
    expect(state.round).toBe(1);
    expect(seen.map((search) => search.chooser)).toEqual(state.players.map((player) => player.playerId));
    for (const search of seen) {
      // "Must search": a found minion can't be declined for the facedown card (RRG 1.8 "Search", p. 39).
      expect({ min: search.min, max: search.max }).toEqual({ min: 1, max: 1 });
      // Every minion in the encounter deck and discard pile is offered, and nothing else.
      expect([...search.offered].sort()).toEqual([...search.searchable].sort());
      // The choice names the campaign instruction raising it, since no card does.
      expect(search.instruction).toEqual({
        kind: "campaign",
        instructionId: PENALTY,
        text: expect.stringContaining("each player must search the encounter deck and discard pile for a minion"),
        citation: "MC27 p. 22",
      });
      expect(cardsInPlay(state)).toContain(search.picked);
      expect(state.instances[search.picked as never]?.engagedWith).toBe(search.chooser);
    }
    // Guerrilla Tactics' two Life-Size Decoys are the only minions in this deck: one each.
    expect(seen.map((search) => nameOf(state, search.picked))).toEqual(["Life-Size Decoy", "Life-Size Decoy"]);
    expect(new Set(seen.map((search) => search.picked)).size).toBe(2);
    expect(state.players.map((player) => player.dealtEncounter.length)).toEqual(
      without.players.map((player) => player.dealtEncounter.length),
    );
  });

  it("sinister-six with no minion to find: no search prompt, and each player is dealt 1 facedown encounter card instead", () => {
    const { seen, pick } = recordingPicker();
    const noMinions = (ids: readonly CardId[]) => ids.filter((id) => !isMinion(id as string));
    const without = realGame(logAt(SINISTER_SIX), "sinister-six", firstLegal, noMinions);
    const state = realGame(withPenalty(SINISTER_SIX), "sinister-six", pick, noMinions);
    expect(state.round).toBe(1);
    expect(seen).toEqual([]);
    expect(searchableMinions(state)).toEqual([]);
    expect(state.players.map((player) => player.dealtEncounter.length)).toEqual(
      without.players.map((player) => player.dealtEncounter.length + 1),
    );
  });
});
