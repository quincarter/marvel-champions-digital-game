import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  YOUR_HERO,
  alterEgoAction,
  aScheme,
  allOf,
  anEnemy,
  boostAreaIconsOn,
  changeForm,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  countersOn,
  dealDamage,
  defineAbilities,
  discardThis,
  discardTopOfEncounterDeckCost,
  doesNotExhaustToDefend,
  eventTarget,
  exhaustThis,
  exhaustYourHero,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  instead,
  ifThen,
  interrupt,
  modifyBasicPower,
  not,
  on,
  after,
  applyRuleUntil,
  oncePerPaidCard,
  option,
  query,
  reduceNextCardCost,
  refMatches,
  removeCounter,
  removeCountersFrom,
  removeThreat,
  repeatTimes,
  resource,
  ready,
  self,
  statOf,
  stun,
  sum,
  topOfEncounterDeckShowsNoIcons,
  preventDamage,
  returnToHandCost,
  valueAtLeast,
  varOf,
  yourIdentity,
  you,
} from "../../../dsl/index.js";

const AERIAL = trait("AERIAL");

/** Redwing's and Battlefield Awareness's X: "the number of icons (star and boost) in the discarded card's boost area". */
const TOP_ICONS = sum(varOf("top.boostIcons"), varOf("top.starIcons"));
/** Talon Line's count: the same icons, on the card Eagle-Eyed discarded, read where it is now. */
const EAGLE_ICONS = boostAreaIconsOn(chosen("moment.discarded"));

/**
 * Wave 9 scripting module `falcon/falcon/support-upgrades-allies` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 *
 * **53002.redwing-action** (Hero Action): "Exhaust Redwing, return him to your hand, and discard the top card of the
 * encounter deck -> choose to either deal X damage to an enemy or remove X threat from a scheme. X is the number of
 * icons (star and boost) in the discarded card's boost area." All three costs are paid together before the choice; the
 * top card is bound as `top`, X is `boostIcons + starIcons` (amplify adds nothing). RRG 1.8 FAQ "Redwing (#2)", p. 65,
 * and ruling January 26, 2026 - Ruling 6 (1): while the top card is faceup and prints no icon the ability cannot be
 * initiated (`while: not(topOfEncounterDeckShowsNoIcons)`); a facedown top card cannot be seen, so the ability is
 * offered and resolves for whatever the card prints, 0 included (ruling March 19, 2026 - Ruling 5). The damage and the
 * threat removal are not an attack or a thwart.
 * DEVIATION: the engine refuses one card paying two parts of a cost (exhausted and also returned), so the exhaust is
 * scripted as the condition that Redwing is ready (`while`), and only the return and the discard are the cost. The
 * outcome is the same: he must be ready, and a card back in hand is no longer exhausted. See the report.
 *
 * **53006.falcons-flock-resource** (Resource): "Remove 1 bird counter from here -> generate a [energy] resource for an
 * Aerial card. (Limit once per card.)" Uses (5 bird counters) and the discard on the last counter are the keyword's.
 * `oncePerPaidCard`: one use for each card being paid for (owner question 36, built as A: each payment counts on its
 * own); `repeatable` lets the other uses on one payment come from other copies' counters, one per card.
 *
 * **53007.soup-kitchen-action** (Alter-Ego Action): "Exhaust Sam Wilson and Soup Kitchen -> heal damage from Sam
 * Wilson equal to his REC and reduce the cost of the next ally or support played this phase by 2." Both exhausts are
 * the cost; the healing is Sam Wilson's REC as it stands.
 *
 * **53008.aerial-evacuation-interrupt** (Hero Interrupt): "When another friendly character would be dealt any amount
 * of damage, discard Aerial Evacuation -> prevent all of that damage and change to alter-ego form. If that character
 * is a hero, they also change to alter-ego form." "Another" is a character other than Falcon's identity. Rulings
 * December 17, 2025 - Ruling 1 (2), March 6, 2026 - Ruling 1 and July 9, 2026 - Ruling 2: it prevents damage taken;
 * the damage is still considered dealt. The change is an effect, so it does not use the voluntary form change of the
 * round (rules insert); either change is skipped for a player who cannot change form.
 *
 * **53009.aerial-recon-interrupt** (Interrupt): "When a player would be dealt an encounter card, remove 1 recon counter
 * from here instead." Works in either form (not a Hero Interrupt); not offered at 0 counters; the card replaced stays on
 * the deck and nothing is dealt.
 *
 * **53010.battlefield-awareness-interrupt** (Hero Interrupt): "When Falcon uses a basic power, exhaust Battlefield
 * Awareness and discard the top card of the encounter deck -> Falcon gets +1 to that power for this use for each icon
 * (star and boost) in the discarded card's boost area." Same refusal as Redwing for a faceup top card with no icon.
 *
 * **53011.draw-their-fire-response** (Hero Response): "After the villain phase begins, discard Draw Their Fire ->
 * Falcon does not exhaust to defend until the end of the phase." The printed text names Falcon, read as your hero.
 *
 * **53012.talon-line-response** (Hero Response): "After you resolve Falcon's 'Eagle-Eyed' ability, discard Talon Line
 * -> for each icon in the discarded card's boost area, choose 1: ready a character you control, or stun an enemy." The
 * card is Eagle-Eyed's `discarded` slot read where it is now (owner question 35 = A: a card Serpent Solutions dealt
 * away is no longer counted by Eagle-Eyed itself, but Talon Line still reads its printed icons). Not offered when the
 * card shows 0 icons (the FAQ reasoning of Redwing; flagged in the spec, 4.2).
 *
 * **53013.vibranium-microweave-constant / -interrupt**: "Falcon gets +1 DEF." and "Hero Interrupt: When Falcon would
 * take any amount of damage, exhaust Vibranium Microweave -> prevent 1 of that damage and deal 1 damage to an enemy."
 *
 * Cards (9):
 * - 53002 Redwing (ally)
 * - 53006 Falcon's Flock (support)
 * - 53007 Soup Kitchen (support)
 * - 53008 Aerial Evacuation (upgrade)
 * - 53009 Aerial Recon (upgrade)
 * - 53010 Battlefield Awareness (upgrade)
 * - 53011 Draw Their Fire (upgrade)
 * - 53012 Talon Line (upgrade)
 * - 53013 Vibranium Microweave (upgrade)
 */
export const FALCON_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "53002.redwing-action": heroAction(
    {
      // ENGINE GAP (reported): the printed cost "Exhaust Redwing, return him to your hand" cannot be paid as written, the
      // engine refuses one card paying two parts of a cost (actions.ts, "one card cannot pay two parts of a cost"). The
      // exhaust is stood in for by requiring him ready; returning him to hand then clears the exhausted state anyway.
      while: allOf(not(topOfEncounterDeckShowsNoIcons), refMatches(self, query("ally", { exhausted: false }))),
      cost: [returnToHandCost(query("ally", { self: true })), discardTopOfEncounterDeckCost("top")],
    },
    chooseOne(
      option("Deal X damage to an enemy", anEnemy(), dealDamage(TOP_ICONS, chosen("enemy"))),
      option("Remove X threat from a scheme", aScheme(), removeThreat(TOP_ICONS, chosen("scheme"))),
    ),
  ),

  "53006.falcons-flock-resource": resource(
    { energy: 1 },
    {
      cost: removeCounter("bird"),
      generatesFor: query([], { trait: AERIAL }),
      repeatable: true,
      limit: oncePerPaidCard,
    },
  ),

  "53007.soup-kitchen-action": alterEgoAction(
    { cost: [exhaustYourHero, exhaustThis] },
    heal(statOf(yourIdentity, "rec"), yourIdentity),
    reduceNextCardCost(you, 2, "phase", query(["ally", "support"])),
  ),

  "53008.aerial-evacuation-interrupt": heroInterrupt(
    on.damage(query(["identity", "ally"], { excluding: yourIdentity })),
    { cost: discardThis },
    preventDamage(),
    changeForm(you, "alterEgo"),
    ifThen(refMatches(eventTarget, query("hero")), changeForm(controllerOf(eventTarget), "alterEgo")),
  ),

  "53009.aerial-recon-interrupt": interrupt(
    on.aPlayerWouldBeDealtAnEncounterCard(),
    { would: true, while: valueAtLeast(countersOn(self, "recon"), 1) },
    instead(removeCountersFrom(self, "recon", 1)),
  ),

  "53010.battlefield-awareness-interrupt": heroInterrupt(
    on.basicPowerUsing(YOUR_HERO),
    {
      while: not(topOfEncounterDeckShowsNoIcons),
      cost: [exhaustThis, discardTopOfEncounterDeckCost("top")],
    },
    modifyBasicPower(TOP_ICONS),
  ),

  "53011.draw-their-fire-response": heroResponse(
    after.phaseBeginning("villain"),
    { cost: discardThis },
    applyRuleUntil(doesNotExhaustToDefend(YOUR_HERO), "endOfPhase"),
  ),

  "53012.talon-line-response": heroResponse(
    on.youResolveAbility("53001a.eagle-eyed"),
    { cost: discardThis, while: valueAtLeast(EAGLE_ICONS, 1) },
    repeatTimes(
      EAGLE_ICONS,
      chooseOne(
        option(
          "Ready a character you control",
          chooseTarget("readied", query(["identity", "ally"], { controller: "you" })),
          ready(chosen("readied")),
        ),
        option("Stun an enemy", anEnemy(), stun(chosen("enemy"))),
      ),
    ),
  ),

  "53013.vibranium-microweave-constant": constant(gets("def", 1, YOUR_HERO)),
  "53013.vibranium-microweave-interrupt": heroInterrupt(
    on.damage(YOUR_HERO),
    { cost: exhaustThis },
    preventDamage(1),
    anEnemy(),
    dealDamage(1, chosen("enemy")),
  ),
});

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason.
 */
export const FALCON_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {
  "53009.aerial-recon-action":
    "Hero Action: Exhaust Aerial Recon and deal a player 1 facedown encounter card -> place 1 recon counter here. The only " +
    "cost the DSL has for a deal is dealEncounterCardsCost(n) (AbilityCost.dealEncounterCards), which deals the paying " +
    "player (engine actions.ts: dealEncounterCardTo(ctx, playerId, 'ability')); the card says a player of the payer's " +
    "choice. Needs an engine cost that deals a chosen player, and the 3.45 interrupt would then have to hear a deal made " +
    "as a cost (trigger-events.ts says a cost deal is not announced).",
};
