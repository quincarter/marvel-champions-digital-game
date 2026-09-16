/**
 * The wave 1 missing-primitives batch (docs/phase7-wave1-scripting.md §6): engine bugs the pack scripting agents
 * traced, and the small primitives their skipped cards need. Stub cards only; the real cards are scripted afterwards.
 *
 * Bugs: `defended` interrupts (Expert Defense, Desperate Defense), the `attack` effect's card damage bonus (Embiggen!),
 * a granted overkill on a player's attack (Hulk Smash), a discard-self cost's threat snapshot (Beat Cop), and a card's
 * own triggered ability reading what was paid to play it (Valkyrie).
 *
 * Primitives: `TargetQuery.anyTrait` (Morphogenetics), `ValueSpec` `sum` (Generation Why?), and
 * `AbilityCost.discardRandomFromHand` (Magic Crowbar, Ball and Chain, Bulldozer's Helmet).
 */
import { flat, trait, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeEncounterDeck, activeVillain, mustInstance, mustPlayer } from "./query.js";
import { matchesQuery, resolveValue, traitsOf, type EffectContext } from "./select.js";
import type { ValueSpec } from "./spec.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMainScheme, stubMinion, stubResource, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { ALLY, expectOk, giveCards, newGame, RESOURCE, resolvePending, runWith, settle, settleUntil } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const c = (value: number): ValueSpec => ({ kind: "const", value });
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const play = (id: InstanceId, payment: readonly Payment[] = []): Command => ({ type: "playCard", playerId: p1, cardInstanceId: id, payment, attachToInstanceId: null });
const use = (id: InstanceId, ability: StubAbility, payment: readonly Payment[] = []): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: id,
  abilityId: ability.ref.id,
  payment,
});
const yourIdentity = { kind: "identityOf", player: { kind: "controller" } } as const;

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({ id: "scheme", stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }] });
const villainWith = (atk = 2) => stubVillain({ id: "villain", stages: [{ hp: flat(30), atk, sch: 0 }] });

function setup(options: { cards?: readonly AnyCard[]; abilities?: readonly StubAbility[]; villainAtk?: number; encounter?: readonly CardId[] }): { deps: EngineDeps; state: GameState } {
  const cards = options.cards ?? [];
  const deps = depsOf(...(options.abilities ?? []));
  const state = newGame({
    villain: villainWith(options.villainAtk),
    mainScheme: SCHEME,
    extraCards: [BLANK, ...cards],
    deck: [...cards.filter((card) => card.type !== "minion" && card.type !== "treachery").flatMap((card) => copies(card.id)), ...copies(RESOURCE.id, 8), ...copies(ALLY.id)],
    encounterDeck: options.encounter ?? copies(BLANK.id, 20),
    deps,
  });
  return { deps, state };
}

const patchInstance = (state: GameState, id: InstanceId, patch: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...(state.instances[id] as CardInstance), ...patch } },
});
const identityOf = (state: GameState) => mustPlayer(state, p1).identity.instanceId;
const damageOn = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const villainDamage = (state: GameState) => damageOn(state, activeVillain(state).instanceId);
const run = (deps: EngineDeps, state: GameState, command: Command) => {
  const result = applyCommand(state, command, deps);
  return { state: expectOk(result), events: result.ok ? result.events : [] };
};
const answerPending = (state: GameState, selectedOptionIds: readonly string[]): Command => ({
  type: "resolveChoice",
  playerId: p1,
  choiceId: state.pendingChoice?.choiceId as never,
  selectedOptionIds,
});

describe("engine bugs from wave 1 scripting", () => {
  describe("`defended` opens an interrupt window (RRG 1.8 'Defend, Defense', p. 15; 'Interrupt', p. 25)", () => {
    // "Hero Interrupt (defense): When your hero defends against an attack, it gets +3 DEF for that attack." (Expert Defense)
    const expert = stubAbility("expert-defense", def({
      trigger: { kind: "interrupt", forced: false, on: { on: "defended", targetIs: { categories: ["hero"], controller: "you" } }, form: "hero" },
      label: ["defense"],
      effects: [{ kind: "modifyStatUntil", stat: "def", amount: c(3), target: yourIdentity, until: "endOfAttack" }],
    }));
    const EXPERT = stubEvent({ id: "expert", cost: 0, abilities: [expert.ref] });

    const atDefense = () => {
      const { deps, state } = setup({ cards: [EXPERT], abilities: [expert], villainAtk: 5 });
      const given = giveCards(state, p1, "expert");
      return { deps, eventId: given.ids[0] as InstanceId, state: settleUntil(runWith(deps, given.state, toHero, endTurn), "declareDefender", deps) };
    };

    it("offers 'when your hero defends' before the attack deals damage, and the DEF bonus reduces it", () => {
      const { deps, eventId, state } = atDefense();
      const hero = identityOf(state);
      const { state: offered, events } = run(deps, state, answerPending(state, [hero]));
      expect(events.some((e: GameEvent) => e.type === "triggerEvent" && e.event.kind === "defended" && e.phase === "initiated")).toBe(true);
      expect(offered.pendingChoice?.prompt).toMatchObject({ kind: "chooseTriggers", timing: "interrupt" });
      expect(offered.pendingChoice?.options.map((o) => o.optionId)).toContain(`${eventId}:expert-defense`);
      expect(damageOn(offered, hero)).toBe(0);

      const after = settle(resolvePending(offered, [`${eventId}:expert-defense`], deps), undefined, deps);
      // 5 ATK against a basic defense of 2 DEF + 3.
      expect(damageOn(after, hero)).toBe(0);
      expect(mustPlayer(after, p1).discard).toContain(eventId);
    });

    it("declining it leaves the basic defense alone", () => {
      const { deps, state } = atDefense();
      const hero = identityOf(state);
      const offered = resolvePending(state, [hero], deps);
      const after = settle(resolvePending(offered, [], deps), undefined, deps);
      expect(damageOn(after, hero)).toBe(3);
    });
  });

  it("the `attack` effect adds a card's damage bonus, like `dealDamage` (Embiggen!; FAQ 'Embiggen (#10)', p. 59)", () => {
    // "(attack): Deal 3 damage to the villain", and "When you play an event … increase the amount of damage that event deals by 2".
    const kick = stubAbility("kick", def({ trigger: { kind: "action" }, label: ["attack"], effects: [{ kind: "attack", target: { kind: "villain" }, amount: c(3) }] }));
    const embiggen = stubAbility("embiggen", def({
      trigger: { kind: "interrupt", forced: true, on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } } },
      effects: [{ kind: "modifyCardEffect", card: { kind: "eventTarget" }, damage: c(2) }],
    }));
    const KICK = stubEvent({ id: "kick", cost: 0, abilities: [kick.ref] });
    const EMBIGGEN = stubSupport({ id: "embiggen", cost: 0, abilities: [embiggen.ref] });
    const { deps, state } = setup({ cards: [KICK, EMBIGGEN], abilities: [kick, embiggen] });
    const given = giveCards(state, p1, "kick", "kick", "embiggen");
    const [first, second, supportId] = given.ids as [InstanceId, InstanceId, InstanceId];

    const plain = settle(runWith(deps, given.state, toHero, play(first)), undefined, deps);
    expect(villainDamage(plain)).toBe(3);
    const boosted = settle(runWith(deps, plain, play(supportId), play(second)), undefined, deps);
    expect(villainDamage(boosted)).toBe(3 + 5);
  });

  it("an interrupt's 'that attack gains overkill' reaches a player's basic attack (Hulk Smash; RRG 1.8 'Overkill', p. 31)", () => {
    const thug = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 2, boostIcons: 0 });
    // "When you make a basic attack, you get +3 ATK for that attack … that attack gains overkill."
    const smash = stubAbility("smash", def({
      trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller", attackKind: "basic" } },
      effects: [{ kind: "modifyStatUntil", stat: "atk", amount: c(3), target: yourIdentity, until: "endOfAttack" }, { kind: "modifyAttack", overkill: true }],
    }));
    const SMASH = stubSupport({ id: "smash", cost: 0, abilities: [smash.ref] });
    const { deps, state } = setup({ cards: [SMASH, thug], abilities: [smash], encounter: copies(thug.id, 20) });
    const roundTwo = settle(runWith(deps, state, endTurn), undefined, deps);
    const thugId = mustPlayer(roundTwo, p1).playArea.find((id) => mustInstance(roundTwo, id).cardId === thug.id);
    if (!thugId) throw new Error("no engaged thug");
    const given = giveCards(roundTwo, p1, "smash");
    const ready = runWith(deps, given.state, toHero, play(given.ids[0] as InstanceId));
    const villainBefore = villainDamage(ready);

    const after = settle(runWith(deps, ready, { type: "basicAttack", playerId: p1, attackerInstanceId: identityOf(ready), targetInstanceId: thugId }), undefined, deps);
    // 2 ATK + 3 into a 2-hit-point minion: the 3 beyond its hit points go to the villain.
    expect(activeEncounterDeck(after).discard).toContain(thugId);
    expect(villainDamage(after)).toBe(villainBefore + 3);
  });

  it("a discard-self cost snapshots the card's threat and damage: 'for each threat here' (Beat Cop)", () => {
    const cop = stubAbility("cop", def({
      trigger: { kind: "action" },
      cost: { discardSelf: true },
      effects: [
        { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "var", name: "self.threat" } },
        { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "var", name: "self.damage" } },
      ],
    }));
    const COP = stubSupport({ id: "cop", cost: 0, abilities: [cop.ref] });
    const { deps, state } = setup({ cards: [COP], abilities: [cop] });
    const given = giveCards(state, p1, "cop");
    const copId = given.ids[0] as InstanceId;
    const staged = patchInstance(runWith(deps, given.state, play(copId)), copId, { threat: 3, damage: 1 });

    const after = settle(runWith(deps, staged, use(copId, cop)), undefined, deps);
    expect(mustPlayer(after, p1).discard).toContain(copId);
    expect(mustInstance(after, copId).threat).toBe(0);
    expect(villainDamage(after)).toBe(4);
  });

  describe("a card's own triggered ability reads what was paid to play it (Valkyrie; RRG 1.8 'Cost', p. 13)", () => {
    // "Response: After this ally enters play, deal 2 damage to the villain (3 instead if you paid for this card using a [energy] resource)."
    const valk = stubAbility("valk-response", def({
      trigger: { kind: "response", forced: false, on: { on: "cardEntersPlay", selfIs: "target" } },
      effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "conditional", if: { kind: "paidWith", resource: "energy" }, then: c(3), else: c(2) } }],
    }));
    const VALK = stubAlly({ id: "valk", cost: 1, atk: 1, thw: 1, hp: 2, abilities: [valk.ref] });
    const ENERGY = stubResource({ id: "energy-res", icons: 0, produces: { energy: 1 } });
    const MENTAL = stubResource({ id: "mental-res", icons: 0, produces: { mental: 1 } });
    // "Put [an ally] from your hand into play", paid with an energy resource: that payment is for this event, not the ally.
    const summon = stubAbility("summon", def({
      trigger: { kind: "action" },
      effects: [
        { kind: "chooseCards", slot: "ally", from: { kind: "zone", zone: "hand", player: { kind: "controller" }, filter: { name: VALK.name } }, chooser: { kind: "controller" }, min: 1, max: 1 },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "ally" }, controller: { kind: "controller" } },
      ],
    }));
    const SUMMON = stubEvent({ id: "summon", cost: 1, abilities: [summon.ref] });
    const cards = [VALK, ENERGY, MENTAL, SUMMON];

    it.each([
      ["energy-res", 3],
      ["mental-res", 2],
    ] as const)("played paying with %s: %i damage", (resource, damage) => {
      const { deps, state } = setup({ cards, abilities: [valk, summon] });
      const given = giveCards(state, p1, "valk", resource);
      const [valkId, payId] = given.ids as [InstanceId, InstanceId];
      const offered = runWith(deps, given.state, play(valkId, [{ fromHand: payId }]));
      expect(offered.pendingChoice?.prompt.kind).toBe("chooseTriggers");
      const after = settle(resolvePending(offered, [`${valkId}:valk-response`], deps), undefined, deps);
      expect(villainDamage(after)).toBe(damage);
    });

    it("put into play by another card's effect, it was not paid for", () => {
      const { deps, state } = setup({ cards, abilities: [valk, summon] });
      const given = giveCards(state, p1, "valk", "summon", "energy-res");
      const [valkId, summonId, payId] = given.ids as [InstanceId, InstanceId, InstanceId];
      const offered = settleUntil(runWith(deps, given.state, play(summonId, [{ fromHand: payId }])), "chooseTriggers", deps);
      const after = settle(resolvePending(offered, [`${valkId}:valk-response`], deps), undefined, deps);
      expect(mustPlayer(after, p1).playArea).toContain(valkId);
      expect(villainDamage(after)).toBe(2);
    });
  });
});

describe("wave 1 primitives", () => {
  it("TargetQuery.anyTrait matches a card with at least one of the traits, printed or granted (Morphogenetics)", () => {
    const ATTACK = trait("Attack");
    const THWART = trait("Thwart");
    const AERIAL = trait("Aerial");
    const attackCard = stubSupport({ id: "attack-card", cost: 0, traits: [ATTACK] });
    const thwartCard = stubSupport({ id: "thwart-card", cost: 0, traits: [THWART] });
    const plainCard = stubSupport({ id: "plain-card", cost: 0 });
    // A grant whose target itself filters with `anyTrait` reads printed traits only, so reading traits can't recurse.
    const wings = stubAbility("wings", def({ trigger: { kind: "constant", traitGrants: [{ trait: AERIAL, target: { categories: ["support"], anyTrait: [ATTACK, THWART] } }] }, effects: [] }));
    const WINGS = stubSupport({ id: "wings", cost: 0, abilities: [wings.ref] });
    const { deps, state } = setup({ cards: [attackCard, thwartCard, plainCard, WINGS], abilities: [wings] });
    const given = giveCards(state, p1, "attack-card", "thwart-card", "plain-card", "wings");
    const [a, t, p, w] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const inPlay = runWith(deps, given.state, play(a), play(t), play(p), play(w));
    const context: EffectContext = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };

    expect([a, t, p].map((id) => matchesQuery(inPlay, id, { anyTrait: [ATTACK, THWART] }, context))).toEqual([true, true, false]);
    expect(matchesQuery(inPlay, a, { anyTrait: [] }, context)).toBe(false);
    expect(traitsOf(inPlay, t, deps)).toContain(AERIAL);
    expect([a, p].map((id) => matchesQuery(inPlay, id, { anyTrait: [AERIAL] }, context))).toEqual([true, false]);
  });

  it("ValueSpec sum adds its values, each read live (Generation Why?)", () => {
    const { deps, state } = setup({});
    const context: EffectContext = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };
    const villains: ValueSpec = { kind: "count", query: { categories: ["villain"] } };
    expect(resolveValue(state, { kind: "sum", values: [c(2), villains] }, context)).toBe(3);
    expect(resolveValue(state, { kind: "sum", values: [{ kind: "sum", values: [c(1), c(1)] }, c(4)] }, context)).toBe(6);
    expect(resolveValue(state, { kind: "sum", values: [] }, context)).toBe(0);
  });

  describe("AbilityCost.discardRandomFromHand (Magic Crowbar, Ball and Chain, Bulldozer's Helmet)", () => {
    // "Discard 1 card at random from your hand → discard this card."
    const crowbar = stubAbility("crowbar", def({ trigger: { kind: "action" }, cost: { discardRandomFromHand: 1 }, effects: [{ kind: "discardFromPlay", target: { kind: "self" } }] }));
    const CROWBAR = stubSupport({ id: "crowbar", cost: 0, abilities: [crowbar.ref] });
    const pricey = stubAbility("pricey", def({ trigger: { kind: "action" }, cost: { resources: 1, discardRandomFromHand: 1 }, effects: [] }));
    const PRICEY = stubSupport({ id: "pricey", cost: 0, abilities: [pricey.ref] });

    const inPlay = (card: "crowbar" | "pricey") => {
      const { deps, state } = setup({ cards: [CROWBAR, PRICEY], abilities: [crowbar, pricey] });
      const given = giveCards(state, p1, card);
      const id = given.ids[0] as InstanceId;
      return { deps, id, state: runWith(deps, given.state, play(id)) };
    };
    /** Test-only state surgery: `keep` becomes the hand, the rest goes to the bottom of the deck. */
    const withHand = (state: GameState, keep: readonly InstanceId[]): GameState => ({
      ...state,
      players: state.players.map((p) => (p.playerId === p1 ? { ...p, hand: keep, deck: [...p.deck, ...p.hand.filter((id) => !keep.includes(id))] } : p)),
    });
    const offered = (state: GameState, deps: EngineDeps, id: InstanceId): boolean => {
      const result = legalActions(state, p1, deps);
      return result.kind === "turn" && result.legal.some((entry) => entry.action.kind === "useAbility" && entry.action.instanceId === id);
    };
    const handDiscards = (events: readonly GameEvent[]) =>
      events.filter((e): e is Extract<GameEvent, { type: "cardDiscardedFromHand" }> => e.type === "cardDiscardedFromHand").map((e) => e.instanceId);

    it("discards one card from the hand with the game's seeded RNG, and a replay discards the same card", () => {
      const { deps, id, state } = inPlay("crowbar");
      const hand = mustPlayer(state, p1).hand;
      expect(hand.length).toBeGreaterThan(1);

      const { state: after, events } = run(deps, state, use(id, crowbar));
      const [discarded, ...more] = handDiscards(events);
      expect(more).toEqual([]);
      expect(hand).toContain(discarded);
      expect(mustPlayer(after, p1).hand).toEqual(hand.filter((card) => card !== discarded));
      expect(mustPlayer(after, p1).discard).toEqual(expect.arrayContaining([discarded, id]));
      expect(after.rng.draws).toBe(state.rng.draws + 1);

      let session: GameSession = startSession(state);
      const applied = sessionApply(session, use(id, crowbar), deps);
      if (!applied.ok) throw new Error(applied.error.message);
      session = applied.session;
      const replayed = replay(session.log, deps);
      expect(replayed.ok && replayed.state).toEqual(session.state);
      expect(session.state).toEqual(after);
    });

    it("a hand of one card is discarded whole (ruling, Feb 28, 2026 (4)); an empty hand can't pay", () => {
      const { deps, id, state } = inPlay("crowbar");
      const only = mustPlayer(state, p1).hand[0] as InstanceId;
      const one = withHand(state, [only]);
      expect(offered(one, deps, id)).toBe(true);
      const after = runWith(deps, one, use(id, crowbar));
      expect(mustPlayer(after, p1).hand).toEqual([]);
      expect(mustPlayer(after, p1).discard).toContain(only);

      const none = withHand(state, []);
      expect(offered(none, deps, id)).toBe(false);
      const rejected = applyCommand(none, use(id, crowbar), deps);
      expect(!rejected.ok && rejected.error.code).toBe("card_not_in_zone");
    });

    it("never picks a card the resource payment spends", () => {
      const { deps, id, state } = inPlay("pricey");
      const resource = mustPlayer(state, p1).hand.find((card) => mustInstance(state, card).cardId === RESOURCE.id);
      const other = mustPlayer(state, p1).hand.find((card) => card !== resource);
      if (!resource || !other) throw new Error("fixture hand needs a resource card and one other card");

      const after = runWith(deps, withHand(state, [resource, other]), use(id, pricey, [{ fromHand: resource }]));
      expect(mustPlayer(after, p1).hand).toEqual([]);
      expect(mustPlayer(after, p1).discard).toEqual(expect.arrayContaining([resource, other]));

      const onlyThePayment = withHand(state, [resource]);
      const rejected = applyCommand(onlyThePayment, use(id, pricey, [{ fromHand: resource }]), deps);
      expect(!rejected.ok && rejected.error.code).toBe("card_not_in_zone");
    });
  });
});
