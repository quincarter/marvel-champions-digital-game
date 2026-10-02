import { cardId } from "@mc/content";
import {
  activeVillain,
  characterProfile,
  hasKeyword,
  legalActions,
  traitsOf,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  answer,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
  endTurn,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { cyclopsGame } from "../../cyclops/cyclops/support.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { PHOENIX_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { phoenixGame } from "./support.js";

const REFS = [
  "34003.cyclops-response",
  "34003.cyclops-forced-interrupt",
  "34004.white-hot-room-action",
  "34005.phoenix-suit-constant",
  "34005.phoenix-suit-constant-2",
  "34005.phoenix-suit-constant-3",
  "34006.rise-from-the-ashes-interrupt",
  "34007.telekinetic-shield-forced-interrupt",
  "34008.mental-paralysis-constant",
  "34008.mental-paralysis-forced-response",
  "34009.mind-control-constant",
  "34014.banshee-response",
  "34015.marvel-girl-interrupt",
  "34016.mission-training-constant",
  "34021.storm-constant",
  "34021.storm-interrupt",
  "34022.cerebro-action",
  "34024.down-time-constant",
];

const jean = (): GameState => stocked(phoenixGame());
const phoenix = (): GameState => withForm(jean(), { heroForm: 0 });
const heroId = (state: GameState) => identityOf(state, P1);
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
const forceOf = (state: GameState): InstanceId => instancesOf(state, "34002a")[0]!;
const powerOf = (state: GameState): number => inst(state, forceOf(state)).counters.power ?? 0;
const withPower = (state: GameState, n: number): GameState =>
  patchInstance(state, forceOf(state), { counters: { power: n } });
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;
const traitNames = (state: GameState, id: InstanceId) => traitsOf(state, id, WAVE6_DEPS).map(String);

/** Gives P1's hand `n` more cards from the deck so cards of any cost can be paid for. */
function stocked(state: GameState, n = 8): GameState {
  const owner = playerOf(state, P1);
  const take = owner.deck.slice(0, n);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [...p.hand, ...take], deck: p.deck.slice(n) } : p,
    ),
  };
}

/** Takes the card out of the hand and attaches it to `host` by surgery (no play, no cost). */
function attachFromHand(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
}

/** Makes an instance another card by surgery, keeping its zone. */
const swapCard = (state: GameState, id: InstanceId, code: string): GameState => {
  if (!state.cardPool[cardId(code)]) throw new Error(`${code} is not in the card pool`);
  return patchInstance(state, id, { cardId: cardId(code) });
};

/** Whether playing `card` attached to `host` is a legal target of a legal play. */
const canAttach = (state: GameState, card: InstanceId, host: InstanceId): boolean => {
  const actions = legalActions(state, P1, WAVE6_DEPS);
  if (actions.kind !== "turn") return false;
  return actions.legal.some(
    (a) => a.action.kind === "playCard" && a.action.instanceId === card && (a.targets ?? []).includes(host),
  );
};

/** Accepts the offered optional trigger whose id ends with one of `wanted` (or picks that instance), else firstLegal. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`) || state.instances[id]?.cardId === w));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Picks the option with this label in a `chooseOne` prompt, accepting nothing else. */
const choosingLabel =
  (label: string): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => o.label === label);
    return hit ? [hit.optionId] : firstLegal(state);
  };

const withMinion = (base: GameState, code = "01101"): { state: GameState; minion: InstanceId } => {
  const { state, id } = engageMinion(base, "01101", P1);
  return { state: code === "01101" ? state : swapCard(state, id, code), minion: id };
};

/** Plays `code` from hand attached to `host`, paying with other hand cards. */
function playAttached(state: GameState, code: string, cost: number, host: InstanceId): GameState {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const [id] = ids as [InstanceId];
  return settle(
    runWith(WAVE6_DEPS, staged, play(P1, id, payWith(staged, P1, cost, [id]), { attachToInstanceId: host })),
    firstLegal,
    undefined,
    WAVE6_DEPS,
  );
}

/** The threat on the main scheme set to `n`, so a thwart or a removal has something to take. */
const withMainThreat = (state: GameState, n: number): GameState =>
  patchInstance(state, state.mainScheme.instanceId, { threat: n });

/** Stops at the second `declareDefender` prompt of the villain phase (the villain phase attacks twice here), so only one attack is read. */
const throughFirstAttack = (state: GameState, pick: Picker = firstLegal): GameState =>
  settle(state, pick, (s) => s.pendingChoice?.prompt.kind === "declareDefender", WAVE6_DEPS);

/** Drives the villain phase to the first `declareDefender` prompt (Rhino's attack on the identity). */
const toDeclareDefender = (state: GameState): GameState =>
  settle(
    runWith(WAVE6_DEPS, state, endTurn()),
    firstLegal,
    (s) => s.pendingChoice?.prompt.kind === "declareDefender",
    WAVE6_DEPS,
  );

const basicAttack = (state: GameState, attacker: InstanceId, target: InstanceId) =>
  ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: attacker,
    targetInstanceId: target,
  }) as never;
const basicThwart = (thwarter: InstanceId, scheme: InstanceId) =>
  ({ type: "basicThwart", playerId: P1, thwarterInstanceId: thwarter, schemeInstanceId: scheme }) as never;

describe("Phoenix supports, upgrades and allies", () => {
  it("registers exactly the refs the card data names for them, all valid", () => {
    expect(Object.keys(PHOENIX_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...REFS].sort());
    for (const definition of Object.values(PHOENIX_SUPPORT_UPGRADES_ALLIES)) {
      expect(validateDefinition(definition)).toEqual([]);
    }
  });

  describe("Cyclops (34003)", () => {
    it("34003.cyclops-response: after he enters play, places 2 power counters on Phoenix Force", () => {
      const base = phoenix();
      expect(powerOf(base)).toBe(4);
      const { state } = playFromHand(WAVE6_DEPS, base, "34003", 3, accepting("34003.cyclops-response"));
      expect(powerOf(state)).toBe(6);
    });

    it("34003.cyclops-forced-interrupt: when he leaves play, removes 2 power counters", () => {
      const { state: inPlay, id: cyclops } = playFromHand(
        WAVE6_DEPS,
        phoenix(),
        "34003",
        3,
        accepting("34003.cyclops-response"),
      );
      const { state: foe, minion } = withMinion(patchInstance(inPlay, instancesOf(inPlay, "34003")[0]!, { damage: 2 }));
      // His own attack's consequential damage (1) defeats him at 2 damage of 3.
      const after = settle(
        runWith(WAVE6_DEPS, foe, basicAttack(foe, cyclops, minion)),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(playerOf(after, P1).discard).toContain(cyclops);
      expect(powerOf(after)).toBe(4);
    });

    it("34003.cyclops-forced-interrupt: with 1 counter left it removes that one, and the last removal flips Phoenix Force", () => {
      const { state: inPlay, id: cyclops } = playFromHand(
        WAVE6_DEPS,
        phoenix(),
        "34003",
        3,
        accepting("34003.cyclops-response"),
      );
      const staged = withPower(patchInstance(inPlay, cyclops, { damage: 2 }), 1);
      const { state: foe, minion } = withMinion(staged);
      const after = settle(
        runWith(WAVE6_DEPS, foe, basicAttack(foe, cyclops, minion)),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(powerOf(after)).toBe(0);
      expect(inst(after, forceOf(after)).flipped).toBe(true);
    });
  });

  describe("White Hot Room (34004)", () => {
    const PLACE = "Place 1 power counter on Phoenix Force";
    const HEAL = "Heal 2 damage from Jean Grey";
    const staged = (): { state: GameState; room: InstanceId } => {
      const { state, id } = playFromHand(WAVE6_DEPS, jean(), "34004", 2);
      return { state: patchInstance(state, heroId(state), { damage: 3 }), room: id };
    };

    it("34004.white-hot-room-action: exhausts to place 1 power counter on Phoenix Force", () => {
      const { state, room } = staged();
      const after = settle(
        runWith(WAVE6_DEPS, state, use(P1, room, "34004.white-hot-room-action")),
        choosingLabel(PLACE),
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, room).exhausted).toBe(true);
      expect(powerOf(after)).toBe(powerOf(state) + 1);
      expect(inst(after, heroId(after)).damage).toBe(3);
    });

    it("34004.white-hot-room-action: or heals 2 damage from Jean Grey, placing no counter", () => {
      const { state, room } = staged();
      const after = settle(
        runWith(WAVE6_DEPS, state, use(P1, room, "34004.white-hot-room-action")),
        choosingLabel(HEAL),
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, heroId(after)).damage).toBe(1);
      expect(powerOf(after)).toBe(powerOf(state));
    });

    it("is an Alter-Ego action: not offered in hero form, nor while exhausted", () => {
      const { state, room } = staged();
      const usable = (s: GameState) => {
        const a = legalActions(s, P1, WAVE6_DEPS);
        return (
          a.kind === "turn" &&
          a.legal.some((l) => l.action.kind === "useAbility" && l.action.abilityId === "34004.white-hot-room-action")
        );
      };
      expect(usable(state)).toBe(true);
      expect(usable(withForm(state, { heroForm: 0 }))).toBe(false);
      expect(usable(patchInstance(state, room, { exhausted: true }))).toBe(false);
    });
  });

  describe("Phoenix Suit (34005)", () => {
    it("34005.phoenix-suit-constant: Phoenix gains AERIAL, but Jean Grey (alter-ego) does not", () => {
      const { state: asHero } = attachFromHand(phoenix(), "34005", heroId(phoenix()));
      expect(traitNames(asHero, heroId(asHero))).toContain("AERIAL");
      const base = jean();
      const { state: asJean } = attachFromHand(base, "34005", heroId(base));
      expect(traitNames(asJean, heroId(asJean))).not.toContain("AERIAL");
    });

    it("34005.phoenix-suit-constant-2: gains steady while RESTRAINED, not once UNLEASHED", () => {
      const base = phoenix();
      const { state: suited } = attachFromHand(base, "34005", heroId(base));
      expect(traitNames(suited, heroId(suited))).toContain("RESTRAINED");
      expect(hasKeyword(suited, heroId(suited), "steady", WAVE6_DEPS)).toBe(true);
      const unleashed = patchInstance(suited, forceOf(suited), { flipped: true });
      expect(hasKeyword(unleashed, heroId(unleashed), "steady", WAVE6_DEPS)).toBe(false);
    });

    it("34005.phoenix-suit-constant-3: gains retaliate 1 while UNLEASHED, not while RESTRAINED", () => {
      const base = phoenix();
      const { state: suited } = attachFromHand(base, "34005", heroId(base));
      expect(hasKeyword(suited, heroId(suited), "retaliate", WAVE6_DEPS)).toBe(false);
      const unleashed = patchInstance(suited, forceOf(suited), { flipped: true });
      expect(traitNames(unleashed, heroId(unleashed))).toContain("UNLEASHED");
      expect(hasKeyword(unleashed, heroId(unleashed), "retaliate", WAVE6_DEPS)).toBe(true);
    });
  });

  describe("Rise from the Ashes (34006)", () => {
    /** Phoenix at 1 hit point from lethal, Rise attached, undefended against Rhino's attack. */
    function doomed() {
      const base = phoenix();
      const { state: armed, id: rise } = attachFromHand(base, "34006", heroId(base));
      const max = profile(armed, heroId(armed)).maxHp;
      const near = patchInstance(armed, heroId(armed), { damage: max - 1, exhausted: true });
      const offered = answer(toDeclareDefender(near), ["decline"], WAVE6_DEPS);
      return { offered, rise, max };
    }

    it("34006.rise-from-the-ashes-interrupt: removes itself from the game, readies, restores hit points and clears every power counter", () => {
      const { offered, rise, max } = doomed();
      expect(
        offered.pendingChoice?.options.some((o) => o.optionId.endsWith(":34006.rise-from-the-ashes-interrupt")),
      ).toBe(true);
      const after = throughFirstAttack(offered, accepting("34006.rise-from-the-ashes-interrupt"));
      expect(inst(after, heroId(after)).damage).toBe(0);
      expect(max).toBeGreaterThan(1);
      expect(inst(after, heroId(after)).exhausted).toBe(false);
      expect(playerOf(after, P1).discard).not.toContain(rise);
      expect(playerOf(after, P1).playArea).not.toContain(rise);
      expect(inst(after, heroId(after)).attachments).not.toContain(rise);
      expect(powerOf(after)).toBe(0);
      // Q24: removing the last counter flips Phoenix Force (Restrained's forced response).
      expect(inst(after, forceOf(after)).flipped).toBe(true);
      expect(after.outcome).toBeFalsy();
    });

    it("declining it lets the identity be defeated: Rise stays and the counters are untouched", () => {
      const { offered } = doomed();
      const after = settle(offered, () => [], undefined, WAVE6_DEPS);
      expect(powerOf(after)).toBe(4);
      expect(after.outcome).toBeTruthy();
    });
  });

  describe("Telekinetic Shield (34007)", () => {
    it("34007.telekinetic-shield-forced-interrupt: an enemy attack's damage is placed on it instead of the host", () => {
      const base = phoenix();
      const { state: armed, id: shield } = attachFromHand(base, "34007", heroId(base));
      const offered = answer(toDeclareDefender(armed), ["decline"], WAVE6_DEPS);
      const after = throughFirstAttack(offered);
      expect(inst(after, heroId(after)).damage).toBe(0);
      expect(inst(after, shield).damage).toBeGreaterThan(0);
    });

    it("discards itself once it holds 5 damage, and the hit that brings it to 5 is still absorbed in full", () => {
      const base = phoenix();
      const { state: armed, id: shield } = attachFromHand(base, "34007", heroId(base));
      const loaded = patchInstance(armed, shield, { damage: 4 });
      const offered = answer(toDeclareDefender(loaded), ["decline"], WAVE6_DEPS);
      const after = throughFirstAttack(offered);
      expect(playerOf(after, P1).discard).toContain(shield);
      expect(inst(after, heroId(after)).damage).toBe(0);
    });

    it("stays attached below 5 damage, absorbing the attack so the host takes none", () => {
      const base = phoenix();
      const { state: armed, id: shield } = attachFromHand(base, "34007", heroId(base));
      const loaded = patchInstance(armed, shield, { damage: 1 });
      const offered = answer(toDeclareDefender(loaded), ["decline"], WAVE6_DEPS);
      const after = throughFirstAttack(offered);
      const atk = inst(after, shield).damage - 1;
      expect(atk).toBeGreaterThan(0);
      expect(inst(after, shield).damage).toBeLessThan(5);
      expect(inst(after, shield).attachedTo).toBe(heroId(after));
      expect(inst(after, heroId(after)).damage).toBe(0);
    });
  });

  describe("Mental Paralysis (34008)", () => {
    const activations = (events: readonly GameEvent[], minion: InstanceId) =>
      events.filter((e) => e.type === "enemyActivated" && e.enemyInstanceId === minion).length;
    const villainPhase = (state: GameState) => driveEventsPicking(WAVE6_DEPS, state, firstLegal, endTurn());

    it("34008.mental-paralysis-constant: the attached minion does not activate, while an unmarked minion does", () => {
      const { state: base, minion } = withMinion(phoenix());
      const { state: other, minion: second } = withMinion(base);
      const { state: armed } = attachFromHand(other, "34008", minion);
      const { events } = villainPhase(armed);
      expect(activations(events, minion)).toBe(0);
      expect(activations(events, second)).toBeGreaterThan(0);
      expect(activations(villainPhase(other).events, minion)).toBeGreaterThan(0);
    });

    it("is played in hero form only, on a non-ELITE minion", () => {
      const { state: base } = withMinion(phoenix());
      const { state: staged, ids } = moveToHand(base, P1, "34008");
      const [card] = ids as [InstanceId];
      const [minion] = base.players[0]!.playArea.filter((id) => codeOf(base, id) === "01101");
      expect(canAttach(staged, card, minion!)).toBe(true);
      const elite = swapCard(staged, minion!, "01102"); // Sandman, ELITE
      expect(canAttach(elite, card, minion!)).toBe(false);
      const { state: asJean, ids: ids2 } = moveToHand(withForm(staged, "alterEgo"), P1, "34008");
      expect(canAttach(asJean, ids2[0]!, minion!)).toBe(false);
    });

    it("34008.mental-paralysis-forced-response: is discarded after you flip to alter-ego form", () => {
      const { state: base, minion } = withMinion(phoenix());
      const { state: armed, id: card } = attachFromHand(base, "34008", minion);
      const after = settle(
        runWith(WAVE6_DEPS, armed, { type: "changeForm", playerId: P1 } as never),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(playerOf(after, P1).identity.form).toBe("alterEgo");
      expect(playerOf(after, P1).discard).toContain(card);
      expect(inst(after, minion).attachments).not.toContain(card);
    });

    it("is not discarded when you flip to hero form (it only matters in alter-ego form)", () => {
      const { state: base, minion } = withMinion(phoenix());
      const { state: armed, id: card } = attachFromHand(base, "34008", minion);
      const toJean = settle(
        runWith(WAVE6_DEPS, withForm(armed, "alterEgo"), toHero()),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(toJean, minion).attachments).toContain(card);
    });
  });

  describe("Mind Control (34009)", () => {
    it("34009.mind-control-constant: the minion becomes a CONTROLLED ally with THW equal to its printed SCH", () => {
      const { state: base, minion } = withMinion(phoenix(), "01172"); // Whiplash, SCH 2
      const armed = playAttached(base, "34009", 4, minion);
      expect(traitNames(armed, minion)).toContain("CONTROLLED");
      expect(profile(armed, minion).thw).toBe(2);
      expect(inst(armed, minion).engagedWith ?? null).toBe(null);
      expect(playerOf(armed, P1).playArea).toContain(minion);
    });

    it("takes 1 consequential damage after it thwarts, and a SCH 0 minion gets 0 THW", () => {
      const { state: base, minion } = withMinion(phoenix(), "01172");
      const armed = playAttached(base, "34009", 4, minion);
      const withScheme = encounterCardInVillainArea(armed, "01107", 5);
      const after = settle(
        runWith(WAVE6_DEPS, withScheme.state, basicThwart(minion, withScheme.id)),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, withScheme.id).threat).toBe(3);
      expect(inst(after, minion).damage).toBe(1);
      const { state: zero, minion: merc } = withMinion(phoenix(), "01101");
      const armedZero = playAttached(zero, "34009", 4, merc);
      expect(profile(armedZero, merc).thw).toBe(0);
    });

    it("is only played on a non-ELITE minion", () => {
      const { state: base, minion } = withMinion(phoenix());
      const { state: staged, ids } = moveToHand(base, P1, "34009");
      expect(canAttach(staged, ids[0]!, minion)).toBe(true);
      expect(canAttach(swapCard(staged, minion, "01102"), ids[0]!, minion)).toBe(false);
    });
  });

  describe("Banshee (34014)", () => {
    it("34014.banshee-response: after Banshee thwarts, confuses a minion", () => {
      const { state: inPlay, id: banshee } = playFromHand(WAVE6_DEPS, phoenix(), "34014", 4);
      const { state: foe, minion } = withMinion(withMainThreat(inPlay, 5));
      expect(inst(foe, minion).statuses.confused).toBe(0);
      const after = settle(
        runWith(WAVE6_DEPS, foe, basicThwart(banshee, foe.mainScheme.instanceId)),
        accepting("34014.banshee-response", minion),
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, minion).statuses.confused).toBe(1);
    });

    it("does nothing when there is no minion to confuse", () => {
      const { state: inPlay, id: banshee } = playFromHand(WAVE6_DEPS, phoenix(), "34014", 4);
      const after = settle(
        runWith(WAVE6_DEPS, withMainThreat(inPlay, 5), basicThwart(banshee, inPlay.mainScheme.instanceId)),
        accepting("34014.banshee-response"),
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, banshee).exhausted).toBe(true);
      expect(inst(after, inPlay.mainScheme.instanceId).threat).toBe(3);
      expect(after.pendingChoice).toBeFalsy();
    });
  });

  describe("Marvel Girl (34015)", () => {
    const attackOn = (code: string) => {
      const { state: inPlay, id: girl } = playFromHand(WAVE6_DEPS, phoenix(), "34015", 3);
      const { state: foe, minion } = withMinion(withMainThreat(inPlay, 6), code);
      const swapped = foe;
      const before = mainThreat(swapped);
      const after = settle(
        runWith(WAVE6_DEPS, swapped, basicAttack(swapped, girl, minion)),
        accepting("34015.marvel-girl-interrupt"),
        undefined,
        WAVE6_DEPS,
      );
      return { before, after };
    };

    it("34015.marvel-girl-interrupt: removes X threat from the main scheme, X the attacked minion's printed SCH", () => {
      const { before, after } = attackOn("01172"); // Whiplash, SCH 2
      expect(mainThreat(after)).toBe(before - 2);
    });

    it("removes nothing for a minion with printed SCH 0 (Hydra Mercenary)", () => {
      const { before, after } = attackOn("01101");
      expect(mainThreat(after)).toBe(before);
    });

    it("does not trigger when she attacks the villain", () => {
      const { state: inPlay, id: girl } = playFromHand(WAVE6_DEPS, phoenix(), "34015", 3);
      const staged = withMainThreat(inPlay, 6);
      const before = mainThreat(staged);
      const villain = activeVillain(staged).instanceId;
      const after = settle(
        runWith(WAVE6_DEPS, staged, basicAttack(staged, girl, villain)),
        accepting("34015.marvel-girl-interrupt"),
        undefined,
        WAVE6_DEPS,
      );
      expect(mainThreat(after)).toBe(before);
    });
  });

  describe("Mission Training (34016)", () => {
    it("34016.mission-training-constant: the attached ally gets +1 THW and +2 hit points, and nobody else does", () => {
      const { state: withAlly, id: cyclops } = playFromHand(WAVE6_DEPS, phoenix(), "34003", 3);
      const before = profile(withAlly, cyclops);
      const { state: armed } = attachFromHand(withAlly, "34016", cyclops);
      const now = profile(armed, cyclops);
      expect([now.thw, now.maxHp, now.atk]).toEqual([before.thw + 1, before.maxHp + 2, before.atk]);
      expect(profile(armed, heroId(armed)).thw).toBe(profile(withAlly, heroId(withAlly)).thw);
    });

    it("attaches only to an X-MEN ally, at most 1 TRAINING upgrade per ally", () => {
      const { state: withAlly, id: cyclops } = playFromHand(WAVE6_DEPS, phoenix(), "34003", 3);
      const { state: staged, ids } = moveToHand(withAlly, P1, "34016", "34016");
      const [first, second] = ids as [InstanceId, InstanceId];
      expect(canAttach(staged, first, cyclops)).toBe(true);
      expect(canAttach(staged, first, heroId(staged))).toBe(false);
      const { state: trained } = attachFromHand(withAlly, "34016", cyclops);
      const { state: again, ids: ids2 } = moveToHand(trained, P1, "34016");
      expect(canAttach(again, ids2[0]!, cyclops)).toBe(false);
      void second;
      const plain = swapCard(staged, cyclops, "01084"); // an ally without X-MEN
      expect(canAttach(plain, first, cyclops)).toBe(false);
    });
  });

  describe("Storm (34021)", () => {
    it("34021.storm-constant: costs 1 less with a MUTANT or X-MEN identity (Jean Grey, Phoenix), so 4 resources play her", () => {
      for (const state of [jean(), phoenix()]) {
        const { state: after, id } = playFromHand(WAVE6_DEPS, state, "34021", 4);
        expect(playerOf(after, P1).playArea).toContain(id);
      }
    });

    it("is not discounted below that: paying 3 does not play her", () => {
      expect(() => playFromHand(WAVE6_DEPS, phoenix(), "34021", 3)).toThrow();
    });

    it("34021.storm-interrupt: when she thwarts a scheme, moves 2 threat from it to another scheme before the thwart", () => {
      const { state: inPlay, id: storm } = playFromHand(WAVE6_DEPS, phoenix(), "34021", 4);
      const { state: staged, id: side } = encounterCardInVillainArea(inPlay, "01107", 5);
      const main = staged.mainScheme.instanceId;
      const mainBefore = inst(staged, main).threat;
      const stormThw = profile(staged, storm).thw;
      const after = settle(
        runWith(WAVE6_DEPS, staged, basicThwart(storm, side)),
        accepting("34021.storm-interrupt", main),
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, main).threat).toBe(mainBefore + 2);
      expect(inst(after, side).threat).toBe(5 - 2 - stormThw);
    });

    it("never offers the thwarted scheme as the other scheme", () => {
      const { state: inPlay, id: storm } = playFromHand(WAVE6_DEPS, phoenix(), "34021", 4);
      const { state: staged, id: side } = encounterCardInVillainArea(inPlay, "01107", 5);
      const atTarget = settle(
        runWith(WAVE6_DEPS, staged, basicThwart(storm, side)),
        accepting("34021.storm-interrupt"),
        (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
        WAVE6_DEPS,
      );
      const offered = atTarget.pendingChoice?.options.map((o) => o.optionId) ?? [];
      expect(offered).toContain(staged.mainScheme.instanceId);
      expect(offered).not.toContain(side);
    });
  });

  describe("Cerebro (34022)", () => {
    /** Cyclops (MUTANT alter-ego, no PSIONIC) with Cerebro in play and an X-MEN ally (Angel) at deck position `at`. */
    function cerebroGame(at: number) {
      let state = stocked(cyclopsGame(), 9);
      const [hand] = playerOf(state, P1).hand;
      state = swapCard(state, hand!, "34022");
      const deck = playerOf(state, P1).deck;
      // Scrub the deck of X-MEN allies, then put one in `at`.
      for (const id of deck) {
        if (["33019", "33013", "33012", "33011", "34003", "34014", "34015", "34021"].includes(codeOf(state, id))) {
          state = swapCard(state, id, "01084");
        }
      }
      state = swapCard(state, playerOf(state, P1).deck[at]!, "33019");
      const played = settle(
        runWith(WAVE6_DEPS, state, {
          type: "playCard",
          playerId: P1,
          cardInstanceId: hand!,
          payment: [{ fromHand: playerOf(state, P1).hand[1]! }],
          attachToInstanceId: null,
        } as never),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      return { state: played, cerebro: hand! };
    }
    const search = (state: GameState, cerebro: InstanceId) =>
      settle(
        runWith(WAVE6_DEPS, state, use(P1, cerebro, "34022.cerebro-action")),
        accepting("33019"),
        undefined,
        WAVE6_DEPS,
      );
    const handCodes = (state: GameState) => playerOf(state, P1).hand.map((id) => codeOf(state, id));

    it("34022.cerebro-action: finds an X-MEN ally in the top 5 cards and adds it to your hand", () => {
      const { state, cerebro } = cerebroGame(2);
      const after = search(state, cerebro);
      expect(handCodes(after)).toContain("33019");
      expect(inst(after, cerebro).exhausted).toBe(true);
    });

    it("searches only the top 5 cards without a PSIONIC character: an X-MEN ally deeper is not found", () => {
      const { state, cerebro } = cerebroGame(8);
      const after = search(state, cerebro);
      expect(handCodes(after)).not.toContain("33019");
      expect(inst(after, cerebro).exhausted).toBe(true);
    });

    it("searches the whole deck if you control a PSIONIC character (Marvel Girl)", () => {
      const { state, cerebro } = cerebroGame(8);
      const girlDeck = swapCard(state, playerOf(state, P1).deck[0]!, "34015");
      const { state: withGirl } = playFromHand(WAVE6_DEPS, girlDeck, "34015", 3);
      const after = search(withGirl, cerebro);
      expect(handCodes(after)).toContain("33019");
    });

    it("can only be played if your identity has MUTANT: Jean Grey (MUTANT) yes; Phoenix (hero) no", () => {
      const playable = (state: GameState) => {
        const { state: staged, ids } = moveToHand(state, P1, "34022");
        const actions = legalActions(staged, P1, WAVE6_DEPS);
        return (
          actions.kind === "turn" &&
          actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === ids[0])
        );
      };
      expect(playable(jean())).toBe(true);
      expect(playable(phoenix())).toBe(false);
    });

    it("is an Alter-Ego action: Phoenix whole-deck search runs as Jean Grey (PSIONIC) with an X-MEN ally deep in the deck", () => {
      const base = jean();
      const { state: withCerebro, id: cerebro } = playFromHand(WAVE6_DEPS, base, "34022", 1);
      const state = swapCard(withCerebro, playerOf(withCerebro, P1).deck[20]!, "34003");
      const after = search2(state, cerebro);
      expect(playerOf(after, P1).hand.map((id) => codeOf(after, id))).toContain("34003");
    });
  });

  describe("Down Time (34024)", () => {
    it("34024.down-time-constant: your alter-ego gets +2 REC, only while in alter-ego form", () => {
      const base = jean();
      const rec = profile(base, heroId(base)).rec;
      const { state: armed } = attachFromHand(base, "34024", heroId(base));
      expect(profile(armed, heroId(armed)).rec).toBe(rec + 2);
      const asHero = withForm(armed, { heroForm: 0 });
      expect(profile(asHero, heroId(asHero)).rec).toBe(profile(withForm(base, { heroForm: 0 }), heroId(base)).rec);
    });
  });
});

function search2(state: GameState, cerebro: InstanceId): GameState {
  return settle(
    runWith(WAVE6_DEPS, state, use(P1, cerebro, "34022.cerebro-action")),
    (s) => {
      const choice = s.pendingChoice;
      const hit = choice?.options.find((o) => s.instances[o.optionId]?.cardId === cardId("34003"));
      return hit ? [hit.optionId] : firstLegal(s);
    },
    undefined,
    WAVE6_DEPS,
  );
}
