/**
 * docs/phase7-wave7.md §3.44: a minion that stays in play attached to an ally it treats as a minion, and the encounter
 * attachment of the same family. Synthetic cards shaped like "When Defeated: Attach [this minion] to the non-[PSIONIC]
 * ally with the highest cost. Attached ally engages its controller. Treat attached ally as a [POSSESSED] minion with a
 * blank text box (except for traits). Attached minion's SCH is equal to its THW and it does not take consequential
 * damage." and "Treat attached ally as a ['POOL] minion with a blank text box. Attached minion's SCH is equal to its
 * printed THW and it does not take consequential damage. When Revealed: Attach to the ally with the highest cost
 * without [this card] attached. Attached ally engages its controller. Otherwise, this card gains surge." (erratum, RRG
 * 1.8 p. 69).
 *
 * Sources: RRG 1.8 FAQ "Malice (#199)" (p. 64), five bullets; ruling, Dec 17, 2025 (1) #3 (a status change: the
 * character "retains all tokens and attachments"); ruling, Jun 25, 2026 (4) #5 ("Characters not under player control
 * are not friendly characters"); owner decisions §4.1 Q26 (a minion only, never "an attachment") and Q27 ("its THW" is
 * the ally's THW with its modifiers, "its printed THW" the printed value).
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { characterProfile, isMinion, locateCard, minionsEngagedWith, mustInstance } from "./query.js";
import { cannotActivate } from "./rules.js";
import {
  activeAbilityRefs,
  categoriesOf,
  controllerOf,
  isAlly,
  isAttachedMinion,
  matchesQuery,
  traitsOf,
} from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubAttachment, stubEvent, stubMinion, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { ALLY, giveCard, TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const POSSESSED = trait("POSSESSED");
const PSIONIC = trait("PSIONIC");
const MARAUDER = trait("MARAUDER");
const ASGARD = trait("ASGARD");
const POOL = trait("POOL");
const self: TargetRef = { kind: "self" };
const host: TargetRef = { kind: "host" };
const one = { kind: "const", value: 1 } as const;
const named = (name: string): TargetRef => ({ kind: "named", name });

const HEIMDALL_CONSTANT = stubAbility("heimdall.constant", {
  trigger: { kind: "constant", rules: [{ kind: "excludedFromAllyLimit", target: { self: true } }] },
  effects: [],
});
/** The ally with the highest cost that is not [PSIONIC]: cost 4, THW 3. */
const HEIMDALL = {
  ...stubAlly({ id: "heimdall", cost: 4, atk: 2, thw: 3, hp: 5, traits: [ASGARD], abilities: [HEIMDALL_CONSTANT.ref] }),
  name: "Heimdall",
};
/** Costs more, but is [PSIONIC]: never the host of the possessing minion. */
const TELEPATH = stubAlly({ id: "telepath", cost: 6, atk: 1, thw: 1, hp: 3, traits: [PSIONIC] });

/** "The non-[PSIONIC] ally with the highest cost", every player's allies. */
const HIGHEST_COST_NON_PSIONIC: TargetRef = {
  kind: "superlative",
  among: { kind: "each", query: { categories: ["ally"], withoutTrait: PSIONIC } },
  order: "highest",
  measure: { kind: "printedCost", of: { kind: "slot", slot: "candidate" } },
  ties: "first",
};
const ENGAGE_HOST: EffectSpec = { kind: "engage", minion: host, player: { kind: "controllerOf", target: host } };

const POSSESSOR_DEFEATED = stubAbility("possessor.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "attach", card: self, to: HIGHEST_COST_NON_PSIONIC }, ENGAGE_HOST],
});
/** "… SCH is equal to its THW": the `"current"` reading (Q27). */
const POSSESSOR_CONSTANT = stubAbility("possessor.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "treatHostAsMinion", traits: [POSSESSED], keepPrintedTraits: true, schFromThw: "current" }],
  },
  effects: [],
});
const POSSESSOR = stubMinion({
  id: "possessor",
  atk: 1,
  sch: 1,
  hp: 1,
  traits: [MARAUDER],
  abilities: [POSSESSOR_DEFEATED.ref, POSSESSOR_CONSTANT.ref],
});

/** "… SCH is equal to its printed THW": the printed reading. */
const POOLIZED_CONSTANT = stubAbility("pool-ized.constant", {
  trigger: { kind: "constant", rules: [{ kind: "treatHostAsMinion", traits: [POOL], schFromThw: true }] },
  effects: [],
});
const POOLIZED_REVEALED = stubAbility("pool-ized.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "if",
      condition: { kind: "isAttached", of: self },
      then: [ENGAGE_HOST],
      otherwise: [{ kind: "gainSurge" }],
    },
  ],
});
const POOLIZED = stubAttachment({
  id: "pool-ized",
  name: "Pool-ized",
  attachesTo: {
    kind: "superlative",
    among: "ally",
    order: "highest",
    measure: "printedCost",
    withoutAttachmentNamed: "Pool-ized",
  },
  abilities: [POOLIZED_CONSTANT.ref, POOLIZED_REVEALED.ref],
});

/** "Each character gets +1 THW." */
const INSPIRED = stubAbility("inspired.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "thw", amount: 1, target: { categories: ["character"] } }] },
  effects: [],
});
const INSPIRING = stubSupport({ id: "inspiring", cost: 0, abilities: [INSPIRED.ref] });
/** A player upgrade: "Attach to a minion." */
const SNARE = { ...stubUpgrade({ id: "snare", cost: 0 }), attachesTo: { kind: "minion" as const } };
/** A player upgrade already on the ally when it is possessed: "Attach to an ally." */
const SHIELD = { ...stubUpgrade({ id: "shield", cost: 0 }), attachesTo: { kind: "ally" as const } };

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ATTACHMENTS: TargetQuery = { categories: ["attachment"] };
const HIT = event("hit", [{ kind: "dealDamage", target: named("possessor"), amount: one }]);
const MEND = event("mend", [{ kind: "heal", target: named("possessor"), amount: one }]);
const SLAY = event("slay", [{ kind: "defeat", target: named("possessor") }]);
const WOUND = event("wound", [{ kind: "placeDamage", target: named("Heimdall"), amount: one }]);
const TIRE = event("tire", [{ kind: "exhaust", target: named("Heimdall") }]);
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const RALLY = event("rally", [
  { kind: "enemyActivation", enemies: { kind: "each", query: { categories: ["minion"] } }, boost: false },
]);
const PURGE = event("purge", [{ kind: "discardFromPlay", target: { kind: "each", query: ATTACHMENTS } }]);
const BANISH = event("banish", [{ kind: "discardFromPlay", target: named("Heimdall") }]);
const EXORCISE = event("exorcise", [{ kind: "discardFromPlay", target: named("possessor") }]);
const STRIKE = event("strike", [
  { kind: "dealDamage", target: named("Heimdall"), amount: { kind: "const", value: 9 } },
]);
const EVENTS = [HIT, MEND, SLAY, WOUND, TIRE, REVEAL, RALLY, PURGE, BANISH, EXORCISE, STRIKE];

const deps: EngineDeps = depsOf(
  HEIMDALL_CONSTANT,
  POSSESSOR_DEFEATED,
  POSSESSOR_CONSTANT,
  POOLIZED_CONSTANT,
  POOLIZED_REVEALED,
  INSPIRED,
  ...EVENTS.map((e) => e.ability),
);

interface Table {
  readonly state: GameState;
  readonly heimdall: InstanceId;
  readonly possessor: InstanceId;
  readonly events: readonly GameEvent[];
  readonly session: GameSession;
}

/**
 * Heimdall (1 damage) beside a cheaper ally and a costlier [PSIONIC] one, the possessing minion engaged with the
 * player; `allies: false` leaves only the [PSIONIC] ally. `equipped`: Heimdall is exhausted with a player upgrade on him
 * before the minion is defeated.
 */
function table(options: { readonly allies?: boolean; readonly equipped?: boolean } = {}): Table {
  let state = gameAtFirstTurn({
    cards: [HEIMDALL, TELEPATH, POSSESSOR, POOLIZED, INSPIRING, SNARE, SHIELD, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [POSSESSOR.id, POOLIZED.id, POOLIZED.id, ...copiesOf(TREACHERY.id, 10)],
    deck: [HEIMDALL.id, TELEPATH.id, INSPIRING.id, SNARE.id, SHIELD.id, ...EVENTS.map((e) => e.card.id)],
  });
  state = playerCardIntoPlay(state, TELEPATH.id).state;
  let heimdall = "" as InstanceId;
  if (options.allies !== false) {
    state = playerCardIntoPlay(state, ALLY.id).state;
    const placed = playerCardIntoPlay(state, HEIMDALL.id);
    heimdall = placed.id;
    state = playFree(placed.state, deps, WOUND.card.id).state;
  }
  if (options.equipped) state = playOnto(playFree(state, deps, TIRE.card.id).state, SHIELD.id, heimdall).state;
  const engaged = minionEngagedWith(state, POSSESSOR.id);
  return { state: engaged.state, heimdall, possessor: engaged.id, events: [], session: startSession(engaged.state) };
}

/** Plays a 0-cost upgrade from hand onto `hostId`. */
function playOnto(state: GameState, card: typeof SHIELD.id, hostId: InstanceId) {
  const given = giveCard(state, P1, card);
  const { session, events } = driveSession(startSession(given.state), deps, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: hostId },
  ]);
  return { state: session.state, events, id: given.id };
}

/** The possessing minion defeated by 1 damage: its When Defeated resolves. */
function possessed(options: Parameters<typeof table>[0] = {}): Table {
  const before = table(options);
  const { state, events, session } = playFree(before.state, deps, HIT.card.id);
  return { ...before, state, events, session };
}
const play = (state: GameState, card: typeof HIT, more: readonly Command[] = []) =>
  playFree(state, deps, card.card.id, P1, more);
const defeatsOf = (events: readonly GameEvent[], id: InstanceId): number =>
  events.filter((e) => e.type === "characterDefeated" && e.instanceId === id).length;
const inEncounterDiscard = (state: GameState, id: InstanceId): boolean =>
  locateCard(state, id)?.kind === "encounterDiscard";

describe("§3.44 FAQ 'Malice (#199)': a minion attached to an ally by its own When Defeated", () => {
  it("bullet 1: she retains the minion card type, and is no attachment (Q26)", () => {
    const { state, heimdall, possessor, events, session } = possessed();
    expect(mustInstance(state, possessor).attachedTo).toBe(heimdall);
    expect(locateCard(state, possessor)).toEqual({ kind: "attachment", hostInstanceId: heimdall });
    expect(isAttachedMinion(state, possessor)).toBe(true);
    expect(isMinion(state, possessor)).toBe(true);
    expect(categoriesOf(state, possessor)).toEqual(["minion", "enemy", "character"]);
    expect(traitsOf(state, possessor)).toEqual([MARAUDER]);
    // Defeated once: the defeat happened and its responses hear it, though she never left play.
    expect(defeatsOf(events, possessor)).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("bullet 2: she retains any damage on her", () => {
    const { state, possessor } = possessed();
    expect(mustInstance(state, possessor).damage).toBe(1);
    expect(characterProfile(state, possessor, deps)?.maxHp).toBe(1);
  });

  it("bullet 3: she can be attacked and damaged like any minion, but is not defeated again, healed or not", () => {
    const { state, heimdall, possessor } = possessed();
    const attacker = playerCardIntoPlay(state, ALLY.id);
    const attacked = driveSession(startSession(attacker.state), deps, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: attacker.id, targetInstanceId: possessor },
    ]);
    expect(mustInstance(attacked.session.state, possessor).damage).toBe(3);
    expect(defeatsOf(attacked.events, possessor)).toBe(0);
    // Healed to full, then at zero hit points again: still no second defeat.
    const mended = play(attacked.session.state, MEND);
    expect(mustInstance(mended.state, possessor).damage).toBe(2);
    const again = play(play(play(mended.state, MEND).state, MEND).state, HIT);
    expect(mustInstance(again.state, possessor).damage).toBe(1);
    expect(defeatsOf(again.events, possessor)).toBe(0);
    // Nor by an effect that says "defeat".
    const slain = play(again.state, SLAY);
    expect(defeatsOf(slain.events, possessor)).toBe(0);
    expect(mustInstance(slain.state, possessor).attachedTo).toBe(heimdall);
    expect(isMinion(slain.state, heimdall)).toBe(true);
  });

  it("bullet 3, Q26: a player card that attaches to a minion can attach to her; 'an attachment' never names her", () => {
    const { state, heimdall, possessor } = possessed();
    const snared = playOnto(state, SNARE.id, possessor);
    expect(mustInstance(snared.state, possessor).attachments).toEqual([snared.id]);
    expect(
      matchesQuery(state, possessor, ATTACHMENTS, {
        selfInstanceId: null,
        controllerId: P1,
        event: null,
        bindings: {},
        deps,
      }),
    ).toBe(false);
    // "Discard each attachment": she stays, and so the ally stays a minion.
    const purged = play(state, PURGE).state;
    expect(mustInstance(purged, possessor).attachedTo).toBe(heimdall);
    expect(isMinion(purged, heimdall)).toBe(true);
  });

  it("bullet 4: she is engaged with no player and cannot activate, whatever aims an activation at her", () => {
    const { state, possessor } = possessed();
    expect(mustInstance(state, possessor).engagedWith).toBeNull();
    expect(minionsEngagedWith(state, P1)).not.toContain(possessor);
    expect(cannotActivate(state, deps, possessor)).toBe(true);
    const rallied = play(state, RALLY);
    expect(rallied.events.filter((e) => e.type === "activationBlocked").map((e) => e.enemyInstanceId)).toEqual([
      possessor,
    ]);
  });

  it("bullet 5: she is discarded when the card she is attached to leaves play", () => {
    const { state, heimdall, possessor } = possessed();
    const banished = play(state, BANISH).state;
    expect(inEncounterDiscard(banished, possessor)).toBe(true);
    expect(mustInstance(banished, possessor).damage).toBe(0);
    expect(locateCard(banished, heimdall)).toEqual({ kind: "discard", playerId: P1 });
    // The possessed ally defeated: it goes to its owner's discard pile, she to the encounter discard pile.
    const struck = play(state, STRIKE);
    expect(defeatsOf(struck.events, heimdall)).toBe(1);
    expect(locateCard(struck.state, heimdall)).toEqual({ kind: "discard", playerId: P1 });
    expect(inEncounterDiscard(struck.state, possessor)).toBe(true);
  });
});

describe("§3.44 the host ally while a minion is attached to it", () => {
  it("attaches to the non-[PSIONIC] ally with the highest cost, which engages its controller as a minion", () => {
    const { state, heimdall } = possessed();
    expect(categoriesOf(state, heimdall)).toEqual(["minion", "enemy", "character"]);
    expect(minionsEngagedWith(state, P1)).toContain(heimdall);
    expect(mustInstance(state, heimdall).engagedWith).toBe(P1);
    expect(locateCard(state, heimdall)).toEqual({ kind: "playArea", playerId: P1 });
    // "A blank text box (except for traits)": its printed traits beside the new one, no abilities.
    expect([...traitsOf(state, heimdall)].sort()).toEqual([ASGARD, POSSESSED].sort());
    expect(activeAbilityRefs(state, heimdall, deps)).toEqual([]);
  });

  it("it is not its controller's ally: not friendly, not counted for the ally limit, not usable on their turn", () => {
    const { state, heimdall } = possessed();
    expect(isAlly(state, heimdall)).toBe(false);
    expect(controllerOf(state, heimdall)).toBeNull();
    // The ally limit counts `isAlly` cards the player controls (`resolve/enter-play.ts`): neither holds.
    const actions = legalActions(state, P1, deps);
    expect(actions.kind).toBe("turn");
    expect(
      actions.kind === "turn" &&
        actions.legal.some((a) => "attackerInstanceId" in a.action && a.action.attackerInstanceId === heimdall),
    ).toBe(false);
  });

  it("it keeps its damage, its exhaustion and its own attachments, and can be attacked by players", () => {
    const { state, heimdall } = possessed({ equipped: true });
    const [shield] = mustInstance(state, heimdall).attachments;
    expect(shield && mustInstance(state, shield).cardId).toBe(SHIELD.id);
    expect(mustInstance(state, heimdall).attachments).toHaveLength(2);
    expect(mustInstance(state, heimdall).damage).toBe(1);
    expect(mustInstance(state, heimdall).exhausted).toBe(true);
    const attacker = playerCardIntoPlay(state, ALLY.id);
    const attacked = driveSession(startSession(attacker.state), deps, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: attacker.id, targetInstanceId: heimdall },
    ]).session.state;
    expect(mustInstance(attacked, heimdall).damage).toBe(3);
  });

  it("it activates against the player it engaged, as a minion: no consequential damage", () => {
    // The identity is in alter-ego form, so the activation is a scheme (RRG 1.8 "Activation", p. 6).
    const { state, heimdall } = possessed();
    const before = mustInstance(state, state.mainScheme.instanceId).threat;
    const rallied = play(state, RALLY).state;
    expect(mustInstance(rallied, rallied.mainScheme.instanceId).threat).toBe(before + 3);
    expect(mustInstance(rallied, heimdall).damage).toBe(1);
  });

  it("Q27: 'SCH is equal to its THW' reads the ally's THW with its modifiers; 'its printed THW' the printed value", () => {
    const current = possessed();
    expect(characterProfile(current.state, current.heimdall, deps)?.sch).toBe(3);
    const inspired = playerCardIntoPlay(current.state, INSPIRING.id).state;
    expect(characterProfile(inspired, current.heimdall, deps)?.sch).toBe(4);
    // As a minion it has no THW of its own to use.
    expect(characterProfile(current.state, current.heimdall, deps)?.thw).toBe(0);

    // The attachment's "printed THW": the same +1 THW changes nothing. Two copies, so Heimdall gets the second.
    const before = table();
    const withBonus = playerCardIntoPlay(before.state, INSPIRING.id).state;
    const once = play(onTopOfEncounterDeck(withBonus, POOLIZED.id), REVEAL).state;
    const printed = play(onTopOfEncounterDeck(once, POOLIZED.id), REVEAL).state;
    expect(traitsOf(printed, before.heimdall)).toEqual([POOL]);
    expect(characterProfile(printed, before.heimdall, deps)?.sch).toBe(3);
  });

  it("with no eligible ally the When Defeated attaches nothing: she is discarded as any defeated minion", () => {
    const { state, possessor, events } = possessed({ allies: false });
    expect(defeatsOf(events, possessor)).toBe(1);
    expect(inEncounterDiscard(state, possessor)).toBe(true);
    expect(minionsEngagedWith(state, P1)).toEqual([]);
  });

  it("the treating minion discarded while the host stays: the host is its controller's ally again, as it was", () => {
    const { state, heimdall, possessor } = possessed({ equipped: true });
    const freed = play(state, EXORCISE).state;
    expect(inEncounterDiscard(freed, possessor)).toBe(true);
    expect(categoriesOf(freed, heimdall)).toEqual(["ally", "character"]);
    expect(controllerOf(freed, heimdall)).toBe(P1);
    expect(mustInstance(freed, heimdall).engagedWith).toBeNull();
    expect(traitsOf(freed, heimdall)).toEqual([ASGARD]);
    expect(activeAbilityRefs(freed, heimdall, deps)).toHaveLength(1);
    expect(mustInstance(freed, heimdall).damage).toBe(1);
    expect(mustInstance(freed, heimdall).exhausted).toBe(true);
    expect(mustInstance(freed, heimdall).attachments).toHaveLength(1);
  });
});

describe("§3.44 the attachment of the same family", () => {
  it("attaches to the ally with the highest cost without a copy, which engages its controller; else it surges", () => {
    const before = table();
    // The costliest ally here is the [PSIONIC] one: this card has no trait exception.
    const first = play(onTopOfEncounterDeck(before.state, POOLIZED.id), REVEAL);
    const telepath = minionsEngagedWith(first.state, P1).find(
      (id) => mustInstance(first.state, id).cardId === TELEPATH.id,
    );
    expect(telepath).toBeDefined();
    expect(traitsOf(first.state, telepath!)).toEqual([POOL]);
    expect(characterProfile(first.state, telepath!, deps)?.sch).toBe(1);
    expect(first.events.some((e) => e.type === "surgeTriggered")).toBe(false);
    // The second copy skips the ally that has one.
    const second = play(onTopOfEncounterDeck(first.state, POOLIZED.id), REVEAL).state;
    expect(traitsOf(second, before.heimdall)).toEqual([POOL]);
    expect(minionsEngagedWith(second, P1)).toContain(before.heimdall);

    // No ally at all: it attaches to nothing, is discarded and gains surge.
    const bare = gameAtFirstTurn({
      cards: [POOLIZED, ...EVENTS.map((e) => e.card)],
      deps,
      encounter: [POOLIZED.id, ...copiesOf(TREACHERY.id, 10)],
      deck: EVENTS.map((e) => e.card.id),
    });
    const surged = play(onTopOfEncounterDeck(bare, POOLIZED.id), REVEAL);
    expect(surged.events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
    expect(surged.state.encounterDecks[Object.keys(surged.state.encounterDecks)[0]!]!.discard).toHaveLength(2);
  });
});
