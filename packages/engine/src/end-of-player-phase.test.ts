/**
 * docs/phase7-wave11-hero-packs.md H3.9: "until the end of the player phase" (`LastingUntil endOfPlayerPhase`), the
 * duration of Take a Stand (62015: "After your hero defends, each ally you control gets +1 THW and +1 ATK until the
 * end of the player phase"), which mostly resolves in the villain phase. Synthetic cards only.
 *
 * Sources: RRG 1.8 "Lasting Effects" (p. 26): a lasting effect "expires as soon as the timing point specified by its
 * duration is reached", and "can only be initiated during that time period"; "Player Phase" (p. 34) names the end of
 * the player phase. Made in the player phase it ends with that phase. Made outside a player phase (the villain phase,
 * or a "when the player phase ends" ability, whose step is already the villain phase's) it is not made at all: owner
 * answer Q104 = B, 2026-10-18 (docs/phase7-wave11-hero-packs.md H3.9; `END_OF_PLAYER_PHASE_OUTSIDE_IT`). "Until the end
 * of the phase" is the control: made in the villain phase, it is made and ends with the villain phase.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import { characterStat, mustPlayer } from "./query.js";
import type { EffectSpec, LastingUntil, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const yourHero: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const plusOne = (stat: "atk" | "thw", until: LastingUntil): EffectSpec => ({
  kind: "modifyStatUntil",
  stat,
  amount: { kind: "const", value: 1 },
  target: yourHero,
  until,
});

/** "Your hero gets +1 ATK until the end of the player phase" and "+1 THW until the end of the phase", in the player phase. */
const RALLY_ABILITY = stubAbility(
  "rally.action",
  def({ trigger: { kind: "action" }, effects: [plusOne("atk", "endOfPlayerPhase"), plusOne("thw", "endOfPhase")] }),
);
const RALLY = stubEvent({ id: "rally", cost: 0, abilities: [RALLY_ABILITY.ref] });
/** The same two, made as the villain phase begins (a forced interrupt, standing in for a response to a defense). */
const DAWN_ABILITY = stubAbility(
  "dawn.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseBeginning", eventIs: { phase: "villain" } } },
    effects: [plusOne("atk", "endOfPlayerPhase"), plusOne("thw", "endOfPhase")],
  }),
);
const DAWN = stubSupport({ id: "dawn", cost: 0, abilities: [DAWN_ABILITY.ref] });
/** "The villain cannot take damage until the end of the player phase" (the `applyRuleUntil` route). */
const WARD_ABILITY = stubAbility(
  "ward.action",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "applyRuleUntil",
        rule: { kind: "cannotTakeDamage", target: { categories: ["villain"] } },
        until: "endOfPlayerPhase",
      },
    ],
  }),
);
const WARD = stubEvent({ id: "ward", cost: 0, abilities: [WARD_ABILITY.ref] });

/** "+1 ATK until the end of the player phase", made as the player phase ends ("when the player phase ends"). */
const DUSK_ABILITY = stubAbility(
  "dusk.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseEnding", eventIs: { phase: "player" } } },
    effects: [plusOne("atk", "endOfPlayerPhase")],
  }),
);
const DUSK = stubSupport({ id: "dusk", cost: 0, abilities: [DUSK_ABILITY.ref] });

const deps = depsOf(RALLY_ABILITY, DAWN_ABILITY, WARD_ABILITY, DUSK_ABILITY);
const start = (): GameState =>
  gameAtFirstTurn({ cards: [RALLY, DAWN, WARD, DUSK], deps, deck: [RALLY.id, DAWN.id, WARD.id, DUSK.id] });
/** The bonus on the identity's stat (the identity starts in alter-ego form, which reads its printed stats as 0). */
const BASE = { atk: 0, thw: 0 };
const heroStat = (state: GameState, stat: "atk" | "thw") =>
  (characterStat(state, mustPlayer(state, P1).identity.instanceId, stat, deps) ?? 0) - BASE[stat];
const endTurn: readonly Command[] = [{ type: "endTurn", playerId: P1 }];

/** Ends the turn and runs to the next player phase's first turn; the log replays to the same state. */
function endRound(state: GameState) {
  const driven = driveSession(startSession(state), deps, endTurn);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  expect(driven.session.state.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P1 });
  return { state: driven.session.state, events: driven.events };
}

describe("H3.9 'until the end of the player phase'", () => {
  it("made in the player phase, it ends as that phase ends, with 'until the end of the phase'", () => {
    const game = playFree(start(), deps, RALLY.id).state;
    expect([heroStat(game, "atk"), heroStat(game, "thw")]).toEqual([1, 1]);
    expect(game.lastingEffects.map((e) => e.duration.kind).sort()).toEqual(["endOfPhase", "endOfPlayerPhase"]);
    const { state, events } = endRound(game);
    expect([heroStat(state, "atk"), heroStat(state, "thw")]).toEqual([0, 0]);
    expect(state.lastingEffects).toEqual([]);
    // Both ended as the player phase ended: ahead of the villain phase's step one (its threat) in the log.
    const ended = events.findIndex((e) => e.type === "lastingEffectEnded");
    const villain = events.findIndex((e) => e.type === "threatPlaced");
    expect(ended).toBeGreaterThanOrEqual(0);
    expect(ended).toBeLessThan(villain);
  });

  it("made in the villain phase, it is not made (Q104 = B); 'until the end of the phase' (control) is", () => {
    const game = playerCardIntoPlay(start(), DAWN.id).state;
    expect(heroStat(game, "atk")).toBe(0);
    const { state: next, events } = endRound(game);
    // Only the phase-long THW bonus was made, and it ended with the villain phase.
    expect(events.filter((e) => e.type === "lastingEffectEnded")).toHaveLength(1);
    expect([heroStat(next, "atk"), heroStat(next, "thw")]).toEqual([0, 0]);
    expect(next.lastingEffects).toEqual([]);
  });

  it("a rule with this duration ends with the player phase too", () => {
    const game = playFree(start(), deps, WARD.id).state;
    expect(game.lastingEffects).toHaveLength(1);
    expect(game.lastingEffects[0]).toMatchObject({ kind: "ruleGrant", duration: { kind: "endOfPlayerPhase" } });
    expect(endRound(game).state.lastingEffects).toEqual([]);
  });

  it("made by a 'when the player phase ends' ability, it is not made: that step is outside the player phase", () => {
    const game = playerCardIntoPlay(start(), DUSK.id).state;
    const next = endRound(game).state;
    expect(heroStat(next, "atk")).toBe(0);
    expect(next.lastingEffects).toEqual([]);
  });
});
