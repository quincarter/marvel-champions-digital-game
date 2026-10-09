/**
 * Mutant Genesis (MC32) — the fifth `CampaignDefinition` (after `trors.ts`, `gmw.ts`, `mts.ts`, `sm.ts`), and the first
 * box with player roles.
 *
 * Source of truth: `docs/campaign-modes/markdown/mc32_mutant_genesis.md` (cited as "MC32 p. N"; the page numbers are the
 * PDF's: the five scenarios' Campaign Instructions are pp. 7, 10, 12, 16 and 19, the campaign rules pp. 4-5, the log
 * sheet p. 24) and `docs/phase7-wave6.md` §1.1, §1.7, §2.3, §3.20, §3.23, §3.24 and the §4.1 decisions (Q11-Q14).
 * Every `CampaignInstruction` carries the printed bullet it encodes, in printed order; an instruction the rulebook does
 * not print as a bullet (a composition step, the draw half of "takes 1 random upgrade") says so in its text.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * MODELING
 *
 * - **Roles** (MC32 p. 5). `role` is a per-seat `choice` log field; "each player must choose a different role" is a
 *   shared `rolesTaken` strike list the seats choose from in order (`fieldOptions { unstruckOnly }`), striking what
 *   they take. The role pool is the role's own campaign set (`MUT_GEN_CAMPAIGN.roles`); `campaignSet` names one set
 *   by id, so "a random upgrade from their role's set" is one `if` per role.
 * - **Role upgrades.** Dealt between games (`random` over the role's set, which skips cards removed from the campaign,
 *   so the pool shrinks) into the seat's `roleUpgrade` field and set aside (`setAsideCards`); an in-game instruction
 *   puts the seat's own card into play under its control. Victory removes the card from the campaign ("Remove each role
 *   upgrade that began the game in play"). Each card's own "Remove this card from the game and the campaign pool" is
 *   an ability (the cards' scripts, a later task) and survives a retry (RRG 1.8 p. 29); an *unused* upgrade is not
 *   removed by a lost game, and the retry deals again from what the pool still holds (§4.1 Q12). The draw clears the
 *   seat's `roleUpgrade` first, so a scenario where no upgrade was earned removes nothing at its Victory.
 * - **Role-building** (MC32 p. 5): per seat, up to 1 event and up to 1 upgrade from the role's two aspects that the
 *   seat's deck does not already include (`notInOwnDeck`, by title), granted `thisGame` (they expire when the game
 *   ends, exempt from deck size).
 * - **Future Past deck** (§3.24). Every node composes the `future_past` and `mut_gen_campaign` sets set aside. Setup
 *   shuffles the recorded Future Past cards into the encounter deck, then builds the "Future Past" scenario deck from
 *   what is still set aside (`buildScenarioDeck { from: ["setAside"] }`), so a Future Past card that is in none of the
 *   log's lists is back in the deck next scenario (§4.1 Q13). Victory adds each Future Past card found in the
 *   encounter deck(s), discard pile(s) and in play to `futurePast` (`cardsInEncounterDeckAndDiscard`, appended
 *   `distinct`: a recorded card is shuffled back in and found again, and is not recorded twice; the set-aside "Future
 *   Past" scenario deck is not the encounter deck and is not read), and removes the Future Past cards in the victory
 *   display (recorded in `futurePastVictoryDisplay`, then `removeFromCampaign`).
 * - **Defeated flags.** "If the X side scheme was defeated" reads the defeat events (`cardsDefeated`), not "no longer
 *   in play": each campaign side scheme flips as it is defeated.
 * - **Captives and Jubilee.** Scenario 2's Victory records the CAPTIVE allies that entered play (`captives`) and
 *   whether Jubilee is in play (`jubilee`). Scenarios 3-5 set the recorded cards aside (`setAsideCards`) and the first
 *   player may shuffle each into any player's deck (the ally becomes that player's card for the game, §3.20, Q14);
 *   Jubilee is put into play under the first player's control.
 * - **Expert campaign** (MC32 p. 5): persistent hit points as every box does; the rejoin token is the price (Q11): a
 *   seat whose recorded hit points are 0 is not offered "Decline" (`mts.ts`'s `healToFull`, the same printed sentence).
 *
 * ---------------------------------------------------------------------------------------------------------------
 * NOT AUTHORED: nothing. The two former notes are authored: Victory's "Add each Future Past card found in the encounter
 * deck, discard pile, and in play" (`cardsInEncounterDeckAndDiscard` with `inPlay`, appended `distinct`), and
 * role-building's "if the deck does not already include the chosen card" (`CollectionFilter.notInOwnDeck`).
 */

import { defeatedSeatRecordsZero } from "./expert-helpers.js";
import { campaignId, cardId, encounterSetId, scenarioId, trait, MUT_GEN_CAMPAIGN, type CardId } from "@mc/content";
import {
  DEFAULT_CAMPAIGN_WINDOW,
  type CampaignDefinition,
  type CampaignGameQuery,
  type CampaignInstruction,
  type CampaignOp,
  type CampaignPredicate,
  type CollectionFilter,
} from "@mc/engine";
import {
  addAccelerationToken,
  allOf,
  buildScenarioDeck,
  campaignLogAtLeast,
  campaignLogCards,
  campaignLogHas,
  campaignLogValue,
  choosePlayer,
  chosen,
  chosenPlayer,
  chooseOneBy,
  damageOn,
  eachPlayer,
  encounterSetAside,
  firstPlayer,
  forEachPlayer,
  grantOwnedCards,
  heal,
  identityOf,
  ifThen,
  moveCards,
  not,
  option,
  putIntoPlay,
  revealCard,
  selectCards,
  setRemainingHitPoints,
  thatPlayer,
} from "../dsl/index.js";

const MUT_GEN_ID = campaignId("mut_gen");

// ---------------------------------------------------------------------------------------------------------------
// Sets, cards and constants (MC32 pp. 4-5)
// ---------------------------------------------------------------------------------------------------------------

const FUTURE_PAST_SET = encounterSetId("future_past");
/** MC32 p. 4: cards 171-175, the encounter-specific campaign cards (all double-sided). */
const CAMPAIGN_SET = encounterSetId("mut_gen_campaign");
/** The scenario deck's printed name (docs/phase7-wave6.md §3.24). The scenarios declare it (`Scenario.separateDecks`). */
const FUTURE_PAST_DECK = "Future Past";

/** MC32 p. 5: the four roles with their associated aspects, from the content record (docs/phase7-wave6.md §1.1). */
const ROLES = MUT_GEN_CAMPAIGN.roles ?? [];

/** MC32 pp. 10-19: "Jubilee (88B)", the ally face of Mutants at the Mall's flip side. */
const JUBILEE_ALLY: CardId = cardId("32088b");
const CAPTIVE = trait("CAPTIVE");
/** Rictor, Boom Boom, Cannonball, Wolfsbane (32089-32092): the CAPTIVE allies. */
const CAPTIVE_ALLIES: readonly { readonly id: CardId; readonly name: string }[] = [
  { id: cardId("32089"), name: "Rictor" },
  { id: cardId("32090"), name: "Boom Boom" },
  { id: cardId("32091"), name: "Cannonball" },
  { id: cardId("32092"), name: "Wolfsbane" },
];

const field = (id: string) => ({ kind: "field" as const, field: id });
const seatField = (id: string) => ({ kind: "field" as const, field: id, seat: "self" as const });
const constant = (value: number | string | boolean) => ({ kind: "const" as const, value });
const choiceOf = (slot: string) => ({ kind: "choice" as const, slot });

const futurePastCards = { inEncounterSet: FUTURE_PAST_SET as string };

// ---------------------------------------------------------------------------------------------------------------
// Repeated shapes
// ---------------------------------------------------------------------------------------------------------------

/**
 * Not printed as its own bullet: makes the campaign cards (171-175) and the Future Past set available to this
 * scenario's setup as set-aside cards (`sm.ts`'s `composeCampaignSets` precedent).
 */
function composeCampaignSets(prefix: string, citation: string): CampaignInstruction {
  return {
    id: `${prefix}.composition.sets`,
    text: "Make the Future Past set and the campaign cards (171-175) available to this scenario's setup instructions.",
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        {
          kind: "composeEncounterSets",
          sets: [FUTURE_PAST_SET, CAMPAIGN_SET].map((set) => constant(set)),
          into: "setAside",
        },
      ],
    },
  };
}

/** MC32 p. 7: "Shuffle the cards from the Future Past modular set and set them aside. This is the Future Past deck." */
function futurePastDeckFirst(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Shuffle the cards from the Future Past modular set and set them aside. This is the Future Past deck.",
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [buildScenarioDeck(FUTURE_PAST_DECK, { from: ["setAside"] })],
    },
  };
}

/** MC32 pp. 10/12/16/19: "Shuffle each Future Past card recorded in the campaign log into the encounter deck. Shuffle
 * the remaining cards from the Future Past deck and set them aside." */
function futurePastDeckRecorded(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Shuffle each Future Past card recorded in the campaign log into the encounter deck. Shuffle the remaining cards from the Future Past deck and set them aside.",
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        moveCards(campaignLogCards("futurePast"), "encounterDeckShuffle"),
        buildScenarioDeck(FUTURE_PAST_DECK, { from: ["setAside"] }),
      ],
    },
  };
}

/** "Reveal the <name> (<n>A) side scheme." The side scheme is a composed, set-aside campaign card. */
function revealCampaignSideScheme(id: string, citation: string, name: string, number: string): CampaignInstruction {
  return {
    id,
    text: `Reveal the ${name} (${number}A) side scheme.`,
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        selectCards("campaign-scheme", encounterSetAside({ name })),
        revealCard(chosen("campaign-scheme"), firstPlayer),
      ],
    },
  };
}

/**
 * The draw half of "each player takes 1 random upgrade from their role's set of cards and puts it into play under
 * their control" (MC32 pp. 7/10/12/16/19), not printed as its own bullet. Clears the seat's `roleUpgrade` first, so a
 * scenario whose gate fails removes nothing at Victory. `gate` is the printed "If … is checked in the campaign log".
 */
function roleUpgradeDraw(id: string, citation: string, gate?: CampaignPredicate): CampaignInstruction {
  const dealt = (role: (typeof ROLES)[number]): CampaignOp => ({
    kind: "if",
    when: { kind: "fieldContains", field: "role", value: role.id, seat: "self" },
    then: [
      {
        kind: "random",
        slot: "roleUpgrade",
        from: { kind: "campaignSet", encounterSetId: role.encounterSetId },
      },
      {
        kind: "if",
        when: { kind: "choiceMade", slot: "roleUpgrade" },
        then: [
          { kind: "setAsideCards", cards: [choiceOf("roleUpgrade")] },
          { kind: "setField", field: "roleUpgrade", seat: "self", value: choiceOf("roleUpgrade") },
        ],
      },
    ],
  });
  const deal: readonly CampaignOp[] = ROLES.map(dealt);
  return {
    id,
    text: "Each player draws a random role upgrade, set aside to be put into play by the next instruction.",
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        {
          kind: "forEachSeat",
          ops: [
            { kind: "clearField", field: "roleUpgrade", seat: "self" },
            ...(gate ? [{ kind: "if" as const, when: gate, then: deal }] : deal),
          ],
        },
      ],
    },
  };
}

/** The in-game half: "… and puts it into play under their control." */
function roleUpgradePut(id: string, citation: string, text: string, gate?: CampaignPredicate): CampaignInstruction {
  return {
    id,
    text,
    citation,
    ...(gate ? { when: gate } : {}),
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(eachPlayer, [
          selectCards("role-upgrade", campaignLogCards("roleUpgrade", { seat: thatPlayer })),
          putIntoPlay(chosen("role-upgrade"), thatPlayer),
        ]),
      ],
    },
  };
}

/**
 * MC32 p. 5, "Role-building": "each player may choose up to 1 copy of an event and/or 1 copy of an upgrade in their
 * collection from their role's associated aspects … Cards chosen this way do not count toward minimum or maximum deck
 * size" and are in the deck "for that game" (`grantCard { thisGame }`). Printed after the upgrade bullet in every
 * scenario, and read as unconditional: it is its own sentence, and p. 5 states it for "setting up a scenario".
 */
function roleBuilding(id: string, citation: string): CampaignInstruction {
  const pick = (category: "event" | "upgrade", slot: string, aspects: readonly string[]): readonly CampaignOp[] => {
    // "If a player's deck does not already include their chosen event and/or upgrade" (MC32 p. 5).
    const filter: CollectionFilter = { categories: [category], aspects, notInOwnDeck: true };
    return [
      { kind: "choose", slot, chooser: "eachSeat", optional: true, from: { kind: "collection", filter } },
      {
        kind: "if",
        when: { kind: "choiceMade", slot },
        then: [{ kind: "grantCard", seat: "self", card: choiceOf(slot), permanence: "thisGame" }],
      },
    ];
  };
  return {
    id,
    text: "Each player may role-build to modify their deck (see page 5).",
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        {
          kind: "forEachSeat",
          ops: ROLES.map((role): CampaignOp => ({
            kind: "if",
            when: { kind: "fieldContains", field: "role", value: role.id, seat: "self" },
            then: [...pick("event", "roleEvent", role.aspects), ...pick("upgrade", "roleUpgradeCard", role.aspects)],
          })),
        },
      ],
    },
  };
}

/** The four "<Scenario side scheme> Defeated" boxes: "If the X side scheme was defeated, record it in the campaign log." */
function sideSchemeRecord(
  id: string,
  citation: string,
  fieldId: string,
  name: string,
  number: string,
): CampaignInstruction {
  return {
    id,
    text: `If the ${name} (${number}A) side scheme was defeated, record it in the campaign log.`,
    citation,
    step: {
      kind: "record",
      writes: [
        {
          field: fieldId,
          mode: "set",
          value: { kind: "atLeast", of: { kind: "cardsDefeated", name }, amount: 1 },
        },
      ],
    },
  };
}

/**
 * MC32 pp. 7/10/12/16, the Future Past Victory bullet, the record half: "Add each Future Past card found in the
 * encounter deck, discard pile, and in play to the campaign log", and (not printed as its own write) the Future Past
 * cards in the victory display, for the next instruction to remove. The add is `distinct`: setup shuffled the recorded
 * cards into the encounter deck, so the list grows by what is newly found rather than naming a card twice.
 */
function futurePastVictoryDisplayRecord(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Add each Future Past card found in the encounter deck, discard pile, and in play to the campaign log. The Future Past cards in the victory display are recorded too, to be removed by the next instruction.",
    citation,
    step: {
      kind: "record",
      writes: [
        {
          field: "futurePast",
          mode: "append",
          distinct: true,
          value: { kind: "cardsInEncounterDeckAndDiscard", query: futurePastCards, inPlay: true },
        },
        {
          field: "futurePastVictoryDisplay",
          mode: "set",
          value: { kind: "cardsInVictoryDisplay", query: futurePastCards },
        },
      ],
    },
  };
}

/** … and the removal half, which names the cards the previous instruction recorded in the victory display. */
function futurePastRemove(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Remove each Future Past card in the victory display from the campaign.",
    citation,
    step: {
      kind: "betweenGames",
      ops: [{ kind: "removeFromCampaign", cards: [field("futurePastVictoryDisplay")] }],
    },
  };
}

/** "Remove each role upgrade that began the game in play from the campaign." (MC32 pp. 7/10/12/16) */
function roleUpgradeRemove(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Remove each role upgrade that began the game in play from the campaign.",
    citation,
    step: {
      kind: "betweenGames",
      ops: [
        {
          kind: "forEachSeat",
          ops: [
            { kind: "removeFromCampaign", cards: [seatField("roleUpgrade")] },
            { kind: "clearField", field: "roleUpgrade", seat: "self" },
          ],
        },
      ],
    },
  };
}

const JUBILEE_IN_PLAY: CampaignGameQuery = {
  kind: "atLeast",
  of: { kind: "cardsInPlay", query: { categories: ["ally"], name: "Jubilee" } },
  amount: 1,
};

/** "If Jubilee (88B) is in play, record that in the campaign log." (MC32 pp. 10/12/16; pp. 12/16 add "Otherwise,
 * remove her from the campaign log", which is the same write of an unchecked box.) */
function jubileeRecord(id: string, citation: string, removeIfNot: boolean): CampaignInstruction {
  return {
    id,
    text: removeIfNot
      ? "If Jubilee (88B) is in play, record that in the campaign log. Otherwise, remove her from the campaign log."
      : "If Jubilee (88B) is in play, record that in the campaign log.",
    citation,
    step: { kind: "record", writes: [{ field: "jubilee", mode: "set", value: JUBILEE_IN_PLAY }] },
  };
}

/** "If Jubilee (88B) is in the campaign log, put her into play." (MC32 pp. 12/16/19) She is not in a scenario's own
 * sets after scenario 2, so she is set aside by id first (`setAsideCards`). */
function jubileeIntoPlay(prefix: string, citation: string): readonly CampaignInstruction[] {
  return [
    {
      id: `${prefix}.composition.jubilee`,
      text: "Set Jubilee aside when she is in the campaign log, to be put into play by the setup instruction that names her.",
      citation,
      when: { kind: "fieldIsSet", field: "jubilee" },
      step: { kind: "betweenGames", ops: [{ kind: "setAsideCards", cards: [constant(JUBILEE_ALLY)] }] },
    },
  ];
}

function jubileePut(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "If Jubilee (88B) is in the campaign log, put her into play.",
    citation,
    when: { kind: "fieldIsSet", field: "jubilee" },
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        selectCards("jubilee", encounterSetAside({ name: "Jubilee", categories: ["ally"] })),
        putIntoPlay(chosen("jubilee"), firstPlayer),
      ],
    },
  };
}

/** A recorded CAPTIVE ally that scenario 3 did not take out of the campaign (MC32 p. 12). */
const stillAvailableCaptive = (captive: CardId): CampaignPredicate => ({
  kind: "and",
  of: [
    { kind: "fieldContains", field: "captives", value: captive },
    { kind: "not", of: { kind: "fieldContains", field: "heldAllies", value: captive } },
  ],
});

/** The set-aside half of "Each CAPTIVE ally recorded in the campaign log may be shuffled into any player's deck." */
function captivesSetAside(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Set each recorded CAPTIVE ally aside, to be offered by the setup instruction that names them.",
    citation,
    // "These allies cannot be used for the rest of the campaign" (p. 12): a captive that ended under Find the Prisoners
    // or Rescue Captives (`heldAllies`, removed from the campaign at scenario 3) is not set aside again.
    step: {
      kind: "betweenGames",
      ops: CAPTIVE_ALLIES.map(({ id: captive }) => ({
        kind: "if" as const,
        when: stillAvailableCaptive(captive),
        then: [{ kind: "setAsideCards" as const, cards: [constant(captive)] }],
      })),
    },
  };
}

/**
 * MC32 pp. 12/16/19 (§3.20, Q14): each recorded CAPTIVE ally "may be shuffled into any player's deck". Optional per
 * ally, the first player chooses the deck, and the ally becomes that player's card for the game (`assignOwnerTo`).
 */
function captivesShuffle(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Each CAPTIVE ally recorded in the campaign log may be shuffled into any player's deck.",
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: CAPTIVE_ALLIES.map(({ id: captive, name }) =>
        ifThen(
          allOf(campaignLogHas("captives", captive), not(campaignLogHas("heldAllies", captive))),
          chooseOneBy(
            firstPlayer,
            option(
              `Shuffle ${name} into a player's deck`,
              choosePlayer(`captive-${name}-deck`, firstPlayer),
              grantOwnedCards(
                encounterSetAside({ name, categories: ["ally"] }),
                "deckShuffle",
                chosenPlayer(`captive-${name}-deck`),
              ),
            ),
            option("Decline", []),
          ),
        ),
      ),
    },
  };
}

/** MC32 p. 5 / pp. 10-19: "Expert Campaign Only: Record each identity's remaining hit points in the campaign log." */
function hpRecord(id: string, citation: string): CampaignInstruction {
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

/** MC32 pp. 10/12/16/19: "Expert Campaign Only: Set each player's hit points to their remaining hit point value
 * recorded in the campaign log for the previous scenario." */
function hpSet(id: string, citation: string): CampaignInstruction {
  return {
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
  };
}

/**
 * MC32 pp. 10/12/16/19: "Expert Campaign Only: Each player may place 1 acceleration token on the main scheme to heal
 * their identity to its full hit point value." **A defeated player must take it** (MC32 p. 5: they "can rejoin their
 * teammates for the next scenario by placing an acceleration token on the main scheme to restore their identity to
 * full hit points"; docs/phase7-wave6.md §4.1 Q11): an identity whose recorded hit points are 0 is not offered
 * "Decline" (`mts.ts`'s `healToFull`, the same sentence).
 */
function healToFull(id: string, citation: string): CampaignInstruction {
  const place = [addAccelerationToken()];
  const healFull = heal(damageOn(identityOf(thatPlayer)), identityOf(thatPlayer));
  return {
    id,
    text: "Expert Campaign Only: Each player may place 1 acceleration token on the main scheme to heal their identity to its full hit point value.",
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
            chooseOneBy(
              thatPlayer,
              // The label names the price (MC32 p. 10: "place 1 acceleration token on the main scheme").
              option("Heal to full · +1 acceleration token", ...place, healFull),
              option("Decline", []),
            ),
            [...place, healFull],
          ),
        ),
      ],
    },
  };
}

const flagSet = (fieldId: string): CampaignPredicate => ({ kind: "fieldIsSet", field: fieldId });

// ---------------------------------------------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------------------------------------------

export const MUT_GEN_CAMPAIGN_DEFINITION: CampaignDefinition = {
  campaignId: MUT_GEN_ID,
  version: "1",
  logFields: [
    {
      id: "remainingHp",
      label: "Remaining hit points (expert)",
      scope: "perSeat",
      type: { kind: "number", min: 0 },
      whenModes: { expertCampaign: true },
      citation: "MC32 p. 5",
    },
    {
      id: "role",
      label: "Role",
      scope: "perSeat",
      type: { kind: "choice", options: ROLES.map((role) => role.id) },
      citation: "MC32 p. 5",
    },
    {
      id: "rolesTaken",
      label: "Roles taken (working)",
      scope: "shared",
      type: { kind: "strikeList", options: ROLES.map((role) => role.id) },
      hidden: true,
      citation: "MC32 p. 5",
    },
    {
      id: "roleUpgrade",
      label: "Role upgrade in play",
      scope: "perSeat",
      type: { kind: "cardRef" },
      citation: "MC32 p. 24",
    },
    {
      id: "frightenedPolice",
      label: "Frightened Police Defeated",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC32 p. 24",
    },
    {
      id: "enemyOfMyEnemy",
      label: "Enemy of My Enemy Defeated",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC32 p. 24",
    },
    {
      id: "findThePrisoners",
      label: "Find the Prisoners Defeated",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC32 p. 24",
    },
    {
      id: "surpriseAttack",
      label: "Surprise Attack Defeated",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC32 p. 24",
    },
    {
      id: "futurePastVictoryDisplay",
      label: "Future Past Cards in the Victory Display",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC32 p. 24",
    },
    {
      id: "futurePast",
      label: "Future Past Cards in the Encounter Deck",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC32 p. 24",
    },
    { id: "jubilee", label: "Jubilee", scope: "shared", type: { kind: "flag" }, citation: "MC32 p. 24" },
    {
      id: "captives",
      label: "Allies from Abduction Protocols",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC32 p. 24",
    },
    {
      id: "heldAllies",
      label: "Allies under Rescue Captives or Find the Prisoners",
      scope: "shared",
      type: { kind: "cardList" },
      citation: "MC32 p. 24",
    },
  ],
  // MC32 p. 4: "If the players lost, they may reset the scenario and try again with no penalty", except Magneto's
  // Expert-Campaign-Only loss of the campaign (MC32 p. 19), the shape `sm.ts` uses for Venom Goblin.
  // MC32 p. 5 "Elimination and Victory": a player defeated in a scenario their teammates win skips its Victory steps
  // (their role upgrade is not removed). The rejoin is the acceleration-token heal (`healToFull`, Q11), so no
  // `rejoinAtPrintedHitPoints`.
  // A seat that sat out the Victory steps gets no hp record, so its earlier one is zeroed: it must pay to rejoin.
  everyNodeVictory: [defeatedSeatRecordsZero("mc32.victory.defeatedHp", "MC32 p. 5")],
  elimination: {
    id: "mc32.elimination",
    text: "Expert Campaign Only: If a player is defeated during a scenario that their teammates go on to win, the defeated player does not participate in the Victory steps of that scenario.",
    citation: "MC32 p. 5",
    whenModes: { expertCampaign: true },
  },
  loss: { retry: "byInstruction", retryBaseline: "nodeStart" },
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "sabretooth",
        label: "Scenario #1 - Sabretooth",
        scenario: { kind: "fixed", scenarioId: scenarioId("sabretooth") },
        composition: [composeCampaignSets("mc32.s1", "MC32 p. 7")],
        setup: [
          {
            id: "mc32.s1.setup.identity",
            text: "Each player records their identity in the campaign log found on the back cover of this rulebook. Players cannot switch identities during a campaign.",
            citation: "MC32 p. 7",
            // The seat's identity is recorded when the campaign log is created (`CampaignSeat.identityCardId`).
            step: { kind: "betweenGames", ops: [] },
          },
          {
            id: "mc32.s1.setup.roles",
            text: "Each player chooses one of the campaign roles. Record each player's role in the campaign log.",
            citation: "MC32 p. 7",
            step: {
              kind: "betweenGames",
              ops: [
                {
                  kind: "forEachSeat",
                  ops: [
                    {
                      kind: "choose",
                      slot: "role",
                      chooser: "eachSeat",
                      from: { kind: "fieldOptions", field: "rolesTaken", unstruckOnly: true },
                    },
                    { kind: "setField", field: "role", seat: "self", value: choiceOf("role") },
                    { kind: "strike", field: "rolesTaken", option: choiceOf("role") },
                  ],
                },
              ],
            },
          },
          roleUpgradeDraw("mc32.s1.setup.role-upgrade-draw", "MC32 p. 7"),
          roleUpgradePut(
            "mc32.s1.setup.role-upgrade",
            "MC32 p. 7",
            "Each player takes one random upgrade from their role's set of cards and puts it into play under their control.",
          ),
          roleBuilding("mc32.s1.setup.role-building", "MC32 p. 7"),
          futurePastDeckFirst("mc32.s1.setup.future-past", "MC32 p. 7"),
          revealCampaignSideScheme("mc32.s1.setup.frightened-police", "MC32 p. 7", "Frightened Police", "171"),
        ],
        victory: [
          sideSchemeRecord(
            "mc32.s1.victory.frightened-police",
            "MC32 p. 7",
            "frightenedPolice",
            "Frightened Police",
            "171",
          ),
          futurePastVictoryDisplayRecord("mc32.s1.victory.future-past-display", "MC32 p. 7"),
          futurePastRemove("mc32.s1.victory.future-past", "MC32 p. 7"),
          roleUpgradeRemove("mc32.s1.victory.role-upgrades", "MC32 p. 7"),
          hpRecord("mc32.s1.victory.hp", "MC32 p. 7"),
        ],
      },
      {
        id: "project-wideawake",
        label: "Scenario #2 - Project Wideawake",
        scenario: { kind: "fixed", scenarioId: scenarioId("project-wideawake") },
        composition: [composeCampaignSets("mc32.s2", "MC32 p. 10")],
        setup: [
          futurePastDeckRecorded("mc32.s2.setup.future-past", "MC32 p. 10"),
          roleUpgradeDraw("mc32.s2.setup.role-upgrade-draw", "MC32 p. 10", flagSet("frightenedPolice")),
          roleUpgradePut(
            "mc32.s2.setup.role-upgrade",
            "MC32 p. 10",
            "If Frightened Police Defeated is checked in the campaign log, each player takes 1 random upgrade from their role's set of cards and puts it into play under their control.",
            flagSet("frightenedPolice"),
          ),
          roleBuilding("mc32.s2.setup.role-building", "MC32 p. 10"),
          revealCampaignSideScheme("mc32.s2.setup.enemy-of-my-enemy", "MC32 p. 10", "Enemy of My Enemy", "172"),
          hpSet("mc32.s2.setup.hp-set", "MC32 p. 10"),
          healToFull("mc32.s2.setup.heal", "MC32 p. 10"),
        ],
        victory: [
          sideSchemeRecord(
            "mc32.s2.victory.enemy-of-my-enemy",
            "MC32 p. 10",
            "enemyOfMyEnemy",
            "Enemy of My Enemy",
            "172",
          ),
          futurePastVictoryDisplayRecord("mc32.s2.victory.future-past-display", "MC32 p. 10"),
          futurePastRemove("mc32.s2.victory.future-past", "MC32 p. 10"),
          roleUpgradeRemove("mc32.s2.victory.role-upgrades", "MC32 p. 10"),
          jubileeRecord("mc32.s2.victory.jubilee", "MC32 p. 10", false),
          {
            id: "mc32.s2.victory.captives",
            text: "Record the name of each CAPTIVE ally that entered play in the campaign log.",
            citation: "MC32 p. 10",
            step: {
              kind: "record",
              writes: [
                {
                  field: "captives",
                  mode: "set",
                  value: { kind: "cardsThatEnteredPlay", query: { categories: ["ally"], trait: CAPTIVE } },
                },
              ],
            },
          },
          hpRecord("mc32.s2.victory.hp", "MC32 p. 10"),
        ],
      },
      {
        id: "master-mold",
        label: "Scenario #3 - Master Mold",
        scenario: { kind: "fixed", scenarioId: scenarioId("master-mold") },
        composition: [
          composeCampaignSets("mc32.s3", "MC32 p. 12"),
          ...jubileeIntoPlay("mc32.s3", "MC32 p. 12"),
          captivesSetAside("mc32.s3.composition.captives", "MC32 p. 12"),
        ],
        setup: [
          futurePastDeckRecorded("mc32.s3.setup.future-past", "MC32 p. 12"),
          jubileePut("mc32.s3.setup.jubilee", "MC32 p. 12"),
          captivesShuffle("mc32.s3.setup.captives", "MC32 p. 12"),
          roleUpgradeDraw("mc32.s3.setup.role-upgrade-draw", "MC32 p. 12", flagSet("enemyOfMyEnemy")),
          roleUpgradePut(
            "mc32.s3.setup.role-upgrade",
            "MC32 p. 12",
            "If Enemy of My Enemy Defeated is checked in the campaign log, each player takes 1 random upgrade from their role's set of cards and puts it into play under their control.",
            flagSet("enemyOfMyEnemy"),
          ),
          roleBuilding("mc32.s3.setup.role-building", "MC32 p. 12"),
          revealCampaignSideScheme("mc32.s3.setup.find-the-prisoners", "MC32 p. 12", "Find the Prisoners", "173"),
          hpSet("mc32.s3.setup.hp-set", "MC32 p. 12"),
          healToFull("mc32.s3.setup.heal", "MC32 p. 12"),
        ],
        victory: [
          sideSchemeRecord(
            "mc32.s3.victory.find-the-prisoners",
            "MC32 p. 12",
            "findThePrisoners",
            "Find the Prisoners",
            "173",
          ),
          futurePastVictoryDisplayRecord("mc32.s3.victory.future-past-display", "MC32 p. 12"),
          futurePastRemove("mc32.s3.victory.future-past", "MC32 p. 12"),
          roleUpgradeRemove("mc32.s3.victory.role-upgrades", "MC32 p. 12"),
          jubileeRecord("mc32.s3.victory.jubilee", "MC32 p. 12", true),
          {
            id: "mc32.s3.victory.held-allies",
            text: "Record the name of each ally that ended the game under Find the Prisoners or Rescue Captives. These allies cannot be used for the rest of the campaign.",
            citation: "MC32 p. 12",
            step: {
              kind: "record",
              writes: [
                {
                  field: "heldAllies",
                  mode: "set",
                  value: {
                    kind: "cardsTuckedUnder",
                    under: { anyOf: [{ name: "Find the Prisoners" }, { name: "Rescue Captives" }] },
                    query: { categories: ["ally"] },
                  },
                },
              ],
            },
          },
          {
            id: "mc32.s3.victory.held-allies-remove",
            text: "Remove the allies recorded by the previous instruction from the campaign: they cannot be used for the rest of the campaign.",
            citation: "MC32 p. 12",
            step: { kind: "betweenGames", ops: [{ kind: "removeFromCampaign", cards: [field("heldAllies")] }] },
          },
          hpRecord("mc32.s3.victory.hp", "MC32 p. 12"),
        ],
      },
      {
        id: "mansion-attack",
        label: "Scenario #4 - Mansion Attack",
        scenario: { kind: "fixed", scenarioId: scenarioId("mansion-attack") },
        composition: [
          composeCampaignSets("mc32.s4", "MC32 p. 16"),
          ...jubileeIntoPlay("mc32.s4", "MC32 p. 16"),
          captivesSetAside("mc32.s4.composition.captives", "MC32 p. 16"),
        ],
        setup: [
          futurePastDeckRecorded("mc32.s4.setup.future-past", "MC32 p. 16"),
          jubileePut("mc32.s4.setup.jubilee", "MC32 p. 16"),
          captivesShuffle("mc32.s4.setup.captives", "MC32 p. 16"),
          roleUpgradeDraw("mc32.s4.setup.role-upgrade-draw", "MC32 p. 16", flagSet("findThePrisoners")),
          roleUpgradePut(
            "mc32.s4.setup.role-upgrade",
            "MC32 p. 16",
            "If Find the Prisoners Defeated is checked in the campaign log, each player takes 1 random upgrade from their role's set of cards and puts it into play under their control.",
            flagSet("findThePrisoners"),
          ),
          roleBuilding("mc32.s4.setup.role-building", "MC32 p. 16"),
          revealCampaignSideScheme("mc32.s4.setup.surprise-attack", "MC32 p. 16", "Surprise Attack", "174"),
          hpSet("mc32.s4.setup.hp-set", "MC32 p. 16"),
          healToFull("mc32.s4.setup.heal", "MC32 p. 16"),
        ],
        victory: [
          sideSchemeRecord("mc32.s4.victory.surprise-attack", "MC32 p. 16", "surpriseAttack", "Surprise Attack", "174"),
          futurePastVictoryDisplayRecord("mc32.s4.victory.future-past-display", "MC32 p. 16"),
          futurePastRemove("mc32.s4.victory.future-past", "MC32 p. 16"),
          roleUpgradeRemove("mc32.s4.victory.role-upgrades", "MC32 p. 16"),
          jubileeRecord("mc32.s4.victory.jubilee", "MC32 p. 16", true),
          hpRecord("mc32.s4.victory.hp", "MC32 p. 16"),
        ],
      },
      {
        id: "magneto",
        label: "Scenario #5 - Magneto",
        scenario: { kind: "fixed", scenarioId: scenarioId("magneto") },
        composition: [
          composeCampaignSets("mc32.s5", "MC32 p. 19"),
          ...jubileeIntoPlay("mc32.s5", "MC32 p. 19"),
          captivesSetAside("mc32.s5.composition.captives", "MC32 p. 19"),
        ],
        setup: [
          futurePastDeckRecorded("mc32.s5.setup.future-past", "MC32 p. 19"),
          jubileePut("mc32.s5.setup.jubilee", "MC32 p. 19"),
          captivesShuffle("mc32.s5.setup.captives", "MC32 p. 19"),
          roleUpgradeDraw("mc32.s5.setup.role-upgrade-draw", "MC32 p. 19", flagSet("surpriseAttack")),
          roleUpgradePut(
            "mc32.s5.setup.role-upgrade",
            "MC32 p. 19",
            "If Surprise Attack Defeated is checked in the campaign log, each player takes 1 random upgrade from their role's set of cards and puts it into play under their control.",
            flagSet("surpriseAttack"),
          ),
          roleBuilding("mc32.s5.setup.role-building", "MC32 p. 19"),
          revealCampaignSideScheme("mc32.s5.setup.magnetos-fortress", "MC32 p. 19", "Magneto's Fortress", "175"),
          hpSet("mc32.s5.setup.hp-set", "MC32 p. 19"),
          healToFull("mc32.s5.setup.heal", "MC32 p. 19"),
        ],
        victory: [
          {
            id: "mc32.s5.victory.win",
            text: "Magneto is defeated and the players win the campaign! Turn the page to read the conclusion.",
            citation: "MC32 p. 19",
            step: { kind: "betweenGames", ops: [] },
          },
        ],
        defeat: [
          {
            id: "mc32.s5.defeat.lose-campaign",
            text: "Expert Campaign Only: If the players lose this game, Magneto rules the world with an iron fist and the players lose the campaign.",
            citation: "MC32 p. 19",
            whenModes: { expertCampaign: true },
            step: { kind: "betweenGames", ops: [{ kind: "endCampaign", result: "lost" }] },
          },
        ],
      },
    ],
  },
};
