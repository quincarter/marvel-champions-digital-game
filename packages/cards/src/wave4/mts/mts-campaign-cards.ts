import type { RuleSpec } from "@mc/engine";
import { trait } from "@mc/content";
import {
  action,
  alterEgoAction,
  anyOfCards,
  cards,
  cannotChooseToDiscard,
  chooseCards,
  chosen,
  constant,
  coveredByEngineRule,
  defineAbilities,
  discardFromHand,
  encounterCards,
  encounterSetAside,
  exists,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  gainsKeyword,
  gets,
  grantOwnedCards,
  heal,
  damageOn,
  heroAction,
  ifThen,
  ignores,
  inHand,
  moveCards,
  named,
  not,
  hasTrait,
  on,
  perHero,
  putIntoPlay,
  query,
  ready,
  selectCards,
  self,
  setAside,
  shuffleDeck,
  shuffleEncounterDeck,
  spend,
  thatPlayer,
  eachPlayer,
  when,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

/**
 * The Mad Titan's Shadow Campaign encounter set (`mts_campaign`, 21180-21193; MC21 pp. 7, 13, 17, 21, 25, 28):
 * campaign-only side schemes that flip into rewards (Secure the Landing Pad → Cosmo, Save the Shawarma Place →
 * Black Swan, Hack Sanctuary's Computer → Defensive Protocols), Security Breach, the System Shock obligation, the
 * Find the Norn Stones / Retrieve Odin's Armor pair, Norn Stone, Summoned Back, Open the Dungeons → Jormungand, and
 * the four Captive allies (Lady Sif, Fandral, Hogun, Volstagg). The campaign's own SETUP/VICTORY instructions that
 * put these cards into play, shuffle them in, or add them to the campaign pool are `../../campaigns/mts.ts`
 * (docs/campaign-mode-design.md §3); this module scripts each card's *own* printed text only.
 *
 * These cards only ever enter a game through `../../campaigns/mts.ts`'s campaign instructions or `System Shock`'s
 * own "shuffle it into your deck"/hand-grant text — MC21 p. 4: "Cards 180-193 ... cannot be included in any deck
 * unless playing The Mad Titan's Shadow campaign and the players were directed to add them ... by the Campaign
 * Instructions." `@mc/content`'s own `specificTo: { kind: "campaign", ... }` on the player-facing ones (Cosmo,
 * Shawarma, Norn Stone, Lady Sif, Fandral, Hogun, Volstagg) already keeps them out of ordinary deckbuilding
 * (`validateDeck`); nothing here re-enforces that.
 *
 * **The a/b flip pairs enter play on the new face** (docs/phase7-wave4.md §3.10, §4 Q17, user decision 2026-09-24):
 * `flipToOtherFace` (`packages/engine/src/resolve/other-face.ts`) already relocates the new face to where its type
 * lives and fires its "enters play" triggers (starting threat + hinder for a side scheme, engagement for a
 * minion), and already sends the new face's controller to `context.controllerId ?? firstPlayerId` — a side
 * scheme's own `whenDefeated` ability has no controller, so this is *already* "the first player" by construction
 * for every flip below (the same "covered by construction" shape `hela.ts` uses for Garm/Skurge/Nidhogg's own
 * "engages the first player").
 *
 * - **Secure the Landing Pad (21180a) → Cosmo (21180b)**: "The first player gains control of Cosmo" is
 *   `coveredByEngineRule()` (`21180b.cosmo-constant`) — a side scheme's own `whenDefeated` has no `context.
 *   controllerId`, so `apply-effect.ts`'s `flipCard` case already resolves the new face's controller to
 *   `ctx.state.firstPlayerId` by construction (`other-face.ts`'s own doc comment names this exact sentence);
 *   "Cosmo does not count against the ally limit" is a genuine standing rule (`21180b.cosmo-constant-2`); "Forced
 *   Interrupt: When Cosmo leaves play, remove him from the game" is `coveredByEngineRule()` — Cosmo is
 *   double-sided, and RRG 1.8 "Double-Sided Card" (p. 17) already sends a double-sided card leaving play out of the
 *   game (the same reasoning `hela.ts`'s Odin uses).
 * - **Security Breach (21181)**: a facedown-tuck-then-return pair, `tuckCards`/`tuckedUnder`.
 * - **Save the Shawarma Place (21182a) → Black Swan (21182b)**: "Black Swan engages the first player" is
 *   `coveredByEngineRule()` (`21182b.black-swan-constant`) — the same `flipCard`/`firstPlayerId` default as Cosmo
 *   above, and `other-face.ts`'s own `engagedEvent` push for the newly-flipped minion face; "Forced Response: After
 *   Black Swan engages you, discard 1 card from your hand" is genuinely triggered
 *   (`21182b.black-swan-forced-response`).
 * - **Hack Sanctuary's Computer (21184a) → Defensive Protocols (21184b)**: a plain "search deck+discard for 1
 *   card" reward, then a crash-counter countdown to System Shock, scripted with a pack-local `counterAtLeast`
 *   predicate (the same `gob/local.ts` shape — no `dsl` wrapper exists for it yet).
 * - **System Shock (21185)**: an obligation that lives in its owner's *hand* rather than their play area (unlike
 *   every other obligation, RRG 1.8 "Obligation", p. 30's "if a player draws an obligation card from their player
 *   deck, they place that obligation into their play area" — overridden by this card's own printed text, which
 *   only makes sense read as staying in hand), printing two independent clauses — a standing "you cannot choose to
 *   discard" restriction, and an unrelated hand-only Alter-Ego Action — now split into two refs by `parse-text.ts`
 *   (`QUOTED_HEADER_RE`, `card-data-pipeline`'s fix for a trigger header nested inside a quoted "gains: '...'"
 *   clause rather than printed bare, the one shape the existing Martial Law/Anti-Hero Propaganda generalization
 *   didn't cover). Both are `inHand(...)` (`AbilityDefinition.activeIn: "hand"`, docs/phase7-wave4.md §3.13, this
 *   exact card's own worked example in that field's doc comment): the constant rule is `cannotChooseToDiscard`,
 *   and the action removes the card from the game.
 * - **Find the Norn Stones (21186a) → Retrieve Odin's Armor (21186b)**: both a same-type (side scheme → side
 *   scheme) flip, so no relocation; each has a `threatCannotBeRemoved` gate and its own `whenDefeated` reward.
 * - **Norn Stone (21187a/b)**: an ordinary double-sided player upgrade — Setup/Permanent front granting stats and
 *   a Hero Action to ready-and-flip, an Alter-Ego Action on the back to heal.
 * - **Summoned Back (21188)**: "search ... for your nemesis minion" is `TargetQuery.nemesisMinionOf`
 *   (`toafk/kang.ts`'s own 11013b precedent), searched across deck, discard, *and* the player's own set-aside area
 *   (`anyOfCards`).
 * - **Open the Dungeons (21189a) → Jormungand (21189b)**: a same-type flip (side scheme → attachment is a *type*
 *   change, so it *does* relocate — to its printed host, Loki) whose own When Defeated lets each player choose a
 *   Captive ally from the campaign set; Jormungand's own Forced Interrupt pre-empts the normal "attachment
 *   discarded on host defeat" sweep by removing itself from the game first.
 * - **Lady Sif / Fandral / Hogun (21190-21192)**: the three Captive allies' own printed abilities. Volstagg
 *   (21193) has no ability ref (Retaliate/Toughness are both data-driven keywords).
 */

const CAPTIVE = trait("CAPTIVE");
const WOUNDED = trait("WOUNDED");

/**
 * "If there are N counters here, ..." — a pack-local predicate wrapper (no `dsl` builder exists yet), the same
 * shape `wave1/gob/local.ts`'s own `noCounters` uses for the same underlying `Predicate.counterAtLeast`.
 */
function counterAtLeast(counterType: string, amount: number) {
  return { kind: "counterAtLeast" as const, of: self, counterType, amount };
}

export const MTS_CAMPAIGN_CARDS = defineAbilities({
  // --- Secure the Landing Pad (21180a) / Cosmo (21180b) --------------------------------------------------------
  // "Hinder 1[per_hero] (data).\nWhen Defeated: Flip this card over."
  "21180a.when-defeated": whenDefeated(flipCard(self)),
  // "The first player gains control of Cosmo." — the flip's own default (module docblock).
  "21180b.cosmo-constant": coveredByEngineRule(),
  // "Cosmo does not count against the ally limit."
  "21180b.cosmo-constant-2": constant({ rules: [{ kind: "excludedFromAllyLimit", target: { self: true } }] }),
  // "Forced Interrupt: When Cosmo leaves play, remove him from the game." — double-sided leave-play (module docblock).
  "21180b.cosmo-forced-interrupt": coveredByEngineRule(),

  // --- Security Breach (21181) ---------------------------------------------------------------------------------
  // "Hinder 2[per_hero]. Victory 2 (data).\nWhen Revealed: Each player places a random card from their hand
  // facedown here."
  "21181.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, {
      kind: "tuckCards",
      cards: zone("hand", thatPlayer, { random: 1 }),
      under: self,
      facedown: true,
    }),
  ),
  // "When Defeated: Return each facedown card here to its owner's hand."
  "21181.when-defeated": whenDefeated(moveCards({ kind: "tucked", under: self }, "hand")),

  // --- Save the Shawarma Place (21182a) / Black Swan (21182b) --------------------------------------------------
  // "Hinder 1[per_hero] (data).\nWhen Defeated: Each player shuffles 1 copy of Shawarma into their deck. Flip this
  // card over." Shawarma is granted the same `thisGame` shape as the campaign's own later `poolDeckGrant`, sourced
  // from the shared campaign pool (`encounterSetAside`, `assignOwnerTo` — docs/phase7-wave4.md §3.10's own new
  // primitive, `EffectSpec.moveCards.assignOwnerTo`).
  "21182a.when-defeated": whenDefeated(
    forEachPlayer(eachPlayer, grantOwnedCards(encounterSetAside({ name: "Shawarma" }), "deckShuffle", thatPlayer)),
    flipCard(self),
  ),
  // "Black Swan engages the first player." — the flip's own default (module docblock).
  "21182b.black-swan-constant": coveredByEngineRule(),
  // "Forced Response: After Black Swan engages you, discard 1 card from your hand."
  "21182b.black-swan-forced-response": forcedResponse({ on: "minionEngaged", selfIs: "source" }, discardFromHand(1)),

  // --- Hack Sanctuary's Computer (21184a) / Defensive Protocols (21184b) ----------------------------------------
  // "Hinder 1[per_hero] (data).\nWhen Defeated: Each player searches their deck and discard pile for 1 card, adds
  // it to their hand, and shuffles their deck. Flip this card over."
  "21184a.when-defeated": whenDefeated(
    forEachPlayer(eachPlayer, [
      chooseCards("found", zone(["deck", "discard"], thatPlayer), { min: 1, max: 1, chooser: thatPlayer }),
      moveCards({ kind: "ref", ref: { kind: "slot", slot: "found" } }, "hand"),
      shuffleDeck(thatPlayer),
    ]),
    flipCard(self),
  ),
  // "Hinder 2[per_hero]. Victory 2 (data).\nForced Interrupt: When the player phase ends, place 1 crash counter
  // here. If there are 2 crash counters here, each player adds 1 copy of the System Shock obligation card to
  // their hand. Remove this card from the game."
  "21184b.defensive-protocols-forced-interrupt": forcedInterrupt(
    on.phaseEnding("player"),
    { kind: "addCounters", counterType: "crash", amount: { kind: "const", value: 1 }, target: self },
    ifThen(counterAtLeast("crash", 2), [
      forEachPlayer(eachPlayer, grantOwnedCards(encounterSetAside({ name: "System Shock" }), "hand", thatPlayer)),
      moveCards({ kind: "ref", ref: self }, "removedFromGame"),
    ]),
  ),

  // --- System Shock (21185) --------------------------------------------------------------------------------------
  // "You cannot choose to discard this card from your hand." — active only while the card is in hand (module
  // docblock, docs/phase7-wave4.md §3.13).
  "21185.system-shock-constant": inHand(constant(cannotChooseToDiscard)),
  // "While this card is in your hand, it gains: 'Alter-Ego Action: Spend a [mental] resource → remove this card
  // from the game.'"
  "21185.system-shock-action": inHand(
    alterEgoAction({ cost: spend({ mental: 1 }) }, moveCards(cards(self), "removedFromGame")),
  ),

  // --- Find the Norn Stones (21186a) / Retrieve Odin's Armor (21186b) -------------------------------------------
  // "Threat cannot be removed from this scheme unless Hela has the Wounded trait."
  "21186a.find-the-norn-stones-constant": constant({
    rules: [
      {
        kind: "threatCannotBeRemoved",
        target: query("sideScheme", { name: "Find the Norn Stones" }),
        while: not(hasTrait(named("Hela"), WOUNDED)),
      },
    ] satisfies readonly RuleSpec[],
  }),
  // "When Defeated: Each player puts a copy of the Norn Stone upgrade into play under their control on its setup
  // side. Flip this card over." (modeling choice 5, `../../campaigns/mts.ts`'s own docblock: Norn Stone's front
  // face already is its Setup side.)
  "21186a.when-defeated": whenDefeated(
    forEachPlayer(eachPlayer, [
      // "a copy": one of the four set-aside copies per player (all four went to the first player before).
      selectCards("nornstone", encounterSetAside({ name: "Norn Stone" }, { random: 1 })),
      // `putIntoPlay`'s own ownerless-non-minion branch treats an unowned card as an encounter-side reveal
      // (RRG 1.8 "Enters Play"); this card is a player upgrade with no owner yet (it comes from the shared
      // `encounterSetAside` pool, never anyone's deck), so ownership is assigned first (`assignOwnerTo`) to take
      // the ordinary "player card, put under a controller" path instead.
      grantOwnedCards(cards(chosen("nornstone")), "hand", thatPlayer),
      putIntoPlay(chosen("nornstone"), thatPlayer),
    ]),
    flipCard(self),
  ),
  // "Hinder 2[per_hero]. Victory 1 (data).\nThreat cannot be removed from this scheme unless the first player
  // controls Odin."
  "21186b.retrieve-odins-armor-constant": constant({
    rules: [
      {
        kind: "threatCannotBeRemoved",
        target: query("sideScheme", { name: "Retrieve Odin's Armor" }),
        while: not(exists(query([], { name: "Odin", controlledBy: { kind: "firstPlayer" } }))),
      },
    ] satisfies readonly RuleSpec[],
  }),
  // "When Defeated: Heal all damage from Odin and flip him to his King side."
  "21186b.when-defeated": whenDefeated(heal(damageOn(named("Odin")), named("Odin")), flipCard(named("Odin"))),

  // --- Norn Stone (21187a front / 21187b back) ------------------------------------------------------------------
  // "Permanent. Setup (data).\nYour hero gets +1 THW, +1 ATK, and +1 DEF."
  "21187a.norn-stone-constant": constant(
    gets("thw", 1, { self: true }),
    gets("atk", 1, { self: true }),
    gets("def", 1, { self: true }),
  ),
  // "Hero Action: Ready your hero. Flip this card over."
  "21187a.norn-stone-action": heroAction(ready(yourIdentity), flipCard(self)),
  // Back face — "Permanent (data).\nYour hero gets +1 THW, +1 ATK, and +1 DEF."
  "21187b.norn-stone-constant": constant(
    gets("thw", 1, { self: true }),
    gets("atk", 1, { self: true }),
    gets("def", 1, { self: true }),
  ),
  // "Alter-Ego Action: Exhaust Norn Stone to heal 1 damage from your identity."
  "21187b.norn-stone-action": alterEgoAction({ cost: { exhaustSelf: true } }, heal(1, yourIdentity)),

  // --- Summoned Back (21188) -------------------------------------------------------------------------------------
  // "Peril. Surge (data).\nWhen Revealed: Search the encounter deck, discard pile, and set-aside area for your
  // nemesis minion and put it into play engaged with you. Shuffle the encounter deck." (`toafk/kang.ts`'s own
  // 11013b precedent for the identification half, `TargetQuery.nemesisMinionOf`.)
  "21188.when-revealed": whenRevealed(
    selectCards(
      "nemesis",
      anyOfCards(
        encounterCards(["deck", "discard"], query("minion", { nemesisMinionOf: you })),
        setAside(you, query("minion", { nemesisMinionOf: you })),
      ),
    ),
    putIntoPlay(chosen("nemesis"), you),
    shuffleEncounterDeck(),
  ),

  // --- Open the Dungeons (21189a) / Jormungand (21189b) ----------------------------------------------------------
  // "When Defeated: Each player chooses 1 Captive ally from the campaign set and puts it into play under their
  // control. Flip this card over."
  "21189a.when-defeated": whenDefeated(
    forEachPlayer(eachPlayer, [
      chooseCards("captive", encounterSetAside(query(["ally"], { trait: CAPTIVE })), {
        min: 1,
        max: 1,
        chooser: thatPlayer,
      }),
      // Same ownerless-non-minion `putIntoPlay` branch as Norn Stone above: assign ownership first.
      grantOwnedCards(cards(chosen("captive")), "hand", thatPlayer),
      putIntoPlay(chosen("captive"), thatPlayer),
    ]),
    flipCard(self),
  ),
  // "Attach to Loki (data).\nLoki gets +4[per_hero] hit points."
  "21189b.jormungand-constant": constant(gets("hp", perHero(4), query("villain", { hostOfSelf: true }))),
  // "Forced Interrupt: When Loki is defeated, remove this card from the game." — pre-empts the normal
  // attachment-discarded-on-host-defeat sweep (module docblock).
  "21189b.jormungand-forced-interrupt": forcedInterrupt(
    when.defeated(query("villain", { name: "Loki" })),
    moveCards({ kind: "ref", ref: self }, "removedFromGame"),
  ),

  // --- Lady Sif (21190) -------------------------------------------------------------------------------------------
  // "Action: Spend a [physical] resource → ready Lady Sif."
  "21190.lady-sif-action": action({ cost: spend({ physical: 1 }) }, ready(self)),

  // --- Fandral (21191) --------------------------------------------------------------------------------------------
  // "[star] When Fandral uses his basic THW, ignore any crisis icons ([crisis]) in play."
  "21191.fandral-constant": constant(ignores({ self: true }, ["crisis"])),

  // --- Hogun (21192) ----------------------------------------------------------------------------------------------
  // "[star] Hogun's attacks gain piercing."
  "21192.hogun-constant": constant(gainsKeyword({ name: "piercing" }, { self: true })),
});
