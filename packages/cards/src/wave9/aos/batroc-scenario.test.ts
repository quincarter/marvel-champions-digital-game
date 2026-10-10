import { AOS_CARDS, CORE_CARDS } from "@mc/content";
import {
  applyCommand,
  createGame,
  hasKeyword,
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
  use,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { wave9Scenario } from "../setup.js";
import { IRON_MAN, SPIDER_MAN, codeOf, inPlayCard, piles } from "../testing.js";
import { AIM_SCIENCE } from "./aim-science.js";
import { BATROC } from "./batroc.js";
import { BATROCS_BRIGADE } from "./batrocs-brigade.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * Whole-game tests of the Batroc scenario (MC50 p. 11, docs/phase7-wave9.md section 2.3 and section 8.4 "Batroc scenario
 * game"): the real `wave9Scenario("batroc")` builder (standard mode, the scenario's recommended modular sets A.I.M.
 * Science and Batroc's Brigade, Core Spider-Man starter deck) played through the engine's real commands, one decision at
 * a time, deterministic by seed (1). Only the encounter deck's order (`stackEncounterDeck`) and the cards a round needs
 * in hand (`moveToHand`) are seeded; every play, ability, attack, thwart and prompt answer is a command the engine
 * validates. RRG 1.8 = mc_rulesreference_v18_compressed.md; rulings = marvel-champions-rulings-post-rrg-1-7.md.
 *
 * Games:
 * - A (solo, to a win): setup; Batroc's attack placing threat on Alert Level; a Vulnerable Guard discarded by a stun
 *   (RRG "Vulnerable"); Guard and Patrol blocking an attack on the villain / a thwart (RRG "Guard", "Patrol", p. 32);
 *   Alert Level flipping at its threshold of 4 (solo) and its response; leaving stage 1 by removing the last threat;
 *   stage 2B's captive and the first player's choice; 3A on High dealing a facedown card (RRG "Deal", "Facedown");
 *   3B redirecting the attack to a captive; Batroc "would be defeated" twice in one turn (reset to 8, 6 threat removed
 *   each time, never defeated); the win at no threat.
 * - B (two players, first player P2): the per-player numbers; the stage 1 threat removed by Batroc's own reset
 *   (it can take the last threat of a stage); the choice made by the first player (RRG "First Player", p. 19);
 *   3A on the Low side.
 * - C (solo): the threshold flip on a minion's defeat, Guard surge and Patrol incite on High, the loss at the High
 *   threshold.
 * - D (solo): Leaping Kick on an ally (hero form); a Vulnerable stun that is not a defeat is covered in A.
 * - E (solo): stage 3's loss when no Rescued Captive is in play.
 *
 * The tally of what each game leaves unproven is at the end of the file (`it.todo`, `it.fails`).
 */
const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE8_ABILITIES, BATROC, BATROCS_BRIGADE, AIM_SCIENCE),
};

// Core cards
const ADVANCE = "01186"; // boost 0, When Revealed: the villain schemes
const SWINGING_WEB_KICK = "01005"; // Hero Action (attack): 8 damage to an enemy, cost 3
const HAYMAKER = "01087"; // Hero Action (attack): 3 damage to an enemy, cost 2
const FOR_JUSTICE = "01060"; // Hero Action (thwart): remove 3 threat (4 if paid with a mental resource), cost 2
const GREAT_RESPONSIBILITY = "01061"; // a mental resource
const MOCKINGBIRD = "01083"; // Response: after she enters play, stun an enemy
// Wave 9 cards
const GUARD = "50093";
const PATROL = "50094";
const COMMANDEER = "50095";
const LEAPING_KICK = "50096";
const SECURITY_CAMERAS_BOOST_TWO = "50097"; // boost 2 (only its boost icons are used here)
const MAD_SCIENCE = "50085";

// ---------------------------------------------------------------------------------------------------------------
// A small driver
// ---------------------------------------------------------------------------------------------------------------

interface Sim {
  state: GameState;
  log: GameEvent[];
}

interface Plan {
  /** An optional trigger whose id contains this text is taken; every other optional trigger is declined. */
  readonly take?: string;
  /** A `chooseOption` option whose label starts with this text. */
  readonly option?: string;
  readonly target?: InstanceId;
  readonly player?: PlayerId;
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
      case "chooseOption": {
        const hit = plan.option ? offered.find((o) => o.label.startsWith(plan.option!)) : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "chooseTarget": {
        const hit = plan.target ? offered.find((o) => (o.optionId as string) === plan.target) : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "choosePlayer": {
        const hit = plan.player ? offered.find((o) => (o.optionId as string) === plan.player) : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      default:
        return firstLegal(s);
    }
  };

/** Plays the scenario past setup (to the first player turn). */
function open(players: readonly (typeof SPIDER_MAN | typeof IRON_MAN)[], firstPlayerIndex?: number): Sim {
  const config = wave9Scenario("batroc", {
    players,
    seed: 1,
    ...(firstPlayerIndex !== undefined ? { firstPlayerIndex } : {}),
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
const pay = (sim: Sim, n: number, exclude: readonly InstanceId[], player: PlayerId = P1) =>
  payWith(sim.state, player, n, exclude);

const villainOf = (sim: Sim): InstanceId => sim.state.villains[0]!.instanceId;
const mainOf = (sim: Sim): InstanceId => sim.state.mainScheme.instanceId;
const mainThreat = (sim: Sim): number => inst(sim.state, mainOf(sim)).threat;
const alertOf = (sim: Sim): InstanceId => inPlayCard(sim.state, "50090a")!;
const alertThreat = (sim: Sim): number => inst(sim.state, alertOf(sim)).threat;
/** Alert Level is one card with a flip side: `flipped` is its High side. */
const alertSide = (sim: Sim): "Low" | "High" => (inst(sim.state, alertOf(sim)).flipped ? "High" : "Low");
const damageOn = (sim: Sim, id: InstanceId): number => inst(sim.state, id).damage;
const stageIndex = (sim: Sim): number => sim.state.mainScheme.stageIndex;
const inPlayCodes = (sim: Sim, player: PlayerId = P1): string[] =>
  playerOf(sim.state, player).playArea.map((i) => codeOf(sim.state, i));
const captivesInPlay = (sim: Sim): InstanceId[] =>
  sim.state.players.flatMap((p) => p.playArea).filter((i) => codeOf(sim.state, i) === "50091");

const thwart = (sim: Sim, by: InstanceId = identityOf(sim.state, P1), player: PlayerId = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: by,
  schemeInstanceId: mainOf(sim),
});
const attack = (by: InstanceId, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: by,
  targetInstanceId: target,
});
const toHero = (player: PlayerId = P1): Command => ({ type: "changeForm", playerId: player });
const roundOf = (sim: Sim): number => sim.state.round;
const activePlayer = (sim: Sim): PlayerId => (sim.state.step as { activePlayerId: PlayerId }).activePlayerId;

/** The error a command would be rejected with, or null when it is legal (the state is not changed). */
const rejection = (sim: Sim, command: Command): string | null => {
  const r = applyCommand(sim.state, command, DEPS);
  return r.ok ? null : r.error.code;
};

/** The first player plays `SWINGING_WEB_KICK` at `target`, paying with the first three other cards in hand. */
const webKick = (sim: Sim, target: InstanceId, player: PlayerId = P1): Command => {
  const kicks = handOf(sim, SWINGING_WEB_KICK, player);
  const card = kicks[0]!;
  return play(player, card, pay(sim, 3, kicks, player));
};

// ---------------------------------------------------------------------------------------------------------------
// Zone invariants (the same shape as wave8/scenario-games.qa.test.ts)
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
}

const nameOfCode = (code: string): string => [...AOS_CARDS, ...CORE_CARDS].find((c) => c.id === code)!.name;

// ---------------------------------------------------------------------------------------------------------------
// Game A: solo, standard, Core Spider-Man, to a win
// ---------------------------------------------------------------------------------------------------------------

describe("Batroc scenario, game A: solo (Spider-Man), standard, seed 1, played to a win", () => {
  const a = open([SPIDER_MAN]);
  const baseline = { encounter: encounterIdsOf(a.state), playerCards: playerCardIdsOf(a.state) };
  const spider = () => identityOf(a.state, P1);
  const batroc = () => villainOf(a);

  it("setup (MC50 p. 11): Alert Level in play Low side up, 4 Rescued Captives set aside, stage 1 with 6 threat, 8 fixed hit points", () => {
    expect(a.state.players).toHaveLength(1);
    expect(playerOf(a.state, P1).identity.form).toBe("alterEgo");
    // 50087a Setup: "Set each Rescued Captive ally aside. Put the Alert Level environment into play, Low side faceup."
    expect(a.state.encounterSetAside.map((i) => codeOf(a.state, i))).toEqual(["50091", "50091", "50091", "50091"]);
    expect(alertOf(a)).toBeDefined();
    expect(codeOf(a.state, alertOf(a))).toBe("50090a");
    expect(alertSide(a)).toBe("Low");
    expect(alertThreat(a)).toBe(0); // the 2[per_hero] threat is expert mode only
    expect(inst(a.state, alertOf(a)).faceup).toBe(true);
    // Stage 1: 1A has been resolved (its Setup ran) and 1B is the stage in play.
    expect(codeOf(a.state, mainOf(a))).toBe("50087a");
    expect(stageIndex(a)).toBe(0);
    expect(mainThreat(a)).toBe(6); // 6[per_hero]
    expect(mainSchemeValue(a.state, "targetThreat", DEPS)).toBe(12); // 12[per_hero] ("completionLoses")
    expect(mainSchemeValue(a.state, "acceleration", DEPS)).toBe(1);
    // Batroc (A): 8 hit points, ATK 2, SCH 1; the hit points are not per player (MC50 p. 4, "Non-Scaling Villain HP").
    expect(codeOf(a.state, batroc())).toBe("50086a");
    expect(a.state.villains[0]!.stageIndex).toBe(0);
    expect(maxHitPoints(a.state, batroc(), DEPS)).toBe(8);
    expect(a.state.firstPlayerId).toBe(P1);
    expect(a.state.pendingChoice).toBeNull();
  });

  it("setup: the encounter deck is 30 cards by set: Batroc 12, A.I.M. Science 5, Batroc's Brigade 5, Standard 7, Spider-Man's obligation 1", () => {
    const deck = piles(a.state).deck;
    expect(deck).toHaveLength(30);
    const count: Record<string, number> = {};
    for (const id of deck) count[codeOf(a.state, id)] = (count[codeOf(a.state, id)] ?? 0) + 1;
    expect(count).toEqual({
      // Batroc (12): Heightened Reflexes 1, Embassy Guard 2, Embassy Patrol 2, Commandeer Security Office 1, Leaping Kick 2, Security Cameras 4
      "50092": 1,
      "50093": 2,
      "50094": 2,
      "50095": 1,
      "50096": 2,
      "50097": 4,
      // A.I.M. Science (5): A.I.M. Scientist 1, A.I.M. Soldier 3, Mad Science 1
      "50083": 1,
      "50084": 3,
      "50085": 1,
      // Batroc's Brigade (5): Machete, Rapido, Zaran, Batroc's Brigade, Soldiers of Fortune
      "50098": 1,
      "50099": 1,
      "50100": 1,
      "50101": 1,
      "50102": 1,
      // Standard (7): Advance 2, Assault 2, Caught Off Guard 1, Gang-Up 1, Shadow of the Past 1
      "01186": 2,
      "01187": 2,
      "01188": 1,
      "01189": 1,
      "01190": 1,
      // Spider-Man's obligation (Core), shuffled into the encounter deck
      "01165": 1,
    });
    // Never in the deck: the villain, the main scheme, Alert Level (in play) and the four Rescued Captives (set aside).
    for (const never of ["50086a", "50086b", "50087a", "50090a", "50090b", "50091"])
      expect(Object.keys(count)).not.toContain(never);
    expect(nameOfCode("50091")).toBe("Rescued Captive");
  });

  it("round 1: Spider-Man flips to hero form and thwarts 1 (6 -> 5)", () => {
    const flipped = act(a, {}, toHero());
    expect(ofType(flipped, "formChanged")).toMatchObject([{ to: "hero" }]);
    const events = act(a, {}, thwart(a));
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: mainOf(a), amount: 1 }]);
    expect(mainThreat(a)).toBe(5);
  });

  it("round 1 villain phase: +1 acceleration; Batroc attacks (2 damage) and places 1 threat on Alert Level; the Guard engages", () => {
    stack(a, ADVANCE, GUARD); // Batroc's boost card (0 icons), then the card dealt to the player
    const events = act(a, {}, endTurn());
    // Villain Phase step 1: 1[per_hero] acceleration (RRG Appendix II, pp. 51-52).
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(a), amount: 1 });
    expect(ofType(events, "attackResolved")).toMatchObject([
      { enemyInstanceId: batroc(), targetInstanceId: spider(), baseAtk: 2, boostIcons: 0, damageDealt: 2 },
    ]);
    // 50086a Forced Response: "After Batroc attacks, place 1 threat on Alert Level."
    expect(ofType(events, "threatPlaced").filter((e) => e.schemeInstanceId === alertOf(a))).toMatchObject([
      { amount: 1, sourceInstanceId: batroc() },
    ]);
    expect(alertThreat(a)).toBe(1);
    expect(mainThreat(a)).toBe(6);
    expect(damageOn(a, spider())).toBe(2);
    const guard = inPlayCard(a.state, GUARD)!;
    expect(inst(a.state, guard).engagedWith).toBe(P1);
    // Low side: the Guard does not gain surge (only the High side gives it), so no further card was revealed.
    expect(hasKeyword(a.state, guard, "surge", DEPS)).toBe(false);
    expect(ofType(events, "encounterCardRevealed")).toHaveLength(1);
    expect(roundOf(a)).toBe(2);
  });

  it("round 2: the engaged Guard blocks attacks on the villain (RRG 'Guard', p. 32); Mockingbird's stun discards the Vulnerable Guard without a defeat", () => {
    expect(rejection(a, attack(spider(), batroc()))).toBe("no_valid_target");
    give(a, P1, MOCKINGBIRD, FOR_JUSTICE, GREAT_RESPONSIBILITY);
    const guard = inPlayCard(a.state, GUARD)!;
    const mocking = handOf(a, MOCKINGBIRD)[0]!;
    const protect = [mocking, handOf(a, FOR_JUSTICE)[0]!, handOf(a, GREAT_RESPONSIBILITY)[0]!];
    const events = act(a, { take: "mockingbird", target: guard }, play(P1, mocking, pay(a, 3, protect)));
    // RRG "Vulnerable": discard when stunned or confused; that is not a defeat, so neither the Guard's When Defeated
    // nor Alert Level's Forced Response answers.
    expect(ofType(events, "statusGiven")).toMatchObject([{ instanceId: guard }]);
    expect(ofType(events, "vulnerableDiscarded")).toMatchObject([{ instanceId: guard }]);
    expect(ofType(events, "characterDefeated")).toEqual([]);
    expect(inPlayCard(a.state, GUARD)).toBeUndefined();
    expect(piles(a.state).discard.map((i) => codeOf(a.state, i))).toContain(GUARD);
    expect(alertThreat(a)).toBe(1);
    expect(inPlayCodes(a)).toContain(MOCKINGBIRD);
  });

  it("round 2: For Justice! paid with a mental resource removes 4, then leaving stage 1 by removing its last threat (6 -> 0) reveals stage 2B with 3 threat", () => {
    const fj = handOf(a, FOR_JUSTICE)[0]!;
    // "4 threat instead if you paid for this card using a [mental] resource": Great Responsibility is the mental one.
    const events = act(a, {}, play(P1, fj, [handOf(a, GREAT_RESPONSIBILITY)[0]!, handOf(a, "01093")[0]!]));
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: mainOf(a), amount: 4 }]);
    expect(mainThreat(a)).toBe(2);
    act(a, {}, thwart(a));
    expect(mainThreat(a)).toBe(1);
    expect(stageIndex(a)).toBe(0);
    // 1B: "When the last threat is removed from this scheme, advance to stage 2A."
    const mocking = inPlayCard(a.state, MOCKINGBIRD)!;
    const last = act(a, {}, thwart(a, mocking));
    expect(ofType(last, "threatRemoved")).toMatchObject([{ schemeInstanceId: mainOf(a), amount: 1 }]);
    expect(ofType(last, "mainSchemeAdvanced")).toHaveLength(1);
    expect(stageIndex(a)).toBe(1);
    // 2B starts with 3[per_hero] threat; completion loses; its own target is 10[per_hero].
    expect(ofType(last, "threatPlaced")).toMatchObject([{ schemeInstanceId: mainOf(a), amount: 3 }]);
    expect(mainThreat(a)).toBe(3);
    expect(mainSchemeValue(a.state, "targetThreat", DEPS)).toBe(10);
    expect(mainSchemeValue(a.state, "acceleration", DEPS)).toBe(1);
    // Consequential damage 1 for Mockingbird's thwart (RRG "Consequential Damage").
    expect(damageOn(a, mocking)).toBe(1);
    expect(captivesInPlay(a)).toEqual([]); // a captive enters only when the last threat of 2B is removed
    expect(a.state.outcome).toBeNull();
  });

  it("round 2 villain phase: stage 2's +1 acceleration; Batroc's attack puts Alert Level at 2; the Patrol engages", () => {
    stack(a, ADVANCE, PATROL);
    const events = act(a, {}, endTurn());
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(a), amount: 1 });
    expect(mainThreat(a)).toBe(4);
    expect(ofType(events, "attackResolved")).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);
    expect(damageOn(a, spider())).toBe(4);
    expect(alertThreat(a)).toBe(2);
    expect(inst(a.state, inPlayCard(a.state, PATROL)!).engagedWith).toBe(P1);
    expect(roundOf(a)).toBe(3);
  });

  it("round 3: the engaged Patrol blocks thwarting the main scheme (RRG 'Patrol', p. 32); Haymaker defeats it and Alert Level reaches 4 and flips to High", () => {
    expect(rejection(a, thwart(a))).toBe("no_valid_target");
    give(a, P1, HAYMAKER, FOR_JUSTICE);
    const patrol = inPlayCard(a.state, PATROL)!;
    const haymaker = handOf(a, HAYMAKER)[0]!;
    const events = act(a, { target: patrol }, play(P1, haymaker, pay(a, 2, [haymaker])));
    expect(ofType(events, "characterDefeated")).toMatchObject([{ instanceId: patrol }]);
    // Patrol's When Defeated (+1) and Alert Level's Forced Response (+1): 2 + 2 = 4 = 4[per_hero] at one player, so
    // "remove all threat from here and flip this card": all 4 tokens leave and the High side shows.
    const onAlert = ofType(events, "threatPlaced").filter((e) => e.schemeInstanceId === alertOf(a));
    expect(onAlert.map((e) => e.amount)).toEqual([1, 1]);
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: alertOf(a), amount: 4 }]);
    expect(ofType(events, "cardFlipped")).toMatchObject([{ instanceId: alertOf(a), flipped: true }]);
    expect(alertSide(a)).toBe("High");
    expect(alertThreat(a)).toBe(0);
    expect(inPlayCard(a.state, PATROL)).toBeUndefined();
    // High side: Batroc gets +1 SCH and +1 ATK (read on the next attack, below).
    expect(a.state.outcome).toBeNull();
  });

  it("round 3: the last threat of 2B (For Justice! 4 of 4) brings a Rescued Captive exhausted under the chosen player; advancing runs 3A on High: a facedown card is dealt", () => {
    // The facedown card 3A deals comes off the top of the encounter deck.
    stack(a, COMMANDEER);
    const fj = handOf(a, FOR_JUSTICE)[0]!;
    const seen: string[] = [];
    const watch: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseOption") seen.push(...choice.options.map((o) => o.label));
      return planner({ option: "Advance to" })(s);
    };
    const r = driveEventsPicking(DEPS, a.state, watch, play(P1, fj, pay(a, 2, [fj])));
    a.state = r.state;
    const events = [...r.events];
    expect(ofType(events, "threatRemoved")).toMatchObject([{ schemeInstanceId: mainOf(a), amount: 4 }]);
    // 2B: "Each time the last threat is removed a Rescued Captive enters play and the players choose: advance, or
    // 3[per_hero] threat more."
    expect(seen).toEqual(["Advance to stage 3A", "Do not advance: place 3[per_hero] threat here"]);
    const [captive] = captivesInPlay(a) as [InstanceId];
    expect(captivesInPlay(a)).toHaveLength(1);
    expect(playerOf(a.state, P1).playArea).toContain(captive);
    expect(inst(a.state, captive).exhausted).toBe(true);
    expect(a.state.encounterSetAside).toHaveLength(3);
    // 3A (High): "each player is dealt 1 facedown encounter card"; Alert Level keeps its threat (0 here).
    expect(ofType(events, "mainSchemeAdvanced")).toHaveLength(1);
    expect(stageIndex(a)).toBe(2);
    expect(playerOf(a.state, P1).dealtEncounter.map((i) => codeOf(a.state, i))).toEqual([COMMANDEER]);
    expect(alertSide(a)).toBe("High");
    expect(alertThreat(a)).toBe(0);
    // 3B: 12[per_hero] threat, target 18[per_hero], acceleration 1[per_hero].
    expect(ofType(events, "threatPlaced")).toMatchObject([{ schemeInstanceId: mainOf(a), amount: 12 }]);
    expect(mainThreat(a)).toBe(12);
    expect(mainSchemeValue(a.state, "targetThreat", DEPS)).toBe(18);
    expect(a.state.outcome).toBeNull();
  });

  it("round 3: Spider-Man thwarts 1 of stage 3's 12 (11)", () => {
    act(a, {}, thwart(a));
    expect(mainThreat(a)).toBe(11);
  });

  it("round 3 villain phase (3B): Batroc's attack is redirected to the Rescued Captive and hits for 3 (ATK 2 +1 from High); the dealt cards are revealed", () => {
    // Boost 0 icons, then the regular deal; the facedown Commandeer is revealed with it.
    stack(a, ADVANCE, MAD_SCIENCE);
    const captive = captivesInPlay(a)[0]!;
    const events = act(a, {}, endTurn());
    expect(ofType(events, "attackRetargeted")).toMatchObject([
      { enemyInstanceId: batroc(), targetInstanceId: captive },
    ]);
    expect(ofType(events, "attackResolved")).toMatchObject([
      { enemyInstanceId: batroc(), targetInstanceId: captive, baseAtk: 3, boostIcons: 0, damageDealt: 3 },
    ]);
    expect(damageOn(a, captive)).toBe(3);
    expect(damageOn(a, spider())).toBe(4); // not Spider-Man
    expect(alertThreat(a)).toBe(1);
    expect(mainThreat(a)).toBe(12); // 11 + 1 acceleration
    expect(playerOf(a.state, P1).dealtEncounter).toEqual([]);
    // The facedown Commandeer Security Office (3[per_hero] threat) and the regular deal were both revealed.
    expect(inst(a.state, inPlayCard(a.state, COMMANDEER)!).threat).toBe(3);
    expect(inPlayCard(a.state, MAD_SCIENCE)).toBeDefined();
    expect(a.state.outcome).toBeNull();
    expect(roundOf(a)).toBe(4);
  });

  it("round 4: two Swinging Web Kicks, each Batroc 'would be defeated': hit points reset to 8, 6 threat removed, never defeated; no threat left wins", () => {
    give(a, P1, SWINGING_WEB_KICK, SWINGING_WEB_KICK, "01004", "01004", "01003");
    // Alert Level (High): "Hero Action: Spend 1 resource of any type -> remove 1 threat from here." (1 -> 0)
    const [resource] = pay(a, 1, handOf(a, SWINGING_WEB_KICK));
    const lowered = act(a, {}, use(P1, alertOf(a), "50090b.alert-level-action", [{ fromHand: resource! }]));
    expect(ofType(lowered, "threatRemoved")).toMatchObject([{ schemeInstanceId: alertOf(a), amount: 1 }]);
    expect(alertThreat(a)).toBe(0);
    const first = act(a, {}, webKick(a, batroc()));
    expect(ofType(first, "damageDealt")).toMatchObject([{ targetInstanceId: batroc(), amount: 8 }]);
    expect(ofType(first, "hitPointsSet")).toHaveLength(1);
    expect(ofType(first, "characterDefeated")).toEqual([]);
    expect(ofType(first, "threatRemoved")).toMatchObject([
      { schemeInstanceId: mainOf(a), amount: 6, sourceInstanceId: batroc() },
    ]);
    expect(damageOn(a, batroc())).toBe(0);
    expect(remainingHitPoints(a.state, batroc(), DEPS)).toBe(8);
    expect(mainThreat(a)).toBe(6);
    expect(a.state.villains[0]!.defeated).toBe(false);
    expect(a.state.outcome).toBeNull();

    const second = act(a, {}, webKick(a, batroc()));
    expect(ofType(second, "damageDealt")).toMatchObject([{ targetInstanceId: batroc(), amount: 8 }]);
    expect(ofType(second, "characterDefeated")).toEqual([]);
    expect(ofType(second, "threatRemoved")).toMatchObject([{ schemeInstanceId: mainOf(a), amount: 6 }]);
    expect(mainThreat(a)).toBe(0);
    expect(a.state.villains[0]!.defeated).toBe(false);
    // 3B: "If there is no threat here, the players win the game." Logged as the engine's one win reason.
    expect(ofType(second, "gameEnded")).toMatchObject([{ outcome: { result: "win", reason: "villainDefeated" } }]);
    expect(a.state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });

  it("invariants: no prompt pending, no card in two zones, every encounter card and deck card accounted for", () => {
    expectInvariants(a, baseline);
    // The four captives: one in play, three still set aside.
    expect(captivesInPlay(a)).toHaveLength(1);
    expect(a.state.encounterSetAside).toHaveLength(3);
  });
});

/** Stage 3B reached by game A's rounds 1 to 3 (no assertions here; game A asserts every step), ready for the villain phase. */
function toStageThree(): Sim {
  const sim = open([SPIDER_MAN]);
  const spider = () => identityOf(sim.state, P1);
  act(sim, {}, toHero());
  act(sim, {}, thwart(sim));
  stack(sim, ADVANCE, GUARD);
  act(sim, {}, endTurn());
  give(sim, P1, MOCKINGBIRD, FOR_JUSTICE, GREAT_RESPONSIBILITY);
  const mocking = handOf(sim, MOCKINGBIRD)[0]!;
  const keep = [mocking, handOf(sim, FOR_JUSTICE)[0]!, handOf(sim, GREAT_RESPONSIBILITY)[0]!];
  act(sim, { take: "mockingbird", target: inPlayCard(sim.state, GUARD)! }, play(P1, mocking, pay(sim, 3, keep)));
  act(
    sim,
    {},
    play(P1, handOf(sim, FOR_JUSTICE)[0]!, [handOf(sim, GREAT_RESPONSIBILITY)[0]!, handOf(sim, "01093")[0]!]),
  );
  act(sim, {}, thwart(sim));
  act(sim, {}, thwart(sim, inPlayCard(sim.state, MOCKINGBIRD)!));
  stack(sim, ADVANCE, PATROL);
  act(sim, {}, endTurn());
  give(sim, P1, HAYMAKER, FOR_JUSTICE);
  const haymaker = handOf(sim, HAYMAKER)[0]!;
  act(sim, { target: inPlayCard(sim.state, PATROL)! }, play(P1, haymaker, pay(sim, 2, [haymaker])));
  stack(sim, COMMANDEER);
  const fj = handOf(sim, FOR_JUSTICE)[0]!;
  act(sim, { option: "Advance to" }, play(P1, fj, pay(sim, 2, [fj])));
  act(sim, {}, thwart(sim, spider()));
  return sim;
}

// ---------------------------------------------------------------------------------------------------------------
// Game B: two players, first player P2
// ---------------------------------------------------------------------------------------------------------------

describe("Batroc scenario, game B: two players (Spider-Man, Iron Man), first player P2, seed 1", () => {
  const b = open([SPIDER_MAN, IRON_MAN], 1);
  const baseline = { encounter: encounterIdsOf(b.state), playerCards: playerCardIdsOf(b.state) };
  const batroc = () => villainOf(b);

  it("setup: the numbers per player: 12 threat on 1B (6 each), target 24, acceleration 2, Batroc still 8 hit points, 4 captives aside", () => {
    expect(b.state.firstPlayerId).toBe(P2);
    expect(mainThreat(b)).toBe(12);
    expect(mainSchemeValue(b.state, "targetThreat", DEPS)).toBe(24);
    expect(mainSchemeValue(b.state, "acceleration", DEPS)).toBe(2);
    // "Non-Scaling Villain HP" (MC50 p. 4): 8 at two players, not 16.
    expect(maxHitPoints(b.state, batroc(), DEPS)).toBe(8);
    expect(b.state.encounterSetAside.map((i) => codeOf(b.state, i))).toEqual(["50091", "50091", "50091", "50091"]);
    expect(alertSide(b)).toBe("Low");
    expect(alertThreat(b)).toBe(0);
    expect(piles(b.state).deck.filter((i) => ["50091", "50090a"].includes(codeOf(b.state, i)))).toEqual([]);
  });

  it("round 1: two Swinging Web Kicks (Batroc 'would be defeated' twice) remove the stage's 12 threat, the second reset taking the last (12 -> 6 -> 0)", () => {
    expect(activePlayer(b)).toBe(P2); // the first player acts first
    act(b, {}, toHero(P2), endTurn(P2));
    expect(activePlayer(b)).toBe(P1);
    act(b, {}, toHero(P1));
    give(
      b,
      P1,
      SWINGING_WEB_KICK,
      SWINGING_WEB_KICK,
      FOR_JUSTICE,
      FOR_JUSTICE,
      GREAT_RESPONSIBILITY,
      GREAT_RESPONSIBILITY,
    );
    give(b, P1, "01004", "01004", "01003", "01003");
    const first = act(b, {}, webKick(b, batroc()));
    expect(ofType(first, "characterDefeated")).toEqual([]);
    expect(ofType(first, "threatRemoved")).toMatchObject([{ amount: 6 }]);
    expect(mainThreat(b)).toBe(6);
    expect(stageIndex(b)).toBe(0);
    // Batroc's own removal can take the last threat of a stage (his text is not a thwart).
    const second = act(b, {}, webKick(b, batroc()));
    expect(ofType(second, "threatRemoved")).toMatchObject([{ amount: 6 }]);
    expect(ofType(second, "mainSchemeAdvanced")).toHaveLength(1);
    expect(ofType(second, "characterDefeated")).toEqual([]);
    expect(stageIndex(b)).toBe(1);
    expect(damageOn(b, batroc())).toBe(0);
    expect(b.state.villains[0]!.defeated).toBe(false);
    // 2B: 3[per_hero] threat, target 10[per_hero], completion loses.
    expect(mainThreat(b)).toBe(6);
    expect(mainSchemeValue(b.state, "targetThreat", DEPS)).toBe(20);
    expect(captivesInPlay(b)).toEqual([]);
  });

  it("round 1: For Justice! twice (4, then the last 2): the first player (P2, not the active player) chooses the captive's player and not to advance: 3[per_hero] = 6 more threat", () => {
    const [fj1, fj2] = handOf(b, FOR_JUSTICE) as [InstanceId, InstanceId];
    const [gr1, gr2] = handOf(b, GREAT_RESPONSIBILITY) as [InstanceId, InstanceId];
    const others = () => pay(b, 1, [fj1, fj2, gr1, gr2, ...handOf(b, SWINGING_WEB_KICK)]);
    const one = act(b, {}, play(P1, fj1, [gr1, ...others()]));
    expect(ofType(one, "threatRemoved")).toMatchObject([{ amount: 4 }]);
    expect(mainThreat(b)).toBe(2);
    const prompts: { kind: string; player: PlayerId; labels: string[] }[] = [];
    const watch: Picker = (s) => {
      const c = s.pendingChoice!;
      prompts.push({ kind: c.prompt.kind, player: c.playerId, labels: c.options.map((o) => o.label) });
      return planner({ player: P2, option: "Do not advance" })(s);
    };
    const r = driveEventsPicking(DEPS, b.state, watch, play(P1, fj2, [gr2, ...others()]));
    b.state = r.state;
    expect(ofType(r.events, "threatRemoved")).toMatchObject([{ amount: 2 }]);
    // 2B: "Each time the last threat is removed a Rescued Captive enters play and the players choose"; the first player
    // makes the choices (RRG "First Player", p. 19).
    const who = prompts.find((p) => p.kind === "choosePlayer")!;
    expect(who.player).toBe(P2);
    const option = prompts.find((p) => p.kind === "chooseOption")!;
    expect(option.player).toBe(P2);
    expect(option.labels).toEqual(["Advance to stage 3A", "Do not advance: place 3[per_hero] threat here"]);
    const [captive] = captivesInPlay(b);
    expect(captivesInPlay(b)).toHaveLength(1);
    expect(playerOf(b.state, P2).playArea).toContain(captive);
    expect(inst(b.state, captive!).exhausted).toBe(true);
    expect(b.state.encounterSetAside).toHaveLength(3);
    expect(stageIndex(b)).toBe(1);
    expect(mainThreat(b)).toBe(6);
  });

  it("round 1 villain phase: +2 acceleration; Batroc activates once for each hero (two attacks, 2 threat on Alert Level)", () => {
    stack(b, ADVANCE, ADVANCE, COMMANDEER, MAD_SCIENCE);
    const events = act(b, {}, endTurn(P1));
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(b), amount: 2 });
    const attacks = ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === batroc());
    expect(attacks.map((e) => e.targetInstanceId).sort()).toEqual(
      [identityOf(b.state, P1), identityOf(b.state, P2)].sort(),
    );
    expect(attacks.map((e) => e.baseAtk)).toEqual([2, 2]);
    expect(alertThreat(b)).toBe(2);
    expect(mainThreat(b)).toBe(8);
    // Commandeer Security Office: 3[per_hero] threat (6); one card is dealt to each player.
    expect(inst(b.state, inPlayCard(b.state, COMMANDEER)!).threat).toBe(6);
    expect(b.state.round).toBe(2);
  });

  it("round 2: a third reset (8 -> 2) and the captive's Hero Action, 1[per_hero] = 2 threat, remove 2B's last threat: the second captive, then Advance runs 3A on the Low side", () => {
    expect(b.state.firstPlayerId).toBe(P1); // the first player token has passed
    expect(activePlayer(b)).toBe(P1);
    give(b, P1, SWINGING_WEB_KICK);
    act(b, {}, webKick(b, batroc()));
    expect(mainThreat(b)).toBe(2);
    act(b, {}, endTurn(P1));
    expect(activePlayer(b)).toBe(P2);
    const captive = captivesInPlay(b)[0]!;
    expect(inst(b.state, captive).exhausted).toBe(false); // readied at the end of the player phase
    const events = act(
      b,
      { player: P1, option: "Advance to" },
      {
        type: "useAbility",
        playerId: P2,
        cardInstanceId: captive,
        abilityId: "50091.rescued-captive-action" as never,
        payment: [],
      },
    );
    expect(ofType(events, "threatRemoved")[0]).toMatchObject({ schemeInstanceId: mainOf(b), amount: 2 });
    expect(captivesInPlay(b)).toHaveLength(2);
    expect(playerOf(b.state, P1).playArea.filter((i) => codeOf(b.state, i) === "50091")).toHaveLength(1);
    expect(stageIndex(b)).toBe(2);
    // 3A on Low: "remove all threat from it and flip it to High" (its 2 tokens go); no facedown cards are dealt.
    expect(ofType(events, "threatRemoved").filter((e) => e.schemeInstanceId === alertOf(b))).toMatchObject([
      { amount: 2 },
    ]);
    expect(alertSide(b)).toBe("High");
    expect(alertThreat(b)).toBe(0);
    expect(b.state.players.map((p) => p.dealtEncounter.length)).toEqual([0, 0]);
    expect(mainThreat(b)).toBe(24); // 12[per_hero]
    expect(mainSchemeValue(b.state, "targetThreat", DEPS)).toBe(36);
    expect(mainSchemeValue(b.state, "acceleration", DEPS)).toBe(2);
  });

  it("invariants: no prompt pending, no card in two zones, every encounter card and deck card accounted for", () => {
    expectInvariants(b, baseline);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game C: Alert Level, flip at the threshold, High-side Guard and Patrol, the loss
// ---------------------------------------------------------------------------------------------------------------

describe("Batroc scenario, game C: solo, Alert Level flips at its threshold and loses at the next", () => {
  const c = open([SPIDER_MAN]);
  const baseline = { encounter: encounterIdsOf(c.state), playerCards: playerCardIdsOf(c.state) };
  const batroc = () => villainOf(c);

  it("round 1: a Guard dealt on the Low side has no surge; Batroc's attack puts Alert Level at 1", () => {
    act(c, {}, toHero());
    stack(c, ADVANCE, GUARD);
    const events = act(c, {}, endTurn());
    expect(alertThreat(c)).toBe(1);
    expect(ofType(events, "encounterCardRevealed")).toHaveLength(1);
    expect(hasKeyword(c.state, inPlayCard(c.state, GUARD)!, "surge", DEPS)).toBe(false);
  });

  it("round 2: Haymaker defeats the Guard (its When Defeated and Alert Level's response: 1 + 2 = 3); Batroc's attack reaches 4, all threat leaves and Alert Level flips", () => {
    give(c, P1, HAYMAKER);
    const haymaker = handOf(c, HAYMAKER)[0]!;
    const defeated = act(c, { target: inPlayCard(c.state, GUARD)! }, play(P1, haymaker, pay(c, 2, [haymaker])));
    expect(ofType(defeated, "characterDefeated")).toHaveLength(1);
    expect(alertThreat(c)).toBe(3);
    expect(alertSide(c)).toBe("Low");
    stack(c, ADVANCE, GUARD, PATROL);
    const events = act(c, {}, endTurn());
    // Batroc attacks first, on the Low side (ATK 2), and that attack is what takes Alert Level to 4.
    expect(ofType(events, "attackResolved")).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);
    expect(ofType(events, "threatRemoved").filter((e) => e.schemeInstanceId === alertOf(c))).toMatchObject([
      { amount: 4 },
    ]);
    expect(ofType(events, "cardFlipped")).toMatchObject([{ instanceId: alertOf(c), flipped: true }]);
    expect(alertSide(c)).toBe("High");
    expect(alertThreat(c)).toBe(0);
    // On High Batroc gets +1 ATK and +1 SCH.
    expect(maxHitPoints(c.state, batroc(), DEPS)).toBe(8);
  });

  it("round 2 villain phase (High): the Guard gains surge and reveals the Patrol, which has incite 1: +1 threat on the main scheme", () => {
    const guard = inPlayCard(c.state, GUARD)!;
    const patrol = inPlayCard(c.state, PATROL)!;
    expect(inst(c.state, guard).engagedWith).toBe(P1);
    expect(inst(c.state, patrol).engagedWith).toBe(P1);
    expect(hasKeyword(c.state, guard, "surge", DEPS)).toBe(true);
    expect(hasKeyword(c.state, patrol, "incite", DEPS)).toBe(true);
    expect(c.state.round).toBe(3);
    // 6 start + 1 + 1 acceleration + 1 incite.
    expect(mainThreat(c)).toBe(9);
  });

  it("round 3: the High side loses the game when Alert Level reaches 4: one defeat gives 2, the second 4", () => {
    give(c, P1, SWINGING_WEB_KICK, SWINGING_WEB_KICK, "01004", "01004");
    const guard = inPlayCard(c.state, GUARD)!;
    const patrol = inPlayCard(c.state, PATROL)!;
    const [k1, k2] = handOf(c, SWINGING_WEB_KICK) as [InstanceId, InstanceId];
    const first = act(c, { target: guard }, play(P1, k1, pay(c, 3, [k1, k2])));
    expect(ofType(first, "characterDefeated")).toMatchObject([{ instanceId: guard }]);
    expect(alertThreat(c)).toBe(2);
    expect(c.state.outcome).toBeNull();
    const second = act(c, { target: patrol }, play(P1, k2, pay(c, 3, [k2])));
    expect(alertThreat(c)).toBe(4);
    expect(ofType(second, "gameEnded")).toMatchObject([{ outcome: { result: "loss", reason: "cardAbility" } }]);
    expect(c.state.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
  });

  it("invariants: no prompt pending, no card in two zones, every card accounted for", () => {
    expectInvariants(c, baseline);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game D: Leaping Kick on an ally (hero form)
// ---------------------------------------------------------------------------------------------------------------

describe("Batroc scenario, game D: solo, Leaping Kick (hero form) on the only ally", () => {
  const d = open([SPIDER_MAN]);
  const baseline = { encounter: encounterIdsOf(d.state), playerCards: playerCardIdsOf(d.state) };

  it("Batroc attacks Mockingbird with overkill: ATK 2 + 2 boost icons = 4 against 3 hit points, 1 excess damage to Spider-Man", () => {
    act(d, {}, toHero());
    give(d, P1, MOCKINGBIRD);
    const mocking = handOf(d, MOCKINGBIRD)[0]!;
    act(d, {}, play(P1, mocking, pay(d, 3, [mocking])));
    expect(inPlayCodes(d)).toContain(MOCKINGBIRD);
    stack(d, ADVANCE, LEAPING_KICK, SECURITY_CAMERAS_BOOST_TWO);
    const events = act(d, {}, endTurn());
    const attacks = ofType(events, "attackResolved");
    const spider = identityOf(d.state, P1);
    expect(attacks).toHaveLength(2);
    // Batroc's own attack on the hero (boost 0), then the Kick's.
    expect(attacks[0]).toMatchObject({ targetInstanceId: spider, baseAtk: 2, boostIcons: 0, damageDealt: 2 });
    expect(attacks[1]).toMatchObject({ targetInstanceId: mocking, baseAtk: 2, boostIcons: 2 });
    expect(ofType(events, "characterDefeated").map((e) => e.instanceId)).toEqual([mocking]);
    // Overkill (RRG "Overkill"): the 1 excess damage goes to Spider-Man, on top of the first attack's 2.
    expect(damageOn(d, spider)).toBe(3);
    // 2 attacks + Mockingbird's defeat (the Kick's damage is not consequential).
    expect(alertThreat(d)).toBe(3);
    expect(d.state.outcome).toBeNull();
  });

  it("invariants: no prompt pending, no card in two zones, every card accounted for", () => {
    expectInvariants(d, baseline);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game E: stage 3B, no Rescued Captive in play
// ---------------------------------------------------------------------------------------------------------------

describe("Batroc scenario, game E: solo, stage 3B is lost when the only Rescued Captive is defeated", () => {
  const e = toStageThree();
  const baseline = { encounter: encounterIdsOf(e.state), playerCards: playerCardIdsOf(e.state) };

  it("Batroc's attack (3) and Leaping Kick's (3, overkill) both reach the captive; the tie with Mockingbird is the first player's pick", () => {
    const [captive] = captivesInPlay(e) as [InstanceId];
    const mocking = inPlayCard(e.state, MOCKINGBIRD)!;
    expect(stageIndex(e)).toBe(2);
    stack(e, ADVANCE, LEAPING_KICK, ADVANCE);
    const options: string[][] = [];
    const watch: Picker = (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "chooseTarget") options.push(c.options.map((o) => o.optionId as string));
      return planner({ target: captive })(s);
    };
    const r = driveEventsPicking(DEPS, e.state, watch, endTurn());
    e.state = r.state;
    const attacks = ofType(r.events, "attackResolved");
    expect(attacks.map((a) => a.targetInstanceId)).toEqual([captive, captive]);
    // Remaining hit points when the Kick picks: captive 5 - 3 = 2, Mockingbird 3 - 1 = 2: tied, both offered.
    expect(options.some((o) => o.includes(captive) && o.includes(mocking))).toBe(true);
    expect(ofType(r.events, "characterDefeated").map((x) => x.instanceId)).toContain(captive);
    expect(captivesInPlay(e)).toEqual([]);
    // 3B: "lose ... when there are no Rescued Captive allies in play".
    expect(e.state.outcome).toMatchObject({ result: "loss" });
  });

  it("invariants: no prompt pending, no card in two zones, every card accounted for", () => {
    expectInvariants(e, baseline);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// What the games do not prove
// ---------------------------------------------------------------------------------------------------------------

describe("not played in a whole game", () => {
  it.todo(
    "Security Cameras, hero half (50097): scripted since; covered by the unit tests only (batroc.test.ts), kept out of these stacks",
  );
  it.todo(
    "expert mode: Alert Level's 2[per_hero] threat at setup and at 3A, Batroc (B) with 12 hit points, quickstrike minions at 3B",
  );
  it.todo("Heightened Reflexes (50092) against Batroc's reset: covered by the unit tests only (batroc.test.ts)");
  it.todo("the Alert Level Hero Action and Commandeer Security Office's When Defeated: unit tests only");
});
