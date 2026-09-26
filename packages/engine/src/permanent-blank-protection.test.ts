/**
 * docs/phase7-wave5.md §4.1 Q31: the Permanent keyword's blank protection. RRG 1.8 "Permanent" (p. 32): "A card with
 * the permanent keyword cannot [...] have any part of its text box blanked, except by card abilities in the same set
 * (hero set, scenario set, or modular set)", equivalent to "Effects on cards not from this card's set cannot [...] blank
 * any part of its text box."
 *
 * A card's set is read off card data (`select.ts` `permanentSetKeys`): the hero set (`aspect: "hero:<identity>"`, the
 * identity itself, its obligation and its nemesis set, §4.1 Q43), and an encounter card's `encounterSetIds` (scenario
 * and modular sets). Synthetic cards: permanent supports shaped like the SP//dr faces (hero set) and Milano (`gmw` 16142, a player card in no set),
 * a permanent side scheme shaped like Light at the End (`sm` 27102), and blanks shaped like Panic in the Streets (a
 * lasting "treat its printed text box as if it were blank") and Tech Theft (a constant rule).
 */

import { cardId, encounterSetId, heroAspect, trait, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import {
  activeAbilityRefs,
  blankedByConstantRules,
  permanentProtectsFrom,
  textBoxBlankFor,
  textBoxCannotBeBlanked,
} from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubObligation, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { HERO } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const TECH = trait("TECH");
const HERO_SET = heroAspect(HERO.id);
const PERMANENT = [{ name: "permanent" }] as const;
const constantRules = (rules: NonNullable<Extract<AbilityDefinition["trigger"], { kind: "constant" }>["rules"]>) =>
  ({ trigger: { kind: "constant", rules }, effects: [] }) satisfies AbilityDefinition;
const actionOf = (id: string) => stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: [] });

// Player cards in play. Each has an action, so `activeAbilityRefs` shows whether its text box is live.
const SUIT_ACTION = actionOf("suit");
/** Permanent, in the hero's set (the SP//dr faces' shape, without their own §3.31 line). */
const SUIT = {
  ...stubSupport({ id: "suit", cost: 0, traits: [TECH], keywords: PERMANENT, abilities: [SUIT_ACTION.ref] }),
  aspect: HERO_SET,
};
const SHIP_ACTION = actionOf("ship");
/** Permanent, in no hero, scenario or modular set (Milano's shape: `aspect: "none"`, no `specificTo`). */
const SHIP = {
  ...stubSupport({ id: "ship", cost: 0, traits: [TECH], keywords: PERMANENT, abilities: [SHIP_ACTION.ref] }),
  aspect: "none" as const,
};
const PLAIN_ACTION = actionOf("plain");
/** Not permanent, in the hero's set: the control. */
const PLAIN = {
  ...stubSupport({ id: "plain", cost: 0, traits: [TECH], abilities: [PLAIN_ACTION.ref] }),
  aspect: HERO_SET,
};

// "Until the end of the phase, treat the printed text box of each support as if it were blank."
const BLANK_EACH_SUPPORT: EffectSpec = {
  kind: "blankTextBox",
  target: { kind: "each", query: { categories: ["support"] } },
  until: "endOfPhase",
};
const HERO_BLANK_ABILITY = stubAbility("hero-blank.action", {
  trigger: { kind: "action" },
  effects: [BLANK_EACH_SUPPORT],
});
/** An event of the hero's own set. */
const HERO_BLANK = stubEvent({ id: "hero-blank", cost: 0, aspect: HERO_SET, abilities: [HERO_BLANK_ABILITY.ref] });
const BASIC_BLANK_ABILITY = stubAbility("basic-blank.action", {
  trigger: { kind: "action" },
  effects: [BLANK_EACH_SUPPORT],
});
/** A basic event: in no set, so never of a permanent card's set. */
const BASIC_BLANK = stubEvent({ id: "basic-blank", cost: 0, abilities: [BASIC_BLANK_ABILITY.ref] });

// Encounter side: a constant "each [Tech] support" blank (Tech Theft's shape) in the "thieves" modular set, and a
// permanent side scheme in the same set and one in another, each with an ability of its own to show it is live.
const THEFT_RULE = stubAbility(
  "theft.constant",
  constantRules([{ kind: "blankTextBox", target: { trait: TECH, categories: ["support"] } }]),
);
const THEFT = stubSideScheme({
  id: "theft",
  encounterSetIds: ["thieves"],
  startingThreat: 5,
  abilities: [THEFT_RULE.ref],
});
const SCHEME_BLANK_RULE = stubAbility(
  "scheme-blank.constant",
  constantRules([{ kind: "blankTextBox", target: { categories: ["sideScheme"] } }]),
);
const SCHEME_BLANK = stubSideScheme({
  id: "scheme-blank",
  encounterSetIds: ["thieves"],
  startingThreat: 5,
  abilities: [SCHEME_BLANK_RULE.ref],
});
const LIGHT_RULE = actionOf("light");
const HIDEOUT_RULE = actionOf("hideout");
/** Permanent, in the "thieves" set: blanked by its own set's rule. */
const LIGHT = stubSideScheme({
  id: "light",
  encounterSetIds: ["thieves"],
  startingThreat: 5,
  keywords: PERMANENT,
  abilities: [LIGHT_RULE.ref],
});
/** Permanent, in another set: not blanked by a "thieves" rule. */
const HIDEOUT = stubSideScheme({
  id: "hideout",
  encounterSetIds: ["hideout"],
  startingThreat: 5,
  keywords: PERMANENT,
  abilities: [HIDEOUT_RULE.ref],
});

// §3.31's own line on a card that is also permanent (the SP//dr faces as printed).
const UNBLANKABLE = stubAbility("spdr.constant", constantRules([{ kind: "textBoxCannotBeBlanked" }]));
const SPDR = {
  ...stubSupport({ id: "spdr", cost: 0, traits: [TECH], keywords: PERMANENT, abilities: [UNBLANKABLE.ref] }),
  aspect: HERO_SET,
};

// §4.1 Q43: a Tech Theft-shaped constant blank in the hero's nemesis set (the stub identity's `nemesisEncounterSetId`),
// one in another identity's nemesis set, and a permanent support of the second seat's hero set.
const RIVAL_ID = cardId(`${HERO.id}-p2`);
const RIVAL_NEMESIS = "rival-nemesis";
const NEMESIS_THEFT_RULE = stubAbility(
  "nemesis-theft.constant",
  constantRules([{ kind: "blankTextBox", target: { trait: TECH, categories: ["support"] } }]),
);
const NEMESIS_THEFT = stubSideScheme({
  id: "nemesis-theft",
  encounterSetIds: [String(HERO.nemesisEncounterSetId)],
  startingThreat: 5,
  abilities: [NEMESIS_THEFT_RULE.ref],
});
const RIVAL_THEFT_RULE = stubAbility(
  "rival-theft.constant",
  constantRules([{ kind: "blankTextBox", target: { trait: TECH, categories: ["support"] } }]),
);
const RIVAL_THEFT = stubSideScheme({
  id: "rival-theft",
  encounterSetIds: [RIVAL_NEMESIS],
  startingThreat: 5,
  abilities: [RIVAL_THEFT_RULE.ref],
});
const RIVAL_SUIT_ACTION = actionOf("rival-suit");
/** Permanent, in the second seat's hero set. */
const RIVAL_SUIT = {
  ...stubSupport({
    id: "rival-suit",
    cost: 0,
    traits: [TECH],
    keywords: PERMANENT,
    abilities: [RIVAL_SUIT_ACTION.ref],
  }),
  aspect: heroAspect(RIVAL_ID),
};

const OBLIGATION = stubObligation({ id: `${HERO.id}-obligation` });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  SUIT_ACTION,
  SHIP_ACTION,
  PLAIN_ACTION,
  HERO_BLANK_ABILITY,
  BASIC_BLANK_ABILITY,
  THEFT_RULE,
  SCHEME_BLANK_RULE,
  LIGHT_RULE,
  HIDEOUT_RULE,
  UNBLANKABLE,
  NEMESIS_THEFT_RULE,
  RIVAL_THEFT_RULE,
  RIVAL_SUIT_ACTION,
);
const CARDS: readonly AnyCard[] = [
  SUIT,
  SHIP,
  PLAIN,
  HERO_BLANK,
  BASIC_BLANK,
  THEFT,
  SCHEME_BLANK,
  LIGHT,
  HIDEOUT,
  SPDR,
  NEMESIS_THEFT,
  RIVAL_THEFT,
  RIVAL_SUIT,
  OBLIGATION,
  FILLER,
];

function start(players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    cards: CARDS,
    deps,
    players,
    deck: [SUIT.id, SHIP.id, PLAIN.id, SPDR.id, RIVAL_SUIT.id, HERO_BLANK.id, BASIC_BLANK.id],
    encounter: [
      THEFT.id,
      SCHEME_BLANK.id,
      LIGHT.id,
      HIDEOUT.id,
      NEMESIS_THEFT.id,
      RIVAL_THEFT.id,
      ...copiesOf(FILLER.id, 20),
    ],
  });
}

/**
 * Two seats: SUIT and PLAIN in P1's play area, RIVAL_SUIT in P2's. The second seat's identity is the first's copied
 * (`seatIdentities`), nemesis set included, so test surgery gives it a nemesis set of its own before any session.
 */
function twoHeroesInPlay(): {
  readonly state: GameState;
  readonly suit: InstanceId;
  readonly plain: InstanceId;
  readonly rivalSuit: InstanceId;
} {
  const base = start(2);
  const rival = base.cardPool[RIVAL_ID];
  if (rival?.type !== "hero_identity") throw new Error("no second identity");
  const surgery: GameState = {
    ...base,
    cardPool: { ...base.cardPool, [RIVAL_ID]: { ...rival, nemesisEncounterSetId: encounterSetId(RIVAL_NEMESIS) } },
  };
  const suit = playerCardIntoPlay(surgery, SUIT.id, P1);
  const plain = playerCardIntoPlay(suit.state, PLAIN.id, P1);
  const rivalSuit = playerCardIntoPlay(plain.state, RIVAL_SUIT.id, P2);
  return { state: rivalSuit.state, suit: suit.id, plain: plain.id, rivalSuit: rivalSuit.id };
}

/** SUIT, SHIP and PLAIN in play. */
function supportsInPlay(): {
  readonly state: GameState;
  readonly suit: InstanceId;
  readonly ship: InstanceId;
  readonly plain: InstanceId;
} {
  const suit = playerCardIntoPlay(start(), SUIT.id);
  const ship = playerCardIntoPlay(suit.state, SHIP.id);
  const plain = playerCardIntoPlay(ship.state, PLAIN.id);
  return { state: plain.state, suit: suit.id, ship: ship.id, plain: plain.id };
}

const refIds = (state: GameState, id: InstanceId) => activeAbilityRefs(state, id, deps).map((ref) => ref.id);

function expectReplays(session: ReturnType<typeof playFree>["session"]) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§4.1 Q31 the Permanent keyword's blank protection (RRG 1.8 'Permanent', p. 32)", () => {
  it("a lasting blank from another set (a basic event) leaves permanent cards live and blanks the rest; it records its source", () => {
    const { state, suit, ship, plain } = supportsInPlay();
    const { session, state: after } = playFree(state, deps, BASIC_BLANK.id);

    const blank = after.lastingEffects.find((effect) => effect.kind === "blankTextBox");
    expect(blank).toMatchObject({ targets: expect.arrayContaining([suit, ship, plain]), sourceCardId: BASIC_BLANK.id });

    // Permanent, other set: abilities and keywords stay.
    expect(textBoxBlankFor(after, suit, deps)).toBe(false);
    expect(refIds(after, suit)).toEqual([SUIT_ACTION.ref.id]);
    expect(hasKeyword(after, suit, "permanent", deps)).toBe(true);
    // A permanent card in no set is protected from everything but itself.
    expect(textBoxBlankFor(after, ship, deps)).toBe(false);
    expect(hasKeyword(after, ship, "permanent", deps)).toBe(true);
    // Not permanent: blanked as before.
    expect(textBoxBlankFor(after, plain, deps)).toBe(true);
    expect(refIds(after, plain)).toEqual([]);
    expectReplays(session);
  });

  it("a lasting blank from the same set (a hero-set event) blanks a permanent card, abilities and keywords alike", () => {
    const { state, suit, ship, plain } = supportsInPlay();
    const { session, state: after } = playFree(state, deps, HERO_BLANK.id);

    expect(textBoxBlankFor(after, suit, deps)).toBe(true);
    expect(refIds(after, suit)).toEqual([]);
    expect(hasKeyword(after, suit, "permanent", deps)).toBe(false);
    // SHIP is in no set, so the hero's set is not its set.
    expect(textBoxBlankFor(after, ship, deps)).toBe(false);
    expect(textBoxBlankFor(after, plain, deps)).toBe(true);
    expectReplays(session);
  });

  it("a constant blank rule from another set (Tech Theft) passes over permanent cards and still blanks the rest", () => {
    const { state: base, suit, ship, plain } = supportsInPlay();
    const { state } = encounterCardInVillainArea(base, THEFT.id, 5);

    expect([...blankedByConstantRules(state, deps)]).toEqual([plain]);
    expect(refIds(state, suit)).toEqual([SUIT_ACTION.ref.id]);
    expect(hasKeyword(state, suit, "permanent", deps)).toBe(true);
    expect(refIds(state, ship)).toEqual([SHIP_ACTION.ref.id]);
    expect(refIds(state, plain)).toEqual([]);
  });

  it("a constant blank rule reaches a permanent card of its own encounter set but not one of another set", () => {
    const blanker = encounterCardInVillainArea(start(), SCHEME_BLANK.id, 5);
    const light = encounterCardInVillainArea(blanker.state, LIGHT.id, 5);
    const hideout = encounterCardInVillainArea(light.state, HIDEOUT.id, 5);
    const state = hideout.state;

    expect([...blankedByConstantRules(state, deps)]).toEqual([light.id]);
    expect(refIds(state, light.id)).toEqual([]);
    expect(hasKeyword(state, light.id, "permanent", deps)).toBe(false);
    expect(refIds(state, hideout.id)).toEqual([HIDEOUT_RULE.ref.id]);
    expect(hasKeyword(state, hideout.id, "permanent", deps)).toBe(true);
  });

  it("the identity and its obligation are of the hero's set; a modular card and a basic card are not", () => {
    const { state, suit, ship } = supportsInPlay();
    const obligationId: CardId = OBLIGATION.id;
    expect(permanentProtectsFrom(state, suit, HERO.id)).toBe(false);
    expect(permanentProtectsFrom(state, suit, obligationId)).toBe(false);
    expect(permanentProtectsFrom(state, suit, HERO_BLANK.id)).toBe(false);
    expect(permanentProtectsFrom(state, suit, THEFT.id)).toBe(true);
    expect(permanentProtectsFrom(state, suit, BASIC_BLANK.id)).toBe(true);
    // A card is always of its own set.
    expect(permanentProtectsFrom(state, ship, SHIP.id)).toBe(false);
    expect(permanentProtectsFrom(state, ship, cardId("unknown-card"))).toBe(true);
  });

  it("a blank with no recorded source (an older save) still reaches a permanent card", () => {
    const { state, suit } = supportsInPlay();
    const blanked: GameState = {
      ...state,
      lastingEffects: [
        ...state.lastingEffects,
        { id: "old.blank", kind: "blankTextBox", targets: [suit], duration: { kind: "endOfPhase" } },
      ],
    };
    expect(textBoxBlankFor(blanked, suit, deps)).toBe(true);
  });

  it("§3.31's own line still protects a permanent card from its own set's blank", () => {
    const spdr = playerCardIntoPlay(start(), SPDR.id);
    const { session, state } = playFree(spdr.state, deps, HERO_BLANK.id);

    expect(textBoxCannotBeBlanked(state, spdr.id, deps)).toBe(true);
    expect(textBoxBlankFor(state, spdr.id, deps)).toBe(false);
    expect(refIds(state, spdr.id)).toEqual([UNBLANKABLE.ref.id]);
    expect(hasKeyword(state, spdr.id, "permanent", deps)).toBe(true);
    expectReplays(session);
  });
});

describe("§4.1 Q43 a hero's nemesis set is of that hero's set (FFG ruling June 25, 2026 (4) #1)", () => {
  it("a constant blank from the hero's nemesis set reaches that hero's permanent card", () => {
    const { state: base, suit, ship, plain } = supportsInPlay();
    const { state } = encounterCardInVillainArea(base, NEMESIS_THEFT.id, 5);

    expect([...blankedByConstantRules(state, deps)].sort()).toEqual([suit, plain].sort());
    expect(refIds(state, suit)).toEqual([]);
    expect(hasKeyword(state, suit, "permanent", deps)).toBe(false);
    // SHIP is in no hero set, so the nemesis set is not its set.
    expect(refIds(state, ship)).toEqual([SHIP_ACTION.ref.id]);
  });

  it("another hero's nemesis set blanks that hero's permanent card and not this one's", () => {
    const { state: base, suit, plain, rivalSuit } = twoHeroesInPlay();
    const { state } = encounterCardInVillainArea(base, RIVAL_THEFT.id, 5);

    expect([...blankedByConstantRules(state, deps)].sort()).toEqual([plain, rivalSuit].sort());
    expect(refIds(state, suit)).toEqual([SUIT_ACTION.ref.id]);
    expect(hasKeyword(state, suit, "permanent", deps)).toBe(true);
    expect(refIds(state, rivalSuit)).toEqual([]);

    // And P1's nemesis set is not P2's.
    const mine = encounterCardInVillainArea(base, NEMESIS_THEFT.id, 5).state;
    expect([...blankedByConstantRules(mine, deps)].sort()).toEqual([suit, plain].sort());
    expect(refIds(mine, rivalSuit)).toEqual([RIVAL_SUIT_ACTION.ref.id]);
  });

  it("the link is an identity in this game's nemesis set, not the card alone", () => {
    const { state, suit, rivalSuit } = twoHeroesInPlay();
    expect(permanentProtectsFrom(state, suit, NEMESIS_THEFT.id)).toBe(false);
    expect(permanentProtectsFrom(state, suit, RIVAL_THEFT.id)).toBe(true);
    expect(permanentProtectsFrom(state, rivalSuit, RIVAL_THEFT.id)).toBe(false);
    expect(permanentProtectsFrom(state, rivalSuit, NEMESIS_THEFT.id)).toBe(true);
    // One seat, no rival: a card of the rival's nemesis set is only its own encounter set.
    const { state: solo, suit: soloSuit } = supportsInPlay();
    expect(permanentProtectsFrom(solo, soloSuit, RIVAL_THEFT.id)).toBe(true);
  });

  it("a lasting blank from a hero-set event, in a two-hero game, replays deep-equal", () => {
    const { state, suit, rivalSuit } = twoHeroesInPlay();
    const { session, state: after } = playFree(state, deps, HERO_BLANK.id);
    expect(textBoxBlankFor(after, suit, deps)).toBe(true);
    // P1's hero set is not P2's.
    expect(textBoxBlankFor(after, rivalSuit, deps)).toBe(false);
    expectReplays(session);
  });
});
