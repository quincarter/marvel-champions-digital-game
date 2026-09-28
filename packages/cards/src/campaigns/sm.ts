/**
 * Sinister Motives (MC27) — the fourth `CampaignDefinition` (after `trors.ts`, `gmw.ts`, `mts.ts`), and the first
 * box with a reputation track rather than a flag pool or a unit currency.
 *
 * Source of truth: `docs/campaign-modes/markdown/mc27_sinister_motives.md` (cited below as "MC27 p. N"; the
 * reputation track's own node/box layout on p. 22 was reconstructed from the PDF's vector drawing, per
 * `docs/phase7-wave5.md` §0/§2.3) and `docs/phase7-wave5.md` §2.3's own summary table. Every `CampaignInstruction`
 * carries the citation of the printed bullet it encodes, in the order that bullet is printed on its page.
 * `docs/phase7-wave5.md` §3.27 (landed 2026-09-26, 3be41be1) built exactly the reputation-marking vocabulary this
 * file uses (`packages/engine/src/campaign/sm-queries.test.ts`'s `REPUTATION_VICTORY`/`REPUTATION_CAMPAIGN`,
 * reused here nearly verbatim with real card/field names) and named this file as its own step 6.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * REPUTATION TRACK MODELING. MC27 p. 5: "Whenever a node connected to a **white box** is marked, resolve the
 * effects of that box immediately. Whenever a node connected to a **pink box** is marked, the Setup instructions
 * in that box will trigger at the beginning of each remaining scenario" (confirmed by every scenario's own setup
 * bullet, "Follow all 'Setup' instructions … for any marked nodes"). Read box-by-box (MC27 p. 22) rather than by
 * white/pink color (not transcribed per-node): **a bullet printed with a "Setup:" label is a pink, repeating
 * instruction; everything else in a box is a white, one-time effect resolved the instant its node crosses** — this
 * reading is confirmed by node 5's reward, whose printed sentence names no "Setup:" label ("During … game setup,
 * each player may take 1 additional mulligan") but is decided to behave like a pink box anyway (`docs/phase7-
 * wave5.md` §4.1 Q19: "marking node 5 appends a conditional instruction applied at every remaining scenario's
 * setup, like a pink box"), because its own effect is only meaningful *at* a future scenario's setup, the same
 * test a "Setup:" label would encode. Every pink (and node 5's reward) is authored as a `conditionalInstructions`
 * entry appended to `reputationSetups`, an `instructionList` field the runner resolves automatically at every
 * remaining scenario's setup (`runner.ts`'s `conditionalInstructions`) — so **no scenario needs to spell out "run
 * the appended reputation Setup instructions" itself**; the printed sentence to that effect is realized by the
 * engine, not authored as a `CampaignInstruction` here.
 *
 * The "(starting at the topmost unmarked node …)" marking order and the negative-victory-points clamp (ruling Aug
 * 3, 2026 (4) #2) are `sm-queries.test.ts`'s own `crossed(n)`/`clampAtZero` pattern, reused unchanged.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * SKIPPED (engine gaps; see the report this file's own commit/PR cites, and the module-level TODOs beside each).
 * Gaps 1, 2, 4 and 5 are closed and kept here, numbered as before, because comments below cite the others by number.
 * Nothing below is worked around with a near-miss effect — each is left unauthored, with the printed text kept as
 * a comment so it can be picked up the moment the primitive exists:
 *
 * 1. *(Closed.)* **"Deal 3 … at random to a player. That player may choose 1 …" (node 1's reward, MC27 p. 22)**
 *    is authored in `sm.reputation.mark`: a `random` (count 3) into a per-seat slot, then a `choose` from
 *    `CampaignChoiceSource` `values(choice(slot))`, so the dealt three are the only options.
 * 2. *(Closed.)* **"Put the Venom (190) ally card into play …" (scenarios 3 and 4, MC27 p. 13/15), "… put a
 *    Helicarrier … into play …" (node 21's reward) and "… put a Symbiote Suit … into play …" (node 25's reward,
 *    MC27 p. 22)** are authored with `CampaignOp` `setAsideCards` (the card, from outside the game, set aside at
 *    setup) plus an `inGame` `putIntoPlay` from `encounterSetAside` (`bringIntoGame`, `putVenomIntoPlay`,
 *    `eachPlayerMayPutIntoPlay`). Whoever the card enters play under becomes its owner (RRG 1.8 "Ownership and
 *    Control", p. 31), so it leaves play to that player's discard pile.
 * 3. **Sandman's Expert-Campaign-Only "Place 2 additional sand counters on the City Streets environment. Resolve
 *    its 'Surging Sands' ability'" (MC27 p. 9).** `addCounters` reaches the counters; there is no generic "resolve
 *    the named sub-ability '[X]' printed on this card" primitive (only `resolveWhenRevealedOf`/`resolveSpecialsOf`,
 *    neither of which is what "Surging Sands" is — City Streets' own custom ability, scripted by whoever writes
 *    `wave5/sm/sandman.ts`, not campaign data). Unauthored.
 * 4. *(Closed.)* **Node 17's penalty, "Setup: The first player must search the encounter deck and discard pile for
 *    a scenario-specific side scheme, then reveal it. Place 1[per_hero] threat on that side scheme. (Shuffle.)"
 *    (MC27 p. 22)** is authored as `sm.rep.node17.penalty` with `TargetQuery.scenarioSpecific` (RRG 1.8
 *    "Scenario-Specific Card", p. 39: the set of the scenario's own main scheme, never a modular or campaign set).
 *    Mysterio's own set prints no side scheme, so there the search finds nothing and nothing is revealed (RRG 1.8
 *    "Search", p. 39: only a card that is found is moved).
 * 5. *(Closed.)* **"… at random that does not have its title recorded in the 'Community Service' section"
 *    (scenarios 2-4, MC27 p. 11/13/15)** is authored in `communityServicePick` with `CampaignChoiceSource`
 *    `excludingTitles` over the `communityService` field.
 *
 * Also not attempted here (out of this file's scope per the brief): scripting the 16 campaign cards themselves
 * (174-189, `ability-scripting-engineer`'s later pass) and the expert campaign's optional deck-customization
 * freeze (a deck-builder rule, not a `CampaignDefinition` instruction).
 */

import { campaignId, cardId, encounterSetId, scenarioId, trait, type CampaignId, type CardId } from "@mc/content";
import {
  DEFAULT_CAMPAIGN_WINDOW,
  type CampaignChoiceSource,
  type CampaignDefinition,
  type CampaignInstruction,
  type CampaignOp,
} from "@mc/engine";
import {
  campaignLogCards,
  campaignLogValue,
  chooseCards,
  chooseOneBy,
  chosen,
  choiceFoundNothing,
  dealEncounterCard,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  engage,
  firstPlayer,
  forEachPlayer,
  giveBoostCard,
  grantAdditionalMulligans,
  identityOf,
  ifThen,
  inCampaignLogField,
  moveCards,
  named,
  option,
  perHero,
  placeThreat,
  printedHpOf,
  putIntoPlay,
  query,
  revealCard,
  selectCards,
  setRemainingHitPoints,
  shuffleDeck,
  shuffleEncounterDeck,
  thatPlayer,
  zone,
} from "../dsl/index.js";

const SM_CAMPAIGN_ID: CampaignId = campaignId("sm");

// ---------------------------------------------------------------------------------------------------------------
// Campaign-specific cards and sets (MC27 p. 4)
// ---------------------------------------------------------------------------------------------------------------

const BAD_PUBLICITY_SET = encounterSetId("bad_publicity");
const COMMUNITY_SERVICE_SET = encounterSetId("community_service");
const SNITCHES_SET = encounterSetId("snitches_get_stitches");
const OSBORN_TECH_SET = encounterSetId("osborn_tech");
/** MC27 p. 4: cards 182-189, the "Campaign - S.H.I.E.L.D. Tech" player cards node 1's reward deals from. */
const SHIELD_TECH_SET = encounterSetId("shield_tech");
const SINISTER_ASSAULT_SET = encounterSetId("sinister_assault");

/** MC27 p. 4/p. 9: cards 176-180, "Choose 1 … at random. Shuffle that side scheme into the encounter deck." */
const COMMUNITY_SERVICE: readonly { readonly id: CardId; readonly name: string }[] = [
  { id: cardId("27176"), name: "Back Alley Burglary" },
  { id: cardId("27177"), name: "Cat in a Tree" },
  { id: cardId("27178"), name: "Henchmen Heist" },
  { id: cardId("27179"), name: "Off the Rails" },
  { id: cardId("27180"), name: "Rubble Rescue" },
];

/** MC27 p. 22: cards 182-189, each with an Enhanced flip side of the *same* printed name (node 13's reward). */
const SHIELD_TECH: readonly { readonly id: CardId; readonly name: string }[] = [
  { id: cardId("27182a"), name: "Compact Darts" },
  { id: cardId("27183a"), name: "Impact-Dampening Suit" },
  { id: cardId("27184a"), name: "Laser Goggles" },
  { id: cardId("27185a"), name: "Propulsion Gauntlet" },
  { id: cardId("27186a"), name: "Retinal Display" },
  { id: cardId("27187a"), name: "Shock Knuckles" },
  { id: cardId("27188a"), name: "Wave Bracers" },
  { id: cardId("27189a"), name: "Wrist Navigator" },
];

const ILLUSION = trait("Illusion");

/** MC27 p. 4's prohibited Venom (Eddie Brock) ally, which scenarios 3 and 4 put into play (MC27 p. 13/15). */
const VENOM_ALLY: CardId = cardId("27190");
/** MC27 p. 22 node 21: "a Helicarrier support (Core Set 92)". Any printing is "their collection"; the Core one is named. */
const HELICARRIER: CardId = cardId("01092");
/** MC27 p. 22 node 25: "a Symbiote Suit upgrade (Sinister Motives 191)", prohibited from decks by MC27 p. 4. */
const SYMBIOTE_SUIT: CardId = cardId("27191");

// ---------------------------------------------------------------------------------------------------------------
// Repeated shapes
// ---------------------------------------------------------------------------------------------------------------

/**
 * Not printed as its own bullet: makes this scenario's campaign-specific sets available to its setup instructions
 * and card abilities as set-aside cards (`gmw.ts`'s `composition(...)` precedent). Every node composes all five;
 * a node whose own setup never reaches Osborn Tech or Sinister Assault simply leaves those cards unused.
 */
function composeCampaignSets(prefix: string, citation: string): CampaignInstruction {
  return {
    id: `${prefix}.composition.sets`,
    text: "(Not printed: makes this box's campaign-specific and reputation-track cards available to this scenario's own setup instructions.)",
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        {
          kind: "composeEncounterSets",
          sets: [BAD_PUBLICITY_SET, COMMUNITY_SERVICE_SET, SNITCHES_SET, OSBORN_TECH_SET, SINISTER_ASSAULT_SET].map(
            (set) => ({ kind: "const" as const, value: set }),
          ),
          into: "setAside",
        },
      ],
    },
  };
}

/** MC27 p. 9/11/13/15/17: "Put the Public Outcry (174) environment into play." The mode face is picked automatically
 * (`effects.ts`'s `modeOnlyFlipped`, RRG 1.8 "Double-Sided Card", p. 17) — one instruction covers both modes. */
function putPublicOutcryIntoPlay(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: 'Put the Public Outcry (174) environment into play (in standard mode, use the side with the text "Standard Mode Only;" in expert mode, use the side with the text "Expert Mode Only").',
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        selectCards("public-outcry", encounterSetAside({ name: "Public Outcry" })),
        putIntoPlay(chosen("public-outcry")),
      ],
    },
  };
}

/**
 * Not printed as its own bullet: brings a card from outside the game (no composed set holds it, no deck lists it) in
 * set aside, so the paired in-game instruction can put it into play (`CampaignOp` `setAsideCards`). `perSeat` sets
 * one copy aside per seat, for "each player may search their collection for …".
 */
function bringIntoGame(
  id: string,
  citation: string,
  card: CardId,
  name: string,
  perSeat: boolean,
): CampaignInstruction {
  return {
    id,
    text: `(Not printed: sets ${name} aside for this scenario, to be put into play by the setup instruction that names it.)`,
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        {
          kind: "setAsideCards",
          cards: [constant(card)],
          ...(perSeat ? { copies: { kind: "seatCount" as const } } : {}),
        },
      ],
    },
  };
}

/** MC27 p. 13/15: "Put the Venom (190) ally card into play under the first player's control." */
function putVenomIntoPlay(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Put the Venom (190) ally card into play under the first player's control.",
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        selectCards("venom-ally", encounterSetAside({ name: "Venom", categories: ["ally"] })),
        putIntoPlay(chosen("venom-ally"), firstPlayer),
      ],
    },
  };
}

/** MC27 p. 22 (nodes 21, 25): "Each player may search their collection for a … and put it into play under their control." */
function eachPlayerMayPutIntoPlay(
  id: string,
  text: string,
  name: string,
  category: "support" | "upgrade",
): CampaignInstruction {
  const slot = `${id}.card`;
  return {
    id,
    text,
    citation: "MC27 p. 22",
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(eachPlayer, [
          chooseCards(slot, encounterSetAside({ name, categories: [category] }), {
            min: 0,
            max: 1,
            chooser: thatPlayer,
          }),
          putIntoPlay(chosen(slot), thatPlayer),
        ]),
      ],
    },
  };
}

/** MC27 p. 9/11/17: "Shuffle the Smear Campaign (175) treachery into the encounter deck." */
function shuffleSmearCampaign(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Shuffle the Smear Campaign (175) treachery into the encounter deck.",
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [moveCards(encounterSetAside({ name: "Smear Campaign" }), "encounterDeckShuffle")],
    },
  };
}

/** MC27 p. 13/15: "Shuffle the Smear Campaign (175) treachery and the Snitches Get Stitches (181) attachment into
 * the encounter deck." One printed bullet, two cards. */
function shuffleSmearAndSnitches(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Shuffle the Smear Campaign (175) treachery and the Snitches Get Stitches (181) attachment into the encounter deck.",
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        moveCards(encounterSetAside({ name: "Smear Campaign" }), "encounterDeckShuffle"),
        moveCards(encounterSetAside({ name: "Snitches Get Stitches" }), "encounterDeckShuffle"),
      ],
    },
  };
}

/**
 * The composition half of Community Service's random draw (MC27 p. 9/11/13/15's "Choose 1 … at random"): the pick
 * itself is between games (no `GameState` exists yet to shuffle a card into), so it is recorded to a hidden,
 * per-scenario `cardRef` field the paired `communityServiceShuffleIn` instruction reads in-game.
 *
 * Scenarios 2-4 (MC27 p. 11/13/15) add "that does not have its title recorded in the 'Community Service' section of
 * the campaign log" (`excludeRecorded`); scenario 1 (p. 9) does not. Only a *defeated* scheme is recorded (p. 9/11/
 * 13/15's Victory bullet), so a title drawn but not defeated may be drawn again. At most one title is recorded per
 * scenario and the fourth draw is the last, so at least two of the five are always left: the rulebook never needs to
 * say what an exhausted draw does, and the engine's answer (it draws nothing, so nothing is shuffled in) is unreachable
 * in this box.
 */
function communityServicePick(prefix: string, citation: string, excludeRecorded: boolean): CampaignInstruction {
  const all: CampaignChoiceSource = { kind: "cards", cardIds: COMMUNITY_SERVICE.map((c) => c.id) };
  return {
    id: `${prefix}.setup.community-service-pick`,
    text: excludeRecorded
      ? 'Choose 1 "Campaign - Community Service" (176-180) side scheme at random that does not have its title recorded in the "Community Service" section of the campaign log.'
      : 'Choose 1 "Campaign - Community Service" (176-180) side scheme at random.',
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        {
          kind: "random",
          slot: "communityService",
          from: excludeRecorded
            ? { kind: "excludingTitles", from: all, titlesIn: { kind: "field", field: "communityService" } }
            : all,
        },
        {
          kind: "setField",
          field: "communityServiceDealt",
          value: { kind: "choice", slot: "communityService" },
        } satisfies CampaignOp,
      ],
    },
  };
}

/** The shuffle-in half of the same sentence: "Shuffle that side scheme into the encounter deck." */
function communityServiceShuffleIn(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Shuffle that side scheme into the encounter deck.",
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [moveCards(campaignLogCards("communityServiceDealt"), "encounterDeckShuffle")],
    },
  };
}

/** MC27 p. 9/11/13/15, printed identically: "If a … Community Service … side scheme is in the victory display,
 * record its title in the 'Community Service' section." */
function communityServiceRecord(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: 'If a "Campaign - Community Service" (176-180) side scheme is in the victory display, record its title in the "Community Service" section.',
    citation,
    step: {
      kind: "record",
      writes: [
        {
          field: "communityService",
          mode: "append",
          value: { kind: "cardsInVictoryDisplay", query: { anyOf: COMMUNITY_SERVICE.map((c) => ({ name: c.name })) } },
        },
      ],
    },
  };
}

/** MC27 p. 11/13/15/17, printed identically: "Expert Campaign Only: Set each player's hit point dial to their
 * remaining hit point value recorded in the campaign log." Not printed on scenario 1, which has nothing recorded yet. */
function hpSet(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Expert Campaign Only: Set each player's hit point dial to their remaining hit point value recorded in the campaign log.",
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

/** MC27 p. 11/13/15/17: "Expert Campaign Only: Each player may deal themself N facedown encounter card(s) from the
 * encounter deck to set their hit point dial to their identity's printed hit point value." */
function optionalPrintedHeal(id: string, citation: string, dealCount: 1 | 2 | 3): CampaignInstruction {
  const dealCards = Array.from({ length: dealCount }, () => dealEncounterCard(thatPlayer));
  return {
    id,
    text: `Expert Campaign Only: Each player may deal themself ${dealCount} facedown encounter card${dealCount > 1 ? "s" : ""} from the encounter deck to set their hit point dial to their identity's printed hit point value.`,
    citation,
    whenModes: { expertCampaign: true },
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(
          eachPlayer,
          chooseOneBy(
            thatPlayer,
            option(
              "Deal cards and heal to printed HP",
              ...dealCards,
              setRemainingHitPoints(printedHpOf(identityOf(thatPlayer)), identityOf(thatPlayer)),
            ),
            option("Decline", []),
          ),
        ),
      ],
    },
  };
}

/** MC27 p. 9/11/13/15/17, printed identically: "Expert Campaign Only: Record each identity's remaining hit points." */
function hpRecord(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Expert Campaign Only: Record each identity's remaining hit points.",
    citation,
    whenModes: { expertCampaign: true },
    step: {
      kind: "record",
      writes: [{ field: "remainingHp", seat: "each", mode: "set", value: { kind: "remainingHitPointsCappedAtBase" } }],
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The reputation track (MC27 pp. 5, 22)
// ---------------------------------------------------------------------------------------------------------------

const field = (id: string) => ({ kind: "field" as const, field: id });
const constant = (value: number | string | boolean) => ({ kind: "const" as const, value });

/** "Whenever a node … is marked" (MC27 p. 5): this marking reached node `n` and the last one had not. */
function crossed(n: number) {
  return {
    kind: "and" as const,
    of: [
      { kind: "valueAtLeast" as const, value: field("reputation"), amount: constant(n) },
      {
        kind: "not" as const,
        of: { kind: "valueAtLeast" as const, value: field("reputationBefore"), amount: constant(n) },
      },
    ],
  };
}

/** MC27 p. 22's "Conditions" section, then the marking itself — `sm-queries.test.ts`'s own proven shape, with this
 * box's real fields and every reachable node (1, 5, 9, 13, 17, 21, 25) wired to its own conditional instruction(s). */
const REPUTATION_VICTORY: readonly CampaignInstruction[] = [
  {
    id: "sm.reputation.conditions",
    text: 'Using the "Conditions" section, calculate your group\'s total reputation value.',
    citation: "MC27 p. 22",
    step: {
      kind: "record",
      writes: [
        { field: "repVictoryPoints", mode: "set", value: { kind: "keywordValueSum", query: {}, keyword: "victory" } },
        {
          field: "repConditions",
          mode: "set",
          value: { kind: "atMost", of: { kind: "cardsInPlay", query: { categories: ["sideScheme"] } }, amount: 0 },
        },
        {
          field: "repConditions",
          mode: "add",
          value: { kind: "atMost", of: { kind: "cardsInPlay", query: { categories: ["minion"] } }, amount: 0 },
        },
        {
          field: "repConditions",
          mode: "add",
          value: { kind: "atMost", of: { kind: "threatOn", query: { categories: ["mainScheme"] } }, amount: 0 },
        },
        {
          field: "repConditions",
          mode: "add",
          value: { kind: "atMost", of: { kind: "defeatedIdentities" }, amount: 0 },
        },
        { field: "repTokens", mode: "set", value: { kind: "accelerationTokensInPlay" } },
        { field: "repPlayers", mode: "set", value: { kind: "playersInScenario" } },
      ],
    },
  },
  {
    id: "sm.reputation.mark",
    text: "… then mark that number of nodes (starting at the topmost unmarked node, and marking each subsequent node going down the track).",
    citation: "MC27 p. 22",
    step: {
      kind: "betweenGames",
      ops: [
        { kind: "setField", field: "reputationBefore", value: field("reputation") },
        // "(+1) Fewer than 1[per_hero] acceleration tokens in play": tokens < players who started the scenario.
        {
          kind: "if",
          when: { kind: "not", of: { kind: "valueAtLeast", value: field("repTokens"), amount: field("repPlayers") } },
          then: [{ kind: "addToField", field: "repConditions", value: constant(1) }],
        },
        // Ruling Aug 3, 2026 (4) #2: negative victory points mark no nodes.
        {
          kind: "addToField",
          field: "reputation",
          value: { kind: "sum", of: [{ kind: "clampAtZero", of: field("repVictoryPoints") }, field("repConditions")] },
        },
        // Node 1's reward, per seat in turn: "Deal 3 … at random to a player. That player may choose 1 to add to
        // their deck …, record that card's title …, then return the others to the collection. … Repeat this process
        // for each player." `excludeGranted` is what "return the others" leaves out of the next seat's deal: only
        // the kept card is taken. Node 1's penalty: choose 1 random Osborn Tech immediately; its "Setup:" shuffle
        // joins every remaining scenario.
        {
          kind: "if",
          when: crossed(1),
          then: [
            {
              kind: "forEachSeat",
              ops: [
                {
                  kind: "random",
                  slot: "shieldTechDealt",
                  count: 3,
                  from: { kind: "campaignSet", encounterSetId: SHIELD_TECH_SET, excludeGranted: true },
                },
                {
                  kind: "choose",
                  slot: "shieldTech",
                  chooser: "eachSeat",
                  optional: true,
                  from: { kind: "values", of: { kind: "choice", slot: "shieldTechDealt" } },
                },
                {
                  kind: "if",
                  when: { kind: "choiceMade", slot: "shieldTech" },
                  then: [
                    {
                      kind: "grantCard",
                      seat: "self",
                      card: { kind: "choice", slot: "shieldTech" },
                      permanence: "campaign",
                    },
                    {
                      kind: "setField",
                      field: "shieldTech",
                      seat: "self",
                      value: { kind: "choice", slot: "shieldTech" },
                    },
                  ],
                },
              ],
            },
            { kind: "random", slot: "osborn1", from: { kind: "campaignSet", encounterSetId: OSBORN_TECH_SET } },
            { kind: "appendToList", field: "osbornTech", value: { kind: "choice", slot: "osborn1" } },
            { kind: "appendToList", field: "reputationSetups", value: constant("sm.rep.node1.penalty") },
          ],
        },
        // Node 5's reward (extra mulligan) and penalty (threat) both ride the next scenario's setup (Q19).
        {
          kind: "if",
          when: crossed(5),
          then: [
            { kind: "appendToList", field: "reputationSetups", value: constant("sm.rep.node5.reward") },
            { kind: "appendToList", field: "reputationSetups", value: constant("sm.rep.node5.penalty") },
          ],
        },
        // Node 9's reward (Aspect Advantage) resolves immediately, once per seat; its penalty joins every remaining setup.
        {
          kind: "if",
          when: crossed(9),
          then: [
            {
              kind: "forEachSeat",
              ops: [
                {
                  kind: "choose",
                  slot: "aspectAdvantage",
                  chooser: "eachSeat",
                  from: { kind: "collection", filter: {} },
                },
                {
                  kind: "grantCard",
                  seat: "self",
                  card: { kind: "choice", slot: "aspectAdvantage" },
                  permanence: "campaign",
                  copies: "maximum",
                },
                {
                  kind: "setField",
                  field: "aspectAdvantage",
                  seat: "self",
                  value: { kind: "choice", slot: "aspectAdvantage" },
                },
              ],
            },
            { kind: "appendToList", field: "reputationSetups", value: constant("sm.rep.node9.penalty") },
          ],
        },
        // Node 13's reward flips each seat's own S.H.I.E.L.D. Tech to Enhanced immediately; its penalty is another
        // immediate random Osborn Tech (no "Setup:" label on this box, unlike node 1's).
        {
          kind: "if",
          when: crossed(13),
          then: [
            {
              kind: "forEachSeat",
              ops: SHIELD_TECH.map(({ id, name }): CampaignOp => ({
                kind: "if",
                when: { kind: "fieldContains", field: "shieldTech", value: id, seat: "self" },
                then: [{ kind: "setGrantFace", card: constant(id), face: name }],
              })),
            },
            { kind: "random", slot: "osborn13", from: { kind: "campaignSet", encounterSetId: OSBORN_TECH_SET } },
            { kind: "appendToList", field: "osbornTech", value: { kind: "choice", slot: "osborn13" } },
          ],
        },
        // Node 17's reward (Planning Ahead) records each seat's chosen card immediately; the "Setup:" search-and-hand
        // half joins every remaining setup, and so does its "Setup:" penalty (file header gap 4).
        {
          kind: "if",
          when: crossed(17),
          then: [
            {
              kind: "forEachSeat",
              ops: [
                { kind: "choose", slot: "planningAhead", chooser: "eachSeat", from: { kind: "ownDeck" } },
                {
                  kind: "setField",
                  field: "planningAhead",
                  seat: "self",
                  value: { kind: "choice", slot: "planningAhead" },
                },
              ],
            },
            { kind: "appendToList", field: "reputationSetups", value: constant("sm.rep.node17.reward") },
            { kind: "appendToList", field: "reputationSetups", value: constant("sm.rep.node17.penalty") },
          ],
        },
        // Node 21's reward ("Setup:" Helicarrier) joins every remaining setup; its penalty is another immediate
        // random Osborn Tech.
        {
          kind: "if",
          when: crossed(21),
          then: [
            { kind: "appendToList", field: "reputationSetups", value: constant("sm.rep.node21.reward.set-aside") },
            { kind: "appendToList", field: "reputationSetups", value: constant("sm.rep.node21.reward") },
            { kind: "random", slot: "osborn21", from: { kind: "campaignSet", encounterSetId: OSBORN_TECH_SET } },
            { kind: "appendToList", field: "osbornTech", value: { kind: "choice", slot: "osborn21" } },
          ],
        },
        // Node 25's reward ("Setup:" Symbiote Suit) and its penalty both join every remaining setup.
        {
          kind: "if",
          when: crossed(25),
          then: [
            { kind: "appendToList", field: "reputationSetups", value: constant("sm.rep.node25.reward.set-aside") },
            { kind: "appendToList", field: "reputationSetups", value: constant("sm.rep.node25.reward") },
            { kind: "appendToList", field: "reputationSetups", value: constant("sm.rep.node25.penalty") },
          ],
        },
      ] satisfies readonly CampaignOp[],
    },
  },
];

const CONDITIONAL_INSTRUCTIONS: Readonly<Record<string, CampaignInstruction>> = {
  "sm.rep.node1.penalty": {
    id: "sm.rep.node1.penalty",
    text: 'Setup: Shuffle each card recorded in the "Osborn Tech" section of the campaign log into the encounter deck.',
    citation: "MC27 p. 22",
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [moveCards(campaignLogCards("osbornTech"), "encounterDeckShuffle")],
    },
  },
  "sm.rep.node5.reward": {
    id: "sm.rep.node5.reward",
    text: "During the Resolve Mulligans step of game setup, each player may take 1 additional mulligan.",
    citation: "MC27 p. 22 (RRG 1.8 p. 67 erratum)",
    step: { kind: "inGame", window: "beforeStartingHands", effects: [grantAdditionalMulligans(1)] },
  },
  "sm.rep.node5.penalty": {
    id: "sm.rep.node5.penalty",
    text: "Setup: Place 1[per_hero] threat on the main scheme.",
    citation: "MC27 p. 22",
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [placeThreat(perHero(1), each(query(["mainScheme"])))],
    },
  },
  "sm.rep.node9.penalty": {
    id: "sm.rep.node9.penalty",
    text: "Setup: In player order, each player must search the encounter deck and discard pile for a minion, then put that minion into play engaged with themself. (Shuffle.) For each player who did not put a minion into play this way, deal that player 1 facedown encounter card.",
    citation: "MC27 p. 22",
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(eachPlayer, [
          chooseCards("node9minion", encounterCards(["deck", "discard"], { categories: ["minion"] }), {
            min: 0,
            max: 1,
            chooser: thatPlayer,
          }),
          shuffleEncounterDeck(),
          ifThen(choiceFoundNothing(), dealEncounterCard(thatPlayer), [
            putIntoPlay(chosen("node9minion"), thatPlayer),
            engage(chosen("node9minion"), thatPlayer),
          ]),
        ]),
      ],
    },
  },
  "sm.rep.node17.reward": {
    id: "sm.rep.node17.reward",
    text: 'Setup: Each player searches their deck and discard pile for 1 copy of the card recorded in their "Planning Ahead" section of the campaign log, then adds that card to their hand. (Shuffle.)',
    citation: "MC27 p. 22",
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(eachPlayer, [
          moveCards(
            zone(["deck", "discard"], thatPlayer, { filter: inCampaignLogField("planningAhead", thatPlayer) }),
            "hand",
          ),
          shuffleDeck(thatPlayer),
        ]),
      ],
    },
  },
  // "Scenario-specific" is RRG 1.8 p. 39's classification (`TargetQuery.scenarioSpecific`). The first player picks
  // among several (RRG 1.8 "Search", p. 39); with none in either zone nothing is revealed and no threat is placed.
  // The shuffle comes last: "upon completion of that … card ability" (same entry).
  "sm.rep.node17.penalty": {
    id: "sm.rep.node17.penalty",
    text: "Setup: The first player must search the encounter deck and discard pile for a scenario-specific side scheme, then reveal it. Place 1[per_hero] threat on that side scheme. (Shuffle.)",
    citation: "MC27 p. 22",
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        chooseCards(
          "node17scheme",
          encounterCards(["deck", "discard"], { categories: ["sideScheme"], scenarioSpecific: true }),
          { min: 1, max: 1, chooser: firstPlayer },
        ),
        revealCard(chosen("node17scheme"), firstPlayer),
        placeThreat(perHero(1), chosen("node17scheme")),
        shuffleEncounterDeck(),
      ],
    },
  },
  "sm.rep.node21.reward.set-aside": bringIntoGame(
    "sm.rep.node21.reward.set-aside",
    "MC27 p. 22",
    HELICARRIER,
    "a Helicarrier support for each player",
    true,
  ),
  "sm.rep.node21.reward": eachPlayerMayPutIntoPlay(
    "sm.rep.node21.reward",
    "Setup: Each player may search their collection for a Helicarrier support (Core Set 92) and put it into play under their control.",
    "Helicarrier",
    "support",
  ),
  "sm.rep.node25.reward.set-aside": bringIntoGame(
    "sm.rep.node25.reward.set-aside",
    "MC27 p. 22",
    SYMBIOTE_SUIT,
    "a Symbiote Suit upgrade for each player",
    true,
  ),
  "sm.rep.node25.reward": eachPlayerMayPutIntoPlay(
    "sm.rep.node25.reward",
    "Setup: Each player may search their collection for a Symbiote Suit upgrade (Sinister Motives 191) and put it into play under their control.",
    "Symbiote Suit",
    "upgrade",
  ),
  "sm.rep.node25.penalty": {
    id: "sm.rep.node25.penalty",
    text: "Setup: Deal 1 facedown encounter card to each player.",
    citation: "MC27 p. 22",
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [forEachPlayer(eachPlayer, dealEncounterCard(thatPlayer))],
    },
  },
};

// ---------------------------------------------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------------------------------------------

export const SM_CAMPAIGN_DEFINITION: CampaignDefinition = {
  campaignId: SM_CAMPAIGN_ID,
  version: "1",
  logFields: [
    {
      id: "reputation",
      label: "Reputation",
      scope: "shared",
      type: { kind: "number", clampAtZero: true },
      citation: "MC27 p. 5",
    },
    {
      id: "reputationBefore",
      label: "Reputation (previous)",
      scope: "shared",
      type: { kind: "number" },
      hidden: true,
      citation: "MC27 p. 5",
    },
    {
      id: "repVictoryPoints",
      label: "Victory points (working)",
      scope: "shared",
      type: { kind: "number" },
      hidden: true,
      citation: "MC27 p. 22",
    },
    {
      id: "repConditions",
      label: "Conditions met (working)",
      scope: "shared",
      type: { kind: "number" },
      hidden: true,
      citation: "MC27 p. 22",
    },
    {
      id: "repTokens",
      label: "Acceleration tokens (working)",
      scope: "shared",
      type: { kind: "number" },
      hidden: true,
      citation: "MC27 p. 22",
    },
    {
      id: "repPlayers",
      label: "Players in scenario (working)",
      scope: "shared",
      type: { kind: "number" },
      hidden: true,
      citation: "MC27 p. 22",
    },
    {
      id: "reputationSetups",
      label: "Reputation Track Setup",
      scope: "shared",
      type: { kind: "instructionList" },
      citation: "MC27 p. 22",
    },
    { id: "osbornTech", label: "Osborn Tech", scope: "shared", type: { kind: "cardList" }, citation: "MC27 p. 23" },
    {
      id: "communityService",
      label: "Community Service",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC27 p. 23",
    },
    {
      id: "communityServiceDealt",
      label: "Community Service (this scenario's draw)",
      scope: "shared",
      type: { kind: "cardRef" },
      hidden: true,
      citation: "MC27 p. 9",
    },
    {
      id: "wakingNightmare",
      label: "Waking Nightmare",
      scope: "shared",
      type: { kind: "number" },
      citation: "MC27 p. 23",
    },
    {
      id: "lastOnesStanding",
      label: "Last Ones Standing",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC27 p. 23",
    },
    {
      id: "finalReputationScore",
      label: "Final Reputation Score",
      scope: "shared",
      type: { kind: "number" },
      citation: "MC27 p. 23",
    },
    {
      id: "remainingHp",
      label: "Remaining hit points",
      scope: "perSeat",
      type: { kind: "number", min: 0 },
      whenModes: { expertCampaign: true },
      citation: "MC27 p. 6",
    },
    {
      id: "shieldTech",
      label: "S.H.I.E.L.D. Tech",
      scope: "perSeat",
      type: { kind: "cardRef", withFace: true },
      citation: "MC27 p. 23",
    },
    {
      id: "aspectAdvantage",
      label: "Aspect Advantage",
      scope: "perSeat",
      type: { kind: "cardRef" },
      citation: "MC27 p. 23",
    },
    {
      id: "planningAhead",
      label: "Planning Ahead",
      scope: "perSeat",
      type: { kind: "cardRef" },
      citation: "MC27 p. 23",
    },
  ],
  // MC27 p. 4: "If the players lost, they may reset the scenario and try again with no penalty" for every scenario
  // except Venom Goblin's Expert-Campaign-Only exception (MC27 p. 17), the same shape `mts.ts` uses for Loki.
  loss: { retry: "byInstruction", retryBaseline: "nodeStart" },
  everyNodeVictory: REPUTATION_VICTORY,
  conditionalInstructions: CONDITIONAL_INSTRUCTIONS,
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "sandman",
        label: "Scenario #1 - Sandman",
        scenario: { kind: "fixed", scenarioId: scenarioId("sandman") },
        composition: [composeCampaignSets("sm.s1", "MC27 p. 9")],
        setup: [
          putPublicOutcryIntoPlay("sm.s1.setup.public-outcry", "MC27 p. 9"),
          shuffleSmearCampaign("sm.s1.setup.smear-campaign", "MC27 p. 9"),
          communityServicePick("sm.s1", "MC27 p. 9", false),
          communityServiceShuffleIn("sm.s1.setup.community-service", "MC27 p. 9"),
          // Expert Campaign Only "Place 2 additional sand counters … resolve its 'Surging Sands' ability" is
          // unauthored (file header, gap 3): no primitive resolves a card's own named sub-ability from campaign data.
        ],
        victory: [
          communityServiceRecord("sm.s1.victory.community-service", "MC27 p. 9"),
          hpRecord("sm.s1.victory.hp", "MC27 p. 9"),
        ],
      },
      {
        id: "venom",
        label: "Scenario #2 - Venom",
        scenario: { kind: "fixed", scenarioId: scenarioId("venom") },
        composition: [composeCampaignSets("sm.s2", "MC27 p. 11")],
        setup: [
          putPublicOutcryIntoPlay("sm.s2.setup.public-outcry", "MC27 p. 11"),
          shuffleSmearCampaign("sm.s2.setup.smear-campaign", "MC27 p. 11"),
          communityServicePick("sm.s2", "MC27 p. 11", true),
          communityServiceShuffleIn("sm.s2.setup.community-service", "MC27 p. 11"),
          hpSet("sm.s2.setup.hp-set", "MC27 p. 11"),
          optionalPrintedHeal("sm.s2.setup.heal", "MC27 p. 11", 1),
          {
            id: "sm.s2.setup.boost-cards",
            text: "Expert Campaign Only: Place 1 facedown boost card on each identity.",
            citation: "MC27 p. 11",
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [forEachPlayer(eachPlayer, giveBoostCard(identityOf(thatPlayer)))],
            },
          },
        ],
        victory: [
          communityServiceRecord("sm.s2.victory.community-service", "MC27 p. 11"),
          hpRecord("sm.s2.victory.hp", "MC27 p. 11"),
        ],
      },
      {
        id: "mysterio",
        label: "Scenario #3 - Mysterio",
        scenario: { kind: "fixed", scenarioId: scenarioId("mysterio") },
        composition: [
          composeCampaignSets("sm.s3", "MC27 p. 13"),
          bringIntoGame("sm.s3.composition.venom", "MC27 p. 13", VENOM_ALLY, "the Venom (190) ally", false),
        ],
        setup: [
          putVenomIntoPlay("sm.s3.setup.venom", "MC27 p. 13"),
          shuffleSmearAndSnitches("sm.s3.setup.smear-and-snitches", "MC27 p. 13"),
          communityServicePick("sm.s3", "MC27 p. 13", true),
          communityServiceShuffleIn("sm.s3.setup.community-service", "MC27 p. 13"),
          hpSet("sm.s3.setup.hp-set", "MC27 p. 13"),
          optionalPrintedHeal("sm.s3.setup.heal", "MC27 p. 13", 2),
          {
            id: "sm.s3.setup.shuffle-top-2",
            text: "Expert Campaign Only: In player order, each player must shuffle the top 2 cards of the encounter deck into their deck.",
            citation: "MC27 p. 13",
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [forEachPlayer(eachPlayer, moveCards(encounterCards(["deck"], undefined, 2), "deckShuffle"))],
            },
          },
        ],
        victory: [
          communityServiceRecord("sm.s3.victory.community-service", "MC27 p. 13"),
          {
            id: "sm.s3.victory.waking-nightmare",
            text: 'Count the total number of Illusion cards in all player decks. Record that number in the "Waking Nightmare" section.',
            citation: "MC27 p. 13",
            step: {
              kind: "record",
              writes: [
                {
                  field: "wakingNightmare",
                  mode: "set",
                  value: { kind: "count", of: { kind: "cardsInPlayerDecks", query: { trait: ILLUSION } } },
                },
              ],
            },
          },
          hpRecord("sm.s3.victory.hp", "MC27 p. 13"),
        ],
      },
      {
        id: "sinister-six",
        label: "Scenario #4 - The Sinister Six",
        scenario: { kind: "fixed", scenarioId: scenarioId("sinister-six") },
        composition: [
          composeCampaignSets("sm.s4", "MC27 p. 15"),
          bringIntoGame("sm.s4.composition.venom", "MC27 p. 15", VENOM_ALLY, "the Venom (190) ally", false),
        ],
        setup: [
          putVenomIntoPlay("sm.s4.setup.venom", "MC27 p. 15"),
          putPublicOutcryIntoPlay("sm.s4.setup.public-outcry", "MC27 p. 15"),
          shuffleSmearAndSnitches("sm.s4.setup.smear-and-snitches", "MC27 p. 15"),
          communityServicePick("sm.s4", "MC27 p. 15", true),
          communityServiceShuffleIn("sm.s4.setup.community-service", "MC27 p. 15"),
          {
            id: "sm.s4.setup.waking-nightmare-threat",
            text: 'Place threat on the Light at the End side scheme equal to the number recorded in the "Waking Nightmare" section of the campaign log.',
            citation: "MC27 p. 15",
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [placeThreat(campaignLogValue("wakingNightmare"), named("Light at the End"))],
            },
          },
          hpSet("sm.s4.setup.hp-set", "MC27 p. 15"),
          optionalPrintedHeal("sm.s4.setup.heal", "MC27 p. 15", 2),
        ],
        victory: [
          communityServiceRecord("sm.s4.victory.community-service", "MC27 p. 15"),
          {
            id: "sm.s4.victory.last-ones-standing",
            text: 'In the "Last Ones Standing" section, record the name of each villain in play.',
            citation: "MC27 p. 15",
            step: {
              kind: "record",
              writes: [
                {
                  field: "lastOnesStanding",
                  mode: "set",
                  value: { kind: "cardsInPlay", query: { categories: ["villain"] } },
                },
              ],
            },
          },
          hpRecord("sm.s4.victory.hp", "MC27 p. 15"),
        ],
      },
      {
        id: "venom-goblin",
        label: "Scenario #5 - Venom Goblin",
        scenario: { kind: "fixed", scenarioId: scenarioId("venom-goblin") },
        composition: [composeCampaignSets("sm.s5", "MC27 p. 17")],
        setup: [
          putPublicOutcryIntoPlay("sm.s5.setup.public-outcry", "MC27 p. 17"),
          shuffleSmearCampaign("sm.s5.setup.smear-campaign", "MC27 p. 17"),
          {
            id: "sm.s5.setup.sinister-assault",
            text: 'Search the "Sinister Assault" (158-163) modular set for each minion with the same name as a villain\'s name recorded in the "Last Ones Standing" section of the campaign log. Shuffle each of those minions into the encounter deck.',
            citation: "MC27 p. 17",
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [moveCards(campaignLogCards("lastOnesStanding"), "encounterDeckShuffle")],
            },
          },
          hpSet("sm.s5.setup.hp-set", "MC27 p. 17"),
          optionalPrintedHeal("sm.s5.setup.heal", "MC27 p. 17", 3),
          {
            id: "sm.s5.setup.extra-threat",
            text: "Expert Campaign Only: Place 1[per_hero] additional threat on each main scheme.",
            citation: "MC27 p. 17",
            whenModes: { expertCampaign: true },
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [placeThreat(perHero(1), each(query(["mainScheme"])))],
            },
          },
        ],
        victory: [
          {
            id: "sm.s5.victory.win",
            text: "You win the campaign!",
            citation: "MC27 p. 17",
            step: { kind: "betweenGames", ops: [] },
          },
          {
            id: "sm.s5.victory.final-score",
            text: 'Optional: In the "Final Reputation Score" section of the campaign log, record a value equal to the number of nodes marked on the reputation track.',
            citation: "MC27 p. 17",
            step: {
              kind: "betweenGames",
              ops: [{ kind: "setField", field: "finalReputationScore", value: field("reputation") }],
            },
          },
        ],
        defeat: [
          {
            id: "sm.s5.defeat.lose-campaign",
            text: "Expert Campaign Only: If the players lose this game, Venom Goblin takes control of New York City and the players lose the campaign.",
            citation: "MC27 p. 17",
            whenModes: { expertCampaign: true },
            step: { kind: "betweenGames", ops: [{ kind: "endCampaign", result: "lost" }] },
          },
        ],
      },
    ],
  },
};
