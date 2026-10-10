/**
 * docs/phase7-wave9.md §3.40 (a): `TriggerEvent cardBeingTucked` and `EffectSpec replaceTuckHost`. "Forced Interrupt:
 * When a card would be tucked under your identity by a player card effect, tuck it under here instead. Then, if there
 * are 2 tucked cards here, …", on a synthetic support (the Decoy) the player controls.
 *
 * Sources: RRG 1.8 "Tuck" (p. 45: "When a player is instructed to tuck a card under another card"), "'Would'" (p. 48),
 * "Replacement Effect" (p. 37: a replaced effect "is no longer considered imminent and no further interrupts or
 * responses to that effect can be triggered"), "Card Types" (p. 12: which cards are player cards), "Swap" (p. 42: a
 * swap is not an instruction to tuck).
 *
 * Synthetic cards only: the Decoy, a player event and a treachery that each tuck the top card of the encounter deck
 * under the player's identity, and a swap with a tucked card.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { createCtx } from "./ctx.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import { tuckOrAnnounce } from "./resolve/tuck.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const self = { kind: "self" } as const;
const you = { kind: "controller" } as const;
const one = { kind: "const", value: 1 } as const;
const DECOY_ID = "decoy.interrupt";
const tuckedHere = { kind: "refCount", of: { kind: "tuckedUnder", of: self } } as const;

/**
 * "Forced Interrupt: When a card would be tucked under your identity by a player card effect, tuck it under here
 * instead. Then, place 1 full counter here if there are 2 tucked cards here."
 */
const DECOY_INTERRUPT = stubAbility(DECOY_ID, {
  trigger: {
    kind: "interrupt",
    forced: true,
    would: true,
    on: { on: "cardBeingTucked", playerIs: "controller", eventIs: { under: "identity", by: "playerCard" } },
  },
  effects: [
    { kind: "replaceTuckHost", to: self },
    {
      kind: "then",
      effects: [
        {
          kind: "if",
          condition: { kind: "compare", left: tuckedHere, op: "equalTo", right: { kind: "const", value: 2 } },
          then: [{ kind: "addCounters", target: self, counterType: "full", amount: one }],
        },
      ],
    },
  ],
});
/** A Decoy that hears any tuck under the identity, whoever tucks ("When a card would be tucked under your identity"). */
const NET_INTERRUPT = stubAbility("net.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    would: true,
    on: { on: "cardBeingTucked", playerIs: "controller", eventIs: { under: "identity" } },
  },
  effects: [{ kind: "replaceTuckHost", to: self }],
});

const topOfEncounterDeck = { kind: "encounter", zones: ["deck"], top: one } as const;
const underYourIdentity = { kind: "identityOf", player: you } as const;
/** "Tuck the top card of the encounter deck under your identity." */
const STASH_EFFECTS: readonly EffectSpec[] = [
  { kind: "tuckCards", cards: topOfEncounterDeck, under: underYourIdentity },
];
const STASH_ACTION = stubAbility("stash.action", { trigger: { kind: "action" }, effects: STASH_EFFECTS });
/** "Tuck the top 2 cards of the encounter deck under your identity." */
const STASH_TWO_ACTION = stubAbility("stash-two.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "tuckCards", cards: { ...topOfEncounterDeck, top: { kind: "const", value: 2 } }, under: underYourIdentity },
  ],
});
/** "Tuck the top card of the encounter deck under the Shelf." (a host that is no identity) */
const SHELVE_ACTION = stubAbility("shelve.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "tuckCards", cards: topOfEncounterDeck, under: { kind: "each", query: { name: "shelf" } } }],
});
const SNARE_REVEALED = stubAbility("snare.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: STASH_EFFECTS,
});
/** "Reveal the top card of the encounter deck." */
const REVEAL_ACTION = stubAbility("reveal.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: you }],
});
/** "Swap the top card of the encounter deck with a card tucked under your identity." */
const SWAP_ACTION = stubAbility("swap.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "chooseCards", slot: "top", from: topOfEncounterDeck, chooser: you, min: 1, max: 1 },
    {
      kind: "swapCards",
      a: { kind: "slot", slot: "top" },
      b: { kind: "tuckedUnder", of: underYourIdentity },
    },
  ],
});

const DECOY = stubSupport({ id: "decoy", cost: 0, abilities: [DECOY_INTERRUPT.ref] });
const NET = stubSupport({ id: "net", cost: 0, abilities: [NET_INTERRUPT.ref] });
const SHELF = stubSupport({ id: "shelf", cost: 0 });
const STASH = stubEvent({ id: "stash", cost: 0, abilities: [STASH_ACTION.ref] });
const STASH_TWO = stubEvent({ id: "stash-two", cost: 0, abilities: [STASH_TWO_ACTION.ref] });
const SHELVE = stubEvent({ id: "shelve", cost: 0, abilities: [SHELVE_ACTION.ref] });
const REVEAL = stubEvent({ id: "reveal", cost: 0, abilities: [REVEAL_ACTION.ref] });
const SWAP = stubEvent({ id: "swap", cost: 0, abilities: [SWAP_ACTION.ref] });
const SNARE = stubTreachery({ id: "snare", boostIcons: 0, abilities: [SNARE_REVEALED.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const ALL = [
  DECOY_INTERRUPT,
  NET_INTERRUPT,
  STASH_ACTION,
  STASH_TWO_ACTION,
  SHELVE_ACTION,
  SNARE_REVEALED,
  REVEAL_ACTION,
];
const deps: EngineDeps = depsOf(...ALL, SWAP_ACTION);
/** The same cards with no ability that hears a tuck. */
const quietDeps: EngineDeps = depsOf(
  STASH_ACTION,
  STASH_TWO_ACTION,
  SHELVE_ACTION,
  SNARE_REVEALED,
  REVEAL_ACTION,
  SWAP_ACTION,
);

interface Table {
  readonly state: GameState;
  readonly decoy: InstanceId | null;
  readonly net: InstanceId | null;
  readonly shelf: InstanceId;
  readonly identity: InstanceId;
}

function table(
  options: {
    readonly decoy?: boolean;
    readonly net?: boolean;
    readonly decoyOf?: typeof P1 | typeof P2;
    readonly players?: 1 | 2;
    readonly with?: EngineDeps;
  } = {},
): Table {
  const start = gameAtFirstTurn({
    players: options.players ?? 1,
    cards: [DECOY, NET, SHELF, STASH, STASH_TWO, SHELVE, REVEAL, SWAP, SNARE, FILLER],
    deps: options.with ?? deps,
    deck: [DECOY.id, NET.id, SHELF.id, STASH.id, STASH_TWO.id, SHELVE.id, REVEAL.id, SWAP.id],
    encounter: [SNARE.id, ...copiesOf(FILLER.id, 20)],
  });
  const shelf = playerCardIntoPlay(start, SHELF.id);
  const decoy = options.decoy === false ? null : playerCardIntoPlay(shelf.state, DECOY.id, options.decoyOf ?? P1);
  const afterDecoy = decoy?.state ?? shelf.state;
  const net = options.net ? playerCardIntoPlay(afterDecoy, NET.id) : null;
  const state = net?.state ?? afterDecoy;
  return {
    state,
    decoy: decoy?.id ?? null,
    net: net?.id ?? null,
    shelf: shelf.id,
    identity: mustPlayer(state, P1).identity.instanceId,
  };
}

const tucked = (state: GameState, host: InstanceId) => mustInstance(state, host).tucked;
const topOfDeck = (state: GameState, n = 1) => state.encounterDecks[activeEncounterDeckId(state)]!.deck.slice(0, n);
const tuckEvents = (events: readonly GameEvent[], phase: "initiated" | "resolved" | "cancelled") =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === phase && e.event.kind === "cardBeingTucked" ? [e.event] : [],
  );
const decoyResolved = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === DECOY_ID).length;
const movesToTuck = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "cardMoved" && e.to.kind === "tucked" ? [e] : []));
function expectReplays(session: GameSession, using = deps) {
  const replayed = replay(session.log, using);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}
/** Reveals the Snare off the top of the encounter deck: its When Revealed tucks the next card under the identity. */
const revealSnare = (state: GameState, using = deps) =>
  playFree(onTopOfEncounterDeck(state, SNARE.id), using, REVEAL.id);

describe("§3.40 (a) a tuck by a player card effect is heard and sent under another card", () => {
  it("1 card: the identity has 0, the Decoy 1; the event names the card, the host, the source and its side", () => {
    const t = table();
    const [card] = topOfDeck(t.state);
    const { state, events, session } = playFree(t.state, deps, STASH.id);
    expect(tucked(state, t.identity)).toEqual([]);
    expect(tucked(state, t.decoy!)).toEqual([card]);
    expect(mustInstance(state, card!).faceup).toBe(true);
    const [heard] = tuckEvents(events, "initiated");
    expect(heard).toMatchObject({
      instanceId: card,
      hostInstanceId: t.identity,
      playerId: P1,
      under: "identity",
      by: "playerCard",
      sourceCardId: STASH.id,
    });
    expect(mustInstance(state, heard!.sourceInstanceId!).cardId).toBe(STASH.id);
    // Replaced, so the original tuck is logged as cancelled and never resolves (RRG 1.8 "Replacement Effect", p. 37).
    expect(tuckEvents(events, "cancelled")).toHaveLength(1);
    expect(tuckEvents(events, "resolved")).toHaveLength(0);
    // One move, straight under the Decoy: the card never sits under the identity.
    expect(movesToTuck(events).map((e) => e.to)).toEqual([{ kind: "tucked", hostInstanceId: t.decoy }]);
    expect(decoyResolved(events)).toBe(1);
    // "Then, … if there are 2 tucked cards here": read after the redirected tuck, and 1 is not 2.
    expect(mustInstance(state, t.decoy!).counters.full ?? 0).toBe(0);
    expectReplays(session);
  });

  it("2 cards from one effect: both land under the Decoy in order (2), and the Then reads 2 on the second only", () => {
    const t = table();
    const cards = topOfDeck(t.state, 2);
    const { state, events, session } = playFree(t.state, deps, STASH_TWO.id);
    expect(tucked(state, t.decoy!)).toEqual(cards);
    expect(tucked(state, t.identity)).toEqual([]);
    expect(tuckEvents(events, "initiated").map((e) => e.instanceId)).toEqual(cards);
    expect(decoyResolved(events)).toBe(2);
    expect(mustInstance(state, t.decoy!).counters.full).toBe(1);
    expectReplays(session);
  });

  it("the tuck under the Decoy is not announced again: 1 event for 1 card, with a second listener in play", () => {
    // The Net hears any tuck under the identity. Both are forced; whichever the player resolves first replaces the
    // tuck, and the other has nothing left to replace (RRG 1.8 "'Would'", p. 48: "no further interrupts to the
    // original trigger may be used").
    const t = table({ net: true });
    const [card] = topOfDeck(t.state);
    const { state, events, session } = playFree(t.state, deps, STASH.id);
    expect(tuckEvents(events, "initiated")).toHaveLength(1);
    expect([...tucked(state, t.decoy!), ...tucked(state, t.net!)]).toEqual([card]);
    expect(tucked(state, t.identity)).toEqual([]);
    expect(movesToTuck(events)).toHaveLength(1);
    expectReplays(session);
  });
});

describe("§3.40 (a) a tuck the pattern does not ask for", () => {
  it("an encounter card's tuck: the card goes under the identity (1), the Decoy has 0 and is not asked", () => {
    const t = table();
    const { state, events, session } = revealSnare(t.state);
    expect(tucked(state, t.identity)).toHaveLength(1);
    expect(tucked(state, t.decoy!)).toEqual([]);
    expect(decoyResolved(events)).toBe(0);
    // Unheard, so it never went on the stack.
    expect(tuckEvents(events, "initiated")).toHaveLength(0);
    expectReplays(session);
  });

  it("an encounter card's tuck is heard, as an encounter card's, by a pattern that names no side", () => {
    const t = table({ decoy: false, net: true });
    const { state, events } = revealSnare(t.state);
    expect(tuckEvents(events, "initiated")).toMatchObject([{ under: "identity", by: "encounterCard", playerId: P1 }]);
    expect(tucked(state, t.net!)).toHaveLength(1);
    expect(tucked(state, t.identity)).toEqual([]);
  });

  it("a tuck the game makes, with no source card, has no side: the Decoy is not asked and the identity has 1", () => {
    const t = table();
    const [card] = topOfDeck(t.state);
    const ctx = createCtx(t.state, deps);
    tuckOrAnnounce(ctx, [card!], t.identity, { sourceInstanceId: null, sourceCardId: undefined, facedown: false });
    expect(ctx.state.stack).toEqual(t.state.stack);
    expect(tucked(ctx.state, t.identity)).toEqual([card]);
    expect(tucked(ctx.state, t.decoy!)).toEqual([]);
  });

  it("a player card's tuck under a card that is no identity is not matched: the Shelf has 1, the Decoy 0", () => {
    const t = table();
    const { state, events } = playFree(t.state, deps, SHELVE.id);
    expect(tucked(state, t.shelf)).toHaveLength(1);
    expect(tucked(state, t.decoy!)).toEqual([]);
    expect(tuckEvents(events, "initiated")).toHaveLength(0);
  });

  it("another player's identity is not 'your identity': P2's Decoy has 0 when P1 tucks under P1's identity", () => {
    const t = table({ players: 2, decoyOf: P2 });
    const { state, events } = playFree(t.state, deps, STASH.id);
    expect(tucked(state, t.identity)).toHaveLength(1);
    expect(tucked(state, t.decoy!)).toEqual([]);
    expect(decoyResolved(events)).toBe(0);
  });

  it("a swap with a tucked card is not a tuck: the Decoy is not asked and the identity still has 1 card", () => {
    const t = table();
    const first = revealSnare(t.state);
    const [was] = tucked(first.state, t.identity);
    const [top] = topOfDeck(first.state);
    const { state, events } = playFree(first.state, deps, SWAP.id);
    expect(tucked(state, t.identity)).toEqual([top]);
    expect(topOfDeck(state)).toEqual([was]);
    expect(tucked(state, t.decoy!)).toEqual([]);
    expect(tuckEvents(events, "initiated")).toHaveLength(0);
    expect(decoyResolved(events)).toBe(0);
  });
});

describe("§3.40 (a) no listener: nothing changes", () => {
  it("a registry with no cardBeingTucked ability: the same log and state as the tuck made before the event existed", () => {
    const t = table({ decoy: false, with: quietDeps });
    const [card] = topOfDeck(t.state);
    const { state, events, session } = playFree(t.state, quietDeps, STASH.id);
    expect(tucked(state, t.identity)).toEqual([card]);
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "cardBeingTucked")).toBe(false);
    expect(movesToTuck(events)).toHaveLength(1);
    expectReplays(session, quietDeps);
  });

  it("a listener in the registry but not in play: the log and the state are those of the registry without it", () => {
    const quiet = table({ decoy: false, with: quietDeps });
    const loud = table({ decoy: false });
    const a = playFree(quiet.state, quietDeps, STASH_TWO.id);
    const b = playFree(loud.state, deps, STASH_TWO.id);
    expect(b.events).toEqual(a.events);
    expect(b.state).toEqual(a.state);
    expect(tucked(b.state, loud.identity)).toHaveLength(2);
  });
});
