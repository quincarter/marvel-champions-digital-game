/**
 * The Mad Titan's Shadow (MC21) — the step 12 acceptance gate (docs/campaign-mode-design.md §11 step 12):
 * "write MC21's definition against the frozen foundation. MC21 is the cheapest second box (campaign pool of
 * flags, no currency, no track). If it needs *any* change in `packages/engine` or `packages/client`, the
 * foundation is wrong."
 *
 * **TEST-ONLY, not content.** MC21 has no normalized `@mc/content` `Scenario`/`EncounterSet`/`Campaign` record yet
 * (`docs/campaign-mode-design.md` §11 step 6's own note: only `trors` is ingested; `mts` — MC21's internal pack
 * code — exists solely as raw MarvelCDB JSON under `packages/content/raw/marvelcdb/`). So, per the brief, this file
 * holds a complete `CampaignDefinition` for MC21 that is never registered in `packages/cards/src/campaigns/index.ts`
 * and never exported: it exists only to answer the gate question. Every scenario, card and encounter-set id below is
 * a **synthetic stand-in** (`mc21-syn-*`), the same discipline `packages/engine/src/testing/campaign.ts`'s
 * `SYNTHETIC_CAMPAIGN` already uses for the shapes MC10 doesn't reach — nothing here can be mistaken for ingested
 * MC21 content. `MTS_CAMPAIGN_ID` uses the pack's own internal short code ("mts", matching MC10's "trors") rather
 * than "mc21" so it reads the same way a real `@mc/content` id eventually will.
 *
 * Source of truth: `docs/campaign-modes/markdown/mc21_the_mad_titans_shadow.md` (the primary rulebook conversion,
 * cited below as "MC21 p. N") and `docs/campaign-modes/log-sheets/mc21_the_mad_titans_shadow_rulebook-compressed-
 * campaign_log.pdf` (its four log-sheet columns are `logFields` below). Every `CampaignInstruction` carries the
 * citation of the printed bullet it encodes, in the order that bullet is printed on its page. Only the printed
 * "CAMPAIGN INSTRUCTIONS" (SETUP:/VICTORY:) bullets and the general "CAMPAIGN MODE RULES"/"EXPERT CAMPAIGN RULES"
 * text are encoded here — the scenario mechanics themselves (Spell environments, two main schemes/two villains,
 * infinite hit points, Loki's five stage-I cards) are ordinary scenario card scripts, exactly as MC10's own Spell
 * environment and Hydra Prison mechanics are left to `@mc/cards/src/wave2/trors/*`, not to the campaign definition.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * GATE VERDICT: MC21 fits. Every printed instruction is expressible in the frozen `@mc/engine` vocabulary
 * (`CampaignOp`/`CampaignGameQuery`/`CampaignPredicate`/`CampaignValue`), with one content-only DSL
 * addition (`addAccelerationToken` gained an optional `target`, `packages/cards/src/dsl/effects.ts` — MC21 p. 13's
 * "place one acceleration token on **one of** the main schemes" needs to name which scheme; MC10 never needed to).
 * `packages/engine` and `packages/client` are untouched.
 *
 * One printed instruction does **not** fit and is left `// TODO(gap 1)` rather than worked around — see
 * `INFINITY_STONES_DISCARD_GAP_TEXT` below and the report to `game-rules-architect`.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * MODELING CHOICES WORTH KNOWING ABOUT.
 *
 * 1. **The campaign pool is nine `flag` fields, not one `cardList`.** The log sheet (MC21 p. 28) prints one
 *    checkbox per named card ("Check here if Cosmo was added to campaign pool"), never a free-form list — matching
 *    `docs/campaign-mode-design.md` §1 row 39 ("Boolean/checkbox log field … campaign pool membership … MC21 p.
 *    28"), not row 41's `cardList` reading of the same mechanism (which the `CardSelector campaignLog` doc comment
 *    also gestures at, unproven until this gate). Each pool card is referenced purely by its **printed name**
 *    (`TargetQuery.name`/`encounterSetAside({ name })`), so no `CardId` is invented for Cosmo, Security Breach,
 *    Black Swan, Norn Stone or Odin at all — only Shawarma, System Shock and Norn Stone need one, because those
 *    three (and only those three) are granted to a **deck** (`CampaignOp grantCard`), which addresses cards by id.
 * 2. **"Was defeated" / "is NOT in the victory display" have no negation in `CampaignGameQuery`.** Both read as a
 *    two-instruction pair: a `record` instruction writes an unlisted **bridging** flag with the *positive* fact
 *    ("is this card still in play" / "is this card in the victory display"), then a `betweenGames` instruction
 *    gated `when: { kind: "not", of: { kind: "fieldIsSet", field: bridge } }` adds to the pool — the same shape
 *    `trors.ts` already established for MC10 p. 12's Hydra Prison ("hydraPrison" bridges "is the … side scheme
 *    still in play", then a later bullet reads its negation). `bridgeThenAddToPool` below is that pattern, factored
 *    once. A **positive** condition ("was *completed*", "**is** in the victory display") never needs the bridge —
 *    it writes the printed pool/log field directly in one `record` instruction.
 * 3. **"1B was completed" reads the *next* stage entering play, not "1B" by its own printed name.** Neither
 *    Ebony Maw's nor Thanos's sub-stage name text was extracted from the rulebook (only the *scenario's* two-stage
 *    main-scheme deck names are printed, e.g. "Attack on Knowhere, The Power Stone"). A main scheme only ever
 *    advances forward (RRG 1.8 "Main Scheme"), so "stage 1(B) was completed" and "stage 2 ever entered play" are the
 *    same fact for a two-stage main scheme deck, and stage 2's name **is** printed — "The Power Stone" (MC21 p. 6),
 *    "Balance the Scales" (MC21 p. 16). This is a causal equivalence, not a simplification of the sentence.
 * 4. **Carried-forward pool cards (Cosmo, Security Breach, Black Swan, Odin) are composed in via
 *    `CampaignOp composeEncounterSets`**, each into its own one-card synthetic set (`MC21_*_SET`), because at least
 *    one of them provably needs it: Security Breach is earned in Ebony Maw's own encounter deck ("Ebony Maw, Black
 *    Order, Armies of Titan, Standard") and carried into Tower Defense's ("Tower Defense, Armies of Titan,
 *    Standard") — which does **not** list Black Order — so its card cannot already be sitting in that scenario's
 *    own pool by coincidence of shared modular sets. `composeEncounterSets` is exactly `CampaignNode.composition`'s
 *    documented job ("decide what game to build: … set-aside cards") and needs no engine change; wiring
 *    `CampaignGameInput.composedEncounterSetIds` into a real `GameSetupConfig.setAside` list is a scenario-builder
 *    concern for whoever scripts MC21's real card kit, not this file's.
 * 5. **Norn Stone is granted like Shawarma/System Shock (`grantCard(..., "thisGame")`), not put into play
 *    in-game**, even though its printed text says "puts one copy … into play on its Setup side" rather than
 *    "shuffles one copy … into their deck": MC21 p. 13's own keyword glossary defines Setup as "A card with the
 *    setup keyword begins the game in play", and MC10's own Basic Condition upgrades (`trors.ts`'s
 *    `obligationSetup` neighbor) already establish that a `Permanent. Setup.` grant needs no separate in-game
 *    effect — RRG 1.8 Appendix II step 11's setup-keyword sweep puts it into play on its own. Assumes Norn Stone's
 *    default/front face *is* its Setup side, which real MC21 card data will confirm or correct.
 * 6. **Odin enters play on his printed default face**, with no `flipCard` to reach "his King side": which face
 *    `@mc/content` will record as Odin's front face is unknown without the real card. If it is not "King", a real
 *    script adds one `flipCard(chosen("odin"))` — an existing primitive (`packages/engine/src/spec.ts` `flipCard`)
 *    — not a foundation gap.
 */

import { campaignId, cardId, scenarioId, trait, type CampaignId, type CardId, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  campaignChoiceKey,
  createCampaignLog,
  resolveBetweenGames,
  startGameFromLog,
  DEFAULT_CAMPAIGN_WINDOW,
  type CampaignChoiceAnswer,
  type CampaignDefinition,
  type CampaignDeps,
  type CampaignGameQuery,
  type CampaignGameResult,
  type CampaignInstruction,
  type CampaignLog,
  type CampaignOp,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  addAccelerationToken,
  campaignLogIsSet,
  campaignLogValue,
  chooseOneBy,
  chooseTarget,
  chosen,
  damageOn,
  eachPlayer,
  encounterSetAside,
  engage,
  firstPlayer,
  forEachPlayer,
  heal,
  identityOf,
  ifThen,
  moveCards,
  option,
  putIntoPlay,
  selectCards,
  setRemainingHitPoints,
  takeDamage,
  thatPlayer,
} from "../dsl/index.js";

const MTS_CAMPAIGN_ID: CampaignId = campaignId("mts");

/** MC21 p. 11/13: "Check here if Avengers Tower has the **_Damaged_** trait." A printed trait, not a face lookup. */
const DAMAGED = trait("DAMAGED");

/** Deck-granted campaign cards (MC21 p. 4: "Cards 180-193 … cannot be included in any deck unless … directed to add
 * them"). These are the only three MC21 pool cards ever addressed by id, because `grantCard` needs one. */
const SHAWARMA: CardId = cardId("mc21-syn-shawarma");
const SYSTEM_SHOCK: CardId = cardId("mc21-syn-system-shock");
const NORN_STONE: CardId = cardId("mc21-syn-norn-stone");

/** One-card synthetic carry-forward sets (modeling choice 4 above). */
const COSMO_SET = "mc21-syn-cosmo-set";
const SECURITY_BREACH_SET = "mc21-syn-security-breach-set";
const BLACK_SWAN_SET = "mc21-syn-black-swan-set";
const ODIN_SET = "mc21-syn-odin-set";

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
 * is the second `option`, matching the ability DSL's own `chooseOne`/"you may" idiom (`packages/cards/src/dsl`).
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
 * and it correctly does not persist (`applyCampaignResult` step 2 expires `thisGame` grants every game). */
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
 * control" and `trors.ts`'s Breakout precedent for an ownerless scenario card entering play. */
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

/** The printed text both gap instructions share (MC21 p. 21, p. 25), pinned so the test file and the report agree. */
export const INFINITY_STONES_DISCARD_GAP_TEXT =
  "If The Infinity Stones 1B was completed, each player discards the top half of their deck.";

/**
 * TODO(gap 1): no `ValueSpec` reads a player's deck size (only `handCount`/`handSize` exist —
 * `packages/engine/src/spec.ts`), so "the top half of their deck, rounded down" cannot be computed to pass as the
 * `zone` `CardSelector`'s `top: ValueSpec`. Left un-scripted (`effects: []`) rather than guessed. Missing member: a
 * `ValueSpec` kind reading a player's deck count, e.g. `{ kind: "deckCount"; player: PlayerRef }`, mirroring
 * `handCount`. **Not campaign-mode-specific**: this pack's own card kit independently needs the same primitive —
 * `docs/cards/by_pack/mts.md` prints, on a real MC21 card's When Revealed: "Each player removes the top half of
 * their deck (rounded down) from the game." Flagged for `game-rules-architect`.
 */
function infinityStonesDiscardGap(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: INFINITY_STONES_DISCARD_GAP_TEXT,
    citation,
    when: { kind: "fieldIsSet", field: "infinityStones1BCompleted" },
    // TODO(gap 1): see the function doc comment above — no ValueSpec reads a player's deck size.
    step: { kind: "inGame", window: DEFAULT_CAMPAIGN_WINDOW, effects: [] },
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
  // scenario except Loki's Expert-Campaign-Only exception (MC21 p. 25). Same reasoning as `trors.ts`'s own
  // `loss` comment: `retry: "byInstruction"` with every node's `defeat` absent reproduces "no penalty" exactly.
  loss: { retry: "byInstruction", retryBaseline: "nodeStart" },
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "ebony-maw",
        label: "Scenario #1 - Ebony Maw",
        scenario: { kind: "fixed", scenarioId: scenarioId("mc21-syn-ebony-maw") },
        setup: [
          {
            id: "mc21.s1.setup.identity",
            text: "Each player records their identity in the campaign log found on the back cover of this rulebook. Players cannot switch identities during a campaign.",
            citation: "MC21 p. 7",
            // Already true the moment the log exists (`CampaignSeat.identityCardId`), same as `trors.ts`'s
            // identical bullet — kept only so the printed setup list is complete and citable.
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
            // Modeling choice 3: stage 1(B) can only be "completed" by advancing to stage 2, "The Power Stone"
            // (MC21 p. 6's own main scheme deck: "Attack on Knowhere, The Power Stone") — a positive fact, written
            // directly with no bridge.
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
        scenario: { kind: "fixed", scenarioId: scenarioId("mc21-syn-tower-defense") },
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
        scenario: { kind: "fixed", scenarioId: scenarioId("mc21-syn-thanos") },
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
        scenario: { kind: "fixed", scenarioId: scenarioId("mc21-syn-hela") },
        setup: [
          putSideSchemeIntoPlay("mc21.s4.setup.norn-stones", "MC21 p. 21", "Find the Norn Stones"),
          shuffleIntoEncounterDeck("mc21.s4.setup.summoned-back", "MC21 p. 21", "Summoned Back", "treachery"),
          poolDeckGrant("mc21.s4.setup.shawarma", "MC21 p. 21", "shawarmaInPool", SHAWARMA, "Shawarma"),
          poolDeckGrant("mc21.s4.setup.system-shock", "MC21 p. 21", "systemShockInPool", SYSTEM_SHOCK, "System Shock"),
          infinityStonesDiscardGap("mc21.s4.setup.infinity-stones-discard", "MC21 p. 21"),
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
        scenario: { kind: "fixed", scenarioId: scenarioId("mc21-syn-loki") },
        composition: [composeCarriedForward("mc21.s5.compose.odin", "MC21 p. 25", "odinInPool", ODIN_SET, "Odin")],
        setup: [
          putSideSchemeIntoPlay("mc21.s5.setup.dungeons", "MC21 p. 25", "Open the Dungeons"),
          shuffleIntoEncounterDeck("mc21.s5.setup.summoned-back", "MC21 p. 25", "Summoned Back", "treachery"),
          poolDeckGrant("mc21.s5.setup.shawarma", "MC21 p. 25", "shawarmaInPool", SHAWARMA, "Shawarma"),
          poolDeckGrant("mc21.s5.setup.system-shock", "MC21 p. 25", "systemShockInPool", SYSTEM_SHOCK, "System Shock"),
          infinityStonesDiscardGap("mc21.s5.setup.infinity-stones-discard", "MC21 p. 25"),
          // Modeling choice 5: granted like Shawarma/System Shock, relying on the Setup-keyword sweep.
          poolDeckGrant("mc21.s5.setup.norn-stone", "MC21 p. 25", "nornStoneInPool", NORN_STONE, "Norn Stone"),
          poolPutIntoPlay(
            "mc21.s5.setup.odin",
            "MC21 p. 25",
            "odinInPool",
            "odin",
            "Odin",
            "If Odin is in the campaign pool, put Odin into play on his King side.",
          ),
          hpSet("mc21.s5.setup.hp", "MC21 p. 25"),
          healToFull("mc21.s5.setup.heal", "MC21 p. 25", false),
        ],
        victory: [
          {
            id: "mc21.s5.victory.win",
            text: "Loki is defeated and the players win the campaign! Turn the page to read the conclusion.",
            citation: "MC21 p. 25",
            // Purely narrative: `applyCampaignResult`'s `advanceAfterWin` already marks a won node completed and
            // ends the campaign "won" once every node is completed — Loki is the last node, so no op is needed.
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

// ---------------------------------------------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------------------------------------------

const NODES = MTS_CAMPAIGN_DEFINITION.graph.kind === "linear" ? MTS_CAMPAIGN_DEFINITION.graph.nodes : [];
const ALL_INSTRUCTIONS: readonly CampaignInstruction[] = NODES.flatMap((node) => [
  ...(node.composition ?? []),
  ...node.setup,
  ...node.victory,
  ...(node.defeat ?? []),
]);
const DECLARED_FIELDS = new Set(MTS_CAMPAIGN_DEFINITION.logFields.map((field) => field.id));

/** Every `field` an instruction's ops/writes/predicates name, walked without assuming a shape (plain data walk,
 * same discipline `coverage.test.ts` uses for `trors`). */
function fieldsReferencedBy(instruction: CampaignInstruction): readonly string[] {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.field === "string") found.push(record.field);
      for (const key of Object.keys(record)) walk(record[key]);
    }
  };
  walk(instruction.when);
  walk(instruction.step);
  return found;
}

describe("MC21 gate: definition shape", () => {
  it("typechecks and round-trips JSON byte for byte", () => {
    const roundTripped = JSON.parse(JSON.stringify(MTS_CAMPAIGN_DEFINITION)) as CampaignDefinition;
    expect(roundTripped).toEqual(MTS_CAMPAIGN_DEFINITION);
  });

  it("has at least one node, and every node has a fixed scenario id", () => {
    expect(NODES.length).toBe(5);
    for (const node of NODES) expect(node.scenario.kind).toBe("fixed");
  });

  it('gives every instruction a citation of the form "MC21 p. N"', () => {
    expect(ALL_INSTRUCTIONS.length).toBeGreaterThan(0);
    for (const instruction of ALL_INSTRUCTIONS) expect(instruction.citation).toMatch(/^MC21 p\. \d+$/);
  });

  it('gives every instruction a unique id prefixed "mc21."', () => {
    const ids = ALL_INSTRUCTIONS.map((instruction) => instruction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("mc21.")).toBe(true);
  });

  it("declares every log field an instruction reads or writes", () => {
    const referenced = new Set(ALL_INSTRUCTIONS.flatMap(fieldsReferencedBy));
    for (const field of referenced) expect(DECLARED_FIELDS.has(field)).toBe(true);
  });

  it("declares a loss policy", () => {
    expect(MTS_CAMPAIGN_DEFINITION.loss.retry).toBe("byInstruction");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The runner, end to end, headlessly — `createCampaignLog` -> `resolveBetweenGames` -> `startGameFromLog` -> a
// synthetic game outcome -> `applyCampaignResult`, looping every node, answering pending choices from a scripted
// list, including a loss/retry.
//
// No `GameState` is played: `@mc/cards` cannot reach `@mc/engine`'s internal `testing/fixtures.ts` stub-card
// builders (`@mc/engine`'s `package.json` `exports` is `{ "." : "./src/index.ts" }` only, so a deep import is not
// a real option), and hand-rolling a second, parallel stub-card kit from `@mc/content`'s full schema just for a
// gate test is disproportionate to what the gate is checking (vocabulary fit, not gameplay). Instead, each node's
// "synthetic game outcome" is a hand-authored `CampaignGameResult` standing in for what `campaignResultOf` would
// have derived from a real playthrough — exactly the pattern `trors.ts`'s own `trors.test.ts` "between-games" walk
// already established and justified for the same reason (its header comment: "the victory half is proven by
// re-deriving `campaignResultOf` from that same real, played-out state" is the one thing this file does not
// attempt; `campaignResultOf`'s own reducer is exercised by `packages/engine/src/campaign/result.ts`'s tests and
// by `trors.test.ts`, against real and synthetic games respectively — not a second time here).
// ---------------------------------------------------------------------------------------------------------------

const DEPS: CampaignDeps = { pool: [] };

const SEATS: readonly CampaignSeatSetup[] = [
  {
    seatNumber: 1,
    identityCardId: cardId("mc21-syn-hero-one"),
    deck: {
      identityCardId: cardId("mc21-syn-hero-one"),
      aspects: ["leadership"],
      cards: [{ cardId: cardId("mc21-syn-player-card"), quantity: 40 }],
    },
  },
  {
    seatNumber: 2,
    identityCardId: cardId("mc21-syn-hero-two"),
    deck: {
      identityCardId: cardId("mc21-syn-hero-two"),
      aspects: ["protection"],
      cards: [{ cardId: cardId("mc21-syn-player-card"), quantity: 40 }],
    },
  },
];

const STANDARD: PlayModes = { campaign: { campaignId: MTS_CAMPAIGN_ID } };
const EXPERT: PlayModes = { campaign: { campaignId: MTS_CAMPAIGN_ID, expertCampaign: true } };

interface Settled<T> {
  readonly value: T;
  readonly asked: readonly CampaignPendingChoice[];
}

function settle<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  script: readonly CampaignChoiceAnswer[],
): Settled<T> {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 24; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return { value: outcome.value, asked };
    const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(outcome.choice));
    if (!found) {
      throw new Error(
        `the script has no answer for ${campaignChoiceKey(outcome.choice)} of [${outcome.choice.options.join(", ")}]`,
      );
    }
    asked.push(outcome.choice);
    answers.push(found);
  }
  throw new Error("the runner asked for more than 24 choices in one step list");
}

/** No `choose`/`random` op appears anywhere in `MTS_CAMPAIGN_DEFINITION`'s between-games ops (MC21's own SETUP/
 * VICTORY bullets never ask the players to pick among several campaign-pool cards — everything is a flat "if X is
 * in the pool" gate), so the answer script is empty. Kept as a named constant so a future edit that *adds* a
 * `choose`/`random` op fails loudly here instead of silently at `settle`'s "no answer" throw. */
const SCRIPT: readonly CampaignChoiceAnswer[] = [];

/** A node's finished-game result, hand-authored (see the section header above). Everything defaults to "nothing
 * happened" so a node only needs to state what it cares about. */
function outcome(nodeId: string, won: boolean, records: CampaignGameResult["records"] = []): CampaignGameResult {
  return { nodeId, outcome: won ? "won" : "lost", records, removedFromCampaign: [], logWrites: [], expiringGrants: [] };
}

const flagWrite = (field: string, value: boolean) => ({
  field,
  seatNumber: null,
  mode: "set" as const,
  value: { kind: "flag" as const, value },
});

describe("MC21 gate: the runner, end to end", () => {
  it("plays all five scenarios in standard mode, with a loss and a retry on Tower Defense, to a pinned final log", () => {
    let log: CampaignLog = createCampaignLog(MTS_CAMPAIGN_DEFINITION, {
      id: "gate-mts-standard",
      seats: SEATS,
      modes: STANDARD,
      poolVersion: "gate-test",
      seed: 1234,
    });
    expect(log.position.nextNodeId).toBe("ebony-maw");

    const play = (nodeId: string, result: CampaignGameResult): CampaignLog => {
      const composed = settle(
        (answers) => resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers),
        SCRIPT,
      );
      const start = startGameFromLog(MTS_CAMPAIGN_DEFINITION, composed.value);
      expect(start.nodeId).toBe(nodeId);
      const applied = settle(
        (answers) =>
          applyCampaignResult(
            MTS_CAMPAIGN_DEFINITION,
            composed.value,
            result,
            { at: 1_700_000_000_000, gameId: `gate-${nodeId}` },
            DEPS,
            answers,
          ),
        SCRIPT,
      );
      return applied.value;
    };

    // Ebony Maw: won, records the landing pad defeated (Cosmo earned) and stage 1B completed (Security Breach
    // earned) — proving the bridge-then-negate and the direct-record shapes both fold correctly.
    log = play(
      "ebony-maw",
      outcome("ebony-maw", true, [
        { instructionId: "mc21.s1.victory.landing-pad.record", write: flagWrite("secureLandingPadInPlay", false) },
        { instructionId: "mc21.s1.victory.security-breach", write: flagWrite("securityBreachInPool", true) },
      ]),
    );
    expect(log.position.resolved["ebony-maw"]).toBe("completed");
    expect(log.shared.cosmoInPool).toEqual({ kind: "flag", value: true });
    expect(log.shared.securityBreachInPool).toEqual({ kind: "flag", value: true });

    // Tower Defense: lost, then retried and won. The loss restores the log to `nodeStart` (MC21 p. 4's "no
    // penalty"); the retry keeps `cosmoInPool`/`securityBreachInPool` from Ebony Maw, which never rolls back.
    expect(log.position.nextNodeId).toBe("tower-defense");
    log = play("tower-defense", outcome("tower-defense", false));
    expect(log.position.nextNodeId).toBe("tower-defense");
    expect(log.position.resolved["tower-defense"]).toBeUndefined();
    expect(log.history.at(-1)?.outcome).toBe("lost");
    expect(log.shared.cosmoInPool).toEqual({ kind: "flag", value: true });

    log = play(
      "tower-defense",
      outcome("tower-defense", true, [
        { instructionId: "mc21.s2.victory.shawarma-place.record", write: flagWrite("saveShawarmaPlaceInPlay", false) },
        { instructionId: "mc21.s2.victory.black-swan.record", write: flagWrite("blackSwanDefeated", true) },
        { instructionId: "mc21.s2.victory.tower-damaged", write: flagWrite("avengersTowerDamaged", true) },
      ]),
    );
    expect(log.position.resolved["tower-defense"]).toBe("completed");
    expect(log.shared.shawarmaInPool).toEqual({ kind: "flag", value: true });
    // Black Swan *was* shown in the victory display (defeated), so she is NOT added to the pool.
    expect(log.shared.blackSwanInPool).toBeUndefined();
    expect(log.shared.avengersTowerDamaged).toEqual({ kind: "flag", value: true });

    // Thanos: won. Composition brought Cosmo and Security Breach back in (both pool flags are set); asserted via
    // the composed `CampaignGameInput` before the (hand-authored) result folds in.
    const thanosComposed = settle(
      (answers) => resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers),
      SCRIPT,
    );
    const thanosStart = startGameFromLog(MTS_CAMPAIGN_DEFINITION, thanosComposed.value);
    expect(thanosStart.encounterSetIds).toEqual([COSMO_SET, SECURITY_BREACH_SET]);
    const thanosApplied = settle(
      (answers) =>
        applyCampaignResult(
          MTS_CAMPAIGN_DEFINITION,
          thanosComposed.value,
          outcome("thanos", true, [
            {
              instructionId: "mc21.s3.victory.defensive-protocols.record",
              write: flagWrite("defensiveProtocolsDefeated", false),
            },
            { instructionId: "mc21.s3.victory.infinity-stones", write: flagWrite("infinityStones1BCompleted", true) },
          ]),
          { at: 1_700_000_000_000, gameId: "gate-thanos" },
          DEPS,
          answers,
        ),
      SCRIPT,
    );
    log = thanosApplied.value;
    expect(log.position.resolved.thanos).toBe("completed");
    expect(log.shared.systemShockInPool).toEqual({ kind: "flag", value: true });
    expect(log.shared.infinityStones1BCompleted).toEqual({ kind: "flag", value: true });

    // Hela: won, Odin's Armor recovered (Odin earned directly, no bridge).
    log = play(
      "hela",
      outcome("hela", true, [
        { instructionId: "mc21.s4.victory.norn-stones.record", write: flagWrite("findNornStonesInPlay", false) },
        { instructionId: "mc21.s4.victory.odin", write: flagWrite("odinInPool", true) },
      ]),
    );
    expect(log.position.resolved.hela).toBe("completed");
    expect(log.shared.nornStoneInPool).toEqual({ kind: "flag", value: true });
    expect(log.shared.odinInPool).toEqual({ kind: "flag", value: true });

    // Loki: composition brings Odin's card back in; won, ending the campaign.
    const lokiComposed = settle(
      (answers) => resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers),
      SCRIPT,
    );
    const lokiStart = startGameFromLog(MTS_CAMPAIGN_DEFINITION, lokiComposed.value);
    expect(lokiStart.encounterSetIds).toEqual([ODIN_SET]);
    const lokiApplied = settle(
      (answers) =>
        applyCampaignResult(
          MTS_CAMPAIGN_DEFINITION,
          lokiComposed.value,
          outcome("loki", true),
          { at: 1_700_000_000_000, gameId: "gate-loki" },
          DEPS,
          answers,
        ),
      SCRIPT,
    );
    log = lokiApplied.value;

    expect(log.status).toBe("won");
    expect(log.position.nextNodeId).toBeNull();
    expect(log.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "ebony-maw:won",
      "tower-defense:lost",
      "tower-defense:won",
      "thanos:won",
      "hela:won",
      "loki:won",
    ]);
    expect(log.position.resolved).toEqual({
      "ebony-maw": "completed",
      "tower-defense": "completed",
      thanos: "completed",
      hela: "completed",
      loki: "completed",
    });
  });

  it("expert campaign: losing the last scenario loses the campaign (MC21 p. 25's defeat block)", () => {
    let log: CampaignLog = createCampaignLog(MTS_CAMPAIGN_DEFINITION, {
      id: "gate-mts-expert",
      seats: SEATS,
      modes: EXPERT,
      poolVersion: "gate-test",
      seed: 5678,
    });

    const play = (result: CampaignGameResult): CampaignLog => {
      const composed = settle(
        (answers) => resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers),
        SCRIPT,
      );
      const applied = settle(
        (answers) =>
          applyCampaignResult(
            MTS_CAMPAIGN_DEFINITION,
            composed.value,
            result,
            { at: 1_700_000_000_000 },
            DEPS,
            answers,
          ),
        SCRIPT,
      );
      return applied.value;
    };

    for (const nodeId of ["ebony-maw", "tower-defense", "thanos", "hela"]) log = play(outcome(nodeId, true));
    expect(log.position.nextNodeId).toBe("loki");

    log = play(outcome("loki", false));
    expect(log.status).toBe("lost");
    expect(log.history.at(-1)?.steps.some((step) => step.instructionId === "mc21.s5.defeat.lose-campaign")).toBe(true);
  });
});
