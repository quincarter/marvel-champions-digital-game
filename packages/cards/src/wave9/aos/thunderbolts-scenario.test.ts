import {
  applyCommand,
  cardsInPlay,
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
  P3,
  P4,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  use,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { EXTREME_RISK } from "../bp/extreme-risk.js";
import { GROWING_STRONG } from "../silk/growing-strong.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { wave9Scenario } from "../setup.js";
import { CAPTAIN_MARVEL, IRON_MAN, SHE_HULK, SPIDER_MAN, codeOf, inPlayCard, piles } from "../testing.js";
import { GRAVITATIONAL_PULL } from "./gravitational-pull.js";
import { HARD_SOUND } from "./hard-sound.js";
import { PALE_LITTLE_SPIDER } from "./pale-little-spider.js";
import { POWER_OF_THE_ATOM } from "./power-of-the-atom.js";
import { SUPERSONIC } from "./supersonic.js";
import { THE_LEAPER } from "./the-leaper.js";
import { THUNDERBOLTS } from "./thunderbolts.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * Whole-game tests of the Thunderbolts scenario (MC50 p. 15, docs/phase7-wave9.md section 2.5 and section 8.4
 * "Thunderbolts scenario game, at one and at four players"): the real `wave9Scenario("thunderbolts")` builder (standard
 * mode unless a game says expert, scripted Thunderbolt sets pinned with `setAsideModularSetIds`, Core starter decks)
 * played through the engine's real commands, one decision at a time, deterministic by seed. Only the encounter deck's
 * order (`stackEncounterDeck`) and the cards a turn needs in hand (`moveToHand`) are seeded, with one exception named
 * where it happens (game C stages Citizen V's and one minion's damage with `patchInstance`). RRG 1.8 =
 * mc_rulesreference_v18_compressed.md; rulings = marvel-champions-rulings-post-rrg-1-7.md.
 *
 * Owner decisions in force: Q2 = A (a stunned or confused Citizen V who "would activate" against a player engaged with a
 * Thunderbolt minion discards the status card and does not heal; game C), Q25 = A (a minion already in play that
 * engages a player triggers quickstrike; no quickstrike minion is in the scripted sets, see the todos), Q26 = A (the
 * remaining minion is put into play held and resolves its keywords, not its When Revealed; every game's setup and game
 * E's tough card), Q27 = A (the environment leaving play discards a held minion; see the todos).
 *
 * Games:
 * - A (solo, Spider-Man, The Leaper + Power of the Atom, to a win): setup numbers; guard on Thunderbolt minions
 *   (RRG "Guard"); the held minion pulled onto the attacker by 50130b; Batroc's engage interrupt; the round-end swap
 *   (most damaged held, healed 1); a Thunderbolt minion defeated into the victory display and nothing replacing it;
 *   Citizen V's step-two interrupt; Tap In's fallback; Innocent Bystanders to exhaustion; Radioactive Man's response;
 *   the win once 1 Thunderbolt minion is in the victory display.
 * - B (four players, five sets): per-player numbers; turn order; Songbird, Joystick, Black Widow (Retaliate), Moonstone
 *   and Atlas doing their own thing; The Coming Storm and Rumbling Thunder rotating engagement round the table (and the
 *   Hazard icon's extra card); Jolt's parley removing her; Tap In's tie; the Sword; amplify; the swap with a new first
 *   player.
 * - C (two players): Citizen V at 0 hit points and not defeated with 1 of 2 minions in the victory display; the real
 *   heal of 4; ties at the swap; Q2 = A; MACH-IV against a non-Aerial hero; the second minion defeats him at once.
 * - D (solo): the loss when the main scheme completes.
 * - E (two players, expert): tough on all three minions (the held one too), tough and the swap, Bystanders' 2 threat.
 */
const DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE8_ABILITIES,
    THUNDERBOLTS,
    GRAVITATIONAL_PULL,
    HARD_SOUND,
    PALE_LITTLE_SPIDER,
    POWER_OF_THE_ATOM,
    SUPERSONIC,
    THE_LEAPER,
    EXTREME_RISK,
    GROWING_STRONG,
  ),
};

interface Sim {
  state: GameState;
  log: GameEvent[];
}
interface Plan {
  readonly take?: string;
  readonly option?: string;
  readonly target?: InstanceId;
  readonly player?: PlayerId;
  /** A `spendResources` prompt: pay nothing, or pay with this card from hand (default: the first option). */
  readonly spend?: "none" | InstanceId;
  /** A `chooseTarget` over cards, answered by the first option that is one of these (a discard from hand). */
  readonly among?: readonly InstanceId[];
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
        const hit =
          (plan.target ? offered.find((o) => (o.optionId as string) === plan.target) : undefined) ??
          (plan.among ? offered.find((o) => plan.among!.includes(o.optionId as InstanceId)) : undefined);
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "choosePlayer": {
        const hit = plan.player ? offered.find((o) => (o.optionId as string) === plan.player) : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "spendResources":
        if (plan.spend === "none") return [];
        return offered
          .filter((o) => !plan.spend || o.optionId === `hand:${plan.spend}`)
          .slice(0, 1)
          .map((o) => o.optionId);
      default:
        return firstLegal(s);
    }
  };

const SEATS = [SPIDER_MAN, IRON_MAN, CAPTAIN_MARVEL, SHE_HULK] as const;
function open(
  players: number,
  sets: readonly string[],
  opts: { seed?: number; expert?: boolean; first?: number } = {},
): Sim {
  const config = wave9Scenario("thunderbolts", {
    players: SEATS.slice(0, players),
    seed: opts.seed ?? 1,
    setAsideModularSetIds: sets,
    ...(opts.expert ? { difficulty: "expert" as const } : {}),
    ...(opts.first !== undefined ? { firstPlayerIndex: opts.first } : {}),
  });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return { state: settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS), log: [] };
}
function act(sim: Sim, plan: Plan, ...commands: readonly Command[]): GameEvent[] {
  const r = driveEventsPicking(DEPS, sim.state, planner(plan), ...commands);
  sim.state = r.state;
  sim.log = [...sim.log, ...r.events];
  return [...r.events];
}
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

// Core cards
const KICK = "01005"; // Swinging Web Kick: attack event, 8 damage to an enemy, cost 3
const HAYMAKER = "01087"; // attack event, 3 damage to an enemy, cost 2
const MOCKINGBIRD = "01083"; // Response: after she enters play, stun an enemy
const BLANK = "01186"; // Advance: boost 0 (used as a boost card that adds nothing)
// Wave 9 cards
const CITIZEN_V = "50129a";
const JUSTICE = "50131a";
const SWORD = "50132";
const JOLT = "50133";
const BYSTANDERS = "50134";
const COMING_STORM = "50135";
const RUMBLING_THUNDER = "50136";
const DOWN_BUT_NOT_OUT = "50137";
const TAP_IN = "50138";
const BATROC = "50161";
const RADIOACTIVE_MAN = "50152";
const MOONSTONE = "50139";
const SONGBIRD = "50143";
const BLACK_WIDOW = "50148";
const MACH_IV = "50156";
const JOYSTICK = "51039";
const ATLAS = "52035";
/** Every Elite, Thunderbolt minion of the eight scripted sets. */
const ELITES = [MOONSTONE, SONGBIRD, BLACK_WIDOW, RADIOACTIVE_MAN, MACH_IV, BATROC, JOYSTICK, ATLAS];

/** The instance of a card by code wherever it is (an Elite minion is one card per game). */
const idOfCode = (sim: Sim, code: string): InstanceId =>
  (Object.keys(sim.state.instances) as InstanceId[]).find((i) => codeOf(sim.state, i) === code)!;
const handOf = (sim: Sim, code: string, player: PlayerId = P1): InstanceId[] =>
  playerOf(sim.state, player).hand.filter((i) => codeOf(sim.state, i) === code);
const give = (sim: Sim, player: PlayerId, ...codes: string[]) => {
  sim.state = moveToHand(sim.state, player, ...codes).state;
};
const stack = (sim: Sim, ...codes: string[]) => {
  sim.state = stackEncounterDeck(sim.state, ...codes);
};
const rejection = (sim: Sim, command: Command): string | null => {
  const r = applyCommand(sim.state, command, DEPS);
  return r.ok ? null : r.error.code;
};
const attack = (by: InstanceId, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: by,
  targetInstanceId: target,
});
const villainOf = (sim: Sim): InstanceId => sim.state.villains[0]!.instanceId;
const mainOf = (sim: Sim): InstanceId => sim.state.mainScheme.instanceId;
const mainThreat = (sim: Sim): number => inst(sim.state, mainOf(sim)).threat;
const damageOf = (sim: Sim, id: InstanceId): number => inst(sim.state, id).damage;
const environmentOf = (sim: Sim): InstanceId => inPlayCard(sim.state, JUSTICE)!;
/** The minion the environment holds, if any. */
const heldOf = (sim: Sim): InstanceId | undefined => inst(sim.state, environmentOf(sim)).attachments[0];
const engagedWith = (sim: Sim, id: InstanceId): PlayerId | null => inst(sim.state, id).engagedWith;
/** Who each Elite minion in play is engaged with, by code ("held" for the one the environment holds). */
const seating = (sim: Sim): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const id of cardsInPlay(sim.state)) {
    const code = codeOf(sim.state, id);
    if (!ELITES.includes(code) && code !== JOLT) continue;
    out[code] = inst(sim.state, id).heldMinion ? "held" : (engagedWith(sim, id) ?? "nobody");
  }
  return out;
};
const deckCounts = (s: GameState): Record<string, number> => {
  const count: Record<string, number> = {};
  for (const id of piles(s).deck) count[codeOf(s, id)] = (count[codeOf(s, id)] ?? 0) + 1;
  return count;
};
const victoryCodes = (sim: Sim): string[] => sim.state.victoryDisplay.map((i) => codeOf(sim.state, i));
const playAreaCodes = (sim: Sim, player: PlayerId = P1): string[] =>
  playerOf(sim.state, player).playArea.map((i) => codeOf(sim.state, i));
const activeOf = (sim: Sim): PlayerId => (sim.state.step as { activePlayerId: PlayerId }).activePlayerId;

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
 * every card a deck started with still somewhere (RRG "Owner", p. 31; "Choices"), and every Elite, Thunderbolt minion
 * of the chosen sets accounted for in exactly one place: engaged, held by the environment, in the victory display or
 * discarded (never in the encounter deck again and never left in the set-aside area).
 */
function expectInvariants(
  sim: Sim,
  setup: { encounter: readonly InstanceId[]; playerCards: readonly InstanceId[]; elites: readonly InstanceId[] },
) {
  const s = sim.state;
  expect(s.pendingChoice).toBeNull();
  const zones = zoneIndex(s);
  const twice = [...zones].filter(([, labels]) => labels.length > 1);
  expect(twice).toEqual([]);
  const lostEncounter = setup.encounter.filter((id) => !zones.has(id) && inst(s, id).attachedTo === null);
  expect(lostEncounter.map((i) => codeOf(s, i))).toEqual([]);
  const lostPlayer = setup.playerCards.filter((id) => !zones.has(id) && inst(s, id).attachedTo === null);
  expect(lostPlayer.map((i) => codeOf(s, i))).toEqual([]);
  for (const [id, instance] of Object.entries(s.instances))
    if (instance.attachedTo !== null) expect(s.instances[instance.attachedTo]?.attachments).toContain(id);
  // Each Elite minion is in exactly one of: a player's area, the environment's attachments, the victory display, the
  // encounter discard pile. None is in the deck or the set-aside area.
  const place = (id: InstanceId): string => {
    if (s.victoryDisplay.includes(id)) return "victory";
    if (inst(s, id).attachedTo !== null) return "held";
    if (s.players.some((p) => p.playArea.includes(id))) return "engaged";
    if (Object.values(s.encounterDecks).some((pile) => pile.discard.includes(id))) return "discard";
    return `lost(${zones.get(id)?.join("+") ?? "nowhere"})`;
  };
  for (const id of setup.elites) expect(["victory", "held", "engaged", "discard"], codeOf(s, id)).toContain(place(id));
  expect(s.encounterSetAside.filter((i) => ELITES.includes(codeOf(s, i)))).toEqual([]);
}

const eliteIdsOf = (s: GameState): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => ELITES.includes(codeOf(s, i)));
const baselineOf = (sim: Sim) => ({
  encounter: encounterIdsOf(sim.state),
  playerCards: playerCardIdsOf(sim.state),
  elites: eliteIdsOf(sim.state),
});

// ---------------------------------------------------------------------------------------------------------------
// Game A: solo, standard, Core Spider-Man, to a win
// ---------------------------------------------------------------------------------------------------------------

describe("Thunderbolts scenario, game A: solo (Spider-Man), standard, The Leaper + Power of the Atom, seed 4, to a win", () => {
  const a = open(1, ["the_leaper", "power_of_the_atom"], { seed: 4 });
  const baseline = baselineOf(a);
  const spider = () => identityOf(a.state, P1);
  const citizen = () => villainOf(a);
  const batroc = () => idOfCode(a, BATROC);
  const radio = () => inPlayCard(a.state, RADIOACTIVE_MAN)!;
  let villainPhase1: GameEvent[] = [];
  let junk: InstanceId;
  let spend: InstanceId;
  let rest: InstanceId[];

  it("setup (MC50 p. 15, 50130a): 1 + 1 sets chosen, their Elite minions out of the deck, one engaged and one held; 1 threat, 12 hit points", () => {
    expect(a.state.players).toHaveLength(1);
    expect(playerOf(a.state, P1).identity.form).toBe("alterEgo");
    expect(codeOf(a.state, citizen())).toBe(CITIZEN_V);
    expect(a.state.villains[0]!.stageIndex).toBe(0);
    expect(maxHitPoints(a.state, citizen(), DEPS)).toBe(12); // 12[per_hero]
    // 50130b: 1[per_hero] threat to start, 11[per_hero] to complete, 1[per_hero] acceleration; completing it loses.
    expect(mainThreat(a)).toBe(1);
    expect(mainSchemeValue(a.state, "targetThreat", DEPS)).toBe(11);
    expect(mainSchemeValue(a.state, "acceleration", DEPS)).toBe(1);
    // 50131a When Revealed: each player reveals a random set-aside Thunderbolt minion (it engages them); the remaining
    // one is attached faceup to the environment; the environment flips to Thunderbolt Backup.
    expect(a.state.villainArea.map((i) => codeOf(a.state, i))).toEqual([JUSTICE]);
    expect(inst(a.state, environmentOf(a)).flipped).toBe(true);
    expect(seating(a)).toEqual({ [BATROC]: "p1", [RADIOACTIVE_MAN]: "held" });
    expect(inst(a.state, radio())).toMatchObject({ attachedTo: environmentOf(a), engagedWith: null, faceup: true });
    expect(heldOf(a)).toBe(radio());
    expect(playAreaCodes(a)).toEqual([BATROC]);
    // "Set each of those minions aside and shuffle the rest of their encounter sets into the encounter deck": the
    // set-aside area is empty (both minions were used) and neither Elite minion is anywhere in the deck.
    expect(a.state.encounterSetAside).toEqual([]);
    expect(a.state.setAsideModularSets ?? []).toEqual([]);
    const deck = deckCounts(a.state);
    expect(deck[BATROC]).toBeUndefined();
    expect(deck[RADIOACTIVE_MAN]).toBeUndefined();
    // Batroc's Forced Interrupt (discard 1 when he engages you) ran at setup, before the opening hand was drawn
    // (RRG Appendix II, step 12 before step 14): nothing to discard, so the hand is the full 6 and the discard is empty.
    expect(playerOf(a.state, P1).hand).toHaveLength(6);
    expect(playerOf(a.state, P1).discard).toEqual([]);
    // Standard: no tough status card on either minion.
    for (const id of [batroc(), radio()]) expect(inst(a.state, id).statuses.tough).toBe(0);
    expect(a.state.pendingChoice).toBeNull();
  });

  it("setup: the encounter deck is 29 cards: Thunderbolts 11 (Jolt among them), the other 5 cards of each chosen set, Standard 7, Spider-Man's obligation 1", () => {
    expect(piles(a.state).deck).toHaveLength(29);
    expect(deckCounts(a.state)).toEqual({
      // Thunderbolts (11): the environment is revealed, the villain and main scheme are not encounter cards.
      [SWORD]: 1,
      [JOLT]: 1,
      [BYSTANDERS]: 3,
      [COMING_STORM]: 1,
      [RUMBLING_THUNDER]: 1,
      [DOWN_BUT_NOT_OUT]: 2,
      [TAP_IN]: 2,
      // Power of the Atom (50152 set aside; 5 left) and The Leaper (50161 set aside; 5 left)
      "50153": 2,
      "50154": 1,
      "50155": 2,
      "50162": 1,
      "50163": 2,
      "50164": 2,
      // Standard (7) and Spider-Man's obligation (Core)
      "01186": 2,
      "01187": 2,
      "01188": 1,
      "01189": 1,
      "01190": 1,
      "01165": 1,
    });
  });

  it("round 1: Spider-Man flips to hero form; Citizen V cannot be attacked while Batroc, a Thunderbolt minion with guard, is engaged with him (RRG 'Guard')", () => {
    const flipped = act(a, {}, { type: "changeForm", playerId: P1 });
    expect(ofType(flipped, "formChanged")).toMatchObject([{ to: "hero" }]);
    // 50130b: "Each Thunderbolt minion gains guard." RRG Guard: the engaged player cannot attack any villain.
    expect(hasKeyword(a.state, batroc(), "guard", DEPS)).toBe(true);
    expect(hasKeyword(a.state, radio(), "guard", DEPS)).toBe(true);
    expect(hasKeyword(a.state, citizen(), "guard", DEPS)).toBe(false);
    expect(rejection(a, attack(spider(), citizen()))).toBe("no_valid_target");
  });

  it("round 1: Spider-Man attacks Batroc for 2; being attacked engages him (50130b), which changes nothing as he already is", () => {
    const events = act(a, {}, attack(spider(), batroc()));
    expect(ofType(events, "damageDealt")).toMatchObject([{ targetInstanceId: batroc(), amount: 2 }]);
    expect(ofType(events, "abilityResolved").map((e) => e.abilityId)).toEqual([
      "50130b.apprehending-rogue-agents-forced-response",
    ]);
    expect(damageOf(a, batroc())).toBe(2);
    expect(engagedWith(a, batroc())).toBe(P1);
    expect(damageOf(a, radio())).toBe(0);
  });

  it("round 1 villain phase: +1 acceleration; Citizen V gives up his attack (no boost card) as Spider-Man is engaged with a Thunderbolt minion; Batroc attacks for 2", () => {
    stack(a, BLANK, BYSTANDERS); // Batroc's boost card (Citizen V draws none), then the card dealt to the player
    const events = act(a, {}, endTurn());
    villainPhase1 = events;
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(a), amount: 1 });
    expect(mainThreat(a)).toBe(2);
    // Step two: Citizen V "would activate" (the attack), his Forced Interrupt cancels it and heals 4 (nothing to heal).
    const activations = ofType(events, "enemyActivated");
    expect(activations.map((e) => codeOf(a.state, e.enemyInstanceId))).toEqual([CITIZEN_V, BATROC]);
    expect(ofType(events, "abilityResolved").map((e) => e.abilityId)).toContain("50129a.citizen-v-forced-interrupt");
    expect(ofType(events, "attackResolved")).toMatchObject([{ enemyInstanceId: batroc(), baseAtk: 2, damageDealt: 2 }]);
    expect(ofType(events, "boostCardDealt")).toHaveLength(1);
    expect(ofType(events, "boostCardDealt")[0]).toMatchObject({ enemyInstanceId: batroc() });
    expect(damageOf(a, spider())).toBe(2);
    // Step three/four: Innocent Bystanders (an obligation) is dealt and revealed: 4 bystander counters (Uses 4).
    const bystanders = inPlayCard(a.state, BYSTANDERS)!;
    expect(playAreaCodes(a)).toContain(BYSTANDERS);
    expect(inst(a.state, bystanders).counters).toMatchObject({ bystander: 4 });
  });

  it("round 1 end: Thunderbolt Backup swaps in the most damaged minion: Batroc (2) is held and heals 1[per_hero]; Radioactive Man engages Spider-Man", () => {
    // 50131b Forced Interrupt "when the round ends": the villain phase's last step, in the endTurn above.
    const events = villainPhase1;
    expect(ofType(events, "minionHeld")).toMatchObject([{ instanceId: batroc(), engagedBefore: P1 }]);
    expect(ofType(events, "damageHealed")).toMatchObject([{ targetInstanceId: batroc(), amount: 1 }]);
    expect(seating(a)).toEqual({ [BATROC]: "held", [RADIOACTIVE_MAN]: "p1" });
    expect(heldOf(a)).toBe(batroc());
    expect(inst(a.state, batroc())).toMatchObject({
      engagedWith: null,
      attachedTo: environmentOf(a),
      heldMinion: true,
    });
    expect(damageOf(a, batroc())).toBe(1); // 2 damage, 1 healed
    expect(inst(a.state, radio())).toMatchObject({ engagedWith: P1, attachedTo: null });
    expect(a.state.round).toBe(2);
  });

  it("round 2: a Swinging Web Kick on the held Batroc (8, to 9) engages him (50130b) and his Forced Interrupt makes Spider-Man discard; Innocent Bystanders asks for a resource", () => {
    give(a, P1, KICK, KICK, "01007", "01007", "01008", "01008");
    const kicks = handOf(a, KICK);
    const others = playerOf(a.state, P1).hand.filter((i) => !kicks.includes(i));
    expect(others).toHaveLength(9);
    [junk, spend, ...rest] = others.slice(-2).concat(others.slice(0, -2)) as [InstanceId, InstanceId, ...InstanceId[]];
    const events = act(a, { target: batroc(), among: [junk], spend }, play(P1, kicks[0]!, rest.slice(0, 3)));
    expect(ofType(events, "damageDealt")).toMatchObject([{ targetInstanceId: batroc(), amount: 8 }]);
    expect(damageOf(a, batroc())).toBe(9);
    // 50130b Forced Response: "After a player attacks a Thunderbolt minion, that minion engages that player."
    expect(engagedWith(a, batroc())).toBe(P1);
    expect(inst(a.state, batroc()).attachedTo).toBeNull();
    expect(heldOf(a)).toBeUndefined();
    expect(playAreaCodes(a)).toContain(BATROC);
    // 50161 Forced Interrupt: "When Batroc engages you, discard 1 card from your hand."
    expect(playerOf(a.state, P1).discard).toContain(junk);
    expect(playerOf(a.state, P1).hand).not.toContain(junk);
    // 50134 Forced Response: "After you attack an enemy ... either spend 1 resource ... Remove 1 bystander counter."
    expect(inst(a.state, inPlayCard(a.state, BYSTANDERS)!).counters).toMatchObject({ bystander: 3 });
    expect(playerOf(a.state, P1).discard).toContain(spend);
    expect(mainThreat(a)).toBe(2);
  });

  it("round 2: a second Kick defeats Batroc (17 of 16): Victory 1 puts him in the victory display, nothing takes his place; Bystanders: threat instead", () => {
    const kick = handOf(a, KICK)[0]!;
    const events = act(a, { target: batroc(), option: "Place threat" }, play(P1, kick, rest.slice(3, 6)));
    expect(ofType(events, "damageDealt")).toMatchObject([{ targetInstanceId: batroc(), amount: 8 }]);
    expect(ofType(events, "characterDefeated").map((e) => codeOf(a.state, e.instanceId))).toEqual([BATROC]);
    expect(victoryCodes(a)).toEqual([BATROC]);
    expect(inPlayCard(a.state, BATROC)).toBeUndefined();
    // Defeated by the attack, so it did not engage anybody again (50130b is checked against "still in play").
    expect(playAreaCodes(a)).not.toContain(BATROC);
    // "What replaces it": nothing. The environment holds nobody until the next round-end swap.
    expect(heldOf(a)).toBeUndefined();
    expect(inst(a.state, environmentOf(a)).attachments).toEqual([]);
    expect(seating(a)).toEqual({ [RADIOACTIVE_MAN]: "p1" });
    // 50134 again: "place 1 threat on the main scheme" (1 in standard mode).
    expect(ofType(events, "threatPlaced")).toMatchObject([{ schemeInstanceId: mainOf(a), amount: 1 }]);
    expect(mainThreat(a)).toBe(3);
    expect(inst(a.state, inPlayCard(a.state, BYSTANDERS)!).counters).toMatchObject({ bystander: 2 });
  });

  it("round 2 villain phase: Citizen V gives up his attack again; Radioactive Man's attack also costs Spider-Man 1 more damage; Tap In has no minion to engage, so Citizen V activates", () => {
    // Boost for Radioactive Man, then Tap In dealt to the player, then the boost card for Citizen V's own activation.
    stack(a, BLANK, TAP_IN, BLANK);
    const events = act(a, { option: "Place threat" }, endTurn());
    expect(ofType(events, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(a), amount: 1 }); // acceleration
    const order = ofType(events, "enemyActivated").map((e) => codeOf(a.state, e.enemyInstanceId));
    // Step two: Citizen V (interrupted, no attack), then Radioactive Man. Tap In (step four) makes Citizen V attack
    // outside step two: that is an attack resolved below, not a second step-two activation.
    expect(order).toEqual([CITIZEN_V, RADIOACTIVE_MAN]);
    expect(ofType(events, "choiceFoundNothing")).toMatchObject([{ slot: "minion" }]);
    const attacks = ofType(events, "attackResolved");
    expect(attacks.map((e) => codeOf(a.state, e.enemyInstanceId))).toEqual([RADIOACTIVE_MAN, CITIZEN_V]);
    expect(attacks).toMatchObject([
      { baseAtk: 2, damageDealt: 2 },
      { baseAtk: 2, damageDealt: 2 },
    ]);
    // 50152 Forced Response: after he activates against you, 1 damage to each character you control (just the hero).
    expect(ofType(events, "damageDealt").map((e) => e.amount)).toEqual([2, 1, 2]);
    expect(damageOf(a, spider())).toBe(2 + 2 + 1 + 2);
    // 50138: nobody to engage ("not engaged with you": Radioactive Man is), so "Citizen V activates against you"; that
    // activation is not step two, so the interrupt does not cancel it.
    expect(ofType(events, "boostCardDealt").map((e) => codeOf(a.state, e.enemyInstanceId))).toEqual([
      RADIOACTIVE_MAN,
      CITIZEN_V,
    ]);
    // Bystanders: two enemy attacks, 2 counters left each time removed one: 0 left, and "Uses" discards the card.
    expect(inPlayCard(a.state, BYSTANDERS)).toBeUndefined();
    expect(piles(a.state).discard.map((i) => codeOf(a.state, i))).toEqual(expect.arrayContaining([BYSTANDERS, TAP_IN]));
    expect(mainThreat(a)).toBe(3 + 1 + 2);
  });

  it("round 2 end: Radioactive Man, the only Thunderbolt minion in play, is the most damaged by default and goes to be held; nobody is engaged", () => {
    expect(seating(a)).toEqual({ [RADIOACTIVE_MAN]: "held" });
    expect(heldOf(a)).toBe(radio());
    expect(playAreaCodes(a)).toEqual([]);
    expect(a.state.round).toBe(3);
  });

  it("round 3: with only a held (unengaged) minion, Spider-Man may attack Citizen V; the Kick, Haymaker and a basic attack deal 8 + 3 + 2 = 13 to his 12 hit points", () => {
    expect(rejection(a, attack(spider(), citizen()))).toBeNull();
    give(a, P1, KICK, HAYMAKER);
    const kick = handOf(a, KICK)[0]!;
    const hay = handOf(a, HAYMAKER)[0]!;
    const hand = playerOf(a.state, P1).hand.filter((i) => i !== kick && i !== hay);
    const first = act(a, {}, play(P1, kick, hand.slice(0, 3)));
    expect(ofType(first, "damageDealt")).toMatchObject([{ targetInstanceId: citizen(), amount: 8 }]);
    // Attacking the villain engages nobody: 50130b is about Thunderbolt minions only.
    expect(seating(a)).toEqual({ [RADIOACTIVE_MAN]: "held" });
    expect(damageOf(a, citizen())).toBe(8);
    const second = act(a, {}, play(P1, hay, hand.slice(3, 5)));
    expect(ofType(second, "damageDealt")).toMatchObject([{ targetInstanceId: citizen(), amount: 3 }]);
    expect(damageOf(a, citizen())).toBe(11);
    expect(a.state.villains[0]!.defeated).toBe(false);
    // Defeating him needs 1[per_hero] = 1 Thunderbolt minion in the victory display: Batroc is there.
    expect(victoryCodes(a)).toEqual([BATROC]);
    const last = act(a, {}, attack(spider(), citizen()));
    expect(ofType(last, "damageDealt")).toMatchObject([{ targetInstanceId: citizen(), amount: 2 }]);
    expect(a.state.villains[0]!.defeated).toBe(true);
    expect(ofType(last, "gameEnded")).toMatchObject([{ outcome: { result: "win", reason: "villainDefeated" } }]);
    expect(a.state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });

  it("invariants: no prompt, no card in two zones, every encounter card and deck card accounted for, Batroc in the victory display and Radioactive Man still held", () => {
    expectInvariants(a, baseline);
    expect(victoryCodes(a)).toEqual([BATROC]);
    expect(heldOf(a)).toBe(radio());
    expect(a.state.encounterSetAside).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game B: four players
// ---------------------------------------------------------------------------------------------------------------

const FOUR_SETS = ["gravitational_pull", "hard_sound", "pale_little_spider", "extreme_risk", "growing_strong"];
const PLAYERS = [P1, P2, P3, P4] as const;
const B_ELITES = [ATLAS, SONGBIRD, BLACK_WIDOW, MOONSTONE, JOYSTICK];
const PSYCH = "50142"; // Psychological Manipulation: boost 1, no Boost ability

describe("Thunderbolts scenario, game B: four players (Spider-Man, Iron Man, Captain Marvel, She-Hulk), five sets, seed 1", () => {
  const b = open(4, FOUR_SETS, { seed: 1 });
  const baseline = baselineOf(b);
  const id = (code: string) => idOfCode(b, code);
  const hero = (p: PlayerId) => identityOf(b.state, p);
  const heroDamage = (p: PlayerId) => damageOf(b, hero(p));
  let round1: GameEvent[] = [];
  let round2: GameEvent[] = [];

  it("setup (MC50 p. 15): 4 + 1 sets, five Elite minions set aside and used: four revealed (one each) and one held; per-player numbers", () => {
    expect(b.state.players.map((p) => p.playerId)).toEqual(PLAYERS);
    expect(maxHitPoints(b.state, villainOf(b), DEPS)).toBe(48); // 12[per_hero]
    expect(mainThreat(b)).toBe(4); // 1[per_hero]
    expect(mainSchemeValue(b.state, "targetThreat", DEPS)).toBe(44); // 11[per_hero]
    expect(mainSchemeValue(b.state, "acceleration", DEPS)).toBe(4); // 1[per_hero]
    // Seed 1 deals Atlas to p1, Songbird to p2, Black Widow to p3, Moonstone to p4; Joystick is held.
    expect(seating(b)).toEqual({
      [ATLAS]: "p1",
      [SONGBIRD]: "p2",
      [BLACK_WIDOW]: "p3",
      [MOONSTONE]: "p4",
      [JOYSTICK]: "held",
    });
    expect(inst(b.state, id(JOYSTICK))).toMatchObject({
      attachedTo: environmentOf(b),
      engagedWith: null,
      faceup: true,
    });
    expect(b.state.encounterSetAside).toEqual([]);
    const deck = deckCounts(b.state);
    for (const elite of ELITES) expect(deck[elite]).toBeUndefined();
    // 7 Standard + 4 obligations + 11 Thunderbolts + 5 cards in each of the 5 sets.
    expect(piles(b.state).deck).toHaveLength(47);
    expect(deck[JOLT]).toBe(1);
    // The five sets' other cards are in the deck (one card of each, as a sample).
    for (const sample of ["50141", "50147", "50151", "51042", "52037"]) expect(deck[sample]).toBe(2);
    // No tough card in standard mode; Black Widow keeps no Handspring; four hands of the opening size.
    for (const code of [ATLAS, SONGBIRD, BLACK_WIDOW, MOONSTONE, JOYSTICK])
      expect(inst(b.state, id(code)).statuses.tough).toBe(0);
    expect(b.state.firstPlayerId).toBe(P1);
    expect(b.state.pendingChoice).toBeNull();
  });

  it("round 1: players act in turn order p1, p2, p3, p4; every one flips to hero form and Citizen V is out of reach (guard)", () => {
    expect(activeOf(b)).toBe(P1);
    for (const p of PLAYERS) {
      // Only the active player may act (RRG "Turn Order"); the guard check is per attacking player.
      if (p !== activeOf(b)) expect(rejection(b, { type: "changeForm", playerId: p })).toBe("not_active_player");
    }
    act(b, {}, { type: "changeForm", playerId: P1 });
    expect(rejection(b, attack(hero(P1), villainOf(b)))).toBe("no_valid_target");
  });

  it("round 1, p1: Spider-Man hits Atlas for 2", () => {
    const events = act(b, {}, attack(hero(P1), id(ATLAS)));
    expect(ofType(events, "damageDealt")).toMatchObject([{ targetInstanceId: id(ATLAS), amount: 2 }]);
    expect(engagedWith(b, id(ATLAS))).toBe(P1);
    act(b, {}, endTurn(P1));
    expect(activeOf(b)).toBe(P2);
  });

  it("round 1, p2: Iron Man attacks the held Joystick; the held minion engages him and the environment holds nothing", () => {
    act(b, {}, { type: "changeForm", playerId: P2 });
    expect(heldOf(b)).toBe(id(JOYSTICK));
    const events = act(b, {}, attack(hero(P2), id(JOYSTICK), P2));
    expect(ofType(events, "damageDealt")).toMatchObject([{ targetInstanceId: id(JOYSTICK), amount: 1 }]);
    expect(engagedWith(b, id(JOYSTICK))).toBe(P2);
    expect(inst(b.state, id(JOYSTICK)).attachedTo).toBeNull();
    expect(heldOf(b)).toBeUndefined();
    expect(seating(b)).toMatchObject({ [SONGBIRD]: "p2", [JOYSTICK]: "p2" });
    act(b, {}, endTurn(P2));
  });

  it("round 1, p3: Captain Marvel attacks Black Widow (2); Retaliate 1 hits Captain Marvel for 1", () => {
    act(b, {}, { type: "changeForm", playerId: P3 });
    const events = act(b, {}, attack(hero(P3), id(BLACK_WIDOW), P3));
    expect(ofType(events, "damageDealt")).toMatchObject([
      { targetInstanceId: id(BLACK_WIDOW), amount: 2 },
      { targetInstanceId: hero(P3), amount: 1, sourceInstanceId: id(BLACK_WIDOW) },
    ]);
    expect(heroDamage(P3)).toBe(1);
    act(b, {}, endTurn(P3));
  });

  it("round 1, p4: She-Hulk attacks Moonstone for 3; the last turn ends and the villain phase begins", () => {
    act(b, {}, { type: "changeForm", playerId: P4 });
    const events = act(b, {}, attack(hero(P4), id(MOONSTONE), P4));
    expect(ofType(events, "damageDealt")).toMatchObject([{ targetInstanceId: id(MOONSTONE), amount: 3 }]);
    expect(Object.fromEntries(B_ELITES.map((c) => [c, damageOf(b, id(c))]))).toEqual({
      [ATLAS]: 2,
      [SONGBIRD]: 0,
      [BLACK_WIDOW]: 2,
      [MOONSTONE]: 3,
      [JOYSTICK]: 1,
    });
  });

  it("round 1 villain phase: +4 acceleration; Citizen V gives up all four activations; the minions activate for p1..p4 (Songbird 2 boost cards, Joystick's choice, Moonstone's tough card)", () => {
    // Boost cards in activation order: Atlas 0; Songbird 0 and 0 (her own interrupt adds one); Joystick 0 and 1 (her
    // chosen additional card, plus the draw); Black Widow 1; Moonstone 2. Then the cards dealt to p1..p4.
    stack(b, "01186", "01186", "01187", "01187", "01188", "01189", "01190", COMING_STORM, JOLT, BYSTANDERS, BYSTANDERS);
    round1 = act(b, { option: "Give her 1 additional" }, endTurn(P4));
    const ev = round1;
    expect(ofType(ev, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(b), amount: 4 });
    const activations = ofType(ev, "enemyActivated").map((e) => [codeOf(b.state, e.enemyInstanceId), e.playerId]);
    expect(activations).toEqual([
      [CITIZEN_V, P1],
      [ATLAS, P1],
      [CITIZEN_V, P2],
      [SONGBIRD, P2],
      [JOYSTICK, P2],
      [CITIZEN_V, P3],
      [BLACK_WIDOW, P3],
      [CITIZEN_V, P4],
      [MOONSTONE, P4],
    ]);
    expect(
      ofType(ev, "attackResolved").map((e) => [
        codeOf(b.state, e.enemyInstanceId),
        e.baseAtk,
        e.boostIcons,
        e.damageDealt,
      ]),
    ).toEqual([
      [ATLAS, 3, 0, 3],
      [SONGBIRD, 0, 0, 0],
      [JOYSTICK, 1, 1, 2],
      [BLACK_WIDOW, 1, 1, 2],
      [MOONSTONE, 2, 2, 4],
    ]);
    expect(ofType(ev, "boostCardDealt").filter((e) => e.enemyInstanceId === id(SONGBIRD))).toHaveLength(2);
    expect(ofType(ev, "boostCardDealt").filter((e) => e.enemyInstanceId === id(JOYSTICK))).toHaveLength(2);
    expect(ofType(ev, "statusGiven")).toMatchObject([{ instanceId: id(MOONSTONE), status: "tough" }]);
    expect([P1, P2, P3, P4].map(heroDamage)).toEqual([3, 2, 3, 4]);
  });

  it("round 1 villain phase: The Coming Storm (8 threat = 2 per player) gives each player the minions of the next seat; Jolt then engages p2", () => {
    const ev = round1;
    const storm = ofType(ev, "encounterCardRevealed").map((e) => [codeOf(b.state, e.instanceId), e.playerId]);
    expect(storm).toEqual([
      [COMING_STORM, P1],
      [JOLT, P2],
      [BYSTANDERS, P3],
      [BYSTANDERS, P4],
    ]);
    expect(ofType(ev, "threatPlaced").filter((e) => e.amount === 8)).toMatchObject([{ amount: 8 }]);
    // 50135: "Each player engages each minion engaged with the player clockwise from them." p1 takes p2's two
    // minions, p2 takes p3's, p3 takes p4's and p4 takes p1's; all at once, from the state before the card.
    const moved = ofType(ev, "engagementRotated")[0]!.moves.map((m) => [codeOf(b.state, m.instanceId), m.from, m.to]);
    expect(moved).toEqual([
      [SONGBIRD, P2, P1],
      [JOYSTICK, P2, P1],
      [BLACK_WIDOW, P3, P2],
      [MOONSTONE, P4, P3],
      [ATLAS, P1, P4],
    ]);
    // Jolt (not Elite) is revealed after it, so she engages p2 and is not moved.
    expect(engagedWith(b, id(JOLT))).toBe(P2);
    expect(inst(b.state, inPlayCard(b.state, COMING_STORM)!).threat).toBe(8);
    // Bystanders: p3 and p4 each hold one with 4 counters.
    expect(playAreaCodes(b, P3)).toContain(BYSTANDERS);
    expect(playAreaCodes(b, P4)).toContain(BYSTANDERS);
  });

  it("round 1 end: the new first player (p2) is asked, the most damaged minion (Moonstone, 3) is held and healed 3 of 1[per_hero] = 4; her tough card stays; Atlas gains a growth counter", () => {
    const ev = round1;
    expect(ofType(ev, "firstPlayerChanged")).toMatchObject([{ playerId: P2 }]);
    expect(b.state.firstPlayerId).toBe(P2);
    expect(ofType(ev, "minionHeld")).toMatchObject([{ instanceId: id(MOONSTONE), engagedBefore: P3 }]);
    expect(ofType(ev, "damageHealed")).toMatchObject([{ targetInstanceId: id(MOONSTONE), amount: 3 }]);
    expect(heldOf(b)).toBe(id(MOONSTONE));
    expect(damageOf(b, id(MOONSTONE))).toBe(0);
    expect(inst(b.state, id(MOONSTONE)).statuses.tough).toBe(1);
    // 52035 Forced Response: after the villain phase ends, a growth counter; +2 hit points for each (18 -> 20).
    expect(inst(b.state, id(ATLAS)).counters).toMatchObject({ growth: 1 });
    expect(maxHitPoints(b.state, id(ATLAS), DEPS)).toBe(20);
    expect(seating(b)).toEqual({
      [SONGBIRD]: "p1",
      [JOYSTICK]: "p1",
      [BLACK_WIDOW]: "p2",
      [JOLT]: "p2",
      [ATLAS]: "p4",
      [MOONSTONE]: "held",
    });
    expect(b.state.round).toBe(2);
    expect(activeOf(b)).toBe(P2);
  });

  it("round 2 (first player p2, order p2, p3, p4, p1): three heroes parley with Jolt; the third removes her from the game, not defeated: no threat, no victory display", () => {
    const jolt = id(JOLT);
    const threatBefore = mainThreat(b);
    for (const [index, p] of ([P2, P3, P4] as const).entries()) {
      expect(activeOf(b)).toBe(p);
      const events = act(b, {}, use(p, jolt, "50133.jolt-action"));
      if (index < 2) {
        expect(inst(b.state, jolt).counters).toMatchObject({ parley: index + 1 });
        expect(cardsInPlay(b.state)).toContain(jolt);
      }
      expect(ofType(events, "cardExhausted").map((e) => e.instanceId)).toContain(hero(p));
      act(b, {}, endTurn(p));
    }
    // "If there are 3 or more parley counters here, remove Jolt from the game. (She is not defeated.)"
    expect(b.state.removedFromGame).toContain(jolt);
    expect(cardsInPlay(b.state)).not.toContain(jolt);
    expect(b.state.victoryDisplay).toEqual([]);
    expect(mainThreat(b)).toBe(threatBefore); // her When Defeated (3 threat) did not run
    expect(seating(b)).not.toHaveProperty(JOLT);
  });

  it("round 2, p1: a Swinging Web Kick on Black Widow (8, to 10) engages her with p1 (50130b) and Retaliate 1 hits Spider-Man; p1 now has three minions", () => {
    expect(activeOf(b)).toBe(P1);
    give(b, P1, KICK);
    const kick = handOf(b, KICK, P1)[0]!;
    const events = act(b, { target: id(BLACK_WIDOW) }, play(P1, kick, payWith(b.state, P1, 3, [kick])));
    expect(ofType(events, "damageDealt")).toMatchObject([
      { targetInstanceId: id(BLACK_WIDOW), amount: 8 },
      { targetInstanceId: hero(P1), amount: 1 },
    ]);
    expect(damageOf(b, id(BLACK_WIDOW))).toBe(10);
    expect(engagedWith(b, id(BLACK_WIDOW))).toBe(P1);
    expect(seating(b)).toEqual({
      [SONGBIRD]: "p1",
      [JOYSTICK]: "p1",
      [BLACK_WIDOW]: "p1",
      [ATLAS]: "p4",
      [MOONSTONE]: "held",
    });
    expect(heroDamage(P1)).toBe(4);
  });

  it("round 2 villain phase: Citizen V attacks the two players with no Thunderbolt minion (p2, p3) and gives up p4's and p1's; the first player's order is p2, p3, p4, p1", () => {
    // Boost cards, in activation order: Citizen V on p2 (2 icons), on p3 (1), Atlas (1), Songbird (0, 0), Joystick (0),
    // Black Widow (0). Then the deals: Hazard (The Coming Storm's icon) gives the first player a second card.
    stack(
      b,
      "01190",
      "01189",
      "01188",
      "01186",
      "01186",
      "01187",
      "01187",
      RUMBLING_THUNDER,
      TAP_IN,
      SWORD,
      BYSTANDERS,
      "50144", // p2, p3, p4, p1, then the Hazard card for the first player
      PSYCH,
      PSYCH, // boost cards for Moonstone (Tap In) and Citizen V (the Sword)
    );
    round2 = act(b, { option: "Give her a tough", target: id(MOONSTONE) }, endTurn(P1));
    const ev = round2;
    expect(ofType(ev, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(b), amount: 4 });
    const step2 = ofType(ev, "enemyActivated").map((e) => [codeOf(b.state, e.enemyInstanceId), e.playerId]);
    // (Moonstone's activation by Tap In, below, and Citizen V's by the Sword are not step-two activations.)
    expect(step2).toEqual([
      [CITIZEN_V, P2],
      [CITIZEN_V, P3],
      [CITIZEN_V, P4],
      [ATLAS, P4],
      [CITIZEN_V, P1],
      [SONGBIRD, P1],
      [JOYSTICK, P1],
      [BLACK_WIDOW, P1],
    ]);
    const attacks = ofType(ev, "attackResolved").map((e) => [
      codeOf(b.state, e.enemyInstanceId),
      e.targetInstanceId,
      e.baseAtk,
      e.boostIcons,
      e.damageDealt,
    ]);
    expect(attacks.slice(0, 6)).toEqual([
      [CITIZEN_V, hero(P2), 2, 2, 4],
      [CITIZEN_V, hero(P3), 2, 1, 3],
      [ATLAS, hero(P4), 3, 1, 4],
      [SONGBIRD, hero(P1), 0, 0, 0],
      [JOYSTICK, hero(P1), 1, 0, 1],
      [BLACK_WIDOW, hero(P1), 1, 0, 1],
    ]);
    // Joystick, p1's choice: a tough status card (the other branch was taken in round 1).
    expect(ofType(ev, "statusGiven").map((e) => [codeOf(b.state, e.instanceId), e.status])).toContainEqual([
      JOYSTICK,
      "tough",
    ]);
  });

  it("round 2 villain phase: Rumbling Thunder (12 threat) rotates the engagement again: p3 takes Atlas, p4 takes Songbird, Joystick and Black Widow, p1 and p2 are left with none", () => {
    const ev = round2;
    // Five cards were dealt: the first player p2 got two (the Hazard icon on The Coming Storm), then p3, p4, p1.
    expect(ofType(ev, "encounterCardRevealed").map((e) => [codeOf(b.state, e.instanceId), e.playerId])).toEqual([
      [RUMBLING_THUNDER, P2],
      ["50144", P2],
      [TAP_IN, P3],
      [SWORD, P4],
      [BYSTANDERS, P1],
    ]);
    expect(inst(b.state, inPlayCard(b.state, RUMBLING_THUNDER)!).threat).toBe(12); // 3[per_hero]
    const moved = ofType(ev, "engagementRotated")[0]!.moves.map((m) => [codeOf(b.state, m.instanceId), m.from, m.to]);
    expect(moved).toEqual([
      [ATLAS, P4, P3],
      [SONGBIRD, P1, P4],
      [JOYSTICK, P1, P4],
      [BLACK_WIDOW, P1, P4],
    ]);
  });

  it("round 2 villain phase: Tap In (p3) finds Songbird (0) and the held Moonstone (0) tied for least damage and p3 chooses Moonstone, who engages p3 and attacks", () => {
    const ev = round2;
    const tapIn = ofType(ev, "choiceRequested").find(
      (e) => e.choice.playerId === P3 && e.choice.prompt.kind === "chooseTarget",
    );
    expect(tapIn!.choice.options.map((o) => o.label).sort()).toEqual(["Moonstone", "Songbird"]);
    expect(ofType(ev, "targetChosen").find((e) => e.slot === "minion")).toMatchObject({ instanceIds: [id(MOONSTONE)] });
    expect(ofType(ev, "attackResolved").find((e) => e.enemyInstanceId === id(MOONSTONE))).toMatchObject({
      targetInstanceId: hero(P3),
      baseAtk: 2,
      // Psychological Manipulation's 1 boost icon plus 1 for the amplify icon on Solid Sound Constructs, revealed just
      // before and now in play (RRG "Amplify Icon", p. 7).
      boostIcons: 2,
      damageDealt: 4,
    });
    expect(engagedWith(b, id(MOONSTONE))).toBe(P3);
    expect(inst(b.state, id(MOONSTONE)).heldMinion).toBeFalsy();
    expect(inst(b.state, id(MOONSTONE)).statuses.tough).toBe(1); // a second tough status card does not stack
  });

  it("round 2 villain phase: the Sword attaches to Citizen V (+1 ATK) and he attacks p4 outside step two, so his interrupt does not cancel it", () => {
    const ev = round2;
    const sword = inPlayCard(b.state, SWORD)!;
    expect(inst(b.state, sword).attachedTo).toBe(villainOf(b));
    const last = ofType(ev, "attackResolved")
      .filter((e) => e.enemyInstanceId === villainOf(b))
      .at(-1)!;
    expect(last).toMatchObject({ targetInstanceId: hero(P4), baseAtk: 3, boostIcons: 2, damageDealt: 5 });
    // p4 was engaged with Songbird, Joystick and Black Widow at that point.
    expect(seating(b)[SONGBIRD]).toBe("p4");
  });

  it("round 2 end: Innocent Bystanders counters, hero damage, and the swap: Black Widow (10) is held and healed 4 = 1[per_hero]", () => {
    const ev = round2;
    const counters = (p: PlayerId) =>
      inst(
        b.state,
        playerOf(b.state, p).playArea.find((i) => codeOf(b.state, i) === BYSTANDERS)!,
      ).counters;
    expect(counters(P1)).toMatchObject({ bystander: 4 }); // just revealed
    expect(counters(P3)).toMatchObject({ bystander: 2 }); // attacked by Citizen V and by Moonstone
    expect(counters(P4)).toMatchObject({ bystander: 2 }); // attacked by Atlas and by Citizen V
    expect(PLAYERS.map(heroDamage)).toEqual([6, 6, 10, 13]);
    expect(ofType(ev, "firstPlayerChanged")).toMatchObject([{ playerId: P3 }]);
    expect(ofType(ev, "minionHeld")).toMatchObject([{ instanceId: id(BLACK_WIDOW), engagedBefore: P4 }]);
    expect(ofType(ev, "damageHealed")).toMatchObject([{ targetInstanceId: id(BLACK_WIDOW), amount: 4 }]);
    expect(damageOf(b, id(BLACK_WIDOW))).toBe(6);
    // Moonstone had left the environment, so nothing is swapped back in: p4 simply loses Black Widow.
    expect(heldOf(b)).toBe(id(BLACK_WIDOW));
    expect(seating(b)).toEqual({
      [ATLAS]: "p3",
      [MOONSTONE]: "p3",
      [SONGBIRD]: "p4",
      [JOYSTICK]: "p4",
      [BLACK_WIDOW]: "held",
    });
    expect(inst(b.state, id(ATLAS)).counters).toMatchObject({ growth: 2 });
    expect(maxHitPoints(b.state, id(ATLAS), DEPS)).toBe(22);
    // Main scheme: 4 + 4 + 4 acceleration, and nothing else (Bystanders paid with resources every time).
    expect(mainThreat(b)).toBe(12);
    expect(b.state.round).toBe(3);
    expect(activeOf(b)).toBe(P3);
  });

  it("invariants: no prompt, no card in two zones, every card accounted for, Jolt removed from the game, the five Elite minions each in one place", () => {
    expectInvariants(b, baseline);
    expect(b.state.removedFromGame.map((i) => codeOf(b.state, i))).toEqual([JOLT]);
    expect(b.state.encounterSetAside).toEqual([]);
    expect(b.state.victoryDisplay).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game C: two players, Citizen V at 0 hit points and not defeated
// ---------------------------------------------------------------------------------------------------------------

describe("Thunderbolts scenario, game C: two players, Citizen V cannot be defeated until 2 Thunderbolt minions are in the victory display", () => {
  const c = open(2, ["supersonic", "the_leaper", "power_of_the_atom"], { seed: 1 });
  const baseline = baselineOf(c);
  const id = (code: string) => idOfCode(c, code);
  const hero = (p: PlayerId) => identityOf(c.state, p);
  const citizen = () => villainOf(c);
  let round1: GameEvent[] = [];
  let round2: GameEvent[] = [];
  const remaining = () => remainingHitPoints(c.state, citizen(), DEPS);

  it("setup: 2 players: 3 sets, Batroc with p1, Radioactive Man with p2, MACH-IV held; 24 hit points, 2 threat, 22 to lose, 2 acceleration", () => {
    expect(seating(c)).toEqual({ [BATROC]: "p1", [RADIOACTIVE_MAN]: "p2", [MACH_IV]: "held" });
    expect(maxHitPoints(c.state, citizen(), DEPS)).toBe(24);
    expect(mainThreat(c)).toBe(2);
    expect(mainSchemeValue(c.state, "targetThreat", DEPS)).toBe(22);
    expect(mainSchemeValue(c.state, "acceleration", DEPS)).toBe(2);
    // 7 Standard + 2 obligations + 11 Thunderbolts + 5 cards in each of 3 sets.
    expect(piles(c.state).deck).toHaveLength(35);
    expect(activeOf(c)).toBe(P1);
  });

  it("round 1, p1: two Kicks defeat Batroc (16) into the victory display; p1 is then free of guard and attacks Citizen V, who stands at 0 hit points and is not defeated", () => {
    // Staging: Citizen V arrives with 22 of his 24 hit points already gone. A whole game's worth of earlier attacks would
    // be needed to take them off with Spider-Man's three Kicks while he heals 4 a round; this test is about what the
    // rule does at 0, so that one number is seeded (patchInstance) and every attack from here on is a real command.
    c.state = patchInstance(c.state, citizen(), { damage: 22 });
    act(c, {}, { type: "changeForm", playerId: P1 });
    give(c, P1, KICK, KICK, "01007", "01007", "01008", "01008");
    const kicks = handOf(c, KICK);
    const fill = playerOf(c.state, P1).hand.filter((i) => !kicks.includes(i));
    expect(rejection(c, attack(hero(P1), citizen()))).toBe("no_valid_target"); // Batroc's guard
    act(c, { target: id(BATROC) }, play(P1, kicks[0]!, fill.slice(0, 3)));
    expect(damageOf(c, id(BATROC))).toBe(8);
    const events = act(c, { target: id(BATROC) }, play(P1, kicks[1]!, fill.slice(3, 6)));
    expect(ofType(events, "characterDefeated").map((e) => codeOf(c.state, e.instanceId))).toEqual([BATROC]);
    expect(victoryCodes(c)).toEqual([BATROC]);
    expect(c.state.villains[0]!.defeated).toBe(false);
    // The guard is gone: the basic attack on Citizen V is legal, and takes him from 22 damage to exactly 24 of 24.
    const hit = act(c, {}, attack(hero(P1), citizen()));
    expect(ofType(hit, "damageDealt")).toMatchObject([{ targetInstanceId: citizen(), amount: 2 }]);
    expect(remaining()).toBe(0);
    // "cannot be defeated unless there are at least 1[per_hero] Thunderbolt minions in the victory display": 1 of 2.
    expect(ofType(hit, "characterDefeated")).toEqual([]);
    expect(c.state.villains[0]!.defeated).toBe(false);
    expect(c.state.outcome).toBeNull();
    expect(cardsInPlay(c.state)).toContain(citizen());
    act(c, {}, endTurn(P1));
  });

  it("round 1, p2: engaged with Radioactive Man (guard), Iron Man may not attack Citizen V (RRG 'Guard')", () => {
    act(c, {}, { type: "changeForm", playerId: P2 });
    expect(rejection(c, attack(hero(P2), citizen(), P2))).toBe("no_valid_target");
  });

  it("round 1 villain phase: Citizen V attacks free p1 as usual, and for p2 gives up the attack and heals 4 off his damage; p2's Radioactive Man attacks", () => {
    // Boosts: Citizen V on p1 (0), Radioactive Man on p2 (0); then one obligation each.
    stack(c, "01186", "01186", BYSTANDERS, BYSTANDERS);
    const damageBefore = damageOf(c, citizen());
    round1 = act(c, { target: id(RADIOACTIVE_MAN) }, endTurn(P2));
    const ev = round1;
    const attacks = ofType(ev, "attackResolved").map((e) => [
      codeOf(c.state, e.enemyInstanceId),
      e.targetInstanceId,
      e.damageDealt,
    ]);
    expect(attacks).toEqual([
      [CITIZEN_V, hero(P1), 2],
      [RADIOACTIVE_MAN, hero(P2), 2],
    ]);
    // 50152: after he activates against you, 1 damage to each character you control.
    expect(
      ofType(ev, "damageDealt")
        .filter((e) => e.sourceInstanceId === id(RADIOACTIVE_MAN))
        .map((e) => e.amount),
    ).toEqual([2, 1]);
    expect(ofType(ev, "damageHealed").filter((e) => e.targetInstanceId === citizen())).toMatchObject([{ amount: 4 }]);
    expect(damageBefore).toBe(24);
    expect(damageOf(c, citizen())).toBe(20);
    expect(remaining()).toBe(4);
  });

  it("round 1 end: Radioactive Man (0) and the held MACH-IV (0) tie for most damage, so the first player (now p2) chooses; he picks Radioactive Man, MACH-IV engages p2", () => {
    const ev = round1;
    const choice = ofType(ev, "choiceRequested").find(
      (e) => e.choice.prompt.kind === "chooseTarget" && e.choice.options.length > 1,
    );
    expect(choice!.choice.playerId).toBe(P2);
    expect(choice!.choice.options.map((o) => o.label).sort()).toEqual(["MACH-IV", "Radioactive Man"]);
    expect(c.state.firstPlayerId).toBe(P2);
    expect(ofType(ev, "minionHeld")).toMatchObject([{ instanceId: id(RADIOACTIVE_MAN), engagedBefore: P2 }]);
    expect(seating(c)).toEqual({ [RADIOACTIVE_MAN]: "held", [MACH_IV]: "p2" });
  });

  it("round 2, p2 then p1: Haymaker and a basic attack take Citizen V back to 0 (still alive); Mockingbird stuns him", () => {
    expect(c.state.round).toBe(2);
    expect(activeOf(c)).toBe(P2);
    act(c, {}, endTurn(P2));
    expect(activeOf(c)).toBe(P1);
    give(c, P1, HAYMAKER, MOCKINGBIRD, "01062", "01063", "01064", "01064", "01065", "01065");
    const hay = handOf(c, HAYMAKER)[0]!;
    const mocking = handOf(c, MOCKINGBIRD)[0]!;
    const hand = playerOf(c.state, P1).hand.filter((i) => i !== hay && i !== mocking);
    const hit = act(c, { target: citizen() }, play(P1, hay, hand.slice(0, 2)));
    expect(ofType(hit, "damageDealt")).toMatchObject([{ targetInstanceId: citizen(), amount: 3 }]);
    expect(remaining()).toBe(1);
    const basic = act(c, {}, attack(hero(P1), citizen()));
    expect(ofType(basic, "damageDealt")).toMatchObject([{ targetInstanceId: citizen(), amount: 2 }]);
    expect(remaining()).toBe(0); // 2 dealt on 1 remaining: his dial stops at zero (RRG 1.8 "Hit Points", p. 22)
    expect(c.state.villains[0]!.defeated).toBe(false);
    // (Innocent Bystanders, dealt to p1 in round 1, asked for a resource after each attack: the hand is read again.)
    const handNow = playerOf(c.state, P1).hand.filter((i) => i !== mocking);
    const stun = act(c, { take: "mockingbird", target: citizen() }, play(P1, mocking, handNow.slice(0, 4)));
    expect(ofType(stun, "statusGiven")).toMatchObject([{ instanceId: citizen(), status: "stunned" }]);
    expect(inst(c.state, citizen()).statuses.stunned).toBe(1);
  });

  // RRG 1.8 "Hit Points" (p. 22): "a villain's hit point dial represents their remaining hit points", reduced by the
  // damage he took, and a dial reads 0 at the lowest. The damage past zero is dealt and not kept (24 on 24 hit points
  // after the basic attack above, not 25), so a later heal of 4 leaves 4 (the engine's `settleDials`).
  it("a villain hit more than his remaining hit points shows 0 remaining, not -1", () => {
    expect(remaining()).toBe(0);
    expect(damageOf(c, citizen())).toBe(24);
  });

  it("round 2 villain phase, owner Q2 = A: the stunned Citizen V would activate against p2 (engaged with MACH-IV): the stun card is discarded and he does not heal", () => {
    // Boosts: MACH-IV on p2 (0), Citizen V on p1 (0); then the cards dealt, p2 first: an obligation, then Rumbling Thunder.
    stack(c, "01186", "01186", BYSTANDERS, RUMBLING_THUNDER);
    round2 = act(c, {}, endTurn(P1));
    const ev = round2;
    const activations = ofType(ev, "enemyActivated").map((e) => [codeOf(c.state, e.enemyInstanceId), e.playerId]);
    expect(activations).toEqual([
      [CITIZEN_V, P2],
      [MACH_IV, P2],
      [CITIZEN_V, P1],
    ]);
    // Q2 = A (docs/phase7-wave9.md section 4.1; MC50 p. 22): status discarded, no heal, no attack on p2.
    expect(ofType(ev, "damageHealed").filter((e) => e.targetInstanceId === citizen())).toEqual([]);
    expect(remaining()).toBe(0);
    // The stun was spent on p2's activation, so he attacked free p1 normally.
    expect(inst(c.state, citizen()).statuses.stunned).toBe(0);
    expect(
      ofType(ev, "attackResolved").map((e) => [codeOf(c.state, e.enemyInstanceId), e.targetInstanceId, e.damageDealt]),
    ).toEqual([
      [MACH_IV, hero(P2), 2],
      [CITIZEN_V, hero(P1), 2],
    ]);
  });

  it("round 2 villain phase: MACH-IV's attack cannot be basic-defended by a non-Aerial hero; Rumbling Thunder (6 threat) gives p1 MACH-IV and leaves p2 with none", () => {
    const ev = round2;
    // 50156: "Each character without the Aerial trait cannot make basic defenses against MACH-IV's attacks." Iron Man is
    // p2's only possible defender, so p2 is never asked to declare one; p1 is asked about Citizen V's attack.
    const defenders = ofType(ev, "choiceRequested").filter((e) => e.choice.prompt.kind === "declareDefender");
    expect(defenders.map((e) => e.choice.playerId)).toEqual([P1]);
    expect(inst(c.state, inPlayCard(c.state, RUMBLING_THUNDER)!).threat).toBe(6); // 3[per_hero]
    expect(ofType(ev, "engagementRotated")[0]!.moves.map((m) => [codeOf(c.state, m.instanceId), m.from, m.to])).toEqual(
      [[MACH_IV, P2, P1]],
    );
  });

  it("round 2 end: MACH-IV (engaged, 0) and Radioactive Man (held, 0) tie; the new first player p1 chooses MACH-IV to be held, so Radioactive Man engages p1", () => {
    const ev = round2;
    expect(c.state.firstPlayerId).toBe(P1);
    expect(ofType(ev, "minionHeld")).toMatchObject([{ instanceId: id(MACH_IV), engagedBefore: P1 }]);
    expect(seating(c)).toEqual({ [MACH_IV]: "held", [RADIOACTIVE_MAN]: "p1" });
    expect(c.state.round).toBe(3);
  });

  it("round 3: Radioactive Man (staged at 17 of 18) is defeated by p1's attack: the second Thunderbolt minion in the victory display defeats Citizen V at once, and the players win", () => {
    c.state = patchInstance(c.state, id(RADIOACTIVE_MAN), { damage: 17 });
    expect(c.state.villains[0]!.defeated).toBe(false);
    const events = act(c, {}, attack(hero(P1), id(RADIOACTIVE_MAN)));
    expect(ofType(events, "characterDefeated").map((e) => codeOf(c.state, e.instanceId))).toContain(RADIOACTIVE_MAN);
    expect(victoryCodes(c)).toContain(RADIOACTIVE_MAN);
    expect(c.state.victoryDisplay.filter((i) => ELITES.includes(codeOf(c.state, i)))).toHaveLength(2);
    expect(c.state.villains[0]!.defeated).toBe(true);
    expect(ofType(events, "gameEnded")).toMatchObject([{ outcome: { result: "win", reason: "villainDefeated" } }]);
  });

  it("invariants: no prompt, no card in two zones, every card accounted for (MACH-IV held, two minions in the victory display)", () => {
    expectInvariants(c, baseline);
    expect(heldOf(c)).toBe(id(MACH_IV));
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game D: solo, the players lose to the main scheme
// ---------------------------------------------------------------------------------------------------------------

describe("Thunderbolts scenario, game D: solo, the main scheme is completed (11 threat) and the players lose", () => {
  const d = open(1, ["the_leaper", "power_of_the_atom"], { seed: 4 });
  const baseline = baselineOf(d);
  let round1: GameEvent[] = [];

  it("round 1: Spider-Man stays in alter-ego form; Citizen V gives up his scheme (4 healed from nothing), Batroc schemes for 1 + 3 boost icons", () => {
    expect(mainThreat(d)).toBe(1);
    expect(mainSchemeValue(d.state, "targetThreat", DEPS)).toBe(11);
    // Boost for Batroc's scheme: Jolt's 3 icons (a boost card that does nothing else); then Rumbling Thunder dealt.
    stack(d, JOLT, RUMBLING_THUNDER);
    round1 = act(d, {}, endTurn());
    const ev = round1;
    // Citizen V's interrupt covers the scheme as well as the attack: against an alter-ego player engaged with a
    // Thunderbolt minion he neither schemes nor draws a boost card (50129a: "does not activate").
    expect(
      ofType(ev, "schemeResolved").map((e) => [
        codeOf(d.state, e.enemyInstanceId),
        e.baseSch,
        e.boostIcons,
        e.threatPlaced,
      ]),
    ).toEqual([[BATROC, 1, 3, 4]]);
    expect(ofType(ev, "boostCardDealt")).toHaveLength(1);
    // 1 + 1 acceleration + 4 from Batroc's scheme.
    expect(mainThreat(d)).toBe(6);
  });

  it("round 1: Rumbling Thunder (3 threat) is in play and with a single player rotates nothing; the swap holds Batroc and gives p1 Radioactive Man (both undamaged: p1 chooses)", () => {
    expect(inst(d.state, inPlayCard(d.state, RUMBLING_THUNDER)!).threat).toBe(3);
    expect(ofType(round1, "engagementRotated").flatMap((e) => e.moves)).toEqual([]);
    expect(ofType(round1, "minionHeld")).toMatchObject([{ engagedBefore: P1 }]);
    expect(Object.values(seating(d)).sort()).toEqual(["held", "p1"]);
  });

  it("round 2: the acceleration icon on Rumbling Thunder makes it 1 + 1 acceleration; the minion's scheme (1 + 2) completes the stage: the players lose", () => {
    stack(d, "01190", BYSTANDERS);
    const ev = act(d, {}, endTurn());
    // Step one: 1[per_hero] acceleration + 1 for each acceleration icon on a side scheme in play (RRG Appendix II).
    expect(ofType(ev, "threatPlaced")[0]).toMatchObject({ schemeInstanceId: mainOf(d), amount: 2 });
    expect(mainThreat(d)).toBeGreaterThanOrEqual(11);
    expect(ofType(ev, "gameEnded")).toMatchObject([{ outcome: { result: "loss", reason: "mainSchemeCompleted" } }]);
    expect(d.state.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
  });

  it("invariants: no prompt, no card in two zones, every card accounted for", () => {
    expectInvariants(d, baseline);
    expect(d.state.victoryDisplay).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Game E: two players, expert
// ---------------------------------------------------------------------------------------------------------------

describe("Thunderbolts scenario, game E: expert mode, two players", () => {
  const e = open(2, ["supersonic", "the_leaper", "power_of_the_atom"], { seed: 1, expert: true });
  const baseline = baselineOf(e);
  const id = (code: string) => idOfCode(e, code);
  const hero = (p: PlayerId) => identityOf(e.state, p);

  it("setup: Citizen V (B) with 16 hit points per player, a tough status card on all three minions (the held one too), the Expert encounter set in the deck", () => {
    expect(e.state.villains[0]!.stageIndex).toBe(1);
    expect(codeOf(e.state, villainOf(e))).toBe(CITIZEN_V);
    expect(maxHitPoints(e.state, villainOf(e), DEPS)).toBe(32);
    // (The Expert set joins the shuffle, so the random deal differs from the standard game's with the same seed.)
    expect(seating(e)).toEqual({ [RADIOACTIVE_MAN]: "p1", [BATROC]: "p2", [MACH_IV]: "held" });
    for (const code of [BATROC, RADIOACTIVE_MAN, MACH_IV]) expect(inst(e.state, id(code)).statuses.tough, code).toBe(1);
    // The scheme numbers do not change with the mode: 1 per player to start, 11 to complete.
    expect(mainThreat(e)).toBe(2);
    expect(mainSchemeValue(e.state, "targetThreat", DEPS)).toBe(22);
    const standard = open(2, ["supersonic", "the_leaper", "power_of_the_atom"], { seed: 1 });
    expect(piles(e.state).deck.length).toBeGreaterThan(piles(standard.state).deck.length);
    expect(e.state.pendingChoice).toBeNull();
  });

  it("round 1, p1 and p2: an attack on a tough minion only discards the status card (RRG 'Tough'); attacking the held MACH-IV engages p2", () => {
    act(e, {}, { type: "changeForm", playerId: P1 });
    const hit = act(e, {}, attack(hero(P1), id(RADIOACTIVE_MAN)));
    expect(ofType(hit, "damageDealt")).toEqual([]);
    expect(inst(e.state, id(RADIOACTIVE_MAN)).statuses.tough).toBe(0);
    expect(damageOf(e, id(RADIOACTIVE_MAN))).toBe(0);
    act(e, {}, endTurn(P1));
    act(e, {}, { type: "changeForm", playerId: P2 });
    act(e, {}, attack(hero(P2), id(MACH_IV), P2));
    expect(inst(e.state, id(MACH_IV)).statuses.tough).toBe(0);
    expect(seating(e)).toEqual({ [RADIOACTIVE_MAN]: "p1", [BATROC]: "p2", [MACH_IV]: "p2" });
    expect(heldOf(e)).toBeUndefined();
  });

  it("round 1 end (expert): all three minions undamaged, so the new first player (p2) chooses Radioactive Man; he is held, healed 2[per_hero] (nothing to heal) and gets a tough status card back", () => {
    stack(e, "01186", "01186", "01187", BYSTANDERS, BYSTANDERS);
    const ev = act(e, { target: id(RADIOACTIVE_MAN) }, endTurn(P2));
    expect(ofType(ev, "minionHeld")).toMatchObject([{ instanceId: id(RADIOACTIVE_MAN), engagedBefore: P1 }]);
    expect(heldOf(e)).toBe(id(RADIOACTIVE_MAN));
    expect(inst(e.state, id(RADIOACTIVE_MAN)).statuses.tough).toBe(1);
    expect(ofType(ev, "statusGiven").filter((x) => x.instanceId === id(RADIOACTIVE_MAN))).toMatchObject([
      { status: "tough" },
    ]);
    expect(seating(e)).toEqual({ [RADIOACTIVE_MAN]: "held", [BATROC]: "p2", [MACH_IV]: "p2" });
    // Batroc and MACH-IV (p2) attacked; Radioactive Man (p1) attacked before the swap.
    expect(
      ofType(ev, "attackResolved")
        .map((x) => codeOf(e.state, x.enemyInstanceId))
        .sort(),
    ).toEqual([BATROC, MACH_IV, RADIOACTIVE_MAN].sort());
    expect(e.state.firstPlayerId).toBe(P2);
  });

  it("round 2 (expert): after p1 attacks Batroc, Innocent Bystanders places 2 threat on the main scheme instead of 1", () => {
    act(e, {}, endTurn(P2));
    const threatBefore = mainThreat(e);
    const ev = act(e, { option: "Place threat" }, attack(hero(P1), id(BATROC)));
    expect(ofType(ev, "threatPlaced")).toMatchObject([{ schemeInstanceId: mainOf(e), amount: 2 }]);
    expect(mainThreat(e)).toBe(threatBefore + 2);
    expect(engagedWith(e, id(BATROC))).toBe(P1);
  });

  it("invariants: no prompt, no card in two zones, every card accounted for", () => {
    expectInvariants(e, baseline);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Doubts found, and what the games do not prove
// ---------------------------------------------------------------------------------------------------------------

describe("Innocent Bystanders: spending the resource", () => {
  // 50134 "either spend 1 resource of any type or place 1 threat on the main scheme. Remove 1 bystander counter."
  // The spend is an option the player chose, so its payment is made in full (the engine's `spendResources.required`,
  // set by the DSL's `option`): choosing it and then paying with no card at all is refused and the choice stays open.
  it("a player who picks 'spend 1 resource' must lose a card from hand: paying with nothing is refused", () => {
    const a = open(1, ["the_leaper", "power_of_the_atom"], { seed: 4 });
    act(a, {}, { type: "changeForm", playerId: P1 });
    stack(a, BLANK, BYSTANDERS);
    act(a, {}, endTurn());
    const bystanders = inPlayCard(a.state, BYSTANDERS)!;
    const handBefore = playerOf(a.state, P1).hand.length;
    const threatBefore = mainThreat(a);
    const strike = attack(identityOf(a.state, P1), idOfCode(a, RADIOACTIVE_MAN));
    expect(() => act(a, { spend: "none" }, strike)).toThrow(/resolveChoice rejected: invalid_choice/);
    expect(inst(a.state, bystanders).counters).toMatchObject({ bystander: 4 }); // nothing happened
    act(a, {}, strike);
    expect(inst(a.state, bystanders).counters).toMatchObject({ bystander: 3 });
    expect(playerOf(a.state, P1).hand.length).toBe(handBefore - 1);
    expect(mainThreat(a)).toBe(threatBefore);
  });
});

describe("not played in a whole game", () => {
  it.todo(
    "Down but Not Out (50137) is not scripted (THUNDERBOLTS_SKIPPED): no game here stacks it, and a copy that is revealed by chance does nothing",
  );
  it.todo(
    "Q27 = A: the environment leaving play discards the held minion undefeated; nothing in the scripted sets removes Justice, Like Lightning (unit tests only)",
  );
  it.todo(
    "Q25 = A: a minion already in play that engages a player triggers quickstrike; none of the eight scripted Elite sets has a quickstrike minion (unit tests only)",
  );
  it.todo("the Sword's Hero Response (spend two physical resources to discard it) and its +1 SCH on a scheme");
  it.todo(
    "Citizen V (B)'s heal of 6 and the expert Thunderbolt Backup's heal of 2 per player on a damaged minion (expert is played for tough and Bystanders only)",
  );
  it.todo(
    "Hard Sound's, Pale Little Spider's and Gravitational Pull's find-and-reveal treacheries, Black Widow's Handspring",
  );
  it.todo("a Thunderbolt minion with Techno (Fixer) or Whiteout (Blizzard): those two sets are not scripted");
});
