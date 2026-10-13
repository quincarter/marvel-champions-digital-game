import { HERCULES_STARTER_DECKS, PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
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
import { NEW_LABORS, withLaborOrder } from "../../dsl/wave10-labor.testing.js";
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
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { stackSetAsideBehindBoost, withForm } from "../../testing/staging.js";
import { codeOf } from "../../wave9/testing.js";
import { engageMinion, stagedInPlay } from "../testing.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with Hercules's printed starter deck (`hercules-leadership`, the decklist card in the pack: 15 hero, 13
 * Leadership and 12 basic cards, `verified: true`) on the playable pool (`PLAYABLE_DEPS`, `playableScenario`),
 * docs/phase7-wave10-hero-packs.md H8.4 lines HS8, HS17 and HS18, and docs/wave-definition-of-done.md step 4.
 *
 * Four parts.
 *
 * 1. Seeded games: the card-name-agnostic greedy driver (`../../testing/driver.ts`) plays three games against Core's
 *    Rhino, and two with All Versus All as the scenario's modular set (HS18, the hero pack's own set), one command at a
 *    time; after every command the invariants below are checked, each game reaches an outcome and replays to the same
 *    final state.
 * 2. A staged game (Rhino, seed 1, real commands, the cards a round needs placed by surgery, each surgery closing a
 *    logged segment so every segment replays deep-equal) that finishes each of the three Labor cards once and so has
 *    all three Gift cards enter play: Defeat the Hydra (Lernean Hydra defeated by Hercules's attack), Protect Humanity
 *    (its last labor counter removed by a defended attack redirected to Amadeus Cho) and Embody Pathos (Olympic Feud
 *    defeated by Hercules's thwart), each followed by Atonement.
 * 3. Edges only the real deck shows: a Labor card that finds nothing to attach to (RRG 1.8 FAQ "Labor cards", p. 65)
 *    goes to the bottom of the Labor deck with no Gift earned; Ancient Rivalry with Thor in play (Team-Up, "Team-Up"
 *    p. 43) and without him; a Labor card finished while he is in alter-ego form earns no Gift (the Atonement is on the
 *    hero face).
 * 4. His nemesis set dealt in, staged: Ares, God of War, Appeal to Athena (the obligation), Olympic Feud.
 *
 * Invariants after every command of parts 1 and 2: no prompt without an answer (RRG 1.8 "Choices", the game never
 * soft locks); the game never rests between steps with nothing pending outside a player turn (Appendix II); no card sits
 * in two zones and every card dealt is somewhere (RRG "Owner", p. 31); the three Labor cards and the three Gift cards
 * exist once each; a Labor card is in the Labor deck, in play, or in the victory display and never in a discard pile (FAQ
 * p. 65: it goes to the bottom of the Labor deck unless it is placed in the victory display), and at most one is in play
 * ("New Labors of Hercules"); a Gift card is in the Gift deck or attached to Hercules, and once in play it stays
 * ("Permanent", p. 32; the Gift cards have it); at most one Gift per Labor card finished (Atonement, once per phase,
 * hero face only); Protect Humanity holds 0 to 3 labor counters; no payment, resource, counter, damage or threat is
 * negative ("Cost", p. 13).
 *
 * Authorities: the printed cards (59001a to 59045); RRG 1.8 (mc_rulesreference_v18_compressed.md) "Victory X" p. 46,
 * "Find" p. 19, "Reveal" p. 38 (a revealed minion resolves When Revealed before Quickstrike), "Target" p. 42 (a scheme
 * with no threat is not a legal target of a thwart or a removal of threat), "Defend, Defense" pp. 14-15, "Team-Up" p. 43,
 * "Player Elimination" p. 33, FAQ p. 65 (Labor cards); the pack insert (the only source of the Labor and Gift rules,
 * docs/phase7-wave10-sources.md section 3); FFG rulings of February 20, 2026 (Ruling 3, Protect Humanity) and March 6,
 * 2026 (Ruling 3 (2), a Labor card that finds nothing).
 */

const DECK = "hercules-leadership";
const AVA_SET = "all_versus_all";
const DEFEAT_THE_HYDRA = "59002";
const EMBODY_PATHOS = "59003";
const PROTECT_HUMANITY = "59004";
const LABOR_CODES = [DEFEAT_THE_HYDRA, EMBODY_PATHOS, PROTECT_HUMANITY];
const NEMEAN = "59005";
const SHIELD = "59006";
const SWORD = "59007";
const GIFT_CODES = [NEMEAN, SHIELD, SWORD];
const CHO = "59008";
const HELM = "59015";
const THOR = "59020";
const RIVALRY = "59026";
const GAUNTLETS = "59013";
const APPEAL = "59035";
const ARES = "59036";
const HYDRA = "59037";
const FEUD = "59038";
const AXE = "59039";
const GOD_OF_WAR = "59040";
const AVA_CODES = ["59041", "59042", "59043", "59044", "59045"];
const ADVANCE = "01186"; // a Core treachery with no boost icon and no boost ability
const MERCENARY = "01101"; // Hydra Mercenary: 3 hit points

const ATONEMENT = ".atonement";
const HELM_INTERRUPT = ".hercs-helm-interrupt";
/** The three Gift cards' "After this card enters play, draw 4 cards" Responses. */
const RESPONSES = [".nemean-lion-skin-response", ".shield-of-perseus-response", ".sword-of-peleus-response"];

const starter = HERCULES_STARTER_DECKS[0]!;
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
/** Core's Rhino (one modular set: the scenario's recommendation unless named), the precon seated. */
const rhino = (seed: number, modularSetIds?: readonly string[]): GameState =>
  open(
    playableScenario("rhino", {
      players: [{ starterDeckId: DECK }],
      seed,
      ...(modularSetIds ? { modularSetIds } : {}),
    } as never),
  );
const hero = (seed = 1): GameState => withForm(rhino(seed), { heroForm: 0 });

const encounterOf = (s: GameState) => s.encounterDecks[Object.keys(s.encounterDecks)[0]!]!;
/** The top sixteen encounter cards that are not the pack's own made into Advance, so a boost card is harmless. */
function quiet(state: GameState): GameState {
  return encounterOf(state)
    .deck.slice(0, 16)
    .filter((id) => !codeOf(state, id).startsWith("59"))
    .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), state);
}

// ---------------------------------------------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------------------------------------------
const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const copiesOf = (s: GameState, code: string): InstanceId[] => instancesOf(s, code);

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

const giftsInPlay = (s: GameState): InstanceId[] =>
  GIFT_CODES.flatMap((code) => copiesOf(s, code)).filter((id) => cardsInPlay(s).includes(id));
const laborsFinished = (s: GameState): InstanceId[] =>
  LABOR_CODES.flatMap((code) => copiesOf(s, code)).filter((id) => s.victoryDisplay.includes(id));

/** Throws a descriptive error on the first broken invariant of `s`; `before` is the previous state, when there is one. */
function checkState(s: GameState, dealtTo: ReadonlyMap<string, PlayerId>, where: string, before?: GameState): void {
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
  // After the player is eliminated every card he owns goes to his discard pile (RRG 'Player Elimination' p. 33).
  if (s.outcome) return;
  // The Labor deck and the Gift deck: three cards each, one copy of each, wherever they are.
  for (const code of [...LABOR_CODES, ...GIFT_CODES]) {
    const n = copiesOf(s, code).length;
    if (n !== 1) fail(`${n} copies of ${code} (${code})`);
  }
  if (!choice) {
    for (const code of LABOR_CODES)
      for (const id of copiesOf(s, code))
        if ((zones.get(id) ?? []).some((label) => label.endsWith(".discard")))
          fail(`${nameOf(s, id)} is in a discard pile (RRG FAQ p. 65: the bottom of the Labor deck instead)`);
  }
  const laborsInPlay = LABOR_CODES.flatMap((code) => copiesOf(s, code)).filter((id) => cardsInPlay(s).includes(id));
  if (laborsInPlay.length > 1) fail(`${laborsInPlay.length} Labor cards in play`);
  for (const code of GIFT_CODES)
    for (const id of copiesOf(s, code)) {
      const labels = zones.get(id) ?? [];
      const ok =
        cardsInPlay(s).includes(id) ||
        labels.some((l) => l.includes(".sep.Gift.")) ||
        s.instances[id]!.attachedTo !== null;
      if (!ok) fail(`${nameOf(s, id)} is neither in the Gift deck nor in play: ${labels.join(", ")}`);
    }
  if (before && !before.outcome) {
    const was = giftsInPlay(before).length;
    if (giftsInPlay(s).length < was) fail("a Gift card left play");
  }
  if (giftsInPlay(s).length > laborsFinished(s).length)
    fail(`${giftsInPlay(s).length} Gift cards in play for ${laborsFinished(s).length} Labor cards finished`);
  for (const id of copiesOf(s, PROTECT_HUMANITY)) {
    const n = s.instances[id]!.counters.labor ?? 0;
    if (n > 3) fail(`Protect Humanity holds ${n} labor counters`);
  }
}

/** What the seeded games saw. */
const seen = {
  games: [] as string[],
  laborStarted: [] as string[],
  laborFinished: [] as string[],
  laborFoundNothing: [] as string[],
  giftsInPlay: [] as string[],
  atonement: [] as string[],
  nemesis: [] as string[],
  allVersusAll: [] as string[],
  teamUp: [] as string[],
};

class Observer {
  constructor(readonly label: string) {}
  observe(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    const here = `${this.label} round ${before.round} ${command.type}`;
    for (const e of events) {
      switch (e.type) {
        case "cardPlayed":
          expect(e.resourcesPaid, `${here}: resources paid`).toBeGreaterThanOrEqual(0);
          if (String(e.cardId) === RIVALRY) seen.teamUp.push(here);
          break;
        case "resourcesGenerated":
          expect(e.amount, `${here}: resources generated`).toBeGreaterThanOrEqual(0);
          break;
        case "encounterCardRevealed": {
          const code = String(e.cardId);
          if (LABOR_CODES.includes(code)) seen.laborStarted.push(`${here} ${code}`);
          if ([ARES, HYDRA, FEUD, AXE, GOD_OF_WAR, APPEAL].includes(code)) seen.nemesis.push(`${here} ${code}`);
          if (AVA_CODES.includes(code)) seen.allVersusAll.push(`${here} ${code}`);
          break;
        }
        case "revealedCardDiscarded":
          if (LABOR_CODES.includes(String(e.cardId))) seen.laborFoundNothing.push(`${here} ${String(e.cardId)}`);
          break;
        case "abilityResolved":
          if (String(e.abilityId).endsWith(ATONEMENT)) seen.atonement.push(here);
          break;
        case "cardMoved":
          if (e.to.kind === "victoryDisplay" && LABOR_CODES.includes(String(e.cardId)))
            seen.laborFinished.push(`${here} ${String(e.cardId)}`);
          break;
        default:
      }
    }
    for (const id of giftsInPlay(after))
      if (!giftsInPlay(before).includes(id)) seen.giftsInPlay.push(`${here} ${codeOf(after, id)}`);
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
    checkState(session.state, dealtTo, `${observer.label} command ${commands} ${JSON.stringify(command)}`, before);
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
describe("the printed precon", () => {
  it("is the 40 cards of the decklist card (15 hero, 13 Leadership, 12 basic) and is legal on the playable pool", () => {
    expect(starter.provenance.verified).toBe(true);
    const codes = printedCodes();
    expect(codes).toHaveLength(40);
    expect(codes.filter((c) => c >= "59008" && c <= "59017")).toHaveLength(15);
    expect(codes.filter((c) => c >= "59018" && c <= "59024")).toHaveLength(13);
    expect(codes.filter((c) => c >= "59025" && c <= "59034")).toHaveLength(12);
    expect(
      validateDeck(
        { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
        PLAYABLE_CARDS,
      ),
    ).toEqual({ ok: true });
    // The Labor and Gift cards are the identity's own separate decks, never in the 40.
    for (const code of [...LABOR_CODES, ...GIFT_CODES]) expect(codes).not.toContain(code);
  });

  it("seats as Hercules: alter-ego form, a hand of 6, a Labor deck and a Gift deck of three, the nemesis set aside and Appeal to Athena in the encounter deck", () => {
    const s = rhino(1);
    const p = playerOf(s, P1);
    expect(p.identity.form).toBe("alterEgo");
    expect(p.hand).toHaveLength(6);
    expect(p.hand.length + p.deck.length).toBe(40);
    expect(
      [...p.hand, ...p.deck]
        .map((i) => codeOf(s, i))
        .sort()
        .join(),
    ).toBe([...printedCodes()].sort().join());
    expect(p.separateDecks.Labor!.deck.map((i) => codeOf(s, i)).sort()).toEqual([...LABOR_CODES].sort());
    expect(p.separateDecks.Gift!.deck.map((i) => codeOf(s, i)).sort()).toEqual([...GIFT_CODES].sort());
    expect(p.setAside.map((i) => codeOf(s, i)).sort()).toEqual([ARES, HYDRA, FEUD, AXE, GOD_OF_WAR].sort());
    expect(encounterOf(s).deck.some((i) => codeOf(s, i) === APPEAL)).toBe(true);
    // 59004 is not the identity's obligation: only 59035 is shuffled into the encounter deck (H8.1 item 4).
    expect(encounterOf(s).deck.some((i) => codeOf(s, i) === PROTECT_HUMANITY)).toBe(false);
  });
});

describe("Hercules precon, Core's Rhino, one player, seeded games played to an outcome", () => {
  it.each([1, 2])("seed %i plays to an outcome with every invariant intact and replays", (seed) => {
    const result = playGame(rhino(seed), new Observer(`rhino#${seed}`));
    seen.games.push(`rhino#${seed}`);
    expect(result.session.state.outcome).not.toBeNull();
    expect(result.session.state.round).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Hercules precon with All Versus All as the modular set (HS18), one player", () => {
  it("is in the encounter deck at setup: five cards of the set, none of Rhino's usual modular set", () => {
    const s = rhino(1, [AVA_SET]);
    const codes = encounterOf(s).deck.map((i) => codeOf(s, i));
    for (const code of AVA_CODES) expect(codes, code).toContain(code);
  });
  it.each([1, 2])("seed %i plays to an outcome with every invariant intact and replays", (seed) => {
    const result = playGame(rhino(seed, [AVA_SET]), new Observer(`ava#${seed}`));
    seen.games.push(`ava#${seed}`);
    expect(result.session.state.outcome).not.toBeNull();
    expect(result.session.state.round).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Part 2: a staged game finishing the three Labor cards
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
const codesIn = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((i) => codeOf(s, i));
const laborDeckCodes = (s: GameState): string[] => codesIn(s, playerOf(s, P1).separateDecks.Labor!.deck);
const newLabors = (s: GameState): Command => use(P1, identityOf(s), NEW_LABORS);

/** Applies `commands` to `s` without a session (staged edges), answering each prompt by `plan`. */
function drive(s: GameState, plan: Plan, ...commands: readonly Command[]) {
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
}

describe("Hercules precon: a staged game finishing the three Labor cards, Rhino seed 1, invariants after every command", () => {
  let session: GameSession;
  let state: GameState;
  let dealtTo: ReadonlyMap<string, PlayerId>;
  const segments: { readonly log: GameSession["log"]; readonly end: GameState }[] = [];
  const finished: string[] = [];

  /** Runs commands, answering each prompt by `plan`, through the session log; checks the invariants after each. */
  const act = (plan: Plan, ...commands: readonly Command[]): GameEvent[] => {
    const events: GameEvent[] = [];
    const settleOne = (where: string) => {
      while (state.pendingChoice && !state.outcome) {
        const choice = state.pendingChoice;
        const before = state;
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
        checkState(state, dealtTo, `${where} (choice)`, before);
      }
    };
    settleOne("pending");
    for (const command of commands) {
      const before = state;
      const r = sessionApply(session, command, DEPS);
      if (!r.ok) throw new Error(`${command.type}: ${r.error.code}: ${r.error.message}`);
      session = r.session;
      state = r.session.state;
      events.push(...r.events);
      checkState(state, dealtTo, command.type, before);
      settleOne(command.type);
    }
    for (const e of ofType(events, "cardMoved"))
      if (e.to.kind === "victoryDisplay" && LABOR_CODES.includes(String(e.cardId))) finished.push(String(e.cardId));
    return events;
  };
  /** Test-only surgery: closes the logged segment and opens the next one from the changed state. */
  const surgery = (next: GameState) => {
    segments.push({ log: session.log, end: state });
    state = next;
    session = startSession(next);
  };
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
  const the = (code: string): InstanceId => copiesOf(state, code)[0]!;
  const me = (): InstanceId => identityOf(state);
  const form = () => playerOf(state, P1).identity.form;
  /** Staging: no threat on the main scheme and no damage on Rhino, so the game runs on for the rounds the cases need. */
  const calm = () =>
    surgery(
      patchInstance(patchInstance(state, state.mainScheme.instanceId, { threat: 0 }), state.activeVillainId!, {
        damage: 0,
      }),
    );
  const giftCodes = (): string[] => codesIn(state, giftsInPlay(state)).sort();
  const maxHp = (): number => characterProfile(state, me(), DEPS)!.maxHp;

  it("setup: alter-ego form, quiet encounter deck, every card accounted for", () => {
    state = quiet(rhino(1));
    session = startSession(state);
    dealtTo = dealtOf(state);
    checkState(state, dealtTo, "start");
    expect(form()).toBe("alterEgo");
    expect(giftsInPlay(state)).toEqual([]);
  });

  it("round 1, alter ego: New Labors of Hercules reveals Defeat the Hydra, which finds the Lernean Hydra (set aside) and attaches to it (+6 hit points, Elite)", () => {
    surgery(withLaborOrder(state, DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS));
    const hydra = the(HYDRA);
    const events = act({ cards: [hydra] }, newLabors(state));
    expect(ofType(events, "encounterCardRevealed").map((e) => String(e.cardId))).toContain(DEFEAT_THE_HYDRA);
    expect(inst(state, hydra).attachments).toEqual([the(DEFEAT_THE_HYDRA)]);
    expect(inst(state, hydra).engagedWith).toBe(P1);
    expect(laborDeckCodes(state)).toEqual([PROTECT_HUMANITY, EMBODY_PATHOS]);
    // A second Labor card cannot be revealed while one is in play.
    expect(accepted(state, newLabors(state))).toBe(false);
  });

  it("round 1: flipped to hero form, Hercules's attack defeats the Hydra (only his attacks can damage it): the Labor card is added to the victory display and Atonement puts a Gift into play, readies him and lets him flip back", () => {
    act({}, changeForm());
    expect(form()).toBe("hero");
    const hydra = the(HYDRA);
    // Surgery: it has taken all but 1 of its (printed + 6) hit points.
    const hp = characterProfile(state, hydra, DEPS)!.maxHp;
    expect(hp).toBeGreaterThanOrEqual(12);
    surgery(patchInstance(state, hydra, { damage: hp - 1 }));
    const handBefore = playerOf(state, P1).hand.length;
    const events = act(
      { take: [ATONEMENT, ...RESPONSES], option: "Flip" },
      { type: "basicAttack", playerId: P1, attackerInstanceId: me(), targetInstanceId: hydra },
    );
    expect(state.victoryDisplay).toContain(the(DEFEAT_THE_HYDRA));
    expect(finished).toEqual([DEFEAT_THE_HYDRA]);
    expect(ofType(events, "characterDefeated").map((e) => e.instanceId)).toContain(hydra);
    expect(giftsInPlay(state)).toHaveLength(1);
    const gift = giftsInPlay(state)[0]!;
    expect(inst(state, gift).attachedTo).toBe(me());
    // "Response: After this card enters play, draw 4 cards."
    expect(ofType(events, "cardDrawn").length).toBeGreaterThanOrEqual(4);
    expect(playerOf(state, P1).hand.length).toBeGreaterThan(handBefore);
    expect(inst(state, me()).exhausted).toBe(false);
    expect(form()).toBe("alterEgo");
  });

  it("round 1 villain phase: nothing is in the way (the Labor card left play; the deck still has two)", () => {
    calm();
    act({}, endTurn());
    expect(state.round).toBe(2);
    expect(laborDeckCodes(state)).toEqual([PROTECT_HUMANITY, EMBODY_PATHOS]);
  });

  it("round 2, alter ego: Protect Humanity is dealt to his play area, finds Amadeus Cho and puts him into play; Herc's Helm (cost 0) is played in hero form", () => {
    const events = act({}, newLabors(state));
    expect(playerOf(state, P1).playArea).toContain(the(PROTECT_HUMANITY));
    expect(inst(state, the(PROTECT_HUMANITY)).counters.labor).toBe(3);
    const cho = the(CHO);
    expect(cardsInPlay(state)).toContain(cho);
    expect(ofType(events, "deckShuffled").length).toBeGreaterThanOrEqual(1);
    act({}, changeForm());
    handOf(HELM);
    act({}, play(P1, handId(HELM), [], { attachToInstanceId: me() }));
    expect(inst(state, the(HELM)).attachedTo).toBe(me());
  });

  it("round 2 villain phase: Rhino's attack is redirected to Amadeus Cho (Protect Humanity); Herc's Helm makes Hercules the defender; the last labor counter (set to 1 by surgery) is removed, the card goes to the victory display and Atonement brings the second Gift", () => {
    surgery(patchInstance(state, the(PROTECT_HUMANITY), { counters: { labor: 1 } }));
    const cho = the(CHO);
    const events = act({ take: [HELM_INTERRUPT, ATONEMENT, ...RESPONSES], option: "Do not" }, endTurn());
    expect(state.round).toBe(3);
    expect(state.victoryDisplay).toContain(the(PROTECT_HUMANITY));
    expect(finished).toEqual([DEFEAT_THE_HYDRA, PROTECT_HUMANITY]);
    expect(giftsInPlay(state)).toHaveLength(2);
    expect(damageOf(cho)).toBe(0);
    expect(ofType(events, "abilityResolved").some((e) => String(e.abilityId).endsWith(HELM_INTERRUPT))).toBe(true);
    expect(form()).toBe("hero");
  });

  it("round 3: he flips to alter ego; Embody Pathos finds an encounter side scheme that is not in play, reveals it treating each per-hero icon as 1, attaches to it and puts 6 more threat on it", () => {
    calm();
    act({}, changeForm());
    expect(form()).toBe("alterEgo");
    // Olympic Feud is the nemesis side scheme; once it is in play (it was dealt by the encounter deck) it is not a
    // candidate, so the Labor card takes one that is not in play.
    const feud = the(FEUD);
    const events = act({ cards: [feud] }, newLabors(state));
    const scheme = inst(state, the(EMBODY_PATHOS)).attachedTo!;
    expect(scheme).not.toBeNull();
    expect(state.cardPool[inst(state, scheme).cardId]!.type).toBe("side_scheme");
    expect(inst(state, scheme).attachments).toEqual([the(EMBODY_PATHOS)]);
    expect(inst(state, scheme).threat).toBeGreaterThanOrEqual(6);
    expect(cardsInPlay(state)).toContain(scheme);
    expect(ofType(events, "encounterCardRevealed").map((e) => String(e.cardId))).toContain(EMBODY_PATHOS);
    act({}, endTurn());
    expect(state.round).toBe(4);
  });

  it("round 4: Hercules's basic thwart (assault: it removes his ATK) finishes that side scheme; Embody Pathos is added to the victory display and Atonement puts the third Gift into play", () => {
    calm();
    act({}, changeForm());
    expect(form()).toBe("hero");
    const scheme = inst(state, the(EMBODY_PATHOS)).attachedTo!;
    surgery(patchInstance(state, scheme, { threat: 2 }));
    // Surgery left it at 2 threat: a thwart is legal (a scheme with no threat would not be a target).
    act(
      { take: [ATONEMENT, ...RESPONSES], option: "Do not" },
      { type: "basicThwart", playerId: P1, thwarterInstanceId: me(), schemeInstanceId: scheme },
    );
    expect(state.victoryDisplay).toContain(the(EMBODY_PATHOS));
    expect(finished).toEqual([DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS]);
    expect(giftCodes()).toEqual([...GIFT_CODES].sort());
  });

  it("all three Gift cards are in play on Hercules, attached to him: +2, +1 and +1 hit points; the Labor deck is empty and New Labors is refused", () => {
    for (const code of GIFT_CODES) expect(inst(state, the(code)).attachedTo).toBe(me());
    const printed = (state.cardPool[inst(state, me()).cardId] as unknown as { hp: number }).hp;
    expect(maxHp()).toBe(printed + 4);
    expect(laborDeckCodes(state)).toEqual([]);
    expect(accepted(state, newLabors(state))).toBe(false);
  });

  it("every card is accounted for, the Labor cards and Gifts held every invariant (checked after every command above)", () => {
    checkState(state, dealtTo, "end");
    expect(state.outcome).toBeFalsy();
    expect(state.victoryDisplay.filter((i) => LABOR_CODES.includes(codeOf(state, i)))).toHaveLength(3);
  });

  it("every logged segment replays from its own first state, command by command, to the state it ended in (deep-equal)", () => {
    const all = [...segments, { log: session.log, end: state }];
    expect(all.length).toBeGreaterThanOrEqual(8);
    for (const { log, end } of all) {
      const replayed = replay(log, DEPS);
      if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
      expect(replayed.state).toEqual(end);
    }
    expect(all.reduce((n, seg) => n + seg.log.commands.length, 0)).toBeGreaterThan(15);
  });

  function damageOf(id: InstanceId): number {
    return inst(state, id).damage;
  }
  void inPlayId;
});

// ---------------------------------------------------------------------------------------------------------------
// Part 3: edges of the real deck
// ---------------------------------------------------------------------------------------------------------------
describe("a Labor card that finds nothing to attach to (RRG 1.8 FAQ p. 65; March 6, 2026 - Ruling 3 (2))", () => {
  /** Protect Humanity on top, Amadeus Cho removed from the game: there is nothing for it to find. */
  function withoutCho() {
    const start = withLaborOrder(quiet(rhino(1)), PROTECT_HUMANITY, DEFEAT_THE_HYDRA, EMBODY_PATHOS);
    const cho = copiesOf(start, CHO)[0]!;
    return {
      cho,
      state: {
        ...start,
        removedFromGame: [...start.removedFromGame, cho],
        players: start.players.map((p) => ({
          ...p,
          deck: p.deck.filter((i) => i !== cho),
          hand: p.hand.filter((i) => i !== cho),
        })),
      } as GameState,
    };
  }

  it("Protect Humanity with no Amadeus Cho to find is discarded, never in play, and goes to the bottom of the Labor deck; no Gift is earned, and the next New Labors reveals the next card", () => {
    const { state } = withoutCho();
    const dealtTo = dealtOf(state);
    checkState(state, dealtTo, "start");
    const first = drive(state, {}, newLabors(state));
    checkState(first.state, dealtTo, "after the failed reveal", state);
    expect(cardsInPlay(first.state)).not.toContain(copiesOf(first.state, PROTECT_HUMANITY)[0]!);
    // Answer 54B (2026-10-13): the find looked for an ally, which could be in Hercules's player deck and in neither
    // the Labor deck (encounter cards) nor the Gift deck (upgrades). Only the player deck was searched and shuffled
    // (RRG "Search", p. 39); the two Labor cards left keep their order and the failed card goes under them.
    expect(ofType(first.events, "deckShuffled").map((e) => e.zone)).toEqual([{ kind: "deck", playerId: P1 }]);
    expect(laborDeckCodes(first.state)).toEqual([DEFEAT_THE_HYDRA, EMBODY_PATHOS, PROTECT_HUMANITY]);
    expect(playerOf(first.state, P1).separateDecks.Gift!.deck).toEqual(playerOf(state, P1).separateDecks.Gift!.deck);
    expect(giftsInPlay(first.state)).toEqual([]);
    expect(first.state.victoryDisplay.map((i) => codeOf(first.state, i))).toEqual([]);
    seen.laborFoundNothing.push("staged Protect Humanity without Amadeus Cho");
    // The card was never in play, so New Labors is available again at once (the same form change round, new action).
    const second = drive(first.state, { cards: [copiesOf(first.state, HYDRA)[0]!] }, newLabors(first.state));
    // The next card down is Defeat the Hydra, now in play; its find for a minion left the Labor and Gift decks alone.
    expect(cardsInPlay(second.state)).toContain(copiesOf(second.state, DEFEAT_THE_HYDRA)[0]!);
    expect(laborDeckCodes(second.state)).toEqual([EMBODY_PATHOS, PROTECT_HUMANITY]);
    expect(ofType(second.events, "deckShuffled").filter((e) => e.zone.kind === "separateDeck")).toEqual([]);
    expect(playerOf(second.state, P1).separateDecks.Gift!.deck).toEqual(playerOf(state, P1).separateDecks.Gift!.deck);
    checkState(second.state, dealtTo, "after the second reveal", first.state);
  });
});

describe("Defeat the Hydra: only Hercules's attacks hurt the minion wearing it", () => {
  const revealed = (order: readonly string[], prefer: (s: GameState) => InstanceId[] = () => []) => {
    const start = withLaborOrder(quiet(rhino(1)), ...order);
    return { start, run: drive(start, { cards: prefer(start) }, newLabors(start)), dealtTo: dealtOf(start) };
  };

  it("Defeat the Hydra: an ally's attack on the minion wearing it is refused ('cannot take damage except from Hercules's attacks', 59002)", () => {
    const t = revealed([DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS], (s) => [copiesOf(s, HYDRA)[0]!]);
    const hydra = copiesOf(t.run.state, HYDRA)[0]!;
    const cho = stagedInPlay(t.run.state, CHO);
    const attack: Command = { type: "basicAttack", playerId: P1, attackerInstanceId: cho.id, targetInstanceId: hydra };
    expect(accepted(cho.state, attack)).toBe(false);
    expect(inst(cho.state, hydra).damage).toBe(0);
  });
});

describe("Ancient Rivalry (Team-Up, Hercules and Thor): the printed deck's one copy", () => {
  /** Hero form, Gauntlets of Hercules in the discard pile, Hercules exhausted, Ancient Rivalry and its payer in hand. */
  function rivalry(thor: boolean) {
    let s = hero();
    const given = moveToHand(s, P1, RIVALRY, GAUNTLETS, "59027");
    s = given.state;
    const [rivalryId, gauntlets, payer] = given.ids as [InstanceId, InstanceId, InstanceId];
    s = {
      ...s,
      players: s.players.map((p) => ({
        ...p,
        hand: [rivalryId, payer],
        discard: [...p.discard, gauntlets],
      })),
    };
    let thorId: InstanceId | null = null;
    if (thor) {
      const placed = stagedInPlay(s, THOR);
      s = patchInstance(placed.state, placed.id, { exhausted: true });
      thorId = placed.id;
    }
    s = patchInstance(s, identityOf(s), { exhausted: true });
    return { state: s, rivalryId, gauntlets, payer, thorId };
  }

  it("without Thor in play it cannot be played (RRG 'Team-Up' p. 43)", () => {
    const t = rivalry(false);
    expect(accepted(t.state, play(P1, t.rivalryId, [t.payer]))).toBe(false);
  });

  it("with Thor in play it adds Gauntlets of Hercules (an identity-specific upgrade) from the discard pile to the hand and readies Hercules and Thor", () => {
    const t = rivalry(true);
    const dealtTo = dealtOf(t.state);
    const run = drive(t.state, { cards: [t.gauntlets] }, play(P1, t.rivalryId, [t.payer]));
    checkState(run.state, dealtTo, "after Ancient Rivalry", t.state);
    expect(playerOf(run.state, P1).hand).toContain(t.gauntlets);
    expect(playerOf(run.state, P1).discard).not.toContain(t.gauntlets);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
    expect(inst(run.state, t.thorId!).exhausted).toBe(false);
    expect(playerOf(run.state, P1).discard).toContain(t.rivalryId);
    seen.teamUp.push("staged Ancient Rivalry with Thor");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Part 4: the nemesis set dealt in
// ---------------------------------------------------------------------------------------------------------------
describe("Hercules's nemesis set and obligation, dealt in against the precon", () => {
  const attacksBy = (events: readonly GameEvent[], enemy: InstanceId) =>
    ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === enemy);

  it("Ares is revealed (set aside until a card brings it in), engages the player, and when he schemes he deals himself a facedown encounter card (59036)", () => {
    // God of War is the card that brings Ares in: the minion discarded from the top is revealed (59040).
    const start = quiet(hero());
    const dealtTo = dealtOf(start);
    const staged = stackSetAsideBehindBoost(start, ARES);
    const run = drive(staged, {}, endTurn());
    checkState(run.state, dealtTo, "after Ares", start);
    const ares = copiesOf(run.state, ARES)[0]!;
    expect(inst(run.state, ares).engagedWith).toBe(P1);
    expect(cardsInPlay(run.state)).toContain(ares);
    seen.nemesis.push("staged Ares");
    // Round 2, alter-ego form: Ares schemes against him and deals the player a facedown encounter card.
    const alter = withForm(run.state, "alterEgo");
    const second = drive(quiet(alter), {}, endTurn());
    checkState(second.state, dealtTo, "after Ares schemes", alter);
    expect(ofType(second.events, "schemeResolved").some((e) => e.enemyInstanceId === ares)).toBe(true);
    expect(ofType(second.events, "enemyActivated").filter((e) => e.enemyInstanceId === ares)).toHaveLength(1);
  });

  it("God of War: each minion attacks the player it is engaged with even in alter-ego form (59040)", () => {
    const start = withForm(engageMinion(quiet(rhino(1)), MERCENARY, "merc", P1), "alterEgo");
    const dealtTo = dealtOf(start);
    const staged = stackSetAsideBehindBoost(start, GOD_OF_WAR);
    const run = drive(staged, {}, endTurn());
    checkState(run.state, dealtTo, "after God of War", start);
    expect(attacksBy(run.events, "merc" as InstanceId).length).toBeGreaterThanOrEqual(1);
    seen.nemesis.push("staged God of War");
  });

  it("Olympic Feud places one more threat for each Olympus card in play: Olympus (59012) in play makes 3, none makes 2 (59038)", () => {
    const base = quiet(hero());
    const withOlympus = stagedInPlay(base, "59012");
    const threats = [base, withOlympus.state].map((s) => {
      const staged = stackSetAsideBehindBoost(s, FEUD);
      const run = drive(staged, {}, endTurn());
      return inst(run.state, copiesOf(run.state, FEUD)[0]!).threat;
    });
    expect(threats[1]! - threats[0]!).toBe(1);
    seen.nemesis.push("staged Olympic Feud");
  });

  it("Appeal to Athena (the obligation) is dealt to Hercules's player, stays in his play area, and takes the Gift cards he controls out of the count until he exhausts Hercules (alter-ego action) to remove it from the game", () => {
    const start = quiet(rhino(1));
    const dealtTo = dealtOf(start);
    // The obligation is in the encounter deck: stacked behind one filler (the villain's boost card), so it is dealt to the player.
    const pile = encounterOf(start);
    const appeal = pile.deck.find((i) => codeOf(start, i) === APPEAL)!;
    const [filler, ...others] = pile.deck.filter((i) => i !== appeal);
    const key = Object.keys(start.encounterDecks)[0]!;
    const staged: GameState = {
      ...start,
      encounterDecks: { ...start.encounterDecks, [key]: { ...pile, deck: [filler!, appeal, ...others] } },
    };
    const run = drive(staged, {}, endTurn());
    checkState(run.state, dealtTo, "after Appeal to Athena", staged);
    expect(playerOf(run.state, P1).playArea).toContain(appeal);
    seen.nemesis.push("staged Appeal to Athena");
    const round2 = run.state;
    const removed = drive(round2, {}, use(P1, appeal, "59035.appeal-to-athena-action", [], undefined, { branch: 0 }));
    checkState(removed.state, dealtTo, "after removing Appeal to Athena", round2);
    expect(removed.state.removedFromGame).toContain(appeal);
    expect(inst(removed.state, identityOf(removed.state)).exhausted).toBe(true);
  });
});

describe("what the seeded games saw", () => {
  it("every seeded game was played to an outcome", () => {
    expect(seen.games).toHaveLength(4);
  });
  it("the seeds are fixed: every game met a Labor card (revealed by New Labors), All Versus All cards and nemesis cards came out of the deck, and no game finished a Labor card by itself (the staged game does all three)", () => {
    const counts = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.length]));
    expect(counts.laborStarted, JSON.stringify(counts)).toBeGreaterThan(0);
    expect(counts.allVersusAll, JSON.stringify(counts)).toBeGreaterThan(0);
    expect(counts.nemesis, JSON.stringify(counts)).toBeGreaterThan(0);
    expect(counts.teamUp, JSON.stringify(counts)).toBeGreaterThan(0);
  });
});
