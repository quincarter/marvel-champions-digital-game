/**
 * Fear No Evil (MC60), the campaign end to end (docs/phase7-wave11-scenarios.md S7 task C2). Every game here is a real,
 * seeded one: the runner composes it (`resolveBetweenGames`), the client-shaped `build()` creates it, the greedy driver
 * plays its opening, and `campaignResultOf` + `applyCampaignResult` fold it back into the log. Nothing is a hand-built
 * `CampaignGameResult`.
 *
 * **Where a game's outcome is staged.** The greedy driver cannot beat (or lose to) a villain on demand, so right
 * before the result is read the finished state is patched: `outcome` is set to a win or a loss, and where a VICTORY
 * bullet reads the board (Disturbed Psyche's threat, the Typhoid Mary ally in the victory display, a card removed
 * from the game, an identity's damage, a defeated seat) that single fact is patched in. Setup, the opening turns and the
 * session replay are untouched. Each patch is named at its call.
 *
 * Sources: MC60 pp. 8 to 9 (Campaign Setup steps 1 to 14, "Underling villain play order", a lost scenario), the
 * scenarios' VICTORY and DEFEAT blocks (pp. 13 to 23), the log sheet (p. 28); RRG 1.8 "Simultaneous Resolution" (p.
 * 40) for the environments' Setups. Unit-level shape tests are `fne.test.ts`, per-step game checks `fne.game.test.ts`.
 */
import { describe, expect, it, vi } from "vitest";
import { CORE_STARTER_DECKS, FNE_STARTER_DECKS, PLAYABLE_CARDS, cardId, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  campaignResultOf,
  activeEncounterDeck,
  characterProfile,
  createCampaignLog,
  createGame,
  remainingHitPoints,
  replay,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignGameResult,
  type CampaignGameStart,
  type CampaignLog,
  type CampaignSeatSetup,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { playToOutcome } from "../testing/driver.js";
import { firstLegal, inst, patchInstance, settle, type Picker } from "../testing/harness.js";
import { WAVE11_DEPS } from "../wave11/index.js";
import { wave11Scenario, wave11ScenarioRecord } from "../wave11/setup.js";
import { SIT_OUT_LABEL } from "./expert-helpers.js";
import {
  FNE_CAMPAIGN_DEFINITION as DEF,
  FNE_ENVIRONMENTS,
  FNE_FINALE_NODE as KINGPIN,
  FNE_FIRST_PLAYTHROUGH,
  FNE_LATER_PLAYTHROUGH,
  FNE_UNDERLING_NODES,
  completedField,
  villainField,
} from "./fne.js";

vi.setConfig({ testTimeout: 900_000 });

const DEPS = { pool: PLAYABLE_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: DEF.campaignId, expertCampaign: true }, expert: true };
const [AMH, GETAWAY, RACKET, RAFT, PRESSES] = FNE_UNDERLING_NODES as [string, string, string, string, string];
const DAREDEVIL_ALLY = "60039";
const CORE_DAREDEVIL = "01058";
const MARY_ALLY = "60210a";
const RAFT_MINIONS = ["60144", "60145", "60146", "60147", "60148", "60149"];

// ---------------------------------------------------------------------------------------------------------------
// Seats and logs
// ---------------------------------------------------------------------------------------------------------------

const seatOf = (starterDeckId: string, seatNumber: number, extra: readonly string[] = []): CampaignSeatSetup => {
  const starter = [...CORE_STARTER_DECKS, ...FNE_STARTER_DECKS].find((deck) => (deck.id as string) === starterDeckId)!;
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: {
      identityCardId: starter.identityCardId,
      aspects: starter.aspects,
      cards: [...starter.cards, ...extra.map((id) => ({ cardId: cardId(id), quantity: 1 }))],
    },
  };
};
const seats = (): CampaignSeatSetup[] => [
  seatOf("core-spider-man-justice", 1),
  seatOf("core-captain-marvel-leadership", 2),
];
const newLog = (seed: number, modes: PlayModes = STANDARD, seatList: readonly CampaignSeatSetup[] = seats()) =>
  createCampaignLog(DEF, { id: `fne-qa-${seed}`, seats: seatList, modes, poolVersion: "test", seed });

// ---------------------------------------------------------------------------------------------------------------
// The driver: compose, build, play, stage the outcome, fold
// ---------------------------------------------------------------------------------------------------------------

interface BetweenChoice {
  readonly slot: string;
  readonly options: readonly string[];
}
type BetweenPick = (choice: BetweenChoice) => string | undefined;

interface RunOptions {
  /** The first-playthrough answer; "later" by default. */
  readonly playthrough?: string;
  /** Overrides the answer to a between-games choice (undefined: the playthrough answer, else the first option). */
  readonly pick?: BetweenPick;
  /** Answers the game's own choices during Setup (default: the first legal option). */
  readonly inGame?: Picker;
  readonly outcome?: "win" | "loss";
  /** Edits the state the driver stopped on, before the outcome is set (the named staging of the file header). */
  readonly surgery?: (played: GameState, opened: GameState) => GameState;
  /** Events appended for the result to read (a card removed from the game). */
  readonly events?: (played: GameState) => readonly GameEvent[];
  readonly commands?: number;
}

interface Game {
  readonly before: CampaignLog;
  readonly composed: CampaignLog;
  readonly start: CampaignGameStart;
  /** Every between-games question the runner asked to compose it, in order. */
  readonly asked: readonly BetweenChoice[];
  readonly opened: GameState;
  readonly played: GameState;
  readonly final: GameState;
  readonly result: CampaignGameResult;
  readonly after: CampaignLog;
  /** The option labels of every `chooseOption` the game put to a player during Setup. */
  readonly offers: readonly (readonly string[])[];
}

function answerBetween(
  step: (answers: readonly CampaignChoiceAnswer[]) => ReturnType<typeof resolveBetweenGames>,
  options: RunOptions,
): { value: CampaignLog; asked: BetweenChoice[] } {
  const answers: CampaignChoiceAnswer[] = [];
  const asked: BetweenChoice[] = [];
  for (let round = 0; round < 60; round++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return { value: outcome.value, asked };
    const choice = outcome.choice;
    asked.push({ slot: choice.slot, options: choice.options });
    const wanted =
      options.pick?.({ slot: choice.slot, options: choice.options }) ??
      (choice.slot === "playthrough" ? (options.playthrough ?? FNE_LATER_PLAYTHROUGH) : choice.options[0]!);
    answers.push({
      instructionId: choice.instructionId,
      slot: choice.slot,
      seatNumber: choice.seatNumber,
      picked: [wanted],
    });
  }
  throw new Error("a campaign choice kept coming");
}

/** The game a composed log starts, built the way a client builds it (as `fne.game.test.ts` does). */
function build(composed: CampaignLog) {
  const start = startGameFromLog(DEF, composed);
  const record = wave11ScenarioRecord(start.scenarioId as string);
  const config = wave11Scenario(
    start.scenarioId as string,
    {
      players: start.input.seats.map((s) => ({ identityCardId: s.identityCardId, deck: s.deck, aspects: s.aspects })),
      seed: start.input.seed,
      modes: start.modes,
      ...(start.villain ? { villainSetId: start.villain } : {}),
      ...(record.mainSchemeChoice && !start.modes.expert
        ? { mainSchemePicks: record.mainSchemeChoice.cardIds.slice(0, start.input.seats.length) as string[] }
        : {}),
    } as never,
  );
  const created = createGame({ ...config, campaign: start.input }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return { start, created };
}

const ended = (state: GameState, result: "win" | "loss"): GameState => ({
  ...state,
  outcome:
    result === "win" ? { result: "win", reason: "villainDefeated" } : { result: "loss", reason: "mainSchemeCompleted" },
});

function runGame(before: CampaignLog, options: RunOptions = {}): Game {
  const { value: composed, asked } = answerBetween(
    (answers) => resolveBetweenGames(DEF, before, DEPS, before.modes, answers),
    options,
  );
  const { start, created } = build(composed);
  const offers: string[][] = [];
  const pick = options.inGame ?? firstLegal;
  const opened = settle(
    created.state,
    (s) => {
      if (s.pendingChoice!.prompt.kind === "chooseOption") offers.push(s.pendingChoice!.options.map((o) => o.label));
      return pick(s);
    },
    (s) => s.step.phase === "player",
    WAVE11_DEPS,
  );
  const session = playToOutcome(opened, WAVE11_DEPS, { maxCommands: options.commands ?? 6 }).session;
  // The recorded session replays to the same state: the replay trace is the regression ground truth.
  const replayed = replay(session.log, WAVE11_DEPS);
  if (!replayed.ok) throw new Error("the session did not replay");
  expect(replayed.state).toEqual(session.state);
  const played = session.state;
  const staged = options.surgery ? options.surgery(played, opened) : played;
  const final = ended(staged, options.outcome ?? "win");
  const result = campaignResultOf(
    DEF,
    composed,
    final,
    [...created.events, ...replayed.events, ...(options.events?.(staged) ?? [])],
    WAVE11_DEPS,
  );
  const folded = answerBetween(
    (answers) => applyCampaignResult(DEF, composed, result, { at: 1_700_000_000_000, gameId: "qa" }, DEPS, answers),
    options,
  );
  return { before, composed, start, asked, opened, played, final, result, after: folded.value, offers };
}

// ---------------------------------------------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------------------------------------------

const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const all = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((id) => codeOf(s, id) === code);
const flag = (log: CampaignLog, field: string): boolean => {
  const value = log.shared[field];
  return value?.kind === "flag" && value.value;
};
const villainOf = (log: CampaignLog, node: string): string | undefined => {
  const value = log.shared[villainField(node)];
  return value?.kind === "choice" ? value.option : undefined;
};
const struck = (log: CampaignLog): readonly string[] => {
  const value = log.shared["unrecordedVillains"];
  return value?.kind === "strikeList" ? value.struck : [];
};
const removedTitles = (log: CampaignLog): readonly string[] => {
  const value = log.shared["removedTitles"];
  return value?.kind === "cardList" ? value.cardIds.map(String) : [];
};
const marks = (log: CampaignLog): Record<string, number> => ({ ...log.position.progress });
const markTotal = (log: CampaignLog): number => Object.values(log.position.progress).reduce((a, b) => a + b, 0);
const resolvedOf = (log: CampaignLog): Record<string, string> => ({ ...log.position.resolved });
const seatHp = (log: CampaignLog): (number | undefined)[] =>
  log.seats.map((seat) => {
    const value = seat.fields["remainingHp"];
    return value?.kind === "number" ? value.value : undefined;
  });
const hpOf = (s: GameState, seat: number): number =>
  remainingHitPoints(s, s.players[seat]!.identity.instanceId, WAVE11_DEPS) ?? Number.NaN;
const recOf = (s: GameState, seat: number): number =>
  characterProfile(s, s.players[seat]!.identity.instanceId, WAVE11_DEPS)!.rec;
const maxHpOf = (s: GameState, seat: number): number =>
  characterProfile(s, s.players[seat]!.identity.instanceId, WAVE11_DEPS)!.maxHp;
const inDeck = (s: GameState, code: string): boolean =>
  activeEncounterDeck(s).deck.some((id) => codeOf(s, id) === code);
const nodeAsked = (game: Game): readonly string[] | undefined => game.asked.find((c) => c.slot === "node")?.options;

/** Runs the whole campaign with the first offered scenario each time, until it ends. */
function playThrough(seed: number, options: RunOptions, modes: PlayModes = STANDARD): Game[] {
  const trail: Game[] = [];
  let log = newLog(seed, modes);
  for (let guard = 0; guard < 12 && log.status === "active"; guard++) {
    const game = runGame(log, options);
    trail.push(game);
    log = game.after;
  }
  return trail;
}

// ---------------------------------------------------------------------------------------------------------------
// 1. A standard campaign from the first playthrough to Kingpin
// ---------------------------------------------------------------------------------------------------------------

describe("a standard first-playthrough campaign, played game by game (MC60 pp. 8, 9)", () => {
  // Seed 7 (found by running the runner over seeds): Raft Breakout reaches three marks in game 3's draw, and Stop the
  // Presses! is the lone remaining scenario at game 4's draw, so Kingpin follows three played games.
  const trail = playThrough(7, { playthrough: FNE_FIRST_PLAYTHROUGH });

  it("plays Art Museum Heist, The Getaway and Protection Racket, then Kingpin, offered only last", () => {
    expect(trail.map((g) => g.start.nodeId)).toEqual([AMH, GETAWAY, RACKET, KINGPIN]);
    // Kingpin is never among the scenarios the players choose from, and the finale asks no question at all.
    for (const game of trail.slice(0, -1)) expect(nodeAsked(game)).not.toContain(KINGPIN);
    const kingpin = trail.at(-1)!;
    expect(nodeAsked(kingpin)).toBeUndefined();
    // It is reached only when every underling scenario is resolved (three Completed, two Failed by their marks).
    expect(Object.keys(resolvedOf(kingpin.composed)).sort()).toEqual([...FNE_UNDERLING_NODES].sort());
    for (const game of trail.slice(0, -1))
      expect(Object.keys(resolvedOf(game.composed)).length, game.start.nodeId).toBeLessThan(5);
    expect(trail.map((g) => g.result.outcome)).toEqual(["won", "won", "won", "won"]);
    expect(trail.at(-1)!.after.status).toBe("won");
  });

  it("p. 8 'Underling villain play order': Hammerhead, Bullseye, Electro, each recorded and struck from the list", () => {
    expect(trail.slice(0, 3).map((g) => g.start.villain)).toEqual(["hammerhead", "bullseye", "electro"]);
    expect(trail.slice(0, 3).map((g) => villainOf(g.composed, g.start.nodeId))).toEqual([
      "hammerhead",
      "bullseye",
      "electro",
    ]);
    expect(struck(trail[1]!.composed)).toEqual(["hammerhead", "bullseye"]);
    expect(struck(trail[2]!.composed)).toEqual(["hammerhead", "bullseye", "electro"]);
    // The playthrough question is asked once, at the very start.
    expect(trail.map((g) => g.asked.some((c) => c.slot === "playthrough"))).toEqual([true, false, false, false]);
    // 5b is offered at each of the three underling setups (Q210 = B), and not at Kingpin, which has no underling villain.
    expect(trail.map((g) => g.asked.some((c) => c.slot === "villainMethod"))).toEqual([true, true, true, false]);
    // Kingpin has no underling villain.
    expect(trail.at(-1)!.start.villain).toBeFalsy();
  });

  it("step 3: each game's draw marks two scenarios once each; a scenario with three marks has Failed", () => {
    // The draw only ever adds marks (a scenario that is played keeps its marks, as the log sheet shows).
    for (let i = 1; i < 3; i++) {
      const before = trail[i - 1]!.after;
      const now = trail[i]!.composed;
      for (const node of FNE_UNDERLING_NODES) {
        expect(marks(now)[node] ?? 0, `${node} before game ${i + 1}`).toBeGreaterThanOrEqual(marks(before)[node] ?? 0);
      }
    }
    // Game 3's draw puts the third mark on The Raft Breakout (2 before it): it Fails before the players choose.
    expect(marks(trail[1]!.after)[RAFT]).toBe(2);
    expect(marks(trail[2]!.composed)[RAFT]).toBe(3);
    expect(trail[2]!.composed.position.resolved[RAFT]).toBe("failed");
    expect(nodeAsked(trail[2]!)).not.toContain(RAFT);
  });

  it("step 3: with one scenario left to draw, it gets two marks (here 1 to 3) and Fails; Kingpin follows", () => {
    const beforeFinale = trail[2]!.after;
    expect(marks(beforeFinale)[PRESSES]).toBe(1);
    expect(Object.keys(resolvedOf(beforeFinale))).not.toContain(PRESSES);
    const kingpin = trail.at(-1)!.composed;
    // Exactly the two marks of the lone draw (not one), stopping at the fail threshold.
    expect(marks(kingpin)[PRESSES]).toBe(3);
    expect(resolvedOf(kingpin)[PRESSES]).toBe("failed");
    // Nothing else was marked by it.
    expect(markTotal(kingpin) - markTotal(beforeFinale)).toBe(2);
  });

  it("a scenario that Failed by its marks puts its Failed environment into play, Setup resolved, in the very next game", () => {
    // Game 3 (Protection Racket): The Raft Breakout Failed in its draw. 60208 on its Failed face, 60144 to 60149
    // (its six minions) shuffled into the encounter deck by its Setup (MC60 p. 9 step 12).
    const game3 = trail[2]!.opened;
    const raft = all(game3, FNE_ENVIRONMENTS[RAFT]!);
    expect(raft).toHaveLength(1);
    expect(inst(game3, raft[0]!).flipped).toBe(true);
    for (const code of RAFT_MINIONS) expect(inDeck(game3, code), code).toBe(true);
    // The Completed environments of games 1 and 2 are on their Completed faces and are not Failed.
    for (const node of [AMH, GETAWAY]) {
      const env = all(game3, FNE_ENVIRONMENTS[node]!);
      expect(env, node).toHaveLength(1);
      expect(inst(game3, env[0]!).flipped, node).toBe(false);
    }
    // Control: before it Failed, game 2 had neither the Raft environment nor its minions.
    expect(all(trail[1]!.opened, FNE_ENVIRONMENTS[RAFT]!)).toHaveLength(0);
    for (const code of RAFT_MINIONS) expect(inDeck(trail[1]!.opened, code), code).toBe(false);
  });

  it("the finale sets up with all five environments, the two Failed ones on their Failed faces", () => {
    const kingpin = trail.at(-1)!.opened;
    const faces = Object.fromEntries(
      FNE_UNDERLING_NODES.map((node) => {
        const env = all(kingpin, FNE_ENVIRONMENTS[node]!);
        return [node, env.length === 1 ? inst(kingpin, env[0]!).flipped : "missing"];
      }),
    );
    expect(faces).toEqual({ [AMH]: false, [GETAWAY]: false, [RACKET]: false, [RAFT]: true, [PRESSES]: true });
  });

  it("the Completed box of each won scenario, and none for a Failed one, is in the log", () => {
    const last = trail.at(-1)!.composed;
    for (const node of [AMH, GETAWAY, RACKET]) expect(flag(last, completedField(node)), node).toBe(true);
    for (const node of [RAFT, PRESSES]) expect(flag(last, completedField(node)), node).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 2. A lost game returns to Campaign Setup
// ---------------------------------------------------------------------------------------------------------------

describe("a lost scenario goes back to Campaign Setup with the log kept (MC60 p. 8; DEFEAT on pp. 13 to 23)", () => {
  const first = runGame(newLog(7), { playthrough: FNE_FIRST_PLAYTHROUGH });
  // Game 2 is The Getaway (Bullseye), lost.
  const lost = runGame(first.after, { outcome: "loss" });
  const retry = runGame(lost.after, { pick: (c) => (c.slot === "node" ? GETAWAY : undefined) });

  it("the lost game changes nothing in the log but the history: marks, villain record and strike list are kept", () => {
    expect(lost.start.nodeId).toBe(GETAWAY);
    expect(lost.result.outcome).toBe("lost");
    expect(lost.after.status).toBe("active");
    expect(lost.after.history.map((h) => [h.nodeId, h.outcome])).toEqual([
      [AMH, "won"],
      [GETAWAY, "lost"],
    ]);
    // Standard mode: no DEFEAT progress and no hit points; the scenario is not resolved.
    expect(marks(lost.after)).toEqual(marks(lost.composed));
    expect(Object.keys(resolvedOf(lost.after))).toEqual([AMH]);
    expect(villainOf(lost.after, GETAWAY)).toBe("bullseye");
    expect(struck(lost.after)).toEqual(["hammerhead", "bullseye"]);
  });

  it("steps 1 to 4 run again: two new marks on top of the kept ones, the scenario chosen again, no first-playthrough question", () => {
    const kept = marks(lost.after);
    const now = marks(retry.composed);
    // Marks never go down, and the new draw is exactly two more (3 is the most any scenario shows).
    for (const node of FNE_UNDERLING_NODES) expect(now[node] ?? 0, node).toBeGreaterThanOrEqual(kept[node] ?? 0);
    expect(markTotal(retry.composed) - markTotal(lost.after)).toBe(2);
    // The players are asked which scenario to play again, and the lost one is offered.
    expect(nodeAsked(retry)).toContain(GETAWAY);
    expect(retry.start.nodeId).toBe(GETAWAY);
    expect(retry.asked.map((c) => c.slot)).not.toContain("playthrough");
    expect(flag(retry.composed, completedField(GETAWAY))).toBe(false);
  });

  it("step 5a: the villain already listed for the scenario is used, not drawn or struck again", () => {
    expect(retry.start.villain).toBe("bullseye");
    expect(villainOf(retry.composed, GETAWAY)).toBe("bullseye");
    expect(struck(retry.composed)).toEqual(["hammerhead", "bullseye"]);
    expect(retry.asked.map((c) => c.slot)).not.toContain("villain");
  });

  it("the retry is an ordinary game: won, it Completes the scenario and the history shows both attempts", () => {
    expect(retry.after.history.map((h) => [h.nodeId, h.outcome])).toEqual([
      [AMH, "won"],
      [GETAWAY, "lost"],
      [GETAWAY, "won"],
    ]);
    expect(resolvedOf(retry.after)[GETAWAY]).toBe("completed");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 3. First-playthrough villain order with the Purple Man / Typhoid Mary choice
// ---------------------------------------------------------------------------------------------------------------

describe("first playthrough, the fourth underling villain (MC60 p. 8 'Underling villain play order' item 4)", () => {
  // Seed 2: four underling games are played before Kingpin (Stop the Presses! Fails in the draw of game 4).
  const log = (pickVillain: string) => {
    const trail: Game[] = [];
    let current = newLog(2);
    for (let guard = 0; guard < 8 && current.status === "active"; guard++) {
      const game = runGame(current, {
        playthrough: FNE_FIRST_PLAYTHROUGH,
        pick: (c) => (c.slot === "villain" ? pickVillain : undefined),
      });
      trail.push(game);
      current = game.after;
    }
    return trail;
  };

  it("asks the group to choose between Purple Man and Typhoid Mary at the fourth game, and plays the one named", () => {
    const trail = log("typhoid_mary");
    expect(trail.map((g) => g.start.nodeId)).toEqual([AMH, GETAWAY, RACKET, RAFT, KINGPIN]);
    expect(trail.slice(0, 3).map((g) => g.start.villain)).toEqual(["hammerhead", "bullseye", "electro"]);
    const fourth = trail[3]!;
    const asked = fourth.asked.find((c) => c.slot === "villain");
    expect(asked?.options).toEqual(["purple_man", "typhoid_mary"]);
    // The first three games asked no villain question at all.
    for (const game of trail.slice(0, 3)) expect(game.asked.map((c) => c.slot)).not.toContain("villain");
    expect(fourth.start.villain).toBe("typhoid_mary");
    expect(villainOf(fourth.composed, RAFT)).toBe("typhoid_mary");
    expect(struck(fourth.composed)).toEqual(["hammerhead", "bullseye", "electro", "typhoid_mary"]);
  });

  it("the choice is the group's: naming Purple Man instead plays Purple Man", () => {
    const trail = log("purple_man");
    expect(trail[3]!.start.villain).toBe("purple_man");
    expect(struck(trail[3]!.composed)).toEqual(["hammerhead", "bullseye", "electro", "purple_man"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 4. Trust and Typhoid Mary
// ---------------------------------------------------------------------------------------------------------------

describe("Trust Established and the Typhoid Mary ally (MC60 p. 9 step 13; Protection Racket VICTORY p. 13)", () => {
  // Seed 7, later playthrough: Typhoid Mary is Art Museum Heist's villain (game 1), so Disturbed Psyche is on the table.
  const trustLog = newLog(7);
  const one = runGame(trustLog, {
    // Staged: Disturbed Psyche (60112) with 2 threat when the game is won; the driver's opening does not reach it.
    surgery: (played) => patchInstance(played, all(played, "60112")[0]!, { threat: 2 }),
  });
  const two = runGame(one.after, {
    // Staged: the ally ends the game in the victory display (defeated), the way a win by defeating her puts her there.
    surgery: (played) => {
      const mary = all(played, MARY_ALLY)[0]!;
      return { ...played, victoryDisplay: [...played.victoryDisplay, mary] };
    },
  });
  const three = runGame(two.after);

  it("game 1 is a Typhoid Mary game, and a win with Disturbed Psyche at 2 threat checks Trust Established", () => {
    expect(one.start.nodeId).toBe(AMH);
    expect(one.start.villain).toBe("typhoid_mary");
    expect(all(one.opened, MARY_ALLY)).toHaveLength(0);
    expect(flag(one.after, "trustEstablished")).toBe(true);
    expect(flag(one.after, "maryDefeated")).toBe(false);
  });

  it("Trust Established puts the ally into play under a player's control in the next game", () => {
    const mary = all(two.opened, MARY_ALLY);
    expect(mary).toHaveLength(1);
    expect(inst(two.opened, mary[0]!).controllerId).not.toBeNull();
    // It is gathered by the campaign (set aside) rather than shuffled into any deck.
    expect(two.composed.attempt!.input.setAsideCards?.map(String)).toContain(MARY_ALLY);
  });

  it("with her in the victory display, Mary Defeated is checked and no later game has the ally", () => {
    expect(flag(two.after, "maryDefeated")).toBe(true);
    expect(flag(two.after, "trustEstablished")).toBe(true);
    expect(all(three.opened, MARY_ALLY)).toHaveLength(0);
    expect(three.composed.attempt!.input.setAsideCards?.map(String)).not.toContain(MARY_ALLY);
  });

  it("without Trust (Disturbed Psyche at 1 threat) there is no ally in the next game", () => {
    const weak = runGame(trustLog, {
      surgery: (played) => patchInstance(played, all(played, "60112")[0]!, { threat: 1 }),
    });
    expect(flag(weak.after, "trustEstablished")).toBe(false);
    expect(all(runGame(weak.after).opened, MARY_ALLY)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 5. A removed Daredevil ally leaves every deck
// ---------------------------------------------------------------------------------------------------------------

describe("an ally removed from the game at Victory leaves the deck by title (MC60 p. 9 step 8; log sheet p. 28)", () => {
  // Echo's starter deck (seat 2) holds Daredevil (60039); Spider-Man's Justice deck (seat 1) holds the Core Set's
  // Daredevil ally (01058), the same title (Daredevil, Matt Murdock). Each deck gets one filler card so it is still a
  // legal 40 once the ally is gone (deck legality after a removal is not what is tested here).
  const echo = seatOf("fne-echo-protection", 2);
  const spider = seatOf("core-spider-man-justice", 1);
  const withFiller = (seat: CampaignSeatSetup, filler: string, quantity: number): CampaignSeatSetup => ({
    ...seat,
    deck: {
      ...seat.deck,
      cards: seat.deck.cards.some((l) => (l.cardId as string) === filler)
        ? seat.deck.cards.map((l) => ((l.cardId as string) === filler ? { ...l, quantity } : l))
        : [...seat.deck.cards, { cardId: cardId(filler), quantity }],
    },
  });
  const both = [withFiller(spider, "01060", 3), withFiller(echo, "01077", 1)];
  const one = runGame(newLog(7, STANDARD, both), {
    // Staged: seat 2's copy of the ally is removed from the game during play (nothing in the opening does it).
    events: (played) => {
      const copy = all(played, DAREDEVIL_ALLY)[0]!;
      return [
        {
          type: "cardMoved",
          instanceId: copy,
          cardId: cardId(DAREDEVIL_ALLY),
          from: { kind: "setAside" },
          to: { kind: "removedFromGame" },
        } as never,
      ];
    },
  });
  const two = runGame(one.after);

  it("the VICTORY step records the title; before it, each deck holds a card of that title", () => {
    expect(all(one.opened, DAREDEVIL_ALLY).length).toBeGreaterThanOrEqual(1);
    expect(all(one.opened, CORE_DAREDEVIL).length).toBeGreaterThanOrEqual(1);
    expect(removedTitles(one.after)).toEqual([DAREDEVIL_ALLY]);
  });

  it("the next game's deck surgery removes every card of that title from both decks, and none is in that game", () => {
    expect(two.composed.removedFromCampaign.some((face) => face.cardId === cardId(DAREDEVIL_ALLY))).toBe(true);
    expect(two.composed.removedFromCampaign.map((face) => face.cardId as string).sort()).toEqual([
      CORE_DAREDEVIL,
      DAREDEVIL_ALLY,
    ]);
    for (const seat of two.composed.attempt!.input.seats) {
      expect(seat.deck).not.toContain(DAREDEVIL_ALLY);
      expect(seat.deck).not.toContain(CORE_DAREDEVIL);
    }
    expect(all(two.opened, CORE_DAREDEVIL)).toHaveLength(0);
    expect(all(two.opened, DAREDEVIL_ALLY)).toHaveLength(0);
  });

  it("a lost game records no removal (Q201): the card is still in the deck for the retry", () => {
    const lost = runGame(newLog(7, STANDARD, both), {
      outcome: "loss",
      events: (played) => [
        {
          type: "cardMoved",
          instanceId: all(played, DAREDEVIL_ALLY)[0]!,
          cardId: cardId(DAREDEVIL_ALLY),
          from: { kind: "setAside" },
          to: { kind: "removedFromGame" },
        } as never,
      ],
    });
    expect(removedTitles(lost.after)).toEqual([]);
    expect(all(runGame(lost.after).opened, DAREDEVIL_ALLY).length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 6. Expert: hit points carry over, rejoin or sit out, and Kingpin's DEFEAT
// ---------------------------------------------------------------------------------------------------------------

const HEAL = "Heal REC · +1 facedown card";
const REJOIN = "Rejoin and heal REC · +1 facedown card";

/** Per seat: pay (heal or rejoin), decline, or sit this scenario out. */
const expertPicker =
  (wants: readonly ("pay" | "decline" | "sitOut")[]): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseOption") {
      const seat = s.players.findIndex((p) => p.playerId === choice.playerId);
      const labels = choice.options.map((o) => o.label);
      const heal = labels.find((l) => l === HEAL || l === REJOIN);
      if (heal) {
        const want = wants[seat] ?? "decline";
        const label = want === "pay" ? heal : want === "sitOut" ? SIT_OUT_LABEL : "Decline";
        const hit = choice.options.find((o) => o.label === label);
        if (hit) return [hit.optionId];
      }
    }
    return firstLegal(s);
  };

const damaged = (state: GameState, seat: number, damage: number): GameState =>
  patchInstance(state, state.players[seat]!.identity.instanceId, { damage });
const eliminate = (state: GameState, seat: number): GameState => ({
  ...state,
  players: state.players.map((p, i) => (i === seat ? { ...p, eliminated: true } : p)),
});

describe("an expert Fear No Evil campaign (MC60 p. 9 steps 10 and 11, Kingpin DEFEAT p. 23)", () => {
  const decline = expertPicker(["decline", "decline"]);
  // Game 1: seat 1 ends at 3 damage; seat 2 is defeated in a scenario the team goes on to win (staged: the driver's
  // opening neither hurts nor defeats anyone).
  const g1 = runGame(newLog(7, EXPERT), {
    inGame: decline,
    surgery: (played) => eliminate(damaged(played, 0, 3), 1),
  });
  // Game 2: seat 1 declines the heal, seat 2 sits out; seat 1 ends at 5 damage.
  const g2 = runGame(g1.after, {
    inGame: expertPicker(["decline", "sitOut"]),
    surgery: (played) => damaged(played, 0, 5),
  });
  // Game 3: seat 1 pays for the heal, seat 2 rejoins.
  const g3 = runGame(g2.after, { inGame: expertPicker(["pay", "pay"]) });

  it("records remaining hit points after a win, and a defeated seat that sits out the Victory steps records 0", () => {
    expect(g1.start.nodeId).toBe(AMH);
    expect(g1.result.sittingOut).toEqual([2]);
    expect(seatHp(g1.after)).toEqual([maxHpOf(g1.final, 0) - 3, 0]);
  });

  it("game 2 starts seat 1 at the recorded hit points (step 10), offering seat 2 to rejoin or sit out first", () => {
    expect(hpOf(g2.opened, 0)).toBe(maxHpOf(g1.final, 0) - 3);
    // The defeated seat is asked before the scenario is set up, with no option to decline the price.
    expect(g2.offers[0]).toEqual([REJOIN, SIT_OUT_LABEL]);
    // Seat 1 (recorded above 0) may decline the heal.
    expect(g2.offers.some((labels) => labels.includes(HEAL) && labels.includes("Decline"))).toBe(true);
    expect(g2.opened.players[1]!.sittingOut).toBe(true);
    expect(g2.opened.startingPlayerCount).toBe(1);
  });

  it("hit points persist across two games: game 2's record (5 damage) is game 3's starting point, and a sat-out seat stays at 0", () => {
    expect(seatHp(g2.after)).toEqual([maxHpOf(g2.final, 0) - 5, 0]);
    expect(g2.result.sittingOut).toEqual([2]);
    // Game 3 (step 10): the record is the start; seat 1 paid the facedown-card heal for REC (step 11), capped at full.
    const record = maxHpOf(g2.final, 0) - 5;
    expect(g3.offers.some((labels) => labels.includes(HEAL))).toBe(true);
    expect(hpOf(g3.opened, 0)).toBe(Math.min(record + recOf(g3.opened, 0), maxHpOf(g3.opened, 0)));
    expect(hpOf(g3.opened, 0)).toBeGreaterThan(record);
  });

  it("the sat-out seat rejoins for the price: it starts at its REC, not full, and is a player again", () => {
    expect(g3.offers[0]).toEqual([REJOIN, SIT_OUT_LABEL]);
    expect(g3.opened.players[1]!.sittingOut).toBeFalsy();
    expect(g3.opened.players[1]!.eliminated).toBe(false);
    expect(hpOf(g3.opened, 1)).toBe(Math.min(recOf(g3.opened, 1), maxHpOf(g3.opened, 1)));
    expect(g3.opened.startingPlayerCount).toBe(2);
    expect(g3.result.sittingOut ?? []).toEqual([]);
  });

  it("Kingpin's DEFEAT flips a Completed environment to Failed and replays; with none Completed the campaign is lost", () => {
    let log = g3.after;
    const completedNow = (l: CampaignLog) => FNE_UNDERLING_NODES.filter((n) => l.position.resolved[n] === "completed");
    const startCompleted = completedNow(log);
    expect(startCompleted.length).toBeGreaterThan(0);
    // After game 3 four are resolved; game 4 is Kingpin, the fifth Failing in that game's own draw (step 3).
    const flipped: string[] = [];
    let previous: Game | undefined;
    for (let guard = 0; guard < 8 && log.status === "active"; guard++) {
      const before = completedNow(log);
      const game = runGame(log, { outcome: "loss", inGame: decline });
      expect(game.start.nodeId).toBe(KINGPIN);
      expect(Object.keys(resolvedOf(game.composed))).toHaveLength(5);
      // Replays after a flip: the environment flipped by the last loss is on its Failed face in this game.
      if (previous) {
        const env = all(game.opened, FNE_ENVIRONMENTS[flipped.at(-1)!]!);
        expect(env).toHaveLength(1);
        expect(inst(game.opened, env[0]!).flipped).toBe(true);
      }
      log = game.after;
      previous = game;
      if (before.length > 0) {
        expect(log.status).toBe("active");
        const now = completedNow(log);
        const changed = before.filter((n) => !now.includes(n));
        expect(changed, "exactly one environment flips").toHaveLength(1);
        expect(log.position.resolved[changed[0]!]).toBe("failed");
        expect(flag(log, completedField(changed[0]!))).toBe(false);
        expect(now).toHaveLength(before.length - 1);
        flipped.push(changed[0]!);
      } else {
        expect(log.status).toBe("lost");
      }
    }
    expect(flipped).toHaveLength(startCompleted.length);
    expect(new Set(flipped).size).toBe(flipped.length);
    expect(log.status).toBe("lost");
    // Every underling scenario ended Failed; the history holds each Kingpin loss.
    for (const node of FNE_UNDERLING_NODES) expect(log.position.resolved[node], node).toBe("failed");
    expect(log.history.filter((h) => h.nodeId === KINGPIN).map((h) => h.outcome)).toEqual(
      Array(startCompleted.length + 1).fill("lost"),
    );
  });
});

// A standard campaign has no such DEFEAT: the control for the flip above.
describe("Kingpin lost in a standard campaign (MC60 p. 23: the DEFEAT flip is Expert Campaign only)", () => {
  it("keeps every environment Completed and offers Kingpin again", () => {
    const trail = playThrough(7, { playthrough: FNE_FIRST_PLAYTHROUGH });
    const beforeKingpin = trail.at(-2)!.after;
    const lost = runGame(beforeKingpin, { outcome: "loss" });
    expect(lost.start.nodeId).toBe(KINGPIN);
    expect(lost.after.status).toBe("active");
    expect(resolvedOf(lost.after)).toEqual(resolvedOf(lost.composed));
    expect(runGame(lost.after).start.nodeId).toBe(KINGPIN);
  });
});
