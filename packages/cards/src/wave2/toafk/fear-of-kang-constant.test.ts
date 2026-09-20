import { applyCommand, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { endTurn, firstLegal, identityOf, P1, P2, playerOf, settle, toHero } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { constant, query, rule } from "../../dsl/index.js";
import { cardName } from "../names.js";

/**
 * The scoping proof named in `kang-encounter-set.ts`'s own module docblock (11049's dedicated note): does a
 * `RuleSpec cannotAttack` rule attached to *one player's* obligation also block a *different* player's attacks?
 *
 * `11049.fear-of-kang-constant` ("You cannot attack Kang") is deliberately **not** part of the shipped
 * `KANG_ENCOUNTER_SET` registry — see that module's docblock for the full argument. This file is the "built a
 * two-player game and looked" evidence for that argument, kept as a real, always-run test (not a throwaway
 * scratch script) so the claim stays checked as the engine evolves. It intentionally constructs the *worst* bare
 * `cannotAttack` rule the primitive can express today — `{ target: query("villain", { name: cardName("11001") }) }`, no
 * `player` field, because `RuleSpec cannotAttack` has none — as a synthetic ability definition local to this test
 * (never added to `WAVE2_DEPS`/`KANG_ENCOUNTER_SET`), so a real command sequence proves the shape rather than an
 * inspection of the engine source alone.
 *
 * **`withObligationInPlay` is test-only surgery** (`testing/staging.ts`'s own established idiom — `moveToDiscard`,
 * `withDamage`), not a real encounter-deck reveal: it relabels a card from the target player's own deck and moves
 * it straight into their play area. This is deliberate, not a shortcut around the real mechanism — the question
 * this file answers is about the primitive's *scope* (does `target`-only matching care who controls the source
 * card?), not about whether Fear of Kang is genuinely revealable, which `kang-encounter-set.test.ts`'s own
 * `revealAsObligation`-based tests already cover for the real "-action" ref. Threading a real two-player villain
 * phase here would additionally have to pin exactly which of two simultaneous per-player reveals lands on which
 * player for a specific seed — a fact this test does not need and should not depend on.
 */
function withObligationInPlay(state: GameState, code: string, owner: PlayerId): GameState {
  const ownerState = playerOf(state, owner);
  const id = ownerState.deck[0] as InstanceId | undefined;
  if (!id) throw new Error(`${owner} has no deck card to repurpose as the obligation`);
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...state.instances[id]!, cardId: code as never } },
    players: state.players.map((p) => (p.playerId === owner ? { ...p, deck: p.deck.filter((x) => x !== id), playArea: [...p.playArea, id] } : p)),
  };
}

const twoPlayerKang = () =>
  startWave2Game(
    wave2Scenario("kang", { players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }], seed: 2026 }),
  );

/** The synthetic ability under test: the only shape `RuleSpec cannotAttack` can express today, target-only. */
const TEST_DEPS = {
  ...WAVE2_DEPS,
  abilities: {
    ...WAVE2_DEPS.abilities,
    "11049.fear-of-kang-constant": constant(rule({ kind: "cannotAttack", target: query("villain", { name: cardName("11001") }) })),
  },
};

describe("cannotAttack scoping (RuleSpec, see kang-encounter-set.ts's 11049 docblock note)", () => {
  it("blocks the OTHER player's attacks too, though only P1 holds Fear of Kang", () => {
    const staged = withObligationInPlay(twoPlayerKang(), "11049", P1);
    const kang = staged.villains[0]!.instanceId;

    // P1's own turn ends without acting; P2 becomes active and flips to hero form to attack.
    let state = settle(runWave2(staged, endTurn(P1)), firstLegal, undefined, WAVE2_DEPS);
    state = settle(runWave2(state, toHero(P2)), firstLegal, undefined, WAVE2_DEPS);
    const attack = { type: "basicAttack" as const, playerId: P2, attackerInstanceId: identityOf(state, P2), targetInstanceId: kang };

    // Baseline: with the ability unscripted (today's real `KANG_ENCOUNTER_SET`), P2's attack is legal — proves the
    // rejection below comes from the synthetic rule, not from something else (a guard minion, a defeated stage).
    const withoutRule = applyCommand(state, attack, WAVE2_DEPS);
    expect(withoutRule.ok, "expected P2's attack on Kang to be legal with 11049.fear-of-kang-constant unscripted").toBe(true);

    // With the bare, target-only `cannotAttack` rule active, P2 — who never held Fear of Kang — is blocked too.
    const withRule = applyCommand(state, attack, TEST_DEPS);
    expect(withRule.ok, "P2 should not have been blocked by P1's own obligation, but a target-only cannotAttack rule blocked them anyway").toBe(false);
  });

  it("also blocks the actual obligation holder (both readings agree on this half)", () => {
    const staged = withObligationInPlay(twoPlayerKang(), "11049", P1);
    const kang = staged.villains[0]!.instanceId;
    const state = settle(runWave2(staged, toHero(P1)), firstLegal, undefined, WAVE2_DEPS);
    const attack = { type: "basicAttack" as const, playerId: P1, attackerInstanceId: identityOf(state, P1), targetInstanceId: kang };

    expect(applyCommand(state, attack, WAVE2_DEPS).ok, "expected P1's attack on Kang to be legal with the ability unscripted").toBe(true);
    expect(applyCommand(state, attack, TEST_DEPS).ok, "P1, who does hold Fear of Kang, should be blocked").toBe(false);
  });
});
