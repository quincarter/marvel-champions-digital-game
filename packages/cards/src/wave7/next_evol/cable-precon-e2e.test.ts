import {
  createGame,
  playerSideSchemeLimit,
  printedResources,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, firstLegal, moveToHand, patchInstance, playerOf, settle } from "../../testing/harness.js";
import { playToOutcome } from "../../testing/driver.js";
import { withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with Cable's precon (`cable-leadership`, cards 40001-40036) through the real engine and the real wave 7
 * scripts, played by the card-name-agnostic greedy driver (`../../testing/driver.ts`) one command at a time, so that
 * every state is checked against the invariants below:
 *
 * - no engine error on a command the driver chose from legal candidates (`sessionApply` reports it);
 * - no prompt without an answer (RRG 1.8 "Choices" are never a soft lock): `minSelections` fits the options offered;
 * - a command never leaves the game between steps with nothing pending: the villain phase always completes
 *   (RRG Appendix II, "Villain Phase", pp. 51-52) and rounds advance by exactly one;
 * - the player side scheme limit is one for one or two starting players (RRG 1.8 "Player Side Scheme Limit", p. 34);
 * - no card instance sits in two zones; every card a player owns is still somewhere; cards stay in their owner's zones
 *   (RRG 1.8 "Owner", "Controller" p. 31: a player's hand, deck and discard pile hold only that player's cards);
 * - the first player token passes to the next seat at the end of each round (RRG 1.8 "First Player", p. 20);
 * - the session log replays to the identical final state (RRG-independent: the engine's determinism contract).
 *
 * Two deviations from the driver, both about policy and not about the rules: Hope Summers is never declared a
 * defender (Stryfe: "If Hope Summers is defeated, you lose", so the greedy driver, which defends with any ally, lost
 * round 1 of every Stryfe game), and a turn is ended after 40 commands (the driver's own per-turn cap resets because it
 * is asked for one command at a time).
 */

const CABLE = { starterDeckId: "cable-leadership" } as const;
const DOMINO = { starterDeckId: "domino-justice" } as const;
const HOPE_SUMMERS = "40130";

/** Which targeted checks (task item 4) were observed anywhere in this file's games. */
const seen = {
  soldierXSearch: 0,
  cableReadiesAfterScheme: 0,
  cableReadiedWhileExhausted: 0,
  playerSideSchemeToVictoryDisplay: 0,
  mindScan: [] as { readonly expected: number; readonly actual: number; readonly note: string }[],
  telekineticBlast: [] as { readonly expected: number; readonly actual: number; readonly note: string }[],
  obligationOrNemesis: 0,
};

interface GameResult {
  readonly session: GameSession;
  readonly commands: number;
}

const cardType = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.type;
const PLAYER_CARD_TYPES: readonly string[] = ["ally", "event", "resource", "support", "upgrade", "player_side_scheme"];
const isSideScheme = (s: GameState, id: InstanceId) => ["side_scheme", "player_side_scheme"].includes(cardType(s, id));
const cardName = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const codeOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;

/** Every list an instance can be in, labeled; attachments, tucked and boost cards are listed under their host. */
function zoneIndex(s: GameState): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (id: InstanceId, label: string) => index.set(id, [...(index.get(id) ?? []), label]);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea", "dealtEncounter", "resolving", "setAside"] as const)
      for (const id of p[zone]) add(id, `${p.playerId}.${zone}`);
    for (const [name, sep] of Object.entries(p.separateDecks)) {
      for (const id of sep.deck) add(id, `${p.playerId}.sep.${name}.deck`);
      for (const id of sep.discard) add(id, `${p.playerId}.sep.${name}.discard`);
    }
    add(p.identity.instanceId, `${p.playerId}.identity`);
  }
  for (const [deckId, pile] of Object.entries(s.encounterDecks)) {
    for (const id of pile.deck) add(id, `enc.${deckId}.deck`);
    for (const id of pile.discard) add(id, `enc.${deckId}.discard`);
  }
  for (const id of s.encounterSetAside) add(id, "encounterSetAside");
  for (const id of s.villainArea) add(id, "villainArea");
  for (const id of s.victoryDisplay) add(id, "victoryDisplay");
  for (const id of s.removedFromGame) add(id, "removedFromGame");
  for (const [id, instance] of Object.entries(s.instances)) {
    for (const t of instance.tucked) add(t, `tuckedUnder.${id}`);
    for (const b of instance.boostCards) add(b, `boostOn.${id}`);
  }
  return index;
}

/**
 * Throws a descriptive error on the first broken invariant of `state`. `dealtTo` maps every card a player's deck started
 * with to that player: encounter cards change owner when a rule says so (a Morlock put into play is owned by the player
 * it joins, "ownershipChanged"), so ownership of the deck's own cards is read from setup, not from `ownerId`.
 */
function checkState(s: GameState, dealtTo: ReadonlyMap<string, PlayerId>, where: string): void {
  const fail = (message: string): never => {
    throw new Error(`[${where}] round ${s.round} ${s.step.phase}/${s.step.kind}: ${message}`);
  };
  const choice = s.pendingChoice;
  if (choice) {
    if (choice.minSelections > choice.options.length)
      fail(`soft lock: ${choice.prompt.kind} needs ${choice.minSelections} but offers ${choice.options.length}`);
    if (choice.minSelections > choice.maxSelections) fail(`${choice.prompt.kind}: min > max`);
  } else if (!s.outcome && !(s.step.phase === "player" && s.step.kind === "turn")) {
    fail("the game stopped between steps with nothing pending");
  }
  const zones = zoneIndex(s);
  for (const [id, labels] of zones)
    if (labels.length > 1) fail(`${id} (${cardName(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  const limit = playerSideSchemeLimit(s);
  const sideSchemes = s.villainArea.filter((id) => cardType(s, id) === "player_side_scheme");
  // While the "discard down to the limit" prompt is open the extra scheme is legitimately in play.
  if (choice?.prompt.kind !== "discardOverPlayerSideSchemeLimit" && sideSchemes.length > limit)
    fail(`${sideSchemes.length} player side schemes in play, limit ${limit}`);
  // Conservation: every card a deck started with is still somewhere (or attached to something in play).
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${cardName(s, id as InstanceId)} (${id}) is in no zone`);
  for (const p of s.players) {
    // Cards stay in their own player's zones: a deck card of another player never shows up in this player's.
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) {
        const dealt = dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId)
          fail(`${cardName(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
        if (zone !== "hand" && zone !== "playArea" && dealt === undefined)
          fail(`${cardName(s, id)} (${id}) is in ${p.playerId}'s ${zone} but no deck started with it`);
      }
  }
}

/** The driver's own answer, except that Hope Summers never defends and nothing else changes. */
function ownAnswer(s: GameState, choice: PendingChoice): readonly string[] | null {
  if (choice.prompt.kind !== "declareDefender") return null;
  const ids = choice.options.map((o) => o.optionId);
  const allies = ids.filter(
    (id) =>
      id !== "decline" && cardType(s, id as InstanceId) === "ally" && codeOf(s, id as InstanceId) !== HOPE_SUMMERS,
  );
  if (allies[0]) return [allies[0]];
  return ids.includes("decline") ? ["decline"] : null;
}

/** Watches events, one command at a time, for the targeted checks and the per-round rules. */
class Observer {
  /** `expected` Mind Scan / Telekinetic Blast amounts waiting for their threat removal / damage. */
  private pending: { kind: "mindScan" | "blast"; n: number; card: InstanceId }[] = [];
  private readonly cableResponsesIn = new Map<string, number>();
  readonly firstPlayerByRound = new Map<number, PlayerId>();
  readonly turnOrder = new Map<number, PlayerId[]>();
  private lastRound = 0;
  /** Schemes defeated so far: a response or a victory display move can come a command after the defeat (its prompt). */
  private readonly defeated = new Set<string>();

  observe(before: GameState, after: GameState, events: readonly GameEvent[]): void {
    const victoryCount = before.victoryDisplay.filter((id) => isSideScheme(before, id)).length;
    for (const e of events) if (e.type === "schemeDefeated") this.defeated.add(e.instanceId);
    for (const e of events) {
      switch (e.type) {
        case "cardPlayed":
          if (String(e.cardId) === "40003")
            this.pending.push({ kind: "mindScan", n: victoryCount, card: e.instanceId });
          if (String(e.cardId) === "40005") this.pending.push({ kind: "blast", n: victoryCount, card: e.instanceId });
          break;
        case "triggerEvent": {
          const ev = e.event as unknown as Record<string, unknown>;
          const mine = this.pending.find((p) => p.card === ev.sourceInstanceId || p.card === ev.viaInstanceId);
          // The card's play is over: an effect that never resolved (cancelled, no legal target) must not claim a later one.
          if (ev.kind === "cardPlayed" && e.phase === "resolved")
            this.pending = this.pending.filter((p) => p.card !== ev.instanceId);
          if (!mine) break;
          if (mine.kind === "mindScan" && ev.kind === "thwart" && e.phase === "initiated") {
            // "Remove 3 threat from a scheme, +1 per side scheme in the victory display".
            seen.mindScan.push({
              expected: 3 + mine.n,
              actual: ev.amount as number,
              note: `Mind Scan's thwart with ${mine.n} side schemes in the victory display`,
            });
          }
          if (mine.kind === "mindScan" && ev.kind === "thwart" && e.phase === "resolved") {
            const scheme = ev.schemeInstanceId as InstanceId;
            const removed = (ev.results as { threatRemoved?: number } | undefined)?.threatRemoved;
            if (removed === undefined) break;
            seen.mindScan.push({
              expected: Math.min(3 + mine.n, before.instances[scheme]!.threat),
              actual: removed,
              note: `Mind Scan removed from ${cardName(before, scheme)} (${before.instances[scheme]!.threat} threat), ${mine.n} in the victory display`,
            });
          }
          if (mine.kind === "blast" && ev.kind === "attack" && e.phase === "initiated") {
            // "6 damage to an enemy, +1 per side scheme in the victory display".
            seen.telekineticBlast.push({
              expected: 6 + mine.n,
              actual: ev.amount as number,
              note: `Telekinetic Blast's attack with ${mine.n} side schemes in the victory display`,
            });
          }
          if (mine.kind === "blast" && ev.kind === "dealDamage" && e.phase === "initiated") {
            seen.telekineticBlast.push({
              expected: 6 + mine.n,
              actual: ev.amount as number,
              note: `Telekinetic Blast's damage to ${cardName(before, ev.targetInstanceId as InstanceId)}, ${mine.n} in the victory display`,
            });
          }
          break;
        }
        case "cardMoved":
          if (e.to.kind === "victoryDisplay" && cardType(after, e.instanceId) === "player_side_scheme") {
            expect(this.defeated.has(e.instanceId)).toBe(true);
            seen.playerSideSchemeToVictoryDisplay++;
          }
          break;
        case "abilityResolved": {
          const id = String(e.abilityId);
          if (id === "40001a.cable-response") {
            // "After Cable defeats a scheme, ready him", once per phase (the ability's own limit).
            expect(this.defeated.size).toBeGreaterThan(0);
            const key = `${after.round}:${before.step.phase}`;
            this.cableResponsesIn.set(key, (this.cableResponsesIn.get(key) ?? 0) + 1);
            expect(this.cableResponsesIn.get(key)).toBe(1);
            // Cable is ready afterward; the response only does something visible when he was exhausted (a basic thwart).
            const cable = after.players.find((p) => codeOf(after, p.identity.instanceId).startsWith("40001"))!;
            expect(after.instances[cable.identity.instanceId]!.exhausted).toBe(false);
            seen.cableReadiesAfterScheme++;
            if (events.some((x) => x.type === "cardReadied" && x.instanceId === cable.identity.instanceId))
              seen.cableReadiedWhileExhausted++;
          }
          if (/^4003[1-6]\./.test(id)) seen.obligationOrNemesis++;
          break;
        }
        case "drawnObligationPlaced":
          seen.obligationOrNemesis++;
          break;
        case "encounterCardRevealed":
          if (/^4003[1-6]$/.test(String(e.cardId))) seen.obligationOrNemesis++;
          break;
        case "turnStarted":
          this.turnOrder.set(after.round, [...(this.turnOrder.get(after.round) ?? []), e.playerId]);
          break;
        default:
      }
    }
    if (after.round !== this.lastRound) {
      expect(after.round - this.lastRound).toBe(1); // the villain phase always completes into exactly the next round
      this.firstPlayerByRound.set(after.round, after.firstPlayerId);
      this.lastRound = after.round;
    }
  }
}

function nextCommand(
  session: GameSession,
  turn: { key: string; n: number },
  script: ((s: GameState) => Command)[],
): Command {
  const s = session.state;
  const choice = s.pendingChoice;
  // Scripted opening commands (the staged game) go first, whenever no prompt is open.
  if (!choice && !s.outcome && script.length > 0) return script.shift()!(s);
  if (choice) {
    const own = ownAnswer(s, choice);
    if (own)
      return { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: own };
  } else if (s.step.phase === "player" && s.step.kind === "turn") {
    const key = `${s.round}:${s.step.activePlayerId}`;
    if (turn.key !== key) Object.assign(turn, { key, n: 0 });
    if (++turn.n > 40) return { type: "endTurn", playerId: s.step.activePlayerId };
  }
  // The driver, asked for exactly one command from this state (it throws if it would issue an illegal one).
  const [command] = playToOutcome(s, WAVE7_DEPS, { maxCommands: 1 }).session.log.commands;
  if (!command) throw new Error("the driver issued no command");
  return command;
}

interface PlayOptions {
  /** Stop once this round starts (a game past it is one that completed `stopAtRound - 1` full rounds). */
  readonly stopAtRound?: number;
  readonly maxCommands?: number;
  /** Commands to issue first, each built from the state it is issued in; the driver plays on from there. */
  readonly script?: readonly ((s: GameState) => Command)[];
}

/** Plays `initial` to an outcome (or `stopAtRound`), checking every invariant after every command. */
function play(initial: GameState, observer: Observer, options: PlayOptions = {}): GameResult {
  const dealtTo = new Map<string, PlayerId>();
  for (const p of initial.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) if (initial.instances[id]!.ownerId === p.playerId) dealtTo.set(id, p.playerId);
  for (const [id, instance] of Object.entries(initial.instances))
    if (instance.ownerId !== null && PLAYER_CARD_TYPES.includes(cardType(initial, id as InstanceId)))
      dealtTo.set(id, instance.ownerId);
  checkState(initial, dealtTo, "start");
  let session = startSession(initial);
  const turn = { key: "", n: 0 };
  const script = [...(options.script ?? [])];
  const maxCommands = options.maxCommands ?? 2500;
  let commands = 0;
  while (!session.state.outcome && (options.stopAtRound === undefined || session.state.round < options.stopAtRound)) {
    if (commands >= maxCommands)
      throw new Error(`no outcome after ${maxCommands} commands (round ${session.state.round})`);
    const before = session.state;
    const command = nextCommand(session, turn, script);
    const result = sessionApply(session, command, WAVE7_DEPS);
    if (!result.ok)
      throw new Error(`engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    commands++;
    observer.observe(before, session.state, result.events);
    checkState(session.state, dealtTo, `command ${commands} ${command.type}`);
  }
  return { session, commands };
}

/** The log replays to a deep-equal final state (and the replay itself reports no error). */
function expectReplays(result: GameResult): void {
  const replayed = replay(result.session.log, WAVE7_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

/** Setup with the opening hands kept, plus the targeted setup check (Soldier X's search). */
function newGame(scenario: string, players: readonly (typeof CABLE | typeof DOMINO)[], seed: number): GameState {
  const created = createGame(wave7Scenario(scenario, { players, seed, modularSetIds: [] }), WAVE7_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const started = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  noteSoldierX(started);
  return started;
}

/**
 * Cable's Setup (Soldier X, 40001b): "search the deck and discard pile for a player side scheme, put it into play".
 * One player side scheme owned by Cable is in the villain area at the first turn.
 */
function noteSoldierX(s: GameState): void {
  const cable = s.players.find((p) => codeOf(s, p.identity.instanceId).startsWith("40001"));
  if (!cable) return;
  const found = s.villainArea.filter(
    (id) => cardType(s, id) === "player_side_scheme" && s.instances[id]!.ownerId === cable.playerId,
  );
  expect(found).toHaveLength(1);
  expect(cable.deck.some((id) => cardType(s, id) === "player_side_scheme")).toBe(true); // others are still in the deck
  seen.soldierXSearch++;
}

const completedRounds = (r: GameResult) => r.session.state.round - 1;
const outcomeOf = (r: GameResult) => r.session.state.outcome;

describe("Cable precon, Morlock Siege, standard, one player", () => {
  const SEEDS = [1, 2, 3, 5, 8];
  it.each(SEEDS)("seed %i plays to an outcome with every invariant intact", (seed) => {
    const result = play(newGame("morlock-siege", [CABLE], seed), new Observer());
    expect(outcomeOf(result)).not.toBeNull();
    expect(result.commands).toBeGreaterThan(10);
    expectReplays(result);
  });
});

describe("Cable precon, Stryfe, Hope Summers under the first player", () => {
  it.each([9, 11])("seed %i plays four full rounds", (seed) => {
    const start = newGame("stryfe", [CABLE], seed);
    // Appendix II step 11: the setup keyword puts Hope Summers into play under the first player.
    const first = playerOf(start, start.firstPlayerId);
    const hope = first.playArea.filter((id) => codeOf(start, id) === HOPE_SUMMERS);
    expect(hope).toHaveLength(1);
    expect(start.instances[hope[0]!]!.controllerId).toBe(start.firstPlayerId);
    const result = play(start, new Observer(), { stopAtRound: 5 });
    expect(result.session.state.round).toBeGreaterThanOrEqual(5);
    expectReplays(result);
  });
});

describe("Cable and Domino, On the Run, two players", () => {
  it.each([2, 9])("seed %i plays three full rounds", (seed) => {
    const observer = new Observer();
    const start = newGame("on-the-run", [CABLE, DOMINO], seed);
    const result = play(start, observer, { stopAtRound: 4 });
    expect(result.session.state.round).toBeGreaterThanOrEqual(4);
    // The first player token passes to the next seat each round (RRG 1.8 "First Player", p. 20).
    const order = start.players.map((p) => p.playerId);
    for (let round = 2; round <= completedRounds(result) + 1; round++) {
      const previous = observer.firstPlayerByRound.get(round - 1)!;
      expect(observer.firstPlayerByRound.get(round)).toBe(order[(order.indexOf(previous) + 1) % order.length]);
    }
    // (Round 1's first turn began during setup, before the first observed command.)
    for (const [round, players] of observer.turnOrder)
      if (round > 1)
        expect(players[0], `round ${round} starts with the first player`).toBe(observer.firstPlayerByRound.get(round));
    expectReplays(result);
  });
});

describe("Targeted checks seen across the games", () => {
  it("Mind Scan and Telekinetic Blast scale with the side schemes in the victory display (staged)", () => {
    let s = newGame("morlock-siege", [CABLE], 1);
    // Two encounter side schemes in the victory display, Cable in hero form with both events in hand and a scheme with
    // threat to thwart: the staging is state surgery; the plays and their amounts come from the engine.
    const encounter = Object.values(s.encounterDecks)[0]!;
    const sideSchemes = encounter.deck.filter((id) => cardType(s, id) === "side_scheme").slice(0, 2);
    expect(sideSchemes).toHaveLength(2);
    s = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [Object.keys(s.encounterDecks)[0]!]: {
          ...encounter,
          deck: encounter.deck.filter((id) => !sideSchemes.includes(id)),
        },
      },
      victoryDisplay: [...s.victoryDisplay, ...sideSchemes],
    };
    s = patchInstance(s, s.mainScheme.instanceId, { threat: 12 });
    s = withForm(s, { heroForm: 0 }, P1);
    s = moveToHand(s, P1, "40003", "40005").state;
    // Both events are played by script (the greedy driver pays with whatever is first in hand, events included), each
    // paid with ready-to-pitch cards other than the other event.
    const playEvent =
      (code: string) =>
      (state: GameState): Command => {
        const hand = playerOf(state, P1).hand;
        const id = hand.find((h) => codeOf(state, h) === code)!;
        const cost = (state.cardPool[code] as unknown as { cost: number }).cost;
        const payment: { fromHand: InstanceId }[] = [];
        let paid = 0;
        for (const h of hand) {
          if (paid >= cost) break;
          if (h === id || ["40003", "40005"].includes(codeOf(state, h))) continue;
          const pool = printedResources(state.cardPool[codeOf(state, h)]!);
          payment.push({ fromHand: h });
          paid += pool.physical + pool.mental + pool.energy + pool.wild;
        }
        return { type: "playCard", playerId: P1, cardInstanceId: id, payment, attachToInstanceId: null };
      };
    const before = { mindScan: seen.mindScan.length, blast: seen.telekineticBlast.length };
    const result = play(s, new Observer(), { stopAtRound: 2, script: [playEvent("40003"), playEvent("40005")] });
    const mind = seen.mindScan.slice(before.mindScan);
    const blast = seen.telekineticBlast.slice(before.blast);
    const end = result.session.state;
    const note = `hand at the end: ${playerOf(end, P1)
      .hand.map((id) => cardName(end, id))
      .join(", ")}; round ${end.round}`;
    expect(
      mind.map((m) => m.actual),
      note,
    ).toContain(5); // 3 + 2 side schemes
    expect(
      blast.map((b) => b.actual),
      note,
    ).toContain(8); // 6 + 2 side schemes
    for (const m of [...mind, ...blast]) expect(m.actual, m.note).toBe(m.expected);
    expectReplays(result);
  });

  it("every targeted check was seen at least once", () => {
    expect(seen.soldierXSearch).toBeGreaterThan(0);
    expect(seen.cableReadiesAfterScheme).toBeGreaterThan(0);
    expect(seen.cableReadiedWhileExhausted).toBeGreaterThan(0);
    expect(seen.playerSideSchemeToVictoryDisplay).toBeGreaterThan(0);
    expect(seen.mindScan.length).toBeGreaterThan(0);
    expect(seen.telekineticBlast.length).toBeGreaterThan(0);
    for (const m of [...seen.mindScan, ...seen.telekineticBlast]) expect(m.actual, m.note).toBe(m.expected);
    expect(seen.obligationOrNemesis).toBeGreaterThan(0);
  });
});
