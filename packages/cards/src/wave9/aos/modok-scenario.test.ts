import { AOS_CARDS, CORE_CARDS } from "@mc/content";
import {
  applyCommand,
  createGame,
  hasKeyword,
  keywordTotal,
  keywordsOf,
  mainSchemeValue,
  maxHitPoints,
  remainingHitPoints,
  statBonus,
  traitsOf,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../dsl/index.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { wave9Scenario } from "../setup.js";
import { IRON_MAN, SPIDER_MAN, codeOf, piles } from "../testing.js";
import { MODOK } from "./modok.js";
import { SCIENTIST_SUPREME } from "./scientist-supreme.js";

vi.setConfig({ testTimeout: 300_000 });

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, MODOK, SCIENTIST_SUPREME) };

// ---------------------------------------------------------------------------------------------------------------
// A small driver (the same shape as batroc-scenario.test.ts)
// ---------------------------------------------------------------------------------------------------------------

interface Sim {
  state: GameState;
  log: GameEvent[];
}

interface Plan {
  /** An optional trigger whose id contains this text is taken; every other optional trigger is declined. */
  readonly take?: string;
  readonly option?: string;
  readonly target?: InstanceId;
  readonly player?: PlayerId;
  /** The defender declared when a `declareDefender` prompt is offered; absent: no defender. */
  readonly defender?: InstanceId;
  /** Defenders in order of preference: the first one offered by the prompt defends (a ready character is not offered twice). */
  readonly defenders?: readonly InstanceId[];
}

const planner =
  (plan: Plan): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options;
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const hit = plan.take ? offered.find((o) => (o.optionId as string).includes(plan.take!)) : undefined;
        return hit ? [hit.optionId] : [];
      }
      case "declareDefender": {
        const wanted = plan.defenders ?? (plan.defender ? [plan.defender] : []);
        const hit = wanted
          .map((id) => offered.find((o) => o.ref.kind === "card" && o.ref.instanceId === id))
          .find((o) => o !== undefined);
        return hit ? [hit.optionId] : ["decline"];
      }
      case "chooseOption": {
        const hit = plan.option ? offered.find((o) => o.label.startsWith(plan.option!)) : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "chooseTarget": {
        const hit = plan.target ? offered.find((o) => (o.optionId as string) === plan.target) : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "choosePlayer": {
        const hit = plan.player
          ? offered.find((o) => o.ref.kind === "player" && o.ref.playerId === plan.player)
          : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      default:
        return firstLegal(s);
    }
  };

type Seat = typeof SPIDER_MAN | typeof IRON_MAN;

interface OpenOptions {
  readonly seed?: number;
  readonly difficulty?: "standard" | "expert";
  readonly firstPlayerIndex?: number;
}

/** The real `modok` scenario past setup (to the first player turn). */
function open(players: readonly Seat[], options: OpenOptions = {}): Sim {
  const config = wave9Scenario("modok", {
    players,
    seed: options.seed ?? 1,
    ...(options.difficulty ? { difficulty: options.difficulty } : {}),
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return { state: settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS), log: [] };
}

/** Runs commands, answering each prompt by `plan`, and returns only the events they produced. */
function act(sim: Sim, plan: Plan, ...commands: readonly Command[]): GameEvent[] {
  const r = driveEventsPicking(DEPS, sim.state, planner(plan), ...commands);
  sim.state = r.state;
  sim.log = [...sim.log, ...r.events];
  return [...r.events];
}

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const give = (sim: Sim, player: PlayerId, ...codes: string[]) => {
  sim.state = moveToHand(sim.state, player, ...codes).state;
};
const stack = (sim: Sim, ...codes: string[]) => {
  sim.state = stackEncounterDeck(sim.state, ...codes);
};
const handOf = (sim: Sim, code: string, player: PlayerId = P1): InstanceId[] =>
  playerOf(sim.state, player).hand.filter((i) => codeOf(sim.state, i) === code);
const nameOfCode = (code: string): string => [...AOS_CARDS, ...CORE_CARDS].find((c) => c.id === code)!.name;

/** The error a command would be rejected with, or null when it is legal (the state is not changed). */
const rejection = (sim: Sim, command: Command): string | null => {
  const r = applyCommand(sim.state, command, DEPS);
  return r.ok ? null : r.error.code;
};

const DECK = "Holding Cell";
const CELLS = ["50105a", "50106a", "50107a", "50108a"] as const;
/** Core upgrades / supports with a single resource icon each: the "3 resources of any type" fodder. */
const FODDER = ["01007", "01008", "01009", "01063", "01064", "01065"];

const villainOf = (sim: Sim): InstanceId => sim.state.villains[0]!.instanceId;
const mainOf = (sim: Sim): InstanceId => sim.state.mainScheme.instanceId;
const mainThreat = (sim: Sim): number => inst(sim.state, mainOf(sim)).threat;
const damageOn = (sim: Sim, id: InstanceId): number => inst(sim.state, id).damage;
const hpLeft = (sim: Sim, id: InstanceId): number => remainingHitPoints(sim.state, id, DEPS)!;
const cellOf = (sim: Sim): InstanceId | undefined => sim.state.scenarioDecks[DECK]!.inPlayTopId;
const deckOfCells = (sim: Sim): readonly InstanceId[] => sim.state.scenarioDecks[DECK]!.deck;
const lockOn = (sim: Sim, id: InstanceId | undefined): number => (id ? (inst(sim.state, id).counters.lock ?? 0) : 0);
const activePlayer = (sim: Sim): PlayerId => (sim.state.step as { activePlayerId: PlayerId }).activePlayerId;
const toHero = (player: PlayerId = P1): Command => ({ type: "changeForm", playerId: player });
const attack = (by: InstanceId, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: by,
  targetInstanceId: target,
});
const thwart = (sim: Sim, by: InstanceId, scheme: InstanceId = mainOf(sim), player: PlayerId = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: by,
  schemeInstanceId: scheme,
});
/** Cards of the encounter set in play anywhere (the villain area, a player's play area) by card code. */
const inPlayIdsOf = (sim: Sim, code: string): InstanceId[] =>
  (Object.keys(sim.state.instances) as InstanceId[]).filter(
    (i) =>
      codeOf(sim.state, i) === code &&
      (sim.state.villainArea.includes(i) ||
        sim.state.players.some((p) => p.playArea.includes(i)) ||
        sim.state.mainScheme.instanceId === i ||
        sim.state.villains.some((v) => v.instanceId === i) ||
        inst(sim.state, i).attachedTo !== null),
  );
const upgradesInPlay = (sim: Sim): string[] =>
  sim.state.villainArea
    .map((i) => codeOf(sim.state, i))
    .filter((c) => /^5010[9]$|^5011[0-2]$/.test(c))
    .sort();
const upgradesAside = (sim: Sim): string[] =>
  sim.state.encounterSetAside
    .map((i) => codeOf(sim.state, i))
    .filter((c) => /^5010[9]$|^5011[0-2]$/.test(c))
    .sort();

/** Hero Action of the top Holding Cell by P1, paid with `paymentCodes` (card codes taken to hand), branch 0 (two of a type / wild) or 1 (3 of any type). */
const cellAction = (sim: Sim, plan: Plan, branch: 0 | 1, ...paymentCodes: string[]): GameEvent[] =>
  cellActionBy(sim, P1, plan, branch, ...paymentCodes);

// ---------------------------------------------------------------------------------------------------------------
// Zone invariants (the same shape as batroc-scenario.test.ts)
// ---------------------------------------------------------------------------------------------------------------

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
  for (const [name, sep] of Object.entries(s.scenarioDecks)) {
    for (const id of sep.deck) add(id, `scenarioDeck.${name}.deck`);
    for (const id of sep.discard) add(id, `scenarioDeck.${name}.discard`);
    // `inPlayTopId` is the top card, which is in play (the villain area): not a second zone.
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

/** Every card instance of the setup that is not a player card, a villain, the main scheme or an attachment. */
function encounterIdsOf(s: GameState): InstanceId[] {
  const owned = new Set(s.players.flatMap((p) => [...p.hand, ...p.deck, ...p.discard, ...p.playArea, ...p.setAside]));
  return (Object.keys(s.instances) as InstanceId[]).filter(
    (id) =>
      !owned.has(id) &&
      !s.players.some((p) => p.identity.instanceId === id) &&
      !s.villains.some((v) => v.instanceId === id) &&
      id !== s.mainScheme.instanceId &&
      s.instances[id]!.attachedTo === null,
  );
}

function playerCardIdsOf(s: GameState): InstanceId[] {
  return s.players.flatMap((p) =>
    [...p.hand, ...p.deck, ...p.discard, ...p.playArea, ...p.setAside].filter((i) => inst(s, i).ownerId === p.playerId),
  );
}

/**
 * The closing invariants of every game: no unanswered prompt, no card instance in two zones, every encounter card
 * (the Holding Cell deck, set-aside upgrades and the victory display included) and every card a deck started with
 * still somewhere (RRG 1.8 "Owner", p. 31; "Choices").
 */
function expectInvariants(sim: Sim, setup: { encounter: readonly InstanceId[]; playerCards: readonly InstanceId[] }) {
  const s = sim.state;
  expect(s.pendingChoice).toBeNull();
  const zones = zoneIndex(s);
  const twice = [...zones].filter(([, labels]) => labels.length > 1);
  expect(twice).toEqual([]);
  const lostEncounter = setup.encounter.filter((id) => !zones.has(id) && inst(s, id).attachedTo === null);
  expect(lostEncounter.map((i) => codeOf(s, i))).toEqual([]);
  const lostPlayer = setup.playerCards.filter((id) => !zones.has(id) && inst(s, id).attachedTo === null);
  expect(lostPlayer.map((i) => codeOf(s, i))).toEqual([]);
}

const ADVANCE = "01186"; // boost 0, When Revealed: the villain schemes
const ASSAULT = "01187"; // boost 0
const KICK = "01005"; // Swinging Web Kick: Hero Action (attack), 8 damage to an enemy, cost 3
const HAYMAKER = "01087"; // Hero Action (attack), 3 damage to an enemy, cost 2
const PSIONIC_ENHANCEMENT = "50122";
const ITS_ALIVE = "50123"; // boost 3
const DIPLOMATIC_IMMUNITY = "50127";

/**
 * Plays `code` (taken to hand) at the target `plan` names, paying with `cost` single-icon upgrades and supports taken to
 * hand for the purpose (so a second copy of an event is never spent as payment).
 */
function playEvent(sim: Sim, plan: Plan, code: string, cost: number, player: PlayerId = P1): GameEvent[] {
  give(sim, player, code);
  const card = handOf(sim, code, player)[0]!;
  const fodder = (): InstanceId[] =>
    playerOf(sim.state, player).hand.filter((i) => FODDER.includes(codeOf(sim.state, i)));
  for (const c of FODDER) {
    if (fodder().length >= cost) break;
    if (
      playerOf(sim.state, player)
        .deck.concat(playerOf(sim.state, player).discard)
        .some((i) => codeOf(sim.state, i) === c)
    )
      give(sim, player, c);
  }
  return act(sim, plan, play(player, card, fodder().slice(0, cost)));
}

const keywordNames = (sim: Sim, id: InstanceId) => keywordsOf(sim.state, id, DEPS).map((k) => k.name);
const traitNames = (sim: Sim, id: InstanceId) => traitsOf(sim.state, id, DEPS).map((t) => String(t));
const inPlayCodes = (sim: Sim, player: PlayerId = P1): string[] =>
  playerOf(sim.state, player).playArea.map((i) => codeOf(sim.state, i));
const countBy = (sim: Sim, ids: readonly InstanceId[]): Record<string, number> => {
  const count: Record<string, number> = {};
  for (const id of ids) count[codeOf(sim.state, id)] = (count[codeOf(sim.state, id)] ?? 0) + 1;
  return count;
};

describe("M.O.D.O.K. scenario, game A: solo (Spider-Man), standard, seed 1, played to a win", () => {
  const a = open([SPIDER_MAN]);
  const baseline = { encounter: encounterIdsOf(a.state), playerCards: playerCardIdsOf(a.state) };
  const spider = () => identityOf(a.state, P1);
  const modok = () => villainOf(a);
  const ally = (code: string) => inPlayIdsOf(a, code)[0]!;
  const mainScheme = () => mainOf(a);

  it("setup (MC50 p. 13, 50104a): one player, Peter Parker in alter-ego form, M.O.D.O.K. (A) with his fixed 10 hit points and retaliate 1", () => {
    expect(a.state.players).toHaveLength(1);
    expect(playerOf(a.state, P1).identity.form).toBe("alterEgo");
    expect(codeOf(a.state, modok())).toBe("50103a");
    expect(a.state.villains[0]!.stageIndex).toBe(0);
    // MC50 p. 4, "Non-Scaling Villain HP": 10 at any player count.
    expect(maxHitPoints(a.state, modok(), DEPS)).toBe(10);
    expect(keywordTotal(a.state, modok(), "retaliate", DEPS)).toBe(1);
    expect(traitNames(a, modok()).sort()).toEqual(["AERIAL", "CYBORG", "PSIONIC"]);
  });

  it("setup: stage 1 has 1[per_hero] threat, target 7[per_hero], acceleration 1[per_hero]", () => {
    expect(codeOf(a.state, mainScheme())).toBe("50104a");
    expect(a.state.mainScheme.stageIndex).toBe(0);
    expect(mainThreat(a)).toBe(1);
    expect(mainSchemeValue(a.state, "targetThreat", DEPS)).toBe(7);
    expect(mainSchemeValue(a.state, "acceleration", DEPS)).toBe(1);
  });

  it("setup (rulebook p. 13): the Holding Cell deck is the four cells shuffled, the top one in play Holding Cell side up with 2[per_hero] lock counters, three beneath it hidden", () => {
    const deck = a.state.scenarioDecks[DECK]!;
    expect(deck.contents.cardIds).toEqual(CELLS);
    const top = cellOf(a)!;
    expect(CELLS).toContain(codeOf(a.state, top));
    expect(a.state.villainArea).toContain(top); // "The top card of this deck is in play"
    expect(inst(a.state, top).faceup).toBe(true);
    expect(inst(a.state, top).counters).toEqual({ lock: 2 });
    expect(deckOfCells(a)).toHaveLength(3);
    for (const id of deckOfCells(a)) {
      expect(inst(a.state, id).faceup).toBe(false);
      expect(inst(a.state, id).counters).toEqual({});
      expect(a.state.villainArea).not.toContain(id);
    }
    // The four are four different cells, and this seed's order is the order they are freed in below.
    expect([top, ...deckOfCells(a)].map((i) => codeOf(a.state, i))).toEqual(["50108a", "50106a", "50107a", "50105a"]);
    expect(deck.discard).toEqual([]);
  });

  it("setup: 1 random Adaptoid upgrade in play (Strong Upgrade, this seed), the other three set aside and in no deck", () => {
    expect(upgradesInPlay(a)).toEqual(["50112"]);
    expect(upgradesAside(a)).toEqual(["50109", "50110", "50111"]);
    const pile = piles(a.state);
    for (const id of [...pile.deck, ...pile.discard]) expect(codeOf(a.state, id)).not.toMatch(/^5011[0-2]$|^50109$/);
  });

  it("setup: the player found a copy of Adaptoid and revealed it, so it is engaged with them, with the upgrade already applying (+1 ATK, toughness, Brute, a tough status card)", () => {
    const adaptoids = inPlayIdsOf(a, "50113");
    expect(adaptoids).toHaveLength(1);
    const adaptoid = adaptoids[0]!;
    expect(inst(a.state, adaptoid).engagedWith).toBe(P1);
    expect(statBonus(a.state, DEPS, adaptoid, "atk")).toBe(1);
    expect(keywordNames(a, adaptoid)).toEqual(["toughness"]);
    expect(traitNames(a, adaptoid).sort()).toEqual(["ADAPTOID", "BRUTE"]);
    expect(inst(a.state, adaptoid).statuses.tough).toBe(1);
    expect(maxHitPoints(a.state, adaptoid, DEPS)).toBe(5);
  });

  it("setup: the encounter deck is 29 cards: 3 Adaptoids, the other M.O.D.O.K. cards, Scientist Supreme 5, Standard 7 and Spider-Man's obligation; no cell, upgrade or Adaptoid beyond those", () => {
    const deck = piles(a.state).deck;
    expect(deck).toHaveLength(29);
    expect(countBy(a, deck)).toEqual({
      // M.O.D.O.K.: Adaptoid 3 (the fourth is in play), the six attachments, A.I.M. Jailer 2, Hostage Situation,
      // Psionic Enhancement, "It's Alive!", Psionic Blast 2
      "50113": 3,
      "50114": 1,
      "50115": 1,
      "50116": 1,
      "50117": 1,
      "50118": 1,
      "50119": 1,
      "50120": 2,
      "50121": 1,
      "50122": 1,
      "50123": 1,
      "50124": 2,
      // Scientist Supreme (5)
      "50125": 1,
      "50126": 1,
      "50127": 1,
      "50128": 2,
      // Standard (7) and Spider-Man's obligation
      "01186": 2,
      "01187": 2,
      "01188": 1,
      "01189": 1,
      "01190": 1,
      "01165": 1,
    });
    expect(nameOfCode("50105a")).toBe("Holding Cell");
  });

  it("round 1: Spider-Man flips to hero form; a Hero Action paid with too little is refused (RRG 1.8 'Cost')", () => {
    expect(rejection(a, toHero())).toBeNull();
    act(a, {}, toHero());
    expect(playerOf(a.state, P1).identity.form).toBe("hero");
    const cell = cellOf(a)!;
    give(a, P1, "01088");
    // Strong Inhuman's cell asks for two [physical] resources (or 3 of any type): Energy produces two [energy], and
    // a single card is not three resources.
    const energy = handOf(a, "01088")[0]!;
    expect(
      rejection(a, use(P1, cell, "50108a.holding-cell-action", [{ fromHand: energy }], undefined, { branch: 0 })),
    ).not.toBeNull();
    expect(
      rejection(a, use(P1, cell, "50108a.holding-cell-action", [{ fromHand: energy }], undefined, { branch: 1 })),
    ).not.toBeNull();
    expect(lockOn(a, cell)).toBe(2);
  });

  it("round 1: the Holding Cell's Hero Action paid with two [physical] (Strength) removes 1 lock counter (2 -> 1)", () => {
    const cell = cellOf(a)!;
    const events = cellAction(a, {}, 0, "01090");
    expect(ofType(events, "counterRemoved")).toMatchObject([{ instanceId: cell, counterType: "lock", amount: 1 }]);
    expect(lockOn(a, cell)).toBe(1);
    expect(codeOf(a.state, cell)).toBe("50108a");
    expect(playerOf(a.state, P1).discard.map((i) => codeOf(a.state, i))).toContain("01090");
  });

  it("round 1: the second Hero Action paid with 3 resources of any type removes the last lock counter: the first player chooses who controls Strong Inhuman, who enters ready with toughness; the next cell enters with 2", () => {
    const cell = cellOf(a)!;
    const events = cellAction(a, {}, 1, "01007", "01008", "01009");
    expect(ofType(events, "cardFlippedToOtherFace")).toMatchObject([
      { instanceId: cell, from: "50108a", to: "50108b" },
    ]);
    expect(codeOf(a.state, cell)).toBe("50108b");
    expect(inst(a.state, cell).controllerId).toBe(P1);
    expect(inPlayCodes(a)).toContain("50108b");
    expect(inst(a.state, cell).exhausted).toBe(false);
    expect(inst(a.state, cell).damage).toBe(0);
    expect(inst(a.state, cell).counters).toEqual({});
    // Toughness: it enters play with a tough status card (RRG 1.8 "Toughness").
    expect(keywordNames(a, cell)).toEqual(["toughness"]);
    expect(inst(a.state, cell).statuses.tough).toBe(1);
    // The next cell comes up from the deck with its own 2[per_hero] lock counters.
    const next = cellOf(a)!;
    expect(next).not.toBe(cell);
    expect(codeOf(a.state, next)).toBe("50106a");
    expect(lockOn(a, next)).toBe(2);
    expect(deckOfCells(a).map((i) => codeOf(a.state, i))).toEqual(["50107a", "50105a"]);
    expect(ofType(events, "scenarioDeckTopEnteredPlay")).toMatchObject([{ name: DECK, instanceId: next }]);
    expect(a.state.outcome).toBeNull();
  });

  it("round 1 villain phase: +1 acceleration; M.O.D.O.K. (ATK 1) attacks, Strong Inhuman defends and its tough status card absorbs the damage (RRG 'Toughness'); the Adaptoid (ATK 2) hits Spider-Man", () => {
    const strong = ally("50108b");
    stack(a, ADVANCE, PSIONIC_ENHANCEMENT); // M.O.D.O.K.'s boost card (0 icons), then the card dealt to the player
    const events = act(a, { defender: strong }, endTurn());
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(a), amount: 1 });
    expect(ofType(events, "attackResolved")).toMatchObject([
      { enemyInstanceId: modok(), targetInstanceId: strong, baseAtk: 1, boostIcons: 0, damageDealt: 1 },
      { enemyInstanceId: ally("50113"), targetInstanceId: spider(), baseAtk: 2, boostIcons: 0, damageDealt: 2 },
    ]);
    expect(ofType(events, "damagePrevented")).toMatchObject([{ targetInstanceId: strong, amount: 1, reason: "tough" }]);
    expect(inst(a.state, strong).statuses.tough).toBe(0);
    expect(damageOn(a, strong)).toBe(0);
    expect(damageOn(a, spider())).toBe(2);
    // The Adaptoid is not villainous (Psionic Upgrade is not in play): no boost card for it.
    expect(ofType(events, "boostCardDealt")).toHaveLength(1);
    // The dealt Psionic Enhancement: a side scheme with 3 threat plus Hinder 1[per_hero].
    const enhancement = inPlayIdsOf(a, PSIONIC_ENHANCEMENT)[0]!;
    expect(inst(a.state, enhancement).threat).toBe(4);
    expect(mainThreat(a)).toBe(2);
    expect(a.state.round).toBe(2);
  });

  it("round 2: Swinging Web Kick (8) on M.O.D.O.K.: retaliate 1 hits Spider-Man; he is not defeated, the cell keeps its 2 lock counters", () => {
    const events = playEvent(a, { target: modok() }, KICK, 3);
    expect(ofType(events, "damageDealt")).toMatchObject([
      { targetInstanceId: modok(), amount: 8, sourceInstanceId: spider() },
      { targetInstanceId: spider(), amount: 1, sourceInstanceId: modok() }, // Retaliate 1 (RRG 1.8 "Retaliate")
    ]);
    expect(damageOn(a, modok())).toBe(8);
    expect(hpLeft(a, modok())).toBe(2);
    expect(damageOn(a, spider())).toBe(3);
    expect(lockOn(a, cellOf(a))).toBe(2);
  });

  it("round 2: M.O.D.O.K. 'would be defeated' by a basic attack (2 of 2 left): hit points reset to the printed 10 and 2 lock counters come off the cell (2 -> 0); he is never defeated", () => {
    const cell = cellOf(a)!;
    const events = act(a, {}, attack(spider(), modok()));
    expect(ofType(events, "damageDealt")[0]).toMatchObject({ targetInstanceId: modok(), amount: 2 });
    expect(ofType(events, "characterDefeated")).toEqual([]);
    expect(ofType(events, "hitPointsSet")).toMatchObject([{ instanceId: modok(), remaining: 10, damage: 0 }]);
    // The cell held exactly 2: removing the last lock counter frees it (no counter is left to remove, so the cell
    // flips to its ally in the interrupt; the cell's own Forced Interrupt answers "the last lock counter removed").
    expect(ofType(events, "cardFlippedToOtherFace")).toMatchObject([
      { instanceId: cell, from: "50106a", to: "50106b" },
    ]);
    expect(inst(a.state, cell).counters).toEqual({});
    expect(damageOn(a, modok())).toBe(0);
    expect(hpLeft(a, modok())).toBe(10);
    expect(a.state.villains[0]!.defeated).toBe(false);
    expect(a.state.villains[0]!.stageIndex).toBe(0);
    expect(a.state.outcome).toBeNull();
    expect(damageOn(a, spider())).toBe(4); // retaliate again
  });

  it("round 2: the cell's last lock counters left it freed: Psionic Inhuman is under Spider-Man's control, ready; the next cell (Sarah Garza's) has 2 and the deck holds one cell", () => {
    expect(inPlayCodes(a)).toEqual(["50113", "50108b", "50106b"]);
    const psionic = ally("50106b");
    expect(inst(a.state, psionic).controllerId).toBe(P1);
    expect(inst(a.state, psionic).exhausted).toBe(false);
    expect(codeOf(a.state, cellOf(a)!)).toBe("50107a");
    expect(lockOn(a, cellOf(a))).toBe(2);
    expect(deckOfCells(a).map((i) => codeOf(a.state, i))).toEqual(["50105a"]);
  });

  it("round 2: Psionic Inhuman thwarts (1 of the main scheme's 2): its response removes 1 lock counter from the Holding Cell in play (2 -> 1)", () => {
    const psionic = ally("50106b");
    const events = act(a, { take: "psionic" }, thwart(a, psionic));
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: mainOf(a), amount: 1 }]);
    expect(ofType(events, "counterRemoved")).toMatchObject([{ instanceId: cellOf(a), counterType: "lock", amount: 1 }]);
    expect(lockOn(a, cellOf(a))).toBe(1);
    expect(mainThreat(a)).toBe(1);
    expect(damageOn(a, psionic)).toBe(1); // the ally's consequential damage
  });

  it("round 2: Sarah Garza's cell asks for a wild resource: The Power of Justice (1 wild) removes the last lock counter and frees her (unique), the Flying cell comes up with 2, the deck is empty", () => {
    const events = cellAction(a, {}, 0, "01062");
    expect(ofType(events, "cardFlippedToOtherFace")).toMatchObject([{ from: "50107a", to: "50107b" }]);
    expect(inPlayCodes(a)).toEqual(["50113", "50108b", "50106b", "50107b"]);
    expect(codeOf(a.state, cellOf(a)!)).toBe("50105a");
    expect(lockOn(a, cellOf(a))).toBe(2);
    expect(deckOfCells(a)).toEqual([]);
    // Three Inhuman allies are in play and no ally was discarded for the ally limit: "does not count against your ally limit".
    expect(a.state.pendingChoice).toBeNull();
  });

  it("round 2: Sarah Garza's attack gains ranged: M.O.D.O.K. deals no Retaliate damage back, only her own 1 consequential damage", () => {
    const sarah = ally("50107b");
    const events = act(a, {}, attack(sarah, modok()));
    expect(ofType(events, "damageDealt")).toMatchObject([
      { targetInstanceId: modok(), amount: 2, sourceInstanceId: sarah },
      { targetInstanceId: sarah, amount: 1, sourceInstanceId: sarah },
    ]);
    expect(damageOn(a, sarah)).toBe(1);
    expect(damageOn(a, modok())).toBe(2);
    expect(damageOn(a, spider())).toBe(4);
  });

  it("round 2 villain phase: M.O.D.O.K.'s boost card 'It's Alive!' (3 icons + 1 amplify from Psionic Enhancement) makes ATK 5; the defending Psionic Inhuman (4 left) is defeated and goes to the bottom of the Holding Cell deck as a cell (owner decision Q24 = A)", () => {
    const psionic = ally("50106b");
    stack(a, ITS_ALIVE, DIPLOMATIC_IMMUNITY);
    const events = act(a, { defender: psionic }, endTurn());
    expect(ofType(events, "attackResolved")[0]).toMatchObject({
      enemyInstanceId: modok(),
      targetInstanceId: psionic,
      baseAtk: 1,
      boostIcons: 4,
      damageDealt: 5,
    });
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: psionic, cardId: "50106b" }]);
    // Not discarded to any pile: its Forced Response flips it and places it under the Holding Cell deck.
    expect(codeOf(a.state, psionic)).toBe("50106a");
    expect(deckOfCells(a)).toEqual([psionic]);
    expect(piles(a.state).discard).not.toContain(psionic);
    expect(a.state.removedFromGame).not.toContain(psionic);
    expect(inPlayCodes(a)).not.toContain("50106b");
    expect(inst(a.state, psionic).counters).toEqual({});
    expect(inst(a.state, psionic).faceup).toBe(false);
    // The Flying cell in play keeps its 2 lock counters and stays the top card.
    expect(codeOf(a.state, cellOf(a)!)).toBe("50105a");
    expect(lockOn(a, cellOf(a))).toBe(2);
    // The Adaptoid hit Spider-Man; the dealt Diplomatic Immunity (3 per player) is a second side scheme.
    expect(damageOn(a, spider())).toBe(6);
    const immunity = inPlayIdsOf(a, DIPLOMATIC_IMMUNITY)[0]!;
    expect(inst(a.state, immunity).threat).toBe(3);
    expect(mainThreat(a)).toBe(2);
    expect(a.state.round).toBe(3);
  });

  it("round 3: Flying Inhuman's cell: two [energy] (Energy) then 3 resources of any type free it, the Psionic cell comes up (again) with 2 lock counters, the deck is empty", () => {
    const flyingCell = cellOf(a)!;
    cellAction(a, {}, 0, "01088");
    expect(lockOn(a, flyingCell)).toBe(1);
    const events = cellAction(a, {}, 1, "01007", "01008", "01009");
    expect(ofType(events, "cardFlippedToOtherFace")).toMatchObject([
      { instanceId: flyingCell, from: "50105a", to: "50105b" },
    ]);
    expect(codeOf(a.state, flyingCell)).toBe("50105b");
    expect(inst(a.state, flyingCell).controllerId).toBe(P1);
    // The Psionic cell, which was under the deck, is the top card now: back in play, hidden no more, 2 lock counters.
    expect(codeOf(a.state, cellOf(a)!)).toBe("50106a");
    expect(lockOn(a, cellOf(a))).toBe(2);
    expect(deckOfCells(a)).toEqual([]);
  });

  it("round 3: Flying Inhuman thwarts Diplomatic Immunity (3 -> 1); its response removes 1 threat from another scheme, chosen here as the main scheme (2 -> 1)", () => {
    const flying = ally("50105b");
    const immunity = inPlayIdsOf(a, DIPLOMATIC_IMMUNITY)[0]!;
    const events = act(a, { take: "flying", target: mainOf(a) }, thwart(a, flying, immunity));
    expect(ofType(events, "threatRemoved")).toMatchObject([
      { schemeInstanceId: immunity, amount: 2 },
      { schemeInstanceId: mainOf(a), amount: 1, sourceInstanceId: flying },
    ]);
    expect(inst(a.state, immunity).threat).toBe(1);
    expect(mainThreat(a)).toBe(1);
    // "another scheme": the response may not take the threat from the scheme just thwarted.
    expect(damageOn(a, flying)).toBe(1);
  });

  it("round 3: the Adaptoid's tough status card (Strong Upgrade) absorbs Spider-Man's basic attack; Sarah Garza's attack then deals 2 (5 -> 3 left)", () => {
    const adaptoid = ally("50113");
    const first = act(a, {}, attack(spider(), adaptoid));
    expect(ofType(first, "damagePrevented")).toMatchObject([
      { targetInstanceId: adaptoid, amount: 2, reason: "tough" },
    ]);
    expect(inst(a.state, adaptoid).statuses.tough).toBe(0);
    expect(damageOn(a, adaptoid)).toBe(0);
    const sarah = ally("50107b");
    const second = act(a, {}, attack(sarah, adaptoid));
    expect(ofType(second, "damageDealt")[0]).toMatchObject({
      targetInstanceId: adaptoid,
      amount: 2,
      sourceInstanceId: sarah,
    });
    expect(hpLeft(a, adaptoid)).toBe(3);
  });

  it("round 3: the Psionic cell paid with two [mental] (Genius), then 3 of any type: all four Inhuman allies are in play (four allies, no ally-limit discard) and no Holding Cell is", () => {
    const psionicCell = cellOf(a)!;
    cellAction(a, {}, 0, "01089");
    expect(lockOn(a, psionicCell)).toBe(1);
    cellAction(a, {}, 1, "01007", "01008", "01009");
    expect(codeOf(a.state, psionicCell)).toBe("50106b");
    expect(inPlayCodes(a)).toEqual(["50113", "50108b", "50107b", "50105b", "50106b"]);
    expect(a.state.scenarioDecks[DECK]!.inPlayTopId).toBeUndefined();
    expect(deckOfCells(a)).toEqual([]);
    expect(a.state.pendingChoice).toBeNull();
    expect(a.state.outcome).toBeNull();
  });

  it("round 3 villain phase: acceleration +2 (base 1 and Diplomatic Immunity's icon); M.O.D.O.K.'s boost 'It's Alive!' (3 + 1 amplify) makes ATK 5 against the defending Flying Inhuman (4 left): defeated", () => {
    const flying = ally("50105b");
    const strong = ally("50108b");
    stack(a, ITS_ALIVE, ADVANCE, ASSAULT); // M.O.D.O.K.'s boost, the card dealt (Advance), the boost card of that scheme
    const events = act(a, { defenders: [flying, strong] }, endTurn());
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(a), amount: 2 });
    expect(ofType(events, "attackResolved")).toMatchObject([
      { enemyInstanceId: modok(), targetInstanceId: flying, baseAtk: 1, boostIcons: 4, damageDealt: 5 },
      { enemyInstanceId: ally("50113"), targetInstanceId: strong, baseAtk: 2, damageDealt: 2 }, // Strong Inhuman defends the Adaptoid
    ]);
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: flying, cardId: "50105b" }]);
    expect(ofType(events, "schemeResolved")).toMatchObject([
      { enemyInstanceId: modok(), baseSch: 2, boostIcons: 1, threatPlaced: 3 },
    ]);
    expect(mainThreat(a)).toBe(6); // 1 + 2 + 3: one short of the target of 7
    expect(damageOn(a, spider())).toBe(6);
    expect(a.state.outcome).toBeNull();
    expect(a.state.round).toBe(4);
  });

  it("round 3: with every other cell freed - no Holding Cell in play and the deck empty - the defeated Flying Inhuman flips and becomes the only card of the Holding Cell deck: in play at once with 2 lock counters (MC50 p. 22 FAQ, owner decision Q24 = A)", () => {
    const flying = ally("50105b");
    expect(flying).toBeUndefined();
    const cell = cellOf(a)!;
    expect(codeOf(a.state, cell)).toBe("50105a");
    expect(a.state.villainArea).toContain(cell);
    expect(lockOn(a, cell)).toBe(2);
    expect(deckOfCells(a)).toEqual([]);
    expect(piles(a.state).discard).not.toContain(cell);
    expect(inPlayCodes(a)).toEqual(["50113", "50108b", "50107b", "50106b"]);
  });

  it("round 4: Spider-Man's attack leaves the Adaptoid with 1 hit point; Sarah Garza's overkill attack kills it, the excess 1 goes to M.O.D.O.K. (not an attack: no retaliate) and its When Defeated takes a lock counter off the Flying cell (2 -> 1)", () => {
    const adaptoid = ally("50113");
    const sarah = ally("50107b");
    const cell = cellOf(a)!;
    act(a, {}, attack(spider(), adaptoid));
    expect(hpLeft(a, adaptoid)).toBe(1);
    const events = act(a, {}, attack(sarah, adaptoid));
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: adaptoid }]);
    expect(ofType(events, "overkillSpilled")).toMatchObject([
      { fromInstanceId: adaptoid, toInstanceId: modok(), amount: 1 },
    ]);
    expect(damageOn(a, modok())).toBe(3);
    expect(damageOn(a, spider())).toBe(6);
    expect(ofType(events, "counterRemoved")).toMatchObject([{ instanceId: cell, counterType: "lock", amount: 1 }]);
    expect(lockOn(a, cell)).toBe(1);
    expect(piles(a.state).discard).toContain(adaptoid);
  });

  it("round 4: with the Flying cell back in play the win branch is closed: Swinging Web Kick brings M.O.D.O.K. to 0 and he is reset (the cell's last counter frees Flying again), not defeated", () => {
    const cell = cellOf(a)!;
    const events = playEvent(a, { target: modok() }, KICK, 3);
    expect(ofType(events, "hitPointsSet")).toMatchObject([{ instanceId: modok(), remaining: 10, damage: 0 }]);
    expect(ofType(events, "gameEnded")).toEqual([]);
    expect(a.state.outcome).toBeNull();
    expect(codeOf(a.state, cell)).toBe("50105b");
    expect(a.state.scenarioDecks[DECK]!.inPlayTopId).toBeUndefined();
    expect(damageOn(a, spider())).toBe(7);
  });

  it("round 4: with no Holding Cell in play, Swinging Web Kick (8) and the attacks of Psionic Inhuman and Flying Inhuman (1 + 1) bring M.O.D.O.K. to 0 and the players win: no reset", () => {
    playEvent(a, { target: modok() }, KICK, 3);
    expect(damageOn(a, modok())).toBe(8);
    expect(a.state.outcome).toBeNull();
    act(a, {}, attack(ally("50106b"), modok()));
    expect(damageOn(a, modok())).toBe(9);
    const events = act(a, {}, attack(ally("50105b"), modok()));
    expect(ofType(events, "hitPointsSet")).toEqual([]);
    expect(ofType(events, "gameEnded")).toMatchObject([{ outcome: { result: "win", reason: "villainDefeated" } }]);
    expect(a.state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });

  it("invariants: no prompt pending, no card in two zones, every encounter card (cells, set-aside upgrades included) and deck card accounted for", () => {
    expectInvariants(a, baseline);
    expect(upgradesAside(a)).toEqual(["50109", "50110", "50111"]);
    expect(upgradesInPlay(a)).toEqual(["50112"]);
    expect(a.state.victoryDisplay).toEqual([]);
    // The four Inhuman allies are the four cells, each once: the Holding Cell deck is empty and nothing is in play for it.
    expect(["50105b", "50106b", "50107b", "50108b"].map((c) => inPlayIdsOf(a, c).length)).toEqual([1, 1, 1, 1]);
    expect(deckOfCells(a)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game B: two players (Iron Man P1, Spider-Man P2), first player P2, standard, seed 3
// ---------------------------------------------------------------------------------------------------------------

const RELENTLESS_ASSAULT = "01053"; // Hero Action (attack): 5 damage to a minion; overkill if paid with a [physical] resource
const AIM_JAILER = "50120";
const HOSTAGE_SITUATION = "50121";
const FOR_JUSTICE = "01060";
const GREAT_RESPONSIBILITY = "01061"; // a mental resource

/** `cellAction` for any player. */
function cellActionBy(sim: Sim, player: PlayerId, plan: Plan, branch: 0 | 1, ...paymentCodes: string[]): GameEvent[] {
  const cell = cellOf(sim)!;
  const code = codeOf(sim.state, cell);
  const chosen: InstanceId[] = [];
  for (const c of paymentCodes) {
    give(sim, player, c);
    chosen.push(handOf(sim, c, player).find((i) => !chosen.includes(i))!);
  }
  return act(
    sim,
    plan,
    use(
      player,
      cell,
      `${code}.holding-cell-action`,
      chosen.map((fromHand) => ({ fromHand })),
      undefined,
      { branch },
    ),
  );
}

describe("M.O.D.O.K. scenario, game B: two players (Iron Man P1, Spider-Man P2), first player P2, standard, seed 3", () => {
  const b = open([IRON_MAN, SPIDER_MAN], { seed: 3, firstPlayerIndex: 1 });
  const baseline = { encounter: encounterIdsOf(b.state), playerCards: playerCardIdsOf(b.state) };
  const modok = () => villainOf(b);
  const ally = (code: string) => inPlayIdsOf(b, code)[0]!;
  const adaptoidOf = (player: PlayerId) =>
    inPlayIdsOf(b, "50113").find((i) => inst(b.state, i).engagedWith === player)!;
  const prompts: { kind: string; player: PlayerId; labels: string[] }[] = [];
  let beforeAssault: Sim | undefined;

  it("setup: the per-player numbers: threat 2 + 1 incite per Adaptoid (Flying Upgrade), target 14, acceleration 2, 4 lock counters, M.O.D.O.K. still 10 hit points", () => {
    expect(b.state.firstPlayerId).toBe(P2);
    expect(activePlayer(b)).toBe(P2);
    expect(maxHitPoints(b.state, modok(), DEPS)).toBe(10); // "Non-Scaling Villain HP" (MC50 p. 4)
    expect(mainSchemeValue(b.state, "targetThreat", DEPS)).toBe(14);
    expect(mainSchemeValue(b.state, "acceleration", DEPS)).toBe(2);
    expect(mainThreat(b)).toBe(4); // 1[per_hero] = 2, plus incite 1 for each of the two Adaptoids revealed after Flying Upgrade
    expect(upgradesInPlay(b)).toEqual(["50109"]);
    expect(upgradesAside(b)).toEqual(["50110", "50111", "50112"]);
    const top = cellOf(b)!;
    expect(codeOf(b.state, top)).toBe("50108a");
    expect(lockOn(b, top)).toBe(4); // 2[per_hero]
    expect(deckOfCells(b)).toHaveLength(3);
    for (const id of deckOfCells(b)) expect(inst(b.state, id).faceup).toBe(false);
  });

  it("setup: each player found and revealed an Adaptoid, so each has one engaged; Flying Upgrade gives it +1 SCH, incite 1 and the Aerial trait", () => {
    expect(inPlayIdsOf(b, "50113")).toHaveLength(2);
    expect(inst(b.state, adaptoidOf(P1)).engagedWith).toBe(P1);
    expect(inst(b.state, adaptoidOf(P2)).engagedWith).toBe(P2);
    for (const id of inPlayIdsOf(b, "50113")) {
      expect(statBonus(b.state, DEPS, id, "sch")).toBe(1);
      expect(statBonus(b.state, DEPS, id, "atk")).toBe(0);
      expect(keywordsOf(b.state, id, DEPS)).toEqual([{ name: "incite", value: 1 }]);
      expect(traitNames(b, id).sort()).toEqual(["ADAPTOID", "AERIAL"]);
    }
    expect(piles(b.state).deck.filter((i) => codeOf(b.state, i) === "50113")).toHaveLength(2);
  });

  it("round 1, P2 (first player) acts first: two Hero Actions on the Holding Cell (Strength, then 3 of any type) take its 4 lock counters to 2", () => {
    act(b, {}, toHero(P2));
    const cell = cellOf(b)!;
    cellActionBy(b, P2, {}, 0, "01090");
    expect(lockOn(b, cell)).toBe(3);
    cellActionBy(b, P2, {}, 1, "01007", "01008", "01009");
    expect(lockOn(b, cell)).toBe(2);
    expect(codeOf(b.state, cell)).toBe("50108a");
  });

  it("round 1, P2: Swinging Web Kick on M.O.D.O.K. (8 of 10, retaliate 1 on P2) and a basic attack on P2's Adaptoid (5 -> 3 left)", () => {
    const events = playEvent(b, { target: modok() }, KICK, 3, P2);
    expect(damageOn(b, modok())).toBe(8);
    expect(ofType(events, "damageDealt")[1]).toMatchObject({ targetInstanceId: identityOf(b.state, P2), amount: 1 });
    const target = adaptoidOf(P2);
    act(b, {}, attack(identityOf(b.state, P2), target, P2));
    expect(hpLeft(b, target)).toBe(3);
    act(b, {}, endTurn(P2));
    expect(activePlayer(b)).toBe(P1);
  });

  it("round 1, P1 (Iron Man): Relentless Assault paid with Strength (a [physical] resource) gains overkill: the 5 damage kills P2's Adaptoid (3 left) and 2 spill onto M.O.D.O.K. (8 + 2 = 10): his interrupt resets him; 2 lock counters come off (never defeated)", () => {
    act(b, {}, toHero(P1));
    give(b, P1, RELENTLESS_ASSAULT, "01090");
    beforeAssault = { state: b.state, log: [] };
    const target = adaptoidOf(P2);
    const cell = cellOf(b)!;
    const card = handOf(b, RELENTLESS_ASSAULT, P1)[0]!;
    const strength = handOf(b, "01090", P1)[0]!;
    const watch: Picker = (s) => {
      const c = s.pendingChoice!;
      prompts.push({ kind: c.prompt.kind, player: c.playerId, labels: c.options.map((o) => o.label) });
      return planner({ target, player: P1 })(s);
    };
    const r = driveEventsPicking(DEPS, b.state, watch, play(P1, card, [strength]));
    b.state = r.state;
    const events = [...r.events];
    expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: 2, paid: { physical: 2 } }]);
    expect(ofType(events, "characterDefeated").map((e) => e.instanceId)).toEqual([target]);
    expect(ofType(events, "overkillSpilled")).toMatchObject([
      { fromInstanceId: target, toInstanceId: modok(), amount: 2 },
    ]);
    expect(ofType(events, "hitPointsSet")).toMatchObject([{ instanceId: modok(), remaining: 10, damage: 0 }]);
    expect(damageOn(b, modok())).toBe(0);
    expect(b.state.villains[0]!.defeated).toBe(false);
    expect(codeOf(b.state, cell)).toBe("50108b"); // the old cell is freed
  });

  it("round 1: the first player (P2, not the active player) chose who controls the freed Strong Inhuman: P1; it enters play with a tough status card; the next cell (Flying's) came up", () => {
    const who = prompts.find((p) => p.kind === "choosePlayer");
    expect(who).toBeDefined();
    expect(who!.player).toBe(P2);
    const strong = ally("50108b");
    expect(inst(b.state, strong).controllerId).toBe(P1);
    expect(playerOf(b.state, P1).playArea).toContain(strong);
    expect(inst(b.state, strong).statuses.tough).toBe(1);
    expect(codeOf(b.state, cellOf(b)!)).toBe("50105a");
    expect(deckOfCells(b).map((i) => codeOf(b.state, i))).toEqual(["50106a", "50107a"]);
  });

  it("MC50 p. 22 FAQ: M.O.D.O.K.'s Forced Interrupt resolves first (overkill is simultaneous with the attack's damage), then the Adaptoid's When Defeated: the freed cell no longer holds counters, so the NEW cell (4) loses 1 (3)", () => {
    const sim: Sim = { state: beforeAssault!.state, log: [] };
    const target = adaptoidOf(P2);
    const card = handOf(sim, RELENTLESS_ASSAULT, P1)[0]!;
    const strength = handOf(sim, "01090", P1)[0]!;
    act(sim, { target, player: P1 }, play(P1, card, [strength]));
    expect(codeOf(sim.state, cellOf(sim)!)).toBe("50105a");
    expect(lockOn(sim, cellOf(sim))).toBe(3);
  });

  it("round 1 villain phase: acceleration 2; M.O.D.O.K. activates once for each hero (two attacks); the dealt A.I.M. Jailer attacks the Rescued ally, which P1 controls (owner decision Q5 = A), and its tough status card absorbs the 2", () => {
    const strong = ally("50108b");
    stack(b, ADVANCE, ADVANCE, AIM_JAILER, HOSTAGE_SITUATION); // two boost cards, then P2's card, then P1's
    const events = act(b, {}, endTurn(P1));
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(b), amount: 2 });
    const modokAttacks = ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === modok());
    expect(modokAttacks.map((e) => e.targetInstanceId).sort()).toEqual(
      [identityOf(b.state, P1), identityOf(b.state, P2)].sort(),
    );
    const jailer = inPlayIdsOf(b, AIM_JAILER)[0]!;
    expect(inst(b.state, jailer).engagedWith).toBe(P2); // dealt to P2, the first player, first
    expect(hasKeyword(b.state, jailer, "guard", DEPS)).toBe(true);
    // A.I.M. Jailer's attack is an enemy attack on the ally: the player attacked is the ally's controller (P1), who
    // is offered the defense (RRG 1.8 "Attack (Enemy Activation)", p. 8; owner decision Q5 = A).
    const initiated = ofType(events, "triggerEvent").filter(
      (e) => e.phase === "initiated" && e.event.kind === "enemyAttack" && e.event.enemyInstanceId === jailer,
    );
    expect(initiated).toMatchObject([{ event: { attackedPlayerId: P1, targetInstanceId: strong } }]);
    expect(ofType(events, "defenseDeclined").filter((e) => e.attackInstanceId === jailer)).toMatchObject([
      { playerId: P1 },
    ]);
    expect(ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === jailer)).toMatchObject([
      { targetInstanceId: strong, baseAtk: 2, damageDealt: 2 },
    ]);
    expect(ofType(events, "damagePrevented")).toMatchObject([{ targetInstanceId: strong, amount: 2, reason: "tough" }]);
    expect(damageOn(b, strong)).toBe(0);
  });

  it("round 1 villain phase: Hostage Situation (dealt to P1) attaches the Rescued ally faceup, in play and under no player's control; it starts with 3 per player threat", () => {
    const strong = ally("50108b");
    const hostage = inPlayIdsOf(b, HOSTAGE_SITUATION)[0]!;
    expect(inst(b.state, hostage).threat).toBe(6);
    expect(inst(b.state, strong).attachedTo).toBe(hostage);
    expect(inst(b.state, strong).controllerId).toBeNull();
    expect(inst(b.state, strong).faceup).toBe(true);
    expect(playerOf(b.state, P1).playArea).not.toContain(strong);
    expect(playerOf(b.state, P2).playArea).not.toContain(strong);
    expect(mainThreat(b)).toBe(6); // 4 + 2 acceleration
    expect(b.state.round).toBe(2);
    expect(b.state.firstPlayerId).toBe(P1); // the first player token passed
  });

  it("round 2, P1 first: the hostage is nobody's - P1, its former controller, cannot attack or thwart with it; Hostage Situation holds M.O.D.O.K. at his hit points (cannot take damage): a basic attack deals none and resets nothing", () => {
    const strong = ally("50108b");
    expect(rejection(b, attack(strong, modok(), P1))).not.toBeNull();
    expect(rejection(b, thwart(b, strong, mainOf(b), P1))).not.toBeNull();
    const iron = identityOf(b.state, P1);
    const cell = cellOf(b)!;
    const before = lockOn(b, cell);
    const events = act(b, {}, attack(iron, modok(), P1));
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === modok() && e.amount > 0)).toEqual([]);
    expect(damageOn(b, modok())).toBe(0);
    expect(lockOn(b, cell)).toBe(before);
    act(b, {}, endTurn(P1));
    expect(activePlayer(b)).toBe(P2);
  });

  it("round 2, P2: Great Responsibility-paid For Justice! twice (4, then the last 2 of Hostage Situation's 6): P2 defeats it and takes control of the hostage, which stays in play with its tough card, not P1 who freed it", () => {
    const strong = ally("50108b");
    const hostage = inPlayIdsOf(b, HOSTAGE_SITUATION)[0]!;
    give(
      b,
      P2,
      FOR_JUSTICE,
      GREAT_RESPONSIBILITY,
      FOR_JUSTICE,
      GREAT_RESPONSIBILITY,
      "01007",
      "01008",
      "01009",
      "01063",
    );
    const cast = (fj: InstanceId, gr: InstanceId, filler: InstanceId) =>
      act(b, { target: hostage }, play(P2, fj, [gr, filler]));
    const [fj1, fj2] = handOf(b, FOR_JUSTICE, P2) as [InstanceId, InstanceId];
    const [gr1, gr2] = handOf(b, GREAT_RESPONSIBILITY, P2) as [InstanceId, InstanceId];
    const [f1, f2] = [handOf(b, "01007", P2)[0]!, handOf(b, "01008", P2)[0]!];
    const first = cast(fj1, gr1, f1);
    expect(ofType(first, "threatRemoved")).toMatchObject([{ schemeInstanceId: hostage, amount: 4 }]);
    expect(inst(b.state, hostage).threat).toBe(2);
    expect(inst(b.state, strong).attachedTo).toBe(hostage);
    const second = cast(fj2, gr2, f2);
    expect(ofType(second, "threatRemoved")).toMatchObject([{ schemeInstanceId: hostage, amount: 2 }]);
    expect(inPlayIdsOf(b, HOSTAGE_SITUATION)).toEqual([]);
    expect(inst(b.state, strong).attachedTo).toBeNull();
    expect(inst(b.state, strong).controllerId).toBe(P2);
    expect(playerOf(b.state, P2).playArea).toContain(strong);
    expect(inst(b.state, strong).statuses.tough).toBe(0);
    expect(damageOn(b, strong)).toBe(0);
  });

  it("round 2, P2: with Hostage Situation gone, M.O.D.O.K. can take damage again (the Guard Jailer engaged with P2 is dealt with first: Haymaker 3 and a basic attack finish its 4 hit points)", () => {
    const jailer = inPlayIdsOf(b, AIM_JAILER)[0]!;
    const spider = identityOf(b.state, P2);
    expect(rejection(b, attack(spider, modok(), P2))).not.toBeNull(); // Guard
    playEvent(b, { target: jailer }, HAYMAKER, 2, P2);
    expect(hpLeft(b, jailer)).toBe(1);
    act(b, {}, attack(spider, jailer, P2));
    expect(inPlayIdsOf(b, AIM_JAILER)).toEqual([]);
    const events = act(b, {}, attack(ally("50108b"), modok(), P2));
    expect(ofType(events, "damageDealt")[0]).toMatchObject({ targetInstanceId: modok(), amount: 3 });
    expect(damageOn(b, modok())).toBe(3);
  });

  it("invariants: no prompt pending, no card in two zones, every encounter card (the Holding Cell deck, set-aside upgrades, discard) accounted for", () => {
    expectInvariants(b, baseline);
    expect(upgradesAside(b)).toEqual(["50110", "50111", "50112"]);
    expect(deckOfCells(b)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game C: solo, expert (M.O.D.O.K. (B), 2 upgrades), the attachment and the reset (owner decision Q3 = A)
// ---------------------------------------------------------------------------------------------------------------

const AUTOMATED_MOBILE_UNIT = "50114"; // M.O.D.O.K. gets +5 hit points; Forced Response: after his hit points are reset, discard this card

describe("M.O.D.O.K. scenario, game C: solo (Spider-Man), expert, seed 13: M.O.D.O.K. (B) with 14 hit points, two upgrades, Automated Mobile Unit and the reset (Q3 = A)", () => {
  const c = open([SPIDER_MAN], { seed: 13, difficulty: "expert" });
  const baseline = { encounter: encounterIdsOf(c.state), playerCards: playerCardIdsOf(c.state) };
  const spider = () => identityOf(c.state, P1);
  const modok = () => villainOf(c);

  it("setup (expert): M.O.D.O.K. (B) has 14 hit points, retaliate 2 and steady; 2 Adaptoid upgrades are in play (Sarah Garza and Strong), the other two set aside", () => {
    expect(codeOf(c.state, modok())).toBe("50103a");
    expect(c.state.villains[0]!.stageIndex).toBe(1);
    expect(maxHitPoints(c.state, modok(), DEPS)).toBe(14);
    expect(keywordsOf(c.state, modok(), DEPS)).toEqual([{ name: "retaliate", value: 2 }, { name: "steady" }]);
    expect(upgradesInPlay(c)).toEqual(["50111", "50112"]);
    expect(upgradesAside(c)).toEqual(["50109", "50110"]);
    // Both upgrades apply to the Adaptoid revealed at setup: +1 ATK each, Elite and Brute, toughness with its status card.
    const adaptoid = inPlayIdsOf(c, "50113")[0]!;
    expect(statBonus(c.state, DEPS, adaptoid, "atk")).toBe(2);
    expect(traitNames(c, adaptoid).sort()).toEqual(["ADAPTOID", "BRUTE", "ELITE"]);
    expect(inst(c.state, adaptoid).statuses.tough).toBe(1);
    expect(mainThreat(c)).toBe(1);
    expect(lockOn(c, cellOf(c))).toBe(2);
  });

  it("round 1 villain phase (alter-ego): M.O.D.O.K. (SCH 3) and 'It's Alive!' (3 icons) push the stage past its target of 7: its completion is replaced - a third upgrade enters (one of the two set aside) and the threat is reset", () => {
    const aside = upgradesAside(c);
    stack(c, ITS_ALIVE, ADVANCE, AUTOMATED_MOBILE_UNIT); // M.O.D.O.K.'s boost, the new villainous Adaptoid's boost, the card dealt
    const events = act(c, {}, endTurn());
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({ amount: 1 });
    expect(ofType(events, "schemeResolved")[0]).toMatchObject({
      enemyInstanceId: modok(),
      baseSch: 3,
      boostIcons: 3,
      threatPlaced: 6,
    });
    expect(ofType(events, "threatRemoved")[0]).toMatchObject({ schemeInstanceId: mainOf(c), amount: 8 }); // 1 + 1 + 6
    expect(c.state.mainScheme.stageIndex).toBe(0);
    expect(c.state.outcome).toBeNull();
    const entered = upgradesInPlay(c).filter((u) => !["50111", "50112"].includes(u));
    expect(entered).toHaveLength(1);
    expect(aside).toContain(entered[0]);
    expect(upgradesAside(c)).toHaveLength(1);
    // The Adaptoid then schemed for its own SCH 1 on the fresh stage (plus the new upgrade's effects).
    expect(mainThreat(c)).toBeGreaterThan(0);
  });

  it("round 1 villain phase: the dealt Automated Mobile Unit attaches to M.O.D.O.K. (Attach to M.O.D.O.K.): he has 14 + 5 = 19 hit points and +1 ATK", () => {
    const unit = inPlayIdsOf(c, AUTOMATED_MOBILE_UNIT)[0]!;
    expect(inst(c.state, unit).attachedTo).toBe(modok());
    expect(maxHitPoints(c.state, modok(), DEPS)).toBe(19);
    expect(statBonus(c.state, DEPS, modok(), "atk")).toBe(1);
    expect(damageOn(c, modok())).toBe(0);
  });

  it("round 2: two Swinging Web Kicks (8 + 8 = 16 of 19); Retaliate 2 costs Spider-Man 2 for each attack", () => {
    act(c, {}, toHero());
    playEvent(c, { target: modok() }, KICK, 3);
    expect(damageOn(c, modok())).toBe(8);
    playEvent(c, { target: modok() }, KICK, 3);
    expect(damageOn(c, modok())).toBe(16);
    expect(damageOn(c, spider())).toBe(4);
    expect(c.state.outcome).toBeNull();
  });

  it("Q3 = A, expert: Haymaker's 3 'would defeat' him (19 of 19); the Forced Interrupt resets him to 14 of 19 (dial at 14), Automated Mobile Unit leaves in response, and he ends at 9 remaining of 14 (5 damage); 2 lock counters free the Strong Inhuman cell", () => {
    const unit = inPlayIdsOf(c, AUTOMATED_MOBILE_UNIT)[0]!;
    const cell = cellOf(c)!;
    const events = playEvent(c, { target: modok() }, HAYMAKER, 2);
    expect(ofType(events, "characterDefeated")).toEqual([]);
    expect(ofType(events, "hitPointsSet")).toMatchObject([{ instanceId: modok(), remaining: 14, damage: 5 }]);
    expect(ofType(events, "cardDiscardedFromPlay").map((e) => e.instanceId)).toEqual([unit]);
    expect(inPlayIdsOf(c, AUTOMATED_MOBILE_UNIT)).toEqual([]);
    expect(piles(c.state).discard).toContain(unit);
    expect(maxHitPoints(c.state, modok(), DEPS)).toBe(14);
    expect(damageOn(c, modok())).toBe(5);
    expect(hpLeft(c, modok())).toBe(9);
    expect(c.state.villains[0]!.defeated).toBe(false);
    expect(statBonus(c.state, DEPS, modok(), "atk")).toBe(0);
    expect(codeOf(c.state, cell)).toBe("50108b");
    expect(inst(c.state, cell).controllerId).toBe(P1);
    expect(damageOn(c, spider())).toBe(6);
  });

  it("invariants: no prompt pending, no card in two zones, every encounter card and deck card accounted for", () => {
    expectInvariants(c, baseline);
    expect(upgradesAside(c)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game D: solo standard, three completions of the main scheme (alter-ego throughout)
// ---------------------------------------------------------------------------------------------------------------

describe("M.O.D.O.K. scenario, game D: solo, standard, seed 6, the main scheme completes three times (Flying Upgrade first)", () => {
  const d = open([SPIDER_MAN], { seed: 6 });
  const baseline = { encounter: encounterIdsOf(d.state), playerCards: playerCardIdsOf(d.state) };
  const modok = () => villainOf(d);
  /** One villain phase with Peter Parker in alter-ego form: M.O.D.O.K. schemes with "It's Alive!" (3 icons) as his boost card; A.I.M. Jailer is dealt. */
  const villainPhase = (dealt: readonly string[] = [AIM_JAILER]) => {
    stack(d, ITS_ALIVE, ...(upgradesInPlay(d).includes("50110") ? [ADVANCE] : []), ...dealt);
    return act(d, {}, endTurn());
  };

  it("setup: Flying Upgrade is the random upgrade; its incite 1 put 1 threat on the stage when the Adaptoid was revealed (1 + 1 = 2, target 7)", () => {
    expect(upgradesInPlay(d)).toEqual(["50109"]);
    expect(mainThreat(d)).toBe(2);
    expect(mainSchemeValue(d.state, "targetThreat", DEPS)).toBe(7);
    expect(playerOf(d.state, P1).identity.form).toBe("alterEgo");
  });

  it("first completion: 2 + 1 acceleration + M.O.D.O.K.'s scheme (SCH 2 + 3 icons = 5) is 8 of 7: instead a random set-aside upgrade (Sarah Garza) enters, all 8 threat leaves, nothing is lost", () => {
    const events = villainPhase();
    expect(ofType(events, "schemeResolved")[0]).toMatchObject({
      enemyInstanceId: modok(),
      baseSch: 2,
      boostIcons: 3,
      threatPlaced: 5,
    });
    expect(ofType(events, "threatRemoved")[0]).toMatchObject({ schemeInstanceId: mainOf(d), amount: 8 });
    expect(upgradesInPlay(d)).toEqual(["50109", "50111"]);
    expect(upgradesAside(d)).toEqual(["50110", "50112"]);
    expect(d.state.mainScheme.stageIndex).toBe(0);
    expect(codeOf(d.state, mainOf(d))).toBe("50104a");
    expect(d.state.outcome).toBeNull();
    // The new upgrade applies to the Adaptoid at once (Elite, +1 ATK); the Adaptoid then schemed for 2 on the cleared stage.
    const adaptoid = inPlayIdsOf(d, "50113")[0]!;
    expect(traitNames(d, adaptoid).sort()).toEqual(["ADAPTOID", "AERIAL", "ELITE"]);
    expect(statBonus(d.state, DEPS, adaptoid, "atk")).toBe(1);
    expect(mainThreat(d)).toBe(2);
  });

  it("first completion: the dealt A.I.M. Jailer finds no Rescued ally, so 1 lock counter goes on the Holding Cell (2 -> 3) and nobody is attacked", () => {
    const jailer = inPlayIdsOf(d, AIM_JAILER)[0]!;
    expect(inst(d.state, jailer).engagedWith).toBe(P1);
    expect(lockOn(d, cellOf(d))).toBe(3);
    expect(damageOn(d, identityOf(d.state, P1))).toBe(0);
  });

  it("second completion: Strong Upgrade enters (3 upgrades in play, 1 set aside)", () => {
    const events = villainPhase();
    expect(ofType(events, "threatRemoved")[0]).toMatchObject({ schemeInstanceId: mainOf(d), amount: 8 });
    expect(upgradesInPlay(d)).toEqual(["50109", "50111", "50112"]);
    expect(upgradesAside(d)).toEqual(["50110"]);
    expect(d.state.outcome).toBeNull();
    expect(lockOn(d, cellOf(d))).toBe(4);
  });

  it("third completion: the last set-aside upgrade (Psionic) enters and, none being left, the players lose the game (50104b)", () => {
    const events = villainPhase([]);
    expect(upgradesInPlay(d)).toEqual(["50109", "50110", "50111", "50112"]);
    expect(upgradesAside(d)).toEqual([]);
    expect(ofType(events, "gameEnded")).toMatchObject([
      { outcome: { result: "loss", reason: "cardAbility", sourceInstanceId: mainOf(d) } },
    ]);
    expect(d.state.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: mainOf(d) });
  });

  it("invariants: no prompt pending, no card in two zones, every encounter card (the four upgrades, the cells, Jailers) accounted for", () => {
    expectInvariants(d, baseline);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game E: solo, standard, the "+5 hit points" attachment at the reset (owner decision Q3 = A)
// ---------------------------------------------------------------------------------------------------------------

describe("M.O.D.O.K. scenario, game E: solo, standard, seed 1: Automated Mobile Unit and the reset (Q3 = A)", () => {
  const e = open([SPIDER_MAN]);
  const baseline = { encounter: encounterIdsOf(e.state), playerCards: playerCardIdsOf(e.state) };
  const modok = () => villainOf(e);

  it("round 1 villain phase (alter-ego): the dealt Automated Mobile Unit attaches to M.O.D.O.K.: 10 + 5 = 15 hit points, +1 ATK; he is undamaged", () => {
    stack(e, ADVANCE, AUTOMATED_MOBILE_UNIT);
    act(e, {}, endTurn());
    const unit = inPlayIdsOf(e, AUTOMATED_MOBILE_UNIT)[0]!;
    expect(inst(e.state, unit).attachedTo).toBe(modok());
    expect(maxHitPoints(e.state, modok(), DEPS)).toBe(15);
    expect(statBonus(e.state, DEPS, modok(), "atk")).toBe(1);
    expect(hpLeft(e, modok())).toBe(15);
    expect(e.state.outcome).toBeNull();
  });

  it("round 2: two Swinging Web Kicks (16 of 15) 'would defeat' him: he is reset to 10 of 15, the attachment leaves, and he ends at 5 remaining of 10 (Q3 = A); the cell's 2 lock counters free Strong Inhuman", () => {
    act(e, {}, toHero());
    const unit = inPlayIdsOf(e, AUTOMATED_MOBILE_UNIT)[0]!;
    const cell = cellOf(e)!;
    playEvent(e, { target: modok() }, KICK, 3);
    expect(damageOn(e, modok())).toBe(8);
    expect(hpLeft(e, modok())).toBe(7);
    const events = playEvent(e, { target: modok() }, KICK, 3);
    expect(ofType(events, "characterDefeated")).toEqual([]);
    // The dial reads 10 at the reset itself (15 maximum, 5 damage); the attachment's response then lowers the maximum.
    expect(ofType(events, "hitPointsSet")).toMatchObject([{ instanceId: modok(), remaining: 10, damage: 5 }]);
    expect(ofType(events, "cardDiscardedFromPlay").map((x) => x.instanceId)).toEqual([unit]);
    expect(maxHitPoints(e.state, modok(), DEPS)).toBe(10);
    expect(damageOn(e, modok())).toBe(5);
    expect(hpLeft(e, modok())).toBe(5);
    expect(codeOf(e.state, cell)).toBe("50108b");
    expect(e.state.villains[0]!.defeated).toBe(false);
  });

  it("round 2: the next reset, with nothing attached, takes him from 5 back to the printed 10 (no damage) and frees the second cell", () => {
    const cell = cellOf(e)!;
    expect(codeOf(e.state, cell)).toBe("50106a");
    const events = playEvent(e, { target: modok() }, KICK, 3);
    expect(ofType(events, "hitPointsSet")).toMatchObject([{ instanceId: modok(), remaining: 10, damage: 0 }]);
    expect(damageOn(e, modok())).toBe(0);
    expect(hpLeft(e, modok())).toBe(10);
    expect(codeOf(e.state, cell)).toBe("50106b");
    expect(damageOn(e, identityOf(e.state, P1))).toBe(3); // Retaliate 1 for each of the three Kicks
    expect(e.state.outcome).toBeNull();
  });

  it("invariants: no prompt pending, no card in two zones, every encounter card and deck card accounted for", () => {
    expectInvariants(e, baseline);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game F: solo, standard, the Scientist Supreme set as its cards come up
// ---------------------------------------------------------------------------------------------------------------

const MONICA = "50126";
const SCIENTIST_SUPREME_CARD = "50125";
const DIPLOMATIC_SANCTIONS = "50128";

describe("M.O.D.O.K. scenario, game F: solo, standard, seed 6: the Scientist Supreme set", () => {
  const f = open([SPIDER_MAN], { seed: 6 });
  const baseline = { encounter: encounterIdsOf(f.state), playerCards: playerCardIdsOf(f.state) };
  const spider = () => identityOf(f.state, P1);
  const monica = () => inPlayIdsOf(f, MONICA)[0]!;
  const supreme = () => inPlayIdsOf(f, SCIENTIST_SUPREME_CARD)[0]!;

  it("round 1: Haymaker and a basic attack kill the Adaptoid (5 hit points); its When Defeated takes 1 lock counter off the Holding Cell (2 -> 1)", () => {
    act(f, {}, toHero());
    const adaptoid = inPlayIdsOf(f, "50113")[0]!;
    const cell = cellOf(f)!;
    playEvent(f, { target: adaptoid }, HAYMAKER, 2);
    expect(hpLeft(f, adaptoid)).toBe(2);
    const events = act(f, {}, attack(spider(), adaptoid));
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: adaptoid }]);
    expect(ofType(events, "counterRemoved")).toMatchObject([{ instanceId: cell, counterType: "lock", amount: 1 }]);
    expect(lockOn(f, cell)).toBe(1);
  });

  it("round 1 villain phase: Monica Rappaccini is dealt and engages Spider-Man; with Scientist Supreme not in the victory display she is Victory -1 and Vulnerable but not villainous", () => {
    stack(f, ADVANCE, MONICA);
    act(f, {}, endTurn());
    expect(inst(f.state, monica()).engagedWith).toBe(P1);
    expect(keywordNames(f, monica()).sort()).toEqual(["victory", "vulnerable"]);
    expect(f.state.victoryDisplay).toEqual([]);
  });

  it("round 2 villain phase: Scientist Supreme (Victory -1, Villainous, Vulnerable) is dealt and engages Spider-Man", () => {
    stack(f, ADVANCE, SCIENTIST_SUPREME_CARD);
    const events = act(f, {}, endTurn());
    expect(inst(f.state, supreme()).engagedWith).toBe(P1);
    expect(keywordNames(f, supreme()).sort()).toEqual(["victory", "villainous", "vulnerable"]);
    expect(maxHitPoints(f.state, supreme(), DEPS)).toBe(6);
    // Monica attacked (ATK 1) with no boost card: she is not villainous yet.
    expect(ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === monica())).toMatchObject([
      { baseAtk: 1, boostIcons: 0, damageDealt: 1 },
    ]);
    expect(ofType(events, "boostCardDealt")).toHaveLength(1); // M.O.D.O.K.'s only
  });

  it("round 3: Swinging Web Kick defeats Scientist Supreme (8 of 6): he goes to the victory display, and Monica Rappaccini becomes villainous (while Scientist Supreme is there)", () => {
    const events = playEvent(f, { target: supreme() }, KICK, 3);
    expect(ofType(events, "characterDefeated")).toMatchObject([{ cardId: SCIENTIST_SUPREME_CARD }]);
    expect(f.state.victoryDisplay.map((i) => codeOf(f.state, i))).toEqual([SCIENTIST_SUPREME_CARD]);
    expect(inPlayIdsOf(f, SCIENTIST_SUPREME_CARD)).toEqual([]);
    expect(keywordNames(f, monica()).sort()).toEqual(["victory", "villainous", "vulnerable"]);
  });

  it("round 3 villain phase: Monica, now villainous, is given a boost card; Diplomatic Sanctions (Surge) makes Spider-Man discard 1 card (1 A.I.M. minion in the victory display), then Diplomatic Immunity enters with 1 acceleration token", () => {
    stack(f, ADVANCE, ASSAULT, DIPLOMATIC_SANCTIONS, DIPLOMATIC_IMMUNITY);
    const events = act(f, {}, endTurn());
    const boosted = ofType(events, "boostCardDealt").map((e) => e.enemyInstanceId);
    expect(boosted).toEqual([modokId(f), monica()]);
    const sanctions = ofType(events, "encounterCardRevealed")[0]!;
    expect(codeOf(f.state, sanctions.instanceId)).toBe(DIPLOMATIC_SANCTIONS);
    // Exactly one card is discarded from hand after the Sanctions are revealed (1 A.I.M. minion in the victory display).
    const afterReveal = events.slice(events.findIndex((e) => e.type === "encounterCardRevealed"));
    expect(ofType(afterReveal, "cardDiscardedFromHand")).toHaveLength(1);
    expect(ofType(events, "surgeTriggered")).toHaveLength(1);
    const immunity = inPlayIdsOf(f, DIPLOMATIC_IMMUNITY)[0]!;
    expect(inst(f.state, immunity).threat).toBe(3);
    expect(inst(f.state, immunity).counters.acceleration).toBe(1);
  });

  it("round 4 villain phase: the acceleration token adds to the threat step (1 + Diplomatic Immunity's icon + 1 token = 3)", () => {
    stack(f, ADVANCE, ASSAULT);
    const events = act(f, {}, endTurn());
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(f), amount: 3 });
  });

  it("invariants: no prompt pending, no card in two zones, every encounter card (victory display included) accounted for", () => {
    expectInvariants(f, baseline);
    expect(f.state.victoryDisplay).toHaveLength(1);
  });
});

const modokId = (sim: Sim): InstanceId => sim.state.villains[0]!.instanceId;

// ---------------------------------------------------------------------------------------------------------------
// What the games do not prove
// ---------------------------------------------------------------------------------------------------------------

describe("not played in a whole game", () => {
  it.todo(
    "Q5 = A end to end: no Core starter card answers 'After [enemy] attacks you', so game B proves only that A.I.M. Jailer's attack on an ally is an attack on the ally's controller (who is offered the defense); a responder needs a custom deck",
  );
  it.todo(
    "Scientist Supreme's attacks gain piercing and ranged (50125): no tough status card or retaliate was in play when he attacked; unit tests only (scientist-supreme.test.ts)",
  );
  it.todo(
    "Focusing Crystal, Nanobots, Psionic Force Field, Psionic Machetes and Reverse Engineering revealed in a game, Psionic Blast and 'It's Alive!' revealed (it was only a boost card here): unit tests only (modok.test.ts)",
  );
  it.todo(
    "expert: the second completion of the main scheme loses (only the standard third completion is played, game D)",
  );
  it.todo("three and four players: 6 and 8 lock counters per cell, three or four Adaptoids revealed at setup");
  it.todo(
    "a freed ally that is the hostage of Hostage Situation being defeated (it then goes under the Holding Cell deck): unit tests only",
  );
});
