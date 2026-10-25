import { PLAYABLE_CARDS, WONDER_MAN_STARTER_DECKS, cardId, type CoreAspect } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  printedResources,
  replay,
  sessionApply,
  startSession,
  validateDeck,
  type Command,
  type GameEvent,
  type GameSession,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { PLAYABLE_DEPS as DEPS, playableScenario } from "../../playable/index.js";
import { playToOutcome } from "../../testing/driver.js";
import {
  P1,
  changeForm,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { stackSetAsideBehindBoost, withForm } from "../../testing/staging.js";
import { codeOf } from "../../wave9/testing.js";
import { IRON_MAN_SCENARIO, engageMinion } from "../testing.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with Wonder Man's printed-stand-in starter deck (`wonder-man-justice`: the owner's listing, 40 cards plus
 * the Permanent Ionic Physiology, `verified: false`, see the deck's provenance) on the playable pool (`PLAYABLE_DEPS`,
 * `playableScenario`), docs/phase7-wave10-hero-packs.md H8.4 line HS8 and docs/wave-definition-of-done.md step 4.
 *
 * Three parts.
 *
 * 1. Seeded games: the card-name-agnostic greedy driver (`../../testing/driver.ts`) plays four games against Core's Rhino
 *    and one against Iron Man at the Civil War scenario `registration-iron-man`, one command at a time, and after every
 *    command the invariants below are checked. Each game must reach an outcome, and its log must replay to the same
 *    final state (the engine's determinism contract).
 * 2. A staged game (Rhino, seed 1, five rounds of real commands, the cards a round needs placed by surgery, each surgery
 *    closing a logged segment so every segment replays deep-equal): Mr. Hollywood overpaying, the three off-aspect
 *    energy events (Bombs Away, Stronger Together, Unified Strike), Firebird's rebirth counter from an overpay, a fourth
 *    tuck refused at the maximum, Pacifism dealt and discarded, "What Are You?".
 * 3. The nemesis set dealt in, staged: Death Cannot Die finds Grim Reaper (Quickstrike), Brother vs. Brother's additional
 *    cost to attack him, Scythe Strike.
 *
 * Invariants after every command of part 1 (and 2): no prompt without an answer (RRG 1.8 "Choices", the game never
 * soft locks); the game never rests between steps with nothing pending outside a player turn (Appendix II); no card sits
 * in two zones and every card dealt is somewhere (RRG "Owner", p. 31); Ionic Physiology never leaves play ("Permanent",
 * p. 32: cards with permanent cannot leave play) and holds at most 3 tucked cards (the card text and the errata of
 * p. 70), each an event or resource card with a printed [energy] resource that its owner owns (the card text; "Tuck",
 * p. 45); in hero form his ATK is 1 plus the cards tucked (the card, Power Recycling); no payment, resource,
 * counter, damage or threat is ever negative ("Cost", p. 13); while Pacifism is in his play area the hero's basic
 * attack is refused ("Pacifism", 58025).
 *
 * Authorities: the printed cards (58001a to 58029, with the stand-in deck's caveat); RRG 1.8
 * (docs/rules/mc_rulesreference_v18_compressed.md) "Cost" and "Overpay" p. 13, "Tuck" p. 45, "Permanent" p. 32, "Quickstrike"
 * p. 36, "Defend, Defense" pp. 14-15, "Target" p. 42 (a scheme with no threat is not a legal target of a thwart),
 * "Reveal" p. 38 (a revealed minion resolves When Revealed before Quickstrike), errata p. 70 (Ionic Physiology); the
 * engine note of this week on Brother vs. Brother (an additional cost to attack Grim Reaper).
 */

const DECK = "wonder-man-justice";
const IONIC = "58002";
const ALTRUISM = "58003";
const BLAST = "58004";
const STRUCK = "58005";
const HOLLYWOOD = "58009";
const WHAT_ARE_YOU = "58011";
const FIREBIRD = "58012";
const BENEVOLENCE = "58016";
const BOMBS_AWAY = "58017";
const TOGETHER = "58019";
const STRIKE = "58020";
const ENERGY = "58023";
const PACIFISM = "58025";
const REAPER = "58026";
const BROTHER = "58027";
const SCYTHE = "58028";
const DEATH_CANNOT_DIE = "58029";
const ADVANCE = "01186"; // a Core treachery with no boost icon and no boost ability
const MERCENARY = "01101"; // Hydra Mercenary: 3 hit points

const RESPONSE = ".ionic-physiology-response";
const HOLLYWOOD_ABILITY = "58009.mr-hollywood-resource";

const starter = WONDER_MAN_STARTER_DECKS[0]!;
const printedCodes = (): string[] =>
  starter.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId as string));

// ---------------------------------------------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------------------------------------------
function open(config: GameSetupConfig): GameState {
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.code}: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
/** Core's Rhino (one modular set, the scenario's recommendation), the precon seated. */
const rhino = (seed: number): GameState =>
  open(playableScenario("rhino", { players: [{ starterDeckId: DECK }], seed } as never));
const ironMan = (seed: number): GameState =>
  open(playableScenario(IRON_MAN_SCENARIO, { players: [{ starterDeckId: DECK }], seed }));
const hero = (seed = 1): GameState => withForm(rhino(seed), { heroForm: 0 });

const encounterOf = (s: GameState) => s.encounterDecks[Object.keys(s.encounterDecks)[0]!]!;
/** The top sixteen encounter cards that are not the pack's own made into Advance, so a boost card is harmless. */
function quiet(state: GameState): GameState {
  return encounterOf(state)
    .deck.slice(0, 16)
    .filter((id) => !codeOf(state, id).startsWith("58"))
    .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), state);
}

// ---------------------------------------------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------------------------------------------
const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;

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

const dealtOf = (initial: GameState): Map<string, PlayerId> => {
  const dealtTo = new Map<string, PlayerId>();
  for (const p of initial.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) if (initial.instances[id]!.ownerId === p.playerId) dealtTo.set(id, p.playerId);
  return dealtTo;
};

const ionicOf = (s: GameState): InstanceId | undefined => instancesOf(s, IONIC)[0];
const tuckedUnder = (s: GameState): readonly InstanceId[] => {
  const ionic = ionicOf(s);
  return ionic ? inst(s, ionic).tucked : [];
};

/** Throws a descriptive error on the first broken invariant of `s`. */
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
    if (labels.length > 1) fail(`${id} (${nameOf(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${nameOf(s, id as InstanceId)} (${id}) is in no zone`);
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard"] as const)
      for (const id of p[zone]) {
        const dealt = dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId)
          fail(`${nameOf(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
        if (zone !== "hand" && dealt === undefined && s.instances[id]!.ownerId !== p.playerId)
          fail(`${nameOf(s, id)} (${id}) is in ${p.playerId}'s ${zone} but no deck started with it`);
      }
  for (const [id, i] of Object.entries(s.instances)) {
    if (i.damage < 0 || i.threat < 0) fail(`${id} (${nameOf(s, id as InstanceId)}) has negative damage or threat`);
    for (const [counter, n] of Object.entries(i.counters))
      if ((n as number) < 0) fail(`${id} has ${n} ${counter} counters`);
  }
  // Ionic Physiology: Permanent, so it is in play for the whole game; at most 3 tucked. (Not after the player is
  // eliminated: every card he owns goes to his discard pile, RRG 'Player Elimination' p. 33.)
  if (s.outcome) return;
  const ionic = ionicOf(s);
  if (!ionic) fail("Ionic Physiology is not in the game");
  if (!cardsInPlay(s).includes(ionic!)) fail("Ionic Physiology left play");
  const under = tuckedUnder(s);
  if (under.length > 3) fail(`${under.length} cards tucked under Ionic Physiology`);
  for (const t of under) {
    if (s.instances[t]!.ownerId !== P1) fail(`${nameOf(s, t)} is tucked but not owned by the player`);
    const card = s.cardPool[s.instances[t]!.cardId]!;
    if (card.type !== "event" && card.type !== "resource") fail(`${nameOf(s, t)} (${card.type}) is tucked`);
    if (printedResources(card).energy < 1) fail(`${nameOf(s, t)} has no printed energy resource and is tucked`);
  }
  const me = playerOf(s, P1).identity;
  if (me.form === "hero") {
    const atk = characterProfile(s, me.instanceId, DEPS)!.atk;
    if (atk !== 1 + under.length) fail(`ATK ${atk} with ${under.length} tucked`);
  }
  // Pacifism: "Wonder Man cannot attack".
  const pacifism = instancesOf(s, PACIFISM).find((i) => playerOf(s, P1).playArea.includes(i));
  if (pacifism && me.form === "hero" && !s.pendingChoice && s.step.phase === "player" && !s.outcome) {
    const target = s.activeVillainId!;
    const attack = applyCommand(
      s,
      { type: "basicAttack", playerId: P1, attackerInstanceId: me.instanceId, targetInstanceId: target },
      DEPS,
    );
    if (attack.ok) fail("Wonder Man attacked under Pacifism");
  }
}

/** What the seeded games saw. */
const seen = {
  games: [] as string[],
  tucks: [] as string[],
  tuckAtMax: [] as string[],
  overpaid: [] as string[],
  offAspect: [] as string[],
  nemesis: [] as string[],
  pacifism: [] as string[],
  energySiphon: [] as string[],
};

class Observer {
  constructor(readonly label: string) {}
  observe(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    const here = `${this.label} round ${before.round} ${command.type}`;
    const at = (cardIdValue: string) => String(cardIdValue);
    for (const e of events) {
      switch (e.type) {
        case "cardPlayed": {
          expect(e.resourcesPaid, `${here}: resources paid`).toBeGreaterThanOrEqual(0);
          const card = after.cardPool[e.cardId]!;
          const cost = "cost" in card && typeof card.cost === "number" ? card.cost : 0;
          if (e.playerId === P1 && e.resourcesPaid > cost) seen.overpaid.push(`${here} ${nameOf(after, e.instanceId)}`);
          if ([BOMBS_AWAY, TOGETHER, STRIKE].includes(at(e.cardId))) seen.offAspect.push(`${here} ${at(e.cardId)}`);
          break;
        }
        case "resourcesGenerated":
          expect(e.amount, `${here}: resources generated`).toBeGreaterThanOrEqual(0);
          if (at(e.abilityId).startsWith("58006")) seen.energySiphon.push(here);
          break;
        case "encounterCardRevealed":
          if ([REAPER, BROTHER, SCYTHE, DEATH_CANNOT_DIE].includes(at(e.cardId)))
            seen.nemesis.push(`${here} ${at(e.cardId)}`);
          if (at(e.cardId) === PACIFISM) seen.pacifism.push(here);
          break;
        default:
      }
    }
    const nBefore = tuckedUnder(before).length;
    const nAfter = tuckedUnder(after).length;
    if (nAfter > nBefore) seen.tucks.push(here);
    if (nAfter === 3) seen.tuckAtMax.push(here);
  }
}

function nextCommand(session: GameSession, turn: { key: string; n: number }): Command {
  const s = session.state;
  if (!s.pendingChoice && s.step.phase === "player" && s.step.kind === "turn") {
    const key = `${s.round}:${s.step.activePlayerId}`;
    if (turn.key !== key) Object.assign(turn, { key, n: 0 });
    if (++turn.n > 40) return { type: "endTurn", playerId: s.step.activePlayerId };
  }
  const [command] = playToOutcome(s, DEPS, { maxCommands: 1 }).session.log.commands;
  if (!command) throw new Error("the driver issued no command");
  return command;
}

interface GameResult {
  readonly session: GameSession;
  readonly commands: number;
}

/** Plays `initial` to an outcome with every invariant checked after every command. */
function playGame(initial: GameState, observer: Observer): GameResult {
  const dealtTo = dealtOf(initial);
  checkState(initial, dealtTo, "start");
  let session = startSession(initial);
  const turn = { key: "", n: 0 };
  let commands = 0;
  while (!session.state.outcome) {
    if (commands >= 2500) throw new Error(`no outcome after 2500 commands (round ${session.state.round})`);
    const before = session.state;
    const command = nextCommand(session, turn);
    const result = sessionApply(session, command, DEPS);
    if (!result.ok)
      throw new Error(`engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    commands++;
    observer.observe(before, session.state, result.events, command);
    checkState(session.state, dealtTo, `${observer.label} command ${commands} ${JSON.stringify(command)}`);
  }
  return { session, commands };
}

function expectReplays(result: GameResult): void {
  const replayed = replay(result.session.log, DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the deck and the seeded games
// ---------------------------------------------------------------------------------------------------------------
describe("the stand-in precon", () => {
  it("lists 41 entries (40 cards and the Permanent Ionic Physiology), is legal on the playable pool, and holds the off-aspect energy events", () => {
    expect(starter.provenance.verified).toBe(false);
    const codes = printedCodes();
    expect(codes).toHaveLength(41);
    expect(
      validateDeck(
        { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
        PLAYABLE_CARDS,
      ),
    ).toEqual({ ok: true });
    // Three copies each of a Protection, a Leadership and an Aggression card: Wonder Man's off-aspect allowance for
    // printed [energy] events (58001b), so the deck is legal with them (docs/phase7-wave10-hero-packs.md H3.15).
    for (const code of [BOMBS_AWAY, TOGETHER, STRIKE]) expect(codes.filter((c) => c === code)).toHaveLength(3);
    const aspectOf = (code: string) => (PLAYABLE_CARDS.find((c) => c.id === code) as { aspect?: CoreAspect }).aspect;
    expect([BOMBS_AWAY, TOGETHER, STRIKE].map(aspectOf)).toEqual(["aggression", "protection", "leadership"]);
  });

  it("seats as Simon Williams: Ionic Physiology in play on the identity, a hand of 6, the nemesis set aside, Pacifism in the encounter deck", () => {
    const s = rhino(1);
    const p = playerOf(s, P1);
    expect(p.identity.form).toBe("alterEgo");
    expect(p.hand).toHaveLength(6);
    const ionic = ionicOf(s)!;
    expect(cardsInPlay(s)).toContain(ionic);
    expect(inst(s, ionic).attachedTo).toBe(identityOf(s));
    // 40 counted cards: hand and deck (the Permanent card is in play).
    expect(p.hand.length + p.deck.length).toBe(40);
    expect(
      [...p.hand, ...p.deck]
        .map((i) => codeOf(s, i))
        .sort()
        .join(),
    ).toBe(
      printedCodes()
        .filter((c) => c !== IONIC)
        .sort()
        .join(),
    );
    expect(p.setAside.map((i) => codeOf(s, i)).sort()).toEqual([
      REAPER,
      BROTHER,
      SCYTHE,
      DEATH_CANNOT_DIE,
      DEATH_CANNOT_DIE,
    ]);
    expect(encounterOf(s).deck.some((i) => codeOf(s, i) === PACIFISM)).toBe(true);
  });
});

describe("Wonder Man precon, Core's Rhino, one player, seeded games played to an outcome", () => {
  it.each([1, 2, 3])("seed %i plays to an outcome with every invariant intact and replays", (seed) => {
    const result = playGame(rhino(seed), new Observer(`rhino#${seed}`));
    seen.games.push(`rhino#${seed}`);
    expect(result.session.state.outcome).not.toBeNull();
    expect(result.session.state.round).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Wonder Man precon at the Civil War scenario registration-iron-man, one player", () => {
  it("seed 1 plays to an outcome with every invariant intact and replays", () => {
    const result = playGame(ironMan(1), new Observer("iron-man#1"));
    seen.games.push("iron-man#1");
    expect(result.session.state.outcome).not.toBeNull();
    expectReplays(result);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Part 2: a staged game on the printed deck
// ---------------------------------------------------------------------------------------------------------------
interface Plan {
  /** Optional triggers to take (the ability id ends with one of these); every other optional trigger is declined. */
  readonly take?: readonly string[];
  /** Card prompts: the first of these on offer is chosen. */
  readonly cards?: readonly InstanceId[];
  /** A chooseOption label prefix to pick. */
  readonly option?: string;
  /** Declare this card the defender when asked (otherwise no defense). */
  readonly defender?: InstanceId;
}
const abilityOf = (o: { ref: { kind: string } }): string | undefined =>
  o.ref.kind === "ability" ? ((o.ref as unknown as { abilityId: string }).abilityId as string) : undefined;
const planner =
  (plan: Plan): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const hit = choice.options.find((o) => plan.take?.some((t) => (abilityOf(o) ?? "").endsWith(t)));
        return hit ? [hit.optionId] : choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
      }
      case "declareDefender": {
        const hit = plan.defender
          ? choice.options.find(
              (o) =>
                (o.optionId as string) === plan.defender ||
                (o.ref.kind === "card" && o.ref.instanceId === plan.defender),
            )
          : undefined;
        return hit ? [hit.optionId] : ["decline"];
      }
      case "chooseOption": {
        const hit = plan.option ? choice.options.find((o) => o.label.startsWith(plan.option!)) : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      default: {
        const wanted = plan.cards?.flatMap((id) =>
          choice.options.filter((o) => o.ref.kind === "card" && o.ref.instanceId === id),
        );
        if (wanted && wanted.length > 0) return wanted.slice(0, choice.maxSelections).map((o) => o.optionId);
        return firstLegal(s);
      }
    }
  };

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const accepted = (s: GameState, command: Command): boolean => applyCommand(s, command, DEPS).ok;

describe("Wonder Man precon: a staged game against Rhino, seed 1, invariants after every command", () => {
  let session: GameSession;
  let state: GameState;
  let dealtTo: ReadonlyMap<string, PlayerId>;
  const segments: { readonly log: GameSession["log"]; readonly end: GameState }[] = [];

  /** Runs commands, answering each prompt by `plan`, through the session log; checks the invariants after each. */
  const act = (plan: Plan, ...commands: readonly Command[]): GameEvent[] => {
    const events: GameEvent[] = [];
    const settleOne = (where: string) => {
      while (state.pendingChoice && !state.outcome) {
        const choice = state.pendingChoice;
        const r = sessionApply(
          session,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: planner(plan)(state),
          },
          DEPS,
        );
        if (!r.ok) throw new Error(r.error.message);
        session = r.session;
        state = r.session.state;
        events.push(...r.events);
        checkState(state, dealtTo, `${where} (choice)`);
      }
    };
    settleOne("pending");
    for (const command of commands) {
      const r = sessionApply(session, command, DEPS);
      if (!r.ok) throw new Error(`${command.type}: ${r.error.code}: ${r.error.message}`);
      session = r.session;
      state = r.session.state;
      events.push(...r.events);
      checkState(state, dealtTo, command.type);
      settleOne(command.type);
    }
    return events;
  };
  /** Test-only surgery: closes the logged segment and opens the next one from the changed state. */
  const surgery = (next: GameState) => {
    segments.push({ log: session.log, end: state });
    state = next;
    session = startSession(next);
  };
  /** The hand is exactly these cards (the first copy of each, from the deck or discard pile); the rest go to the deck's bottom. */
  const handOf = (...codes: string[]) => {
    const given = moveToHand(state, P1, ...codes);
    surgery({
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: [...given.ids], deck: [...p.deck, ...p.hand.filter((i) => !given.ids.includes(i))] }
          : p,
      ),
    });
  };
  const handId = (code: string): InstanceId => {
    const id = playerOf(state, P1).hand.find((i) => codeOf(state, i) === code);
    if (!id) throw new Error(`${code} is not in hand`);
    return id;
  };
  const inPlayId = (code: string): InstanceId => {
    const id = cardsInPlay(state).find((i) => codeOf(state, i) === code);
    if (!id) throw new Error(`${code} is not in play`);
    return id;
  };
  const me = (): InstanceId => identityOf(state);
  const rhinoId = (): InstanceId => state.activeVillainId!;
  const damageOf = (id: InstanceId): number => inst(state, id).damage;
  const tuckedCodes = (): string[] => tuckedUnder(state).map((i) => codeOf(state, i));
  const discardCodes = (): string[] => playerOf(state, P1).discard.map((i) => codeOf(state, i));
  /** Staging: no threat on the main scheme and no damage on Rhino, so the game runs on for the rounds the cases need. */
  const calm = () =>
    surgery(patchInstance(patchInstance(state, state.mainScheme.instanceId, { threat: 0 }), rhinoId(), { damage: 0 }));
  const hollywoodPays = () => resourceAbility(inPlayId(HOLLYWOOD), HOLLYWOOD_ABILITY);
  const basicAttack = (target: InstanceId, attacker = me()): Command => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: attacker,
    targetInstanceId: target,
  });

  it("setup: alter-ego form, quiet encounter deck, every card accounted for", () => {
    state = quiet(rhino(1));
    session = startSession(state);
    dealtTo = dealtOf(state);
    checkState(state, dealtTo, "start");
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
  });

  it("round 1, alter ego: Mr. Hollywood (cost 1) is played paid by a physical card and attaches to Simon Williams", () => {
    handOf(HOLLYWOOD, BENEVOLENCE);
    act({}, play(P1, handId(HOLLYWOOD), [handId(BENEVOLENCE)], { attachToInstanceId: me() }));
    expect(inst(state, inPlayId(HOLLYWOOD)).attachedTo).toBe(me());
    act({}, changeForm());
    expect(playerOf(state, P1).identity.form).toBe("hero");
  });

  it("round 1: Active Altruism (cost 0) overpaid with Mr. Hollywood's energy removes 3 threat instead of 1, and Ionic Physiology tucks it (card text 58003, 58009, 58002; RRG 'Cost' p. 13)", () => {
    surgery(patchInstance(state, state.mainScheme.instanceId, { threat: 5 }));
    handOf(ALTRUISM, STRUCK, BENEVOLENCE);
    const before = inst(state, state.mainScheme.instanceId).threat;
    const events = act({ take: [RESPONSE] }, play(P1, handId(ALTRUISM), [], { abilities: [hollywoodPays()] }));
    expect(ofType(events, "resourcesGenerated")).toMatchObject([{ amount: 1 }]);
    expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: 1 }]);
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(before - 3);
    expect(tuckedCodes()).toEqual([ALTRUISM]);
  });

  it("round 1: Starstruck (cost 1) paid by a physical card and Mr. Hollywood's energy overpays an energy: Rhino takes ATK (1 + 1 tucked) and is stunned; the card is tucked (the second)", () => {
    const hollywood = inPlayId(HOLLYWOOD);
    const before = damageOf(rhinoId());
    act({ take: [RESPONSE] }, play(P1, handId(STRUCK), [handId(BENEVOLENCE)], { abilities: [hollywoodPays()] }));
    expect(damageOf(rhinoId()) - before).toBe(2);
    expect(inst(state, rhinoId()).statuses.stunned).toBe(1);
    expect(tuckedCodes()).toEqual([ALTRUISM, STRUCK]);
    // Used once per card, and not exhausted by it: the same upgrade pays again for the next card.
    expect(inst(state, hollywood).exhausted).toBe(false);
  });

  it("round 1 villain phase: Rhino is stunned, so his attack is replaced by discarding the status (RRG 'Stun, Stunned' p. 41); no damage reaches Wonder Man", () => {
    act({}, endTurn());
    expect(state.round).toBe(2);
    expect(inst(state, rhinoId()).statuses.stunned).toBe(0);
    expect(damageOf(me())).toBe(0);
  });

  it("round 2: Bombs Away (Aggression, printed [energy]) is legal in the Justice deck: Wonder Man (Aerial) exhausts, 3 damage to Rhino and to the engaged minion, which is defeated; tucked as the third card", () => {
    surgery(engageMinion(state, MERCENARY, "merc", P1));
    handOf(BOMBS_AWAY, ENERGY);
    const before = damageOf(rhinoId());
    act({ take: [RESPONSE] }, play(P1, handId(BOMBS_AWAY), [handId(ENERGY)]));
    expect(damageOf(rhinoId()) - before).toBe(3);
    expect(cardsInPlay(state)).not.toContain("merc" as InstanceId);
    expect(inst(state, me()).exhausted).toBe(true);
    expect(tuckedCodes()).toEqual([ALTRUISM, STRUCK, BOMBS_AWAY]);
    expect(characterProfile(state, me(), DEPS)!.atk).toBe(4);
  });

  it("round 2: a fourth tuck is refused at the maximum of 3 (card text 58002): Ionic Blast overpaid by one energy deals 3 + 2 and goes to the discard pile; nothing is tucked", () => {
    handOf(BLAST, ENERGY);
    const before = damageOf(rhinoId());
    const events = act({ take: [RESPONSE] }, play(P1, handId(BLAST), [handId(ENERGY)]));
    expect(damageOf(rhinoId()) - before).toBe(5);
    expect(tuckedCodes()).toEqual([ALTRUISM, STRUCK, BOMBS_AWAY]);
    expect(discardCodes()).toContain(BLAST);
    // The Response is not even offered with the card full: no tuck happens, and no prompt stands in the way.
    expect(events.some((e) => e.type === "cardMoved" && e.to.kind === "tucked")).toBe(false);
  });

  it("round 2 villain phase: Wonder Man is exhausted and undefended; Rhino's ATK 2 deals 2", () => {
    act({}, endTurn());
    expect(state.round).toBe(3);
    expect(damageOf(me())).toBe(2);
  });

  it("round 3: Firebird (cost 2) paid by Energy and overpaid with Mr. Hollywood gets a rebirth counter (card text 58012: 'If you overpaid')", () => {
    calm();
    handOf(FIREBIRD, ENERGY, STRIKE);
    const events = act({}, play(P1, handId(FIREBIRD), [handId(ENERGY)], { abilities: [hollywoodPays()] }));
    expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: 3 }]);
    expect(inst(state, inPlayId(FIREBIRD)).counters.rebirth).toBe(1);
  });

  it("round 3: Unified Strike (Leadership, printed [energy]): Firebird's basic attack adds Wonder Man's ATK 4 (1 + 3 tucked) and she takes no consequential damage; he exhausts", () => {
    const firebird = inPlayId(FIREBIRD);
    const control = basicAttack(rhinoId(), firebird);
    const before = damageOf(rhinoId());
    act({ take: [".unified-strike-interrupt"] }, control);
    expect(damageOf(rhinoId()) - before).toBe(2 + 4);
    expect(damageOf(firebird)).toBe(0);
    expect(inst(state, me()).exhausted).toBe(true);
    expect(discardCodes()).toContain(STRIKE);
  });

  it("round 3 villain phase: Pacifism is dealt to Wonder Man's player (card text 58025: 'Give to the Simon Williams player') and stays in his play area", () => {
    surgery(stackSetAsideBehindBoostOrDeck(state, PACIFISM));
    act({}, endTurn());
    expect(state.round).toBe(4);
    expect(playerOf(state, P1).playArea).toContain(inPlayId(PACIFISM));
  });

  it("round 4: under Pacifism his basic attack is refused (checked after every command); Stronger Together (Protection, printed [energy]) cuts Rhino's attack on defending Firebird by Wonder Man's DEF to nothing", () => {
    calm();
    expect(accepted(state, basicAttack(rhinoId()))).toBe(false);
    handOf(TOGETHER);
    const firebird = inPlayId(FIREBIRD);
    act({ defender: firebird, take: [".stronger-together-interrupt"] }, endTurn());
    expect(state.round).toBe(5);
    expect(damageOf(firebird)).toBe(0);
    expect(discardCodes()).toContain(TOGETHER);
  });

  it("round 5: he flips to alter ego and discards 3 cards tucked under Ionic Physiology to discard Pacifism (card text: 'Exhaust Simon Williams or discard 3 cards tucked'); Simon stays ready", () => {
    calm();
    act({}, changeForm());
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    const pacifism = inPlayId(PACIFISM);
    act({}, use(P1, pacifism, "58025.pacifism-action", [], undefined, { branch: 1 }));
    expect(cardsInPlay(state)).not.toContain(pacifism);
    expect(tuckedCodes()).toEqual([]);
    expect(inst(state, me()).exhausted).toBe(false);
    expect(discardCodes()).toEqual(expect.arrayContaining([ALTRUISM, STRUCK, BOMBS_AWAY]));
    expect(cardsInPlay(state)).toContain(ionicOf(state)!);
    act({}, endTurn());
    expect(state.round).toBe(6);
  });

  it('round 6: "What Are You?" (cost 2): lethal damage sets his hit points to 4 remaining, changes him to alter ego, tucks 3 energy events from the discard pile and removes the upgrade from the game (card text 58011)', () => {
    calm();
    act({}, changeForm());
    expect(playerOf(state, P1).identity.form).toBe("hero");
    handOf(WHAT_ARE_YOU, ENERGY);
    act({}, play(P1, handId(WHAT_ARE_YOU), [handId(ENERGY)], { attachToInstanceId: me() }));
    const way = inPlayId(WHAT_ARE_YOU);
    // Rhino's ATK 2 would finish him: 12 hit points, 11 damage on him (surgery), and Firebird is not defending.
    surgery(patchInstance(state, me(), { damage: 11 }));
    const firebirdBefore = damageOf(inPlayId(FIREBIRD));
    const events = act(
      {
        cards: playerOf(state, P1).discard.filter((i) =>
          ["58003", "58004", "58005", "58017", "58020", "58019"].includes(codeOf(state, i)),
        ),
      },
      endTurn(),
    );
    expect(events.filter((e) => e.type === "cardMoved" && e.to.kind === "tucked")).toHaveLength(3);
    expect(state.round).toBe(7);
    expect(state.outcome).toBeFalsy();
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    const profile = characterProfile(state, me(), DEPS)!;
    expect(profile.maxHp - damageOf(me())).toBe(4);
    expect(state.removedFromGame).toContain(way);
    expect(tuckedUnder(state).length).toBe(3);
    expect(damageOf(inPlayId(FIREBIRD))).toBe(firebirdBefore);
  });

  it("every card is accounted for, Ionic Physiology never held more than 3 or left play (checked after every command above)", () => {
    checkState(state, dealtTo, "end");
    expect(state.outcome).toBeFalsy();
  });

  it("every logged segment replays from its own first state, command by command, to the state it ended in (deep-equal)", () => {
    const all = [...segments, { log: session.log, end: state }];
    expect(all.length).toBeGreaterThan(8);
    for (const { log, end } of all) {
      const replayed = replay(log, DEPS);
      if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
      expect(replayed.state).toEqual(end);
    }
    expect(all.reduce((n, seg) => n + seg.log.commands.length, 0)).toBeGreaterThan(15);
  });
});

/** Pacifism sits in the encounter deck: stacked behind one filler (the villain's boost card), so it is dealt to the player. */
function stackSetAsideBehindBoostOrDeck(state: GameState, code: string): GameState {
  const pile = encounterOf(state);
  const id = pile.deck.find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  const key = Object.keys(state.encounterDecks)[0]!;
  const rest = pile.deck.filter((i) => i !== id);
  const [filler, ...others] = rest;
  return { ...state, encounterDecks: { ...state.encounterDecks, [key]: { ...pile, deck: [filler!, id, ...others] } } };
}

// ---------------------------------------------------------------------------------------------------------------
// Part 3: the nemesis set dealt in
// ---------------------------------------------------------------------------------------------------------------
describe("Grim Reaper's nemesis set, dealt in against the precon", () => {
  const drive = (s: GameState, plan: Plan, ...commands: readonly Command[]) => {
    let current = s;
    const events: GameEvent[] = [];
    const settleOne = () => {
      for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
        if (guard > 200) throw new Error("choices did not settle");
        const choice = current.pendingChoice;
        const r = applyCommand(
          current,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: planner(plan)(current),
          },
          DEPS,
        );
        if (!r.ok) throw new Error(r.error.message);
        current = r.state;
        events.push(...r.events);
      }
    };
    settleOne();
    for (const command of commands) {
      const r = applyCommand(current, command, DEPS);
      if (!r.ok) throw new Error(`${command.type}: ${r.error.code}: ${r.error.message}`);
      current = r.state;
      events.push(...r.events);
      settleOne();
    }
    return { state: current, events };
  };
  const attacksBy = (events: readonly GameEvent[], enemy: InstanceId) =>
    ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === enemy);

  /** Death Cannot Die dealt in a villain phase (behind the villain's boost card): Grim Reaper arrives and attacks. */
  function reaperIn() {
    const dealt = dealtOf(quiet(hero()));
    const start = stackSetAsideBehindBoost(quiet(hero()), DEATH_CANNOT_DIE);
    const run = drive(start, {}, endTurn());
    checkState(run.state, dealt, "after Death Cannot Die");
    return { ...run, dealt };
  }

  it("Death Cannot Die finds Grim Reaper, who engages the player and attacks once by Quickstrike; the treachery is discarded (card text 58029, 58026; RRG 'Quickstrike' p. 36)", () => {
    const { state, events } = reaperIn();
    const reaper = instancesOf(state, REAPER)[0]!;
    expect(inst(state, reaper).engagedWith).toBe(P1);
    expect(cardsInPlay(state)).toContain(reaper);
    // His own activation this phase, plus the attack the treachery gives him ('activates against you').
    expect(attacksBy(events, reaper)).toHaveLength(1);
    expect(cardsInPlay(state)).not.toContain(instancesOf(state, DEATH_CANNOT_DIE)[0]!);
    seen.nemesis.push("staged Death Cannot Die");
  });

  it("Brother vs. Brother in play: attacking Grim Reaper costs a card from the hand; with no card to discard the attack is refused, with one it is made and the card is discarded", () => {
    const first = reaperIn();
    const reaper = instancesOf(first.state, REAPER)[0]!;
    const withScheme = stackSetAsideBehindBoost(first.state, BROTHER);
    const second = drive(withScheme, {}, endTurn());
    expect(cardsInPlay(second.state)).toContain(instancesOf(second.state, BROTHER)[0]!);
    // Round 3, hero form: an empty hand cannot pay, a hand of one can.
    const attacker = identityOf(second.state);
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: attacker,
      targetInstanceId: reaper,
    };
    const live = withForm(second.state, { heroForm: 0 });
    const emptyHanded: GameState = {
      ...live,
      players: live.players.map((p) => ({ ...p, hand: [], deck: [...p.deck, ...p.hand] })),
    };
    expect(accepted(emptyHanded, attack)).toBe(false);
    const given = moveToHand(emptyHanded, P1, BENEVOLENCE);
    const handed = given.state;
    const spare = given.ids[0]!;
    const costed = drive(handed, {}, attack);
    expect(damageIn(costed.state, reaper)).toBeGreaterThan(damageIn(handed, reaper));
    expect(playerOf(costed.state, P1).discard).toContain(spare);
    seen.nemesis.push("staged Brother vs. Brother");
  });

  it("Scythe Strike with Grim Reaper in play: he activates against the player (card text 58028)", () => {
    const first = reaperIn();
    const reaper = instancesOf(first.state, REAPER)[0]!;
    const start = stackSetAsideBehindBoost(first.state, SCYTHE);
    const run = drive(start, {}, endTurn());
    expect(attacksBy(run.events, reaper)).toHaveLength(2);
    expect(run.state.outcome).toBeFalsy();
    checkState(run.state, first.dealt, "after Scythe Strike");
  });
});

const damageIn = (s: GameState, id: InstanceId): number => inst(s, id).damage;

describe("what the seeded games saw", () => {
  it("every seeded game was played to an outcome", () => {
    expect(seen.games).toHaveLength(4);
  });
  it("the seeded games tucked to the maximum, played an off-aspect energy event and met the nemesis set (the seeds are fixed)", () => {
    const counts = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.length]));
    expect(counts.tucks, JSON.stringify(counts)).toBeGreaterThan(0);
    // The seeds are fixed, so these are facts of these games: an off-aspect energy event played, a tuck at the maximum,
    // and the nemesis set dealt in by the encounter deck itself. (No game overpaid or met Pacifism: the staged game does.)
    expect(counts.tuckAtMax, JSON.stringify(counts)).toBeGreaterThan(0);
    expect(counts.offAspect, JSON.stringify(counts)).toBeGreaterThan(0);
    expect(counts.nemesis, JSON.stringify(counts)).toBeGreaterThan(0);
  });
});
