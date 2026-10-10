import {
  CORE_CARDS,
  WINTER_CARDS,
  cardId,
  trait,
  type AllyCard,
  type SupportCard,
  type UpgradeCard,
} from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  handSize,
  hasKeyword,
  legalActions,
  maxHitPoints,
  traitsOf,
  type Command,
  type EffectSpec,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type Payment,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { attackAnEnemy, draw, heroAction, ifThen, playNote } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import {
  CYBERNETIC_ARM_NOTE,
  WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";
import { WS_DEPS, engageMinion, stagedInPlay, wsGame, wsHeroGame } from "../testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Winter Soldier's player cards (54002, 54003, 54007 to 54011), docs/phase7-wave9.md section 8.4 and 3.52. The printed
 * precon `winter-aggression` against Rhino (stage 1). Cybernetic Arm's "that event deals 1 additional damage" is shown
 * on Core's Haymaker (3 damage), and the note it writes for the Winter events ("If you exhausted Cybernetic Arm to pay
 * for this event") through a Haymaker whose script is replaced here by one that draws a card when the note is on its play.
 */
const ARM = "54002.cybernetic-arm-resource";
const WIDOW = "54003.black-widow-response";
const SAFE_HOUSE = "54007.safe-house-30-action";
const INFILTRATION = "54008.silent-infiltration-response";
const ARMOR = "54009.winter-armor-constant";
const MASK_TRAIT = "54010.winter-mask-constant";
const MASK = "54010.winter-mask-response";
const RIFLE = "54011.winter-rifle-interrupt";
const REFS = [ARM, WIDOW, SAFE_HOUSE, INFILTRATION, ARMOR, MASK_TRAIT, MASK, RIFLE];
const CODES = ["54002", "54003", "54007", "54008", "54009", "54010", "54011"];

const HAYMAKER = "01087"; // basic attack event, cost 2: Hero Action (attack): 3 damage to an enemy
const MERCENARY = "01101"; // Hydra Mercenary: minion, 3 hit points
const BOMBER = "01110"; // Hydra Bomber: minion, 2 hit points
const SANDMAN = "01102"; // minion, 2 boost icons
const SHOCKER = "01103"; // minion, When Revealed: 1 damage to each hero
const DEFENSE_EVENT = "01090"; // a non-Attack event (Core)

const card = <T>(code: string): T => WINTER_CARDS.find((c) => c.id === cardId(code)) as T;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const handOf = (s: GameState): readonly InstanceId[] => playerOf(s, P1).hand;
const discardOf = (s: GameState): readonly InstanceId[] => playerOf(s, P1).discard;
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const MINION_CODES = new Set(CORE_CARDS.filter((c) => c.type === "minion").map((c) => c.id as string));
const isMinion = (s: GameState, id: InstanceId): boolean => MINION_CODES.has(codeOf(s, id));
const withScheme = (s: GameState, threat: number): GameState => patchInstance(s, schemeOf(s), { threat });

/** The first hand card of `code`, drawn from the deck when it is not in the hand yet. */
function inHand(s: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(s, P1, code);
  return { state: given.state, id: given.ids[0]! };
}
/** A hand card turned into another card by surgery (the first that is neither `keep` nor one of the others). */
function asCard(s: GameState, code: string, keep: readonly InstanceId[] = []): { state: GameState; id: InstanceId } {
  const id = handOf(s).find((i) => !keep.includes(i))!;
  return { state: patchInstance(s, id, { cardId: cardId(code) }), id };
}
const viaArm = (arm: InstanceId): Payment => resourceAbility(arm, ARM);
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(WS_DEPS, s, pick, ...commands);
const refusal = (s: GameState, command: Command, deps: EngineDeps = WS_DEPS): string | undefined => {
  const result = applyCommand(s, command, deps);
  return result.ok ? undefined : result.error.message;
};
const offeredActions = (s: GameState, deps: EngineDeps = WS_DEPS) => {
  const legal = legalActions(s, P1, deps);
  if (legal.kind !== "turn") throw new Error(legal.kind);
  return legal.legal;
};
const canUse = (s: GameState, ability: string): boolean =>
  offeredActions(s).some((a) => a.action.kind === "useAbility" && a.action.abilityId === ability);

/** Takes the named triggers (id suffixes) when offered, targets `target` when it is offered, else the first option. */
const planner =
  (plan: { take?: readonly string[]; target?: InstanceId; found?: InstanceId; seen?: string[] } = {}): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        plan.seen?.push(...offered);
        const hit = offered.find((o) => plan.take?.some((t) => o.endsWith(t)));
        return hit ? [hit] : [];
      }
      case "declareDefender":
        return [identityOf(s)];
      case "chooseTarget":
        return plan.target && offered.includes(plan.target) ? [plan.target] : firstLegal(s);
      case "chooseCards": {
        if (plan.found && offered.includes(plan.found)) return [plan.found];
        return firstLegal(s);
      }
      default:
        return firstLegal(s);
    }
  };

const basicAttack = (s: GameState, target: InstanceId, attacker: InstanceId = identityOf(s)): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const basicThwart = (s: GameState, thwarter: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: schemeOf(s),
});

/** Hero form with the upgrade `code` already attached to the identity. */
function hero(code?: string, opts: { counters?: Record<string, number> } = {}) {
  const base = wsHeroGame();
  if (!code) return { state: base, id: identityOf(base) };
  return stagedInPlay(base, code, { attach: true, ...opts });
}

/** Core's Haymaker with a witness for the Arm's note: it also draws a card when the note is on its play. */
const NOTED_DEPS: EngineDeps = {
  abilities: {
    ...WS_DEPS.abilities,
    "01087.haymaker-action": heroAction(
      { label: "attack" },
      ...(attackAnEnemy(3) as EffectSpec[]),
      ifThen(playNote(CYBERNETIC_ARM_NOTE), draw(1)),
    ),
  },
};

describe("registry", () => {
  it("registers every printed ref of the seven cards; nothing is skipped", () => {
    const printed = CODES.flatMap((code) => abilityRefIds(card(code)));
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(SKIPPED).toEqual({});
  });
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(REGISTRY[id]!)).toEqual([]);
  });
  it("timing words", () => {
    expect(REGISTRY[ARM]!.trigger).toMatchObject({ kind: "resource" });
    expect(REGISTRY[WIDOW]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[SAFE_HOUSE]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY[INFILTRATION]!.trigger).toMatchObject({ kind: "response", forced: false, form: "hero" });
    expect(REGISTRY[MASK]!.trigger).toMatchObject({ kind: "response", forced: false, form: "hero" });
    expect(REGISTRY[RIFLE]!.trigger).toMatchObject({ kind: "interrupt", forced: false, form: "hero" });
  });
  it("costs: the printed arrows", () => {
    expect(REGISTRY[ARM]!.cost).toEqual({ exhaustSelf: true });
    expect(REGISTRY[WIDOW]!.cost).toBeUndefined();
    expect(REGISTRY[SAFE_HOUSE]!.cost).toEqual({ exhaustSelf: true });
    expect(REGISTRY[INFILTRATION]!.cost).toEqual({ discardSelf: true });
    expect(REGISTRY[MASK]!.cost).toEqual({ exhaustSelf: true });
    expect(REGISTRY[RIFLE]!.cost).toEqual({ exhaustSelf: true });
  });
});

describe("printed data", () => {
  it("Cybernetic Arm: unique Item Tech upgrade, cost 1, [physical]", () => {
    const c = card<UpgradeCard>("54002");
    expect(c).toMatchObject({ type: "upgrade", cost: 1, unique: true, resourceIcons: { physical: 1 } });
    expect(c.traits).toEqual([trait("ITEM"), trait("TECH")]);
  });
  it("Black Widow: unique S.H.I.E.L.D. Spy ally, cost 3, ATK 2, THW 2, 3 hit points, consequential damage 1 and 1", () => {
    const c = card<AllyCard>("54003");
    expect(c).toMatchObject({ type: "ally", cost: 3, unique: true, atk: 2, thw: 2, hp: 3 });
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.resourceIcons).toEqual({ wild: 1 });
    expect(c.traits).toEqual([trait("S.H.I.E.L.D."), trait("SPY")]);
  });
  it("Safe House #30: unique Location S.H.I.E.L.D. support, cost 1, [mental]", () => {
    const c = card<SupportCard>("54007");
    expect(c).toMatchObject({ type: "support", cost: 1, unique: true, resourceIcons: { mental: 1 } });
    expect(c.traits).toEqual([trait("LOCATION"), trait("S.H.I.E.L.D.")]);
  });
  it("Silent Infiltration: Preparation upgrade, cost 2, [mental], two copies", () => {
    const c = card<UpgradeCard>("54008");
    expect(c).toMatchObject({ cost: 2, unique: false, deckLimit: 2, resourceIcons: { mental: 1 } });
    expect(c.traits).toEqual([trait("PREPARATION")]);
  });
  it("Winter Armor: unique Armor upgrade, cost 2, [physical]", () => {
    const c = card<UpgradeCard>("54009");
    expect(c).toMatchObject({ cost: 2, unique: true, resourceIcons: { physical: 1 } });
    expect(c.traits).toEqual([trait("ARMOR")]);
  });
  it("Winter Mask: unique Item Tech upgrade, cost 1, [mental]", () => {
    const c = card<UpgradeCard>("54010");
    expect(c).toMatchObject({ cost: 1, unique: true, resourceIcons: { mental: 1 } });
    expect(c.traits).toEqual([trait("ITEM"), trait("TECH")]);
  });
  it("Winter Rifle: unique Weapon upgrade, cost 3, [energy], Restricted (data)", () => {
    const c = card<UpgradeCard>("54011");
    expect(c).toMatchObject({ cost: 3, unique: true, resourceIcons: { energy: 1 } });
    expect(c.traits).toEqual([trait("WEAPON")]);
    expect(c.keywords).toEqual([{ name: "restricted" }]);
  });
});

describe("54002 Cybernetic Arm", () => {
  it("played from hand for 1: enters play faceup, ready, attached to the identity", () => {
    const { state: given, id } = inHand(wsHeroGame(), "54002");
    const pay = handOf(given).find((i) => i !== id)!;
    const { state } = run(given, firstLegal, play(P1, id, [pay]));
    expect(inst(state, id)).toMatchObject({ attachedTo: identityOf(state), faceup: true, exhausted: false });
    expect(inst(state, identityOf(state)).attachments).toContain(id);
    expect(discardOf(state)).toEqual([pay]);
  });
  it("pays for Haymaker (cost 2) with one hand card: the Arm is exhausted and the event deals 3 + 1 = 4", () => {
    const { state: armed, id: arm } = hero("54002");
    const { state: swapped, id: haymaker } = asCard(armed, HAYMAKER);
    const pay = handOf(swapped).find((i) => i !== haymaker)!;
    const { state } = run(swapped, planner(), play(P1, haymaker, [pay], { abilities: [viaArm(arm)] }));
    expect(inst(state, arm).exhausted).toBe(true);
    expect(damageOn(state, villainOf(state))).toBe(4);
    expect(discardOf(state)).toContain(haymaker);
    expect(discardOf(state)).toContain(pay);
  });
  it("without the Arm the same event deals 3", () => {
    const { state: swapped, id: haymaker } = asCard(wsHeroGame(), HAYMAKER);
    const pays = handOf(swapped)
      .filter((i) => i !== haymaker)
      .slice(0, 2);
    const { state } = run(swapped, planner(), play(P1, haymaker, pays));
    expect(damageOn(state, villainOf(state))).toBe(3);
  });
  it("the Arm alone is 1 resource: it does not pay for a cost-2 event", () => {
    const { state: armed, id: arm } = hero("54002");
    const { state: swapped, id: haymaker } = asCard(armed, HAYMAKER);
    expect(refusal(swapped, play(P1, haymaker, [], { abilities: [viaArm(arm)] }))).toBeDefined();
  });
  it("the bonus is on the event paid for, not the Arm: a basic attack after it deals plain damage", () => {
    const { state: armed, id: arm } = hero("54002");
    const { state: swapped, id: haymaker } = asCard(armed, HAYMAKER);
    const pay = handOf(swapped).find((i) => i !== haymaker)!;
    const played = run(swapped, planner(), play(P1, haymaker, [pay], { abilities: [viaArm(arm)] })).state;
    expect(damageOn(played, villainOf(played))).toBe(4);
    // The hero is still ready (an event does not exhaust him), so a basic attack goes on: ATK 2, no bonus.
    const after = run(played, planner(), basicAttack(played, villainOf(played))).state;
    expect(damageOn(after, villainOf(after))).toBe(6);
  });
  it("generates only for an Attack event: it cannot pay for a non-Attack event, an ally or an upgrade", () => {
    const { state: armed, id: arm } = hero("54002");
    const { state: defense, id: event } = asCard(armed, DEFENSE_EVENT);
    const pay = handOf(defense).filter((i) => i !== event);
    expect(refusal(defense, play(P1, event, [], { abilities: [viaArm(arm)] }))).toBeDefined();
    const { state: ally, id: widow } = inHand(armed, "54003");
    const pays = handOf(ally)
      .filter((i) => i !== widow)
      .slice(0, 2);
    expect(refusal(ally, play(P1, widow, pays, { abilities: [viaArm(arm)] }))).toBeDefined();
    const { state: up, id: mask } = inHand(armed, "54010");
    expect(refusal(up, play(P1, mask, [], { abilities: [viaArm(arm)] }))).toBeDefined();
    expect(pay.length).toBeGreaterThan(0);
  });
  it("exhausted, it pays for nothing", () => {
    const { state: armed, id: arm } = hero("54002");
    const tired = patchInstance(armed, arm, { exhausted: true });
    const { state: swapped, id: haymaker } = asCard(tired, HAYMAKER);
    const pay = handOf(swapped).find((i) => i !== haymaker)!;
    expect(refusal(swapped, play(P1, haymaker, [pay], { abilities: [viaArm(arm)] }))).toBeDefined();
  });
  it("it writes the note an event reads: a Haymaker that draws on the note draws exactly when the Arm paid", () => {
    const { state: armed, id: arm } = hero("54002");
    const { state: swapped, id: haymaker } = asCard(armed, HAYMAKER);
    const before = handOf(swapped).length;
    const pay = handOf(swapped).find((i) => i !== haymaker)!;
    const withArm = driveEventsPicking(
      NOTED_DEPS,
      swapped,
      planner(),
      play(P1, haymaker, [pay], { abilities: [viaArm(arm)] }),
    ).state;
    // The event and its payment leave the hand (2 cards) and the note draws 1.
    expect(handOf(withArm)).toHaveLength(before - 2 + 1);
    const pays = handOf(swapped)
      .filter((i) => i !== haymaker)
      .slice(0, 2);
    const without = driveEventsPicking(NOTED_DEPS, swapped, planner(), play(P1, haymaker, pays)).state;
    expect(handOf(without)).toHaveLength(before - 3);
  });
  it("the note and the damage are per play: a second Haymaker paid with cards only is plain", () => {
    const { state: armed, id: arm } = hero("54002");
    const { state: swapped, id: first } = asCard(armed, HAYMAKER);
    const { state: both, id: second } = asCard(swapped, HAYMAKER, [first]);
    const pay = handOf(both).find((i) => i !== first && i !== second)!;
    const one = driveEventsPicking(
      NOTED_DEPS,
      both,
      planner(),
      play(P1, first, [pay], { abilities: [viaArm(arm)] }),
    ).state;
    expect(damageOn(one, villainOf(one))).toBe(4);
    const pays = handOf(one)
      .filter((i) => i !== second)
      .slice(0, 2);
    const two = driveEventsPicking(NOTED_DEPS, one, planner(), play(P1, second, pays)).state;
    expect(damageOn(two, villainOf(two))).toBe(7);
  });
});

describe("54003 Black Widow", () => {
  /** Black Widow in hand, with `codes` put into the discard pile as the Attack events (or others) to return. */
  function widowReady(discard: readonly string[]): { state: GameState; widow: InstanceId; pile: InstanceId[] } {
    const { state: given, id: widow } = inHand(wsHeroGame(), "54003");
    const pile: InstanceId[] = [];
    let s = given;
    for (const code of discard) {
      const id = handOf(s).find((i) => i !== widow && !pile.includes(i))!;
      pile.push(id);
      s = patchInstance(s, id, { cardId: cardId(code) });
    }
    s = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((i) => !pile.includes(i)), discard: [...p.discard, ...pile] }
          : p,
      ),
    };
    return { state: s, widow, pile };
  }
  const playWidow = (s: GameState, widow: InstanceId, pick: Picker, keep: readonly InstanceId[] = []) =>
    run(
      s,
      pick,
      play(
        P1,
        widow,
        handOf(s)
          .filter((i) => i !== widow && !keep.includes(i))
          .slice(0, 3),
      ),
    );

  it("after she is played, an Attack event from the discard pile returns to the hand; the cost cards are discarded", () => {
    const { state, widow, pile } = widowReady([HAYMAKER]);
    const result = playWidow(state, widow, planner({ take: [WIDOW] })).state;
    expect(playerOf(result, P1).playArea).toContain(widow);
    expect(handOf(result)).toContain(pile[0]);
    expect(discardOf(result)).not.toContain(pile[0]);
    expect(discardOf(result)).toHaveLength(3);
  });
  it("she enters play with 0 damage, ready; she is an ally with 3 hit points", () => {
    const { state, widow } = widowReady([HAYMAKER]);
    const result = playWidow(state, widow, planner({ take: [WIDOW] })).state;
    expect(inst(result, widow)).toMatchObject({ damage: 0, exhausted: false, faceup: true });
    expect(maxHitPoints(result, widow, WS_DEPS)).toBe(3);
  });
  it("it is a response: declined, the event stays in the discard pile", () => {
    const { state, widow, pile } = widowReady([HAYMAKER]);
    const offered: string[] = [];
    const result = playWidow(state, widow, planner({ seen: offered })).state;
    expect(offered.filter((o) => o.endsWith(WIDOW))).toHaveLength(1);
    expect(discardOf(result)).toContain(pile[0]);
    expect(handOf(result)).not.toContain(pile[0]);
  });
  it("only an Attack event: a non-Attack event in the discard pile is not returned", () => {
    const { state, widow, pile } = widowReady([DEFENSE_EVENT]);
    const result = playWidow(state, widow, planner({ take: [WIDOW] })).state;
    expect(discardOf(result)).toContain(pile[0]);
    expect(handOf(result)).not.toContain(pile[0]);
    expect(result.pendingChoice).toBeNull();
  });
  it("one event only, of the player's choice, when two Attack events are in the discard pile", () => {
    const { state, widow, pile } = widowReady([HAYMAKER, HAYMAKER]);
    const result = playWidow(state, widow, planner({ take: [WIDOW], found: pile[1]! })).state;
    expect(handOf(result)).toContain(pile[1]);
    expect(handOf(result)).not.toContain(pile[0]);
    expect(discardOf(result)).toContain(pile[0]);
  });
  it("with no Attack event in the discard pile nothing happens and nothing is asked", () => {
    const { state, widow } = widowReady([]);
    const before = handOf(state).length;
    const result = playWidow(state, widow, planner({ take: [WIDOW] })).state;
    expect(result.pendingChoice).toBeNull();
    expect(handOf(result)).toHaveLength(before - 1 - 3);
  });
  it("an Attack event in the hand or the deck is not in the discard pile: only the discard pile is read", () => {
    const { state, widow } = widowReady([]);
    const { state: held, id: haymaker } = asCard(state, HAYMAKER, [widow]);
    const before = handOf(held).length;
    const result = playWidow(held, widow, planner({ take: [WIDOW] }), [haymaker]).state;
    expect(handOf(result)).toHaveLength(before - 1 - 3);
    expect(handOf(result)).toContain(haymaker);
  });
  it("put into play without playing her (surgery), the response never triggers", () => {
    const { state: staged } = widowReady([HAYMAKER]);
    const { state, id } = stagedInPlay(staged, "54003");
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(state.pendingChoice).toBeNull();
  });
  describe("as an ally", () => {
    function inPlay() {
      const { state, id } = stagedInPlay(withScheme(wsHeroGame(), 5), "54003");
      return { state, widow: id };
    }
    it("a basic attack with ATK 2 deals 2 damage and she takes consequential damage 1 (attack) and is exhausted", () => {
      const { state: s, widow } = inPlay();
      const staged = engageMinion(s, MERCENARY, "minion-1");
      const result = run(staged, planner(), basicAttack(staged, "minion-1" as InstanceId, widow)).state;
      expect(damageOn(result, "minion-1" as InstanceId)).toBe(2);
      expect(damageOn(result, widow)).toBe(1);
      expect(inst(result, widow).exhausted).toBe(true);
    });
    it("a basic thwart with THW 2 removes 2 threat and she takes consequential damage 1", () => {
      const { state, widow } = inPlay();
      const result = run(state, planner(), basicThwart(state, widow)).state;
      expect(inst(result, schemeOf(result)).threat).toBe(3);
      expect(damageOn(result, widow)).toBe(1);
    });
  });
});

describe("54007 Safe House #30", () => {
  /** Alter-ego form with the support in play and a minion of `code` on top of the encounter deck. */
  function house(minion: string | null = MERCENARY) {
    const base = wsGame();
    const { state: placed, id } = stagedInPlay(base, "54007");
    if (minion === null) return { state: placed, id, minion: null };
    const ids = placed.encounterDecks[activeEncounterDeckId(placed)]!.deck;
    const target = ids.find((i) => codeOf(placed, i) === minion);
    if (!target) throw new Error(`no ${minion} in the encounter deck`);
    return { state: placed, id, minion: target };
  }
  const withoutMinionsInDeck = (s: GameState): GameState => {
    const deckId = activeEncounterDeckId(s);
    const pile = s.encounterDecks[deckId]!;
    const minions = pile.deck.filter((i) => isMinion(s, i));
    return {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => !minions.includes(i)), discard: [...pile.discard, ...minions] },
      },
    };
  };
  const minionsInDeck = (s: GameState): InstanceId[] =>
    s.encounterDecks[activeEncounterDeckId(s)]!.deck.filter((i) => isMinion(s, i));

  it("an Alter-Ego Action: offered in alter-ego form, not in hero form", () => {
    const { state, id } = house();
    expect(canUse(state, SAFE_HOUSE)).toBe(true);
    const heroForm = { ...wsHeroGame() };
    const staged = stagedInPlay(heroForm, "54007");
    expect(canUse(staged.state, SAFE_HOUSE)).toBe(false);
    expect(id).toBeDefined();
  });
  it("searches the encounter deck for the minion the player picks and puts it into play engaged with him, then draws 1", () => {
    const { state, id, minion } = house(SANDMAN);
    const hand = handOf(state).length;
    const { state: result, events } = run(state, planner({ found: minion! }), use(P1, id, SAFE_HOUSE));
    expect(inst(result, minion!)).toMatchObject({ engagedWith: P1, faceup: true });
    expect(playerOf(result, P1).playArea).toContain(minion);
    expect(inst(result, id).exhausted).toBe(true);
    expect(handOf(result)).toHaveLength(hand + 1);
    expect(result.encounterDecks[activeEncounterDeckId(result)]!.deck).not.toContain(minion);
    expect(ofType(events, "deckShuffled").length).toBeGreaterThanOrEqual(1);
    expect(result.pendingChoice).toBeNull();
  });
  it("puts it into play, not reveals it: a When Revealed does not resolve (Shocker's 1 damage to each hero)", () => {
    const { state, id, minion } = house(SHOCKER);
    const { state: result } = run(state, planner({ found: minion! }), use(P1, id, SAFE_HOUSE));
    expect(inst(result, minion!).engagedWith).toBe(P1);
    expect(damageOn(result, identityOf(result))).toBe(0);
  });
  it("only the encounter deck, not its discard pile: a minion in the discard pile is not found", () => {
    const { state, id } = house(MERCENARY);
    const emptied = withoutMinionsInDeck(state);
    const discardMinions = emptied.encounterDecks[activeEncounterDeckId(emptied)]!.discard.filter((i) =>
      isMinion(emptied, i),
    );
    expect(discardMinions.length).toBeGreaterThan(0);
    const hand = handOf(emptied).length;
    const result = driveEventsPicking(WS_DEPS, emptied, planner(), use(P1, id, SAFE_HOUSE));
    expect(discardMinions.every((m) => inst(result.state, m).engagedWith === null)).toBe(true);
    expect(handOf(result.state).length).toBeLessThanOrEqual(hand);
  });
  it("it is a search: the encounter deck is shuffled when it completes", () => {
    const { state, id, minion } = house(MERCENARY);
    const { events } = run(state, planner({ found: minion! }), use(P1, id, SAFE_HOUSE));
    expect(ofType(events, "deckShuffled").length).toBeGreaterThanOrEqual(1);
  });
  it("compulsory: with a minion in the deck one is put into play (the first, when the player takes the default)", () => {
    const { state, id } = house(MERCENARY);
    const count = minionsInDeck(state).length;
    expect(count).toBeGreaterThan(0);
    const { state: result } = run(state, planner(), use(P1, id, SAFE_HOUSE));
    expect(minionsInDeck(result)).toHaveLength(count - 1);
  });
  it('"Then": with no minion in the deck the action is still offered and exhausts it, finds nothing and draws nothing', () => {
    const { state, id } = house(MERCENARY);
    const emptied = withoutMinionsInDeck(state);
    const hand = handOf(emptied).length;
    expect(canUse(emptied, SAFE_HOUSE)).toBe(true);
    const { state: result } = run(emptied, planner(), use(P1, id, SAFE_HOUSE));
    expect(inst(result, id).exhausted).toBe(true);
    expect(handOf(result)).toHaveLength(hand);
    expect(minionsInDeck(result)).toEqual([]);
  });
  it("exhausted, it cannot be used again", () => {
    const { state, id, minion } = house(MERCENARY);
    const { state: used } = run(state, planner({ found: minion! }), use(P1, id, SAFE_HOUSE));
    expect(refusal(used, use(P1, id, SAFE_HOUSE))).toBeDefined();
  });
  it("no resource is spent: the hand is the same size plus the drawn card", () => {
    const { state, id } = house(MERCENARY);
    const hand = handOf(state).length;
    const { state: result } = run(state, planner(), use(P1, id, SAFE_HOUSE));
    expect(handOf(result)).toHaveLength(hand + 1);
    expect(discardOf(result)).toHaveLength(discardOf(state).length);
  });
  it("played from hand for 1", () => {
    const { state: given, id } = inHand(wsGame(), "54007");
    const pay = handOf(given).find((i) => i !== id)!;
    const { state } = run(given, firstLegal, play(P1, id, [pay]));
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(inst(state, id).exhausted).toBe(false);
  });
});

describe("54008 Silent Infiltration", () => {
  /** Hero form, the upgrade on the hero, and a Hydra Bomber (2 hit points) engaged: ATK 2 defeats it. */
  function ready() {
    const { state, id } = hero("54008");
    return { state: engageMinion(state, BOMBER, "minion-1"), upgrade: id, minion: "minion-1" as InstanceId };
  }

  it("played from hand for 2: attached to the identity", () => {
    const { state: given, id } = inHand(wsHeroGame(), "54008");
    const pays = handOf(given)
      .filter((i) => i !== id)
      .slice(0, 2);
    const { state } = run(given, firstLegal, play(P1, id, pays));
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
  });
  it("after the hero's attack defeats an enemy: discard it, ready the hero (exhausted by the attack) and confuse an enemy", () => {
    const { state, upgrade, minion } = ready();
    const { state: result } = run(state, planner({ take: [INFILTRATION] }), basicAttack(state, minion));
    expect(codeOf(result, minion)).toBe(BOMBER);
    expect(playerOf(result, P1).playArea).not.toContain(minion);
    expect(discardOf(result)).toContain(upgrade);
    expect(inst(result, identityOf(result)).exhausted).toBe(false);
    expect(inst(result, villainOf(result)).statuses.confused).toBe(1);
  });
  it("the confused enemy is the player's choice among the enemies left", () => {
    const { state, minion } = ready();
    const other = engageMinion(state, MERCENARY, "minion-2");
    const other2 = "minion-2" as InstanceId;
    const { state: result } = run(other, planner({ take: [INFILTRATION], target: other2 }), basicAttack(other, minion));
    expect(inst(result, other2).statuses.confused).toBe(1);
    expect(inst(result, villainOf(result)).statuses.confused).toBe(0);
  });
  it("it is a response: declined, the hero stays exhausted, the upgrade stays and no enemy is confused", () => {
    const { state, upgrade, minion } = ready();
    const { state: result } = run(state, planner(), basicAttack(state, minion));
    expect(inst(result, identityOf(result)).exhausted).toBe(true);
    expect(inst(result, upgrade).attachedTo).toBe(identityOf(result));
    expect(inst(result, villainOf(result)).statuses.confused).toBe(0);
  });
  it("not offered when the attack does not defeat its target", () => {
    const { state } = hero("54008");
    const staged = engageMinion(state, MERCENARY, "minion-1");
    const offered: string[] = [];
    const { state: result } = run(
      staged,
      planner({ take: [INFILTRATION], seen: offered }),
      basicAttack(staged, "minion-1" as InstanceId),
    );
    expect(offered.filter((o) => o.endsWith(INFILTRATION))).toEqual([]);
    expect(inst(result, identityOf(result)).exhausted).toBe(true);
  });
  it("not offered for a thwart", () => {
    const { state } = hero("54008");
    const offered: string[] = [];
    run(withScheme(state, 5), planner({ seen: offered }), basicThwart(state, identityOf(state)));
    expect(offered.filter((o) => o.endsWith(INFILTRATION))).toEqual([]);
  });
  it('not offered when an ally\'s attack defeats the enemy ("you" is the hero)', () => {
    const { state, minion } = ready();
    const { state: withAlly, id: widow } = stagedInPlay(state, "54003");
    const offered: string[] = [];
    run(withAlly, planner({ seen: offered }), basicAttack(withAlly, minion, widow));
    expect(offered.filter((o) => o.endsWith(INFILTRATION))).toEqual([]);
  });
  it("answers an attack event too (Haymaker, 3 damage defeats the Bomber)", () => {
    const { state, minion } = ready();
    const { state: swapped, id: haymaker } = asCard(state, HAYMAKER);
    const pays = handOf(swapped)
      .filter((i) => i !== haymaker)
      .slice(0, 2);
    const offered: string[] = [];
    run(swapped, planner({ seen: offered, target: minion }), play(P1, haymaker, pays));
    expect(offered.filter((o) => o.endsWith(INFILTRATION))).toHaveLength(1);
  });
  it("two copies are both offered in one window", () => {
    const { state, minion } = ready();
    const { state: second } = stagedInPlay(state, "54008", { attach: true });
    const offered: string[] = [];
    run(second, planner({ seen: offered }), basicAttack(second, minion));
    expect(offered.filter((o) => o.endsWith(INFILTRATION))).toHaveLength(2);
  });
});

describe("54009 Winter Armor", () => {
  it("played from hand for 2: attached to the identity", () => {
    const { state: given, id } = inHand(wsHeroGame(), "54009");
    const pays = handOf(given)
      .filter((i) => i !== id)
      .slice(0, 2);
    const { state } = run(given, firstLegal, play(P1, id, pays));
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
  });
  it("+3 hit points: 11 to 14, in hero form and in alter-ego form; the base game is 11", () => {
    expect(maxHitPoints(wsHeroGame(), identityOf(wsHeroGame()), WS_DEPS)).toBe(11);
    const { state } = hero("54009");
    expect(maxHitPoints(state, identityOf(state), WS_DEPS)).toBe(14);
    const alter = stagedInPlay(wsGame(), "54009", { attach: true }).state;
    expect(maxHitPoints(alter, identityOf(alter), WS_DEPS)).toBe(14);
  });
  it("gains steady (the keyword; the second status card it allows is the engine's rule)", () => {
    const bare = wsHeroGame();
    expect(hasKeyword(bare, identityOf(bare), "steady", WS_DEPS)).toBe(false);
    const { state } = hero("54009");
    expect(hasKeyword(state, identityOf(state), "steady", WS_DEPS)).toBe(true);
    expect(hasKeyword(state, identityOf(state), "stalwart", WS_DEPS)).toBe(false);
  });
  it("13 damage on a 14-hit-point hero is not defeat", () => {
    const { state } = hero("54009");
    const hurt = patchInstance(state, identityOf(state), { damage: 13 });
    expect(hurt.outcome).toBeFalsy();
    expect(maxHitPoints(hurt, identityOf(hurt), WS_DEPS)).toBe(14);
  });
  it("the bonus ends with the card: discarded, he is back to 11 hit points", () => {
    const { state } = hero("54009");
    const armor = inst(state, identityOf(state)).attachments[0]!;
    const gone = patchInstance(
      { ...state, players: state.players.map((p) => (p.playerId === P1 ? { ...p, discard: [armor] } : p)) },
      identityOf(state),
      { attachments: [] },
    );
    expect(maxHitPoints(patchInstance(gone, armor, { attachedTo: null }), identityOf(gone), WS_DEPS)).toBe(11);
  });
});

describe("54010 Winter Mask", () => {
  const mask = (): { state: GameState; upgrade: InstanceId } => {
    const { state, id } = hero("54010");
    return { state: engageMinion(state, BOMBER, "minion-1"), upgrade: id };
  };
  const minion = "minion-1" as InstanceId;

  it("played from hand for 1: attached to the identity", () => {
    const { state: given, id } = inHand(wsHeroGame(), "54010");
    const pay = handOf(given).find((i) => i !== id)!;
    const { state } = run(given, firstLegal, play(P1, id, [pay]));
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
  });
  it("you gain the Spy trait (and keep S.H.I.E.L.D. and Soldier), in either form", () => {
    const bare = wsHeroGame();
    expect(traitsOf(bare, identityOf(bare), WS_DEPS)).not.toContain(trait("SPY"));
    const { state } = hero("54010");
    expect(traitsOf(state, identityOf(state), WS_DEPS)).toEqual(
      expect.arrayContaining([trait("SPY"), trait("S.H.I.E.L.D."), trait("SOLDIER")]),
    );
    const alter = stagedInPlay(wsGame(), "54010", { attach: true }).state;
    expect(traitsOf(alter, identityOf(alter), WS_DEPS)).toContain(trait("SPY"));
  });
  it("after the hero attacks and defeats an enemy: exhaust the Mask, draw 1", () => {
    const { state, upgrade } = mask();
    const hand = handOf(state).length;
    const { state: result } = run(state, planner({ take: [MASK] }), basicAttack(state, minion));
    expect(inst(result, upgrade).exhausted).toBe(true);
    expect(handOf(result)).toHaveLength(hand + 1);
    expect(inst(result, upgrade).attachedTo).toBe(identityOf(result));
  });
  it("optional: declined, no card is drawn and the Mask stays ready", () => {
    const { state, upgrade } = mask();
    const hand = handOf(state).length;
    const { state: result } = run(state, planner(), basicAttack(state, minion));
    expect(inst(result, upgrade).exhausted).toBe(false);
    expect(handOf(result)).toHaveLength(hand);
  });
  it("exhausted, it is not offered", () => {
    const { state, upgrade } = mask();
    const tired = patchInstance(state, upgrade, { exhausted: true });
    const offered: string[] = [];
    run(tired, planner({ seen: offered }), basicAttack(tired, minion));
    expect(offered.filter((o) => o.endsWith(MASK))).toEqual([]);
  });
  it("not offered when the attack does not defeat its target", () => {
    const { state } = hero("54010");
    const staged = engageMinion(state, MERCENARY, "minion-1");
    const offered: string[] = [];
    run(staged, planner({ seen: offered }), basicAttack(staged, minion));
    expect(offered.filter((o) => o.endsWith(MASK))).toEqual([]);
  });
  it("not offered for an ally's attack", () => {
    const { state } = mask();
    const { state: withAlly, id: widow } = stagedInPlay(state, "54003");
    const offered: string[] = [];
    run(withAlly, planner({ seen: offered }), basicAttack(withAlly, minion, widow));
    expect(offered.filter((o) => o.endsWith(MASK))).toEqual([]);
  });
  it("Spy is a trait of the hero: it is gained from the Mask only (handSize and stats untouched)", () => {
    const { state } = hero("54010");
    expect(handSize(state, P1, WS_DEPS)).toBe(5);
  });
});

describe("54011 Winter Rifle", () => {
  it("played from hand for 3: attached to the identity", () => {
    const { state: given, id } = inHand(wsHeroGame(), "54011");
    const pays = handOf(given)
      .filter((i) => i !== id)
      .slice(0, 3);
    const { state } = run(given, firstLegal, play(P1, id, pays));
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
    expect(state.pendingChoice).toBeNull();
  });
  it("on a basic attack: exhaust the Rifle, +2 ATK for this attack: 2 + 2 = 4 damage to the villain", () => {
    const { state, id } = hero("54011");
    const { state: result } = run(state, planner({ take: [RIFLE] }), basicAttack(state, villainOf(state)));
    expect(inst(result, id).exhausted).toBe(true);
    expect(damageOn(result, villainOf(result))).toBe(4);
  });
  it("optional: declined, the attack deals 2 and the Rifle stays ready", () => {
    const { state, id } = hero("54011");
    const { state: result } = run(state, planner(), basicAttack(state, villainOf(state)));
    expect(inst(result, id).exhausted).toBe(false);
    expect(damageOn(result, villainOf(result))).toBe(2);
  });
  it("only for this attack: the next basic attack (after readying) is back to ATK 2", () => {
    const { state, id } = hero("54011");
    const first = run(state, planner({ take: [RIFLE] }), basicAttack(state, villainOf(state))).state;
    const readied = patchInstance(patchInstance(first, id, { exhausted: false }), identityOf(first), {
      exhausted: false,
    });
    const second = run(readied, planner(), basicAttack(readied, villainOf(readied))).state;
    expect(damageOn(second, villainOf(second))).toBe(6);
  });
  it("the attack gains piercing: the villain's tough status card is discarded first and the 4 damage is dealt", () => {
    const { state } = hero("54011");
    const villain = villainOf(state);
    const tough = patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, tough: 1 } });
    const piercing = run(tough, planner({ take: [RIFLE] }), basicAttack(tough, villain)).state;
    expect(damageOn(piercing, villain)).toBe(4);
    expect(inst(piercing, villain).statuses.tough).toBe(0);
    const plain = run(tough, planner(), basicAttack(tough, villain)).state;
    expect(damageOn(plain, villain)).toBe(0);
    expect(inst(plain, villain).statuses.tough).toBe(0);
  });
  it("the attack gains ranged: Concussion Blasters' retaliate 1 on the villain does not hit him (without the Rifle it does)", () => {
    const { state } = hero("54011");
    const top = state.encounterDecks[activeEncounterDeckId(state)]!.deck[0]!;
    const { state: placed, id: blasters } = encounterCardInVillainArea(
      patchInstance(state, top, { cardId: cardId("01153") }),
      "01153",
    );
    const villain = villainOf(placed);
    const armed = patchInstance(patchInstance(placed, blasters, { attachedTo: villain }), villain, {
      attachments: [...inst(placed, villain).attachments, blasters],
    });
    const plain = run(armed, planner(), basicAttack(armed, villain)).state;
    expect(damageOn(plain, identityOf(plain))).toBeGreaterThan(0);
    const ranged = run(armed, planner({ take: [RIFLE] }), basicAttack(armed, villain)).state;
    expect(damageOn(ranged, identityOf(ranged))).toBe(0);
    expect(damageOn(ranged, villain)).toBe(4);
  });
  it("only a basic attack: Haymaker (an attack event) does not offer it", () => {
    const { state } = hero("54011");
    const { state: swapped, id: haymaker } = asCard(state, HAYMAKER);
    const pays = handOf(swapped)
      .filter((i) => i !== haymaker)
      .slice(0, 2);
    const offered: string[] = [];
    const { state: result } = run(swapped, planner({ seen: offered }), play(P1, haymaker, pays));
    expect(offered.filter((o) => o.endsWith(RIFLE))).toEqual([]);
    expect(damageOn(result, villainOf(result))).toBe(3);
  });
  it("only the hero: an ally's basic attack does not offer it", () => {
    const { state } = hero("54011");
    const { state: withAlly, id: widow } = stagedInPlay(state, "54003");
    const offered: string[] = [];
    const { state: result } = run(
      withAlly,
      planner({ seen: offered }),
      basicAttack(withAlly, villainOf(withAlly), widow),
    );
    expect(offered.filter((o) => o.endsWith(RIFLE))).toEqual([]);
    expect(damageOn(result, villainOf(result))).toBe(2);
  });
  it("exhausted, it is not offered", () => {
    const { state, id } = hero("54011");
    const tired = patchInstance(state, id, { exhausted: true });
    const offered: string[] = [];
    run(tired, planner({ seen: offered }), basicAttack(tired, villainOf(tired)));
    expect(offered.filter((o) => o.endsWith(RIFLE))).toEqual([]);
  });
  it("a thwart is not an attack: not offered", () => {
    const { state } = hero("54011");
    const offered: string[] = [];
    run(withScheme(state, 5), planner({ seen: offered }), basicThwart(state, identityOf(state)));
    expect(offered.filter((o) => o.endsWith(RIFLE))).toEqual([]);
  });
});
