/**
 * docs/phase7-wave9.md §3.39, §3.40: `CardSelector tucked { random, filter }`, a pick at random among the cards tucked
 * under a card. "When Revealed: If you have 4 cards tucked under your identity, discard 1 of those cards at random.
 * Tuck this card under your identity." on a synthetic treachery (the Hunt), and "Deal 1 random minion here to a player
 * as a facedown encounter card" on a synthetic support (the Cage).
 *
 * Sources: RRG 1.8 "Tuck" (p. 45: tucked cards are not in play). The pick is one draw on the game's seeded RNG per
 * card (`GameState.rng`), so a replay of the command log picks the same card. The discard of the picked card is an
 * effect of the card whose ability made it: an encounter card's here (`TriggerEvent tuckedCardDiscarded.by`), so a
 * card that answers "after a player card effect discards this card from under an identity" does not.
 *
 * Synthetic cards only.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import type { CardSelector, EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const you = { kind: "controller" } as const;
const one = { kind: "const", value: 1 } as const;
const yourIdentity = { kind: "identityOf", player: you } as const;
const underYourIdentity: TargetRef = { kind: "tuckedUnder", of: yourIdentity };
const tuckedAtLeast = (of: TargetRef, value: number) =>
  ({ kind: "compare", left: { kind: "refCount", of }, op: "atLeast", right: { kind: "const", value } }) as const;
const randomUnder = (under: TargetRef, count: number, more: Partial<CardSelector> = {}): CardSelector =>
  ({ kind: "tucked", under, random: { kind: "const", value: count }, ...more }) as CardSelector;

/** The Hunt's When Revealed (see the file comment). */
const HUNT_REVEALED = stubAbility("hunt.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "if",
      condition: tuckedAtLeast(underYourIdentity, 4),
      then: [{ kind: "moveCards", cards: randomUnder(yourIdentity, 1), to: "discard" }],
    },
    { kind: "tuckCards", cards: { kind: "ref", ref: self }, under: yourIdentity },
  ],
});
/** "Forced Response: After a player card effect discards this card from under an identity, that identity takes 2 damage." */
const HUNT_RESPONSE = stubAbility("hunt.response", {
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
/** "Forced Response: After a tucked card is discarded, place 1 seen counter here." */
const WITNESS_RESPONSE = stubAbility("witness.response", {
  trigger: { kind: "response", forced: true, on: { on: "tuckedCardDiscarded" } },
  effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: one }],
});
const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, { trigger: { kind: "action" }, effects });
const REVEAL_ACTION = action("reveal.action", [{ kind: "revealEncounterCard", player: you }]);
/** "Discard 1 card tucked under your identity at random." as a player card's effect. */
const CULL_ACTION = action("cull.action", [{ kind: "moveCards", cards: randomUnder(yourIdentity, 1), to: "discard" }]);
/** "Discard 2 cards tucked under your identity at random." / "… 9 cards …" (more than are there). */
const CULL_TWO_ACTION = action("cull-two.action", [
  { kind: "moveCards", cards: randomUnder(yourIdentity, 2), to: "discard" },
]);
const CULL_ALL_ACTION = action("cull-all.action", [
  { kind: "moveCards", cards: randomUnder(yourIdentity, 9), to: "discard" },
]);
/** "Discard 1 minion tucked under your identity at random." */
const CULL_MINION_ACTION = action("cull-minion.action", [
  {
    kind: "moveCards",
    cards: randomUnder(yourIdentity, 1, { filter: { categories: ["minion"] } } as Partial<CardSelector>),
    to: "discard",
  },
]);
/** "If there are at least 4 minions here, deal 1 random minion here to a player as a facedown encounter card." */
const CAGE_ACTION = action("cage.action", [
  {
    kind: "if",
    condition: tuckedAtLeast({ kind: "tuckedUnder", of: self, filter: { categories: ["minion"] } }, 4),
    then: [
      {
        kind: "selectCards",
        slot: "loose",
        cards: randomUnder(self, 1, { filter: { categories: ["minion"] } } as Partial<CardSelector>),
      },
      { kind: "dealAsEncounterCard", cards: { kind: "slot", slot: "loose" }, player: you },
    ],
  },
]);

const HUNT = stubTreachery({ id: "hunt", boostIcons: 0, abilities: [HUNT_REVEALED.ref, HUNT_RESPONSE.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const THUG = stubMinion({ id: "thug", hp: 2, atk: 1, sch: 1, boostIcons: 0 });
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_RESPONSE.ref] });
const CAGE = stubSupport({ id: "cage", cost: 0, abilities: [CAGE_ACTION.ref] });
const event = (id: string, ability: typeof REVEAL_ACTION) => stubEvent({ id, cost: 0, abilities: [ability.ref] });
const REVEAL = event("reveal", REVEAL_ACTION);
const CULL = event("cull", CULL_ACTION);
const CULL_TWO = event("cull-two", CULL_TWO_ACTION);
const CULL_ALL = event("cull-all", CULL_ALL_ACTION);
const CULL_MINION = event("cull-minion", CULL_MINION_ACTION);
const EVENTS = [REVEAL, CULL, CULL_TWO, CULL_ALL, CULL_MINION];

const deps: EngineDeps = depsOf(
  HUNT_REVEALED,
  HUNT_RESPONSE,
  WITNESS_RESPONSE,
  REVEAL_ACTION,
  CULL_ACTION,
  CULL_TWO_ACTION,
  CULL_ALL_ACTION,
  CULL_MINION_ACTION,
  CAGE_ACTION,
);

/** Takes `id` out of the encounter deck and tucks it under `host` (surgery). */
function tuck(state: GameState, host: InstanceId, id: InstanceId): GameState {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
    instances: {
      ...state.instances,
      [host]: { ...mustInstance(state, host), tucked: [...mustInstance(state, host).tucked, id] },
    },
  };
}

interface Table {
  readonly state: GameState;
  readonly identity: InstanceId;
  readonly witness: InstanceId;
  readonly cage: InstanceId;
  /** What is tucked, in order. */
  readonly under: readonly InstanceId[];
}

/**
 * P1 controls the Witness and the Cage. `tucked` names the encounter cards tucked under `host` (default the identity),
 * in order: the Hunt, a filler or a thug.
 */
function table(
  tucked: readonly ("hunt" | "filler" | "thug")[],
  options: { readonly host?: "identity" | "cage"; readonly seed?: number } = {},
): Table {
  let state = gameAtFirstTurn({
    cards: [HUNT, FILLER, THUG, WITNESS, CAGE, ...EVENTS],
    deps,
    deck: [WITNESS.id, CAGE.id, ...EVENTS.map((e) => e.id)],
    encounter: [...copiesOf(HUNT.id, 6), ...copiesOf(THUG.id, 6), ...copiesOf(FILLER.id, 20)],
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  });
  const witness = playerCardIntoPlay(state, WITNESS.id);
  const cage = playerCardIntoPlay(witness.state, CAGE.id);
  state = cage.state;
  const identity = mustPlayer(state, P1).identity.instanceId;
  const host = options.host === "cage" ? cage.id : identity;
  const under: InstanceId[] = [];
  for (const name of tucked) {
    const deck = state.encounterDecks[activeEncounterDeckId(state)]!.deck;
    const id = deck.find((x) => mustInstance(state, x).cardId === name && !under.includes(x))!;
    state = tuck(state, host, id);
    under.push(id);
  }
  return { state, identity, witness: witness.id, cage: cage.id, under };
}

const reveal = (t: Table) => playFree(onTopOfEncounterDeck(t.state, HUNT.id), deps, REVEAL.id);
const tuckedUnder = (state: GameState, host: InstanceId) => mustInstance(state, host).tucked;
const encounterDiscard = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!.discard;
const damageOn = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const seen = (state: GameState, t: Table) => mustInstance(state, t.witness).counters.seen ?? 0;
const discards = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "tuckedCardDiscarded" ? [e.event] : [],
  );
const huntResponses = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === "hunt.response").length;
function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§3.40 the Hunt revealed: a random discard only at four tucked cards, then it tucks itself", () => {
  it("0 tucked: nothing is discarded, no draw on the RNG, the Hunt is tucked (1)", () => {
    const t = table([]);
    const staged = onTopOfEncounterDeck(t.state, HUNT.id);
    const hunt = staged.encounterDecks[activeEncounterDeckId(staged)]!.deck[0]!;
    const { state, events, session } = reveal(t);
    expect(tuckedUnder(state, t.identity)).toEqual([hunt]);
    expect(discards(events)).toEqual([]);
    expect(state.rng).toEqual(staged.rng);
    expect(damageOn(state, t.identity)).toBe(0);
    expectReplays(session);
  });

  it("1 tucked: nothing is discarded, no draw on the RNG, 2 tucked", () => {
    const t = table(["filler"]);
    const { state, events, session } = reveal(t);
    expect(tuckedUnder(state, t.identity)).toHaveLength(2);
    expect(tuckedUnder(state, t.identity)[0]).toBe(t.under[0]);
    expect(discards(events)).toEqual([]);
    expect(state.rng).toEqual(t.state.rng);
    expectReplays(session);
  });

  it("4 tucked: exactly 1 of the four is discarded by one RNG draw, then the Hunt tucks (4 again); an encounter card's discard", () => {
    const t = table(["filler", "filler", "filler", "filler"]);
    const { state, events, session } = reveal(t);
    const gone = t.under.filter((id) => !tuckedUnder(state, t.identity).includes(id));
    expect(gone).toHaveLength(1);
    expect(encounterDiscard(state)).toContain(gone[0]);
    expect(tuckedUnder(state, t.identity)).toHaveLength(4);
    // The three that stayed keep their order, and the Hunt is last.
    expect(tuckedUnder(state, t.identity).slice(0, 3)).toEqual(t.under.filter((id) => id !== gone[0]));
    expect(mustInstance(state, tuckedUnder(state, t.identity)[3]!).cardId).toBe(HUNT.id);
    expect(state.rng).not.toEqual(t.state.rng);
    // The discard is the Hunt's own effect: an encounter card's, heard once.
    expect(discards(events)).toHaveLength(1);
    expect(discards(events)[0]).toMatchObject({
      instanceId: gone[0],
      hostInstanceId: t.identity,
      by: "encounterCard",
      how: "effect",
      under: "identity",
    });
    expect(seen(state, t)).toBe(1);
    expectReplays(session);
  });

  it("4 Hunts tucked: the Hunt discarded at random by another Hunt deals no damage (0 on the identity)", () => {
    const t = table(["hunt", "hunt", "hunt", "hunt"]);
    const { state, events, session } = reveal(t);
    expect(discards(events)).toHaveLength(1);
    expect(discards(events)[0]!.by).toBe("encounterCard");
    expect(huntResponses(events)).toBe(0);
    expect(damageOn(state, t.identity)).toBe(0);
    expect(tuckedUnder(state, t.identity)).toHaveLength(4);
    expectReplays(session);
  });

  it("the pick follows the seed: the same seed picks the same card twice, and seeds 1 to 40 reach each of the four", () => {
    const pickOf = (seed: number) => {
      const t = table(["filler", "filler", "filler", "filler"], { seed });
      const { state } = reveal(t);
      return t.under.findIndex((id) => !tuckedUnder(state, t.identity).includes(id));
    };
    expect(pickOf(21)).toBe(pickOf(21));
    const reached = new Set(Array.from({ length: 40 }, (_, i) => pickOf(i + 1)));
    expect([...reached].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("§3.40 a random pick among tucked cards as a player card's effect", () => {
  it("1 Hunt tucked, discarded at random by a player card: a player card's discard, the identity takes 2", () => {
    const t = table(["hunt"]);
    const { state, events, session } = playFree(t.state, deps, CULL.id);
    expect(tuckedUnder(state, t.identity)).toEqual([]);
    expect(discards(events)).toHaveLength(1);
    expect(discards(events)[0]).toMatchObject({ instanceId: t.under[0], by: "playerCard", how: "effect" });
    expect(huntResponses(events)).toBe(1);
    expect(damageOn(state, t.identity)).toBe(2);
    expectReplays(session);
  });

  it("0 tucked: nothing is picked and the RNG is not drawn", () => {
    const t = table([]);
    const { state, events, session } = playFree(t.state, deps, CULL.id);
    expect(discards(events)).toEqual([]);
    expect(state.rng).toEqual(t.state.rng);
    expectReplays(session);
  });

  it("2 of 4 at random: two different cards discarded, 2 remain in their order", () => {
    const t = table(["filler", "filler", "filler", "filler"]);
    const { state, events, session } = playFree(t.state, deps, CULL_TWO.id);
    const left = tuckedUnder(state, t.identity);
    expect(left).toHaveLength(2);
    expect(left).toEqual(t.under.filter((id) => left.includes(id)));
    expect(new Set(discards(events).map((d) => d.instanceId)).size).toBe(2);
    expectReplays(session);
  });

  it("9 of 3 at random: all 3 are discarded and no more", () => {
    const t = table(["filler", "filler", "filler"]);
    const { state, events, session } = playFree(t.state, deps, CULL_ALL.id);
    expect(tuckedUnder(state, t.identity)).toEqual([]);
    expect(discards(events)).toHaveLength(3);
    expectReplays(session);
  });

  it("a filter narrows the pool: 3 treacheries and 1 minion tucked, 1 random minion is always the minion", () => {
    const t = table(["filler", "filler", "thug", "filler"]);
    const { state, events, session } = playFree(t.state, deps, CULL_MINION.id);
    expect(discards(events).map((d) => d.instanceId)).toEqual([t.under[2]]);
    expect(tuckedUnder(state, t.identity)).toHaveLength(3);
    expectReplays(session);
  });
});

describe("§3.39 'deal 1 random minion here to a player as a facedown encounter card' (bound, then dealt)", () => {
  const useCage = (t: Table) =>
    runCommands(t.state, deps, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: t.cage,
      abilityId: CAGE_ACTION.ref.id,
      payment: [],
    });

  it("4 minions under the card: 1 of them, by the seeded draw, is dealt facedown and 3 remain; nothing is discarded", () => {
    const t = table(["thug", "thug", "thug", "thug"], { host: "cage" });
    const { state, events, session } = useCage(t);
    const left = tuckedUnder(state, t.cage);
    expect(left).toHaveLength(3);
    const dealt = t.under.filter((id) => !left.includes(id));
    expect(mustPlayer(state, P1).dealtEncounter).toEqual(dealt);
    expect(mustInstance(state, dealt[0]!).faceup).toBe(false);
    expect(discards(events)).toEqual([]);
    expect(state.rng).not.toEqual(t.state.rng);
    expectReplays(session);
  });

  it("3 minions under the card: nothing is dealt, no draw on the RNG", () => {
    const t = table(["thug", "thug", "thug"], { host: "cage" });
    const { state, session } = useCage(t);
    expect(tuckedUnder(state, t.cage)).toEqual(t.under);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([]);
    expect(state.rng).toEqual(t.state.rng);
    expectReplays(session);
  });
});
