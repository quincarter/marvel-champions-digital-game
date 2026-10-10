import { AOS_CARDS, CORE_CARDS } from "@mc/content";
import {
  applyCommand,
  createGame,
  keywordTotal,
  mainSchemeValue,
  maxHitPoints,
  remainingHitPoints,
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
  payWith,
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
import { IRON_MAN, SPIDER_MAN, codeOf, inPlayCard, piles } from "../testing.js";
import { AIM_ABDUCTION } from "./aim-abduction.js";
import { AIM_SCIENCE } from "./aim-science.js";
import { BLACK_WIDOW } from "./black-widow.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * Whole-game tests of the Black Widow scenario (MC50 p. 9, docs/phase7-wave9.md section 2.2 and section 8.4 "Black Widow
 * scenario game"): the real `wave9Scenario("black-widow")` builder (its recommended modular sets A.I.M. Abduction and
 * A.I.M. Science, Standard, and Expert in expert mode), played through the engine's real commands, one decision at a
 * time, deterministic by seed (1). Only the encounter deck's order (`stackEncounterDeck`) and the cards a turn needs in
 * hand (`moveToHand`) are seeded; every attack, play, thwart and prompt answer is a command the engine validates.
 * RRG 1.8 = mc_rulesreference_v18_compressed.md; rulings = marvel-champions-rulings-post-rrg-1-7.md.
 *
 * Games:
 * - A (solo, standard, Core Spider-Man, to a win): setup (the Scientist chosen); her Forced Interrupt on a basic attack
 *   (Gauntlet attaches, retaliate), on an event attack (Grappling Hook: an event discarded), on an ally attack with the
 *   main scheme at 0 (no discard; the Gauntlet's response discards it); a Vulnerable A.I.M. minion discarded by a stun;
 *   A.I.M. Abductor tucking the only ally under Abduct Superhumans, and the ally back when it is defeated; stage I to II
 *   (Widow's Bite stuns the attacker; When Revealed threat); a stunned hero's attack is not an attack on her
 *   (RRG "Stun, Stunned"); Dance of Death and Covert Ops; the win at her last stage.
 * - B (two players): the per-player numbers; the chosen Guard blocks only its engaged player (RRG "Guard"); the second
 *   player's attack resolves a Preparation for that player; the villain phase's activations; Night Vision Goggles and
 *   Automated Defenses both granting a Preparation, the attacker ordering them; Stun Net attaching and any player
 *   discarding it.
 * - C (expert, solo): stage II to III; Attacrobatics' expert clause; A.I.M. Commando's Preparation answered by
 *   quickstrike; A.I.M. Grunt taking the whole attack (January 17, 2026 - Ruling 2, Q4 = A).
 * - D (solo): the loss by the main scheme.
 *
 * The tally of what the games leave unproven is at the end of the file (`it.todo`).
 */
const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE8_ABILITIES, BLACK_WIDOW, AIM_ABDUCTION, AIM_SCIENCE),
};

// Core cards
const ADVANCE = "01186"; // boost 0, When Revealed: the villain schemes
const ASSAULT = "01187"; // boost 0, no Preparation; When Revealed (hero): the villain attacks you
const SWINGING_WEB_KICK = "01005"; // Hero Action (attack): 8 damage to an enemy, cost 3
const HAYMAKER = "01087"; // Hero Action (attack): 3 damage to an enemy, cost 2
const SUPERSONIC_PUNCH = "01032"; // Hero Action (attack): 4 damage to an enemy, cost 2
const FOR_JUSTICE = "01060"; // Hero Action (thwart): remove 3 threat (4 if paid with a mental resource), cost 2
const GREAT_RESPONSIBILITY = "01061"; // a mental resource
const EMERGENCY = "01085";
const BACKFLIP = "01003"; // an event
const FIRST_AID = "01086"; // an event
const MOCKINGBIRD = "01083"; // Response: after she enters play, stun an enemy
// Wave 9 cards
const GAUNTLET = "50068";
const HOOK = "50069";
const GOGGLES = "50070";
const NET = "50071";
const COMMANDO = "50072";
const GRUNT = "50073";
const DEFENSES = "50074";
const DESTROY_EVIDENCE = "50075";
const ATTACROBATICS = "50076";
const COVERT_OPS = "50077";
const DANCE_OF_DEATH = "50078";
const BITE = "50079";
const ABDUCTOR = "50080";
const ABDUCT = "50081";
const SCIENTIST = "50083";
const SOLDIER = "50084";

// ---------------------------------------------------------------------------------------------------------------
// A small driver
// ---------------------------------------------------------------------------------------------------------------

interface Sim {
  state: GameState;
}

interface Plan {
  /** An optional trigger whose id contains this text is taken; every other optional trigger is declined. */
  readonly take?: string;
  /** A `chooseTarget` option among these (any of them, in any order of the prompt) is chosen. */
  readonly targets?: readonly InstanceId[];
  /** Names of the minions chosen at setup, in the order the prompts come (each consumed once). */
  readonly minions?: string[];
  /** An `orderSpecials` option whose id contains this text goes first. */
  readonly first?: string;
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
      case "declareDefender":
        return ["decline"];
      case "chooseTarget": {
        const hit = offered.find((o) => plan.targets?.includes(o.optionId as InstanceId));
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "chooseCards": {
        // The setup search ("each player chooses a minion"): the first listed name still wanted.
        const hit = plan.minions ? offered.find((o) => plan.minions![0] === o.label) : undefined;
        if (hit) plan.minions!.shift();
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "orderSpecials": {
        const hit = plan.first ? offered.find((o) => (o.optionId as string).includes(plan.first!)) : undefined;
        if (!hit) return firstLegal(s);
        return [hit, ...offered.filter((o) => o !== hit)].slice(0, choice.minSelections).map((o) => o.optionId);
      }
      default:
        return firstLegal(s);
    }
  };

type Seat = typeof SPIDER_MAN | typeof IRON_MAN;

/** Plays the scenario past setup (to the first player turn); each player's setup minion is chosen by name. */
function open(players: readonly Seat[], minions: readonly string[], mode: "standard" | "expert" = "standard"): Sim {
  const config = wave9Scenario("black-widow", {
    players,
    seed: 1,
    ...(mode === "expert" ? { difficulty: "expert" as const } : {}),
  });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return { state: settle(created.state, planner({ minions: [...minions] }), (s) => s.step.phase === "player", DEPS) };
}

/** Runs commands, answering each prompt by `plan`, and returns only the events they produced. */
function act(sim: Sim, plan: Plan, ...commands: readonly Command[]): GameEvent[] {
  const r = driveEventsPicking(DEPS, sim.state, planner(plan), ...commands);
  sim.state = r.state;
  return [...r.events];
}

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** The index of the first event of this type (and, when given, matching) in the list; -1 when none. */
const indexOf = (events: readonly GameEvent[], type: GameEvent["type"], match: Record<string, unknown> = {}): number =>
  events.findIndex((e) => e.type === type && Object.entries(match).every(([k, v]) => (e as never)[k] === v));
const resolvedIds = (events: readonly GameEvent[]): string[] =>
  ofType(events, "abilityResolved").map((e) => e.abilityId);

const give = (sim: Sim, player: PlayerId, ...codes: string[]) => {
  sim.state = moveToHand(sim.state, player, ...codes).state;
};
const stack = (sim: Sim, ...codes: string[]) => {
  sim.state = stackEncounterDeck(sim.state, ...codes);
};
const handOf = (sim: Sim, code: string, player: PlayerId = P1): InstanceId[] =>
  playerOf(sim.state, player).hand.filter((i) => codeOf(sim.state, i) === code);
const pay = (sim: Sim, n: number, exclude: readonly InstanceId[], player: PlayerId = P1) =>
  payWith(sim.state, player, n, exclude);

const villainOf = (sim: Sim): InstanceId => sim.state.villains[0]!.instanceId;
const mainOf = (sim: Sim): InstanceId => sim.state.mainScheme.instanceId;
const mainThreat = (sim: Sim): number => inst(sim.state, mainOf(sim)).threat;
const damageOn = (sim: Sim, id: InstanceId): number => inst(sim.state, id).damage;
const villainStage = (sim: Sim): number => sim.state.villains[0]!.stageIndex;
const widowHp = (sim: Sim): number => remainingHitPoints(sim.state, villainOf(sim), DEPS)!;
const attachedCodes = (sim: Sim, id: InstanceId): string[] =>
  inst(sim.state, id).attachments.map((i) => codeOf(sim.state, i));
const discardCodes = (sim: Sim): string[] => piles(sim.state).discard.map((i) => codeOf(sim.state, i));
const deckTop = (sim: Sim): string => codeOf(sim.state, piles(sim.state).deck[0]!);
const playAreaCodes = (sim: Sim, player: PlayerId = P1): string[] =>
  playerOf(sim.state, player).playArea.map((i) => codeOf(sim.state, i));

const attack = (by: InstanceId, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: by,
  targetInstanceId: target,
});
const thwart = (by: InstanceId, scheme: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: by,
  schemeInstanceId: scheme,
});
const toHero = (player: PlayerId = P1): Command => ({ type: "changeForm", playerId: player });

/** The error a command would be rejected with, or null when it is legal (the state is not changed). */
const rejection = (sim: Sim, command: Command): string | null => {
  const r = applyCommand(sim.state, command, DEPS);
  return r.ok ? null : r.error.code;
};

/** The player plays `code` from hand (seeded if needed), paying with the first `cost` other cards in hand. */
const playEvent = (sim: Sim, code: string, cost: number, player: PlayerId = P1): Command => {
  const [card] = handOf(sim, code, player);
  return play(player, card!, pay(sim, cost, handOf(sim, code, player), player));
};

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
 * The closing invariants of every game: no unanswered prompt, no card instance in two zones, every encounter card and
 * every card a deck started with still somewhere (RRG "Owner", p. 31; "Choices").
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
  // An attachment still in play is on a card that is in play (never left hanging on a discarded host).
  for (const [id, instance] of Object.entries(s.instances))
    if (instance.attachedTo !== null) expect(s.instances[instance.attachedTo]?.attachments).toContain(id);
}

const countsOf = (s: GameState): Record<string, number> => {
  const count: Record<string, number> = {};
  for (const id of piles(s).deck) count[codeOf(s, id)] = (count[codeOf(s, id)] ?? 0) + 1;
  return count;
};

const nameOfCode = (code: string): string => [...AOS_CARDS, ...CORE_CARDS].find((c) => c.id === code)!.name;

// ---------------------------------------------------------------------------------------------------------------
// Game A: solo, standard, Core Spider-Man, to a win
// ---------------------------------------------------------------------------------------------------------------

describe("Black Widow scenario, game A: solo (Spider-Man), standard, seed 1, played to a win", () => {
  const a = open([SPIDER_MAN], ["A.I.M. Scientist"]);
  const baseline = { encounter: encounterIdsOf(a.state), playerCards: playerCardIdsOf(a.state) };
  const spider = () => identityOf(a.state, P1);
  const widow = () => villainOf(a);

  it("setup (MC50 p. 9): the player chose the Scientist and it engaged them; 2 threat per player, X = stage 1, 13 hit points", () => {
    expect(a.state.players).toHaveLength(1);
    expect(playerOf(a.state, P1).identity.form).toBe("alterEgo");
    // 50067a Setup: "Each player searches the encounter deck for a minion and puts it into play engaged with them."
    // Put into play, not revealed: nothing was discarded and no When Revealed or surge ran.
    const scientist = inPlayCard(a.state, SCIENTIST)!;
    expect(inst(a.state, scientist).engagedWith).toBe(P1);
    expect(playAreaCodes(a)).toEqual([SCIENTIST]);
    expect(piles(a.state).discard).toEqual([]);
    expect(a.state.encounterSetAside).toEqual([]);
    // 1B: starts with 2[per_hero] threat, target 10[per_hero]; X = Black Widow's stage number per hero.
    expect(codeOf(a.state, mainOf(a))).toBe("50067a");
    expect(mainThreat(a)).toBe(2);
    expect(mainSchemeValue(a.state, "targetThreat", DEPS)).toBe(10);
    expect(mainSchemeValue(a.state, "acceleration", DEPS)).toBe(1);
    // Standard mode: Black Widow (I), 13 hit points per player.
    expect(codeOf(a.state, widow())).toBe("50064");
    expect(villainStage(a)).toBe(0);
    expect(a.state.villains[0]!.lastStageIndex).toBe(1);
    expect(maxHitPoints(a.state, widow(), DEPS)).toBe(13);
    expect(a.state.round).toBe(1);
    expect(a.state.firstPlayerId).toBe(P1);
    expect(a.state.pendingChoice).toBeNull();
  });

  it("setup: the encounter deck is 36 cards by set: Black Widow 19, A.I.M. Abduction 5, A.I.M. Science 4 (the Scientist is in play), Standard 7, Spider-Man's obligation 1", () => {
    const deck = piles(a.state).deck;
    expect(deck).toHaveLength(36);
    expect(countsOf(a.state)).toEqual({
      // Black Widow (19): Gauntlet 2, Hook, Goggles, Net, Commando 2, Grunt 2, Defenses, Destroy Evidence, Attacrobatics 2,
      // Covert Ops 2, Dance of Death 2, Widow's Bite 2
      "50068": 2,
      "50069": 1,
      "50070": 1,
      "50071": 1,
      "50072": 2,
      "50073": 2,
      "50074": 1,
      "50075": 1,
      "50076": 2,
      "50077": 2,
      "50078": 2,
      "50079": 2,
      // A.I.M. Abduction (5): Abductor 2, Abduct Superhumans, Nabbed! 2
      "50080": 2,
      "50081": 1,
      "50082": 2,
      // A.I.M. Science (5, less the Scientist): Soldier 3, Mad Science
      "50084": 3,
      "50085": 1,
      // Standard (7): Advance 2, Assault 2, Caught Off Guard, Gang-Up, Shadow of the Past; Spider-Man's obligation
      "01186": 2,
      "01187": 2,
      "01188": 1,
      "01189": 1,
      "01190": 1,
      "01165": 1,
    });
    // Never in the deck: the villain, the main scheme, and the Expert set (standard mode).
    for (const never of ["50064", "50065", "50066", "50067a", "50067b", "01191", "01192", "01193"])
      expect(Object.keys(countsOf(a.state))).not.toContain(never);
    expect(nameOfCode(ABDUCT)).toBe("Abduct Superhumans");
  });

  it("round 1: a basic attack on her. Forced Interrupt before the damage: 1 threat off the main scheme (2 -> 1), the top card (Gauntlet) discarded, its Preparation attaches it to her; retaliate 1 answers", () => {
    stack(a, GAUNTLET, HOOK);
    act(a, {}, toHero());
    const events = act(a, {}, attack(spider(), widow()));
    // The interrupt's removal is hers (source: Black Widow), then the discard, the Preparation, then the attack's damage.
    expect(ofType(events, "threatRemoved")).toMatchObject([
      { schemeInstanceId: mainOf(a), amount: 1, sourceInstanceId: widow() },
    ]);
    const removal = indexOf(events, "threatRemoved");
    const discarded = events.findIndex(
      (e) => e.type === "cardMoved" && e.cardId === GAUNTLET && e.to.kind === "encounterDiscard",
    );
    const prep = indexOf(events, "abilityResolved", { abilityId: "50068.preparation" });
    const hit = indexOf(events, "damageDealt", { targetInstanceId: widow() });
    expect([removal, discarded, prep, hit].every((i) => i >= 0)).toBe(true);
    expect(removal).toBeLessThan(discarded);
    expect(discarded).toBeLessThan(prep);
    expect(prep).toBeLessThan(hit);
    expect(mainThreat(a)).toBe(1);
    expect(attachedCodes(a, widow())).toEqual([GAUNTLET]);
    expect(discardCodes(a)).not.toContain(GAUNTLET);
    expect(deckTop(a)).toBe(HOOK);
    // Spider-Man's ATK 2 lands; the Gauntlet gives her retaliate 1 and Spider-Man takes 1.
    expect(damageOn(a, widow())).toBe(2);
    expect(keywordTotal(a.state, widow(), "retaliate", DEPS)).toBe(1);
    expect(damageOn(a, spider())).toBe(1);
    // The Gauntlet stays: a Preparation was resolved (its response was offered and declined).
    expect(a.state.pendingChoice).toBeNull();
  });

  it("round 1: Swinging Web Kick is an attack too. Grappling Hook (top): the attacking player discards an event from hand; the Hook is discarded, not attached; 1 -> 0 threat", () => {
    give(a, P1, SWINGING_WEB_KICK, BACKFLIP);
    const [backflip] = handOf(a, BACKFLIP);
    const events = act(a, {}, playEvent(a, SWINGING_WEB_KICK, 3));
    expect(resolvedIds(events)).toEqual(
      expect.arrayContaining(["50064.black-widow-forced-interrupt", "50069.preparation"]),
    );
    expect(mainThreat(a)).toBe(0);
    expect(discardCodes(a)).toContain(HOOK);
    expect(attachedCodes(a, widow())).toEqual([GAUNTLET]); // the Hook's Preparation does not attach it
    // The one event in hand (Backflip) was discarded to Spider-Man's discard pile.
    expect(playerOf(a.state, P1).hand).not.toContain(backflip);
    expect(playerOf(a.state, P1).discard).toContain(backflip);
    expect(damageOn(a, widow())).toBe(10); // 2 + 8
    expect(damageOn(a, spider())).toBe(2); // retaliate again
  });

  it("round 1: Mockingbird's response stuns the Vulnerable Scientist and it is discarded, not defeated (RRG 'Vulnerable')", () => {
    give(a, P1, MOCKINGBIRD);
    const [mocking] = handOf(a, MOCKINGBIRD);
    const scientist = inPlayCard(a.state, SCIENTIST)!;
    const events = act(a, { take: "mockingbird", targets: [scientist] }, playEvent(a, MOCKINGBIRD, 3));
    expect(ofType(events, "statusGiven")).toMatchObject([{ instanceId: scientist, status: "stunned" }]);
    expect(ofType(events, "vulnerableDiscarded")).toMatchObject([{ instanceId: scientist }]);
    expect(ofType(events, "characterDefeated")).toEqual([]);
    expect(inPlayCard(a.state, SCIENTIST)).toBeUndefined();
    expect(discardCodes(a)).toContain(SCIENTIST);
    expect(playAreaCodes(a)).toEqual([MOCKINGBIRD]);
    expect(playerOf(a.state, P1).playArea).toEqual([mocking]);
  });

  it("round 1: an ally attacks her with the main scheme at 0. The Forced Interrupt removes nothing and discards nothing; retaliate, then the Gauntlet's response discards it (no Preparation resolved)", () => {
    const mocking = inPlayCard(a.state, MOCKINGBIRD)!;
    const top = deckTop(a);
    const discardBefore = piles(a.state).discard.length;
    const events = act(a, { take: "gauntlet" }, attack(mocking, widow()));
    // MC50 p. 9: "If no threat is removed, then the rest of her ability does not resolve."
    expect(resolvedIds(events)).toContain("50064.black-widow-forced-interrupt");
    expect(ofType(events, "threatRemoved")).toEqual([]);
    expect(mainThreat(a)).toBe(0);
    expect(deckTop(a)).toBe(top);
    // Only the Gauntlet joined the discard pile (by its own response).
    expect(piles(a.state).discard).toHaveLength(discardBefore + 1);
    expect(discardCodes(a)).toContain(GAUNTLET);
    expect(attachedCodes(a, widow())).toEqual([]);
    expect(damageOn(a, widow())).toBe(11); // + Mockingbird's ATK 1
    expect(widowHp(a)).toBe(2);
    // "after resolving the retaliate keyword": retaliate 1 (from the Gauntlet) came before the response discarded it.
    const retaliation = indexOf(events, "damageDealt", { targetInstanceId: mocking, sourceInstanceId: widow() });
    const response = indexOf(events, "abilityResolved", { abilityId: "50068.black-widows-gauntlet-response" });
    expect(retaliation).toBeGreaterThanOrEqual(0);
    expect(retaliation).toBeLessThan(response);
    // Retaliate 1 plus Mockingbird's own consequential damage 1.
    expect(damageOn(a, mocking)).toBe(2);
  });

  it("round 1 villain phase: +1 acceleration; she attacks (ATK 1, the Gauntlet is gone); A.I.M. Abductor tucks Mockingbird (the only ally) under Abduct Superhumans, found and put into play with its threat", () => {
    stack(a, ADVANCE, ABDUCTOR); // her boost card (0 icons), then the card dealt to the player
    const events = act(a, {}, endTurn());
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({
      schemeInstanceId: mainOf(a),
      amount: 1,
      sourceInstanceId: null,
    });
    expect(ofType(events, "attackResolved")).toMatchObject([
      { enemyInstanceId: widow(), targetInstanceId: spider(), baseAtk: 1, boostIcons: 0, damageDealt: 1 },
    ]);
    expect(damageOn(a, spider())).toBe(3);
    // Only the Abductor was revealed: Abduct Superhumans was found and put into play, so its surge did not apply.
    expect(ofType(events, "encounterCardRevealed")).toMatchObject([{ cardId: ABDUCTOR }]);
    const abduct = inPlayCard(a.state, ABDUCT)!;
    const mocking = playerOf(a.state, P1).discard.length >= 0 ? inst(a.state, abduct).tucked[0]! : undefined;
    expect(codeOf(a.state, mocking!)).toBe(MOCKINGBIRD);
    expect(inst(a.state, abduct).tucked).toEqual([mocking]);
    // 2[per_hero] on entering + Mockingbird's cost 3 = 5; 1 acceleration token on the side scheme.
    expect(inst(a.state, abduct).threat).toBe(5);
    expect(inst(a.state, abduct).counters).toMatchObject({ acceleration: 1 });
    expect(playAreaCodes(a)).toEqual([ABDUCTOR]);
    expect(inst(a.state, inPlayCard(a.state, ABDUCTOR)!).engagedWith).toBe(P1);
    expect(mainThreat(a)).toBe(1);
    expect(a.state.round).toBe(2);
    expect(a.state.pendingChoice).toBeNull();
  });

  it("round 2: thwarting Abduct Superhumans (1, then For Justice! paid with a mental resource for 4) defeats it: Mockingbird returns ready and undamaged, her response stuns the Abductor, the acceleration token leaves", () => {
    const abduct = inPlayCard(a.state, ABDUCT)!;
    const abductor = inPlayCard(a.state, ABDUCTOR)!;
    act(a, {}, thwart(spider(), abduct));
    expect(inst(a.state, abduct).threat).toBe(4);
    give(a, P1, FOR_JUSTICE, GREAT_RESPONSIBILITY, EMERGENCY);
    const [fj] = handOf(a, FOR_JUSTICE);
    const events = act(
      a,
      { take: "mockingbird", targets: [abduct, abductor] },
      play(P1, fj!, [handOf(a, GREAT_RESPONSIBILITY)[0]!, handOf(a, EMERGENCY)[0]!]),
    );
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: abduct, amount: 4 }]);
    expect(ofType(events, "schemeDefeated")).toMatchObject([{ instanceId: abduct }]);
    const mocking = inPlayCard(a.state, MOCKINGBIRD)!;
    expect(inst(a.state, mocking)).toMatchObject({ exhausted: false, damage: 0, controllerId: P1 });
    expect(inPlayCard(a.state, ABDUCT)).toBeUndefined();
    // RRG "Acceleration Token": tokens on another card leave play with it.
    expect(a.state.mainScheme.accelerationTokens).toBe(0);
    expect(Object.values(a.state.instances).filter((i) => (i.counters as Record<string, number>).acceleration)).toEqual(
      [],
    );
    // Entering play again, her response is offered again and stunned the Abductor.
    expect(ofType(events, "statusGiven")).toMatchObject([{ instanceId: abductor, status: "stunned" }]);
    expect(mainThreat(a)).toBe(1);
  });

  it("round 2: Haymaker with Widow's Bite on top. 1 -> 0 threat; the 3 damage defeats stage I (2 left); stage II enters with 2 threat; after the attack the attacker is stunned", () => {
    stack(a, BITE);
    give(a, P1, HAYMAKER);
    const events = act(a, {}, playEvent(a, HAYMAKER, 2));
    expect(ofType(events, "villainStageAdvanced")).toMatchObject([{ stageIndex: 1, instanceId: widow() }]);
    // Stage II: "Place 2[per_hero] threat on the main scheme" after the removal of 1 (0 + 2).
    expect(ofType(events, "threatPlaced")).toMatchObject([
      { schemeInstanceId: mainOf(a), amount: 2, sourceInstanceId: widow() },
    ]);
    expect(mainThreat(a)).toBe(2);
    expect(villainStage(a)).toBe(1);
    expect(a.state.outcome).toBeNull();
    expect(maxHitPoints(a.state, widow(), DEPS)).toBe(16);
    expect(damageOn(a, widow())).toBe(0);
    expect(mainSchemeValue(a.state, "acceleration", DEPS)).toBe(2); // X = 2
    expect(discardCodes(a)).toContain(BITE);
    // "After this attack, stun the attacking character": after the damage, on Spider-Man.
    expect(inst(a.state, spider()).statuses.stunned).toBe(1);
    const stun = indexOf(events, "statusGiven", { instanceId: spider() });
    expect(stun).toBeGreaterThan(indexOf(events, "damageDealt", { targetInstanceId: widow() }));
  });

  it("round 2 villain phase (stage II): +2 acceleration; her boost Widow's Bite is not resolved as a Preparation; the stunned Abductor's attack is replaced by removing the stun; Advance makes her scheme", () => {
    stack(a, BITE, ADVANCE, ASSAULT); // boost for her attack, the dealt card, the boost for the scheme it causes
    const events = act(a, {}, endTurn());
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({
      schemeInstanceId: mainOf(a),
      amount: 2,
      sourceInstanceId: null,
    });
    // Stage II: ATK 2 + the 2 boost icons on Widow's Bite; its Preparation is not a Boost ability.
    expect(ofType(events, "attackResolved")).toMatchObject([
      { enemyInstanceId: widow(), baseAtk: 2, boostIcons: 2, damageDealt: 4 },
    ]);
    expect(resolvedIds(events)).not.toContain("50079.preparation");
    expect(inst(a.state, spider()).statuses.stunned).toBe(1); // still stunned: a boost card does not stun
    expect(ofType(events, "enemyActivated").filter((e) => e.enemyInstanceId !== widow())).toHaveLength(1);
    expect(ofType(events, "schemeResolved")).toMatchObject([{ enemyInstanceId: widow(), baseSch: 2, threatPlaced: 2 }]);
    expect(mainThreat(a)).toBe(6); // 2 + 2 acceleration + 2 scheme
    expect(damageOn(a, spider())).toBe(7); // 3 + 4
    expect(a.state.round).toBe(3);
  });

  it("round 3: a stunned hero's Swinging Web Kick is not an attack: the stun is removed, her Forced Interrupt does not fire (RRG 'Stun, Stunned': 'not considered to have attacked')", () => {
    give(a, P1, SWINGING_WEB_KICK, SWINGING_WEB_KICK, SWINGING_WEB_KICK, "01007", "01007", "01008", "01093", "01002");
    stack(a, DANCE_OF_DEATH, COVERT_OPS);
    expect(inst(a.state, spider()).statuses.stunned).toBe(1);
    const threat = mainThreat(a);
    const events = act(a, {}, playEvent(a, SWINGING_WEB_KICK, 3));
    expect(ofType(events, "statusRemoved")).toMatchObject([
      { instanceId: spider(), status: "stunned", reason: "cancelledAttack" },
    ]);
    expect(resolvedIds(events)).not.toContain("50065.black-widow-forced-interrupt");
    expect(mainThreat(a)).toBe(threat);
    expect(deckTop(a)).toBe(DANCE_OF_DEATH);
    expect(damageOn(a, widow())).toBe(0);
    expect(inst(a.state, spider()).statuses.stunned).toBe(0);
  });

  it("round 3: the second Kick. Stage II's interrupt (1 threat off, Dance of Death discarded): its Preparation deals 1 damage to each character Spider-Man controls", () => {
    const mocking = inPlayCard(a.state, MOCKINGBIRD)!;
    const threat = mainThreat(a);
    const hurt = [damageOn(a, spider()), damageOn(a, mocking)];
    const events = act(a, {}, playEvent(a, SWINGING_WEB_KICK, 3));
    expect(resolvedIds(events)).toEqual(
      expect.arrayContaining(["50065.black-widow-forced-interrupt", "50078.preparation"]),
    );
    expect(mainThreat(a)).toBe(threat - 1);
    expect(discardCodes(a)).toContain(DANCE_OF_DEATH);
    expect([damageOn(a, spider()), damageOn(a, mocking)]).toEqual([hurt[0]! + 1, hurt[1]! + 1]);
    expect(damageOn(a, widow())).toBe(8);
    expect(widowHp(a)).toBe(8);
  });

  it("round 3: the third Kick. Covert Ops' Preparation places 1 threat on each scheme (the main scheme is the only one); 8 more damage defeats her last stage: the win", () => {
    const threat = mainThreat(a);
    const events = act(a, {}, playEvent(a, SWINGING_WEB_KICK, 3));
    expect(resolvedIds(events)).toContain("50077.preparation");
    expect(ofType(events, "threatPlaced")).toMatchObject([
      { schemeInstanceId: mainOf(a), amount: 1, sourceInstanceId: expect.any(String) },
    ]);
    expect(mainThreat(a)).toBe(threat - 1 + 1);
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: widow() }]);
    expect(widowHp(a)).toBe(0);
    expect(a.state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });

  it("invariants: no prompt pending, no card in two zones, every card accounted for", () => {
    expectInvariants(a, baseline);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game B: two players (Spider-Man, Iron Man), standard
// ---------------------------------------------------------------------------------------------------------------

describe("Black Widow scenario, game B: two players (P1 Spider-Man with the Grunt, P2 Iron Man with the Commando), standard, seed 1", () => {
  const b = open([SPIDER_MAN, IRON_MAN], ["A.I.M. Grunt", "A.I.M. Commando"]);
  const baseline = { encounter: encounterIdsOf(b.state), playerCards: playerCardIdsOf(b.state) };
  const spider = () => identityOf(b.state, P1);
  const iron = () => identityOf(b.state, P2);
  const widow = () => villainOf(b);

  it("setup (MC50 p. 9): each player chose a minion in player order and it engaged them; 4 threat, target 20, X = 1 per hero, 26 hit points", () => {
    expect(b.state.players).toHaveLength(2);
    const grunt = inPlayCard(b.state, GRUNT)!;
    const commando = inPlayCard(b.state, COMMANDO)!;
    expect(inst(b.state, grunt).engagedWith).toBe(P1);
    expect(inst(b.state, commando).engagedWith).toBe(P2);
    expect(playAreaCodes(b, P1)).toEqual([GRUNT]);
    expect(playAreaCodes(b, P2)).toEqual([COMMANDO]);
    // Put into play, not revealed; both heroes are in alter-ego form, so the Commando's quickstrike did not attack.
    expect(piles(b.state).discard).toEqual([]);
    expect(damageOn(b, identityOf(b.state, P2))).toBe(0);
    expect(damageOn(b, identityOf(b.state, P1))).toBe(0);
    expect(piles(b.state).deck).toHaveLength(36); // 19 + 5 + 5 + 7 + 2 obligations - 2 chosen
    expect(mainThreat(b)).toBe(4); // 2[per_hero]
    expect(mainSchemeValue(b.state, "targetThreat", DEPS)).toBe(20);
    expect(mainSchemeValue(b.state, "acceleration", DEPS)).toBe(2); // X = 1 (stage) per hero
    expect(maxHitPoints(b.state, widow(), DEPS)).toBe(26); // 13 per player
    expect(b.state.firstPlayerId).toBe(P1);
    expect(b.state.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P1 });
  });

  it("round 1, P1: the engaged Guard stops P1 attacking her (RRG 'Guard', p. 32), but an attack on the Grunt is no attack on her: nothing is removed or discarded", () => {
    act(b, {}, toHero(P1));
    expect(rejection(b, attack(spider(), widow()))).toBe("no_valid_target");
    const grunt = inPlayCard(b.state, GRUNT)!;
    const top = deckTop(b);
    const events = act(b, {}, attack(spider(), grunt));
    expect(resolvedIds(events)).not.toContain("50064.black-widow-forced-interrupt");
    expect(mainThreat(b)).toBe(4);
    expect(deckTop(b)).toBe(top);
    expect(damageOn(b, grunt)).toBe(2);
    expect(damageOn(b, widow())).toBe(0);
    act(b, {}, endTurn(P1));
    expect(b.state.step).toMatchObject({ activePlayerId: P2 });
  });

  it("round 1, P2 (the Commando does not block): a basic attack with Grappling Hook on top. The Hook's Preparation makes P2 discard an event of P2's choice; P1's hand is untouched", () => {
    act(b, {}, toHero(P2));
    give(b, P2, FIRST_AID, HAYMAKER);
    const [firstAid] = handOf(b, FIRST_AID, P2);
    const [haymaker] = handOf(b, HAYMAKER, P2);
    const p1Hand = playerOf(b.state, P1).hand;
    stack(b, HOOK, GOGGLES);
    const events = act(b, { targets: [firstAid!] }, attack(iron(), widow(), P2));
    expect(resolvedIds(events)).toEqual(
      expect.arrayContaining(["50064.black-widow-forced-interrupt", "50069.preparation"]),
    );
    expect(ofType(events, "abilityResolved").find((e) => e.abilityId === "50069.preparation")).toMatchObject({
      controllerId: P2,
    });
    expect(playerOf(b.state, P2).discard).toContain(firstAid);
    expect(playerOf(b.state, P2).hand).toContain(haymaker); // P2 chose which event
    expect(playerOf(b.state, P1).hand).toEqual(p1Hand);
    expect(mainThreat(b)).toBe(3);
    expect(damageOn(b, widow())).toBe(1); // Iron Man's ATK 1
    expect(discardCodes(b)).toContain(HOOK);
    expect(attachedCodes(b, widow())).toEqual([]);
  });

  it("round 1, P2: Haymaker with Night Vision Goggles on top. Its Preparation attaches them to her; 3 -> 2 threat", () => {
    const events = act(b, {}, playEvent(b, HAYMAKER, 2, P2));
    expect(resolvedIds(events)).toContain("50070.preparation");
    expect(attachedCodes(b, widow())).toEqual([GOGGLES]);
    expect(mainThreat(b)).toBe(2);
    expect(damageOn(b, widow())).toBe(4);
  });

  it("round 1 villain phase: acceleration 2 (X = 1 per hero); she activates against each player in turn order with her own boost card, each player's minion after her; the dealt cards are revealed; the first player token passes to P2", () => {
    stack(b, ADVANCE, ADVANCE, DEFENSES, DESTROY_EVIDENCE); // two boost cards (0 icons), then P1's and P2's dealt cards
    const events = act(b, {}, endTurn(P2));
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({
      schemeInstanceId: mainOf(b),
      amount: 2,
      sourceInstanceId: null,
    });
    const activations = ofType(events, "enemyActivated").map((e) => [codeOf(b.state, e.enemyInstanceId), e.playerId]);
    expect(activations).toEqual([
      ["50064", P1],
      [GRUNT, P1],
      ["50064", P2],
      [COMMANDO, P2],
    ]);
    // Only the villain is given a boost card (RRG 'Boost Card', 'Villainous': minions without it skip the step).
    expect(ofType(events, "boostCardDealt")).toHaveLength(2);
    expect(ofType(events, "attackResolved").map((e) => [e.baseAtk, e.damageDealt])).toEqual([
      [1, 1],
      [1, 1],
      [1, 1],
      [2, 2],
    ]);
    expect(damageOn(b, spider())).toBe(2);
    expect(damageOn(b, iron())).toBe(3);
    // Dealt: Automated Defenses to P1 (3 threat + Hinder 1 per hero = 5), Destroy Evidence to P2 (2 + Hinder 2 per hero = 6).
    expect(ofType(events, "encounterCardRevealed")).toMatchObject([
      { cardId: DEFENSES, playerId: P1 },
      { cardId: DESTROY_EVIDENCE, playerId: P2 },
    ]);
    expect(inst(b.state, inPlayCard(b.state, DEFENSES)!).threat).toBe(5);
    expect(inst(b.state, inPlayCard(b.state, DESTROY_EVIDENCE)!).threat).toBe(6);
    expect(mainThreat(b)).toBe(4);
    expect(ofType(events, "firstPlayerChanged")).toMatchObject([{ playerId: P2 }]);
    expect(b.state.round).toBe(2);
    expect(b.state.step).toMatchObject({ activePlayerId: P2, remainingPlayerIds: [P1] });
  });

  it("round 2, P2: Assault (no printed Preparation) is discarded by her interrupt and gains BOTH granted Preparations; P2 orders them: Defenses' 1 damage first, then the Goggles prevent the attack's damage and are discarded", () => {
    stack(b, ASSAULT);
    const events = act(b, { first: "automated-defenses" }, attack(iron(), widow(), P2));
    const granted = ofType(events, "abilityResolved").filter((e) => e.abilityId.endsWith("granted-preparation"));
    expect(granted.map((e) => e.abilityId)).toEqual([
      "50074.automated-defenses-granted-preparation",
      "50070.night-vision-goggles-granted-preparation",
    ]);
    expect(granted.every((e) => e.controllerId === P2)).toBe(true);
    expect(mainThreat(b)).toBe(3);
    expect(discardCodes(b)).toEqual(expect.arrayContaining([ASSAULT, GOGGLES]));
    expect(attachedCodes(b, widow())).toEqual([]);
    // Defenses: "Deal 1 damage to the attacking character"; Goggles: "Prevent all damage from this attack".
    expect(damageOn(b, iron())).toBe(4);
    expect(ofType(events, "damagePrevented")).toMatchObject([{ targetInstanceId: widow(), amount: 1 }]);
    expect(damageOn(b, widow())).toBe(4);
  });

  it("round 2, P2: Supersonic Punch with Stun Net on top. After the attack the Net attaches to the attacking character; 4 damage lands (the Goggles are gone)", () => {
    give(b, P2, SUPERSONIC_PUNCH, "01033", "01034", "01035", "01036");
    stack(b, NET);
    const events = act(b, {}, playEvent(b, SUPERSONIC_PUNCH, 2, P2));
    expect(resolvedIds(events)).toContain("50071.preparation");
    const net = inPlayCard(b.state, NET)!;
    expect(inst(b.state, net).attachedTo).toBe(iron());
    // "After this attack": attached once the damage has been dealt.
    const attached = events.findIndex((e) => e.type === "cardMoved" && e.cardId === NET && e.to.kind === "attachment");
    expect(attached).toBeGreaterThan(indexOf(events, "damageDealt", { targetInstanceId: widow() }));
    expect(mainThreat(b)).toBe(2);
    expect(damageOn(b, widow())).toBe(8);
    expect(attachedCodes(b, iron())).toEqual([NET]);
  });

  it("round 2, P1: any player may trigger the Net's action: P1 exhausts Spider-Man to discard it, freeing P2's Iron Man", () => {
    act(b, {}, endTurn(P2));
    expect(b.state.step).toMatchObject({ activePlayerId: P1 });
    const net = inPlayCard(b.state, NET)!;
    const events = act(b, {}, use(P1, net, "50071.stun-net-action"));
    expect(resolvedIds(events)).toContain("50071.stun-net-action");
    expect(inst(b.state, spider()).exhausted).toBe(true);
    expect(inPlayCard(b.state, NET)).toBeUndefined();
    expect(discardCodes(b)).toContain(NET);
    expect(attachedCodes(b, iron())).toEqual([]);
  });

  it("invariants: no prompt pending, no card in two zones, every card accounted for", () => {
    expectInvariants(b, baseline);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game C: expert, solo: stage II to III
// ---------------------------------------------------------------------------------------------------------------

describe("Black Widow scenario, game C: solo (Spider-Man), expert, seed 1: stage II to III, Attacrobatics, the Commando and the Grunt", () => {
  const c = open([SPIDER_MAN], ["A.I.M. Soldier"], "expert");
  const baseline = { encounter: encounterIdsOf(c.state), playerCards: playerCardIdsOf(c.state) };
  const spider = () => identityOf(c.state, P1);
  const widow = () => villainOf(c);

  it("setup (expert): Black Widow (II) leads (stage 2 is her first), the Expert set is in the deck, the Soldier was put into play without its When Revealed (the Scientist stays in the deck); 2 + 2 threat, X = 2, 16 hit points", () => {
    expect(villainStage(c)).toBe(1);
    expect(c.state.villains[0]!.lastStageIndex).toBe(2);
    expect(codeOf(c.state, widow())).toBe("50064");
    expect(maxHitPoints(c.state, widow(), DEPS)).toBe(16);
    // 1B's 2[per_hero] plus Black Widow (II)'s When Revealed 2[per_hero] (she is revealed at setup).
    expect(mainThreat(c)).toBe(4);
    expect(mainSchemeValue(c.state, "acceleration", DEPS)).toBe(2);
    expect(mainSchemeValue(c.state, "targetThreat", DEPS)).toBe(10);
    const counts = countsOf(c.state);
    expect(counts).toMatchObject({ "01191": 1, "01192": 1, "01193": 1, [SCIENTIST]: 1, [SOLDIER]: 2 });
    expect(playAreaCodes(c)).toEqual([SOLDIER]);
    expect(inst(c.state, inPlayCard(c.state, SOLDIER)!).engagedWith).toBe(P1);
    expect(inPlayCard(c.state, SCIENTIST)).toBeUndefined();
    expect(piles(c.state).deck).toHaveLength(39); // 19 + 5 + 4 + 7 + 3 Expert + 1 obligation
  });

  it("round 1: Attacrobatics on top of a basic attack. Her interrupt (4 -> 3); the Preparation prevents all the damage; in expert mode that much damage is dealt to the attacker after the attack", () => {
    act(c, {}, toHero());
    stack(c, ATTACROBATICS);
    const events = act(c, {}, attack(spider(), widow()));
    expect(resolvedIds(events)).toEqual(
      expect.arrayContaining(["50065.black-widow-forced-interrupt", "50076.preparation"]),
    );
    expect(mainThreat(c)).toBe(3);
    expect(ofType(events, "damagePrevented")).toMatchObject([{ targetInstanceId: widow(), amount: 2 }]);
    expect(damageOn(c, widow())).toBe(0);
    expect(damageOn(c, spider())).toBe(2); // 'deal that much damage to the attacking character'
    const prevented = indexOf(events, "damagePrevented");
    const back = indexOf(events, "damageDealt", { targetInstanceId: spider() });
    expect(back).toBeGreaterThan(prevented);
  });

  it("round 1: Swinging Web Kick with A.I.M. Commando on top. After the attack the Commando enters engaged with Spider-Man (hero form) and its quickstrike attacks at once", () => {
    give(
      c,
      P1,
      SWINGING_WEB_KICK,
      SWINGING_WEB_KICK,
      SWINGING_WEB_KICK,
      "01007",
      "01007",
      "01008",
      "01093",
      "01063",
      "01009",
      "01064",
      "01002",
      "01058",
      "01059",
      "01062",
    );
    stack(c, COMMANDO);
    const events = act(c, {}, playEvent(c, SWINGING_WEB_KICK, 3));
    expect(mainThreat(c)).toBe(2);
    expect(damageOn(c, widow())).toBe(8);
    const commando = inPlayCard(c.state, COMMANDO)!;
    expect(inst(c.state, commando).engagedWith).toBe(P1);
    // "After this attack, put this minion into play engaged with you": after the 8 damage, then its quickstrike attack (ATK 2).
    const entered = events.findIndex(
      (e) => e.type === "cardMoved" && e.cardId === COMMANDO && e.to.kind === "playArea",
    );
    expect(entered).toBeGreaterThan(indexOf(events, "damageDealt", { targetInstanceId: widow() }));
    expect(ofType(events, "attackResolved")).toMatchObject([
      { enemyInstanceId: commando, targetInstanceId: spider(), baseAtk: 2, damageDealt: 2 },
    ]);
    expect(entered).toBeLessThan(indexOf(events, "attackResolved"));
    expect(damageOn(c, spider())).toBe(4);
  });

  it("round 1: a second Kick defeats stage II (8 + 8 = 16): stage III enters with a fresh 20 hit points, its When Revealed 3 threat and X = 3", () => {
    const threat = mainThreat(c);
    const events = act(c, {}, playEvent(c, SWINGING_WEB_KICK, 3));
    expect(ofType(events, "villainStageAdvanced")).toMatchObject([{ stageIndex: 2, instanceId: widow() }]);
    expect(ofType(events, "threatPlaced")).toMatchObject([
      { schemeInstanceId: mainOf(c), amount: 3, sourceInstanceId: widow() },
    ]);
    expect(mainThreat(c)).toBe(threat - 1 + 3);
    expect(villainStage(c)).toBe(2);
    expect(maxHitPoints(c.state, widow(), DEPS)).toBe(20); // 20 per player on stage III
    expect(damageOn(c, widow())).toBe(0);
    expect(mainSchemeValue(c.state, "acceleration", DEPS)).toBe(3);
    expect(c.state.outcome).toBeNull();
  });

  it("round 1: a third Kick with A.I.M. Grunt on top. The Grunt enters engaged and the WHOLE attack resolves against it: she takes nothing (January 17, 2026 - Ruling 2)", () => {
    stack(c, GRUNT);
    const events = act(c, {}, playEvent(c, SWINGING_WEB_KICK, 3));
    expect(resolvedIds(events)).toEqual(
      expect.arrayContaining(["50066.black-widow-forced-interrupt", "50073.preparation"]),
    );
    expect(damageOn(c, widow())).toBe(0);
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === widow())).toEqual([]);
    // 8 damage on the Grunt's 5 hit points defeats it.
    expect(ofType(events, "damageDealt")).toMatchObject([
      { targetInstanceId: expect.any(String), amount: 8, sourceInstanceId: spider() },
    ]);
    expect(ofType(events, "characterDefeated").map((e) => codeOf(c.state, e.instanceId))).toEqual([GRUNT]);
    expect(inPlayCard(c.state, GRUNT)).toBeUndefined();
    expect(c.state.outcome).toBeNull();
  });

  it("invariants: no prompt pending, no card in two zones, every card accounted for", () => {
    expectInvariants(c, baseline);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game D: the main scheme
// ---------------------------------------------------------------------------------------------------------------

describe("Black Widow scenario, game D: solo, standard: the loss by The Widow's Web", () => {
  const d = open([SPIDER_MAN], [SOLDIER]);
  const baseline = { encounter: encounterIdsOf(d.state), playerCards: playerCardIdsOf(d.state) };

  it("round 1 (alter-ego, nothing done): +1 acceleration, her scheme (SCH 2) and the Soldier's (SCH 1): 2 -> 6", () => {
    expect(mainThreat(d)).toBe(2);
    expect(inPlayCard(d.state, SCIENTIST)).toBeUndefined(); // the Soldier was put into play, not revealed
    stack(d, ASSAULT, DESTROY_EVIDENCE); // her boost card (0 icons), then the dealt card
    const events = act(d, {}, endTurn());
    expect(ofType(events, "schemeResolved")).toMatchObject([
      { baseSch: 2, boostIcons: 0, threatPlaced: 2 },
      { baseSch: 1, boostIcons: 0, threatPlaced: 1 },
    ]);
    expect(mainThreat(d)).toBe(6);
    expect(d.state.outcome).toBeNull();
    expect(d.state.round).toBe(2);
  });

  it("round 2: the same again reaches the target of 10 per hero: the players lose (MC50 p. 9: 'If this stage is completed, the players lose the game')", () => {
    stack(d, ASSAULT);
    const events = act(d, {}, endTurn());
    expect(mainThreat(d)).toBe(10);
    expect(ofType(events, "gameEnded")).toMatchObject([{ outcome: { result: "loss", reason: "mainSchemeCompleted" } }]);
    expect(d.state.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
  });

  it("invariants: no prompt pending, no card in two zones, every card accounted for", () => {
    expectInvariants(d, baseline);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// What the games do not prove
// ---------------------------------------------------------------------------------------------------------------

describe("not played in a whole game", () => {
  it.todo("Nabbed! (50082) in a whole game: unit tests only (aim-abduction.test.ts)");
  it.todo(
    "A.I.M. Soldier's When Revealed finding the Scientist, and Mad Science: unit tests only (aim-science.test.ts)",
  );
  it.todo("Covert Ops, Dance of Death and Widow's Bite as When Revealed cards in a whole game: unit tests only");
  it.todo("Destroy Evidence's incite 1 on a revealed card: unit tests only");
  it.todo(
    "Winter Soldier's Arm Block against her attack (January 17, 2026 - Ruling 2, the hero half): no Winter Soldier kit in this scenario's decks",
  );
  it.todo("three and four players; campaign mode");
});
