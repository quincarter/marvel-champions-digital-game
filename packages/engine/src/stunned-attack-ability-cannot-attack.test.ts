/**
 * A stunned character that cannot attack at all makes no attempt with an attack ability either.
 *
 * FFG ruling 2023-01-18 (Vision, Intangible): "No attack attempt can be made that removing Stunned would replace";
 * RRG v1.8 p.11 "'Cannot'": the word is absolute. RRG v1.8 p.41 "Stun, Stunned" waives only the target: "A stunned
 * character can attempt to attack or use an attack ability even if it has no valid target for an attack."
 *
 * Intangible ("Vision cannot attack or defend", 26002) is stubbed with the rule `26002.intangible-constant` scripts:
 * the engine's tests cannot import the card scripts.
 */

import { flat, type AbilityId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMainScheme, stubMinion, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { giveCard, newGame, RESOURCE, runWith, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn: Command = { type: "endTurn", playerId: p1 };
const toHero: Command = { type: "changeForm", playerId: p1 };

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(50), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 9, boostIcons: 0 });

const n = (value: number) => ({ kind: "const", value }) as const;
/** "Hero Action (attack): Deal 3 damage to an enemy." */
const STRIKE_ABILITY = stubAbility("strike.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [
    {
      kind: "chooseTarget",
      slot: "enemy",
      chooser: { kind: "controller" },
      query: { categories: ["enemy"], attackableBy: { kind: "identityOf", player: { kind: "controller" } } },
    },
    { kind: "attack", target: { kind: "slot", slot: "enemy" }, amount: n(3) },
  ],
});
const STRIKE = stubEvent({ id: "strike", cost: 0, abilities: [STRIKE_ABILITY.ref] });
/** "Hero Action (attack): Deal 3 damage to the villain": a named target. */
const NAMED_ABILITY = stubAbility("named.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: n(3) }],
});
const NAMED = stubEvent({ id: "named", cost: 0, abilities: [NAMED_ABILITY.ref] });
/** An ally's own unlabeled "Action: This ally attacks the villain." */
const LUNGE: EffectSpec = { kind: "attack", target: { kind: "villain" }, amount: n(1), attacker: { kind: "self" } };
const LUNGE_ABILITY = stubAbility("buddy.action", { trigger: { kind: "action" }, effects: [LUNGE] });
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [LUNGE_ABILITY.ref] });
/** Intangible: "[Attached character] cannot attack." */
const INTANGIBLE_RULE = stubAbility("intangible.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "cannotAttack", attacker: { hostOfSelf: true }, target: { categories: ["enemy"] } } satisfies RuleSpec,
    ],
  },
  effects: [],
});
const INTANGIBLE = stubUpgrade({ id: "intangible", cost: 0, abilities: [INTANGIBLE_RULE.ref] });
const deps: EngineDeps = depsOf(STRIKE_ABILITY, NAMED_ABILITY, LUNGE_ABILITY, INTANGIBLE_RULE);

interface Table {
  readonly state: GameState;
  readonly hero: InstanceId;
  readonly ally: InstanceId;
  readonly villain: InstanceId;
}

const playCommand = (card: InstanceId, attachTo: InstanceId | null = null): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: attachTo,
});

/** P1's second turn in hero form with the ally in play and a minion engaged; `intangible` on that character; `stunned`. */
function table(opts: { readonly stunned: "hero" | "ally"; readonly intangible: "hero" | "ally" | null }): Table {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [THUG, BUDDY, STRIKE, NAMED, INTANGIBLE],
    encounterDeck: Array.from({ length: 12 }, () => THUG.id),
    deck: [...Array.from({ length: 18 }, () => RESOURCE.id), BUDDY.id, STRIKE.id, NAMED.id, INTANGIBLE.id],
    deps,
  });
  const second = settle(runWith(deps, start, toHero, endTurn), undefined, deps);
  const hero = mustPlayer(second, p1).identity.instanceId;
  const givenAlly = giveCard(second, p1, BUDDY.id);
  let state = runWith(deps, givenAlly.state, playCommand(givenAlly.id));
  const ally = givenAlly.id;
  if (opts.intangible) {
    const host = opts.intangible === "hero" ? hero : ally;
    // The stub attaches to the identity when played; for the ally it is moved there, as the rule reads its host.
    const given = giveCard(state, p1, INTANGIBLE.id);
    state = runWith(deps, given.state, playCommand(given.id, hero));
    if (host !== hero) {
      const without = (id: InstanceId) => mustInstance(state, id).attachments.filter((a) => a !== given.id);
      state = {
        ...state,
        instances: {
          ...state.instances,
          [given.id]: { ...mustInstance(state, given.id), attachedTo: host },
          [hero]: { ...mustInstance(state, hero), attachments: without(hero) },
          [host]: { ...mustInstance(state, host), attachments: [...without(host), given.id] },
        },
      };
    }
    if (mustInstance(state, given.id).attachedTo !== host) throw new Error("intangible not attached");
  }
  const who = opts.stunned === "hero" ? hero : ally;
  state = {
    ...state,
    instances: {
      ...state.instances,
      [who]: { ...mustInstance(state, who), statuses: { stunned: 1, confused: 0, tough: 0 } },
    },
  };
  return { state, hero, ally, villain: state.activeVillainId! };
}

const offeredToPlay = (state: GameState, id: InstanceId) => {
  const actions = legalActions(state, p1, deps);
  return (
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id)
  );
};
const offeredAbility = (state: GameState, id: InstanceId) => {
  const actions = legalActions(state, p1, deps);
  return (
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === id)
  );
};
const useLunge = (ally: InstanceId): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: ally,
  abilityId: LUNGE_ABILITY.ref.id as AbilityId,
  payment: [],
});
const stunOf = (state: GameState, id: InstanceId) => mustInstance(state, id).statuses.stunned;

describe("FFG ruling 2023-01-18 (Vision, Intangible); RRG v1.8 p.11: no stunned attack-ability attempt by a character that cannot attack", () => {
  for (const event of [STRIKE, NAMED]) {
    it(`a stunned hero without the rule may still attempt '${event.id}': the stun is removed, no damage`, () => {
      const at = table({ stunned: "hero", intangible: null });
      const given = giveCard(at.state, p1, event.id);
      expect(offeredToPlay(given.state, given.id)).toBe(true);
      const result = applyCommand(given.state, playCommand(given.id), deps);
      if (!result.ok) throw new Error(result.error.message);
      const after = settle(result.state, undefined, deps);
      expect(stunOf(after, at.hero)).toBe(0);
      expect(mustInstance(after, at.villain).damage).toBe(0);
    });

    it(`a stunned hero in Intangible form is not offered '${event.id}' and is refused; the stun stays`, () => {
      const at = table({ stunned: "hero", intangible: "hero" });
      const given = giveCard(at.state, p1, event.id);
      expect(offeredToPlay(given.state, given.id)).toBe(false);
      const result = applyCommand(given.state, playCommand(given.id), deps);
      expect(result.ok).toBe(false);
      expect(stunOf(given.state, at.hero)).toBe(1);
    });
  }

  it("a stunned ally without the rule may still attempt its own 'this ally attacks': the stun is removed", () => {
    const at = table({ stunned: "ally", intangible: null });
    expect(offeredAbility(at.state, at.ally)).toBe(true);
    const result = applyCommand(at.state, useLunge(at.ally), deps);
    if (!result.ok) throw new Error(result.error.message);
    const after = settle(result.state, undefined, deps);
    expect(stunOf(after, at.ally)).toBe(0);
    expect(mustInstance(after, at.villain).damage).toBe(0);
  });

  // Not yet: an unlabeled attack effect is not judged against `cannotAttack` when the ability is initiated, stunned or
  // not (`effectsTargetFault`), and as it resolves a stunned attacker spends its stun before `cannotAttack` is read
  // (`attack` in `resolve/apply-effect.ts`). Table: `table({ stunned: "ally", intangible: "ally" })`, `useLunge`.
  it.todo("a stunned ally that cannot attack is not offered its 'this ally attacks' and is refused; the stun stays");
});
