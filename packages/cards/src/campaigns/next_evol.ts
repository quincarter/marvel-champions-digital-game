/**
 * NeXt Evolution (MC40) — the seventh `CampaignDefinition` (after `trors.ts`, `gmw.ts`, `mts.ts`, `sm.ts`, `mut_gen.ts`
 * and `mojo.ts`): five scenarios (Morlock Siege, On the Run, Juggernaut, Mister Sinister, Stryfe) in numerical order, a
 * campaign player side scheme chosen for each, and the environment each earns.
 *
 * Source of truth: `docs/campaign-modes/markdown/mc40_next_evolution.md` ("MC40 p. N", the PDF's pages: the campaign
 * rules pp. 6-7, the five scenarios' Campaign Instructions pp. 9, 11, 14, 16 and 18, the log sheet p. 24) and
 * `docs/phase7-wave7.md` §1.19-§1.21, §2.10, §3.40-§3.46 and the §4.1 decisions (Q24, Q25, Q28). Every
 * `CampaignInstruction` carries the printed bullet it encodes, in printed order; an instruction the rulebook does not
 * print as a bullet (a composition step, the set-aside half of "put into play", the removal p. 7 describes) says so.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * MODELING
 *
 * - **The six player side schemes** (MC40 p. 7) are `sideSchemes`, a `strikeList` over the six scheme titles (a struck
 *   option is a row whose "Scenario Chosen" box is filled). `sideSchemeScenario1`..`5` record which row each scenario
 *   used. A scheme is chosen by the players as a group from the unstruck rows (`choose`, `fieldOptions
 *   unstruckOnly`), marked and struck at once. Scenario 1 offers all six; scenarios 2-5 print "that has not been chosen
 *   previously", which is exactly what a strike means. The pairing (scheme, encounter card, environment) is the log
 *   sheet's own row table (`SCHEMES`).
 * - **A retry repeats the choice** (MC40 p. 7, §3.40): the `choose` carries `repeatOnRetry`, so a lost scenario's retry
 *   is not asked again, and `retryBaseline: "nodeStart"` rolls the strike, the mark and the encounter card back so
 *   they are written again from the same pick.
 * - **Putting the scheme into play.** Between games the chosen a face (and, so the Action of an environment that may
 *   enter play this game can find them, the Pouches or the Safehouse it hands out) is set aside; in game the scheme is
 *   put into play, controlled by nobody (§4.1 Q24: the card is nobody's, `putIntoPlay` on an unowned card).
 * - **Earning** (p. 7): only the Victory step records an environment (`environmentsEarned`, the b faces), so a scheme
 *   defeated in a lost game earns nothing. A chosen scheme that is not among the environments earned when the players
 *   win "is removed from the campaign and cannot be chosen again" (both faces, `removeFromCampaign`); its encounter card
 *   stays in `encounterCards` ("even if the players do not defeat the player side scheme").
 * - **Encounter cards** accumulate in `encounterCards`: each setup appends its own scheme's card, sets every recorded
 *   card aside and shuffles them into the encounter deck (scenario 1 therefore adds one card, scenario 5 five).
 * - **Earned environments** are set aside between games and put into play in game, in the log sheet's row order ("in any
 *   order": none reads another). Each enters play, so Team Assembled, Safehouse Established, Geared Up and Mission
 *   Prepped get their counter again every scenario. Scenario 2 also gives each enemy a tough status card when one is
 *   earned; scenarios 3-5 count the campaign environments in play for their momentum counter and threat.
 * - **Scenario 2 before 1A's Setup** (`beforeScenarioSetup`, §3.42): each villain recorded under Marauders Defeated is
 *   removed from the game by title (`byName`: scenario 1 may have recorded the other mode's face), so the draw is among
 *   the four that remain. Their minions stay in the deck.
 * - **Morlocks Saved** (p. 11): one gated search per possible count (1-4); the first player chooses the player and that
 *   player adds any card of their deck to their hand and shuffles. It resolves after mulligans (§4.1 Q28 = B), as an
 *   extra card on top of the opening hand.
 * - **Black Tom Cassidy** (p. 14, scenario 3): the card and 1 per player Creeping Willow are taken from the encounter
 *   deck into the set-aside area, a random one is dealt facedown to each player (the seeded RNG, `encounterSetAside` with
 *   `random`), and the remaining card is shuffled into the encounter deck. The set must be in the encounter deck: the
 *   campaign requires it for Juggernaut and nothing in the definition can say so (see the report; the game builder
 *   passes it as the scenario's modular set).
 * - **Hope Summers's damage** (pp. 14-18): recorded by Victory in scenarios 3 and 4 (`hopeDamage3`, `hopeDamage4`),
 *   and in scenarios 4 and 5 the first player decides for the group between that much damage on her ("place", not
 *   "deal") or that much threat on Teleported Away / Stryfe's Grasp. Nothing to choose at 0.
 * - **Expert campaign** (p. 7): the shared `expert-helpers.ts`. Scenarios 2 and 4 heal with an acceleration token,
 *   scenarios 3 and 5 with a facedown encounter card; a defeated player must pay it to rejoin. A seat that sat out a won
 *   scenario's Victory steps records nothing (`elimination`). Losing Stryfe loses the campaign.
 */

import { campaignId, cardId, encounterSetId, scenarioId, trait, type CardId } from "@mc/content";
import {
  DEFAULT_CAMPAIGN_WINDOW,
  type CampaignDefinition,
  type CampaignInstruction,
  type CampaignOp,
  type CampaignPredicate,
  type CampaignValue,
  type EffectSpec,
  type TargetQuery,
} from "@mc/engine";
import {
  addCounters,
  anyOfCards,
  campaignLogAtLeast,
  campaignLogCards,
  campaignLogHas,
  campaignLogValue,
  cards,
  choosePlayer,
  chooseCards,
  chooseOneBy,
  chosen,
  chosenPlayer,
  countOf,
  dealAsEncounterCard,
  discardEncounterUntil,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  firstPlayer,
  forEachPlayer,
  giveTough,
  ifThen,
  moveCards,
  named,
  option,
  perHero,
  placeDamage,
  placeThreat,
  product,
  putIntoPlay,
  query,
  revealCard,
  selectCards,
  shuffleDeck,
  shuffleEncounterDeck,
  theVillain,
  thatPlayer,
  zone,
  atMost,
} from "../dsl/index.js";
import { healToFull, healWithFacedownCard, hpRecord, hpSet } from "./expert-helpers.js";

const NEXT_EVOL_ID = campaignId("next_evol");
const CAMPAIGN_SET = encounterSetId("next_evol_campaign");

const MORLOCK = trait("MORLOCK");
const PSIONIC = trait("PSIONIC");

const constant = (value: number | string | boolean): CampaignValue => ({ kind: "const", value });
const field = (id: string): CampaignValue => ({ kind: "field", field: id });
const choiceOf = (slot: string): CampaignValue => ({ kind: "choice", slot });

// ---------------------------------------------------------------------------------------------------------------
// The campaign sheet's rows (MC40 p. 24) and the cards of the campaign set
// ---------------------------------------------------------------------------------------------------------------

interface SchemeRow {
  /** The player side scheme's title, which is the option id of `sideSchemes` and of `sideSchemeScenarioN`. */
  readonly name: string;
  readonly scheme: CardId;
  readonly encounterCard: CardId;
  readonly environment: CardId;
  /** What the environment's Action hands out of the campaign's set-aside pool: Pouches (one per player) or Safehouse. */
  readonly supply?: { readonly name: string; readonly card: CardId; readonly perPlayer: boolean };
}

/** The log sheet's rows, in its order: scheme / encounter card / environment (MC40 p. 24, docs/phase7-wave7.md §1.19). */
const SCHEMES: readonly SchemeRow[] = [
  {
    name: "Establish Safehouse",
    scheme: cardId("40191a"),
    encounterCard: cardId("40201"),
    environment: cardId("40191b"),
    supply: { name: "Safehouse", card: cardId("40197"), perPlayer: false },
  },
  {
    name: "Mission Prep",
    scheme: cardId("40193a"),
    encounterCard: cardId("40200"),
    environment: cardId("40193b"),
  },
  {
    name: "Assemble the Team",
    scheme: cardId("40190a"),
    encounterCard: cardId("40199"),
    environment: cardId("40190b"),
  },
  {
    name: "Gear Up",
    scheme: cardId("40192a"),
    encounterCard: cardId("40203"),
    environment: cardId("40192b"),
    supply: { name: "Pouches", card: cardId("40196"), perPlayer: true },
  },
  {
    name: "Practice Maneuvers",
    scheme: cardId("40194a"),
    encounterCard: cardId("40198"),
    environment: cardId("40194b"),
  },
  {
    name: "Prepare Defenses",
    scheme: cardId("40195a"),
    encounterCard: cardId("40202"),
    environment: cardId("40195b"),
  },
];

const SCHEME_NAMES = SCHEMES.map((row) => row.name);
const NODE_COUNT = 5;
const sideSchemeFieldOf = (scenarioNumber: number): string => `sideSchemeScenario${scenarioNumber}`;

const CAMPAIGN_ENVIRONMENTS: TargetQuery = { categories: ["environment"], inEncounterSet: CAMPAIGN_SET as string };
const campaignEnvironmentsInPlay = countOf(query("environment", { inEncounterSet: CAMPAIGN_SET as string }));

// ---------------------------------------------------------------------------------------------------------------
// Repeated shapes
// ---------------------------------------------------------------------------------------------------------------

const chosenFor = (scenarioNumber: number, row: SchemeRow): CampaignPredicate => ({
  kind: "fieldContains",
  field: sideSchemeFieldOf(scenarioNumber),
  value: row.name,
});
const earned = (row: SchemeRow): CampaignPredicate => ({
  kind: "fieldContains",
  field: "environmentsEarned",
  value: row.environment as string,
});

/**
 * "The players as a group choose [one] player side scheme listed in the campaign log [that has not been chosen
 * previously]", and "Mark the player side scheme as chosen for scenario #N". Printed as two bullets, one step: the pick
 * and its mark share a slot. A retry repeats the pick (§3.40).
 */
function chooseScheme(scenarioNumber: number, prefix: string, citation: string): CampaignInstruction {
  const previously = scenarioNumber === 1 ? "" : " that has not been chosen previously";
  return {
    id: `${prefix}.choose`,
    text: `The players as a group choose 1 player side scheme listed in the campaign log${previously}, and mark the player side scheme as chosen for scenario #${scenarioNumber} in the campaign log.`,
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        {
          kind: "choose",
          slot: "scheme",
          chooser: "group",
          from: { kind: "fieldOptions", field: "sideSchemes", unstruckOnly: true },
          repeatOnRetry: true,
        },
        { kind: "setField", field: sideSchemeFieldOf(scenarioNumber), value: choiceOf("scheme") },
        { kind: "strike", field: "sideSchemes", option: choiceOf("scheme") },
      ],
    },
  };
}

/**
 * Not printed as its own bullet: sets the chosen scheme aside, and the supply its environment hands out once it flips
 * (Pouches for Geared Up, Safehouse for Safehouse Established). An environment already earned has its supply set aside
 * with it (`earnedEnvironments`); a scheme chosen cannot be an earned one.
 */
function setChosenSchemeAside(scenarioNumber: number, prefix: string, citation: string): CampaignInstruction {
  const supplies = SCHEMES.flatMap((row): CampaignOp[] =>
    row.supply
      ? [
          {
            kind: "if",
            when: chosenFor(scenarioNumber, row),
            then: [
              {
                kind: "setAsideCards",
                cards: [constant(row.supply.card)],
                ...(row.supply.perPlayer ? { copies: { kind: "seatCount" as const } } : {}),
              },
            ],
          },
        ]
      : [],
  );
  return {
    id: `${prefix}.scheme-set-aside`,
    text: "Set the chosen player side scheme aside, with what its environment hands out, to be put into play by the next instruction.",
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        ...SCHEMES.map((row): CampaignOp => ({
          kind: "if",
          when: chosenFor(scenarioNumber, row),
          then: [{ kind: "setAsideCards", cards: [constant(row.scheme)] }],
        })),
        ...supplies,
      ],
    },
  };
}

/** "Put the chosen player side scheme into play." Controlled by nobody (§4.1 Q24). */
function putSchemeIntoPlay(scenarioNumber: number, id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Put the chosen player side scheme into play.",
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: SCHEMES.map((row) =>
        ifThen(campaignLogHas(sideSchemeFieldOf(scenarioNumber), row.name), [
          selectCards("scheme", encounterSetAside({ name: row.name })),
          putIntoPlay(chosen("scheme"), firstPlayer),
        ]),
      ),
    },
  };
}

/** "Take the encounter card listed in the campaign log in the same row as the chosen player side scheme [...]": the record half. */
function recordEncounterCard(scenarioNumber: number, prefix: string, citation: string): CampaignInstruction {
  return {
    id: `${prefix}.encounter-card-record`,
    text: "Take the encounter card listed in the campaign log in the same row as the chosen player side scheme: add it to the cards recorded for the encounter deck, and set every recorded encounter card aside.",
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        ...SCHEMES.map((row): CampaignOp => ({
          kind: "if",
          when: chosenFor(scenarioNumber, row),
          then: [{ kind: "appendToList", field: "encounterCards", value: constant(row.encounterCard) }],
        })),
        { kind: "setAsideCards", cards: [field("encounterCards")] },
      ],
    },
  };
}

/** "... and shuffle [it / them] into the encounter deck." Scenario 1 prints "it", the rest "each encounter card that corresponds to a player side scheme marked as chosen". */
function shuffleEncounterCards(id: string, citation: string, text: string): CampaignInstruction {
  return {
    id,
    text,
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [moveCards(campaignLogCards("encounterCards"), "encounterDeckShuffle")],
    },
  };
}

/** The four setup bullets every scenario prints under "choose": choose + mark, put into play, take the encounter card(s). */
function chooseBlock(scenarioNumber: number, prefix: string, citation: string): readonly CampaignInstruction[] {
  const text =
    scenarioNumber === 1
      ? "Take the encounter card listed in the campaign log in the same row as the chosen player side scheme and shuffle it into the encounter deck."
      : "Take each encounter card that corresponds to a player side scheme marked as chosen in the campaign log and shuffle them into the encounter deck.";
  return [
    chooseScheme(scenarioNumber, prefix, citation),
    setChosenSchemeAside(scenarioNumber, prefix, citation),
    putSchemeIntoPlay(scenarioNumber, `${prefix}.scheme`, citation),
    recordEncounterCard(scenarioNumber, prefix, citation),
    shuffleEncounterCards(`${prefix}.encounter-cards`, citation, text),
  ];
}

/**
 * "Gather each campaign environment marked as 'Earned' in the campaign log. Put those environments into play in any
 * order." (pp. 11-18): the b faces set aside between games, put into play in game in the sheet's row order.
 */
function earnedEnvironments(prefix: string, citation: string, text: string): readonly CampaignInstruction[] {
  return [
    {
      id: `${prefix}.environments-set-aside`,
      text: "Set each earned campaign environment aside, to be put into play by the next instruction.",
      citation,
      step: {
        kind: "betweenGames",
        ops: [
          { kind: "setAsideCards", cards: [field("environmentsEarned")] },
          // Pouches (one per player) and the Safehouse for an environment that hands them out.
          ...SCHEMES.flatMap((row): CampaignOp[] =>
            row.supply
              ? [
                  {
                    kind: "if",
                    when: earned(row),
                    then: [
                      {
                        kind: "setAsideCards",
                        cards: [constant(row.supply.card)],
                        ...(row.supply.perPlayer ? { copies: { kind: "seatCount" as const } } : {}),
                      },
                    ],
                  },
                ]
              : [],
          ),
        ],
      },
    },
    putEarnedEnvironmentsIntoPlay(`${prefix}.environments`, citation, text),
  ];
}

function putEarnedEnvironmentsIntoPlay(id: string, citation: string, text: string): CampaignInstruction {
  return {
    id,
    text,
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: environmentEffects(),
    },
  };
}

function environmentEffects(): EffectSpec[] {
  return SCHEMES.map((row) => {
    const name = ENVIRONMENT_NAMES[row.environment as string]!;
    return ifThen(campaignLogHas("environmentsEarned", row.environment as string), [
      selectCards("environment", encounterSetAside({ name, categories: ["environment"] })),
      putIntoPlay(chosen("environment"), firstPlayer),
    ]);
  });
}

/** The environments' printed titles (the b faces), for picking them out of the set-aside area. */
const ENVIRONMENT_NAMES: Readonly<Record<string, string>> = {
  "40191b": "Safehouse Established",
  "40193b": "Mission Prepped",
  "40190b": "Team Assembled",
  "40192b": "Geared Up",
  "40194b": "Practiced Maneuvers",
  "40195b": "Prepared Defenses",
};

/** "Mark each campaign environment in play as 'Earned' in the campaign log (if it is not already)." (also scenario 1, "If there is a campaign environment card in play") */
function recordEnvironments(id: string, citation: string, text: string): CampaignInstruction {
  return {
    id,
    text,
    citation,
    step: {
      kind: "record",
      writes: [
        {
          field: "environmentsEarned",
          mode: "append",
          distinct: true,
          value: { kind: "cardsInPlay", query: CAMPAIGN_ENVIRONMENTS },
        },
      ],
    },
  };
}

/**
 * MC40 p. 7: "If the players do not defeat the chosen player side scheme by the time they win the scenario, that card is
 * removed from the campaign and cannot be chosen again." Not printed as a Victory bullet; it follows the environments
 * recorded above, which is how "defeated" is read (the scheme flipped to its environment, and a flipped one is in play).
 */
function removeUndefeatedScheme(scenarioNumber: number, id: string): CampaignInstruction {
  return {
    id,
    text: "If the players did not defeat the chosen player side scheme, it is removed from the campaign and cannot be chosen again.",
    citation: "MC40 p. 7",
    step: {
      kind: "betweenGames",
      ops: SCHEMES.map((row): CampaignOp => ({
        kind: "if",
        when: { kind: "and", of: [chosenFor(scenarioNumber, row), { kind: "not", of: earned(row) }] },
        then: [{ kind: "removeFromCampaign", cards: [constant(row.scheme), constant(row.environment)] }],
      })),
    },
  };
}

/** "Record the amount of damage on Hope Summers in the campaign log." (pp. 14, 16) */
function recordHopeDamage(id: string, citation: string, fieldId: string): CampaignInstruction {
  return {
    id,
    text: "Record the amount of damage on Hope Summers in the campaign log.",
    citation,
    step: {
      kind: "record",
      writes: [
        {
          field: fieldId,
          mode: "set",
          value: { kind: "damageOn", query: { categories: ["ally"], name: "Hope Summers" } },
        },
      ],
    },
  };
}

/**
 * "The players choose to either place damage on Hope Summers equal to the damage recorded for her from the previous
 * scenario in the campaign log, or place that much threat on [the scheme]." The players decide as a group, the first
 * player enters it (RRG 1.8 "First Player", p. 19); with nothing recorded there is nothing to choose (foundation row 59).
 */
function hopeDamageOrThreat(id: string, citation: string, fieldId: string, scheme: string): CampaignInstruction {
  const recorded = campaignLogValue(fieldId);
  return {
    id,
    text: `The players choose to either place damage on Hope Summers equal to the damage recorded for her from the previous scenario in the campaign log, or place that much threat on ${scheme}.`,
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        ifThen(
          campaignLogAtLeast(fieldId, 1),
          chooseOneBy(
            firstPlayer,
            option("Place that damage on Hope Summers", placeDamage(recorded, named("Hope Summers"))),
            option(`Place that much threat on ${scheme}`, placeThreat(recorded, named(scheme))),
          ),
        ),
      ],
    },
  };
}

/** `Expert Campaign Only` + `Elimination`, MC40 p. 7. */
const FOURTH_AND_FIFTH_HEAL = healWithFacedownCard;

// ---------------------------------------------------------------------------------------------------------------
// Scenario-specific instructions
// ---------------------------------------------------------------------------------------------------------------

/** MC40 p. 11: "Before resolving the 'Setup' text on Gotta Get Away (103A), remove each villain card recorded in the campaign log under 'Marauders Defeated' from the game." */
const removeMaraudersDefeated: CampaignInstruction = {
  id: "mc40.s2.setup.marauders-removed",
  text: "Before resolving the “Setup” text on Gotta Get Away (103A), remove each villain card recorded in the campaign log under “Marauders Defeated” from the game. (Minion cards with the same title remain in the encounter deck.)",
  citation: "MC40 p. 11",
  step: {
    kind: "inGame",
    window: "beforeScenarioSetup",
    effects: [
      moveCards(campaignLogCards("maraudersDefeated", { byName: true, filter: query("villain") }), "removedFromGame"),
    ],
  },
};

/**
 * MC40 p. 11: "For each Morlock saved in the previous scenario, choose a player to search their deck for one card, add
 * that card to their hand, and shuffle their deck." One gated copy per possible count (a Morlock for each of four
 * allies at most); after mulligans (§4.1 Q28 = B).
 */
const morlockSearches: CampaignInstruction = {
  id: "mc40.s2.setup.morlocks-saved",
  text: "For each Morlock saved in the previous scenario, choose a player to search their deck for one card, add that card to their hand, and shuffle their deck.",
  citation: "MC40 p. 11",
  step: {
    kind: "inGame",
    window: "afterMulligans",
    effects: [1, 2, 3, 4].map((count) => {
      const slot = `morlock-search-${count}`;
      return ifThen(campaignLogAtLeast("morlocksSaved", count), [
        choosePlayer(slot, firstPlayer),
        chooseCards(`found-${count}`, zone("deck", chosenPlayer(slot)), {
          min: 1,
          max: 1,
          chooser: chosenPlayer(slot),
        }),
        moveCards(cards(chosen(`found-${count}`)), "hand"),
        shuffleDeck(chosenPlayer(slot)),
      ]);
    }),
  },
};

/** MC40 p. 11: "If there is a campaign environment marked as 'Earned' in the campaign log, put that environment into play and give each enemy a tough status card." */
const environmentAndTough: readonly CampaignInstruction[] = [
  {
    id: "mc40.s2.setup.environment-set-aside",
    text: "Set the earned campaign environment aside, to be put into play by the next instruction.",
    citation: "MC40 p. 11",
    step: {
      kind: "betweenGames",
      ops: [
        { kind: "setAsideCards", cards: [field("environmentsEarned")] },
        ...SCHEMES.flatMap((row): CampaignOp[] =>
          row.supply
            ? [
                {
                  kind: "if",
                  when: earned(row),
                  then: [
                    {
                      kind: "setAsideCards",
                      cards: [constant(row.supply.card)],
                      ...(row.supply.perPlayer ? { copies: { kind: "seatCount" as const } } : {}),
                    },
                  ],
                },
              ]
            : [],
        ),
      ],
    },
  },
  {
    id: "mc40.s2.setup.environment",
    text: "If there is a campaign environment marked as “Earned” in the campaign log, put that environment into play and give each enemy a tough status card.",
    citation: "MC40 p. 11",
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        ...environmentEffects(),
        ifThen(
          campaignLogAtLeast("environmentsEarned", 1, { of: "count" }),
          giveTough({ kind: "each", query: query("enemy") }),
        ),
      ],
    },
  },
];

/** MC40 p. 14: "Place 1 momentum counter on Juggernaut for each campaign environment in play." */
const momentumCounters: CampaignInstruction = {
  id: "mc40.s3.setup.momentum",
  text: "Place 1 momentum counter on Juggernaut for each campaign environment in play.",
  citation: "MC40 p. 14",
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [addCounters("momentum", campaignEnvironmentsInPlay, theVillain)],
  },
};

const BLACK_TOM_OR_WILLOW: TargetQuery = { anyOf: [{ name: "Black Tom Cassidy" }, { name: "Creeping Willow" }] };

/**
 * MC40 p. 14: "Shuffle Black Tom Cassidy and 1 per player Creeping Willow minion together and deal one of these cards to
 * each player as a facedown encounter card. Shuffle the remaining card into the encounter deck." The cards are taken from
 * the encounter deck into the set-aside area, where a random one is drawn for each player (a shuffle's result, from the
 * game's seeded RNG), and what is left goes back into the encounter deck, shuffled.
 */
const blackTomDealt: CampaignInstruction = {
  id: "mc40.s3.setup.black-tom",
  text: "Shuffle Black Tom Cassidy and 1[per_hero] Creeping Willow minion together and deal one of these cards to each player as a facedown encounter card. Shuffle the remaining card into the encounter deck.",
  citation: "MC40 p. 14",
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [
      selectCards("black-tom", encounterCards(["deck"], query("minion", { name: "Black Tom Cassidy" }))),
      selectCards(
        "willows",
        atMost(perHero(1), encounterCards(["deck"], query("minion", { name: "Creeping Willow" }))),
      ),
      moveCards(anyOfCards(cards(chosen("black-tom")), cards(chosen("willows"))), "encounterSetAside"),
      forEachPlayer(
        eachPlayer,
        selectCards("dealt", encounterSetAside(BLACK_TOM_OR_WILLOW, { random: 1 })),
        dealAsEncounterCard(chosen("dealt"), thatPlayer),
      ),
      moveCards(encounterSetAside(BLACK_TOM_OR_WILLOW), "encounterDeckShuffle"),
    ],
  },
};

/** MC40 p. 16: "Put the Teleported Away side scheme into play. Place an additional 1 per player threat on it for each campaign environment in play." */
const teleportedAway: CampaignInstruction = {
  id: "mc40.s4.setup.teleported-away",
  text: "Put the Teleported Away side scheme into play. Place an additional 1[per_hero] threat on it for each campaign environment in play.",
  citation: "MC40 p. 16",
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [
      selectCards(
        "teleported-away",
        encounterCards(["deck", "discard"], query("sideScheme", { name: "Teleported Away" })),
      ),
      putIntoPlay(chosen("teleported-away"), firstPlayer),
      shuffleEncounterDeck(),
      placeThreat(product(perHero(1), campaignEnvironmentsInPlay), named("Teleported Away")),
    ],
  },
};

/** MC40 p. 18: "Place 1 per player threat on Stryfe's Grasp for each campaign environment in play." */
const grasp: CampaignInstruction = {
  id: "mc40.s5.setup.grasp",
  text: "Place 1[per_hero] threat on Stryfe’s Grasp for each campaign environment in play.",
  citation: "MC40 p. 18",
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [placeThreat(product(perHero(1), campaignEnvironmentsInPlay), named("Stryfe's Grasp"))],
  },
};

/** MC40 p. 18: "In player order, each player discards cards from the encounter deck until they discard a minion or a Psionic attachment and reveal that card." */
const discardUntilReveal: CampaignInstruction = {
  id: "mc40.s5.setup.discard-until",
  text: "In player order, each player discards cards from the encounter deck until they discard a minion or a Psionic attachment and reveal that card.",
  citation: "MC40 p. 18",
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [
      forEachPlayer(
        eachPlayer,
        discardEncounterUntil({ anyOf: [query("minion"), query("attachment", { trait: PSIONIC })] }, "found"),
        revealCard(chosen("found"), thatPlayer),
      ),
    ],
  },
};

/** MC40 p. 18: "Shuffle the encounter discard pile into the encounter deck." */
const reshuffleDiscard: CampaignInstruction = {
  id: "mc40.s5.setup.reshuffle",
  text: "Shuffle the encounter discard pile into the encounter deck.",
  citation: "MC40 p. 18",
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [moveCards(encounterCards(["discard"]), "encounterDeckShuffle")],
  },
};

// ---------------------------------------------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------------------------------------------

const schemeOptions = (): readonly string[] => SCHEME_NAMES;

export const NEXT_EVOL_CAMPAIGN_DEFINITION: CampaignDefinition = {
  campaignId: NEXT_EVOL_ID,
  version: "1",
  logFields: [
    {
      id: "remainingHp",
      label: "Remaining hit points (expert)",
      scope: "perSeat",
      type: { kind: "number", min: 0 },
      whenModes: { expertCampaign: true },
      citation: "MC40 p. 7",
    },
    {
      id: "maraudersDefeated",
      label: "Marauders Defeated",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC40 p. 24",
    },
    {
      id: "morlocksSaved",
      label: "Morlocks Saved",
      scope: "shared",
      type: { kind: "number", min: 0, max: 4 },
      citation: "MC40 p. 24",
    },
    {
      id: "hopeDamage3",
      label: "Hope Summers's Damage, Scenario 3",
      scope: "shared",
      type: { kind: "number", min: 0 },
      citation: "MC40 p. 24",
    },
    {
      id: "hopeDamage4",
      label: "Hope Summers's Damage, Scenario 4",
      scope: "shared",
      type: { kind: "number", min: 0 },
      citation: "MC40 p. 24",
    },
    {
      id: "sideSchemes",
      label: "Campaign Player Side Schemes",
      scope: "shared",
      type: { kind: "strikeList", options: [...schemeOptions()] },
      citation: "MC40 p. 24",
    },
    ...Array.from({ length: NODE_COUNT }, (_, index) => ({
      id: sideSchemeFieldOf(index + 1),
      label: `Player side scheme chosen for scenario ${index + 1}`,
      scope: "shared" as const,
      type: { kind: "choice" as const, options: [...schemeOptions()] },
      citation: "MC40 p. 24",
    })),
    {
      id: "encounterCards",
      label: "Encounter Cards",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC40 p. 24",
    },
    {
      id: "environmentsEarned",
      label: "Environments Earned",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC40 p. 24",
    },
  ],
  // MC40 p. 7 "Elimination and Victory": a player defeated in a scenario their teammates win skips its Victory steps
  // and rejoins by paying the next setup's heal (`healToFull` / `healWithFacedownCard`), so no `rejoinAtPrintedHitPoints`.
  elimination: {
    id: "mc40.elimination",
    text: "Expert Campaign Only: If a player is defeated during a scenario that their teammates go on to win, the defeated player does not participate in the Victory steps of that scenario.",
    citation: "MC40 p. 7",
    whenModes: { expertCampaign: true },
  },
  // MC40 p. 6: "If the players lost, they may reset the scenario and try again with no penalty" (the choice of scheme
  // is repeated, `choose.repeatOnRetry`), except Stryfe in an expert campaign (p. 18).
  loss: { retry: "byInstruction", retryBaseline: "nodeStart" },
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "morlock-siege",
        label: "Scenario #1 - Morlock Siege",
        scenario: { kind: "fixed", scenarioId: scenarioId("morlock-siege") },
        setup: [
          {
            id: "mc40.s1.setup.identity",
            text: "Each player records their identity in the campaign log found on the back cover of this rulebook. Players cannot switch identities during a campaign.",
            citation: "MC40 p. 9",
            // The seat's identity is recorded when the campaign log is created (`CampaignSeat.identityCardId`).
            step: { kind: "betweenGames", ops: [] },
          },
          ...chooseBlock(1, "mc40.s1.setup", "MC40 p. 9"),
        ],
        victory: [
          {
            id: "mc40.s1.victory.marauders",
            text: "Record the title of each villain under Routed in the campaign log under “Marauders Defeated.”",
            citation: "MC40 p. 9",
            step: {
              kind: "record",
              writes: [
                {
                  field: "maraudersDefeated",
                  mode: "set",
                  value: { kind: "cardsTuckedUnder", under: { name: "Routed" }, query: { categories: ["villain"] } },
                },
              ],
            },
          },
          {
            id: "mc40.s1.victory.morlocks",
            text: "Record the number of Morlock allies still in play in the campaign log under “Morlocks Saved.”",
            citation: "MC40 p. 9",
            step: {
              kind: "record",
              writes: [
                {
                  field: "morlocksSaved",
                  mode: "set",
                  value: {
                    kind: "capAt",
                    of: { kind: "count", of: { kind: "cardsInPlay", query: { categories: ["ally"], trait: MORLOCK } } },
                    amount: 4,
                  },
                },
              ],
            },
          },
          recordEnvironments(
            "mc40.s1.victory.environment",
            "MC40 p. 9",
            "If there is a campaign environment card in play, mark it as “Earned” in the campaign log.",
          ),
          removeUndefeatedScheme(1, "mc40.s1.victory.removed"),
          hpRecord("mc40.s1.victory.hp", "MC40 p. 9"),
        ],
      },
      {
        id: "on-the-run",
        label: "Scenario #2 - On the Run",
        scenario: { kind: "fixed", scenarioId: scenarioId("on-the-run") },
        setup: [
          removeMaraudersDefeated,
          morlockSearches,
          ...environmentAndTough,
          ...chooseBlock(2, "mc40.s2.setup", "MC40 p. 11"),
          hpSet("mc40.s2.setup.hp-set", "MC40 p. 11"),
          healToFull("mc40.s2.setup.heal", "MC40 p. 11"),
        ],
        victory: [
          recordEnvironments(
            "mc40.s2.victory.environment",
            "MC40 p. 11",
            "Mark each campaign environment in play as “Earned” in the campaign log (if it is not already).",
          ),
          removeUndefeatedScheme(2, "mc40.s2.victory.removed"),
          hpRecord("mc40.s2.victory.hp", "MC40 p. 11"),
        ],
      },
      {
        id: "juggernaut",
        label: "Scenario #3 - Juggernaut",
        scenario: { kind: "fixed", scenarioId: scenarioId("juggernaut") },
        setup: [
          ...earnedEnvironments(
            "mc40.s3.setup",
            "MC40 p. 14",
            "Gather each campaign environment marked as “Earned” in the campaign log. Put those environments into play in any order.",
          ),
          momentumCounters,
          blackTomDealt,
          ...chooseBlock(3, "mc40.s3.setup", "MC40 p. 14"),
          hpSet("mc40.s3.setup.hp-set", "MC40 p. 14"),
          FOURTH_AND_FIFTH_HEAL("mc40.s3.setup.heal", "MC40 p. 14"),
        ],
        victory: [
          recordHopeDamage("mc40.s3.victory.hope", "MC40 p. 14", "hopeDamage3"),
          recordEnvironments(
            "mc40.s3.victory.environment",
            "MC40 p. 14",
            "Mark each campaign environment in play as “Earned” in the campaign log (if it is not already).",
          ),
          removeUndefeatedScheme(3, "mc40.s3.victory.removed"),
          hpRecord("mc40.s3.victory.hp", "MC40 p. 14"),
        ],
      },
      {
        id: "mister-sinister",
        label: "Scenario #4 - Mister Sinister",
        scenario: { kind: "fixed", scenarioId: scenarioId("mister-sinister") },
        setup: [
          ...earnedEnvironments(
            "mc40.s4.setup",
            "MC40 p. 16",
            "Gather each campaign environment marked as “Earned” in the campaign log. Put those environments into play in any order.",
          ),
          teleportedAway,
          hopeDamageOrThreat("mc40.s4.setup.hope", "MC40 p. 16", "hopeDamage3", "Teleported Away"),
          ...chooseBlock(4, "mc40.s4.setup", "MC40 p. 16"),
          hpSet("mc40.s4.setup.hp-set", "MC40 p. 16"),
          healToFull("mc40.s4.setup.heal", "MC40 p. 16"),
        ],
        victory: [
          recordHopeDamage("mc40.s4.victory.hope", "MC40 p. 16", "hopeDamage4"),
          recordEnvironments(
            "mc40.s4.victory.environment",
            "MC40 p. 16",
            "Mark each campaign environment in play as “Earned” in the campaign log (if it is not already).",
          ),
          removeUndefeatedScheme(4, "mc40.s4.victory.removed"),
          hpRecord("mc40.s4.victory.hp", "MC40 p. 16"),
        ],
      },
      {
        id: "stryfe",
        label: "Scenario #5 - Stryfe",
        scenario: { kind: "fixed", scenarioId: scenarioId("stryfe") },
        setup: [
          ...earnedEnvironments(
            "mc40.s5.setup",
            "MC40 p. 18",
            "Gather each campaign environment marked as “Earned” in the campaign log. Put those environments into play in any order.",
          ),
          grasp,
          hopeDamageOrThreat("mc40.s5.setup.hope", "MC40 p. 18", "hopeDamage4", "Stryfe's Grasp"),
          discardUntilReveal,
          reshuffleDiscard,
          ...chooseBlock(5, "mc40.s5.setup", "MC40 p. 18"),
          hpSet("mc40.s5.setup.hp-set", "MC40 p. 18"),
          FOURTH_AND_FIFTH_HEAL("mc40.s5.setup.heal", "MC40 p. 18"),
        ],
        victory: [
          {
            id: "mc40.s5.victory.win",
            text: "Stryfe is defeated and the players win the campaign! Read the conclusion on the next page.",
            citation: "MC40 p. 18",
            step: { kind: "betweenGames", ops: [] },
          },
        ],
        defeat: [
          {
            id: "mc40.s5.defeat.lose-campaign",
            text: "Expert Campaign Only: If the players lose this game, Stryfe escapes into the past and the players lose the campaign.",
            citation: "MC40 p. 18",
            whenModes: { expertCampaign: true },
            step: { kind: "betweenGames", ops: [{ kind: "endCampaign", result: "lost" }] },
          },
        ],
      },
    ],
  },
};
