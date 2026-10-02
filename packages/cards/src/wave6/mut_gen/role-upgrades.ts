import { trait } from "@mc/content";
import {
  anEnemy,
  attackAnEnemy,
  cards,
  chooseTarget,
  chosen,
  confuse,
  defineAbilities,
  divide,
  draw,
  each,
  giveTough,
  heal,
  heroAction,
  heroInterrupt,
  heroResource,
  heroResponse,
  modifyBasicPower,
  moveCards,
  on,
  query,
  ready,
  removeFromCampaign,
  self,
  spend,
  stun,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../dsl/index.js";

const ATTACK = trait("ATTACK");
const DEFENSE = trait("DEFENSE");
const TACTIC = trait("TACTIC");
const THWART = trait("THWART");

/** "Remove this card from the game and the campaign pool." (RRG 1.8 p. 29: the removal outlasts a lost game.) */
const REMOVE_THIS_CARD = [removeFromCampaign(cards(self)), moveCards(cards(self), "removedFromGame")] as const;

/** "When you make a basic defense": your identity uses its DEF, before the value is read (RRG 1.8 "Basic Power", p. 10). */
const MAKE_A_BASIC_DEFENSE = on.basicPowerUsing(YOUR_IDENTITY, { power: "defense" });
/** "Generate [wild][wild] resources for a <trait> or <trait> event". */
const wildPairFor = (first: ReturnType<typeof trait>, second: ReturnType<typeof trait>) =>
  [{ wild: 2 }, { generatesFor: query("event", { anyTrait: [first, second] }) }] as const;

/**
 * The Mutant Genesis role upgrades (`brawler`, `commander`, `defender`, `peacekeeper`; 32176-32195, MC32 p. 5): five
 * campaign-only upgrades per role, put into play at setup by `campaigns/mut_gen.ts` (a role upgrade the campaign deals
 * between games; a standalone deck cannot hold them, `specificTo: campaign`). Each prints "Remove this card from the
 * game and the campaign pool", an in-game `removeFromCampaign` plus `removedFromGame`. A used upgrade's removal
 * survives a lost game and an unused one is redealt (docs/phase7-wave6.md §4.1 Q12), both done by the campaign runner.
 *
 * Scripted: Swagger (32177, 32186), Ferocious Attack (32179), War Cry (32180), Shock and Awe (32184), Improvisation
 * (32185), Surprise! (32187, 32191), Heroic Intervention (32188), Bodyguard (32190), Mentorship (32194) and Fortitude
 * (32195). Not scripted (`coverage.test.ts` `KNOWN_SKIPPED`, each with its reason): Coup de Grace (32176, 32181), Brazen
 * Defense (32178), Compassion (32182, 32192), Group Assault (32183), Determined Defense (32189) and Rescue Operation
 * (32193).
 *
 * - **Swagger**: "When you make a basic defense, you get +3 DEF" is the interrupt to your basic DEF use
 *   (`basicPowerUsing`, power `defense`) with `modifyBasicPower(3)`, as Rapid Growth (`ant` 13005) does for any power.
 * - **Resources** (War Cry, Improvisation, Bodyguard, Fortitude): `generatesFor` an event with either trait, as
 *   Solid's does; the other effects resolve with the payment (docs/phase7-wave4.md §3.30).
 * - **Thwart actions** (Heroic Intervention, Mentorship): "(thwart)" with "from among schemes in play" is
 *   `divide("threat", n, scheme)` under the `thwart` label, as Inconspicuous (`trors` 04038) is.
 * - **Surprise!**: "After you thwart" is a hero response to a thwart by your identity; "from among schemes" is the same
 *   `divide`, not a thwart.
 */
export const MUT_GEN_ROLE_UPGRADES = defineAbilities({
  // Swagger (Brawler 32177, Defender 32186) — Hero Interrupt (defense): When you make a basic defense, you get +3 DEF.
  // Ready your hero. Remove this card from the game and the campaign pool.
  "32177.swagger-interrupt": heroInterrupt(
    MAKE_A_BASIC_DEFENSE,
    { label: "defense" },
    modifyBasicPower(3),
    ready(yourIdentity),
    ...REMOVE_THIS_CARD,
  ),
  "32186.swagger-interrupt": heroInterrupt(
    MAKE_A_BASIC_DEFENSE,
    { label: "defense" },
    modifyBasicPower(3),
    ready(yourIdentity),
    ...REMOVE_THIS_CARD,
  ),

  // Ferocious Attack (Brawler 32179) — Hero Action (attack): Spend 3 resources of any type -> deal 6 damage to an
  // enemy and ready your hero. Remove this card from the game and the campaign pool.
  "32179.ferocious-attack-action": heroAction(
    { label: "attack", cost: spend(3) },
    attackAnEnemy(6),
    ready(yourIdentity),
    ...REMOVE_THIS_CARD,
  ),

  // War Cry (Brawler 32180) — Hero Resource: Generate [wild][wild] resources for an Attack or Defense event. Gain a
  // tough status card. Remove this card from the game and the campaign pool.
  "32180.war-cry-resource": heroResource(...wildPairFor(ATTACK, DEFENSE), giveTough(yourIdentity), ...REMOVE_THIS_CARD),

  // Shock and Awe (Commander 32184) — Hero Action (attack): Spend 3 resources of any type -> deal 6 damage to an enemy
  // and ready each ally you control. Remove this card from the game and the campaign pool.
  "32184.shock-and-awe-action": heroAction(
    { label: "attack", cost: spend(3) },
    attackAnEnemy(6),
    ready(each(query("ally", { controller: "you" }))),
    ...REMOVE_THIS_CARD,
  ),

  // Improvisation (Commander 32185) — Hero Resource: Generate [wild][wild] resources for an Attack or Tactic event.
  // Ready an ally and heal 2 damage from it. Remove this card from the game and the campaign pool.
  "32185.improvisation-resource": heroResource(
    ...wildPairFor(ATTACK, TACTIC),
    chooseTarget("ally", query("ally")),
    ready(chosen("ally")),
    heal(2, chosen("ally")),
    ...REMOVE_THIS_CARD,
  ),

  // Surprise! (Defender 32187, Peacekeeper 32191) — Hero Response: After you thwart, remove 3 threat from among
  // schemes in play. Confuse an enemy. Remove this card from the game and the campaign pool.
  "32187.surprise-response": heroResponse(
    on.thwarts(YOUR_IDENTITY),
    divide("threat", 3, query("scheme")),
    anEnemy("enemy"),
    confuse(chosen("enemy")),
    ...REMOVE_THIS_CARD,
  ),
  "32191.surprise-response": heroResponse(
    on.thwarts(YOUR_IDENTITY),
    divide("threat", 3, query("scheme")),
    anEnemy("enemy"),
    confuse(chosen("enemy")),
    ...REMOVE_THIS_CARD,
  ),

  // Heroic Intervention (Defender 32188) — Hero Action (thwart): Spend 3 resources of any type -> remove 5 threat from
  // among schemes in play. You gain a tough status card. Remove this card from the game and the campaign pool.
  "32188.heroic-intervention-action": heroAction(
    { label: "thwart", cost: spend(3) },
    divide("threat", 5, query("scheme")),
    giveTough(yourIdentity),
    ...REMOVE_THIS_CARD,
  ),

  // Bodyguard (Defender 32190) — Hero Resource: Generate [wild][wild] resources for a Defense or Thwart event. Draw 1
  // card. Remove this card from the game and the campaign pool.
  "32190.bodyguard-resource": heroResource(...wildPairFor(DEFENSE, THWART), draw(1), ...REMOVE_THIS_CARD),

  // Mentorship (Peacekeeper 32194) — Hero Action (thwart): Spend 3 resources of any type -> remove 5 threat from among
  // schemes in play. Ready each ally you control. Remove this card from the game and the campaign pool.
  "32194.mentorship-action": heroAction(
    { label: "thwart", cost: spend(3) },
    divide("threat", 5, query("scheme")),
    ready(each(query("ally", { controller: "you" }))),
    ...REMOVE_THIS_CARD,
  ),

  // Fortitude (Peacekeeper 32195) — Hero Resource: Generate [wild][wild] resources for a Tactic or Thwart event. Stun
  // an enemy. Remove this card from the game and the campaign pool.
  "32195.fortitude-resource": heroResource(
    ...wildPairFor(TACTIC, THWART),
    anEnemy("enemy"),
    stun(chosen("enemy")),
    ...REMOVE_THIS_CARD,
  ),
});
