import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  after,
  attacksGainKeywords,
  cards,
  chooseCards,
  choosePlayer,
  chosen,
  chosenPlayer,
  constant,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discardFromHand,
  discardThis,
  draw,
  each,
  exists,
  exhaustThis,
  flipCard,
  gainsKeyword,
  gets,
  hasTrait,
  heal,
  heroAction,
  heroResource,
  heroResponse,
  identityOf,
  ifThen,
  ignores,
  interrupt,
  isHero,
  modifyAttack,
  moveCards,
  on,
  perHero,
  playersWhere,
  query,
  ready,
  refMatches,
  response,
  rule,
  self,
  shuffleDeck,
  spend,
  takesConsequentialDamage,
  thatPlayer,
  theVillain,
  thwartAScheme,
  thwartTarget,
  attackTarget,
  victoryDisplayCount,
  whenDefeated,
  defeatingPlayer,
  YOUR_IDENTITY,
  yourIdentity,
  you,
  zone,
  chooseTarget,
  confuse,
  canTakeStatus,
} from "../../dsl/index.js";
import { NEXT_EVOL_PRECON_CABLE_DECK } from "../next_evol/precon-cable-deck.js";

const SKILL = trait("SKILL");
const WEAPON = trait("WEAPON");
const MUTANT = trait("MUTANT");

/** The card itself, to flip it when its controller says so ("You may flip this card."). */
const mayFlipThis = [chooseCards("flip", cards(self), { min: 0, max: 1 }), flipCard(chosen("flip"))];
/** The upgrade's host: its controller's identity (an upgrade with no "attach to" text goes to it). */
const HOST = { hostOfSelf: true } as const;
const CONFUSED_ENEMY = query("enemy", { hasStatus: "confused" });

/**
 * Psylocke's permanent blades, allies, supports, upgrades, side scheme and resource (41002-41024), docs/phase7-wave7.md
 * §7.2, §3.64.
 *
 * - **Psi-Knife (41002a) / Psi-Katana (41002b)**: Permanent is data. Each face's constant and Hero Resource are its own
 *   ref. The Knife is +1 THW and [mental]; the Katana +1 ATK, piercing on her basic attacks (`basicOnly`: an event's
 *   attack does not gain it), and [physical]. "You may flip this card" is part of the resource's effects, a choice the
 *   player may decline; a flip Body Swapped forbids is not offered (`cannotFlip`). The restricted limit after a flip to
 *   the Katana is the engine's (Q38 = A).
 * - **Angel (41003)**: ready the identity after he is played.
 * - **Training Regimen (41008)**: search is optional (a deck may hold no SKILL card); the hand discard is read after the
 *   search, in hero form only.
 * - **Martial Arts / Psionic / Weapons Training (41009-41011)**: a constant and a response whose cost discards the card.
 *   Each response is her own ("Psylocke defends / thwarts / attacks", not an ally).
 * - **Captain Britain (41012)**: two scoped -1 rules on his consequential damage, one per power: after a thwart that
 *   thwarted a side scheme (the scheme has left play if defeated, so read `anywhere`), after an attack on a minion.
 * - **Cypher (41013)**: the target is read as the attack ends; a confused enemy the attack defeats counts (its status
 *   is part of the attack's result).
 * - **Pete Wisdom (41018)**: after the player resolves a treachery (an obligation is not one). X-FORCE is data.
 * - **IPAC (41022)**: printed as a cost, "deal 1 facedown encounter card to a player" is built as the first effects (the
 *   cost only deals to the payer): the card stays facedown until the villain phase, so nothing else is read in between.
 * - **X-Bunker (41023)**: the chosen player is one whose identity has MUTANT; they search the top X cards, X the side
 *   schemes (player and encounter) in the victory display.
 * - **Float Like a Butterfly (41017)**: "Play under any player's control", Max 1 per player are data.
 * - **Lay the Trap (41016)**: Victory 0 is data; the damage is the defeating player's.
 * - **The Power of the Mind (41021)**: the reprint of 40028, the same definition.
 */
export const PSYLOCKE_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "41002a.psi-knife-constant": constant(gets("thw", 1, HOST)),
  "41002a.psi-knife-resource": heroResource({ mental: 1 }, { cost: exhaustThis }, mayFlipThis),
  "41002b.psi-katana-constant": constant(
    gets("atk", 1, HOST),
    attacksGainKeywords(["piercing"], { attacker: HOST, basicOnly: true }),
  ),
  "41002b.psi-katana-resource": heroResource({ physical: 1 }, { cost: exhaustThis }, mayFlipThis),

  "41003.angel-response": response(after.youPlayThis(), ready(yourIdentity)),

  "41008.training-regimen-action": action(
    { cost: exhaustThis },
    chooseCards("found", zone("deck", you, { filter: query([], { trait: SKILL }) }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
    ifThen(isHero(), discardFromHand(1)),
  ),

  "41009.martial-arts-training-constant": constant(gets("def", 1, HOST)),
  "41009.martial-arts-training-response": heroResponse(
    after.defends(YOUR_IDENTITY),
    { cost: discardThis },
    ready(yourIdentity),
  ),
  "41010.psionic-training-constant": constant(ignores(HOST, ["guard", "patrol"])),
  "41010.psionic-training-response": heroResponse(
    after.thwarts(YOUR_IDENTITY),
    { cost: discardThis },
    chooseTarget("enemy", query("enemy", canTakeStatus("confused"))),
    confuse(chosen("enemy")),
  ),
  "41011.weapons-training-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, HOST)),
  "41011.weapons-training-response": heroResponse(
    after.attacks(YOUR_IDENTITY),
    { cost: discardThis },
    ready(each(query("upgrade", { trait: WEAPON, controller: "you" }))),
  ),

  "41012.captain-britain-constant": constant(
    rule(
      takesConsequentialDamage({ self: true }, -1, {
        from: "thwart",
        if: refMatches(thwartTarget(), query("sideScheme"), { anywhere: true }),
      }),
    ),
    rule(
      takesConsequentialDamage({ self: true }, -1, {
        from: "attack",
        if: refMatches(attackTarget(), query("minion"), { anywhere: true }),
      }),
    ),
  ),

  "41013.cypher-response": response(after.attacks("self", { damages: true, target: CONFUSED_ENEMY }), draw(1)),

  "41016.when-defeated": whenDefeated(dealDamage(perHero(5), theVillain, { by: defeatingPlayer })),

  "41017.float-like-a-butterfly-interrupt": interrupt(
    on.attacks(query("character", { controller: "you" }), { target: CONFUSED_ENEMY }),
    modifyAttack({ extraDamage: 1 }),
  ),

  "41018.pete-wisdom-response": response(after.youResolveTreachery(), heal(1, self)),

  "41021.the-power-of-the-mind-constant": NEXT_EVOL_PRECON_CABLE_DECK["40028.the-power-of-the-mind-constant"]!,

  "41022.ipac-action": heroAction(
    { cost: exhaustThis },
    choosePlayer("player"),
    dealEncounterCard(chosenPlayer("player")),
    draw(2, chosenPlayer("player")),
  ),

  "41023.x-bunker-action": action(
    // Choosing the player is part of the cost's wording: with nobody whose identity has MUTANT it cannot be used.
    { cost: exhaustThis, while: exists(query("identity", { trait: MUTANT })) },
    choosePlayer("player", you, { among: playersWhere(hasTrait(identityOf(thatPlayer), MUTANT)) }),
    chooseCards("found", zone("deck", chosenPlayer("player"), { top: victoryDisplayCount(query("sideScheme")) }), {
      min: 0,
      max: 1,
      chooser: chosenPlayer("player"),
    }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(chosenPlayer("player")),
  ),

  "41024.telepathy-action": heroAction(
    { label: "thwart", cost: [exhaustThis, spend({ mental: 2 })] },
    thwartAScheme(2),
  ),
});
