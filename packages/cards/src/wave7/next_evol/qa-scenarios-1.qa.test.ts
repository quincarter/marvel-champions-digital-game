import {
  applyCommand,
  cardsInPlay,
  cardsMatch,
  characterProfile,
  createGame,
  maxHitPoints,
  playerSideSchemeLimit,
  replay,
  restrictedStanding,
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
import {
  P1,
  P3,
  endTurn,
  firstLegal,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Wave 7 QA, scenarios slice 1 (docs/phase7-wave7-qa-scenarios-1.md): Morlock Siege, On the Run and Juggernaut, played
 * harder than the precon files did: expert mode, three and four players, the scenarios' recommended modular sets, and
 * every state of every game checked against the invariants below by one command at a time (`sessionApply`), then a
 * deep-equal replay of the log (the engine's determinism contract).
 *
 * Generic invariants (as `x23/precon-e2e.test.ts`): no engine error on a driver-chosen command; no prompt without an
 * answer and no rest between steps with nothing pending (RRG 1.8 Appendix II, pp. 51-52); the player side scheme limit
 * (p. 34); no card in two zones; owners keep their cards (p. 31); no two matching uniques in play (p. 45); the
 * restricted limit (p. 38); the first player token passes to the next seat each round (p. 19); rounds advance by one.
 *
 * Scenario invariants, from the printed cards (MC40 pp. 9, 11, 14; the RRG page is named where one applies):
 * - Morlock Siege: villains under Routed are exactly the defeated ones, at most three, and three end the game as a win
 *   (40077b / 40078b); no minion shares the villain's title once the villain is in play (Routed 40081, owner Q4); the
 *   knock counter is placed once per villain phase and the third advances to 2A, which puts 2 Morlocks into play for one
 *   player and 1 each otherwise (40078a); stage 2 has a Morlock in play or the game is over; an enemy attack on a player
 *   who controls a Morlock lands on a Morlock (40079, owner Q6); a new villain activates against each player in player
 *   order (Routed); a Morlock never counts toward the ally limit (40079).
 * - On the Run: one villain, every other villain and the villain's own title among the minions removed from the game
 *   (40103a Setup), Hope's Captor on the villain until the game ends (40105), a MARAUDER minion engaged with each
 *   player after 1B, the villain schemes instead of attacking a player with a MARAUDER minion engaged (owner Q9), the
 *   first defeat resets and flips Hope's Captor and advances to 2A, only the second defeat wins (40104b).
 * - Juggernaut: Hope Summers in play under the first player, and under the next first player after every pass (owner
 *   2026-10-05, RRG p. 19); the Helmet card is attached to Juggernaut all game (40122, "Permanent", RRG p. 32); ATK is the
 *   printed ATK plus one per momentum counter (40118-40120) and a counter is removed only by the Helmet's Action
 *   (40122a); counters carry over when a stage of the same title is defeated (RRG 1.8 "Villain Defeat", p. 47); the
 *   Unstoppable Juggernaut's interrupt attacks every player in player order (40121b).
 *
 * Findings pinned with `it.fails` at the end (docs/phase7-wave7-qa-scenarios-1.md): a redirect to a Morlock lost when Harpoon's
 * indirect damage is answered by a damage-prevention interrupt (40079 / 40074a, owner Q6), and Hope's Captor's "would
 * attack" interrupt not outranking the villain's own "attacks you" Forced Interrupt (40105a / 40070a, RRG 1.8 "Would", p. 48).
 *
 * Policy of the games, said plainly: the greedy driver loses most seeds of these scenarios to the main scheme or to the
 * Marauders within one to four rounds, so (a) a "thwart first" or "attack first" policy sits in front of the driver where
 * a game says so, and (b) "tilted" games start with the villain on a few hit points, no engaged minion and no tough
 * status card (surgery on the initial state, replayable) so that a defeat comes in round 1 and the game goes on through
 * what follows it. Nothing else is staged in a game.
 *
 * Deviations from the driver, policy only: Hope Summers and the Morlocks are never declared defenders (the villain's
 * main scheme loses the game when no Morlock is in play and Hope's leaving play loses it); a hero defends when Hope is
 * the target; a turn is ended after 40 commands.
 */

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const IRON_MAN = { starterDeckId: "core-iron-man-aggression" } as const;
const BLACK_PANTHER = { starterDeckId: "core-black-panther-protection" } as const;
type Seat = { readonly starterDeckId: string };
const TABLE: readonly Seat[] = [SPIDER_MAN, CAPTAIN_MARVEL, IRON_MAN, BLACK_PANTHER];
const seatsOf = (n: number): Seat[] => TABLE.slice(0, n);

const HOPE = "40130";
const MORLOCK = "40079";
const CAPTOR = "40105a";
const HELMET = "40122a";
const HELMET_ACTION = "40122a.juggernauts-helmet-action";
const UNSTOPPABLE = "40121b.the-unstoppable-juggernaut-forced-interrupt";

type Scenario = "morlock-siege" | "on-the-run" | "juggernaut";
type Mode = "standard" | "expert";

interface GameResult {
  readonly session: GameSession;
  readonly commands: number;
  readonly label: string;
}

const codeOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;
const inst = (s: GameState, id: InstanceId) => s.instances[id]!;
const cardOf = (s: GameState, id: InstanceId) => s.cardPool[codeOf(s, id)]!;
const nameOf = (s: GameState, id: InstanceId) => cardOf(s, id).name;
const typeOf = (s: GameState, id: InstanceId) => cardOf(s, id).type;
const PLAYER_CARD_TYPES: readonly string[] = ["ally", "event", "resource", "support", "upgrade", "player_side_scheme"];
const traitsOfCard = (s: GameState, id: InstanceId): string[] => {
  const c = cardOf(s, id) as unknown as { traits?: readonly string[]; sides?: { stages: { traits: string[] }[] }[] };
  if (c.traits) return [...c.traits];
  const v = s.villains.find((x) => x.instanceId === id);
  return v ? [...(c.sides?.[0]?.stages[v.stageIndex]?.traits ?? [])] : [];
};
const villainsInPlay = (s: GameState) => s.villains.filter((v) => !v.defeated);
const activeVillain = (s: GameState): InstanceId => s.activeVillainId;
const idsByCode = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((id) => codeOf(s, id) === code);
const inPlaySet = (s: GameState): ReadonlySet<InstanceId> => new Set(cardsInPlay(s));
const momentumOf = (s: GameState): number => inst(s, activeVillain(s)).counters["momentum"] ?? 0;
const nonEliminated = (s: GameState): PlayerId[] => s.players.filter((p) => !p.eliminated).map((p) => p.playerId);
/** Seat order starting from the first player, eliminated seats left out (RRG 1.8 "In Player Order", p. 24). */
function playerOrder(s: GameState): PlayerId[] {
  const order = s.players.map((p) => p.playerId);
  const at = order.indexOf(s.firstPlayerId);
  return [...order.slice(at), ...order.slice(0, at)].filter((id) => !playerOf(s, id).eliminated);
}

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

function inPlayOf(s: GameState, playerId: PlayerId): InstanceId[] {
  const player = playerOf(s, playerId);
  const roots = [player.identity.instanceId, ...player.playArea];
  return roots.flatMap((id) => [id, ...(inst(s, id).attachments as readonly InstanceId[])]);
}

interface Setup {
  readonly scenario: Scenario;
  readonly mode: Mode;
  readonly players: number;
  /** Cards each deck started with (so a card that changed hands is traced to its dealt owner). */
  readonly dealtTo: ReadonlyMap<string, PlayerId>;
}

/** Throws a descriptive error on the first broken invariant of `s`. */
function checkState(s: GameState, setup: Setup, where: string): void {
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
    if (labels.length > 1) fail(`${id} (${nameOf(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  const sideSchemes = s.villainArea.filter((id) => typeOf(s, id) === "player_side_scheme");
  if (choice?.prompt.kind !== "discardOverPlayerSideSchemeLimit" && sideSchemes.length > playerSideSchemeLimit(s))
    fail(`${sideSchemes.length} player side schemes in play, limit ${playerSideSchemeLimit(s)}`);
  for (const [id, owner] of setup.dealtTo)
    if (!zones.has(id) && inst(s, id as InstanceId).attachedTo === null)
      fail(`${owner}'s ${nameOf(s, id as InstanceId)} (${id}) is in no zone`);
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) {
        const dealt = setup.dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId)
          fail(`${nameOf(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
      }
  const table = s.players.filter((p) => !p.eliminated).flatMap((p) => inPlayOf(s, p.playerId));
  for (let i = 0; i < table.length; i++)
    for (let j = i + 1; j < table.length; j++)
      if (cardsMatch(cardOf(s, table[i]!), cardOf(s, table[j]!)))
        fail(`unique cards ${nameOf(s, table[i]!)} and ${nameOf(s, table[j]!)} match and are both in play`);
  if (!choice)
    for (const p of s.players) {
      const standing = restrictedStanding(s, WAVE7_DEPS, p.playerId);
      if (standing.held.length > standing.limit)
        fail(`${p.playerId} controls ${standing.held.length} restricted cards, the limit is ${standing.limit}`);
    }
  // The ally limit is three (RRG 1.8 "Ally Limit"); Hope Summers and the Morlocks do not count (40130, 40079).
  if (!choice)
    for (const p of s.players) {
      const counted = p.playArea.filter(
        (id) => typeOf(s, id) === "ally" && codeOf(s, id) !== HOPE && codeOf(s, id) !== MORLOCK,
      );
      if (counted.length > 3)
        fail(`${p.playerId} has ${counted.length} allies in play that count against the ally limit`);
    }
  if (s.outcome) return;
  // Per-player scaling is fixed at setup (RRG 1.8 "Player Elimination"): startingPlayerCount never changes.
  if (s.startingPlayerCount !== setup.players) fail(`startingPlayerCount ${s.startingPlayerCount}`);
  // A pending choice can be a card resolving mid-way, so the scenario's standing conditions are judged between steps.
  if (choice) return;
  const play = inPlaySet(s);
  const active = activeVillain(s);
  const villains = villainsInPlay(s);
  if (villains.length !== 1) fail(`${villains.length} villains in play`);
  if (!play.has(active)) fail("the active villain is not in play");
  for (const id of play)
    if (typeOf(s, id) === "minion" && nameOf(s, id) === nameOf(s, active))
      fail(`minion ${nameOf(s, id)} (${id}) shares the villain's title and is in play (owner Q4, RRG 1.8 p. 46)`);

  if (setup.scenario === "morlock-siege") {
    const routed = [...play].filter((id) => nameOf(s, id) === "Routed");
    if (routed.length !== 1) fail(`${routed.length} Routed environments in play`);
    const under = inst(s, routed[0]!).tucked;
    if (under.length > 2) fail(`${under.length} villains under Routed and the game is not won`);
    if (under.some((id) => typeOf(s, id) !== "villain")) fail("Routed holds a card that is not a villain");
    const stage = s.mainScheme.stageIndex;
    const knock = inst(s, s.mainScheme.instanceId).counters["knock"] ?? 0;
    if (stage === 0 && knock > 2) fail(`${knock} knock counters at stage 1`);
    const morlocks = [...play].filter((id) => codeOf(s, id) === MORLOCK);
    if (stage === 1 && morlocks.length === 0) fail("stage 2 and no Morlock in play, the game is not lost");
    if (stage === 0 && morlocks.length > 0) fail("a Morlock is in play at stage 1");
    for (const id of morlocks) if (inst(s, id).controllerId === null) fail(`Morlock ${id} has no controller`);
  }
  if (setup.scenario === "on-the-run") {
    if (s.villains.length < 1) fail("no villain");
    const captors = idsByCode(s, CAPTOR);
    if (captors.length !== 1) fail(`${captors.length} Hope's Captor cards`);
    if (inst(s, captors[0]!).attachedTo !== active) fail("Hope's Captor is not attached to the villain");
    // 40103a Setup: "Remove the minion with the same title as the villain, along with each other villain, from the game."
    for (const v of s.villains)
      if (v.instanceId !== active && !s.removedFromGame.includes(v.instanceId))
        fail(`villain ${nameOf(s, v.instanceId)} is not removed from the game`);
    for (const [id, instance] of Object.entries(s.instances))
      if (
        typeOf(s, id as InstanceId) === "minion" &&
        nameOf(s, id as InstanceId) === nameOf(s, active) &&
        !s.removedFromGame.includes(id as InstanceId) &&
        instance.ownerId === null
      )
        fail(
          `minion ${nameOf(s, id as InstanceId)} (${id}) shares the villain's title and was not removed from the game`,
        );
  }
  if (setup.scenario === "juggernaut") {
    const hope = idsByCode(s, HOPE);
    if (hope.length !== 1) fail(`${hope.length} Hope Summers cards`);
    const h = hope[0]!;
    if (!play.has(h)) fail("Hope Summers is not in play (the players lose the game when she leaves)");
    const first = playerOf(s, s.firstPlayerId);
    if (!first.playArea.includes(h)) fail(`Hope Summers is not in the first player's (${s.firstPlayerId}) play area`);
    if (inst(s, h).controllerId !== s.firstPlayerId)
      fail(`Hope Summers is controlled by ${inst(s, h).controllerId}, the first player is ${s.firstPlayerId}`);
    const helmets = idsByCode(s, HELMET);
    if (helmets.length !== 1) fail(`${helmets.length} Helmet cards`);
    if (inst(s, helmets[0]!).attachedTo !== active) fail("Juggernaut's Helmet is not attached to Juggernaut");
    const momentum = momentumOf(s);
    if (momentum < 0) fail(`${momentum} momentum counters`);
    const v = s.villains.find((x) => x.instanceId === active)!;
    const card = cardOf(s, active) as unknown as { sides: { stages: { atk: number }[] }[] };
    const printed = card.sides[0]!.stages[v.stageIndex]!.atk;
    const profile = characterProfile(s, active, WAVE7_DEPS) as { atk?: number | null } | undefined;
    if (profile?.atk != null && profile.atk < printed + momentum)
      fail(`Juggernaut's ATK is ${profile.atk}, printed ${printed} + ${momentum} momentum counters`);
  }
}

/** The driver's own answer, except that Hope Summers and a Morlock never defend (and a hero does for Hope). */
function ownAnswer(s: GameState, choice: PendingChoice): readonly string[] | null {
  if (choice.prompt.kind !== "declareDefender") return null;
  const ids = choice.options.map((o) => o.optionId);
  const target = choice.prompt.attack.targetCharacterInstanceId;
  const allies = ids.filter(
    (id) =>
      id !== "decline" &&
      typeOf(s, id as InstanceId) === "ally" &&
      codeOf(s, id as InstanceId) !== HOPE &&
      codeOf(s, id as InstanceId) !== MORLOCK,
  );
  if (allies[0]) return [allies[0]];
  if (codeOf(s, target) === HOPE) {
    const hero = ids.find((id) => id !== "decline" && typeOf(s, id as InstanceId) === "hero_identity");
    if (hero) return [hero];
  }
  return ids.includes("decline") ? ["decline"] : null;
}

/** What a game reached, so the tests can say which rules were exercised (and fail if a scenario was never reached). */
interface Tally {
  routedTucks: number;
  knockAdvances: number;
  stageAdvances: number;
  morlockRedirects: number;
  captorSchemes: number;
  captorFlips: number;
  unstoppable: number;
  momentumPlaced: number;
  helmetActions: number;
  villainReplacements: number;
  tokenPasses: number;
  stage2Reached: boolean;
}
const newTally = (): Tally => ({
  routedTucks: 0,
  knockAdvances: 0,
  stageAdvances: 0,
  morlockRedirects: 0,
  captorSchemes: 0,
  captorFlips: 0,
  unstoppable: 0,
  momentumPlaced: 0,
  helmetActions: 0,
  villainReplacements: 0,
  tokenPasses: 0,
  stage2Reached: false,
});

/** Watches events, one command at a time, for the per-round and per-scenario rules. */
class Observer {
  readonly firstPlayerByRound = new Map<number, PlayerId>();
  private holder: PlayerId = P1;
  private alive = new Set<PlayerId>();
  readonly turnOrder = new Map<number, PlayerId[]>();
  readonly tally = newTally();
  private lastRound = 0;
  private captorFlipped = false;
  private searchOwed = false;
  /** Instances declared as defenders of the attack now resolving (cleared when it resolves). */
  private readonly defenders = new Set<InstanceId>();
  /** 2A has been revealed and its Morlocks are not yet counted (a prompt may be open in between). */
  private morlocksOwed = false;
  private playersAt2A = 0;
  private routedOwed = 0;
  /** Unstoppable Juggernaut's attacks still owed, in player order (40121b step 4). */
  readonly hopeHolders = new Set<PlayerId>();
  constructor(
    readonly label: string,
    private readonly setup: Setup,
  ) {}

  init(initial: GameState): void {
    this.lastRound = initial.round;
    this.firstPlayerByRound.set(initial.round, initial.firstPlayerId);
    this.holder = initial.firstPlayerId;
    this.alive = new Set(nonEliminated(initial));
  }

  observe(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    const here = `${this.label} round ${before.round} ${command.type}`;
    for (const e of events)
      if (e.type === "turnStarted")
        this.turnOrder.set(after.round, [...(this.turnOrder.get(after.round) ?? []), e.playerId]);
    if (after.round !== this.lastRound) {
      expect(after.round - this.lastRound).toBe(1); // the villain phase always completes into exactly the next round
      this.firstPlayerByRound.set(after.round, after.firstPlayerId);
      this.lastRound = after.round;
    }
    // RRG 1.8 "First Player" (p. 19) and "Player Elimination" (p. 34): the token goes to the next clockwise player still in
    // the game, at the end of the round and at once when its holder is eliminated.
    for (const e of events) {
      if (e.type === "playerEliminated") this.alive.delete(e.playerId);
      if (e.type === "firstPlayerChanged") {
        const seats = before.players.map((p) => p.playerId);
        let expected: PlayerId | undefined;
        for (let step = 1; step <= seats.length && expected === undefined; step++) {
          const seat = seats[(seats.indexOf(this.holder) + step) % seats.length]!;
          if (this.alive.has(seat)) expected = seat;
        }
        expect(
          e.playerId,
          `${here}: the first player token goes clockwise from ${this.holder} to a seat still in the game`,
        ).toBe(expected);
        if (e.playerId !== this.holder) this.tally.tokenPasses++;
        this.holder = e.playerId;
      }
    }
    if (this.setup.scenario === "morlock-siege") this.morlockSiege(before, after, events, here);
    if (this.setup.scenario === "on-the-run") this.onTheRun(before, after, events, here);
    if (this.setup.scenario === "juggernaut") this.juggernaut(before, after, events, here);
    this.attacks(before, after, events, here);
  }

  /**
   * An enemy activation's attack, from `enemyActivated` to the first `attackResolved` / `schemeResolved` of that enemy
   * (across commands: prompts pause it). The attacked player is the one the activation began against, not the defender's
   * (RRG 1.8 "Attack (Enemy Activation)" step 2, p. 9: a defending player becomes the target player).
   */
  private activation: {
    enemy: InstanceId;
    player: PlayerId;
    morlocks: InstanceId[];
    marauders: InstanceId[];
    defended: boolean;
    lost: Set<InstanceId>;
  } | null = null;

  /**
   * Whatever the scenario: an enemy attack on a player who controls a Morlock is an attack on a Morlock (40079 Forced
   * Interrupt, owner Q6) unless the player declared a defender; an attack of the villain on a player with a MARAUDER
   * minion engaged never resolves under Hope's Captor (40105, owner Q9).
   */
  private attacks(before: GameState, after: GameState, events: readonly GameEvent[], here: string): void {
    for (const e of events) {
      if (e.type === "characterDefeated") this.activation?.lost.add(e.instanceId);
      if (e.type === "enemyActivated" && e.activation === "attack") {
        const controlled = (s: GameState) =>
          [...inPlaySet(s)].filter((id) => codeOf(s, id) === MORLOCK && inst(s, id).controllerId === e.playerId);
        const engaged = (s: GameState) =>
          [...inPlaySet(s)].filter(
            (id) =>
              typeOf(s, id) === "minion" &&
              inst(s, id).engagedWith === e.playerId &&
              traitsOfCard(s, id).includes("MARAUDER"),
          );
        const villain = e.enemyInstanceId === activeVillain(before);
        this.activation = {
          enemy: e.enemyInstanceId,
          player: e.playerId,
          morlocks: controlled(before).filter((id) => controlled(after).includes(id)),
          marauders: villain ? engaged(before).filter((id) => engaged(after).includes(id)) : [],
          defended: false,
          lost: new Set(),
        };
      }
      if (e.type === "defenderDeclared" && this.activation) this.activation.defended = true;
      if (e.type === "schemeResolved" && this.activation?.enemy === e.enemyInstanceId) this.activation = null;
      if (e.type === "attackResolved") {
        const a = this.activation;
        if (codeOf(after, e.targetInstanceId) === MORLOCK) this.tally.morlockRedirects++;
        if (!a || a.enemy !== e.enemyInstanceId) continue;
        this.activation = null;
        const morlocks = a.morlocks.filter((id) => !a.lost.has(id) && inPlaySet(after).has(id));
        const target = e.targetInstanceId;
        if (!a.defended && morlocks.length > 0 && codeOf(after, target) !== MORLOCK)
          throw new Error(
            `${here}: an attack on ${a.player} hit ${nameOf(after, target)} while ${a.player} controlled a Morlock (40079 Forced Interrupt, owner Q6)`,
          );
        const kept = a.marauders.filter((id) => !a.lost.has(id) && inPlaySet(after).has(id));
        if (this.setup.scenario === "on-the-run" && kept.length > 0)
          throw new Error(
            `${here}: the villain's attack on ${a.player} resolved while ${nameOf(after, kept[0]!)} (MARAUDER) was engaged with them (Hope's Captor 40105, owner Q9)`,
          );
      }
    }
  }

  private morlockSiege(before: GameState, after: GameState, events: readonly GameEvent[], here: string): void {
    const t = this.tally;
    const advanced = events.find((e) => e.type === "mainSchemeAdvanced");
    if (advanced && advanced.type === "mainSchemeAdvanced" && advanced.stageIndex === 1) {
      t.stageAdvances++;
      t.stage2Reached = true;
      this.morlocksOwed = true;
      const idx = events.findIndex((x) => x.type === "mainSchemeAdvanced");
      this.playersAt2A =
        nonEliminated(before).length - events.slice(0, idx).filter((x) => x.type === "playerEliminated").length;
      if (advanced.advancedBy?.cause === "cardEffect") t.knockAdvances++;
    }
    // 2A: 2 set-aside Morlocks into play for one player, 1 each otherwise (4 are set aside), once nothing is pending.
    if (this.morlocksOwed && !after.pendingChoice) {
      this.morlocksOwed = false;
      const left = after.encounterSetAside.filter((id) => codeOf(after, id) === MORLOCK).length;
      expect(left, `${here}: set-aside Morlocks left after 2A`).toBe(
        4 - (this.setup.players === 1 ? 2 : this.playersAt2A),
      );
    }
    // The villain defeated: it goes under Routed, the next one activates against each player in player order.
    events.forEach((e) => {
      if (e.type !== "characterDefeated") return;
      if (before.villains.every((v) => v.instanceId !== e.instanceId)) return;
      t.routedTucks++;
      if (after.outcome) return;
      const next = activeVillain(after);
      if (next === e.instanceId) return;
      t.villainReplacements++;
      // One activation per player still in the game (RRG 1.8 "Villain Defeat" p. 47; Routed 40081), counted below.
      this.routedOwed = playerOrder(before).length;
    });
    for (const e of events) {
      if (
        (e.type === "attackResolved" || e.type === "schemeResolved") &&
        e.enemyInstanceId === activeVillain(after) &&
        this.routedOwed > 0
      )
        this.routedOwed--;
      if (e.type === "playerEliminated" && this.routedOwed > 0) this.routedOwed--;
    }
    // (An activation made against an alter-ego player is logged by `schemeResolved` alone.)
    if (!after.outcome && !after.pendingChoice && after.step.phase === "player" && this.routedOwed > 0)
      throw new Error(
        `${here}: the new villain made ${this.routedOwed} fewer activations than there are players (Routed 40081)`,
      );
    if (after.outcome?.result === "win") {
      const routed = [...inPlaySet(after)].filter((id) => nameOf(after, id) === "Routed");
      expect(routed.length).toBe(1);
      expect(
        inst(after, routed[0]!).tucked.length,
        `${here}: the win is three villains under Routed`,
      ).toBeGreaterThanOrEqual(3);
    }
  }

  private onTheRun(before: GameState, after: GameState, events: readonly GameEvent[], here: string): void {
    const t = this.tally;
    const villain = activeVillain(before);
    for (const e of events)
      if (e.type === "schemeResolved" && e.enemyInstanceId === villain) {
        const player = events.find(
          (x) => x.type === "enemyActivated" && x.enemyInstanceId === villain && x.activation === "attack",
        );
        if (player) t.captorSchemes++;
      }
    const flipped = idsByCode(after, CAPTOR).some((id) => inst(after, id).flipped);
    if (flipped && !this.captorFlipped) {
      this.captorFlipped = true;
      t.captorFlips++;
      t.stage2Reached = true;
      expect(after.mainScheme.stageIndex, `${here}: the flip advances to 2A (40105b)`).toBe(1);
      expect(villainsInPlay(after), `${here}: the villain is not defeated by the reset`).toHaveLength(1);
      this.searchOwed = true;
    }
    // 2A (40104a): each player searched for a MARAUDER minion engaged with them, and each MARAUDER enemy holds a tough
    // status card, once the reveal has nothing pending.
    if (this.searchOwed && !after.pendingChoice) {
      this.searchOwed = false;
      for (const p of nonEliminated(after)) {
        const minions = [...inPlaySet(after)].filter(
          (id) =>
            typeOf(after, id) === "minion" &&
            inst(after, id).engagedWith === p &&
            traitsOfCard(after, id).includes("MARAUDER"),
        );
        expect(minions.length, `${here}: ${p} has a MARAUDER minion engaged after 2A`).toBeGreaterThanOrEqual(1);
      }
      for (const id of inPlaySet(after))
        if (["minion", "villain"].includes(typeOf(after, id)) && traitsOfCard(after, id).includes("MARAUDER"))
          expect(
            inst(after, id).statuses.tough,
            `${here}: ${nameOf(after, id)} holds a tough status card after 2A`,
          ).toBeGreaterThanOrEqual(1);
    }
    if (after.outcome?.result === "win")
      expect(this.captorFlipped || flipped, `${here}: a win before Hope's Captor flipped`).toBe(true);
  }

  private juggernaut(before: GameState, after: GameState, events: readonly GameEvent[], here: string): void {
    const t = this.tally;
    const hope = idsByCode(after, HOPE)[0];
    const holder = hope ? inst(after, hope).controllerId : null;
    if (holder) this.hopeHolders.add(holder);
    const b = momentumOf(before);
    const a = momentumOf(after);
    const helmetAction = events.some((e) => e.type === "abilityResolved" && String(e.abilityId) === HELMET_ACTION);
    if (helmetAction) t.helmetActions++;
    if (a < b && !helmetAction && activeVillain(before) === activeVillain(after))
      throw new Error(`${here}: momentum fell from ${b} to ${a} without the Helmet's Action (40122a)`);
    if (a > b) t.momentumPlaced += a - b;
    for (const e of events) {
      if (e.type === "villainStageAdvanced") {
        t.stageAdvances++;
        t.stage2Reached = true;
      }
      if (e.type === "abilityResolved" && String(e.abilityId) === UNSTOPPABLE) {
        t.unstoppable++;
      }
    }
    // Counters carry over to a stage with the same title (RRG 1.8 "Villain Defeat", p. 47): the stage change itself
    // only ever adds (40119 / 40120 "Place 1 momentum counter").
    if (events.some((e) => e.type === "villainStageAdvanced") && !helmetAction)
      expect(a, `${here}: counters carry to the next Juggernaut stage`).toBeGreaterThanOrEqual(b);
  }
}

function nextCommand(
  session: GameSession,
  turn: { key: string; n: number },
  script: ((s: GameState) => Command)[],
): Command {
  const s = session.state;
  const choice = s.pendingChoice;
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
  if (!choice && s.step.phase === "player" && s.step.kind === "turn" && POLICY.thwartFirst) {
    // Policy: a ready hero or ally thwarts the main scheme first (the greedy driver loses to the scheme in a round or two).
    const player = playerOf(s, s.step.activePlayerId);
    const characters = [
      player.identity.instanceId,
      ...player.playArea.filter((id) => typeOf(s, id) === "ally" && codeOf(s, id) !== HOPE),
    ];
    if (inst(s, s.mainScheme.instanceId).threat > 0)
      for (const id of characters) {
        const thwart: Command = {
          type: "basicThwart",
          playerId: player.playerId,
          thwarterInstanceId: id,
          schemeInstanceId: s.mainScheme.instanceId,
        };
        if (applyCommand(s, thwart, WAVE7_DEPS).ok) return thwart;
      }
  }
  if (!choice && s.step.phase === "player" && s.step.kind === "turn" && POLICY.attackFirst) {
    // Policy: a ready hero or ally attacks the villain first (to defeat villains under Routed within the round cap).
    const player = playerOf(s, s.step.activePlayerId);
    const characters = [
      player.identity.instanceId,
      ...player.playArea.filter((id) => typeOf(s, id) === "ally" && codeOf(s, id) !== HOPE),
    ];
    for (const id of characters) {
      const attack: Command = {
        type: "basicAttack",
        playerId: player.playerId,
        attackerInstanceId: id,
        targetInstanceId: activeVillain(s),
      };
      if (applyCommand(s, attack, WAVE7_DEPS).ok) return attack;
    }
  }
  const [command] = playToOutcome(s, WAVE7_DEPS, { maxCommands: 1 }).session.log.commands;
  if (!command) throw new Error("the driver issued no command");
  return command;
}

const POLICY = { thwartFirst: false, attackFirst: false };
interface PlayOptions {
  readonly stopAtRound?: number;
  readonly maxCommands?: number;
  readonly script?: readonly ((s: GameState) => Command)[];
}

/** Plays `initial` to an outcome (or `stopAtRound`), checking every invariant after every command. */
function play(
  initial: GameState,
  setup: Omit<Setup, "dealtTo">,
  observer: Observer,
  options: PlayOptions = {},
): GameResult {
  const dealtTo = new Map<string, PlayerId>();
  for (const p of initial.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) if (inst(initial, id).ownerId === p.playerId) dealtTo.set(id, p.playerId);
  for (const [id, instance] of Object.entries(initial.instances))
    if (instance.ownerId !== null && PLAYER_CARD_TYPES.includes(typeOf(initial, id as InstanceId)))
      dealtTo.set(id, instance.ownerId);
  const full: Setup = { ...setup, dealtTo };
  checkState(initial, full, "start");
  observer.init(initial);
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
    observer.observe(before, session.state, result.events, command);
    checkState(session.state, full, `${observer.label} command ${commands} ${JSON.stringify(command)}`);
  }
  return { session, commands, label: observer.label };
}

function expectReplays(result: GameResult): void {
  const replayed = replay(result.session.log, WAVE7_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

function newGame(
  scenario: Scenario,
  mode: Mode,
  seats: readonly Seat[],
  seed: number,
  firstPlayerIndex?: number,
): GameState {
  const created = createGame(
    wave7Scenario(scenario, {
      players: seats,
      seed,
      difficulty: mode,
      ...(firstPlayerIndex === undefined ? {} : { firstPlayerIndex }),
    }),
    WAVE7_DEPS,
  );
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}

/** Surgery: every engaged minion goes to the encounter discard pile (so nothing guards the villain). */
function withoutMinions(s: GameState): GameState {
  const gone = s.players.flatMap((p) => p.playArea.filter((id) => typeOf(s, id) === "minion"));
  if (gone.length === 0) return s;
  const deckId = Object.keys(s.encounterDecks)[0]!;
  const pile = s.encounterDecks[deckId]!;
  return {
    ...s,
    encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, ...gone] } },
    players: s.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => !gone.includes(id)) })),
    instances: {
      ...s.instances,
      ...Object.fromEntries(gone.map((id) => [id, { ...s.instances[id]!, engagedWith: null }])),
    },
  };
}

const completedRounds = (r: GameResult) => r.session.state.round - 1;

/** Each round starts with the first player, and the token passed at least `minPasses` times (checked as it moved). */
function expectTokenPasses(observer: Observer, minPasses: number): void {
  expect(observer.tally.tokenPasses, "the first player token passed").toBeGreaterThanOrEqual(minPasses);
  for (const [round, players] of observer.turnOrder) {
    const first = observer.firstPlayerByRound.get(round);
    if (round > 1 && first !== undefined) expect(players[0], `round ${round} starts with the first player`).toBe(first);
  }
}

export interface Game {
  readonly scenario: Scenario;
  readonly mode: Mode;
  readonly players: number;
  readonly seed: number;
  readonly thwartFirst?: boolean;
  readonly attackFirst?: boolean;
  /** Surgery on the starting villain: this many hit points remain (so a defeat comes in round 1). */
  readonly tilt?: number;
  readonly firstPlayerIndex?: number;
}

function playGame(g: Game, options: PlayOptions = {}) {
  const label = `${g.scenario}/${g.mode}/${g.players}p#${g.seed}`;
  POLICY.thwartFirst = g.thwartFirst ?? false;
  POLICY.attackFirst = g.attackFirst ?? false;
  let start = newGame(g.scenario, g.mode, seatsOf(g.players), g.seed, g.firstPlayerIndex);
  if (g.tilt !== undefined) {
    const v = activeVillain(start);
    const tilted = withoutMinions(start);
    start = patchInstance(tilted, v, {
      damage: (maxHitPoints(tilted, v, WAVE7_DEPS) ?? 0) - g.tilt,
      statuses: { ...inst(tilted, v).statuses, tough: 0 },
    });
  }
  const setup = {
    scenario: g.scenario,
    mode: g.mode,
    players: g.players,
  };
  const observer = new Observer(label, { ...setup, dealtTo: new Map() });
  const result = play(start, setup, observer, options);
  return { start, observer, result };
}

// ---------------------------------------------------------------------------------------------------------------
// Whole games. Seeds were picked by a scan (deleted): each lasts several rounds without a driver loss in round 1, and
// none reaches the two defects pinned below by chance (the invariants would name them). The greedy driver loses most
// seeds of these scenarios to the main scheme or to the Marauders within one to four rounds; "tilted" games start with
// the villain on a few hit points, no engaged minion and no tough status (surgery on the initial state, replayable), so
// that a defeat comes in round 1 and the game goes on through what follows it: Routed (Morlock Siege), Hope's Captor
// and stage 2 (On the Run), the stage change of Juggernaut with its momentum counters (Juggernaut).
// ---------------------------------------------------------------------------------------------------------------

interface Plan extends Game {
  readonly rounds: number;
  /** The least number of rounds completed (the game ends earlier only by an outcome). */
  readonly minRounds: number;
  readonly note: string;
}

function runPlan(plan: Plan) {
  const { start, observer, result } = playGame(plan, { stopAtRound: plan.rounds + 1, maxCommands: 1500 });
  const s = result.session.state;
  expect(completedRounds(result) >= plan.minRounds || s.outcome !== null, `${observer.label}: ${plan.note}`).toBe(true);
  expect(completedRounds(result)).toBeGreaterThanOrEqual(plan.minRounds);
  if (plan.players > 1 && completedRounds(result) >= 2) expectTokenPasses(observer, 1);
  expectReplays(result);
  return { start, observer, result };
}

describe("Morlock Siege: whole games under every invariant", () => {
  it("expert, 1 player (B faces, Routed with retaliate): Knock, Knock to Mutant Massacre, Morlock redirects, a villain under Routed", () => {
    const { observer, result } = runPlan({
      scenario: "morlock-siege",
      mode: "expert",
      players: 1,
      seed: 7,
      attackFirst: true,
      rounds: 6,
      minRounds: 4,
      note: "plays several rounds",
    });
    expect(observer.tally.stage2Reached, "2A was revealed (a Morlock pair in play)").toBe(true);
    expect(observer.tally.routedTucks, "a villain went under Routed").toBeGreaterThanOrEqual(1);
    expect(observer.tally.villainReplacements).toBeGreaterThanOrEqual(1);
    expect(observer.tally.morlockRedirects, "an attack was redirected to a Morlock").toBeGreaterThanOrEqual(1);
    expect(result.session.state.outcome?.result).toBe("loss");
  });

  it("standard, 3 players, villain on 3 hit points: Routed, the new villain activates against all three, Morlocks from 2A", () => {
    const { observer } = runPlan({
      scenario: "morlock-siege",
      mode: "standard",
      players: 3,
      seed: 3,
      attackFirst: true,
      tilt: 2,
      rounds: 6,
      minRounds: 3,
      note: "plays several rounds",
    });
    expect(observer.tally.routedTucks).toBeGreaterThanOrEqual(1);
    expect(observer.tally.stage2Reached).toBe(true);
    expect(observer.tally.knockAdvances, "2A was reached by knock counters (40077b)").toBeGreaterThanOrEqual(1);
  });
});

describe("On the Run: whole games under every invariant", () => {
  it("standard, 3 players, the greedy driver (a MARAUDER minion engaged with each player from 1B)", () => {
    runPlan({
      scenario: "on-the-run",
      mode: "standard",
      players: 3,
      seed: 4,
      thwartFirst: true,
      rounds: 6,
      minRounds: 1,
      note: "loses to Gotta Get Away or plays on",
    });
  });

  it("expert, 4 players, the greedy driver (per-player scaling at four: 8 threat each, 32)", () => {
    const { start } = runPlan({
      scenario: "on-the-run",
      mode: "expert",
      players: 4,
      seed: 11,
      thwartFirst: true,
      rounds: 6,
      minRounds: 1,
      note: "loses to Gotta Get Away or plays on",
    });
    // 40103a: 1[per_hero] starting threat, 8[per_hero] to complete; four players, and one MARAUDER minion each from 1B.
    const stage = (
      start.cardPool[start.instances[start.mainScheme.instanceId]!.cardId as string] as unknown as {
        stages: { targetThreat: { perPlayer: number } }[];
      }
    ).stages[0]!;
    expect(stage.targetThreat.perPlayer * start.startingPlayerCount).toBe(32);
    for (const p of start.players)
      expect(
        p.playArea.filter((id) => typeOf(start, id) === "minion" && traitsOfCard(start, id).includes("MARAUDER")),
        `${p.playerId} has one MARAUDER minion from 1B`,
      ).toHaveLength(1);
  });

  it("expert, 2 players, villain on 3 hit points: Hope's Captor flips, 2A searches a minion for each player, tough everywhere", () => {
    const { observer, result } = runPlan({
      scenario: "on-the-run",
      mode: "expert",
      players: 2,
      seed: 2,
      attackFirst: true,
      thwartFirst: true,
      tilt: 2,
      rounds: 5,
      minRounds: 1,
      note: "reaches stage 2",
    });
    expect(observer.tally.captorFlips, "the first defeat reset the villain and flipped Hope's Captor").toBe(1);
    expect(observer.tally.stage2Reached).toBe(true);
    // The villain is still the same card (not defeated, the dial reset to the printed value, +6 per hero on the flip).
    expect(villainsInPlay(result.session.state)).toHaveLength(1);
  });
});

describe("Juggernaut: whole games under every invariant", () => {
  it("expert, 1 player (starts on Juggernaut II): Helmet, momentum, Hope Summers, the Unstoppable Juggernaut", () => {
    runPlan({
      scenario: "juggernaut",
      mode: "expert",
      players: 1,
      seed: 11,
      thwartFirst: true,
      rounds: 6,
      minRounds: 3,
      note: "plays several rounds",
    });
  });

  it("standard, 4 players: Hope Summers follows the first player token through four seats", () => {
    const { observer } = runPlan({
      scenario: "juggernaut",
      mode: "standard",
      players: 4,
      seed: 8,
      thwartFirst: true,
      rounds: 6,
      minRounds: 3,
      note: "plays several rounds",
    });
    expect(observer.hopeHolders.size, "Hope Summers was controlled by several players").toBeGreaterThanOrEqual(3);
  });

  it("expert, 3 players, the third seat is the first player: the token wraps P3 -> P1 and Hope Summers goes with it", () => {
    const { start, observer } = runPlan({
      scenario: "juggernaut",
      mode: "expert",
      players: 3,
      seed: 2,
      thwartFirst: true,
      firstPlayerIndex: 2,
      rounds: 6,
      minRounds: 3,
      note: "plays several rounds",
    });
    expect(start.firstPlayerId).toBe(P3);
    expect(observer.hopeHolders.has(P3) && observer.hopeHolders.has(P1)).toBe(true);
  });

  it("expert, 1 player, Juggernaut II on 3 hit points: the defeat brings Juggernaut III, momentum counters and the Helmet carry over", () => {
    const { observer, result } = runPlan({
      scenario: "juggernaut",
      mode: "expert",
      players: 1,
      seed: 4,
      attackFirst: true,
      thwartFirst: true,
      tilt: 2,
      rounds: 4,
      minRounds: 0,
      note: "reaches Juggernaut III",
    });
    expect(observer.tally.stageAdvances, "Juggernaut II was defeated and III revealed").toBeGreaterThanOrEqual(1);
    const s = result.session.state;
    expect(s.villains[0]!.stageIndex, "the villain is on its last stage (expert: II then III)").toBeGreaterThanOrEqual(
      1,
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Staged states: the same engine and real commands, a state set up by surgery (said in each test). Each pins a defect
// with `it.fails` (expected behavior from the cited rule; delete the wrapper when the owner fixes it).
// ---------------------------------------------------------------------------------------------------------------

/** Standard-set boost cards that print no boost icon and no Boost ability, and a quiet reveal (Back in Action 40088). */
const BLANK = "01186";

/** The scenario, 1 player, past setup, on the first seed that starts with the villain whose printed number starts `villain`. */
function startingWith(
  scenario: Scenario,
  villain: string,
  modular?: readonly string[],
  seat: Seat = SPIDER_MAN,
): GameState {
  for (let seed = 1; seed < 400; seed++) {
    const created = createGame(
      wave7Scenario(scenario, {
        players: [seat],
        seed,
        difficulty: "standard",
        modularSetIds: modular ?? [],
      }),
      WAVE7_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const id = created.state.instances[created.state.activeVillainId]!.cardId as string;
    if (!id.startsWith(villain)) continue;
    return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  }
  throw new Error(`no seed starts ${scenario} with ${villain}`);
}

interface StagedPlan {
  /** The label (start) of the option to take at a `chooseOption` prompt. */
  readonly option?: string;
  /** Instance-id prefix of the forced abilities to order first at an `orderTriggers` prompt (order is the first player's). */
  readonly first?: string;
  /** Take every optional ability offered at a `chooseTriggers` prompt (the driver's own policy). */
  readonly accept?: boolean;
}
function stagedRun(state: GameState, plan: StagedPlan, ...commands: Parameters<typeof driveEventsPicking>[3][]) {
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    switch (choice.prompt.kind) {
      case "orderTriggers": {
        const ids = choice.options.map((o) => o.optionId);
        return [
          ...ids.filter((id) => plan.first && id.includes(plan.first)),
          ...ids.filter((id) => !(plan.first && id.includes(plan.first))),
        ];
      }
      case "chooseOption": {
        const hit = choice.options.find((o) => (plan.option ? o.label.startsWith(plan.option) : true));
        return [(hit ?? choice.options[0]!).optionId];
      }
      case "declareDefender":
        return ["decline"];
      case "chooseTriggers":
        return plan.accept ? choice.options.map((o) => o.optionId) : [];
      default:
        return firstLegal(s);
    }
  };
  return driveEventsPicking(WAVE7_DEPS, state, pick, ...commands);
}

/** Surgery: a copy of the player's card `code` (hand, deck or discard pile) attached to `host`, faceup. */
function attachFromDeck(s: GameState, player: PlayerId, code: string, host: InstanceId): GameState {
  const owner = playerOf(s, player);
  const id = [...owner.hand, ...owner.deck, ...owner.discard].find((i) => codeOf(s, i) === code);
  if (!id) throw new Error(`no ${code} in ${player}'s cards`);
  return {
    ...s,
    players: s.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            hand: p.hand.filter((x) => x !== id),
            deck: p.deck.filter((x) => x !== id),
            discard: p.discard.filter((x) => x !== id),
          }
        : p,
    ),
    instances: {
      ...s.instances,
      [id]: { ...s.instances[id]!, faceup: true, attachedTo: host },
      [host]: { ...s.instances[host]!, attachments: [...s.instances[host]!.attachments, id] },
    },
  };
}

describe("Staged: Morlock's redirect (40079) against Harpoon's Forced Interrupt (40074a), Morlock Siege 2A", () => {
  // Surgery: Captain Marvel (Core) in hero form with Cosmic Flight (01017) attached; Knock, Knock holds 2 knock counters and
  // no threat, so the villain phase advances to Mutant Massacre 2A, which puts two Morlocks into play under P1 before Harpoon
  // (the villain, SCH 0) attacks. The first player orders the forced interrupts; every optional ability offered is taken.
  const run = (option: string, first: string) => {
    const seeded = startingWith("morlock-siege", "40074", [], CAPTAIN_MARVEL);
    const base = attachFromDeck(seeded, P1, "01017", playerOf(seeded, P1).identity.instanceId);
    const armed = patchInstance(base, base.mainScheme.instanceId, { counters: { knock: 2 }, threat: 0 });
    return stagedRun(
      stackEncounterDeck(armed, BLANK, "40088"),
      { option, first, accept: true },
      toHero(P1),
      endTurn(P1),
    );
  };
  const attackOf = (events: readonly GameEvent[]) => events.find((e) => e.type === "attackResolved");
  const landedOn = (state: GameState, events: readonly GameEvent[]) => {
    const attack = attackOf(events);
    return attack?.type === "attackResolved" ? codeOf(state, attack.targetInstanceId) : null;
  };

  it("control: Harpoon's other option (a second boost card) leaves the attack on the Morlock the interrupt chose", () => {
    const { state, events } = run("Give Harpoon 1 additional", "40079");
    expect(landedOn(state, events)).toBe(MORLOCK);
  });

  // 40079 Forced Interrupt: "When an enemy attacks you, it attacks a Morlock you control instead." (owner Q6 = A, RRG 1.8 p. 10).
  // Harpoon's "Take 2 indirect damage" is answered by Cosmic Flight (an interrupt that prevents the damage); the attack then
  // resolves against the hero, not the Morlock, whichever of the two forced interrupts the first player ordered first.
  it.fails.each([
    ["Morlock ordered before Harpoon", "40079"],
    ["Harpoon ordered before Morlock", "40074a"],
  ])(
    "Harpoon's 'Take 2 indirect damage' answered by Cosmic Flight: the attack still lands on a Morlock (%s)",
    (_n, first) => {
      const { state, events } = run("Take 2 indirect damage", first);
      expect(landedOn(state, events)).toBe(MORLOCK);
    },
  );
});

describe("Staged: Hope's Captor (40105a) against the villain's own Forced Interrupt, On the Run", () => {
  // Surgery: none beyond hero form. 1 player; Arclight is the villain (A face: confuse a character or +2 ATK), a MARAUDER
  // minion is engaged from 1B, so Hope's Captor replaces the villain's attack with a scheme. The first player orders the
  // forced interrupts to the same attack. RRG 1.8 "Would" (p. 48): "would" gives an interrupt higher timing priority than
  // interrupts to the same triggering condition without it, and once an interrupt replaces what is about to occur "no
  // further interrupts to the original trigger may be used" ("Interrupt", p. 25).
  const run = (first: string) =>
    stagedRun(
      stackEncounterDeck(startingWith("on-the-run", "40070"), BLANK, "40109"),
      { first },
      toHero(P1),
      endTurn(P1),
    );
  const arclightResolved = (events: readonly GameEvent[]) =>
    events.filter((e) => e.type === "abilityResolved" && String(e.abilityId) === "40070a.arclight-forced-interrupt");

  it("control: ordered first, Hope's Captor makes the villain scheme and Arclight's interrupt is never used", () => {
    const { state, events } = run("40105a");
    expect(events.some((e) => e.type === "schemeResolved" && e.enemyInstanceId === state.activeVillainId)).toBe(true);
    expect(events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === state.activeVillainId)).toBe(false);
    expect(arclightResolved(events)).toHaveLength(0);
  });

  it.fails("ordered last by the first player, Arclight's interrupt still cannot resolve (the attack is replaced first)", () => {
    const { state, events } = run("40070a");
    expect(events.some((e) => e.type === "schemeResolved" && e.enemyInstanceId === state.activeVillainId)).toBe(true);
    expect(
      arclightResolved(events),
      "Arclight's 'confuse / +2 ATK' choice resolved for an attack that never happened",
    ).toHaveLength(0);
  });
});
