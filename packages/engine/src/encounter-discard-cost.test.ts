/**
 * docs/phase7-wave9.md §3.43 (a): `AbilityCost.discardFromEncounterDeck { amount | choose, slot }`, "discard the top
 * card of the encounter deck →" and "choose a number from 1 to 5, discard that many cards from the top of the encounter
 * deck →". Proven with synthetic cards shaped like Redwing 53002 and Infiltration 51015, each test driving real
 * commands; the numbers in the titles are the spec's.
 *
 * Sources: RRG 1.8 "Encounter Deck" (p. 17): a discard of a specified number of cards stops when it empties the deck,
 * "is considered to be fulfilled" and is not continued with the new deck, which is made at once with an acceleration
 * token; "Cost" (pp. 13–14): paid in full or not at all, "up to" needs at least one; "Cost Arrow Icon" (p. 14): the
 * cost before the effect; "Star Icon" (p. 40) and "Boost, Boost Icon" (p. 11): a star is counted apart from the boost
 * icons. §3.42 for the top card kept faceup.
 */

import type { AnyCard, CardId, HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, CostSelection } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions, type LegalAction } from "./legal.js";
import { activeEncounterDeck, activeVillain, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import { createGame } from "./setup.js";
import type { Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubMinion, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  defaultPick,
  HERO,
  MAIN_SCHEME,
  RESOURCE,
  VILLAIN,
  withEncounterPiles,
} from "./testing/scenario.js";
import { copiesOf, P1, P2 } from "./testing/wave3.js";
import { faceVisible } from "./visibility.js";

const you = { kind: "controller" } as const;
const theVillain: TargetRef = { kind: "villain" };
const yourIdentity: TargetRef = { kind: "identityOf", player: you };
const v = (name: string): ValueSpec => ({ kind: "var", name }) as ValueSpec;
const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition): StubAbility => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub;
};

// --- Encounter cards: what is discarded. ----------------------------------------------------------------------------
const BLANK_CARD = stubTreachery({ id: "blank-card", boostIcons: 0 });
const ONE_PIP = stubTreachery({ id: "one-pip", boostIcons: 1 });
/** Two boost icons and a star: 3 icons in the boost area. */
const STARRED = stubTreachery({ id: "starred", boostIcons: 2, starIcon: true });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 2, boostIcons: 1 });
const ENCOUNTER: readonly AnyCard[] = [BLANK_CARD, ONE_PIP, STARRED, THUG];

// --- The player cards that pay the cost. ----------------------------------------------------------------------------
const topCost = (amount: number): AbilityCost => ({ discardFromEncounterDeck: { amount, slot: "top" } });
const SHOWS_NO_ICONS: Predicate = { kind: "topOfDeckFaceup", deck: "encounter", boostAreaIcons: { atMost: 0 } };
/**
 * Redwing's shape: "Exhaust → discard the top card of the encounter deck → deal X damage, X the number of icons (★ and
 * boost) in the discarded card's boost area", refused against a showing card with none (§3.42).
 */
const REDWING_ACTION = ability("redwing.action", {
  trigger: { kind: "action", while: { kind: "not", of: SHOWS_NO_ICONS } },
  cost: { exhaustSelf: true, ...topCost(1) },
  effects: [
    {
      kind: "dealDamage",
      target: theVillain,
      amount: { kind: "sum", values: [v("top.boostIcons"), v("top.starIcons")] },
    },
  ],
});
const REDWING = stubUpgrade({ id: "redwing", cost: 0, abilities: [REDWING_ACTION.ref] });
/**
 * Battlefield Awareness's shape, a triggered ability with the cost: "Response: After you change form, exhaust this card
 * and discard the top card of the encounter deck → deal 1 damage for each icon in the discarded card's boost area."
 */
const LOOKOUT_RESPONSE = ability("lookout.response", {
  trigger: { kind: "response", forced: false, on: { on: "formChanged", playerIs: "controller" } },
  cost: { exhaustSelf: true, ...topCost(1) },
  effects: [
    {
      kind: "dealDamage",
      target: theVillain,
      amount: { kind: "sum", values: [v("top.boostIcons"), v("top.starIcons")] },
    },
  ],
});
const LOOKOUT = stubUpgrade({ id: "lookout", cost: 0, abilities: [LOOKOUT_RESPONSE.ref] });
/** A fixed number above 1: "discard the top 3 cards of the encounter deck → deal 1 damage for each". */
const SALVO = stubEvent({
  id: "salvo",
  cost: 0,
  abilities: [
    ability("salvo.action", {
      trigger: { kind: "action" },
      cost: topCost(3),
      effects: [{ kind: "dealDamage", target: theVillain, amount: v("top.count") }],
    }).ref,
  ],
});
/**
 * Infiltration's shape: "Choose a number from 1 to 5. Discard that many cards from the top of the encounter deck →
 * remove 1 threat from the main scheme for each card discarded this way. Put 1 minion discarded this way into play
 * engaged with you." The number chosen is tallied on the identity so a test can read `<slot>.chosen`.
 */
const INFILTRATE = stubEvent({
  id: "infiltrate",
  cost: 0,
  abilities: [
    ability("infiltrate.action", {
      trigger: { kind: "action" },
      cost: { discardFromEncounterDeck: { amount: { choose: { min: 1, max: 5 } }, slot: "found" } },
      effects: [
        { kind: "removeThreat", target: { kind: "mainScheme" } as TargetRef, amount: v("found.count") },
        { kind: "addCounters", target: yourIdentity, counterType: "chosen", amount: v("found.chosen") },
        {
          kind: "chooseCards",
          slot: "minion",
          from: { kind: "ref", ref: { kind: "slot", slot: "found" }, filter: { categories: ["minion"] } },
          chooser: you,
          min: 1,
          max: 1,
        },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "minion" }, controller: you },
      ],
    }).ref,
  ],
});
/** The same cost with nothing after it that can fail: tallies what the slot holds. */
const COUNT = stubEvent({
  id: "count",
  cost: 0,
  abilities: [
    ability("count.action", {
      trigger: { kind: "action" },
      cost: { discardFromEncounterDeck: { amount: { choose: { min: 2, max: 4 } }, slot: "found" } },
      effects: [
        { kind: "addCounters", target: yourIdentity, counterType: "cards", amount: v("found.count") },
        { kind: "addCounters", target: yourIdentity, counterType: "icons", amount: v("found.boostIcons") },
        { kind: "addCounters", target: yourIdentity, counterType: "stars", amount: v("found.starIcons") },
      ],
    }).ref,
  ],
});

/** Falcon's hero face (§3.42): the top card of the encounter deck faceup during the player phase. */
const EAGLE = ability("falcon.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "topOfDeckFaceup", deck: "encounter", while: { kind: "gameStep", phase: "player" } }],
  },
  effects: [],
});
const FALCON: HeroIdentityCard = stubIdentity({
  id: "falcon",
  hp: 11,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroAbilities: [EAGLE.ref],
});

const KIT: readonly AnyCard[] = [REDWING, SALVO, INFILTRATE, COUNT, LOOKOUT];
const deps: EngineDeps = depsOf(...abilities);

/** Two seats at the first turn: P1 plays Falcon (in alter-ego form, so the deck's top card is facedown), P2 the stub hero. */
function table(): GameState {
  const result = createGame(
    {
      seed: 43,
      cards: [...DEFAULT_CARDS, FALCON, ...KIT, ...ENCOUNTER],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: ENCOUNTER.flatMap((card) => copiesOf(card.id, 6)),
      players: [FALCON, HERO].map((card) => ({
        identityCardId: card.id,
        deck: [...copiesOf(RESOURCE.id, 12), ...KIT.flatMap((kit) => [kit.id, kit.id])],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

/**
 * Test surgery, before a session starts (so its log replays): the encounter deck (top first) and its discard pile hold
 * exactly the named cards, the rest of the deck is out of the game, P1 holds one copy of every kit card, and the main
 * scheme holds 10 threat.
 */
function arrange(state: GameState, deck: readonly AnyCard[], discard: readonly AnyCard[] = []): GameState {
  const piles = activeEncounterDeck(state);
  const pool = [...piles.deck, ...piles.discard];
  const take = (cards: readonly AnyCard[]): InstanceId[] =>
    cards.map((card) => {
      const at = pool.findIndex((id) => state.instances[id]!.cardId === card.id);
      if (at < 0) throw new Error(`no spare ${card.id} in the encounter deck`);
      return pool.splice(at, 1)[0]!;
    });
  const next = withEncounterPiles(state, { deck: take(deck), discard: take(discard) });
  const seat = mustPlayer(next, P1);
  const cards = [...seat.hand, ...seat.deck];
  const hand = KIT.map((kit) => cards.find((id) => next.instances[id]!.cardId === kit.id)!);
  const scheme = next.mainScheme.instanceId;
  return {
    ...next,
    removedFromGame: [...next.removedFromGame, ...pool],
    instances: { ...next.instances, [scheme]: { ...next.instances[scheme]!, threat: 10 } },
    players: next.players.map((p) =>
      p.playerId === P1 ? { ...p, hand, deck: cards.filter((id) => !hand.includes(id)) } : p,
    ),
  };
}

const inHand = (state: GameState, card: AnyCard, player: PlayerId = P1): InstanceId => {
  const id = mustPlayer(state, player).hand.find((x) => state.instances[x]!.cardId === card.id);
  if (!id) throw new Error(`${player} holds no ${card.id}`);
  return id;
};
const inPlay = (state: GameState, card: AnyCard): InstanceId => {
  const id = cardsInPlay(state).find((x) => state.instances[x]!.cardId === card.id);
  if (!id) throw new Error(`no ${card.id} in play`);
  return id;
};
const play = (state: GameState, card: AnyCard, costSelection?: CostSelection): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: inHand(state, card),
  payment: [],
  attachToInstanceId: null,
  ...(costSelection ? { costSelection } : {}),
});
const useRedwing = (state: GameState): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: inPlay(state, REDWING),
  abilityId: REDWING_ACTION.ref.id,
  payment: [],
});
const toHero: Command = { type: "changeForm", playerId: P1 };

interface Run {
  readonly session: GameSession;
  readonly state: GameState;
  /** The events of the last step only. */
  readonly events: readonly GameEvent[];
}
const begin = (state: GameState): Run => ({ session: startSession(state), state, events: [] });
/** Answers a `chooseNumber` choice with `number`, and every other choice with the default pick. */
const choosing =
  (number: number) =>
  (state: GameState): readonly string[] =>
    state.pendingChoice?.prompt.kind === "chooseNumber" ? [String(number)] : defaultPick(state);
function step(
  run: Run,
  command: Command | ((state: GameState) => Command),
  pick?: (state: GameState) => readonly string[],
): Run {
  const next = typeof command === "function" ? command(run.state) : command;
  const { session, events } = driveSession(run.session, deps, [next], pick);
  return { session, state: session.state, events };
}
function expectReplays(run: Run): void {
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.state);
}

const piles = (state: GameState) => activeEncounterDeck(state);
const cardIds = (state: GameState, ids: readonly InstanceId[]): CardId[] =>
  ids.map((id) => mustInstance(state, id).cardId);
const villainDamage = (state: GameState): number => mustInstance(state, activeVillain(state).instanceId).damage;
const schemeThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const counters = (state: GameState, type: string): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).counters[type] ?? 0;
const settled = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "encounterDiscardCostSettled" ? [e] : []));
/** Whether applying `command` stops at a `chooseNumber` choice: the payer is asked for the number. */
const asksNumber = (state: GameState, command: Command): boolean => {
  const applied = sessionApply(startSession(state), command, deps);
  if (!applied.ok) throw new Error(applied.error.message);
  return applied.session.state.pendingChoice?.prompt.kind === "chooseNumber";
};
const legalFor = (state: GameState, match: (action: LegalAction) => boolean) => {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error("not P1's turn");
  return {
    legal: actions.legal.find(match),
    illegal: actions.illegal.find((a) => match(a as unknown as LegalAction)),
  };
};
const isPlayOf = (state: GameState, card: AnyCard) => (a: LegalAction) =>
  a.action.kind === "playCard" && a.action.instanceId === inHand(state, card);

describe("§3.43 (a) a fixed number of cards discarded from the top of the encounter deck as a cost", () => {
  it("Redwing with a top card of 2 boost icons and a star: X = 3, the card in the discard pile, nothing asked", () => {
    const start = arrange(table(), [STARRED, ONE_PIP, ONE_PIP]);
    const top = piles(start).deck[0]!;
    let run = step(begin(start), (s) => play(s, REDWING));
    expect(asksNumber(run.state, useRedwing(run.state))).toBe(false);
    run = step(run, useRedwing);
    expect(villainDamage(run.state)).toBe(3);
    expect(piles(run.state).discard).toEqual([top]);
    expect(mustInstance(run.state, top).faceup).toBe(true);
    expect(piles(run.state).deck).toHaveLength(2);
    expect(mustInstance(run.state, inPlay(run.state, REDWING)).exhausted).toBe(true);
    expect(run.state.pendingChoice).toBeNull();
    expect(settled(run.events)).toEqual([
      expect.objectContaining({ chosen: 1, discarded: [top], deckEmptied: false, paid: true, playerId: P1 }),
    ]);
    // The cost is paid before the effect (RRG 1.8 "Cost Arrow Icon", p. 14).
    const types = run.events.map((e) => e.type);
    expect(types.indexOf("encounterDiscardCostSettled")).toBeLessThan(types.indexOf("damageDealt"));
    expectReplays(run);
  });

  it("a card with no icons discarded facedown: the cost is paid and X = 0", () => {
    const start = arrange(table(), [BLANK_CARD, ONE_PIP]);
    let run = step(begin(start), (s) => play(s, REDWING));
    run = step(run, useRedwing);
    expect(villainDamage(run.state)).toBe(0);
    expect(cardIds(run.state, piles(run.state).discard)).toEqual([BLANK_CARD.id]);
    expect(settled(run.events)[0]).toMatchObject({ paid: true });
  });

  it("a triggered ability pays it as an action does: the response's discard, then its effect", () => {
    const start = arrange(table(), [STARRED, ONE_PIP, BLANK_CARD]);
    const top = piles(start).deck[0]!;
    const takeTrigger = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice!;
      return choice.prompt.kind === "chooseTriggers" ? [choice.options[0]!.optionId] : defaultPick(state);
    };
    let run = step(begin(start), (s) => play(s, LOOKOUT));
    run = step(run, toHero, takeTrigger);
    expect(settled(run.events)).toEqual([expect.objectContaining({ chosen: 1, discarded: [top], paid: true })]);
    expect(villainDamage(run.state)).toBe(3);
    expect(mustInstance(run.state, inPlay(run.state, LOOKOUT)).exhausted).toBe(true);
    // The top card is faceup once the hero face is up (§3.42): the card the response discarded was showing, and the
    // next one is shown as it comes to the top.
    expect(run.events.filter((e) => e.type === "encounterTopShown").map((e) => e.instanceId)).toEqual([
      top,
      piles(run.state).deck[0],
    ]);
    expectReplays(run);
  });

  it("a printed 3: three cards top first, counted for the effect", () => {
    const start = arrange(table(), [ONE_PIP, STARRED, THUG, BLANK_CARD]);
    const [a, b, c] = piles(start).deck;
    const run = step(begin(start), (s) => play(s, SALVO));
    expect(villainDamage(run.state)).toBe(3);
    // Discarded one at a time without changing the order (RRG 1.8 "Discard", p. 16): the last one is on top.
    expect(piles(run.state).discard).toEqual([c, b, a]);
    expect(settled(run.events)[0]).toMatchObject({ chosen: 3, discarded: [a, b, c], paid: true });
    expect(cardIds(run.state, piles(run.state).deck)).toEqual([BLANK_CARD.id]);
    expectReplays(run);
  });

  it("a printed 3 over a deck of 2: both discarded, the deck reset with one acceleration token, the cost paid for 2", () => {
    const start = arrange(table(), [ONE_PIP, STARRED], [BLANK_CARD, BLANK_CARD, THUG]);
    const tokens = start.mainScheme.accelerationTokens;
    const run = step(begin(start), (s) => play(s, SALVO));
    expect(settled(run.events)[0]).toMatchObject({ chosen: 3, deckEmptied: true, paid: true });
    expect(settled(run.events)[0]!.discarded).toHaveLength(2);
    expect(villainDamage(run.state)).toBe(2);
    // "Do not continue the discard effect with the newly shuffled encounter deck" (RRG 1.8 p. 17).
    expect(piles(run.state).deck).toHaveLength(5);
    expect(piles(run.state).discard).toEqual([]);
    expect(run.state.mainScheme.accelerationTokens).toBe(tokens + 1);
    expectReplays(run);
  });

  it("an empty deck beside a discard pile is reset first, then discarded from", () => {
    const start = arrange(table(), [], [ONE_PIP, STARRED, BLANK_CARD, THUG]);
    const tokens = start.mainScheme.accelerationTokens;
    const run = step(begin(start), (s) => play(s, SALVO));
    expect(settled(run.events)[0]).toMatchObject({ chosen: 3, deckEmptied: false, paid: true });
    expect(villainDamage(run.state)).toBe(3);
    expect(piles(run.state).deck).toHaveLength(1);
    expect(piles(run.state).discard).toHaveLength(3);
    expect(run.state.mainScheme.accelerationTokens).toBe(tokens + 1);
  });
});

describe("§3.43 (a) a chosen number of cards", () => {
  it("Infiltration choosing 4 with a minion third from the top: 4 threat removed, the minion engaged with the player", () => {
    const start = arrange(table(), [ONE_PIP, BLANK_CARD, THUG, STARRED, ONE_PIP, ONE_PIP]);
    const [a, b, minion, d] = piles(start).deck;
    const asked = sessionApply(startSession(start), play(start, INFILTRATE), deps);
    if (!asked.ok) throw new Error(asked.error.message);
    // The number is asked as the cost is paid: 1 to 5, whatever the deck holds.
    const choice = asked.session.state.pendingChoice;
    expect(choice).toMatchObject({ playerId: P1, prompt: { kind: "chooseNumber", min: 1, max: 5 } });
    expect(choice?.options.map((o) => o.optionId)).toEqual(["1", "2", "3", "4", "5"]);
    expect(piles(asked.session.state).discard).toEqual([]);

    const run = step(begin(start), (s) => play(s, INFILTRATE), choosing(4));
    expect(schemeThreat(run.state)).toBe(10 - 4);
    expect(counters(run.state, "chosen")).toBe(4);
    expect(settled(run.events)).toEqual([
      expect.objectContaining({ chosen: 4, discarded: [a, b, minion, d], deckEmptied: false, paid: true }),
    ]);
    // The minion left the discard pile for play, engaged with the player who played the card; the other three stay.
    expect(cardsInPlay(run.state)).toContain(minion);
    expect(mustInstance(run.state, minion!).engagedWith).toBe(P1);
    expect(piles(run.state).discard).toEqual([d, b, a]);
    expect(piles(run.state).deck).toHaveLength(2);
    expectReplays(run);
  });

  it("choosing 1 and choosing 5: that many cards, that much threat", () => {
    const deck = [ONE_PIP, BLANK_CARD, STARRED, ONE_PIP, BLANK_CARD, ONE_PIP, ONE_PIP];
    const one = step(begin(arrange(table(), deck)), (s) => play(s, INFILTRATE), choosing(1));
    expect(schemeThreat(one.state)).toBe(9);
    expect(piles(one.state).discard).toHaveLength(1);
    expect(counters(one.state, "chosen")).toBe(1);
    const five = step(begin(arrange(table(), deck)), (s) => play(s, INFILTRATE), choosing(5));
    expect(schemeThreat(five.state)).toBe(5);
    expect(piles(five.state).discard).toHaveLength(5);
    expect(piles(five.state).deck).toHaveLength(2);
    expect(counters(five.state, "chosen")).toBe(5);
    expectReplays(five);
  });

  it("Infiltration choosing 5 with 2 cards left: 2 discarded, the deck reset with one acceleration token, 2 threat removed", () => {
    const start = arrange(table(), [ONE_PIP, STARRED], [BLANK_CARD, BLANK_CARD, BLANK_CARD]);
    const [a, b] = piles(start).deck;
    const tokens = start.mainScheme.accelerationTokens;
    // The legal action offers the whole printed range and says how many cards the deck holds.
    expect(legalFor(start, isPlayOf(start, INFILTRATE)).legal?.encounterDeckDiscard).toEqual({
      min: 1,
      max: 5,
      inDeck: 2,
    });
    const run = step(begin(start), (s) => play(s, INFILTRATE), choosing(5));
    expect(settled(run.events)).toEqual([
      expect.objectContaining({ chosen: 5, discarded: [a, b], deckEmptied: true, paid: true }),
    ]);
    expect(schemeThreat(run.state)).toBe(10 - 2);
    // "For each card discarded this way" is 2; the number chosen is still 5.
    expect(counters(run.state, "chosen")).toBe(5);
    expect(run.state.mainScheme.accelerationTokens).toBe(tokens + 1);
    // The two discarded cards went into the new deck with the three that were in the discard pile.
    expect(piles(run.state).deck).toHaveLength(5);
    expect(piles(run.state).deck).toEqual(expect.arrayContaining([a, b]));
    expect(piles(run.state).discard).toEqual([]);
    expectReplays(run);
  });

  it("a range that does not start at 1, with the slot's totals: count, boost icons and stars apart", () => {
    const start = arrange(table(), [STARRED, ONE_PIP, BLANK_CARD, STARRED, ONE_PIP]);
    const asked = sessionApply(startSession(start), play(start, COUNT), deps);
    if (!asked.ok) throw new Error(asked.error.message);
    expect(asked.session.state.pendingChoice?.options.map((o) => o.optionId)).toEqual(["2", "3", "4"]);
    const run = step(begin(start), (s) => play(s, COUNT), choosing(4));
    expect(counters(run.state, "cards")).toBe(4);
    // 2 + 1 + 0 + 2 boost icons; two of the four cards print a star (RRG 1.8 "Boost, Boost Icon", p. 11).
    expect(counters(run.state, "icons")).toBe(5);
    expect(counters(run.state, "stars")).toBe(2);
    expectReplays(run);
  });

  it("the number named in the command is not asked; a number outside the printed range is refused", () => {
    const start = arrange(table(), [ONE_PIP, BLANK_CARD, STARRED, ONE_PIP, BLANK_CARD, ONE_PIP]);
    expect(asksNumber(start, play(start, INFILTRATE))).toBe(true);
    expect(asksNumber(start, play(start, INFILTRATE, { discardFromEncounterDeck: 3 }))).toBe(false);
    const run = step(begin(start), (s) => play(s, INFILTRATE, { discardFromEncounterDeck: 3 }));
    expect(settled(run.events)[0]).toMatchObject({ chosen: 3, paid: true });
    expect(schemeThreat(run.state)).toBe(7);
    expectReplays(run);
    for (const bad of [0, 6, 2.5]) {
      const refused = sessionApply(
        startSession(start),
        play(start, INFILTRATE, { discardFromEncounterDeck: bad }),
        deps,
      );
      expect(refused.ok).toBe(false);
      if (!refused.ok) {
        expect(refused.error.code).toBe("invalid_choice");
        expect(refused.error.message).toContain("1 to 5 cards from the encounter deck");
      }
    }
    // A named number above what the deck holds is legal (RRG 1.8 "Encounter Deck", p. 17).
    const short = arrange(table(), [ONE_PIP, ONE_PIP], [BLANK_CARD]);
    const over = step(begin(short), (s) => play(s, INFILTRATE, { discardFromEncounterDeck: 5 }));
    expect(settled(over.events)[0]).toMatchObject({ chosen: 5, deckEmptied: true, paid: true });
    expect(schemeThreat(over.state)).toBe(8);
  });

  it("two minions among the discards: the player picks which one enters play; none: nothing does", () => {
    const start = arrange(table(), [THUG, ONE_PIP, THUG, ONE_PIP]);
    const [first, , second] = piles(start).deck;
    const pickSecond = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice!;
      if (choice.prompt.kind === "chooseNumber") return ["3"];
      if (choice.prompt.kind === "chooseCards") {
        expect(choice.options.map((o) => o.optionId)).toEqual([first, second]);
        return [second!];
      }
      return defaultPick(state);
    };
    const run = step(begin(start), (s) => play(s, INFILTRATE), pickSecond);
    expect(mustInstance(run.state, second!).engagedWith).toBe(P1);
    expect(cardsInPlay(run.state)).not.toContain(first);
    expect(piles(run.state).discard).toContain(first);
    expect(schemeThreat(run.state)).toBe(7);
    expectReplays(run);

    const none = step(begin(arrange(table(), [ONE_PIP, BLANK_CARD, THUG])), (s) => play(s, INFILTRATE), choosing(2));
    expect(schemeThreat(none.state)).toBe(8);
    expect(cardsInPlay(none.state).filter((id) => mustInstance(none.state, id).cardId === THUG.id)).toEqual([]);
    expect(none.state.pendingChoice).toBeNull();
  });
});

describe("§3.43 (a) the cost in legal actions and why not", () => {
  it("lists the range a player may choose from and the deck's size; a printed number is a range of one", () => {
    const start = arrange(table(), [ONE_PIP, BLANK_CARD, STARRED]);
    const infiltrate = legalFor(start, isPlayOf(start, INFILTRATE)).legal;
    expect(infiltrate?.encounterDeckDiscard).toEqual({ min: 1, max: 5, inDeck: 3 });
    expect(legalFor(start, isPlayOf(start, COUNT)).legal?.encounterDeckDiscard).toEqual({ min: 2, max: 4, inDeck: 3 });
    expect(legalFor(start, isPlayOf(start, SALVO)).legal?.encounterDeckDiscard).toEqual({ min: 3, max: 3, inDeck: 3 });
    // The example command is accepted as it is: the engine asks for the number.
    const example = sessionApply(startSession(start), infiltrate!.example, deps);
    expect(example.ok).toBe(true);
    // A cost with no such component says nothing.
    expect(legalFor(start, isPlayOf(start, REDWING)).legal?.encounterDeckDiscard).toBeUndefined();

    const withRedwing = step(begin(start), (s) => play(s, REDWING)).state;
    const use = legalFor(
      withRedwing,
      (a) => a.action.kind === "useAbility" && a.action.abilityId === REDWING_ACTION.ref.id,
    ).legal;
    expect(use?.encounterDeckDiscard).toEqual({ min: 1, max: 1, inDeck: 3 });
  });

  it("no card in the encounter deck or its discard pile: the cost cannot be paid, and the action says why", () => {
    const start = withEncounterPiles(arrange(table(), [ONE_PIP]), { deck: [], discard: [] });
    const found = legalFor(start, isPlayOf(start, INFILTRATE));
    expect(found.legal).toBeUndefined();
    expect(found.illegal).toMatchObject({
      reason: "card_not_in_zone",
      message: "there is no card in the encounter deck to discard for this cost",
    });
    const refused = sessionApply(startSession(start), play(start, INFILTRATE), deps);
    expect(refused.ok).toBe(false);
    // Nothing was paid: the card is still in hand.
    expect(mustPlayer(start, P1).hand).toContain(inHand(start, INFILTRATE));
  });
});

describe("§3.43 (a) with the top card of the encounter deck faceup (§3.42)", () => {
  const seenByAll = (state: GameState, id: InstanceId): boolean =>
    [P1, P2].every((viewer) => faceVisible(state, id, { viewer, deps }));
  const shown = (events: readonly GameEvent[]) =>
    events.flatMap((e) => (e.type === "encounterTopShown" ? [e.instanceId] : []));

  it("each card that comes to the top as the cost discards is shown, and the card left on top is showing", () => {
    const start = arrange(table(), [ONE_PIP, STARRED, BLANK_CARD, THUG, ONE_PIP]);
    const [, b, c, d] = piles(start).deck;
    let run = step(begin(start), toHero);
    run = step(run, (s) => play(s, SALVO));
    expect(shown(run.events)).toEqual([b, c, d]);
    expect(piles(run.state).deck[0]).toBe(d);
    expect(seenByAll(run.state, d!)).toBe(true);
    expect(villainDamage(run.state)).toBe(3);
    expectReplays(run);
  });

  it("a cost that empties the deck shows the new deck's top card after the reset", () => {
    const start = arrange(table(), [ONE_PIP, STARRED], [BLANK_CARD, THUG]);
    let run = step(begin(start), toHero);
    run = step(run, (s) => play(s, SALVO));
    const top = piles(run.state).deck[0]!;
    expect(shown(run.events).at(-1)).toBe(top);
    expect(run.events.some((e) => e.type === "encounterTopHidden")).toBe(false);
    expect(seenByAll(run.state, top)).toBe(true);
    expectReplays(run);
  });

  it("Redwing against a showing card: refused with no icons, X read from the card everyone saw otherwise", () => {
    const blank = step(
      step(begin(arrange(table(), [BLANK_CARD, STARRED])), (s) => play(s, REDWING)),
      toHero,
    );
    const isUse = (a: LegalAction) => a.action.kind === "useAbility" && a.action.abilityId === REDWING_ACTION.ref.id;
    expect(legalFor(blank.state, isUse).legal).toBeUndefined();
    expect(legalFor(blank.state, isUse).illegal).toBeDefined();
    expect(sessionApply(blank.session, useRedwing(blank.state), deps).ok).toBe(false);

    let run = step(
      step(begin(arrange(table(), [STARRED, BLANK_CARD])), (s) => play(s, REDWING)),
      toHero,
    );
    expect(legalFor(run.state, isUse).legal?.encounterDeckDiscard).toEqual({ min: 1, max: 1, inDeck: 2 });
    run = step(run, useRedwing);
    expect(villainDamage(run.state)).toBe(3);
    // The next card is showing now, and it prints nothing: a second Redwing would be refused (he is exhausted anyway).
    expect(shown(run.events)).toEqual([piles(run.state).deck[0]]);
    expectReplays(run);
  });
});
