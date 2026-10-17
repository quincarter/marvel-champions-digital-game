/**
 * Rules audit chunk 04 (Glossary: ATTACK (PLAYER ABILITY TYPE) ... CHOOSE (OPTION)). Audit proofs only: each `it.fails`
 * marks a place the engine does something the RRG forbids, and flips to a failure when it is fixed.
 *
 * RRG 1.8 "Attack (Player Ability Type)" (p. 10): "A character can only initiate a basic attack if there is an enemy
 * that can be attacked by that character or if that character is stunned." The engine checks every target of a basic
 * attack (`basicAttackPaying`, `actions.ts`) before it looks at the attacker's stun, so a stunned hero with no
 * attackable enemy (here every enemy "cannot take damage", as under The Red House) is refused instead of spending the
 * attack to discard the stun.
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { Command } from "../commands.js";
import { applyCommand } from "../engine.js";
import { playerId, type InstanceId } from "../ids.js";
import { activeVillain, mustInstance, mustPlayer } from "../query.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { stubMainScheme, stubSupport, stubVillain } from "../testing/fixtures.js";
import { giveCard, newGame, RESOURCE, runWith, settle } from "../testing/scenario.js";

const p1 = playerId("p1");
const toHero: Command = { type: "changeForm", playerId: p1 };

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(50), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
/** "Enemies cannot take damage." (The Red House shape; the villain is the only enemy here.) */
const RULE = stubAbility("house.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotTakeDamage", target: { categories: ["villain"] } }] },
  effects: [],
});
const HOUSE = stubSupport({ id: "house", cost: 0, abilities: [RULE.ref] });
const deps: EngineDeps = depsOf(RULE);

describe("a stunned hero's basic attack with no enemy that can be attacked (RRG 1.8 p. 10 'Attack (Player Ability Type)')", () => {
  it("is allowed: the hero exhausts and the stunned card is discarded (RRG 1.8 'Stun, Stunned', p. 41)", () => {
    const start = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [HOUSE],
      encounterDeck: [],
      deck: [...Array.from({ length: 18 }, () => RESOURCE.id), HOUSE.id],
      deps,
    });
    const hero = settle(runWith(deps, start, toHero), undefined, deps);
    const given = giveCard(hero, p1, HOUSE.id);
    const withHouse = runWith(deps, given.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    const me: InstanceId = mustPlayer(withHouse, p1).identity.instanceId;
    const villain = activeVillain(withHouse).instanceId;
    const stunned: GameState = {
      ...withHouse,
      instances: {
        ...withHouse.instances,
        [me]: { ...mustInstance(withHouse, me), statuses: { stunned: 1, confused: 0, tough: 0 } },
      },
    };
    const result = applyCommand(
      stunned,
      { type: "basicAttack", playerId: p1, attackerInstanceId: me, targetInstanceId: villain },
      deps,
    );
    // Actual: { ok: false, error: { code: "no_valid_target", message: "that enemy cannot take damage from this attack" } }.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(mustInstance(result.state, me).exhausted).toBe(true);
      expect(mustInstance(result.state, me).statuses.stunned).toBe(0);
    }
  });
});
