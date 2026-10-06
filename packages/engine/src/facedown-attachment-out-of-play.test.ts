/**
 * RRG 1.8 "In Play and Out of Play" (p. 23): "Facedown cards attached to in-play cards are out of play." "If a card is
 * out of play, its text is inactive and cannot affect the game." "Card abilities only interact with, and can only
 * target, cards that are in play (unless the ability text specifically refers to an out-of-play area)."
 *
 * Proven with a synthetic "Cache" support shaped like the cards that keep a card facedown on themselves ("attach 1 card
 * from your hand facedown here", "add 1 card attached here to your hand", "swap the facedown card attached here with an
 * upgrade you control") and a unique, restricted "Blade" upgrade with a forced response of its own.
 *
 * Also: RRG 1.8 "Leaves Play" (p. 27: a card's attachments are discarded as it leaves play); "'Swap'" (p. 42: "When
 * swapping a card in a play area with a card in an out-of-play area, if those two cards ... do not share a title, the
 * in-play card is considered to leave play and the out-of-play card is considered to enter play ... and the other card
 * enters play ready"; "Swapped cards maintain the orientation (such as ready or exhausted, faceup or facedown) of the
 * original card").
 */

import { trait, type AbilityReference, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { cardOf, mustInstance, mustPlayer } from "./query.js";
import {
  cardsInPlay,
  facedownAttachments,
  isFacedownAttachment,
  restrictedCardsOf,
  selectTargets,
  type EffectContext,
} from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { matchingCardInPlay } from "./unique.js";
import { faceVisible } from "./visibility.js";

const self: TargetRef = { kind: "self" };
const you = { kind: "controller" } as const;
const BLADE_TRAIT = trait("BLADE");
const GADGET_TRAIT = trait("GADGET");

const FACEDOWN_HERE: TargetQuery = { host: self, facedown: true };
const UPGRADES_YOU_CONTROL: TargetQuery = { categories: ["upgrade"], controller: "you" };
const YOUR_GADGET: TargetQuery = { categories: ["upgrade"], controller: "you", trait: GADGET_TRAIT };

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, { trigger: { kind: "action" }, effects });

/** "Attach 1 BLADE upgrade from your hand facedown here." */
const STASH = action("cache.stash", [
  {
    kind: "chooseCards",
    slot: "stashed",
    from: { kind: "zone", zone: "hand", player: you, filter: { categories: ["upgrade"], trait: BLADE_TRAIT } },
    chooser: you,
    min: 1,
    max: 1,
  },
  { kind: "attach", card: { kind: "slot", slot: "stashed" }, to: self, facedown: true },
]);
/** Writes what two queries see onto the Cache: "upgrades you control", and "facedown cards attached here". */
const TALLY = action("cache.tally", [
  {
    kind: "addCounters",
    target: self,
    counterType: "upgrades",
    amount: { kind: "count", query: UPGRADES_YOU_CONTROL },
  },
  { kind: "addCounters", target: self, counterType: "stashed", amount: { kind: "count", query: FACEDOWN_HERE } },
]);
/** "Add each card attached facedown here to your hand." */
const TAKE = action("cache.take", [
  { kind: "moveCards", cards: { kind: "ref", ref: { kind: "each", query: FACEDOWN_HERE } }, to: "hand" },
]);
/** "Discard this card." */
const SCRAP = action("cache.scrap", [{ kind: "moveCards", cards: { kind: "ref", ref: self }, to: "discard" }]);
/** "Swap the facedown card attached here with a GADGET upgrade you control." */
const SWAP = action("cache.swap", [
  { kind: "swapCards", a: { kind: "each", query: FACEDOWN_HERE }, b: { kind: "each", query: YOUR_GADGET } },
]);
const CACHE = stubSupport({
  id: "cache",
  cost: 0,
  abilities: [STASH.ref, TALLY.ref, TAKE.ref, SCRAP.ref, SWAP.ref],
});

/** "Forced Response: After an ability of a support you control resolves, place 1 heard counter on your identity." */
const BLADE_HEARS = stubAbility("blade.hears", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "abilityResolved", playerIs: "controller", sourceIs: { categories: ["support"] } },
  },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: you },
      counterType: "heard",
      amount: { kind: "const", value: 1 },
    },
  ] as EffectSpec[],
});
const BLADE: UpgradeCard = {
  ...stubUpgrade({ id: "blade", cost: 0, traits: [BLADE_TRAIT], keywords: [{ name: "restricted" }] }),
  unique: true,
  abilities: [BLADE_HEARS.ref],
};
const GADGET = stubUpgrade({ id: "gadget", cost: 0, traits: [GADGET_TRAIT] });

const deps: EngineDeps = depsOf(STASH, TALLY, TAKE, SCRAP, SWAP, BLADE_HEARS);

const use = (cache: InstanceId, ability: { readonly ref: AbilityReference }): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: cache,
  abilityId: ability.ref.id,
  payment: [],
});

function drive(state: GameState, ...commands: readonly Command[]) {
  const { session, events } = driveSession(startSession(state), deps, commands);
  return { session, state: session.state, events };
}

/** The Cache and a Gadget in play, one Blade in hand. */
function table(): { readonly state: GameState; readonly cache: InstanceId; readonly gadget: InstanceId } {
  const start = gameAtFirstTurn({
    cards: [CACHE, BLADE, GADGET],
    deps,
    deck: [CACHE.id, BLADE.id, BLADE.id, GADGET.id],
  });
  const cache = playerCardIntoPlay(start, CACHE.id);
  const gadget = playerCardIntoPlay(cache.state, GADGET.id);
  return { state: giveCard(gadget.state, P1, BLADE.id).state, cache: cache.id, gadget: gadget.id };
}

/** The same table with a Blade stashed facedown on the Cache. */
function stashed() {
  const t = table();
  const run = drive(t.state, use(t.cache, STASH));
  const [blade] = mustInstance(run.state, t.cache).attachments;
  if (!blade) throw new Error("nothing was stashed");
  return { ...t, ...run, blade };
}

const heard = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).counters["heard"] ?? 0;
const context = (state: GameState, cache: InstanceId): EffectContext => ({
  selfInstanceId: cache,
  controllerId: P1,
  event: null,
  bindings: {},
  deps,
});
const about = (events: readonly GameEvent[], id: InstanceId, type: GameEvent["type"]): readonly GameEvent[] =>
  events.filter((event) => event.type === type && "instanceId" in event && event.instanceId === id);

describe("RRG 1.8 p. 23: a facedown card attached to a card in play is out of play", () => {
  it("is on its host, out of play, and its owner may still look at it", () => {
    const g = stashed();
    expect(mustInstance(g.state, g.blade)).toMatchObject({ attachedTo: g.cache, faceup: false });
    expect(isFacedownAttachment(g.state, g.blade)).toBe(true);
    expect(cardsInPlay(g.state)).not.toContain(g.blade);
    expect(cardsInPlay(g.state)).toContain(g.cache);
    expect(facedownAttachments(g.state)).toEqual([g.blade]);
    expect(faceVisible(g.state, g.blade)).toBe(true);
  });

  it("is not an 'upgrade you control', and is still found by a query for the facedown cards attached here", () => {
    const g = stashed();
    const run = drive(g.state, use(g.cache, TALLY));
    // The Gadget in play is the one upgrade; the Blade is counted only as a facedown card here.
    expect(mustInstance(run.state, g.cache).counters).toMatchObject({ upgrades: 1, stashed: 1 });
    const ctx = context(g.state, g.cache);
    expect(selectTargets(g.state, UPGRADES_YOU_CONTROL, ctx)).toEqual([g.gadget]);
    expect(selectTargets(g.state, FACEDOWN_HERE, ctx)).toEqual([g.blade]);
    // "A support with an upgrade attached" does not read it; "with a facedown card attached" does.
    const withAttached = (wanted: TargetQuery): TargetQuery => ({ categories: ["support"], hasAttachment: wanted });
    expect(selectTargets(g.state, withAttached({ categories: ["upgrade"] }), ctx)).toEqual([]);
    expect(selectTargets(g.state, withAttached({ facedown: true }), ctx)).toEqual([g.cache]);
    // Asking for facedown cards does not make it anything else: it has no type the query could name.
    expect(selectTargets(g.state, { ...UPGRADES_YOU_CONTROL, facedown: false }, ctx)).toEqual([g.gadget]);
  });

  it("does not trigger its own abilities; the same card faceup in play does", () => {
    const g = stashed();
    expect(heard(drive(g.state, use(g.cache, TALLY)).state)).toBe(0);
    const t = table();
    const blade = playerCardIntoPlay(t.state, BLADE.id);
    expect(heard(drive(blade.state, use(t.cache, TALLY)).state)).toBe(1);
  });

  it("does not count toward the restricted limit or the unique rule: a second copy can be played", () => {
    const g = stashed();
    expect(restrictedCardsOf(g.state, P1, deps)).toEqual([]);
    expect(matchingCardInPlay(g.state, BLADE, new Set(), P1, deps)).toBeNull();
    const second = giveCard(g.state, P1, BLADE.id, [g.blade]);
    const run = drive(second.state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: second.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(cardsInPlay(run.state)).toContain(second.id);
    expect(restrictedCardsOf(run.state, P1, deps)).toEqual([second.id]);
    expect(matchingCardInPlay(run.state, BLADE, new Set(), P1, deps)).toBe(second.id);
  });

  it("goes to its owner's discard pile with its host, faceup and itself again, without leaving play", () => {
    const g = stashed();
    const run = drive(g.state, use(g.cache, SCRAP));
    const discard = mustPlayer(run.state, P1).discard;
    expect(discard).toContain(g.cache);
    expect(discard).toContain(g.blade);
    expect(mustInstance(run.state, g.blade)).toMatchObject({
      attachedTo: null,
      faceup: true,
      facedownAs: null,
      controllerId: P1,
    });
    expect(mustInstance(run.state, g.cache).attachments).toEqual([]);
    // The host was discarded from play; the facedown card was never in play to be.
    expect(about(run.events, g.cache, "cardDiscardedFromPlay")).toHaveLength(1);
    expect(about(run.events, g.blade, "cardDiscardedFromPlay")).toHaveLength(0);
    expect(about(run.events, g.blade, "cardMoved")).toHaveLength(1);
  });

  it("an ability that names it moves it: 'add each card attached facedown here to your hand'", () => {
    const g = stashed();
    const run = drive(g.state, use(g.cache, TAKE));
    expect(mustPlayer(run.state, P1).hand).toContain(g.blade);
    expect(mustInstance(run.state, g.blade)).toMatchObject({ attachedTo: null, facedownAs: null, controllerId: P1 });
    expect(mustInstance(run.state, g.cache).attachments).toEqual([]);
    expect(facedownAttachments(run.state)).toEqual([]);
  });

  it("is in play once it is faceup on its host", () => {
    const g = stashed();
    const turned: GameState = {
      ...g.state,
      instances: {
        ...g.state.instances,
        [g.blade]: { ...mustInstance(g.state, g.blade), faceup: true, facedownAs: null },
      },
    };
    expect(isFacedownAttachment(turned, g.blade)).toBe(false);
    expect(cardsInPlay(turned)).toContain(g.blade);
    expect(selectTargets(turned, UPGRADES_YOU_CONTROL, context(turned, g.cache))).toContain(g.blade);
    expect(restrictedCardsOf(turned, P1, deps)).toEqual([g.blade]);
  });
});

describe("RRG 1.8 'Swap' (p. 42): a facedown attachment swapped with a card in play", () => {
  it("the card in play leaves play and becomes the facedown attachment; the other enters play faceup and ready in its place", () => {
    const g = stashed();
    const before = mustPlayer(g.state, P1).playArea.indexOf(g.gadget);
    const run = drive(g.state, use(g.cache, SWAP));
    expect(run.events.filter((event) => event.type === "swapRefused")).toEqual([]);
    expect(run.events).toContainEqual({
      type: "cardsSwapped",
      how: "leftAndEntered",
      outgoing: g.gadget,
      incoming: g.blade,
      cardIds: [GADGET.id, BLADE.id],
    });
    // The Gadget took the Blade's place and orientation: facedown on the Cache, out of play, with no text.
    expect(mustInstance(run.state, g.cache).attachments).toEqual([g.gadget]);
    expect(mustInstance(run.state, g.gadget)).toMatchObject({ attachedTo: g.cache, faceup: false });
    expect(isFacedownAttachment(run.state, g.gadget)).toBe(true);
    expect(cardsInPlay(run.state)).not.toContain(g.gadget);
    // The Blade took the Gadget's: in play, faceup, ready, under its player's control, itself again.
    expect(mustPlayer(run.state, P1).playArea.indexOf(g.blade)).toBe(before);
    expect(mustInstance(run.state, g.blade)).toMatchObject({
      attachedTo: null,
      faceup: true,
      facedownAs: null,
      exhausted: false,
      controllerId: P1,
    });
    expect(cardsInPlay(run.state)).toContain(g.blade);
    expect(cardOf(run.state, g.blade)?.id).toBe(BLADE.id);
    expect(restrictedCardsOf(run.state, P1, deps)).toEqual([g.blade]);
    // It entered play, and from now on it hears.
    expect(heard(drive(run.state, use(g.cache, TALLY)).state)).toBeGreaterThan(heard(run.state));
  });

  it("a stash and a swap replay deep-equal", () => {
    const t = table();
    const { session } = driveSession(startSession(t.state), deps, [use(t.cache, STASH), use(t.cache, SWAP)]);
    const [gadget] = mustInstance(session.state, t.cache).attachments;
    expect(gadget).toBe(t.gadget);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
