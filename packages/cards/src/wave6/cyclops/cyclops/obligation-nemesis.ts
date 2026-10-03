import {
  alterEgoAction,
  anyOfCards,
  atEndOfAttack,
  boost,
  cards,
  chooseCards,
  chosen,
  constant,
  defineAbilities,
  discard,
  each,
  enemyScheme,
  enemyAttack,
  exhaustYourHero,
  exists,
  forcedInterrupt,
  ifThen,
  isAttached,
  isStunned,
  modifyAttack,
  moveCards,
  not,
  placeThreat,
  query,
  rule,
  searchAndReveal,
  self,
  stun,
  surge,
  takeDamage,
  theMainScheme,
  tuckCards,
  tuckedUnder,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";

const MISTER_SINISTER = query("minion", { name: "Mister Sinister" });

/**
 * Lost Visor (33027), Cyclops's obligation, and his Mister Sinister nemesis set: Mister Sinister (33028, nemesis
 * minion), Genetic Manipulation (33029, side scheme), Gene Therapy x2 (33030, attachment) and Concussive Force (33031,
 * treachery).
 *
 * - **Lost Visor** is not the shared `obligation()` shape: it stays in play with the visor tucked under it, a constant
 *   plus an alter-ego action (the two refs Valkyrie's Trouble in Otherworld has) and an unheaded When Revealed, the
 *   printed search, which the card data carries as `33027.lost-visor-when-revealed` (a curated
 *   `unheadedWhenRevealed` correction). It searches the hand, deck, discard pile and play area (the card prints hand
 *   too) for Ruby Quartz Visor and tucks it facedown under Lost Visor; the action returns whatever is tucked under the
 *   card to the hand.
 * - **Gene Therapy** is Unstoppable's shape (`../../mut_gen/colossus/obligation-nemesis.ts`): the host is `attachesTo`
 *   data (lowest printed ATK, no copy), "otherwise gains surge" and the forced interrupt are scripted.
 * - **Mister Sinister** / **Concussive Force**: his boost is Slammed's (stun, or 2 damage if already stunned).
 */
export const CYCLOPS_OBLIGATION_NEMESIS = defineAbilities({
  // Lost Visor — Search your hand, deck, discard pile, and play area for Ruby Quartz Visor and place it facedown under
  // this card. (Play area: the visor is an upgrade attached to the hero; tucking takes it out of play.)
  "33027.lost-visor-when-revealed": whenRevealed(
    chooseCards(
      "visor",
      anyOfCards(
        zone(["deck", "hand", "discard"], you, { filter: { name: "Ruby Quartz Visor" } }),
        cards(each(query("upgrade", { controller: "you", name: "Ruby Quartz Visor" }))),
      ),
      { min: 1, max: 1 },
    ),
    tuckCards(cards(chosen("visor")), self, true),
  ),
  // Lost Visor — Cyclops cannot attack. "Cyclops" is the obligation's controller's identity (hero form only matters:
  // an alter-ego cannot attack anyway), the same reading Valkyrie's obligation uses.
  "33027.lost-visor-constant": constant(
    rule({ kind: "cannotAttack", target: query("enemy"), attacker: query("identity", { controller: "you" }) }),
  ),
  // Lost Visor — Alter-Ego Action: Exhaust Scott Summers -> add Ruby Quartz Visor to your hand and remove Lost Visor
  // from the game.
  "33027.lost-visor-action": alterEgoAction(
    { cost: exhaustYourHero },
    moveCards(tuckedUnder(self), "hand"),
    moveCards(cards(self), "removedFromGame"),
  ),

  // Mister Sinister — Stalwart, Toughness, Villainous (data). [star] Boost: You are stunned. If you are already
  // stunned, take 2 damage.
  "33028.boost": boost(ifThen(isStunned(yourIdentity), takeDamage(2), stun(yourIdentity))),

  // Genetic Manipulation — When Defeated: Search the encounter deck and discard pile for Gene Therapy and reveal it.
  // (Shuffle.)
  "33029.when-defeated": whenDefeated(...searchAndReveal("Gene Therapy")),

  // Gene Therapy — if no enemy can host it (schema-level `attachesTo`), this card gains surge.
  "33030.gene-therapy-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // [star] Forced Interrupt: When attached enemy attacks, the attack gains overkill and piercing. At the end of this
  // attack, discard Gene Therapy.
  "33030.gene-therapy-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("host"),
    modifyAttack({ overkill: true, keywords: ["piercing"] }),
    atEndOfAttack(discard(self)),
  ),

  // Concussive Force — When Revealed (Alter-Ego): If Mister Sinister is in play, he schemes. Otherwise, place 2 threat
  // on the main scheme.
  "33031.when-revealed-alter-ego": whenRevealedAlterEgo(
    ifThen(
      exists(MISTER_SINISTER),
      enemyScheme(each(MISTER_SINISTER), { against: you }),
      placeThreat(2, theMainScheme),
    ),
  ),
  // When Revealed (Hero): If Mister Sinister is in play, he attacks you. Otherwise, take 2 damage.
  "33031.when-revealed-hero": whenRevealedHero(
    ifThen(exists(MISTER_SINISTER), enemyAttack(each(MISTER_SINISTER), { against: you }), takeDamage(2)),
  ),
});
