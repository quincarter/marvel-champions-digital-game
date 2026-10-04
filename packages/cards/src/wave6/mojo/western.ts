import { trait } from "@mc/content";
import {
  after,
  attacksGainKeywords,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  dealIndirectDamage,
  defineAbilities,
  discard,
  draw,
  each,
  eachPlayer,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gets,
  identityOf,
  ifThen,
  isAttached,
  moveCards,
  not,
  on,
  perHero,
  query,
  resourceTypesOf,
  cards,
  increaseDamage,
  selectCards,
  self,
  spendResources,
  statOf,
  surge,
  thatPlayer,
  varAtLeast,
  when,
  whenRevealed,
  revealedFromEncounterDeck,
  you,
  zone,
} from "../../dsl/index.js";

const SETTING = trait("SETTING");

/**
 * MojoMania (`mojo`), the Western genre set (`western` 39066-39070, docs/phase7-wave6.md §7.4): Wild Wild Mojo (the
 * SHOW environment), Dead or Alive, Card Shark, Gunslinger (x2) and A Game of Cards.
 *
 * **Wild Wild Mojo**: "Each enemy attack gains overkill" grants the keyword to the attack, not to the enemy making it
 * (`attacksGainKeywords`, RRG 1.8 "Overkill", p. 31: "an attack with the overkill keyword"). "When a character
 * takes damage, increase that damage by 1" is a forced interrupt to any damage event: the overkill spill is a damage
 * event of its own, so it gets its own +1 (RRG 1.8 FAQ "Wild Wild Mojo (#66)", p. 64). An ally's consequential damage
 * is a damage event too; a consequential 0 stays 0 (insert p. 18; `applyDamage` ignores an amount of 0). The surge is
 * only for a reveal that began at the encounter deck (§3.64, insert p. 18: not from the show deck, not by the Wheel
 * of Genres).
 *
 * **Dead or Alive** attaches at the schema level (`attachesTo`, resolved by the reveal before this card's When
 * Revealed); only "if you cannot, this card gains surge" is scripted, as Razor Claws does (`27059`).
 *
 * **Card Shark** and **A Game of Cards** count printed resource types with `resourceTypesOf` (wild is a type of its own).
 */
export const WESTERN_ABILITIES = defineAbilities({
  // Wild Wild Mojo (39066) — Each enemy attack gains overkill.
  "39066.wild-wild-mojo-constant": constant(attacksGainKeywords(["overkill"], { attacker: query("enemy") })),
  // Wild Wild Mojo — Forced Interrupt: When a character takes damage, increase that damage by 1.
  "39066.wild-wild-mojo-forced-interrupt": forcedInterrupt(on.damage(query("character")), increaseDamage(1)),
  // Wild Wild Mojo — When Revealed: Discard each other Setting environment in play. If this card was revealed from the
  // encounter deck, it gains surge.
  "39066.when-revealed": whenRevealed(
    discard(each(query("environment", { trait: SETTING, excluding: self }))),
    ifThen(revealedFromEncounterDeck, surge()),
  ),

  // Dead or Alive (39067) — Attach to the minion with the highest printed hit points. If you cannot, this card gains
  // surge.
  "39067.dead-or-alive-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // Dead or Alive — Attached minion gets +3[per_hero] hit points.
  "39067.dead-or-alive-constant-2": constant(gets("hp", perHero(3), query("minion", { hostOfSelf: true }))),
  // Dead or Alive — Forced Interrupt: When attached minion is defeated, each player adds 1 card from their discard
  // pile to their hand.
  "39067.dead-or-alive-forced-interrupt": forcedInterrupt(
    when.defeated("host"),
    forEachPlayer(
      eachPlayer,
      chooseCards("recovered", zone("discard", thatPlayer), { min: 1, max: 1, chooser: thatPlayer }),
      moveCards(cards(chosen("recovered")), "hand"),
    ),
  ),

  // Card Shark (39068) — [star] Forced Response: After Card Shark attacks you, discard the top 3 cards of your deck.
  // Take indirect damage equal to the number of different printed resource types discarded this way.
  "39068.card-shark-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    selectCards("milled", zone("deck", you, { top: 3 })),
    moveCards(cards(chosen("milled")), "discard"),
    dealIndirectDamage(you, resourceTypesOf(chosen("milled"))),
  ),

  // Gunslinger (39069) — Quickstrike (data). Forced Interrupt: When this minion engages you (before resolving
  // quickstrike), you may spend [energy][energy] resources. If you do, deal damage to this minion equal to your hero's
  // ATK.
  "39069.gunslinger-forced-interrupt": forcedInterrupt(
    { on: "minionEngaged", selfIs: "source" },
    spendResources({ energy: 2 }, "spent"),
    ifThen(varAtLeast("spent.made"), dealDamage(statOf(identityOf(you), "atk"), self)),
  ),

  // A Game of Cards (39070) — When Revealed: Draw 5 cards. Choose and discard 5 cards from your hand. For each
  // different printed resource type discarded this way, discard an upgrade or support you control.
  "39070.when-revealed": whenRevealed(
    draw(5),
    chooseCards("discarded", zone("hand", you), { min: 5, max: 5 }),
    moveCards(cards(chosen("discarded")), "discard"),
    chooseTarget("lost", query(["upgrade", "support"], { controller: "you" }), {
      count: resourceTypesOf(chosen("discarded")),
    }),
    discard(chosen("lost")),
  ),
});
