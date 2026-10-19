/**
 * Fear No Evil (MC60): the campaign definition's composed games, played for real. A log is composed by the runner
 * (`resolveBetweenGames`), its `CampaignGameInput` handed to `wave11Scenario` and `createGame` the way a client must
 * build it, and the board after setup checked against MC60 p. 9 steps 12 to 14 and each scenario's SETUP bullet; then
 * `campaignResultOf` reads the finished game for the VICTORY records (Trust, Mary, removed titles).
 * Runner-level tests (log, position, composed input) are `fne.test.ts`'s.
 */
import { describe, expect, it, vi } from "vitest";
import { CORE_STARTER_DECKS, PLAYABLE_CARDS, cardId, type PlayModes } from "@mc/content";
import {
  activeEncounterDeck,
  cardsInPlay,
  applyCampaignResult,
  campaignResultOf,
  createCampaignLog,
  createGame,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignLog,
  type GameEvent,
  type GameState,
  type InstanceId,
  type LogValue,
} from "@mc/engine";
import { firstLegal, identityOf, inst, patchInstance, settle } from "../testing/harness.js";
import { WAVE11_DEPS } from "../wave11/index.js";
import { wave11Scenario, wave11ScenarioRecord } from "../wave11/setup.js";
import {
  FNE_CAMPAIGN_DEFINITION as DEF,
  FNE_FIRST_PLAYTHROUGH,
  FNE_LATER_PLAYTHROUGH,
  FNE_UNDERLING_NODES,
} from "./fne.js";

vi.setConfig({ testTimeout: 600_000 });

const DEPS = { pool: PLAYABLE_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const [AMH, GETAWAY, RACKET, RAFT, PRESSES] = FNE_UNDERLING_NODES as [string, string, string, string, string];
const KINGPIN = "kingpin";

const seat = (starterDeckId: string, seatNumber: number) => {
  const starter = CORE_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId)!;
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
};
const SEATS = [seat("core-spider-man-justice", 1), seat("core-captain-marvel-leadership", 2)];

interface Setup {
  /** Nodes resolved before the game, and how. Every other underling node is the one this game plays. */
  readonly resolved?: Readonly<Record<string, "completed" | "failed">>;
  readonly node: string;
  readonly shared?: Readonly<Record<string, LogValue>>;
  readonly seed?: number;
}

/** Composes the log, answering the first option of anything asked except the node and the first-playthrough question. */
function composed({ resolved = {}, node, shared = {}, seed = 3 }: Setup): CampaignLog {
  const base = createCampaignLog(DEF, {
    id: `fne-game-${seed}`,
    seats: SEATS,
    modes: STANDARD,
    poolVersion: "test",
    seed,
  });
  let log: CampaignLog = {
    ...base,
    position: { ...base.position, resolved },
    shared: { playthrough: { kind: "choice", option: FNE_LATER_PLAYTHROUGH }, ...shared },
  };
  const answers: CampaignChoiceAnswer[] = [];
  for (let round = 0; round < 40; round++) {
    const result = resolveBetweenGames(DEF, log, DEPS, log.modes, answers);
    if (result.kind === "done") return result.value;
    const choice = result.choice;
    answers.push({
      instructionId: choice.instructionId,
      slot: choice.slot,
      seatNumber: choice.seatNumber,
      picked: [choice.slot === "node" ? node : choice.options[0]!],
    });
  }
  throw new Error("a campaign choice kept coming");
}

/** The game a composed log starts, built the way a client builds it. */
function build(log: CampaignLog, node: string) {
  const start = startGameFromLog(DEF, log);
  const record = wave11ScenarioRecord(start.scenarioId as string);
  const config = wave11Scenario(
    start.scenarioId as string,
    {
      players: start.input.seats.map((s) => ({ identityCardId: s.identityCardId, deck: s.deck, aspects: s.aspects })),
      seed: start.input.seed,
      modes: start.modes,
      ...(start.villain ? { villainSetId: start.villain } : {}),
      ...(record.mainSchemeChoice
        ? { mainSchemePicks: record.mainSchemeChoice.cardIds.slice(0, start.input.seats.length) as string[] }
        : {}),
    } as never,
  );
  expect(start.nodeId).toBe(node);
  const created = createGame({ ...config, campaign: start.input }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return { start, config, created };
}

function play(setup: Setup): { log: CampaignLog; state: GameState; opening: GameState; events: readonly GameEvent[] } {
  const log = composed(setup);
  const { created } = build(log, setup.node);
  const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  return { log, state, opening: created.state, events: created.events };
}

const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const all = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((id) => codeOf(s, id) === code);
const threatOf = (s: GameState, code: string): number => inst(s, all(s, code)[0]!).threat;
const inPlay = (s: GameState, code: string): boolean => cardsInPlay(s).some((id) => codeOf(s, id) === code);
const playingSet = (s: GameState): ReadonlySet<InstanceId> => new Set(cardsInPlay(s));

const others = (node: string, as: "completed" | "failed" = "completed"): Record<string, "completed" | "failed"> =>
  Object.fromEntries(FNE_UNDERLING_NODES.filter((n) => n !== node).map((n) => [n, as]));

describe("step 12: the environments, step 13: the Typhoid Mary ally (Kingpin, 2 players)", () => {
  const trust = { trustEstablished: { kind: "flag", value: true } } as const;
  const mixed = {
    [AMH]: "completed",
    [GETAWAY]: "failed",
    [RACKET]: "completed",
    [RAFT]: "failed",
    [PRESSES]: "completed",
  } as const;

  it("places each environment on its Completed or Failed face, resolves its Setup, and puts the ally into play", () => {
    const { state } = play({ node: KINGPIN, resolved: mixed, shared: trust });
    for (const [code, flipped] of [
      ["60205a", false],
      ["60206a", true],
      ["60207a", false],
      ["60208a", true],
      ["60209a", false],
    ] as const) {
      const ids = all(state, code);
      expect(ids, code).toHaveLength(1);
      expect(inst(state, ids[0]!).flipped, code).toBe(flipped);
      expect(inPlay(state, code), code).toBe(true);
    }
    // 60205a Completed: a tough status card on each identity.
    for (const player of state.players)
      expect(inst(state, identityOf(state, player.playerId)).statuses.tough).toBeGreaterThanOrEqual(1);
    // 60209a Completed: each player put a Daily Bugle support into play (the campaign set them aside).
    const supports = ["60153", "60154", "60155", "60156"].filter((code) => all(state, code).length > 0);
    expect(supports.length).toBeGreaterThanOrEqual(2);
    // 60208b Failed: the six Raft Breakout minions are shuffled into the encounter deck.
    const deck = activeEncounterDeck(state).deck.map((id) => codeOf(state, id));
    for (const code of ["60144", "60145", "60146", "60147", "60148", "60149"]) expect(deck, code).toContain(code);
    // Step 13: the ally is in play under a player's control.
    const mary = all(state, "60210a");
    expect(mary).toHaveLength(1);
    expect(inst(state, mary[0]!).controllerId).not.toBeNull();
  });

  it("without Trust Established, no ally; with Mary Defeated, no ally", () => {
    const none = play({ node: KINGPIN, resolved: mixed });
    expect(all(none.state, "60210a")).toHaveLength(0);
    const dead = play({
      node: KINGPIN,
      resolved: mixed,
      shared: { ...trust, maryDefeated: { kind: "flag", value: true } },
    });
    expect(all(dead.state, "60210a")).toHaveLength(0);
  });

  it("Kingpin's SETUP: three Completed environments give each minion in play a tough status card", () => {
    const { state } = play({ node: KINGPIN, resolved: mixed });
    const completed = ["60205a", "60207a", "60209a"].filter((code) => !inst(state, all(state, code)[0]!).flipped);
    expect(completed).toHaveLength(3);
    const minions = Object.keys(state.instances).filter((id) => {
      const instance = inst(state, id as InstanceId);
      return (
        playingSet(state).has(id as InstanceId) &&
        ["minion"].includes(PLAYABLE_CARDS.find((c) => c.id === instance.cardId)?.type ?? "")
      );
    });
    expect(minions.length).toBeGreaterThanOrEqual(1);
    for (const id of minions)
      expect(inst(state, id as InstanceId).statuses.tough, codeOf(state, id as InstanceId)).toBeGreaterThanOrEqual(1);
  });
});

describe("each scenario's SETUP bullet reads the check marks beside it (a lone scenario is drawn twice: two marks)", () => {
  it("Art Museum Heist: 1[per_hero] threat per check mark on the main scheme", () => {
    const { log, state, opening } = play({ node: AMH, resolved: others(AMH) });
    expect(log.shared["checks"]).toEqual({ kind: "number", value: 2 });
    const control = createGame({ ...build(log, AMH).config }, WAVE11_DEPS);
    if (!control.ok) throw new Error(control.error.message);
    const base = settle(control.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
    expect(state.mainScheme.instanceId).toBeDefined();
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(inst(base, base.mainScheme.instanceId).threat + 4);
    expect(opening).toBeDefined();
  });

  it("The Getaway: two marks find and reveal Jackknifed Tanker Truck with extra threat on it", () => {
    const { state } = play({ node: GETAWAY, resolved: others(GETAWAY) });
    expect(all(state, "60131")).toHaveLength(1);
    expect(inPlay(state, "60131")).toBe(true);
    expect(threatOf(state, "60131")).toBeGreaterThanOrEqual(2);
  });

  it("Protection Racket: 1 threat per check mark on each main scheme (standard)", () => {
    const { state } = play({ node: RACKET, resolved: others(RACKET) });
    const schemes = ["60134a", "60135a", "60136a", "60137a", "60138a"].flatMap((code) => all(state, code));
    const mine = [state.mainScheme.instanceId, ...(state.extraMainSchemes ?? []).map((m) => m.instanceId)];
    expect(mine).toHaveLength(2);
    for (const id of mine) expect(inst(state, id).threat).toBeGreaterThanOrEqual(2);
    expect(schemes.length).toBeGreaterThanOrEqual(0);
  });

  it("The Raft Breakout: two marks give each Prisoner minion in play a tough status card", () => {
    const { state } = play({ node: RAFT, resolved: others(RAFT) });
    const prisoners = Object.keys(state.instances).filter((id) => {
      const card = PLAYABLE_CARDS.find((c) => c.id === inst(state, id as InstanceId).cardId);
      return (
        playingSet(state).has(id as InstanceId) &&
        card?.type === "minion" &&
        card.traits.some((t) => (t as string) === "PRISONER")
      );
    });
    expect(prisoners.length).toBeGreaterThanOrEqual(1);
    for (const id of prisoners) expect(inst(state, id as InstanceId).statuses.tough).toBeGreaterThanOrEqual(1);
  });

  it("Stop the Presses!: two marks remove two stamina counters from each Daily Bugle support", () => {
    const { state } = play({ node: PRESSES, resolved: others(PRESSES) });
    const supports = ["60153", "60154", "60155", "60156"]
      .flatMap((code) => all(state, code))
      .filter((id) => playingSet(state).has(id));
    expect(supports.length).toBeGreaterThanOrEqual(2);
    for (const id of supports) expect(inst(state, id).counters["stamina"] ?? 0).toBe(1);
  });
});

describe("VICTORY records read the finished game", () => {
  it("Trust Established (Disturbed Psyche with 2 threat), Mary Defeated (the ally in the victory display), removed titles", () => {
    const first = play({
      node: GETAWAY,
      resolved: others(GETAWAY),
      shared: { trustEstablished: { kind: "flag", value: true } },
    });
    // The ally is in play (step 13); the villain is whoever the draw named (record the scratch flags from this game).
    let state = first.state;
    const mary = all(state, "60210a")[0]!;
    expect(mary).toBeDefined();
    state = {
      ...state,
      victoryDisplay: [...state.victoryDisplay, mary],
      outcome: { result: "win", reason: "villainDefeated" },
    } as GameState;
    const events: GameEvent[] = [
      {
        type: "cardMoved",
        instanceId: all(state, "60153")[0] ?? mary,
        cardId: cardId("60153"),
        from: { kind: "setAside" } as never,
        to: { kind: "removedFromGame" } as never,
      },
    ];
    const result = campaignResultOf(DEF, first.log, state, events, WAVE11_DEPS);
    const written = (field: string) => result.records.filter((r) => r.write.field === field).map((r) => r.write.value);
    expect(written("maryThisGame")).toEqual([{ kind: "flag", value: true }]);
    expect(written("trustThisGame")).toEqual([{ kind: "flag", value: false }]);

    const applied = applyCampaignResult(DEF, first.log, result, { at: 1 }, DEPS);
    if (applied.kind !== "done") throw new Error("unexpected pending choice");
    expect(applied.value.shared["maryDefeated"]).toEqual({ kind: "flag", value: true });
    expect(applied.value.shared["trustEstablished"]).toEqual({ kind: "flag", value: true });
    expect(applied.value.position.resolved[GETAWAY]).toBe("completed");
    void FNE_FIRST_PLAYTHROUGH;
  });

  it("Trust Established is checked when Disturbed Psyche has at least 2 threat on it (a Typhoid Mary game)", () => {
    const log = composed({
      node: AMH,
      resolved: others(AMH),
      shared: {
        unrecordedVillains: { kind: "strikeList", struck: ["bullseye", "electro", "hammerhead", "purple_man"] },
      },
    });
    expect(startGameFromLog(DEF, log).villain).toBe("typhoid_mary");
    const { created } = build(log, AMH);
    const ready = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
    const psyche = all(ready, "60112")[0]!;
    expect(psyche).toBeDefined();
    const check = (threat: number): LogValue | undefined => {
      const ended = patchInstance(ready, psyche, { threat });
      const state = { ...ended, outcome: { result: "win", reason: "villainDefeated" } } as GameState;
      const result = campaignResultOf(DEF, log, state, [], WAVE11_DEPS);
      return result.records.find((r) => r.write.field === "trustThisGame")?.write.value;
    };
    expect(check(1)).toEqual({ kind: "flag", value: false });
    expect(check(2)).toEqual({ kind: "flag", value: true });
  });
});
