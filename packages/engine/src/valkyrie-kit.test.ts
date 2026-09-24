/**
 * docs/phase7-wave4.md §3.22: the primitives Valkyrie's kit needed, on synthetic cards shaped like the printed ones.
 *
 * - "Play the set-aside Death-Glow upgrade as if it were in your hand" (Death Perception, 25001a): `playFromHand.from:
 *   "setAside"`; "set this card aside, out of play": `CardDestination "setAside"`.
 * - "Forced Interrupt: When attached enemy is defeated, set this card aside, out of play. If Valkyrie defeated that
 *   enemy, ready her." (Death-Glow, 25002): `TargetQuery.extensionOf` (RRG 1.8 "You, Your", p. 49).
 * - "After the enemy with Death-Glow is defeated" (Flight of the Valkyrior, 25008): `EventPattern.targetHadAttachment`.
 * - "+2 ATK instead while attacking the enemy with Death-Glow attached" (Dragonfang, 25006) and "+2 DEF instead while
 *   defending against …" (Valkyrie's Spear, 25005): `Predicate attackInProgress`.
 * - "Declare Valkyrie the defender without exhausting her" (Shieldmaiden, 25011): `EffectSpec declareDefender` (RRG 1.8
 *   "Defend, Defense", p. 15: a hero declared the defender is making a basic defense).
 * - "Use its ATK instead of its DEF for this attack" (The Best Defense…, 25020): `modifyAttack.defenseUsesAtk`.
 * - "Resolve this attack against each minion engaged with that player" (Thor, 25013): `EffectSpec resolveAttackAgainst`.
 */

import type { AnyCard, CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const you = { kind: "controller" } as const;
const yourIdentity = { kind: "identityOf", player: you } as const;
const WITH_GLOW: TargetQuery = { categories: ["enemy"], hasAttachment: { name: "glow" } };
const draw = { kind: "draw", player: you, amount: { kind: "const", value: 1 } } as const;

/** Death-Glow: "Attach to an enemy. Forced Interrupt: When attached enemy is defeated, set this card aside, out of play.
 * If Valkyrie defeated that enemy, ready her." */
const GLOW_INTERRUPT = stubAbility(
  "glow.forced-interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", targetIs: { hostOfSelf: true } } },
    effects: [
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "setAside" },
      {
        kind: "if",
        condition: { kind: "refMatches", ref: { kind: "eventSource" }, query: { extensionOf: you }, anywhere: true },
        then: [{ kind: "ready", target: yourIdentity }],
      },
    ],
  }),
);
const GLOW: AnyCard = {
  ...stubUpgrade({ id: "glow", cost: 1, abilities: [GLOW_INTERRUPT.ref] }),
  attachesTo: { kind: "enemy" },
};
/** Death Perception on a support: "Action: Play the set-aside Death-Glow upgrade as if it were in your hand." */
const PERCEPTION_ACTION = stubAbility(
  "perception.action",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "playFromHand",
        player: you,
        from: "setAside",
        costReduction: { kind: "const", value: 0 },
        filter: { name: "glow" },
      },
    ],
  }),
);
const PERCEPTION = stubSupport({ id: "perception", cost: 0, abilities: [PERCEPTION_ACTION.ref] });
/** Flight of the Valkyrior: "Response: After the enemy with Death-Glow is defeated, … → draw 1 card." */
const FLIGHT_RESPONSE = stubAbility(
  "flight.response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "characterDefeated", targetIs: { categories: ["enemy"] }, targetHadAttachment: { name: "glow" } },
    },
    effects: [draw],
  }),
);
const FLIGHT = stubSupport({ id: "flight", cost: 0, abilities: [FLIGHT_RESPONSE.ref] });
/** Dragonfang: "Valkyrie gets +1 ATK (+2 ATK instead while attacking the enemy with Death-Glow attached)." */
const FANG_CONSTANT = stubAbility(
  "fang.constant",
  def({
    trigger: {
      kind: "constant",
      modifiers: [
        {
          stat: "atk",
          target: { categories: ["identity"], controller: "you" },
          amount: {
            kind: "conditional",
            if: {
              kind: "attackInProgress",
              attacker: { categories: ["identity"], controller: "you" },
              target: WITH_GLOW,
            },
            then: { kind: "const", value: 2 },
            else: { kind: "const", value: 1 },
          },
        },
      ],
    },
    effects: [],
  }),
);
const FANG = stubUpgrade({ id: "fang", cost: 0, abilities: [FANG_CONSTANT.ref] });
/** Valkyrie's Spear: "+1 DEF (+2 DEF instead while defending against the enemy with Death Glow attached)." */
const SPEAR_CONSTANT = stubAbility(
  "spear.constant",
  def({
    trigger: {
      kind: "constant",
      modifiers: [
        {
          stat: "def",
          target: { categories: ["identity"], controller: "you" },
          amount: {
            kind: "conditional",
            if: {
              kind: "attackInProgress",
              attacker: WITH_GLOW,
              defender: { categories: ["identity"], controller: "you" },
            },
            then: { kind: "const", value: 2 },
            else: { kind: "const", value: 1 },
          },
        },
      ],
    },
    effects: [],
  }),
);
const SPEAR = stubUpgrade({ id: "spear", cost: 0, abilities: [SPEAR_CONSTANT.ref] });
/** Shieldmaiden: "Hero Interrupt (defense): When the enemy with Death-Glow attached attacks, declare Valkyrie the
 * defender without exhausting her." */
const SHIELD_INTERRUPT = stubAbility(
  "shield.interrupt",
  def({
    trigger: { kind: "interrupt", forced: false, on: { on: "enemyAttack", sourceIs: WITH_GLOW } },
    label: ["defense"],
    effects: [{ kind: "declareDefender", character: yourIdentity }],
  }),
);
const SHIELD = stubEvent({ id: "shield", cost: 0, abilities: [SHIELD_INTERRUPT.ref] });
/** The Best Defense…: "Hero Interrupt (defense): When your hero defends against an attack, use its ATK instead of its
 * DEF for this attack." The basic defense's `basicPowerUsing` is the moment it defends. */
const BEST_INTERRUPT = stubAbility(
  "best.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: false,
      on: {
        on: "basicPowerUsing",
        targetIs: { categories: ["identity"], controller: "you" },
        eventIs: { power: "defense" },
      },
    },
    label: ["defense"],
    effects: [{ kind: "modifyAttack", defenseUsesAtk: true }],
  }),
);
const BEST = stubEvent({ id: "best", cost: 0, abilities: [BEST_INTERRUPT.ref] });
/** "Action: each enemy with Death-Glow attacks you." — a 0-cost way to start a minion's attack. */
const PROVOKE_ACTION = stubAbility(
  "provoke.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "enemyAttack", enemies: { kind: "each", query: WITH_GLOW } }] }),
);
const PROVOKE = stubEvent({ id: "provoke", cost: 0, abilities: [PROVOKE_ACTION.ref] });
/** "Action: deal 3 damage to each enemy with Death-Glow." — non-attack damage from an event. */
const BLAST_ACTION = stubAbility(
  "blast.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "dealDamage", target: { kind: "each", query: WITH_GLOW }, amount: { kind: "const", value: 3 } }],
  }),
);
const BLAST = stubEvent({ id: "blast", cost: 0, abilities: [BLAST_ACTION.ref] });
/** Thor: "Interrupt: When Thor attacks a minion engaged with a player, … → resolve this attack against each minion
 * engaged with that player." */
const THOR_INTERRUPT = stubAbility(
  "thor.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: false,
      on: { on: "attack", selfIs: "source", targetIs: { categories: ["minion"], engagedWith: "you" } },
    },
    effects: [
      {
        kind: "resolveAttackAgainst",
        targets: { kind: "each", query: { categories: ["minion"], engagedWith: "you" } },
      },
    ],
  }),
);
const THOR = stubAlly({ id: "thor", cost: 0, atk: 2, thw: 1, hp: 5, abilities: [THOR_INTERRUPT.ref] });
const SQUIRE = stubAlly({ id: "squire", cost: 0, atk: 3, thw: 1, hp: 3 });

const FRAIL = stubMinion({ id: "frail", atk: 4, sch: 1, hp: 2, boostIcons: 0 });
const STURDY = stubMinion({ id: "sturdy", atk: 4, sch: 1, hp: 10, boostIcons: 0 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps = depsOf(
  GLOW_INTERRUPT,
  PERCEPTION_ACTION,
  FLIGHT_RESPONSE,
  FANG_CONSTANT,
  SPEAR_CONSTANT,
  SHIELD_INTERRUPT,
  BEST_INTERRUPT,
  PROVOKE_ACTION,
  BLAST_ACTION,
  THOR_INTERRUPT,
);
const PLAYER_CARDS = [GLOW, PERCEPTION, FLIGHT, FANG, SPEAR, SHIELD, BEST, PROVOKE, BLAST, THOR, SQUIRE];
const CARDS: readonly AnyCard[] = [...PLAYER_CARDS, FRAIL, STURDY, BLANK];
const DECK: readonly CardId[] = PLAYER_CARDS.flatMap((card) => [card.id, card.id]);

/** One player in hero form, Death-Glow set aside (Valkyrie's Setup), minions available in the encounter deck. */
function start(): { state: GameState; glow: InstanceId } {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: DECK,
    encounter: [...copiesOf(FRAIL.id, 3), ...copiesOf(STURDY.id, 3), ...copiesOf(BLANK.id, 20)],
  });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const given = giveCard(hero, P1, GLOW.id);
  const seat = mustPlayer(given.state, P1);
  return {
    glow: given.id,
    state: {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: seat.hand.filter((id) => id !== given.id), setAside: [...seat.setAside, given.id] }
          : p,
      ),
    },
  };
}
/** Death-Glow attached to `host` (surgery), under P1's control. */
function glowOn(state: GameState, glow: InstanceId, host: InstanceId): GameState {
  const seat = mustPlayer(state, P1);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, setAside: seat.setAside.filter((id) => id !== glow) } : p,
    ),
    instances: {
      ...state.instances,
      [glow]: { ...mustInstance(state, glow), attachedTo: host, controllerId: P1, faceup: true },
      [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, glow] },
    },
  };
}
const exhausted = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), exhausted: true } },
});
const identityOf = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).identity.instanceId;
const acceptTriggers = (state: GameState): readonly string[] =>
  state.pendingChoice?.prompt.kind === "chooseTriggers"
    ? state.pendingChoice.options.map((o) => o.optionId)
    : defaultPick(state);
function run(state: GameState, commands: readonly Command[], pick = acceptTriggers) {
  const driven = driveSession(startSession(state), deps, commands, pick);
  return { state: driven.session.state, events: driven.events, session: driven.session };
}
const playFree = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const expectReplay = (session: ReturnType<typeof run>["session"], state: GameState) => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(state);
};

describe("§3.22 Valkyrie: set aside, and played from set aside as if from hand", () => {
  it("'Play the set-aside Death-Glow upgrade as if it were in your hand' plays it, paid for, onto the chosen enemy", () => {
    const { state: base, glow } = start();
    const minion = minionEngagedWith(base, FRAIL.id);
    const perception = playerCardIntoPlay(minion.state, PERCEPTION.id);
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTarget") return [minion.id];
      if (choice?.prompt.kind === "spendResources") return [choice.options[0]!.optionId];
      return defaultPick(state);
    };
    const handBefore = mustPlayer(perception.state, P1).hand.length;
    const { state, session } = run(
      perception.state,
      [
        {
          type: "useAbility",
          playerId: P1,
          cardInstanceId: perception.id,
          abilityId: PERCEPTION_ACTION.ref.id,
          payment: [],
        },
      ],
      pick,
    );
    expect(mustInstance(state, glow).attachedTo).toBe(minion.id);
    expect(mustPlayer(state, P1).setAside).not.toContain(glow);
    expect(mustPlayer(state, P1).hand.length).toBe(handBefore - 1); // one card spent for its cost of 1
    expectReplay(session, state);
  });

  it("offers nothing when the card is not set aside (it is in hand instead)", () => {
    const { state: base, glow } = start();
    const inHand: GameState = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((id) => id !== glow), hand: [...p.hand, glow] } : p,
      ),
    };
    const minion = minionEngagedWith(inHand, FRAIL.id);
    const perception = playerCardIntoPlay(minion.state, PERCEPTION.id);
    const { state } = run(perception.state, [
      {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: perception.id,
        abilityId: PERCEPTION_ACTION.ref.id,
        payment: [],
      },
    ]);
    expect(mustInstance(state, glow).attachedTo).toBeNull();
    expect(mustPlayer(state, P1).hand).toContain(glow);
  });
});

describe("§3.22 Death-Glow: set aside when its enemy is defeated; 'if Valkyrie defeated that enemy' (extensionOf)", () => {
  it("her basic attack defeats it: Death-Glow goes to her set-aside area and she readies; the 'with Death-Glow' response fires", () => {
    const { state: base, glow } = start();
    const minion = minionEngagedWith(base, FRAIL.id);
    const flight = playerCardIntoPlay(glowOn(minion.state, glow, minion.id), FLIGHT.id);
    const handBefore = mustPlayer(flight.state, P1).hand.length;
    const { state, session } = run(flight.state, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(flight.state), targetInstanceId: minion.id },
    ]);
    expect(mustPlayer(state, P1).setAside).toContain(glow);
    expect(mustInstance(state, identityOf(state)).exhausted).toBe(false);
    expect(mustPlayer(state, P1).hand.length).toBe(handBefore + 1);
    expectReplay(session, state);
  });

  it("an event she played dealt the defeating damage: still her (an extension of her identity), so she readies", () => {
    const { state: base, glow } = start();
    const minion = minionEngagedWith(base, FRAIL.id);
    const tired = exhausted(glowOn(minion.state, glow, minion.id), identityOf(base));
    const blast = giveCard(tired, P1, BLAST.id);
    const { state } = run(blast.state, [playFree(blast.id)]);
    expect(mustPlayer(state, P1).setAside).toContain(glow);
    expect(mustInstance(state, identityOf(state)).exhausted).toBe(false);
  });

  it("an ally defeated it: Death-Glow is set aside all the same, but she does not ready", () => {
    const { state: base, glow } = start();
    const minion = minionEngagedWith(base, FRAIL.id);
    const squire = playerCardIntoPlay(exhausted(glowOn(minion.state, glow, minion.id), identityOf(base)), SQUIRE.id);
    const { state } = run(squire.state, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: squire.id, targetInstanceId: minion.id },
    ]);
    expect(mustPlayer(state, P1).setAside).toContain(glow);
    expect(mustInstance(state, identityOf(state)).exhausted).toBe(true);
  });
});

describe("§3.22 'while attacking / defending against the enemy with Death-Glow attached' (attackInProgress)", () => {
  it("Dragonfang: +2 ATK attacking the Death-Glow enemy, +1 attacking another", () => {
    const { state: base, glow } = start();
    const marked = minionEngagedWith(base, STURDY.id);
    const other = minionEngagedWith(marked.state, STURDY.id);
    const fang = playerCardIntoPlay(glowOn(other.state, glow, marked.id), FANG.id);
    const attack = (target: InstanceId): Command => ({
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(fang.state),
      targetInstanceId: target,
    });
    expect(mustInstance(run(fang.state, [attack(marked.id)]).state, marked.id).damage).toBe(2 + 2);
    expect(mustInstance(run(fang.state, [attack(other.id)]).state, other.id).damage).toBe(2 + 1);
  });

  it("Valkyrie's Spear: +2 DEF defending against the Death-Glow enemy", () => {
    const { state: base, glow } = start();
    const marked = minionEngagedWith(base, STURDY.id);
    const spear = playerCardIntoPlay(glowOn(marked.state, glow, marked.id), SPEAR.id);
    const provoke = giveCard(spear.state, P1, PROVOKE.id);
    const defend = (state: GameState): readonly string[] =>
      state.pendingChoice?.prompt.kind === "declareDefender" ? [identityOf(state)] : acceptTriggers(state);
    const { state } = run(provoke.state, [playFree(provoke.id)], defend);
    // ATK 4 − (DEF 2 + 2) = 0.
    expect(mustInstance(state, identityOf(state)).damage).toBe(0);
  });
});

describe("§3.22 'declare Valkyrie the defender without exhausting her' and 'use its ATK instead of its DEF'", () => {
  it("Shieldmaiden: an exhausted hero defends as a basic defense, her DEF reducing the damage, and nobody is asked to declare", () => {
    const { state: base, glow } = start();
    const marked = minionEngagedWith(base, STURDY.id);
    const tired = exhausted(glowOn(marked.state, glow, marked.id), identityOf(base));
    const shield = giveCard(tired, P1, SHIELD.id);
    const provoke = giveCard(shield.state, P1, PROVOKE.id);
    const asked: string[] = [];
    const pick = (state: GameState): readonly string[] => {
      if (state.pendingChoice?.prompt.kind === "declareDefender") asked.push("declareDefender");
      return acceptTriggers(state);
    };
    const { state, events, session } = run(provoke.state, [playFree(provoke.id)], pick);
    expect(asked).toEqual([]);
    // ATK 4 − DEF 2 = 2, dealt to the hero, who stays exhausted.
    expect(mustInstance(state, identityOf(state)).damage).toBe(2);
    expect(mustInstance(state, identityOf(state)).exhausted).toBe(true);
    const defended = events.filter(
      (e) => e.type === "triggerEvent" && e.event.kind === "defended" && e.phase === "initiated",
    );
    expect(defended).toHaveLength(1);
    expectReplay(session, state);
  });

  it("The Best Defense…: her basic defense reduces the damage by her ATK instead of her DEF", () => {
    const { state: base, glow } = start();
    const marked = minionEngagedWith(base, STURDY.id);
    const best = giveCard(glowOn(marked.state, glow, marked.id), P1, BEST.id);
    const provoke = giveCard(best.state, P1, PROVOKE.id);
    const defend = (state: GameState): readonly string[] =>
      state.pendingChoice?.prompt.kind === "declareDefender" ? [identityOf(state)] : acceptTriggers(state);
    // DEF 2 and ATK 2 would not tell them apart: Dragonfang (+1 ATK when not attacking) makes her ATK 3.
    const fang = playerCardIntoPlay(provoke.state, FANG.id);
    const { state, session } = run(fang.state, [playFree(provoke.id)], defend);
    // ATK 4 − her ATK 3 = 1 (with DEF it would have been 2).
    expect(mustInstance(state, identityOf(state)).damage).toBe(1);
    expectReplay(session, state);
  });
});

describe("§3.22 Thor: 'resolve this attack against each minion engaged with that player' (resolveAttackAgainst)", () => {
  it("one basic attack deals Thor's ATK to every engaged minion, once each; his interrupt does not re-trigger", () => {
    const { state: base } = start();
    const a = minionEngagedWith(base, STURDY.id);
    const b = minionEngagedWith(a.state, STURDY.id);
    const c = minionEngagedWith(b.state, STURDY.id);
    const thor = playerCardIntoPlay(c.state, THOR.id);
    const { state, events, session } = run(thor.state, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: thor.id, targetInstanceId: a.id },
    ]);
    expect([a.id, b.id, c.id].map((id) => mustInstance(state, id).damage)).toEqual([2, 2, 2]);
    // One attack, so one consequential damage.
    expect(mustInstance(state, thor.id).damage).toBe(1);
    const windows = events.filter(
      (e): e is Extract<GameEvent, { type: "windowOpened" }> =>
        e.type === "windowOpened" && e.candidates.some((c) => c.abilityId === THOR_INTERRUPT.ref.id),
    );
    expect(windows).toHaveLength(1);
    expectReplay(session, state);
  });
});
