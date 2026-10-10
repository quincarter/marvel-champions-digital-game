/**
 * Rules QA for the Winter Soldier pack `winter` (54001a/b to 54033, scripted modules only; Whiteout, Blizzard and Encased in
 * Ice are not scripted yet): the interactions the module tests do not assert, each tied to an RRG 1.8 section
 * (`mc_rulesreference_v18_compressed.pdf`), an FFG ruling by its date heading (marvel-champions-rulings-post-rrg-1-7.md) or
 * an owner answer (docs/phase7-wave9.md section 4.1). A `FINDING` comment marks a case where the game and its source
 * disagree: the expected behavior is an `it.fails`, with a passing companion that pins today's behavior. Findings are
 * tabled in docs/phase7-wave9-qa.md.
 */
import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  characterProfile,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  resourceAbility,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, moveToDiscard, withForm } from "../../testing/staging.js";
import { WS_DEPS, engageMinion, stagedInPlay, wsGame, wsHeroGame } from "./testing.js";

vi.setConfig({ testTimeout: 180_000 });

const ARM = "54002";
const WIDOW = "54003";
const ARM_BLOCK = "54004";
const METAL_PUNCH = "54005";
const DISCHARGE = "54006";
const SAFE_HOUSE = "54007";
const INFILTRATION = "54008";
const ARMOR = "54009";
const MASK = "54010";
const RIFLE = "54011";
const CAP = "54012";
const FIREPOWER = "54014";
const ONE_BY_ONE = "54015";
const STANCE = "54017";
const BAMBINO = "54018";
const WALL = "54019";
const SIDEARM = "54020";
const SUPER_SOLDIERS = "54022";
const WINTER_WIDOW = "54023";
const CROSSBONES = "54028";
const HIT_SQUAD = "54029";
const ARMAMENT = "54030";
const ARM_RESOURCE = "54002.cybernetic-arm-resource";
const SAFE_HOUSE_ACTION = "54007.safe-house-30-action";
const WALL_ACTION = "54019.man-on-the-wall-action";
const ARMAMENT_ACTION = "54030.high-tech-armament-action";
const LETHAL = "54001a.lethal-protector";
const RIFLE_INTERRUPT = "54011.winter-rifle-interrupt";
const BAMBINO_INTERRUPT = "54018.bambino-interrupt";
const MASK_RESPONSE = "54010.winter-mask-response";
const INFILTRATION_RESPONSE = "54008.silent-infiltration-response";
const ARM_BLOCK_INTERRUPT = "54004.arm-block-constant";
const SHOCKER = "01103"; // Rhino set minion, 3 hit points
const CORE_HYDRA = "01101"; // Core Hydra Mercenary: Hydra trait, ATK 1, 3 hit points
const ENERGY = "01088";
const GENIUS = "01089";
const ASSAULT = "01187"; // no boost icons
const BLANK = "01186"; // no boost icons

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const damage = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const inPlay = (s: GameState, id: InstanceId): boolean => cardsInPlay(s).includes(id);
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "confused" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: n } });
const basicAttack = (s: GameState, target: InstanceId, player = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: identityOf(s, player),
  targetInstanceId: target,
});
const basicThwart = (s: GameState, scheme: InstanceId, player = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: identityOf(s, player),
  schemeInstanceId: scheme,
});
const heroStat = (s: GameState, id: InstanceId, which: "atk" | "maxHp"): number =>
  characterProfile(s, id, WS_DEPS)![which];

/**
 * A picker that answers each prompt from `opts`: accept a trigger by the suffix of its id, name targets in order, name
 * cards. Everything else is `firstLegal`; defenders are declined unless `defend` names one.
 */
function chooser(
  opts: {
    readonly accept?: readonly string[];
    readonly targets?: readonly InstanceId[];
    readonly cards?: readonly InstanceId[];
    readonly defend?: InstanceId;
  } = {},
) {
  const offered: string[] = [];
  const queue = [...(opts.targets ?? [])];
  const picker: Picker = (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseTriggers") {
      offered.push(...ids);
      const hit = ids.find((id) => (opts.accept ?? []).some((a) => id.endsWith(a)));
      return hit ? [hit] : [];
    }
    if (choice.prompt.kind === "declareDefender")
      return opts.defend && ids.includes(opts.defend) ? [opts.defend] : ["decline"];
    const target = choice.prompt.kind === "chooseTarget" ? queue.find((t) => ids.includes(t)) : undefined;
    if (target) {
      queue.splice(queue.indexOf(target), 1);
      return [target];
    }
    const wanted = (opts.cards ?? []).filter((c) => ids.includes(c));
    if (wanted.length > 0) return wanted;
    return firstLegal(s);
  };
  return { picker, offered, wasOffered: (ref: string) => offered.some((o) => o.endsWith(ref)) };
}

/**
 * Plays the event `code` from the hand and drives its prompts with `pick`. Paid with `payCodes` (hand cards turned into
 * those cards by surgery, so the resource types are known) and, with `arm`, Cybernetic Arm's generated resource first.
 */
function cast(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker,
  opts: { readonly arm?: InstanceId; readonly payCodes?: readonly string[]; readonly extra?: object } = {},
) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const n = cost - (opts.arm ? 1 : 0);
  const pay = payWith(given.state, P1, n, [id]);
  const prepared = (opts.payCodes ?? []).reduce((acc, c, i) => relabel(acc, pay[i]!, c), given.state);
  const abilities = opts.arm ? [resourceAbility(opts.arm, ARM_RESOURCE)] : [];
  return {
    id,
    ...driveEventsPicking(WS_DEPS, prepared, pick, play(P1, id, pay, { abilities, ...opts.extra })),
  };
}

const stunnedHero = (): GameState => {
  const s = wsHeroGame();
  return withStatus(s, identityOf(s), "stunned");
};

// ---------------------------------------------------------------------------------------------------------------------
// A stunned hero and Winter Soldier's labeled events (and Steady from Winter Armor)
// ---------------------------------------------------------------------------------------------------------------------

describe("a stunned hero playing Winter Soldier's attack events (RRG 1.8 'Labeled Ability' p. 26, 'Stun, Stunned' p. 41)", () => {
  // Labeled Ability: "the entire ability (except for its costs) is canceled"; Stun: costs, "including exhausting the
  // character, must still be paid". Ruling August 13, 2026 - Ruling 1 (1): the event was still played.

  it("Metal Punch 54005 paid with Cybernetic Arm: the Arm is exhausted (a cost) but no damage is dealt and the stun is removed", () => {
    const arm = stagedInPlay(stunnedHero(), ARM, { attach: true });
    const r = cast(arm.state, METAL_PUNCH, 3, firstLegal, { arm: arm.id });
    expect(inst(r.state, arm.id).exhausted).toBe(true);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });

  it("Electrical Discharge 54006 paid with two [energy]: no damage and the enemy is not stunned", () => {
    const r = cast(stunnedHero(), DISCHARGE, 2, firstLegal, { payCodes: [ENERGY, ENERGY] });
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, villainOf(r.state)).statuses.stunned).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
  });

  it("Super-Soldiers 54022 with Captain America in play: no damage and neither character gets the tough status card", () => {
    const cap = stagedInPlay(stunnedHero(), CAP);
    const r = cast(cap.state, SUPER_SOLDIERS, 3, firstLegal);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, cap.id).statuses.tough).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.tough).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
  });

  it("Firepower 54014: the Weapon is exhausted as the cost, no damage is dealt, the stun is removed", () => {
    const side = stagedInPlay(stunnedHero(), SIDEARM, { attach: true, counters: { ammo: 3 } });
    const r = cast(side.state, FIREPOWER, 1, firstLegal, { extra: { costChoices: { exhausted: [side.id] } } });
    expect(inst(r.state, side.id).exhausted).toBe(true);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
  });

  it("Arm Block 54004 (attack/defense) by a stunned hero: the whole ability is canceled, so no 3 damage and no defense; the hero takes Rhino's attack", () => {
    // Labeled Ability: an ability with several labels is canceled entirely when one label is canceled, and "each status card
    // ... that cancels any of the labeled ability's types is removed". Stun cancels the attack label, so the defense label
    // goes with it.
    const given = moveToHand(stunnedHero(), P1, ARM_BLOCK);
    const state = stackEncounterDeck(given.state, ASSAULT, BLANK);
    const chosen = chooser({ accept: [ARM_BLOCK_INTERRUPT] });
    const pick: Picker = (s) =>
      s.pendingChoice!.prompt.kind === "payForCard"
        ? [s.pendingChoice!.options.find((o) => (o.optionId as string).startsWith("hand:"))!.optionId as string]
        : chosen.picker(s);
    const r = driveEventsPicking(WS_DEPS, state, pick, endTurn(P1));
    expect(chosen.wasOffered(ARM_BLOCK_INTERRUPT)).toBe(true);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
    expect(damage(r.state, identityOf(r.state))).toBe(2);
  });
});

describe("Arm Block 54004 and the status cards of the hero and of the attacker (RRG 1.8 'Stun, Stunned' p. 41, 'Confuse, Confused')", () => {
  const blockPicker = (accept: readonly string[]) => {
    const chosen = chooser({ accept });
    const pick: Picker = (s) =>
      s.pendingChoice!.prompt.kind === "payForCard"
        ? [s.pendingChoice!.options.find((o) => (o.optionId as string).startsWith("hand:"))!.optionId as string]
        : chosen.picker(s);
    return { chosen, pick };
  };

  it("a confused hero is unaffected: confuse cancels only a thwart, so Arm Block still deals 3 and defends, and the confused card stays", () => {
    const base = wsHeroGame();
    const confused = withStatus(base, identityOf(base), "confused");
    const given = moveToHand(confused, P1, ARM_BLOCK);
    const state = stackEncounterDeck(given.state, ASSAULT, BLANK);
    const { chosen, pick } = blockPicker([ARM_BLOCK_INTERRUPT]);
    const r = driveEventsPicking(WS_DEPS, state, pick, endTurn(P1));
    expect(chosen.wasOffered(ARM_BLOCK_INTERRUPT)).toBe(true);
    expect(damage(r.state, villainOf(r.state))).toBe(3);
    expect(damage(r.state, identityOf(r.state))).toBe(2);
    expect(inst(r.state, identityOf(r.state)).statuses.confused).toBe(1);
  });

  it("a stunned Rhino does not attack, so 'When an enemy attacks' never happens: Arm Block is not offered and the stun card is spent", () => {
    // Stun: the activation's attack is replaced by discarding the stunned card and the enemy "is not considered to have attacked".
    const base = wsHeroGame();
    const given = moveToHand(withStatus(base, villainOf(base), "stunned"), P1, ARM_BLOCK);
    // A stunned villain is dealt no boost card, so the first card stacked is the one dealt to the player.
    const state = stackEncounterDeck(given.state, BLANK, BLANK);
    const { chosen, pick } = blockPicker([ARM_BLOCK_INTERRUPT]);
    const r = driveEventsPicking(WS_DEPS, state, pick, endTurn(P1));
    expect(chosen.wasOffered(ARM_BLOCK_INTERRUPT)).toBe(false);
    expect(inst(r.state, villainOf(r.state)).statuses.stunned).toBe(0);
    expect(damage(r.state, identityOf(r.state))).toBe(0);
  });
});

describe("Winter Armor 54009 gives steady (RRG 1.8 'Steady' p. 41)", () => {
  // Steady: "not considered stunned and stunned status cards on it do not resolve" while it has fewer than 2.
  const armored = () => stagedInPlay(wsHeroGame(), ARMOR, { attach: true });

  it("one stunned status card does not resolve: the hero's basic attack is made and the card stays", () => {
    const { state } = armored();
    const stunned = withStatus(state, identityOf(state), "stunned", 1);
    const r = driveEventsPicking(WS_DEPS, stunned, firstLegal, basicAttack(stunned, villainOf(stunned)));
    expect(damage(r.state, villainOf(r.state))).toBe(2);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(1);
  });

  it("two stunned status cards do resolve: the attack is replaced and both cards are removed (Stun: 'remove each stunned status card')", () => {
    const { state } = armored();
    const stunned = withStatus(state, identityOf(state), "stunned", 2);
    const r = driveEventsPicking(WS_DEPS, stunned, firstLegal, basicAttack(stunned, villainOf(stunned)));
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// One basic attack with several upgrades: Winter Rifle, Bambino, Lethal Protector, Mask, Silent Infiltration
// ---------------------------------------------------------------------------------------------------------------------

describe("a basic attack carrying Winter Rifle, Bambino and the defeat responses (RRG 1.8 'Piercing' p. 32, 'Overkill' p. 31, 'Tough' p. 44, 'Restricted' p. 38)", () => {
  /** Hero form, a Shocker (3 hit points) with a tough status card engaged, and the named upgrades on the identity. */
  function staged(upgrades: readonly string[]) {
    let s = withStatus(engageMinion(wsHeroGame(), SHOCKER, "shock"), "shock" as InstanceId, "tough");
    const ids: Record<string, InstanceId> = {};
    for (const code of upgrades) {
      const put = stagedInPlay(s, code, { attach: true, ...(code === BAMBINO ? { counters: { ammo: 3 } } : {}) });
      s = put.state;
      ids[code] = put.id;
    }
    return { state: s, ids };
  }
  const shock = "shock" as InstanceId;

  it("Rifle (piercing, ATK 4) plus Bambino (+3, overkill) on a tough Shocker: the tough card is pierced first, 7 damage defeats it, 4 spill to Rhino and Lethal Protector removes 2 threat", () => {
    // Piercing discards tough "before dealing damage"; Overkill: the damage beyond hit points goes to the villain. 2 + 2 + 3
    // = 7; 7 - 3 = 4. Two restricted cards (Rifle, Bambino on an identity) are within the limit, so neither is discarded.
    const staged2 = staged([RIFLE, BAMBINO]);
    const ids = staged2.ids;
    const state = patchInstance(staged2.state, staged2.state.mainScheme.instanceId, { threat: 5 });
    const before = mainThreat(state);
    const chosen = chooser({ accept: [RIFLE_INTERRUPT, BAMBINO_INTERRUPT, LETHAL] });
    const r = driveEventsPicking(WS_DEPS, state, chosen.picker, basicAttack(state, shock));
    expect(inPlay(r.state, shock)).toBe(false);
    expect(damage(r.state, villainOf(r.state))).toBe(4);
    expect(mainThreat(r.state)).toBe(before - 2);
    expect(inst(r.state, ids[RIFLE]!).exhausted).toBe(true);
    expect(inst(r.state, ids[BAMBINO]!).counters).toEqual({ ammo: 2 });
    expect(inPlay(r.state, ids[RIFLE]!)).toBe(true);
    expect(inPlay(r.state, ids[BAMBINO]!)).toBe(true);
  });

  it("Bambino alone on the same tough Shocker: the tough card prevents all the damage, so nothing is dealt, nothing spills and the ammo counter is still spent", () => {
    // Tough: "prevent all of that damage and discard a tough status card"; Overkill needs the minion to be defeated; ruling
    // March 6, 2026 - Ruling 1 (2) (tough prevents Overkill damage to an ally's identity) is the same shape.
    const { state, ids } = staged([BAMBINO]);
    const chosen = chooser({ accept: [BAMBINO_INTERRUPT, LETHAL] });
    const r = driveEventsPicking(WS_DEPS, state, chosen.picker, basicAttack(state, shock));
    expect(inPlay(r.state, shock)).toBe(true);
    expect(damage(r.state, shock)).toBe(0);
    expect(inst(r.state, shock).statuses.tough).toBe(0);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(chosen.wasOffered(LETHAL)).toBe(false);
    expect(inst(r.state, ids[BAMBINO]!).counters).toEqual({ ammo: 2 });
  });

  it("Lethal Protector, Winter Mask and Silent Infiltration all answer one defeat: 2 threat removed, a card drawn, the hero readied and an enemy confused", () => {
    // Three Responses to one condition: the player may resolve each, in the order they choose (RRG 'Timing' / 'Responses').
    const base = patchInstance(engageMinion(wsHeroGame(), SHOCKER, "shock"), "shock" as InstanceId, { damage: 1 });
    const withMask = stagedInPlay(base, MASK, { attach: true });
    const withInf = stagedInPlay(withMask.state, INFILTRATION, { attach: true });
    const state = patchInstance(withInf.state, withInf.state.mainScheme.instanceId, { threat: 5 });
    const before = mainThreat(state);
    const hand = playerOf(state, P1).hand.length;
    const chosen = chooser({ accept: [LETHAL, MASK_RESPONSE, INFILTRATION_RESPONSE], targets: [villainOf(state)] });
    const done = driveEventsPicking(WS_DEPS, state, chosen.picker, basicAttack(state, shock));
    expect(inPlay(done.state, shock)).toBe(false);
    expect(mainThreat(done.state)).toBe(before - 2);
    expect(playerOf(done.state, P1).hand.length).toBe(hand + 1);
    expect(inst(done.state, withMask.id).exhausted).toBe(true);
    expect(playerOf(done.state, P1).discard).toContain(withInf.id);
    expect(inst(done.state, identityOf(done.state)).exhausted).toBe(false);
    expect(inst(done.state, villainOf(done.state)).statuses.confused).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Cybernetic Arm with the events it pays for
// ---------------------------------------------------------------------------------------------------------------------

describe("Cybernetic Arm 54002 paying for events (RRG 1.8 'Event' p. 19; owner answer Q53; 'Wild Resource' p. 48)", () => {
  it("One by One 54015 paid with the Arm: each of its two instances of damage is 1 higher (3 to the Shocker, then 3 to the villain)", () => {
    // The Arm's "1 additional damage" is added to each instance of damage the event deals (Q53), and the follow-up deal is
    // a separate instance, not "additional" damage itself.
    const base = patchInstance(engageMinion(wsHeroGame(), SHOCKER, "shock"), "shock" as InstanceId, { damage: 1 });
    const arm = stagedInPlay(base, ARM, { attach: true });
    const chosen = chooser({ targets: ["shock" as InstanceId, villainOf(base)] });
    const r = cast(arm.state, ONE_BY_ONE, 1, chosen.picker, { arm: arm.id });
    expect(inst(r.state, arm.id).exhausted).toBe(true);
    expect(inPlay(r.state, "shock" as InstanceId)).toBe(false);
    expect(damage(r.state, villainOf(r.state))).toBe(3);
  });

  it("Electrical Discharge 54006 paid with the Arm's wild resource and a [mental] card: the wild counts as [energy], so the enemy is stunned and takes 4 + 1", () => {
    // Wild Resource: "Wild resources can be used as their type or any of the other types".
    const arm = stagedInPlay(wsHeroGame(), ARM, { attach: true });
    const r = cast(arm.state, DISCHARGE, 2, firstLegal, { arm: arm.id, payCodes: [GENIUS] });
    expect(damage(r.state, villainOf(r.state))).toBe(5);
    expect(inst(r.state, villainOf(r.state)).statuses.stunned).toBe(1);
  });

  it("Metal Punch 54005 paid with the Arm against a tough Shocker: the overkill attack is fully prevented, so no excess goes to Rhino", () => {
    // Tough prevents all the damage and the minion is not defeated, so Overkill has no excess to deal (ruling March 6, 2026 -
    // Ruling 1 (2), same shape for an ally).
    const base = withStatus(engageMinion(wsHeroGame(), SHOCKER, "shock"), "shock" as InstanceId, "tough");
    const arm = stagedInPlay(base, ARM, { attach: true });
    const chosen = chooser({ targets: ["shock" as InstanceId] });
    const r = cast(arm.state, METAL_PUNCH, 3, chosen.picker, { arm: arm.id });
    expect(inst(r.state, "shock" as InstanceId).statuses.tough).toBe(0);
    expect(damage(r.state, "shock" as InstanceId)).toBe(0);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
  });
});

describe("Spoiling for a Fight 54016 with no minion to find (RRG 1.8 'Encounter Deck' p. 17)", () => {
  it("the discard runs out the deck and is fulfilled: no minion enters play, it does not continue with the reshuffled deck, and the hero is still readied", () => {
    // Encounter Deck: "discard cards ... until a card with specific criteria is discarded, discard cards from the encounter deck
    // until the discard condition is met or the encounter deck is empty. If the encounter deck is emptied this way, that card
    // ability is considered to be fulfilled. Do not continue the discard effect with the newly shuffled encounter deck."
    const base = wsHeroGame();
    const isMinion = (a: GameState, id: InstanceId) => a.cardPool[cardId(codeOf(a, id))]?.type === "minion";
    const noMinions = Object.values(base.encounterDecks).reduce(
      (acc, pile) =>
        [...pile.deck, ...pile.discard].reduce((a, id) => (isMinion(a, id) ? relabel(a, id, BLANK) : a), acc),
      base,
    );
    const tired = patchInstance(noMinions, identityOf(noMinions), { exhausted: true });
    const given = moveToHand(tired, P1, "54016");
    const r = driveEventsPicking(WS_DEPS, given.state, firstLegal, play(P1, given.ids[0]!));
    expect(inst(r.state, identityOf(r.state)).exhausted).toBe(false);
    expect(cardsInPlay(r.state).filter((i) => inst(r.state, i).engagedWith === P1)).toHaveLength(0);
    expect(playerOf(r.state, P1).discard).toContain(given.ids[0]!);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Team-Up with another player's character
// ---------------------------------------------------------------------------------------------------------------------

describe("Super-Soldiers 54022 and a Captain America another player controls (RRG 1.8 'Team-Up' p. 43)", () => {
  it("the other player's Captain America is a friendly character in play: the event is playable and he gets the tough status card", () => {
    // Team-Up: "a friendly character in play whose title or subtitle matches name 1 and a friendly character in play ...".
    const s = wsHeroGame({ twoPlayers: true });
    const capId = playerOf(s, P2).hand[0]!;
    const withCap: GameState = {
      ...patchInstance(relabel(s, capId, CAP), capId, { faceup: true, controllerId: P2 }),
      players: s.players.map((p) =>
        p.playerId === P2 ? { ...p, hand: p.hand.filter((i) => i !== capId), playArea: [...p.playArea, capId] } : p,
      ),
    };
    const r = cast(withCap, SUPER_SOLDIERS, 3, firstLegal);
    expect(damage(r.state, villainOf(r.state))).toBe(6);
    expect(inst(r.state, capId).statuses.tough).toBe(1);
    expect(inst(r.state, identityOf(r.state)).statuses.tough).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Winter, Widow, Soldier, Spy and "Max 1 per player"
// ---------------------------------------------------------------------------------------------------------------------

describe("Winter, Widow, Soldier, Spy 54023 and Aggressive Stance 54017 (RRG 1.8 'Play, Put into Play' p. 32; 'Max' entry)", () => {
  it("OPEN POINT: with one Aggressive Stance attached, a second copy is put into play from the discard pile (pinned)", () => {
    // 'Play, Put into Play' says putting a card into play bypasses "any restrictions or prohibitions regarding playing that
    // card", while the 'Max' entry says "A player cannot take control of another copy of a 'Max 1 per player' card they
    // already control." The RRG does not say which wins for a put-into-play effect and no ruling names it, so this only pins
    // today's behavior.
    const widow = stagedInPlay(wsHeroGame(), WIDOW);
    const first = stagedInPlay(widow.state, STANCE, { attach: true });
    const second = moveToDiscard(first.state, P1, STANCE);
    const chosen = chooser({ cards: [second.id] });
    const r = cast(second.state, WINTER_WIDOW, 2, chosen.picker);
    const attached = inst(r.state, identityOf(r.state)).attachments.filter((i) => codeOf(r.state, i) === STANCE);
    expect(attached).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Safe House #30 finding a Quickstrike minion
// ---------------------------------------------------------------------------------------------------------------------

/** The first instance of `code`: a player's set-aside copy, else any other. */
const findCard = (s: GameState, code: string): InstanceId =>
  playerOf(s, P1).setAside.find((i) => codeOf(s, i) === code) ??
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const removeFromZones = (s: GameState, id: InstanceId): GameState => ({
  ...s,
  players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
  encounterDecks: Object.fromEntries(
    Object.entries(s.encounterDecks).map(([k, d]) => [
      k,
      { deck: d.deck.filter((i) => i !== id), discard: d.discard.filter((i) => i !== id) },
    ]),
  ),
});
/** A set-aside minion put into play engaged with P1 by surgery (no reveal). */
function engagedNemesis(s: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = findCard(s, code);
  const stripped = removeFromZones(s, id);
  return {
    id,
    state: {
      ...stripped,
      players: stripped.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...stripped.instances, [id]: { ...stripped.instances[id]!, faceup: true, engagedWith: P1 } },
    },
  };
}
/** The set-aside side scheme `code` put into the villain area by surgery. */
function sideScheme(s: GameState, code: string, threat: number): { state: GameState; id: InstanceId } {
  const id = findCard(s, code);
  const stripped = removeFromZones(s, id);
  return {
    id,
    state: {
      ...stripped,
      villainArea: [...stripped.villainArea, id],
      instances: { ...stripped.instances, [id]: { ...stripped.instances[id]!, faceup: true, threat } },
    },
  };
}

describe("Safe House #30 54007 finding Crossbones (RRG 1.8 'Quickstrike' p. 36, 'Engage' p. 18)", () => {
  it("in alter-ego form the Quickstrike minion engages Bucky Barnes and does not attack him, and the 'then' card is drawn", () => {
    // Quickstrike: "After a minion with the quickstrike keyword engages a player whose identity is in hero form, that minion
    // attacks that player." Bucky is in alter-ego form, so no attack. Crossbones is a set-aside nemesis card, so the test
    // moves him to the top of the encounter deck for the search to find.
    const house = stagedInPlay(wsGame(), SAFE_HOUSE);
    const id = findCard(house.state, CROSSBONES);
    const stripped = removeFromZones(house.state, id);
    const deckId = activeEncounterDeckId(stripped);
    const pile = stripped.encounterDecks[deckId]!;
    const state: GameState = {
      ...stripped,
      encounterDecks: { ...stripped.encounterDecks, [deckId]: { ...pile, deck: [id, ...pile.deck] } },
    };
    const hand = playerOf(state, P1).hand.length;
    const chosen = chooser({ cards: [id] });
    const r = driveEventsPicking(WS_DEPS, state, chosen.picker, use(P1, house.id, SAFE_HOUSE_ACTION));
    expect(inst(r.state, id)).toMatchObject({ engagedWith: P1, faceup: true });
    expect(damage(r.state, identityOf(r.state))).toBe(0);
    expect(ofType(r.events, "damageDealt").filter((e) => e.sourceInstanceId === id)).toHaveLength(0);
    expect(playerOf(r.state, P1).hand.length).toBe(hand + 1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Crossbones and Hydra Hit Squad
// ---------------------------------------------------------------------------------------------------------------------

describe("Crossbones 54028 under Hydra Hit Squad 54029 (RRG 1.8 'Hit Points' p. 22, 'Tough' p. 44)", () => {
  /**
   * Hero form, Crossbones engaged with P1, an ally of `allyCode` in play that defends only Crossbones' attack, Rhino
   * stunned (no attack, no boost card). `squad` puts Hydra Hit Squad into play (Crossbones ATK 3); `tough` gives the ally a tough card.
   */
  function crossbonesAttacks(allyCode: string, opts: { squad: boolean; tough: boolean }) {
    const ally = stagedInPlay(wsHeroGame(), allyCode);
    let s = opts.tough ? withStatus(ally.state, ally.id, "tough") : ally.state;
    const nemesis = engagedNemesis(s, CROSSBONES);
    s = nemesis.state;
    if (opts.squad) s = sideScheme(s, HIT_SQUAD, 3).state;
    s = withStatus(s, villainOf(s), "stunned");
    const r = driveEventsPicking(
      WS_DEPS,
      s,
      (st) => {
        const prompt = st.pendingChoice!.prompt;
        if (prompt.kind === "declareDefender") {
          return prompt.attack.enemyInstanceId === nemesis.id &&
            st.pendingChoice!.options.some((o) => o.optionId === ally.id)
            ? [ally.id]
            : ["decline"];
        }
        return firstLegal(st);
      },
      ...st2end(s),
    );
    return { ...r, ally: ally.id, crossbones: nemesis.id };
  }
  const st2end = (s: GameState): Command[] => s.players.map((p) => endTurn(p.playerId));
  const threatFromCrossbones = (events: readonly GameEvent[], id: InstanceId) =>
    ofType(events, "threatPlaced").filter((e) => e.sourceInstanceId === id);

  it("Hit Squad's +1 ATK makes his attack (3) defeat a full-health Black Widow (3 hit points): 2 threat on the main scheme; without the side scheme she survives", () => {
    const squad = crossbonesAttacks(WIDOW, { squad: true, tough: false });
    expect(ofType(squad.events, "characterDefeated").some((e) => e.instanceId === squad.ally)).toBe(true);
    expect(threatFromCrossbones(squad.events, squad.crossbones).map((e) => e.amount)).toEqual([2]);
    const plain = crossbonesAttacks(WIDOW, { squad: false, tough: false });
    expect(damage(plain.state, plain.ally)).toBe(2);
    expect(threatFromCrossbones(plain.events, plain.crossbones)).toHaveLength(0);
  });

  it("a tough Captain America (Toughness) hit for 3 is not defeated, so the Forced Response does not trigger: the tough card prevents all of it", () => {
    // Tough: "prevent all of that damage"; the ally is "not considered to have taken damage", so it is not defeated.
    const tough = crossbonesAttacks(CAP, { squad: true, tough: true });
    expect(ofType(tough.events, "characterDefeated").some((e) => e.instanceId === tough.ally)).toBe(false);
    expect(damage(tough.state, tough.ally)).toBe(0);
    expect(inst(tough.state, tough.ally).statuses.tough).toBe(0);
    expect(threatFromCrossbones(tough.events, tough.crossbones)).toHaveLength(0);
    const bare = crossbonesAttacks(CAP, { squad: true, tough: false });
    expect(threatFromCrossbones(bare.events, bare.crossbones).map((e) => e.amount)).toEqual([2]);
  });

  it("defeating the side scheme removes the +2 hit points: a Hydra minion with 4 damage (5 hit points while it stood) is defeated at once", () => {
    // Hit Points: when an ally or minion's "+X hit points" "ceases to be in effect and causes that ally or minion to have
    // damage on it equal to or greater than its hit points, that ally or minion is defeated."
    const merc = patchInstance(engageMinion(wsHeroGame(), CORE_HYDRA, "merc"), "merc" as InstanceId, { damage: 4 });
    const squad = sideScheme(merc, HIT_SQUAD, 1);
    expect(heroStat(squad.state, "merc" as InstanceId, "maxHp")).toBe(5);
    const r = driveEventsPicking(WS_DEPS, squad.state, firstLegal, basicThwart(squad.state, squad.id));
    expect(inPlay(r.state, squad.id)).toBe(false);
    expect(inPlay(r.state, "merc" as InstanceId)).toBe(false);
  });

  it("in a two-player game the player who defeats it gets the Hydra minion: P2's thwart defeats it and the minion engages P2", () => {
    // The card text: "The player who defeated this scheme searches ... and reveals it", and a revealed minion engages the
    // player revealing it (RRG 'Engage' p. 18).
    const base = withForm(wsHeroGame({ twoPlayers: true }), { heroForm: 0 }, P2);
    const squad = sideScheme(base, HIT_SQUAD, 1);
    const deckId = activeEncounterDeckId(squad.state);
    const top = squad.state.encounterDecks[deckId]!.deck[0]!;
    const state = relabel(squad.state, top, CORE_HYDRA);
    const r = driveEventsPicking(WS_DEPS, state, firstLegal, endTurn(P1), basicThwart(state, squad.id, P2));
    expect(inPlay(r.state, squad.id)).toBe(false);
    expect(inst(r.state, top).engagedWith).toBe(P2);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// High-Tech Armament's Hero Action cost, and Man on the Wall's duration
// ---------------------------------------------------------------------------------------------------------------------

describe("High-Tech Armament 54030: 'Exhaust a character you control' (RRG 1.8 'Cost' p. 13)", () => {
  /** Armament attached to the villain through the real reveal in the villain phase, then the next player phase. */
  function attached() {
    const base = wsHeroGame();
    const id = findCard(base, ARMAMENT);
    const stripped = removeFromZones(base, id);
    const deckId = activeEncounterDeckId(stripped);
    const pile = stripped.encounterDecks[deckId]!;
    const [boost, ...rest] = pile.deck;
    const state: GameState = relabel(
      {
        ...stripped,
        encounterDecks: { ...stripped.encounterDecks, [deckId]: { ...pile, deck: [boost!, id, ...rest] } },
      },
      boost!,
      BLANK,
    );
    const r = driveEventsPicking(WS_DEPS, state, chooser().picker, endTurn(P1));
    return { state: r.state, id };
  }

  it("with the identity exhausted and no other character, the action cannot be taken; with a ready ally it is paid by the ally, not the identity", () => {
    const { state, id } = attached();
    expect(inst(state, id).attachedTo).toBe(villainOf(state));
    const tired = patchInstance(state, identityOf(state), { exhausted: true });
    const refused = applyCommand(tired, use(P1, id, ARMAMENT_ACTION, [], { exhausted: [identityOf(tired)] }), WS_DEPS);
    expect(refused.ok).toBe(false);
    const widow = stagedInPlay(tired, WIDOW);
    const r = driveEventsPicking(
      WS_DEPS,
      widow.state,
      firstLegal,
      use(P1, id, ARMAMENT_ACTION, [], { exhausted: [widow.id] }),
    );
    expect(inst(r.state, widow.id).exhausted).toBe(true);
    expect(inPlay(r.state, id)).toBe(false);
  });
});

describe("Man on the Wall 54019 (RRG 1.8 'Cost' p. 13; the card says 'this phase')", () => {
  it("a reduction not used in the hero phase is gone in the next one: Winter Rifle (cost 3) paid with 2 cards is refused the next round", () => {
    const wall = stagedInPlay(engageMinion(wsHeroGame(), SHOCKER, "shock"), WALL, { attach: true });
    const used = driveEventsPicking(WS_DEPS, wall.state, firstLegal, use(P1, wall.id, WALL_ACTION));
    // End the turn through the villain phase (the Shocker's attack is not defended), into the next player phase.
    const stacked = stackEncounterDeck(used.state, ASSAULT, BLANK, BLANK);
    const next = driveEventsPicking(WS_DEPS, stacked, chooser().picker, endTurn(P1));
    expect(next.state.step.phase).toBe("player");
    const given = moveToHand(next.state, P1, RIFLE);
    const twoCards = payWith(given.state, P1, 2, given.ids);
    expect(applyCommand(given.state, play(P1, given.ids[0]!, twoCards), WS_DEPS).ok).toBe(false);
    // Control: the refusal is the price, not something else about the card.
    const threeCards = payWith(given.state, P1, 3, given.ids);
    expect(applyCommand(given.state, play(P1, given.ids[0]!, threeCards), WS_DEPS).ok).toBe(true);
  });
});
