/**
 * docs/phase7-wave10-box-heroes.md B3.1: an additional cost to play a card (`additionalCostToPlay` on a printed
 * constant) that searches the encounter deck and its discard pile for a minion and puts it into play
 * (`AbilityCost.searchEncounterIntoPlay`), on synthetic cards shaped like Hunted (`cw` 56007: "As an additional cost
 * to play this upgrade, search the encounter deck and discard pile for a minion and put it into play engaged with you.
 * Attach Hunted to that minion and stun it.").
 *
 * Sources: RRG 1.8 "Cost" (p. 14): "A player must pay all additional costs simultaneously with the cost that is being
 * added to … if they cannot pay for all of the costs at once, then they do not pay any of the costs and the effect
 * associated with the costs does not occur." "Search" (p. 39): "If a player finds multiple cards that satisfy the
 * criteria of a search, the player chooses among those options", and "If any portion of a deck is searched, upon
 * completion of that game step, game function, or card ability, shuffle that entire deck." Ruling February 28, 2026 -
 * Ruling 1: "Any abilities triggered by paying a cost resolve immediately before the effect following the arrow
 * resolves"; Ruling 4: "Quickstrike triggers upon engagement". Owner decisions, 2026-10-11 (provisional): box-heroes
 * question 17 = A (with nothing to find the card cannot be played and is not offered) and question 18 = A (a
 * quickstrike minion attacks first in hero form, and is then stunned).
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubMinion, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard, withEncounterPiles } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const MINION: TargetQuery = { categories: ["minion"] };
const search = (zones: readonly ("deck" | "discard")[] = ["deck", "discard"]): AbilityCost => ({
  searchEncounterIntoPlay: { slot: "hunted", query: MINION, zones },
});
const STUN: EffectSpec = { kind: "giveStatus", target: { kind: "slot", slot: "hunted" }, status: "stunned" };

/** "As an additional cost to play this upgrade, search … for a minion and put it into play engaged with you. Attach to that minion and stun it." */
const HUNT_ABILITY = stubAbility("hunt.constant", {
  trigger: { kind: "constant", additionalCostToPlay: { attachToSlot: "hunted" } },
  cost: search(),
  effects: [STUN],
});
const HUNT = stubUpgrade({ id: "hunt", cost: 0, abilities: [HUNT_ABILITY.ref] });
/** The same with a printed cost of 2. */
const COSTLY_ABILITY = stubAbility("costly.constant", {
  trigger: { kind: "constant", additionalCostToPlay: { attachToSlot: "hunted" } },
  cost: search(),
  effects: [STUN],
});
const COSTLY = stubUpgrade({ id: "costly", cost: 2, abilities: [COSTLY_ABILITY.ref] });
/** The same search over the discard pile only. */
const DREDGE_ABILITY = stubAbility("dredge.constant", {
  trigger: { kind: "constant", additionalCostToPlay: { attachToSlot: "hunted" } },
  cost: search(["discard"]),
  effects: [STUN],
});
const DREDGE = stubUpgrade({ id: "dredge", cost: 0, abilities: [DREDGE_ABILITY.ref] });

/** "Your identity gains retaliate 1." */
const THORNS_ABILITY = stubAbility("thorns.constant", {
  trigger: {
    kind: "constant",
    keywordGrants: [
      { keyword: { name: "retaliate", value: 1 }, target: { categories: ["identity"], controller: "you" } },
    ],
  },
  effects: [],
});
const THORNS = stubSupport({ id: "thorns", cost: 0, abilities: [THORNS_ABILITY.ref] });

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 5, boostIcons: 0 });
const STRIKER = stubMinion({
  id: "striker",
  atk: 2,
  sch: 1,
  hp: 4,
  boostIcons: 0,
  keywords: [{ name: "quickstrike" }],
});
const GLASS = stubMinion({ id: "glass", atk: 2, sch: 1, hp: 1, boostIcons: 0, keywords: [{ name: "quickstrike" }] });
/** "Surge. When Revealed: deal 4 damage to the engaged player's identity." */
const LOUD_ABILITY = stubAbility("loud.revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "controller" } },
      amount: { kind: "const", value: 4 },
    },
  ],
});
const LOUD = stubMinion({
  id: "loud",
  atk: 1,
  sch: 1,
  hp: 3,
  boostIcons: 0,
  keywords: [{ name: "surge" }],
  abilities: [LOUD_ABILITY.ref],
});

const MINIONS = [GRUNT, BRUTE, STRIKER, GLASS, LOUD];
const CARDS = [HUNT, COSTLY, DREDGE, THORNS, BLANK, ...MINIONS];
const deps: EngineDeps = depsOf(HUNT_ABILITY, COSTLY_ABILITY, DREDGE_ABILITY, THORNS_ABILITY, LOUD_ABILITY);

/**
 * A game at the first turn whose encounter deck holds `inDeck` (third from the top on) among blank treacheries and
 * whose encounter discard pile holds `inDiscard`; every other minion is out of both piles.
 */
function start(inDeck: readonly string[], inDiscard: readonly string[] = []) {
  const state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [HUNT.id, COSTLY.id, DREDGE.id, THORNS.id],
    encounter: [...copiesOf(BLANK.id, 12), ...MINIONS.map((m) => m.id)],
  });
  const piles = activeEncounterDeck(state);
  const all = [...piles.deck, ...piles.discard];
  const codeOf = (id: InstanceId): string => mustInstance(state, id).cardId as string;
  const blanks = all.filter((id) => codeOf(id) === BLANK.id);
  const take = (code: string): InstanceId => all.find((id) => codeOf(id) === code)!;
  const deckIds = inDeck.map(take);
  const discardIds = inDiscard.map(take);
  return {
    state: withEncounterPiles(state, {
      deck: [...blanks.slice(0, 2), ...deckIds, ...blanks.slice(2)],
      discard: discardIds,
    }),
    deckIds,
    discardIds,
  };
}

const playOf = (id: InstanceId, extra: Partial<Extract<Command, { type: "playCard" }>> = {}): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
  ...extra,
});
const toHero: Command = { type: "changeForm", playerId: P1 };

function run(state: GameState, ...commands: readonly Command[]) {
  const { state: after, events, session } = runCommandsPicking(state, deps, defaultPick, ...commands);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(after);
  return { state: after, events };
}

function playAction(state: GameState, card: InstanceId) {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected P1's turn, got ${actions.kind}`);
  const isPlay = (a: { action: { kind: string; instanceId?: InstanceId } }) =>
    a.action.kind === "playCard" && a.action.instanceId === card;
  return { legal: actions.legal.find(isPlay), illegal: actions.illegal.find(isPlay) };
}

const identityOf = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const shuffles = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "deckShuffled" && e.zone.kind === "encounterDeck");
const stunned = (state: GameState, id: InstanceId): number => mustInstance(state, id).statuses.stunned;

describe("B3.1 the cost is paid with the play: the minion enters play, the upgrade attaches to it, its effects resolve", () => {
  it("one minion in the deck: offered at cost 0 with that minion as its target; engaged, attached, stunned, one shuffle", () => {
    const { state: seeded, deckIds } = start([GRUNT.id]);
    const [grunt] = deckIds as [InstanceId];
    const { state, id } = giveCard(seeded, P1, HUNT.id);
    const { legal } = playAction(state, id);
    expect(legal?.targets).toEqual([grunt]);
    expect(legal?.needsPayment).toBe(false);
    expect(legal?.example).toMatchObject({ type: "playCard", costChoices: { hunted: [grunt] } });

    const { state: after, events } = run(state, playOf(id));
    expect(mustPlayer(after, P1).playArea).toContain(grunt);
    expect(mustInstance(after, grunt).engagedWith).toBe(P1);
    expect(mustInstance(after, id).attachedTo).toBe(grunt);
    expect(mustInstance(after, grunt).attachments).toEqual([id]);
    expect(mustInstance(after, id).controllerId).toBe(P1);
    expect(stunned(after, grunt)).toBe(1);
    expect(activeEncounterDeck(after).deck).not.toContain(grunt);
    expect(activeEncounterDeck(after).deck).toHaveLength(activeEncounterDeck(state).deck.length - 1);
    expect(shuffles(events)).toHaveLength(1);
    expect(mustPlayer(after, P1).hand).not.toContain(id);
  });

  it("the shuffle is part of the cost: it comes before the minion enters play, which comes before the upgrade does", () => {
    const { state: seeded, deckIds } = start([GRUNT.id]);
    const [grunt] = deckIds as [InstanceId];
    const { state, id } = giveCard(seeded, P1, HUNT.id);
    const { events } = run(state, playOf(id));
    const at = (find: (e: GameEvent) => boolean) => events.findIndex(find);
    const shuffled = at((e) => e.type === "deckShuffled" && e.zone.kind === "encounterDeck");
    const minionIn = at((e) => e.type === "cardMoved" && e.instanceId === grunt && e.to.kind === "playArea");
    const upgradeIn = at((e) => e.type === "cardMoved" && e.instanceId === id && e.to.kind === "attachment");
    const stun = at((e) => e.type === "statusGiven" && e.instanceId === grunt);
    expect(shuffled).toBeGreaterThan(-1);
    expect(minionIn).toBeGreaterThan(shuffled);
    expect(upgradeIn).toBeGreaterThan(minionIn);
    expect(stun).toBeGreaterThan(upgradeIn);
  });

  it("a minion only in the discard pile is found there; the deck was searched too, so it is shuffled once", () => {
    const { state: seeded, discardIds } = start([], [BRUTE.id]);
    const [brute] = discardIds as [InstanceId];
    const { state, id } = giveCard(seeded, P1, HUNT.id);
    expect(playAction(state, id).legal?.targets).toEqual([brute]);
    const { state: after, events } = run(state, playOf(id));
    expect(mustInstance(after, brute).engagedWith).toBe(P1);
    expect(mustInstance(after, id).attachedTo).toBe(brute);
    expect(stunned(after, brute)).toBe(1);
    expect(activeEncounterDeck(after).discard).not.toContain(brute);
    expect(shuffles(events)).toHaveLength(1);
  });

  it("a search of the discard pile alone shuffles nothing and does not see a minion in the deck", () => {
    const { state: seeded, discardIds } = start([GRUNT.id], [BRUTE.id]);
    const [brute] = discardIds as [InstanceId];
    const { state, id } = giveCard(seeded, P1, DREDGE.id);
    expect(playAction(state, id).legal?.targets).toEqual([brute]);
    const { state: after, events } = run(state, playOf(id));
    expect(mustInstance(after, id).attachedTo).toBe(brute);
    expect(shuffles(events)).toHaveLength(0);
  });

  it("the minion is put into play, not revealed: no When Revealed and no surge", () => {
    const { state: seeded, deckIds } = start([LOUD.id]);
    const [loud] = deckIds as [InstanceId];
    const { state, id } = giveCard(seeded, P1, HUNT.id);
    const { state: after, events } = run(state, playOf(id));
    expect(mustInstance(after, loud).engagedWith).toBe(P1);
    expect(mustInstance(after, identityOf(after)).damage).toBe(0);
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(false);
    expect(events.some((e) => e.type === "encounterCardRevealed" && e.instanceId === loud)).toBe(false);
  });
});

describe("B3.1 question 17 = A: with nothing to find the card cannot be played and is not offered", () => {
  it("no minion in either pile: listed illegal with the cost's reason, the command is refused, nothing is shuffled", () => {
    const { state: seeded } = start([]);
    const { state, id } = giveCard(seeded, P1, HUNT.id);
    const { legal, illegal } = playAction(state, id);
    expect(legal).toBeUndefined();
    expect(illegal?.reason).toBe("no_valid_target");
    expect(illegal?.message).toBe(
      "the encounter deck or the encounter discard pile holds no card to search for (hunted)",
    );
    const result = applyCommand(state, playOf(id), deps);
    expect(result.ok).toBe(false);
    expect(activeEncounterDeck(state).deck).toEqual(activeEncounterDeck(seeded).deck);
  });

  it("a minion in the deck only does not pay a search of the discard pile", () => {
    const { state: seeded } = start([GRUNT.id]);
    const { state, id } = giveCard(seeded, P1, DREDGE.id);
    expect(playAction(state, id).legal).toBeUndefined();
    expect(applyCommand(state, playOf(id), deps).ok).toBe(false);
  });

  it("the resource cost and the search are paid together: short of resources, nothing is searched or shuffled", () => {
    const { state: seeded, deckIds } = start([GRUNT.id]);
    const [grunt] = deckIds as [InstanceId];
    const { state, id } = giveCard(seeded, P1, COSTLY.id);
    const result = applyCommand(state, playOf(id), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("insufficient_resources");
    expect(activeEncounterDeck(state).deck).toContain(grunt);
    // Paid in full, both happen.
    const { legal } = playAction(state, id);
    expect(legal?.needsPayment).toBe(true);
    const { state: after, events } = run(state, legal!.example);
    expect(mustInstance(after, id).attachedTo).toBe(grunt);
    expect(shuffles(events)).toHaveLength(1);
    expect(events).toContainEqual(expect.objectContaining({ type: "cardPlayed", instanceId: id, resourcesPaid: 2 }));
  });
});

describe("B3.1 the pick: the player chooses among the minions found", () => {
  it("two candidates: both are targets, the command must name one, and the one named enters play", () => {
    const { state: seeded, deckIds, discardIds } = start([GRUNT.id], [BRUTE.id]);
    const [grunt] = deckIds as [InstanceId];
    const [brute] = discardIds as [InstanceId];
    const { state, id } = giveCard(seeded, P1, HUNT.id);
    expect(playAction(state, id).legal?.targets).toEqual([grunt, brute]);

    const unnamed = applyCommand(state, playOf(id), deps);
    expect(unnamed.ok).toBe(false);
    if (!unnamed.ok) expect(unnamed.error.code).toBe("invalid_choice");

    const { state: after } = run(state, playOf(id, { costChoices: { hunted: [brute] } }));
    expect(mustInstance(after, id).attachedTo).toBe(brute);
    expect(mustInstance(after, brute).engagedWith).toBe(P1);
    expect(stunned(after, brute)).toBe(1);
    expect(activeEncounterDeck(after).deck).toContain(grunt);
    expect(stunned(after, grunt)).toBe(0);
  });

  it("a card that is no minion, two cards, and a host named on the command are all refused", () => {
    const { state: seeded, deckIds, discardIds } = start([GRUNT.id], [BRUTE.id]);
    const [grunt] = deckIds as [InstanceId];
    const [brute] = discardIds as [InstanceId];
    const { state, id } = giveCard(seeded, P1, HUNT.id);
    const blank = activeEncounterDeck(state).deck[0]!;
    const code = (command: Command) => {
      const result = applyCommand(state, command, deps);
      return result.ok ? "ok" : result.error.code;
    };
    expect(code(playOf(id, { costChoices: { hunted: [blank] } }))).toBe("no_valid_target");
    expect(code(playOf(id, { costChoices: { hunted: [grunt, brute] } }))).toBe("invalid_choice");
    expect(code(playOf(id, { costChoices: { hunted: [grunt] }, attachToInstanceId: identityOf(state) }))).toBe(
      "no_valid_target",
    );
  });
});

describe("B3.1 question 18 = A: what the cost triggers resolves before the card enters play", () => {
  it("a quickstrike minion (ATK 2) attacks first in hero form: 2 damage, then the upgrade attaches and it is stunned", () => {
    const { state: seeded, deckIds } = start([STRIKER.id]);
    const [striker] = deckIds as [InstanceId];
    const { state, id } = giveCard(seeded, P1, HUNT.id);
    const { state: after, events } = run(state, toHero, playOf(id));
    expect(mustInstance(after, identityOf(after)).damage).toBe(2);
    expect(mustInstance(after, id).attachedTo).toBe(striker);
    expect(stunned(after, striker)).toBe(1);
    const hit = events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === identityOf(after));
    const attached = events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === id && e.to.kind === "attachment",
    );
    const stun = events.findIndex((e) => e.type === "statusGiven" && e.instanceId === striker);
    expect(hit).toBeGreaterThan(-1);
    expect(attached).toBeGreaterThan(hit);
    expect(stun).toBeGreaterThan(attached);
  });

  it("in alter-ego form the quickstrike minion does not attack; it is stunned all the same", () => {
    const { state: seeded, deckIds } = start([STRIKER.id]);
    const [striker] = deckIds as [InstanceId];
    const { state, id } = giveCard(seeded, P1, HUNT.id);
    const { state: after } = run(state, playOf(id));
    expect(mustInstance(after, identityOf(after)).damage).toBe(0);
    expect(stunned(after, striker)).toBe(1);
  });

  it("the minion defeated by retaliate before the upgrade enters: the upgrade has no host and is discarded, unresolved", () => {
    const { state: seeded, deckIds } = start([GLASS.id]);
    const [glass] = deckIds as [InstanceId];
    const thorns = playerCardIntoPlay(seeded, THORNS.id);
    const { state, id } = giveCard(thorns.state, P1, HUNT.id);
    const { state: after, events } = run(state, toHero, playOf(id));
    expect(mustInstance(after, identityOf(after)).damage).toBe(2);
    expect(activeEncounterDeck(after).discard).toContain(glass);
    expect(mustPlayer(after, P1).discard).toContain(id);
    expect(mustInstance(after, id).attachedTo).toBeNull();
    expect(events).toContainEqual({ type: "playedUpgradeHasNoHost", instanceId: id, playerId: P1 });
    expect(events.some((e) => e.type === "statusGiven")).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: "cardPlayed", instanceId: id }));
  });
});
