import {
  assignDamage,
  chooseOne,
  confuse,
  defineAbilities,
  hasStatus,
  ifThen,
  inPlay,
  named,
  option,
  perHero,
  placeThreat,
  query,
  self,
  surge,
  takeDamage,
  theMainScheme,
  threatOn,
  whenRevealed,
  yourIdentity,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

const BOMB_SCARE = cardName("01109");

/** The Bomb Scare modular set (01109–01112). */
export const BOMB_SCARE_SET = defineAbilities({
  // Bomb Scare — When Revealed: Place an additional 1 [per_hero] threat here. (Acceleration icon: the engine adds +1 threat in step one.)
  "01109.when-revealed": whenRevealed(placeThreat(perHero(1), self)),
  // Hydra Bomber — When Revealed: Choose to either take 2 damage or place 1 threat on the main scheme.
  "01110.when-revealed": whenRevealed(
    chooseOne(
      option("Take 2 damage", takeDamage(2)),
      option("Place 1 threat on the main scheme", placeThreat(1, theMainScheme)),
    ),
  ),
  // Explosion — When Revealed: If Bomb Scare is in play, assign X damage among heroes and allies, where X is the amount
  // of threat on Bomb Scare. If Bomb Scare is not in play, this card gains surge.
  // "Heroes" are hero-form identities (an alter-ego can't be assigned this damage).
  "01111.when-revealed": whenRevealed(
    ifThen(inPlay(BOMB_SCARE), assignDamage(threatOn(named(BOMB_SCARE)), query(["hero", "ally"])), surge()),
  ),
  // False Alarm — When Revealed: You are confused. If you are already confused, this card gains surge.
  "01112.when-revealed": whenRevealed(ifThen(hasStatus(yourIdentity, "confused"), surge(), confuse(yourIdentity))),
});
