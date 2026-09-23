/**
 * The Galaxy's Most Wanted (MC16) — the second `CampaignDefinition` (docs/campaign-mode-design.md §11 step 7 is
 * `trors.ts`; this is the box that exercises the design's own "MC16" rows: 1, 11, 15, 23, 25, 26, 30, 31, 35, 37,
 * 38, 47, 48, 53, 55).
 *
 * Source of truth: `docs/campaign-modes/markdown/mc16_galaxys_most_wanted.md` (cited below as "MC16 p. N"),
 * cross-checked against the RRG 1.8 errata pages ("RRG 1.8 p. 67") the markdown conversion predates in two places
 * (see the header note on both). Every `CampaignInstruction` carries the citation of the printed bullet it encodes,
 * in the order that bullet is printed on its page.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * WHAT THIS BOX ASKED OF THE FOUNDATION. Six gaps, all closed in `@mc/engine` (this file is content, so none of
 * them is worked around here — see each commit's own citation of the printed sentence that forced it):
 *
 * - `CampaignOp` `composeEncounterSets` gained `into: "deck" | "setAside"`. MC16's escalating Badoon Headhunter
 *   draws (below) and its Galactic Artifacts side schemes (`nebula`'s setup) shuffle *specific* cards from a
 *   campaign-composed set into the deck one at a time — which needs those cards to already be `GameState`
 *   instances (`campaignLog`/`encounterSetAside` selectors only ever match an existing instance) without putting
 *   the *whole* set into the deck the way MC60's own `composeEncounterSets` reading does. `into: "setAside"` makes
 *   a gathered set's cards available for a later selective pick instead.
 * - `CollectionFilter.unitCostExactly`, reading `PlayerCardCommon.unitCost` (MC16 p. 5's Market price) rather than
 *   `maxPrintedCost`'s printed play cost — a different number on the same card (most Market cards print cost 0).
 * - `CampaignValue` `seatCount`/`divide` and `CampaignPredicate` `valueAtLeast`: MC16 p. 10's "1[per_hero] or
 *   fewer cards in The Collection" is a threshold that is itself computed (the seat count), which
 *   `fieldAtLeast`'s literal `amount` cannot spell, and MC16 p. 12's "for every 2 Galactic Artifacts … record 1
 *   unit" is a quotient no existing `CampaignValue` combinator produced.
 * - `CampaignGameQuery` `cardsInScenarioArea` (the `record`-side mirror of the in-game `scenarioArea` selector,
 *   MC16 p. 10's Collection), `keywordValueSum`/`capAt` (MC16 p. 8's "units equal to the victory values … to a
 *   maximum of 3" — a *sum* of the printed `Victory X` keyword, not the card count `cardsInVictoryDisplay` gives),
 *   and `atMost` (`atLeast`'s complement, for "if there are no minions in play"/"no threat on the main scheme" —
 *   there is no negation over `CampaignGameQuery` to spell `not(atLeast(…, 1))` instead).
 * - `TargetQuery.printedId`: the Campaign Challenge side schemes print the *same* title on both mode faces
 *   (16178a/16178b "Badoon Blitz", …; docs/phase7-wave3.md §1.4 emits each as its own card precisely so this can
 *   tell them apart), and revealing "the standard face" is not "a side scheme named Badoon Blitz".
 *
 * ---------------------------------------------------------------------------------------------------------------
 * TWO READINGS WORTH KNOWING ABOUT.
 *
 * 1. **The Market's "repeat this process as many times as you wish" is authored as a bounded, itemised list, not
 *    an engine loop.** `CampaignOp` has no repeat/while construct (design §4.5's closed vocabulary), and the
 *    Market is small and finite: 28 cards, exactly 4 at each of 7 price tiers (16150–16177). `marketShoppingOps`
 *    below offers each tier's remaining (`excludeGranted`) cards one at a time, up to 4 times per tier per seat —
 *    a hard ceiling on how many *physical* cards could ever be offered at that price, so it is complete (every
 *    reachable purchase set is still reachable, by declining the tiers/slots a seat doesn't want) without a loop
 *    primitive. Each slot's price is a `spend` **constant** (the tier), not "the chosen card's own price", because
 *    `campaignSet`'s `unitCostExactly` filter already guarantees every option in one slot costs the same.
 * 2. **MC16's own errata is applied, not the rulebook markdown's un-erratad wording.** RRG 1.8 p. 67: "RULEBOOK
 *    PG. 10, CAMPAIGN INSTRUCTIONS, SETUP, BULLET 5 — Should read: 'Expert Campaign Only: **When setup ends**, in
 *    player order, each player must choose 1 card from their hand and put it faceup into The Collection.'" — the
 *    conversion this file was written against has no "When setup ends", so the instruction below is windowed
 *    `afterMulligans` (RRG 1.8 Appendix II step 15, after hands are drawn) rather than the default
 *    `afterScenarioSetup`, which is what the errata's added clause means. RRG 1.8 p. 67 also errata's Kree
 *    Supremacy's reveal to "(Optional)" — already reflected in the markdown conversion this file reads, so no
 *    second reading is needed there, only the optional-reveal bridge below.
 */

import {
  cardId,
  encounterSetId,
  scenarioId,
  trait,
  type CardId,
  GMW_CAMPAIGN as GMW_CAMPAIGN_RECORD,
} from "@mc/content";
import {
  DEFAULT_CAMPAIGN_WINDOW,
  type CampaignDefinition,
  type CampaignInstruction,
  type CampaignOp,
} from "@mc/engine";
import {
  addCounters,
  attachCard,
  campaignLogAtLeast,
  campaignLogCards,
  campaignLogHas,
  campaignLogIsSet,
  campaignLogValue,
  cards,
  chosen,
  controllerOf,
  dealAsEncounterCard,
  dealEncounterCard,
  discardEncounterUntil,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  forEachPlayer,
  giveBoostCard,
  giveTough,
  heal,
  damageOn,
  identityOf,
  ifThen,
  inCampaignLogField,
  firstPlayer,
  max,
  moveCards,
  oneCopyOf,
  placeThreat,
  putIntoPlay,
  query,
  revealCard,
  selectCards,
  setRemainingHitPoints,
  shuffleEncounterDeck,
  theMainScheme,
  theVillain,
  thatPlayer,
} from "../dsl/index.js";

// The same sentinel `@mc/engine`'s `random`-with-`optional` uses for "yes, take it" (`CAMPAIGN_ACCEPT`), reused
// here for a plain optional `choose` over a single non-card option: MC16 prints two binary "may you …?" setup
// decisions with no card involved (heal to printed HP, reveal Kree Supremacy), and `cards.cardIds` wants a
// `CardId` even though this option names no real card — `cardId()` is a brand, not a lookup.
const CAMPAIGN_ACCEPT = cardId("accept");

// --- sets ---------------------------------------------------------------------------------------------------
const THE_MARKET = encounterSetId("the_market");
const CHALLENGE = encounterSetId("challenge");
const BADOON_HEADHUNTER_SET = encounterSetId("badoon_headhunter");
const GALACTIC_ARTIFACTS_SET = encounterSetId("galactic_artifacts");

// --- Campaign Challenge side schemes (MC16 p. 4/p. 8/p. 10/p. 12/p. 14/p. 18): standard (a) / expert (b) faces --
const BADOON_BLITZ = { a: cardId("16178a"), b: cardId("16178b") };
const GALLERY_OF_SPLENDOR = { a: cardId("16179a"), b: cardId("16179b") };
const THERE_IS_NO_ESCAPE = { a: cardId("16180a"), b: cardId("16180b") };
const GUERRILLA_TACTICS = { a: cardId("16181a"), b: cardId("16181b") };
const KREE_SUPREMACY = { a: cardId("16182a"), b: cardId("16182b") };

// --- Badoon Headhunter set (MC16 p. 4/p. 8): the escalating ladder, in the order "Headhunter Defeated?" unlocks --
const BADOON_HEADHUNTER = cardId("16183");
const ON_THE_HUNT = cardId("16184");
const DEAD_TO_RIGHTS = cardId("16185");
const HEADHUNTERS_HENCHMAN = cardId("16186");
const FUGITIVE_RECOVERY = cardId("16187");

// --- Galactic Artifacts side schemes MC16 p. 14 names by title (raw "Hujahdarian", not the rulebook's "Hujadarian") --
const HUJAHDARIAN_MONARCH_EGG = cardId("16127");
const MAGICAL_TEAPOT = cardId("16128");
const PHILOSOPHERS_STONE = cardId("16129");
const CRYSTAL_BALL = cardId("16130");

// --- Scenario 5's own encounter set (already part of `ronan`'s base build; found by name, not campaign-composed) --
const YOU_STAND_ACCUSED = cardId("16116");
const PINCER_MANEUVER = cardId("16112");

// --- Main scheme stage cards a victory bullet checks by id (RRG 1.8 doesn't name a stage; the card does) --
const TERRESTRIAL_INVASION_1B = cardId("16061b");
const ART_OF_EVASION_1B = cardId("16091b");

const NEBULAS_SHIP_QUERY = query(["environment"], { name: "Nebula's Ship" });
const NEBULAS_SHIP = each(NEBULAS_SHIP_QUERY);
const TECHNIQUE = trait("TECHNIQUE");

/**
 * Every campaign scenario composes both campaign-only encounter sets as set-aside pool cards (see the file header
 * gap note on `composeEncounterSets`' `into`): the Campaign Challenge side scheme this scenario reveals, and
 * whichever Badoon Headhunter cards its own setup shuffles in. `nebula` additionally composes Galactic Artifacts.
 */
function composition(prefix: string, citation: string, extraSets: readonly string[] = []): CampaignInstruction {
  return {
    id: `${prefix}.composition.sets`,
    text: "(Not printed: makes this scenario's Campaign Challenge side scheme and Badoon Headhunter cards available to its own setup instructions below.)",
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        {
          kind: "composeEncounterSets",
          sets: [
            { kind: "const", value: CHALLENGE },
            { kind: "const", value: BADOON_HEADHUNTER_SET },
            ...extraSets.map((set) => ({ kind: "const" as const, value: set })),
          ],
          into: "setAside",
        },
      ],
    },
  };
}

/** MC16 p. 4/p. 8, printed on every scenario's setup list: "Reveal the [X] side scheme (use the reverse side for expert mode)." */
function revealChallengeSideScheme(
  prefix: string,
  citation: string,
  name: string,
  faces: { readonly a: CardId; readonly b: CardId },
): readonly CampaignInstruction[] {
  const reveal = (face: CardId) => [
    selectCards("challenge", encounterSetAside(query([], { printedId: face }))),
    revealCard(chosen("challenge"), firstPlayer),
  ];
  return [
    {
      id: `${prefix}.setup.reveal-standard`,
      text: `Reveal the ${name} side scheme.`,
      citation,
      whenModes: { expert: false },
      step: { kind: "inGame", window: DEFAULT_CAMPAIGN_WINDOW, effects: reveal(faces.a) },
    },
    {
      id: `${prefix}.setup.reveal-expert`,
      text: `Reveal the ${name} side scheme (use the reverse side for expert mode).`,
      citation,
      whenModes: { expert: true },
      step: { kind: "inGame", window: DEFAULT_CAMPAIGN_WINDOW, effects: reveal(faces.b) },
    },
  ];
}

/**
 * MC16 p. 8/p. 10/p. 12/p. 14/p. 18: "Shuffle the Badoon Headhunter (183) minion into the encounter deck. Then,
 * if the number of marks in the 'Headhunter Defeated?' section … is equal to or greater than: (1) …(2)…" —
 * `maxTier` is how far this scenario's own printed list goes (1 for scenario 1, up to 4 for scenario 5).
 */
function headhunterLadder(prefix: string, citation: string, maxTier: 0 | 1 | 2 | 3 | 4): CampaignInstruction {
  const rungs: readonly [number, CardId][] = [
    [1, ON_THE_HUNT],
    [2, DEAD_TO_RIGHTS],
    [3, HEADHUNTERS_HENCHMAN],
    [4, FUGITIVE_RECOVERY],
  ];
  return {
    id: `${prefix}.setup.headhunter`,
    text: "Shuffle the Badoon Headhunter (183) minion into the encounter deck. Then, if the number of marks in the “Headhunter Defeated?” section of the campaign log is equal to or greater than the listed number, shuffle that card into the encounter deck as well.",
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        moveCards(encounterSetAside(query([], { printedId: BADOON_HEADHUNTER })), "encounterDeckShuffle"),
        ...rungs
          .filter(([tier]) => tier <= maxTier)
          .map(([tier, id]) =>
            ifThen(
              campaignLogAtLeast("headhunterDefeated", tier),
              moveCards(encounterSetAside(query([], { printedId: id })), "encounterDeckShuffle"),
            ),
          ),
      ],
    },
  };
}

/** MC16 p. 8/p. 10/p. 12/p. 14: "If Badoon Headhunter is in the victory display, mark the box …" — a count, not a checkbox grid. */
function headhunterRecordVictory(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "If Badoon Headhunter is in the victory display, mark the box beside this scenario in the “Headhunter Defeated?” section.",
    citation,
    step: {
      kind: "record",
      writes: [
        {
          field: "headhunterDefeated",
          mode: "add",
          value: {
            kind: "atLeast",
            of: { kind: "cardsInVictoryDisplay", query: { name: "Badoon Headhunter" } },
            amount: 1,
          },
        },
      ],
    },
  };
}

/**
 * MC16 p. 10/p. 12/p. 14/p. 18, printed identically: "Expert Campaign Only: Set each player's hit points to their
 * remaining hit point value recorded in the campaign log for the previous scenario." Not printed on scenario 1,
 * which has nothing recorded yet.
 */
function hpSetSetup(prefix: string, citation: string): CampaignInstruction {
  return {
    id: `${prefix}.setup.hp-set`,
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
  };
}

/**
 * MC16 p. 10/p. 12/p. 14/p. 18, printed identically: "Expert Campaign Only: Each player may subtract 1 unit from
 * their respective 'Unspent Units' box … to heal their identity to its printed hit point value." Two instructions
 * for one printed sentence, the same split `trors.ts`'s `obligationSetup` uses: the spend and the heal are on
 * opposite sides of the game boundary. `healedFull` is cleared first so a declined offer this scenario cannot
 * read as last scenario's acceptance.
 */
function healSetup(prefix: string, citation: string): readonly CampaignInstruction[] {
  return [
    {
      id: `${prefix}.setup.heal-spend`,
      text: "Expert Campaign Only: Each player may subtract 1 unit from their respective “Unspent Units” box in the campaign log to heal their identity to its printed hit point value.",
      citation,
      whenModes: { expertCampaign: true },
      step: {
        kind: "betweenGames",
        ops: [
          {
            kind: "forEachSeat",
            ops: [
              { kind: "clearField", field: "healedFull", seat: "self" },
              {
                kind: "if",
                when: { kind: "fieldAtLeast", field: "units", amount: 1, seat: "self" },
                then: [
                  {
                    kind: "choose",
                    slot: "heal",
                    chooser: "eachSeat",
                    optional: true,
                    from: { kind: "cards", cardIds: [CAMPAIGN_ACCEPT] },
                  },
                  {
                    kind: "if",
                    when: { kind: "choiceMade", slot: "heal" },
                    then: [
                      { kind: "spend", field: "units", seat: "self", amount: { kind: "const", value: 1 } },
                      { kind: "setField", field: "healedFull", seat: "self", value: { kind: "const", value: true } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      id: `${prefix}.setup.heal-effect`,
      text: "(The heal half of the same sentence: each player who paid the unit begins this scenario at their full hit point value.)",
      citation,
      whenModes: { expertCampaign: true },
      step: {
        kind: "inGame",
        window: DEFAULT_CAMPAIGN_WINDOW,
        effects: [
          forEachPlayer(
            eachPlayer,
            ifThen(
              campaignLogIsSet("healedFull", true, { seat: thatPlayer }),
              heal(damageOn(identityOf(thatPlayer)), identityOf(thatPlayer)),
            ),
          ),
        ],
      },
    },
  ];
}

/** MC16 p. 8/p. 10/p. 12/p. 14, printed identically: "Expert Campaign Only: Record each identity's remaining hit points." */
function hpRecordVictory(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Expert Campaign Only: Record each identity's remaining hit points in the campaign log.",
    citation,
    whenModes: { expertCampaign: true },
    step: {
      kind: "record",
      writes: [{ field: "remainingHp", seat: "each", mode: "set", value: { kind: "remainingHitPointsCappedAtBase" } }],
    },
  };
}

/**
 * MC16 p. 5: "Between scenarios, players can spend the units recorded in their campaign log to add cards from The
 * Market to their deck … You may repeat this process as many times as you wish (until you have no units
 * remaining)." See the file header's reading note: one `if`/`choose`/`spend`/`grantCard` group per remaining
 * physical Market card at each of the 7 price tiers (4 cards per tier, 16150–16177), offered cheapest first.
 * `excludeGranted` (group-wide, per `campaignSet`'s own doc) is what makes a card taken by an earlier seat or an
 * earlier slot this same seat unavailable to every slot after it.
 */
function marketShoppingSetup(prefix: string, citation: string): CampaignInstruction {
  const seatOps: CampaignOp[] = [];
  for (let tier = 1; tier <= 7; tier++) {
    for (let copy = 0; copy < 4; copy++) {
      const slot = `market-${tier}-${copy}`;
      seatOps.push({
        kind: "if",
        when: { kind: "fieldAtLeast", field: "units", amount: tier, seat: "self" },
        then: [
          {
            kind: "choose",
            slot,
            chooser: "eachSeat",
            optional: true,
            from: {
              kind: "campaignSet",
              encounterSetId: THE_MARKET,
              excludeGranted: true,
              filter: { unitCostExactly: tier },
            },
          },
          {
            kind: "if",
            when: { kind: "choiceMade", slot },
            then: [
              { kind: "spend", field: "units", seat: "self", amount: { kind: "const", value: tier } },
              { kind: "grantCard", seat: "self", card: { kind: "choice", slot }, permanence: "campaign" },
              { kind: "appendToList", field: "marketCards", seat: "self", value: { kind: "choice", slot } },
            ],
          },
        ],
      });
    }
  }
  return {
    id: `${prefix}.setup.market`,
    text: "Between scenarios, players can spend the units recorded in their campaign log to add cards from The Market to their deck. Only one copy of each card from The Market can be used during a campaign for the players as a group.",
    citation,
    step: { kind: "betweenGames", ops: [{ kind: "forEachSeat", ops: seatOps }] },
  };
}

export const GMW_CAMPAIGN_DEFINITION: CampaignDefinition = {
  campaignId: GMW_CAMPAIGN_RECORD.id,
  version: "1",
  logFields: [
    { id: "units", label: "Unspent Units", scope: "perSeat", type: { kind: "number", min: 0 }, citation: "MC16 p. 5" },
    {
      id: "marketCards",
      label: "Market Cards in Player's Deck",
      scope: "perSeat",
      type: { kind: "cardList" },
      citation: "MC16 p. 5",
    },
    {
      id: "remainingHp",
      label: "Remaining hit points",
      scope: "perSeat",
      type: { kind: "number", min: 0 },
      whenModes: { expertCampaign: true },
      citation: "MC16 p. 5",
    },
    // Written and read within one scenario's setup: cleared first so the previous scenario's "yes" cannot leak.
    {
      id: "healedFull",
      label: "Healed to printed hit points this scenario",
      scope: "perSeat",
      type: { kind: "flag" },
      whenModes: { expertCampaign: true },
      citation: "MC16 p. 10",
    },
    {
      id: "headhunterDefeated",
      label: "Headhunter Defeated?",
      scope: "shared",
      type: { kind: "number", min: 0, max: 4 },
      citation: "MC16 p. 8",
    },
    {
      id: "galacticArtifacts",
      label: "Galactic Artifacts Side Schemes in the Victory Display",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC16 p. 12",
    },
    {
      id: "collection",
      label: "Cards in The Collection",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC16 p. 10",
    },
    // The bare count behind "1[per_hero] or fewer": no printed column, read once by the very next instruction.
    {
      id: "collectionCount",
      label: "Cards in The Collection (count)",
      scope: "shared",
      type: { kind: "number", min: 0 },
      citation: "MC16 p. 10",
    },
    {
      id: "powerStoneControl",
      label: "Power Stone Control",
      scope: "shared",
      type: { kind: "cardRef" },
      citation: "MC16 p. 15",
    },
    {
      id: "evasionCounters",
      label: "Evasion Counters",
      scope: "shared",
      type: { kind: "number", min: 0 },
      citation: "MC16 p. 15",
    },
    // "(Optional)" reveal (RRG 1.8 p. 67 errata) is a group decision bridged the same way `healedFull` is.
    {
      id: "kreeSupremacyRevealed",
      label: "Kree Supremacy revealed",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC16 p. 18",
    },
  ],
  // MC16 p. 4: "If the players lost, they may reset the scenario and try again with no penalty" — for every
  // scenario except one Expert Campaign Only exception on Ronan (MC16 p. 18), the same shape `trors.ts` uses.
  loss: { retry: "byInstruction", retryBaseline: "nodeStart" },
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "brotherhood-of-badoon",
        label: "Scenario #1 - Brotherhood of Badoon",
        scenario: { kind: "fixed", scenarioId: scenarioId("brotherhood-of-badoon") },
        composition: [composition("mc16.s1", "MC16 p. 8")],
        setup: [
          {
            id: "mc16.s1.setup.identity",
            text: "Each player records their identity in the campaign log found on pages 22 and 23 of this rulebook. (Players cannot switch identities during a campaign.)",
            citation: "MC16 p. 8",
            // Already true the moment the log exists (see `trors.ts`'s own note on this bullet).
            step: { kind: "betweenGames", ops: [] },
          },
          ...revealChallengeSideScheme("mc16.s1", "MC16 p. 8", "Badoon Blitz", BADOON_BLITZ),
          headhunterLadder("mc16.s1", "MC16 p. 8", 0),
          {
            id: "mc16.s1.setup.expert-minion",
            text: "Expert Campaign Only: In player order, each player must discard cards from the top of the encounter deck until they discard a minion, then put that minion into play engaged with them.",
            citation: "MC16 p. 8",
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                forEachPlayer(eachPlayer, [
                  discardEncounterUntil(query(["minion"]), "foundMinion"),
                  putIntoPlay(chosen("foundMinion"), thatPlayer),
                ]),
              ],
            },
          },
        ],
        victory: [
          {
            id: "mc16.s1.victory.units",
            text: "Record units in each player's “Unspent Units” box: 1 for each player; up to 3 equal to the victory values on encounter cards in the victory display; 1 if there are no minions in play; 1 if the main scheme is on stage 1B (Terrestrial Invasion).",
            citation: "MC16 p. 8",
            step: {
              kind: "record",
              writes: [
                { field: "units", seat: "each", mode: "add", value: { kind: "const", value: 1 } },
                {
                  field: "units",
                  seat: "each",
                  mode: "add",
                  value: { kind: "capAt", of: { kind: "keywordValueSum", query: {}, keyword: "victory" }, amount: 3 },
                },
                {
                  field: "units",
                  seat: "each",
                  mode: "add",
                  value: { kind: "atMost", of: { kind: "cardsInPlay", query: { categories: ["minion"] } }, amount: 0 },
                },
                {
                  field: "units",
                  seat: "each",
                  mode: "add",
                  value: {
                    kind: "atLeast",
                    of: {
                      kind: "cardsInPlay",
                      query: { categories: ["mainScheme"], printedId: TERRESTRIAL_INVASION_1B },
                    },
                    amount: 1,
                  },
                },
              ],
            },
          },
          headhunterRecordVictory("mc16.s1.victory.headhunter", "MC16 p. 8"),
          hpRecordVictory("mc16.s1.victory.hp", "MC16 p. 8"),
        ],
      },
      {
        id: "infiltrate-the-museum",
        label: "Scenario #2 - Infiltrate the Museum",
        scenario: { kind: "fixed", scenarioId: scenarioId("infiltrate-the-museum") },
        composition: [composition("mc16.s2", "MC16 p. 10")],
        setup: [
          marketShoppingSetup("mc16.s2", "MC16 p. 5"),
          ...revealChallengeSideScheme("mc16.s2", "MC16 p. 10", "Gallery of Splendor", GALLERY_OF_SPLENDOR),
          headhunterLadder("mc16.s2", "MC16 p. 10", 1),
          hpSetSetup("mc16.s2", "MC16 p. 10"),
          ...healSetup("mc16.s2", "MC16 p. 10"),
          {
            id: "mc16.s2.setup.collection",
            text: "Expert Campaign Only: When setup ends, in player order, each player must choose 1 card from their hand and put it faceup into The Collection.",
            // RRG 1.8 p. 67 errata: "Added 'When setup ends'" — see the file header's second reading note.
            citation: "RRG 1.8 p. 67 errata; MC16 p. 10 bullet 5",
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: "afterMulligans",
              effects: [
                forEachPlayer(eachPlayer, [
                  {
                    kind: "chooseCards",
                    slot: "toCollection",
                    from: { kind: "zone", zone: "hand", player: thatPlayer },
                    chooser: thatPlayer,
                    min: 1,
                    max: 1,
                  },
                  moveCards(cards(chosen("toCollection")), { scenarioArea: "The Collection" }),
                ]),
              ],
            },
          },
        ],
        victory: [
          {
            id: "mc16.s2.victory.units",
            text: "Record units in each player's “Unspent Units” box (add to units already held): 1 for each player; up to 3 equal to the victory values on encounter cards in the victory display; 1 if there is no threat on the main scheme; the title of each player card in The Collection.",
            citation: "MC16 p. 10",
            step: {
              kind: "record",
              writes: [
                { field: "units", seat: "each", mode: "add", value: { kind: "const", value: 1 } },
                {
                  field: "units",
                  seat: "each",
                  mode: "add",
                  value: { kind: "capAt", of: { kind: "keywordValueSum", query: {}, keyword: "victory" }, amount: 3 },
                },
                {
                  field: "units",
                  seat: "each",
                  mode: "add",
                  value: { kind: "atMost", of: { kind: "threatOn", query: { categories: ["mainScheme"] } }, amount: 0 },
                },
                {
                  field: "collection",
                  mode: "append",
                  value: {
                    kind: "cardsInScenarioArea",
                    name: "The Collection",
                    query: { categories: ["ally", "support", "upgrade"] },
                  },
                },
                {
                  field: "collectionCount",
                  mode: "set",
                  value: {
                    kind: "count",
                    of: {
                      kind: "cardsInScenarioArea",
                      name: "The Collection",
                      query: { categories: ["ally", "support", "upgrade"] },
                    },
                  },
                },
              ],
            },
          },
          {
            id: "mc16.s2.victory.collection-bonus",
            text: "Record 1 unit for each player if there are 1[per_hero] or fewer cards in The Collection.",
            citation: "MC16 p. 10",
            step: {
              kind: "betweenGames",
              ops: [
                {
                  kind: "if",
                  // "N or fewer" is `count <= seatCount`, i.e. `NOT(count >= seatCount + 1)`.
                  when: {
                    kind: "not",
                    of: {
                      kind: "valueAtLeast",
                      value: { kind: "field", field: "collectionCount" },
                      amount: { kind: "sum", of: [{ kind: "seatCount" }, { kind: "const", value: 1 }] },
                    },
                  },
                  then: [
                    {
                      kind: "forEachSeat",
                      ops: [{ kind: "addToField", field: "units", seat: "self", value: { kind: "const", value: 1 } }],
                    },
                  ],
                },
              ],
            },
          },
          headhunterRecordVictory("mc16.s2.victory.headhunter", "MC16 p. 10"),
          hpRecordVictory("mc16.s2.victory.hp", "MC16 p. 10"),
        ],
      },
      {
        id: "escape-the-museum",
        label: "Scenario #3 - Escape the Museum",
        scenario: { kind: "fixed", scenarioId: scenarioId("escape-the-museum") },
        composition: [composition("mc16.s3", "MC16 p. 12")],
        setup: [
          marketShoppingSetup("mc16.s3", "MC16 p. 5"),
          ...revealChallengeSideScheme("mc16.s3", "MC16 p. 12", "“There Is No Escape”", THERE_IS_NO_ESCAPE),
          {
            id: "mc16.s3.setup.collection-remove",
            text: "Each player must search their deck, discard pile, and hand for each of their cards recorded in the “Cards in The Collection” section of the campaign log, then remove those cards from the game. Each player draws up to their hand size.",
            citation: "MC16 p. 12",
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                moveCards(campaignLogCards("collection"), "removedFromGame"),
                forEachPlayer(eachPlayer, {
                  kind: "drawUpTo",
                  player: thatPlayer,
                  amount: { kind: "handSize", player: thatPlayer },
                }),
              ],
            },
          },
          headhunterLadder("mc16.s3", "MC16 p. 12", 2),
          hpSetSetup("mc16.s3", "MC16 p. 12"),
          ...healSetup("mc16.s3", "MC16 p. 12"),
          {
            id: "mc16.s3.setup.expert-attachment",
            text: "Expert Campaign Only: In player order, each player must discard cards from the top of the encounter deck until they discard an attachment, then reveal that card.",
            citation: "MC16 p. 12",
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                forEachPlayer(eachPlayer, [
                  discardEncounterUntil(query(["attachment"]), "foundAttachment"),
                  revealCard(chosen("foundAttachment"), thatPlayer),
                ]),
              ],
            },
          },
        ],
        victory: [
          {
            id: "mc16.s3.victory.units",
            text: "Record units in each player's “Unspent Units” box (add to units already held): 1 for each player; up to 3 equal to the victory values on encounter cards in the victory display; record the title of each Galactic Artifacts side scheme in the victory display.",
            citation: "MC16 p. 12",
            step: {
              kind: "record",
              writes: [
                { field: "units", seat: "each", mode: "add", value: { kind: "const", value: 1 } },
                {
                  field: "units",
                  seat: "each",
                  mode: "add",
                  value: { kind: "capAt", of: { kind: "keywordValueSum", query: {}, keyword: "victory" }, amount: 3 },
                },
                ...[HUJAHDARIAN_MONARCH_EGG, MAGICAL_TEAPOT, PHILOSOPHERS_STONE, CRYSTAL_BALL].map((name) => ({
                  field: "galacticArtifacts",
                  mode: "append" as const,
                  value: {
                    kind: "cardsInVictoryDisplay" as const,
                    query: { categories: ["sideScheme"] as const, printedId: name },
                  },
                })),
              ],
            },
          },
          {
            id: "mc16.s3.victory.artifact-bonus",
            text: "For every 2 Galactic Artifacts side schemes in the victory display, record 1 unit for each player.",
            citation: "MC16 p. 12",
            step: {
              kind: "betweenGames",
              ops: [
                {
                  kind: "forEachSeat",
                  ops: [
                    {
                      kind: "addToField",
                      field: "units",
                      seat: "self",
                      value: {
                        kind: "divide",
                        of: { kind: "count", field: "galacticArtifacts" },
                        by: 2,
                        round: "down",
                      },
                    },
                  ],
                },
              ],
            },
          },
          headhunterRecordVictory("mc16.s3.victory.headhunter", "MC16 p. 12"),
          hpRecordVictory("mc16.s3.victory.hp", "MC16 p. 12"),
        ],
      },
      {
        id: "nebula",
        label: "Scenario #4 - Nebula",
        scenario: { kind: "fixed", scenarioId: scenarioId("nebula") },
        composition: [composition("mc16.s4", "MC16 p. 14", [GALACTIC_ARTIFACTS_SET])],
        setup: [
          marketShoppingSetup("mc16.s4", "MC16 p. 5"),
          ...revealChallengeSideScheme("mc16.s4", "MC16 p. 14", "Guerrilla Tactics", GUERRILLA_TACTICS),
          {
            id: "mc16.s4.setup.artifacts",
            text: "Shuffle each Galactic Artifacts side scheme recorded in the “Galactic Artifacts Side Schemes in the Victory Display” section of the campaign log into the encounter deck. Perform the following for each specified side scheme shuffled in this way: Hujadarian Monarch Egg: place 1 evasion counter on Nebula's Ship. Magical Teapot: deal the first player 1 facedown encounter card. Philosopher's Stone: give Nebula 1 facedown boost card. Crystal Ball: give Nebula a tough status card.",
            citation: "MC16 p. 14",
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                moveCards(campaignLogCards("galacticArtifacts"), "encounterDeckShuffle"),
                ifThen(
                  campaignLogHas("galacticArtifacts", HUJAHDARIAN_MONARCH_EGG),
                  addCounters("evasion", 1, NEBULAS_SHIP),
                ),
                ifThen(campaignLogHas("galacticArtifacts", MAGICAL_TEAPOT), dealEncounterCard(firstPlayer)),
                ifThen(campaignLogHas("galacticArtifacts", PHILOSOPHERS_STONE), giveBoostCard(theVillain)),
                ifThen(campaignLogHas("galacticArtifacts", CRYSTAL_BALL), giveTough(theVillain)),
              ],
            },
          },
          headhunterLadder("mc16.s4", "MC16 p. 14", 3),
          hpSetSetup("mc16.s4", "MC16 p. 14"),
          ...healSetup("mc16.s4", "MC16 p. 14"),
          {
            id: "mc16.s4.setup.expert-technique",
            text: "Expert Campaign Only: Discard cards from the top of the encounter deck until a Technique attachment is discarded this way, then attach that card to Nebula.",
            citation: "MC16 p. 14",
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                discardEncounterUntil(query(["attachment"], { trait: TECHNIQUE }), "foundTechnique"),
                attachCard(chosen("foundTechnique"), theVillain),
              ],
            },
          },
        ],
        victory: [
          {
            id: "mc16.s4.victory.units",
            text: "Record units in each player's “Unspent Units” box (add to units already held): 1 for each player; up to 3 equal to the victory values on encounter cards in the victory display; 1 if there are 1 or fewer evasion counters on Nebula's Ship; 1 if the main scheme is on stage 1B (The Art of Evasion).",
            citation: "MC16 p. 14/p. 15",
            step: {
              kind: "record",
              writes: [
                { field: "units", seat: "each", mode: "add", value: { kind: "const", value: 1 } },
                {
                  field: "units",
                  seat: "each",
                  mode: "add",
                  value: { kind: "capAt", of: { kind: "keywordValueSum", query: {}, keyword: "victory" }, amount: 3 },
                },
                {
                  field: "units",
                  seat: "each",
                  mode: "add",
                  value: {
                    kind: "atMost",
                    of: { kind: "countersOn", query: NEBULAS_SHIP_QUERY, counter: "evasion" },
                    amount: 1,
                  },
                },
                {
                  field: "units",
                  seat: "each",
                  mode: "add",
                  value: {
                    kind: "atLeast",
                    of: { kind: "cardsInPlay", query: { categories: ["mainScheme"], printedId: ART_OF_EVASION_1B } },
                    amount: 1,
                  },
                },
              ],
            },
          },
          headhunterRecordVictory("mc16.s4.victory.headhunter", "MC16 p. 15"),
          {
            id: "mc16.s4.victory.power-stone",
            text: "If the Power Stone is attached to an identity, record that identity's name in the “Power Stone Control” section. Record the number of evasion counters on Nebula's Ship in the “Evasion Counters” section.",
            citation: "MC16 p. 15",
            step: {
              kind: "record",
              writes: [
                {
                  field: "powerStoneControl",
                  mode: "set",
                  value: {
                    kind: "cardsInPlay",
                    query: { categories: ["identity"], hasAttachment: { name: "Power Stone" } },
                  },
                },
                {
                  field: "evasionCounters",
                  mode: "set",
                  value: { kind: "countersOn", query: NEBULAS_SHIP_QUERY, counter: "evasion" },
                },
              ],
            },
          },
          hpRecordVictory("mc16.s4.victory.hp", "MC16 p. 15"),
        ],
      },
      {
        id: "ronan-the-accuser",
        label: "Scenario #5 - Ronan the Accuser",
        scenario: { kind: "fixed", scenarioId: scenarioId("ronan-the-accuser") },
        composition: [composition("mc16.s5", "MC16 p. 18")],
        setup: [
          marketShoppingSetup("mc16.s5", "MC16 p. 5"),
          {
            id: "mc16.s5.setup.kree-decide",
            text: "(Optional) Reveal the Kree Supremacy side scheme (use the reverse side for expert mode).",
            citation: "RRG 1.8 p. 67 errata; MC16 p. 18",
            step: {
              kind: "betweenGames",
              ops: [
                { kind: "clearField", field: "kreeSupremacyRevealed" },
                {
                  kind: "choose",
                  slot: "kree",
                  chooser: "group",
                  optional: true,
                  from: { kind: "cards", cardIds: [CAMPAIGN_ACCEPT] },
                },
                {
                  kind: "if",
                  when: { kind: "choiceMade", slot: "kree" },
                  then: [{ kind: "setField", field: "kreeSupremacyRevealed", value: { kind: "const", value: true } }],
                },
              ],
            },
          },
          {
            id: "mc16.s5.setup.kree-reveal-standard",
            text: "(Optional) Reveal the Kree Supremacy side scheme.",
            citation: "RRG 1.8 p. 67 errata; MC16 p. 18",
            whenModes: { expert: false },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                ifThen(campaignLogIsSet("kreeSupremacyRevealed", true), [
                  selectCards("kree", encounterSetAside(query([], { printedId: KREE_SUPREMACY.a }))),
                  revealCard(chosen("kree"), firstPlayer),
                ]),
              ],
            },
          },
          {
            id: "mc16.s5.setup.kree-reveal-expert",
            text: "(Optional) Reveal the Kree Supremacy side scheme (use the reverse side for expert mode).",
            citation: "RRG 1.8 p. 67 errata; MC16 p. 18",
            whenModes: { expert: true },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                ifThen(campaignLogIsSet("kreeSupremacyRevealed", true), [
                  selectCards("kree", encounterSetAside(query([], { printedId: KREE_SUPREMACY.b }))),
                  revealCard(chosen("kree"), firstPlayer),
                ]),
              ],
            },
          },
          {
            id: "mc16.s5.setup.you-stand-accused",
            text: "If a player's identity was recorded in the “Power Stone Control” section of the campaign log, search the encounter deck and discard pile for one copy of the “You Stand Accused!” (116) treachery, then deal that card to that player as a facedown encounter card.",
            citation: "MC16 p. 18",
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                ifThen(campaignLogIsSet("powerStoneControl", true), [
                  selectCards(
                    "accused",
                    oneCopyOf(encounterCards(["deck", "discard"], { printedId: YOU_STAND_ACCUSED })),
                  ),
                  dealAsEncounterCard(
                    chosen("accused"),
                    controllerOf(each(query(["identity"], inCampaignLogField("powerStoneControl")))),
                  ),
                  shuffleEncounterDeck(),
                ]),
              ],
            },
          },
          {
            id: "mc16.s5.setup.pincer-maneuver",
            text: "Search the encounter deck and discard pile for one copy of the Pincer Maneuver (112) side scheme and reveal it. Place X[per_hero] additional threat on Pincer Maneuver, where X is equal to 3 minus the recorded number in the Evasion Counters section of the campaign log.",
            citation: "MC16 p. 18",
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                selectCards("pincer", oneCopyOf(encounterCards(["deck", "discard"], { printedId: PINCER_MANEUVER }))),
                revealCard(chosen("pincer"), firstPlayer),
                shuffleEncounterDeck(),
                forEachPlayer(
                  eachPlayer,
                  placeThreat(
                    max(0, { kind: "scaled", value: campaignLogValue("evasionCounters"), times: -1, plus: 3 }),
                    chosen("pincer"),
                  ),
                ),
              ],
            },
          },
          headhunterLadder("mc16.s5", "MC16 p. 18", 4),
          hpSetSetup("mc16.s5", "MC16 p. 18"),
          ...healSetup("mc16.s5", "MC16 p. 18"),
          {
            id: "mc16.s5.setup.expert-threat",
            text: "Expert Campaign Only: Place an additional 1[per_hero] threat on the main scheme.",
            citation: "MC16 p. 18",
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [forEachPlayer(eachPlayer, placeThreat(1, theMainScheme))],
            },
          },
        ],
        victory: [
          {
            id: "mc16.s5.victory.win",
            text: "Ronan the Accuser is defeated and the players win the campaign! Read the conclusion on the next page!",
            citation: "MC16 p. 18",
            // Purely narrative, the same as `trors.ts`'s Red Skull: `advanceAfterWin` marks the last node and ends
            // the campaign "won" once every node is completed.
            step: { kind: "betweenGames", ops: [] },
          },
        ],
        defeat: [
          {
            id: "mc16.s5.defeat.lose-campaign",
            text: "Expert Campaign Only: If the players lose this game, Ronan the Accuser claims the Power Stone and the players lose the campaign.",
            citation: "MC16 p. 18",
            whenModes: { expertCampaign: true },
            step: { kind: "betweenGames", ops: [{ kind: "endCampaign", result: "lost" }] },
          },
        ],
      },
    ],
  },
};
