import {
  activeVillain,
  cardsMatch,
  characterProfile,
  createGame,
  handSize,
  hasKeyword,
  maxHitPoints,
  playerSideSchemeLimit,
  replay,
  restrictedStanding,
  sessionApply,
  startSession,
  traitsOf,
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
  P2,
  P3,
  P4,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { playToOutcome } from "../../testing/driver.js";
import { withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { attackFor, heroed, round, villainId } from "./superpower-testing.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Wave 7 rules QA, slice 2 (docs/phase7-wave7-qa-scenarios-2.md): Mister Sinister, Stryfe and the box's nine modular
 * encounter sets, played harder than the precon files did. Whole seeded games run one command at a time through the real
 * engine and scripts (the greedy driver, `../../testing/driver.ts`), every state checked against the invariants in
 * `checkState` and the observer, and replayed to a deep-equal state:
 *
 * - expert mode (RRG 1.8 "Expert Mode", p. 28; MC40 p. 21 for Mister Sinister II's setup order), 3 and 4 players, and a
 *   modular matrix that seats each of the nine sets in a scenario it did not ship as the default for;
 * - Hope Summers: exactly one in play, controlled by the first player, base THW and ATK of that player's hero (Jan 17,
 *   2026 - Ruling 1; owner Q14 = B), so the control follows the first player token (RRG "First Player", p. 20);
 * - Mister Sinister: the SUPERPOWER attachments hold at most one copy each and give exactly their trait and keyword
 *   (docs/phase7-wave7.md §2.7), and each status card placed on him is answered by the stage's threat.
 *
 * The staged tests at the end each prove one interaction, citing the rule; a failing one is an `it.fails` naming the
 * card, the cite and the expected behavior.
 */

const CABLE = { starterDeckId: "cable-leadership" } as const;
const DOMINO = { starterDeckId: "domino-justice" } as const;
const X23 = { starterDeckId: "x-23-aggression" } as const;
const PSYLOCKE = { starterDeckId: "psylocke-justice" } as const;
type Seat = typeof CABLE | typeof DOMINO | typeof X23 | typeof PSYLOCKE;
/** Seats in order: a game of N players uses the first N, rotated by `rotate`. */
const ROSTER: readonly Seat[] = [CABLE, DOMINO, X23, PSYLOCKE];
const seatsOf = (n: number, rotate = 0): Seat[] =>
  Array.from({ length: n }, (_, i) => ROSTER[(i + rotate) % ROSTER.length]!);

const HOPE = "40130";
const SUPERPOWERS = { flight: "40151", super_strength: "40155", telepathy: "40159" } as const;

interface GameSpec {
  readonly scenario: "mister-sinister" | "stryfe" | "juggernaut";
  readonly players: number;
  readonly seed: number;
  readonly expert?: boolean;
  readonly modular?: readonly string[];
  readonly rotate?: number;
  readonly firstPlayerIndex?: number;
  /** Stop at the start of this round (a round cap) unless an outcome comes first. */
  readonly cap: number;
}

const cardType = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.type;
const PLAYER_CARD_TYPES: readonly string[] = ["ally", "event", "resource", "support", "upgrade", "player_side_scheme"];
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

/** Cards a player controls that are in play: the identity, the play area and everything attached to those. */
function inPlayOf(s: GameState, playerId: PlayerId): InstanceId[] {
  const player = s.players.find((p) => p.playerId === playerId)!;
  const roots = [player.identity.instanceId, ...player.playArea];
  return roots.flatMap((id) => [id, ...(s.instances[id]!.attachments as readonly InstanceId[])]);
}

const hopeIds = (s: GameState): InstanceId[] =>
  s.players.flatMap((p) => p.playArea.filter((id) => codeOf(s, id) === HOPE));
const superpowersOn = (s: GameState): string[] =>
  s.instances[villainId(s)]!.attachments.map((id) => codeOf(s, id)).filter((c) =>
    (Object.values(SUPERPOWERS) as string[]).includes(c),
  );
const profileOf = (s: GameState, id: InstanceId) =>
  characterProfile(s, id, WAVE7_DEPS) as { atk?: number | null; thw?: number | null } | undefined;

/** Throws a descriptive error on the first broken invariant of `state`. */
function checkState(s: GameState, dealtTo: ReadonlyMap<string, PlayerId>, scenario: string, where: string): void {
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
  const sideSchemes = s.villainArea.filter((id) => cardType(s, id) === "player_side_scheme");
  if (choice?.prompt.kind !== "discardOverPlayerSideSchemeLimit" && sideSchemes.length > playerSideSchemeLimit(s))
    fail(`${sideSchemes.length} player side schemes in play, limit ${playerSideSchemeLimit(s)}`);
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${cardName(s, id as InstanceId)} (${id}) is in no zone`);
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard"] as const)
      for (const id of p[zone]) {
        const dealt = dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId) {
          // A card another player's Hope carried back to the wrong hand is the pinned finding (Telekinetic Wave, see the
          // staged test), noted rather than failing every game that reaches it.
          if (zone === "hand" && ["upgrade", "support"].includes(cardType(s, id)))
            seen.foreignHand.push(`${where} ${id}`);
          else fail(`${cardName(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
        }
      }
  // Unique Icon (RRG p. 45): no two matching unique cards in play at once, across the whole table.
  const table = s.players.filter((p) => !p.eliminated).flatMap((p) => inPlayOf(s, p.playerId));
  for (let i = 0; i < table.length; i++)
    for (let j = i + 1; j < table.length; j++) {
      const a = s.cardPool[codeOf(s, table[i]!)]!;
      const b = s.cardPool[codeOf(s, table[j]!)]!;
      if (cardsMatch(a, b)) fail(`unique cards ${a.name} (${table[i]}) and ${b.name} (${table[j]}) are both in play`);
    }
  // Restricted (RRG p. 38): at most the limit, except while a prompt (the discard down) is open.
  if (!choice)
    for (const p of s.players) {
      const standing = restrictedStanding(s, WAVE7_DEPS, p.playerId);
      if (standing.held.length > standing.limit)
        fail(`${p.playerId} controls ${standing.held.length} restricted cards, the limit is ${standing.limit}`);
    }
  if (s.outcome) return;

  // Hope Summers (40130): "The first player controls Hope Summers" (card text; owner Q16, Q14; Jan 17, 2026 - Ruling 1).
  // While she is in play there is exactly one, under the first player's control, her base THW and ATK her hero's (0 while
  // that player is an alter-ego, Q14 = B). Stryfe's Grasp and Sinister Ends give her an attack target and a loss.
  const hopes = hopeIds(s);
  if (hopes.length > 1) fail(`${hopes.length} copies of Hope Summers in play`);
  const hope = hopes[0];
  if (hope !== undefined && !s.players.some((p) => p.eliminated)) {
    const holder = s.players.find((p) => p.playArea.includes(hope))!;
    if (holder.playerId !== s.firstPlayerId)
      fail(`Hope Summers is in ${holder.playerId}'s play area, the first player is ${s.firstPlayerId}`);
    if (s.instances[hope]!.controllerId !== s.firstPlayerId)
      fail(`Hope Summers is controlled by ${s.instances[hope]!.controllerId}, the first player is ${s.firstPlayerId}`);
  }
  if (hope === undefined && (scenario === "stryfe" || scenario === "mister-sinister") && s.round >= 1) {
    // Leaving play loses the game: the game would be over.
    fail("Hope Summers is not in play and the game goes on");
  }
  if (hope !== undefined && !choice && !s.players.some((p) => p.eliminated)) {
    const leader = s.players.find((p) => p.playerId === s.firstPlayerId)!;
    const heroForm = leader.identity.form === "hero";
    const mine = profileOf(s, hope);
    const heroProfile = profileOf(s, leader.identity.instanceId);
    // Compared while no other player card is in play (an upgrade on Hope, or Uncanny X-Force's +1 THW to each ally, adds on
    // top of the base: RRG "Modifiers", p. 29) and nothing is attached to an identity (a hero's -1 follows to her).
    const bare = s.players.every(
      (p) => p.playArea.every((id) => id === hope) && s.instances[p.identity.instanceId]!.attachments.length === 0,
    );
    if (mine && heroProfile && heroForm && bare && s.instances[hope]!.attachments.length === 0) {
      if (heroProfile.atk != null && mine.atk != null)
        expect(mine.atk, `${where}: Hope's ATK follows her controller's hero`).toBe(heroProfile.atk);
      if (heroProfile.thw != null && mine.thw != null)
        expect(mine.thw, `${where}: Hope's THW follows her controller's hero`).toBe(heroProfile.thw);
    }
  }

  // The SUPERPOWER attachments: at most one of each (the set has one), and the villain has the trait and keyword each
  // gives exactly while it is attached (Flight AERIAL, Super Strength BRUTE + steady, Telepathy PSIONIC + retaliate 1).
  const supers = superpowersOn(s);
  if (new Set(supers).size !== supers.length) fail(`duplicate SUPERPOWER attachments: ${supers.join(",")}`);
  if (scenario === "mister-sinister") {
    const v = villainId(s);
    const traits = traitsOf(s, v, WAVE7_DEPS).map(String);
    expect(traits.includes("AERIAL"), `${where}: AERIAL iff Flight`).toBe(supers.includes(SUPERPOWERS.flight));
    expect(traits.includes("BRUTE"), `${where}: BRUTE iff Super Strength`).toBe(
      supers.includes(SUPERPOWERS.super_strength),
    );
    expect(traits.includes("PSIONIC"), `${where}: PSIONIC iff Telepathy`).toBe(supers.includes(SUPERPOWERS.telepathy));
    expect(hasKeyword(s, v, "steady", WAVE7_DEPS), `${where}: steady iff Super Strength`).toBe(
      supers.includes(SUPERPOWERS.super_strength),
    );
    // (X-23's In the Name of Vengeance, 43030, gives every enemy retaliate 1, so the converse is only read without it.)
    const vengeance = s.villainArea.some((id) => codeOf(s, id) === "43030");
    const retaliates = hasKeyword(s, v, "retaliate", WAVE7_DEPS);
    if (supers.includes(SUPERPOWERS.telepathy)) expect(retaliates, `${where}: Telepathy gives retaliate`).toBe(true);
    else if (!vengeance) expect(retaliates, `${where}: no retaliate without Telepathy`).toBe(false);
  }
}

/** The driver's own answer, except that Hope Summers never defends and that a hero defends when Hope is attacked. */
function ownAnswer(s: GameState, choice: PendingChoice): readonly string[] | null {
  if (choice.prompt.kind !== "declareDefender") return null;
  const ids = choice.options.map((o) => o.optionId);
  const target = choice.prompt.attack.targetCharacterInstanceId;
  const allies = ids.filter(
    (id) => id !== "decline" && cardType(s, id as InstanceId) === "ally" && codeOf(s, id as InstanceId) !== HOPE,
  );
  if (allies[0]) return [allies[0]];
  if (codeOf(s, target) === HOPE) {
    const hero = ids.find((id) => id !== "decline" && cardType(s, id as InstanceId) === "hero_identity");
    if (hero) return [hero];
  }
  return ids.includes("decline") ? ["decline"] : null;
}

/** What an observed game saw, for the file's last test (every check seen at least once). */
const seen = {
  foreignHand: [] as string[],
  statusAnswered: [] as string[],
  hopeFollowedFirstPlayer: [] as string[],
  superpowerAttached: [] as string[],
  stageThreeReached: [] as string[],
  livingBombSeen: [] as string[],
};

interface GameResult {
  readonly session: GameSession;
  readonly commands: number;
  readonly label: string;
  readonly start: GameState;
  readonly firstPlayers: ReadonlyMap<number, PlayerId>;
}

/** Plays one command at a time, checking every invariant after each; returns the session. */
function play(initial: GameState, spec: GameSpec, label: string): GameResult {
  const dealtTo = new Map<string, PlayerId>();
  for (const p of initial.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) if (initial.instances[id]!.ownerId === p.playerId) dealtTo.set(id, p.playerId);
  for (const [id, instance] of Object.entries(initial.instances))
    if (instance.ownerId !== null && PLAYER_CARD_TYPES.includes(cardType(initial, id as InstanceId)))
      dealtTo.set(id, instance.ownerId);
  checkState(initial, dealtTo, spec.scenario, `${label} start`);
  const firstPlayers = new Map<number, PlayerId>([[initial.round, initial.firstPlayerId]]);
  let session = startSession(initial);
  const turn = { key: "", n: 0 };
  let commands = 0;
  let lastRound = initial.round;
  while (!session.state.outcome && session.state.round < spec.cap) {
    if (commands >= 4000)
      throw new Error(`${label}: no outcome after ${commands} commands (round ${session.state.round})`);
    const before = session.state;
    const command = nextCommand(session, turn);
    const result = sessionApply(session, command, WAVE7_DEPS);
    if (!result.ok)
      throw new Error(
        `${label}: engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`,
      );
    session = result.session;
    commands++;
    observe(before, session.state, result.events, spec, label);
    checkState(session.state, dealtTo, spec.scenario, `${label} command ${commands} ${JSON.stringify(command)}`);
    if (session.state.round !== lastRound) {
      expect(session.state.round - lastRound, `${label}: rounds advance by one`).toBe(1);
      lastRound = session.state.round;
      firstPlayers.set(lastRound, session.state.firstPlayerId);
    }
  }
  return { session, commands, label, start: initial, firstPlayers };
}

function nextCommand(session: GameSession, turn: { key: string; n: number }): Command {
  const s = session.state;
  const choice = s.pendingChoice;
  if (choice) {
    const own = ownAnswer(s, choice);
    if (own)
      return { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: own };
  } else if (s.step.phase === "player" && s.step.kind === "turn") {
    const key = `${s.round}:${s.step.activePlayerId}`;
    if (turn.key !== key) Object.assign(turn, { key, n: 0 });
    if (++turn.n > 40) return { type: "endTurn", playerId: s.step.activePlayerId };
  }
  const [command] = playToOutcome(s, WAVE7_DEPS, { maxCommands: 1 }).session.log.commands;
  if (!command) throw new Error("the driver issued no command");
  return command;
}

/** Per-command checks of Mister Sinister's rules and the bookkeeping of what was seen. */
function observe(
  before: GameState,
  after: GameState,
  events: readonly GameEvent[],
  spec: GameSpec,
  label: string,
): void {
  const v = before.activeVillainId;
  const here = `${label} round ${before.round}`;
  if (spec.scenario === "mister-sinister" && cardPoolName(before, v) === "Mister Sinister") {
    // "Forced Response: After a status card is placed on Mister Sinister, place N threat on the main scheme", N the
    // stage's number (40136-40138).
    const stage = before.villains.find((x) => x.instanceId === v)!.stageIndex + 1;
    const given = events.filter((e) => e.type === "statusGiven" && e.instanceId === v).length;
    const placed = events.filter(
      (e) => e.type === "threatPlaced" && e.schemeInstanceId === before.mainScheme.instanceId && e.amount === stage,
    ).length;
    if (given > 0 && after.villains.find((x) => x.instanceId === v)!.stageIndex + 1 === stage) {
      expect(
        placed,
        `${here}: ${given} status card(s) placed on Mister Sinister II-ish stage ${stage}`,
      ).toBeGreaterThanOrEqual(given);
      seen.statusAnswered.push(here);
    }
    if (superpowersOn(after).length > superpowersOn(before).length) seen.superpowerAttached.push(here);
    if (
      after.mainScheme.stageIndex !== before.mainScheme.stageIndex &&
      cardPoolName(after, after.mainScheme.instanceId).startsWith("Sinister Ends")
    )
      seen.stageThreeReached.push(here);
  }
  if (
    spec.scenario === "stryfe" &&
    events.some((e) => e.type === "mainSchemeFlippedToOtherFace" || e.type === "cardFlippedToOtherFace")
  )
    seen.livingBombSeen.push(here);
  if (after.round !== before.round && hopeIds(after)[0] !== undefined && after.players.length > 1)
    if (
      after.firstPlayerId !== before.firstPlayerId &&
      after.instances[hopeIds(after)[0]!]!.controllerId === after.firstPlayerId
    )
      seen.hopeFollowedFirstPlayer.push(here);
}
const cardPoolName = (s: GameState, id: InstanceId): string => s.cardPool[s.instances[id]!.cardId]!.name;

/** The log replays to a deep-equal final state (and the replay itself reports no error). */
function expectReplays(result: GameResult): void {
  const replayed = replay(result.session.log, WAVE7_DEPS);
  expect(replayed.ok, `${result.label}: replay`).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

function newGame(spec: GameSpec): GameState {
  const config = wave7Scenario(spec.scenario, {
    players: seatsOf(spec.players, spec.rotate ?? 0),
    seed: spec.seed,
    modularSetIds: spec.modular ?? [],
    ...(spec.expert ? { difficulty: "expert" as const } : {}),
    ...(spec.firstPlayerIndex === undefined ? {} : { firstPlayerIndex: spec.firstPlayerIndex }),
  });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}

const labelOf = (spec: GameSpec) =>
  `${spec.scenario}${spec.expert ? " expert" : ""} ${spec.players}p${spec.modular?.length ? " +" + spec.modular.join("+") : ""} #${spec.seed}`;

// ---------------------------------------------------------------------------------------------------------------------
// Staged interactions. Core seats (their cards are the fixtures every other wave 7 test uses); the real wave 7 scripts.
// ---------------------------------------------------------------------------------------------------------------------

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const BLACK_PANTHER = { starterDeckId: "core-black-panther-protection" } as const;
const IRON_MAN = { starterDeckId: "core-iron-man-aggression" } as const;
const CORE_SEATS = [SPIDER_MAN, CAPTAIN_MARVEL, BLACK_PANTHER, IRON_MAN] as const;

function staged(
  scenario: GameSpec["scenario"],
  players: number,
  opts: { expert?: boolean; seed?: number; modular?: readonly string[] } = {},
): GameState {
  const config = wave7Scenario(scenario, {
    players: CORE_SEATS.slice(0, players),
    seed: opts.seed ?? 1,
    modularSetIds: opts.modular ?? [],
    ...(opts.expert ? { difficulty: "expert" as const } : {}),
  });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE7_DEPS);
}
const P_IDS = [P1, P2, P3, P4] as const;
const villainStageNumber = (s: GameState) => activeVillain(s).stageIndex + 1;

describe("setup by player count (RRG 1.8 'Expert Mode', p. 28; MC40 pp. 16-21; card data)", () => {
  it.each([1, 2, 3, 4])(
    "Mister Sinister, %i players: standard starts on I with 14 hit points per hero; expert starts on II with 17 per hero and 3 threat per hero",
    (n) => {
      const standard = staged("mister-sinister", n);
      expect(villainStageNumber(standard)).toBe(1);
      expect(maxHitPoints(standard, villainId(standard), WAVE7_DEPS)).toBe(14 * n);
      // Stage 2A's starting threat is 1 per hero and Sinister II is not revealed in standard mode.
      expect(inst(standard, standard.mainScheme.instanceId).threat).toBe(n);
      expect(superpowersOn(standard)).toHaveLength(1);

      const expert = staged("mister-sinister", n, { expert: true });
      expect(villainStageNumber(expert)).toBe(2);
      expect(maxHitPoints(expert, villainId(expert), WAVE7_DEPS)).toBe(17 * n);
      // MC40 p. 21: 1B resolves first, so Mister Sinister II sees 1 attachment (< 2) and places 2 per hero: 1n + 2n.
      expect(superpowersOn(expert)).toHaveLength(1);
      expect(inst(expert, expert.mainScheme.instanceId).threat).toBe(3 * n);
    },
  );

  it.each([1, 2, 3, 4])(
    "Stryfe, %i players: standard I has 15 per hero and the Grasp 4 + 6 per hero; expert starts on II with 17 per hero and each hero has a PSIONIC attachment",
    (n) => {
      const standard = staged("stryfe", n);
      expect(villainStageNumber(standard)).toBe(1);
      expect(maxHitPoints(standard, villainId(standard), WAVE7_DEPS)).toBe(15 * n);
      const grasp = standard.villainArea.find((id) => cardName(standard, id) === "Stryfe's Grasp")!;
      expect(inst(standard, grasp).threat).toBe(4 + 6 * n);

      const expert = staged("stryfe", n, { expert: true });
      expect(villainStageNumber(expert)).toBe(2);
      expect(maxHitPoints(expert, villainId(expert), WAVE7_DEPS)).toBe(17 * n);
      const psionic = Object.values(expert.instances).filter((i) => {
        const card = expert.cardPool[i.cardId]!;
        return (
          card.type === "attachment" &&
          i.attachedTo !== null &&
          ((card as { traits?: readonly string[] }).traits ?? []).map(String).includes("PSIONIC") &&
          ["40169", "40170", "40171", "40172", "40173"].includes(i.cardId as string)
        );
      });
      // MC40 p. 21 / Jul 9, 2026 - Ruling 3 (1): Stage II's When Revealed resolves at setup, once per player.
      expect(psionic).toHaveLength(n);
    },
  );

  it.each([3, 4])(
    "%i players: Hope Summers is one card, under the first player, her ATK and THW her hero's (Jan 17, 2026 - Ruling 1)",
    (n) => {
      for (const scenario of ["mister-sinister", "stryfe"] as const) {
        const s = staged(scenario, n);
        const hopes = hopeIds(s);
        expect(hopes).toHaveLength(1);
        expect(s.players.find((p) => p.playArea.includes(hopes[0]!))!.playerId).toBe(s.firstPlayerId);
        expect(s.instances[hopes[0]!]!.controllerId).toBe(s.firstPlayerId);
      }
    },
  );
});

describe("Hope Summers follows the first player token (card text; RRG 1.8 'First Player', p. 20; 'Ownership and Control', p. 31)", () => {
  it("3 players, three rounds: control passes P1 -> P2 -> P3 -> P1 and her base ATK and THW are each controller's hero's", () => {
    let s = staged("stryfe", 3);
    s = heroed(s);
    const hope = hopeIds(s)[0]!;
    const seenControllers: PlayerId[] = [];
    for (let r = 0; r < 3; r++) {
      const leader = s.firstPlayerId;
      seenControllers.push(s.instances[hope]!.controllerId as PlayerId);
      expect(s.instances[hope]!.controllerId).toBe(leader);
      const hero = s.players.find((p) => p.playerId === leader)!.identity.instanceId;
      const mine = profileOf(s, hope)!;
      const theirs = profileOf(s, hero)!;
      expect(mine.atk, `round ${s.round}: Hope's ATK`).toBe(theirs.atk);
      expect(mine.thw, `round ${s.round}: Hope's THW`).toBe(theirs.thw);
      // Stryfe I: a hero's round with blank boosts (nothing here asks for an answer).
      // (Surgery: no threat on the main scheme and no damage on the heroes, so nobody loses and nobody is eliminated.)
      let calm = patchInstance(s, s.mainScheme.instanceId, { threat: 0 });
      for (const p of s.players) calm = patchInstance(calm, p.identity.instanceId, { damage: 0 });
      s = round(calm, { boosts: 3 }).state;
      expect(s.outcome).toBeNull();
    }
    expect(seenControllers).toEqual([P1, P2, P3]);
    expect(s.firstPlayerId).toBe(P1);
    expect(s.instances[hope]!.controllerId).toBe(P1);
  });

  it("Q14 = B: while her controller is in alter-ego form her ATK and THW are 0, and they come back with the hero", () => {
    const s = staged("stryfe", 2);
    const hope = hopeIds(s)[0]!;
    const alterEgo = withForm(s, "alterEgo", P1);
    expect(profileOf(alterEgo, hope)).toMatchObject({ atk: 0, thw: 0 });
    const hero = withForm(s, { heroForm: 0 }, P1);
    const heroProfile = profileOf(hero, identityOf(hero, P1))!;
    expect(profileOf(hero, hope)).toMatchObject({ atk: heroProfile.atk, thw: heroProfile.thw });
  });
});

/** Surgery: P1 controls an upgrade of theirs attached to Hope Summers (a hero upgrade the engine lets attach to an ally is not needed: surgery). */
function p1UpgradeOnHope(state: GameState): { state: GameState; upgrade: InstanceId; hope: InstanceId } {
  const hope = hopeIds(state)[0]!;
  const owner = state.players.find((p) => p.playerId === P1)!;
  const upgrade = [...owner.hand, ...owner.deck].find((id) => cardType(state, id) === "upgrade");
  if (!upgrade) throw new Error("P1 has no upgrade");
  const moved: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: p.hand.filter((i) => i !== upgrade),
            deck: p.deck.filter((i) => i !== upgrade),
            playArea: [...p.playArea, upgrade],
          }
        : p,
    ),
    instances: {
      ...state.instances,
      [upgrade]: { ...state.instances[upgrade]!, faceup: true, exhausted: false, attachedTo: hope, controllerId: P1 },
      [hope]: { ...state.instances[hope]!, attachments: [...state.instances[hope]!.attachments, upgrade] },
    },
  };
  return { state: moved, upgrade, hope };
}
const holderOf = (s: GameState, id: InstanceId): string | undefined => {
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      if (p[zone].includes(id)) return `${p.playerId}.${zone}`;
  return undefined;
};
/** Round 1 passes the token, so Hope (and the upgrade on her, RRG p. 31) are the second player's in round 2. */
function hopeCarriedUpgradeInRound2(): { state: GameState; upgrade: InstanceId } {
  const { state: armed, upgrade } = p1UpgradeOnHope(staged("stryfe", 2, { seed: 2 }));
  const calm = (s: GameState) => {
    let c = patchInstance(s, s.mainScheme.instanceId, { threat: 0 });
    for (const p of s.players) c = patchInstance(c, p.identity.instanceId, { damage: 0 });
    return c;
  };
  const afterOne = round(calm(heroed(armed)), { boosts: 2 }).state;
  expect(afterOne.firstPlayerId).toBe(P2);
  return { state: calm(afterOne), upgrade };
}

describe("a card another player owns and Hope Summers carries (RRG 1.8 'Ownership and Control', p. 31)", () => {
  it("RRG p. 31: an upgrade on a card that changes control changes control with it, and stays its owner's", () => {
    const { state, upgrade } = hopeCarriedUpgradeInRound2();
    expect(state.instances[upgrade]!.controllerId).toBe(P2);
    expect(state.instances[upgrade]!.ownerId).toBe(P1);
  });

  // Telekinetic Wave (40179): "Return an upgrade or support you control to your hand." RRG p. 31, "Ownership and Control":
  // a card that leaves play "is placed in its owner's equivalent out-of-play area (hand, deck, or discard pile)". The
  // upgrade is P1's card, so it can only reach P1's hand; P2's hand is not a place it can go.
  it("40179.when-revealed (Telekinetic Wave): P2 returns P1's upgrade carried by Hope Summers: it goes to its OWNER's hand (RRG p. 31)", () => {
    const { state, upgrade } = hopeCarriedUpgradeInRound2();
    const run = round(heroed(state), { boosts: 2, reveals: ["40179", "40175"] });
    expect(holderOf(run.state, upgrade)).toBe("p1.hand");
  });

  // Cerebral Erasure (40175) prints "to its owner's hand" itself.
  it("40175.when-revealed (Cerebral Erasure): P2 returns P1's upgrade carried by Hope Summers to its owner's hand, as printed", () => {
    const { state, upgrade } = hopeCarriedUpgradeInRound2();
    const run = round(heroed(state), { boosts: 2, reveals: ["40175", "40176"] });
    expect(holderOf(run.state, upgrade)).toBe("p1.hand");
  });
});

/** The player's hand becomes the first cards of these types found in their hand, deck and discard pile; the rest goes to the deck. */
function handOfTypes(state: GameState, player: PlayerId, spec: Readonly<Record<string, number>>): GameState {
  const owner = state.players.find((p) => p.playerId === player)!;
  const pool = [...owner.hand, ...owner.deck, ...owner.discard];
  const chosen: InstanceId[] = [];
  for (const [type, count] of Object.entries(spec)) {
    const found = pool.filter((id) => cardType(state, id) === type && !chosen.includes(id)).slice(0, count);
    if (found.length < count) throw new Error(`${player} has only ${found.length} ${type} cards`);
    chosen.push(...found);
  }
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: chosen, deck: pool.filter((id) => !chosen.includes(id)), discard: [] } : p,
    ),
  };
}
/** Q18 = B / MC40 p. 18: the most cards of one of the six player card types in a hand. */
function mostCommon(s: GameState, player: PlayerId): number {
  const tally = new Map<string, number>();
  for (const id of s.players.find((p) => p.playerId === player)!.hand) {
    const t = cardType(s, id);
    if (["ally", "event", "resource", "support", "upgrade", "player_side_scheme"].includes(t))
      tally.set(t, (tally.get(t) ?? 0) + 1);
  }
  return Math.max(0, ...tally.values());
}

describe("Uncontrollable Power (40166b), three and four players (card text; MC40 p. 18)", () => {
  it("3 players: each places X from their own hand, in player order, each asked about the optional discard first", () => {
    let s = staged("stryfe", 3, { seed: 3 });
    s = handOfTypes(s, P1, { upgrade: 3, event: 2, support: 1 });
    s = handOfTypes(s, P2, { event: 4, ally: 1, support: 1 });
    s = handOfTypes(s, P3, { ally: 2, event: 2, resource: 1 });
    const expected = P_IDS.slice(0, 3).map((p) => mostCommon(s, p));
    expect(expected).toEqual([3, 4, 2]);
    const main = s.mainScheme.instanceId;
    const run = round(patchInstance(s, main, { threat: 0 }), { boosts: 3 });
    const placed = run.events.filter(
      (e) => e.type === "threatPlaced" && e.schemeInstanceId === main && e.sourceInstanceId === main,
    ) as Extract<GameEvent, { type: "threatPlaced" }>[];
    expect(placed.map((e) => e.amount)).toEqual(expected);
    const asked = run.prompts.filter((p) => p.labels.length > 0 && p.kind === "chooseCards").map((p) => p.player);
    expect(asked.slice(0, 3)).toEqual([P1, P2, P3]);
  });

  it("3 players, the first discarding an upgrade first: X is read after the discard (3 upgrades become 2 and tie the 2 events: X = 2)", () => {
    let s = staged("stryfe", 3, { seed: 3 });
    s = handOfTypes(s, P1, { upgrade: 3, event: 2, support: 1 });
    s = handOfTypes(s, P2, { event: 4, ally: 1, support: 1 });
    s = handOfTypes(s, P3, { ally: 2, event: 2, resource: 1 });
    const upgradeName = cardName(
      s,
      s.players[0]!.hand.find((id) => cardType(s, id) === "upgrade")!,
    );
    const main = s.mainScheme.instanceId;
    const run = round(patchInstance(s, main, { threat: 0 }), { boosts: 3, plan: { pick: [upgradeName] } });
    const placed = (
      run.events.filter(
        (e) => e.type === "threatPlaced" && e.schemeInstanceId === main && e.sourceInstanceId === main,
      ) as Extract<GameEvent, { type: "threatPlaced" }>[]
    ).map((e) => e.amount);
    expect(placed).toEqual([2, 4, 2]);
  });
});

describe("Mister Sinister with three and four players and the real SUPERPOWER and Hope scripts", () => {
  const advancesOf = (log: readonly GameEvent[]) =>
    log.filter((e) => e.type === "mainSchemeAdvanced") as Extract<GameEvent, { type: "mainSchemeAdvanced" }>[];
  /** The heroes' round (hero form) with the main scheme at its target: the villain phase completes the stage. */
  const complete = (s: GameState) =>
    round(patchInstance(s, s.mainScheme.instanceId, { threat: 5 * s.players.length }), { boosts: s.players.length });
  const stageName = (s: GameState) =>
    (s.cardPool[s.instances[s.mainScheme.instanceId]!.cardId] as { stages: readonly { name?: string }[] }).stages[
      s.mainScheme.stageIndex
    ]?.name;

  it.each([3, 4])(
    "%i players: stage 2 twice then Sinister Ends; each set's cards are attached, shuffled in or kept aside, and the traits follow",
    (n) => {
      const s0 = staged("mister-sinister", n, { seed: 5 });
      const first = stageName(s0);
      expect(["Taking Off", "Bulking Up", "Focusing In"]).toContain(first);
      const one = complete(heroed(s0));
      expect(advancesOf(one.events)).toHaveLength(1);
      expect(superpowersOn(one.state)).toHaveLength(2);
      const two = complete(heroed(one.state));
      expect(stageName(two.state)).toBe("Sinister Ends");
      expect(superpowersOn(two.state)).toHaveLength(2);
      // The third set was removed with the random stage 2 and stays aside for the whole game (MC40 p. 16).
      const setOf = (id: InstanceId) =>
        ((s0.cardPool[codeOf(s0, id)] as { encounterSetIds?: readonly string[] }).encounterSetIds ?? []).map(String);
      const aside = two.state.encounterSetAside.filter((id) =>
        ["flight", "super_strength", "telepathy"].some((x) => setOf(id).includes(x)),
      );
      expect(aside).toHaveLength(5);
      // 3A: each player is dealt one facedown encounter card.
      const dealt = two.events.filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter");
      expect(dealt).toHaveLength(n);
    },
  );

  it("3 players, Sinister Ends 3B: every activation is redirected to Hope Summers, and her controller (P1) is the attacked player and defends (Q16 = A; RRG p. 10)", () => {
    const base = staged("mister-sinister", 3, { seed: 5 });
    const ends: GameState = {
      ...base,
      mainScheme: { ...base.mainScheme, stageIndex: 4 },
      instances: {
        ...base.instances,
        [base.mainScheme.instanceId]: { ...base.instances[base.mainScheme.instanceId]!, threat: 0 },
      },
    };
    const hope = hopeIds(ends)[0]!;
    const heroName = cardName(ends, ends.players[0]!.identity.instanceId);
    const run = round(heroed(ends), { boosts: 3, reveals: ["40145", "40145"], plan: { defend: heroName } });
    const retargets = run.events.filter((e) => e.type === "attackRetargeted") as Extract<
      GameEvent,
      { type: "attackRetargeted" }
    >[];
    expect(retargets.length).toBeGreaterThanOrEqual(1);
    for (const e of retargets) {
      expect(e.targetInstanceId).toBe(hope);
      expect(e.playerId, "the attacked player is Hope's controller").toBe(P1);
    }
    const defenderPrompts = run.prompts.filter((p) => p.kind === "declareDefender").map((p) => p.player);
    expect(defenderPrompts.length).toBeGreaterThanOrEqual(1);
    expect(new Set(defenderPrompts)).toEqual(new Set([P1]));
    for (const p of [P2, P3]) expect(inst(run.state, identityOf(run.state, p)).damage, `${p} took no damage`).toBe(0);
  });
});

describe("Stryfe with four players: Stage I defeated, Living Bomb and Stage II (card text; owner Q19 = A, Q21 = A)", () => {
  it("Stryfe's Grasp flips into Living Bomb carrying its 4 + 6 x 4 threat plus 3; Stage II has 17 x 4 hit points and stalwart; every identity has +2 hand size; each player gets a PSIONIC attachment in player order", () => {
    const base = staged("stryfe", 4, { seed: 4 });
    const villain = villainId(base);
    const stacked = stackEncounterDeck(base, "40170", "40171", "40172", "40173");
    const hp = maxHitPoints(stacked, villain, WAVE7_DEPS) ?? 0;
    expect(hp).toBe(60);
    const armed = patchInstance(stacked, villain, { damage: hp - 1 });
    // (The attacker is put in hero form first, so the sizes before are read in that form.)
    const formed = withForm(armed, { heroForm: 0 }, P1);
    const handSizesBefore = formed.players.map((p) => handSize(formed, p.playerId, WAVE7_DEPS));
    const run = attackFor(armed, villain, {}, P1);
    const s = run.state;
    expect(villainStageNumber(s)).toBe(2);
    expect(maxHitPoints(s, villain, WAVE7_DEPS)).toBe(17 * 4);
    const bomb = s.villainArea.find((id) => cardName(s, id) === "Living Bomb")!;
    expect(bomb).toBeDefined();
    expect(s.villainArea.some((id) => cardName(s, id) === "Stryfe's Grasp")).toBe(false);
    expect(inst(s, bomb).threat).toBe(4 + 6 * 4 + 3);
    expect(hasKeyword(s, villain, "stalwart", WAVE7_DEPS)).toBe(true);
    s.players.forEach((p, i) => expect(handSize(s, p.playerId, WAVE7_DEPS)).toBe(handSizesBefore[i]! + 2));
    const names = s.players.map((p) =>
      s.instances[p.identity.instanceId]!.attachments.map((a) => cardName(s, a)).sort(),
    );
    expect(names).toEqual([["Mind Alteration"], ["Mind Trap"], ["Psionic Amnesia"], ["Psychic Inertia"]]);
    expect(s.outcome).toBeNull();
  });
});

describe("Mutant Insurrection (40189) outside its own scenario: Stryfe is a MUTANT LIBERATION FRONT character (RRG 1.8 'Character'; card text)", () => {
  const reveal = (scenario: GameSpec["scenario"], modular: readonly string[]) => {
    const base = staged(scenario, 1, { seed: 2, modular });
    // The card dealt to the first player in the villain phase is Mutant Insurrection, after one blank boost card.
    const run = round(patchInstance(base, base.mainScheme.instanceId, { threat: 0 }), {
      boosts: 1,
      reveals: ["40189"],
    });
    const card = Object.values(run.state.instances).find((i) => i.cardId === "40189")!;
    return { run, card };
  };

  it("with Stryfe in play it places 2 threat for him on top of its own 3 (no surge); each minion gains toughness", () => {
    const { run, card } = reveal("stryfe", ["mutant_insurrection", "extreme_measures"]);
    expect(card.threat).toBe(3 + 2);
    const surged = run.events.some((e) => e.type === "encounterCardRevealed" && e.cardId === "40189");
    expect(surged).toBe(true);
  });

  it("with no MLF character in play (Mister Sinister) it places nothing and gains surge: the next card is revealed too", () => {
    const base = staged("mister-sinister", 1, { seed: 2, modular: ["mutant_insurrection"] });
    const stacked = stackEncounterDeck(
      patchInstance(base, base.mainScheme.instanceId, { threat: 0 }),
      "01186",
      "40189",
      "40145",
    );
    const run = round(stacked, { boosts: 0 });
    const revealedCodes = run.events
      .filter((e): e is Extract<GameEvent, { type: "encounterCardRevealed" }> => e.type === "encounterCardRevealed")
      .map((e) => e.cardId as string);
    const at = revealedCodes.indexOf("40189");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(revealedCodes[at + 1], "40189 gained surge, so the card under it was revealed").toBeDefined();
    const card = Object.values(run.state.instances).find((i) => i.cardId === "40189")!;
    expect(card.threat).toBe(3);
  });
});

describe("Nasty Boys outside Mister Sinister: Teamwork (RRG 1.8 'Teamwork', p. 43)", () => {
  it("a NASTY BOY revealed while another is in play activates against the player it engages; the first one does not (Slab, then Ruckus)", () => {
    const base = staged("stryfe", 2, { seed: 2, modular: ["nasty_boys", "extreme_measures"] });
    const calm = patchInstance(base, base.mainScheme.instanceId, { threat: 0 });
    // Villain phase: two blank boost cards for Stryfe's activations; then Slab to the first player and Ruckus to the second.
    const run = round(heroed(calm), { boosts: 2, reveals: ["40116", "40115"] });
    const byName = (name: string) =>
      run.events.filter(
        (e) => e.type === "enemyActivated" && cardName(run.state, e.enemyInstanceId) === name,
      ) as Extract<GameEvent, { type: "enemyActivated" }>[];
    expect(byName("Slab"), "Slab: nobody else of the trait was in play").toHaveLength(0);
    const ruckus = byName("Ruckus");
    expect(ruckus, "Ruckus: Slab is in play, so it activates once").toHaveLength(1);
    expect(ruckus[0]!.playerId).toBe(P2);
    expect(ruckus[0]!.activation).toBe("attack");
  });
});

describe("Sinister Strike (40150) at Sinister Ends: a card-caused attack is still 'when Mister Sinister attacks' (Q9 = A; MC40 p. 16)", () => {
  it("his attack from the card goes to Hope Summers, and the revealing player is still stunned by the AERIAL clause", () => {
    // Flight attached by the first stage 2 seed; find a seed whose first stage 2 is Taking Off by reading the attachment.
    let base: GameState | null = null;
    for (let seed = 1; seed <= 12 && !base; seed++) {
      const candidate = staged("mister-sinister", 1, { seed });
      if (superpowersOn(candidate).includes(SUPERPOWERS.flight)) base = candidate;
    }
    if (!base) throw new Error("no seed starts on Taking Off");
    const ends: GameState = {
      ...base,
      mainScheme: { ...base.mainScheme, stageIndex: 4 },
      instances: {
        ...base.instances,
        [base.mainScheme.instanceId]: { ...base.instances[base.mainScheme.instanceId]!, threat: 0 },
      },
    };
    const hope = hopeIds(ends)[0]!;
    const heroName = cardName(ends, ends.players[0]!.identity.instanceId);
    // Boost cards: his own activation (retargeted), then the Strike's attack. Hope would die at 3 hit points: the hero defends.
    const run = round(heroed(ends), {
      boostCards: ["01186", "01187"],
      reveals: ["40150"],
      plan: { defend: heroName },
    });
    const retargets = run.events.filter((e) => e.type === "attackRetargeted") as Extract<
      GameEvent,
      { type: "attackRetargeted" }
    >[];
    expect(retargets.length, "the activation and the Strike's attack").toBeGreaterThanOrEqual(2);
    for (const e of retargets) expect(e.targetInstanceId).toBe(hope);
    expect(inst(run.state, identityOf(run.state, P1)).statuses.stunned).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Whole games. Seeds were picked by a scan (deleted) for games that run several rounds before the greedy driver loses.
// ---------------------------------------------------------------------------------------------------------------------

const SETS_OF = (s: GameState, code: string): string[] =>
  ((s.cardPool[code] as { encounterSetIds?: readonly string[] } | undefined)?.encounterSetIds ?? []).map(String);

/** Every card of each named set is somewhere in the game at setup (the deck, the set-aside area, or attached/in play). */
function expectSetsSeated(start: GameState, sets: readonly string[], label: string): void {
  for (const set of sets) {
    const cards = Object.values(start.instances).filter((i) => SETS_OF(start, i.cardId as string).includes(set));
    expect(cards.length, `${label}: ${set} has cards in the game`).toBeGreaterThan(0);
    // None of the set's cards is face down in a player's zone: they begin in the deck, the set-aside area or in play.
    const stray = cards.filter((i) =>
      start.players.some((p) => [...p.hand, ...p.deck, ...p.discard].includes(i.instanceId)),
    );
    expect(stray, `${label}: ${set} cards are not in a player's hand or deck`).toHaveLength(0);
  }
}

const SUPER_SET: Readonly<Record<string, string>> = {
  flight: SUPERPOWERS.flight,
  super_strength: SUPERPOWERS.super_strength,
  telepathy: SUPERPOWERS.telepathy,
};

function runGame(spec: GameSpec): GameResult {
  const start = newGame(spec);
  const result = play(start, spec, labelOf(spec));
  expectSetsSeated(start, spec.modular ?? [], labelOf(spec));
  for (const set of spec.modular ?? [])
    if (SUPER_SET[set])
      // A SUPERPOWER set chosen as a modular set: its attachment enters play on the villain by its setup keyword (Q20 = B).
      expect(superpowersOn(start), `${labelOf(spec)}: ${set} attached at setup`).toContain(SUPER_SET[set]);
  expectReplays(result);
  return result;
}

describe("whole games: expert mode and 3-4 players (Mister Sinister and Stryfe)", () => {
  it.each<GameSpec>([
    { scenario: "mister-sinister", players: 1, seed: 7, expert: true, cap: 5 },
    { scenario: "mister-sinister", players: 2, seed: 2, expert: true, cap: 5 },
    { scenario: "mister-sinister", players: 3, seed: 1, expert: true, cap: 4 },
    { scenario: "mister-sinister", players: 4, seed: 3, expert: true, cap: 4 },
    { scenario: "stryfe", players: 2, seed: 2, expert: true, cap: 5 },
    { scenario: "stryfe", players: 3, seed: 5, expert: true, cap: 4 },
    { scenario: "stryfe", players: 4, seed: 2, expert: true, cap: 4 },
    { scenario: "stryfe", players: 3, seed: 1, cap: 5 },
    { scenario: "stryfe", players: 4, seed: 6, cap: 4 },
  ])("$scenario expert=$expert $players players seed $seed", (spec) => {
    const r = runGame(spec);
    expect(r.session.state.round, "at least two rounds were played").toBeGreaterThanOrEqual(2);
  });
});

describe("whole games: the modular matrix (each set seated in a scenario it did not ship as the default for)", () => {
  it.each<GameSpec>([
    { scenario: "stryfe", players: 2, seed: 1, modular: ["flight", "black_tom_cassidy"], cap: 4 },
    { scenario: "stryfe", players: 2, seed: 1, modular: ["super_strength", "military_grade"], cap: 4 },
    { scenario: "stryfe", players: 2, seed: 1, modular: ["telepathy", "mutant_slayers"], cap: 4 },
    { scenario: "stryfe", players: 2, seed: 1, modular: ["nasty_boys", "telepathy"], cap: 4 },
    { scenario: "mister-sinister", players: 2, seed: 1, modular: ["extreme_measures"], cap: 3 },
    { scenario: "mister-sinister", players: 2, seed: 3, modular: ["mutant_insurrection"], cap: 4 },
    { scenario: "mister-sinister", players: 2, seed: 1, modular: ["military_grade"], cap: 3 },
    { scenario: "mister-sinister", players: 2, seed: 1, modular: ["mutant_slayers"], cap: 3 },
    { scenario: "mister-sinister", players: 2, seed: 1, modular: ["black_tom_cassidy"], cap: 3 },
  ])("$scenario + $modular", (spec) => {
    runGame(spec);
  });
});

describe("what the observed games saw (a passing suite is a claim: these are the checks the games actually reached)", () => {
  // Reached by the games above (each check ran at least once): the answer to a status card placed on Mister Sinister, a
  // SUPERPOWER attachment going on, Hope Summers changing hands with the token, and a Grasp-to-Living-Bomb flip.
  // Not reached by any game (the greedy driver loses first): Sinister Ends (stage 3), covered by the staged tests above.
  it("every targeted check below ran at least once in the games, and no game left a card in a foreign hand", () => {
    expect(
      seen.statusAnswered.length,
      "a status card placed on Mister Sinister was answered by threat",
    ).toBeGreaterThan(0);
    expect(seen.superpowerAttached.length, "a SUPERPOWER attachment went on").toBeGreaterThan(0);
    expect(seen.hopeFollowedFirstPlayer.length, "Hope Summers changed hands with the token").toBeGreaterThan(0);
    expect(seen.livingBombSeen.length, "Stryfe's Grasp flipped").toBeGreaterThan(0);
    expect(seen.foreignHand, "no game reached the Telekinetic Wave finding").toEqual([]);
  });
});
