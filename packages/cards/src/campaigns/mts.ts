/**
 * The Mad Titan's Shadow (MC21) — the second-cheapest box (docs/campaign-mode-design.md's own "a campaign pool of
 * flags, no currency, no track"), the third `CampaignDefinition` after `trors.ts`/`gmw.ts`.
 *
 * This is `campaigns/mts.gate.test.ts`'s TEST-ONLY definition (docs/campaign-mode-design.md §11 step 12's
 * acceptance gate) re-encoded against the box's now-ingested `@mc/content` ids: real scenario ids
 * (`MTS_SCENARIOS`), real card ids (`packages/content/src/data/mts/cards.ts` 21180–21193), and the real
 * `MTS_CAMPAIGN` record. The gate's own verdict stands unchanged: every printed instruction fits the frozen
 * campaign vocabulary (`CampaignOp`/`CampaignGameQuery`/`CampaignPredicate`/`CampaignValue`) with the one
 * content-only DSL addition the gate already made (`addAccelerationToken`'s optional `target`) and the one ordinary
 * value primitive it needed (`ValueSpec deckCount`, already landed in `@mc/engine`/`deckCountOf`). No further
 * campaign-foundation change was needed writing this file.
 *
 * Source of truth: `docs/campaign-modes/markdown/mc21_the_mad_titans_shadow.md` (cited below as "MC21 p. N") and
 * `docs/campaign-modes/log-sheets/mc21_the_mad_titans_shadow_rulebook-compressed-campaign_log.pdf` (its four
 * columns are `logFields` below). Every `CampaignInstruction` carries the citation of the printed bullet it
 * encodes, in the order that bullet is printed on its page. Only the printed "CAMPAIGN INSTRUCTIONS" (SETUP:/
 * VICTORY:) bullets and the general "CAMPAIGN MODE RULES"/"EXPERT CAMPAIGN RULES" text are encoded here — the
 * scenario mechanics themselves (Spell environments, two main schemes/two villains, infinite hit points, Loki's
 * five stage-I cards) are ordinary scenario card scripts, in `../wave4/mts/*.ts`, not the campaign definition.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * MODELING CHOICES CARRIED OVER FROM THE GATE (unchanged; see `mts.gate.test.ts`'s own header for the full
 * reasoning behind each).
 *
 * 1. The campaign pool is nine `flag` fields (one checkbox per named card on the log sheet, MC21 p. 28), not one
 *    `cardList`. Every pool card is referenced by its printed name, except the three granted to a deck (Shawarma,
 *    System Shock, Norn Stone), which need a `CardId` because `grantCard` addresses cards by id.
 * 2. "Was defeated" / "is NOT in the victory display" is a bridge-then-negate pair (`bridgeThenAddToPool`): a
 *    `record` instruction writes the positive fact, then a `betweenGames` instruction gated on its negation adds
 *    to the pool.
 * 3. "1B was completed" reads the *next* stage (stage 2, whose printed name is known) entering play — a causal
 *    equivalence for a main scheme deck that only ever advances forward (RRG 1.8 "Main Scheme").
 * 4. Carried-forward pool cards (Cosmo, Security Breach, Black Swan, Odin) are composed in via `CampaignOp
 *    composeEncounterSets`, each into its own one-card synthetic set (`MTS_POOL_*_SET`, local ids — see the
 *    module docblock note on why these are not `@mc/content` `EncounterSetId`s: `composeEncounterSets`' `sets`
 *    field is a plain `CampaignValue` string, and wiring `CampaignGameInput.composedEncounterSetIds` into a real
 *    `GameSetupConfig.setAside` list is a scenario-builder concern, not this file's).
 * 5. Norn Stone is granted like Shawarma/System Shock (`grantCard(..., "thisGame")`): its own printed
 *    `Permanent. Setup.` keyword already puts it into play once it is in a deck (RRG 1.8 Appendix II step 11's
 *    setup-keyword sweep), matching `trors.ts`'s own Basic Condition upgrades.
 * 6. Odin enters play on his printed default (Captive) face when composed in fresh (scenario 3); scenario 5's own
 *    "put Odin into play on his King side" instead flips him immediately after — `21139a`'s Captive side is his
 *    printed front face (`@mc/content`'s own `otherFaceId` pairing, `hela.ts`'s own module docblock).
 * 7. Two additional carried-forward instructions the gate's synthetic ids couldn't name yet, now that the real
 *    card kit exists: scenario 3's "If Avengers Tower had the Damaged trait, deal three damage to each identity"
 *    reads `avengersTowerDamaged` exactly as recorded in scenario 2; scenario 5's Odin composition flips him to
 *    his King side after entering play (choice 6 above), since `composeCarriedForward`'s own `putIntoPlay` always
 *    enters a card on its printed default face.
 */

import { cardId, campaignId, scenarioId, trait, type CampaignId, type CardId } from "@mc/content";
import {
  DEFAULT_CAMPAIGN_WINDOW,
  type CampaignDefinition,
  type CampaignGameQuery,
  type CampaignInstruction,
  type CampaignOp,
} from "@mc/engine";
import {
  addAccelerationToken,
  campaignLogIsSet,
  campaignLogValue,
  chooseOneBy,
  chooseTarget,
  chosen,
  damageOn,
  deckCountOf,
  eachPlayer,
  encounterSetAside,
  engage,
  firstPlayer,
  flipCard,
  forEachPlayer,
  heal,
  identityOf,
  ifThen,
  moveCards,
  named,
  option,
  putIntoPlay,
  scaled,
  selectCards,
  setRemainingHitPoints,
  takeDamage,
  thatPlayer,
  zone,
} from "../dsl/index.js";

const MTS_CAMPAIGN_ID: CampaignId = campaignId("mts");

/** MC21 p. 13: "Check here if Avengers Tower has the **_Damaged_** trait." A printed trait, not a face lookup. */
const DAMAGED = trait("DAMAGED");

/** Deck-granted campaign cards (MC21 p. 4: "Cards 180-193 … cannot be included in any deck unless … directed to add
 * them"). These are the only three MC21 pool cards ever addressed by id, because `grantCard` needs one. */
const SHAWARMA: CardId = cardId("21183");
const SYSTEM_SHOCK: CardId = cardId("21185");
const NORN_STONE: CardId = cardId("21187a");

/** One-card synthetic carry-forward sets (modeling choice 4 above): local ids, never registered as real
 * `@mc/content` encounter sets — `composeEncounterSets`'s own `sets` field is a plain string. */
const COSMO_SET = "mts.pool.cosmo";
const SECURITY_BREACH_SET = "mts.pool.security-breach";
const BLACK_SWAN_SET = "mts.pool.black-swan";
const ODIN_SET = "mts.pool.odin";

// ---------------------------------------------------------------------------------------------------------------
// Repeated shapes, factored once — mirrors `trors.ts`'s `repeatedSetup`/`hpRecordVictory` factories.
// ---------------------------------------------------------------------------------------------------------------

/** MC21 p. 13/17/21/25: "Expert Campaign Only: Set each player's hit points to their remaining hit point value
 * recorded in the campaign log for the previous scenario." Printed identically on scenarios 2-5's SETUP list. */
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

/** MC21 p. 7/13/17/21: "Expert Campaign Only: Record each identity's remaining hit points in the campaign log."
 * Printed identically after every scenario's VICTORY bullets except the last (Loki, MC21 p. 25, has none — the
 * campaign is over). */
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

/**
 * MC21 p. 13's "one of the main schemes" (Tower Defense has two) vs. p. 17/21/25's "the main scheme" (every other
 * scenario has one): the printed sentence is otherwise identical, so `chooseScheme` is the only branch. "Decline"
 * is the second `option`, matching the ability DSL's own `chooseOne`/"you may" idiom.
 */
function healToFull(id: string, citation: string, chooseScheme: boolean): CampaignInstruction {
  const place = chooseScheme
    ? [
        chooseTarget("scheme", { categories: ["mainScheme"] }, { chooser: thatPlayer }),
        addAccelerationToken(chosen("scheme")),
      ]
    : [addAccelerationToken()];
  return {
    id,
    text: chooseScheme
      ? "Expert Campaign Only: Each player may place one acceleration token on one of the main schemes to heal their identity to its full hit point value."
      : "Expert Campaign Only: Each player may place one acceleration token on the main scheme to heal their identity to its full hit point value.",
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
            option("Heal to full", ...place, heal(damageOn(identityOf(thatPlayer)), identityOf(thatPlayer))),
            option("Decline", []),
          ),
        ),
      ],
    },
  };
}

/** "Put the '<name>' side scheme into play." (MC21 p. 7/13/17/21/25, one per scenario's opening SETUP bullet.) */
function putSideSchemeIntoPlay(id: string, citation: string, name: string): CampaignInstruction {
  return {
    id,
    text: `Put the "${name}" side scheme into play.`,
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [selectCards("scheme", encounterSetAside({ name })), putIntoPlay(chosen("scheme"), firstPlayer)],
    },
  };
}

/** "Shuffle the '<name>' <kind> into the encounter deck." (Security Breach MC21 p. 7; Summoned Back MC21 p. 21/25.) */
function shuffleIntoEncounterDeck(id: string, citation: string, name: string, kind: string): CampaignInstruction {
  return {
    id,
    text: `Shuffle the "${name}" ${kind} into the encounter deck.`,
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [moveCards(encounterSetAside({ name }), "encounterDeckShuffle")],
    },
  };
}

/** "If <name> is in the campaign pool, shuffle it into the encounter deck." (Security Breach, MC21 p. 13/17.) */
function poolShuffleIntoEncounterDeck(
  id: string,
  citation: string,
  poolField: string,
  name: string,
): CampaignInstruction {
  return {
    id,
    text: `If ${name} is in the campaign pool, shuffle it into the encounter deck.`,
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        ifThen(campaignLogIsSet(poolField, true), moveCards(encounterSetAside({ name }), "encounterDeckShuffle")),
      ],
    },
  };
}

/** "If <name> is in the campaign pool, each player shuffles one copy of <name> into their deck." (Shawarma MC21 p.
 * 17/21/25; System Shock MC21 p. 21/25) — a `thisGame` grant (modeling choice 5), not literally an in-game shuffle:
 * the card ends up in the player's deck for this game only, exactly what "shuffles … into their deck" describes,
 * and it correctly does not persist (`applyCampaignResult` expires `thisGame` grants every game). */
function poolDeckGrant(
  id: string,
  citation: string,
  poolField: string,
  card: CardId,
  name: string,
): CampaignInstruction {
  return {
    id,
    text: `If ${name} is in the campaign pool, each player shuffles one copy of ${name} into their deck.`,
    citation,
    when: { kind: "fieldIsSet", field: poolField },
    step: {
      kind: "betweenGames",
      ops: [
        {
          kind: "forEachSeat",
          ops: [{ kind: "grantCard", seat: "self", card: { kind: "const", value: card }, permanence: "thisGame" }],
        },
      ],
    },
  };
}

/** MC21 p. 17: "If Cosmo is in the campaign pool, put him into play under the first player's control." / p. 25's
 * Odin (no `engage`). `controller` defaults to `firstPlayer`, matching the printed "under the first player's
 * control". */
function poolPutIntoPlay(
  id: string,
  citation: string,
  poolField: string,
  slot: string,
  name: string,
  text: string,
): CampaignInstruction {
  return {
    id,
    text,
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        ifThen(campaignLogIsSet(poolField, true), [
          selectCards(slot, encounterSetAside({ name })),
          putIntoPlay(chosen(slot), firstPlayer),
        ]),
      ],
    },
  };
}

/** MC21 p. 17: "If Black Swan is in the campaign pool, put her into play engaged with the first player." */
function poolPutIntoPlayEngaged(
  id: string,
  citation: string,
  poolField: string,
  slot: string,
  name: string,
): CampaignInstruction {
  return {
    id,
    text: `If ${name} is in the campaign pool, put her into play engaged with the first player.`,
    citation,
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        ifThen(campaignLogIsSet(poolField, true), [
          selectCards(slot, encounterSetAside({ name })),
          putIntoPlay(chosen(slot), firstPlayer),
          engage(chosen(slot), firstPlayer),
        ]),
      ],
    },
  };
}

/** MC21 p. 13/17's composition half of a carried-forward pool card (modeling choice 4): brings the card's own
 * one-card synthetic set into a later scenario's game before setup runs, when its pool flag is set. */
function composeCarriedForward(
  id: string,
  citation: string,
  poolField: string,
  set: string,
  name: string,
): CampaignInstruction {
  return {
    id,
    text: `(Composition half of putting ${name} into play: bring its card into this scenario's pool, since it was earned in an earlier one.)`,
    citation,
    when: { kind: "fieldIsSet", field: poolField },
    step: { kind: "betweenGames", ops: [{ kind: "composeEncounterSets", sets: [{ kind: "const", value: set }] }] },
  };
}

/**
 * "Was defeated" / "is NOT in the victory display" (modeling choice 2): a `record` bridge writing the *positive*
 * fact, then a `betweenGames` pool-add gated on its negation. `bridgeQuery` is `cardsInPlay` for "was defeated"
 * (true = still in play = NOT defeated) or `cardsInVictoryDisplay` for "is NOT in the display" (true = IS shown).
 */
function bridgeThenAddToPool(opts: {
  readonly idPrefix: string;
  readonly citation: string;
  readonly text: string;
  readonly bridgeField: string;
  readonly bridgeQuery: CampaignGameQuery;
  readonly poolField: string;
}): readonly CampaignInstruction[] {
  return [
    {
      id: `${opts.idPrefix}.record`,
      text: `(Reading half of the same sentence: whether the condition holds when the game ends.)`,
      citation: opts.citation,
      step: { kind: "record", writes: [{ field: opts.bridgeField, mode: "set", value: opts.bridgeQuery }] },
    },
    {
      id: `${opts.idPrefix}.pool`,
      text: opts.text,
      citation: opts.citation,
      when: { kind: "not", of: { kind: "fieldIsSet", field: opts.bridgeField } },
      step: {
        kind: "betweenGames",
        ops: [{ kind: "setField", field: opts.poolField, value: { kind: "const", value: true } } satisfies CampaignOp],
      },
    },
  ];
}

/** The printed text both instructions share (MC21 p. 21, p. 25), pinned so a test file and the report agree. */
export const INFINITY_STONES_DISCARD_TEXT =
  "If The Infinity Stones 1B was completed, each player discards the top half of their deck.";

/**
 * MC21 p. 21 / p. 25's shared SETUP bullet. "The top half of their deck" is `scaled(deckCountOf(thatPlayer),
 * { divide: { by: 2, … } })` feeding the `zone` selector's `top`, per player.
 *
 * **Rounding: down** (decided 2026-09-22, `mts.gate.test.ts`). The printed campaign sentence states no direction.
 * RRG 1.8 "Modifiers" (p. 29) — "Fractional values are rounded up after all modifiers have been applied" — is
 * about modified values, not about halving a deck, and MC21's own card with the near-identical sentence prints
 * "(rounded down)" (`docs/cards/by_pack/mts.md`: "removes the top half of their deck (rounded down) from the
 * game"). No ruling covers it; worth asking FFG.
 */
function infinityStonesDiscard(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: INFINITY_STONES_DISCARD_TEXT,
    citation,
    when: { kind: "fieldIsSet", field: "infinityStones1BCompleted" },
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(
          eachPlayer,
          moveCards(
            zone("deck", thatPlayer, {
              top: scaled(deckCountOf(thatPlayer), { divide: { by: 2, round: "down" } }),
            }),
            "discard",
          ),
        ),
      ],
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------------------------------------------

export const MTS_CAMPAIGN_DEFINITION: CampaignDefinition = {
  campaignId: MTS_CAMPAIGN_ID,
  version: "1",
  logFields: [
    {
      id: "remainingHp",
      label: "Remaining hit points",
      scope: "perSeat",
      type: { kind: "number", min: 0 },
      whenModes: { expertCampaign: true },
      citation: "MC21 p. 28",
    },
    {
      id: "cosmoInPool",
      label: "Cosmo added to campaign pool",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 28",
    },
    {
      id: "securityBreachInPool",
      label: "Security Breach added to campaign pool",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 28",
    },
    {
      id: "shawarmaInPool",
      label: "Shawarma added to campaign pool",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 28",
    },
    {
      id: "blackSwanInPool",
      label: "Black Swan added to campaign pool",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 28",
    },
    {
      id: "avengersTowerDamaged",
      label: "Avengers Tower has the Damaged trait",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 28",
    },
    {
      id: "systemShockInPool",
      label: "System Shock added to campaign pool",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 28",
    },
    {
      id: "infinityStones1BCompleted",
      label: "The Infinity Stones 1B was completed",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 28",
    },
    {
      id: "nornStoneInPool",
      label: "Norn Stone added to campaign pool",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 28",
    },
    {
      id: "odinInPool",
      label: "Odin added to campaign pool",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 28",
    },
    // Bridging fields the printed sheet has no column for (modeling choice 2), mirroring `trors.ts`'s own four.
    {
      id: "secureLandingPadInPlay",
      label: "Secure the Landing Pad still in play",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 7",
    },
    {
      id: "saveShawarmaPlaceInPlay",
      label: "Save the Shawarma Place still in play",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 13",
    },
    {
      id: "blackSwanDefeated",
      label: "Black Swan in the victory display",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 13",
    },
    {
      id: "defensiveProtocolsDefeated",
      label: "Defensive Protocols in the victory display",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 17",
    },
    {
      id: "findNornStonesInPlay",
      label: "Find the Norn Stones still in play",
      scope: "shared",
      type: { kind: "flag" },
      citation: "MC21 p. 21",
    },
  ],
  // MC21 p. 4: "If the players lost, they may reset the scenario and try again with no penalty" — for every
  // scenario except Loki's Expert-Campaign-Only exception (MC21 p. 25).
  loss: { retry: "byInstruction", retryBaseline: "nodeStart" },
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "ebony-maw",
        label: "Scenario #1 - Ebony Maw",
        scenario: { kind: "fixed", scenarioId: scenarioId("ebony-maw") },
        setup: [
          {
            id: "mc21.s1.setup.identity",
            text: "Each player records their identity in the campaign log found on the back cover of this rulebook. Players cannot switch identities during a campaign.",
            citation: "MC21 p. 7",
            step: { kind: "betweenGames", ops: [] },
          },
          putSideSchemeIntoPlay("mc21.s1.setup.landing-pad", "MC21 p. 7", "Secure the Landing Pad"),
          shuffleIntoEncounterDeck("mc21.s1.setup.security-breach", "MC21 p. 7", "Security Breach", "side scheme"),
        ],
        victory: [
          ...bridgeThenAddToPool({
            idPrefix: "mc21.s1.victory.landing-pad",
            citation: "MC21 p. 7",
            text: "If Secure the Landing Pad was defeated, add Cosmo to the campaign pool.",
            bridgeField: "secureLandingPadInPlay",
            bridgeQuery: {
              kind: "atLeast",
              of: { kind: "cardsInPlay", query: { name: "Secure the Landing Pad" } },
              amount: 1,
            },
            poolField: "cosmoInPool",
          }),
          {
            id: "mc21.s1.victory.security-breach",
            text: "If Attack on Knowhere 1B was completed, add Security Breach to the campaign pool.",
            citation: "MC21 p. 7",
            step: {
              kind: "record",
              writes: [
                {
                  field: "securityBreachInPool",
                  mode: "set",
                  value: {
                    kind: "atLeast",
                    of: { kind: "cardsThatEnteredPlay", query: { name: "The Power Stone" } },
                    amount: 1,
                  },
                },
              ],
            },
          },
          hpRecord("mc21.s1.victory.hp", "MC21 p. 7"),
        ],
      },
      {
        id: "tower-defense",
        label: "Scenario #2 - Tower Defense",
        scenario: { kind: "fixed", scenarioId: scenarioId("tower-defense") },
        composition: [
          composeCarriedForward(
            "mc21.s2.compose.security-breach",
            "MC21 p. 13",
            "securityBreachInPool",
            SECURITY_BREACH_SET,
            "Security Breach",
          ),
        ],
        setup: [
          putSideSchemeIntoPlay("mc21.s2.setup.shawarma-place", "MC21 p. 13", "Save the Shawarma Place"),
          poolShuffleIntoEncounterDeck(
            "mc21.s2.setup.security-breach",
            "MC21 p. 13",
            "securityBreachInPool",
            "Security Breach",
          ),
          hpSet("mc21.s2.setup.hp", "MC21 p. 13"),
          healToFull("mc21.s2.setup.heal", "MC21 p. 13", true),
        ],
        victory: [
          ...bridgeThenAddToPool({
            idPrefix: "mc21.s2.victory.shawarma-place",
            citation: "MC21 p. 13",
            text: "If Save the Shawarma Place was defeated, add Shawarma to the campaign pool.",
            bridgeField: "saveShawarmaPlaceInPlay",
            bridgeQuery: {
              kind: "atLeast",
              of: { kind: "cardsInPlay", query: { name: "Save the Shawarma Place" } },
              amount: 1,
            },
            poolField: "shawarmaInPool",
          }),
          ...bridgeThenAddToPool({
            idPrefix: "mc21.s2.victory.black-swan",
            citation: "MC21 p. 13",
            text: "If Black Swan is NOT in the victory display, add her to the campaign pool.",
            bridgeField: "blackSwanDefeated",
            bridgeQuery: {
              kind: "atLeast",
              of: { kind: "cardsInVictoryDisplay", query: { name: "Black Swan" } },
              amount: 1,
            },
            poolField: "blackSwanInPool",
          }),
          {
            id: "mc21.s2.victory.tower-damaged",
            text: "If Avengers Tower has the Damaged trait, record that in the campaign log.",
            citation: "MC21 p. 13",
            step: {
              kind: "record",
              writes: [
                {
                  field: "avengersTowerDamaged",
                  mode: "set",
                  value: {
                    kind: "atLeast",
                    of: { kind: "cardsInPlay", query: { name: "Avengers Tower", trait: DAMAGED } },
                    amount: 1,
                  },
                },
              ],
            },
          },
          hpRecord("mc21.s2.victory.hp", "MC21 p. 13"),
        ],
      },
      {
        id: "thanos",
        label: "Scenario #3 - Thanos",
        scenario: { kind: "fixed", scenarioId: scenarioId("thanos") },
        composition: [
          composeCarriedForward("mc21.s3.compose.cosmo", "MC21 p. 17", "cosmoInPool", COSMO_SET, "Cosmo"),
          composeCarriedForward(
            "mc21.s3.compose.security-breach",
            "MC21 p. 17",
            "securityBreachInPool",
            SECURITY_BREACH_SET,
            "Security Breach",
          ),
          composeCarriedForward(
            "mc21.s3.compose.black-swan",
            "MC21 p. 17",
            "blackSwanInPool",
            BLACK_SWAN_SET,
            "Black Swan",
          ),
        ],
        setup: [
          putSideSchemeIntoPlay("mc21.s3.setup.sanctuarys-computer", "MC21 p. 17", "Hack Sanctuary's Computer"),
          poolPutIntoPlay(
            "mc21.s3.setup.cosmo",
            "MC21 p. 17",
            "cosmoInPool",
            "cosmo",
            "Cosmo",
            "If Cosmo is in the campaign pool, put him into play under the first player's control.",
          ),
          poolShuffleIntoEncounterDeck(
            "mc21.s3.setup.security-breach",
            "MC21 p. 17",
            "securityBreachInPool",
            "Security Breach",
          ),
          poolDeckGrant("mc21.s3.setup.shawarma", "MC21 p. 17", "shawarmaInPool", SHAWARMA, "Shawarma"),
          poolPutIntoPlayEngaged(
            "mc21.s3.setup.black-swan",
            "MC21 p. 17",
            "blackSwanInPool",
            "blackswan",
            "Black Swan",
          ),
          hpSet("mc21.s3.setup.hp", "MC21 p. 17"),
          healToFull("mc21.s3.setup.heal", "MC21 p. 17", false),
          {
            id: "mc21.s3.setup.tower-damage",
            text: "If Avengers Tower had the Damaged trait, deal three damage to each identity.",
            citation: "MC21 p. 17",
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                forEachPlayer(
                  eachPlayer,
                  ifThen(campaignLogIsSet("avengersTowerDamaged", true), takeDamage(3, thatPlayer)),
                ),
              ],
            },
          },
        ],
        victory: [
          ...bridgeThenAddToPool({
            idPrefix: "mc21.s3.victory.defensive-protocols",
            citation: "MC21 p. 17",
            text: "If Defensive Protocols is NOT in the victory display, add System Shock to the campaign pool.",
            bridgeField: "defensiveProtocolsDefeated",
            bridgeQuery: {
              kind: "atLeast",
              of: { kind: "cardsInVictoryDisplay", query: { name: "Defensive Protocols" } },
              amount: 1,
            },
            poolField: "systemShockInPool",
          }),
          {
            id: "mc21.s3.victory.infinity-stones",
            text: "If The Infinity Stones 1B was completed, record that in the campaign log.",
            citation: "MC21 p. 17",
            step: {
              kind: "record",
              writes: [
                {
                  field: "infinityStones1BCompleted",
                  mode: "set",
                  value: {
                    kind: "atLeast",
                    of: { kind: "cardsThatEnteredPlay", query: { name: "Balance the Scales" } },
                    amount: 1,
                  },
                },
              ],
            },
          },
          hpRecord("mc21.s3.victory.hp", "MC21 p. 17"),
        ],
      },
      {
        id: "hela",
        label: "Scenario #4 - Hela",
        scenario: { kind: "fixed", scenarioId: scenarioId("hela") },
        setup: [
          putSideSchemeIntoPlay("mc21.s4.setup.norn-stones", "MC21 p. 21", "Find the Norn Stones"),
          shuffleIntoEncounterDeck("mc21.s4.setup.summoned-back", "MC21 p. 21", "Summoned Back", "treachery"),
          poolDeckGrant("mc21.s4.setup.shawarma", "MC21 p. 21", "shawarmaInPool", SHAWARMA, "Shawarma"),
          poolDeckGrant("mc21.s4.setup.system-shock", "MC21 p. 21", "systemShockInPool", SYSTEM_SHOCK, "System Shock"),
          infinityStonesDiscard("mc21.s4.setup.infinity-stones-discard", "MC21 p. 21"),
          hpSet("mc21.s4.setup.hp", "MC21 p. 21"),
          healToFull("mc21.s4.setup.heal", "MC21 p. 21", false),
        ],
        victory: [
          ...bridgeThenAddToPool({
            idPrefix: "mc21.s4.victory.norn-stones",
            citation: "MC21 p. 21",
            text: "If Find the Norn Stones was defeated, add Norn Stone to the campaign pool.",
            bridgeField: "findNornStonesInPlay",
            bridgeQuery: {
              kind: "atLeast",
              of: { kind: "cardsInPlay", query: { name: "Find the Norn Stones" } },
              amount: 1,
            },
            poolField: "nornStoneInPool",
          }),
          {
            id: "mc21.s4.victory.odin",
            text: "If Retrieve Odin's Armor is in the victory display, add Odin to the campaign pool.",
            citation: "MC21 p. 21",
            step: {
              kind: "record",
              writes: [
                {
                  field: "odinInPool",
                  mode: "set",
                  value: {
                    kind: "atLeast",
                    of: { kind: "cardsInVictoryDisplay", query: { name: "Retrieve Odin's Armor" } },
                    amount: 1,
                  },
                },
              ],
            },
          },
          hpRecord("mc21.s4.victory.hp", "MC21 p. 21"),
        ],
      },
      {
        id: "loki",
        label: "Scenario #5 - Loki",
        scenario: { kind: "fixed", scenarioId: scenarioId("loki") },
        composition: [composeCarriedForward("mc21.s5.compose.odin", "MC21 p. 25", "odinInPool", ODIN_SET, "Odin")],
        setup: [
          putSideSchemeIntoPlay("mc21.s5.setup.dungeons", "MC21 p. 25", "Open the Dungeons"),
          shuffleIntoEncounterDeck("mc21.s5.setup.summoned-back", "MC21 p. 25", "Summoned Back", "treachery"),
          poolDeckGrant("mc21.s5.setup.shawarma", "MC21 p. 25", "shawarmaInPool", SHAWARMA, "Shawarma"),
          poolDeckGrant("mc21.s5.setup.system-shock", "MC21 p. 25", "systemShockInPool", SYSTEM_SHOCK, "System Shock"),
          infinityStonesDiscard("mc21.s5.setup.infinity-stones-discard", "MC21 p. 25"),
          // Modeling choice 5: granted like Shawarma/System Shock, relying on the Setup-keyword sweep.
          poolDeckGrant("mc21.s5.setup.norn-stone", "MC21 p. 25", "nornStoneInPool", NORN_STONE, "Norn Stone"),
          {
            id: "mc21.s5.setup.odin",
            text: "If Odin is in the campaign pool, put Odin into play on his King side.",
            citation: "MC21 p. 25",
            step: {
              kind: "inGame",
              window: DEFAULT_CAMPAIGN_WINDOW,
              effects: [
                ifThen(campaignLogIsSet("odinInPool", true), [
                  selectCards("odin", encounterSetAside({ name: "Odin" })),
                  putIntoPlay(chosen("odin"), firstPlayer),
                  // Modeling choice 6/7: composed Odin enters on his printed default (Captive) face; flip him to
                  // King immediately, matching the printed instruction exactly (`hela.ts`'s own module docblock:
                  // his Captive face is `21139a`, the King side `21139b`).
                  flipCard(named("Odin")),
                ]),
              ],
            },
          },
          hpSet("mc21.s5.setup.hp", "MC21 p. 25"),
          healToFull("mc21.s5.setup.heal", "MC21 p. 25", false),
        ],
        victory: [
          {
            id: "mc21.s5.victory.win",
            text: "Loki is defeated and the players win the campaign! Turn the page to read the conclusion.",
            citation: "MC21 p. 25",
            step: { kind: "betweenGames", ops: [] },
          },
        ],
        defeat: [
          {
            id: "mc21.s5.defeat.lose-campaign",
            text: "Expert Campaign Only: If the players lose this game, Loki exerts his rule over all the universe and the players lose the campaign.",
            citation: "MC21 p. 25",
            whenModes: { expertCampaign: true },
            step: { kind: "betweenGames", ops: [{ kind: "endCampaign", result: "lost" }] },
          },
        ],
      },
    ],
  },
};
