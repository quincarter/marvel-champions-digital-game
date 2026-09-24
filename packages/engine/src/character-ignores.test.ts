/**
 * docs/phase7-wave4.md §3.24: a character that ignores the guard keyword, the patrol keyword and the crisis icon.
 * Synthetic cards shaped like Evasive Maneuvering (`nebu` 22005: "While in hero form, Nebula ignores the guard keyword,
 * the patrol keyword, and the crisis icon."), with Wasp (`ironheart` 29034), Shadowcat (`mut_gen` 32002, 32030a) and
 * Psionic Training (`psylocke` 41010) printing the same exemption.
 *
 * Sources: the cards' own text; RRG 1.8 "Ignore" (p. 23), "Guard" (p. 21), "Patrol" (p. 32), "Crisis Icon" (p. 14).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import { canAttack } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const mainScheme: TargetRef = { kind: "mainScheme" };
const SENTRY = stubMinion({ id: "sentry", atk: 1, sch: 1, hp: 9, keywords: [{ name: "guard" }, { name: "patrol" }] });
const CRISIS = stubSideScheme({ id: "crisis-scheme", startingThreat: 3, icons: ["crisis"] });

const EVASIVE = stubAbility("evasive.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "characterIgnores",
        target: { categories: ["hero"], controller: "you" },
        ignores: ["guard", "patrol", "crisis"],
      },
    ],
  },
  effects: [],
});
const EVASIVE_CARD = stubSupport({ id: "evasive", cost: 0, abilities: [EVASIVE.ref] });
const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Hero Action (thwart): Remove 3 threat from the main scheme." */
const THWART_MAIN = actionEvent("thwart-main", [{ kind: "thwart", target: mainScheme, amount: n(3) }]);
/** "Remove 2 threat from the main scheme." — not a thwart, and not the character's own removal. */
const REMOVE_MAIN = actionEvent("remove-main", [{ kind: "removeThreat", target: mainScheme, amount: n(2) }]);
const deps: EngineDeps = depsOf(EVASIVE, THWART_MAIN.ability, REMOVE_MAIN.ability);

function start(options: { evasive: boolean; crisis: boolean; form?: "hero" | "alterEgo" }): GameState {
  let state = gameAtFirstTurn({
    cards: [SENTRY, CRISIS, EVASIVE_CARD, THWART_MAIN.card, REMOVE_MAIN.card],
    deps,
    encounter: [SENTRY.id, CRISIS.id, ...copiesOf(SENTRY.id, 5)],
    deck: [EVASIVE_CARD.id, ...copiesOf(THWART_MAIN.card.id, 2), ...copiesOf(REMOVE_MAIN.card.id, 2)],
  });
  const form = options.form ?? "hero";
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form } })),
    instances: {
      ...state.instances,
      [state.mainScheme.instanceId]: { ...mustInstance(state, state.mainScheme.instanceId), threat: 5 },
    },
  };
  state = minionEngagedWith(state, SENTRY.id, P1).state;
  if (options.crisis) state = encounterCardInVillainArea(state, CRISIS.id, 3).state;
  if (options.evasive) state = playerCardIntoPlay(state, EVASIVE_CARD.id).state;
  return state;
}
const hero = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const basicThwart = (state: GameState): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: hero(state),
  schemeInstanceId: state.mainScheme.instanceId,
});

describe("§3.24 a character that ignores guard, patrol and the crisis icon", () => {
  it("guard: the exempt hero may attack the villain past an engaged guard minion; others may not", () => {
    const plain = start({ evasive: false, crisis: false });
    expect(canAttack(plain, hero(plain), plain.activeVillainId, deps)).toBe(false);
    const evasive = start({ evasive: true, crisis: false });
    expect(canAttack(evasive, hero(evasive), evasive.activeVillainId, deps)).toBe(true);
  });

  it("patrol and crisis: the exempt hero's basic thwart and '(thwart)' ability remove threat from the main scheme", () => {
    expect(
      applyCommand(start({ evasive: false, crisis: true }), basicThwart(start({ evasive: false, crisis: true })), deps)
        .ok,
    ).toBe(false);
    const evasive = start({ evasive: true, crisis: true });
    const { session } = driveSession(startSession(evasive), deps, [basicThwart(evasive)]);
    expect(mainThreat(session.state)).toBeLessThan(5);
    expect(mainThreat(playFree(evasive, deps, THWART_MAIN.card.id).state)).toBe(2);
  });

  it("a removal that is neither the character's thwart nor its own is still stopped by the crisis icon", () => {
    const { state, events } = playFree(start({ evasive: true, crisis: true }), deps, REMOVE_MAIN.card.id);
    expect(mainThreat(state)).toBe(5);
    expect(events).toContainEqual(expect.objectContaining({ type: "threatRemovalBlocked", reason: "crisis" }));
  });

  it("a character the rule does not match is not exempt (the alter-ego, here)", () => {
    const state = start({ evasive: true, crisis: false, form: "alterEgo" });
    expect(canAttack(state, hero(state), state.activeVillainId, deps)).toBe(false);
  });
});
