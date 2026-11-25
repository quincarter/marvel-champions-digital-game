/**
 * Competitive card audit, group 5 (docs/competitive-card-audit.md section 5): widely played pool cards whose responses
 * or interrupts can fire during the other team's phases, in a real two-team game (`./two-team.ts`). p1 (registration)
 * faces leader one in area one; p2 (resistance) faces leader two in area two. Round: p1 hero, p2 hero, p1's villain
 * phase (leader one acts on p1's team), p2's villain phase. "Inactive" = the team whose segment is not being played:
 * its forced and triggered abilities fire and it answers choices, but it takes no actions (Q11 / Q11+).
 *
 * Sources: MC56 p. 16 ("Card abilities on your side of the table completely ignore cards on the other side of the
 * table unless they specifically refer to them"; "enemy" is the leader you are fighting and the minions on your side;
 * "the villain" and "the enemy leader" are the leader in your area; "attacks you" needs the attack to be against you),
 * p. 17 ("Cards in your opponent's game area are not in play in your game area"), pp. 16-17, 20 (scenario rules
 * override RRG per Golden Rule, RRG p. 4); owner decisions Q3 B, Q11, N8, N11 of docs/competitive-mode-plan.md section
 * 1.10 (a leader attacking a leader is heard as "when an enemy attacks" only by the team whose area holds the attacker,
 * never as "attacks you"; phase and round events are heard by the active team's area, and the round ends once, after
 * phase 4). A "fires" test shows the card firing while its team is inactive; a "ignores" test shows it NOT firing for
 * something in the other area, beside a control that it does fire for its own area.
 */

import { cardId } from "@mc/content";
import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { firstLegal, inst, playerOf, type Picker } from "../../../../testing/harness.js";
import {
  P1,
  P2,
  acceptAll,
  boost,
  cooperativeGame,
  endTurn,
  everyTypeResource,
  give,
  intoPlay,
  leadersOf,
  patch,
  play,
  realCards,
  run,
  schemesOf,
  twoTeamGame,
  typedResource,
} from "./two-team.js";

vi.setConfig({ testTimeout: 120_000 });

const GAMBITS_STAFF = "37004";
const BISHOP = "37011";
const BACKFLIP = "01003";
const WARNING = "09021";
const WEBBED_UP = "01009";
const GREAT_RESPONSIBILITY = "01061";
const COUNTERINTELLIGENCE = "08017";
const NICK_FURY = "01084";
const ENHANCED_SPIDER_SENSE = "01004";
const BLACK_WIDOW = "01075";
const EMERGENCY = "01085";
const FIGHTING_DIRTY = "56208";
const DOUBLE_AGENT = "56211";
const RIGHTEOUS_CAUSE = "56125";

const POOL = [
  GAMBITS_STAFF,
  BISHOP,
  BACKFLIP,
  WARNING,
  WEBBED_UP,
  GREAT_RESPONSIBILITY,
  COUNTERINTELLIGENCE,
  NICK_FURY,
  ENHANCED_SPIDER_SENSE,
  BLACK_WIDOW,
  EMERGENCY,
  FIGHTING_DIRTY,
  DOUBLE_AGENT,
  RIGHTEOUS_CAUSE,
];
const NB = boost("nb", 0);
const NB_ID = NB.id as string;
/** A resource that pays for anything: one icon of each type. */
const WILD = everyTypeResource("res-wild");
const WILD_ID = WILD.id as string;
/** Pays for Fighting Dirty without [physical], so the card does not stun leader two as well. */
const ENERGY = typedResource("res-energy", "energy");
const ENERGY_ID = ENERGY.id as string;

interface Prompt {
  readonly player: string;
  readonly codes: readonly string[];
  /** The card the offered window is about (the revealed card, the attacked character), when the event names one. */
  readonly subject: string;
  /** The player the event names (`playerId`: the revealing player of a reveal), when it names one. */
  readonly eventPlayer: string;
  /** The attacking enemy of an attack window (`enemyInstanceId`, else `attackerInstanceId`), when the event names one. */
  readonly attacker: string;
}
/** Every optional-trigger prompt shown during a run: who was asked and which cards were offered. */
type Log = Prompt[];

/**
 * Accepts every optional trigger `accept` allows (default all; every prompt is logged), pays with every-type resources
 * first, else the first legal option.
 */
function picker(log: Log, accept: (prompt: Prompt) => boolean = () => true): Picker {
  return (s) => {
    const choice = s.pendingChoice!;
    const codeOfInstance = (id: InstanceId) => s.instances[id]?.cardId as string | undefined;
    const codeOf = (o: (typeof choice.options)[number]) =>
      o.ref.kind === "card" || o.ref.kind === "ability" ? (codeOfInstance(o.ref.instanceId) ?? "?") : "?";
    if (choice.prompt.kind === "chooseTriggers") {
      const event = choice.prompt.event as unknown as Record<string, InstanceId | undefined>;
      const subjectId = event.instanceId ?? event.cardInstanceId ?? event.targetInstanceId ?? event.schemeInstanceId;
      const prompt: Prompt = {
        player: choice.playerId as string,
        codes: choice.options.map(codeOf),
        subject: (subjectId ? codeOfInstance(subjectId) : undefined) ?? "?",
        eventPlayer: (event.playerId as string | undefined) ?? "?",
        attacker: codeOfInstance((event.enemyInstanceId ?? event.attackerInstanceId)!) ?? "?",
      };
      log.push(prompt);
      return accept(prompt) ? choice.options.map((o) => o.optionId as string) : [];
    }
    if (choice.prompt.kind === "payForCard" || choice.prompt.kind === "payForAbility") {
      const wild = choice.options.filter((o) => codeOf(o) === WILD_ID);
      const rest = choice.options.filter((o) => codeOf(o) !== WILD_ID);
      return [...wild, ...rest].slice(0, choice.prompt.cost).map((o) => o.optionId as string);
    }
    return acceptAll(s);
  };
}
/** How many times `player` was offered `code` against an attack by the enemy with code `attacker`. */
const offeredAgainst = (log: Log, player: string, code: string, attacker: string) =>
  log.filter((p) => p.player === player && p.codes.includes(code) && p.attacker === attacker).length;
const offered = (log: Log, player: string, code: string, subject?: string) =>
  log.filter((p) => p.player === player && p.codes.includes(code) && (subject === undefined || p.subject === subject))
    .length;
const never: (prompt: Prompt) => boolean = () => false;

function game(options: { deckOne?: readonly string[]; deckTwo?: readonly string[] } = {}) {
  return twoTeamGame({
    ...options,
    filler: NB,
    extraCards: [WILD, ENERGY, ...realCards(...POOL)],
    seatCards: [...POOL, ENERGY_ID, ENERGY_ID, ENERGY_ID, ...Array.from({ length: 10 }, () => WILD_ID)],
  });
}
type Game = ReturnType<typeof game>;

/** p2's hero turn: p1 has ended its own. */
const toResistance = (g: Game) => run(g.deps, g.state, firstLegal, endTurn(P1)).state;

/** `copies` of `code` and `wild` wild resources into the hand of `player` (surgery). */
function hold(state: GameState, player: typeof P1 | typeof P2, code: string, copies = 1, wild = 4): GameState {
  let current = state;
  const taken: InstanceId[] = [];
  for (let i = 0; i < copies; i += 1) {
    const next = give(current, player, code, taken);
    taken.push(next.id);
    current = next.state;
  }
  const paid: InstanceId[] = [];
  for (let i = 0; i < wild; i += 1) {
    const next = give(current, player, WILD_ID, paid);
    paid.push(next.id);
    current = next.state;
  }
  return current;
}

/** Puts `code` into `player`'s play area (surgery); `attachTo` hosts it (an upgrade on a character). */
function inPlay(state: GameState, player: typeof P1 | typeof P2, code: string): { state: GameState; id: InstanceId } {
  return intoPlay(state, player, code);
}

/** Puts a card of `player` onto `host` as an attachment (surgery). */
function attach(state: GameState, player: typeof P1 | typeof P2, code: string, host: InstanceId) {
  const card = give(state, player, code);
  const id = card.id;
  const seat = playerOf(card.state, player);
  return {
    id,
    state: {
      ...card.state,
      players: card.state.players.map((p) =>
        p.playerId === player ? { ...p, hand: seat.hand.filter((i) => i !== id) } : p,
      ),
      instances: {
        ...card.state.instances,
        [id]: { ...card.state.instances[id]!, attachedTo: host, faceup: true, controllerId: player },
        [host]: { ...card.state.instances[host]!, attachments: [...card.state.instances[host]!.attachments, id] },
      },
    } as GameState,
  };
}

/** p2 plays Fighting Dirty (leader one, p2's "your leader", attacks leader two): the leader-vs-leader attack. */
function fightingDirty(g: Game, state: GameState, pick: Picker) {
  const dirty = give(state, P2, FIGHTING_DIRTY);
  const first = give(dirty.state, P2, ENERGY_ID);
  const second = give(first.state, P2, ENERGY_ID, [first.id]);
  return run(g.deps, second.state, pick, play(P2, dirty.id, [first.id, second.id]));
}
const asAlterEgo = (state: GameState): GameState =>
  ({
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" } })),
  }) as GameState;

const identityOf = (state: GameState, player: typeof P1 | typeof P2): InstanceId =>
  playerOf(state, player).identity.instanceId;
const damageOf = (state: GameState, player: typeof P1 | typeof P2) => inst(state, identityOf(state, player)).damage;
const inDiscard = (state: GameState, player: typeof P1 | typeof P2, id: InstanceId) =>
  playerOf(state, player).discard.includes(id);

describe("Gambit's Staff (37004), Hero Interrupt: when an enemy attacks, exhaust it -> 1 damage to that enemy", () => {
  it("fires in p2's hero phase while p1 is inactive: leader one (p1's enemy) attacks leader two, and takes 1", () => {
    const g = game();
    const { one, two } = leadersOf(g.state);
    const staff = inPlay(toResistance(g), P1, GAMBITS_STAFF);
    const log: Log = [];
    const { state } = fightingDirty(g, staff.state, picker(log));
    expect(offered(log, "p1", GAMBITS_STAFF)).toBe(1);
    expect(inst(state, two).damage).toBe(2);
    expect(inst(state, one).damage).toBe(1);
    expect(inst(state, staff.id).exhausted).toBe(true);
  });

  it("ignores it for p2's staff: leader one is not an enemy of p2's side, so it is not heard (MC56 p. 16)", () => {
    const g = game();
    const { one } = leadersOf(g.state);
    const staff = inPlay(toResistance(g), P2, GAMBITS_STAFF);
    const log: Log = [];
    const { state } = fightingDirty(g, staff.state, picker(log));
    expect(offered(log, "p2", GAMBITS_STAFF)).toBe(0);
    expect(inst(state, one).damage).toBe(0);
  });
});

describe("Bishop (37011), Response: after an enemy attacks you, place 1 energy counter here", () => {
  it("ignores leader one attacking leader two in p2's hero phase (not an attack on p1), fires on the attack on p1", () => {
    const g = game();
    const bishop = inPlay(toResistance(g), P1, BISHOP);
    const log: Log = [];
    const cross = fightingDirty(g, bishop.state, picker(log));
    expect(offered(log, "p1", BISHOP)).toBe(0);
    expect(inst(cross.state, bishop.id).counters.energy ?? 0).toBe(0);
    // Control: p2 ends its turn, and leader one attacks p1 in p1's own villain phase.
    const control = run(g.deps, cross.state, picker(log), endTurn(P2));
    expect(offered(log, "p1", BISHOP)).toBe(1);
    expect(inst(control.state, bishop.id).counters.energy).toBe(1);
  });
});

describe("Backflip (01003), Interrupt (defense): when you would take damage from an attack, prevent it", () => {
  it("control: offered for the attack on p1 in p1's own villain phase, and prevents it", () => {
    const g = game();
    const log: Log = [];
    const { state } = run(g.deps, hold(toResistance(g), P1, BACKFLIP), picker(log), endTurn(P2));
    expect(offered(log, "p1", BACKFLIP)).toBe(1);
    expect(damageOf(state, P1)).toBe(0);
  });

  it("ignores every attack that is not on p1: not offered for leader one's attack on leader two or leader two's on p2", () => {
    const g = game();
    // p1 declines in its own phase, so the one copy would be offered again if the other team's attacks offered it.
    const held = hold(toResistance(g), P1, BACKFLIP);
    const log: Log = [];
    const cross = fightingDirty(g, held, picker(log, never));
    expect(offered(log, "p1", BACKFLIP)).toBe(0);
    const { state } = run(g.deps, cross.state, picker(log, never), endTurn(P2));
    expect(offered(log, "p1", BACKFLIP)).toBe(1);
    expect(damageOf(state, P1)).toBe(2);
    expect(damageOf(state, P2)).toBe(2);
  });
});

describe("Warning (09021), Interrupt: when a hero would take damage, reduce that amount by 1", () => {
  it("control: offered for p1's hero in p1's phase and reduces the attack from 2 to 1", () => {
    const g = game();
    const log: Log = [];
    const { state } = run(g.deps, hold(toResistance(g), P1, WARNING), picker(log), endTurn(P2));
    expect(offered(log, "p1", WARNING)).toBe(1);
    expect(damageOf(state, P1)).toBe(1);
  });

  it("ignores p2's hero in p2's villain phase (MC56 pp. 16-17): p1 is asked once, for its own, never for leader two's attack", () => {
    const g = game();
    const log: Log = [];
    const { state } = run(g.deps, hold(toResistance(g), P1, WARNING), picker(log, never), endTurn(P2));
    expect(offered(log, "p1", WARNING)).toBe(1);
    expect(damageOf(state, P2)).toBe(2);
  });
});

describe("Webbed Up (01009), Forced Interrupt: when attached enemy would attack, discard this instead, then stun it", () => {
  it("fires in p2's hero phase on a Webbed Up leader one: its attack on leader two is replaced by the discard and a stun", () => {
    const g = game();
    const { one, two } = leadersOf(g.state);
    const webbed = attach(toResistance(g), P1, WEBBED_UP, one);
    const { state, events } = fightingDirty(g, webbed.state, picker([]));
    expect(inDiscard(state, P1, webbed.id)).toBe(true);
    expect(inst(state, one).statuses.stunned).toBe(1);
    expect(inst(state, two).damage).toBe(0);
    expect(
      events.some((e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === one && e.damageDealt > 0),
    ).toBe(false);
  });
});

describe("Great Responsibility (01061), Hero Interrupt: when threat would be placed on a scheme, take it as damage", () => {
  it("is offered to p1 (inactive) when p2's Double Agent places 2 threat on leader one's main scheme, in p1's area", () => {
    const g = game();
    const { one: schemeOne, two: schemeTwo } = schemesOf(g.state);
    const seeded = patch(hold(toResistance(g), P1, GREAT_RESPONSIBILITY), schemeTwo, { threat: 5 });
    const before = inst(seeded, schemeOne).threat;
    const damageBefore = damageOf(seeded, P1);
    const log: Log = [];
    const dealt = give(seeded, P2, DOUBLE_AGENT);
    const first = give(dealt.state, P2, WILD_ID);
    const second = give(first.state, P2, WILD_ID, [first.id]);
    const { state } = run(g.deps, second.state, picker(log), play(P2, dealt.id, [first.id, second.id]));
    expect(offered(log, "p1", GREAT_RESPONSIBILITY)).toBe(1);
    expect(inst(state, schemeOne).threat).toBe(before);
    expect(damageOf(state, P1) - damageBefore).toBe(2);
  });
});

describe("Counterintelligence (08017), Interrupt: when threat would be placed on the main scheme, discard it -> prevent 3", () => {
  /** p2 plays Double Agent: 2 threat on leader one's main scheme (area one). */
  function doubleAgent(g: Game, state: GameState, log: Log) {
    const { two: schemeTwo } = schemesOf(g.state);
    const seeded = patch(state, schemeTwo, { threat: 5 });
    const dealt = give(seeded, P2, DOUBLE_AGENT);
    const first = give(dealt.state, P2, WILD_ID);
    const second = give(first.state, P2, WILD_ID, [first.id]);
    return run(g.deps, second.state, picker(log), play(P2, dealt.id, [first.id, second.id]));
  }

  it("fires for p1's upgrade in p2's hero phase: the threat on p1's own main scheme is prevented, the card discarded", () => {
    const g = game();
    const { one: schemeOne } = schemesOf(g.state);
    const upgrade = inPlay(toResistance(g), P1, COUNTERINTELLIGENCE);
    const before = inst(upgrade.state, schemeOne).threat;
    const log: Log = [];
    const { state } = doubleAgent(g, upgrade.state, log);
    expect(offered(log, "p1", COUNTERINTELLIGENCE)).toBe(1);
    expect(inst(state, schemeOne).threat).toBe(before);
    expect(inDiscard(state, P1, upgrade.id)).toBe(true);
  });

  it("ignores it for p2's upgrade: the threat lands in area one, which p2's cards do not hear (MC56 p. 16)", () => {
    const g = game();
    const { one: schemeOne } = schemesOf(g.state);
    const upgrade = inPlay(toResistance(g), P2, COUNTERINTELLIGENCE);
    const before = inst(upgrade.state, schemeOne).threat;
    const log: Log = [];
    const { state } = doubleAgent(g, upgrade.state, log);
    expect(offered(log, "p2", COUNTERINTELLIGENCE)).toBe(0);
    expect(inst(state, schemeOne).threat).toBe(before + 2);
    expect(playerOf(state, P2).playArea).toContain(upgrade.id);
  });
});

describe("Nick Fury (01084), Forced Response: at the end of the round, if still in play, discard him", () => {
  /** p1 plays Nick Fury in its own hero phase (so his end-of-round effect is set up), then the round runs. */
  function fury() {
    const g = game();
    const given = hold(g.state, P1, NICK_FURY, 1, 4);
    const card = playerOf(given, P1).hand.find((i) => inst(given, i).cardId === NICK_FURY)!;
    const paid = playerOf(given, P1)
      .hand.filter((i) => inst(given, i).cardId === WILD_ID)
      .slice(0, 2);
    const played = run(g.deps, given, picker([]), play(P1, card, paid));
    return { g, card, played };
  }

  // Q3 B / N8: the round ends once, after phase 4, for both teams, so the effect p1's Fury set up fires while p1 is
  // inactive (MC56 p. 16), and not at the end of p1's own villain phase.
  it("p1's Fury, played in p1's hero phase, is discarded when the round ends after phase 4, not before", () => {
    const { g, card, played } = fury();
    expect(playerOf(played.state, P1).playArea).toContain(card);
    const rest = run(g.deps, played.state, picker([]), endTurn(P1));
    const end = run(g.deps, rest.state, picker([]), endTurn(P2));
    const leaders = leadersOf(g.state);
    const events = [...rest.events, ...end.events];
    expect(playerOf(end.state, P1).discard).toContain(card);
    const gone = events.findIndex((e) => e.type === "cardMoved" && e.instanceId === card && e.to.kind === "discard");
    const phaseFour = events
      .map((e) => e.type === "enemyActivated" && e.enemyInstanceId === leaders.two)
      .lastIndexOf(true);
    expect(gone).toBeGreaterThan(phaseFour);
  });

  it("the control: p2's Fury (its team's villain phase is the last of the round) is discarded at round end", () => {
    const g = game();
    const given = hold(toResistance(g), P2, NICK_FURY, 1, 4);
    const card = playerOf(given, P2).hand.find((i) => inst(given, i).cardId === NICK_FURY)!;
    const paid = playerOf(given, P2)
      .hand.filter((i) => inst(given, i).cardId === WILD_ID)
      .slice(0, 2);
    const played = run(g.deps, given, picker([]), play(P2, card, paid));
    const end = run(g.deps, played.state, picker([]), endTurn(P2));
    expect(playerOf(end.state, P2).discard).toContain(card);
  });
});

describe("Enhanced Spider-Sense (01004), Hero Interrupt: when a treachery is revealed, cancel its When Revealed", () => {
  /** Righteous Cause (a treachery whose When Revealed makes the enemy leader scheme) on top of one deck. */
  const scheming = (events: readonly GameEvent[], leader: InstanceId) =>
    events.filter((e) => e.type === "schemeResolved" && e.enemyInstanceId === leader).length;

  it("control: Righteous Cause revealed in p1's area in p1's villain phase is cancelled (leader one does not scheme)", () => {
    const g = game({ deckOne: [NB_ID, RIGHTEOUS_CAUSE] });
    const { one } = leadersOf(g.state);
    const log: Log = [];
    const { events } = run(g.deps, hold(toResistance(g), P1, ENHANCED_SPIDER_SENSE), picker(log), endTurn(P2));
    expect(offered(log, "p1", ENHANCED_SPIDER_SENSE, RIGHTEOUS_CAUSE)).toBe(1);
    expect(scheming(events, one)).toBe(0);
  });

  it("ignores Righteous Cause revealed in p2's area in p2's villain phase: p1 is not asked and leader two schemes", () => {
    const g = game({ deckTwo: [NB_ID, RIGHTEOUS_CAUSE] });
    const { two } = leadersOf(g.state);
    const log: Log = [];
    const held = hold(toResistance(g), P1, ENHANCED_SPIDER_SENSE);
    const { events } = run(g.deps, held, picker(log, never), endTurn(P2));
    expect(offered(log, "p1", ENHANCED_SPIDER_SENSE, RIGHTEOUS_CAUSE)).toBe(0);
    expect(scheming(events, two)).toBe(1);
  });
});

describe("Black Widow (01075), Interrupt: when a card is revealed, exhaust her and spend [mental] -> cancel it", () => {
  const scheming = (events: readonly GameEvent[], leader: InstanceId) =>
    events.filter((e) => e.type === "schemeResolved" && e.enemyInstanceId === leader).length;

  it("control: she is offered for a card revealed in p1's area in p1's phase and cancels it", () => {
    const g = game({ deckOne: [NB_ID, RIGHTEOUS_CAUSE] });
    const { one } = leadersOf(g.state);
    const widow = inPlay(hold(toResistance(g), P1, WILD_ID, 1, 2), P1, BLACK_WIDOW);
    const log: Log = [];
    const { events } = run(g.deps, widow.state, picker(log), endTurn(P2));
    expect(offered(log, "p1", BLACK_WIDOW, RIGHTEOUS_CAUSE)).toBe(1);
    expect(scheming(events, one)).toBe(0);
  });

  // Fixed (audit finding 5): her trigger `encounterCardRevealedFromEncounterDeck()` names no query; the engine now
  // scopes the event itself to the listening card's area (`heardOnThisSide`, resolve/triggers.ts; MC56 pp. 16-17:
  // abilities on your side ignore the other side), as Enhanced Spider-Sense's `query("treachery")` already was.
  it("ignores a card revealed in p2's area in p2's villain phase: p1's Widow is not offered, leader two schemes", () => {
    const g = game({ deckTwo: [NB_ID, RIGHTEOUS_CAUSE] });
    const { two } = leadersOf(g.state);
    const widow = inPlay(hold(toResistance(g), P1, WILD_ID, 1, 2), P1, BLACK_WIDOW);
    const log: Log = [];
    const { events } = run(g.deps, widow.state, picker(log, never), endTurn(P2));
    expect(offered(log, "p1", BLACK_WIDOW, RIGHTEOUS_CAUSE)).toBe(0);
    expect(scheming(events, two)).toBe(1);
  });

  // The area scoping is two-team only: in a cooperative game every seat shares the one game area, so p1's Widow is
  // offered for the card p2 reveals as well as for p1's own.
  it("cooperative control: p1's Widow is offered for the card p2 reveals in the villain phase", () => {
    const g = cooperativeGame({
      players: 2,
      filler: NB,
      extraCards: [WILD, ...realCards(BLACK_WIDOW)],
      seatCards: [BLACK_WIDOW, ...Array.from({ length: 10 }, () => WILD_ID)],
    });
    const widow = inPlay(hold(g.state, P1, WILD_ID, 1, 2), P1, BLACK_WIDOW);
    const log: Log = [];
    run(g.deps, widow.state, picker(log, never), endTurn(P1), endTurn(P2));
    const asked = log.filter((p) => p.player === "p1" && p.codes.includes(BLACK_WIDOW));
    expect(asked.map((p) => p.eventPlayer)).toEqual(["p1", "p2"]);
  });
});

describe("Emergency (01085), Interrupt (thwart): when the villain schemes, reduce the threat placed by 1", () => {
  const schemeOf = (events: readonly GameEvent[], leader: InstanceId) =>
    events.find((e) => e.type === "schemeResolved" && e.enemyInstanceId === leader);

  it("control: offered when leader one (p1's villain) schemes in p1's phase, reducing SCH 1 to 0 threat", () => {
    const g = game();
    const { one } = leadersOf(g.state);
    const log: Log = [];
    const { events } = run(g.deps, hold(asAlterEgo(toResistance(g)), P1, EMERGENCY), picker(log), endTurn(P2));
    expect(offered(log, "p1", EMERGENCY)).toBe(1);
    expect(schemeOf(events, one)).toMatchObject({ threatPlaced: 0 });
  });

  it("ignores leader two's scheme in p2's phase (not 'the villain' for p1, MC56 p. 17): offered once, threat placed in full", () => {
    const g = game();
    const { two } = leadersOf(g.state);
    const log: Log = [];
    const held = hold(asAlterEgo(toResistance(g)), P1, EMERGENCY);
    const { events } = run(g.deps, held, picker(log, never), endTurn(P2));
    expect(offered(log, "p1", EMERGENCY)).toBe(1);
    expect(schemeOf(events, two)).toMatchObject({ threatPlaced: 1 });
  });
});

const ENGINE_TESTING = new URL("../../../../../../engine/src/testing/", import.meta.url).href;
const fixtures = (await import(/* @vite-ignore */ `${ENGINE_TESTING}fixtures.ts`)) as {
  readonly stubMinion: (spec: { id: string; atk: number; sch: number; hp: number; boostIcons?: number }) => never;
  readonly stubAlly: (spec: { id: string; cost: number; atk: number; thw: number; hp: number }) => never;
};

const POWERFUL_PUNCH = "32014";
const SHADOW_AND_STEEL = "32021";
const MINION_ID = "audit-minion";
const MINION = fixtures.stubMinion({ id: MINION_ID, atk: 1, sch: 1, hp: 5, boostIcons: 0 });
/** A Shadowcat ally: the fixture's ally titled "Shadowcat" (a stub's title is its id). */
const SHADOWCAT_ID = "Shadowcat";
const SHADOWCAT = fixtures.stubAlly({ id: SHADOWCAT_ID, cost: 0, atk: 1, thw: 1, hp: 3 });

/**
 * A two-team game whose seats hold Powerful Punch, Shadow and Steel, a Shadowcat ally and Fighting Dirty (with its
 * energy); a minion in deck one.
 */
function defenseGame() {
  return twoTeamGame({
    deckOne: [NB_ID, NB_ID, MINION_ID],
    filler: NB,
    extraCards: [WILD, ENERGY, MINION, SHADOWCAT, ...realCards(POWERFUL_PUNCH, SHADOW_AND_STEEL, FIGHTING_DIRTY)],
    seatCards: [
      POWERFUL_PUNCH,
      SHADOW_AND_STEEL,
      SHADOWCAT_ID,
      FIGHTING_DIRTY,
      ENERGY_ID,
      ENERGY_ID,
      ...Array.from({ length: 10 }, () => WILD_ID),
    ],
  });
}

/** `player`'s hero is Colossus: its identity card retitled (each seat's identity is a card of its own). */
function asColossus(state: GameState, player: typeof P1 | typeof P2): GameState {
  const identity = playerOf(state, player).identity.instanceId;
  const card = state.cardPool[state.instances[identity]!.cardId] as unknown as {
    hero: { faceName: string };
    heroFaces?: readonly { faceName: string }[];
  };
  const retitled = {
    ...card,
    hero: { ...card.hero, faceName: "Colossus" },
    ...(card.heroFaces ? { heroFaces: card.heroFaces.map((face) => ({ ...face, faceName: "Colossus" })) } : {}),
  };
  return { ...state, cardPool: { ...state.cardPool, [state.instances[identity]!.cardId]: retitled } } as GameState;
}

/** p1's hero is Colossus and the minion from deck one is engaged with p1 (surgery). */
function withColossusAndMinion(state: GameState): { state: GameState; minion: InstanceId } {
  const colossus = asColossus(state, P1);
  const { one } = leadersOf(colossus);
  const deckId = colossus.villains.find((v) => v.instanceId === one)!.encounterDeckId;
  const piles = colossus.encounterDecks[deckId]!;
  const minion = piles.deck.find((i) => colossus.instances[i]!.cardId === cardId(MINION_ID))!;
  const next = {
    ...colossus,
    encounterDecks: {
      ...colossus.encounterDecks,
      [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== minion) },
    },
    players: colossus.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, minion] } : p)),
  } as GameState;
  return { state: patch(next, minion, { engagedWith: P1, faceup: true }), minion };
}

// (attack/defense) is a defense too (RRG v1.8 "Labeled Ability" p. 26, multiple labels; FFG July 19, 2023 #49.3 Powerful Punch); MC56 p. 16 "no player can declare a defender" excludes it from leader-vs-leader attacks (N11)
describe("(attack/defense) cards against a leader-vs-leader attack (N11): a defense too, so neither team may use one", () => {
  it("Powerful Punch (32014): not offered to p1 or p2 for leader one's attack on leader two; offered to p1 for leader one's attack on p1", () => {
    const g = defenseGame();
    const leaderOne = inst(g.state, leadersOf(g.state).one).cardId as string;
    const held = hold(hold(toResistance(g), P1, POWERFUL_PUNCH), P2, POWERFUL_PUNCH);
    const log: Log = [];
    const cross = fightingDirty(g, held, picker(log, never));
    expect(offered(log, "p1", POWERFUL_PUNCH)).toBe(0);
    expect(offered(log, "p2", POWERFUL_PUNCH)).toBe(0);
    // Control on the same board: p2 ends its turn, and leader one attacks p1 in p1's own villain phase.
    run(g.deps, cross.state, picker(log, never), endTurn(P2));
    expect(offeredAgainst(log, "p1", POWERFUL_PUNCH, leaderOne)).toBe(1);
  });

  it("Shadow and Steel (32021), Team-Up met (Colossus hero, Shadowcat ally on p1's team): not offered for the leader-vs-leader attack; offered on a minion's attack", () => {
    const g = defenseGame();
    const ready = intoPlay(hold(toResistance(g), P1, SHADOW_AND_STEEL), P1, SHADOWCAT_ID).state;
    const board = withColossusAndMinion(ready);
    const log: Log = [];
    const cross = fightingDirty(g, board.state, picker(log, never));
    expect(offered(log, "p1", SHADOW_AND_STEEL)).toBe(0);
    // Control on the same board: in p1's villain phase the minion engaged with p1 attacks.
    run(g.deps, cross.state, picker(log, never), endTurn(P2));
    expect(offeredAgainst(log, "p1", SHADOW_AND_STEEL, MINION_ID)).toBe(1);
  });
});

// Competitive (MC56 pp. 16, 20): "friendly" = cards your team controls (RRG 1.8 "Friendly" p. 21; "the players" = your
// team); the other side's characters do not satisfy Team-Up (RRG p. 43). Rules expert, 2026-11-20.
describe("Team-Up in competitive play: only your own team's characters are friendly (Shadow and Steel 32021)", () => {
  /** `colossus`'s hero is Colossus, a Shadowcat ally is in `shadowcat`'s play area, and both seats hold Shadow and Steel. */
  function board(colossus: typeof P1 | typeof P2, shadowcat: typeof P1 | typeof P2) {
    const g = defenseGame();
    const held = hold(hold(toResistance(g), P1, SHADOW_AND_STEEL), P2, SHADOW_AND_STEEL);
    return { g, state: asColossus(intoPlay(held, shadowcat, SHADOWCAT_ID).state, colossus) };
  }
  /** Both villain phases (leader one attacks p1, leader two attacks p2); how often each seat was offered the card. */
  function offers(colossus: typeof P1 | typeof P2, shadowcat: typeof P1 | typeof P2) {
    const { g, state } = board(colossus, shadowcat);
    const { one, two } = leadersOf(state);
    const log: Log = [];
    run(g.deps, state, picker(log, never), endTurn(P2));
    return {
      p1: offeredAgainst(log, "p1", SHADOW_AND_STEEL, inst(state, one).cardId as string),
      p2: offeredAgainst(log, "p2", SHADOW_AND_STEEL, inst(state, two).cardId as string),
    };
  }

  it("team one: p1 (Colossus) with a Shadowcat on its own side is offered it when leader one attacks; with p2's Shadowcat it is not", () => {
    expect(offers(P1, P1).p1).toBe(1);
    expect(offers(P1, P2).p1).toBe(0);
  });

  it("team two: p2 (Colossus) with a Shadowcat on its own side is offered it when leader two attacks; with p1's Shadowcat it is not", () => {
    expect(offers(P2, P2).p2).toBe(1);
    expect(offers(P2, P1).p2).toBe(0);
  });
});
