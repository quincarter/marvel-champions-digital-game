import { cardId } from "@mc/content";
import { characterProfile, hasKeyword, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  answer,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  endTurn,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { moveToDiscard, playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { WOLVERINE_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { wolverineGame } from "./support.js";

const REFS = [
  "35003.jubilee-response",
  "35004.adamantium-skeleton-constant",
  "35004.adamantium-skeleton-constant-2",
  "35005.berserker-frenzy-response",
  "35005.berserker-frenzy-forced-response",
  "35006.i-got-better-interrupt",
  "35007.logans-cabin-action",
  "35016.warrior-skill-interrupt",
];

const logan = (): GameState => wolverineGame();
const wolverine = (): GameState => withForm(logan(), { heroForm: 0 });
const heroId = (state: GameState) => identityOf(state, P1);
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;

/** Takes the card out of the hand and attaches it to `host` by surgery (no play, no cost). */
function attach(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
}

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

const toDeclareDefender = (state: GameState): GameState =>
  settle(
    runWith(WAVE6_DEPS, state, endTurn()),
    firstLegal,
    (s) => s.pendingChoice?.prompt.kind === "declareDefender",
    WAVE6_DEPS,
  );
const throughFirstAttack = (state: GameState, pick: Picker = firstLegal): GameState =>
  settle(state, pick, (s) => s.pendingChoice?.prompt.kind === "declareDefender", WAVE6_DEPS);

const basicAttack = (attacker: InstanceId, target: InstanceId) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }) as never;

/** A minion engaged with P1 with room for plenty of damage. */
const withMinion = (base: GameState): { state: GameState; minion: InstanceId } => {
  const { state, id } = engageMinion(base, "01101", P1);
  // Whiplash (more hit points than Wolverine's ATK) so a hit never defeats it.
  return { state: patchInstance(state, id, { cardId: cardId("01172") }), minion: id };
};
const attackOnce = (state: GameState, minion: InstanceId): GameState =>
  settle(runWith(WAVE6_DEPS, state, basicAttack(heroId(state), minion)), firstLegal, undefined, WAVE6_DEPS);

describe("Wolverine supports, upgrades and allies", () => {
  it("registers exactly the refs the card data names for them, all valid", () => {
    expect(Object.keys(WOLVERINE_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...REFS].sort());
    for (const definition of Object.values(WOLVERINE_SUPPORT_UPGRADES_ALLIES)) {
      expect(validateDefinition(definition)).toEqual([]);
    }
  });

  describe("Adamantium Skeleton (35004)", () => {
    it("35004.adamantium-skeleton-constant: +4 hit points, in either form", () => {
      const base = wolverine();
      const hp = profile(base, heroId(base)).maxHp;
      const { state: armed } = attach(base, "35004", heroId(base));
      expect(profile(armed, heroId(armed)).maxHp).toBe(hp + 4);
      const alter = withForm(armed, "alterEgo");
      const alterBase = withForm(base, "alterEgo");
      expect(profile(alter, heroId(alter)).maxHp).toBe(profile(alterBase, heroId(alterBase)).maxHp + 4);
    });

    it("35004.adamantium-skeleton-constant-2: Wolverine gets +1 ATK, and only as the hero", () => {
      const base = wolverine();
      const atk = profile(base, heroId(base)).atk;
      const { state: armed } = attach(base, "35004", heroId(base));
      expect(profile(armed, heroId(armed)).atk).toBe(atk + 1);
    });

    it("35004.adamantium-skeleton-constant-2: his basic attacks gain piercing (a tough status on the target is ignored)", () => {
      const { state: foe, minion } = withMinion(wolverine());
      const toughMinion = patchInstance(foe, minion, { statuses: { ...inst(foe, minion).statuses, tough: 1 } });
      const plain = attackOnce(toughMinion, minion);
      // Without the upgrade the tough status absorbs the attack's damage and is discarded.
      expect(inst(plain, minion).damage).toBe(0);
      const { state: armed } = attach(toughMinion, "35004", heroId(toughMinion));
      const pierced = attackOnce(armed, minion);
      expect(inst(pierced, minion).damage).toBe(profile(armed, heroId(armed)).atk);
    });
  });

  describe("Berserker Frenzy (35005)", () => {
    const frenzied = () => attach(wolverine(), "35005", heroId(wolverine()));
    const handSize = (state: GameState) => playerOf(state, P1).hand.length;

    it("35005.berserker-frenzy-response: after Wolverine takes damage from an enemy attack, draws 1 card", () => {
      const { state: armed } = frenzied();
      const offered = toDeclareDefender(armed);
      const before = handSize(offered);
      const declined = answer(offered, ["decline"], WAVE6_DEPS);
      const after = throughFirstAttack(declined, accepting("35005.berserker-frenzy-response"));
      expect(inst(after, heroId(after)).damage).toBeGreaterThan(0);
      expect(handSize(after)).toBe(before + 1);
    });

    it("draws nothing when the response is declined", () => {
      const { state: armed } = frenzied();
      const offered = answer(toDeclareDefender(armed), ["decline"], WAVE6_DEPS);
      const before = handSize(offered);
      const after = throughFirstAttack(offered, () => []);
      expect(handSize(after)).toBe(before);
    });

    it("draws nothing when the attack is defended (Wolverine takes no damage)", () => {
      const { state: armed } = frenzied();
      const ally = playFromHand(WAVE6_DEPS, armed, "35003", 2).state;
      const jubilee = instancesOf(ally, "35003")[0]!;
      const offered = toDeclareDefender(ally);
      const before = handSize(offered);
      const defended = answer(offered, [jubilee], WAVE6_DEPS);
      const after = throughFirstAttack(defended, accepting("35005.berserker-frenzy-response"));
      expect(inst(after, heroId(after)).damage).toBe(0);
      expect(handSize(after)).toBe(before);
    });

    it("35005.berserker-frenzy-forced-response: discards itself after he flips to alter-ego form", () => {
      const { state: armed, id } = frenzied();
      expect(inst(armed, heroId(armed)).attachments).toContain(id);
      const alter = settle(runWith(WAVE6_DEPS, armed, toHero(P1)), firstLegal, undefined, WAVE6_DEPS);
      expect(playerOf(alter, P1).identity.form).toBe("alterEgo");
      expect(playerOf(alter, P1).discard).toContain(id);
      expect(inst(alter, heroId(alter)).attachments).not.toContain(id);
    });
  });

  describe('"I Got Better" (35006)', () => {
    /** Wolverine one hit point from lethal, the card attached, about to be attacked by the villain. */
    function doomed() {
      const base = wolverine();
      const { state: armed, id } = attach(base, "35006", heroId(base));
      const max = profile(armed, heroId(armed)).maxHp;
      const near = patchInstance(armed, heroId(armed), { damage: max - 1, exhausted: true });
      return { offered: answer(toDeclareDefender(near), ["decline"], WAVE6_DEPS), id, max };
    }

    it("35006.i-got-better-interrupt: sets the hit point dial to 5, readies and discards itself", () => {
      const { offered, id, max } = doomed();
      expect(offered.pendingChoice?.options.some((o) => o.optionId.endsWith(":35006.i-got-better-interrupt"))).toBe(
        true,
      );
      const after = throughFirstAttack(offered, accepting("35006.i-got-better-interrupt"));
      expect(after.outcome).toBeFalsy();
      expect(profile(after, heroId(after)).maxHp - inst(after, heroId(after)).damage).toBe(5);
      expect(max).toBeGreaterThan(5);
      expect(inst(after, heroId(after)).exhausted).toBe(false);
      expect(playerOf(after, P1).discard).toContain(id);
    });

    it("declining it lets the identity be defeated", () => {
      const { offered } = doomed();
      const after = settle(offered, () => [], undefined, WAVE6_DEPS);
      expect(after.outcome).toBeTruthy();
    });
  });

  describe("Logan's Cabin (35007)", () => {
    it("35007.logans-cabin-action: exhausts to shuffle 1 Wolverine card from the discard pile into the deck", () => {
      const { state: played, id: cabin } = playFromHand(WAVE6_DEPS, logan(), "35007", 1);
      const { state: inDiscard, id: barrage } = moveToDiscard(played, P1, "35008");
      const deckBefore = playerOf(inDiscard, P1).deck.length;
      const mid = runWith(WAVE6_DEPS, inDiscard, use(P1, cabin, "35007.logans-cabin-action"));
      // Any Wolverine card in the discard pile is offered (here Berserker Barrage and an earlier Lunging Strike).
      expect(mid.pendingChoice?.options.map((o) => o.optionId)).toContain(barrage);
      const after = settle(mid, accepting(barrage), undefined, WAVE6_DEPS);
      expect(inst(after, cabin).exhausted).toBe(true);
      expect(playerOf(after, P1).discard).not.toContain(barrage);
      expect(playerOf(after, P1).deck).toContain(barrage);
      expect(playerOf(after, P1).deck.length).toBe(deckBefore + 1);
    });

    it("takes only a Wolverine card: a card of another set in the discard pile stays there", () => {
      const { state: played, id: cabin } = playFromHand(WAVE6_DEPS, logan(), "35007", 1);
      const { state: inDiscard, id: other } = moveToDiscard(played, P1, "35017");
      const mid = runWith(WAVE6_DEPS, inDiscard, use(P1, cabin, "35007.logans-cabin-action"));
      const offered = mid.pendingChoice?.options.map((o) => o.optionId) ?? [];
      expect(offered.length).toBeGreaterThan(0);
      expect(offered).not.toContain(other);
      const after = settle(mid, firstLegal, undefined, WAVE6_DEPS);
      expect(playerOf(after, P1).discard).toContain(other);
      expect(playerOf(after, P1).deck).not.toContain(other);
    });

    it("is an alter-ego action: not usable as Wolverine", () => {
      const { state: played, id: cabin } = playFromHand(WAVE6_DEPS, logan(), "35007", 1);
      const hero = withForm(played, { heroForm: 0 });
      expect(() => runWith(WAVE6_DEPS, hero, use(P1, cabin, "35007.logans-cabin-action"))).toThrow();
    });
  });

  describe("Warrior Skill (35016)", () => {
    function armed(counters = 3) {
      const { state: foe, minion } = withMinion(wolverine());
      const { state, id } = attach(foe, "35016", heroId(foe));
      return { state: patchInstance(state, id, { counters: { warrior: counters } }), skill: id, minion };
    }
    const warriorOf = (state: GameState, id: InstanceId) => inst(state, id).counters.warrior ?? 0;

    it("35016.warrior-skill-interrupt: a basic attack deals 1 additional damage for 1 counter", () => {
      const { state, skill, minion } = armed();
      const atk = profile(state, heroId(state)).atk;
      const after = settle(
        runWith(WAVE6_DEPS, state, basicAttack(heroId(state), minion)),
        accepting("35016.warrior-skill-interrupt"),
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, minion).damage).toBe(atk + 1);
      expect(warriorOf(after, skill)).toBe(2);
    });

    it("declining it deals the plain ATK and keeps the counter", () => {
      const { state, skill, minion } = armed();
      const atk = profile(state, heroId(state)).atk;
      const after = settle(
        runWith(WAVE6_DEPS, state, basicAttack(heroId(state), minion)),
        () => [],
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, minion).damage).toBe(atk);
      expect(warriorOf(after, skill)).toBe(3);
    });

    it("works on any attack, 1 counter each, and is gone with its last counter", () => {
      const { state, skill, minion } = armed(1);
      const atk = profile(state, heroId(state)).atk;
      const first = settle(
        runWith(WAVE6_DEPS, state, basicAttack(heroId(state), minion)),
        accepting("35016.warrior-skill-interrupt"),
        undefined,
        WAVE6_DEPS,
      );
      expect(warriorOf(first, skill)).toBe(0);
      expect(inst(first, minion).damage).toBe(atk + 1);
      // Out of counters: the cost cannot be paid, so the next attack is plain.
      const readied = patchInstance(patchInstance(first, heroId(first), { exhausted: false }), minion, { damage: 0 });
      const second = settle(
        runWith(WAVE6_DEPS, readied, basicAttack(heroId(readied), minion)),
        accepting("35016.warrior-skill-interrupt"),
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(second, minion).damage).toBe(atk);
    });

    it("also adds 1 to an attack event's damage (Uppercut), not only a basic attack", () => {
      const { state, skill } = armed();
      // A deck card made into Uppercut by surgery (his own attack events are another module).
      const staged = moveToHand(state, P1, "35024");
      const uppercut = staged.ids[0]!;
      const ready = patchInstance(staged.state, uppercut, { cardId: cardId("01054") });
      const cast = (pick: Picker) =>
        settle(
          runWith(WAVE6_DEPS, ready, play(P1, uppercut, payWith(ready, P1, 3, [uppercut]))),
          pick,
          undefined,
          WAVE6_DEPS,
        );
      const plain = cast((state) => (state.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(state)));
      const boosted = cast(accepting("35016.warrior-skill-interrupt"));
      // The first legal target is the villain.
      const villainDamage = (s: GameState) => inst(s, s.villains[0]!.instanceId).damage;
      expect(villainDamage(plain)).toBeGreaterThan(0);
      expect(villainDamage(boosted)).toBe(villainDamage(plain) + 1);
      expect(warriorOf(boosted, skill)).toBe(2);
    });

    it("is not offered when an ally, not the hero, attacks", () => {
      const { state, minion } = armed();
      const { state: withAlly } = playFromHand(WAVE6_DEPS, state, "35003", 2);
      const ally = instancesOf(withAlly, "35003")[0]!;
      const after = settle(runWith(WAVE6_DEPS, withAlly, basicAttack(ally, minion)), firstLegal, undefined, WAVE6_DEPS);
      expect(inst(after, minion).damage).toBe(1);
      expect(codeOf(after, minion)).toBe(codeOf(withAlly, minion));
      expect(cardId("35016")).toBeTruthy();
      expect(hasKeyword(after, heroId(after), "piercing", WAVE6_DEPS)).toBe(false);
    });
  });

  describe("Jubilee (35003, §3.43)", () => {
    /** Accepts Jubilee's response and aims it (and any other target choice) at `enemy`. */
    const aimingJubilee =
      (enemy: InstanceId): Picker =>
      (state) => {
        const choice = state.pendingChoice;
        if (!choice) return [];
        if (choice.options.some((o) => o.optionId === enemy)) return [enemy];
        return accepting("35003.jubilee-response")(state);
      };
    /** Wolverine (hero form), a minion engaged, Jubilee played aiming her response at the villain (Rhino). */
    function cheered() {
      const { state: foe, minion } = withMinion(wolverine());
      const villain = foe.villains[0]!.instanceId;
      const { state, id: jubilee } = playFromHand(WAVE6_DEPS, foe, "35003", 2, aimingJubilee(villain));
      return { state, jubilee, minion, villain };
    }
    const attack = (state: GameState, attacker: InstanceId, target: InstanceId): GameState =>
      settle(runWith(WAVE6_DEPS, state, basicAttack(attacker, target)), () => [], undefined, WAVE6_DEPS);
    const bonuses = (state: GameState, jubilee: InstanceId) =>
      state.lastingEffects.filter((e) => e.kind === "statModifier" && e.scope.selfInstanceId === jubilee);
    const dealt = (before: GameState, after: GameState, id: InstanceId) =>
      inst(after, id).damage - inst(before, id).damage;

    it("Wolverine's basic attack against the chosen enemy gets +2 ATK; his ATK is unchanged outside it", () => {
      const { state, jubilee, villain } = cheered();
      expect(playerOf(state, P1).playArea).toContain(jubilee);
      expect(bonuses(state, jubilee)).toHaveLength(1);
      const atk = profile(state, heroId(state)).atk;
      expect(atk).toBe(profile(wolverine(), heroId(wolverine())).atk);
      expect(dealt(state, attack(state, heroId(state), villain), villain)).toBe(atk + 2);
    });

    it("Jubilee's own basic attack against it gets +2 ATK too", () => {
      const { state, jubilee, villain } = cheered();
      expect(dealt(state, attack(state, jubilee, villain), villain)).toBe(profile(state, jubilee).atk + 2);
    });

    it("a basic attack against another enemy does not", () => {
      const { state, minion } = cheered();
      expect(dealt(state, attack(state, heroId(state), minion), minion)).toBe(profile(state, heroId(state)).atk);
    });

    it("an event's attack against it does not (Lunging Strike from hand: 8)", () => {
      const { state, villain } = cheered();
      const pick: Picker = (s) =>
        s.pendingChoice?.options.some((o) => o.optionId === villain) ? [villain] : firstLegal(s);
      const after = playFromHand(WAVE6_DEPS, state, "35010", 3, pick).state;
      expect(dealt(state, after, villain)).toBe(8);
    });

    it("each trigger stacks (ruling Jun 2, 2026 (1)): Jubilee re-entering play makes it +4", () => {
      const { state, jubilee, villain } = cheered();
      // Back to hand by surgery, then played again: a second trigger this phase, on the same enemy.
      const back: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.playerId === P1
            ? { ...p, playArea: p.playArea.filter((i) => i !== jubilee), hand: [...p.hand, jubilee] }
            : p,
        ),
      };
      const again = playFromHand(WAVE6_DEPS, back, "35003", 2, aimingJubilee(villain)).state;
      expect(bonuses(again, jubilee)).toHaveLength(2);
      expect(dealt(again, attack(again, heroId(again), villain), villain)).toBe(profile(again, heroId(again)).atk + 4);
    });

    it("ends with the phase", () => {
      const { state, jubilee } = cheered();
      const villainPhase = toDeclareDefender(state);
      expect(villainPhase.step.phase).toBe("villain");
      expect(bonuses(villainPhase, jubilee)).toEqual([]);
    });
  });
});
