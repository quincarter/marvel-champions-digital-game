/**
 * docs/phase7-wave2.md §18: the wave 2 `KNOWN_SKIPPED` audit. Three of the fifteen non-campaign skips name a
 * primitive that already exists; this file is the evidence, driven through real commands rather than read off the
 * type. Synthetic cards throughout — engine code never names a card, and the card names in the test titles only say
 * which printed text each shape was checked against.
 *
 * Sources: RRG 1.8 "Cost" (p. 13, overpayment), "Choose (Game Element)" (p. 12), "Search" (p. 39), "Tuck" (p. 45),
 * "Leaves Play" (p. 27).
 */

import { flat, trait, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand } from "./engine.js";
import { legalActions } from "./legal.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import { matchesQuery } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubResource,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, runWith, settle, settleUntil, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const play = (id: InstanceId, payment: readonly Payment[] = []): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
});

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
});

interface Setup {
  readonly cards?: readonly AnyCard[];
  readonly abilities?: readonly StubAbility[];
  readonly villain?: ReturnType<typeof stubVillain>;
  readonly encounter?: readonly CardId[];
  readonly deck?: readonly CardId[];
}

function setup({ cards = [], abilities = [], villain, encounter, deck }: Setup): {
  deps: EngineDeps;
  state: GameState;
} {
  const deps = depsOf(...abilities);
  const playable = cards.filter(
    (c) =>
      c.type === "event" || c.type === "upgrade" || c.type === "ally" || c.type === "support" || c.type === "resource",
  );
  const state = newGame({
    villain: villain ?? stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] }),
    mainScheme: SCHEME,
    extraCards: [BLANK, ...cards],
    deck: deck ?? [...playable.flatMap((c) => copies(c.id)), ...copies(RESOURCE.id, 14)],
    encounterDeck: encounter ?? copies(BLANK.id, 20),
    deps,
  });
  return { deps, state };
}

// ---- §18.1 an overpayment read from a later `cardEntersPlay` interrupt ---------------------------------------------

/**
 * "Interrupt: When Ant-Man enters play, place 1 pym counter on him (to a maximum of 4) for each resource you
 * overpaid for Ant-Man's cost." (Ant-Man 12011; Wasp 13012 is the same sentence counting `[energy]` only.)
 *
 * The skip claimed `overpaid.*` was readable only inside the ability resolution that paid the cost.
 * `abilityFrame` (`resolve/frames.ts`) merges `playPaymentVars` into **every** ability frame whose card still has a
 * `playCard` frame on the stack, and `cardEntersPlay` is announced from inside that frame (`resolve/enter-play.ts`),
 * so a later interrupt on the same card already reads it.
 */
describe("§18.1 `overpaid.*` read from a `cardEntersPlay` interrupt on the card being played", () => {
  const PHYSICAL = stubResource({ id: "phys", icons: 0, produces: { physical: 1 } });
  const ENERGY = stubResource({ id: "nrg", icons: 0, produces: { energy: 1 } });

  const counters = (id: string, name: string, max: number) =>
    stubAbility(
      id,
      def({
        trigger: { kind: "interrupt", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
        effects: [
          {
            kind: "addCounters",
            target: { kind: "self" },
            counterType: "pym",
            amount: { kind: "scaled", value: { kind: "var", name }, max },
          },
        ],
      }),
    );

  const totalAbility = counters("pym.total", "overpaid.total", 4);
  const PYM = stubAlly({ id: "pym", cost: 1, atk: 1, thw: 1, hp: 3, abilities: [totalAbility.ref] });
  const energyAbility = counters("sting.energy", "overpaid.energy", 3);
  const STING = stubAlly({ id: "sting", cost: 1, atk: 1, thw: 1, hp: 3, abilities: [energyAbility.ref] });

  /** Plays `ally` paying with the named resource cards, and reports the counters it entered play with. */
  function pymCounters(card: AnyCard, ability: StubAbility, wallet: readonly CardId[]): number {
    const { deps, state } = setup({
      cards: [PHYSICAL, ENERGY, card],
      abilities: [ability],
      deck: [...copies(PHYSICAL.id, 10), ...copies(ENERGY.id, 10), ...copies(card.id, 3)],
    });
    const given = giveCards(state, p1, card.id, ...wallet);
    const [ally, ...paid] = given.ids;
    if (!ally) throw new Error("no ally");
    const after = settle(
      runWith(
        deps,
        given.state,
        play(
          ally,
          paid.map((id) => ({ fromHand: id })),
        ),
      ),
      undefined,
      deps,
    );
    return mustInstance(after, ally).counters.pym ?? 0;
  }

  it("counts every resource paid beyond the printed cost (RRG 1.8 'Cost', p. 13)", () => {
    // Cost 1 paid with 3: two overpaid.
    expect(pymCounters(PYM, totalAbility, [PHYSICAL.id, PHYSICAL.id, PHYSICAL.id])).toBe(2);
  });

  it("reads 0 when the card is paid for exactly", () => {
    expect(pymCounters(PYM, totalAbility, [PHYSICAL.id])).toBe(0);
  });

  it("counts one resource type only, for a card that names one", () => {
    // Cost 1 paid with 2 [energy] + 2 [physical]: 3 overpaid, of which at most 2 can be the [energy] ones.
    expect(pymCounters(STING, energyAbility, [ENERGY.id, ENERGY.id, PHYSICAL.id, PHYSICAL.id])).toBe(2);
    // The same overpayment made entirely of the wrong type counts nothing.
    expect(pymCounters(STING, energyAbility, [PHYSICAL.id, PHYSICAL.id, PHYSICAL.id])).toBe(0);
  });
});

// ---- §18.2 "up to X", where X is read from the board ----------------------------------------------------------------

/**
 * "Action: Give up to X friendly characters a tough status card, where X is the villain's stage number (to a maximum
 * of 3)." (Muster Courage 12032.)
 *
 * The skip named `EffectSpec chooseCards.max`, which is indeed a fixed `number` — but a choice among characters **in
 * play** is `chooseTarget`, whose `count` has been `number | ValueSpec` since Shield Toss and whose `optional` is
 * exactly "up to" (RRG 1.8 "Choose (Game Element)", p. 12).
 */
describe("§18.2 `chooseTarget.count` as a live value, with `optional` for 'up to'", () => {
  const muster = stubAbility(
    "muster.action",
    def({
      trigger: { kind: "action", form: "hero" },
      effects: [
        {
          kind: "chooseTarget",
          slot: "brave",
          query: { categories: ["hero", "ally"], controller: "any" },
          chooser: { kind: "controller" },
          count: { kind: "scaled", value: { kind: "villainStageNumber" }, max: 3 },
          optional: true,
        },
        { kind: "giveStatus", target: { kind: "slot", slot: "brave" }, status: "tough" },
      ],
    }),
  );
  const MUSTER = stubEvent({ id: "muster", cost: 0, abilities: [muster.ref] });
  const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 3 });
  /** Stage I has 1 hit point, so one basic attack advances the villain and changes what "X" reads. */
  const TWO_STAGE = stubVillain({
    id: "two-stage",
    stages: [
      { hp: flat(1), atk: 0, sch: 0 },
      { hp: flat(40), atk: 0, sch: 0 },
    ],
  });

  /** Hero form, two allies out, Muster Courage in hand. */
  function board(): { deps: EngineDeps; state: GameState; muster: InstanceId } {
    const { deps, state } = setup({ cards: [MUSTER, BUDDY], abilities: [muster], villain: TWO_STAGE });
    const given = giveCards(state, p1, MUSTER.id, BUDDY.id, BUDDY.id);
    const [event, ally1, ally2] = given.ids as readonly InstanceId[];
    if (!event || !ally1 || !ally2) throw new Error("fixture");
    const out = settle(runWith(deps, given.state, toHero, play(ally1), play(ally2)), undefined, deps);
    return { deps, state: out, muster: event };
  }

  it("offers exactly the villain's stage number of targets, and none of them is mandatory", () => {
    const { deps, state, muster: event } = board();
    const prompted = settleUntil(runWith(deps, state, play(event)), "chooseTarget", deps);
    const choice = prompted.pendingChoice;
    if (!choice) throw new Error("no choice");
    // Three friendly characters are in play (hero + two allies), so the bound is the value, not the candidate count.
    expect(choice.options).toHaveLength(3);
    expect({ min: choice.minSelections, max: choice.maxSelections }).toEqual({ min: 0, max: 1 });
  });

  it("re-reads the value from the board: the same card offers 2 once the villain is on stage II", () => {
    const { deps, state, muster: event } = board();
    const villain = state.villains[0]?.instanceId as InstanceId;
    const hero = mustPlayer(state, p1).identity.instanceId;
    const advanced = settle(
      runWith(deps, state, { type: "basicAttack", playerId: p1, attackerInstanceId: hero, targetInstanceId: villain }),
      undefined,
      deps,
    );
    expect(advanced.villains[0]?.stageIndex).toBe(1);
    const prompted = settleUntil(runWith(deps, advanced, play(event)), "chooseTarget", deps);
    expect(prompted.pendingChoice?.maxSelections).toBe(2);
  });

  it("taking none of the offered targets is legal, and gives nothing", () => {
    const { deps, state, muster: event } = board();
    const prompted = settleUntil(runWith(deps, state, play(event)), "chooseTarget", deps);
    const choice = prompted.pendingChoice;
    if (!choice) throw new Error("no choice");
    const after = settle(
      runWith(deps, prompted, {
        type: "resolveChoice",
        playerId: p1,
        choiceId: choice.choiceId,
        selectedOptionIds: [],
      }),
      undefined,
      deps,
    );
    const hero = mustPlayer(after, p1).identity.instanceId;
    expect(mustInstance(after, hero).statuses.tough).toBe(0);
  });
});

// ---- §18.3 one search pool across a player's out-of-play zones *and* the play area ------------------------------------

/**
 * "When Revealed: The Clint Barton player searches their hand, deck, discard pile, and play area for Mockingbird and
 * tucks her faceup beneath this card." (Marked for Death 04028, errata RRG 1.8 p. 66.)
 *
 * The skip claimed `CardSelector zone` could not reach the play area. It cannot — but `anyOf` (§10.1) unions a `zone`
 * selector with a `ref` selector over `each(query)`, which *is* the play area, into one pool and one choice; and
 * `tuckCards` already takes a card **out of play** properly (§3.10, RRG 1.8 "Leaves Play", p. 27).
 */
describe("§18.3 `anyOf(zone, ref(each(query)))`: one pool across hand/deck/discard and the play area", () => {
  const MOCKINGBIRD = stubAlly({ id: "mockingbird", cost: 0, atk: 2, thw: 2, hp: 3 });

  const search = stubAbility(
    "marked.when-revealed",
    def({
      trigger: { kind: "whenRevealed" },
      effects: [
        {
          kind: "chooseCards",
          slot: "found",
          chooser: { kind: "eventPlayer" },
          min: 1,
          max: 1,
          from: {
            kind: "anyOf",
            of: [
              {
                kind: "zone",
                zone: ["hand", "deck", "discard"],
                player: { kind: "eventPlayer" },
                filter: { name: MOCKINGBIRD.name },
              },
              {
                kind: "ref",
                ref: { kind: "each", query: { categories: ["ally"], controller: "any" } },
                filter: { name: MOCKINGBIRD.name },
              },
            ],
          },
        },
        {
          kind: "tuckCards",
          cards: { kind: "ref", ref: { kind: "slot", slot: "found" } },
          under: { kind: "self" },
          facedown: false,
        },
      ],
    }),
  );
  const MARKED = stubSideScheme({ id: "marked", startingThreat: 5, boostIcons: 0, abilities: [search.ref] });

  const table = () =>
    setup({
      cards: [MARKED, MOCKINGBIRD],
      abilities: [search],
      encounter: copies(MARKED.id, 20),
      deck: [...copies(RESOURCE.id, 20), MOCKINGBIRD.id],
    });

  const markedInPlay = (state: GameState): InstanceId => {
    const found = Object.values(state.instances).find(
      (i) => i.cardId === MARKED.id && state.villainArea.includes(i.instanceId),
    );
    if (!found) throw new Error("Marked for Death is not in play");
    return found.instanceId;
  };
  const tuckedUnderMarked = (state: GameState): readonly InstanceId[] =>
    mustInstance(state, markedInPlay(state)).tucked;

  it("finds the card in the player's deck and tucks it faceup", () => {
    const { deps, state } = table();
    // The villain phase deals the side scheme; its When Revealed searches, and the only copy is in the deck.
    const after = settle(runWith(deps, state, toHero, endTurn), undefined, deps);
    const tucked = tuckedUnderMarked(after);
    expect(tucked).toHaveLength(1);
    expect(mustInstance(after, tucked[0] as InstanceId).cardId).toBe(MOCKINGBIRD.id);
    expect(mustInstance(after, tucked[0] as InstanceId).faceup).toBe(true);
  });

  it("finds the same card when it is already in play, and takes it out of play", () => {
    const { deps, state } = table();
    const given = giveCards(state, p1, MOCKINGBIRD.id);
    const ally = given.ids[0] as InstanceId;
    const out = settle(runWith(deps, given.state, toHero, play(ally)), undefined, deps);
    expect(mustPlayer(out, p1).playArea).toContain(ally);
    const after = settle(runWith(deps, out, endTurn), undefined, deps);
    expect(mustPlayer(after, p1).playArea).not.toContain(ally);
    // A card that leaves play is a new instance of the same card, so match on the card id, not the instance.
    const tucked = tuckedUnderMarked(after);
    expect(tucked).toHaveLength(1);
    expect(mustInstance(after, tucked[0] as InstanceId).cardId).toBe(MOCKINGBIRD.id);
  });
});

// ---- §19 a resource-type-filtered discard *cost* ---------------------------------------------------------------------

/**
 * "Alter-Ego Action: Discard a [physical] resource from your hand → discard this obligation." (Weakened 11018;
 * Stolen Memories 11019 reads `[mental]`, Time-Travel Hijinks 11021 `[energy]`.)
 *
 * `AbilityCost.discardFromHand` gains `filter` (docs/phase7-wave2.md §19), the cost-side twin of the effect's own
 * `discardFromHand.filter`. RRG 1.8 "Cost" (p. 13): a cost is paid in full — so a hand with no matching card cannot
 * pay it, and `legalActions` does not offer the ability (RRG 1.8 "Initiating Abilities", p. 24, steps 3 and 5).
 */
describe("§19 `AbilityCost.discardFromHand.filter`", () => {
  const PHYSICAL = stubResource({ id: "phys19", icons: 0, produces: { physical: 1 } });
  const MENTAL = stubResource({ id: "mental19", icons: 0, produces: { mental: 1 } });
  /** A printed wild icon is only ever "wild" (RRG 1.8 "Wild Resource", p. 48), so it never pays a [physical] cost. */
  const WILD = stubResource({ id: "wild19", icons: 1 });

  const purge = stubAbility(
    "purge.action",
    def({
      trigger: { kind: "action", form: "hero" },
      cost: { discardFromHand: { min: 1, max: 1, bind: "paid", filter: { printedResource: "physical" } } },
      effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "var", name: "paid" } }],
    }),
  );
  const PURGE = stubSupport({ id: "purge", cost: 0, abilities: [purge.ref] });

  /** Hero form, Purge in play, and exactly the named resource cards in hand. */
  function board(hand: readonly CardId[]): { deps: EngineDeps; state: GameState; purge: InstanceId } {
    const { deps, state } = setup({
      cards: [PURGE, PHYSICAL, MENTAL, WILD],
      abilities: [purge],
      deck: [...copies(PURGE.id, 2), ...copies(PHYSICAL.id, 6), ...copies(MENTAL.id, 6), ...copies(WILD.id, 6)],
    });
    const given = giveCards(state, p1, PURGE.id, ...hand);
    const support = given.ids[0] as InstanceId;
    let out = settle(runWith(deps, given.state, toHero, play(support)), undefined, deps);
    // Drop everything else, so the hand holds exactly the cards this test named.
    const keep = new Set(given.ids.slice(1));
    out = {
      ...out,
      players: out.players.map((p) => (p.playerId === p1 ? { ...p, hand: p.hand.filter((id) => keep.has(id)) } : p)),
    };
    return { deps, state: out, purge: support };
  }

  const use = (id: InstanceId, discard: readonly InstanceId[]): Command => ({
    type: "useAbility",
    playerId: p1,
    cardInstanceId: id,
    abilityId: purge.ref.id,
    payment: [],
    costChoices: { discard },
  });
  const villainId = (state: GameState) => state.villains[0]?.instanceId as InstanceId;

  it("accepts a hand card carrying the named printed icon", () => {
    const { deps, state, purge: support } = board([PHYSICAL.id, MENTAL.id]);
    const physical = mustPlayer(state, p1).hand.find((id) => state.instances[id]?.cardId === PHYSICAL.id) as InstanceId;
    const after = settle(runWith(deps, state, use(support, [physical])), undefined, deps);
    expect(mustInstance(after, villainId(after)).damage).toBe(1);
    expect(mustPlayer(after, p1).discard).toContain(physical);
  });

  it("refuses a hand card that does not, without paying anything", () => {
    const { deps, state, purge: support } = board([PHYSICAL.id, MENTAL.id]);
    const mental = mustPlayer(state, p1).hand.find((id) => state.instances[id]?.cardId === MENTAL.id) as InstanceId;
    const result = applyCommand(state, use(support, [mental]), deps);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a rejection");
    expect(result.error.code).toBe("no_valid_target");
    // Nothing moved: the whole cost is refused before any of it is paid.
    expect(mustPlayer(state, p1).discard).not.toContain(mental);
  });

  it("refuses a printed wild icon for a typed cost (RRG 1.8 'Wild Resource', p. 48)", () => {
    const { deps, state, purge: support } = board([WILD.id]);
    const wild = mustPlayer(state, p1).hand.find((id) => state.instances[id]?.cardId === WILD.id) as InstanceId;
    const result = applyCommand(state, use(support, [wild]), deps);
    if (result.ok) throw new Error("expected a rejection");
    expect(result.error.code).toBe("no_valid_target");
  });

  it("is offered by `legalActions` only while a matching card is in hand", () => {
    const offered = (hand: readonly CardId[]): boolean => {
      const { deps, state, purge: support } = board(hand);
      const actions = legalActions(state, p1, deps);
      if (actions.kind !== "turn") throw new Error("not a turn");
      return actions.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === support);
    };
    expect(offered([PHYSICAL.id, MENTAL.id])).toBe(true);
    expect(offered([MENTAL.id, MENTAL.id])).toBe(false);
    expect(offered([])).toBe(false);
  });

  it("fills the cost pick in for the client, choosing a matching card", () => {
    const { deps, state, purge: support } = board([MENTAL.id, PHYSICAL.id]);
    const actions = legalActions(state, p1, deps);
    if (actions.kind !== "turn") throw new Error("not a turn");
    const offered = actions.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === support);
    if (!offered || offered.example.type !== "useAbility") throw new Error("not offered");
    const [picked] = offered.example.costChoices?.discard ?? [];
    expect(picked && state.instances[picked]?.cardId).toBe(PHYSICAL.id);
  });
});

// ---- §20.1 "shares a trait with" -------------------------------------------------------------------------------------

/**
 * "Action: Play a card from your hand that shares a trait with your hero, reducing its resource cost by 1."
 * (Team-Building Exercise 12024.)
 *
 * `TargetQuery.sharesTraitWith: TargetRef` (docs/phase7-wave2.md §20.1). `trait`/`anyTrait` name traits the script
 * fixes; this one is whatever traits another card happens to have right now, which a generic basic-aspect card
 * played by any hero cannot hardcode.
 */
describe("§20.1 `TargetQuery.sharesTraitWith`", () => {
  const AVENGER = trait("AVENGER");
  const XMEN = trait("X-MEN");
  const SPY = trait("SPY");

  const AVENGER_HERO = stubIdentity({
    id: "avenger-hero",
    hp: 10,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroTraits: [AVENGER, SPY],
  });
  const SHARED = stubAlly({ id: "shared", cost: 2, atk: 1, thw: 1, hp: 2, traits: [AVENGER] });
  const ALSO_SHARED = stubAlly({ id: "also-shared", cost: 2, atk: 1, thw: 1, hp: 2, traits: [XMEN, SPY] });
  const UNSHARED = stubAlly({ id: "unshared", cost: 2, atk: 1, thw: 1, hp: 2, traits: [XMEN] });
  const TRAITLESS = stubAlly({ id: "traitless", cost: 2, atk: 1, thw: 1, hp: 2 });

  const exercise = stubAbility(
    "exercise.action",
    def({
      trigger: { kind: "action" },
      effects: [
        {
          kind: "playFromHand",
          player: { kind: "controller" },
          costReduction: { kind: "const", value: 1 },
          filter: { sharesTraitWith: { kind: "identityOf", player: { kind: "controller" } } },
        },
      ],
    }),
  );
  const EXERCISE = stubEvent({ id: "exercise", cost: 0, abilities: [exercise.ref] });

  /** Every hand card the "play a card that shares a trait with your hero" step would offer. */
  function offered(): readonly CardId[] {
    const deps = depsOf(exercise);
    const state = newGame({
      deps,
      identity: AVENGER_HERO,
      mainScheme: SCHEME,
      extraCards: [BLANK, EXERCISE, SHARED, ALSO_SHARED, UNSHARED, TRAITLESS],
      encounterDeck: copies(BLANK.id, 20),
      deck: [
        ...copies(EXERCISE.id, 2),
        ...copies(SHARED.id, 2),
        ...copies(ALSO_SHARED.id, 2),
        ...copies(UNSHARED.id, 2),
        ...copies(TRAITLESS.id, 2),
        ...copies(RESOURCE.id, 12),
      ],
    });
    const given = giveCards(
      state,
      p1,
      EXERCISE.id,
      SHARED.id,
      ALSO_SHARED.id,
      UNSHARED.id,
      TRAITLESS.id,
      RESOURCE.id,
      RESOURCE.id,
    );
    const event = given.ids[0] as InstanceId;
    const prompted = settleUntil(runWith(deps, given.state, toHero, play(event)), "chooseCards", deps);
    const choice = prompted.pendingChoice;
    if (!choice) throw new Error("no choice");
    return choice.options.map((o) => prompted.instances[o.optionId as InstanceId]?.cardId as CardId);
  }

  it("offers only the hand cards sharing at least one trait with the named card", () => {
    const cards = new Set(offered());
    expect(cards.has(SHARED.id)).toBe(true);
    // One shared trait out of two is enough.
    expect(cards.has(ALSO_SHARED.id)).toBe(true);
    expect(cards.has(UNSHARED.id)).toBe(false);
    expect(cards.has(TRAITLESS.id)).toBe(false);
    // A resource card has no traits either, so it can never share one.
    expect(cards.has(RESOURCE.id)).toBe(false);
  });
});

// ---- §20.2 "a card from the <X> encounter set" ------------------------------------------------------------------------

/**
 * "When Revealed: Discard cards from the encounter deck until a card from the Ant-Man Nemesis set is discarded this
 * way. Reveal that card." (Yellowjacket's Plan 12029.)
 *
 * `TargetQuery.encounterSetOf: TargetRef` (docs/phase7-wave2.md §20.2): the candidate belongs to an encounter set the
 * named card belongs to. Every printed "a card from the <X> set" in cycle 1 sits on a card that is itself in that
 * set, so the ref is `self`.
 */
describe("§20.2 `TargetQuery.encounterSetOf`", () => {
  const NEMESIS = "ant-nemesis";
  const OTHER = "some-other-set";
  /** In the named set, and the only card in the deck that is. */
  const MINE = stubTreachery({ id: "mine", boostIcons: 0, encounterSetIds: [NEMESIS] });
  /** In a different set. */
  const THEIRS = stubTreachery({ id: "theirs", boostIcons: 0, encounterSetIds: [OTHER] });
  /** In no set at all (an obligation, a basic-encounter card). */
  const UNSET = stubTreachery({ id: "unset", boostIcons: 0 });

  const search = stubAbility(
    "plan.action",
    def({
      trigger: { kind: "action", form: "hero" },
      effects: [{ kind: "discardEncounterUntil", filter: { encounterSetOf: { kind: "self" } }, bind: "found" }],
    }),
  );
  /** The searching card: a side scheme, so it stays in play and its Hero Action can be triggered on demand. */
  const PLAN = stubSideScheme({
    id: "plan",
    startingThreat: 9,
    boostIcons: 0,
    encounterSetIds: [NEMESIS],
    abilities: [search.ref],
  });

  const deps = depsOf(search);
  const ENCOUNTER: readonly CardId[] = [...copies(PLAN.id, 17), THEIRS.id, UNSET.id, MINE.id];

  /** The encounter deck ordered exactly as listed, by instance, whatever the setup shuffle did. */
  function arrange(state: GameState, order: readonly CardId[]): GameState {
    const deck = activeEncounterDeck(state).deck;
    const taken = new Set<InstanceId>();
    const ordered = order.map((card) => {
      const id = deck.find((candidate) => state.instances[candidate]?.cardId === card && !taken.has(candidate));
      if (!id) throw new Error(`fixture: no spare ${card} in the encounter deck`);
      taken.add(id);
      return id;
    });
    return withEncounterPiles(state, { deck: [...ordered, ...deck.filter((id) => !taken.has(id))] });
  }

  /** A game whose villain phase has revealed the searching side scheme into play. */
  function inPlay(): { state: GameState; plan: InstanceId } {
    const fresh = newGame({
      deps,
      mainScheme: SCHEME,
      extraCards: [BLANK, PLAN, MINE, THEIRS, UNSET],
      encounterDeck: ENCOUNTER,
    });
    // Every card the villain phase touches (boost cards, then the dealt card) is a copy of the side scheme, so the
    // reveal is deterministic without depending on the setup shuffle.
    const stacked = arrange(fresh, copies(PLAN.id, 17));
    const after = settle(runWith(deps, stacked, toHero, endTurn), undefined, deps);
    const plan = after.villainArea.find((id) => after.instances[id]?.cardId === PLAN.id);
    if (!plan) throw new Error("the side scheme did not enter play");
    return { state: after, plan };
  }

  it("matches a card in the named set wherever it is, and nothing else", () => {
    const { state, plan } = inPlay();
    const context = { selfInstanceId: plan, controllerId: p1, event: null, bindings: {}, deps };
    const query = { encounterSetOf: { kind: "self" as const } };
    const instanceOf = (card: CardId): InstanceId => {
      const found = Object.values(state.instances).find((i) => i.cardId === card);
      if (!found) throw new Error(`no ${card}`);
      return found.instanceId;
    };
    // Still in the encounter deck, so this is the zone-independence the printed text needs.
    expect(matchesQuery(state, instanceOf(MINE.id), query, context)).toBe(true);
    expect(matchesQuery(state, instanceOf(THEIRS.id), query, context)).toBe(false);
    expect(matchesQuery(state, instanceOf(UNSET.id), query, context)).toBe(false);
    // The searching card is in its own set, so it matches itself; and a player card never does.
    expect(matchesQuery(state, plan, query, context)).toBe(true);
    expect(matchesQuery(state, mustPlayer(state, p1).hand[0] as InstanceId, query, context)).toBe(false);
  });

  it("`discardEncounterUntil` stops on it, discarding the off-set cards before it", () => {
    const { state, plan } = inPlay();
    const ordered = arrange(state, [THEIRS.id, UNSET.id, MINE.id]);
    const before = activeEncounterDeck(ordered).discard.length;
    const after = settle(
      runWith(deps, ordered, {
        type: "useAbility",
        playerId: p1,
        cardInstanceId: plan,
        abilityId: search.ref.id,
        payment: [],
      }),
      undefined,
      deps,
    );
    const discarded = activeEncounterDeck(after).discard.slice(0, activeEncounterDeck(after).discard.length - before);
    const cards = discarded.map((id) => after.instances[id]?.cardId);
    expect(cards).toContain(MINE.id);
    expect(cards).toContain(THEIRS.id);
    expect(cards).toContain(UNSET.id);
    // It stopped there: exactly the three cards, not the rest of the deck.
    expect(discarded).toHaveLength(3);
  });
});

// ---- §21 "after you ready X" ------------------------------------------------------------------------------------------

/**
 * "Hero Response: After you ready Quicksilver, ready this card." (Friction Resistance 14009.)
 *
 * `TriggerEvent cardReadied` (docs/phase7-wave2.md §21), the "-ed" twin of `cardReadying`, announced from
 * `readyAndAnnounce` once the card has actually gone from exhausted to ready.
 */
describe("§21 the `cardReadied` announcement", () => {
  const resistance = stubAbility(
    "resistance.response",
    def({
      trigger: {
        kind: "response",
        forced: true,
        form: "hero",
        on: { on: "cardReadied", targetIs: { categories: ["identity"], controller: "you" } },
      },
      effects: [
        { kind: "ready", target: { kind: "self" } },
        // Not printed on the card: a tally, so "the response fired" stays observable even when something else would
        // have readied the upgrade anyway (the end-of-phase step).
        { kind: "addCounters", target: { kind: "self" }, counterType: "fired", amount: { kind: "const", value: 1 } },
      ],
    }),
  );
  const RESISTANCE = stubUpgrade({ id: "resistance", cost: 0, abilities: [resistance.ref] });

  const surge = stubAbility(
    "surge.action",
    def({
      trigger: { kind: "action", form: "hero" },
      effects: [{ kind: "ready", target: { kind: "identityOf", player: { kind: "controller" } } }],
    }),
  );
  const SURGE = stubEvent({ id: "surge", cost: 0, abilities: [surge.ref] });

  /** "… cannot ready" on the hero (All Tied Up), as a constant rule on a support in play. */
  const tied = stubAbility(
    "tied.constant",
    def({
      trigger: {
        kind: "constant",
        rules: [{ kind: "cannotReady", target: { categories: ["identity"], controller: "any" } }],
      },
      effects: [],
    }),
  );
  const TIED = stubSupport({ id: "tied", cost: 0, abilities: [tied.ref] });

  /** Hero form, Friction Resistance out and exhausted, the hero exhausted, plus whatever else is asked for. */
  function board(extra: readonly AnyCard[] = [], extraAbilities: readonly StubAbility[] = []) {
    const { deps, state } = setup({
      cards: [RESISTANCE, SURGE, ...extra],
      abilities: [resistance, surge, ...extraAbilities],
    });
    const given = giveCards(state, p1, RESISTANCE.id, SURGE.id, ...extra.map((c) => c.id));
    const [upgrade, event, ...rest] = given.ids as readonly InstanceId[];
    if (!upgrade || !event) throw new Error("fixture");
    let out = settle(runWith(deps, given.state, toHero, play(upgrade), ...rest.map((id) => play(id))), undefined, deps);
    const hero = mustPlayer(out, p1).identity.instanceId;
    // Exhaust both by hand: what the printed card does with them is not what is under test.
    out = {
      ...out,
      instances: {
        ...out.instances,
        [upgrade]: { ...mustInstance(out, upgrade), exhausted: true },
        [hero]: { ...mustInstance(out, hero), exhausted: true },
      },
    };
    return { deps, state: out, upgrade, event, hero };
  }

  const firings = (state: GameState, upgrade: InstanceId): number => mustInstance(state, upgrade).counters.fired ?? 0;

  it("fires after a card actually readies", () => {
    const { deps, state, upgrade, event, hero } = board();
    const after = settle(runWith(deps, state, play(event)), undefined, deps);
    expect(mustInstance(after, hero).exhausted).toBe(false);
    expect(mustInstance(after, upgrade).exhausted).toBe(false);
    expect(firings(after, upgrade)).toBe(1);
  });

  it("does not fire when the ready was blocked (RRG 1.8 \"'Cannot'\", p. 11)", () => {
    const { deps, state, upgrade, event, hero } = board([TIED], [tied]);
    const after = settle(runWith(deps, state, play(event)), undefined, deps);
    // The hero stayed exhausted, so nothing readied and the response never triggered.
    expect(mustInstance(after, hero).exhausted).toBe(true);
    expect(firings(after, upgrade)).toBe(0);
  });

  it("does not fire for a card that was already ready", () => {
    const { deps, state, upgrade, event, hero } = board();
    const ready = {
      ...state,
      instances: { ...state.instances, [hero]: { ...mustInstance(state, hero), exhausted: false } },
    };
    const after = settle(runWith(deps, ready, play(event)), undefined, deps);
    expect(firings(after, upgrade)).toBe(0);
  });

  it("fires at the end-of-phase ready too, and only for the card the pattern names", () => {
    const { deps, state, upgrade, hero } = board();
    // The end-of-phase step readies every card (RRG 1.8 "End of the Player Phase"): the identity and the upgrade
    // both ready, but only the identity matches this response's `targetIs`, so the tally is 1, not 2.
    const after = settle(runWith(deps, state, endTurn), undefined, deps);
    expect(mustInstance(after, hero).exhausted).toBe(false);
    expect(firings(after, upgrade)).toBe(1);
  });
});

// ---- §22 a restriction with a clock on it ------------------------------------------------------------------------------

/**
 * "• Choose and discard 1 card from your hand. **You cannot change form until your next turn ends.** Discard this
 * obligation." (Care for Cassie 12025.) "• Exhaust your identity. **You cannot ready your identity until your next
 * turn ends.** Discard this obligation." (Need for Speed 14024.)
 *
 * `LastingEffectBody ruleGrant` + `LastingDuration endOfPlayerTurn` + `EffectSpec applyRuleUntil`
 * (docs/phase7-wave2.md §22). Both obligations discard themselves as they resolve, so the restriction has to outlive
 * its own card — RRG 1.8 "Lasting Effects" (p. 26): a lasting effect keeps working "whether or not the card that
 * created the lasting effect is in play".
 */
describe("§22 `applyRuleUntil`: a `RuleSpec` that outlives its card", () => {
  const noForm = stubAbility(
    "cassie.action",
    def({
      trigger: { kind: "action" },
      effects: [
        {
          kind: "applyRuleUntil",
          rule: { kind: "cannotChangeForm", player: { kind: "controller" } },
          until: "endOfNextTurn",
        },
      ],
    }),
  );
  const CASSIE = stubEvent({ id: "cassie", cost: 0, abilities: [noForm.ref] });

  const noReady = stubAbility(
    "speed.action",
    def({
      trigger: { kind: "action" },
      effects: [
        { kind: "exhaust", target: { kind: "identityOf", player: { kind: "controller" } } },
        {
          kind: "applyRuleUntil",
          rule: { kind: "cannotReady", target: { categories: ["identity"], controller: "you" } },
          until: "endOfNextTurn",
        },
      ],
    }),
  );
  const SPEED = stubEvent({ id: "speed", cost: 0, abilities: [noReady.ref] });

  /**
   * The same restriction created with **no turn in progress**, which is where the printed obligations resolve (a
   * villain-phase encounter-card reveal). Delayed to the end of the round so the moment is deterministic and the
   * encounter deck stays out of it.
   */
  const delayed = stubAbility(
    "delayed.action",
    def({
      trigger: { kind: "action" },
      effects: [
        {
          kind: "atEndOfRound",
          effects: [
            {
              kind: "applyRuleUntil",
              rule: { kind: "cannotChangeForm", player: { kind: "controller" } },
              until: "endOfNextTurn",
            },
          ],
        },
      ],
    }),
  );
  const DELAYED = stubEvent({ id: "delayed", cost: 0, abilities: [delayed.ref] });

  const canChangeForm = (state: GameState, deps: EngineDeps): boolean => applyCommand(state, toHero, deps).ok;

  it("keeps working after the card that made it has gone, and through the player's *next* turn", () => {
    const { deps, state } = setup({ cards: [CASSIE], abilities: [noForm] });
    const given = giveCards(state, p1, CASSIE.id);
    const played = settle(runWith(deps, given.state, play(given.ids[0] as InstanceId)), undefined, deps);
    // The event is in the discard pile and the restriction is in force.
    expect(mustPlayer(played, p1).discard).toContain(given.ids[0]);
    expect(canChangeForm(played, deps)).toBe(false);

    // Made during this player's own turn, so ending *this* turn is not "your next turn ends".
    const nextTurn = settle(runWith(deps, played, endTurn), undefined, deps);
    expect(nextTurn.round).toBe(2);
    expect(canChangeForm(nextTurn, deps)).toBe(false);

    // The end of that next turn is the timing point (RRG 1.8 "Lasting Effects", p. 26).
    const after = settle(runWith(deps, nextTurn, endTurn), undefined, deps);
    expect(after.round).toBe(3);
    expect(canChangeForm(after, deps)).toBe(true);
  });

  it("is created with no turn in progress, and then lifts at the end of the next turn", () => {
    const { deps, state } = setup({ cards: [DELAYED], abilities: [delayed] });
    const given = giveCards(state, p1, DELAYED.id);
    const armed = settle(runWith(deps, given.state, play(given.ids[0] as InstanceId)), undefined, deps);
    // Nothing yet: the restriction is still a delayed effect waiting for the end of the round.
    expect(canChangeForm(armed, deps)).toBe(true);

    // The round ends in the villain phase, where no player's turn is in progress. Unlike "until the end of this
    // turn" (§13.3), this duration *is* created there — its time period has not started yet.
    const round2 = settle(runWith(deps, armed, endTurn), undefined, deps);
    expect(round2.round).toBe(2);
    expect(canChangeForm(round2, deps)).toBe(false);

    const round3 = settle(runWith(deps, round2, endTurn), undefined, deps);
    expect(round3.round).toBe(3);
    expect(canChangeForm(round3, deps)).toBe(true);
  });

  it("stops the identity readying at the end of the phase, and stops doing so once it expires", () => {
    const { deps, state } = setup({ cards: [SPEED], abilities: [noReady] });
    const given = giveCards(state, p1, SPEED.id);
    const played = settle(runWith(deps, given.state, play(given.ids[0] as InstanceId)), undefined, deps);
    const hero = mustPlayer(played, p1).identity.instanceId;
    expect(mustInstance(played, hero).exhausted).toBe(true);

    // The end-of-phase ready step runs and is refused (RRG 1.8 "'Cannot'", p. 11).
    const round2 = settle(runWith(deps, played, endTurn), undefined, deps);
    expect(mustInstance(round2, hero).exhausted).toBe(true);

    // The restriction expires when that next turn ends, so the following ready step works.
    const round3 = settle(runWith(deps, round2, endTurn), undefined, deps);
    expect(mustInstance(round3, hero).exhausted).toBe(false);
  });

  it("freezes the rule's player ref, one effect per player, each on that player's own clock", () => {
    const everyone = stubAbility(
      "everyone.action",
      def({
        trigger: { kind: "action" },
        effects: [
          {
            kind: "applyRuleUntil",
            rule: { kind: "cannotChangeForm", player: { kind: "each" } },
            until: "endOfNextTurn",
          },
        ],
      }),
    );
    const EVERYONE = stubEvent({ id: "everyone", cost: 0, abilities: [everyone.ref] });
    const deps = depsOf(everyone);
    const twoPlayer = newGame({
      deps,
      players: 2,
      mainScheme: SCHEME,
      extraCards: [BLANK, EVERYONE],
      encounterDeck: copies(BLANK.id, 30),
      deck: [...copies(EVERYONE.id, 4), ...copies(RESOURCE.id, 16)],
    });
    const given = giveCards(twoPlayer, p1, EVERYONE.id);
    const played = settle(runWith(deps, given.state, play(given.ids[0] as InstanceId)), undefined, deps);
    const p2 = playerId("p2");

    // One lasting effect per player, each naming its player outright rather than re-asking a ref later.
    const grants = played.lastingEffects.filter((e) => e.kind === "ruleGrant");
    expect(grants).toHaveLength(2);
    expect(grants.map((e) => (e.duration.kind === "endOfPlayerTurn" ? e.duration.playerId : null)).sort()).toEqual([
      p1,
      p2,
    ]);
    expect(applyCommand(played, toHero, deps).ok).toBe(false);

    // p1's was made during p1's own turn, so it waits for p1's *next* turn; p2's turn is still to come this round,
    // so p2's own next turn is this one and theirs lifts at its end.
    const p2Turn = settle(runWith(deps, played, endTurn), undefined, deps);
    expect(applyCommand(p2Turn, { type: "changeForm", playerId: p2 }, deps).ok).toBe(false);

    // Round 2 (first player has passed, so p2 leads): p2 is free again, p1 is not.
    const round2 = settle(runWith(deps, p2Turn, { type: "endTurn", playerId: p2 }), undefined, deps);
    expect(round2.round).toBe(2);
    expect(applyCommand(round2, { type: "changeForm", playerId: p2 }, deps).ok).toBe(true);
    expect(round2.lastingEffects.filter((e) => e.kind === "ruleGrant")).toHaveLength(1);

    const p1Turn = settle(runWith(deps, round2, { type: "endTurn", playerId: p2 }), undefined, deps);
    expect(applyCommand(p1Turn, toHero, deps).ok).toBe(false);
    const afterP1 = settle(runWith(deps, p1Turn, endTurn), undefined, deps);
    expect(afterP1.lastingEffects.filter((e) => e.kind === "ruleGrant")).toEqual([]);
  });

  it("reads 'you' as the ability's controller, not whoever is acting when it is checked", () => {
    const deps = depsOf(noForm);
    const twoPlayer = newGame({
      deps,
      players: 2,
      mainScheme: SCHEME,
      extraCards: [BLANK, CASSIE],
      encounterDeck: copies(BLANK.id, 30),
      deck: [...copies(CASSIE.id, 4), ...copies(RESOURCE.id, 16)],
    });
    const given = giveCards(twoPlayer, p1, CASSIE.id);
    const played = settle(runWith(deps, given.state, play(given.ids[0] as InstanceId)), undefined, deps);
    const p2 = playerId("p2");
    const handOff = settle(runWith(deps, played, endTurn), undefined, deps);
    // It is p2's turn now, and p2 is not the player the restriction was made for.
    expect(applyCommand(handOff, { type: "changeForm", playerId: p2 }, deps).ok).toBe(true);
  });
});
