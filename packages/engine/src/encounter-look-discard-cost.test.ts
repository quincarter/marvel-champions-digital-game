/**
 * docs/phase7-wave6.md §3.54: looking at encounter cards and discarding one as a cost
 * (`AbilityCost.encounterLookDiscard`, `encounter-look-cost.ts`). Synthetic cards shaped like Thief Extraordinaire
 * (Remy LeBeau, `gambit` 37001b: "Action (thwart): Exhaust Remy LeBeau and look at the top 2 cards of the encounter
 * deck. Discard 1 of those cards → remove threat from a scheme equal to the number of boost icons on that card."), here
 * on a support removing threat from the main scheme.
 *
 * - Only the paying player looks (RRG 1.8 "Look, Looked-At", p. 27): their `chooseCards` choice offers exactly the top
 *   cards, face-visible while it is open and hidden again after; the cards not discarded stay on top in order.
 * - The discard is the cost, paid before the effects (RRG 1.8 "Initiating Abilities", p. 24; "Cost Arrow Icon", p. 14),
 *   from the top of the deck (RRG 1.8 "Discard", p. 16), several discards in deck order.
 * - Fewer cards than the look shows what there is; an empty deck resets first; with too few cards to discard (deck and
 *   discard pile empty) the cost cannot be paid (RRG 1.8 "Cost", p. 13; "Encounter Deck", p. 17), and `legalActions`
 *   says so. A discard that empties the deck resets it at that move (§3.60).
 * - A confused identity still pays the cost of its labeled thwart (RRG 1.8 "Labeled Ability", p. 26; "Confuse", p. 13).
 *
 * No FFG ruling on Thief Extraordinaire in the post-RRG 1.7 rulings transcript.
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeEncounterDeck, activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { faceVisible, zoneHidden } from "./visibility.js";

const SLOT = "stolen";
const removeStolen: EffectSpec = {
  kind: "removeThreat",
  target: { kind: "mainScheme" },
  amount: { kind: "boostIcons", of: { kind: "slot", slot: SLOT } },
};
const lookCost = (look: number, discard: number): AbilityCost => ({
  exhaustSelf: true,
  encounterLookDiscard: { look, discard, slot: SLOT },
});

/** Thief Extraordinaire's shape: exhaust, look at the top 2, discard 1 → remove threat equal to its boost icons. */
const THIEF = stubAbility("thief.action", {
  trigger: { kind: "action" },
  label: ["thwart"],
  cost: lookCost(2, 1),
  effects: [removeStolen],
});
/** Look at the top 3, discard 2 (several discards, one choice). */
const PAIR = stubAbility("pair.action", { trigger: { kind: "action" }, cost: lookCost(3, 2), effects: [removeStolen] });
/** The control: the same action and effect with no look cost. */
const PLAIN = stubAbility("plain.action", {
  trigger: { kind: "action" },
  label: ["thwart"],
  cost: { exhaustSelf: true },
  effects: [{ ...removeStolen, amount: { kind: "const", value: 1 } }],
});
const THIEF_CARD = stubSupport({ id: "thief", cost: 0, abilities: [THIEF.ref] });
const PAIR_CARD = stubSupport({ id: "pair", cost: 0, abilities: [PAIR.ref] });
const PLAIN_CARD = stubSupport({ id: "plain", cost: 0, abilities: [PLAIN.ref] });
/** The same cost on an event's action, played from hand: the slot is bound on the play and reaches its ability. */
const HEIST_ACTION = stubAbility("heist.action", {
  trigger: { kind: "action" },
  cost: { encounterLookDiscard: { look: 2, discard: 1, slot: SLOT } },
  effects: [removeStolen],
});
const HEIST = stubEvent({ id: "heist", cost: 0, abilities: [HEIST_ACTION.ref] });

/** Encounter cards told apart by boost icons, so a wrong pick removes a different amount. */
const T1 = stubTreachery({ id: "t1", boostIcons: 1 });
const T2 = stubTreachery({ id: "t2", boostIcons: 2 });
const T3 = stubTreachery({ id: "t3", boostIcons: 3 });
const T0 = stubTreachery({ id: "t0", boostIcons: 0 });

const deps: EngineDeps = depsOf(THIEF, PAIR, PLAIN, HEIST_ACTION);
const THREAT = 10;

interface Table {
  readonly state: GameState;
  readonly thief: InstanceId;
  readonly pair: InstanceId;
  readonly plain: InstanceId;
  /** The encounter cards by name. */
  readonly card: Readonly<Record<"t1" | "t2" | "t3" | "t0", InstanceId>>;
}

/**
 * P1 with the three supports in play, the main scheme at 10 threat, and the encounter deck and discard pile laid out
 * (top first) from the four named cards; any of them not named is in neither pile (test surgery).
 */
function table(deck: readonly ("t1" | "t2" | "t3" | "t0")[], discard: readonly ("t1" | "t2" | "t3" | "t0")[] = []) {
  let state = gameAtFirstTurn({
    cards: [THIEF_CARD, PAIR_CARD, PLAIN_CARD, HEIST, T1, T2, T3, T0],
    deps,
    encounter: [T1.id, T2.id, T3.id, T0.id],
    deck: [THIEF_CARD.id, PAIR_CARD.id, PLAIN_CARD.id, HEIST.id],
  });
  const ids = [...activeEncounterDeck(state).deck, ...activeEncounterDeck(state).discard];
  const find = (name: string) => ids.find((id) => state.instances[id]?.cardId === name)!;
  const card = { t1: find("t1"), t2: find("t2"), t3: find("t3"), t0: find("t0") };
  const deckId = activeEncounterDeckId(state);
  state = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: deck.map((name) => card[name]), discard: discard.map((name) => card[name]) },
    },
    instances: {
      ...state.instances,
      [state.mainScheme!.instanceId]: { ...mustInstance(state, state.mainScheme!.instanceId), threat: THREAT },
      ...Object.fromEntries(discard.map((name) => [card[name], { ...state.instances[card[name]]!, faceup: true }])),
    },
  };
  const thief = playerCardIntoPlay(state, THIEF_CARD.id);
  const pair = playerCardIntoPlay(thief.state, PAIR_CARD.id);
  const plain = playerCardIntoPlay(pair.state, PLAIN_CARD.id);
  return { state: plain.state, thief: thief.id, pair: pair.id, plain: plain.id, card } satisfies Table;
}

const use = (source: InstanceId, ability: { readonly ref: { readonly id: string } }): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: source,
  abilityId: ability.ref.id as never,
  payment: [],
});

/** Applies one command and stops at the first choice it opens (no answering). */
function step(session: GameSession, command: Command) {
  const result = sessionApply(session, command, deps);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

/** Answers the look with `picks` (and every other choice by default), then checks replay deep-equal. */
function run(state: GameState, command: Command, picks: readonly InstanceId[]) {
  const pick = (s: GameState) =>
    s.pendingChoice?.prompt.kind === "chooseCards" && s.pendingChoice.prompt.slot === SLOT ? picks : defaultPick(s);
  const { session, events } = driveSession(startSession(state), deps, [command], pick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events, session };
}

const threat = (state: GameState) => mustInstance(state, state.mainScheme!.instanceId).threat;
const deckOf = (state: GameState) => activeEncounterDeck(state).deck;
const discardOf = (state: GameState) => activeEncounterDeck(state).discard;
const tokens = (state: GameState) => state.mainScheme!.accelerationTokens;
const settled = (events: readonly GameEvent[]) => events.filter((e) => e.type === "encounterLookCostSettled");
const at = (events: readonly GameEvent[], type: GameEvent["type"]) => events.findIndex((e) => e.type === type);

function offered(state: GameState, source: InstanceId, abilityId: string) {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`not P1's turn: ${actions.kind}`);
  const matches = (a: { readonly action: { readonly kind: string } }) =>
    a.action.kind === "useAbility" &&
    "instanceId" in a.action &&
    a.action.instanceId === source &&
    "abilityId" in a.action &&
    a.action.abilityId === abilityId;
  return { legal: actions.legal.find(matches), illegal: actions.illegal.find(matches) };
}

describe("§3.54 looking at encounter cards and discarding one as a cost", () => {
  it("the payer looks at exactly the top 2, face-visible only during the look; the cost is paid before the effects", () => {
    const { state, thief, card } = table(["t2", "t3", "t1", "t0"]);
    const { legal, illegal } = offered(state, thief, THIEF.ref.id);
    expect(illegal).toBeUndefined();
    expect(legal?.needsPayment).toBe(false);
    for (const id of [card.t2, card.t3]) expect(faceVisible(state, id)).toBe(false);

    const used = step(startSession(state), use(thief, THIEF));
    const looking = used.session.state;
    const choice = looking.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    expect(choice.prompt).toEqual({ kind: "chooseCards", slot: SLOT });
    expect(choice.options.map((o) => o.optionId)).toEqual([card.t2, card.t3]);
    expect([choice.minSelections, choice.maxSelections]).toEqual([1, 1]);
    // The two looked at are seen; the third is not. The exhaust is paid; the effect has not resolved.
    expect(faceVisible(looking, card.t2)).toBe(true);
    expect(faceVisible(looking, card.t3)).toBe(true);
    expect(faceVisible(looking, card.t1)).toBe(false);
    expect(zoneHidden(looking, card.t1)).toBe(true);
    expect(mustInstance(looking, thief).exhausted).toBe(true);
    expect(threat(looking)).toBe(THREAT);
    expect(deckOf(looking)).toEqual([card.t2, card.t3, card.t1, card.t0]);
    expect(used.events).toContainEqual({ type: "cardsLookedAt", playerId: P1, instanceIds: [card.t2, card.t3] });

    // Discarding the 3-icon card removes 3 (a near miss on the other looked-at card would remove 2).
    const { state: after, events } = run(state, use(thief, THIEF), [card.t3]);
    expect(threat(after)).toBe(THREAT - 3);
    expect(deckOf(after)).toEqual([card.t2, card.t1, card.t0]);
    expect(discardOf(after)).toEqual([card.t3]);
    expect(mustInstance(after, card.t3).faceup).toBe(true);
    // The card kept is hidden again once the look ends.
    expect(faceVisible(after, card.t2)).toBe(false);
    expect(settled(events)).toEqual([
      {
        type: "encounterLookCostSettled",
        instanceId: thief,
        playerId: P1,
        lookedAt: [card.t2, card.t3],
        discarded: [card.t3],
        paid: true,
      },
    ]);
    expect(at(events, "cardsLookedAt")).toBeLessThan(at(events, "encounterLookCostSettled"));
    expect(at(events, "encounterLookCostSettled")).toBeLessThan(at(events, "threatRemoved"));
    expect(tokens(after)).toBe(tokens(state));

    const other = run(state, use(thief, THIEF), [card.t2]).state;
    expect(threat(other)).toBe(THREAT - 2);
    expect(deckOf(other)).toEqual([card.t3, card.t1, card.t0]);
  });

  it("discarding 2 of 3: one choice of exactly 2, discarded top first whatever order they were picked in", () => {
    const { state, pair, card } = table(["t1", "t3", "t2", "t0"]);
    const { state: after, events } = run(state, use(pair, PAIR), [card.t2, card.t1]);
    expect(threat(after)).toBe(THREAT - 3);
    expect(deckOf(after)).toEqual([card.t3, card.t0]);
    expect(settled(events)[0]).toMatchObject({ lookedAt: [card.t1, card.t3, card.t2], discarded: [card.t1, card.t2] });
    const moved = events.flatMap((e) => (e.type === "cardMoved" ? [e.instanceId] : []));
    expect(moved.indexOf(card.t1)).toBeLessThan(moved.indexOf(card.t2));
    // The last discarded is the top of the discard pile.
    expect(discardOf(after)[0]).toBe(card.t2);
  });

  it("fewer cards than the look: shows what there is, and the discard that empties the deck resets it (§3.60)", () => {
    const { state, thief, card } = table(["t2"], ["t1", "t3"]);
    const used = step(startSession(state), use(thief, THIEF));
    expect(used.session.state.pendingChoice!.options.map((o) => o.optionId)).toEqual([card.t2]);

    const { state: after, events } = run(state, use(thief, THIEF), [card.t2]);
    expect(threat(after)).toBe(THREAT - 2);
    // Reset at that discard, with the discarded cards in the new deck; one acceleration token.
    expect([...deckOf(after)].sort()).toEqual([card.t1, card.t2, card.t3].sort());
    expect(discardOf(after)).toEqual([]);
    expect(tokens(after)).toBe(tokens(state) + 1);
    expect(settled(events)[0]).toMatchObject({ lookedAt: [card.t2], discarded: [card.t2], paid: true });
  });

  it("a deck of 2 discarded down to 1 does not reset (near miss)", () => {
    const { state, thief, card } = table(["t2", "t1"], ["t3"]);
    const { state: after } = run(state, use(thief, THIEF), [card.t2]);
    expect(deckOf(after)).toEqual([card.t1]);
    expect(discardOf(after)).toEqual([card.t2, card.t3]);
    expect(tokens(after)).toBe(tokens(state));
  });

  it("an empty deck with a discard pile resets first, then the look is of the new deck", () => {
    const { state, thief, card } = table([], ["t1", "t3", "t2"]);
    expect(offered(state, thief, THIEF.ref.id).legal).toBeDefined();
    const used = step(startSession(state), use(thief, THIEF));
    const looking = used.session.state;
    expect(tokens(looking)).toBe(tokens(state) + 1);
    expect(discardOf(looking)).toEqual([]);
    const top2 = deckOf(looking).slice(0, 2);
    expect(looking.pendingChoice!.options.map((o) => o.optionId)).toEqual(top2);
    const { state: after } = run(state, use(thief, THIEF), [top2[0]!]);
    expect(deckOf(after)).toEqual(deckOf(looking).filter((id) => id !== top2[0]));
    expect(threat(after)).toBe(THREAT - mustInstanceIcons(top2[0]!, card));
  });

  it("deck and discard pile both empty: cannot be paid, not offered, and nothing is spent", () => {
    const { state, thief } = table([], []);
    expect(offered(state, thief, THIEF.ref.id)).toMatchObject({
      legal: undefined,
      illegal: { reason: "card_not_in_zone" },
    });
    const refused = sessionApply(startSession(state), use(thief, THIEF), deps);
    expect(refused.ok).toBe(false);
    expect(mustInstance(state, thief).exhausted).toBe(false);
  });

  it("discard 2 with a 1-card deck cannot be paid; a 2-card deck can (near miss)", () => {
    const short = table(["t1"], ["t2", "t3"]);
    expect(offered(short.state, short.pair, PAIR.ref.id).illegal).toMatchObject({ reason: "card_not_in_zone" });
    const enough = table(["t1", "t2"], ["t3"]);
    expect(offered(enough.state, enough.pair, PAIR.ref.id).legal).toBeDefined();
    const { state: after, events } = run(enough.state, use(enough.pair, PAIR), [enough.card.t1, enough.card.t2]);
    expect(threat(after)).toBe(THREAT - 3);
    expect(settled(events)[0]).toMatchObject({ lookedAt: [enough.card.t1, enough.card.t2], paid: true });
  });

  it("a confused identity still pays the cost of its labeled thwart; the thwart is replaced by the confused card", () => {
    const base = table(["t3", "t2", "t1"]);
    const hero = mustPlayer(base.state, P1).identity.instanceId;
    const heroInstance = mustInstance(base.state, hero);
    const state: GameState = {
      ...base.state,
      instances: {
        ...base.state.instances,
        [hero]: { ...heroInstance, statuses: { ...heroInstance.statuses, confused: 1 } },
      },
    };
    const { state: after, events } = run(state, use(base.thief, THIEF), [base.card.t3]);
    expect(mustInstance(after, base.thief).exhausted).toBe(true);
    expect(deckOf(after)).toEqual([base.card.t2, base.card.t1]);
    expect(discardOf(after)).toEqual([base.card.t3]);
    expect(settled(events)[0]).toMatchObject({ paid: true, discarded: [base.card.t3] });
    expect(mustInstance(after, hero).statuses.confused).toBe(0);
    expect(threat(after)).toBe(THREAT);
  });

  it("on an event's action played from hand: the slot reaches its ability", () => {
    const base = table(["t1", "t3", "t2"]);
    const heist = giveCard(base.state, P1, HEIST.id);
    const play: Command = {
      type: "playCard",
      playerId: P1,
      cardInstanceId: heist.id,
      payment: [],
      attachToInstanceId: null,
    };
    const { state: after } = run(heist.state, play, [base.card.t3]);
    expect(threat(after)).toBe(THREAT - 3);
    expect(deckOf(after)).toEqual([base.card.t1, base.card.t2]);
    expect(mustPlayer(after, P1).discard).toContain(heist.id);
  });

  it("nothing changes without the cost: the same action looks at nothing, asks nothing, leaves the deck", () => {
    const { state, plain, card } = table(["t2", "t3", "t1"], ["t0"]);
    const used = step(startSession(state), use(plain, PLAIN));
    expect(used.session.state.pendingChoice).toBeNull();
    const { state: after, events } = run(state, use(plain, PLAIN), []);
    expect(threat(after)).toBe(THREAT - 1);
    expect(deckOf(after)).toEqual([card.t2, card.t3, card.t1]);
    expect(discardOf(after)).toEqual([card.t0]);
    expect(events.some((e) => e.type === "cardsLookedAt" || e.type === "encounterLookCostSettled")).toBe(false);
  });
});

/** The boost icons the stub treachery `id` prints. */
function mustInstanceIcons(id: InstanceId, card: Table["card"]): number {
  return id === card.t1 ? 1 : id === card.t2 ? 2 : id === card.t3 ? 3 : 0;
}
