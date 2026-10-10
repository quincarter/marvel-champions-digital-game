/**
 * docs/phase7-wave9.md §3.40 (b): `TriggerEvent tuckedCardDiscarded` and `AbilityDefinition.activeIn: "tucked"`.
 * "Forced Response: After a player card effect discards this card from under an identity, that identity takes 2
 * damage.", on a synthetic treachery (the Curse) tucked under the player's identity.
 *
 * Sources: RRG 1.8 "Tuck" (p. 45: tucked cards are not in play; "When a card leaves play, each card tucked under it is
 * discarded"), "In Play and Out of Play" (p. 23: out-of-play text works when it "specifically refer[s] to being used
 * from an out-of-play area"), "Card Types" (p. 12) and "Player Card" (p. 33: which cards are player cards), "Cost"
 * (p. 13: the arrow "distinguishes a cost from an effect").
 *
 * Owner decision §4.1 Q7 = A (provisional): "a player card effect" is any discard a player card causes, as an effect,
 * as a cost, or by a constant such as an identity's cap on its tucked cards. The tests named "Q7" rest on it; under
 * answer B the Curse's pattern would add `how: "effect"` and the cost would deal no damage.
 *
 * Synthetic cards only.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubResource, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const you = { kind: "controller" } as const;
const one = { kind: "const", value: 1 } as const;
const yourIdentity = { kind: "identityOf", player: you } as const;
const underYourIdentity = { kind: "tuckedUnder", of: yourIdentity } as const;
const CURSE_ID = "curse.response";

/**
 * "Forced Response: After a player card effect discards this card from under an identity, that identity takes 2
 * damage." §4.1 Q7 = A: no `how`, so a cost and a constant count.
 */
const CURSE_RESPONSE = stubAbility(CURSE_ID, {
  activeIn: "tucked",
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "tuckedCardDiscarded", selfIs: "target", eventIs: { under: "identity", by: "playerCard" } },
  },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "eventPlayer" } },
      amount: { kind: "const", value: 2 },
    },
  ],
});
/** "Forced Response: After a tucked card is discarded, place 1 seen counter here." It makes every discard announced. */
const WITNESS_RESPONSE = stubAbility("witness.response", {
  trigger: { kind: "response", forced: true, on: { on: "tuckedCardDiscarded" } },
  effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: one }],
});

const discardTuckedUnderIdentity: EffectSpec = {
  kind: "moveCards",
  cards: { kind: "ref", ref: underYourIdentity },
  to: "discard",
};
/** "Discard each card tucked under your identity." as a player event and as a treachery's When Revealed. */
const SWEEP_ACTION = stubAbility("sweep.action", {
  trigger: { kind: "action" },
  effects: [discardTuckedUnderIdentity],
});
const RAID_REVEALED = stubAbility("raid.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [discardTuckedUnderIdentity],
});
/** "Action: Discard a card tucked under your identity → place 1 paid counter here." */
const TOLL_ACTION = stubAbility("toll.action", {
  trigger: { kind: "action" },
  cost: { discardTucked: { slot: "paid", query: {}, under: yourIdentity, min: 1, max: 1 } },
  effects: [{ kind: "addCounters", target: self, counterType: "paid", amount: one }],
});
/** "If there are more than 2 tucked cards under your identity, discard all of them." (a constant on a player card) */
const CAP_CHECK = stubAbility("cap.check", {
  trigger: {
    kind: "stateCheck",
    when: {
      kind: "compare",
      left: { kind: "refCount", of: underYourIdentity },
      op: "atLeast",
      right: { kind: "const", value: 3 },
    },
  },
  effects: [discardTuckedUnderIdentity],
});
/** "Return each card tucked under your identity to its owner's hand." */
const RECALL_ACTION = stubAbility("recall.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: underYourIdentity }, to: "hand" }],
});
/** "Swap the top card of the encounter deck with a card tucked under your identity." */
const SWAP_ACTION = stubAbility("swap.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "chooseCards",
      slot: "top",
      from: { kind: "encounter", zones: ["deck"], top: one },
      chooser: you,
      min: 1,
      max: 1,
    },
    { kind: "swapCards", a: { kind: "slot", slot: "top" }, b: underYourIdentity },
  ],
});
/** "Discard the Shelf." / "Discard the top card of the encounter deck." / "Reveal the top card of the encounter deck." */
const CLEAR_ACTION = stubAbility("clear.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "discardFromPlay", target: { kind: "each", query: { name: "shelf" } } }],
});
const MILL_ACTION = stubAbility("mill.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "moveCards", cards: { kind: "encounter", zones: ["deck"], top: one }, to: "discard" }],
});
const REVEAL_ACTION = stubAbility("reveal.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: you }],
});

const CURSE = stubTreachery({ id: "curse", boostIcons: 0, abilities: [CURSE_RESPONSE.ref] });
const RAID = stubTreachery({ id: "raid", boostIcons: 0, abilities: [RAID_REVEALED.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_RESPONSE.ref] });
const TOLL = stubSupport({ id: "toll", cost: 0, abilities: [TOLL_ACTION.ref] });
const CAP = stubSupport({ id: "cap", cost: 0, abilities: [CAP_CHECK.ref] });
const SHELF = stubSupport({ id: "shelf", cost: 0 });
const SCRAP = stubResource({ id: "scrap", icons: 1 });
const event = (id: string, ability: typeof SWEEP_ACTION) => stubEvent({ id, cost: 0, abilities: [ability.ref] });
const SWEEP = event("sweep", SWEEP_ACTION);
const RECALL = event("recall", RECALL_ACTION);
const SWAP = event("swap", SWAP_ACTION);
const CLEAR = event("clear", CLEAR_ACTION);
const MILL = event("mill", MILL_ACTION);
const REVEAL = event("reveal", REVEAL_ACTION);
/** An event with no ability: playing it only runs the flow, state checks included. */
const NOTHING = stubEvent({ id: "nothing", cost: 0 });

const QUIET = [SWEEP_ACTION, RAID_REVEALED, TOLL_ACTION, CAP_CHECK, RECALL_ACTION, SWAP_ACTION, CLEAR_ACTION];
const MORE = [MILL_ACTION, REVEAL_ACTION];
const deps: EngineDeps = depsOf(CURSE_RESPONSE, WITNESS_RESPONSE, ...QUIET, ...MORE);
/** The same cards with no ability that hears a tucked card's discard. */
const quietDeps: EngineDeps = depsOf(...QUIET, ...MORE);

/** Takes `id` out of whatever pile holds it and tucks it under `host` (surgery). */
function tuck(state: GameState, host: InstanceId, id: InstanceId): GameState {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: p.hand.filter((x) => x !== id),
      deck: p.deck.filter((x) => x !== id),
    })),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
    instances: {
      ...state.instances,
      [host]: { ...mustInstance(state, host), tucked: [...mustInstance(state, host).tucked, id] },
    },
  };
}

interface Staged {
  /** Curses tucked under the identity. */
  readonly curses?: number;
  /** Curses tucked under the Shelf. */
  readonly shelved?: number;
  /** Fillers tucked under the identity, after the Curses. */
  readonly fillers?: number;
  /** One of the player's own cards tucked under the identity, last. */
  readonly scrap?: boolean;
  /** The Cap in play. */
  readonly cap?: boolean;
  readonly witness?: boolean;
  readonly with?: EngineDeps;
}

function table(staged: Staged = {}) {
  const using = staged.with ?? deps;
  let state = gameAtFirstTurn({
    cards: [CURSE, RAID, FILLER, WITNESS, TOLL, CAP, SHELF, SCRAP, SWEEP, RECALL, SWAP, CLEAR, MILL, REVEAL, NOTHING],
    deps: using,
    deck: [
      WITNESS.id,
      TOLL.id,
      CAP.id,
      SHELF.id,
      SCRAP.id,
      ...[SWEEP, RECALL, SWAP, CLEAR, MILL, REVEAL, NOTHING, NOTHING].map((card) => card.id),
    ],
    encounter: [...copiesOf(CURSE.id, 4), RAID.id, ...copiesOf(FILLER.id, 20)],
  });
  const toll = playerCardIntoPlay(state, TOLL.id);
  const shelf = playerCardIntoPlay(toll.state, SHELF.id);
  state = shelf.state;
  const witness = staged.witness === false ? null : playerCardIntoPlay(state, WITNESS.id);
  state = witness?.state ?? state;
  if (staged.cap) state = playerCardIntoPlay(state, CAP.id).state;
  const identity = mustPlayer(state, P1).identity.instanceId;
  const inDeck = (card: string) =>
    state.encounterDecks[activeEncounterDeckId(state)]!.deck.find((id) => mustInstance(state, id).cardId === card)!;
  const curses: InstanceId[] = [];
  const fillers: InstanceId[] = [];
  const shelved: InstanceId[] = [];
  for (let i = 0; i < (staged.curses ?? 0); i++) {
    curses.push(inDeck(CURSE.id));
    state = tuck(state, identity, curses[i]!);
  }
  for (let i = 0; i < (staged.shelved ?? 0); i++) {
    shelved.push(inDeck(CURSE.id));
    state = tuck(state, shelf.id, shelved[i]!);
  }
  for (let i = 0; i < (staged.fillers ?? 0); i++) {
    fillers.push(inDeck(FILLER.id));
    state = tuck(state, identity, fillers[i]!);
  }
  let scrap: InstanceId | null = null;
  if (staged.scrap) {
    const given = giveCard(state, P1, SCRAP.id);
    state = tuck(given.state, identity, given.id);
    scrap = given.id;
  }
  return {
    state,
    identity,
    toll: toll.id,
    shelf: shelf.id,
    witness: witness?.id ?? null,
    curses,
    fillers,
    shelved,
    scrap,
  };
}

const tucked = (state: GameState, host: InstanceId) => mustInstance(state, host).tucked;
const damage = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const encounterDiscard = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!.discard;
const seen = (state: GameState, witness: InstanceId | null) => mustInstance(state, witness!).counters.seen ?? 0;
/**
 * Each tucked card's discard as it was announced: the card, the host, and the cause the event reported. An
 * announcement is logged once, as it resolves.
 */
const discards = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "tuckedCardDiscarded"
      ? [
          {
            card: e.event.instanceId,
            host: e.event.hostInstanceId,
            under: e.event.under,
            by: e.event.by ?? "none",
            how: e.event.how,
            player: e.event.playerId,
          },
        ]
      : [],
  );
const curseResolved = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === CURSE_ID).length;
function expectReplays(session: GameSession, using = deps) {
  const replayed = replay(session.log, using);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}
const payToll = (state: GameState, toll: InstanceId, card: InstanceId, using = deps) => {
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: toll,
    abilityId: TOLL_ACTION.ref.id,
    payment: [],
    costChoices: { paid: [card] },
  };
  const { session, events } = driveSession(startSession(state), using, [command]);
  return { session, events, state: session.state };
};

describe("§3.40 (b) a tucked card discarded: the host and the cause as the event reports them", () => {
  it("Q7: by a player card effect: 1 Curse discarded, the identity takes 2; the event says playerCard, effect", () => {
    const t = table({ curses: 1 });
    const { state, events, session } = playFree(t.state, deps, SWEEP.id);
    expect(tucked(state, t.identity)).toEqual([]);
    expect(encounterDiscard(state)).toContain(t.curses[0]);
    expect(damage(state, t.identity)).toBe(2);
    expect(discards(events)).toEqual([
      { card: t.curses[0], host: t.identity, under: "identity", by: "playerCard", how: "effect", player: P1 },
    ]);
    const source = events.flatMap((e) =>
      e.type === "triggerEvent" && e.event.kind === "tuckedCardDiscarded" ? [e.event.sourceInstanceId] : [],
    )[0];
    expect(mustInstance(state, source!).cardId).toBe(SWEEP.id);
    expect(curseResolved(events)).toBe(1);
    expect(state.pendingTuckedDiscards).toBeUndefined();
    expectReplays(session);
  });

  it("Q7: by a player card cost: 1 of 2 Curses paid, the identity takes 2 and the cost's effect still resolves", () => {
    const t = table({ curses: 2 });
    const { state, events, session } = payToll(t.state, t.toll, t.curses[1]!);
    expect(tucked(state, t.identity)).toEqual([t.curses[0]]);
    expect(damage(state, t.identity)).toBe(2);
    expect(discards(events)).toEqual([
      { card: t.curses[1], host: t.identity, under: "identity", by: "playerCard", how: "cost", player: P1 },
    ]);
    expect(mustInstance(state, t.toll).counters.paid).toBe(1);
    // The response to the cost resolves before the ability's effect (the flow announces between frames).
    const answered = events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === CURSE_ID);
    const paid = events.findIndex((e) => e.type === "counterAdded" && e.counterType === "paid");
    expect(answered).toBeGreaterThanOrEqual(0);
    expect(answered).toBeLessThan(paid);
    expectReplays(session);
  });

  it("Q7: by a player card's constant (a cap of 2): 3 tucked, all 3 discarded, 2 Curses deal 2 each: 4 damage", () => {
    // 2 tucked: the cap's check is seen false. The third card lands (surgery) and the check, now true, resolves.
    const t = table({ curses: 2, cap: true });
    const under = playFree(t.state, deps, NOTHING.id);
    expect(tucked(under.state, t.identity)).toHaveLength(2);
    expect(encounterDiscard(under.state)).toEqual([]);
    const filler = under.state.encounterDecks[activeEncounterDeckId(under.state)]!.deck[0]!;
    const { state, events, session } = playFree(tuck(under.state, t.identity, filler), deps, NOTHING.id);
    expect(tucked(state, t.identity)).toEqual([]);
    expect(damage(state, t.identity)).toBe(4);
    expect(discards(events).map(({ by, how, under }) => ({ by, how, under }))).toEqual([
      { by: "playerCard", how: "effect", under: "identity" },
      { by: "playerCard", how: "effect", under: "identity" },
      { by: "playerCard", how: "effect", under: "identity" },
    ]);
    expect(curseResolved(events)).toBe(2);
    expect(seen(state, t.witness)).toBe(3);
    expectReplays(session);
  });

  it("by an encounter card effect: 2 Curses discarded, 0 damage; the event says encounterCard, effect", () => {
    const t = table({ curses: 2 });
    const { state, events, session } = playFree(onTopOfEncounterDeck(t.state, RAID.id), deps, REVEAL.id);
    expect(tucked(state, t.identity)).toEqual([]);
    expect(damage(state, t.identity)).toBe(0);
    expect(discards(events)).toEqual([
      { card: t.curses[0], host: t.identity, under: "identity", by: "encounterCard", how: "effect", player: P1 },
      { card: t.curses[1], host: t.identity, under: "identity", by: "encounterCard", how: "effect", player: P1 },
    ]);
    expect(curseResolved(events)).toBe(0);
    expect(seen(state, t.witness)).toBe(2);
    expectReplays(session);
  });

  it("by the game, its host leaving play: under a support, no side, 'rule'; 0 damage", () => {
    const t = table({ shelved: 1 });
    const { state, events, session } = playFree(t.state, deps, CLEAR.id);
    expect(encounterDiscard(state)).toContain(t.shelved[0]);
    expect(damage(state, t.identity)).toBe(0);
    expect(discards(events)).toEqual([
      { card: t.shelved[0], host: t.shelf, under: "other", by: "none", how: "rule", player: P1 },
    ]);
    expect(curseResolved(events)).toBe(0);
    expectReplays(session);
  });

  it("a player's own card discarded from under the identity goes to its owner's pile and is reported the same way", () => {
    const t = table({ scrap: true });
    const { state, events } = playFree(t.state, deps, SWEEP.id);
    expect(mustPlayer(state, P1).discard).toContain(t.scrap);
    expect(discards(events)).toMatchObject([{ card: t.scrap, host: t.identity, by: "playerCard", how: "effect" }]);
    expect(damage(state, t.identity)).toBe(0);
  });
});

describe('§3.40 (b) `activeIn: "tucked"`: the card answers its own discard from under a card, and nothing else', () => {
  it("2 Curses tucked, 1 discarded: only that one answers (2 damage, not 4); the other stays tucked and silent", () => {
    const t = table({ curses: 2, witness: false });
    const { state, events } = payToll(t.state, t.toll, t.curses[0]!);
    expect(curseResolved(events)).toBe(1);
    expect(damage(state, t.identity)).toBe(2);
    expect(tucked(state, t.identity)).toEqual([t.curses[1]]);
  });

  it("with no other listener in play the tucked card itself is what hears the discard", () => {
    const t = table({ curses: 1, witness: false });
    const { state, events } = playFree(t.state, deps, SWEEP.id);
    expect(discards(events)).toHaveLength(1);
    expect(damage(state, t.identity)).toBe(2);
  });

  it("a Curse discarded from the encounter deck was never tucked: no event, 0 damage", () => {
    const t = table();
    const { state, events } = playFree(onTopOfEncounterDeck(t.state, CURSE.id), deps, MILL.id);
    expect(encounterDiscard(state)).toHaveLength(1);
    expect(discards(events)).toEqual([]);
    expect(damage(state, t.identity)).toBe(0);
  });

  it("a Curse tucked under a card that is no identity: discarded by a player card's host leaving, 0 damage", () => {
    const t = table({ shelved: 2, witness: false });
    const { state, events } = playFree(t.state, deps, CLEAR.id);
    // Nothing in play hears it and the Curses' own pattern asks for an identity, so nothing is announced.
    expect(discards(events)).toEqual([]);
    expect(damage(state, t.identity)).toBe(0);
    expect(state.pendingTuckedDiscards).toBeUndefined();
  });
});

describe("§3.40 (b) a card that stops being tucked without a discard is not heard", () => {
  it("returned to its owner's hand: 0 events, the witness has 0 counters", () => {
    const t = table({ scrap: true });
    const { state, events } = playFree(t.state, deps, RECALL.id);
    expect(mustPlayer(state, P1).hand).toContain(t.scrap);
    expect(tucked(state, t.identity)).toEqual([]);
    expect(discards(events)).toEqual([]);
    expect(seen(state, t.witness)).toBe(0);
  });

  it("swapped with the top card of the encounter deck: the Curse is on the deck, 0 events, 0 damage", () => {
    const t = table({ curses: 1 });
    const { state, events } = playFree(t.state, deps, SWAP.id);
    expect(state.encounterDecks[activeEncounterDeckId(state)]!.deck[0]).toBe(t.curses[0]);
    expect(tucked(state, t.identity)).toHaveLength(1);
    expect(discards(events)).toEqual([]);
    expect(damage(state, t.identity)).toBe(0);
    expect(seen(state, t.witness)).toBe(0);
  });
});

describe("§3.40 (b) no listener: nothing changes", () => {
  it("a registry with no tuckedCardDiscarded ability records nothing and logs no such event", () => {
    const t = table({ fillers: 2, witness: false, with: quietDeps });
    const { state, events, session } = playFree(t.state, quietDeps, SWEEP.id);
    expect(tucked(state, t.identity)).toEqual([]);
    expect(state.pendingTuckedDiscards).toBeUndefined();
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "tuckedCardDiscarded")).toBe(false);
    expectReplays(session, quietDeps);
  });

  it("a listener in the registry that does not hear this discard: the log and state of the registry without it", () => {
    const quiet = table({ fillers: 2, witness: false, with: quietDeps });
    const loud = table({ fillers: 2, witness: false });
    const a = playFree(quiet.state, quietDeps, SWEEP.id);
    const b = playFree(loud.state, deps, SWEEP.id);
    expect(b.events).toEqual(a.events);
    expect(b.state).toEqual(a.state);
  });
});
