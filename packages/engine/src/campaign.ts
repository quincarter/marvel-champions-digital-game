/**
 * Campaign mode as plain, serializable data.
 *
 * RRG 1.8 "Modes of Play" (p. 29): "Campaign mode allows players to modify standard mode through interconnected
 * scenarios that are played one after another. **No two campaigns are exactly alike, and the rules for each are
 * found in the campaign's associated rulebook.**" That second sentence is the whole design constraint — the engine
 * cannot know what any one campaign does, so this file declares only the *vocabulary* a rulebook's campaign
 * instructions are written in. No campaign and no card is ever named here: a box is a `CampaignDefinition` value
 * authored in `@mc/cards`, exactly the way card text is, and adding a box must not add a member to any union below.
 *
 * The shapes were surveyed against all ten campaign rulebooks (`docs/campaign-modes/markdown/`, the inventory in
 * `docs/campaign-mode-design.md` §1), not against the first box we build, so each non-obvious member cites the
 * printed sentence that forces it — `MC60 p. 9` means page 9 of the Fear No Evil rulebook conversion.
 *
 * **This module is data only.** The runner (`resolveBetweenGames`, `campaignResultOf`, `applyCampaignResult`) and the
 * campaign `DeckContext` are later steps (design §11 steps 4-5). Nothing here has behaviour, and every type is plain
 * JSON — no functions, classes, `Map`, `Set` or `Date` — so a log round-trips through `JSON.stringify`. The in-game
 * primitives (design §11 step 3) are declared where the rest of the executable vocabulary lives — `spec.ts`'s
 * `ValueSpec`/`Predicate`/`CardSelector`/`EffectSpec` — and read the frozen `GameState.campaign` snapshot only.
 */

import type {
  CampaignId,
  CardId,
  CoreAspect,
  DeckContents,
  EncounterSetId,
  ModePredicate,
  PlayModes,
  ScenarioId,
  Trait,
} from "@mc/content";
import type { RngState } from "./rng.js";
import type { CardSelector, EffectSpec, Predicate, TargetCategory, TargetQuery, ValueSpec } from "./spec.js";

// ---------------------------------------------------------------------------------------------------------------
// §4 The definition
// ---------------------------------------------------------------------------------------------------------------

/** One box's campaign, as the rulebook prints it. Authored in `@mc/cards`; the engine only interprets it. */
export interface CampaignDefinition {
  /** Matches a `@mc/content` `Campaign.id`. Opaque to the engine, which never compares it to a literal. */
  readonly campaignId: CampaignId;
  /** Bumped whenever an instruction id, log field id or node id changes. Stamped into every log it creates. */
  readonly version: string;
  readonly logFields: readonly LogFieldDef[];
  readonly graph: CampaignGraph;
  readonly loss: LossPolicy;
  /**
   * Instructions appended to *every* node's setup, in printed order, before the node's own. MC50 p. 11 prints the
   * same board-preparation block in every scenario; MC45 p. 20 prints the same mission-area block.
   */
  readonly everyNodeSetup?: readonly CampaignInstruction[];
  readonly everyNodeVictory?: readonly CampaignInstruction[];
  /**
   * Instructions the *log itself* can switch on, keyed by id; a `kind: "instructionList"` field names entries here.
   * MC27 p. 22: each marked reputation-track node adds a "Setup:" instruction to every remaining scenario. Without
   * this, a node's instruction list is not a function of the definition alone and MC27 would force an engine change.
   */
  readonly conditionalInstructions?: Readonly<Record<string, CampaignInstruction>>;
}

// ---------------------------------------------------------------------------------------------------------------
// §4.1 Scenario graph
// ---------------------------------------------------------------------------------------------------------------

/**
 * Not a list. Eight boxes are linear (MC10 p. 3: "win all five scenarios in numerical order"), but MC60 p. 8 says
 * "Unlike other Marvel Champions campaigns, the order of these scenarios is not fixed. Instead, the players choose
 * which scenario to play next after each game", and its choice is preceded by log mutation (MC60 p. 9 steps 1-3).
 */
export type CampaignGraph =
  /** MC10, MC16, MC21, MC27, MC32, MC40, MC45, MC50: nodes played in printed order. */
  | { readonly kind: "linear"; readonly nodes: readonly CampaignNode[] }
  /** MC60 p. 8-9: `beforeChoice` runs first (the progression draw), then `available` gates each node. */
  | {
      readonly kind: "choice";
      readonly nodes: readonly CampaignNode[];
      readonly beforeChoice: readonly CampaignInstruction[];
      readonly available: CampaignPredicate;
      /**
       * A node that becomes mandatory once `when` holds and nothing else is available. MC60 p. 9 step 4: "If each
       * scenario is either Completed or Failed, the players must choose the Kingpin scenario".
       */
      readonly finale?: { readonly nodeId: string; readonly when: CampaignPredicate };
    };

export interface CampaignNode {
  /**
   * Stable id, unique within the box. Distinct from a scenario id on purpose: MC60 p. 9 step 5 plays one main
   * scheme against a separately chosen villain, so a node is "a scenario slot", not "a scenario".
   */
  readonly id: string;
  /** As the rulebook titles it, for the step list and the log sheet. */
  readonly label: string;
  readonly scenario: CampaignScenarioRef;
  /**
   * Between-games steps that decide *what game to build* before setup begins — MC60 p. 9 steps 5-6, "Determine the
   * villain … Gather your chosen main scheme, your chosen villain, and their corresponding encounter sets".
   * Feeds `CampaignGameInput`, not the log, except where an op writes the log as well (step 5 records the villain).
   */
  readonly composition?: readonly CampaignInstruction[];
  readonly setup: readonly CampaignInstruction[];
  readonly victory: readonly CampaignInstruction[];
  /**
   * The printed "DEFEAT:" block. Absent for the seven boxes whose loss is "they may reset the scenario and try
   * again with no penalty" (MC10 p. 3); present for MC50 p. 19 and MC60 p. 13.
   */
  readonly defeat?: readonly CampaignInstruction[];
}

export type CampaignScenarioRef =
  | { readonly kind: "fixed"; readonly scenarioId: ScenarioId }
  /** MC60 p. 9 steps 5-6: the villain (and so the encounter sets) is picked between games by `composition`. */
  | { readonly kind: "composed" };

// ---------------------------------------------------------------------------------------------------------------
// §4.2 Log field schema
// ---------------------------------------------------------------------------------------------------------------

/** What one box of the printed campaign log sheet holds. Declared by the box; the engine stores it and nothing more. */
export type LogFieldType =
  /**
   * Delay counters (MC10 p. 7), unspent units (MC16 p. 5), secret counters (MC50 p. 11), remaining hit points
   * (MC10 p. 17). `clampAtZero` is MC27 p. 5's reputation track, which can score negative but marks no node then.
   */
  | { readonly kind: "number"; readonly min?: number; readonly max?: number; readonly clampAtZero?: true }
  /** A checkbox: "Trust Established?", "Mary Defeated?", "Completed" (MC60 p. 13); campaign-pool membership (MC21 p. 7). */
  | { readonly kind: "flag" }
  /** An ordered list of card titles. Duplicates are allowed (ruling June 2, 2026 (3) answer 3). */
  | { readonly kind: "cardList" }
  /**
   * One card, optionally with the face it is recorded on: MC10 p. 12 replaces a "Basic" Condition upgrade "with its
   * 'Improved' side"; MC27 p. 22 flips a S.H.I.E.L.D. Tech upgrade "to its Enhanced side".
   */
  | { readonly kind: "cardRef"; readonly withFace?: true }
  /** A fixed option set: a role (MC32 p. 5), the chosen villain (MC60 p. 9 step 5), an accusation (MC50 p. 19). */
  | { readonly kind: "choice"; readonly options: readonly string[] }
  /**
   * Named options that stay available until struck. MC45 p. 5: "MISSION side schemes are available unless their
   * name has been struck from the campaign log"; MC40 p. 7 does the same to player side schemes.
   */
  | { readonly kind: "strikeList"; readonly options: readonly string[] }
  /**
   * Counters, and the face, that ride a named card across scenarios. MC50 p. 6: a Board Member with four secrets
   * "permanently turns against the heroes, flipping to its attachment side", and MC50 p. 11 replaces those counters
   * at the next scenario's setup. This is a card instance whose state is campaign state, not a number about a card.
   */
  | { readonly kind: "cardState"; readonly cardIds: readonly CardId[] }
  /** Ids into `CampaignDefinition.conditionalInstructions` (MC27 p. 22's reputation-track nodes). */
  | { readonly kind: "instructionList" }
  /** Freeform. Never read by an instruction; rendered on the sheet only ("Notes"). */
  | { readonly kind: "text" };

export interface LogFieldDef {
  readonly id: string;
  /** As the printed sheet names it, so the rendered log reads like the paper one. */
  readonly label: string;
  /** MC10 p. 17's "player number" is what makes a per-seat field addressable; see `CampaignSeat.seatNumber`. */
  readonly scope: "shared" | "perSeat";
  readonly type: LogFieldType;
  /** Only tracked under these modes: persistent damage is `{ expertCampaign: true }` (MC10 p. 17). */
  readonly whenModes?: ModePredicate;
  /**
   * Never shown to the players. MC50 p. 5: three evidence cards "are randomly drawn at the start of the campaign,
   * and kept hidden from the players in the A.I.M. envelope". Stored in `CampaignLog.hidden` and excluded from
   * every view model (design §10.2, Q4).
   */
  readonly hidden?: true;
  /** The printed page this field comes from, e.g. `"MC10 p. 7"`. Format is pinned by the `@mc/cards` coverage test. */
  readonly citation: string;
}

// ---------------------------------------------------------------------------------------------------------------
// §4.3 Instructions
// ---------------------------------------------------------------------------------------------------------------

/** One printed bullet of a rulebook's SETUP / VICTORY / DEFEAT block. */
export interface CampaignInstruction {
  /** Stable and unique within the box, prefixed with it. The coverage test resolves every id an op references. */
  readonly id: string;
  /** The printed sentence, verbatim: shown in the between-games step list and in the log's history. */
  readonly text: string;
  readonly citation: string;
  /**
   * `{ expertCampaign: true }` is the printed "**Expert Campaign Only**" prefix (MC10 p. 3: "Players should ignore
   * these instructions unless they are playing an expert campaign"). `{ expert: true }` is the separate expert-*mode*
   * gate a campaign instruction may also read — MC16 p. 8 reveals a side scheme "(use the reverse side for expert
   * mode)" — which is why `PlayModes.expert` and `campaign.expertCampaign` are independent flags (design Q1).
   */
  readonly whenModes?: ModePredicate;
  /** A log-state gate: "If Security Breach is in the campaign pool" (MC21 p. 17), "If 'Trust Established?' is checked". */
  readonly when?: CampaignPredicate;
  readonly step: CampaignStep;
}

/**
 * The boundary is exactly "does it need a `GameState`?". `inGame` puts a card into play, shuffles into the
 * encounter deck, places threat or counters, sets hit points. `betweenGames` only touches decks, the log and player
 * choices. `record` is the read half: it reads the *finished* game and writes the log.
 */
export type CampaignStep =
  /** Resolved by the engine inside the game, at a named window, as ordinary effects. */
  | { readonly kind: "inGame"; readonly window: CampaignWindow; readonly effects: readonly EffectSpec[] }
  /** Resolved by the campaign runner. No `GameState` exists. */
  | { readonly kind: "betweenGames"; readonly ops: readonly CampaignOp[] }
  /** Read the finished game, write the log. Victory and defeat instructions are mostly these. */
  | { readonly kind: "record"; readonly writes: readonly LogWriteSpec[] };

/**
 * Where inside RRG Appendix II an `inGame` instruction resolves. All five are printed somewhere:
 *
 * - `beforeScenarioSetup` — MC60 p. 9 steps 1-7, "Before beginning setup for each game, perform the following steps".
 * - `beforePlayerSetup` — MC60 p. 9 step 8, deck surgery between "Proceed with scenario setup until player setup"
 *   (step 7) and "Proceed with player setup" (step 9).
 * - `afterScenarioSetup` — **the default.** MC10 p. 3 says only "set up the scenario as per the normal rules of the
 *   game. Then, follow that scenario's setup instructions"; MC50 p. 4 pins the same sentence to "**before players
 *   draw their starting hands**", i.e. after Appendix II step 12 and before step 13. MC10 p. 7's own "Each player
 *   searches their deck for all cards with the setup keyword and puts them into play" is only coherent before the
 *   draw, which is the corroboration. Flagged as a *reading* (design Q7): ruling June 2, 2026 (3) answer 2 says
 *   "Campaign setup finishes before resolving Collector II's When Revealed damage", which for MC16 would put
 *   campaign setup earlier still — a box may override the affected instructions to `beforeScenarioSetup`.
 * - `beforeStartingHands` — MC50 p. 4's own wording, kept as a distinct value so a definition can quote the page it
 *   came from rather than silently relying on the default meaning the same thing.
 * - `afterMulligans` — MC50 p. 11, "**After resolving mulligans,** resolve the 'Setup' ability of each evidence card
 *   the players have earned", i.e. after Appendix II step 15.
 */
export type CampaignWindow =
  | "beforeScenarioSetup"
  | "beforePlayerSetup"
  | "afterScenarioSetup"
  | "beforeStartingHands"
  | "afterMulligans";

/** The default window for a setup instruction with no window printed on it (MC10 p. 3 + MC50 p. 4; see above). */
export const DEFAULT_CAMPAIGN_WINDOW: CampaignWindow = "afterScenarioSetup";

/**
 * The order the engine resolves the windows in, which is the order the `setup` flow steps run (`setup-steps.ts`).
 *
 * Three of the five — `afterScenarioSetup`, `beforeStartingHands`, `beforePlayerSetup` — name *the same printed gap*:
 * after RRG 1.8 Appendix II step 12 ("Resolve Scenario Setup and When Revealed Abilities", p. 51) and before step 14
 * ("Draw Starting Hands"). MC10 p. 3 ("Then, follow that scenario's setup instructions"), MC50 p. 4 ("before players
 * draw their starting hands") and MC60 p. 9 step 8 (deck surgery between scenario setup and player setup) all land
 * there, and no rulebook prints two of them for one scenario, so their order relative to each other is an **engine
 * convention**, not a rule: latest-sounding last. Flagged in design §6.1/Q7 rather than silently chosen.
 */
export const CAMPAIGN_WINDOW_ORDER = [
  "beforeScenarioSetup",
  "afterScenarioSetup",
  "beforeStartingHands",
  "beforePlayerSetup",
  "afterMulligans",
] as const satisfies readonly CampaignWindow[];

// ---------------------------------------------------------------------------------------------------------------
// §4.3c What an in-game instruction (or an ordinary card ability) writes back
// ---------------------------------------------------------------------------------------------------------------

/**
 * One card **face** removed from the campaign (RRG 1.8 p. 29).
 *
 * Removal is by face, not by physical card: ruling **April 30, 2026 (4)** answer 2, on the MC45 campaign — "Prelate
 * versions of minions remain available for the Apocalypse scenario even if their Overseer counterparts were crossed
 * out of the campaign log." The two versions are two faces of one double-sided card, which in `@mc/content` is one
 * `CardId` plus a `flipSide`, so a `CardId` alone cannot say which of them was crossed out.
 *
 * `face` is the printed name of the *other* face (`CardFlipSide.name`), matching how `LogValue` `cardRef` and
 * `CampaignGrant` already name a face; absent means the card's front face, which is every single-sided card.
 */
export interface CampaignCardFace {
  readonly cardId: CardId;
  readonly face?: string;
}

/**
 * The value an in-game `recordInCampaignLog` writes, in the engine's own executable vocabulary (`ValueSpec`,
 * `Predicate`, `CardSelector`) rather than the between-games `CampaignGameQuery`: inside a game there *is* a
 * `GameState`, so a write reads it the way any card ability would.
 *
 * Only the log field kinds an in-game instruction can produce are here. `strikeList`, `instructionList` and
 * `cardState` are never written in one sentence in-game: a strike is `mode: "strike"` with a `choice` value (the same
 * way `LogWriteSpec` spells it), and the other two are written between games.
 */
export type CampaignLogValueSpec =
  /** "Record the number of delay counters on the main scheme" (MC10 p. 7). */
  | { readonly kind: "number"; readonly amount: ValueSpec }
  /** "Check the box" (MC60 p. 13); `when` makes it conditional, absent is simply true. */
  | { readonly kind: "flag"; readonly when?: Predicate }
  /** "Record the name of each Experimental attachment that entered the game" (MC10 p. 5). */
  | { readonly kind: "cardList"; readonly cards: CardSelector }
  /** One card, optionally with the face it is on (MC10 p. 12's "Improved" side). The first card the selector names. */
  | { readonly kind: "cardRef"; readonly card: CardSelector; readonly withFace?: true }
  /** A named option of a `choice` or `strikeList` field. */
  | { readonly kind: "choice"; readonly option: string }
  | { readonly kind: "text"; readonly value: string };

/**
 * What a game has written back to the campaign so far, accumulated in `GameState` as plain data and folded into the
 * `CampaignLog` by the runner (design §7.2) — **the game itself never touches anything outside `GameState`**.
 *
 * Kept apart from the frozen `GameState.campaign` input on purpose: the input is the replay baseline and never
 * changes, and these writes are the only campaign state a game produces. Both stick whatever the outcome, because
 * RRG 1.8 p. 29 keeps a removal "even if players retry the scenario wherein that card was removed", and design §6.2
 * extends the same reading to an in-game log write — which is why a lost game's writes must stay distinguishable
 * from the between-games writes a retry rolls back to `LossPolicy.retryBaseline`.
 */
export interface CampaignInGameWrites {
  readonly logWrites: readonly LogWrite[];
  readonly removedFromCampaign: readonly CampaignCardFace[];
}

/** A game that has written nothing back yet. */
export const NO_CAMPAIGN_WRITES: CampaignInGameWrites = { logWrites: [], removedFromCampaign: [] };

// ---------------------------------------------------------------------------------------------------------------
// §4.3b Reading the finished game
// ---------------------------------------------------------------------------------------------------------------

/**
 * What a `record` instruction reads out of the finished game. Answered by `campaignResultOf` as a derived reducer
 * over the final state and the event stream (design §7.2) — never accumulated by a client and handed back.
 */
export type CampaignGameQuery =
  /** MC10 p. 5: "Record the name of each Experimental attachment that entered the game in the campaign log." */
  | { readonly kind: "cardsThatEnteredPlay"; readonly query: TargetQuery }
  /** MC60 p. 13: "Record the title of each unique ally and support that was removed from the game in the campaign log." */
  | { readonly kind: "cardsRemovedFromGame"; readonly query: TargetQuery }
  /** MC50 p. 11: "Record the number of Rescued Captive allies in play in the campaign log." */
  | { readonly kind: "cardsInPlay"; readonly query: TargetQuery }
  /** MC60 p. 13: "If the Typhoid Mary/Bloody Mary ally is in the victory display, check the 'Mary Defeated?' box." */
  | { readonly kind: "cardsInVictoryDisplay"; readonly query: TargetQuery }
  /**
   * MC10 p. 7: "Record the number of delay counters on the main scheme in the campaign log." MC50 p. 11 does the
   * same per Board Member. `counter` is a counter name as `CardInstance.counters` keys them.
   */
  | { readonly kind: "countersOn"; readonly query: TargetQuery; readonly counter: string }
  /** MC60 p. 13: "If Disturbed Psyche is in play and has at least 2 threat on it…" */
  | { readonly kind: "threatOn"; readonly query: TargetQuery }
  /**
   * MC10 p. 17: "each player must record their remaining hit points … If a player's remaining hit point value is
   * higher than their base hit point value, record their base hit points in the campaign log instead." The cap is
   * part of the query because every box prints it, and MC60 p. 9 records it after *each* game, won or lost.
   */
  | { readonly kind: "remainingHitPointsCappedAtBase" }
  /** MC10 p. 12: "Each player engaged with an enemy records they are engaged with an enemy in the campaign log." */
  | { readonly kind: "isEngagedWithEnemy" }
  /** A fixed value, for an instruction that simply marks a box: MC60 p. 13's "Check the 'Completed' box". */
  | { readonly kind: "const"; readonly value: number | string | boolean }
  /** The size of a list-valued query, for "the number of minions and side schemes recorded" (MC50 p. 11). */
  | { readonly kind: "count"; readonly of: CampaignGameQuery }
  /** A list- or number-valued query as a yes/no, for a `flag` field. */
  | { readonly kind: "atLeast"; readonly of: CampaignGameQuery; readonly amount: number };

/** How a `record` instruction writes one field. */
export interface LogWriteSpec {
  readonly field: string;
  /** Absent on a shared field. `"each"` writes every seat's own value ("each identity's remaining hit points"). */
  readonly seat?: "self" | "each";
  readonly mode: LogWriteMode;
  readonly value: CampaignGameQuery;
}

export type LogWriteMode = "set" | "add" | "append" | "strike";

/** One computed write, as it goes into the log and into the history trace. The resolved form of a `LogWriteSpec`. */
export interface LogWrite {
  readonly field: string;
  /** The seat this value belongs to, by `CampaignSeat.seatNumber`; null for a shared or hidden field. */
  readonly seatNumber: number | null;
  readonly mode: LogWriteMode;
  readonly value: LogValue;
}

// ---------------------------------------------------------------------------------------------------------------
// §4.4 Values and predicates over the log
// ---------------------------------------------------------------------------------------------------------------

/**
 * The between-games value language. Deliberately tiny and separate from `ValueSpec`: there is no `GameState` to
 * read here, so nothing in `ValueSpec`'s vocabulary would resolve. (The in-game half instead extends `ValueSpec`
 * and `Predicate` with a `campaignLog` member — design §4.4, engine step 3.)
 */
export type CampaignValue =
  | { readonly kind: "const"; readonly value: number | string | boolean }
  | { readonly kind: "field"; readonly field: string; readonly seat?: "self" | "each" }
  | { readonly kind: "count"; readonly field: string }
  | { readonly kind: "sum" | "difference" | "min" | "max"; readonly of: readonly CampaignValue[] }
  /** MC27 p. 5 and ruling August 3, 2026 (4) answer 2: negative victory points mark no reputation-track nodes. */
  | { readonly kind: "clampAtZero"; readonly of: CampaignValue }
  /** A choice made earlier in this same step list, by `CampaignOp` `choose`/`random` slot. */
  | { readonly kind: "choice"; readonly slot: string };

export type CampaignPredicate =
  | { readonly kind: "fieldAtLeast"; readonly field: string; readonly amount: number; readonly seat?: "self" }
  | { readonly kind: "fieldIsSet"; readonly field: string; readonly seat?: "self" }
  | { readonly kind: "fieldContains"; readonly field: string; readonly value: string; readonly seat?: "self" }
  /** MC45 p. 5: an option "is available unless their name has been struck from the campaign log". */
  | { readonly kind: "notStruck"; readonly field: string; readonly option: string }
  /** MC60 p. 9 step 4: "choose any scenario to play that has not been Completed or Failed". */
  | { readonly kind: "nodeResolved"; readonly nodeId: string; readonly as?: "completed" | "failed" }
  | { readonly kind: "modes"; readonly of: ModePredicate }
  | { readonly kind: "not"; readonly of: CampaignPredicate }
  | { readonly kind: "and" | "or"; readonly of: readonly CampaignPredicate[] };

// ---------------------------------------------------------------------------------------------------------------
// §4.5 The between-games vocabulary
// ---------------------------------------------------------------------------------------------------------------

/**
 * Every op is derived from a printed sentence in one of the ten rulebooks. This union is the foundation's real
 * surface area: **adding a box must not require adding to it.** If a new box needs a new member, the shape is
 * wrong, not the box (design §11 step 12 is the acceptance gate for exactly that).
 */
export type CampaignOp =
  // --- log writes ------------------------------------------------------------------------------------------
  | { readonly kind: "setField"; readonly field: string; readonly seat?: "self"; readonly value: CampaignValue }
  | { readonly kind: "addToField"; readonly field: string; readonly seat?: "self"; readonly value: CampaignValue }
  | { readonly kind: "appendToList"; readonly field: string; readonly seat?: "self"; readonly value: CampaignValue }
  /** MC45 p. 5 / MC40 p. 7: strike a named option so it is no longer available. */
  | { readonly kind: "strike"; readonly field: string; readonly seat?: "self"; readonly option: CampaignValue }
  | { readonly kind: "clearField"; readonly field: string; readonly seat?: "self" }
  // --- decks -----------------------------------------------------------------------------------------------
  /**
   * MC10 p. 3: "Added cards must be included in the player's deck for the rest of the campaign. Cards added to the
   * deck as part of a campaign do not count toward a player's minimum or maximum deck size."
   * `permanence: "thisGame"` is MC32 p. 5's role-building, where the card is added "to their deck for that game".
   */
  | {
      readonly kind: "grantCard";
      readonly seat: "self" | "each";
      readonly card: CampaignValue;
      readonly permanence: GrantPermanence;
    }
  | { readonly kind: "revokeCard"; readonly seat: "self" | "each"; readonly card: CampaignValue }
  /**
   * RRG 1.8 p. 29: "If a card is removed from a campaign, that card can no longer be used during the rest of the
   * campaign, even if players retry the scenario wherein that card was removed." Applies to every seat and to the
   * encounter side, and survives a retry — hence it is not restored by `LossPolicy.retryBaseline`.
   */
  | { readonly kind: "removeFromCampaign"; readonly cards: readonly CampaignValue[] }
  /** MC10 p. 12 ("replace their 'Basic' Condition upgrade with its 'Improved' side"); MC27 p. 22's Enhanced side. */
  | { readonly kind: "setGrantFace"; readonly card: CampaignValue; readonly face: string }
  // --- choices and randomness --------------------------------------------------------------------------------
  /** MC10 p. 5's Tech upgrade choice; MC27 p. 22's "chooses an aspect card in their collection"; MC60 p. 9 step 4. */
  | {
      readonly kind: "choose";
      readonly slot: string;
      readonly chooser: "eachSeat" | "group" | "firstPlayer";
      readonly from: CampaignChoiceSource;
      readonly count?: number;
      readonly optional?: true;
    }
  /**
   * MC27 p. 22 ("Deal 3 … upgrades at random"), MC45 p. 5 ("randomly select one of the available MISSION side
   * schemes"), MC60 p. 9 step 2. Drawn from `CampaignLog.rng`, so a campaign is replayable and a client cannot
   * reroll by reloading.
   */
  | { readonly kind: "random"; readonly slot: string; readonly from: CampaignChoiceSource; readonly count?: number }
  // --- currency ----------------------------------------------------------------------------------------------
  /**
   * MC16 p. 5: "Subtract that card's Unit Cost value from the value recorded in your 'Unspent Units' box, then add
   * that card to your deck." The per-card price is card data, not campaign data.
   */
  | { readonly kind: "spend"; readonly field: string; readonly seat: "self"; readonly amount: CampaignValue }
  // --- graph -------------------------------------------------------------------------------------------------
  /**
   * MC60 p. 9 step 3: "**progress** each scenario matching a drawn environment by marking the first unmarked box to
   * the right of that scenario … If a scenario has three Xs to its right, it has Failed."
   */
  | { readonly kind: "progressNode"; readonly node: CampaignValue }
  | { readonly kind: "markNode"; readonly node: CampaignValue; readonly as: "completed" | "failed" }
  /**
   * MC45 p. 20: winning the last scenario can still lose the campaign — "If the Protect the Professor MISSION side
   * scheme was not defeated, the players failed to save Professor X and lose the campaign."
   */
  | { readonly kind: "endCampaign"; readonly result: "won" | "lost" }
  // --- composition (feeds `CampaignGameInput`, not the log) ----------------------------------------------------
  /** MC60 p. 9 step 5: "Determine the villain … and record the name of the chosen villain next to the scenario". */
  | { readonly kind: "composeVillain"; readonly villain: CampaignValue }
  /** MC60 p. 9 step 6: "Gather your chosen main scheme, your chosen villain, and their corresponding encounter sets." */
  | { readonly kind: "composeEncounterSets"; readonly sets: readonly CampaignValue[] }
  // --- control -------------------------------------------------------------------------------------------------
  /** "Repeat this process for each player" (MC27 p. 22). Inner ops see `seat: "self"` as the scoped seat. */
  | { readonly kind: "forEachSeat"; readonly ops: readonly CampaignOp[] }
  | {
      readonly kind: "if";
      readonly when: CampaignPredicate;
      readonly then: readonly CampaignOp[];
      readonly else?: readonly CampaignOp[];
    };

/** MC10 p. 3 (rest of the campaign) vs. MC32 p. 5's role-building, which is "for that game" only. */
export type GrantPermanence = "campaign" | "thisGame";

/** What a `choose` or `random` op draws from. */
export type CampaignChoiceSource =
  /** An explicit list, for an option set the rulebook enumerates. */
  | { readonly kind: "cards"; readonly cardIds: readonly CardId[] }
  /** Cards of a campaign-specific encounter set (MC10 p. 5's Tech upgrades, MC50 p. 5's evidence cards). */
  | { readonly kind: "campaignSet"; readonly encounterSetId: EncounterSetId; readonly excludeGranted?: true }
  /**
   * MC10 p. 17: "When a player is instructed to add a card from their expert encounter set to their deck, they must
   * take that card from the set that matches their player number" — the seat's own numbered copy of
   * `Campaign.perSeatSetIds`.
   */
  | { readonly kind: "perSeatSet"; readonly excludeGranted?: true }
  /** MC27 p. 22 / MC32 p. 5 / MC45 p. 24: "an aspect card in their collection", filtered. */
  | { readonly kind: "collection"; readonly filter: CollectionFilter }
  /** Options of a `choice` or `strikeList` field (MC45 p. 5's available missions). */
  | { readonly kind: "fieldOptions"; readonly field: string; readonly unstruckOnly?: true }
  /** MC60 p. 9 steps 2 and 4: the unresolved scenarios, or the ones the players may currently choose. */
  | { readonly kind: "nodes"; readonly filter: "unresolved" | "available" }
  /** MC27 p. 22's "Planning Ahead": "Each player chooses one card from their deck". */
  | { readonly kind: "ownDeck"; readonly filter?: CollectionFilter };

/**
 * How a collection- or deck-wide choice is narrowed. Mirrors `TargetQuery`'s vocabulary where the two overlap, but
 * is its own type because it filters *card data*, not cards in play (there is no game here).
 */
export interface CollectionFilter {
  /** MC32 p. 5: "up to 1 copy of an event and/or 1 copy of an upgrade"; MC45 p. 24's upgrade/support/ally. */
  readonly categories?: readonly TargetCategory[];
  /** MC32 p. 5's "their role's associated aspects"; MC27 p. 22's "from any aspect" is simply this being absent. */
  readonly aspects?: readonly string[];
  readonly traits?: readonly Trait[];
  /** MC45 p. 20: "When playing expert campaign, the ally you choose during Setup must share a trait with your hero." */
  readonly sharesTraitWithIdentity?: true;
  /** MC16 p. 5's Unit Cost ceiling reads a numeric log field instead; this is a printed-cost filter. */
  readonly maxPrintedCost?: number;
  readonly excludeCardIds?: readonly CardId[];
}

// ---------------------------------------------------------------------------------------------------------------
// §4.6 Loss policy
// ---------------------------------------------------------------------------------------------------------------

/** What a lost game costs. There is **no engine default**: a box must state its policy, and the coverage test checks it. */
export interface LossPolicy {
  /**
   * `"free"`: MC10 p. 3 (and MC16, MC21, MC27, MC32, MC40, MC45) — "If the players lost, they may reset the
   * scenario and try again with no penalty."
   * `"byInstruction"`: MC50 p. 19 and MC60 p. 13 print a "DEFEAT:" block whose instructions run first.
   */
  readonly retry: "free" | "byInstruction";
  /** Defeat instructions appended to every node's own — MC60 p. 13's "Expert Campaign Only: Progress …" pattern. */
  readonly everyNodeDefeat?: readonly CampaignInstruction[];
  /**
   * What a retry restores. `"nodeStart"` replays the node against the log exactly as it stood when the node began,
   * *minus* anything the lost game removed from the campaign (RRG 1.8 p. 29) and minus whatever the `defeat`
   * instructions wrote. MC40 p. 7 depends on it: "When the players replay a scenario after losing, they must choose
   * the same player side scheme for that scenario and defeat it in order to earn its reward, **even if they
   * defeated it during a game they lost**." A per-box value, never an engine default (design Q6).
   */
  readonly retryBaseline: "nodeStart";
}

// ---------------------------------------------------------------------------------------------------------------
// §5 The log
// ---------------------------------------------------------------------------------------------------------------

/** One field's value. The `kind` always matches its `LogFieldDef.type.kind`. */
export type LogValue =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "flag"; readonly value: boolean }
  | { readonly kind: "cardList"; readonly cardIds: readonly CardId[] }
  | { readonly kind: "cardRef"; readonly cardId: CardId; readonly face?: string }
  | { readonly kind: "choice"; readonly option: string }
  | { readonly kind: "strikeList"; readonly struck: readonly string[] }
  /**
   * MC50 p. 6/p. 11: counters *by name* plus the face the card is on, because the flip is permanent ("that board
   * member permanently turns against the heroes, flipping to its attachment side").
   */
  | {
      readonly kind: "cardState";
      readonly cards: Readonly<
        Record<string, { readonly counters: Readonly<Record<string, number>>; readonly face?: string }>
      >;
    }
  | { readonly kind: "instructionList"; readonly ids: readonly string[] }
  | { readonly kind: "text"; readonly value: string };

/** A card the campaign put in a seat's deck (MC10 p. 3; MC16 p. 5; MC27 p. 22; MC32 p. 5). */
export interface CampaignGrant {
  readonly cardId: CardId;
  readonly permanence: GrantPermanence;
  /** Which face the grant is on: MC10 p. 12's "Improved" side, MC27 p. 22's Enhanced side. */
  readonly face?: string;
  /** The node that granted it, for the sheet and for `LossPolicy.retryBaseline`. */
  readonly grantedAtNodeId: string;
}

export interface CampaignSeat {
  /**
   * 1-based. MC10 p. 17: "each player is assigned a number from 1 to 4 in the campaign log. Each Expert Campaign
   * Set is also numbered from 1 to 4" — a seat attribute with rules consequences, not cosmetic ordering.
   */
  readonly seatNumber: number;
  /** MC10 p. 3: "Each player must use their chosen identity for the entire campaign." */
  readonly identityCardId: CardId;
  /**
   * The campaign's own **copy** of this seat's deck (design Q5). A `DeckId` into `mc-decks` would let an edit made
   * outside the campaign silently change the next scenario; `history[n].logBefore` keeps the copy the lost game
   * used, so a retry replays that deck.
   */
  readonly deck: DeckContents;
  readonly grants: readonly CampaignGrant[];
  readonly fields: Readonly<Record<string, LogValue>>;
}

/**
 * Everything a retry has to be able to restore, and the unit `CampaignHistoryEntry.logBefore` stores. It is the
 * mutable half of `CampaignLog`: the identity fields (`id`, `campaignId`, `schema`, `status`, `history`) are not
 * here because a retry never changes them.
 */
export interface CampaignLogSnapshot {
  readonly definitionVersion: string;
  readonly shared: Readonly<Record<string, LogValue>>;
  readonly hidden: Readonly<Record<string, LogValue>>;
  readonly seats: readonly CampaignSeat[];
  readonly removedFromCampaign: readonly CampaignCardFace[];
  readonly position: CampaignPosition;
  readonly rng: RngState;
}

/** The storage shape of a `CampaignLog`. Bumped like `SAVE_SCHEMA`; an older log is retired, not silently misread. */
export const CAMPAIGN_LOG_SCHEMA = 1;

export interface CampaignLog {
  readonly schema: number;
  readonly id: string;
  readonly campaignId: CampaignId;
  /** The `CampaignDefinition.version` this log was created against. A mismatch marks the log `incompatible`. */
  readonly definitionVersion: string;
  /** `@mc/content` pool version at creation, so errata landing under a running campaign is *detected*, not applied. */
  readonly poolVersion: string;
  /**
   * Campaign-level modes — in practice `campaign.expertCampaign`. Per-scenario modes live on each history entry,
   * because RRG 1.8 p. 29 says "During campaign mode or expert campaign mode, players can choose which other
   * mode(s) they wish to play for each individual scenario."
   */
  readonly modes: PlayModes;
  readonly seats: readonly CampaignSeat[];
  readonly shared: Readonly<Record<string, LogValue>>;
  /** Fields declared `hidden` (MC50 p. 5). Never crosses into a view model. */
  readonly hidden: Readonly<Record<string, LogValue>>;
  /** RRG 1.8 p. 29: no longer usable "during the rest of the campaign, even if players retry". By face — see `CampaignCardFace`. */
  readonly removedFromCampaign: readonly CampaignCardFace[];
  readonly position: CampaignPosition;
  /** The seed the campaign RNG was created from, kept beside the advancing state so a campaign can be re-derived. */
  readonly seed: number;
  /** Seeded RNG for every `random` op. Advancing it is part of the log's state. */
  readonly rng: RngState;
  /** One entry per game *attempted*, won or lost, in order: the campaign's replay trace. */
  readonly history: readonly CampaignHistoryEntry[];
  readonly status: CampaignStatus;
}

export type CampaignStatus = "active" | "won" | "lost" | "abandoned" | "incompatible";

export interface CampaignPosition {
  /** `linear`: the next node. `choice`: null until the players choose (MC60 p. 9 step 4). Null also when finished. */
  readonly nextNodeId: string | null;
  readonly resolved: Readonly<Record<string, "completed" | "failed">>;
  /** MC60 p. 9 step 3: progression marks per node id; three means Failed. */
  readonly progress: Readonly<Record<string, number>>;
}

export interface CampaignHistoryEntry {
  readonly nodeId: string;
  /** The per-scenario modes chosen for this attempt (RRG 1.8 p. 29: modes are chosen per scenario). */
  readonly modes: PlayModes;
  readonly outcome: CampaignAttemptOutcome;
  /** The `mc-saves` game id, so the played game can be replayed from the campaign browser. Null once pruned. */
  readonly gameId: string | null;
  /** The log exactly as it stood before this node's instructions ran — `LossPolicy.retryBaseline`. */
  readonly logBefore: CampaignLogSnapshot;
  /** Every step that ran, in order. This is what makes a campaign inspectable the way the game log is. */
  readonly steps: readonly CampaignStepTrace[];
  /** Epoch milliseconds, supplied by the caller. Never read from a clock here, so the engine stays pure. */
  readonly at: number;
}

export type CampaignAttemptOutcome = "won" | "lost" | "abandoned";

/** One resolved (or deliberately skipped) instruction, for the step list and for `rules-qa-engineer`'s replay. */
export interface CampaignStepTrace {
  readonly instructionId: string;
  /** Copied from the instruction so the trace reads without the definition to hand. */
  readonly text: string;
  readonly citation: string;
  readonly kind: CampaignStep["kind"];
  /** Set when the instruction did not run: its `whenModes` gate or its `when` predicate failed. */
  readonly skipped?: "modes" | "condition";
  readonly writes: readonly LogWrite[];
  readonly choices: readonly CampaignChoiceRecord[];
  readonly removedFromCampaign: readonly CampaignCardFace[];
  readonly grants: readonly CampaignGrant[];
}

/** What a `choose`/`random` op actually picked, so a step list is replayable from `(logBefore, result, choices)`. */
export interface CampaignChoiceRecord {
  readonly slot: string;
  /** The seat that chose, by `CampaignSeat.seatNumber`; null for a group or first-player choice. */
  readonly seatNumber: number | null;
  /** Card ids, node ids or option strings, depending on the source. */
  readonly picked: readonly string[];
  /** True when the pick came from `CampaignLog.rng` rather than from a human. */
  readonly random?: true;
}

// ---------------------------------------------------------------------------------------------------------------
// §7 Game <-> campaign boundary
// ---------------------------------------------------------------------------------------------------------------

/**
 * What the campaign hands a game. It becomes `GameSetupConfig.campaign` and therefore lands in `GameState` and in
 * the save's replay baseline — which is the property that keeps replay deterministic while the log keeps evolving
 * underneath: **a saved campaign game replays without consulting the campaign log at all.**
 */
export interface CampaignGameInput {
  readonly campaignId: CampaignId;
  readonly nodeId: string;
  readonly definitionVersion: string;
  readonly modes: PlayModes;
  /** Every log value this game may read, flattened and frozen. */
  readonly log: CampaignLogView;
  /** Already filtered by mode and by `when`, already in printed order; the engine runs each window's list as given. */
  readonly instructions: readonly ResolvedInstruction[];
  /** RRG 1.8 p. 29 removals, so nothing can re-enter the game through a search. By face (ruling April 30, 2026 (4)). */
  readonly removedFromCampaign: readonly CampaignCardFace[];
  readonly seats: readonly CampaignSeatInput[];
  /** Seed for anything the *in-game* instructions randomise; drawn from the log's RNG so it is not a second source. */
  readonly seed: number;
}

/**
 * The readable part of the log, flattened for in-game reads. Narrower than `CampaignLogSnapshot` on purpose: the
 * game never needs the decks, the RNG or the graph position, and a hidden field appears here only if an instruction
 * of this game reads it (MC50 p. 5's envelope stays shut otherwise).
 */
export interface CampaignLogView {
  readonly shared: Readonly<Record<string, LogValue>>;
  readonly perSeat: readonly {
    readonly seatNumber: number;
    readonly fields: Readonly<Record<string, LogValue>>;
  }[];
}

/** A seat as the campaign composed it, in the shape `PlayerSetup` consumes. */
export interface CampaignSeatInput {
  readonly seatNumber: number;
  readonly identityCardId: CardId;
  /** The expanded deck list, grants included. */
  readonly deck: readonly CardId[];
  readonly aspects: readonly CoreAspect[];
  /** Which of `deck` are campaign grants: legal here, and exempt from min/max deck size (MC10 p. 3). */
  readonly grantedCardIds: readonly CardId[];
}

/** An instruction the runner has already gated and ordered, ready for the engine to resolve at its window. */
export interface ResolvedInstruction {
  readonly instructionId: string;
  readonly text: string;
  readonly citation: string;
  readonly window: CampaignWindow;
  readonly effects: readonly EffectSpec[];
}

/**
 * What the finished game hands the campaign. Derived by `campaignResultOf` from the final state and the event
 * stream, never accumulated by a client.
 */
export interface CampaignGameResult {
  readonly nodeId: string;
  readonly outcome: "won" | "lost";
  /** Each `record` instruction's computed value, in printed order, with the instruction id that produced it. */
  readonly records: readonly { readonly instructionId: string; readonly write: LogWrite }[];
  /**
   * `removeFromCampaign` resolved *in game* — MC10 p. 3's Tech upgrades print "Discard this card and remove it from
   * the campaign log". Applied whatever the outcome, because RRG 1.8 p. 29 keeps it across a retry.
   */
  readonly removedFromCampaign: readonly CampaignCardFace[];
  /** `recordInCampaignLog` resolved in game. Applied whatever the outcome, for the same reason. */
  readonly logWrites: readonly LogWrite[];
  /** Grants with `permanence: "thisGame"` expiring now — MC32 p. 5's "use it or lose it" role upgrades. */
  readonly expiringGrants: readonly CardId[];
}
