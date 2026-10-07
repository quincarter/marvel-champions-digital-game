import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  YOUR_HERO,
  YOUR_IDENTITY,
  after,
  canEnterPlay,
  chooseCards,
  constant,
  defineAbilities,
  each,
  encounterSetAside,
  exists,
  exhaustThis,
  forEachPlayer,
  gets,
  heal,
  heroResponse,
  ifThen,
  not,
  on,
  eachPlayer,
  perHero,
  putIntoPlay,
  query,
  removeThreat,
  response,
  theMainScheme,
  thatPlayer,
  whenDefeated,
  defeatingPlayer,
  draw,
} from "../../dsl/index.js";

const SPECIALIZATION = trait("SPECIALIZATION");
const SPECIALIST = query("upgrade", { trait: SPECIALIZATION });
/** "Your hero performs a basic attack / thwart / defense": `basicPowerUsed` narrowed to the power, as Improved Recovery does. */
const heroUses = (power: "attack" | "thwart" | "defense") => ({
  ...on.basicPowerUsed(YOUR_HERO),
  eventIs: { power },
});

/**
 * The x23 pack's player side schemes (43018, 43021, 43039), the four linked Specialists (43034-43037) and the basic
 * resource reprints (43022-43024), docs/phase7-wave7.md §3.75.
 *
 * - **Keep Them Busy (43018)**: Victory 0 and Assault are data; the When Defeated is "the player who defeated this
 *   scheme" (`defeatingPlayer`) removing 5 per hero threat from the main scheme.
 * - **Specialized Training (43021)**: each player in player order who controls no SPECIALIZATION upgrade chooses one
 *   set-aside SPECIALIZATION upgrade (the Specialists, set aside ownerless at setup, RRG "Linked (Card Title)", p. 27)
 *   and puts it into play under their control. A unique Specialist that matches one already in play cannot be put
 *   into play (RRG 1.8 "Unique Icon", pp. 45–46), so it is not among the choices (`canEnterPlay`).
 * - **Rally the Troops (43039)**: heal 2 from each ally, every player's.
 * - **The Specialists**: "Your hero gets +1 X" is a constant on your hero (hero form only); the Hero Response is
 *   "After your hero performs a basic X". Front Line Specialist is erratad (RRG 1.8 p. 69): "Your identity gets +4
 *   hit points", and its Response (not a Hero Response) follows damage to the identity from an enemy attack.
 * - **Energy, Genius, Strength (43022-43024)**: print "Max 1 per deck." only (data), no ability refs.
 */
export const X23_PACK_CARDS: AbilityRegistry = defineAbilities({
  "43018.when-defeated": whenDefeated(removeThreat(perHero(5), theMainScheme, { by: defeatingPlayer })),

  "43021.when-defeated": whenDefeated(
    forEachPlayer(eachPlayer, [
      ifThen(not(exists(query("upgrade", { trait: SPECIALIZATION, controlledBy: thatPlayer }))), [
        chooseCards("taken", encounterSetAside({ ...SPECIALIST, ...canEnterPlay(thatPlayer) }), {
          min: 1,
          max: 1,
          chooser: thatPlayer,
        }),
        putIntoPlay({ kind: "slot", slot: "taken" }, thatPlayer),
      ]),
    ]),
  ),

  "43039.when-defeated": whenDefeated(heal(2, each(query("ally")))),

  "43034.combat-specialist-constant": constant(gets("atk", 1, YOUR_HERO)),
  "43034.combat-specialist-response": heroResponse(heroUses("attack"), { cost: exhaustThis }, draw(1)),
  "43035.defense-specialist-constant": constant(gets("def", 1, YOUR_HERO)),
  "43035.defense-specialist-response": heroResponse(heroUses("defense"), { cost: exhaustThis }, draw(1)),
  "43036.front-line-specialist-constant": constant(gets("hp", 4, YOUR_IDENTITY)),
  "43036.front-line-specialist-response": response(
    after.damage(YOUR_IDENTITY, { fromAttack: true, taken: true }),
    { cost: exhaustThis },
    draw(1),
  ),
  "43037.surveillance-specialist-constant": constant(gets("thw", 1, YOUR_HERO)),
  "43037.surveillance-specialist-response": heroResponse(heroUses("thwart"), { cost: exhaustThis }, draw(1)),
});
