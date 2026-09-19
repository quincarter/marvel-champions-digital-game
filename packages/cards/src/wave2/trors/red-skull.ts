import { trait } from "@mc/content";
import {
  attachCard,
  boost,
  chooseCards,
  chooseTarget,
  chosen,
  confuse,
  constant,
  coveredByEngineRule,
  countOf,
  dealDamage,
  dealEncounterCard,
  defeatingPlayer,
  defineAbilities,
  discard,
  eachPlayer,
  enemyAttack,
  enemyScheme,
  exhaust,
  firstPlayer,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gets,
  giveTough,
  hasStatus,
  heroAction,
  ifElse,
  ifThen,
  moveCards,
  on,
  placeThreat,
  putIntoPlay,
  query,
  resourceTypesOf,
  revealCard,
  rule,
  scenarioDeck,
  self,
  selectCards,
  setup,
  shuffleDeck,
  spend,
  stun,
  theMainScheme,
  theVillain,
  thatPlayer,
  undefendedAttack,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { cards, modifyAttack } from "../../dsl/effects.js";
import { cardName } from "../names.js";

const WEAPON = trait("WEAPON");
const ELITE = trait("ELITE");
const HYDRA = trait("HYDRA");

/**
 * The Red Skull scenario (`red_skull` encounter set, plus the required Hydra Assault/Hydra Patrol modular sets and
 * the Weapon Master modular set within them): the villain (04125–04127), main scheme "The Rise of Red Skull" →
 * "New World Hydra" (04128), his own encounter set (04130–04144), and the shared Hydra Assault (04145–04147, only
 * 04145/04146 are new — 04147 is a Core/wave 1 reprint), Weapon Master (04148–04151) and Hydra Patrol (04152–04154,
 * only 04154 is new) modular cards.
 *
 * `04141.when-defeated` (Prison Camps) and `04143.when-defeated` (Hydra Reinforcements) — both print "the player who
 * defeated this scheme," the same missing `PlayerRef` Crossbones' Assault (04070, `crossbones.ts`) was pinned for —
 * were pinned pending that primitive; the engine's `defeatingPlayer` (docs/phase7-wave2.md §3) now covers all three.
 * Test Subjects (04123, `zola.ts`) is unaffected — it names "the first player" explicitly, not the defeating player.
 *
 * **Reading: "Set The Sleeper aside, out of play"** (1A Setup) is modeled at the scenario-builder level
 * (`../setup.ts`'s `redSkullScenario`, `GameSetupConfig.setAside`) rather than as a scripted effect — the same
 * choice Taskmaster's Captive allies use (`taskmaster.ts`'s module docblock) — since it's equivalent to never
 * building the card into the encounter deck in the first place, and the engine's `setAside` config already exists
 * for exactly this.
 *
 * **Reading: "Interrupt: When a character thwarts this side scheme, they may use their ATK instead of their THW"**
 * (The Red House, 04139) is modeled as a *constant* `RuleSpec.thwartWithAtk` (docs/phase7-wave2.md §3.11: "The
 * Assault keyword [...] `RuleSpec thwartWithAtk` with `basicThwart.useAtk` is the Red House's optional version"),
 * not as a scripted Interrupt ability — the underlying primitive is itself a standing rule read whenever a thwart
 * against this scheme resolves, the same way `cannotTakeDamage` (this card's own first sentence) is a constant
 * despite reading like an ongoing prevention rather than a trigger.
 *
 * **Reading: "Forced Interrupt: when attached side scheme is defeated"** (Twisted Reality, 04135) is scripted as a
 * `forcedResponse`, not a `forcedInterrupt`: `schemeDefeated` isn't in `isAnnouncement`'s explicit interruptible
 * list (`packages/engine/src/trigger-events.ts`), so it defaults to announcement-only (response-timing only,
 * like `cardEntersPlay` — docs/phase7-wave2-scripting.md §6.9's same shape). Unlike that Interrupt (None Shall
 * Pass) or Mockingbird's, this one's effect ("deal the first player an encounter card") has no interaction with
 * the defeat it's reacting to — nothing to prevent or redirect — so a Response produces the identical observable
 * outcome a moment later; this is a faithful restatement, not an approximation, but is flagged here rather than
 * silently assumed.
 */
export const RED_SKULL_SET = defineAbilities({
  // Red Skull (I/II/III) — [star] gets +1 ATK for each side scheme in play.
  "04125.red-skull-constant": constant(gets("atk", countOf(query("sideScheme")), query("villain", { self: true }))),
  "04126.red-skull-constant": constant(gets("atk", countOf(query("sideScheme")), query("villain", { self: true }))),
  "04126.when-revealed": whenRevealed(dealEncounterCard(eachPlayer)),
  "04127.red-skull-constant": constant(gets("atk", countOf(query("sideScheme")), query("villain", { self: true }))),
  "04127.when-revealed": whenRevealed(dealEncounterCard(eachPlayer)),

  // The Rise of Red Skull 1A — Setup: put the Red House into play. Shuffle every other encounter side scheme into
  // the side-scheme deck (errata, RRG 1.8 p. 66 #128A). The Sleeper is set aside via the scenario builder.
  "04128a.setup": setup(
    selectCards("redHouse", { kind: "encounter", zones: ["deck"], filter: query("sideScheme", { name: cardName("04139") }) }),
    putIntoPlay(chosen("redHouse"), firstPlayer),
    { kind: "buildScenarioDeck", name: "side-scheme" },
  ),
  // The data carries a second ("-constant") ability ref for 1A with no separate printed text of its own beyond
  // "Setup:" — the same parser-artifact shape as this pack's other duplicated refs (`absorbing-man.ts`'s
  // Omni-Morph Duplication, `zola.ts`'s The Mad Doctor/Neurological Implants).
  "04128a.the-rise-of-red-skull-constant": coveredByEngineRule(),
  // The Rise of Red Skull — Forced Response (module docblock: printed "Forced Interrupt," scripted as a Response):
  // after resolving step one of the villain phase, reveal the top card of the side-scheme deck and put it into play.
  "04128b.the-rise-of-red-skull-forced-response": forcedResponse(
    on.threatPlaced(query("mainScheme")),
    selectCards("found", scenarioDeck("side-scheme", { top: 1 })),
    revealCard(chosen("found"), firstPlayer),
  ),

  // New World Hydra 2A — When Revealed: reveal the top card of the side-scheme deck and put it into play.
  "04129a.when-revealed": whenRevealed(selectCards("found", scenarioDeck("side-scheme", { top: 1 })), revealCard(chosen("found"), firstPlayer)),
  // New World Hydra — same Forced Response as 1B. "If this scheme is completed, the players lose" is data.
  "04129b.new-world-hydra-forced-response": forcedResponse(
    on.threatPlaced(query("mainScheme")),
    selectCards("found2", scenarioDeck("side-scheme", { top: 1 })),
    revealCard(chosen("found2"), firstPlayer),
  ),
  "04129b.new-world-hydra-constant": coveredByEngineRule(),

  // The Sleeper — Guard. Retaliate 1. Toughness (data). When Revealed: engages the first player. When Defeated:
  // remove it from the game.
  "04130.when-revealed": whenRevealed({ kind: "engage", minion: self, player: firstPlayer }),
  "04130.when-defeated": whenDefeated(moveCards(cards(self), "removedFromGame")),

  // Hydra Exo-Soldier — Toughness (data). [star] Boost: give the villain a tough status card and another boost
  // card. "Another boost card" reads as one more for *this* activation (`modifyAttack.extraBoostCards`), since
  // this card is itself resolving as a boost card during one — the validator refuses `giveBoostCard` (a *future*
  // boost, waiting facedown) inside a Boost ability for exactly this reason (`dsl/validate.ts`).
  "04131.boost": boost(giveTough(theVillain), modifyAttack({ extraBoostCards: 1 })),

  // Red Skull's Luger — Attach to Red Skull (data). [star] his attacks gain piercing and ranged. Hero Action:
  // spend [E][M][P] → discard. [star] Boost: attach to Red Skull.
  "04132.red-skulls-luger-constant": constant(gainsKeyword({ name: "piercing" }, query("enemy", { hostOfSelf: true })), gainsKeyword({ name: "ranged" }, query("enemy", { hostOfSelf: true }))),
  "04132.red-skulls-luger-action": heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self)),
  "04132.boost": boost(attachCard(self, theVillain)),

  // Red Skull's Right Hook — Attach to Red Skull. Red Skull gains retaliate 1. Hero Action as above.
  "04133.red-skulls-right-hook-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, query("enemy", { hostOfSelf: true }))),
  "04133.red-skulls-right-hook-action": heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self)),

  // Master Strategist — Attach to Red Skull. Forced Interrupt: when Red Skull activates, give him an additional
  // boost card for each side scheme in play, then discard this card.
  "04134.master-strategist-forced-interrupt": forcedInterrupt(
    { on: ["enemyAttack", "enemyScheme"], sourceIs: { hostOfSelf: true } },
    modifyAttack({ extraBoostCards: countOf(query("sideScheme")) }),
    discard(self),
  ),

  // Twisted Reality — Incite 1 (data). Attach to a side scheme (data). Forced Response (module docblock): after
  // attached side scheme is defeated, deal the first player an encounter card.
  "04135.twisted-reality-forced-interrupt": forcedResponse(on.schemeDefeated("host"), dealEncounterCard(firstPlayer)),

  // Bitter Rival — When Revealed (current, errata RRG 1.8 p. 66): for each side scheme in play, choose and
  // exhaust a character you control. [star] Boost: exhaust a character you control.
  "04136.when-revealed": whenRevealed(chooseTarget("chars", query("character", { controller: "you" }), { count: countOf(query("sideScheme")) }), exhaust(chosen("chars"))),
  "04136.boost": boost(chooseTarget("char", query("character", { controller: "you" })), exhaust(chosen("char"))),

  // Spreading Lies — When Revealed: place 2 threat on each scheme in play. [star] Boost: give Red Skull a tough
  // status card.
  "04137.when-revealed": whenRevealed(placeThreat(2, { kind: "each", query: query("scheme") })),
  "04137.boost": boost(giveTough(theVillain)),

  // Infinite Power — When Revealed (Alter-Ego): give Red Skull a tough status card; he schemes. When Revealed
  // (Hero): give Red Skull a tough status card; he attacks you.
  "04138.when-revealed-alter-ego": whenRevealedAlterEgo(giveTough(theVillain), enemyScheme(theVillain)),
  "04138.when-revealed-hero": whenRevealedHero(giveTough(theVillain), enemyAttack(theVillain, { against: you })),

  // The Red House — Red Skull cannot take damage. Interrupt (module docblock: modeled as a constant rule): when a
  // character thwarts this side scheme, they may use their ATK instead of their THW.
  "04139.the-red-house-constant": constant(rule({ kind: "cannotTakeDamage", target: query("villain") })),
  "04139.the-red-house-interrupt": constant(rule({ kind: "thwartWithAtk", scheme: query("sideScheme", { self: true }) })),

  // The Sleeper Awakened — This scheme cannot leave play while The Sleeper is in play (data). When Revealed: put
  // The Sleeper into play engaged with the first player. When The Sleeper is defeated, remove this card (data —
  // the same "removed alongside" rule the card's own second sentence describes; no further ability ref for it).
  "04140.the-sleeper-awakened-constant": coveredByEngineRule(),
  "04140.when-revealed": whenRevealed(
    selectCards("sleeper", { kind: "encounterSetAside", filter: query("minion", { name: cardName("04130") }) }),
    putIntoPlay(chosen("sleeper"), firstPlayer),
  ),

  // Prison Camps — When Defeated: The player who defeated this scheme searches their deck and discard pile for an
  // ally, puts it into play, and shuffles their deck.
  "04141.when-defeated": whenDefeated(
    chooseCards("found", zone(["deck", "discard"], defeatingPlayer, { filter: query("ally") }), { min: 1, max: 1, chooser: defeatingPlayer }),
    putIntoPlay(chosen("found"), defeatingPlayer),
    shuffleDeck(defeatingPlayer),
  ),

  // Censor the Past — When Defeated: each player chooses up to 3 cards in their discard pile and shuffles them
  // into their deck.
  "04142.when-defeated": whenDefeated(
    forEachPlayer(eachPlayer, [
      chooseCards("returned", { kind: "zone", zone: "discard", player: thatPlayer }, { min: 0, max: 3, chooser: thatPlayer }),
      moveCards(cards(chosen("returned")), "deckShuffle"),
    ]),
  ),

  // Hydra Reinforcements — When Defeated: The player who defeated this scheme discards a non-Elite minion.
  "04143.when-defeated": whenDefeated(
    chooseTarget("minion", query("minion", { withoutTrait: ELITE }), { chooser: defeatingPlayer }),
    discard(chosen("minion")),
  ),

  // Mass Chaos — When Revealed: each player discards the top 5 cards of their deck and places 1 threat here for
  // each different type of resource icon they discarded this way.
  "04144.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, [
      selectCards("milled", { kind: "zone", zone: "deck", player: thatPlayer, top: { kind: "const", value: 5 } }),
      moveCards(cards(chosen("milled")), "discard"),
      placeThreat(resourceTypesOf(chosen("milled")), self),
    ]),
  ),

  // Hydra Flame-Soldier (Hydra Assault) — [star] Forced Response: after an undefended attack against you, discard
  // a support you control. [star] Boost: if this resolves during an undefended attack, discard a support you
  // control.
  "04145.hydra-flame-soldier-forced-response": forcedResponse(
    { on: "enemyAttack", sourceIs: { hostOfSelf: true }, playerIs: "controller", usesAttackedPlayer: true, requireResults: { damage: 1, undefended: 1 } },
    chooseTarget("support", query("support", { controller: "you" }), { optional: true }),
    ifThen({ kind: "exists", query: query("support", { controller: "you" }) }, discard(chosen("support"))),
  ),
  "04145.boost": boost(
    ifThen(undefendedAttack, [chooseTarget("support2", query("support", { controller: "you" }), { optional: true }), ifThen({ kind: "exists", query: query("support", { controller: "you" }) }, discard(chosen("support2")))]),
  ),

  // Hydra Jet-Trooper (Hydra Assault) — Quickstrike (data). [star] Boost: if you are in hero form, the villain
  // attacks you after this activation (with no boost cards dealt for that attack — a second-attack nuance this
  // pack has no card testing yet; `enemyAttack`'s own boost dealing already applies normally).
  "04146.boost": boost(ifThen({ kind: "form", player: you, form: "hero" }, enemyAttack(theVillain, { against: you }))),

  // Combat Knife (Weapon Master) — Attach to the villain (data). [star] Attached villain's attacks gain piercing.
  // Hero Action: spend [M][P] → discard.
  "04148.combat-knife-constant": constant(gainsKeyword({ name: "piercing" }, query("enemy", { hostOfSelf: true }))),
  "04148.combat-knife-action": heroAction({ cost: spend({ mental: 1, physical: 1 }) }, discard(self)),

  // Hydra Sidearm (Weapon Master) — Attach to the villain (data). [star] Forced Interrupt: when attached villain
  // attacks, the attack gains ranged. Hero Action: spend [M][P] → discard.
  "04149.hydra-sidearm-forced-interrupt": constant(gainsKeyword({ name: "ranged" }, query("enemy", { hostOfSelf: true }))),
  "04149.hydra-sidearm-action": heroAction({ cost: spend({ mental: 1, physical: 1 }) }, discard(self)),

  // Weapon Master (Weapon Master) — When Revealed (Alter-Ego): the villain schemes (surge if they have a Weapon
  // attachment). When Revealed (Hero): the villain attacks you (surge if they have a Weapon attachment).
  "04150.when-revealed-alter-ego": whenRevealedAlterEgo(
    enemyScheme(theVillain),
    ifThen({ kind: "exists", query: query("attachment", { trait: WEAPON, host: theVillain }) }, { kind: "gainSurge" }),
  ),
  "04150.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you }),
    ifThen({ kind: "exists", query: query("attachment", { trait: WEAPON, host: theVillain }) }, { kind: "gainSurge" }),
  ),

  // Concussion Grenade (Weapon Master) — When Revealed (Alter-Ego): you are confused; place 1 threat on the main
  // scheme (2 instead if already confused). When Revealed (Hero): you are stunned; deal 1 damage to your hero (2
  // instead if already stunned). The "already" check reads status before this card's own confuse/stun applies.
  "04151.when-revealed-alter-ego": whenRevealedAlterEgo(placeThreat(ifElse(hasStatus(yourIdentity, "confused"), 2, 1), theMainScheme), confuse(yourIdentity)),
  "04151.when-revealed-hero": whenRevealedHero(dealDamage(ifElse(hasStatus(yourIdentity, "stunned"), 2, 1), yourIdentity), stun(yourIdentity)),

  // Hydra Patrol (Hydra Patrol) — When Defeated: each player searches the encounter deck and discard pile for a
  // Hydra minion and puts it into play engaged with them. Shuffle the encounter deck.
  "04154.when-defeated": whenDefeated(
    forEachPlayer(eachPlayer, [
      chooseCards("found", { kind: "encounter", zones: ["deck", "discard"], filter: query("minion", { trait: HYDRA }) }, { min: 1, max: 1, chooser: thatPlayer }),
      putIntoPlay(chosen("found"), thatPlayer),
    ]),
    { kind: "shuffleEncounterDeck" },
  ),
});
