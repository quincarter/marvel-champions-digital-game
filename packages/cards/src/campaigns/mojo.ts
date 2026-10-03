/**
 * MojoMania — the sixth `CampaignDefinition` (after `trors.ts`, `gmw.ts`, `mts.ts`, `sm.ts`, `mut_gen.ts`), and the first
 * box with no campaign-specific cards: three scenarios (MaGog, Spiral, Mojo) played in order, a card carried from one
 * to the next, and Longshot.
 *
 * Source of truth: the MojoMania insert ("insert p. N", Hall of Heroes' scan of the rulebook,
 * https://hallofheroeslcg.com/wp-content/uploads/2022/11/mojomania-insert.pdf): the campaign rules are pp. 4-5, the
 * three scenarios' Campaign Instructions pp. 9, 13-14 and 17. The campaign log is the back cover, which the scan does
 * not include, so the log fields below are read off the instructions that name them, not off the printed sheet.
 * Also `docs/phase7-wave6.md` §3.72, §4.1 (Q33, Q41-Q43) and ruling April 30, 2026 (3) #1.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * MODELING
 *
 * - **Loss** (insert p. 4): "they may reset the scenario and try again with no penalty": `retry: "free"`, no DEFEAT
 *   block, and the log is restored to the node's start (`retryBaseline`), so a lost game checks off nothing.
 * - **Modular sets** (insert pp. 9, 13, 17). The campaign decides *which* sets a scenario uses, because the printed
 *   restriction ("You cannot choose to use modular encounter sets that are checked off") is a rule about the choice, and
 *   the choice is what the log can see. `modularSets` is a `strikeList` of the six genre sets, a struck option being a
 *   checked-off box; `modularPicked` is the working list a setup writes its picks to, in the order they were made, which
 *   the game builder reads (`mojoModularSetPicks`) and Victory checks off. Scenario 1 (no printed bullet; one set,
 *   "1 random genre set recommended", insert p. 7) offers the six sets; scenario 2 picks 3 unchecked ones; scenario 3
 *   picks 1 + one per player ("If there are not enough sets remaining, you may choose checked-off sets once all
 *   others are chosen"): each pick offers an unchecked set while one is left, and only then a checked-off one.
 * - **Longshot** (insert pp. 2, 9, 13-14, 17). Composed set aside at every node. Scenario 1 shuffles him in; Victory
 *   records `longshotInPlay` (by printed id: the wolv hero pack has an ally named Longshot too). Scenarios 2 and 3: if
 *   he was in play, one player (any seat, chosen by the players) may reveal him (ruling Apr 30, 2026 (3) #1: his When
 *   Revealed resolves); otherwise, or if they decline, he is shuffled into the encounter deck (owner, 2026-10-03).
 * - **Working fields** are per-seat and so cannot be `hidden` (the log keeps one hidden value per field, not one per seat).
 * - **The recorded card** (insert pp. 9, 14, 13, 17). Victory of scenarios 1 and 2 asks each player which support or
 *   upgrade they control costing at most 2 (3 when The Champion is on its BOOING CROWD side, scenario 1; when there is
 *   less than 10 per player threat on the main scheme, scenario 2) to record, never one with a dash cost. The game's
 *   facts are written to per-seat working fields by `record` instructions, and the player's choice is a between-games
 *   `choose` over them: the in-play cards of that seat within the cap, less the cards printing a dash. The pick is
 *   appended to `recordedCards`. Scenarios 2 and 3 put each recorded card into play from any player's deck, then add
 *   threat to the main scheme equal to the total cost.
 * - **Expert campaign** (insert p. 5): remaining hit points are recorded after a win (capped at base) and restored at
 *   the next setup; the heal is dealing yourself one facedown encounter card, and a defeated player (recorded hit
 *   points 0) must take it to rejoin (the token of `mts.ts`/`mut_gen.ts`, docs/phase7-wave6.md §4.1 Q11, here a card).
 *
 * ---------------------------------------------------------------------------------------------------------------
 * NOT AUTHORED (each a recorded question, see the handoff): the insert's own words are ambiguous in four places, each
 * built as the most literal reading (Longshot's two were decided by the owner on 2026-10-03: a declined Longshot is
 * shuffled in, and any seat may reveal him): an X-cost card is not a "—" cost and may be recorded; a cost is the printed cost.
 */

import {
  DATA_ONLY_CARDS,
  PLAYABLE_CARDS,
  campaignId,
  cardId,
  encounterSetId,
  scenarioId,
  trait,
  type CardId,
} from "@mc/content";
import {
  DEFAULT_CAMPAIGN_WINDOW,
  type CampaignDefinition,
  type CampaignGameQuery,
  type CampaignInstruction,
  type CampaignLog,
  type CampaignOp,
  type CampaignPredicate,
  type CampaignValue,
  type CampaignChoiceSource,
} from "@mc/engine";
import {
  campaignLogAtLeast,
  campaignLogCards,
  campaignLogIsSet,
  chooseCards,
  chooseOneBy,
  chosen,
  damageOn,
  dealEncounterCard,
  eachPlayer,
  encounterSetAside,
  chosenPlayer,
  choosePlayer,
  firstPlayer,
  forEachPlayer,
  heal,
  identityOf,
  ifThen,
  moveCards,
  option,
  placeThreat,
  putIntoPlay,
  revealSetAside,
  setRemainingHitPoints,
  theMainScheme,
  thatPlayer,
  totalPrintedCost,
  campaignLogValue,
} from "../dsl/index.js";

const MOJO_ID = campaignId("mojo");

// ---------------------------------------------------------------------------------------------------------------
// Sets, cards and constants
// ---------------------------------------------------------------------------------------------------------------

/** Insert p. 2: the six genre sets, "used in any scenario"; the ids of `MOJO_ENCOUNTER_SETS`. */
export const MOJO_GENRE_SETS = ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"] as const;

/** Insert p. 2: the one-card modular set. */
const LONGSHOT_SET = encounterSetId("longshot");
/** The MojoMania Longshot ally (39071); the wolv pack's hero ally of the same name is a different card. */
const LONGSHOT: CardId = cardId("39071");
const BOOING_CROWD = trait("BOOING CROWD");

/**
 * Support and upgrade cards that print a dash for their cost ("Players cannot choose cards without a cost (i.e. that
 * have a cost of '—')", insert pp. 9 and 14). The content record emits a dash as cost 0 with `specialCost: "dash"`, which
 * a cost ceiling cannot tell from a free card, so they are listed from the pool and taken out of the offered cards.
 */
const DASH_COST_IDS: readonly CardId[] = [...PLAYABLE_CARDS, ...DATA_ONLY_CARDS]
  .filter(
    (card) =>
      (card.type === "support" || card.type === "upgrade") && "specialCost" in card && card.specialCost === "dash",
  )
  .map((card) => card.id);

const constant = (value: number | string | boolean): CampaignValue => ({ kind: "const", value });
const field = (id: string): CampaignValue => ({ kind: "field", field: id });
const seatField = (id: string): CampaignValue => ({ kind: "field", field: id, seat: "self" });
const choiceOf = (slot: string): CampaignValue => ({ kind: "choice", slot });
const count = (id: string): CampaignValue => ({ kind: "count", field: id });

const flagSet = (id: string): CampaignPredicate => ({ kind: "fieldIsSet", field: id });
const not = (of: CampaignPredicate): CampaignPredicate => ({ kind: "not", of });

// ---------------------------------------------------------------------------------------------------------------
// Longshot (insert pp. 2, 9, 13, 17)
// ---------------------------------------------------------------------------------------------------------------

/** Not printed: makes Longshot available to this scenario's setup as a set-aside card (`mut_gen.ts`'s precedent). */
function composeLongshot(prefix: string, citation: string): CampaignInstruction {
  return {
    id: `${prefix}.composition.longshot`,
    text: "(Not printed: sets the Longshot ally aside, to be shuffled in or revealed by the setup instruction that names him.)",
    citation,
    step: {
      kind: "betweenGames",
      ops: [{ kind: "composeEncounterSets", sets: [constant(LONGSHOT_SET)], into: "setAside" }],
    },
  };
}

/** Insert p. 9: "Shuffle the Longshot ally (71) into the encounter deck." */
const shuffleLongshotIn = (id: string, citation: string): CampaignInstruction => ({
  id,
  text: "Shuffle the Longshot ally (71) into the encounter deck.",
  citation,
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [moveCards(encounterSetAside({ printedId: LONGSHOT }), "encounterDeckShuffle")],
  },
});

/**
 * Insert pp. 13 and 17: "If the Longshot ally (71) was in play at the end of the last scenario, one player may reveal
 * him. Otherwise, shuffle him into the encounter deck." Revealing him resolves his When Revealed (ruling Apr 30, 2026
 * (3) #1): `revealSetAside`. The "one player" is any seat the players choose (Q69); declining shuffles him in (Q68).
 */
const revealOrShuffleLongshot = (id: string, citation: string): CampaignInstruction => ({
  id,
  text: "If the Longshot ally (71) was in play at the end of the last scenario, one player may reveal him. Otherwise, shuffle him into the encounter deck.",
  citation,
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [
      ifThen(
        campaignLogIsSet("longshotInPlay", true),
        chooseOneBy(
          firstPlayer,
          // Q69 (owner, 2026-10-03): the players pick the seat that reveals (and so controls) him.
          option(
            "Reveal Longshot",
            choosePlayer("revealer", firstPlayer),
            revealSetAside({ printedId: LONGSHOT }, chosenPlayer("revealer")),
          ),
          // Q68 (owner, 2026-10-03): declining never leaves him out of the scenario; he is shuffled in.
          option("Decline", moveCards(encounterSetAside({ printedId: LONGSHOT }), "encounterDeckShuffle")),
        ),
        moveCards(encounterSetAside({ printedId: LONGSHOT }), "encounterDeckShuffle"),
      ),
    ],
  },
});

/** Insert pp. 9 and 14: "Record in the campaign log whether the Longshot ally (71) is in play." */
const longshotRecord = (id: string, citation: string): CampaignInstruction => ({
  id,
  text: "Record in the campaign log whether the Longshot ally (71) is in play.",
  citation,
  step: {
    kind: "record",
    writes: [
      {
        field: "longshotInPlay",
        mode: "set",
        value: { kind: "atLeast", of: { kind: "cardsInPlay", query: { printedId: LONGSHOT } }, amount: 1 },
      },
    ],
  },
});

// ---------------------------------------------------------------------------------------------------------------
// Modular sets (insert pp. 7, 9, 13, 17)
// ---------------------------------------------------------------------------------------------------------------

const UNCHECKED: CampaignChoiceSource = { kind: "fieldOptions", field: "modularSets", unstruckOnly: true };
const ALL_SETS: CampaignChoiceSource = { kind: "fieldOptions", field: "modularSets" };
/** A source minus the sets already picked for this scenario (excluded by exact id: they are option strings). */
const lessPicked = (from: CampaignChoiceSource): CampaignChoiceSource => ({
  kind: "excludingTitles",
  from,
  titlesIn: field("modularPicked"),
});

/** One pick: the group chooses a set from `from` and the pick is appended to `modularPicked` (and `modularFresh`). */
const pick = (slot: string, from: CampaignChoiceSource, fresh: boolean): readonly CampaignOp[] => [
  { kind: "choose", slot, chooser: "group", from: lessPicked(from) },
  { kind: "appendToList", field: "modularPicked", value: choiceOf(slot) },
  ...(fresh ? [{ kind: "appendToList" as const, field: "modularFresh", value: choiceOf(slot) }] : []),
];

const clearWorking: readonly CampaignOp[] = [
  { kind: "clearField", field: "modularPicked" },
  { kind: "clearField", field: "modularFresh" },
];

/**
 * Scenario 1 (not printed: insert p. 7's "1 modular set (1 random genre set recommended)"): one genre set, any of the
 * six since none is checked off yet.
 */
function modularSetsFirst(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "(Not printed: choose the scenario's 1 modular set from the six genre sets; the checked-off sets begin empty.)",
    citation,
    step: { kind: "betweenGames", ops: [...clearWorking, ...pick("set1", UNCHECKED, true)] },
  };
}

/** Insert p. 13: "You cannot choose to use modular encounter sets that are checked off in the campaign log." */
function modularSetsSecond(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "You cannot choose to use modular encounter sets that are checked off in the campaign log.",
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        ...clearWorking,
        ...pick("set1", UNCHECKED, true),
        ...pick("set2", UNCHECKED, true),
        ...pick("set3", UNCHECKED, true),
      ],
    },
  };
}

/**
 * "1 + 1[per_hero]" sets are picked (insert p. 16: "Choose 1 modular set, plus 1[per_hero] additional modular sets"),
 * so pick `i` runs when `i <= 1 + seats`. Each pick offers an unchecked set while one remains (`6 - checked - fresh
 * picks >= 1`), and only then a checked-off one: insert p. 17, "If there are not enough sets remaining, you may choose
 * checked-off sets once all others are chosen."
 */
function modularSetsThird(id: string, citation: string): CampaignInstruction {
  const uncheckedLeft: CampaignPredicate = {
    kind: "valueAtLeast",
    value: { kind: "difference", of: [constant(MOJO_GENRE_SETS.length), count("modularSets"), count("modularFresh")] },
    amount: constant(1),
  };
  const slots = [1, 2, 3, 4, 5].map((n): CampaignOp => ({
    kind: "if",
    // Pick 1 is unconditional; pick n is one per seat after it.
    when:
      n === 1
        ? { kind: "valueAtLeast", value: constant(1), amount: constant(1) }
        : { kind: "valueAtLeast", value: { kind: "seatCount" }, amount: constant(n - 1) },
    then: [
      {
        kind: "if",
        when: uncheckedLeft,
        then: pick(`set${n}`, UNCHECKED, true),
        else: pick(`checked${n}`, ALL_SETS, false),
      },
    ],
  }));
  return {
    id,
    text: "You cannot choose to use modular encounter sets that are checked off in the campaign log. If there are not enough sets remaining, you may choose checked-off sets once all others are chosen.",
    citation,
    step: { kind: "betweenGames", ops: [...clearWorking, ...slots] },
  };
}

/** Insert pp. 9 and 14: "Check off the name of the modular encounter set used in this scenario in the campaign log." */
const checkOffSets = (id: string, citation: string, plural: boolean): CampaignInstruction => ({
  id,
  text: plural
    ? "Check off the name of each modular encounter set used in this scenario in the campaign log."
    : "Check off the name of the modular encounter set used in this scenario in the campaign log.",
  citation,
  step: { kind: "betweenGames", ops: [{ kind: "strike", field: "modularSets", option: field("modularPicked") }] },
});

/**
 * The modular sets a composed log chose for the node about to be played, in the order picked: what the game builder
 * hands `wave6Scenario` (`modularSetIds`; for Mojo's scenario `setAsideModularSetIds`, the first being the one that
 * Mojo 1B brings in). The campaign decides them (`modularSetsSecond`/`modularSetsThird`), the builder does not.
 */
export function mojoModularSetPicks(log: CampaignLog): readonly string[] {
  const value = log.shared["modularPicked"];
  return value?.kind === "strikeList" ? value.struck : [];
}

/** The sets checked off so far: the log's `modularSets` struck options (insert pp. 9, 14). */
export function mojoCheckedOffSets(log: CampaignLog): readonly string[] {
  const value = log.shared["modularSets"];
  return value?.kind === "strikeList" ? value.struck : [];
}

// ---------------------------------------------------------------------------------------------------------------
// The recorded card (insert pp. 9, 13-14, 17)
// ---------------------------------------------------------------------------------------------------------------

/** A support or upgrade the seat controls, printed cost `max` or less (`maxPrintedCost` reads events as 0; none are). */
const controlledWithin = (max: number) => ({
  categories: ["support", "upgrade"] as const,
  controller: "you" as const,
  maxPrintedCost: max,
});

/**
 * Not printed: reads the finished game into the working fields the choice below offers from, because a `record`
 * instruction reads a game and a `choose` reads the log. Per seat: the supports and upgrades they control within each
 * cost cap, and the dash-cost ones they control. Shared: `championBooing` (scenario 1) or the main scheme's threat and
 * the number of players who started (scenario 2).
 */
function recordCandidates(id: string, citation: string, cap: "champion" | "threat"): CampaignInstruction {
  const shared =
    cap === "champion"
      ? [
          {
            field: "championBooing",
            mode: "set" as const,
            value: {
              kind: "atLeast",
              of: {
                kind: "cardsInPlay",
                query: { categories: ["environment"], name: "The Champion", trait: BOOING_CROWD },
              },
              amount: 1,
            } satisfies CampaignGameQuery,
          },
        ]
      : [
          {
            field: "mainSchemeThreat",
            mode: "set" as const,
            value: {
              kind: "threatOn",
              query: { categories: ["mainScheme"] },
            } satisfies CampaignGameQuery,
          },
          {
            field: "playersStarted",
            mode: "set" as const,
            value: { kind: "playersInScenario" } satisfies CampaignGameQuery,
          },
        ];
  return {
    id,
    text: "(Not printed: records the supports and upgrades each player controls within the cost cap, and the main scheme's side or threat, for the next instruction's choice.)",
    citation,
    step: {
      kind: "record",
      writes: [
        ...shared,
        {
          field: "candidatesLow",
          seat: "each",
          mode: "set",
          value: { kind: "cardsInPlay", query: controlledWithin(2) },
        },
        {
          field: "candidatesHigh",
          seat: "each",
          mode: "set",
          value: { kind: "cardsInPlay", query: controlledWithin(3) },
        },
        {
          field: "dashCosts",
          seat: "each",
          mode: "set",
          value: {
            kind: "cardsInPlay",
            query: {
              categories: ["support", "upgrade"],
              controller: "you",
              // An empty `anyOf` matches nothing, which is the right answer when the pool prints no dash.
              anyOf: DASH_COST_IDS.map((printedId) => ({ printedId })),
            },
          },
        },
      ],
    },
  };
}

/** Insert pp. 9 and 14: "(three or less if …)" — the printed condition, over what `recordCandidates` wrote. */
const championBooing: CampaignPredicate = flagSet("championBooing");
const lessThanTenPerPlayer: CampaignPredicate = {
  kind: "valueAtLeast",
  // threat < 10 per player  <=>  not (floor(threat / 10) >= players)
  value: { kind: "divide", of: field("mainSchemeThreat"), by: 10, round: "down" },
  amount: field("playersStarted"),
};

/**
 * "Each player may choose one support or upgrade they control with a cost of two or less (three or less if …) and
 * record it in the campaign log." Never a card without a cost. `highCap` is the printed three-or-less condition.
 */
function recordCard(id: string, citation: string, highCap: CampaignPredicate, text: string): CampaignInstruction {
  const offer = (cards: string): CampaignOp => ({
    kind: "choose",
    slot: "recordedCard",
    chooser: "eachSeat",
    optional: true,
    from: { kind: "excludingTitles", from: { kind: "values", of: seatField(cards) }, titlesIn: seatField("dashCosts") },
  });
  return {
    id,
    text,
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        {
          kind: "forEachSeat",
          ops: [
            { kind: "if", when: highCap, then: [offer("candidatesHigh")], else: [offer("candidatesLow")] },
            {
              kind: "if",
              when: { kind: "choiceMade", slot: "recordedCard" },
              then: [{ kind: "appendToList", field: "recordedCards", seat: "self", value: choiceOf("recordedCard") }],
            },
          ],
        },
      ],
    },
  };
}

/**
 * Insert pp. 13 and 17: "Each player may take one copy of [each card] they recorded in the campaign log from any
 * player's deck and put it into play under their control. Then, add threat to the main scheme equal to the total cost of
 * the cards put into play this way." A recorded card names the first copy found in any deck (`campaignLogCards`
 * claims one instance per recorded entry, so two entries of one title name two copies); the player chooses which of
 * their recorded cards to take, none included. The setup window is before starting hands are drawn, so every copy is
 * still in a deck.
 */
function takeRecordedCards(id: string, citation: string, text: string, most: number): CampaignInstruction {
  return {
    id,
    text,
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(
          eachPlayer,
          chooseCards("taken", campaignLogCards("recordedCards", { seat: thatPlayer }), {
            min: 0,
            max: most,
            chooser: thatPlayer,
          }),
          putIntoPlay(chosen("taken"), thatPlayer, { bind: "put" }),
          placeThreat(totalPrintedCost(chosen("put")), theMainScheme),
        ),
      ],
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Expert campaign (insert p. 5)
// ---------------------------------------------------------------------------------------------------------------

/** Insert pp. 9, 14: "Expert Campaign Only: Record each identity's remaining hit points in the campaign log." */
const hpRecord = (id: string, citation: string): CampaignInstruction => ({
  id,
  text: "Expert Campaign Only: Record each identity's remaining hit points in the campaign log.",
  citation,
  whenModes: { expertCampaign: true },
  step: {
    kind: "record",
    writes: [{ field: "remainingHp", seat: "each", mode: "set", value: { kind: "remainingHitPointsCappedAtBase" } }],
  },
});

/** Insert pp. 13, 17: "Expert Campaign Only: Set each player's hit points to their remaining hit point value recorded …" */
const hpSet = (id: string, citation: string): CampaignInstruction => ({
  id,
  text: "Expert Campaign Only: Set each player's hit points to their remaining hit point value recorded in the campaign log for the previous scenario.",
  citation,
  whenModes: { expertCampaign: true },
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [
      forEachPlayer(
        eachPlayer,
        setRemainingHitPoints(campaignLogValue("remainingHp", { seat: thatPlayer }), identityOf(thatPlayer)),
      ),
    ],
  },
});

/**
 * Insert pp. 13, 17: "Expert Campaign Only: Each player may deal themself one facedown encounter card to heal their
 * identity to its full hit point value." **A defeated player must take it** (insert p. 5: "they can rejoin their
 * teammates for the next scenario by dealing themself one facedown encounter card during setup"; the same reading as
 * Q11's acceleration token): an identity whose recorded hit points are 0 is not offered "Decline".
 */
const healWithFacedownCard = (id: string, citation: string): CampaignInstruction => {
  const deal = dealEncounterCard(thatPlayer);
  const healFull = heal(damageOn(identityOf(thatPlayer)), identityOf(thatPlayer));
  return {
    id,
    text: "Expert Campaign Only: Each player may deal themself one facedown encounter card to heal their identity to its full hit point value.",
    citation,
    whenModes: { expertCampaign: true },
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(
          eachPlayer,
          ifThen(
            campaignLogAtLeast("remainingHp", 1, { seat: thatPlayer }),
            chooseOneBy(thatPlayer, option("Heal to full", deal, healFull), option("Decline", [])),
            [deal, healFull],
          ),
        ),
      ],
    },
  };
};

// ---------------------------------------------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------------------------------------------

const CARD_TEXT_SECOND =
  "Each player may take one copy of the card they recorded in the campaign log from any player's deck and put it into play under their control. Then, add threat to the main scheme equal to the total cost of the cards put into play this way.";
const CARD_TEXT_THIRD =
  "Each player may take one copy of each card they recorded in the campaign log from any player's deck and puts it into play under their control. Then, add threat to the main scheme equal to the total cost of the cards put into play this way.";
const RECORD_TEXT_FIRST =
  "Each player may choose one support or upgrade they control with a cost of two or less (three or less if The Champion is on its BOOING CROWD side) and record it in the campaign log. Players cannot choose cards without a cost (i.e. that have a cost of “—”).";
const RECORD_TEXT_SECOND =
  "Each player may choose one support or upgrade they control with a cost of two or less (three or less if there is less than ten threat per player on the main scheme) and record it in the campaign log. Players cannot choose cards without a cost (i.e. that have a cost of “—”).";

export const MOJO_CAMPAIGN_DEFINITION: CampaignDefinition = {
  campaignId: MOJO_ID,
  version: "1",
  logFields: [
    {
      id: "longshotInPlay",
      label: "Longshot in play",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MojoMania insert p. 9",
    },
    {
      id: "modularSets",
      label: "Modular encounter sets used (checked off)",
      scope: "shared",
      type: { kind: "strikeList", options: [...MOJO_GENRE_SETS] },
      citation: "MojoMania insert p. 9",
    },
    {
      id: "modularPicked",
      label: "Modular sets chosen for this scenario (working)",
      scope: "shared",
      type: { kind: "strikeList", options: [...MOJO_GENRE_SETS] },
      citation: "MojoMania insert p. 13",
    },
    {
      id: "modularFresh",
      label: "Of those, the sets that were not checked off (working)",
      scope: "shared",
      type: { kind: "strikeList", options: [...MOJO_GENRE_SETS] },
      hidden: true,
      citation: "MojoMania insert p. 17",
    },
    {
      id: "recordedCards",
      label: "Recorded support or upgrade",
      scope: "perSeat",
      type: { kind: "cardList" },
      citation: "MojoMania insert p. 9",
    },
    {
      id: "remainingHp",
      label: "Remaining hit points (expert)",
      scope: "perSeat",
      type: { kind: "number", min: 0 },
      whenModes: { expertCampaign: true },
      citation: "MojoMania insert p. 5",
    },
    {
      id: "championBooing",
      label: "The Champion on its BOOING CROWD side (working)",
      scope: "shared",
      type: { kind: "flag" },
      hidden: true,
      citation: "MojoMania insert p. 9",
    },
    {
      id: "mainSchemeThreat",
      label: "Threat on the main scheme (working)",
      scope: "shared",
      type: { kind: "number", min: 0 },
      hidden: true,
      citation: "MojoMania insert p. 14",
    },
    {
      id: "playersStarted",
      label: "Players who started the scenario (working)",
      scope: "shared",
      type: { kind: "number", min: 0 },
      hidden: true,
      citation: "MojoMania insert p. 14",
    },
    {
      id: "candidatesLow",
      label: "Supports and upgrades costing 2 or less (working)",
      scope: "perSeat",
      type: { kind: "cardList" },
      citation: "MojoMania insert p. 9",
    },
    {
      id: "candidatesHigh",
      label: "Supports and upgrades costing 3 or less (working)",
      scope: "perSeat",
      type: { kind: "cardList" },
      citation: "MojoMania insert p. 9",
    },
    {
      id: "dashCosts",
      label: "Supports and upgrades without a cost (working)",
      scope: "perSeat",
      type: { kind: "cardList" },
      citation: "MojoMania insert p. 9",
    },
  ],
  // Insert p. 4: "If the players lost, they may reset the scenario and try again with no penalty." No DEFEAT block in
  // any scenario, so the policy is `free`; the log goes back to the node's start.
  loss: { retry: "free", retryBaseline: "nodeStart" },
  // Insert p. 5: "If a player is defeated during a scenario that their teammates go on to win, the defeated player does
  // not participate in any of the victory steps for that scenario." The rejoin is the facedown-card heal.
  elimination: {
    id: "mojo.elimination",
    text: "If a player is defeated during a scenario that their teammates go on to win, the defeated player does not participate in any of the victory steps for that scenario.",
    citation: "MojoMania insert p. 5",
    whenModes: { expertCampaign: true },
  },
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "magog",
        label: "Scenario #1 - MaGog",
        scenario: { kind: "fixed", scenarioId: scenarioId("magog") },
        composition: [
          composeLongshot("mojo.s1", "MojoMania insert p. 9"),
          modularSetsFirst("mojo.s1.composition.sets", "MojoMania insert p. 7"),
        ],
        setup: [
          {
            id: "mojo.s1.setup.identity",
            text: "Each player records their identity in the campaign log found on the back cover of this rulebook. Players cannot switch identities during a campaign.",
            citation: "MojoMania insert p. 9",
            // The seat's identity is recorded when the campaign log is created (`CampaignSeat.identityCardId`).
            step: { kind: "betweenGames", ops: [] },
          },
          shuffleLongshotIn("mojo.s1.setup.longshot", "MojoMania insert p. 9"),
        ],
        victory: [
          longshotRecord("mojo.s1.victory.longshot", "MojoMania insert p. 9"),
          checkOffSets("mojo.s1.victory.modular-set", "MojoMania insert p. 9", false),
          recordCandidates("mojo.s1.victory.candidates", "MojoMania insert p. 9", "champion"),
          recordCard("mojo.s1.victory.card", "MojoMania insert p. 9", championBooing, RECORD_TEXT_FIRST),
          hpRecord("mojo.s1.victory.hp", "MojoMania insert p. 9"),
        ],
      },
      {
        id: "spiral",
        label: "Scenario #2 - Spiral",
        scenario: { kind: "fixed", scenarioId: scenarioId("spiral") },
        composition: [composeLongshot("mojo.s2", "MojoMania insert p. 13")],
        setup: [
          modularSetsSecond("mojo.s2.setup.modular-sets", "MojoMania insert p. 13"),
          revealOrShuffleLongshot("mojo.s2.setup.longshot", "MojoMania insert p. 13"),
          takeRecordedCards("mojo.s2.setup.recorded-card", "MojoMania insert p. 13", CARD_TEXT_SECOND, 1),
          hpSet("mojo.s2.setup.hp-set", "MojoMania insert p. 13"),
          healWithFacedownCard("mojo.s2.setup.heal", "MojoMania insert p. 13"),
        ],
        victory: [
          longshotRecord("mojo.s2.victory.longshot", "MojoMania insert p. 14"),
          checkOffSets("mojo.s2.victory.modular-sets", "MojoMania insert p. 14", true),
          recordCandidates("mojo.s2.victory.candidates", "MojoMania insert p. 14", "threat"),
          recordCard("mojo.s2.victory.card", "MojoMania insert p. 14", not(lessThanTenPerPlayer), RECORD_TEXT_SECOND),
          hpRecord("mojo.s2.victory.hp", "MojoMania insert p. 14"),
        ],
      },
      {
        id: "mojo",
        label: "Scenario #3 - Mojo",
        scenario: { kind: "fixed", scenarioId: scenarioId("mojo") },
        composition: [composeLongshot("mojo.s3", "MojoMania insert p. 17")],
        setup: [
          modularSetsThird("mojo.s3.setup.modular-sets", "MojoMania insert p. 17"),
          revealOrShuffleLongshot("mojo.s3.setup.longshot", "MojoMania insert p. 17"),
          takeRecordedCards("mojo.s3.setup.recorded-cards", "MojoMania insert p. 17", CARD_TEXT_THIRD, 2),
          hpSet("mojo.s3.setup.hp-set", "MojoMania insert p. 17"),
          healWithFacedownCard("mojo.s3.setup.heal", "MojoMania insert p. 17"),
        ],
        victory: [
          {
            id: "mojo.s3.victory.win",
            text: "The players win the campaign!",
            citation: "MojoMania insert p. 17",
            step: { kind: "betweenGames", ops: [] },
          },
        ],
      },
    ],
  },
};
