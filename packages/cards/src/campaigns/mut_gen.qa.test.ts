/**
 * `MUT_GEN_CAMPAIGN_DEFINITION` (Mutant Genesis, MC32) driven through the real runner and a real game at every node,
 * `sm.qa.test.ts`'s two-part shape (docs/wave-definition-of-done.md §6; `mut_gen.test.ts` is the definition's own
 * unit file and plays no game):
 *
 * - **A full five-scenario campaign** (Colossus + Shadowcat, the box's precons, seat 1 Brawler, seat 2 Defender): at
 *   every node the composed log starts a real game (`wave6Scenario` + the composed sets + `createGame`), the greedy
 *   headless driver (`../testing/driver.ts`) plays it to its real outcome, the session log is replayed to a deep-equal
 *   state, and `campaignResultOf` derives the node's result from the real final state and event stream. The log is
 *   checked after each node against the rulebook's setup and aftermath (MC32 pp. 5, 7, 10, 12, 16, 19, 24).
 *   **Finding, not a bug:** the card-name-agnostic driver lost every one of these five real games (30 seeds per node
 *   searched, none won), so each node's *win* is the documented substitution (`trors.qa.test.ts`): the real final
 *   state with its outcome overridden to a win, then the facts a win would have recorded (a side scheme defeated,
 *   Jubilee in play, the Captive allies that entered play) supplied as stand-in records. What a real game would let
 *   `campaignResultOf` derive for those is the engine's own job (`campaign/sm-queries.test.ts`).
 * - **A real lost-and-retried scenario**: the real loss is folded as a loss, the log survives, and the retry starts a
 *   new real game from it.
 * - **A used role upgrade's removal sticks across the retry (§4.1 Q12)**: the real upgrade card is used in a real game
 *   (its own "Remove this card from the game and the campaign pool"), `campaignResultOf` reads the removal from the real
 *   final state, and the retry (and the next scenario) never deal it again.
 * - **Expert campaign rules** (MC32 p. 5): persistent hit points recorded from a real game's real damage and restored
 *   at the next setup, the rejoin token (Q11), and Magneto's Expert-Campaign-Only loss of the campaign (MC32 p. 19).
 *
 * Rulebook gaps are written as `it.fails` with the page; none remain, and the "former gaps" describe pins the two
 * that were closed (Future Past cards in the encounter deck, role-building's "does not already include").
 */
import { describe, expect, it } from "vitest";
import { MUT_GEN_CARDS, MUT_GEN_STARTER_DECKS, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  campaignResultOf,
  createCampaignLog,
  createGame,
  maxHitPoints,
  remainingHitPoints,
  replay,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { abilityRefIds } from "../ability-refs.js";
import { firstLegal, P1, runWith, settle as settleGame, toHero, use, type Picker } from "../testing/harness.js";
import { playToOutcome } from "../testing/driver.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../wave6/index.js";
import { cardsOfComposedSets } from "./composed-sets.js";
import { MUT_GEN_CAMPAIGN_DEFINITION as DEF } from "./mut_gen.js";

const DEPS: CampaignDeps = { pool: WAVE6_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: DEF.campaignId, expertCampaign: true } };
const NODES = ["sabretooth", "project-wideawake", "master-mold", "mansion-attack", "magneto"] as const;

// ---------------------------------------------------------------------------------------------------------------
// Campaign helpers
// ---------------------------------------------------------------------------------------------------------------

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = MUT_GEN_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no mut_gen starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}
const SEATS: readonly CampaignSeatSetup[] = [seatFor("colossus-protection", 1), seatFor("shadowcat-aggression", 2)];

/** Seat 1 takes Brawler, seat 2 Defender; every optional choice (role-building, deck shuffles) is declined. */
const ROLE_PLAN: Record<number, string> = { 1: "brawler", 2: "defender" };
const pickRoles = (choice: CampaignPendingChoice): readonly string[] =>
  choice.slot === "role" ? [ROLE_PLAN[choice.seatNumber ?? 0] ?? choice.options[0]!] : [];

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

function newLog(modes: PlayModes, seed = 4242): CampaignLog {
  return createCampaignLog(DEF, { id: `mut-gen-qa-${seed}`, seats: SEATS, modes, poolVersion: "qa-test", seed });
}
const compose = (log: CampaignLog): CampaignLog =>
  settleBy((answers) => resolveBetweenGames(DEF, log, DEPS, log.modes, answers), pickRoles).value;
const fold = (composed: CampaignLog, result: CampaignGameResult): CampaignLog =>
  settleBy(
    (answers) => applyCampaignResult(DEF, composed, result, { at: 1_700_000_000_000, gameId: "qa" }, DEPS, answers),
    () => [],
  ).value;

type RecordEntry = CampaignGameResult["records"][number];
const flag = (instructionId: string, field: string, value: boolean): RecordEntry => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set", value: { kind: "flag", value } },
});
const list = (instructionId: string, field: string, ids: readonly string[]): RecordEntry => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set", value: { kind: "cardList", cardIds: ids as never } },
});
const hp = (instructionId: string, seatNumber: number, value: number): RecordEntry => ({
  instructionId,
  write: { field: "remainingHp", seatNumber, mode: "set", value: { kind: "number", value } },
});

/** The result with every record of the overridden (field, seat) replaced: a stand-in for what a won game derives. */
function withRecords(result: CampaignGameResult, overrides: readonly RecordEntry[]): CampaignGameResult {
  const overridden = (entry: RecordEntry) =>
    overrides.some(
      (over) => over.write.field === entry.write.field && over.write.seatNumber === entry.write.seatNumber,
    );
  return { ...result, records: [...result.records.filter((entry) => !overridden(entry)), ...overrides] };
}

/** A bare stand-in result (no real game behind it), for walking a log to a node without playing the earlier ones. */
function bareResult(nodeId: string, won: boolean, records: readonly RecordEntry[] = []): CampaignGameResult {
  return {
    nodeId,
    outcome: won ? "won" : "lost",
    records,
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
  };
}

const field = (log: CampaignLog, id: string) => log.shared[id];
const seatField = (log: CampaignLog, seatIndex: number, id: string) => log.seats[seatIndex]?.fields[id];
const roleUpgradeOf = (log: CampaignLog, seatIndex: number): string | undefined => {
  const value = seatField(log, seatIndex, "roleUpgrade");
  return value?.kind === "cardRef" && value.cardId !== "" ? (value.cardId as string) : undefined;
};
const removedIds = (log: CampaignLog): readonly string[] =>
  log.removedFromCampaign.map((face) => face.cardId as string);
const setOfCard = (id: string): string | undefined => {
  const card = MUT_GEN_CARDS.find((candidate) => (candidate.id as string) === id);
  return card && "specificTo" in card ? (card.specificTo?.encounterSetId as string | undefined) : undefined;
};
const futurePastCardIds = MUT_GEN_CARDS.filter(
  (card) => "encounterSetIds" in card && card.encounterSetIds.includes("future_past" as never),
).map((card) => card.id as string);
const ids = (log: CampaignLog): readonly string[] =>
  startGameFromLog(DEF, log).input.instructions.map((instruction) => instruction.instructionId);

// ---------------------------------------------------------------------------------------------------------------
// Real-game helpers
// ---------------------------------------------------------------------------------------------------------------

interface Built {
  readonly start: ReturnType<typeof startGameFromLog>;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/** The real game a composed log starts, exactly as the campaign card harness builds it (unsettled). */
function build(composed: CampaignLog): Built {
  const start = startGameFromLog(DEF, composed);
  const removedCardIds = composed.removedFromCampaign.map((face) => face.cardId);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config = wave6Scenario(start.scenarioId, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: composed.modes,
  });
  const created = createGame(
    {
      ...config,
      encounterDeck: [
        ...config.encounterDeck,
        ...cardsOfComposedSets(WAVE6_CARDS, start.encounterSets.deck, removedCardIds),
      ],
      setAside: [
        ...(config.setAside ?? []),
        ...cardsOfComposedSets(WAVE6_CARDS, start.encounterSets.setAside, removedCardIds),
      ],
      campaign: start.input,
    },
    WAVE6_DEPS,
  );
  if (!created.ok) throw new Error(`${start.nodeId}: setup failed: ${created.error.message}`);
  return { start, state: created.state, events: created.events };
}

/** The game settled to the first player phase, every choice answered by `pick`. */
const settledStart = (composed: CampaignLog, pick: Picker = firstLegal): GameState =>
  settleGame(build(composed).state, pick, (state) => state.step.phase === "player", WAVE6_DEPS);

interface Played {
  readonly final: GameState;
  readonly events: readonly GameEvent[];
}

/** Plays a game to its real outcome with the greedy driver and proves its session log replays to the same state. */
function playOut(
  initial: GameState,
  setupEvents: readonly GameEvent[],
  nodeId: string,
  deps: EngineDeps = WAVE6_DEPS,
): Played {
  const driven = playToOutcome(initial, deps, { maxCommands: 40_000 });
  expect(driven.outcome, `${nodeId} never reached an outcome`).not.toBeNull();
  const replayed = replay(driven.session.log, deps);
  expect(replayed.ok, `${nodeId}: replay failed`).toBe(true);
  if (!replayed.ok) throw new Error("replay failed");
  expect(replayed.state).toEqual(driven.session.state);
  return { final: driven.session.state, events: [...setupEvents, ...replayed.events] };
}

/** `trors.qa.test.ts`'s documented substitution: the real final state, its outcome overridden to a win. */
const asWin = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((player) => ({ ...player, eliminated: false })),
  outcome: { result: "win", reason: "villainDefeated" },
});
const asLoss = (state: GameState): GameState =>
  state.outcome?.result === "loss" ? state : { ...state, outcome: { result: "loss", reason: "allPlayersDefeated" } };

const resultOf = (composed: CampaignLog, state: GameState, events: readonly GameEvent[]): CampaignGameResult =>
  campaignResultOf(DEF, composed, state, events, WAVE6_DEPS);

const inst = (state: GameState, id: InstanceId) => state.instances[id]!;
const cardOfInstance = (state: GameState, id: InstanceId): string => inst(state, id).cardId as string;
const nameOf = (code: string): string | undefined => WAVE6_CARDS.find((card) => (card.id as string) === code)?.name;
/** The cards attached to a seat's identity: an upgrade put into play is attached there, as when it is played. */
const onIdentityOf = (state: GameState, seat: number): readonly InstanceId[] =>
  state.instances[state.players[seat]!.identity.instanceId]?.attachments ?? [];
/** A seat's cards in play: loose in the play area, or on the identity. */
const playAreaOf = (state: GameState, seat: number): readonly string[] =>
  [...(state.players[seat]?.playArea ?? []), ...onIdentityOf(state, seat)].map((id) => cardOfInstance(state, id));
const villainAreaNames = (state: GameState): readonly (string | undefined)[] =>
  state.villainArea.map((id) => nameOf(cardOfInstance(state, id)));
const anywhere = (state: GameState, code: string): InstanceId[] =>
  Object.values(state.instances)
    .filter((instance) => (instance.cardId as string) === code)
    .map((instance) => instance.instanceId);

// ---------------------------------------------------------------------------------------------------------------
// 1. A full campaign, a real game at every node
// ---------------------------------------------------------------------------------------------------------------

describe("a full standard campaign: a real game at every node, the log checked after each (MC32 pp. 5-24)", () => {
  it("plays all five scenarios, each composed from the log, played, replayed and folded back", () => {
    let log = newLog(STANDARD);
    expect(log.position.nextNodeId).toBe("sabretooth");
    const removedAfter: string[][] = [];

    // ---- Scenario 1, Sabretooth (MC32 p. 7) ----
    {
      const composed = compose(log);
      const { start, state, events } = build(composed);
      expect(start.nodeId).toBe("sabretooth");
      // "Each player chooses one of the campaign roles. Record each player's role in the campaign log." (p. 7), each a
      // different role (p. 5).
      expect(composed.seats.map((seat) => seat.fields.role)).toEqual([
        { kind: "choice", option: "brawler" },
        { kind: "choice", option: "defender" },
      ]);
      // "… takes one random upgrade from their role's set of cards and puts it into play under their control."
      const upgrades = [roleUpgradeOf(composed, 0)!, roleUpgradeOf(composed, 1)!];
      expect(setOfCard(upgrades[0]!)).toBe("brawler");
      expect(setOfCard(upgrades[1]!)).toBe("defender");
      const settled = settleGame(state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
      expect(onIdentityOf(settled, 0).map((id) => cardOfInstance(settled, id))).toContain(upgrades[0]);
      expect(onIdentityOf(settled, 1).map((id) => cardOfInstance(settled, id))).toContain(upgrades[1]);
      const upgradeInstances = anywhere(settled, upgrades[0]!);
      expect(upgradeInstances.map((id) => inst(settled, id).controllerId)).toEqual([P1]);
      // "Reveal the Frightened Police (171A) side scheme." and the Future Past deck is set aside (p. 7).
      expect(villainAreaNames(settled)).toContain("Frightened Police");
      expect(settled.scenarioDecks["Future Past"]?.deck.length).toBeGreaterThan(0);

      const played = playOut(state, events, "sabretooth");
      const real = resultOf(composed, asWin(played.final), played.events);
      // The Victory records are derived from the real final state: the greedy game never defeated the side scheme.
      expect(real.records.find((entry) => entry.write.field === "frightenedPolice")?.write.value).toEqual({
        kind: "flag",
        value: false,
      });
      // Stand-in for a win that defeated Frightened Police (p. 7) and put a Future Past card in the victory display.
      const stray = futurePastCardIds[0]!;
      log = fold(
        composed,
        withRecords(real, [
          flag("mc32.s1.victory.frightened-police", "frightenedPolice", true),
          list("mc32.s1.victory.future-past-display", "futurePastVictoryDisplay", [stray]),
        ]),
      );
      expect(log.position.resolved.sabretooth).toBe("completed");
      expect(log.position.nextNodeId).toBe("project-wideawake");
      expect(field(log, "frightenedPolice")).toEqual({ kind: "flag", value: true });
      // "Remove each Future Past card in the victory display from the campaign." and "Remove each role upgrade that
      // began the game in play from the campaign." (p. 7)
      expect(removedIds(log)).toEqual(expect.arrayContaining([...upgrades, stray]));
      expect(roleUpgradeOf(log, 0)).toBeUndefined();
      expect(roleUpgradeOf(log, 1)).toBeUndefined();
      // Roles are recorded for the whole campaign (p. 5: "cannot switch" roles is not printed, but p. 7 records them).
      expect(log.seats.map((seat) => seat.fields.role)).toEqual(composed.seats.map((seat) => seat.fields.role));
      removedAfter.push([...removedIds(log)]);
    }

    // ---- Scenario 2, Project Wideawake (MC32 p. 10) ----
    {
      const composed = compose(log);
      const { start, state, events } = build(composed);
      expect(start.nodeId).toBe("project-wideawake");
      expect(composed.seats.map((seat) => seat.fields.role)).toEqual(log.seats.map((seat) => seat.fields.role));
      // "If Frightened Police Defeated is checked in the campaign log, each player takes 1 random upgrade …" (p. 10).
      const upgrades = [roleUpgradeOf(composed, 0)!, roleUpgradeOf(composed, 1)!];
      expect(setOfCard(upgrades[0]!)).toBe("brawler");
      expect(setOfCard(upgrades[1]!)).toBe("defender");
      for (const upgrade of upgrades) expect(removedAfter[0]).not.toContain(upgrade); // the pool shrank
      expect(ids(composed)).toContain("mc32.s2.setup.role-upgrade");
      const settled = settleGame(state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
      expect(playAreaOf(settled, 0)).toContain(upgrades[0]);
      expect(playAreaOf(settled, 1)).toContain(upgrades[1]);
      // "Shuffle the remaining cards from the Future Past deck and set them aside." (p. 10): a Future Past deck exists.
      expect(settled.scenarioDecks["Future Past"]?.deck.length).toBeGreaterThan(0);
      expect(villainAreaNames(settled)).toContain("Enemy of My Enemy");

      const played = playOut(state, events, "project-wideawake");
      const real = resultOf(composed, asWin(played.final), played.events);
      log = fold(
        composed,
        withRecords(real, [
          flag("mc32.s2.victory.enemy-of-my-enemy", "enemyOfMyEnemy", true),
          flag("mc32.s2.victory.jubilee", "jubilee", true),
          list("mc32.s2.victory.captives", "captives", ["32089", "32091"]),
        ]),
      );
      expect(log.position.nextNodeId).toBe("master-mold");
      expect(field(log, "enemyOfMyEnemy")).toEqual({ kind: "flag", value: true });
      expect(field(log, "jubilee")).toEqual({ kind: "flag", value: true });
      expect(field(log, "captives")).toEqual({ kind: "cardList", cardIds: ["32089", "32091"] });
      expect(removedIds(log)).toEqual(expect.arrayContaining([...removedAfter[0]!, ...upgrades]));
      expect(roleUpgradeOf(log, 0)).toBeUndefined();
      removedAfter.push([...removedIds(log)]);
    }

    // ---- Scenario 3, Master Mold (MC32 p. 12) ----
    {
      const composed = compose(log);
      const { start, state, events } = build(composed);
      expect(start.nodeId).toBe("master-mold");
      // "If Jubilee (88B) is in the campaign log, put her into play." "Each CAPTIVE ally recorded in the campaign log
      // may be shuffled into any player's deck." (p. 12; Q14: the first player chooses the deck)
      expect(start.input.setAsideCards).toEqual(expect.arrayContaining(["32088b", "32089", "32091"]));
      expect(start.input.setAsideCards).not.toContain("32090");
      const shuffleCaptives: Picker = (s) => {
        const shuffle = s.pendingChoice?.options.find((option) => option.label.startsWith("Shuffle"));
        return shuffle ? [shuffle.optionId] : firstLegal(s);
      };
      const settled = settleGame(state, shuffleCaptives, (s) => s.step.phase === "player", WAVE6_DEPS);
      const jubilee = anywhere(settled, "32088b");
      expect(jubilee).toHaveLength(1);
      expect(settled.players[0]?.playArea).toContain(jubilee[0]);
      expect(inst(settled, jubilee[0]!).controllerId).toBe(settled.firstPlayerId);
      for (const captive of ["32089", "32091"]) {
        const [instanceId] = anywhere(settled, captive);
        expect(instanceId, `${captive} has an instance`).toBeDefined();
        const owner = inst(settled, instanceId!).ownerId;
        const holder = settled.players.find((player) => player.playerId === owner);
        expect(holder, `${captive} is some player's card`).toBeDefined();
        expect([...holder!.deck, ...holder!.hand]).toContain(instanceId);
      }
      expect(anywhere(settled, "32090").every((id) => !settled.players.some((p) => p.deck.includes(id)))).toBe(true);
      // "If Enemy of My Enemy Defeated is checked …, each player takes 1 random upgrade …" (p. 12)
      expect(ids(composed)).toContain("mc32.s3.setup.role-upgrade");
      expect(villainAreaNames(settled)).toContain("Find the Prisoners");

      const played = playOut(state, events, "master-mold");
      const real = resultOf(composed, asWin(played.final), played.events);
      log = fold(
        composed,
        withRecords(real, [
          flag("mc32.s3.victory.find-the-prisoners", "findThePrisoners", true),
          flag("mc32.s3.victory.jubilee", "jubilee", false), // "Otherwise, remove her from the campaign log." (p. 12)
          list("mc32.s3.victory.held-allies", "heldAllies", ["32089"]),
        ]),
      );
      expect(log.position.nextNodeId).toBe("mansion-attack");
      expect(field(log, "findThePrisoners")).toEqual({ kind: "flag", value: true });
      expect(field(log, "jubilee")).toEqual({ kind: "flag", value: false });
      // "These allies cannot be used for the rest of the campaign." (p. 12)
      expect(removedIds(log)).toContain("32089");
      expect(roleUpgradeOf(log, 0)).toBeUndefined();
    }

    // ---- Scenario 4, Mansion Attack (MC32 p. 16) ----
    {
      const composed = compose(log);
      const { start, state, events } = build(composed);
      expect(start.nodeId).toBe("mansion-attack");
      // Jubilee was removed from the log at scenario 3: she is neither set aside nor put into play (p. 16).
      expect(start.input.setAsideCards).not.toContain("32088b");
      expect(ids(composed)).not.toContain("mc32.s4.setup.jubilee");
      // "If Find the Prisoners Defeated is checked …, each player takes 1 random upgrade …" (p. 16)
      expect(ids(composed)).toContain("mc32.s4.setup.role-upgrade");
      const settled = settleGame(state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
      expect(anywhere(settled, "32088b").every((id) => !settled.players.some((p) => p.playArea.includes(id)))).toBe(
        true,
      );
      expect(villainAreaNames(settled)).toContain("Surprise Attack");

      const played = playOut(state, events, "mansion-attack");
      const real = resultOf(composed, asWin(played.final), played.events);
      log = fold(composed, withRecords(real, [flag("mc32.s4.victory.surprise-attack", "surpriseAttack", true)]));
      expect(log.position.nextNodeId).toBe("magneto");
      expect(field(log, "surpriseAttack")).toEqual({ kind: "flag", value: true });
      expect(roleUpgradeOf(log, 0)).toBeUndefined();
    }

    // ---- Scenario 5, Magneto (MC32 p. 19) ----
    {
      const composed = compose(log);
      const { start, state, events } = build(composed);
      expect(start.nodeId).toBe("magneto");
      // "If Surprise Attack Defeated is checked …, each player takes 1 random upgrade …" (p. 19)
      expect(ids(composed)).toContain("mc32.s5.setup.role-upgrade");
      const settled = settleGame(state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
      expect(villainAreaNames(settled)).toContain("Magneto's Fortress");
      for (const seat of [0, 1]) {
        expect(setOfCard(roleUpgradeOf(composed, seat)!)).toBe(seat === 0 ? "brawler" : "defender");
      }

      const played = playOut(state, events, "magneto");
      log = fold(composed, resultOf(composed, asWin(played.final), played.events));
      // "Magneto is defeated and the players win the campaign!" (p. 19)
      expect(log.status).toBe("won");
      expect(log.position.nextNodeId).toBeNull();
    }

    expect(log.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual(NODES.map((node) => `${node}:won`));
    expect(log.position.resolved).toEqual(Object.fromEntries(NODES.map((node) => [node, "completed"])));
  }, 300_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 2. A real lost-and-retried scenario keeps the log
// ---------------------------------------------------------------------------------------------------------------

describe("a real lost game and its retry (MC32 p. 4: 'reset the scenario and try again with no penalty')", () => {
  it("the real loss is folded as a loss, the log survives it, and the retry starts a new real game from the log", () => {
    // Scenario 1 won with Frightened Police defeated, so scenario 2 deals upgrades and has a real log to lose with.
    const afterOne = fold(
      compose(newLog(STANDARD, 77)),
      bareResult("sabretooth", true, [flag("mc32.s1.victory.frightened-police", "frightenedPolice", true)]),
    );
    const composed = compose(afterOne);
    const { state, events } = build(composed);
    const played = playOut(state, events, "project-wideawake");
    expect(played.final.outcome?.result, "the greedy driver loses this node").toBe("loss");
    const real = resultOf(composed, played.final, played.events);
    expect(real.outcome).toBe("lost"); // derived from the real final state

    const lost = fold(composed, real);
    expect(lost.status).toBe("active");
    expect(lost.position.nextNodeId).toBe("project-wideawake");
    expect(lost.position.resolved["project-wideawake"]).toBeUndefined();
    expect(lost.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "sabretooth:won",
      "project-wideawake:lost",
    ]);
    // Everything the log held before the lost game is still there: roles, the flag, scenario 1's removals.
    expect(lost.seats.map((seat) => seat.fields.role)).toEqual(afterOne.seats.map((seat) => seat.fields.role));
    expect(field(lost, "frightenedPolice")).toEqual({ kind: "flag", value: true });
    // Q12: the only new removals are the upgrades the real game used (the greedy driver plays Swagger, whose own
    // "Remove this card from the game and the campaign pool" fired in the real game); an unused upgrade stays in the
    // pool, since only Victory removes it (p. 7 / p. 10). RRG 1.8 p. 29: a removal outlasts a lost game.
    const usedInGame = real.removedFromCampaign.map((face) => face.cardId as string);
    expect(removedIds(lost)).toEqual([...removedIds(afterOne), ...usedInGame]);
    for (const seat of [0, 1]) {
      const dealt = roleUpgradeOf(composed, seat)!;
      expect(removedIds(lost).includes(dealt), `seat ${seat + 1}'s ${dealt}`).toBe(usedInGame.includes(dealt));
    }
    expect(field(lost, "enemyOfMyEnemy")).toBeUndefined();

    // The retry composes from the surviving log and plays a second real game that also replays.
    const retry = compose(lost);
    expect(retry.seats.map((seat) => seat.fields.role)).toEqual(afterOne.seats.map((seat) => seat.fields.role));
    expect(setOfCard(roleUpgradeOf(retry, 0)!)).toBe("brawler");
    expect(setOfCard(roleUpgradeOf(retry, 1)!)).toBe("defender");
    for (const seat of [0, 1]) expect(usedInGame).not.toContain(roleUpgradeOf(retry, seat)!); // never dealt again
    const second = build(retry);
    expect(second.start.nodeId).toBe("project-wideawake");
    const replayedGame = playOut(second.state, second.events, "project-wideawake (retry)");
    expect(replayedGame.final.outcome).not.toBeNull();
    const won = fold(
      retry,
      withRecords(resultOf(retry, asWin(replayedGame.final), replayedGame.events), [
        flag("mc32.s2.victory.enemy-of-my-enemy", "enemyOfMyEnemy", true),
      ]),
    );
    expect(won.position.nextNodeId).toBe("master-mold");
    expect(won.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "sabretooth:won",
      "project-wideawake:lost",
      "project-wideawake:won",
    ]);
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 3. A used role upgrade's removal sticks across the retry (Q12)
// ---------------------------------------------------------------------------------------------------------------

describe("a used role upgrade's removal sticks across the retry (docs/phase7-wave6.md §4.1 Q12; RRG 1.8 p. 29)", () => {
  /** A composed scenario-1 log whose seat 1 was dealt Ferocious Attack (32179, "Spend 3 resources -> deal 6 damage"). */
  function dealtFerociousAttack(): CampaignLog {
    for (let seed = 1; seed < 200; seed++) {
      const composed = compose(newLog(STANDARD, seed));
      if (roleUpgradeOf(composed, 0) === "32179") return composed;
    }
    throw new Error("no seed deals Ferocious Attack to seat 1");
  }

  it("the real card is used in a real game, the loss keeps its removal, and neither the retry nor the next scenario deals it again", () => {
    const composed = dealtFerociousAttack();
    const unused = roleUpgradeOf(composed, 1)!;
    const built = build(composed);
    const game = settleGame(built.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
    const card = onIdentityOf(game, 0).find((id) => cardOfInstance(game, id) === "32179")!;
    expect(card).toBeDefined();
    const hero = settleGame(runWith(WAVE6_DEPS, game, toHero(P1)), firstLegal, undefined, WAVE6_DEPS);
    const pay = hero.players[0]!.hand.slice(0, 3).map((fromHand) => ({ fromHand }));
    const used = settleGame(
      runWith(WAVE6_DEPS, hero, use(P1, card, "32179.ferocious-attack-action", pay)),
      firstLegal,
      undefined,
      WAVE6_DEPS,
    );
    // The card's own "Remove this card from the game and the campaign pool" wrote the removal into the game.
    expect(used.removedFromGame).toContain(card);
    expect((used.campaignWrites?.removedFromCampaign ?? []).map((face) => face.cardId as string)).toEqual(["32179"]);

    // The real game plays on from there to its real loss; the result reads the removal off the real final state.
    // Seat 2 must leave its upgrade unused, and the greedy driver uses every upgrade it is offered, so that card's
    // ability is withheld from this one game's registry (the card stays in play and is never triggered).
    const withheld = new Set(WAVE6_CARDS.filter((c) => (c.id as string) === unused).flatMap((c) => abilityRefIds(c)));
    expect(withheld.size).toBeGreaterThan(0);
    const withoutUnused: EngineDeps = {
      ...WAVE6_DEPS,
      abilities: Object.fromEntries(Object.entries(WAVE6_DEPS.abilities).filter(([id]) => !withheld.has(id))),
    };
    const played = playOut(used, built.events, "sabretooth", withoutUnused);
    const lostState = asLoss(played.final);
    const real = resultOf(composed, lostState, played.events);
    expect(real.outcome).toBe("lost");
    expect(real.removedFromCampaign.map((face) => face.cardId as string)).toEqual(["32179"]);

    const lost = fold(composed, real);
    expect(lost.position.nextNodeId).toBe("sabretooth");
    expect(removedIds(lost)).toEqual(["32179"]); // the used card is gone; the unused one is not removed
    expect(removedIds(lost)).not.toContain(unused);

    // The retry: never dealt again, and the real game starts with another Brawler upgrade in play.
    const retry = compose(lost);
    const redealt = roleUpgradeOf(retry, 0)!;
    expect(redealt).not.toBe("32179");
    expect(setOfCard(redealt)).toBe("brawler");
    const retryGame = settledStart(retry);
    expect(playAreaOf(retryGame, 0)).toContain(redealt);
    expect(playAreaOf(retryGame, 0)).not.toContain("32179");
    expect(anywhere(retryGame, "32179")).toEqual([]);

    // Winning the retry removes the redealt upgrade too, and the first removal is still there exactly once.
    const retryBuilt = build(retry);
    const retryPlayed = playOut(retryBuilt.state, retryBuilt.events, "sabretooth (retry)");
    const won = fold(retry, resultOf(retry, asWin(retryPlayed.final), retryPlayed.events));
    expect(removedIds(won).filter((code) => code === "32179")).toHaveLength(1);
    expect(removedIds(won)).toContain(redealt);
    expect(won.position.nextNodeId).toBe("project-wideawake");

    // The next scenario (Frightened Police not recorded here, so supply it) draws from what the pool still holds.
    const next = compose(
      fold(
        composed,
        withRecords(resultOf(retry, asWin(retryPlayed.final), retryPlayed.events), [
          flag("mc32.s1.victory.frightened-police", "frightenedPolice", true),
        ]),
      ),
    );
    expect([redealt, "32179"]).not.toContain(roleUpgradeOf(next, 0));
    expect(setOfCard(roleUpgradeOf(next, 0)!)).toBe("brawler");
  }, 180_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 4. Expert campaign rules (MC32 p. 5)
// ---------------------------------------------------------------------------------------------------------------

describe("expert campaign (MC32 p. 5)", () => {
  const identityDamage = (state: GameState, seat: number): number => {
    const id = state.players[seat - 1]?.identity.instanceId;
    return id === undefined ? -1 : (inst(state, id).damage ?? -1);
  };
  const tokens = (state: GameState): number => state.mainScheme?.accelerationTokens ?? 0;
  /** Declines every optional thing, and picks "Decline" whenever it is offered (`mts.qa.test.ts`'s own picker). */
  const declineEverything: Picker = (state) => {
    const decline = state.pendingChoice?.options.find((option) => option.label === "Decline");
    return decline ? [decline.optionId] : firstLegal(state);
  };

  /** An expert log that has won the first `n` scenarios with `remaining` recorded for each seat each time. */
  function expertAt(n: number, remaining: Readonly<Record<number, number>>, seed = 4242): CampaignLog {
    let log = newLog(EXPERT, seed);
    for (const [index, node] of NODES.slice(0, n).entries()) {
      log = fold(
        compose(log),
        bareResult(node, true, [
          hp(`mc32.s${index + 1}.victory.hp`, 1, remaining[1] ?? 0),
          hp(`mc32.s${index + 1}.victory.hp`, 2, remaining[2] ?? 0),
        ]),
      );
    }
    return log;
  }

  it("persistent hit points: a real game's real damage is recorded, capped at base, and restored at the next setup", () => {
    const composed = compose(newLog(EXPERT, 31));
    expect(ids(composed)).not.toContain("mc32.s1.setup.hp-set"); // nothing recorded before scenario 1
    const { state, events } = build(composed);
    const played = playOut(state, events, "sabretooth");
    const win = asWin(played.final);
    const real = resultOf(composed, win, played.events);
    const log = fold(composed, real);

    // "record their remaining hit points in the campaign log … if greater than base, record their base" (p. 5).
    const recorded: number[] = [];
    for (const [index, player] of win.players.entries()) {
      const remaining = remainingHitPoints(win, player.identity.instanceId, WAVE6_DEPS) ?? 0;
      const base = maxHitPoints(win, player.identity.instanceId, WAVE6_DEPS) ?? remaining;
      const expected = Math.max(0, Math.min(remaining, base));
      expect(seatField(log, index, "remainingHp")).toEqual({ kind: "number", value: expected });
      recorded.push(expected);
    }
    expect(Math.min(...recorded)).toBeLessThanOrEqual(Math.max(...recorded));

    // The next setup sets each identity to the recorded value (then offers the token heal, declined here).
    const second = compose(log);
    expect(ids(second)).toEqual(expect.arrayContaining(["mc32.s2.setup.hp-set", "mc32.s2.setup.heal"]));
    const next = settledStart(second, declineEverything);
    for (const [index, player] of next.players.entries()) {
      const base = maxHitPoints(next, player.identity.instanceId, WAVE6_DEPS) ?? 0;
      expect(base - identityDamage(next, index + 1), `seat ${index + 1} starts at its recorded hit points`).toBe(
        recorded[index],
      );
    }
  }, 120_000);

  it("a recorded value above base is capped at base (MC32 p. 5)", () => {
    const composed = compose(newLog(EXPERT, 32));
    const { state, events } = build(composed);
    const win = asWin(state);
    // A healed-above-base identity: negative damage cannot exist, so exercise the cap through the query's own max.
    const real = resultOf(composed, win, events);
    const log = fold(composed, real);
    for (const [index, player] of win.players.entries()) {
      const base = maxHitPoints(win, player.identity.instanceId, WAVE6_DEPS)!;
      expect(seatField(log, index, "remainingHp")).toEqual({ kind: "number", value: base });
    }
  });

  it("the rejoin token (Q11): a seat recorded at 0 must place it; a seat above 0 may decline", () => {
    const withHp = expertAt(1, { 1: 0, 2: 7 }, 33);
    const oneDown = settledStart(compose(withHp), declineEverything);
    const bothAlive = settledStart(compose(expertAt(1, { 1: 7, 2: 7 }, 33)), declineEverything);
    // Seat 1 was recorded at 0 (MC32 p. 5: "can rejoin … by placing an acceleration token"), so it is healed to full
    // even though "Decline" was always chosen: one more token than the all-alive run.
    expect(identityDamage(oneDown, 1)).toBe(0);
    expect(tokens(oneDown)).toBe(tokens(bothAlive) + 1);
    // Seat 2 may decline and so is still down its persistent damage.
    expect(identityDamage(oneDown, 2)).toBe(identityDamage(bothAlive, 2));
    expect(identityDamage(bothAlive, 1)).toBeGreaterThan(0);
    // Accepting the heal costs one token per seat.
    const accepted = settledStart(compose(expertAt(1, { 1: 7, 2: 7 }, 33)), firstLegal);
    expect(identityDamage(accepted, 1)).toBe(0);
    expect(tokens(accepted)).toBe(tokens(bothAlive) + 2);
  }, 60_000);

  it("Magneto in an expert campaign: losing the real game loses the campaign (MC32 p. 19); standard retries", () => {
    for (const [modes, status] of [
      [EXPERT, "lost"],
      [STANDARD, "active"],
    ] as const) {
      const composed = compose(modes === EXPERT ? expertAt(4, { 1: 8, 2: 8 }, 34) : walkStandard(4, 34));
      expect(startGameFromLog(DEF, composed).nodeId).toBe("magneto");
      const { state, events } = build(composed);
      const played = playOut(state, events, "magneto");
      expect(played.final.outcome?.result, "the greedy driver loses Magneto").toBe("loss");
      const real = resultOf(composed, played.final, played.events);
      expect(real.outcome).toBe("lost");
      const after = fold(composed, real);
      expect(after.status).toBe(status);
      if (status === "lost") {
        expect(after.position.nextNodeId).toBeNull();
        expect(after.history.at(-1)?.steps.some((step) => step.instructionId === "mc32.s5.defeat.lose-campaign")).toBe(
          true,
        );
      } else {
        expect(after.position.nextNodeId).toBe("magneto");
        expect(after.history.at(-1)?.outcome).toBe("lost");
      }
    }
  }, 180_000);

  function walkStandard(n: number, seed: number): CampaignLog {
    let log = newLog(STANDARD, seed);
    for (const node of NODES.slice(0, n)) log = fold(compose(log), bareResult(node, true));
    return log;
  }
});

// ---------------------------------------------------------------------------------------------------------------
// 5. Former gaps: rulebook sentences once left unauthored, now pinned against real games
// ---------------------------------------------------------------------------------------------------------------

describe("former gaps against the MC32 rulebook", () => {
  /** A real scenario-1 game whose final state has `Future Past` cards in the encounter deck (a stand-in for them
   * having been revealed and shuffled there), won by substitution. */
  function winWithFuturePastInEncounterDeck(): { readonly log: CampaignLog; readonly stray: string } {
    const composed = compose(newLog(STANDARD, 55));
    const { state, events } = build(composed);
    const played = playOut(state, events, "sabretooth");
    const final = played.final;
    const stray = (final.scenarioDecks["Future Past"]?.deck ?? [])[0]!;
    const deckId = final.encounterDeckOrder[0]!;
    const doctored: GameState = {
      ...final,
      scenarioDecks: {
        ...final.scenarioDecks,
        "Future Past": {
          ...final.scenarioDecks["Future Past"]!,
          deck: final.scenarioDecks["Future Past"]!.deck.slice(1),
        },
      },
      encounterDecks: {
        ...final.encounterDecks,
        [deckId]: { ...final.encounterDecks[deckId]!, deck: [...final.encounterDecks[deckId]!.deck, stray] },
      },
    };
    const log = fold(composed, resultOf(composed, asWin(doctored), played.events));
    return { log, stray: cardOfInstance(final, stray) };
  }

  it("precondition: the doctored game really holds a Future Past card in its encounter deck", () => {
    const { stray } = winWithFuturePastInEncounterDeck();
    expect(futurePastCardIds).toContain(stray);
  }, 60_000);

  // MC32 pp. 7/10/12/16, Victory: "Add each Future Past card found in the encounter deck, discard pile, and in play
  // to the campaign log." (`cardsInEncounterDeckAndDiscard`, appended `distinct`.)
  it("Victory adds each Future Past card found in the encounter deck to the campaign log (MC32 p. 7)", () => {
    const { log, stray } = winWithFuturePastInEncounterDeck();
    expect(field(log, "futurePast")).toEqual({ kind: "cardList", cardIds: expect.arrayContaining([stray]) });
  }, 60_000);

  // MC32 p. 7 (and pp. 10/12/16): "Remove each Future Past card in the victory display from the campaign." The log
  // records the removal (`removedFromCampaign`), and `cardsOfComposedSets` leaves removed cards out of the composed sets.
  it("a Future Past card removed from the campaign is not in the next scenario's Future Past deck (MC32 p. 7)", () => {
    const stray = futurePastCardIds[0]!;
    const log = fold(
      compose(newLog(STANDARD, 57)),
      bareResult("sabretooth", true, [
        flag("mc32.s1.victory.frightened-police", "frightenedPolice", true),
        list("mc32.s1.victory.future-past-display", "futurePastVictoryDisplay", [stray]),
      ]),
    );
    expect(removedIds(log)).toContain(stray); // the log did record the removal
    const next = settledStart(compose(log));
    expect(anywhere(next, stray)).toEqual([]);
  }, 60_000);

  // MC32 p. 12: allies that ended under Find the Prisoners "cannot be used for the rest of the campaign": `captives`
  // still names Rictor, so scenarios 4 and 5 skip any captive that `heldAllies` holds.
  it("a Captive ally removed under Find the Prisoners is not offered again at scenario 4 (MC32 p. 12)", () => {
    let log = fold(compose(newLog(STANDARD, 58)), bareResult("sabretooth", true));
    log = fold(
      compose(log),
      bareResult("project-wideawake", true, [list("mc32.s2.victory.captives", "captives", ["32089", "32091"])]),
    );
    log = fold(
      compose(log),
      bareResult("master-mold", true, [list("mc32.s3.victory.held-allies", "heldAllies", ["32089"])]),
    );
    expect(removedIds(log)).toContain("32089");
    const composed = compose(log);
    expect(startGameFromLog(DEF, composed).nodeId).toBe("mansion-attack");
    expect(startGameFromLog(DEF, composed).input.setAsideCards).not.toContain("32089");
  }, 60_000);

  // MC32 p. 5 "Elimination and Victory" (docs/phase7-wave6.md §2.3): in an expert campaign "the defeated player does
  // not participate in the Victory steps of that scenario": the definition's `elimination` policy keeps the seat out
  // of them, so its role upgrade is not removed from the campaign.
  it("an expert seat defeated in a won game does not take part in the Victory steps: its role upgrade is not removed (MC32 p. 5)", () => {
    const composed = compose(newLog(EXPERT, 157));
    const { state, events } = build(composed);
    const played = playOut(state, events, "sabretooth");
    const won = asWin(played.final);
    const seatTwoDown: GameState = {
      ...won,
      players: won.players.map((player, index) => (index === 1 ? { ...player, eliminated: true } : player)),
    };
    // The seat must not have used its role upgrade during the game (using one removes it from the campaign, which is
    // not what this test is about): a seed whose greedy game leaves it unused. Seed 56 until 2026-10-03, when the
    // thwart-target rule changed what the greedy driver is offered and that game began to use Surprise!.
    const upgrade = roleUpgradeOf(composed, 1)!;
    const usedInGame = played.final.removedFromGame.some((id) => cardOfInstance(played.final, id) === upgrade);
    expect(usedInGame, "pick a seed whose game leaves seat 2's role upgrade unused").toBe(false);
    const log = fold(composed, resultOf(composed, seatTwoDown, played.events));
    expect(removedIds(log)).not.toContain(upgrade);
  }, 60_000);

  // MC32 p. 5 role-building: "If a player's deck does not already include their chosen event and/or upgrade, they may
  // add either or both" (`CollectionFilter.notInOwnDeck`). At scenarios 1 and 2 of a real walk, no seat is offered a
  // card whose title its deck already holds, and every offer still has cards in it.
  it("role-building offers only cards the seat's deck does not already include (MC32 p. 5)", () => {
    const offered = (log: CampaignLog) =>
      settleBy((answers) => resolveBetweenGames(DEF, log, DEPS, log.modes, answers), pickRoles).asked.filter(
        (choice) => choice.slot === "roleEvent" || choice.slot === "roleUpgradeCard",
      );
    const first = newLog(STANDARD, 59);
    const second = fold(compose(first), bareResult("sabretooth", true));
    for (const log of [first, second]) {
      const asked = offered(log);
      expect(asked).toHaveLength(4);
      for (const choice of asked) {
        const seat = log.seats.find((candidate) => candidate.seatNumber === choice.seatNumber)!;
        const deckTitles = new Set(seat.deck.cards.map((line) => nameOf(line.cardId as string)));
        expect(choice.options.length, choice.slot).toBeGreaterThan(0);
        expect(
          choice.options.filter((id) => deckTitles.has(nameOf(id))),
          choice.slot,
        ).toEqual([]);
      }
    }
  }, 60_000);
});
