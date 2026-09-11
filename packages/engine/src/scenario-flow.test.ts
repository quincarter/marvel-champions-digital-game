import { flat, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubObligation,
  stubResource,
  stubSideScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { ALLY, DEFAULT_CARDS, giveCards, HERO, newGame, resolvePending, RESOURCE, runWith, settle, settleUntil } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const def = (definition: AbilityDefinition) => definition;
const toHero = (player: PlayerId = p1): Command => ({ type: "changeForm", playerId: player });
const endTurn = (player: PlayerId = p1): Command => ({ type: "endTurn", playerId: player });
const copies = (id: CardId, n = 20): readonly CardId[] => Array.from({ length: n }, () => id);
const you = { kind: "controller" } as const;

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({ id: "scheme", stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }] });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const ENERGY = stubResource({ id: "energy", icons: 0, produces: { energy: 2 } });
const MENTAL = stubResource({ id: "mental", icons: 0, produces: { mental: 1 } });

// The default stub identity "hero" links to obligation "hero-obligation" and nemesis set "hero-nemesis".
const NEMESIS_MINION = stubMinion({ id: "nemesis-minion", atk: 1, sch: 1, hp: 4, boostIcons: 0, encounterSetIds: ["hero-nemesis"] });
const NEMESIS_SCHEME = stubSideScheme({ id: "nemesis-scheme", startingThreat: 3, boostIcons: 0, encounterSetIds: ["hero-nemesis"] });
const NEMESIS_TREACHERY: AnyCard = { ...stubTreachery({ id: "nemesis-treachery", boostIcons: 0, encounterSetIds: ["hero-nemesis"] }), quantityInSet: 2 };
const NEMESIS: readonly AnyCard[] = [NEMESIS_MINION, NEMESIS_SCHEME, NEMESIS_TREACHERY];

const decline = (state: GameState): readonly string[] =>
  state.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : (state.pendingChoice?.options.slice(0, state.pendingChoice.minSelections).map((o) => o.optionId) ?? []);
const idsOf = (state: GameState, ids: readonly InstanceId[], card: AnyCard) => ids.filter((id) => state.instances[id]?.cardId === card.id);
const threatOn = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;

/** Test surgery: the first encounter cards become copies of `order`, in order (round 1 draws each player's boost card first). */
function stackEncounter(state: GameState, ...order: readonly CardId[]): GameState {
  const rest = [...state.encounterDeck];
  const top: InstanceId[] = [];
  for (const card of order) {
    const index = rest.findIndex((id) => state.instances[id]?.cardId === card);
    if (index < 0) throw new Error(`no ${card} in the encounter deck`);
    top.push(rest[index] as InstanceId);
    rest.splice(index, 1);
  }
  return { ...state, encounterDeck: [...top, ...rest] };
}

function game(options: { cards?: readonly AnyCard[]; abilities?: readonly StubAbility[]; encounter?: readonly CardId[]; villain?: ReturnType<typeof stubVillain>; scheme?: ReturnType<typeof stubMainScheme>; start?: number; last?: number; deck?: readonly CardId[] } = {}) {
  const deps = depsOf(...(options.abilities ?? []));
  const config: Partial<GameSetupConfig> = {
    ...(options.start !== undefined ? { villainStartStageIndex: options.start } : {}),
    ...(options.last !== undefined ? { villainLastStageIndex: options.last } : {}),
  };
  const result = createGame(
    {
      seed: 99,
      cards: [...DEFAULT_CARDS, BLANK, ENERGY, MENTAL, options.villain ?? VILLAIN, options.scheme ?? SCHEME, ...(options.cards ?? [])],
      villainCardId: (options.villain ?? VILLAIN).id,
      mainSchemeCardId: (options.scheme ?? SCHEME).id,
      encounterDeck: options.encounter ?? copies(BLANK.id),
      players: [{ identityCardId: HERO.id, deck: [...copies(RESOURCE.id, 12), ...copies(ALLY.id, 6), ...copies(ENERGY.id, 3), ...copies(MENTAL.id, 3), ...(options.deck ?? [])] }],
      ...config,
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return { deps, state: settle(result.state, decline, deps) };
}

describe("setup completeness (RRG Appendix II, 'Obligation', 'Nemesis Encounter Set')", () => {
  it("shuffles each identity's obligation into the encounter deck and sets its nemesis set aside", () => {
    const OBLIGATION = stubObligation({ id: "hero-obligation" });
    const { state } = game({ cards: [OBLIGATION, ...NEMESIS] });
    expect(idsOf(state, state.encounterDeck, OBLIGATION)).toHaveLength(1);
    const setAside = mustPlayer(state, p1).setAside;
    expect(setAside).toHaveLength(4); // minion, side scheme, 2 × treachery (quantityInSet)
    expect(state.encounterDeck.some((id) => setAside.includes(id))).toBe(false);
    expect(setAside.some((id) => cardsInPlay(state).includes(id))).toBe(false);
  });

  it("requireIdentitySets rejects a setup whose obligation or nemesis cards are missing", () => {
    const result = createGame({
      seed: 1,
      cards: [...DEFAULT_CARDS],
      villainCardId: DEFAULT_CARDS.find((c) => c.type === "villain")?.id as CardId,
      mainSchemeCardId: DEFAULT_CARDS.find((c) => c.type === "main_scheme")?.id as CardId,
      encounterDeck: [],
      players: [{ identityCardId: HERO.id, deck: copies(RESOURCE.id) }],
      requireIdentitySets: true,
    });
    expect(result.ok).toBe(false);
  });

  it("standard/expert villain stages: the game is won when the last stage used is defeated", () => {
    const three = stubVillain({ id: "villain", stages: [{ hp: flat(3), atk: 0, sch: 0 }, { hp: flat(3), atk: 0, sch: 0 }, { hp: flat(3), atk: 0, sch: 0 }] });
    const kick = stubAbility("kick", def({ trigger: { kind: "action" }, label: ["attack"], effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 3 } }] }));
    const KICK = stubEvent({ id: "kick", cost: 0, abilities: [kick.ref] });
    const deps = depsOf(kick);
    const standard = createGame(
      { seed: 5, cards: [...DEFAULT_CARDS, three, SCHEME, BLANK, KICK], villainCardId: three.id, mainSchemeCardId: SCHEME.id, encounterDeck: copies(BLANK.id), players: [{ identityCardId: HERO.id, deck: copies(KICK.id, 20) }], villainLastStageIndex: 1 },
      deps,
    );
    if (!standard.ok) throw new Error(standard.error.message);
    let state = settle(standard.state, decline, deps);
    state = runWith(deps, state, toHero());
    for (let i = 0; i < 2 && !state.outcome; i++) {
      const kickId = mustPlayer(state, p1).hand.find((id) => state.instances[id]?.cardId === KICK.id) as InstanceId;
      state = runWith(deps, state, { type: "playCard", playerId: p1, cardInstanceId: kickId, payment: [], attachToInstanceId: null });
    }
    expect(state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });

  it("expert: the starting stage's When Revealed resolves at setup (Rhino II); a new stage brings Toughness and its When Revealed (Rhino III)", () => {
    const BREAKIN = stubSideScheme({ id: "breakin", startingThreat: 2, boostIcons: 0 });
    const rhinoII = stubAbility("rhino-ii", def({
      trigger: { kind: "whenRevealed" },
      effects: [
        { kind: "selectCards", slot: "b", cards: { kind: "encounter", zones: ["deck", "discard"], filter: { name: "breakin" } } },
        { kind: "revealCard", cards: { kind: "slot", slot: "b" }, player: you },
        { kind: "shuffleEncounterDeck" },
      ],
    }));
    const rhinoIII = stubAbility("rhino-iii", def({ trigger: { kind: "whenRevealed" }, effects: [{ kind: "giveStatus", target: { kind: "each", query: { categories: ["hero"] } }, status: "stunned" }] }));
    const rhino = stubVillain({
      id: "villain",
      stages: [
        { hp: flat(5), atk: 0, sch: 0 },
        { hp: flat(3), atk: 0, sch: 0, abilities: [rhinoII.ref] },
        { hp: flat(9), atk: 0, sch: 0, keywords: [{ name: "toughness" }], abilities: [rhinoIII.ref] },
      ],
    });
    const kick = stubAbility("kick", def({ trigger: { kind: "action" }, label: ["attack"], effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 3 } }] }));
    const KICK = stubEvent({ id: "kick", cost: 0, abilities: [kick.ref] });
    const { deps, state } = game({ cards: [BREAKIN, KICK], abilities: [rhinoII, rhinoIII, kick], villain: rhino, start: 1, encounter: [BREAKIN.id, ...copies(BLANK.id, 10)], deck: copies(KICK.id, 2) });
    const breakinId = Object.values(state.instances).find((i) => i.cardId === BREAKIN.id)?.instanceId as InstanceId;
    expect(state.villainArea).toContain(breakinId);
    expect(threatOn(state, breakinId)).toBe(2);
    // Put a kick in hand (test surgery) and defeat stage II as a hero.
    const kickId = Object.values(state.instances).find((i) => i.cardId === KICK.id)?.instanceId as InstanceId;
    const withKick: GameState = { ...state, players: state.players.map((p) => ({ ...p, deck: p.deck.filter((id) => id !== kickId), hand: [...p.hand.filter((id) => id !== kickId), kickId] })) };
    const after = runWith(deps, withKick, toHero(), { type: "playCard", playerId: p1, cardInstanceId: kickId, payment: [], attachToInstanceId: null });
    expect(after.villain.stageIndex).toBe(2);
    expect(mustInstance(after, after.villain.instanceId).statuses.tough).toBe(1);
    expect(mustInstance(after, mustPlayer(after, p1).identity.instanceId).statuses.stunned).toBe(1);
  });
});

describe("obligations (RRG 'Obligation', 'Reveal')", () => {
  const obligationEffects: readonly EffectSpec[] = [
    {
      kind: "chooseOne",
      chooser: you,
      options: [
        {
          label: "Exhaust your alter-ego → remove this from the game",
          condition: { kind: "exists", query: { categories: ["alterEgo"], controller: "you", exhausted: false } },
          effects: [{ kind: "exhaust", target: { kind: "identityOf", player: you } }, { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "removedFromGame" }],
        },
        {
          label: "Discard 1 card at random; discard this obligation",
          effects: [{ kind: "discardFromHand", player: you, amount: { kind: "const", value: 1 }, random: true }, { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "discard" }],
        },
      ],
    },
  ];

  it("is given to its hero's player, who resolves it — even when another player revealed it", () => {
    const eviction = stubAbility("eviction", def({ trigger: { kind: "whenRevealed" }, effects: obligationEffects }));
    const OBLIGATION = stubObligation({ id: "a-obligation", abilities: [eviction.ref] });
    const HERO_A = stubIdentity({ id: "a", hp: 10, atk: 2, thw: 1, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 });
    const HERO_B = stubIdentity({ id: "b", hp: 10, atk: 2, thw: 1, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 });
    const deps = depsOf(eviction);
    const created = createGame(
      {
        seed: 3,
        cards: [...DEFAULT_CARDS, HERO_A, HERO_B, OBLIGATION, BLANK, VILLAIN, SCHEME],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: SCHEME.id,
        encounterDeck: copies(BLANK.id, 10),
        players: [
          { identityCardId: HERO_A.id, deck: copies(RESOURCE.id, 20) },
          { identityCardId: HERO_B.id, deck: copies(RESOURCE.id, 20) },
        ],
      },
      deps,
    );
    if (!created.ok) throw new Error(created.error.message);
    // Round 1: two boost cards (one per villain activation), then p1 and p2 are dealt one each: p2 gets the obligation.
    const start = stackEncounter(settle(created.state, decline, deps), BLANK.id, BLANK.id, BLANK.id, OBLIGATION.id);
    const obligationId = start.encounterDeck[3] as InstanceId;
    const atChoice = settleUntil(runWith(deps, start, endTurn(p1), endTurn(p2)), "chooseOption", deps);
    expect(atChoice.pendingChoice?.playerId).toBe(p1);
    expect(mustPlayer(atChoice, p1).playArea).toContain(obligationId);
    const after = settle(resolvePending(atChoice, ["0"], deps), decline, deps);
    expect(after.removedFromGame).toContain(obligationId);
    // Exhausted during the villain phase; the ready step is at the end of the *player* phase, so it stays exhausted.
    expect(mustInstance(after, mustPlayer(after, p1).identity.instanceId).exhausted).toBe(true);
  });

  it("an obligation whose hero isn't in the game is removed from the game and another card is revealed", () => {
    const orphan = stubAbility("orphan", def({ trigger: { kind: "whenRevealed" }, effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 9 } }] }));
    const ORPHAN = stubObligation({ id: "absent-obligation", abilities: [orphan.ref] });
    const ABSENT = stubIdentity({ id: "absent", hp: 10, atk: 1, thw: 1, def: 1, rec: 1, heroHandSize: 5, alterEgoHandSize: 5 });
    const { deps, state } = game({ cards: [ORPHAN, ABSENT], abilities: [orphan], encounter: [ORPHAN.id, ...copies(BLANK.id, 10)] });
    const stacked = stackEncounter(state, BLANK.id, ORPHAN.id);
    const orphanId = stacked.encounterDeck[1] as InstanceId;
    const after = settle(runWith(deps, stacked, endTurn()), decline, deps);
    expect(after.removedFromGame).toContain(orphanId);
    expect(threatOn(after, after.mainScheme.instanceId)).toBe(5);
    // The replacement reveal was a blank (boost card + the extra reveal).
    expect(idsOf(after, after.encounterDiscard, BLANK)).toHaveLength(2);
  });
});

describe("encounter-deck searches and set-aside cards", () => {
  it("'Discard cards from the encounter deck until a minion is discarded. Put it into play engaged with the first player' (1B When Revealed at setup)", () => {
    const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 3, boostIcons: 0 });
    const underground = stubAbility("underground", def({
      trigger: { kind: "whenRevealed" },
      effects: [
        { kind: "discardEncounterUntil", filter: { categories: ["minion"] }, bind: "m" },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "m" }, controller: { kind: "firstPlayer" } },
      ],
    }));
    const scheme = stubMainScheme({ id: "scheme", stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0), abilities: [underground.ref] }] });
    const { state } = game({ cards: [THUG], abilities: [underground], scheme, encounter: [THUG.id, ...copies(BLANK.id, 5)] });
    const thug = Object.values(state.instances).find((i) => i.cardId === THUG.id);
    expect(thug && mustPlayer(state, p1).playArea).toContain(thug?.instanceId);
    expect(thug?.engagedWith).toBe(p1);
  });

  it("Shadow of the Past: reveal your set-aside nemesis minion and side scheme; shuffle the rest of the set into the encounter deck", () => {
    const shadow = stubAbility("shadow", def({
      trigger: { kind: "whenRevealed" },
      effects: [
        { kind: "selectCards", slot: "nm", cards: { kind: "setAside", player: you, filter: { categories: ["minion"] } } },
        { kind: "revealCard", cards: { kind: "slot", slot: "nm" }, player: you },
        { kind: "selectCards", slot: "ns", cards: { kind: "setAside", player: you, filter: { categories: ["sideScheme"] } } },
        { kind: "revealCard", cards: { kind: "slot", slot: "ns" }, player: you },
        { kind: "moveCards", cards: { kind: "setAside", player: you }, to: "encounterDeckShuffle" },
        { kind: "if", condition: { kind: "not", of: { kind: "varAtLeast", name: "nm.count", amount: 1 } }, then: [{ kind: "gainSurge" }] },
      ],
    }));
    const SHADOW = stubTreachery({ id: "shadow", boostIcons: 0, abilities: [shadow.ref] });
    const { deps, state } = game({ cards: [SHADOW, ...NEMESIS], abilities: [shadow], encounter: [SHADOW.id, ...copies(BLANK.id, 10)] });
    const after = settle(runWith(deps, stackEncounter(state, BLANK.id, SHADOW.id), endTurn()), decline, deps);
    expect(mustPlayer(after, p1).setAside).toEqual([]);
    const minion = Object.values(after.instances).find((i) => i.cardId === NEMESIS_MINION.id);
    expect(minion?.engagedWith).toBe(p1);
    const scheme = Object.values(after.instances).find((i) => i.cardId === NEMESIS_SCHEME.id)?.instanceId as InstanceId;
    expect(after.villainArea).toContain(scheme);
    expect(threatOn(after, scheme)).toBe(3);
    const treacheries = Object.values(after.instances).filter((i) => i.cardId === NEMESIS_TREACHERY.id).map((i) => i.instanceId);
    expect(treacheries.every((id) => after.encounterDeck.includes(id) || after.encounterDiscard.includes(id))).toBe(true);
  });

  it("Highway Robbery: cards placed facedown under the scheme (tucked, out of play) return to hand when it is defeated", () => {
    const robbery = stubAbility("robbery-revealed", def({
      trigger: { kind: "whenRevealed" },
      effects: [{ kind: "forEachPlayer", players: { kind: "each" }, effects: [{ kind: "tuckCards", cards: { kind: "zone", zone: "hand", player: { kind: "scoped" }, random: { kind: "const", value: 1 } }, under: { kind: "self" }, facedown: true }] }],
    }));
    const giveBack = stubAbility("robbery-defeated", def({ trigger: { kind: "whenDefeated" }, effects: [{ kind: "moveCards", cards: { kind: "tucked", under: { kind: "self" } }, to: "hand" }] }));
    const ROBBERY = stubSideScheme({ id: "robbery", startingThreat: 1, boostIcons: 0, abilities: [robbery.ref, giveBack.ref] });
    const { deps, state } = game({ cards: [ROBBERY], abilities: [robbery, giveBack], encounter: [ROBBERY.id, ...copies(BLANK.id, 10)] });
    const roundTwo = settle(runWith(deps, stackEncounter(state, BLANK.id, ROBBERY.id), endTurn()), decline, deps);
    const robberyId = Object.values(roundTwo.instances).find((i) => i.cardId === ROBBERY.id)?.instanceId as InstanceId;
    const [tuckedId] = mustInstance(roundTwo, robberyId).tucked as [InstanceId];
    expect(tuckedId).toBeDefined();
    expect(mustPlayer(roundTwo, p1).hand).not.toContain(tuckedId);
    expect(cardsInPlay(roundTwo)).not.toContain(tuckedId);
    const thwarted = runWith(deps, roundTwo, toHero(), { type: "basicThwart", playerId: p1, thwarterInstanceId: mustPlayer(roundTwo, p1).identity.instanceId, schemeInstanceId: robberyId });
    expect(mustPlayer(thwarted, p1).hand).toContain(tuckedId);
    expect(thwarted.encounterDiscard).toContain(robberyId);
    expect(mustInstance(thwarted, robberyId).tucked).toEqual([]);
  });
});

describe("damage assignment and hand discards", () => {
  it("'Assign X damage among heroes and allies' (Explosion) — one point at a time", () => {
    const explosion = stubAbility("explosion", def({ trigger: { kind: "action" }, effects: [{ kind: "assignDamage", amount: { kind: "const", value: 3 }, among: { categories: ["hero", "ally"] }, chooser: you }] }));
    const EXPLOSION = stubEvent({ id: "explosion", cost: 0, abilities: [explosion.ref] });
    const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 4 });
    const deps = depsOf(explosion);
    const state = newGame({ villain: VILLAIN, mainScheme: SCHEME, extraCards: [EXPLOSION, PAL, BLANK], deck: [...copies(EXPLOSION.id, 3), ...copies(PAL.id, 3), ...copies(RESOURCE.id, 10)], encounterDeck: copies(BLANK.id), deps });
    // Test surgery: make sure both cards are in hand, whatever the opening draw was.
    const given = giveCards(state, p1, PAL.id, EXPLOSION.id);
    const [pal, bomb] = given.ids as [InstanceId, InstanceId];
    const play = (id: InstanceId): Command => ({ type: "playCard", playerId: p1, cardInstanceId: id, payment: [], attachToInstanceId: null });
    const identity = mustPlayer(given.state, p1).identity.instanceId;
    let current = runWith(deps, given.state, toHero(), play(pal), play(bomb));
    for (const target of [identity, pal, identity]) {
      expect(current.pendingChoice?.prompt).toEqual({ kind: "chooseTarget", slot: "assignDamage", abilityId: null });
      current = resolvePending(current, [target], deps);
    }
    expect(mustInstance(current, identity).damage).toBe(2);
    expect(mustInstance(current, pal).damage).toBe(1);
  });

  it("'Discard 1 card at random from each player's hand; 1 threat for each different resource type discarded' (The Vulture's Plans)", () => {
    const plans = stubAbility("plans", def({
      trigger: { kind: "action" },
      effects: [
        { kind: "moveCards", cards: { kind: "zone", zone: "hand", player: { kind: "each" }, random: { kind: "const", value: 1 } }, to: "discard", bind: "d" },
        { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "resourceTypes", cards: { kind: "slot", slot: "d" } } },
      ],
    }));
    const PLANS = stubEvent({ id: "plans", cost: 0, abilities: [plans.ref] });
    const deps = depsOf(plans);
    const state = newGame({ players: 2, villain: VILLAIN, mainScheme: SCHEME, extraCards: [PLANS, ENERGY, MENTAL, BLANK], deck: [...copies(PLANS.id, 2), ...copies(ENERGY.id, 4), ...copies(MENTAL.id, 4), ...copies(RESOURCE.id, 10)], encounterDeck: copies(BLANK.id), deps });
    const find = (player: PlayerId, card: AnyCard) => [...mustPlayer(state, player).hand, ...mustPlayer(state, player).deck].find((id) => state.instances[id]?.cardId === card.id) as InstanceId;
    const plansId = find(p1, PLANS);
    const energyId = find(p1, ENERGY);
    const mentalId = find(p2, MENTAL);
    // Test surgery: p1 holds the event and one Energy; p2 holds one Mental.
    const rigged: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === p1
          ? { ...p, hand: [plansId, energyId], deck: [...p.deck, ...p.hand].filter((id) => id !== plansId && id !== energyId) }
          : { ...p, hand: [mentalId], deck: [...p.deck, ...p.hand].filter((id) => id !== mentalId) },
      ),
    };
    const after = runWith(deps, rigged, { type: "playCard", playerId: p1, cardInstanceId: plansId, payment: [], attachToInstanceId: null });
    expect(threatOn(after, after.mainScheme.instanceId)).toBe(7);
    expect(mustPlayer(after, p1).discard).toContain(energyId);
    expect(mustPlayer(after, p2).discard).toContain(mentalId);
  });
});

test("scenario-flow mechanics replay to an identical state", () => {
  const shadow = stubAbility("shadow", def({
    trigger: { kind: "whenRevealed" },
    effects: [
      { kind: "selectCards", slot: "nm", cards: { kind: "setAside", player: you, filter: { categories: ["minion"] } } },
      { kind: "revealCard", cards: { kind: "slot", slot: "nm" }, player: you },
      { kind: "moveCards", cards: { kind: "setAside", player: you }, to: "encounterDeckShuffle" },
    ],
  }));
  const SHADOW = stubTreachery({ id: "shadow", boostIcons: 0, abilities: [shadow.ref] });
  const OBLIGATION = stubObligation({ id: "hero-obligation" });
  const { deps, state } = game({ cards: [SHADOW, OBLIGATION, ...NEMESIS], abilities: [shadow], encounter: [SHADOW.id, ...copies(BLANK.id, 10)] });
  let session: GameSession = startSession(stackEncounter(state, BLANK.id, SHADOW.id));
  const apply = (command: Command) => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  };
  apply(endTurn());
  while (session.state.pendingChoice) {
    const choice = session.state.pendingChoice;
    apply({ type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: decline(session.state) });
  }
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
});
