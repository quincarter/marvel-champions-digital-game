/**
 * docs/phase7-wave6.md §3.77: "cannot thwart / attack / defend" scoped to one character, the identity. Synthetic cards
 * shaped like Wrapped in Metal (`mut_gen` 32150: "Attached identity cannot thwart, attack, defend, or recover") and
 * Permanently Phased (`mut_gen` 32055: "You cannot attack, defend …", an obligation).
 *
 * Sources: RRG 1.8 "You, Your" (p. 49): a "you" that can be the identity must be, and an event's thwart, attack or
 * defense is its player's identity's; "Obligation" (p. 30): an obligation's "you" is the player whose play area holds
 * it; "'Cannot'" (p. 11) is absolute. The player's allies are not the identity and are unaffected.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { legalDefenders } from "./resolve/index.js";
import { cannotDefend, cannotThwart } from "./rules.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubAttachment, stubEvent, stubObligation } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const bans = (who: TargetQuery): RuleSpec[] => [
  { kind: "cannotThwart", thwarter: who },
  { kind: "cannotAttack", target: { categories: ["enemy"] }, attacker: who },
  { kind: "cannotDefend", target: who },
];

/** "Attached identity cannot thwart, attack, defend." */
const METAL_RULE = stubAbility(
  "metal.constant",
  def({ trigger: { kind: "constant", rules: bans({ categories: ["identity"], hostOfSelf: true }) }, effects: [] }),
);
const METAL = stubAttachment({ id: "metal", abilities: [METAL_RULE.ref] });
/** An obligation: "You cannot thwart, attack or defend." */
const PHASED_RULE = stubAbility(
  "phased.constant",
  def({
    trigger: { kind: "constant", rules: bans({ categories: ["identity"], controlledBy: { kind: "controller" } }) },
    effects: [],
  }),
);
const PHASED = stubObligation({ id: "phased", abilities: [PHASED_RULE.ref] });

/** "(thwart): Remove 1 threat from a scheme." */
const PROBE_ACTION = stubAbility("probe.action", {
  trigger: { kind: "action" },
  label: ["thwart"],
  effects: [
    { kind: "chooseTarget", slot: "scheme", query: { categories: ["scheme"] }, chooser: { kind: "controller" } },
    { kind: "thwart", target: { kind: "slot", slot: "scheme" }, amount: n(1) },
  ] as EffectSpec[],
});
const PROBE = stubEvent({ id: "probe", cost: 0, abilities: [PROBE_ACTION.ref] });
/** Unlabeled: "Your identity thwarts each scheme for 1." */
const SWEEP_ACTION = stubAbility("sweep.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "thwart", target: { kind: "each", query: { categories: ["scheme"] } }, amount: n(1) }],
});
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [SWEEP_ACTION.ref] });
/** "Your identity attacks the villain for 3." */
const STRIKE_ACTION = stubAbility("strike.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "attack", target: { kind: "each", query: { categories: ["villain"] } }, amount: n(3) }],
});
const STRIKE = stubEvent({ id: "strike", cost: 0, abilities: [STRIKE_ACTION.ref] });
/** An ally with "Action: this ally thwarts each scheme for 1." */
const BUDDY_ACTION = stubAbility("buddy.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "thwart",
      thwarter: { kind: "self" },
      target: { kind: "each", query: { categories: ["scheme"] } },
      amount: n(1),
    },
  ],
});
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 5, abilities: [BUDDY_ACTION.ref] });

const deps: EngineDeps = depsOf(METAL_RULE, PHASED_RULE, PROBE_ACTION, SWEEP_ACTION, STRIKE_ACTION, BUDDY_ACTION);

const identityOf = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).identity.instanceId;
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const villainDamage = (state: GameState) => mustInstance(state, activeVillain(state).instanceId).damage;

/** Each seat in hero form, the main scheme at 5 threat, and a ready buddy ally under P1's control. */
function start(players: 1 | 2 = 1): { readonly state: GameState; readonly buddy: InstanceId } {
  const base = gameAtFirstTurn({
    players,
    cards: [METAL, PHASED, PROBE, SWEEP, STRIKE, BUDDY],
    deps,
    deck: [BUDDY.id, PROBE.id, SWEEP.id, SWEEP.id, STRIKE.id, STRIKE.id],
    encounter: [METAL.id, PHASED.id],
  });
  const main = base.mainScheme.instanceId;
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 5 } },
  };
  const buddy = playerCardIntoPlay(heroes, BUDDY.id);
  return { state: buddy.state, buddy: buddy.id };
}

/** Surgery: Wrapped in Metal attached to `player`'s identity. */
function wrap(state: GameState, player: PlayerId = P1): GameState {
  const taken = encounterCardInVillainArea(state, METAL.id);
  const host = identityOf(taken.state, player);
  return {
    ...taken.state,
    villainArea: taken.state.villainArea.filter((id) => id !== taken.id),
    instances: {
      ...taken.state.instances,
      [taken.id]: { ...mustInstance(taken.state, taken.id), attachedTo: host },
      [host]: {
        ...mustInstance(taken.state, host),
        attachments: [...mustInstance(taken.state, host).attachments, taken.id],
      },
    },
  };
}

/** Surgery: the obligation in `player`'s play area (controlled by no one). */
function oblige(state: GameState, player: PlayerId = P1): GameState {
  const taken = encounterCardInVillainArea(state, PHASED.id);
  return {
    ...taken.state,
    villainArea: taken.state.villainArea.filter((id) => id !== taken.id),
    players: taken.state.players.map((p) =>
      p.playerId === player ? { ...p, playArea: [...p.playArea, taken.id] } : p,
    ),
  };
}

function run(state: GameState, commands: readonly Command[]): GameState {
  const driven = driveSession(startSession(state), deps, commands);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return driven.session.state;
}

const basicThwart = (state: GameState, thwarter: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: state.mainScheme.instanceId,
});
const basicAttack = (state: GameState, attacker: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: activeVillain(state).instanceId,
});
const playCard = (state: GameState, card: CardId) => {
  const given = giveCard(state, P1, card);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return { state: given.state, command };
};

const restricted: readonly [string, (state: GameState) => GameState][] = [
  ["an attachment's 'attached identity'", (state) => wrap(state)],
  ["an obligation's 'you'", (state) => oblige(state)],
];

describe("§3.77 identity-scoped 'cannot thwart / attack / defend'", () => {
  describe.each(restricted)("%s", (_name, restrict) => {
    it("thwart: the identity's basic thwart is refused; the ally's basic thwart removes threat", () => {
      const { state: base, buddy } = start();
      const state = restrict(base);
      const refused = applyCommand(state, basicThwart(state, identityOf(state)), deps);
      expect(refused.ok ? null : refused.error.code).toBe("no_valid_target");
      expect(cannotThwart(state, deps, P1, undefined, identityOf(state))).toBe(true);
      expect(cannotThwart(state, deps, P1, undefined, buddy)).toBe(false);
      // A player-level question (no thwarter) is not restricted by a character-scoped rule.
      expect(cannotThwart(state, deps, P1)).toBe(false);
      expect(mainThreat(run(state, [basicThwart(state, buddy)]))).toBe(4);
    });

    it("thwart: neither a '(thwart)' event nor an unlabeled 'your identity thwarts' event has a valid target", () => {
      const { state: base } = start();
      const state = restrict(base);
      for (const card of [PROBE.id, SWEEP.id]) {
        const event = playCard(state, card);
        const refused = applyCommand(event.state, event.command, deps);
        expect(refused.ok ? null : refused.error.code).toBe("no_valid_target");
      }
      // Unrestricted, it removes threat.
      const free = playCard(base, SWEEP.id);
      expect(mainThreat(run(free.state, [free.command]))).toBe(4);
    });

    it("thwart: the ally's own thwart ability still removes threat", () => {
      const { state: base, buddy } = start();
      const state = restrict(base);
      const used: Command = {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: buddy,
        abilityId: BUDDY_ACTION.ref.id,
        payment: [],
      };
      expect(mainThreat(run(state, [used]))).toBe(4);
    });

    it("attack: the identity's basic attack and attack event are refused or do nothing; the ally attacks", () => {
      const { state: base, buddy } = start();
      const state = restrict(base);
      expect(applyCommand(state, basicAttack(state, identityOf(state)), deps).ok).toBe(false);
      const strike = playCard(state, STRIKE.id);
      expect(villainDamage(run(strike.state, [strike.command]))).toBe(0);
      expect(villainDamage(run(state, [basicAttack(state, buddy)]))).toBe(1);
      const free = playCard(base, STRIKE.id);
      expect(villainDamage(run(free.state, [free.command]))).toBe(3);
    });

    it("defend: the identity is not a legal defender (basic or '(defense)'); the ally is", () => {
      const { state: base, buddy } = start();
      const state = restrict(base);
      const villain = activeVillain(state).instanceId;
      const defenders = legalDefenders(state, P1, deps, villain);
      expect(defenders).toContain(buddy);
      expect(defenders).not.toContain(identityOf(state));
      // The same rule `declareLabeledDefense` asks for a "(defense)" ability.
      expect(cannotDefend(state, deps, identityOf(state), villain)).toBe(true);
      expect(legalDefenders(base, P1, deps, villain)).toContain(identityOf(base));
    });
  });

  it("an obligation's 'you' is its holder's identity only: the other player's identity is unaffected", () => {
    const { state: base } = start(2);
    const state = oblige(base, P1);
    const villain = activeVillain(state).instanceId;
    expect(cannotThwart(state, deps, P1, undefined, identityOf(state, P1))).toBe(true);
    expect(cannotThwart(state, deps, P2, undefined, identityOf(state, P2))).toBe(false);
    expect(cannotDefend(state, deps, identityOf(state, P1), villain)).toBe(true);
    expect(cannotDefend(state, deps, identityOf(state, P2), villain)).toBe(false);
    expect(legalDefenders(state, P2, deps, villain)).toContain(identityOf(state, P2));

    const p2Obliged = oblige(base, P2);
    expect(applyCommand(p2Obliged, basicAttack(p2Obliged, identityOf(p2Obliged, P1)), deps).ok).toBe(true);
    expect(cannotDefend(p2Obliged, deps, identityOf(p2Obliged, P1), villain)).toBe(false);
  });
});
