/**
 * Rules QA for the Thunderbolts scenario of the Agents of S.H.I.E.L.D. box (Citizen V 50129a/b, Apprehending Rogue
 * Agents 50130a/b, Justice, Like Lightning / Thunderbolt Backup 50131a/b, 50132 to 50138), the Thunderbolt minion sets
 * (`aos`: Gravitational Pull 50139 to 50142, Hard Sound 50143 to 50147, Pale Little Spider 50148 to 50151, Power of
 * the Atom 50152 to 50155, Supersonic 50156 to 50160, The Leaper 50161 to 50164; `bp`: Extreme Risk 51039 to 51042;
 * `silk`: Growing Strong 52035 to 52038) and the S.H.I.E.L.D. Executive Board (50181a to 50184c): the interactions
 * the module tests and the scenario games (`thunderbolts-scenario.test.ts`, `thunderbolts-new-sets-scenario.test.ts`)
 * do not assert, each tied to an RRG 1.8 entry (`mc_rulesreference_v18_compressed.pdf`), an FFG ruling by its date
 * heading (marvel-champions-rulings-post-rrg-1-7.md), the box rulebook (MC50) or an owner answer
 * (docs/phase7-wave9.md section 4.1). A `FINDING` comment marks a case where the game and its source disagree: the
 * expected behavior is an `it.fails`, with a passing companion that pins today's behavior. Findings are tabled in
 * docs/phase7-wave9-qa.md.
 */
import { cardId } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  createGame,
  type Command,
  type EngineDeps,
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
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  encounterCardInVillainArea,
  playFromHand,
} from "../../testing/staging.js";
import { attachToHost, engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { EXTREME_RISK } from "../bp/extreme-risk.js";
import { wave9Scenario } from "../setup.js";
import { GROWING_STRONG } from "../silk/growing-strong.js";
import {
  BLACK_CAT,
  BLANK,
  CAPTAIN_MARVEL,
  FILLER_A,
  FILLER_B,
  IRON_MAN,
  ONE_ICON,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  heroAttacks,
  heroForm,
  onlyDeck,
  picking as pickingTarget,
  piles,
  revealedCodes,
  setKit,
  types,
  without,
} from "../testing.js";
import { EXECUTIVE_BOARD } from "./executive-board.js";
import { GRAVITATIONAL_PULL } from "./gravitational-pull.js";
import { HARD_SOUND } from "./hard-sound.js";
import { PALE_LITTLE_SPIDER } from "./pale-little-spider.js";
import { POWER_OF_THE_ATOM } from "./power-of-the-atom.js";
import { SUPERSONIC } from "./supersonic.js";
import { THE_LEAPER } from "./the-leaper.js";
import { THUNDERBOLTS } from "./thunderbolts.js";

vi.setConfig({ testTimeout: 300_000 });

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

// Core cards
const BLANKS = ["01186", "01186", "01187", "01187"]; // treacheries with no boost icon and no Boost ability
const HAYMAKER = "01087"; // Hero Action (attack): 3 damage to an enemy, cost 2
const COSMIC_FLIGHT = "01017"; // gives Captain Marvel the Aerial trait
const PHYSICAL_CARDS = ["01003", "01008"]; // each prints one physical resource
const ENERGY_CARDS = ["01002", "01006"]; // each prints one energy resource
// Wave 9 cards
const CITIZEN_V = "50129a";
const JUSTICE = "50131a";
const SWORD = "50132";
const JOLT = "50133";
const BYSTANDERS = "50134";
const TAP_IN = "50138";
const MOONSTONE = "50139";
const GRAVITATIONAL_PULL_CARD = "50141";
const SONGBIRD = "50143";
const BINDINGS = "50145";
const HARD_SOUND_CARD = "50147";
const BLACK_WIDOW = "50148";
const HANDSPRING = "50149";
const RADIOACTIVE_MAN = "50152";
const RUNAWAY = "50154";
const MACH_IV = "50156";
const BLASTERS = "50157";
const DOGFIGHT = "50159";
const SUPERSONIC_CARD = "50160";
const COUP = "50162";
const RULE_THE_SKIES = "50140";
const BATROC_MINION = "50161";
const BATROC_LEAPER = "50163";
const MEDICAL = "50181a";
const AIM_ENERGY = "50184a";
const ELITES = ["50139", "50143", "50148", "50152", "50156", "50161", "51039", "52035"];

// ---------------------------------------------------------------------------------------------------------------------
// Shared staging
// ---------------------------------------------------------------------------------------------------------------------

interface Plan {
  /** Ability-id fragments to take when an optional trigger is offered; everything else is declined. */
  readonly take?: readonly string[];
  /** An option label fragment to answer a chooseOption with. */
  readonly option?: string;
  readonly target?: InstanceId;
  /** Records every trigger id offered and every (kind, player) asked. */
  readonly seen?: string[];
  readonly asked?: { kind: string; playerId: PlayerId }[];
}
const planned =
  (plan: Plan = {}): Picker =>
  (s) => {
    const c = s.pendingChoice!;
    const ids = c.options.map((o) => o.optionId as string);
    plan.asked?.push({ kind: c.prompt.kind, playerId: c.playerId });
    switch (c.prompt.kind) {
      case "chooseTriggers": {
        plan.seen?.push(...ids);
        const hit = ids.find((id) => plan.take?.some((t) => id.includes(t)));
        return hit ? [hit] : [];
      }
      case "declareDefender":
        return ["decline"];
      case "chooseOption": {
        const hit = plan.option ? c.options.find((o) => o.label.includes(plan.option!)) : undefined;
        return hit ? [hit.optionId as string] : firstLegal(s);
      }
      case "chooseTarget": {
        const hit = plan.target ? c.options.find((o) => o.optionId === plan.target) : undefined;
        return hit ? [hit.optionId as string] : firstLegal(s);
      }
      default:
        return firstLegal(s);
    }
  };
const run = (deps: EngineDeps, s: GameState, plan: Plan, ...commands: readonly Command[]) =>
  driveEventsPicking(deps, s, planned(plan), ...commands);

const SEATS = [SPIDER_MAN, IRON_MAN, CAPTAIN_MARVEL] as const;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const idsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code);
const inPlay = (s: GameState, code: string): InstanceId | undefined =>
  idsOf(s, code).find((i) => cardsInPlay(s).includes(i));
const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
const BASIC_ATTACK = (s: GameState, by: InstanceId, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: by,
  targetInstanceId: target,
});

/** `code` relabeled onto the player's deck card `which` and put into their play area (an ally or support in play). */
function inPlayArea(state: GameState, code: string, player: PlayerId = P1, which = 0) {
  const id = playerOf(state, player).deck[which]!;
  const relabeled = patchInstance(state, id, {
    cardId: cardId(code),
    faceup: true,
    controllerId: player,
    exhausted: false,
  });
  return {
    id,
    state: {
      ...relabeled,
      players: relabeled.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The Thunderbolts scenario
// ---------------------------------------------------------------------------------------------------------------------

/** The scenario past setup, every seat in hero form. */
function game(
  players: number,
  sets: readonly string[],
  opts: { readonly seed?: number; readonly mode?: "standard" | "expert" } = {},
): GameState {
  const config = wave9Scenario("thunderbolts", {
    players: SEATS.slice(0, players),
    seed: opts.seed ?? 1,
    difficulty: opts.mode ?? "standard",
    setAsideModularSetIds: sets,
  });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  for (const p of state.players) state = heroForm(state, p.playerId);
  return state;
}
const environmentOf = (s: GameState): InstanceId => inPlay(s, JUSTICE)!;
const thunderbolts = (s: GameState): InstanceId[] =>
  cardsInPlay(s).filter((i) => ELITES.includes(codeOf(s, i)) || codeOf(s, i) === JOLT);
const heldOf = (s: GameState): InstanceId | undefined => thunderbolts(s).find((i) => inst(s, i).heldMinion);
const minionOf = (s: GameState, player: PlayerId): InstanceId | undefined =>
  thunderbolts(s).find((i) => inst(s, i).engagedWith === player);
/** The first seed from 1 on whose setup holds `code` under the environment. */
function gameHolding(code: string, players: number, sets: readonly string[]): GameState {
  for (let seed = 1; seed <= 24; seed++) {
    const s = game(players, sets, { seed });
    if (heldOf(s) && codeOf(s, heldOf(s)!) === code) return s;
  }
  throw new Error(`no seed holds ${code}`);
}
/** A minion taken out of play: the test's way of emptying a player's engagement without a defeat. */
function setAsideNow(state: GameState, id: InstanceId): GameState {
  const { heldMinion: _held, ...rest } = inst(state, id);
  const host = rest.attachedTo;
  const instances = { ...state.instances, [id]: { ...rest, engagedWith: null, attachedTo: null } };
  if (host)
    instances[host] = { ...instances[host]!, attachments: instances[host]!.attachments.filter((a) => a !== id) };
  return {
    ...state,
    instances,
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== id) })),
    encounterSetAside: [...state.encounterSetAside, id],
  };
}
/** Every player ends their turn and the villain phase runs. */
const villainPhase = (s: GameState, plan: Plan = {}) =>
  run(DEPS, s, plan, ...s.players.map((p) => endTurn(p.playerId)));
const SETS_SL = ["supersonic", "the_leaper"] as const;

describe("Justice, Like Lightning's held minion against a treachery of its own set (RRG 1.8 'Find', 'Engage' p. 18; MC50 p. 15)", () => {
  // The held minion "is considered to be in play" (MC50 p. 15), so "Find Moonstone and reveal her. (If she is already
  // in play, she engages you.)" finds her in play, and "an engaged minion remains engaged until ... a card ability
  // causes it to engage another player" (RRG "Engage"): she leaves the environment, engages the revealing player and
  // activates against them. A held minion does not activate (known; MC50 p. 15), so an attack proves she left.
  it("Gravitational Pull reveals the held Moonstone: she engages the revealer, is no longer held, and attacks them", () => {
    let s = gameHolding(MOONSTONE, 1, ["gravitational_pull", "supersonic"]);
    const moon = heldOf(s)!;
    const engaged = minionOf(s, P1)!;
    // The engaged minion is the most damaged, so the round-end swap holds it, not Moonstone.
    s = patchInstance(s, engaged, { damage: 6 });
    s = stackEncounterDeck(s, BLANKS[0]!, GRAVITATIONAL_PULL_CARD, BLANKS[1]!, BLANKS[2]!);
    const { state, events } = villainPhase(s);
    expect(attacksBy(state, events, MOONSTONE)).toHaveLength(1);
    expect(inst(state, moon)).toMatchObject({ engagedWith: P1, attachedTo: null });
    expect(inst(state, moon).heldMinion).toBeFalsy();
    expect(heldOf(state)).toBe(engaged);
  });
});

describe("Tap In (50138) against a stunned minion (RRG 1.8 'Stun' p. 41, 'Activation' p. 6)", () => {
  // "If a stunned villain or minion would attack, discard the stunned status card instead ... that character is not
  // considered to have attacked", and "whenever an enemy attacks or schemes, it is considered to have activated". The
  // stunned minion Tap In engages therefore did not activate, so "If no minion activated this way, Citizen V
  // activates against you" applies. (Wave 4 pinned the same reading for Waylay/Gamora's surge.)
  it("the least damaged minion is stunned: the stun is discarded, it does not attack, and Citizen V activates instead", () => {
    let s = game(1, SETS_SL);
    const m1 = minionOf(s, P1)!;
    const held = heldOf(s)!;
    s = patchInstance(s, m1, { damage: 6 });
    s = patchInstance(s, held, { statuses: { ...inst(s, held).statuses, stunned: 1 } });
    // Step two: the minion's boost card (Citizen V gives up his activation); step three: Tap In; then Citizen V's boost.
    s = stackEncounterDeck(s, BLANKS[0]!, TAP_IN, BLANKS[1]!, BLANKS[2]!);
    const { state, events } = villainPhase(s);
    expect(inst(state, held).engagedWith).toBe(P1);
    expect(inst(state, held).statuses.stunned).toBe(0);
    expect(attacksBy(state, events, codeOf(state, held))).toHaveLength(0);
    expect(attacksBy(state, events, CITIZEN_V)).toHaveLength(1);
  });
});

describe("Thunderbolt Backup's swap keeps what is on the minions (MC50 p. 15)", () => {
  // "The attached minion is considered to be in play, retains all tokens, status cards, and attachments on it", and the
  // swap only moves the engagement. Both directions: the minion that goes under the environment, the one that comes out.
  it("the minion sent to be held keeps its confused and tough status cards, its attachment and its damage less the heal", () => {
    let s = game(1, SETS_SL);
    const m1 = minionOf(s, P1)!;
    const held = heldOf(s)!;
    s = patchInstance(s, m1, { damage: 6, statuses: { stunned: 0, confused: 1, tough: 1 } });
    const armed = attachToHost(s, BLASTERS, m1);
    s = stackEncounterDeck(armed.state, BLANKS[0]!, BYSTANDERS);
    const { state } = villainPhase(s);
    expect(heldOf(state)).toBe(m1);
    expect(inst(state, m1)).toMatchObject({ engagedWith: null, attachedTo: environmentOf(state) });
    expect(inst(state, m1).statuses).toMatchObject({ confused: 1, tough: 1 });
    expect(inst(state, m1).attachments).toEqual([armed.id]);
    expect(damageOf(state, m1)).toBe(5);
    expect(inst(state, held).engagedWith).toBe(P1);
  });

  it("a minion that comes out keeps its stunned card and its attachment, and engages the player the other was engaged with", () => {
    let s = game(1, SETS_SL);
    const m1 = minionOf(s, P1)!;
    const held = heldOf(s)!;
    s = patchInstance(s, m1, { damage: 6 });
    s = patchInstance(s, held, { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const armed = attachToHost(s, BLASTERS, held);
    s = stackEncounterDeck(armed.state, BLANKS[0]!, BYSTANDERS);
    const { state } = villainPhase(s);
    expect(inst(state, held)).toMatchObject({ engagedWith: P1, attachedTo: null });
    expect(inst(state, held).attachments).toEqual([armed.id]);
    expect(inst(state, held).statuses.tough).toBe(1);
  });
});

describe("Thunderbolt Backup's swap against Coup de Foudre (50162): 'When a minion engages a player' (RRG 1.8 'Engage' p. 18)", () => {
  // The minion that comes out from under the environment engages the player the other was engaged with, which is a
  // minion engaging a player like any other: Coup de Foudre's Forced Interrupt discards the top X cards of that
  // player's deck, X the boost icons on that minion (4 for each Elite Thunderbolt).
  it("the swap's engage discards the top 4 cards of the engaged player's deck", () => {
    let s = game(1, SETS_SL);
    const m1 = minionOf(s, P1)!;
    const held = heldOf(s)!;
    s = patchInstance(s, m1, { damage: 6 });
    s = encounterCardInVillainArea(s, COUP, 5).state;
    s = stackEncounterDeck(s, BLANKS[0]!, BYSTANDERS);
    const before = playerOf(s, P1).deck.length;
    const { state } = villainPhase(s);
    expect(inst(state, held).engagedWith).toBe(P1);
    expect(before - playerOf(state, P1).deck.length).toBe(4);
  });
});

describe("Guard on every Thunderbolt minion (50130b) against an ally (RRG 1.8 'Guard' p. 21)", () => {
  // "While a minion with the guard keyword is engaged with a player, that player cannot use cards they control to
  // attack a villain without this keyword." An ally is a card they control.
  it("a player's ally may not attack Citizen V while a Thunderbolt minion is engaged with that player, but may attack the minion", () => {
    const base = game(1, SETS_SL);
    const m1 = minionOf(base, P1)!;
    const cat = inPlayArea(base, BLACK_CAT);
    expect(applyCommand(cat.state, BASIC_ATTACK(cat.state, cat.id, villainOf(cat.state)), DEPS).ok).toBe(false);
    expect(applyCommand(cat.state, BASIC_ATTACK(cat.state, cat.id, m1), DEPS).ok).toBe(true);
  });
});

describe("Apprehending Rogue Agents' Forced Response (50130b): 'After a player attacks a Thunderbolt minion' (MC50 p. 15)", () => {
  // The rulebook: "causes any Thunderbolt minion attacked by a player to engage that player". A player attacks with
  // their hero, an ally or an attack event (RRG 1.8 'Attack (Player Ability Type)' p. 10); the minion engaged with
  // another player is attacked by this one and engages them.
  it("an attack event (Haymaker) from the second player on the first player's minion engages the minion with the second player", () => {
    const s = game(2, ["gravitational_pull", "supersonic", "the_leaper"]);
    const target = minionOf(s, P1)!;
    const played = playFromHand(DEPS, s, HAYMAKER, 2, pickingTarget(target), P2);
    expect(damageOf(played.state, target)).toBeGreaterThan(0);
    expect(inst(played.state, target).engagedWith).toBe(P2);
  });

  it("an ally's basic attack from the first player on the second player's minion engages the minion with the ally's controller", () => {
    const base = game(2, ["gravitational_pull", "supersonic", "the_leaper"]);
    const target = minionOf(base, P2)!;
    const cat = inPlayArea(base, BLACK_CAT, P1);
    const { state } = run(DEPS, cat.state, {}, BASIC_ATTACK(cat.state, cat.id, target, P1));
    expect(damageOf(state, target)).toBeGreaterThan(0);
    expect(inst(state, target).engagedWith).toBe(P1);
  });
});

describe("Jolt (50133) is a Thunderbolt minion but has no Victory keyword (RRG 1.8 'Victory X' p. 46)", () => {
  // Only a card with Victory goes to the victory display; Jolt (Villainous only) goes to the encounter discard pile,
  // so she never counts toward Citizen V's "1[per_hero] Thunderbolt minions in the victory display" and Down but Not
  // Out cannot return her.
  it("defeated, Jolt is discarded, the victory display stays empty, and Citizen V is still not defeatable", () => {
    let s = game(1, SETS_SL);
    s = setAsideNow(setAsideNow(s, minionOf(s, P1)!), heldOf(s)!);
    const jolt = engageMinion(s, JOLT, P1);
    s = defeatWithAttack(DEPS, jolt.state, jolt.id);
    expect(s.victoryDisplay).toEqual([]);
    expect(piles(s).discard).toContain(jolt.id);
    // Citizen V takes lethal damage and stays in play (card text: not defeated without the minion in the display).
    s = patchInstance(s, villainOf(s), { damage: 999 });
    const hit = run(
      DEPS,
      heroForm(patchInstance(s, identityOf(s), { exhausted: false })),
      {},
      BASIC_ATTACK(s, identityOf(s), villainOf(s)),
    );
    expect(hit.state.villains[0]!.instanceId).toBe(villainOf(s));
    expect(hit.state.outcome).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// "You" is the identity: Citizen V's Sword and Innocent Bystanders
// ---------------------------------------------------------------------------------------------------------------------

describe("'After you attack' and an ally's attack (RRG 1.8 'You, Your' p. 49): Citizen V's Sword (50132) and Innocent Bystanders (50134)", () => {
  // RRG "You, Your": "If a card ability triggers from a game function that 'you' perform (such as 'after you attack and
  // defeat an enemy'), the player resolving that card ability must resolve that card ability as if the identity they
  // control performed that game function ... it triggers after the controlling player's identity attacks ... but not
  // when an ally under that player's control attacks". The exception is only "after [enemy] attacks you".
  // Was a finding (Thunderbolts 1, fixed): both scripts matched `query(["identity", "ally"])` as the
  // attacker, so an ally's attack answers them. The repo's other "after you attack" cards use YOUR_HERO / YOUR_IDENTITY.

  /** No Thunderbolt minion engaged (no guard), the Sword on Citizen V, Black Cat ready, two physical cards in hand. */
  function swordTable() {
    let s = game(1, SETS_SL);
    s = setAsideNow(setAsideNow(s, minionOf(s, P1)!), heldOf(s)!);
    const sword = attachToHost(s, SWORD, villainOf(s));
    const cat = inPlayArea(sword.state, BLACK_CAT);
    const hand = moveToHand(cat.state, P1, ...PHYSICAL_CARDS);
    return { state: hand.state, cat: cat.id };
  }

  it("an ally's attack on Citizen V does not offer the Sword's discard response (only the identity's does)", () => {
    const t = swordTable();
    const seen: string[] = [];
    run(DEPS, t.state, { seen }, BASIC_ATTACK(t.state, t.cat, villainOf(t.state)));
    expect(seen.some((id) => id.includes("citizen-vs-sword"))).toBe(false);
  });

  it("the Sword's response is offered after the identity's attack (the control)", () => {
    const t = swordTable();
    const viaHero: string[] = [];
    run(DEPS, t.state, { seen: viaHero }, BASIC_ATTACK(t.state, identityOf(t.state), villainOf(t.state)));
    expect(viaHero.some((id) => id.includes("citizen-vs-sword"))).toBe(true);
  });

  /** An engaged minion to attack, Innocent Bystanders (4 counters) in P1's play area, Black Cat ready. */
  function bystandersTable() {
    const base = game(1, SETS_SL);
    const target = minionOf(base, P1)!;
    const deckId = Object.keys(base.encounterDecks)[0]!;
    const pile = base.encounterDecks[deckId as keyof typeof base.encounterDecks]!;
    const card = [...pile.deck, ...pile.discard].find((i) => codeOf(base, i) === BYSTANDERS)!;
    const given: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== card), discard: pile.discard.filter((i) => i !== card) },
      },
      players: base.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, card] } : p)),
      instances: {
        ...base.instances,
        [card]: { ...base.instances[card]!, faceup: true, controllerId: P1, counters: { bystander: 4 } },
      },
    };
    const cat = inPlayArea(given, BLACK_CAT);
    return { state: cat.state, cat: cat.id, target, bystanders: card };
  }

  it("Black Cat's attack on an enemy removes no bystander counter (only the identity's attack counts as 'you')", () => {
    const t = bystandersTable();
    const { state } = run(DEPS, t.state, {}, BASIC_ATTACK(t.state, t.cat, t.target));
    expect(inst(state, t.bystanders).counters["bystander"]).toBe(4);
  });

  it("the identity's attack removes a bystander counter (the control)", () => {
    const t = bystandersTable();
    const viaHero = run(DEPS, t.state, {}, BASIC_ATTACK(t.state, identityOf(t.state), t.target)).state;
    expect(inst(viaHero, t.bystanders).counters["bystander"]).toBe(3);
  });

  it("a stunned hero's attack is replaced by discarding the stun and is not an attack: no bystander counter is removed (RRG 'Stun' p. 41)", () => {
    const t = bystandersTable();
    const hero = identityOf(t.state);
    const stunned = patchInstance(t.state, hero, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const { state } = run(DEPS, stunned, {}, BASIC_ATTACK(stunned, hero, t.target));
    expect(inst(state, hero).statuses.stunned).toBe(0);
    expect(damageOf(state, t.target)).toBe(0);
    expect(inst(state, t.bystanders).counters["bystander"]).toBe(4);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The Thunderbolt sets
// ---------------------------------------------------------------------------------------------------------------------

describe("Hard Sound (50147) against a stunned Songbird (RRG 1.8 'Stun' p. 41, 'Activation' p. 6)", () => {
  // "If no enemy activated this way, this card gains surge": a stunned Songbird discards the stun instead of attacking
  // and "is not considered to have attacked", so nobody activated and the card surges (the same reading as Tap In).
  const { deps, setupGame, villainPhase: phase } = setKit("hard_sound", HARD_SOUND);

  it("she engages the revealer, loses the stun, does not attack, and the card gains surge", () => {
    const base = heroForm(setupGame());
    const staged = encounterCardInVillainArea(base, SONGBIRD, 0);
    const stunned = patchInstance(staged.state, staged.id, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const r = phase(onlyDeck(stunned, BLANK, HARD_SOUND_CARD, FILLER_A), []);
    expect(attacksBy(r.state, r.events, SONGBIRD)).toHaveLength(0);
    expect(inst(r.state, staged.id).statuses.stunned).toBe(0);
    expect(inst(r.state, staged.id).engagedWith).toBe(P1);
    // She is "revealed" as found in play (the engine reports the reveal that engages her); the surge reveals the next card.
    expect(revealedCodes(r.state, r.events)).toEqual([HARD_SOUND_CARD, SONGBIRD, FILLER_A]);
  });

  // Hard Sound Bindings: "When you would attack, discard Hard Sound Bindings instead. Then, you are stunned." An attack
  // event is an attack ("Attack (Player Ability Type)", p. 10), so it is replaced too; the event is still played.
  it("Hard Sound Bindings (50145) replace an attack event (Haymaker) the same way: no damage, the Bindings discarded, the hero stunned", () => {
    const base = heroForm(setupGame());
    const worn = attachToHost(base, BINDINGS, identityOf(base));
    const played = playFromHand(deps, worn.state, HAYMAKER, 2, pickingTarget(villainOf(base)));
    expect(damageOf(played.state, villainOf(base))).toBe(0);
    expect(piles(played.state).discard).toContain(worn.id);
    expect(inst(played.state, identityOf(base)).statuses.stunned).toBe(1);
    expect(playerOf(played.state, P1).discard).toContain(played.id);
  });
});

describe("Pale Little Spider (50148 to 50151) with two players", () => {
  const { deps, setupGame, villainPhase: phase } = setKit("pale_little_spider", PALE_LITTLE_SPIDER);

  // "After Black Widow schemes against you ... Otherwise, you are confused": "you" is the player she schemes against.
  it("Black Widow engaged with the second player schemes at them: only the second player is confused (no Handspring to find)", () => {
    const base = without(setupGame([SPIDER_MAN, IRON_MAN]), HANDSPRING);
    const engaged = engageMinion(base, BLACK_WIDOW, P2);
    // Rhino schemes twice (two boost cards), Black Widow once (villainous), then one card for each player.
    const r = phase(onlyDeck(engaged.state, BLANKS[0]!, BLANKS[1]!, BLANKS[2]!, FILLER_A, FILLER_B), []);
    expect(
      types(r.events, "schemeResolved").filter((e) => codeOf(r.state, e.enemyInstanceId) === BLACK_WIDOW),
    ).toHaveLength(1);
    expect(inst(r.state, identityOf(r.state, P2)).statuses.confused).toBe(1);
    expect(inst(r.state, identityOf(r.state, P1)).statuses.confused).toBe(0);
  });

  // Handspring: "deal that damage to the attacking character instead". An ally that attacks is the attacking character.
  it("Handspring (50149): an ally's attack on Black Widow is dealt to the ally (and Retaliate 1 answers the ally too)", () => {
    const base = heroForm(setupGame());
    const widow = engageMinion(base, BLACK_WIDOW, P1);
    const armed = attachToHost(widow.state, HANDSPRING, widow.id);
    const cat = inPlayArea(armed.state, BLACK_CAT);
    const r = run(deps, cat.state, {}, BASIC_ATTACK(cat.state, cat.id, widow.id));
    expect(damageOf(r.state, widow.id)).toBe(0);
    expect(piles(r.state).discard).toContain(armed.id);
    // Black Cat (ATK 1, 2 hit points) takes the redirected 1 and Retaliate's 1: defeated.
    expect(playerOf(r.state, P1).discard).toContain(cat.id);
    expect(damageOf(r.state, identityOf(r.state))).toBe(0);
  });
});

describe("Runaway Nuclear Reaction (50154): 'After Radioactive Man is dealt any amount of damage' (ruling January 26, 2026 - Ruling 3)", () => {
  // Damage dealt is not damage taken or damage within his hit points: Radioactive Man (18 hit points) at 17 damage is
  // dealt 2 by a basic attack and defeated; the card is still in play and answers, placing 2 threat.
  const { deps, setupGame } = setKit("power_of_the_atom", POWER_OF_THE_ATOM);

  it("the attack that defeats him still places the damage dealt as threat (5 + 2)", () => {
    const base = heroForm(setupGame());
    const rm = engageMinion(base, RADIOACTIVE_MAN, P1);
    const scheme = encounterCardInVillainArea(rm.state, RUNAWAY, 5);
    const hurt = patchInstance(scheme.state, rm.id, { damage: 17 });
    const r = heroAttacks(deps, hurt, rm.id);
    expect(inPlay(r.state, RADIOACTIVE_MAN)).toBeUndefined();
    expect(inst(r.state, scheme.id).threat).toBe(7);
  });
});

describe("Rule the Skies (50140): 'Each Aerial character gets +1 ATK' (RRG 1.8 'Character' p. 12)", () => {
  // A character is an identity, ally, villain or minion: an Aerial hero (Captain Marvel with Cosmic Flight) gets the +1 too.
  const { deps, setupGame } = setKit("gravitational_pull", GRAVITATIONAL_PULL);

  it("Captain Marvel with Cosmic Flight deals 1 more with a basic attack while it is in play; without Cosmic Flight she does not", () => {
    const { state: flying } = playFromHand(deps, setupGame([CAPTAIN_MARVEL]), COSMIC_FLIGHT, 2);
    const flyingHero = heroForm(flying);
    const rhino = villainOf(flyingHero);
    const plain = heroAttacks(deps, flyingHero, rhino);
    const scheme = encounterCardInVillainArea(flyingHero, RULE_THE_SKIES, 3).state;
    const boosted = heroAttacks(deps, scheme, rhino);
    expect(damageOf(boosted.state, rhino) - damageOf(plain.state, rhino)).toBe(1);
    const grounded = encounterCardInVillainArea(heroForm(setupGame([CAPTAIN_MARVEL])), RULE_THE_SKIES, 3).state;
    const groundedBase = heroForm(setupGame([CAPTAIN_MARVEL]));
    expect(damageOf(heroAttacks(deps, grounded, villainOf(grounded)).state, villainOf(grounded))).toBe(
      damageOf(heroAttacks(deps, groundedBase, villainOf(groundedBase)).state, villainOf(groundedBase)),
    );
  });
});

describe("A name two cards share: Batroc the Leaper (50163) in the Batroc scenario (card text 50163; RRG 1.8 'Referential Ability' p. 36)", () => {
  // The villain of scenario two is also named "Batroc". "Find Batroc and reveal him. (If he is already in play, he
  // engages you.) Batroc activates against you. If no enemy activated this way, this card gains surge." The "him" found
  // and revealed is the minion of the set, and the next sentence names the same Batroc. The RRG md copy prints only
  // item 1 of the priority list under 'Referential Ability' ("the card on which the referential ability is printed"; the
  // later items are cut from the copy), so the tie-break itself is not citable here: see the open point in
  // docs/phase7-wave9-qa.md. The Thunderbolt sets are modular sets, which MC50 p. 11 lets a player add to scenario two.
  // FINDING (docs/phase7-wave9-qa.md, Thunderbolts 4): `named` takes the first card in play with the title, the villain.
  function leaperInBatroc() {
    const config = wave9Scenario("batroc", {
      players: [SPIDER_MAN],
      seed: 1,
      difficulty: "standard",
      modularSetIds: ["the_leaper"],
    });
    const created = createGame(config, DEPS);
    if (!created.ok) throw new Error(created.error.message);
    let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", DEPS);
    s = heroForm(s);
    for (const id of cardsInPlay(s).filter((i) => inst(s, i).engagedWith)) s = setAsideNow(s, id);
    const villain = villainOf(s);
    // Step two: the villain's boost card; step three: Batroc the Leaper; then the activation's boost card; a surge's card.
    s = stackEncounterDeck(s, BLANKS[0]!, BATROC_LEAPER, BLANKS[1]!, BLANKS[2]!);
    const r = villainPhase(s);
    const revealed = r.events.map((e, i) =>
      e.type === "encounterCardRevealed" ? [i, codeOf(r.state, e.instanceId)] : null,
    );
    const from = revealed.findIndex((x) => x?.[1] === BATROC_LEAPER);
    const next = revealed.findIndex(
      (x, i) => i > from && x !== null && x[1] !== BATROC_MINION && x[1] !== BATROC_LEAPER,
    );
    const window = r.events.slice(
      revealed[from]![0] as number,
      next === -1 ? undefined : (revealed[next]![0] as number),
    );
    const attacks = types(window, "attackResolved");
    return {
      minionAttacks: attacks.filter((e) => codeOf(r.state, e.enemyInstanceId) === BATROC_MINION).length,
      villainAttacks: attacks.filter((e) => e.enemyInstanceId === villain).length,
      surged: next !== -1,
    };
  }

  it.fails("the minion Batroc activates against the revealer, the villain does not, and the card does not surge", () => {
    expect(leaperInBatroc()).toEqual({ minionAttacks: 1, villainAttacks: 0, surged: false });
  });

  it("today: the villain Batroc attacks instead of the minion he found, and the card still gains surge", () => {
    expect(leaperInBatroc()).toEqual({ minionAttacks: 0, villainAttacks: 1, surged: true });
  });
});

describe("Aerial Dogfight (50159) with a boost that grants ranged (card 50160; RRG 1.8 'Boost' p. 11)", () => {
  // Supersonic's Boost: "If this activation is an attack, it gains overkill and ranged." Dogfight: "unless the attacker or
  // attack has the Aerial trait, or the attack has ranged." The boost resolves before damage, so the attack has ranged.
  const { deps, setupGame, villainPhase: phase } = setKit("supersonic", SUPERSONIC);

  function aerialHero() {
    const { state: flying } = playFromHand(deps, setupGame([CAPTAIN_MARVEL]), COSMIC_FLIGHT, 2);
    return encounterCardInVillainArea(heroForm(flying), DOGFIGHT, 3).state;
  }

  it("Rhino (not Aerial) attacks Captain Marvel with Cosmic Flight: a Supersonic boost makes it ranged, 3 damage; a plain 1-icon boost is reduced to 1", () => {
    const s = aerialHero();
    const ranged = phase(s, [SUPERSONIC_CARD, FILLER_A, FILLER_B]);
    expect(damageOf(ranged.state, identityOf(s))).toBe(3);
    const plain = phase(s, [ONE_ICON, FILLER_A, FILLER_B]);
    expect(damageOf(plain.state, identityOf(s))).toBe(1);
  });

  // RRG 1.8 'Tough' p. 44: a tough status card discards when the character "would take damage"; its defender bullet says
  // "if the damage is reduced to 0, the hero does not lose their tough status card". A reduction to 0 takes no damage.
  it("a hero's attack reduced to 0 by Dogfight does not use up the Aerial MACH-IV's tough status card", () => {
    const base = heroForm(setupGame());
    const mach = engageMinion(base, MACH_IV, P1);
    const armed = patchInstance(encounterCardInVillainArea(mach.state, DOGFIGHT, 3).state, mach.id, {
      statuses: { stunned: 0, confused: 0, tough: 1 },
    });
    const r = heroAttacks(deps, armed, mach.id);
    expect(damageOf(r.state, mach.id)).toBe(0);
    expect(inst(r.state, mach.id).statuses.tough).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The S.H.I.E.L.D. Executive Board
// ---------------------------------------------------------------------------------------------------------------------

describe("S.H.I.E.L.D. Executive Board", () => {
  const { deps, setupGame, villainPhase: phase } = setKit("s.h.i.e.l.d._executive_board", EXECUTIVE_BOARD);
  const secretsOn = (s: GameState, id: InstanceId) => inst(s, id).counters["secret"] ?? 0;
  const boardMember = (s: GameState, code: string): InstanceId => s.villainArea.find((i) => codeOf(s, i) === code)!;
  const withSecrets = (s: GameState, code: string, n: number): GameState =>
    patchInstance(s, boardMember(s, code), { counters: n > 0 ? { secret: n } : {} });
  const act = (state: GameState, member: InstanceId, ref: string, ids: readonly InstanceId[], plan: Plan = {}) =>
    run(
      deps,
      state,
      plan,
      use(
        P1,
        member,
        ref,
        ids.map((fromHand) => ({ fromHand })),
      ),
    );
  const mainThreat = (s: GameState) => inst(s, s.mainScheme.instanceId).threat;

  // Card 50181a: "Spend [energy][energy] -> remove 1 secret counter from here. Then, heal 1 damage ..." RRG 1.8 "'Then'"
  // p. 44: the text before "then" must be fully resolved before the rest is. With no secret counter there is nothing to
  // remove, so nothing is healed (the action may also be refused outright: either is consistent with the text).
  // FINDING (docs/phase7-wave9-qa.md, Thunderbolts 3): `removeCounters` skips a card holding none without marking the
  // instruction unresolved, so the "Then" half runs: the action heals 1 with no secret counter to remove.
  const healedWithNoSecret = (): number => {
    const base = heroForm(setupGame());
    const hero = identityOf(base);
    const hurt = patchInstance(withSecrets(base, MEDICAL, 0), hero, { damage: 3 });
    const given = moveToHand(hurt, P1, ...ENERGY_CARDS);
    try {
      const r = act(given.state, boardMember(given.state, MEDICAL), "50181a.chief-medical-officer-action", given.ids);
      return 3 - damageOf(r.state, hero);
    } catch {
      return 0; // refusing the action outright is consistent with the text too
    }
  };

  it.fails("Chief Medical Officer's Hero Action with no secret counter left heals nothing ('Then', RRG p. 44)", () => {
    expect(healedWithNoSecret()).toBe(0);
  });

  it("today: the same action with no secret counter still heals 1 (the cost is paid, nothing is removed)", () => {
    expect(healedWithNoSecret()).toBe(1);
  });

  it("the Hero Action cannot be used from the alter-ego form (card text: 'Hero Action')", () => {
    const base = withSecrets(setupGame(), MEDICAL, 2);
    expect(base.players[0]!.identity.form).toBe("alterEgo");
    const given = moveToHand(base, P1, ...ENERGY_CARDS);
    const r = applyCommand(
      given.state,
      use(
        P1,
        boardMember(given.state, MEDICAL),
        "50181a.chief-medical-officer-action",
        given.ids.map((fromHand) => ({ fromHand })),
      ),
      deps,
    );
    expect(r.ok).toBe(false);
  });

  // Card 50184a: "Incite 1. When Revealed: ... [star] Boost: Resolve this card's 'When Revealed' ability." RRG 1.8 'Incite X'
  // p. 24: incite is "When a card with the incite X keyword is revealed". A boost card is not revealed.
  it("A.I.M. Interference as a boost card places its counters but no incite threat on the main scheme", () => {
    const base = heroForm(setupGame());
    const asBoost = run(
      deps,
      onlyDeck(base, AIM_ENERGY, FILLER_A, FILLER_B),
      { option: "Place the counter" },
      endTurn(P1),
    );
    const control = run(deps, onlyDeck(base, BLANK, FILLER_A, FILLER_B), { option: "Place the counter" }, endTurn(P1));
    const counts = (s: GameState) => ["50181a", "50182a", "50183a"].map((c) => secretsOn(s, boardMember(s, c)));
    expect(counts(asBoost.state)).toEqual([1, 1, 1]);
    expect(counts(control.state)).toEqual([0, 0, 0]);
    expect(mainThreat(asBoost.state)).toBe(mainThreat(control.state));
  });

  // Card 50184a: "You may spend X [energy] resources to prevent X of these counters". RRG 1.8 'You, Your' p. 49 and 'Reveal'
  // p. 38: on a revealed encounter card "you" is the player revealing it; 'First Player' p. 19 gives the first player the
  // choices only where the card "does not specify which player should act".
  // Was a finding (Thunderbolts 2, fixed): `placeSecrets` asked `chooseOneBy(firstPlayer, ...)`, so with two
  // players the FIRST player decides (and pays from their hand) for an A.I.M. Interference the SECOND player revealed.
  function secondPlayerReveals() {
    let s = setupGame([SPIDER_MAN, IRON_MAN]);
    s = heroForm(s, P1, P2);
    const given = moveToHand(s, P1, ...ENERGY_CARDS);
    // Two activations of Rhino (a boost card each), then P1's card, then P2's A.I.M. Interference.
    const staged = onlyDeck(given.state, BLANK, BLANK, FILLER_A, AIM_ENERGY, FILLER_B);
    const asked: { kind: string; playerId: PlayerId }[] = [];
    const r = phase(staged, [], planned({ asked }));
    return { asked, r };
  }

  it("the second player, who reveals A.I.M. Interference, is the one asked whether to spend a resource", () => {
    const { asked } = secondPlayerReveals();
    const optionAsks = asked.filter((a) => a.kind === "chooseOption");
    expect(optionAsks.length).toBeGreaterThan(0);
    expect(optionAsks.every((a) => a.playerId === P2)).toBe(true);
  });
});
