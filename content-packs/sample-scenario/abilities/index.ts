/**
 * The Clockmaker scenario's abilities. Every script copies the shape of a base-game card whose script is known good
 * (the base card is named in each comment), so a creator can see a villain, a main scheme and an encounter set done
 * with existing DSL primitives only.
 *
 * Ability ids are `<card code>.<slug>`, the base game's convention with the pack's card code swapped in. A card that
 * names another card writes its exact printed name in the script (`searchAndReveal("Stopped Clocks")`).
 */
import {
  andThen,
  damagedAtLeast,
  dealDamage,
  definePackAbilities,
  discard,
  each,
  eventAmount,
  forcedInterrupt,
  heal,
  ifThen,
  instead,
  not,
  perHero,
  placeDamage,
  placeThreat,
  query,
  searchAndReveal,
  self,
  setup,
  surge,
  theMainScheme,
  theVillain,
  varAtLeast,
  when,
  whenRevealed,
} from "@mc/mod-sdk";

export default definePackAbilities({
  // The Clockmaker (II). Modeled on Rhino (II) (01095):
  // When Revealed: Search the encounter deck and discard pile for the Stopped Clocks side scheme and reveal it.
  // Shuffle the encounter deck.
  "x.sample-scenario.01.stage-two-when-revealed": whenRevealed(searchAndReveal("Stopped Clocks")),

  // Ticking Away 1A. Modeled on The Break-In! 1A (01097a): Setup: Advance to stage 1B. (The engine always continues
  // onto the B side.)
  "x.sample-scenario.02a.setup": setup(),

  // Pendulum Guard. Modeled on Shocker (01103): When Revealed: Deal 1 damage to each hero.
  "x.sample-scenario.04.when-revealed": whenRevealed(dealDamage(1, each(query("hero")))),

  // Stopped Clocks. Modeled on Breakin' & Takin' (01107): When Revealed: Place an additional 1 [per_hero] threat here.
  "x.sample-scenario.05.when-revealed": whenRevealed(placeThreat(perHero(1), self)),

  // Overwind. Modeled on Hard to Keep Down (01104): When Revealed: The villain heals 4 damage. If no damage was healed
  // this way, this card gains surge.
  "x.sample-scenario.06.when-revealed": whenRevealed(
    heal(4, theVillain, { bind: "healed" }),
    ifThen(not(varAtLeast("healed.amount")), surge()),
  ),

  // Escapement Plating. Modeled on Armored Rhino Suit (01098): Forced Interrupt: When any amount of damage would be
  // dealt to the villain, place it here instead. Then, if there is at least 4 damage here, discard this card.
  "x.sample-scenario.07.escapement-plating-forced-interrupt": forcedInterrupt(
    when.damage(query("villain")),
    { wouldBeDealt: true },
    instead(placeDamage(eventAmount, self), andThen(ifThen(damagedAtLeast(self, 4), discard(self)))),
  ),

  // Jammed Gears. Modeled on Bomb Scare (01109): When Revealed: Place an additional 1 [per_hero] threat here.
  // (The acceleration icon is the card's own: the engine adds +1 threat on the main scheme.)
  "x.sample-scenario.08.when-revealed": whenRevealed(placeThreat(perHero(1), self)),

  // Gear Crawler. Modeled on Hydra Bomber (01110)'s second option: Place 1 threat on the main scheme.
  "x.sample-scenario.09.when-revealed": whenRevealed(placeThreat(1, theMainScheme)),
});
