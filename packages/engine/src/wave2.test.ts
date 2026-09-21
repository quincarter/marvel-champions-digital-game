/**
 * docs/phase7-wave2.md: the engine changes cycle 1 card shapes need before their data can be judged or seated.
 * Deck legality for Spider-Woman's two aspects and her aspect-coloured signature cards, scenario- and
 * campaign-specific player cards, Team-Up with a three-sided identity, ability coverage across every face, the
 * `printedAspect` query, obligation copies at setup, and the `ifAble` attachment host. Synthetic cards only.
 *
 * Sources: RRG 1.8 Appendix I (p. 50), "Identity-Specific Card" (p. 23), "Classifications" (p. 12), "Campaign-Specific
 * Card" (p. 11), "Team-Up" (p. 43), "Obligation" (p. 30), "Attach To" (p. 8); FAQ "Jessica Drew (#31B)" (p. 60) and
 * "Slipping Sanity (#23)" (p. 61); the Red Skull rulebook, p. 18 (Spider-Woman's starter deck); the Ant-Man insert.
 */

import {
  abilityId,
  cardId,
  encounterSetId,
  flat,
  trait,
  unerrataedText,
  type AbilityReference,
  type AnyCard,
  type CoreAspect,
  type DeckContents,
  type EventCard,
  type HeroIdentityCard,
  type PlayerCard,
} from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, AbilityRegistry, EngineDeps } from "./abilities.js";
import { DEFAULT_DEPS } from "./abilities.js";
import { abilityRefsOf, unscriptedCards, validateDeck, type DeckProblemCode } from "./deck.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck } from "./query.js";
import { attachmentHostCandidates } from "./resolve/index.js";
import { matchesQuery, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import {
  stubAttachment,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubObligation,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, newGameAtMulligan } from "./testing/scenario.js";

const p1 = playerId("p1");
const ref = (id: string): AbilityReference => ({ id: abilityId(id) });

// ---- Spider-Woman: two aspects, and signature cards that also print an aspect -------------------------------

const SW = "sw";
const spiderWoman: HeroIdentityCard = {
  ...stubIdentity({
    id: SW,
    name: "Spider-Woman",
    hp: 11,
    atk: 1,
    thw: 1,
    def: 1,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
  }),
  deckbuilding: { aspectCount: 2, equalCardsPerAspect: true },
};
const signature = (id: string, quantity: number, printedAspect?: CoreAspect): EventCard => ({
  ...stubEvent({ id, cost: 1, aspect: `hero:${SW}` }),
  quantityInSet: quantity,
  ...(printedAspect ? { printedAspect } : {}),
});
/** 15 signature cards, as the printed precon has (Red Skull rulebook, p. 18). */
const SIGNATURE: readonly EventCard[] = [
  signature("venom-blast", 2, "aggression"),
  signature("pheromones", 2, "leadership"),
  signature("contaminant-immunity", 2, "protection"),
  signature("inconspicuous", 2, "justice"),
  signature("glide", 3),
  signature("finesse", 2),
  signature("apartment", 1),
  signature("captain-marvel", 1),
];
const aspectCards = (aspect: CoreAspect, n: number): readonly EventCard[] =>
  Array.from({ length: n }, (_, i) => stubEvent({ id: `${aspect}-${i}`, cost: 1, aspect }));
const AGGRESSION = aspectCards("aggression", 5);
const JUSTICE = aspectCards("justice", 5);
const SW_POOL: readonly AnyCard[] = [spiderWoman, ...SIGNATURE, ...AGGRESSION, ...JUSTICE];

/** The signature set plus `aggression` Aggression and `justice` Justice cards (3 copies per title, then the rest). */
function swDeck(
  aggression: number,
  justice: number,
  aspects: readonly CoreAspect[] = ["aggression", "justice"],
): DeckContents {
  const take = (cards: readonly EventCard[], n: number) =>
    cards.flatMap((card, i) => {
      const quantity = Math.max(0, Math.min(3, n - 3 * i));
      return quantity > 0 ? [{ cardId: card.id, quantity }] : [];
    });
  return {
    identityCardId: spiderWoman.id,
    aspects,
    cards: [
      ...SIGNATURE.map((card) => ({ cardId: card.id, quantity: card.quantityInSet })),
      ...take(AGGRESSION, aggression),
      ...take(JUSTICE, justice),
    ],
  };
}
const codes = (deck: DeckContents, pool: readonly AnyCard[]): readonly DeckProblemCode[] => {
  const verdict = validateDeck(deck, pool);
  return verdict.ok ? [] : verdict.problems.map((problem) => problem.code);
};

describe("Spider-Woman's Double Agent (FAQ 'Jessica Drew (#31B)', p. 60)", () => {
  it("15 signature cards plus an equal number of Aggression and Justice cards is legal, an unequal split is not", () => {
    // The printed precon is 15 + 11 + 11 plus 3 basic resources; 13 + 13 reaches 40 without basics.
    expect(codes(swDeck(13, 12), SW_POOL)).toEqual(["deckbuilding_requirement"]);
    expect(codes(swDeck(13, 13), SW_POOL)).toEqual([]);
  });

  it("signature cards that print an aspect are identity-specific: required, never off-aspect, not in the equal count", () => {
    // Pheromones (Leadership) and Contaminant Immunity (Protection) sit in an Aggression/Justice deck without an
    // aspect_restriction. The implementation leaves them out of the equal split. Counting them instead can never change
    // a verdict for her real set, which prints 2 copies in each of the four aspects, so any two chosen aspects gain 2
    // each (docs/phase7-wave2.md §1.2).
    const verdict = validateDeck(swDeck(13, 13), SW_POOL);
    expect(verdict.ok).toBe(true);
    const withoutVenom = {
      ...swDeck(13, 13),
      cards: swDeck(13, 13).cards.filter((e) => e.cardId !== cardId("venom-blast")),
    };
    expect(codes(withoutVenom, SW_POOL)).toContain("identity_set_mismatch");
  });

  it("choosing one aspect is illegal for her", () => {
    expect(codes(swDeck(26, 0, ["aggression"]), SW_POOL)).toContain("aspect_choice");
  });
});

// ---- Scenario- and campaign-specific player cards --------------------------------------------------------------

describe("scenario- and campaign-specific player cards (RRG 1.8 'Classifications', p. 12)", () => {
  const captive: PlayerCard = {
    ...stubEvent({ id: "captive", cost: 0 }),
    aspect: "none",
    specificTo: { kind: "scenario", encounterSetId: encounterSetId("taskmaster") },
  };
  const campaignUpgrade: PlayerCard = {
    ...stubEvent({ id: "campaign-upgrade", cost: 0 }),
    specificTo: { kind: "campaign", encounterSetId: encounterSetId("hydra_camp") },
  };
  const pool = [...SW_POOL, captive, campaignUpgrade];
  const legal = swDeck(13, 13);

  it("a campaign card is refused outside a campaign, and is not counted toward deck size", () => {
    const deck = { ...legal, cards: [...legal.cards, { cardId: campaignUpgrade.id, quantity: 1 }] };
    expect(codes(deck, pool)).toEqual(["campaign_card"]);
  });

  it("a scenario-specific card (a Captive ally) is refused", () => {
    const deck = { ...legal, cards: [...legal.cards, { cardId: captive.id, quantity: 1 }] };
    expect(codes(deck, pool)).toEqual(["scenario_card"]);
  });
});

// ---- Three-sided identities ----------------------------------------------------------------------------------------

const giantFace = {
  ...HERO.hero,
  faceName: "Giant Guy",
  traits: [trait("Giant")],
  abilities: [ref("tri.giant-response")],
};
const threeSided: HeroIdentityCard = {
  ...stubIdentity({
    id: "tri",
    name: "Tiny Guy",
    hp: 12,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroAbilities: [ref("tri.tiny-response")],
  }),
  additionalHeroForms: [giantFace],
};

describe("three-sided identities (Ant-Man insert, 'Foldable Cards')", () => {
  it("Team-Up checks every hero face's title (RRG 1.8 'Team-Up', p. 43)", () => {
    const teamUp: PlayerCard = {
      ...stubEvent({ id: "team-up", cost: 1 }),
      keywords: [{ name: "teamUp", names: ["Giant Guy", "Somebody Else"] }],
    };
    const filler = aspectCards("leadership", 14);
    const deck: DeckContents = {
      identityCardId: threeSided.id,
      aspects: ["leadership"],
      cards: [{ cardId: teamUp.id, quantity: 1 }, ...filler.map((card) => ({ cardId: card.id, quantity: 3 }))],
    };
    expect(codes(deck, [threeSided, teamUp, ...filler])).not.toContain("team_up_identity");
    const stranger: PlayerCard = { ...teamUp, keywords: [{ name: "teamUp", names: ["Nobody", "Somebody Else"] }] };
    expect(codes(deck, [threeSided, stranger, ...filler])).toContain("team_up_identity");
  });

  it("an unscripted ability on the extra hero form makes the identity unscripted", () => {
    expect(abilityRefsOf(threeSided).map((r) => r.id)).toEqual(["tri.tiny-response", "tri.giant-response"]);
    const partial: AbilityRegistry = { [abilityId("tri.tiny-response")]: {} as AbilityDefinition };
    const deps: EngineDeps = { ...DEFAULT_DEPS, abilities: partial };
    const deck: DeckContents = { identityCardId: threeSided.id, aspects: ["leadership"], cards: [] };
    expect(unscriptedCards(deck, [threeSided], deps)).toEqual([threeSided.id]);
  });

  it("the other face of a double-sided card counts toward its abilities", () => {
    const flip: PlayerCard = {
      ...stubEvent({ id: "basic-upgrade", cost: 0, abilities: [ref("basic-upgrade.a")] }),
      flipSide: {
        name: "Improved Upgrade",
        traits: [],
        keywords: [],
        text: unerrataedText("x"),
        abilities: [ref("basic-upgrade.b")],
      },
    };
    expect(abilityRefsOf(flip).map((r) => r.id)).toEqual(["basic-upgrade.a", "basic-upgrade.b"]);
  });
});

// ---- `printedAspect` in card effects -----------------------------------------------------------------------------

describe("an identity-specific card that prints an aspect is that aspect's card for card effects", () => {
  it("TargetQuery.aspect matches printedAspect as well as aspect", () => {
    const venom = signature("venom-blast", 1, "aggression");
    const state = newGameAtMulligan({ extraCards: [venom], deck: [...DEFAULT_DECK, venom.id] });
    const id = Object.values(state.instances).find((i) => i.cardId === venom.id)?.instanceId as InstanceId;
    const context: EffectContext = {
      selfInstanceId: null,
      controllerId: p1,
      event: null,
      bindings: {},
      deps: DEFAULT_DEPS,
    };
    expect(matchesQuery(state, id, { aspect: "aggression" }, context)).toBe(true);
    expect(matchesQuery(state, id, { aspect: "justice" }, context)).toBe(false);
    expect(matchesQuery(state, id, { aspect: `hero:${SW}` }, context)).toBe(true);
  });
});

// ---- Setup: every copy of an identity's obligation ------------------------------------------------------------

describe("setup shuffles every copy of the identity's obligation (RRG 1.8 'Obligation', p. 30)", () => {
  const countIn = (state: GameState, id: string): number =>
    activeEncounterDeck(state).deck.filter((instance) => state.instances[instance]?.cardId === cardId(id)).length;

  it("two copies for a set that holds two (Slipping Sanity), one otherwise", () => {
    const one = stubObligation({ id: `${HERO.id}-obligation` });
    expect(countIn(newGameAtMulligan({ extraCards: [one] }), one.id)).toBe(1);
    expect(countIn(newGameAtMulligan({ extraCards: [{ ...one, quantityInSet: 2 }] }), one.id)).toBe(2);
  });
});

// ---- The `ifAble` attachment host --------------------------------------------------------------------------------

describe("'Attach to Yellowjacket, if able. If you cannot, attach to the villain.' (docs/phase7-wave2.md §1.7)", () => {
  const VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(50), atk: 0, sch: 0 }] });
  const SCHEME = stubMainScheme({
    id: "long",
    stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
  });
  const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
  const YELLOWJACKET = stubMinion({ id: "Yellowjacket", atk: 0, sch: 0, hp: 4, boostIcons: 0 });
  const SIZE = stubAttachment({
    id: "size-increase",
    attachesTo: {
      kind: "ifAble",
      preferred: { kind: "namedCard", name: "Yellowjacket" },
      otherwise: { kind: "villain" },
    },
  });

  function game(): GameState {
    const result = createGame({
      seed: 3,
      cards: [...DEFAULT_CARDS, VILLAIN, SCHEME, BLANK, YELLOWJACKET, SIZE],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [YELLOWJACKET.id, ...Array.from({ length: 10 }, () => BLANK.id)],
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
    });
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  }
  const context: EffectContext = {
    selfInstanceId: null,
    controllerId: p1,
    event: null,
    bindings: {},
    deps: DEFAULT_DEPS,
  };
  const host = SIZE.attachesTo;

  it("falls back to the villain when the preferred host is not in play", () => {
    const state = game();
    expect(attachmentHostCandidates(state, host, context)).toEqual([state.activeVillainId]);
  });

  it("takes the preferred host when it is in play", () => {
    const start = game();
    const deck = activeEncounterDeck(start).deck;
    const jacket = deck.find((id) => start.instances[id]?.cardId === YELLOWJACKET.id) as InstanceId;
    const deckId = Object.keys(start.encounterDecks)[0] as string;
    const state: GameState = {
      ...start,
      encounterDecks: {
        ...start.encounterDecks,
        [deckId]: { ...activeEncounterDeck(start), deck: deck.filter((id) => id !== jacket) },
      },
      players: start.players.map((p) => ({ ...p, playArea: [...p.playArea, jacket] })),
      instances: {
        ...start.instances,
        [jacket]: {
          ...(start.instances[jacket] as NonNullable<GameState["instances"][string]>),
          faceup: true,
          engagedWith: p1,
        },
      },
    };
    expect(attachmentHostCandidates(state, host, context)).toEqual([jacket]);
  });
});
