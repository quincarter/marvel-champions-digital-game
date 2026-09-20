/**
 * docs/phase7-wave2.md §18: the wave 2 `KNOWN_SKIPPED` audit. Three of the fifteen non-campaign skips name a
 * primitive that already exists; this file is the evidence, driven through real commands rather than read off the
 * type. Synthetic cards throughout — engine code never names a card, and the card names in the test titles only say
 * which printed text each shape was checked against.
 *
 * Sources: RRG 1.8 "Cost" (p. 13, overpayment), "Choose (Game Element)" (p. 12), "Search" (p. 39), "Tuck" (p. 45),
 * "Leaves Play" (p. 27).
 */

import { flat, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand } from "./engine.js";
import { legalActions } from "./legal.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMainScheme, stubResource, stubSideScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, runWith, settle, settleUntil } from "./testing/scenario.js";

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
const SCHEME = stubMainScheme({ id: "scheme", stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }] });

interface Setup {
  readonly cards?: readonly AnyCard[];
  readonly abilities?: readonly StubAbility[];
  readonly villain?: ReturnType<typeof stubVillain>;
  readonly encounter?: readonly CardId[];
  readonly deck?: readonly CardId[];
}

function setup({ cards = [], abilities = [], villain, encounter, deck }: Setup): { deps: EngineDeps; state: GameState } {
  const deps = depsOf(...abilities);
  const playable = cards.filter((c) => c.type === "event" || c.type === "upgrade" || c.type === "ally" || c.type === "support" || c.type === "resource");
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
    stubAbility(id, def({
      trigger: { kind: "interrupt", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
      effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "pym", amount: { kind: "scaled", value: { kind: "var", name }, max } }],
    }));

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
    const after = settle(runWith(deps, given.state, play(ally, paid.map((id) => ({ fromHand: id })))), undefined, deps);
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
  const muster = stubAbility("muster.action", def({
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
  }));
  const MUSTER = stubEvent({ id: "muster", cost: 0, abilities: [muster.ref] });
  const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 3 });
  /** Stage I has 1 hit point, so one basic attack advances the villain and changes what "X" reads. */
  const TWO_STAGE = stubVillain({ id: "two-stage", stages: [{ hp: flat(1), atk: 0, sch: 0 }, { hp: flat(40), atk: 0, sch: 0 }] });

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
      runWith(deps, prompted, { type: "resolveChoice", playerId: p1, choiceId: choice.choiceId, selectedOptionIds: [] }),
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

  const search = stubAbility("marked.when-revealed", def({
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
            { kind: "zone", zone: ["hand", "deck", "discard"], player: { kind: "eventPlayer" }, filter: { name: MOCKINGBIRD.name } },
            { kind: "ref", ref: { kind: "each", query: { categories: ["ally"], controller: "any" } }, filter: { name: MOCKINGBIRD.name } },
          ],
        },
      },
      { kind: "tuckCards", cards: { kind: "ref", ref: { kind: "slot", slot: "found" } }, under: { kind: "self" }, facedown: false },
    ],
  }));
  const MARKED = stubSideScheme({ id: "marked", startingThreat: 5, boostIcons: 0, abilities: [search.ref] });

  const table = () =>
    setup({
      cards: [MARKED, MOCKINGBIRD],
      abilities: [search],
      encounter: copies(MARKED.id, 20),
      deck: [...copies(RESOURCE.id, 20), MOCKINGBIRD.id],
    });

  const markedInPlay = (state: GameState): InstanceId => {
    const found = Object.values(state.instances).find((i) => i.cardId === MARKED.id && state.villainArea.includes(i.instanceId));
    if (!found) throw new Error("Marked for Death is not in play");
    return found.instanceId;
  };
  const tuckedUnderMarked = (state: GameState): readonly InstanceId[] => mustInstance(state, markedInPlay(state)).tucked;

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

  const purge = stubAbility("purge.action", def({
    trigger: { kind: "action", form: "hero" },
    cost: { discardFromHand: { min: 1, max: 1, bind: "paid", filter: { printedResource: "physical" } } },
    effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "var", name: "paid" } }],
  }));
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
    out = { ...out, players: out.players.map((p) => (p.playerId === p1 ? { ...p, hand: p.hand.filter((id) => keep.has(id)) } : p)) };
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
