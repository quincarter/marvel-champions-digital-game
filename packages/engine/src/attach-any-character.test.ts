/**
 * docs/phase7-wave6.md §3.49: a player upgrade attached to any character, by an effect (`attach`, `findCard`'s
 * `{ attachTo }`) or as a cost (`AbilityCost.attach`, `AbilityCost.dealDamage`), proven with a synthetic "charm" upgrade
 * shaped like Rogue's Touched (`rogue` 38002): Skin Contact (38001a, "Find Touched and attach it to another character")
 * and Energy Transfer (38007, "Hero Action: Find Touched and attach it to a character other than Rogue and deal 2 damage
 * to that character → heal 2 damage from Rogue and ready her"; both erratum RRG 1.8 p. 69).
 *
 * Sources: RRG 1.8 "Attach To" (p. 8: placed on a game element in play; discarded when that element leaves play; the
 * card's own "attach to" text is not resolved when an ability attaches it to a specific game element). "Ownership and
 * Control" (p. 31: cards enter play under their owner's control; control stays constant; a card leaving play goes to
 * its owner's out-of-play area). "Cost" (pp. 13–14: paid in full; with cards the payer controls or from their own
 * out-of-play areas; "If dealing damage is a cost, that cost is considered paid even if some or all of that damage is
 * prevented"). "Find" (p. 19), "Search" (p. 39). §4 Q30 (default, §4.1): another player's hero or alter-ego, any ally,
 * any minion and the villain are all hosts.
 *
 * Control of an attached upgrade (owner decision 2026-10-03), RRG 1.8 "Ownership and Control" (p. 31): "Upgrades
 * attached to a card controlled by a player other than the upgrade's owner are controlled by that other player."
 * "Upgrades on a card that changes control also change control to the same new controller." "A player controls the
 * cards in their own out-of-play areas." On an enemy or the villain (the scenario's, not a player's) it stays its
 * owner's. Its abilities are its controller's: "you" is the host's controller, and "Rogue" is its owner's identity
 * (`identityOf(ownerOf(self))`).
 *
 * Synthetic cards only; the engine never names a card.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import { createCtx, moveCard, updateInstance } from "./ctx.js";
import { applyCommand, replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState, ZoneId } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, seatIdentities } from "./testing/scenario.js";
import { minionEngagedWith, playerCardIntoPlay } from "./testing/wave3.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const you = { kind: "controller" } as const;

const counterOn = (target: TargetRef, counterType: string): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType,
  amount: { kind: "const", value: 1 },
});
/** "Action: Exhaust this → 1 'mine' counter on your identity, 1 'owners' counter on the identity of this card's owner." */
const CHARM_ACTION = stubAbility("charm.action", {
  trigger: { kind: "action" },
  cost: { exhaustSelf: true },
  effects: [
    counterOn({ kind: "identityOf", player: { kind: "controller" } }, "mine"),
    counterOn({ kind: "identityOf", player: { kind: "ownerOf", target: { kind: "self" } } }, "owners"),
  ],
});
const CHARM = stubUpgrade({ id: "charm", cost: 0, abilities: [CHARM_ACTION.ref] });
/** "Attach to an ally." (Inspired, Sky Cycle's shape), played from hand. */
const PATCH = { ...stubUpgrade({ id: "patch", cost: 0 }), attachesTo: { kind: "ally" } } as const;
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const GOON = stubMinion({ id: "goon", atk: 0, sch: 0, hp: 5 });
const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 3 });
const TWO_STAGE = stubVillain({
  id: "twostage",
  stages: [
    { hp: flat(5), atk: 0, sch: 0 },
    { hp: flat(30), atk: 0, sch: 0 },
  ],
});
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const CHARM_QUERY: TargetQuery = { categories: ["upgrade"], name: "charm" };
const FIND_MINE: TargetRef = { kind: "find", query: CHARM_QUERY, owner: you };
const P2_IDENTITY: TargetRef = { kind: "identityOf", player: { kind: "id", playerId: p2 } };
const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
/** "A character other than [your identity]". */
const OTHER_CHARACTER: TargetQuery = { categories: ["character"], excluding: { kind: "identityOf", player: you } };
const PAID: EffectSpec = {
  kind: "addCounters",
  target: { kind: "identityOf", player: you },
  counterType: "paid",
  amount: { kind: "const", value: 1 },
};

const actionEvent = (id: string, effects: readonly EffectSpec[], cost?: AbilityCost) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects, ...(cost ? { cost } : {}) });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attachTo = (id: string, host: TargetRef) =>
  actionEvent(id, [{ kind: "findCard", query: CHARM_QUERY, owner: you, to: { attachTo: host } }]);

/** "Find your charm and attach it to …" (the Skin Contact shape, with the host fixed so no choice is asked). */
const TO_VILLAIN = attachTo("to-villain", { kind: "villain" });
const TO_P2 = attachTo("to-p2", P2_IDENTITY);
const TO_GOON = attachTo("to-goon", named("goon"));
const TO_PAL = attachTo("to-pal", named("pal"));
/** "Attach your charm (in play) to …": the plain `attach` effect, host to host. */
const plainAttach = (id: string, to: TargetRef) =>
  actionEvent(id, [{ kind: "attach", card: { kind: "each", query: CHARM_QUERY }, to }]);
const MOVE_TO_P2 = plainAttach("move-to-p2", P2_IDENTITY);
const MOVE_TO_VILLAIN = plainAttach("move-to-villain", { kind: "villain" });
const MOVE_TO_P1 = plainAttach("move-to-p1", { kind: "identityOf", player: { kind: "id", playerId: p1 } });
/** Drivers for the host's changes. */
const FLIP_P2 = actionEvent("flip-p2", [{ kind: "changeForm", player: { kind: "id", playerId: p2 }, to: "hero" }]);
const SMASH_VILLAIN = actionEvent("smash-villain", [
  { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 5 } },
]);
const KILL_GOON = actionEvent("kill-goon", [
  { kind: "dealDamage", target: named("goon"), amount: { kind: "const", value: 5 } },
]);
const KILL_PAL = actionEvent("kill-pal", [
  { kind: "dealDamage", target: named("pal"), amount: { kind: "const", value: 3 } },
]);
/** "Find your charm and attach it to a character other than you and deal 2 damage to that character → (mark paid)." */
const TRANSFER = actionEvent("transfer", [PAID], {
  attach: { card: FIND_MINE, to: { slot: "host", query: OTHER_CHARACTER }, bind: "charm" },
  dealDamage: { target: { kind: "slot", slot: "host" }, amount: 2 },
});
/** "Find your charm and attach it to a minion → (mark paid)": no damage, so a host with one candidate is forced. */
const TO_A_MINION = actionEvent("to-a-minion", [PAID], {
  attach: { card: FIND_MINE, to: { slot: "host", query: { categories: ["minion"] } } },
});
/** "Find a charm (anyone's) and attach it to a minion →": the payer must still pay with their own. */
const ANY_TO_A_MINION = actionEvent("any-to-a-minion", [PAID], {
  attach: { card: { kind: "find", query: CHARM_QUERY }, to: { slot: "host", query: { categories: ["minion"] } } },
});

const EVENTS = [
  TO_VILLAIN,
  TO_P2,
  TO_GOON,
  TO_PAL,
  MOVE_TO_P2,
  MOVE_TO_VILLAIN,
  MOVE_TO_P1,
  FLIP_P2,
  SMASH_VILLAIN,
  KILL_GOON,
  KILL_PAL,
  TRANSFER,
  TO_A_MINION,
  ANY_TO_A_MINION,
];
const deps: EngineDeps = depsOf(CHARM_ACTION, ...EVENTS.map((e) => e.ability));
const BASE_CARDS = [
  ...DEFAULT_CARDS,
  TWO_STAGE,
  LONG_SCHEME,
  BLANK,
  GOON,
  PAL,
  CHARM,
  PATCH,
  ...EVENTS.map((e) => e.card),
];
const EVENT_IDS = EVENTS.map((e) => e.card.id as CardId);

function game(options: { readonly players?: number; readonly seed?: number } = {}): GameState {
  const identities = seatIdentities(
    stubIdentity({ id: "seeker", hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 }),
    options.players ?? 2,
  );
  const config: GameSetupConfig = {
    seed: options.seed ?? 11,
    cards: [...BASE_CARDS, ...identities],
    villainCardId: TWO_STAGE.id,
    mainSchemeCardId: LONG_SCHEME.id,
    encounterDeck: [...Array.from({ length: 12 }, () => BLANK.id as CardId), GOON.id, GOON.id],
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, ...EVENT_IDS, PAL.id, CHARM.id, PATCH.id],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const instancesOf = (state: GameState, card: { readonly id: CardId }): readonly InstanceId[] =>
  (Object.keys(state.instances) as InstanceId[]).filter((id) => state.instances[id]?.cardId === card.id);
const charmOf = (state: GameState, owner: PlayerId = p1): InstanceId =>
  instancesOf(state, CHARM).find((id) => state.instances[id]?.ownerId === owner)!;
const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const identityId = (state: GameState, player: PlayerId = p1): InstanceId =>
  mustPlayer(state, player).identity.instanceId;

/** A board with a minion engaged with p1 and p2's ally in play; returns their ids. */
function board(seed?: number) {
  const start = game(seed === undefined ? {} : { seed });
  const withGoon = minionEngagedWith(start, GOON.id, p1);
  const withPal = playerCardIntoPlay(withGoon.state, PAL.id, p2);
  return { state: withPal.state, goon: withGoon.id, pal: withPal.id };
}

/** Test-only state surgery: puts a card somewhere, faceup, through the engine's one way to move a card. */
function place(state: GameState, id: InstanceId, zone: ZoneId): GameState {
  const ctx = createCtx(state, deps);
  moveCard(ctx, id, zone, "top");
  updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
  return ctx.state;
}

/** Plays the event from p1's hand (cost 0), with any cost picks; returns the result. */
function attempt(state: GameState, card: { readonly id: CardId }, costChoices?: Record<string, readonly InstanceId[]>) {
  const given = giveCard(state, p1, card.id);
  const result = applyCommand(
    given.state,
    {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
      ...(costChoices ? { costChoices } : {}),
    },
    deps,
  );
  return { result, given };
}
function play(state: GameState, card: { readonly id: CardId }, costChoices?: Record<string, readonly InstanceId[]>) {
  const { result, given } = attempt(state, card, costChoices);
  if (!result.ok) throw new Error(result.error.message);
  expect(result.state.pendingChoice).toBeNull();
  return { state: result.state, events: result.events, before: given.state, eventId: given.id };
}

const typed = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** The hosts `legalActions` offers for playing `card` from p1's hand (empty when the play is not offered). */
function offeredHosts(state: GameState, card: { readonly id: CardId }): readonly InstanceId[] | null {
  const given = giveCard(state, p1, card.id);
  const legal = legalActions(given.state, p1, deps);
  if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
  const play = legal.legal.find((a) => a.example.type === "playCard" && a.example.cardInstanceId === given.id);
  return play ? play.targets : null;
}

const controlChanges = (events: readonly GameEvent[], id: InstanceId) =>
  typed(events, "controllerChanged").filter((e) => e.instanceId === id);

describe("§3.49 attach (effect): any character is a host; another player's card hands its player control (p. 31)", () => {
  it("the villain: on it, owned and controlled by p1", () => {
    const { state: start } = board();
    const charm = charmOf(start);
    const { state } = play(start, TO_VILLAIN.card);
    expect(mustInstance(state, villainId(state)).attachments).toEqual([charm]);
    expect(mustInstance(state, charm)).toMatchObject({ attachedTo: villainId(state), ownerId: p1, controllerId: p1 });
  });

  it("another player's identity in alter-ego form, then in hero form: still attached, p2 controls it", () => {
    const { state: start } = board();
    const charm = charmOf(start);
    expect(mustPlayer(start, p2).identity.form).toBe("alterEgo");
    const { state: onP2, events: attached } = play(start, TO_P2.card);
    expect(mustInstance(onP2, identityId(onP2, p2)).attachments).toEqual([charm]);
    expect(mustInstance(onP2, charm)).toMatchObject({
      attachedTo: identityId(onP2, p2),
      ownerId: p1,
      controllerId: p2,
    });
    expect(controlChanges(attached, charm)).toEqual([
      { type: "controllerChanged", instanceId: charm, from: p1, to: p2, reason: "attachedTo" },
    ]);
    // The host flips: the identity is the same card, so the charm stays on it (RRG 1.8 "Attach To", p. 8).
    const { state: flipped, events } = play(onP2, FLIP_P2.card);
    expect(mustPlayer(flipped, p2).identity.form).toBe("hero");
    expect(mustInstance(flipped, identityId(flipped, p2)).attachments).toEqual([charm]);
    expect(mustInstance(flipped, charm)).toMatchObject({ attachedTo: identityId(flipped, p2), controllerId: p2 });
    expect(typed(events, "cardMoved").filter((e) => e.instanceId === charm)).toEqual([]);
    expect(controlChanges(events, charm)).toEqual([]);
  });

  it("another player's ally (p2 controls it), then an enemy minion (back to p1, its owner)", () => {
    const { state: start, goon, pal } = board();
    const charm = charmOf(start);
    const { state: onPal } = play(start, TO_PAL.card);
    expect(mustInstance(onPal, pal).attachments).toEqual([charm]);
    expect(mustInstance(onPal, charm)).toMatchObject({ attachedTo: pal, controllerId: p2 });
    // Host to host: one move; off p2's card, the control p2 had from it ends (p. 31), and the scenario is no player.
    const { state: onGoon, events } = play(onPal, TO_GOON.card);
    expect(controlChanges(events, charm)).toEqual([
      { type: "controllerChanged", instanceId: charm, from: p2, to: p1, reason: "attachedTo" },
    ]);
    expect(mustInstance(onGoon, pal).attachments).toEqual([]);
    expect(mustInstance(onGoon, goon).attachments).toEqual([charm]);
    expect(mustInstance(onGoon, charm)).toMatchObject({ attachedTo: goon, controllerId: p1, ownerId: p1 });
    expect(typed(events, "cardMoved").filter((e) => e.instanceId === charm)).toEqual([
      {
        type: "cardMoved",
        instanceId: charm,
        cardId: CHARM.id,
        from: { kind: "attachment", hostInstanceId: pal },
        to: { kind: "attachment", hostInstanceId: goon },
      },
    ]);
  });

  it("a player card out of play whose controller had changed enters play under its owner's control (RRG p. 31)", () => {
    const { state: start } = board();
    const charm = charmOf(start);
    const stale = {
      ...start,
      instances: { ...start.instances, [charm]: { ...mustInstance(start, charm), controllerId: p2 } },
    };
    const { state } = play(stale, TO_VILLAIN.card);
    expect(mustInstance(state, charm).controllerId).toBe(p1);
  });

  it("the villain advances a stage: the charm carries over", () => {
    const { state: start } = board();
    const charm = charmOf(start);
    const { state: onVillain } = play(start, TO_VILLAIN.card);
    const { state, events } = play(onVillain, SMASH_VILLAIN.card);
    expect(typed(events, "villainStageAdvanced")).toHaveLength(1);
    expect(mustInstance(state, villainId(state)).attachments).toEqual([charm]);
    expect(mustInstance(state, charm)).toMatchObject({ attachedTo: villainId(state), controllerId: p1 });
  });
});

describe("§3.49 the host leaves play: the charm goes to its owner's discard pile, where a find finds it", () => {
  it("an enemy minion defeated: the charm is in p1's discard pile, not the encounter discard pile", () => {
    const { state: start, goon } = board();
    const charm = charmOf(start);
    const { state: onGoon } = play(start, TO_GOON.card);
    const { state } = play(onGoon, KILL_GOON.card);
    expect(state.instances[goon] && mustInstance(state, goon).attachments).toEqual([]);
    expect(mustPlayer(state, p1).discard).toContain(charm);
    expect(mustInstance(state, charm)).toMatchObject({ attachedTo: null });
    // §3.48: found there and attached again.
    const { state: again, events } = play(state, TO_VILLAIN.card);
    expect(typed(events, "cardFound")[0]).toMatchObject({ from: { kind: "discard", playerId: p1 } });
    expect(mustInstance(again, villainId(again)).attachments).toEqual([charm]);
  });

  it("another player's ally defeated: the charm goes to p1's discard pile, the ally to p2's", () => {
    const { state: start, pal } = board();
    const charm = charmOf(start);
    const { state: onPal } = play(start, TO_PAL.card);
    const { state } = play(onPal, KILL_PAL.card);
    expect(mustPlayer(state, p2).discard).toContain(pal);
    expect(mustPlayer(state, p1).discard).toContain(charm);
    expect(mustPlayer(state, p2).discard).not.toContain(charm);
  });
});

describe("§3.49 AbilityCost.attach: attach as a cost", () => {
  it("legalActions offers one host per character other than the payer's identity, in play order", () => {
    const { state, goon, pal } = board();
    const hosts = offeredHosts(state, TRANSFER.card);
    expect(new Set(hosts)).toEqual(new Set([villainId(state), identityId(state, p2), goon, pal]));
    expect(hosts).not.toContain(identityId(state, p1));
  });

  it("paid onto a minion: found in the deck, attached, the deck shuffled, then 2 damage, then the effects", () => {
    const { state: start, goon } = board();
    const charm = charmOf(start);
    expect(mustPlayer(start, p1).deck).toContain(charm);
    const { state, events } = play(start, TRANSFER.card, { host: [goon] });
    expect(mustInstance(state, goon).attachments).toEqual([charm]);
    expect(mustInstance(state, charm)).toMatchObject({ attachedTo: goon, controllerId: p1, faceup: true });
    expect(mustInstance(state, goon).damage).toBe(2);
    expect(mustInstance(state, identityId(state)).counters.paid).toBe(1);
    expect(typed(events, "cardFound")).toEqual([
      {
        type: "cardFound",
        instanceId: charm,
        cardId: CHARM.id,
        from: { kind: "deck", playerId: p1 },
        alreadyThere: false,
        deckShuffled: true,
      },
    ]);
    const at = (pred: (e: GameEvent) => boolean) => events.findIndex(pred);
    const found = at((e) => e.type === "cardFound");
    const moved = at((e) => e.type === "cardMoved" && e.instanceId === charm);
    const shuffled = at((e) => e.type === "deckShuffled");
    const damaged = at((e) => e.type === "damageDealt" && "targetInstanceId" in e && e.targetInstanceId === goon);
    const marked = at((e) => e.type === "counterAdded" && e.counterType === "paid");
    expect(found).toBeGreaterThanOrEqual(0);
    expect([found, moved, shuffled, damaged].every((i, n, all) => n === 0 || all[n - 1]! < i)).toBe(true);
    expect(damaged).toBeLessThan(marked);
  });

  it("paid onto another player's hero: p2 controls it (p. 31); the host takes the damage", () => {
    const { state: start } = board();
    const charm = charmOf(start);
    const p2Identity = identityId(start, p2);
    const { state, events } = play(start, TRANSFER.card, { host: [p2Identity] });
    expect(mustInstance(state, p2Identity).attachments).toEqual([charm]);
    expect(mustInstance(state, charm)).toMatchObject({ ownerId: p1, controllerId: p2 });
    expect(controlChanges(events, charm)).toEqual([
      { type: "controllerChanged", instanceId: charm, from: p1, to: p2, reason: "attachedTo" },
    ]);
    expect(mustInstance(state, p2Identity).damage).toBe(2);
  });

  it("near miss: the payer's own identity is refused, and nothing is paid", () => {
    const { state: start } = board();
    const { result, given } = attempt(start, TRANSFER.card, { host: [identityId(start, p1)] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("no_valid_target");
    expect(given.state.instances[charmOf(start)]?.attachedTo ?? null).toBeNull();
  });

  it("near miss: with several hosts, a command naming none is refused (the payer picks)", () => {
    const { state: start } = board();
    const { result } = attempt(start, TRANSFER.card);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_choice");
  });

  it("one candidate host: the pick is forced and may be omitted", () => {
    const { state: start, goon } = board();
    expect(offeredHosts(start, TO_A_MINION.card)).toEqual([goon]);
    const { state } = play(start, TO_A_MINION.card);
    expect(mustInstance(state, goon).attachments).toEqual([charmOf(start)]);
    expect(mustInstance(state, identityId(state)).counters.paid).toBe(1);
  });

  it("no legal host: not offered, and refused", () => {
    const start = game();
    expect(offeredHosts(start, TO_A_MINION.card)).toBeNull();
    const { result } = attempt(start, TO_A_MINION.card);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
  });

  it("no card to attach (removed from the game): not offered, and refused", () => {
    const { state: start } = board();
    const gone = place(start, charmOf(start), { kind: "removedFromGame" });
    expect(offeredHosts(gone, TRANSFER.card)).toBeNull();
    const { result } = attempt(gone, TRANSFER.card, { host: [villainId(gone)] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("card_not_in_zone");
  });

  it("only a card the payer may pay with: p2's charm in p2's discard pile is not used for p1's cost (RRG p. 14)", () => {
    const { state: start, goon } = board();
    const gone = place(start, charmOf(start, p1), { kind: "removedFromGame" });
    const theirs = place(gone, charmOf(gone, p2), { kind: "discard", playerId: p2 });
    expect(offeredHosts(theirs, ANY_TO_A_MINION.card)).toBeNull();
    // With p1's own back in p1's discard pile, that one pays, and p2's stays put.
    const mine = place(theirs, charmOf(theirs, p1), { kind: "discard", playerId: p1 });
    expect(offeredHosts(mine, ANY_TO_A_MINION.card)).toEqual([goon]);
    const { state } = play(mine, ANY_TO_A_MINION.card);
    expect(mustInstance(state, goon).attachments).toEqual([charmOf(state, p1)]);
    expect(mustPlayer(state, p2).discard).toContain(charmOf(state, p2));
  });

  it("the charm's current host is a legal pick: it stays, no move, and the cost is paid", () => {
    const { state: start, goon } = board();
    const charm = charmOf(start);
    const { state: onGoon } = play(start, TO_GOON.card);
    const { state, events } = play(onGoon, TRANSFER.card, { host: [goon] });
    expect(typed(events, "cardFound")[0]).toMatchObject({ alreadyThere: true, deckShuffled: false });
    expect(typed(events, "cardMoved").filter((e) => e.instanceId === charm)).toEqual([]);
    expect(mustInstance(state, goon).attachments).toEqual([charm]);
    expect(mustInstance(state, goon).damage).toBe(2);
    expect(mustInstance(state, identityId(state)).counters.paid).toBe(1);
  });

  it("dealing damage is paid even when it is all prevented (RRG 1.8 'Cost', p. 14): the effects still resolve", () => {
    const { state: start, goon } = board();
    const ctx = createCtx(start, deps);
    updateInstance(ctx, goon, (i) => ({ ...i, statuses: { ...i.statuses, tough: 1 } }));
    const { state } = play(ctx.state, TRANSFER.card, { host: [goon] });
    expect(mustInstance(state, goon).damage).toBe(0);
    expect(mustInstance(state, goon).statuses.tough).toBe(0);
    expect(mustInstance(state, goon).attachments).toEqual([charmOf(start)]);
    expect(mustInstance(state, identityId(state)).counters.paid).toBe(1);
  });
});

describe("RRG p. 31: an upgrade on a card another player controls is controlled by that player, by every route", () => {
  /** Plays PATCH from p1's hand onto `host`. */
  function playPatch(state: GameState, host: InstanceId) {
    const given = giveCard(state, p1, PATCH.id);
    const result = applyCommand(
      given.state,
      { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: host },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    return { state: result.state, events: result.events, id: given.id };
  }

  it("played from hand onto p2's ally: p2 controls it from the moment it is attached", () => {
    const { state: start, pal } = board();
    const { state, events, id } = playPatch(start, pal);
    expect(mustInstance(state, pal).attachments).toEqual([id]);
    expect(mustInstance(state, id)).toMatchObject({ attachedTo: pal, ownerId: p1, controllerId: p2 });
    expect(controlChanges(events, id)).toEqual([
      { type: "controllerChanged", instanceId: id, from: p1, to: p2, reason: "attachedTo" },
    ]);
  });

  it("near miss: played onto p1's own ally, p1 controls it and no change is logged", () => {
    const { state: start } = board();
    const mine = playerCardIntoPlay(start, PAL.id, p1);
    const { state, events, id } = playPatch(mine.state, mine.id);
    expect(mustInstance(state, id)).toMatchObject({ attachedTo: mine.id, controllerId: p1 });
    expect(controlChanges(events, id)).toEqual([]);
  });

  it("the plain attach effect, host to host: villain (p1) → p2's hero (p2) → villain (p1) → p1's hero (p1)", () => {
    const { state: start } = board();
    const charm = charmOf(start);
    const { state: onVillain } = play(start, TO_VILLAIN.card);
    expect(mustInstance(onVillain, charm).controllerId).toBe(p1);
    const { state: onP2, events: toP2 } = play(onVillain, MOVE_TO_P2.card);
    expect(mustInstance(onP2, charm)).toMatchObject({ attachedTo: identityId(onP2, p2), controllerId: p2 });
    expect(controlChanges(toP2, charm)).toEqual([
      { type: "controllerChanged", instanceId: charm, from: p1, to: p2, reason: "attachedTo" },
    ]);
    const { state: back, events: toVillain } = play(onP2, MOVE_TO_VILLAIN.card);
    expect(mustInstance(back, charm)).toMatchObject({ attachedTo: villainId(back), controllerId: p1 });
    expect(controlChanges(toVillain, charm)).toEqual([
      { type: "controllerChanged", instanceId: charm, from: p2, to: p1, reason: "attachedTo" },
    ]);
    const { state: onP1, events: toP1 } = play(back, MOVE_TO_P1.card);
    expect(mustInstance(onP1, charm)).toMatchObject({ attachedTo: identityId(onP1, p1), controllerId: p1 });
    expect(controlChanges(toP1, charm)).toEqual([]);
  });

  it("p2's card with it on changes control: the upgrade changes control with it", () => {
    const { state: start, pal } = board();
    const charm = charmOf(start);
    const { state: onPal } = play(start, TO_PAL.card);
    // Test-only state surgery standing in for an effect that hands the ally to p1; the next command's state checks
    // carry the upgrade along ("Upgrades on a card that changes control also change control", p. 31).
    const taken = {
      ...onPal,
      instances: { ...onPal.instances, [pal]: { ...mustInstance(onPal, pal), controllerId: p1 } },
    };
    const { state, events } = play(taken, FLIP_P2.card);
    expect(mustInstance(state, charm).controllerId).toBe(p1);
    expect(controlChanges(events, charm)).toEqual([
      { type: "controllerChanged", instanceId: charm, from: p2, to: p1, reason: "attachedTo" },
    ]);
  });

  it("its host leaves play: it goes to its owner's discard pile, controlled by its owner there", () => {
    const { state: start, pal } = board();
    const charm = charmOf(start);
    const { state: onPal } = play(start, TO_PAL.card);
    expect(mustInstance(onPal, charm)).toMatchObject({ attachedTo: pal, controllerId: p2 });
    const { state } = play(onPal, KILL_PAL.card);
    expect(mustPlayer(state, p1).discard).toContain(charm);
    expect(mustInstance(state, charm)).toMatchObject({ attachedTo: null, ownerId: p1, controllerId: p1 });
  });

  it("p2 uses its ability as its controller: 'you' is p2, its owner's identity is p1's; p1 cannot use it", () => {
    const { state: start } = board();
    const charm = charmOf(start);
    const { state: onP2 } = play(start, TO_P2.card);
    const use = (player: PlayerId) =>
      ({
        type: "useAbility",
        playerId: player,
        cardInstanceId: charm,
        abilityId: CHARM_ACTION.ref.id,
        payment: [],
      }) as const;
    // p1's turn: p1 does not control it.
    const p1Legal = legalActions(onP2, p1, deps);
    if (p1Legal.kind !== "turn") throw new Error(`expected a turn, got ${p1Legal.kind}`);
    expect(p1Legal.legal.some((a) => a.example.type === "useAbility" && a.example.cardInstanceId === charm)).toBe(
      false,
    );
    expect(applyCommand(onP2, use(p1), deps).ok).toBe(false);
    // p2's turn: p2 does.
    const p2Turn = runCommands(onP2, deps, { type: "endTurn", playerId: p1 }).state;
    const p2Legal = legalActions(p2Turn, p2, deps);
    if (p2Legal.kind !== "turn") throw new Error(`expected a turn, got ${p2Legal.kind}`);
    expect(p2Legal.legal.some((a) => a.example.type === "useAbility" && a.example.cardInstanceId === charm)).toBe(true);
    const used = runCommands(p2Turn, deps, use(p2)).state;
    expect(mustInstance(used, charm).exhausted).toBe(true);
    expect(mustInstance(used, identityId(used, p2)).counters.mine).toBe(1);
    expect(mustInstance(used, identityId(used, p1)).counters.owners).toBe(1);
    expect(mustInstance(used, identityId(used, p1)).counters.mine).toBeUndefined();
  });

  it("open question (RRG 1.8 'Cost', p. 14, as written): p1 cannot pay an attach cost with it while p2 controls it", () => {
    // "While a player is paying a cost, that player must pay costs with cards and/or game elements they control." Pinned
    // so a ruling the other way (Energy Transfer's "Find Touched" reaching another player's card) is a deliberate change.
    const { state: start } = board();
    const { state: onP2 } = play(start, TO_P2.card);
    expect(mustInstance(onP2, charmOf(onP2)).controllerId).toBe(p2);
    expect(offeredHosts(onP2, TRANSFER.card)).toBeNull();
    const { result } = attempt(onP2, TRANSFER.card, { host: [villainId(onP2)] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("card_not_in_zone");
  });

  it("a 2-player game where p1 attaches it to p2's hero and p2 uses it replays deep-equal", () => {
    const { state: start } = board(7);
    const charm = charmOf(start);
    const given = giveCard(start, p1, TO_P2.card.id);
    let session = startSession(given.state);
    for (const command of [
      { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      { type: "endTurn", playerId: p1 },
      { type: "useAbility", playerId: p2, cardInstanceId: charm, abilityId: CHARM_ACTION.ref.id, payment: [] },
    ] as const) {
      const result = sessionApply(session, command, deps);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    }
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
    expect(mustInstance(session.state, charm).controllerId).toBe(p2);
    expect(mustInstance(session.state, identityId(session.state, p2)).counters.mine).toBe(1);
  });
});

describe("§3.49 replay and the game without it", () => {
  it("a game that pays an attach cost replays deep-equal", () => {
    const { state: start, goon } = board(5);
    const given = giveCard(start, p1, TRANSFER.card.id);
    let session = startSession(given.state);
    for (const command of [
      {
        type: "playCard",
        playerId: p1,
        cardInstanceId: given.id,
        payment: [],
        attachToInstanceId: null,
        costChoices: { host: [goon] },
      },
      { type: "endTurn", playerId: p1 },
    ] as const) {
      const result = sessionApply(session, command, deps);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    }
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
    expect(mustInstance(session.state, goon).attachments).toEqual([charmOf(start)]);
  });

  it("a game with no attach cost binds no attach slot and finds nothing, round after round", () => {
    const plain = runCommands(game(), deps, { type: "endTurn", playerId: p1 }, { type: "endTurn", playerId: p2 });
    expect(plain.state.round).toBeGreaterThan(1);
    expect(typed(plain.events, "cardFound")).toEqual([]);
    expect(JSON.stringify(plain.state)).not.toContain("_attach.card");
  });
});
