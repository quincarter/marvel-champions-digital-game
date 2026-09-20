import { applyCommand, type AbilityRegistry, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { endTurn, firstLegal, identityOf, P1, P2, playerOf, settle, toHero } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { constant, query, rule } from "../../dsl/index.js";
import { cardName } from "../names.js";

/**
 * The scoping proof named in `kang-encounter-set.ts`'s own module docblock (11049's dedicated note): does a
 * `RuleSpec cannotAttack` rule attached to *one player's* obligation block a *different* player's attacks too?
 *
 * `11049.fear-of-kang-constant` ("You cannot attack Kang") **is** part of the shipped `KANG_ENCOUNTER_SET` registry
 * now, scripted with `player: you` (docs/phase7-wave2.md §25 — `game-rules-architect` gave `RuleSpec cannotAttack`
 * a `player?: PlayerRef` field for exactly this card, so `WAVE2_DEPS` below already carries the real, scoped
 * ability). This file is the "built a two-player game and looked" evidence backing both halves of the design, kept
 * as a real, always-run test (not a throwaway scratch script) so both claims stay checked as the engine evolves:
 *
 * - A *bare*, target-only `cannotAttack` rule (no `player`) is still table-wide by design — that is what Distracting
 *   Taunts (`wave1/twc/piledriver.ts` 07035, "**Players** cannot attack other villains") genuinely needs, and
 *   `player` being optional means every rule shaped like it keeps working unchanged. `NEUTRAL_DEPS`/`BARE_RULE_DEPS`
 *   below are a *regression guard* for that card's shape, not a claim Fear of Kang should ship this way — it
 *   doesn't, and the "silently over-restrict the whole table" outcome this once forced was exactly the reason
 *   11049's constant half stayed unscripted for a full pass (see the module docblock's git history if curious).
 * - The `player: you` shape 11049 actually ships with only blocks *its own controller's* attacks; a different
 *   player at the table, who never revealed Fear of Kang, can still attack Kang freely.
 *
 * **`withObligationInPlay` is test-only surgery** (`testing/staging.ts`'s own established idiom — `moveToDiscard`,
 * `withDamage`), not a real encounter-deck reveal: it relabels a card from the target player's own deck and moves
 * it straight into their play area. This is deliberate, not a shortcut around the real mechanism — the question
 * this file answers is about the primitive's *scope* (does a rule's `player` field care who controls the source
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

/** `WAVE2_DEPS` with 11049's own constant ability removed — the "nothing restricts this attack at all" baseline. */
const abilitiesWithout11049Constant: AbilityRegistry = { ...WAVE2_DEPS.abilities };
delete (abilitiesWithout11049Constant as Record<string, unknown>)["11049.fear-of-kang-constant"];
const NEUTRAL_DEPS = { ...WAVE2_DEPS, abilities: abilitiesWithout11049Constant };

/** The bare, table-wide shape — Distracting Taunts' own shape, kept as a regression guard, not 11049's. */
const BARE_RULE_DEPS = {
  ...NEUTRAL_DEPS,
  abilities: {
    ...NEUTRAL_DEPS.abilities,
    "11049.fear-of-kang-constant": constant(rule({ kind: "cannotAttack", target: query("villain", { name: cardName("11001") }) })),
  },
};

describe("cannotAttack scoping (RuleSpec, see kang-encounter-set.ts's 11049 note)", () => {
  it("a bare, target-only rule blocks the OTHER player's attacks too (Distracting Taunts' own shape)", () => {
    const staged = withObligationInPlay(twoPlayerKang(), "11049", P1);
    const kang = staged.villains[0]!.instanceId;

    // P1's own turn ends without acting; P2 becomes active and flips to hero form to attack.
    let state = settle(runWave2(staged, endTurn(P1)), firstLegal, undefined, WAVE2_DEPS);
    state = settle(runWave2(state, toHero(P2)), firstLegal, undefined, WAVE2_DEPS);
    const attack = { type: "basicAttack" as const, playerId: P2, attackerInstanceId: identityOf(state, P2), targetInstanceId: kang };

    // Baseline: with no cannotAttack rule at all, P2's attack is legal — proves the rejection below comes from the
    // synthetic bare rule, not from something else (a guard minion, a defeated stage).
    const withoutRule = applyCommand(state, attack, NEUTRAL_DEPS);
    expect(withoutRule.ok, "expected P2's attack on Kang to be legal with no cannotAttack rule active").toBe(true);

    // With a bare, target-only `cannotAttack` rule active, P2 — who never held Fear of Kang — is blocked too.
    const withRule = applyCommand(state, attack, BARE_RULE_DEPS);
    expect(withRule.ok, "P2 should not have been blocked by P1's own obligation, but a target-only cannotAttack rule blocked them anyway").toBe(false);
  });

  it("a bare, target-only rule also blocks the actual obligation holder (both readings agree on this half)", () => {
    const staged = withObligationInPlay(twoPlayerKang(), "11049", P1);
    const kang = staged.villains[0]!.instanceId;
    const state = settle(runWave2(staged, toHero(P1)), firstLegal, undefined, WAVE2_DEPS);
    const attack = { type: "basicAttack" as const, playerId: P1, attackerInstanceId: identityOf(state, P1), targetInstanceId: kang };

    expect(applyCommand(state, attack, NEUTRAL_DEPS).ok, "expected P1's attack on Kang to be legal with no cannotAttack rule active").toBe(true);
    expect(applyCommand(state, attack, BARE_RULE_DEPS).ok, "P1, who does hold Fear of Kang, should be blocked").toBe(false);
  });

  it("the shipped 11049.fear-of-kang-constant (player: you) blocks its own controller but not the other player", () => {
    const staged = withObligationInPlay(twoPlayerKang(), "11049", P1);
    const kang = staged.villains[0]!.instanceId;

    // P1, who holds Fear of Kang, cannot attack Kang.
    const p1State = settle(runWave2(staged, toHero(P1)), firstLegal, undefined, WAVE2_DEPS);
    const p1Attack = { type: "basicAttack" as const, playerId: P1, attackerInstanceId: identityOf(p1State, P1), targetInstanceId: kang };
    expect(applyCommand(p1State, p1Attack, WAVE2_DEPS).ok, "P1, who controls Fear of Kang, should be blocked from attacking Kang").toBe(false);

    // P2, who never held Fear of Kang, can still attack Kang freely — the whole point of scoping `player: you`.
    let p2State = settle(runWave2(staged, endTurn(P1)), firstLegal, undefined, WAVE2_DEPS);
    p2State = settle(runWave2(p2State, toHero(P2)), firstLegal, undefined, WAVE2_DEPS);
    const p2Attack = { type: "basicAttack" as const, playerId: P2, attackerInstanceId: identityOf(p2State, P2), targetInstanceId: kang };
    expect(applyCommand(p2State, p2Attack, WAVE2_DEPS).ok, "P2, who never controlled Fear of Kang, should still be able to attack Kang").toBe(true);
  });
});
