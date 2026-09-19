import { trait } from "@mc/content";
import {
  amount,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countAmong,
  dealDamage,
  dealEncounterCard,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterCards,
  discardFromHand,
  draw,
  eachPlayer,
  encounterCards,
  enemyAttack,
  enemyScheme,
  eventAmount,
  eventPlayer,
  eventSource,
  eventTarget,
  exhaustYourHero,
  firstPlayer,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  giveTough,
  heroAction,
  identityOf,
  ifThen,
  isAlterEgo,
  isHero,
  moveCards,
  on,
  option,
  ownerOf,
  placeThreat,
  preventDamage,
  putIntoPlay,
  query,
  removeThreat,
  response,
  self,
  selectCards,
  setup,
  shuffleEncounterDeck,
  spend,
  stun,
  takeIntoHand,
  theMainScheme,
  theVillain,
  thatPlayer,
  tuckCards,
  tuckedUnder,
  valueAtLeast,
  varOf,
  when,
  whenDefeated,
  whenRevealed,
  you,
  zone,
} from "../../dsl/index.js";
import { cards } from "../../dsl/effects.js";
import { cardName } from "../names.js";

const THWART = trait("THWART");
const ATTACK = trait("ATTACK");
const CAPTIVE = trait("CAPTIVE");
const HYDRA_PATROL_NAME = cardName("04154");

/**
 * The Taskmaster scenario (`taskmaster` encounter set, plus the required Hydra Patrol set and the Weapon Master
 * modular set): the villain (04093–04095), main scheme "Hunting Down Heroes" (04096), and his own encounter set
 * (04097–04108). Hydra Patrol's own cards (04152–04154) are scripted in `red-skull.ts`, where the set is shared.
 *
 * `04093.taskmaster-forced-response` (and its identical copies on 04094/04095) were pinned pending an
 * `EventPattern` field to filter `formChanged`'s own `to` direction; the engine's `EventPattern.eventIs` and
 * `PlayerRef { kind: "eventPlayer" }` (docs/phase7-wave2.md §3.13.9) now cover it — `on.playerChangesForm("hero")`.
 *
 * **Captured by Hydra (04107) now carries its own `.when-defeated` ref too** (a later data pass split the two
 * printed triggers apart, the same fix Hydra Prison, 04122, `zola.ts`, already had two refs for) — both halves are
 * scripted below.
 */
export const TASKMASTER_SET = defineAbilities({
  // Taskmaster (I/II/III) — Forced Response: after a player changes to hero form, they discard the top card of the
  // encounter deck and take damage equal to the number of boost icons on that card. "They" is `eventPlayer`, the
  // player `formChanged` itself names — no `playerIs` scope, since it is any player, not just "you".
  "04093.taskmaster-forced-response": forcedResponse(
    on.playerChangesForm("hero"),
    discardEncounterCards(1, { bind: "d" }),
    dealDamage(varOf("d.boostIcons"), identityOf(eventPlayer)),
  ),
  "04094.taskmaster-forced-response": forcedResponse(
    on.playerChangesForm("hero"),
    discardEncounterCards(1, { bind: "d" }),
    dealDamage(varOf("d.boostIcons"), identityOf(eventPlayer)),
  ),
  "04095.taskmaster-forced-response": forcedResponse(
    on.playerChangesForm("hero"),
    discardEncounterCards(1, { bind: "d" }),
    dealDamage(varOf("d.boostIcons"), identityOf(eventPlayer)),
  ),

  // Taskmaster (II/III) — When Revealed: deal each player an encounter card.
  "04094.when-revealed": whenRevealed(dealEncounterCard(eachPlayer)),
  "04095.when-revealed": whenRevealed(dealEncounterCard(eachPlayer)),

  // Hunting Down Heroes 1A — Setup: (Captive allies set aside — `../setup.ts`'s scenario builder, `config.setAside`,
  // since they carry no `encounterSetIds` of their own to be swept into the encounter deck). Search the encounter
  // deck for Hydra Patrol and put it into play. Shuffle the encounter deck.
  "04096a.setup": setup(
    selectCards("found", encounterCards(["deck"], { name: HYDRA_PATROL_NAME })),
    putIntoPlay(chosen("found"), firstPlayer),
    shuffleEncounterDeck(),
  ),
  // Hunting Down Heroes — Forced Response: after resolving step one of the villain phase, each player in hero
  // form must choose to place 1 threat here or take 1 damage (docs/phase7-wave2-scripting.md's own reading of
  // "resolving step one" as the step's own `placeThreat` event, established in `absorbing-man.ts`).
  "04096b.hunting-down-heroes-forced-response": forcedResponse(
    on.threatPlaced(query("mainScheme")),
    forEachPlayer(
      eachPlayer,
      ifThen(
        isHero(thatPlayer),
        chooseOne(option("Place 1 threat here", placeThreat(1, theMainScheme)), option("Take 1 damage", dealDamage(1, identityOf(thatPlayer)))),
      ),
    ),
  ),

  // Moon Knight — Response: after you play him, spend a [wild] resource → draw 2 cards.
  "04097.moon-knight-response": response(on.youPlayThis(), { cost: spend(1) }, draw(2)),
  // Shang-Chi — Response: after you play him, spend a [energy] resource → stun an enemy.
  "04098.shang-chi-response": response(on.youPlayThis(), { cost: spend({ energy: 1 }) }, chooseTarget("enemy", query("enemy")), stun(chosen("enemy"))),
  // White Tiger — Response: after you play her, spend a [mental] resource → remove 3 threat from a scheme.
  "04099.white-tiger-response": response(on.youPlayThis(), { cost: spend({ mental: 1 }) }, chooseTarget("scheme", query("scheme")), removeThreat(3, chosen("scheme"))),
  // Elektra — Response: after you play her, spend a [physical] resource → deal 3 damage to an enemy.
  "04100.elektra-response": response(on.youPlayThis(), { cost: spend({ physical: 1 }) }, chooseTarget("enemy", query("enemy")), dealDamage(3, chosen("enemy"))),

  // Hydra Hunter — [star] his attacks gain piercing and ranged. [star] Boost: if you are in hero form, take 1
  // damage. Otherwise place 1 threat on the main scheme.
  "04101.hydra-hunter-constant": constant(gainsKeyword({ name: "piercing" }, query("minion", { self: true })), gainsKeyword({ name: "ranged" }, query("minion", { self: true }))),
  "04101.boost": { trigger: { kind: "boost" }, effects: [ifThen(isHero(), dealDamage(1, identityOf(you)), placeThreat(1, theMainScheme))] },

  // Taskmaster's Sword — Attach to Taskmaster (data). [star] His attacks gain piercing. Hero Action: exhaust your
  // hero and spend [M][P] → discard.
  "04102.taskmasters-sword-constant": constant(gainsKeyword({ name: "piercing" }, query("enemy", { hostOfSelf: true }))),
  "04102.taskmasters-sword-action": heroAction({ cost: [exhaustYourHero, spend({ mental: 1, physical: 1 })] }, discard(self)),

  // Taskmaster's Shield — Attach to Taskmaster (data). Taskmaster gains retaliate 1. Hero Action as above.
  "04103.taskmasters-shield-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, query("enemy", { hostOfSelf: true }))),
  "04103.taskmasters-shield-action": heroAction({ cost: [exhaustYourHero, spend({ mental: 1, physical: 1 })] }, discard(self)),

  // Photographic Reflexes — Attach to Taskmaster. Forced Interrupt: when a player attacks Taskmaster, prevent all
  // damage that would be dealt to him and deal an equal amount to that player's identity instead, then discard.
  // (Reading: "prevent all damage that would be dealt" is the damage step — `when.damage`, interruptible — not the
  // attack's own initiation, which is announcement-only for the reason Mockingbird's interrupt is skipped in
  // `hawkeye-kit.ts`; here the printed text names the *damage* directly, so this card needs no such workaround.)
  "04104.photographic-reflexes-forced-interrupt": forcedInterrupt(
    when.damage("host", { fromAttack: true }),
    preventDamage(),
    dealDamage(eventAmount, identityOf(ownerOf(eventSource))),
    discard(self),
  ),

  // Mimicry — When Revealed (Alter-Ego): discard the top 5 cards of your deck; if a Thwart card was discarded,
  // Taskmaster schemes. When Revealed (Hero): same discard; if an Attack card was discarded, Taskmaster attacks you.
  "04105.when-revealed-alter-ego": whenRevealed(
    ifThen(isAlterEgo(), [
      selectCards("milled", zone("deck", you, { top: 5 })),
      moveCards(cards(chosen("milled")), "discard"),
      ifThen(valueAtLeast(countAmong(chosen("milled"), query("event", { trait: THWART })), 1), enemyScheme(theVillain)),
    ]),
  ),
  "04105.when-revealed-hero": whenRevealed(
    ifThen(isHero(), [
      selectCards("milled", zone("deck", you, { top: 5 })),
      moveCards(cards(chosen("milled")), "discard"),
      ifThen(valueAtLeast(countAmong(chosen("milled"), query("event", { trait: ATTACK })), 1), enemyAttack(theVillain, { against: you })),
    ]),
  ),

  // Hunted by Hydra — Incite 1 (data). When Revealed: each player in hero form takes 1 damage and discards 1
  // card at random from their hand.
  "04106.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, ifThen(isHero(thatPlayer), [dealDamage(1, identityOf(thatPlayer)), discardFromHand(1, thatPlayer, { random: true })])),
  ),

  // Captured by Hydra — When Revealed: place 1 random set-aside Captive ally facedown beneath this scheme.
  "04107.when-revealed": whenRevealed(
    selectCards("captive", { kind: "encounterSetAside", filter: query("ally", { trait: CAPTIVE }), random: amount(1) }),
    tuckCards(cards(chosen("captive")), self, true),
  ),
  // Captured by Hydra — When Defeated: the player who defeated it takes that ally into their hand and removes this
  // scheme from the game. Got its own ability ref in a later data pass (module docblock).
  "04107.when-defeated": whenDefeated(takeIntoHand(tuckedUnder(self), defeatingPlayer), moveCards(cards(self), "removedFromGame")),

  // Taskmaster's Training Camp — Forced Response: after a minion enters play, give it a tough status card.
  "04108.taskmasters-training-camp-forced-response": forcedResponse(on.entersPlay(query("minion")), giveTough(eventTarget)),
});
