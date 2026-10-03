import { trait } from "@mc/content";
import type { EventPattern, TargetQuery } from "@mc/engine";
import {
  after,
  alterEgoAction,
  atEndOfPhase,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  costModifier,
  defineAbilities,
  discardEncounterCards,
  eventTarget,
  exhaustThis,
  exists,
  forcedInterrupt,
  gainsTrait,
  gets,
  heal,
  heroAction,
  heroResource,
  heroResponse,
  ifThen,
  interrupt,
  isHero,
  modifyAttack,
  modifyBasicPower,
  modifyConsequentialDamage,
  moveCards,
  not,
  on,
  printedResourcesOf,
  putIntoPlay,
  query,
  ready,
  refMatches,
  removeCounter,
  response,
  rule,
  self,
  shuffleDeck,
  statCompare,
  statOf,
  stun,
  takesConsequentialDamage,
  varOf,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";
import { COLOSSUS_SUPPORT_UPGRADES_ALLIES } from "../../mut_gen/colossus/support-upgrades-allies.js";
import { SHADOWCAT_SUPPORT_UPGRADES_ALLIES } from "../../mut_gen/shadowcat/support-upgrades-allies.js";
import { CYCLOPS_PRECON_PLAYER_CARDS } from "../../cyclops/precon-player-cards.js";
import { CYCLOPS_SUPPORT_UPGRADES_ALLIES } from "../../cyclops/cyclops/support-upgrades-allies.js";
import { MSM_PACK_CARDS } from "../../../wave1/msm/pack-cards.js";

const X_MEN = trait("X-MEN");
const X_FORCE = trait("X-FORCE");
const AERIAL = trait("AERIAL");
const WEATHER = trait("WEATHER");
const AN_X_MEN_ALLY = query("ally", { trait: X_MEN });
/** "Your WEATHER support in play" (`weather.ts`). */
const YOUR_WEATHER_SUPPORT: TargetQuery = query("support", { trait: WEATHER, controller: "you" });

/** "After you resolve the 'Special' ability on your WEATHER support": the `abilityResolved` trigger event, by source
 * card (`wave1/bkw/local.ts`). A WEATHER support's only resolvable ability is its Special; its Constant never resolves. */
const specialResolvedOnYourWeather: EventPattern = {
  on: "abilityResolved",
  playerIs: "controller",
  sourceIs: YOUR_WEATHER_SUPPORT,
};

/**
 * Storm's identity-specific upgrades and supports (`storm` 36006-36008), her Leadership allies, supports and upgrades
 * (36016-36020, 36022-36026) and her basic and Leadership cards (36035, "To Me, My X-Men!" 36020), docs/phase7-wave6.md
 * §6.2, §3.58. Her events are `events.ts`, her WEATHER supports `weather.ts`.
 *
 * - **Reprints, aliased**: Effective Leadership 36021 (`33018`), The X-Jet 36023 (`32020`), Utopia 36024 (`33020`),
 *   X-Mansion 36025 (`32049`) and Endurance 36026 (`05023`).
 * - **Storm's Crown (36006) / Cape (36007)**: "Storm" is her hero face (`isHero`). The Crown's resource is the printed
 *   resource of her WEATHER support in play; the Cape's response hears any ability resolved on it (its Special).
 * - **Ororo's Garden (36008)**: alter-ego form only, heals her identity.
 * - **Havok (36014)**: any attack he makes (basic or not). "+1 ATK for this attack" is the attack's own `atkBonus`; his
 *   printed attack consequential damage is 0, so `modifyConsequentialDamage` creates the damage beneath the attack
 *   (`insertConsequentialDamage`) rather than changing a pending one. No boost icon, no change.
 * - **Mirage (36015)**: the enemy's current SCH against Mirage's current THW (`statCompare`), read as the target is
 *   chosen; with no such enemy the response has no target and is not offered.
 * - **Gentle (36016)**: +1 consequential damage only from an attack on the villain (the attack's reported target).
 * - **Pixie (36017)**: any play of Pixie (hand or otherwise): `cardPlayed` is a play, not a put into play.
 * - **Uncanny X-Men (36018)**: "Max 1 TEAM card per player" is card data (`playRestrictions.maxWithTrait`, §3.28). The
 *   cost reduction needs every character you control to be X-MEN, your identity included (§4.1 Q31): in alter-ego
 *   form (MUTANT) it does not apply; the +1 hit point always does.
 * - **Leadership Skill (36019)**: the counter is the cost; +1 to whichever of THW or ATK the ally's basic power uses.
 * - **"To Me, My X-Men!" (36020)**: a search of the top 5 only, so no shuffle; the ally goes to hand at the end of the
 *   phase only if it is still in play then.
 * - **Forge (36022)**: deck and discard pile, then shuffled.
 * - **Hangar Bay (36035)**: heard after an ally's defense, and only when the attack defeated no one (`resultsAtMost`, part of
 *   the trigger condition, so the cost is never paid for a defeated ally).
 */
export const STORM_SUPPORT_UPGRADES_ALLIES = defineAbilities({
  "36006.storms-crown-constant": constant(gets("thw", 1, YOUR_IDENTITY, { while: isHero() })),
  "36006.storms-crown-resource": heroResource(printedResourcesOf(YOUR_WEATHER_SUPPORT), { cost: exhaustThis }),

  "36007.storms-cape-constant": constant(
    gets("def", 1, YOUR_IDENTITY, { while: isHero() }),
    gainsTrait(AERIAL, YOUR_IDENTITY, { while: isHero() }),
  ),
  "36007.storms-cape-response": heroResponse(specialResolvedOnYourWeather, { cost: exhaustThis }, ready(yourIdentity)),

  "36008.ororos-garden-action": alterEgoAction({ cost: exhaustThis }, heal(2, yourIdentity)),

  "36014.havok-forced-interrupt": forcedInterrupt(
    on.attacks("self"),
    discardEncounterCards(1, { bind: "d" }),
    modifyAttack({ atkBonus: varOf("d.boostIcons") }),
    modifyConsequentialDamage(varOf("d.boostIcons")),
  ),

  "36015.mirage-response": response(
    after.entersPlay("self"),
    chooseTarget("enemy", query("enemy", statCompare("sch", "lt", statOf(self, "thw")))),
    stun(chosen("enemy")),
  ),

  "36016.gentle-constant": constant(
    rule(
      takesConsequentialDamage({ self: true }, 1, {
        from: "attack",
        if: refMatches({ kind: "slot", slot: "attack.target" }, query("villain"), { anywhere: true }),
      }),
    ),
  ),

  "36017.pixie-response": response(
    on.youPlayThis(),
    chooseCards("found", zone("discard", you, { filter: AN_X_MEN_ALLY }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
  ),

  "36018.uncanny-x-men-constant": constant(
    gets("hp", 1, query("ally", { trait: X_MEN, controller: "you" })),
    costModifier({
      delta: -1,
      appliesTo: query("ally", { trait: X_MEN, controller: "you" }),
      while: not(exists(query("character", { controller: "you", withoutTrait: X_MEN }))),
    }),
  ),

  "36019.leadership-skill-interrupt": interrupt(
    on.basicPowerUsing(query("ally"), { power: ["attack", "thwart"] }),
    { cost: removeCounter("leadership", 1) },
    modifyBasicPower(1),
  ),

  "36020.to-me-my-x-men-action": heroAction(
    chooseCards("found", zone("deck", you, { top: 5, filter: AN_X_MEN_ALLY }), { min: 0, max: 1 }),
    putIntoPlay(chosen("found")),
    atEndOfPhase(ifThen(refMatches(chosen("found"), query("ally")), moveCards(cards(chosen("found")), "hand"))),
  ),

  "36022.forge-response": response(
    after.entersPlay("self"),
    chooseCards("found", zone(["deck", "discard"], you, { filter: query("support", { anyTrait: [X_MEN, X_FORCE] }) }), {
      min: 0,
      max: 1,
    }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  "36035.hangar-bay-response": response(
    { ...after.defends(query("ally")), resultsAtMost: { defeated: 0 } },
    { cost: exhaustThis },
    ready(eventTarget),
  ),

  // Reprints.
  "36021.effective-leadership-interrupt": CYCLOPS_PRECON_PLAYER_CARDS["33018.effective-leadership-interrupt"]!,
  "36023.the-x-jet-resource": COLOSSUS_SUPPORT_UPGRADES_ALLIES["32020.the-x-jet-resource"]!,
  "36024.utopia-constant": CYCLOPS_SUPPORT_UPGRADES_ALLIES["33020.utopia-constant"]!,
  "36024.utopia-response": CYCLOPS_SUPPORT_UPGRADES_ALLIES["33020.utopia-response"]!,
  "36025.x-mansion-action": SHADOWCAT_SUPPORT_UPGRADES_ALLIES["32049.x-mansion-action"]!,
  "36026.endurance-constant": MSM_PACK_CARDS["05023.endurance-constant"]!,
});
