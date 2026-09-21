/**
 * Wave 1's last missing-primitive batch (docs/phase7-wave1-scripting.md §6): the engine/DSL vocabulary the 19 cards
 * still pinned in `packages/cards/src/wave1/coverage.test.ts` `KNOWN_SKIPPED` need before they can be scripted.
 *
 * Stub cards only — engine code never names a card. Each `describe` names the printed shape it enables.
 */
import { cardId, flat, trait, type AnyCard, type CardId, type UpgradeCard } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, activeVillain, characterProfile, mustInstance, mustPlayer } from "./query.js";
import { playCostOf } from "./actions.js";
import { legalActions } from "./legal.js";
import { excessDamageThreatSchemes } from "./rules.js";
import { cardsInPlay, evaluate, matchesQuery, type EffectContext } from "./select.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { createGame } from "./setup.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import {
  stubAlly,
  stubAttachment,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubResource,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { auditVillainPhases } from "./villain/audit.js";
import {
  ALLY,
  RESOURCE,
  DEFAULT_CARDS,
  DEFAULT_DECK,
  expectOk,
  giveCard,
  giveCards,
  HERO,
  newGame,
  payFor,
  resolvePending,
  seatIdentities,
  settle,
  settleUntil,
  withEncounterPiles,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const self: TargetRef = { kind: "self" };
const one: ValueSpec = { kind: "const", value: 1 };
const c = (value: number): ValueSpec => ({ kind: "const", value });
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const endTurn: Command = { type: "endTurn", playerId: p1 };
const toHero: Command = { type: "changeForm", playerId: p1 };

const run = (deps: EngineDeps, state: GameState, ...commands: readonly Command[]): GameState => {
  let current = settle(state, undefined, deps);
  for (const command of commands) current = settle(expectOk(applyCommand(current, command, deps)), undefined, deps);
  return current;
};

// ---------------------------------------------------------------------------
// 1. A scheme's current threat against a threshold (`Predicate` `compare`)
// ---------------------------------------------------------------------------

/**
 * The Wrecking Crew signature side schemes' shape: "Forced Response: After threat is placed here, if there is 10 or
 * more threat here, <punishment>. Remove all but 3 threat from this scheme."
 */
const THRESHOLD = stubAbility("threshold.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "placeThreat", selfIs: "target" } },
  effects: [
    {
      kind: "if",
      condition: { kind: "compare", left: { kind: "threat", of: self }, op: "atLeast", right: c(10) },
      then: [
        { kind: "addCounters", target: self, counterType: "punished", amount: one },
        // "Remove all but 3 threat from this scheme": already expressible, but it is the other half of the sentence,
        // so the test pins that the pair works together.
        {
          kind: "removeThreat",
          target: self,
          amount: { kind: "scaled", value: { kind: "threat", of: self }, plus: -3 },
        },
      ],
    },
  ],
});
const THRESHOLD_SCHEME = stubSideScheme({
  id: "threshold-scheme",
  startingThreat: 8,
  boostIcons: 0,
  abilities: [THRESHOLD.ref],
});

/** "When Wrecker schemes, place the threat on his side scheme instead of the main scheme." */
const OWN_SCHEME = stubAbility("boss.own-scheme", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "schemeThreatDestination", enemy: { self: true }, scheme: "ownSignatureSideScheme" }],
  },
  effects: [],
});

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** Breakout 1A's shape: setup puts each villain's signature side scheme into play. */
const PUT_SCHEMES = stubAbility("scenario.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "signature", cards: { kind: "encounterSetAside" } },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "signature" }, controller: { kind: "firstPlayer" } },
  ],
});
const SCENARIO = stubMainScheme({
  id: "scenario",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [PUT_SCHEMES.ref] },
  ],
});

interface GameOptions {
  readonly sch?: number;
  readonly signature?: AnyCard & { readonly id: CardId };
  readonly abilities?: readonly StubAbility[];
}

/** A one-villain game whose villain schemes onto its own signature side scheme, parked on p1's first turn. */
function schemeGame(options: GameOptions = {}): { deps: EngineDeps; state: GameState } {
  const signature = options.signature ?? THRESHOLD_SCHEME;
  const boss = stubVillain({
    id: "boss",
    stages: [{ hp: flat(40), atk: 0, sch: options.sch ?? 2, abilities: [OWN_SCHEME.ref] }],
  });
  const deps = depsOf(THRESHOLD, OWN_SCHEME, PUT_SCHEMES, ...(options.abilities ?? []));
  const result = createGame(
    {
      seed: 5,
      cards: [...DEFAULT_CARDS, boss, SCENARIO, signature, BLANK],
      villainCardId: boss.id,
      villains: [
        { villainCardId: boss.id, encounterDeck: copies(BLANK.id, 20), signatureSideSchemeCardId: signature.id },
      ],
      mainSchemeCardId: SCENARIO.id,
      encounterDeck: [],
      players: [{ identityCardId: cardId("hero"), deck: DEFAULT_DECK }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return { deps, state: settle(result.state, undefined, deps) };
}

const signatureId = (state: GameState) => activeVillain(state).signatureSideSchemeId as InstanceId;

describe("`compare`: a live value against a threshold", () => {
  it("reads a scheme's current threat, and is re-read every time the predicate is asked", () => {
    const { deps, state } = schemeGame();
    const context: EffectContext = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };
    const scheme = signatureId(state);
    const threat = (of: TargetRef): ValueSpec => ({ kind: "threat", of });
    const ref: TargetRef = { kind: "named", name: THRESHOLD_SCHEME.name };
    const at = (op: "atLeast" | "atMost" | "equalTo", n: number): Predicate => ({
      kind: "compare",
      left: threat(ref),
      op,
      right: c(n),
    });

    expect(mustInstance(state, scheme).threat).toBe(8);
    expect([evaluate(state, at("atLeast", 8), context), evaluate(state, at("atLeast", 9), context)]).toEqual([
      true,
      false,
    ]);
    expect([evaluate(state, at("atMost", 8), context), evaluate(state, at("atMost", 7), context)]).toEqual([
      true,
      false,
    ]);
    expect([evaluate(state, at("equalTo", 8), context), evaluate(state, at("equalTo", 7), context)]).toEqual([
      true,
      false,
    ]);
  });

  it("compares two live values, not just a literal threshold", () => {
    const { deps, state } = schemeGame();
    const context: EffectContext = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };
    const scheme: TargetRef = { kind: "named", name: THRESHOLD_SCHEME.name };
    const threat: ValueSpec = { kind: "threat", of: scheme };
    const villains: ValueSpec = { kind: "count", query: { categories: ["villain"] } };
    // 8 threat vs. 1 villain in play.
    expect(evaluate(state, { kind: "compare", left: threat, op: "atLeast", right: villains }, context)).toBe(true);
    expect(evaluate(state, { kind: "compare", left: villains, op: "atLeast", right: threat }, context)).toBe(false);
  });

  it("gates a 'Forced Response: after threat is placed here, if there is 10 or more threat here' on the threshold", () => {
    // Villain SCH 2 onto an 8-threat scheme: the first villain phase reaches exactly 10 and the response fires;
    // "remove all but 3" leaves 3 behind.
    const { deps, state } = schemeGame();
    const after = run(deps, state, endTurn);
    const scheme = signatureId(after);
    expect(mustInstance(after, scheme).counters.punished).toBe(1);
    expect(mustInstance(after, scheme).threat).toBe(3);
  });

  it("does not fire below the threshold, though the same threat placement still triggers the response", () => {
    const { deps, state } = schemeGame({ sch: 1 });
    const after = run(deps, state, endTurn);
    const scheme = signatureId(after);
    expect(mustInstance(after, scheme).threat).toBe(9);
    expect(mustInstance(after, scheme).counters.punished).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Boost icons summed over `discardEncounterCards`
// ---------------------------------------------------------------------------

/**
 * Power Drain / Lightning Bolt / Shock Therapy's shape: "Discard N cards from the encounter deck. <do something> for
 * each boost icon discarded this way." `moveCards` has had a summed `<bind>.boostIcons` since Hit Squad, but these
 * cards must keep `discardEncounterCards`' reshuffle safety (RRG 1.8 "Encounter Deck", p. 17: stop rather than
 * continue into the newly shuffled deck), which a `moveCards` over an `encounterCards` selector does not have.
 */
const TWO_ICONS = stubTreachery({ id: "two-icons", boostIcons: 2 });
const THREE_ICONS = stubTreachery({ id: "three-icons", boostIcons: 3 });
const NO_ICONS = stubTreachery({ id: "no-icons", boostIcons: 0 });

const iconEvent = (id: string, count: number) => {
  const effects: readonly EffectSpec[] = [
    { kind: "discardEncounterCards", count: c(count), bind: "dumped" },
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "controller" } },
      counterType: "icons",
      amount: { kind: "var", name: "dumped.boostIcons" },
    },
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "controller" } },
      counterType: "dumped",
      amount: { kind: "var", name: "dumped.count" },
    },
  ];
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const DISCARD_TWO = iconEvent("discard-two", 2);
const DISCARD_THREE = iconEvent("discard-three", 3);

const ICON_CARDS = [TWO_ICONS, THREE_ICONS, NO_ICONS, DISCARD_TWO.card, DISCARD_THREE.card];
const iconDeps = depsOf(DISCARD_TWO.ability, DISCARD_THREE.ability);

/** A quiet one-villain game whose encounter deck is exactly `encounter`, parked on p1's first turn. */
function iconGame(encounter: readonly CardId[]): GameState {
  const boss = stubVillain({ id: "quiet-boss", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 7,
      cards: [...DEFAULT_CARDS, boss, SCENARIO, BLANK, ...ICON_CARDS, ...identities],
      villainCardId: boss.id,
      mainSchemeCardId: SCENARIO.id,
      encounterDeck: encounter,
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, DISCARD_TWO.card.id, DISCARD_THREE.card.id],
      })),
    },
    iconDeps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, iconDeps).state;
}

const playCard = (state: GameState, card: { readonly id: CardId }): GameState => {
  const given = giveCard(state, p1, card.id);
  return runCommands(given.state, iconDeps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  }).state;
};
const counter = (state: GameState, name: string) =>
  mustInstance(state, mustPlayer(state, p1).identity.instanceId).counters[name];

describe("`discardEncounterCards` binds the boost icons it discarded", () => {
  it("sums the icons across every card discarded, not just the first", () => {
    // The deck is seeded so the top two cards are 2 and 3 icons.
    const start = iconGame([TWO_ICONS.id, THREE_ICONS.id, ...copies(NO_ICONS.id, 14)]);
    const deck = activeEncounterDeck(start).deck;
    const stacked = withEncounterPiles(start, { deck: [...deck].sort((a, b) => order(start, a) - order(start, b)) });
    const state = playCard(stacked, DISCARD_TWO.card);
    expect(counter(state, "dumped")).toBe(2);
    expect(counter(state, "icons")).toBe(5);
  });

  it("counts 0 for cards with no boost icons, and 0 when nothing was discarded", () => {
    const start = iconGame(copies(NO_ICONS.id, 16));
    const state = playCard(start, DISCARD_TWO.card);
    expect(counter(state, "dumped")).toBe(2);
    expect(counter(state, "icons")).toBeUndefined(); // 0 counters added
  });

  it("keeps the reshuffle rule: a discard cut short by the empty deck sums only the cards it reached", () => {
    const start = iconGame([TWO_ICONS.id, THREE_ICONS.id, ...copies(NO_ICONS.id, 14)]);
    const deck = [...activeEncounterDeck(start).deck].sort((a, b) => order(start, a) - order(start, b));
    // Two cards left (2 icons, then 3) and the rest in the discard pile: discarding 3 stops at 2 and never touches
    // the reshuffled deck (RRG 1.8 "Encounter Deck", p. 17).
    const short = withEncounterPiles(start, { deck: deck.slice(0, 2), discard: deck.slice(2) });
    const state = playCard(short, DISCARD_THREE.card);
    expect(counter(state, "dumped")).toBe(2);
    expect(counter(state, "icons")).toBe(5);
    expect(activeEncounterDeck(state).deck).toEqual([]);
    expect(state.mainScheme.accelerationTokens).toBe(0);
  });
});

/** Sort key that puts the 2-icon card first, then the 3-icon card, then the rest — the shuffle is seeded, not fixed. */
function order(state: GameState, id: InstanceId): number {
  const card = state.instances[id]?.cardId;
  if (card === TWO_ICONS.id) return 0;
  if (card === THREE_ICONS.id) return 1;
  return 2;
}

// ---------------------------------------------------------------------------
// 3. An upper bound on a trigger's event results (`EventPattern.resultsAtMost`)
// ---------------------------------------------------------------------------

/**
 * Unflappable's shape: "Response: After you defend against an attack **and take no damage**, exhaust this → …".
 * `requireResults` and `eventAtLeast` are both minimums, so the "no damage" half needs an upper bound — and it must
 * be part of the trigger condition, not an effect-level `if`, because FAQ "Unflappable (#20)" (RRG 1.8 p. 60) ties
 * the cost itself to it: "The cost of the ability on Unflappable only requires that the defending identity take no
 * damage during step 4 of the enemy attack."
 */
const UNSCATHED = stubAbility("unscathed.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "defended", targetIs: { categories: ["hero"], controller: "you" }, resultsAtMost: { damage: 0 } },
  },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "controller" } },
      counterType: "unscathed",
      amount: one,
    },
  ],
});
/** The same Response without the bound: the control that proves the bound is what stops it. */
const ANY_DEFENSE = stubAbility("any-defense.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "defended", targetIs: { categories: ["hero"], controller: "you" } },
  },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "controller" } },
      counterType: "defended",
      amount: one,
    },
  ],
});

/** A game whose villain hits for `atk` and whose hero has `def`, parked on p1's first turn in hero form. */
function defenseGame(options: { readonly atk: number; readonly def: number }): { deps: EngineDeps; state: GameState } {
  const hero = stubIdentity({
    id: "stoic",
    hp: 20,
    atk: 2,
    thw: 2,
    def: options.def,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroAbilities: [UNSCATHED.ref, ANY_DEFENSE.ref],
  });
  const boss = stubVillain({ id: "hitter", stages: [{ hp: flat(40), atk: options.atk, sch: 0 }] });
  const deps = depsOf(UNSCATHED, ANY_DEFENSE);
  const result = createGame(
    {
      seed: 11,
      cards: [...DEFAULT_CARDS, hero, boss, SCENARIO, BLANK],
      villainCardId: boss.id,
      mainSchemeCardId: SCENARIO.id,
      encounterDeck: copies(BLANK.id, 20),
      includeIdentitySets: false,
      players: [{ identityCardId: hero.id, deck: DEFAULT_DECK }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return { deps, state: runCommands(result.state, deps).state };
}

/** Ends p1's turn in hero form and defends the villain's attack with the identity. */
function defendOnce(deps: EngineDeps, state: GameState): GameState {
  const hero = settle(expectOk(applyCommand(state, toHero, deps)), undefined, deps);
  const attacking = settleUntil(expectOk(applyCommand(hero, endTurn, deps)), "declareDefender", deps);
  const identity = mustPlayer(attacking, p1).identity.instanceId;
  return settle(resolvePending(attacking, [identity], deps), undefined, deps);
}

describe("`resultsAtMost`: an upper bound on a trigger's event results", () => {
  it("'after you defend and take no damage' triggers when the attack got through for 0", () => {
    // ATK 2 into DEF 3: no damage.
    const { deps, state } = defenseGame({ atk: 2, def: 3 });
    const after = defendOnce(deps, state);
    const identity = mustPlayer(after, p1).identity.instanceId;
    expect(mustInstance(after, identity).damage).toBe(0);
    expect(mustInstance(after, identity).counters.unscathed).toBe(1);
    expect(mustInstance(after, identity).counters.defended).toBe(1);
  });

  it("does not trigger when the defended attack dealt damage, while the unbounded Response still does", () => {
    // ATK 5 into DEF 1: 4 damage through.
    const { deps, state } = defenseGame({ atk: 5, def: 1 });
    const after = defendOnce(deps, state);
    const identity = mustPlayer(after, p1).identity.instanceId;
    expect(mustInstance(after, identity).damage).toBeGreaterThan(0);
    expect(mustInstance(after, identity).counters.unscathed).toBeUndefined();
    expect(mustInstance(after, identity).counters.defended).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 4. `TargetQuery.host`: "a Weapon upgrade on your hero"
// ---------------------------------------------------------------------------

const WEAPON = trait("Weapon");
/** No `attachesTo`: an upgrade with none attaches to its controller's identity (`actions.ts` `ownIdentity`). */
const HERO_WEAPON = stubUpgrade({ id: "hero-weapon", cost: 0, traits: [WEAPON] });
/** "Attach to a friendly character": the same trait and type, but it can sit on an ally instead. */
const ALLY_WEAPON: UpgradeCard = {
  ...stubUpgrade({ id: "ally-weapon", cost: 0, traits: [WEAPON] }),
  attachesTo: { kind: "friendlyCharacter" },
};
const HELPER = stubAlly({ id: "helper", cost: 0, atk: 1, thw: 1, hp: 3 });

/** "Exhaust a Weapon upgrade on your hero → …": the cost the host filter unblocks. */
const MEAN_SWING_ACTION = stubAbility("mean-swing.action", {
  trigger: { kind: "action" },
  cost: {
    exhaustCards: {
      slot: "weapon",
      query: { categories: ["upgrade"], trait: WEAPON, host: { kind: "identityOf", player: { kind: "controller" } } },
      min: 1,
      max: 1,
    },
  },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: c(3) }],
});
const MEAN_SWING = stubEvent({ id: "mean-swing", cost: 0, abilities: [MEAN_SWING_ACTION.ref] });

const hostDeps = depsOf(MEAN_SWING_ACTION);

/** Whether `legalActions` offers this hand card as playable right now. */
function playable(state: GameState, card: InstanceId): boolean {
  const actions = legalActions(state, p1, hostDeps);
  return (
    actions.kind === "turn" &&
    actions.legal.some((a) => a.example.type === "playCard" && a.example.cardInstanceId === card)
  );
}

/** A one-player game with a Weapon upgrade on the hero and an identical one on an ally. */
function hostGame(): { state: GameState; onHero: InstanceId; onAlly: InstanceId; ally: InstanceId } {
  const start = newGame({
    extraCards: [HERO_WEAPON, ALLY_WEAPON, HELPER, MEAN_SWING],
    deck: [...DEFAULT_DECK, HELPER.id, HERO_WEAPON.id, ALLY_WEAPON.id, MEAN_SWING.id],
    deps: hostDeps,
  });
  const given = giveCards(start, p1, HELPER.id, HERO_WEAPON.id, ALLY_WEAPON.id);
  const [ally, onHero, onAlly] = given.ids as [InstanceId, InstanceId, InstanceId];
  const played = runCommands(
    given.state,
    hostDeps,
    { type: "playCard", playerId: p1, cardInstanceId: ally, payment: [], attachToInstanceId: null },
    { type: "playCard", playerId: p1, cardInstanceId: onHero, payment: [], attachToInstanceId: null },
    { type: "playCard", playerId: p1, cardInstanceId: onAlly, payment: [], attachToInstanceId: ally },
  ).state;
  return { state: played, onHero, onAlly, ally };
}

describe("`TargetQuery.host`: a card attached to what a ref names", () => {
  it("separates two identical upgrades by what they are attached to", () => {
    const { state, onHero, onAlly, ally } = hostGame();
    const identity = mustPlayer(state, p1).identity.instanceId;
    expect(mustInstance(state, onHero).attachedTo).toBe(identity);
    expect(mustInstance(state, onAlly).attachedTo).toBe(ally);

    const ctx: EffectContext = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps: hostDeps };
    const matching = (host: TargetRef) =>
      cardsInPlay(state).filter((id) => matchesQuery(state, id, { categories: ["upgrade"], trait: WEAPON, host }, ctx));
    expect(matching({ kind: "identityOf", player: { kind: "controller" } })).toEqual([onHero]);
    expect(matching({ kind: "each", query: { categories: ["ally"] } })).toEqual([onAlly]);
    // An unattached card never matches a host filter.
    expect(
      cardsInPlay(state).filter((id) =>
        matchesQuery(
          state,
          id,
          { categories: ["ally"], host: { kind: "identityOf", player: { kind: "controller" } } },
          ctx,
        ),
      ),
    ).toEqual([]);
  });

  it("an 'exhaust a Weapon upgrade on your hero →' cost can only pay with the hero's copy", () => {
    const { state, onHero, onAlly } = hostGame();
    const given = giveCards(state, p1, MEAN_SWING.id);
    const [event] = given.ids as [InstanceId];
    expect(playable(given.state, event)).toBe(true);
    const after = runCommands(given.state, hostDeps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: event,
      payment: [],
      attachToInstanceId: null,
    }).state;
    expect(mustInstance(after, onHero).exhausted).toBe(true);
    expect(mustInstance(after, onAlly).exhausted).toBe(false);
  });

  it("with the hero's copy already exhausted the cost cannot be paid at all, though an identical ally copy is ready", () => {
    const { state, onHero } = hostGame();
    const exhausted: GameState = {
      ...state,
      instances: { ...state.instances, [onHero]: { ...mustInstance(state, onHero), exhausted: true } },
    };
    const given = giveCards(exhausted, p1, MEAN_SWING.id);
    const [event] = given.ids as [InstanceId];
    expect(playable(given.state, event)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. "For this activation, <a named enemy> gets +N ATK/SCH" — no new primitive
// ---------------------------------------------------------------------------

/**
 * Taskmaster's boost shape: "Boost: For this activation, **the villain** gets +1 SCH and +1 ATK for each upgrade you
 * control." `modifyAttack.atkBonus` bonuses whichever enemy is being activated, which is wrong when this card is the
 * boost card for a *villainous minion's* activation (RRG 1.8 "Boost, Boost Icon", p. 11: "Minions with the villainous
 * keyword are also given a boost card when they activate").
 *
 * These tests pin that `modifyStatUntil` with `until: "endOfAttack"` already says it: a lasting stat modifier on a
 * card the ref names, scoped to the current activation frame (an attack *or* a scheme — `currentActivationFrameId`),
 * and the enemy activation reads the enemy's live profile when it deals its damage. So no new engine primitive is
 * needed; the card compiles to `modifyStat("atk", n, theVillain, "endOfAttack")`.
 */
const BOOST_THE_VILLAIN = stubAbility("boost-villain.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "modifyStatUntil", stat: "atk", amount: c(3), target: { kind: "villain" }, until: "endOfAttack" }],
});
const VILLAIN_BOOSTER = stubTreachery({ id: "villain-booster", boostIcons: 0, abilities: [BOOST_THE_VILLAIN.ref] });

/** The same effect aimed at a card that is *not* the activating enemy, recording what each one's ATK reads as. */
const BOOST_THE_ALLY = stubAbility("boost-ally.boost", {
  trigger: { kind: "boost" },
  effects: [
    {
      kind: "modifyStatUntil",
      stat: "atk",
      amount: c(3),
      target: { kind: "each", query: { categories: ["ally"] } },
      until: "endOfAttack",
    },
    {
      kind: "addCounters",
      target: { kind: "villain" },
      counterType: "allyAtk",
      amount: { kind: "stat", of: { kind: "each", query: { categories: ["ally"] } }, stat: "atk" },
    },
    {
      kind: "addCounters",
      target: { kind: "villain" },
      counterType: "villainAtk",
      amount: { kind: "stat", of: { kind: "villain" }, stat: "atk" },
    },
  ],
});
const ALLY_BOOSTER = stubTreachery({ id: "ally-booster", boostIcons: 0, abilities: [BOOST_THE_ALLY.ref] });

const boostDeps = depsOf(BOOST_THE_VILLAIN, BOOST_THE_ALLY);

/** A one-player game whose villain hits for 2 and whose encounter deck is nothing but `booster`. */
function boostGame(booster: { readonly id: CardId }): GameState {
  const boss = stubVillain({ id: "boost-boss", stages: [{ hp: flat(40), atk: 2, sch: 0 }] });
  const result = createGame(
    {
      seed: 3,
      cards: [...DEFAULT_CARDS, boss, SCENARIO, VILLAIN_BOOSTER, ALLY_BOOSTER],
      villainCardId: boss.id,
      mainSchemeCardId: SCENARIO.id,
      encounterDeck: copies(booster.id, 20),
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK] }],
    },
    boostDeps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, boostDeps).state;
}

describe("'for this activation, <named enemy> gets +N ATK' needs no new primitive", () => {
  it("a boost's lasting +3 ATK on the villain is read by the villain's own attack, and expires with the activation", () => {
    const start = boostGame(VILLAIN_BOOSTER);
    const after = run(boostDeps, start, toHero, endTurn);
    const identity = mustPlayer(after, p1).identity.instanceId;
    // ATK 2 + 3 for this activation, undefended.
    expect(mustInstance(after, identity).damage).toBe(5);
    // The modifier is gone once the activation frame closed.
    expect(characterProfile(after, activeVillain(after).instanceId, boostDeps)?.atk).toBe(2);
  });

  it("aimed at a card other than the activating enemy it bonuses that card only, leaving the activation alone", () => {
    const given = giveCards(boostGame(ALLY_BOOSTER), p1, ALLY.id);
    const ally = given.ids[0] as InstanceId;
    const withAlly = runCommands(given.state, boostDeps, toHero, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: ally,
      payment: payFor(given.state, p1, 2),
      attachToInstanceId: null,
    }).state;
    const after = run(boostDeps, withAlly, endTurn);
    const villain = activeVillain(after).instanceId;
    // The ally's ATK read +3 while the villain's stayed at its printed 2 — the bonus followed the ref, not the
    // activation, which is exactly what Taskmaster's "the villain gets…" needs when a minion is the one activating.
    expect(mustInstance(after, villain).counters.allyAtk).toBe(Number(ALLY.atk) + 3);
    expect(mustInstance(after, villain).counters.villainAtk).toBe(2);
    expect(mustInstance(after, mustPlayer(after, p1).identity.instanceId).damage).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 6. `TargetQuery.hasAnyStatus`: "choose a status card in play"
// ---------------------------------------------------------------------------

/**
 * Vapors of Valtorr's shape: "Choose a status card in play. Replace that status card with a different status card."
 * `hasStatus` takes exactly one type; "a status card" is the OR over all three (RRG 1.8 "Status Cards", p. 42).
 * The "replace with a *different* one" half then composes out of vocabulary that already exists — a `chooseOne`
 * whose options are gated by `hasStatus` on the chosen character.
 */
const holder: TargetRef = { kind: "slot", slot: "holder" };
const REPLACE_STATUS = stubAbility("replace-status.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "chooseTarget",
      slot: "holder",
      query: { categories: ["character"], hasAnyStatus: true },
      chooser: { kind: "controller" },
    },
    {
      kind: "chooseOne",
      chooser: { kind: "controller" },
      options: [
        {
          label: "Replace a stunned status card with a confused one",
          condition: { kind: "hasStatus", of: holder, status: "stunned" },
          effects: [
            { kind: "removeStatus", target: holder, status: "stunned" },
            { kind: "giveStatus", target: holder, status: "confused" },
          ],
        },
        {
          label: "Replace a tough status card with a stunned one",
          condition: { kind: "hasStatus", of: holder, status: "tough" },
          effects: [
            { kind: "removeStatus", target: holder, status: "tough" },
            { kind: "giveStatus", target: holder, status: "stunned" },
          ],
        },
      ],
    },
  ],
});
const VAPORS = stubEvent({ id: "vapors", cost: 0, abilities: [REPLACE_STATUS.ref] });
const statusDeps = depsOf(REPLACE_STATUS);

const withStatus = (state: GameState, id: InstanceId, status: "stunned" | "confused" | "tough"): GameState => ({
  ...state,
  instances: {
    ...state.instances,
    [id]: { ...mustInstance(state, id), statuses: { ...mustInstance(state, id).statuses, [status]: 1 } },
  },
});

describe("`TargetQuery.hasAnyStatus`: a character carrying a status card of any type", () => {
  it("matches a character with any of the three, and its negation matches the ones with none", () => {
    const start = newGame({ extraCards: [VAPORS], deck: [...DEFAULT_DECK, VAPORS.id], deps: statusDeps });
    const identity = mustPlayer(start, p1).identity.instanceId;
    const villain = activeVillain(start).instanceId;
    const ctx: EffectContext = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps: statusDeps };
    const characters = (state: GameState, has: boolean) =>
      cardsInPlay(state).filter((id) => matchesQuery(state, id, { categories: ["character"], hasAnyStatus: has }, ctx));

    expect(characters(start, true)).toEqual([]);
    expect(characters(start, false)).toEqual([villain, identity]);
    for (const status of ["stunned", "confused", "tough"] as const) {
      expect(characters(withStatus(start, villain, status), true)).toEqual([villain]);
    }
    // ANDed with `hasStatus` like every other field, not replaced by it.
    const stunned = withStatus(start, villain, "stunned");
    expect(
      cardsInPlay(stunned).filter((id) => matchesQuery(stunned, id, { hasAnyStatus: true, hasStatus: "tough" }, ctx)),
    ).toEqual([]);
  });

  it("'choose a status card in play, replace it with a different one' composes with `chooseOne` and `hasStatus`", () => {
    const start = newGame({ extraCards: [VAPORS], deck: [...DEFAULT_DECK, VAPORS.id], deps: statusDeps });
    const villain = activeVillain(start).instanceId;
    const given = giveCards(withStatus(start, villain, "stunned"), p1, VAPORS.id);
    const after = runCommands(given.state, statusDeps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.ids[0] as InstanceId,
      payment: [],
      attachToInstanceId: null,
    }).state;
    // Only the villain has a status, so the target choice has one candidate; only the stunned option is offered.
    expect(mustInstance(after, villain).statuses).toEqual({ stunned: 0, confused: 1, tough: 0 });
  });
});

// ---------------------------------------------------------------------------
// 7. A cost change with no phase or round duration (`untilCardPlayed`)
// ---------------------------------------------------------------------------

/**
 * Physical Toll's shape: "The next event you play costs 3 additional resources. Discard this obligation after you
 * play an event." Two halves of one timing point — the next matching card this player plays — with **no** phase or
 * round bound (RRG 1.8 "Lasting Effects", p. 26: an effect expires when the timing point its duration specifies is
 * reached; this card specifies none). Bounding it to the round would silently stop applying if the player simply
 * doesn't play an event that round.
 */
const TOLL_ACTION = stubAbility("toll.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "reduceNextCardCost",
      player: { kind: "controller" },
      amount: c(-3),
      duration: "untilPlayed",
      cardFilter: { categories: ["event"] },
    },
    {
      kind: "afterNextCardPlayed",
      player: { kind: "controller" },
      cardFilter: { categories: ["event"] },
      effects: [
        {
          kind: "addCounters",
          target: { kind: "identityOf", player: { kind: "controller" } },
          counterType: "tollPaid",
          amount: one,
        },
      ],
    },
  ],
});
/** A support, so the card that creates the effect stays in play and is not itself the "next event". */
const TOLL = stubSupport({ id: "toll", cost: 0, abilities: [TOLL_ACTION.ref] });
const CHEAP_EVENT_ACTION = stubAbility("cheap.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: one }],
});
const CHEAP_EVENT = stubEvent({ id: "cheap", cost: 1, abilities: [CHEAP_EVENT_ACTION.ref] });
const CHEAP_ALLY = stubAlly({ id: "cheap-ally", cost: 1, atk: 1, thw: 1, hp: 2 });

const tollDeps = depsOf(TOLL_ACTION, CHEAP_EVENT_ACTION);
const tollGame = () =>
  newGame({
    extraCards: [TOLL, CHEAP_EVENT, CHEAP_ALLY],
    deck: [...DEFAULT_DECK, TOLL.id, CHEAP_EVENT.id, CHEAP_ALLY.id],
    deps: tollDeps,
  });
const useToll = (state: GameState): { state: GameState } => {
  const given = giveCards(state, p1, TOLL.id);
  const played = runCommands(given.state, tollDeps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.ids[0] as InstanceId,
    payment: [],
    attachToInstanceId: null,
  }).state;
  const support = mustPlayer(played, p1).playArea.find((id) => played.instances[id]?.cardId === TOLL.id) as InstanceId;
  return {
    state: runCommands(played, tollDeps, {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: support,
      abilityId: TOLL_ACTION.ref.id,
      payment: [],
    }).state,
  };
};

describe("`untilPlayed`: a cost change with no phase or round bound", () => {
  it("adds to the matching card's cost, and leaves a non-matching card alone", () => {
    const { state } = useToll(tollGame());
    const withCards = giveCards(state, p1, CHEAP_EVENT.id, CHEAP_ALLY.id);
    const [event, ally] = withCards.ids as [InstanceId, InstanceId];
    expect(playCostOf(withCards.state, p1, event, tollDeps)?.current).toBe(4); // printed 1 + 3
    expect(playCostOf(withCards.state, p1, ally, tollDeps)?.current).toBe(1); // the filter doesn't match
  });

  it("survives the round boundary the printed card never mentions, then is consumed by the matching play", () => {
    const { state } = useToll(tollGame());
    const identity = mustPlayer(state, p1).identity.instanceId;
    // Play out the whole round without playing an event: the effect must still be waiting.
    const nextRound = run(tollDeps, state, endTurn);
    expect(nextRound.round).toBeGreaterThan(state.round);
    const withEvent = giveCards(nextRound, p1, CHEAP_EVENT.id, RESOURCE.id, RESOURCE.id, RESOURCE.id, RESOURCE.id);
    const event = withEvent.ids[0] as InstanceId;
    expect(playCostOf(withEvent.state, p1, event, tollDeps)?.current).toBe(4);

    const paid = runCommands(withEvent.state, tollDeps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: event,
      payment: payFor(withEvent.state, p1, 4),
      attachToInstanceId: null,
    }).state;
    // The delayed half fired once the event's play finished…
    expect(mustInstance(paid, identity).counters.tollPaid).toBe(1);
    // …and both halves are gone, so the next event costs its printed price again.
    expect(paid.lastingEffects).toEqual([]);
    const again = giveCards(paid, p1, CHEAP_EVENT.id);
    expect(playCostOf(again.state, p1, again.ids[0] as InstanceId, tollDeps)?.current).toBe(1);
  });

  it("waits through a non-matching play: an ally neither pays the extra cost nor fires the delayed half", () => {
    const { state } = useToll(tollGame());
    const identity = mustPlayer(state, p1).identity.instanceId;
    const withAlly = giveCards(state, p1, CHEAP_ALLY.id);
    const ally = withAlly.ids[0] as InstanceId;
    const after = runCommands(withAlly.state, tollDeps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: ally,
      payment: payFor(withAlly.state, p1, 1),
      attachToInstanceId: null,
    }).state;
    expect(mustInstance(after, identity).counters.tollPaid).toBeUndefined();
    const withEvent = giveCards(after, p1, CHEAP_EVENT.id);
    expect(playCostOf(withEvent.state, p1, withEvent.ids[0] as InstanceId, tollDeps)?.current).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 8. A cancelled play stops the cancelled card's own effects
// ---------------------------------------------------------------------------

/**
 * Counterspell's shape: "Forced Interrupt: When you play an event, cancel its effects and discard it. Then, discard
 * this card." RRG 1.8 "Cancel" (p. 13):
 * - "Cancel abilities interrupt the initiation of effects and prevent them from resolving."
 * - "Anytime the effects of an ability are canceled, the ability (apart from its effects) is still regarded as
 *   initiated, and any costs are still paid. Only the effects are prevented from initiating, and do not resolve."
 * - "If the effects of an event card are canceled, the card is still considered played, and it is discarded."
 *
 * So the play still happens (cost paid, "Max N per round" counted, `cardPlayed` announced) and the event still goes
 * to its owner's discard — only its own abilities are skipped.
 */
const COUNTERSPELL_INTERRUPT = stubAbility("counterspell.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
  },
  effects: [{ kind: "cancelTriggeringEvent" }, { kind: "discardFromPlay", target: { kind: "self" } }],
});
const COUNTERSPELL = stubUpgrade({ id: "counterspell", cost: 0, abilities: [COUNTERSPELL_INTERRUPT.ref] });
/** "Deal 3 damage to the villain" — the effects that must not resolve. */
const BLAST_ACTION = stubAbility("blast.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: c(3) }],
});
const BLAST = stubEvent({ id: "blast", cost: 1, abilities: [BLAST_ACTION.ref] });
/** "Response: after you play a card …" — still fires, because the card is still considered played. */
const WATCHER_PLAYED = stubAbility("watcher-played.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardPlayed", playerIs: "controller" } },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "controller" } },
      counterType: "sawPlay",
      amount: one,
    },
  ],
});
const WATCHER = stubSupport({ id: "play-watcher", cost: 0, abilities: [WATCHER_PLAYED.ref] });

const cancelDeps = depsOf(COUNTERSPELL_INTERRUPT, BLAST_ACTION, WATCHER_PLAYED);
const cancelGame = () =>
  newGame({
    extraCards: [COUNTERSPELL, BLAST, WATCHER],
    deck: [...DEFAULT_DECK, COUNTERSPELL.id, BLAST.id, WATCHER.id],
    deps: cancelDeps,
  });
const playFree = (state: GameState, card: { readonly id: CardId }): GameState => {
  const given = giveCards(state, p1, card.id);
  return runCommands(given.state, cancelDeps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.ids[0] as InstanceId,
    payment: [],
    attachToInstanceId: null,
  }).state;
};

describe("a cancelled play stops the cancelled card's own effects (RRG 1.8 'Cancel', p. 13)", () => {
  it("the event's own ability does not resolve, but it is still played, paid for and discarded", () => {
    const withWatcher = playFree(playFree(cancelGame(), WATCHER), COUNTERSPELL);
    const identity = mustPlayer(withWatcher, p1).identity.instanceId;
    const villain = activeVillain(withWatcher).instanceId;
    const given = giveCards(withWatcher, p1, BLAST.id);
    const blast = given.ids[0] as InstanceId;
    const handBefore = mustPlayer(given.state, p1).hand.length;

    const after = runCommands(given.state, cancelDeps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: blast,
      payment: payFor(given.state, p1, 1),
      attachToInstanceId: null,
    }).state;

    expect(mustInstance(after, villain).damage).toBe(0); // the effects never initiated
    expect(mustPlayer(after, p1).discard).toContain(blast); // "it is discarded"
    expect(mustPlayer(after, p1).hand.length).toBe(handBefore - 2); // the event and the resource it cost
    expect(after.playedThisRound[BLAST.name]).toBe(1); // "still considered played" (Max N per round)
    expect(mustInstance(after, identity).counters.sawPlay).toBeGreaterThanOrEqual(1);
    // "Then, discard this card": the interrupt's own second sentence.
    expect(mustPlayer(after, p1).playArea.some((id) => after.instances[id]?.cardId === COUNTERSPELL.id)).toBe(false);
  });

  it("an uncancelled play is unaffected: the same event resolves normally without the interrupt in play", () => {
    const start = cancelGame();
    const villain = activeVillain(start).instanceId;
    const given = giveCards(start, p1, BLAST.id);
    const after = runCommands(given.state, cancelDeps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.ids[0] as InstanceId,
      payment: payFor(given.state, p1, 1),
      attachToInstanceId: null,
    }).state;
    expect(mustInstance(after, villain).damage).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 9. A boost card dealt outside an activation (`giveBoostCard`)
// ---------------------------------------------------------------------------

/**
 * Hired Gun / Intimidation's shape: "When Revealed: … give the villain 1 facedown boost card". RRG 1.8 "Boost, Boost
 * Icon" (p. 11): "If an enemy is dealt a boost card outside of its own activation, that boost card remains facedown on
 * that enemy until that enemy activates. If that enemy is a villain or a minion with the villainous keyword, it still
 * gets dealt another boost card at the start of its activation as normal."
 */
const GIVE_VILLAIN = stubAbility("give-villain.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "giveBoostCard", enemy: { kind: "villain" } }],
});
const GIVER = stubTreachery({ id: "giver", boostIcons: 0, abilities: [GIVE_VILLAIN.ref] });
/** The waiting card and the activation's own card, told apart by their icons. */
const WAITER = stubTreachery({ id: "waiter", boostIcons: 2 });
const NORMAL = stubTreachery({ id: "normal", boostIcons: 1 });
/** "Give each minion and each identity a facedown boost card": only the minion is an enemy that can hold one. */
const GIVE_AROUND_ACTION = stubAbility("give-around.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "giveBoostCard", enemy: { kind: "each", query: { categories: ["minion", "identity"] } } }],
});
const GIVE_AROUND = stubEvent({ id: "give-around", cost: 0, abilities: [GIVE_AROUND_ACTION.ref] });
const LACKEY = stubMinion({ id: "lackey", atk: 1, sch: 1, hp: 5, boostIcons: 0 });
const SCHEMER = stubVillain({ id: "schemer", stages: [{ hp: flat(40), atk: 1, sch: 1 }] });

const giveDeps = depsOf(GIVE_VILLAIN, GIVE_AROUND_ACTION);
const GIVE_CARDS = [GIVER, WAITER, NORMAL, NO_ICONS, GIVE_AROUND, LACKEY];

/** A one-player game whose encounter deck runs `top` in order, then filler with no icons. */
function giveGame(top: readonly CardId[]): GameState {
  const start = newGame({
    villain: SCHEMER,
    mainScheme: SCENARIO,
    extraCards: GIVE_CARDS,
    encounterDeck: [...top, ...copies(NO_ICONS.id, 16)],
    deck: [...DEFAULT_DECK, GIVE_AROUND.id],
    deps: giveDeps,
  });
  const deck = [...activeEncounterDeck(start).deck];
  const ordered: InstanceId[] = [];
  for (const card of top) {
    const index = deck.findIndex((id) => start.instances[id]?.cardId === card);
    ordered.push(...deck.splice(index, 1));
  }
  return withEncounterPiles(start, { deck: [...ordered, ...deck] });
}

type Events = ReturnType<typeof runCommands>["events"];
const flippedCards = (state: GameState, events: Events, enemy: InstanceId) =>
  events.flatMap((e) =>
    e.type === "boostCardFlipped" && e.enemyInstanceId === enemy ? [state.instances[e.instanceId]?.cardId] : [],
  );
const threatFrom = (events: Events, source: InstanceId) =>
  events.flatMap((e) => (e.type === "threatPlaced" && e.sourceInstanceId === source ? [e.amount] : []));

describe("`giveBoostCard`: a boost card dealt outside an activation waits facedown (RRG 1.8 'Boost', p. 11)", () => {
  it("stays facedown on the villain through the rest of the phase, then resolves at its next activation before the normal one", () => {
    // Round 1: NO_ICONS is the villain's boost card, GIVER is dealt and revealed, WAITER is the card it gives.
    // Round 2: NORMAL is the villain's automatic boost card.
    const start = giveGame([NO_ICONS.id, GIVER.id, WAITER.id, NORMAL.id]);
    const roundOne = runCommands(start, giveDeps, endTurn);
    const villain = activeVillain(roundOne.state).instanceId;
    const [waiting] = mustInstance(roundOne.state, villain).boostCards;
    expect(roundOne.state.instances[waiting as InstanceId]?.cardId).toBe(WAITER.id);
    expect(mustInstance(roundOne.state, waiting as InstanceId).faceup).toBe(false);
    expect(roundOne.events).toContainEqual({
      type: "boostCardDealt",
      enemyInstanceId: villain,
      instanceId: waiting,
      outsideActivation: true,
    });
    expect(flippedCards(roundOne.state, roundOne.events, villain)).toEqual([NO_ICONS.id]);

    const roundTwo = runCommands(roundOne.state, giveDeps, endTurn);
    // Both resolve, the waiting card first (dealt order), and the icons add up: SCH 1 + 2 + 1.
    expect(flippedCards(roundTwo.state, roundTwo.events, villain)).toEqual([WAITER.id, NORMAL.id]);
    expect(threatFrom(roundTwo.events, villain)).toEqual([4]);
    expect(mustInstance(roundTwo.state, villain).boostCards).toEqual([]);
    expect(activeEncounterDeck(roundTwo.state).discard).toContain(waiting);

    const whole = runCommands(start, giveDeps, endTurn, endTurn);
    expect(auditVillainPhases(whole.session.log, giveDeps).violations).toEqual([]);
  });

  it("any enemy can hold one, a non-villainous minion flips only that card, and a non-enemy is never given one", () => {
    // Round 1: NO_ICONS is the villain's boost card, LACKEY is dealt, revealed and engaged.
    const roundOne = runCommands(giveGame([NO_ICONS.id, LACKEY.id, WAITER.id, NORMAL.id]), giveDeps, endTurn).state;
    const lackey = mustPlayer(roundOne, p1).playArea.find(
      (id) => roundOne.instances[id]?.cardId === LACKEY.id,
    ) as InstanceId;
    expect(lackey).toBeDefined();
    const identity = mustPlayer(roundOne, p1).identity.instanceId;

    const given = giveCards(roundOne, p1, GIVE_AROUND.id);
    const played = runCommands(given.state, giveDeps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.ids[0] as InstanceId,
      payment: [],
      attachToInstanceId: null,
    });
    // WAITER went to the minion; the identity named by the same ref got nothing, and no second card was drawn for it.
    expect(mustInstance(played.state, lackey).boostCards.map((id) => played.state.instances[id]?.cardId)).toEqual([
      WAITER.id,
    ]);
    expect(mustInstance(played.state, identity).boostCards).toEqual([]);
    expect(played.events.filter((e) => e.type === "boostCardDealt")).toHaveLength(1);

    const roundTwo = runCommands(played.state, giveDeps, endTurn);
    const villain = activeVillain(roundTwo.state).instanceId;
    // The villain gets its automatic card (NORMAL); the minion is not villainous, so it flips only the waiting card.
    expect(flippedCards(roundTwo.state, roundTwo.events, villain)).toEqual([NORMAL.id]);
    expect(flippedCards(roundTwo.state, roundTwo.events, lackey)).toEqual([WAITER.id]);
    expect(threatFrom(roundTwo.events, lackey)).toEqual([3]); // SCH 1 + 2
    const whole = runCommands(played.state, giveDeps, endTurn);
    expect(auditVillainPhases(whole.session.log, giveDeps).violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 10. `TargetQuery.anyPrintedResource`: "a [mental] or a [physical] resource"
// ---------------------------------------------------------------------------

/**
 * Tombstone's shape: "Forced Response: After Tombstone attacks and damages you, discard a [mental] or a [physical]
 * resource from your hand, if able." `printedResource` takes exactly one type; this is the OR, as `anyTrait` is to
 * `trait`. A wild icon is only ever "wild" outside paying a cost (RRG 1.8 "Wild Resource", p. 48), and "printed"
 * means the bottom-left icon (ruling, Jan 11, 2026 (3)), so a card of any type with such an icon qualifies.
 */
const MENTAL = stubResource({ id: "mental-res", icons: 1, produces: { mental: 1 } });
const PHYSICAL = stubResource({ id: "physical-res", icons: 1, produces: { physical: 1 } });
const ENERGY = stubResource({ id: "energy-res", icons: 1, produces: { energy: 1 } });
const WILD = stubResource({ id: "wild-res", icons: 1 });
const TOSS_ACTION = stubAbility("toss.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "chooseCards",
      slot: "tossed",
      from: {
        kind: "zone",
        zone: "hand",
        player: { kind: "controller" },
        filter: { anyPrintedResource: ["mental", "physical"] },
      },
      chooser: { kind: "controller" },
      min: 1,
      max: 1,
    },
    { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "tossed" } }, to: "discard" },
  ],
});
const TOSS = stubEvent({ id: "toss", cost: 0, abilities: [TOSS_ACTION.ref] });
/** Not a resource card, but it prints a [mental] icon. */
const MENTAL_EVENT = stubEvent({ id: "mental-event", cost: 5, resourceIcons: { mental: 1 } });
const tossDeps = depsOf(TOSS_ACTION);
const tossGame = () =>
  newGame({
    extraCards: [MENTAL, PHYSICAL, ENERGY, WILD, TOSS, MENTAL_EVENT],
    deck: [...DEFAULT_DECK, MENTAL.id, PHYSICAL.id, ENERGY.id, WILD.id, TOSS.id, MENTAL_EVENT.id],
    deps: tossDeps,
  });
const playToss = (state: GameState): GameState => {
  const given = giveCards(state, p1, TOSS.id);
  return settleUntil(
    expectOk(
      applyCommand(
        given.state,
        {
          type: "playCard",
          playerId: p1,
          cardInstanceId: given.ids[0] as InstanceId,
          payment: [],
          attachToInstanceId: null,
        },
        tossDeps,
      ),
    ),
    "chooseCards",
    tossDeps,
  );
};

describe("`TargetQuery.anyPrintedResource`: a card printing any of several resource types", () => {
  it("matches a printed icon of any listed type, on any card type, and never a wild or unlisted icon", () => {
    const given = giveCards(tossGame(), p1, MENTAL.id, PHYSICAL.id, ENERGY.id, WILD.id, MENTAL_EVENT.id);
    const [mental, physical, energy, wild, event] = given.ids as [
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
    ];
    const ctx: EffectContext = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps: tossDeps };
    const matches = (id: InstanceId, q: Parameters<typeof matchesQuery>[2]) => matchesQuery(given.state, id, q, ctx);
    const either = { anyPrintedResource: ["mental", "physical"] } as const;
    expect([mental, physical, energy, wild, event].map((id) => matches(id, either))).toEqual([
      true,
      true,
      false,
      false,
      true,
    ]);
    expect(matches(wild, { anyPrintedResource: ["wild"] })).toBe(true);
    // ANDed with the other fields: narrowing to resource cards drops the event.
    expect(matches(event, { ...either, categories: ["resource"] })).toBe(false);
  });

  it("'discard a [mental] or a [physical] resource from your hand' offers exactly those cards and discards the pick", () => {
    const given = giveCards(tossGame(), p1, MENTAL.id, PHYSICAL.id, ENERGY.id, WILD.id);
    const [mental, physical] = given.ids as [InstanceId, InstanceId];
    const asked = playToss(given.state);
    expect(new Set(asked.pendingChoice?.options.map((o) => o.optionId))).toEqual(new Set([mental, physical]));
    const after = resolvePending(asked, [physical], tossDeps);
    expect(mustPlayer(after, p1).discard).toContain(physical);
    expect(mustPlayer(after, p1).hand).toContain(mental);
  });

  it("'if able': with neither type in hand nothing is asked and nothing is discarded", () => {
    const given = giveCards(tossGame(), p1, ENERGY.id, WILD.id);
    const noEither = {
      ...given.state,
      players: given.state.players.map((p) => ({
        ...p,
        hand: p.hand.filter((id) => {
          const card = given.state.instances[id]?.cardId;
          return card !== MENTAL.id && card !== PHYSICAL.id && card !== MENTAL_EVENT.id;
        }),
      })),
    };
    const handBefore = mustPlayer(noEither, p1).hand;
    const after = playToss(noEither);
    expect(after.pendingChoice).toBeNull();
    expect(mustPlayer(after, p1).hand).toEqual(handBefore); // the event itself was given, then played
    expect(mustPlayer(after, p1).discard.map((id) => after.instances[id]?.cardId)).toEqual([TOSS.id]);
  });
});

// ---------------------------------------------------------------------------
// 11. Excess damage placed as threat (`RuleSpec excessDamageAsThreat`)
// ---------------------------------------------------------------------------

/**
 * Radioactive Buildup's shape: "Attach to Thunderball. Excess damage dealt by Thunderball is placed as threat on his
 * corresponding side scheme. Forced Response: After Thunderball attacks, discard this card."
 *
 * The first sentence is a constant, not a Forced Response. Scripting it as a response on the attack (the §3.6 test
 * shape) would share a response window with the card's own "after Thunderball attacks, discard this card", and the
 * discard could win the race. As a constant, the threat is placed while the damage is dealt, before any "after the
 * attack" window opens. Excess damage is damage dealt beyond remaining hit points (RRG 1.8 "Excess Damage", p. 19),
 * counted even when it isn't taken (ruling, Jan 26, 2026 (3)).
 */
const BUILDUP_RULE = stubAbility("buildup.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "excessDamageAsThreat",
        source: { hostOfSelf: true },
        scheme: { kind: "signatureSideSchemeOf", villain: { kind: "host" } },
      },
    ],
  },
  effects: [],
});
const BUILDUP_DISCARD = stubAbility("buildup.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "enemyAttack", sourceIs: { hostOfSelf: true } } },
  effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
});
const BUILDUP = stubAttachment({
  id: "buildup",
  attachesTo: { kind: "villain" },
  abilities: [BUILDUP_RULE.ref, BUILDUP_DISCARD.ref],
});
/** The same rule printed on the villain itself, naming "his" scheme without a ref. */
const OWN_EXCESS = stubAbility("bruiser.own-excess", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "excessDamageAsThreat", source: { self: true }, scheme: "ownSignatureSideScheme" }],
  },
  effects: [],
});
const BUILDUP_SCHEME = stubSideScheme({ id: "buildup-scheme", startingThreat: 1, boostIcons: 0 });
const excessDeps = depsOf(PUT_SCHEMES, BUILDUP_RULE, BUILDUP_DISCARD, OWN_EXCESS);

/** p1's second turn, in hero form, against an ATK 5 villain; with `attached` the buildup was revealed in round 1. */
function excessGame(options: {
  readonly attached: boolean;
  readonly villainAbilities?: readonly StubAbility[];
}): GameState {
  const bruiser = stubVillain({
    id: "bruiser",
    stages: [{ hp: flat(40), atk: 5, sch: 0, abilities: (options.villainAbilities ?? []).map((a) => a.ref) }],
  });
  const top = options.attached ? [BLANK.id, BUILDUP.id] : [];
  const result = createGame(
    {
      seed: 9,
      cards: [...DEFAULT_CARDS, bruiser, SCENARIO, BUILDUP_SCHEME, BLANK, BUILDUP],
      villainCardId: bruiser.id,
      villains: [
        {
          villainCardId: bruiser.id,
          encounterDeck: [...top, ...copies(BLANK.id, 16)],
          signatureSideSchemeCardId: BUILDUP_SCHEME.id,
        },
      ],
      mainSchemeCardId: SCENARIO.id,
      encounterDeck: [],
      players: [{ identityCardId: cardId("hero"), deck: DEFAULT_DECK }],
    },
    excessDeps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const start = settle(result.state, undefined, excessDeps);
  const deck = [...activeEncounterDeck(start).deck];
  const ordered: InstanceId[] = [];
  for (const card of top)
    ordered.push(
      ...deck.splice(
        deck.findIndex((id) => start.instances[id]?.cardId === card),
        1,
      ),
    );
  return runCommands(withEncounterPiles(start, { deck: [...ordered, ...deck] }), excessDeps, endTurn, toHero).state;
}

/** Puts an ally into play and has it defend the villain's next attack. */
function defendWithAlly(state: GameState, tough = false) {
  const given = giveCards(state, p1, ALLY.id, RESOURCE.id, RESOURCE.id);
  const ally = given.ids[0] as InstanceId;
  let played = runCommands(given.state, excessDeps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: ally,
    payment: payFor(given.state, p1, 2),
    attachToInstanceId: null,
  }).state;
  if (tough) played = withStatus(played, ally, "tough");
  const pickAlly = (s: GameState): readonly string[] =>
    s.pendingChoice?.prompt.kind === "declareDefender" ? [ally] : resolveDefault(s);
  return { ally, ...runCommandsPicking(played, excessDeps, pickAlly, endTurn) };
}
const resolveDefault = (s: GameState): readonly string[] =>
  s.pendingChoice?.options.slice(0, s.pendingChoice.minSelections).map((o) => o.optionId) ?? [];
const buildupOn = (state: GameState) => cardsInPlay(state).find((id) => state.instances[id]?.cardId === BUILDUP.id);

describe("`excessDamageAsThreat`: excess damage dealt is placed as threat on a scheme", () => {
  it("an attack defeating a 3-HP ally for 5 places 2 threat, before the card's own 'after attacks, discard this' response", () => {
    const start = excessGame({ attached: true });
    const attachment = buildupOn(start) as InstanceId;
    expect(mustInstance(start, attachment).attachedTo).toBe(activeVillain(start).instanceId);
    const scheme = signatureId(start);
    const before = mustInstance(start, scheme).threat;

    const { state, events, ally } = defendWithAlly(start);
    expect(mustPlayer(state, p1).playArea).not.toContain(ally);
    expect(mustInstance(state, scheme).threat).toBe(before + 2);
    const converted = events.findIndex(
      (e) =>
        e.type === "excessDamageAsThreat" &&
        e.amount === 2 &&
        e.schemeInstanceId === scheme &&
        e.targetInstanceId === ally,
    );
    const placed = events.findIndex(
      (e) => e.type === "threatPlaced" && e.schemeInstanceId === scheme && e.amount === 2,
    );
    const discarded = events.findIndex((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === attachment);
    expect(converted).toBeGreaterThanOrEqual(0);
    expect(placed).toBeGreaterThan(converted);
    expect(discarded).toBeGreaterThan(placed);
    expect(buildupOn(state)).toBeUndefined();
  });

  it("counts excess damage dealt, not taken: a tough ally takes nothing and the excess still becomes threat", () => {
    const start = excessGame({ attached: true });
    const scheme = signatureId(start);
    const before = mustInstance(start, scheme).threat;
    const { state, ally } = defendWithAlly(start, true);
    expect(mustInstance(state, ally).damage).toBe(0);
    expect(mustInstance(state, scheme).threat).toBe(before + 2);
  });

  it("no excess, no threat: an undefended attack a 10-HP hero survives", () => {
    const start = excessGame({ attached: true });
    const scheme = signatureId(start);
    const before = mustInstance(start, scheme).threat;
    const { state, events } = runCommands(start, excessDeps, endTurn);
    expect(mustInstance(state, mustPlayer(state, p1).identity.instanceId).damage).toBe(5);
    expect(events.some((e) => e.type === "excessDamageAsThreat")).toBe(false);
    expect(mustInstance(state, scheme).threat).toBe(before);
  });

  it("`ownSignatureSideScheme` printed on the villain itself; only the matching source converts, and nothing without the rule", () => {
    const own = excessGame({ attached: false, villainAbilities: [OWN_EXCESS] });
    const scheme = signatureId(own);
    const before = mustInstance(own, scheme).threat;
    const { state, ally } = defendWithAlly(own);
    expect(mustInstance(state, scheme).threat).toBe(before + 2);
    // The rule names the villain, so an ally's damage never converts.
    expect(excessDamageThreatSchemes(state, excessDeps, activeVillain(state).instanceId)).toEqual([scheme]);
    expect(excessDamageThreatSchemes(state, excessDeps, mustPlayer(state, p1).identity.instanceId)).toEqual([]);
    expect(ally).toBeDefined();

    const control = excessGame({ attached: false });
    const controlBefore = mustInstance(control, signatureId(control)).threat;
    const after = defendWithAlly(control).state;
    expect(mustInstance(after, signatureId(after)).threat).toBe(controlBefore);
  });
});

// ---------------------------------------------------------------------------
// 12. "The defending character" (`TargetRef defendingCharacter`)
// ---------------------------------------------------------------------------

/**
 * Energy Projectiles' boost: "Deal 1 damage to the defending character." A Boost ability resolves with no triggering
 * event, so `eventTarget` can't name the defender. RRG 1.8 "Attack (Enemy Activation)" (p. 9): boost cards flip in
 * step 3, after the defender is declared in step 2. If that damage defeats a defending ally, the attack is undefended
 * and its damage goes to that ally's controller's identity (p. 9 step 5; "Defend, Defense", p. 16).
 */
const PROJECTILE_BOOST = stubAbility("projectile.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "dealDamage", target: { kind: "defendingCharacter" }, amount: one }],
});
const PROJECTILE = stubTreachery({ id: "projectile", boostIcons: 0, abilities: [PROJECTILE_BOOST.ref] });
const FRAIL = stubAlly({ id: "frail", cost: 0, atk: 1, thw: 1, hp: 1 });
const STURDY = stubAlly({ id: "sturdy", cost: 0, atk: 1, thw: 1, hp: 5 });
const defendDeps = depsOf(PROJECTILE_BOOST);
const DEFENDING_VILLAIN = stubVillain({ id: "projector", stages: [{ hp: flat(40), atk: 2, sch: 1 }] });

/** p1's first turn with `allies` in play, against an ATK 2 villain whose every boost card is a projectile. */
function projectileGame(...allies: readonly AnyCard[]): { state: GameState; allies: readonly InstanceId[] } {
  const start = newGame({
    villain: DEFENDING_VILLAIN,
    mainScheme: SCENARIO,
    extraCards: [PROJECTILE, FRAIL, STURDY],
    encounterDeck: copies(PROJECTILE.id, 20),
    deck: [...DEFAULT_DECK, FRAIL.id, STURDY.id],
    deps: defendDeps,
  });
  const given = giveCards(start, p1, ...allies.map((a) => a.id));
  const played = runCommands(
    given.state,
    defendDeps,
    ...given.ids.map((id): Command => ({
      type: "playCard",
      playerId: p1,
      cardInstanceId: id,
      payment: [],
      attachToInstanceId: null,
    })),
  ).state;
  return { state: played, allies: given.ids };
}
const defendingWith =
  (defender: string) =>
  (s: GameState): readonly string[] =>
    s.pendingChoice?.prompt.kind === "declareDefender" ? [defender] : resolveDefault(s);
const damageTo = (events: Events, target: InstanceId) =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === target ? [e.amount] : []));

describe("`TargetRef defendingCharacter`: the defender of the enemy attack in progress", () => {
  it("a boost damages the defending ally before the attack's own damage", () => {
    const { state, allies } = projectileGame(STURDY);
    const ally = allies[0] as InstanceId;
    const { state: after, events } = runCommandsPicking(state, defendDeps, defendingWith(ally), toHero, endTurn);
    expect(damageTo(events, ally)).toEqual([1, 2]);
    expect(mustInstance(after, ally).damage).toBe(3);
    expect(mustInstance(after, mustPlayer(after, p1).identity.instanceId).damage).toBe(0);
  });

  it("names a hero making a basic defense, and nothing on an undefended attack or a scheme", () => {
    const { state } = projectileGame();
    const identity = mustPlayer(state, p1).identity.instanceId;
    // ATK 2 into DEF 2: only the boost's 1 damage lands.
    const defended = runCommandsPicking(state, defendDeps, defendingWith(identity), toHero, endTurn);
    expect(damageTo(defended.events, identity)).toEqual([1]);

    const undefended = runCommands(state, defendDeps, toHero, endTurn);
    expect(damageTo(undefended.events, identity)).toEqual([2]);

    const scheme = runCommands(state, defendDeps, endTurn);
    expect(scheme.events.some((e) => e.type === "damageDealt")).toBe(false);
    expect(mustInstance(scheme.state, identity).damage).toBe(0);
  });

  it("a defending ally the boost defeats makes the attack undefended, and the identity takes the attack (RRG 1.8 p. 9, p. 16)", () => {
    const { state, allies } = projectileGame(FRAIL);
    const ally = allies[0] as InstanceId;
    const identity = mustPlayer(state, p1).identity.instanceId;
    const {
      state: after,
      events,
      session,
    } = runCommandsPicking(state, defendDeps, defendingWith(ally), toHero, endTurn);
    expect(mustPlayer(after, p1).playArea).not.toContain(ally);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "defenderLeftPlay", defenderInstanceId: ally, targetInstanceId: identity }),
    );
    // No DEF reduction: the identity did not defend, and the ally's damage does not carry over.
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "attackResolved",
        targetInstanceId: identity,
        defenseReduction: 0,
        damageDealt: 2,
      }),
    );
    expect(mustInstance(after, identity).damage).toBe(2);
    expect(auditVillainPhases(session.log, defendDeps).violations).toEqual([]);
  });
});
