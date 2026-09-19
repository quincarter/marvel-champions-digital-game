/**
 * docs/phase7-wave2.md §6: the engine side of the schema pass for the packs after cycle 1. Discount and Requirement in
 * play pricing, the new attachment hosts, a three-sided villain's change of form, and the setup and deckbuilding gates
 * that keep campaign, competitive, evidence and separated-identity cards out of a standard game. Synthetic cards only.
 *
 * Sources: the Fear No Evil rulebook, "Featured Keywords" (p. 3) and FAQ (p. 26); RRG 1.8 "Requirement (Resources)"
 * (p. 37), "Cost" (p. 13), "Wild Resource" (p. 48), "Leader" (p. 26), "Attach To" (p. 8), "Flip" (p. 20), "First Player"
 * (p. 19); the Civil War rulebook (pp. 3, 6); the Agents of S.H.I.E.L.D. rulebook (p. 6); the SP//dr insert; ruling,
 * Jul 9, 2026 (3) answer 2.
 */

import {
  abilityId,
  cardId,
  encounterSetId,
  flat,
  trait,
  unerrataedText,
  type AnyCard,
  type CardId,
  type DeckContents,
  type EvidenceCard,
  type HeroIdentityCard,
  type KeywordInstance,
  type PlayerCard,
  type VillainCard,
} from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { playCostOf } from "./actions.js";
import type { Payment } from "./commands.js";
import { validateDeck } from "./deck.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeVillain, mustInstance, villainOf } from "./query.js";
import { attachmentHostCandidates } from "./resolve/index.js";
import type { EffectContext } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubIdentity, stubMainScheme, stubMinion, stubResource, stubSideScheme, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, fromHand, giveCards, HERO, newGame, settle, defaultPick, VILLAIN, MAIN_SCHEME } from "./testing/scenario.js";

const p1 = playerId("p1");
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const context = (deps: EngineDeps = { abilities: {} }): EffectContext => ({ selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps });
const abilities: StubAbility[] = [];
const actionEvent = (id: string, cost: number, effects: readonly EffectSpec[], keywords: readonly KeywordInstance[] = []): PlayerCard => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  abilities.push(ability);
  return { ...stubEvent({ id, cost, abilities: [ability.ref] }), keywords };
};

// ---- §6.2 Discount X (trait) -----------------------------------------------------------------------------------

const MARTIAL = trait("Martial Artist");
const FIGHTER: HeroIdentityCard = stubIdentity({
  id: "fighter",
  hp: 10,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroTraits: [MARTIAL],
});
const PHYS = stubResource({ id: "phys", icons: 0, produces: { physical: 1 } });
const MENT = stubResource({ id: "ment", icons: 0, produces: { mental: 1 } });
const KNOW = actionEvent("know-your-enemy", 2, [], [{ name: "discount", value: 1, traits: [MARTIAL] }]);
const LEGAL = actionEvent("legal-trouble", 2, [], [{ name: "discount", value: 1, traits: [trait("Attorney"), trait("Police")] }]);
const BINDING = actionEvent("web-binding", 2, [], [{ name: "requirement", resources: { mental: 1 } }]);
const RND = actionEvent("rnd-facility", 2, [], [{ name: "requirement", resources: { mental: 2 } }]);
const CHEAPEN = actionEvent("cheapen", 0, [{ kind: "reduceNextCardCost", player: { kind: "controller" }, amount: { kind: "const", value: 2 }, duration: "phase" }]);

const PLAYER_CARDS: readonly AnyCard[] = [PHYS, MENT, KNOW, LEGAL, BINDING, RND, CHEAPEN];
const deps: EngineDeps = depsOf(...abilities);

/** A game past setup with the fighter in hero form, holding what the test gives it. */
function pricedGame(identity: HeroIdentityCard = FIGHTER): GameState {
  const state = newGame({
    identity,
    deps,
    extraCards: [...PLAYER_CARDS, FIGHTER],
    deck: [...DEFAULT_DECK, ...PLAYER_CARDS.flatMap((card) => copies(card.id, 3))],
  });
  const changed = applyCommand(state, { type: "changeForm", playerId: p1 }, deps);
  if (!changed.ok) throw new Error(changed.error.message);
  return settle(changed.state, defaultPick, deps);
}
const play = (state: GameState, id: InstanceId, payment: readonly Payment[]) =>
  applyCommand(state, { type: "playCard", playerId: p1, cardInstanceId: id, payment, attachToInstanceId: null }, deps);

describe("§6.2 Discount X (trait): the Fear No Evil rulebook, p. 3", () => {
  it("costs X less when the identity has the trait, and lists the card itself as the reason", () => {
    const { state, ids: [know, legal] } = giveCards(pricedGame(), p1, KNOW.id, LEGAL.id);
    expect(playCostOf(state, p1, know!, deps)).toEqual({ printed: 2, current: 1, contributions: [{ sourceInstanceId: know, delta: -1 }], reduction: 0 });
    // "Attorney or Police": the fighter has neither.
    expect(playCostOf(state, p1, legal!, deps)?.current).toBe(2);
  });

  it("an identity without the trait pays full price, so one resource is not enough", () => {
    const { state, ids: [know, res] } = giveCards(pricedGame(HERO), p1, KNOW.id, PHYS.id);
    expect(playCostOf(state, p1, know!, deps)?.current).toBe(2);
    expect(play(state, know!, fromHand(res!)).ok).toBe(false);
    const { state: fighter, ids: [know2, res2] } = giveCards(pricedGame(), p1, KNOW.id, PHYS.id);
    expect(play(fighter, know2!, fromHand(res2!)).ok).toBe(true);
  });
});

describe("§6.1 Requirement (Resources): RRG 1.8 p. 37", () => {
  it("the named resources must be among those spent: two physical are refused, physical and mental are accepted", () => {
    const { state, ids: [binding, a, b, m] } = giveCards(pricedGame(), p1, BINDING.id, PHYS.id, PHYS.id, MENT.id);
    expect(play(state, binding!, fromHand(a!, b!)).ok).toBe(false);
    expect(play(state, binding!, fromHand(a!, m!)).ok).toBe(true);
  });

  it("a wild resource can be the required type (RRG 1.8 'Wild Resource', p. 48)", () => {
    const { state, ids: [binding, a] } = giveCards(pricedGame(), p1, BINDING.id, PHYS.id);
    const wild = state.players[0]!.hand.find((id) => state.instances[id]?.cardId === cardId("res")) as InstanceId;
    expect(play(state, binding!, fromHand(a!, wild)).ok).toBe(true);
  });

  it("a repeated icon needs that many: [mental][mental]", () => {
    const { state, ids: [rnd, m, p, m2] } = giveCards(pricedGame(), p1, RND.id, MENT.id, PHYS.id, MENT.id);
    expect(play(state, rnd!, fromHand(m!, p!)).ok).toBe(false);
    expect(play(state, rnd!, fromHand(m!, m2!)).ok).toBe(true);
  });

  it("a cost reduced below the required resources cannot be met, so the card cannot be played (docs/phase7-wave2.md §4.12)", () => {
    const { state, ids: [cheapen, binding, m] } = giveCards(pricedGame(), p1, CHEAPEN.id, BINDING.id, MENT.id);
    const cheapened = play(state, cheapen!, []);
    if (!cheapened.ok) throw new Error(cheapened.error.message);
    const reduced = settle(cheapened.state, defaultPick, deps);
    expect(playCostOf(reduced, p1, binding!, deps)?.current).toBe(0);
    expect(play(reduced, binding!, []).ok).toBe(false);
    expect(play(reduced, binding!, fromHand(m!)).ok).toBe(false);
  });
});

// ---- §6.3, §6.5–§6.8: attachment hosts --------------------------------------------------------------------------

const PERMANENT = stubSideScheme({ id: "choosing-sides", startingThreat: 3, keywords: [{ name: "permanent" }] });
const ORDINARY = stubSideScheme({ id: "ordinary-scheme", startingThreat: 3 });
const PLAIN = stubMinion({ id: "plain", atk: 1, sch: 1, hp: 3, boostIcons: 0, traits: [trait("Thug")] });
const TRAITED = stubMinion({ id: "traited", atk: 1, sch: 1, hp: 3, boostIcons: 0, traits: [trait("Thug"), trait("Mercenary"), trait("Elite")] });
const ordered = (id: string, order: number): VillainCard => ({ ...stubVillain({ id, stages: [{ hp: flat(10), atk: 1, sch: 1 }] }), activationOrder: order });
const SIX = [ordered("doc-ock", 1), ordered("vulture", 6), ordered("electro", 2)] as const;

function sixGame(): GameState {
  const config: GameSetupConfig = {
    seed: 7,
    cards: [...DEFAULT_CARDS, ...SIX, PERMANENT, ORDINARY, PLAIN, TRAITED],
    villainCardId: SIX[0].id,
    villains: SIX.map((villain) => ({ villainCardId: villain.id, encounterDeck: copies(PLAIN.id, 4) })),
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: [],
    includeIdentitySets: false,
    players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
  };
  const result = createGame(config);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

/** Test surgery: new faceup instances of these cards, schemes in the villain area and minions engaged with p1. */
function withInPlay(state: GameState, ...cards: readonly AnyCard[]): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  let next = state;
  const ids: InstanceId[] = [];
  for (const card of cards) {
    const id = `t${next.nextInstanceSeq}` as InstanceId;
    const minion = card.type === "minion";
    const instance = { ...mustInstance(next, next.players[0]!.identity.instanceId), instanceId: id, cardId: card.id, ownerId: null, controllerId: null, home: { kind: "activeEncounterDeck" } as const, engagedWith: minion ? p1 : null, attachments: [], damage: 0 };
    next = {
      ...next,
      nextInstanceSeq: next.nextInstanceSeq + 1,
      cardPool: { ...next.cardPool, [card.id]: card },
      instances: { ...next.instances, [id]: instance },
      villainArea: minion ? next.villainArea : [...next.villainArea, id],
      players: minion ? next.players.map((p) => (p.playerId === p1 ? { ...p, playArea: [...p.playArea, id] } : p)) : next.players,
    };
    ids.push(id);
  }
  return { state: next, ids };
}

describe("new attachment hosts (docs/phase7-wave2.md §6.3, §6.5–§6.8)", () => {
  it("'the villain who is not the active villain' is every other villain in play (Direct Assault)", () => {
    const state = sixGame();
    const [doc, vulture, electro] = state.villains.map((v) => v.instanceId);
    expect(activeVillain(state).instanceId).toBe(doc);
    expect(attachmentHostCandidates(state, { kind: "nonActiveVillain" }, context())).toEqual([vulture, electro]);
  });

  it("the highest and lowest activation order value (Heightened Morale, Team Leader)", () => {
    const state = sixGame();
    const [doc, vulture] = state.villains.map((v) => v.instanceId);
    expect(attachmentHostCandidates(state, { kind: "superlative", among: "villain", order: "highest", measure: "activationOrder" }, context())).toEqual([vulture]);
    expect(attachmentHostCandidates(state, { kind: "superlative", among: "villain", order: "lowest", measure: "activationOrder" }, context())).toEqual([doc]);
  });

  it("a villain with no printed activation order is no candidate", () => {
    const state = newGame();
    expect(attachmentHostCandidates(state, { kind: "superlative", among: "villain", order: "highest", measure: "activationOrder" }, context())).toEqual([]);
  });

  it("'the minion with the most traits' (Cyborg Tech)", () => {
    const { state, ids: [, traited] } = withInPlay(newGame(), PLAIN, TRAITED);
    expect(attachmentHostCandidates(state, { kind: "superlative", among: "minion", order: "highest", measure: "traitCount" }, context())).toEqual([traited]);
  });

  it("'a non-permanent side scheme' excludes a side scheme with the permanent keyword", () => {
    const { state, ids: [permanent, ordinary] } = withInPlay(newGame(), PERMANENT, ORDINARY);
    expect(attachmentHostCandidates(state, { kind: "sideScheme" }, context())).toEqual([permanent, ordinary]);
    expect(attachmentHostCandidates(state, { kind: "qualified", category: "sideScheme", withoutKeyword: "permanent" }, context())).toEqual([ordinary]);
    expect(attachmentHostCandidates(state, { kind: "qualified", category: "sideScheme", keyword: "permanent" }, context())).toEqual([permanent]);
  });

  it("'an enemy or scheme' is every host either part names, once each, in the order listed", () => {
    const { state, ids: [minion, scheme] } = withInPlay(newGame(), PLAIN, ORDINARY);
    const villain = activeVillain(state).instanceId;
    const host = { kind: "anyOf", hosts: [{ kind: "enemy" }, { kind: "scheme" }] } as const;
    expect(attachmentHostCandidates(state, host, context())).toEqual([villain, minion, state.mainScheme.instanceId, scheme]);
    const overlap = { kind: "anyOf", hosts: [{ kind: "enemy" }, { kind: "villain" }] } as const;
    expect(attachmentHostCandidates(state, overlap, context())).toEqual([villain, minion]);
  });

  it("'Greycrow or Harpoon' as an ifAble's preferred host falls back when neither is in play", () => {
    const state = newGame();
    const host = {
      kind: "ifAble",
      preferred: { kind: "anyOf", hosts: [{ kind: "namedCard", name: "Greycrow" }, { kind: "namedCard", name: "Harpoon" }] },
      otherwise: { kind: "villain" },
    } as const;
    expect(attachmentHostCandidates(state, host, context())).toEqual([activeVillain(state).instanceId]);
  });

  it("cooperative play: 'the enemy leader' is the villain, 'your leader' has no host (the Civil War rulebook, p. 6)", () => {
    const state = newGame();
    expect(attachmentHostCandidates(state, { kind: "leader", of: "enemy" }, context())).toEqual([activeVillain(state).instanceId]);
    expect(attachmentHostCandidates(state, { kind: "leader", of: "yours" }, context())).toEqual([]);
    // Tangled Up: "Attach to your leader. Otherwise, attach to your hero."
    const tangled = { kind: "ifAble", preferred: { kind: "leader", of: "yours" }, otherwise: { kind: "yourIdentity" } } as const;
    expect(attachmentHostCandidates(state, tangled, context())).toEqual([state.players[0]!.identity.instanceId]);
  });
});

// ---- §6.9 a three-sided villain ----------------------------------------------------------------------------------

const BIOMORPH = trait("Biomorph");
const CYBERPATH = trait("Cyberpath");
const GIANT = trait("Giant");
const faceStages = (form: typeof BIOMORPH) => [{ hp: flat(16), atk: 2, sch: 1, traits: [trait("Mutant"), form] }];
const APOCALYPSE: VillainCard = {
  ...stubVillain({ id: "apocalypse", stages: faceStages(BIOMORPH), back: { name: "Apocalypse", stages: faceStages(CYBERPATH) } }),
  sides: [
    { side: "A", name: "Apocalypse", stages: stubVillain({ id: "a", stages: faceStages(BIOMORPH) }).sides[0].stages },
    { side: "B", name: "Apocalypse", stages: stubVillain({ id: "b", stages: faceStages(CYBERPATH) }).sides[0].stages },
    { side: "C", name: "Apocalypse", stages: stubVillain({ id: "c", stages: faceStages(GIANT) }).sides[0].stages },
  ],
};
const TO_GIANT = actionEvent("staggering-strength", 0, [{ kind: "changeVillainForm", villain: { kind: "villain" }, toFaceWithTrait: GIANT }]);
const FLIP = actionEvent("flip-him", 0, [{ kind: "flipCard", target: { kind: "villain" } }]);
const formDeps: EngineDeps = depsOf(...abilities);

describe("§6.9 a three-sided villain changes to the face that has the named form (RRG 1.8 'Flip', p. 20)", () => {
  function apocalypseGame(): GameState {
    return newGame({ villain: APOCALYPSE, deps: formDeps, extraCards: [TO_GIANT, FLIP], deck: [...DEFAULT_DECK, TO_GIANT.id, FLIP.id] });
  }

  it("'change Apocalypse to [Giant] form' turns the Giant face up and is a flip", () => {
    const { state, ids: [event] } = giveCards(apocalypseGame(), p1, TO_GIANT.id);
    const result = applyCommand(state, { type: "playCard", playerId: p1, cardInstanceId: event!, payment: [], attachToInstanceId: null }, formDeps);
    if (!result.ok) throw new Error(result.error.message);
    const after = settle(result.state, defaultPick, formDeps);
    expect(villainOf(after, after.activeVillainId)?.side).toBe("C");
    expect(result.events).toContainEqual({ type: "villainFlipped", instanceId: after.activeVillainId, from: "A", to: "C" });
  });

  it("'flip' names no face of a three-sided villain, so it changes nothing", () => {
    const { state, ids: [event] } = giveCards(apocalypseGame(), p1, FLIP.id);
    const result = applyCommand(state, { type: "playCard", playerId: p1, cardInstanceId: event!, payment: [], attachToInstanceId: null }, formDeps);
    if (!result.ok) throw new Error(result.error.message);
    expect(villainOf(result.state, result.state.activeVillainId)?.side).toBe("A");
    expect(result.events.some((e) => e.type === "villainFlipped")).toBe(false);
  });

  it("setup can start on the C face", () => {
    const state = newGame({ villain: { ...APOCALYPSE, startingSide: "C" } });
    expect(activeVillain(state).side).toBe("C");
  });
});

// ---- Gates: evidence, separated identities, competitive cards ---------------------------------------------------

const EVIDENCE: EvidenceCard = {
  id: cardId("50186"),
  type: "evidence",
  name: "Wiretap",
  setCode: HERO.setCode,
  cycleId: HERO.cycleId,
  collectorNumber: "186",
  quantityInSet: 1,
  unique: false,
  evidence: "means",
  encounterSetIds: [encounterSetId("executive_board_evidence")],
  traits: [],
  text: unerrataedText("Setup: …"),
  abilities: [{ id: abilityId("50186.setup") }],
};
const SPDR: HeroIdentityCard = {
  ...stubIdentity({ id: "spdr", hp: 14, atk: 2, thw: 2, def: 2, rec: 4, heroHandSize: 3, alterEgoHandSize: 6 }),
  separatedIdentity: {
    alterEgoCardNumber: "2",
    heroCardOtherSide: { cardType: "support", name: "SP//dr Suit", traits: [], keywords: [{ name: "permanent" }], text: unerrataedText("x"), abilities: [] },
    alterEgoCardOtherSide: { cardType: "upgrade", name: "SP//dr", traits: [], keywords: [], text: unerrataedText("x"), abilities: [] },
  },
};
const FUTURIST: PlayerCard = { ...stubEvent({ id: "futurist", cost: 1 }), specificTo: { kind: "competitive", encounterSetId: encounterSetId("iron_man_leader") } };

describe("cards that cannot be used in a standard game are refused (docs/phase7-wave2.md §6.3, §6.4, §6.10)", () => {
  const base: GameSetupConfig = {
    seed: 1,
    cards: [...DEFAULT_CARDS, EVIDENCE, SPDR],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: [],
    includeIdentitySets: false,
    players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
  };

  it("an evidence card in the encounter deck or a player deck is refused at setup", () => {
    expect(createGame({ ...base, encounterDeck: [EVIDENCE.id] }).ok).toBe(false);
    expect(createGame({ ...base, players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, EVIDENCE.id] }] }).ok).toBe(false);
    expect(createGame(base).ok).toBe(true);
  });

  it("a separated identity cannot be seated, and its deck is reported unsupported", () => {
    const result = createGame({ ...base, players: [{ identityCardId: SPDR.id, deck: DEFAULT_DECK }] });
    expect(result.ok).toBe(false);
    const deck: DeckContents = { identityCardId: SPDR.id, aspects: ["justice"], cards: [] };
    const verdict = validateDeck(deck, [SPDR]);
    expect(verdict.ok ? [] : verdict.problems.map((p) => p.code)).toContain("unsupported_identity");
  });

  it("a competitive-mode card and an evidence card are refused in a decklist", () => {
    const deck: DeckContents = { identityCardId: HERO.id, aspects: ["justice"], cards: [{ cardId: FUTURIST.id, quantity: 1 }, { cardId: EVIDENCE.id, quantity: 1 }] };
    const verdict = validateDeck(deck, [HERO, FUTURIST, EVIDENCE]);
    const codes = verdict.ok ? [] : verdict.problems.map((p) => p.code);
    expect(codes).toContain("competitive_card");
    expect(codes).toContain("not_a_player_card");
  });
});
