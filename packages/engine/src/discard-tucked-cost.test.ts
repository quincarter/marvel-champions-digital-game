/**
 * docs/phase7-wave9.md §3.39: "Discard a card tucked here →" as a cost (`AbilityCost.discardTucked`, `TuckedCostPick`).
 * Synthetic cards shaped like an identity's "Action: Discard a card tucked here → draw 2 cards.", here a support the
 * player controls with cards tucked under it.
 *
 * Sources: RRG 1.8 "Cost" (pp. 13–14: a cost is paid in full or not at all, "with cards and/or game elements they
 * control"), "Initiating Abilities" (p. 24, steps 3 and 5: a cost that cannot be paid aborts with nothing paid), "Tuck"
 * (p. 45: "Tucked cards are not in play"). §4.1 Q7: a tucked card discarded as a cost and one discarded by an effect
 * make the same move, so whatever answers the discard hears both.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command, CostChoices } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubResource, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const draw2 = { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 2 } } as const;

/** "Action: Discard a card tucked here → draw 2 cards." */
const ONE = stubAbility("nest.one", {
  trigger: { kind: "action" },
  cost: { discardTucked: { slot: "discarded", query: {}, under: self, min: 1, max: 1 } },
  effects: [draw2],
});
/** "Action: Discard 2 cards tucked here → draw 2 cards." */
const TWO = stubAbility("nest.two", {
  trigger: { kind: "action" },
  cost: { discardTucked: { slot: "discarded", query: {}, under: self, min: 2, max: 2, bind: "gone" } },
  effects: [draw2],
});
/** "Action: Discard a treachery tucked here → draw 2 cards." */
const PLOTS = stubAbility("nest.plots", {
  trigger: { kind: "action" },
  cost: { discardTucked: { slot: "discarded", query: { categories: ["treachery"] }, under: self, min: 1, max: 1 } },
  effects: [draw2],
});
/** The same discard as an effect: "Action: Discard each card tucked here." */
const SWEEP = stubAbility("nest.sweep", {
  trigger: { kind: "action" },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "tuckedUnder", of: self } }, to: "discard" }],
});
/** "Action: Discard a card tucked under a Nest → draw 2 cards.", on a card that is not the Nest. */
const REACH = stubAbility("perch.reach", {
  trigger: { kind: "action" },
  cost: {
    discardTucked: {
      slot: "discarded",
      query: {},
      under: { kind: "each", query: { categories: ["support"], name: "nest" } },
      min: 1,
      max: 1,
    },
  },
  effects: [draw2],
});

const NEST = stubSupport({ id: "nest", cost: 0, abilities: [ONE.ref, TWO.ref, PLOTS.ref, SWEEP.ref] });
const PERCH = stubSupport({ id: "perch", cost: 0, abilities: [REACH.ref] });
const PLOT = stubTreachery({ id: "plot", boostIcons: 0 });
const SCRAP = stubResource({ id: "scrap", icons: 1 });
const deps: EngineDeps = depsOf(ONE, TWO, PLOTS, SWEEP, REACH);

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
  /** Encounter cards tucked under the Nest. */
  readonly plots?: number;
  /** One of the player's own cards tucked under the Nest, after the encounter cards. */
  readonly scrap?: boolean;
  /** Who controls the Nest. */
  readonly nestOf?: typeof P1 | typeof P2;
  /** A second Nest under the same player. */
  readonly secondNest?: boolean;
  readonly players?: 1 | 2;
}

function start(staged: Staged = {}) {
  let state = gameAtFirstTurn({
    cards: [NEST, PERCH, PLOT, SCRAP],
    deps,
    deck: [...copiesOf(NEST.id, 2), PERCH.id, ...copiesOf(SCRAP.id, 12)],
    encounter: copiesOf(PLOT.id, 8),
    players: staged.players ?? 1,
  });
  const nest = playerCardIntoPlay(state, NEST.id, staged.nestOf ?? P1);
  state = nest.state;
  if (staged.secondNest) state = playerCardIntoPlay(state, NEST.id, staged.nestOf ?? P1).state;
  const perch = playerCardIntoPlay(state, PERCH.id);
  state = perch.state;
  const tucked: InstanceId[] = [];
  for (let i = 0; i < (staged.plots ?? 0); i++) {
    const id = state.encounterDecks[activeEncounterDeckId(state)]!.deck[0]!;
    state = tuck(state, nest.id, id);
    tucked.push(id);
  }
  if (staged.scrap) {
    const given = giveCard(state, P1, SCRAP.id);
    state = tuck(given.state, nest.id, given.id);
    tucked.push(given.id);
  }
  return { state, nest: nest.id, perch: perch.id, tucked };
}

const use = (card: InstanceId, ability: typeof ONE, costChoices?: CostChoices): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: ability.ref.id,
  payment: [],
  ...(costChoices ? { costChoices } : {}),
});
const drive = (state: GameState, command: Command) => driveSession(startSession(state), deps, [command]);
const tuckedUnder = (state: GameState, host: InstanceId) => mustInstance(state, host).tucked;
const encounterDiscard = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!.discard;
const hand = (state: GameState) => mustPlayer(state, P1).hand.length;
const moves = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "cardMoved" && e.from.kind === "tucked" ? [e] : []));
/** How `legalActions` lists this ability: legal with its example command, or illegal with the engine's reason. */
function listed(state: GameState, card: InstanceId, ability: typeof ONE) {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error("not this player's turn");
  const mine = (a: { readonly action: unknown }) =>
    JSON.stringify(a.action).includes(`"${card}"`) && JSON.stringify(a.action).includes(`"${ability.ref.id}"`);
  const legal = actions.legal.find(mine);
  const illegal = actions.illegal.find(mine);
  return {
    legal: legal !== undefined,
    example: legal?.example,
    reason: illegal?.reason,
    message: illegal?.message,
  };
}

describe("§3.39 discarding cards tucked under a card as a cost", () => {
  it("0 tucked: the cost cannot be paid, the ability is listed as illegal with the reason, and nothing is spent", () => {
    const { state, nest } = start();
    expect(listed(state, nest, ONE)).toMatchObject({
      legal: false,
      reason: "no_valid_target",
      message: "not enough tucked cards to discard for this cost",
    });
    const result = applyCommand(state, use(nest, ONE), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
  });

  it("1 tucked: the pick is forced, the encounter card goes to the encounter discard pile, then 2 cards are drawn", () => {
    const { state, nest, tucked } = start({ plots: 1 });
    expect(listed(state, nest, ONE).legal).toBe(true);
    const before = hand(state);
    const { session, events } = drive(state, use(nest, ONE));
    expect(tuckedUnder(session.state, nest)).toEqual([]);
    expect(encounterDiscard(session.state)).toEqual([tucked[0]]);
    expect(hand(session.state)).toBe(before + 2);
    // The cost is paid before the effect (RRG 1.8 "Cost", p. 13): the discard is logged ahead of the first draw.
    const moved = events.findIndex((e) => e.type === "cardMoved" && e.instanceId === tucked[0]);
    const drawn = events.findIndex((e) => e.type === "cardDrawn");
    expect(moved).toBeGreaterThanOrEqual(0);
    expect(moved).toBeLessThan(drawn);
  });

  it("4 tucked: the player names which; only that card is discarded and the other 3 stay in tuck order", () => {
    const { state, nest, tucked } = start({ plots: 4 });
    // No pick given and more than one candidate: the choice is the player's, so the bare command is refused.
    const bare = applyCommand(state, use(nest, ONE), deps);
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.error.code).toBe("invalid_choice");
    const before = hand(state);
    const { session } = drive(state, use(nest, ONE, { discarded: [tucked[2]!] }));
    expect(tuckedUnder(session.state, nest)).toEqual([tucked[0], tucked[1], tucked[3]]);
    expect(encounterDiscard(session.state)).toEqual([tucked[2]]);
    expect(hand(session.state)).toBe(before + 2);
  });

  it("4 tucked: legalActions offers it with an example command that names one tucked card and is accepted", () => {
    const { state, nest, tucked } = start({ plots: 4 });
    const entry = listed(state, nest, ONE);
    expect(entry.legal).toBe(true);
    expect(entry.example).toMatchObject({ costChoices: { discarded: [tucked[0]] } });
    expect(applyCommand(state, entry.example!, deps).ok).toBe(true);
  });

  it("a player's own tucked card goes to its owner's discard pile, not the encounter discard pile", () => {
    const { state, nest, tucked } = start({ plots: 1, scrap: true });
    const scrap = tucked[1]!;
    const { session } = drive(state, use(nest, ONE, { discarded: [scrap] }));
    expect(mustPlayer(session.state, P1).discard).toContain(scrap);
    expect(encounterDiscard(session.state)).toEqual([]);
    expect(tuckedUnder(session.state, nest)).toEqual([tucked[0]]);
  });

  it("a card that is not tucked there, the same card twice, or 2 cards for a cost of 1 is refused, nothing paid", () => {
    const { state, nest, perch, tucked } = start({ plots: 2 });
    const stray = applyCommand(state, use(nest, ONE, { discarded: [perch] }), deps);
    expect(stray.ok).toBe(false);
    if (!stray.ok) expect(stray.error.code).toBe("no_valid_target");
    const both = applyCommand(state, use(nest, ONE, { discarded: [tucked[0]!, tucked[1]!] }), deps);
    expect(both.ok).toBe(false);
    const twice = applyCommand(state, use(nest, TWO, { discarded: [tucked[0]!, tucked[0]!] }), deps);
    expect(twice.ok).toBe(false);
    expect(tuckedUnder(state, nest)).toEqual(tucked);
  });

  it("a cost of 2: unpayable with 1 tucked; with 3 the two named are discarded and 1 stays", () => {
    const short = start({ plots: 1 });
    expect(listed(short.state, short.nest, TWO)).toMatchObject({ legal: false, reason: "no_valid_target" });
    expect(applyCommand(short.state, use(short.nest, TWO), deps).ok).toBe(false);
    expect(tuckedUnder(short.state, short.nest)).toHaveLength(1);

    const { state, nest, tucked } = start({ plots: 3 });
    const { session } = drive(state, use(nest, TWO, { discarded: [tucked[2]!, tucked[0]!] }));
    expect(tuckedUnder(session.state, nest)).toEqual([tucked[1]]);
    expect([...encounterDiscard(session.state)].sort()).toEqual([tucked[0]!, tucked[2]!].sort());
  });

  it("the query narrows which tucked cards can pay: only a player card tucked leaves a treachery cost unpayable", () => {
    const only = start({ scrap: true });
    expect(listed(only.state, only.nest, PLOTS).legal).toBe(false);
    expect(listed(only.state, only.nest, ONE).legal).toBe(true);

    const { state, nest, tucked } = start({ plots: 1, scrap: true });
    // One treachery among the two tucked cards: the pick is forced to it.
    const { session } = drive(state, use(nest, PLOTS));
    expect(encounterDiscard(session.state)).toEqual([tucked[0]]);
    expect(tuckedUnder(session.state, nest)).toEqual([tucked[1]]);
  });

  it("the card the cards are under must be the payer's: another player's Nest leaves no candidate", () => {
    const mine = start({ plots: 1 });
    expect(listed(mine.state, mine.perch, REACH).legal).toBe(true);
    const theirs = start({ plots: 1, nestOf: P2, players: 2 });
    expect(listed(theirs.state, theirs.perch, REACH)).toMatchObject({ legal: false, reason: "no_valid_target" });
    expect(applyCommand(theirs.state, use(theirs.perch, REACH), deps).ok).toBe(false);
    expect(tuckedUnder(theirs.state, theirs.nest)).toHaveLength(1);
  });

  it("the cost names one card: a ref naming two Nests leaves no candidate rather than picking one silently", () => {
    const { state, perch } = start({ plots: 1, secondNest: true });
    expect(listed(state, perch, REACH).legal).toBe(false);
  });

  it("Q7: the cost's discard and an effect's discard of a tucked card log the same move out of the tucked zone", () => {
    const { state, nest, tucked } = start({ plots: 1 });
    const asCost = moves(drive(state, use(nest, ONE)).events);
    const asEffect = moves(drive(state, use(nest, SWEEP)).events);
    const expected = {
      type: "cardMoved",
      instanceId: tucked[0],
      cardId: PLOT.id,
      from: { kind: "tucked", hostInstanceId: nest },
      to: { kind: "encounterDiscard", deckId: activeEncounterDeckId(state) },
    };
    expect(asCost).toEqual([expected]);
    expect(asEffect).toEqual(asCost);
  });

  it("replays to the same state", () => {
    const { state, nest, tucked } = start({ plots: 4 });
    const { session } = drive(state, use(nest, ONE, { discarded: [tucked[1]!] }));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
