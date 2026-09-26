import {
  after,
  allOf,
  atEndOfAttack,
  boost,
  chooseCards,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  discardAtRandom,
  discardEncounterUntil,
  each,
  encounterCards,
  enemyAttack,
  eventDealt,
  eventTarget,
  exhaust,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gets,
  giveTough,
  heal,
  heroAction,
  ifThen,
  made,
  modifyAttack,
  not,
  otherPlayers,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  refMatches,
  rule,
  searchAndReveal,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  spendResources,
  stun,
  surge,
  takeDamage,
  theMainScheme,
  theVillain,
  TRAIT,
  varAtLeast,
  when,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

/** "[star] Forced Interrupt: When Klaw attacks, give him 1 additional boost card for this activation." (every stage) */
const KLAW_EXTRA_BOOST = forcedInterrupt(when.enemyAttacks("self"), modifyAttack({ extraBoostCards: 1 }));
/** "Hero Action: Spend [energy][mental][physical] resources → discard this card." */
const SPEND_EMP_TO_DISCARD = heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self));
/** "Discard cards from the encounter deck until a minion is discarded. Put that minion into play engaged with the first player." */
const MINION_FOR_FIRST_PLAYER = [
  discardEncounterUntil(query("minion"), "minion"),
  putIntoPlay(chosen("minion"), firstPlayer),
];

/** The Klaw scenario: Klaw (01113–01115), Underground Distribution / Secret Rendezvous (01116–01117), and the Klaw set (01118–01127). */
export const KLAW = defineAbilities({
  "01113.klaw-forced-interrupt": KLAW_EXTRA_BOOST,
  "01114.klaw-forced-interrupt": KLAW_EXTRA_BOOST,
  "01115.klaw-forced-interrupt": KLAW_EXTRA_BOOST,
  // Klaw (II) — When Revealed: Search the encounter deck and discard pile for The "Immortal" Klaw and reveal it. Shuffle the encounter deck.
  "01114.when-revealed": whenRevealed(searchAndReveal(cardName("01127"))),
  // Underground Distribution 1A — Setup: Search the encounter deck for the Defense Network side scheme and reveal it.
  // Shuffle the encounter deck. Advance to stage 1B (implicit).
  "01116a.setup": setup(searchAndReveal(cardName("01125"), ["deck"])),
  // 1B — When Revealed: Discard cards from the encounter deck until a minion is discarded. Put that minion into play engaged with the first player.
  "01116b.when-revealed": whenRevealed(MINION_FOR_FIRST_PLAYER),
  // Secret Rendezvous 2A — When Revealed: (the same). Advance to stage 2B (implicit).
  "01117a.when-revealed": whenRevealed(MINION_FOR_FIRST_PLAYER),

  // Sonic Converter — [star] Forced Response: After Klaw attacks and damages a character, stun that character.
  "01118.sonic-converter-forced-response": forcedResponse(
    after.villainAttacks({ damages: true }),
    ifThen(refMatches(eventTarget, query("character")), stun(eventTarget)),
  ),
  "01118.sonic-converter-action": SPEND_EMP_TO_DISCARD,
  // Solid-Sound Body — Klaw gains retaliate 1.
  "01119.solid-sound-body-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, { hostOfSelf: true })),
  "01119.solid-sound-body-action": SPEND_EMP_TO_DISCARD,
  // Weapons Runner — [star] Boost: Put Weapons Runner into play engaged with you.
  "01121.boost": boost(putIntoPlay(self, you)),
  // Klaw's Vengeance — When Revealed (Alter-Ego): Discard 1 card at random from your hand.
  "01122.when-revealed-alter-ego": whenRevealedAlterEgo(discardAtRandom(1)),
  // When Revealed (Hero): Klaw attacks you. If this attack deals damage, place 1 threat on the main scheme.
  "01122.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, bind: "vengeance" }),
    ifThen(varAtLeast("vengeance.damage"), placeThreat(1, theMainScheme)),
  ),
  // Sonic Boom — When Revealed: Either spend [energy][mental][physical] resources or exhaust each character you control.
  "01123.when-revealed": whenRevealed(
    spendResources({ energy: 1, mental: 1, physical: 1 }, "boom"),
    ifThen(not(made("boom")), exhaust(each(query("character", { controller: "you" })))),
  ),
  // [star] Boost: If this activation deals damage to you, exhaust your hero.
  "01123.boost": boost(
    atEndOfAttack(ifThen(allOf(eventDealt("damage"), refMatches(eventTarget, YOUR_IDENTITY)), exhaust(yourIdentity))),
  ),
  // Sound Manipulation — When Revealed (Alter-Ego): Klaw heals 4 damage. If no damage was healed this way, this card gains surge.
  "01124.when-revealed-alter-ego": whenRevealedAlterEgo(
    heal(4, theVillain, { bind: "healed" }),
    ifThen(not(varAtLeast("healed.amount")), surge()),
  ),
  // When Revealed (Hero): Take 2 damage. Klaw heals 2 damage.
  "01124.when-revealed-hero": whenRevealedHero(takeDamage(2), heal(2, theVillain)),
  // Defense Network / Illegal Arms Factory — When Revealed: Place an additional 1 [per_hero] threat here.
  "01125.when-revealed": whenRevealed(placeThreat(perHero(1), self)),
  "01126.when-revealed": whenRevealed(placeThreat(perHero(1), self)),
  // The "Immortal" Klaw — Klaw gets +10 hit points (lost when this scheme leaves play).
  "01127.the-immortal-klaw-constant": constant(gets("hp", 10, query("villain"))),
});

const MASTERS_OF_EVIL_MINION = query("minion", { trait: TRAIT.MASTERS_OF_EVIL });

/** The Masters of Evil modular set (01128–01133). */
export const MASTERS_OF_EVIL_SET = defineAbilities({
  // The Masters of Evil — When Revealed: Discard cards from the encounter deck until a Masters of Evil minion is discarded.
  // Put that minion into play engaged with the first player.
  "01128.when-revealed": whenRevealed(
    discardEncounterUntil(MASTERS_OF_EVIL_MINION, "minion"),
    putIntoPlay(chosen("minion"), firstPlayer),
  ),
  // Radioactive Man — [star] Forced Response: After Radioactive Man attacks you, discard 1 card at random from your hand.
  "01129.radioactive-man-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    discardAtRandom(1),
  ),
  // [star] Boost: Discard 1 card at random from your hand.
  "01129.boost": boost(discardAtRandom(1)),
  // Whirlwind — [star] Forced Interrupt: When Whirlwind attacks you, also resolve his attack against each other hero.
  "01130.whirlwind-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("self", { againstYou: true }),
    atEndOfAttack(enemyAttack(self, { against: otherPlayers(you), additionalResolution: true })),
  ),
  // [star] Boost: Deal 1 damage to each hero.
  "01130.boost": boost(dealDamage(1, each(query("hero")))),
  // Tiger Shark — [star] Forced Response: After Tiger Shark attacks, give him a tough status card.
  "01131.tiger-shark-forced-response": forcedResponse(after.enemyAttacks("self"), giveTough(self)),
  // [star] Boost: Give the villain a tough status card.
  "01131.boost": boost(giveTough(theVillain)),
  // Melter — [star] The engaged player must defend against Melter's attacks with an ally they control, if able.
  "01132.melter-constant": constant(rule({ kind: "mustDefendWithAlly", attacker: { self: true } })),
  // [star] Boost: Exhaust each ally you control.
  "01132.boost": boost(exhaust(each(query("ally", { controller: "you" })))),
  // Masters of Mayhem — When Revealed: Each Masters of Evil minion attacks the hero it is engaged with. If no attacks were made
  // this way, search the encounter deck and discard pile for a Masters of Evil minion and put it into play engaged with you,
  // then shuffle the encounter deck. The first player orders the attacks and picks among eligible minions (RRG "First Player").
  // The shuffle is not `andThen`: a searched deck is shuffled on completion whether or not the search found a minion
  // (RRG 1.8 "Search", p. 39), so the printed "then shuffle" happens either way (`core/modular/hydra-and-doomsday.ts`).
  "01133.when-revealed": whenRevealed(
    enemyAttack(each(MASTERS_OF_EVIL_MINION), { bind: "mayhem" }),
    ifThen(not(made("mayhem")), [
      chooseCards("minion", encounterCards(["deck", "discard"], MASTERS_OF_EVIL_MINION), {
        min: 1,
        max: 1,
        chooser: firstPlayer,
      }),
      putIntoPlay(chosen("minion"), you),
      shuffleEncounterDeck(),
    ]),
  ),
});
