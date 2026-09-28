import { applyCommand, cardsInPlay, maxHitPoints, type Command, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea } from "../../testing/staging.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spiderHamScenario } from "./support.js";

const spiderHamVsRhino = (seed = 1) => startWave5Game(spiderHamScenario("rhino", { seed }));

/**
 * Accepts the named optional response/interrupt (by ability id); declines everything else. Also pays a reactively
 * played card's own `payForCard` step by taking the first `cost` offered options. Nova's `events.test.ts` own
 * `accepting()` precedent.
 */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    }
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Places `n` toon counters on the identity — `identity.test.ts`'s own counter-surgery precedent. */
const withToonCounters = (state: GameState, n: number): GameState => {
  const identity = identityOf(state, P1);
  return patchInstance(state, identity, { counters: { ...inst(state, identity).counters, toon: n } });
};

describe("Spider-Ham's events (30003-30007, 30014-30017)", () => {
  describe("30003.ham-it-up-action", () => {
    it("removes 1 threat from a scheme for each toon counter on Spider-Ham", () => {
      const hero = withToonCounters(runWave5(spiderHamVsRhino(), toHero(P1)), 3);
      const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
      const { state } = playFromHand(withThreat, "30003", 0);
      expect(mainThreat(state)).toBe(10 - 3);
    });

    it("with no toon counters, removes no threat", () => {
      const hero = runWave5(spiderHamVsRhino(), toHero(P1));
      expect(inst(hero, identityOf(hero, P1)).counters.toon ?? 0).toBe(0);
      const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
      const { state } = playFromHand(withThreat, "30003", 0);
      expect(mainThreat(state)).toBe(10);
    });
  });

  describe("30004.hogwashed-action", () => {
    const withMinion = () => {
      const hero = withToonCounters(runWave5(spiderHamVsRhino(), toHero(P1)), 1);
      const stacked = stackEncounterDeck(hero, "01186", "01101"); // Advance (0 boost), Hydra Mercenary (3 hp, Guard).
      const revealed = settle(runWave5(stacked, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      const minion = instancesOf(revealed, "01101").find((id) => cardsInPlay(revealed).includes(id))!;
      expect(minion).toBeDefined();
      return { state: revealed, minion };
    };

    it("removes the toon counter, and choosing damage deals 5 damage to a minion", () => {
      const { state: staged, minion } = withMinion();
      const maxHp = maxHitPoints(staged, minion, WAVE5_DEPS) ?? 3;
      expect(maxHp).toBeLessThanOrEqual(5); // 5 damage defeats Hydra Mercenary outright.
      const pick: Picker = (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        const hit = choice.options.find((o) => o.label === "Deal 5 damage to a minion");
        return hit ? [hit.optionId] : firstLegal(s);
      };
      const { state: after } = playFromHand(staged, "30004", 1, pick);
      expect(cardsInPlay(after)).not.toContain(minion); // defeated by the 5 damage.
      expect(inst(after, identityOf(after, P1)).counters.toon ?? 0).toBe(0); // the toon counter cost, spent.
    });

    it("removes the toon counter, and choosing threat removes 5 threat from a side scheme", () => {
      const hero = withToonCounters(runWave5(spiderHamVsRhino(), toHero(P1)), 1);
      const { state: staged, id: scheme } = encounterCardInVillainArea(hero, "01107", 8); // Breakin' & Takin'.
      const pick: Picker = (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        const hit = choice.options.find((o) => o.label === "Remove 5 threat from a side scheme");
        return hit ? [hit.optionId] : firstLegal(s);
      };
      const { state: after } = playFromHand(staged, "30004", 1, pick);
      expect(inst(after, scheme).threat).toBe(3);
      expect(inst(after, identityOf(after, P1)).counters.toon ?? 0).toBe(0);
    });

    it("cannot be played without a toon counter on Spider-Ham", () => {
      const hero = runWave5(spiderHamVsRhino(), toHero(P1));
      expect(inst(hero, identityOf(hero, P1)).counters.toon ?? 0).toBe(0);
      const { state: given, ids } = moveToHand(hero, P1, "30004");
      const [card] = ids as [InstanceId];
      const command: Command = play(P1, card, []);
      const result = applyCommand(given, command, WAVE5_DEPS);
      // No legal way to pay Hogwashed's own "remove 1 toon counter" cost: playing it is refused outright.
      expect(result.ok).toBe(false);
    });
  });

  describe("30005.i-dont-think-so-interrupt", () => {
    // Rhino attacks this round (this seed), and deals a boost card from the top of the encounter deck for that
    // attack before the phase's own "reveal an encounter card" step draws the *next* card — the same two-card
    // staging Nova's own `28013.no-quarter-action` test and Hogwashed's own minion test above use ("01186" first,
    // 0 boost icons, so the boost draw doesn't consume the card under test). Breakin' & Takin' (01107), a side
    // scheme, is what reaches the actual reveal.
    it("cancels the effects of the revealed card and discards it, spending 1 toon counter", () => {
      const hero = withToonCounters(runWave5(spiderHamVsRhino(), toHero(P1)), 1);
      const given = moveToHand(hero, P1, "30005");
      const identity = identityOf(given.state, P1);
      const stacked = stackEncounterDeck(given.state, "01186", "01107");
      const settled = settle(
        runWave5(stacked, endTurn(P1)),
        accepting("30005.i-dont-think-so-interrupt"),
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(settled, identity).counters.toon ?? 0).toBe(0); // the toon counter cost, spent.
      const revealedInstance = instancesOf(settled, "01107")[0]!;
      expect(cardsInPlay(settled)).not.toContain(revealedInstance); // cancelled: never entered play as a side scheme.
    });

    it("declining leaves the revealed card to resolve normally", () => {
      const hero = withToonCounters(runWave5(spiderHamVsRhino(), toHero(P1)), 1);
      const given = moveToHand(hero, P1, "30005");
      const identity = identityOf(given.state, P1);
      const stacked = stackEncounterDeck(given.state, "01186", "01107");
      const settled = settle(runWave5(stacked, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      const revealedInstance = instancesOf(settled, "01107")[0]!;
      expect(cardsInPlay(settled)).toContain(revealedInstance); // resolved normally: the side scheme entered play.
      expect(inst(settled, identity).counters.toon ?? 0).toBe(1); // declined: no toon counter spent.
    });
  });

  it("30006.petulant-pig-action: the villain attacks you, and draws 3 cards", () => {
    const hero = runWave5(spiderHamVsRhino(1), toHero(P1));
    const identity = identityOf(hero, P1);
    const handBefore = playerOf(hero, P1).hand.length;
    const damageBefore = inst(hero, identity).damage;
    const { state: after } = playFromHand(hero, "30006", 0, (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "declareDefender") return ["decline"];
      return firstLegal(s);
    });
    expect(inst(after, identity).damage).toBeGreaterThan(damageBefore); // Rhino's own attack landed undefended.
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 3); // the event played, then 3 drawn.
  });

  it("30007.swinging-web-pig-action: deals 6 damage to an enemy and confuses that enemy", () => {
    const hero = runWave5(spiderHamVsRhino(), toHero(P1));
    const villain = hero.villains[0]!.instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playFromHand(hero, "30007", 3);
    expect(inst(state, villain).damage).toBe(before + 6);
    expect(state.instances[villain]?.statuses.confused ?? 0).toBeGreaterThan(0);
  });

  describe("30014.even-the-odds-action", () => {
    it("removes 1 threat from each side scheme, and deals 1 damage to the villain for each one defeated this way", () => {
      const hero = runWave5(spiderHamVsRhino(), toHero(P1));
      const villain = hero.villains[0]!.instanceId;
      const { state: withFirst, id: defeated } = encounterCardInVillainArea(hero, "01107", 1); // Breakin' & Takin': 1 threat, defeated.
      const { state: withBoth, id: surviving } = encounterCardInVillainArea(withFirst, "01109", 3); // Bomb Scare: 3 threat, survives at 2.
      const before = inst(withBoth, villain).damage;
      const { state: after } = playFromHand(withBoth, "30014", 2); // printed cost 2.
      expect(cardsInPlay(after)).not.toContain(defeated);
      expect(inst(after, surviving).threat).toBe(2);
      expect(inst(after, villain).damage).toBe(before + 1); // exactly 1 side scheme defeated this way.
    });

    it("with no side schemes in play, removes no threat and deals no damage", () => {
      const hero = runWave5(spiderHamVsRhino(), toHero(P1));
      const villain = hero.villains[0]!.instanceId;
      const before = inst(hero, villain).damage;
      const { state } = playFromHand(hero, "30014", 2);
      expect(inst(state, villain).damage).toBe(before);
    });
  });

  it("30015.great-responsibility-interrupt: aliased to `01061` — you take threat that would be placed on a scheme as damage instead", () => {
    // Villain phase step 1 places threat on the main scheme equal to the active villain's own SCH (Rhino: 1) before
    // any card is revealed (RRG 1.8 "Villain Phase", p. 47) — no encounter-deck staging needed. Stops the instant the
    // interrupt's own effect lands, the same "stop at the moment under test" precedent `identity.test.ts`'s own
    // Spider-Nonsense test uses, so a later villain attack this same round can't also change the identity's damage.
    const given = moveToHand(runWave5(spiderHamVsRhino(), toHero(P1)), P1, "30015");
    const identity = identityOf(given.state, P1);
    const threatBefore = mainThreat(given.state);
    const damageBefore = inst(given.state, identity).damage;
    const settled = settle(
      runWave5(given.state, endTurn(P1)),
      accepting("30015.great-responsibility-interrupt"),
      (s) => inst(s, identity).damage > damageBefore,
      WAVE5_DEPS,
    );
    expect(mainThreat(settled)).toBe(threatBefore); // prevented: no threat placed.
    expect(inst(settled, identity).damage).toBe(damageBefore + 1); // Rhino's SCH (1), taken as damage instead.
  });

  it("30015.great-responsibility-interrupt: declining lets the threat land on the scheme normally", () => {
    const given = moveToHand(runWave5(spiderHamVsRhino(), toHero(P1)), P1, "30015");
    const identity = identityOf(given.state, P1);
    const threatBefore = mainThreat(given.state);
    const damageBefore = inst(given.state, identity).damage;
    const settled = settle(
      runWave5(given.state, endTurn(P1)),
      firstLegal,
      (s) => mainThreat(s) > threatBefore,
      WAVE5_DEPS,
    );
    expect(mainThreat(settled)).toBe(threatBefore + 1); // declined: the villain's own scheme placed threat normally.
    expect(inst(settled, identity).damage).toBe(damageBefore);
  });

  it("30016.making-an-entrance-interrupt: aliased to `20013` — +2 THW for a basic thwart; heals 2 if it clears the scheme", () => {
    const hero = runWave5(spiderHamVsRhino(), toHero(P1));
    const identity = identityOf(hero, P1);
    const given = moveToHand(patchInstance(hero, identity, { damage: 3 }), P1, "30016");
    const scheme = given.state.mainScheme.instanceId;
    // Spider-Ham's own basic THW (2) + Making an Entrance's +2 = 4, enough to clear a 4-threat scheme.
    const withThreat = patchInstance(given.state, scheme, { threat: 4 });
    const thwarted = settle(
      runWave5(withThreat, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      accepting("30016.making-an-entrance-interrupt"),
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(thwarted)).toBe(0);
    expect(inst(thwarted, identity).damage).toBe(1); // 3 damage, healed 2.
  });

  it("30017.one-way-or-another-action: aliased to `22015` — searches the encounter deck for a side scheme, reveals it, and draws 3 cards", () => {
    const hero = runWave5(spiderHamVsRhino(), toHero(P1));
    const handBefore = playerOf(hero, P1).hand.length;
    const { state } = playFromHand(hero, "30017", 0);
    expect(playerOf(state, P1).hand.length).toBe(handBefore + 3);
  });
});
