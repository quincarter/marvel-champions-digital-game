/**
 * Wave 1's closing primitive batch (docs/phase7-wave1-scripting.md §6): the last three pieces of engine/DSL
 * vocabulary the pinned `packages/cards/src/wave1/coverage.test.ts` `KNOWN_SKIPPED` cards need, plus the fix for the
 * one scripted card that was using the wrong lasting-effect duration as a stand-in.
 *
 * Stub cards only — engine code never names a card. Each `describe` names the printed shape it enables.
 */
import { flat, type Aspect, type CardId } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeVillain, characterProfile, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { runCommands } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMainScheme, stubResource, stubVillain } from "./testing/fixtures.js";
import { expectOk, newGame } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const controller = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: controller };
const c = (value: number): ValueSpec => ({ kind: "const", value });
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

interface Piles {
  readonly hand?: readonly CardId[];
  readonly deck?: readonly CardId[];
  readonly discard?: readonly CardId[];
  /** Where every card not named above goes. `"aside"` parks it out of reach, so the piles are exactly as written. */
  readonly rest?: "aside" | "deck" | "discard";
}

interface Arranged {
  readonly state: GameState;
  readonly hand: readonly InstanceId[];
  readonly deck: readonly InstanceId[];
  readonly discard: readonly InstanceId[];
}

/**
 * Test surgery that deals `player` an exact hand, deck and discard pile out of the instances they already own — the
 * player-side twin of `withEncounterPiles`, and the only way to write a deck-runs-out test that doesn't depend on the
 * opening shuffle.
 */
function arrange(state: GameState, player: PlayerId, piles: Piles): Arranged {
  const owner = mustPlayer(state, player);
  const spare = [...owner.hand, ...owner.deck, ...owner.discard];
  const take = (wanted: readonly CardId[] = []): readonly InstanceId[] =>
    wanted.map((card) => {
      const index = spare.findIndex((id) => mustInstance(state, id).cardId === card);
      if (index < 0) throw new Error(`${player} has no spare ${card}`);
      return spare.splice(index, 1)[0] as InstanceId;
    });
  const hand = take(piles.hand);
  const deck = take(piles.deck);
  const discard = take(piles.discard);
  const rest = piles.rest ?? "aside";
  return {
    hand,
    deck,
    discard,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand,
              deck: rest === "deck" ? [...deck, ...spare] : deck,
              discard: rest === "discard" ? [...discard, ...spare] : discard,
              setAside: rest === "aside" ? [...p.setAside, ...spare] : p.setAside,
            }
          : p,
      ),
    },
  };
}

const counterOn = (state: GameState, id: InstanceId, name: string): number | undefined =>
  mustInstance(state, id).counters[name];
const counter = (state: GameState, name: string, player: PlayerId = p1): number | undefined =>
  counterOn(state, mustPlayer(state, player).identity.instanceId, name);
const cardIdsIn = (state: GameState, ids: readonly InstanceId[]): readonly CardId[] =>
  ids.map((id) => mustInstance(state, id).cardId);

// ---------------------------------------------------------------------------
// 1. "Discard from the top of your deck until …" (player deck)
// ---------------------------------------------------------------------------

/** A card of the hero's own identity set: `aspect: "hero:<identity card id>"` (RRG 1.8 "Identity-Specific Card", p. 23). */
const SIGNATURE = stubAlly({ id: "signature", cost: 1, atk: 1, thw: 1, hp: 2, aspect: "hero:hero" as Aspect });
const FILLER = stubResource({ id: "filler", icons: 1 });

/**
 * Teen Spirit's shape: "Discard cards from the top of your deck until you discard a Ms. Marvel card, then add that
 * card to your hand." The counter records `<bind>.count` so a run that found nothing is observable.
 */
const TEEN_SPIRIT = stubAbility("teen-spirit.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "discardDeckUntil", player: controller, filter: { identitySetOf: controller }, bind: "found" },
    { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "found" } }, to: "hand" },
    { kind: "addCounters", target: yourIdentity, counterType: "found", amount: { kind: "var", name: "found.count" } },
  ],
});
const SPIRIT = stubEvent({ id: "teen-spirit", cost: 0, abilities: [TEEN_SPIRIT.ref] });

const spiritDeps = depsOf(TEEN_SPIRIT);
const SPIRIT_CARDS = [SIGNATURE, FILLER, SPIRIT];
const SPIRIT_DECK: readonly CardId[] = [...copies(FILLER.id, 10), ...copies(SIGNATURE.id, 3), ...copies(SPIRIT.id, 3)];

/** A quiet game whose deck is fillers, identity-set allies and copies of the Teen Spirit stand-in. */
const spiritGame = (players = 1, deps: EngineDeps = spiritDeps, extra: readonly CardId[] = []): GameState =>
  newGame({ players, extraCards: SPIRIT_CARDS, deck: [...SPIRIT_DECK, ...extra], deps, seed: 3 });

/** Plays a card already sitting in `player`'s hand. */
const play = (state: GameState, deps: EngineDeps, card: InstanceId, player: PlayerId = p1): GameState =>
  runCommands(state, deps, {
    type: "playCard",
    playerId: player,
    cardInstanceId: card,
    payment: [],
    attachToInstanceId: null,
  }).state;

describe("`discardDeckUntil`: discard from the top of a player deck until a match", () => {
  it("discards down to the first matching card, binds it, and leaves the rest in the discard pile", () => {
    const set = arrange(spiritGame(), p1, { hand: [SPIRIT.id], deck: [FILLER.id, FILLER.id, SIGNATURE.id, FILLER.id] });
    const [skip1, skip2, match, untouched] = set.deck as [InstanceId, InstanceId, InstanceId, InstanceId];
    const state = play(set.state, spiritDeps, set.hand[0] as InstanceId);

    expect(mustPlayer(state, p1).hand).toContain(match);
    expect(mustPlayer(state, p1).discard).toEqual(expect.arrayContaining([skip1, skip2]));
    expect(mustPlayer(state, p1).discard).not.toContain(match);
    // The search stops at the match: the card under it is still the top of the deck.
    expect(mustPlayer(state, p1).deck).toEqual([untouched]);
    expect(counter(state, "found")).toBe(1);
  });

  it("binds nothing and the following effects still run when the deck holds no match", () => {
    const set = arrange(spiritGame(), p1, { hand: [SPIRIT.id], deck: copies(FILLER.id, 3) });
    const state = play(set.state, spiritDeps, set.hand[0] as InstanceId);

    expect(mustPlayer(state, p1).deck).toEqual([]);
    expect(cardIdsIn(state, mustPlayer(state, p1).hand)).not.toContain(SIGNATURE.id);
    // `<bind>.count` is 0, and the `moveCards` after it moved nothing rather than erroring.
    expect(counter(state, "found")).toBeUndefined();
  });

  /**
   * RRG 1.8 "Player Deck" (p. 33): "If the player's deck empties while the player was discarding cards from their
   * deck, no further cards are discarded from the newly shuffled deck." Read from the player-deck entry itself, not
   * carried over from "Encounter Deck" (p. 17) — the two happen to agree.
   */
  it("stops when the deck empties mid-discard and never reaches the match waiting in the discard pile", () => {
    const set = arrange(spiritGame(), p1, { hand: [SPIRIT.id], deck: copies(FILLER.id, 2), discard: [SIGNATURE.id] });
    const [match] = set.discard as [InstanceId];
    const state = play(set.state, spiritDeps, set.hand[0] as InstanceId);

    expect(mustPlayer(state, p1).hand).not.toContain(match);
    expect(mustPlayer(state, p1).discard).toContain(match);
    expect(counter(state, "found")).toBeUndefined();
    // Both fillers were discarded, and the deck was left empty rather than refilled by this effect.
    expect(mustPlayer(state, p1).deck).toEqual([]);
    expect(mustPlayer(state, p1).discard).toEqual(expect.arrayContaining([...set.deck]));
  });

  /**
   * The other half of p. 33: "If a player deck empties, the player shuffles their discard pile to make a new deck.
   * That player immediately deals themself one facedown encounter card." A deck that was *already* empty when the
   * effect began resets first and the discarding then happens from the new deck — `discardEncounterCards` makes the
   * same split for the encounter deck.
   */
  it("resets an already-empty deck first, takes the encounter-card penalty, and searches the new deck", () => {
    const set = arrange(spiritGame(), p1, { hand: [SPIRIT.id], deck: [], discard: [FILLER.id, SIGNATURE.id] });
    const state = play(set.state, spiritDeps, set.hand[0] as InstanceId);

    expect(cardIdsIn(state, mustPlayer(state, p1).hand)).toContain(SIGNATURE.id);
    expect(counter(state, "found")).toBe(1);
    expect(mustPlayer(state, p1).dealtEncounter).toHaveLength(1);
  });

  it("does nothing at all when deck and discard pile are both empty", () => {
    const set = arrange(spiritGame(), p1, { hand: [SPIRIT.id], deck: [], discard: [] });
    const state = play(set.state, spiritDeps, set.hand[0] as InstanceId);

    expect(counter(state, "found")).toBeUndefined();
    // p. 33: "the deck does not reset until there is at least one card in the player's discard pile" — so no penalty.
    expect(mustPlayer(state, p1).dealtEncounter).toHaveLength(0);
  });

  it("searches each named player's own deck in player order, every match landing in the one slot", () => {
    const EACH = stubAbility("each-deck.action", {
      trigger: { kind: "action" },
      effects: [
        { kind: "discardDeckUntil", player: { kind: "each" }, filter: { categories: ["ally"] }, bind: "found" },
        {
          kind: "addCounters",
          target: yourIdentity,
          counterType: "found",
          amount: { kind: "var", name: "found.count" },
        },
      ],
    });
    const CARD = stubEvent({ id: "each-deck", cost: 0, abilities: [EACH.ref] });
    const deps = depsOf(EACH);
    const start = newGame({
      players: 2,
      extraCards: [...SPIRIT_CARDS, CARD],
      deck: [...SPIRIT_DECK, CARD.id],
      deps,
      seed: 3,
    });
    const first = arrange(start, p1, { hand: [CARD.id], deck: [FILLER.id, SIGNATURE.id] });
    const second = arrange(first.state, p2, { deck: [SIGNATURE.id, FILLER.id] });
    const state = play(second.state, deps, first.hand[0] as InstanceId);

    expect(counter(state, "found")).toBe(2);
    expect(cardIdsIn(state, mustPlayer(state, p1).discard)).toEqual(expect.arrayContaining([FILLER.id, SIGNATURE.id]));
    expect(cardIdsIn(state, mustPlayer(state, p2).discard)).toContain(SIGNATURE.id);
    // p2's second card was never reached: the search stopped at its match.
    expect(mustPlayer(state, p2).deck).toEqual([second.deck[1]]);
  });
});

// ---------------------------------------------------------------------------
// 2. A per-player hand discard with a live count and a card filter
// ---------------------------------------------------------------------------

/**
 * "A resource of any type": a card with a printed resource icon of any of the four types RRG 1.8 "Resource" (p. 37)
 * lists. Printed icons only — the bottom-left corner, never a resource an ability generates (ruling, Jan 11, 2026
 * (3): "the discarded card must have a [wild] resource icon printed in its bottom-left corner. The only time a
 * 'printed resource' can refer to a resource generated by an ability is when paying a cost").
 */
const ANY_RESOURCE = { anyPrintedResource: ["physical", "mental", "energy", "wild"] } as const;

/** A player card with no printed resource icon at all: the thing the filter has to exclude. */
const ICONLESS = stubEvent({ id: "iconless", cost: 0, resources: 0 });
/** One printed [physical]. */
const PHYSICAL = stubResource({ id: "physical-res", icons: 0, produces: { physical: 1 } });

/**
 * Power Drain's shape: "Discard 2 cards from the encounter deck. Each player must choose and discard 1 resource of
 * any type from their hand for each boost icon discarded this way." The count is a live `<bind>.boostIcons`, known
 * only once the encounter cards are turned over, and the candidates are filtered.
 */
const POWER_DRAIN = stubAbility("power-drain.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "addCounters", target: yourIdentity, counterType: "icons", amount: { kind: "const", value: 0 } },
    {
      kind: "discardFromHand",
      player: { kind: "each" },
      amount: { kind: "var", name: "drained" },
      filter: ANY_RESOURCE,
    },
  ],
});
/** The same, with a fixed count, for the cases that don't need a bound var. */
const drainer = (id: string, count: number, filter: typeof ANY_RESOURCE | undefined = ANY_RESOURCE) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [{ kind: "discardFromHand", player: { kind: "each" }, amount: c(count), ...(filter ? { filter } : {}) }],
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const DRAIN_ONE = drainer("drain-one", 1);
const DRAIN_THREE = drainer("drain-three", 3);

const DRAIN_CARDS = [ICONLESS, PHYSICAL, FILLER, DRAIN_ONE.card, DRAIN_THREE.card];
const drainDeps = depsOf(DRAIN_ONE.ability, DRAIN_THREE.ability, POWER_DRAIN);
const DRAIN_DECK: readonly CardId[] = [
  ...copies(ICONLESS.id, 6),
  ...copies(PHYSICAL.id, 6),
  ...copies(FILLER.id, 6),
  ...copies(DRAIN_ONE.card.id, 3),
  ...copies(DRAIN_THREE.card.id, 3),
];

const drainGame = (players = 2): GameState =>
  newGame({ players, extraCards: DRAIN_CARDS, deck: DRAIN_DECK, deps: drainDeps, seed: 3 });

/**
 * Applies one command without auto-answering anything, so the test can inspect the choice the engine parked — the
 * shape a client reads straight off `legalActions`.
 */
const step = (state: GameState, command: Command, deps: EngineDeps = drainDeps): GameState =>
  expectOk(applyCommand(state, command, deps));
const playRaw = (state: GameState, card: InstanceId, deps: EngineDeps = drainDeps, player: PlayerId = p1): GameState =>
  step(
    state,
    { type: "playCard", playerId: player, cardInstanceId: card, payment: [], attachToInstanceId: null },
    deps,
  );

/** The parked choice as `legalActions` hands it to a client. */
const pending = (state: GameState, deps: EngineDeps = drainDeps) => {
  const actions = legalActions(state, p1, deps);
  if (actions.kind !== "choice") throw new Error(`expected a pending choice, got ${actions.kind}`);
  return actions.choice;
};

/** Answers the parked choice with exactly these option ids. */
const answer = (
  state: GameState,
  selectedOptionIds: readonly InstanceId[],
  deps: EngineDeps = drainDeps,
): GameState => {
  const choice = state.pendingChoice;
  if (!choice) throw new Error("no pending choice");
  return step(
    state,
    {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: [...selectedOptionIds],
    },
    deps,
  );
};

describe("`discardFromHand` with a `filter`: 'discard 1 resource of any type from their hand'", () => {
  it("offers only the hand cards that match, never the iconless ones", () => {
    const first = arrange(drainGame(), p1, { hand: [ICONLESS.id, PHYSICAL.id, FILLER.id, DRAIN_ONE.card.id] });
    const second = arrange(first.state, p2, { hand: [ICONLESS.id] });
    const [iconless, physical, filler, drain] = first.hand as [InstanceId, InstanceId, InstanceId, InstanceId];
    const state = playRaw(second.state, drain);

    const choice = pending(state);
    expect(choice.playerId).toBe(p1);
    expect(choice.options.map((o) => o.optionId)).toEqual([physical, filler]);
    expect(choice.options.map((o) => o.optionId)).not.toContain(iconless);
    expect([choice.minSelections, choice.maxSelections]).toEqual([1, 1]);
  });

  it("clamps the count to how many matching cards the player actually holds", () => {
    const first = arrange(drainGame(), p1, { hand: [PHYSICAL.id, ICONLESS.id, ICONLESS.id, DRAIN_THREE.card.id] });
    const second = arrange(first.state, p2, { hand: [ICONLESS.id] });
    const state = playRaw(second.state, first.hand[3] as InstanceId);

    // "Must … discard 3" with one matching card in hand discards that one and no more.
    const choice = pending(state);
    expect([choice.minSelections, choice.maxSelections]).toEqual([1, 1]);
    expect(choice.options.map((o) => o.optionId)).toEqual([first.hand[0]]);
  });

  it("asks each player in player order, one choice at a time, and skips a player with no match", () => {
    const first = arrange(drainGame(3), p1, { hand: [ICONLESS.id, DRAIN_ONE.card.id] });
    const second = arrange(first.state, p2, { hand: [PHYSICAL.id, ICONLESS.id] });
    const third = arrange(second.state, playerId("p3"), { hand: [FILLER.id] });
    const started = playRaw(third.state, first.hand[1] as InstanceId);

    // p1 holds nothing that matches, so p1 is skipped without a choice and p2 is asked first.
    const p2Choice = pending(started);
    expect(p2Choice.playerId).toBe(p2);
    expect(p2Choice.options.map((o) => o.optionId)).toEqual([second.hand[0]]);

    const afterP2 = answer(started, [second.hand[0] as InstanceId]);
    const p3Choice = pending(afterP2);
    expect(p3Choice.playerId).toBe(playerId("p3"));
    expect(p3Choice.options.map((o) => o.optionId)).toEqual([third.hand[0]]);

    const done = answer(afterP2, [third.hand[0] as InstanceId]);
    expect(done.pendingChoice).toBeNull();
    expect(mustPlayer(done, p1).hand).toEqual([first.hand[0]]);
    expect(mustPlayer(done, p2).discard).toContain(second.hand[0]);
    expect(mustPlayer(done, playerId("p3")).discard).toContain(third.hand[0]);
  });

  it("does not stop for a choice at all when no player holds a matching card", () => {
    const first = arrange(drainGame(), p1, { hand: [ICONLESS.id, DRAIN_ONE.card.id] });
    const second = arrange(first.state, p2, { hand: [ICONLESS.id] });
    const state = playRaw(second.state, first.hand[1] as InstanceId);

    expect(state.pendingChoice).toBeNull();
    expect(mustPlayer(state, p1).hand).toEqual([first.hand[0]]);
    expect(mustPlayer(state, p2).hand).toEqual([second.hand[0]]);
  });

  it("reads the count live, so a value bound earlier in the same ability drives it", () => {
    const BOUND = stubAbility("bound-drain.action", {
      trigger: { kind: "action" },
      effects: [
        // Stands in for "discard 2 cards from the encounter deck … for each boost icon discarded this way": the
        // count is only known once the earlier effect has run.
        { kind: "addCounters", target: yourIdentity, counterType: "icons", amount: c(2) },
        {
          kind: "discardFromHand",
          player: { kind: "each" },
          amount: { kind: "counters", of: yourIdentity, counterType: "icons" },
          filter: ANY_RESOURCE,
        },
      ],
    });
    const CARD = stubEvent({ id: "bound-drain", cost: 0, abilities: [BOUND.ref] });
    const deps = depsOf(BOUND);
    const start = newGame({
      players: 1,
      extraCards: [...DRAIN_CARDS, CARD],
      deck: [...DRAIN_DECK, CARD.id],
      deps,
      seed: 3,
    });
    const set = arrange(start, p1, { hand: [PHYSICAL.id, FILLER.id, ICONLESS.id, CARD.id] });
    const state = playRaw(set.state, set.hand[3] as InstanceId, deps);

    const choice = pending(state, deps);
    expect([choice.minSelections, choice.maxSelections]).toEqual([2, 2]);
    expect(choice.options.map((o) => o.optionId)).toEqual([set.hand[0], set.hand[1]]);
  });
});

// ---------------------------------------------------------------------------
// 3. A stat bonus scoped to an activation that has not started yet
// ---------------------------------------------------------------------------

/**
 * Death from Above's shape: "When Revealed (Hero): Green Goblin attacks with +X ATK, where X is the villain's stage
 * number" (and the alter-ego half, "schemes with +X SCH").
 *
 * The bonus belongs to *that* activation, which has not been initiated when the sentence is read, so
 * `modifyAttack`'s `atkBonus` (which changes the activation already in progress) cannot express it and
 * `modifyStatUntil`'s `until: "endOfAttack"` is dropped outright when no activation is in progress. Carrying the
 * bonus on the `enemyAttack`/`enemyScheme` effect itself is what scopes it correctly.
 */
const BOSS = stubVillain({ id: "bonus-boss", stages: [{ hp: flat(40), atk: 1, sch: 1 }] });
const DASHED = stubVillain({
  id: "dashed-boss",
  stages: [{ hp: flat(40), atk: 0, sch: 0, dashedStats: ["atk", "sch"] }],
});
const BONUS_SCHEME = stubMainScheme({
  id: "bonus-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const theVillain: TargetRef = { kind: "villain" };
const you = { kind: "controller" } as const;

/** The workaround `mutagen-formula.ts` had to use: a phase-long stat bonus, then the activation. */
const phaseBonus = (id: string, stat: "atk" | "sch", activation: "enemyAttack" | "enemyScheme") =>
  stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [
      { kind: "modifyStatUntil", stat, amount: c(2), target: theVillain, until: "endOfPhase" },
      { kind: activation, enemies: theVillain, against: you, boost: false },
    ],
  });
/** The primitive: the bonus rides on the activation the same sentence initiates. */
const scopedBonus = (id: string, activation: "enemyAttack" | "enemyScheme", bonus: Record<string, ValueSpec>) =>
  stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [{ kind: activation, enemies: theVillain, against: you, boost: false, ...bonus } as EffectSpec],
  });

const WORKAROUND_ATK = phaseBonus("workaround-atk", "atk", "enemyAttack");
const WORKAROUND_SCH = phaseBonus("workaround-sch", "sch", "enemyScheme");
const SCOPED_ATK = scopedBonus("scoped-atk", "enemyAttack", { atkBonus: c(2) });
const SCOPED_SCH = scopedBonus("scoped-sch", "enemyScheme", { schBonus: c(2) });

const bonusCard = (ability: { readonly ref: { readonly id: string } }, id: string) =>
  stubEvent({ id, cost: 0, abilities: [ability.ref as never] });
const WORKAROUND_ATK_CARD = bonusCard(WORKAROUND_ATK, "workaround-atk");
const WORKAROUND_SCH_CARD = bonusCard(WORKAROUND_SCH, "workaround-sch");
const SCOPED_ATK_CARD = bonusCard(SCOPED_ATK, "scoped-atk");
const SCOPED_SCH_CARD = bonusCard(SCOPED_SCH, "scoped-sch");

const BONUS_CARDS = [WORKAROUND_ATK_CARD, WORKAROUND_SCH_CARD, SCOPED_ATK_CARD, SCOPED_SCH_CARD, FILLER];
const bonusDeps = depsOf(WORKAROUND_ATK, WORKAROUND_SCH, SCOPED_ATK, SCOPED_SCH);
const BONUS_DECK: readonly CardId[] = [
  ...copies(FILLER.id, 8),
  ...copies(WORKAROUND_ATK_CARD.id, 3),
  ...copies(WORKAROUND_SCH_CARD.id, 3),
  ...copies(SCOPED_ATK_CARD.id, 3),
  ...copies(SCOPED_SCH_CARD.id, 3),
];

const bonusGame = (villain = BOSS): GameState =>
  newGame({
    players: 1,
    villain,
    mainScheme: BONUS_SCHEME,
    extraCards: BONUS_CARDS,
    deck: BONUS_DECK,
    deps: bonusDeps,
    seed: 3,
  });

const heroDamage = (state: GameState): number => mustInstance(state, mustPlayer(state, p1).identity.instanceId).damage;
const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;

/** Plays the card twice from one hand, resolving each fully; both plays are in the same player phase. */
function playTwice(
  state: GameState,
  card: CardId,
  deps: EngineDeps = bonusDeps,
): { readonly first: GameState; readonly second: GameState } {
  const set = arrange(state, p1, { hand: [card, card] });
  const first = play(set.state, deps, set.hand[0] as InstanceId);
  const second = play(first, deps, set.hand[1] as InstanceId);
  return { first, second };
}

describe("`enemyAttack.atkBonus` / `enemyScheme.schBonus`: a bonus scoped to the activation the effect starts", () => {
  it('the `until: "endOfPhase"` workaround stacks: a second copy in the same phase attacks at +2X', () => {
    const { first, second } = playTwice(bonusGame(), WORKAROUND_ATK_CARD.id);
    // ATK 1 + 2 = 3 for the first attack …
    expect(heroDamage(first)).toBe(3);
    // … and 1 + 2 + 2 = 5 for the second, because both phase-long bonuses are still live. That is the bug.
    expect(heroDamage(second) - heroDamage(first)).toBe(5);
  });

  it("the scoped bonus does not stack: each activation gets exactly its own +X ATK", () => {
    const { first, second } = playTwice(bonusGame(), SCOPED_ATK_CARD.id);
    expect(heroDamage(first)).toBe(3);
    expect(heroDamage(second) - heroDamage(first)).toBe(3);
  });

  it("the same for a scheme activation: `schBonus` applies once, to that activation only", () => {
    const stacked = playTwice(bonusGame(), WORKAROUND_SCH_CARD.id);
    expect(mainThreat(stacked.first)).toBe(3);
    expect(mainThreat(stacked.second) - mainThreat(stacked.first)).toBe(5);

    const scoped = playTwice(bonusGame(), SCOPED_SCH_CARD.id);
    expect(mainThreat(scoped.first)).toBe(3);
    expect(mainThreat(scoped.second) - mainThreat(scoped.first)).toBe(3);
  });

  it("leaves the villain's printed stats alone once the activation is over", () => {
    const set = arrange(bonusGame(), p1, { hand: [SCOPED_ATK_CARD.id] });
    const state = play(set.state, bonusDeps, set.hand[0] as InstanceId);
    expect(characterProfile(state, activeVillain(state).instanceId, bonusDeps)?.atk).toBe(1);
  });

  /**
   * RRG 1.8 "Dash (Value)" (p. 15): a dash "is treated as an unmodifiable 0", so "+X ATK"/"+X SCH" does not raise it
   * — the same rule the in-progress `modifyAttack.atkBonus` already follows. (This engine skips an activation whose
   * stat is dashed outright, so the assertion is that nothing happened at all.)
   */
  it("does not raise a dashed ATK or SCH", () => {
    const set = arrange(bonusGame(DASHED), p1, { hand: [SCOPED_ATK_CARD.id, SCOPED_SCH_CARD.id] });
    const attacked = play(set.state, bonusDeps, set.hand[0] as InstanceId);
    expect(heroDamage(attacked)).toBe(0);
    const schemed = play(attacked, bonusDeps, set.hand[1] as InstanceId);
    expect(mainThreat(schemed)).toBe(0);
  });
});
