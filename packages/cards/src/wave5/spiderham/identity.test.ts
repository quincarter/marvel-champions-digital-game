import { describe, expect, it } from "vitest";
import { applyCommand, type Command, type GameState, type InstanceId } from "@mc/engine";
import {
  answer,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  run,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { WAVE5_DEPS } from "../index.js";
import { startWave5Game } from "../testing.js";
import { spiderHamScenario } from "./support.js";

// Real Core data: the Rhino villain phase always attacks a lone player — the same neutral target
// `wave3/vnm/venom-kit.test.ts`'s own Shake it Off test and Nova's own identity test use to exercise damage/a
// basic power.
const spiderHamVsRhino = (seed = 1) => startWave5Game(spiderHamScenario("rhino", { seed }));

/** Accepts the named optional response (a trigger's option id is `<instance>:<ability>`); declines any other
 * prompt. Nova's `identity.test.ts` own `accepting()` precedent. */
const accepting =
  (wantedAbility: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => id === wantedAbility || id.endsWith(`:${wantedAbility}`));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Spider-Ham (identity, 30001a/b)", () => {
  describe("30001a.spider-ham-constant: a toon counter spends as if it were a [wild] resource", () => {
    it("pays Cartoon Physics's [physical] cost of 1 with a single toon counter", () => {
      // Hero form: the ability is printed on the hero face (30001a), so it is active only while Spider-Ham is in
      // hero form, the same form gate every identity-face ability reads from `activeAbilityRefs`.
      const state = run(spiderHamVsRhino(), toHero(P1));
      const identity = identityOf(state, P1);
      const withToon = patchInstance(state, identity, { counters: { ...inst(state, identity).counters, toon: 1 } });
      const { state: withCard, ids } = moveToHand(withToon, P1, "30009"); // Cartoon Physics
      const [card] = ids as [InstanceId];
      const played = settle(
        runWith(
          WAVE5_DEPS,
          withCard,
          play(P1, card, [], { abilities: [resourceAbility(identity, "30001a.spider-ham-constant")] }),
        ),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(played, identity).counters.toon ?? 0).toBe(0); // The counter paid the cost — spent, not left over.
      expect(playerOf(played, P1).hand).not.toContain(card);
    });

    it("cannot pay with the ability when Spider-Ham holds no toon counters", () => {
      const state = run(spiderHamVsRhino(), toHero(P1));
      const identity = identityOf(state, P1);
      expect(inst(state, identity).counters.toon ?? 0).toBe(0);
      const { state: withCard, ids } = moveToHand(state, P1, "30009");
      const [card] = ids;
      const command: Command = play(P1, card!, [], {
        abilities: [resourceAbility(identity, "30001a.spider-ham-constant")],
      });
      const result = applyCommand(withCard, command, WAVE5_DEPS);
      expect(result.ok).toBe(false);
    });
  });

  it("30001a.spider-nonsense: after Spider-Ham takes damage, places 1 toon counter on him", () => {
    // Seed 1: Rhino attacks (rather than schemes) on the villain phase this test reaches — the same seed
    // `wave3/vnm/venom-kit.test.ts`'s own Shake it Off test relies on for the identical reason.
    const hero = run(spiderHamVsRhino(1), toHero(P1));
    const identity = identityOf(hero, P1);
    const reached = settle(
      runWith(WAVE5_DEPS, hero, { type: "endTurn", playerId: P1 }),
      firstLegal,
      (s: GameState) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE5_DEPS,
    );
    // No defense: Rhino's full ATK lands on the identity, so "takes any amount of damage" is true. Stops the
    // instant the counter lands — left to run to full stillness, this seed's villain phase reveals a second Rhino
    // activation that attacks (and damages, and re-offers Spider-Nonsense) again before the phase ends, which
    // would look like the response fired twice (Venom's Shake it Off test, `wave3/vnm/venom-kit.test.ts`, is the
    // same "stop at the moment under test" precedent).
    const offered = answer(reached, ["decline"], WAVE5_DEPS);
    const before = inst(offered, identity).counters.toon ?? 0;
    const settled = settle(
      offered,
      accepting("30001a.spider-nonsense"),
      (s: GameState) => (inst(s, identity).counters.toon ?? 0) > before,
      WAVE5_DEPS,
    );
    expect(inst(settled, identity).damage).toBeGreaterThan(0);
    expect(inst(settled, identity).counters.toon ?? 0).toBe(before + 1);
  });

  it("30001a.spider-nonsense: declining the response leaves no toon counter", () => {
    const hero = run(spiderHamVsRhino(1), toHero(P1));
    const identity = identityOf(hero, P1);
    const reached = settle(
      runWith(WAVE5_DEPS, hero, { type: "endTurn", playerId: P1 }),
      firstLegal,
      (s: GameState) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE5_DEPS,
    );
    const offered = answer(reached, ["decline"], WAVE5_DEPS);
    const settled = settle(offered, firstLegal, undefined, WAVE5_DEPS); // firstLegal declines every optional trigger.
    expect(inst(settled, identity).damage).toBeGreaterThan(0);
    expect(inst(settled, identity).counters.toon ?? 0).toBe(0);
  });

  it("30001b.cartoon-power: after a basic recovery, places 1 toon counter on Peter Porker", () => {
    const state = spiderHamVsRhino(2); // alter-ego by default
    const identity = identityOf(state, P1);
    const hurt = patchInstance(state, identity, { damage: 3 });
    const before = inst(hurt, identity).counters.toon ?? 0;
    const settled = settle(
      runWith(WAVE5_DEPS, hurt, { type: "basicRecover", playerId: P1 }),
      accepting("30001b.cartoon-power"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(settled, identity).damage).toBe(0); // Peter Porker's own REC healed it (unrelated to Cartoon Power).
    expect(inst(settled, identity).counters.toon ?? 0).toBe(before + 1);
  });

  it("30001b.cartoon-power: declining the response leaves no toon counter", () => {
    const state = spiderHamVsRhino(2);
    const identity = identityOf(state, P1);
    const hurt = patchInstance(state, identity, { damage: 3 });
    const settled = settle(
      runWith(WAVE5_DEPS, hurt, { type: "basicRecover", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(settled, identity).counters.toon ?? 0).toBe(0);
  });

  it("30001b.cartoon-power: form-gated — attacking or thwarting in hero form never reaches it (no ATK/THW/DEF on Peter Porker)", () => {
    // Spider-Ham (hero) attacks the villain: `basicPowerUsed` fires with power "attack", not "recover", and
    // Cartoon Power isn't even registered while in hero form (it's printed on the alter-ego face).
    const hero = run(spiderHamVsRhino(3), toHero(P1));
    const identity = identityOf(hero, P1);
    const villain = hero.villains[0]!.instanceId;
    const before = inst(hero, identity).counters.toon ?? 0;
    const settled = settle(
      runWith(WAVE5_DEPS, hero, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(settled, identity).counters.toon ?? 0).toBe(before);
  });
});
