import { trait } from "@mc/content";
import type { Predicate, TargetQuery, TargetRef } from "@mc/engine";
import {
  action,
  aScheme,
  atEndOfPhase,
  attack,
  attacksGainKeywords,
  cancelConsequentialDamage,
  cards,
  changeForm,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  chosenPlayer,
  choosePlayer,
  constant,
  countOf,
  dealDamage,
  dealEncounterCardsCost,
  dealtEncounterCount,
  damageAnEnemy,
  defeat,
  defineAbilities,
  discardThis,
  divide,
  draw,
  each,
  encounterCards,
  eventPlayer,
  eventSource,
  exhaustThis,
  exists,
  gainsKeyword,
  gainsTrait,
  gets,
  hasAttachment,
  heal,
  heroAction,
  heroInterrupt,
  ifThen,
  interrupt,
  isHero,
  min,
  modifyStat,
  modifyStatOf,
  moveCards,
  on,
  oneCopyOf,
  option,
  partOf,
  playOnlyIf,
  preventDamage,
  query,
  ready,
  removeThreat,
  removeThreatFromAScheme,
  response,
  rule,
  scaled,
  selectCards,
  setup,
  shuffleDeck,
  spend,
  theMainScheme,
  topOfDeck,
  varOf,
  when,
  you,
  YOUR_HERO,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

const GUARDIAN = trait("Guardian");
const ELITE = trait("Elite");
const AERIAL = trait("Aerial");

/** A predicate that reads a card wherever it is, including a discard pile (the default `refMatches` is in-play only). */
const refMatchesAnywhere = (ref: TargetRef, q: TargetQuery): Predicate => ({
  kind: "refMatches",
  ref,
  query: q,
  anywhere: true,
});

/** "Each guardian character you control" (Leader of the Guardians, C.I.T.T.): hero/alter-ego or ally. */
const GUARDIAN_CHARACTERS_YOU_CONTROL: TargetQuery = query(["identity", "ally"], {
  controller: "you",
  trait: GUARDIAN,
});
/** "Each guardian character" (Blaze of Glory): no controller filter — printed without "you control". */
const GUARDIAN_CHARACTERS: TargetQuery = query(["identity", "ally"], { trait: GUARDIAN });

/**
 * Star-Lord / Peter Quill (17001a/b) and his hero kit (17002–17023). Reprints in this pack (Get Ready 17016, The
 * Power of Leadership 17018, and any others `../reprints.ts` catches by exact name/type match against the earlier
 * pool) are aliased automatically, not scripted here. Budding Crime Syndicate (17025) carries no ability of its
 * own — its Hinder keyword (docs/phase7-wave3.md §1.3) is read by the engine directly.
 *
 * **Three genuine primitive gaps, all closed** (docs/phase7-wave3.md §3.39/§3.40/§3.41/§3.42, docs/phase7-wave3-
 * scripting.md §6d):
 * - `17017.target-practice-interrupt` ("Interrupt: When an ally with a weapon attachment upgrade makes an
 *   attack…") — the mirror of the existing `host`/`hostOfSelf` pair, `TargetQuery.hasAttachment` asks whether a
 *   *character* has an attachment matching some other query, on the trigger itself (not an `ifThen(exists(...))`
 *   guard in the effects, which would let the interrupt be offered — and Target Practice discarded — against an
 *   ally with no weapon at all).
 * - `17029.agile-flight-action` ("Remove a total of up to 5 threat from among schemes (as you choose)") —
 *   `EffectSpec divide`'s new `upTo: true` lets the chooser divide fewer than the computed amount, but at least 1
 *   whenever a scheme holds threat it can lose (§4 Q16, decided by the user on 2026-09-23), unlike the existing forced-maximum shape (`minSelections === maxSelections === amount`,
 *   docs/phase7-wave2.md §3.7's own Inconspicuous/Wasp Sting, which print "a total of N" with no "up to").
 * - `17005.sliding-shot-constant` ("Play only if you control an Element Gun") — `constant.playOnlyIf`, read from
 *   the card being played wherever it is (not the in-play-only `activeRules`/`activeAbilityRefs` a bare
 *   `cannotPlay` rule would need), enforced in `playRestrictionFault` for the play command, `legalActions`, and
 *   any event offered in a timing window alike.
 */
export const STAR_LORD_KIT = defineAbilities({
  // Star-Lord — Each ally you control gains the guardian trait.
  "17001a.star-lord-constant": constant(gainsTrait(GUARDIAN, query("ally", { controller: "you" }))),

  // "What could go wrong?" — Interrupt: When you play a card from your hand, deal yourself 1 facedown encounter
  // card → reduce the cost to play that card by 3. (Limit once per round.) The engine treats this as a cost
  // modifier offered while paying for the play, not as an ability resolved in the interrupt window itself
  // (docs/phase7-wave3.md §3.20, §4 Q6) — the trigger stays the printed Interrupt on `cardBeingPlayed` so the
  // client still labels it that way, but it carries no effects of its own.
  "17001a.what-could-go-wrong": interrupt(when.youPlay({}), {
    cost: dealEncounterCardsCost(1),
    limit: { count: 1, period: "round" },
    playCostReduction: { amount: 3, fromHand: true },
  }),

  // Peter Quill — Setup: Search your deck and discard pile for a copy of the Element Gun upgrade and add it to
  // your hand. The printed text omits "shuffle your deck" (unlike Captain America's identically-shaped 03001b),
  // but RRG 1.8 "Shuffle" (p. 39): "Any time a deck is searched by a game step or card ability, that deck is
  // shuffled after the game step or card ability completes its resolution" — an always-true rule, not something
  // the printed sentence has to restate, so it's scripted here regardless. "A copy": the kit prints two Element
  // Guns, so `oneCopyOf` takes one (deck first, then discard; docs/phase7-wave3.md §3.50) and leaves the other.
  "17001b.setup": setup(
    moveCards(oneCopyOf(zone(["deck", "discard"], you, { filter: query("upgrade", { name: "Element Gun" }) })), "hand"),
    shuffleDeck(),
  ),

  // Smooth Talker — Action: Choose a card in your hand. Swap that card with the top card of your deck. (Limit
  // once per round.) "Swap" is composed from existing primitives: capture the current top card before the chosen
  // hand card is placed there, then bring that captured card to hand.
  "17001b.smooth-talker": action(
    { limit: { count: 1, period: "round" } },
    chooseCards("swapped", zone("hand", you), { min: 1, max: 1 }),
    selectCards("top", zone("deck", you, { top: 1 })),
    moveCards(cards(chosen("swapped")), "deckTop"),
    moveCards(cards(chosen("top")), "hand"),
  ),

  // Nova Prime — Response: After you play Nova Prime from your hand, defeat a non-Elite minion.
  "17002.nova-prime-response": response(
    when.youPlayThis(),
    chooseTarget("target", query("minion", { withoutTrait: ELITE })),
    defeat(chosen("target")),
  ),

  // Daring Escape — Hero Action: Deal yourself 1 facedown encounter card → ready your hero and draw 1 card.
  "17003.daring-escape-constant": heroAction({ cost: dealEncounterCardsCost(1) }, ready(yourIdentity), draw(1)),

  // Gutsy Move — Hero Action (thwart): Remove 2 threat from a scheme. Remove 2 additional threat from that scheme
  // for each facedown encounter card in front of you.
  "17004.gutsy-move-action": heroAction(
    { label: "thwart" },
    aScheme(),
    removeThreat(scaled(dealtEncounterCount(you), { times: 2, plus: 2 }), chosen("scheme")),
  ),

  // Sliding Shot — Play only if you control an Element Gun (docs/phase7-wave3.md §3.42).
  "17005.sliding-shot-constant": constant(playOnlyIf(exists({ name: "Element Gun", controller: "you" }))),

  // Sliding Shot — Hero Action (attack): Deal 5 damage to an enemy. Deal 2 additional damage to that enemy for
  // each facedown encounter card in front of you.
  "17005.sliding-shot-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy")),
    attack(scaled(dealtEncounterCount(you), { times: 2, plus: 5 }), chosen("enemy")),
  ),

  // Bad Boy — Hero Interrupt: When you would take any amount of damage from the villain's attack, discard this
  // card → prevent all of that damage. Change to alter-ego form and draw 2 cards.
  "17006.bad-boy-constant": heroInterrupt(
    when.damage(YOUR_IDENTITY, { fromAttack: true }),
    { cost: discardThis },
    preventDamage(),
    changeForm(you, "alterEgo"),
    draw(2),
  ),

  // Element Gun — Restricted (data). Hero Action (attack): Exhaust Element Gun and spend 1 resource of any type →
  // deal 3 damage to an enemy. This attack gains piercing.
  "17007.element-gun-action": heroAction(
    { label: "attack", cost: [exhaustThis, spend(1)] },
    chooseTarget("enemy", query("enemy")),
    attack(3, chosen("enemy"), { keywords: ["piercing"] }),
  ),

  // Jet Boots — Star-Lord gains the aerial trait.
  "17008.jet-boots-constant": constant(gainsTrait(AERIAL, YOUR_HERO)),
  // Jet Boots — Hero Interrupt: When Star-Lord would take any amount of damage, exhaust Jet Boots → prevent 1 of
  // that damage for each facedown encounter card in front of you.
  "17008.jet-boots-interrupt": heroInterrupt(
    when.damage(YOUR_HERO),
    { cost: exhaustThis },
    preventDamage(dealtEncounterCount(you)),
  ),

  // Leader of the Guardians — Each guardian character you control gets +1 THW.
  "17009.leader-of-the-guardians-constant": constant(gets("thw", 1, GUARDIAN_CHARACTERS_YOU_CONTROL)),

  // Star-Lord's Helmet — While you are in hero form, you get +1 hand size for each facedown encounter card in
  // front of you (to a maximum of +3 hand size). Ruling, Mar 30, 2026 (1): "(to a maximum of X)" applies locally.
  "17010.star-lords-helmet-constant": constant(
    gets("handSize", min(dealtEncounterCount(you), 3), YOUR_IDENTITY, { while: isHero() }),
  ),

  // Adam Warlock — Response: After Adam Warlock attacks or thwarts, discard 1 card at random from your hand. If
  // that card's printed resource has: [physical] – Remove 3 threat from a scheme. [energy] – Heal 3 damage from
  // an identity. [mental] – Deal 3 damage to an enemy. [wild] – Choose one of the above.
  "17011.adam-warlock-response": response(
    when.attacksOrThwarts("self"),
    moveCards(zone("hand", you, { random: 1 }), "discard", "discarded"),
    ifThen(refMatchesAnywhere(chosen("discarded"), { printedResource: "physical" }), removeThreatFromAScheme(3)),
    ifThen(refMatchesAnywhere(chosen("discarded"), { printedResource: "energy" }), [
      chooseTarget("healed", query("identity")),
      heal(3, chosen("healed")),
    ]),
    ifThen(refMatchesAnywhere(chosen("discarded"), { printedResource: "mental" }), damageAnEnemy(3)),
    ifThen(
      refMatchesAnywhere(chosen("discarded"), { printedResource: "wild" }),
      chooseOne(
        option("Remove 3 threat from a scheme", ...removeThreatFromAScheme(3)),
        option(
          "Heal 3 damage from an identity",
          chooseTarget("healed2", query("identity")),
          heal(3, chosen("healed2")),
        ),
        option("Deal 3 damage to an enemy", ...damageAnEnemy(3)),
      ),
    ),
  ),
  // Adam Warlock's bulleted reminder lines were ingested as their own refs — an ingestion artifact (the bullet
  // list under one Response), not separate abilities; `partOf` points each back at the real ability it continues
  // (the same shape wave 1's Dance of Death 08004 and Baron Mordo 09028 use), so a test of the response covers
  // all four by construction.
  "17011.adam-warlock-constant": partOf("17011.adam-warlock-response"),
  "17011.adam-warlock-constant-2": partOf("17011.adam-warlock-response"),
  "17011.adam-warlock-constant-3": partOf("17011.adam-warlock-response"),
  "17011.adam-warlock-constant-4": partOf("17011.adam-warlock-response"),

  // Beta Ray Bill — Response: After Beta Ray Bill attacks and defeats a minion, remove 2 threat from the main
  // scheme.
  "17012.beta-ray-bill-response": response(
    when.attacks("self", { target: query("minion"), defeats: true }),
    removeThreat(2, theMainScheme),
  ),

  // Yondu — [star] Yondu's attacks gain ranged. (Ranged attacks ignore retaliate — reminder text, already an
  // engine rule.) "[star]" here is the card's own printed typographical marker, not a boost effect.
  "17013.yondu-constant": constant(gainsKeyword({ name: "ranged" }, query("ally", { self: true }))),

  // Air Supremacy — Hero Action: Choose up to X enemies, where X is equal to the number of aerial characters you
  // control → deal 3 damage to each chosen enemy.
  "17014.air-supremacy-action": heroAction(
    chooseTarget("enemies", query("enemy"), {
      upTo: true,
      count: countOf(query(["identity", "ally"], { controller: "you", trait: AERIAL })),
    }),
    dealDamage(3, chosen("enemies")),
  ),

  // Blaze of Glory — Max 1 per round (data). Hero Action: Each guardian character gets +2 THW and +2 ATK this
  // phase. At the end of the phase, deal 1 damage to each guardian character.
  "17015.blaze-of-glory-action": heroAction(
    modifyStatOf("thw", 2, GUARDIAN_CHARACTERS, "endOfPhase"),
    modifyStatOf("atk", 2, GUARDIAN_CHARACTERS, "endOfPhase"),
    atEndOfPhase(dealDamage(1, each(GUARDIAN_CHARACTERS))),
  ),

  // Target Practice — Interrupt: When an ally with a weapon attachment upgrade makes an attack, discard Target
  // Practice → that ally gets +2 ATK for that attack (docs/phase7-wave3.md §3.40). "An ally" is any player's, not
  // just yours — the printed card does not say "you control".
  "17017.target-practice-interrupt": interrupt(
    on.attacks(query("ally", hasAttachment(query("upgrade", { trait: trait("Weapon") })))),
    { cost: discardThis },
    modifyStat("atk", 2, eventSource, "endOfAttack"),
  ),

  // The Power of Leadership (17018) reprints an earlier Leadership resource card verbatim — aliased by
  // `../reprints.ts`, not scripted here.

  // Knowhere — Play only if your identity has the guardian trait (data). Increase your ally limit by 1.
  "17022.knowhere-constant": constant(rule({ kind: "allyLimit", amount: 1 })),
  // Knowhere — Response: After a player plays a guardian ally, exhaust Knowhere → that player draws 1 card.
  "17022.knowhere-response": response(
    on.cardPlayed(query("ally", { trait: GUARDIAN })),
    { cost: exhaustThis },
    draw(1, eventPlayer),
  ),

  // Dive Bomb — Play only if your identity has the aerial trait (data). Hero Action (attack): Deal 7 damage to an
  // enemy. Deal 1 damage to each other enemy.
  "17028.dive-bomb-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy")),
    attack(7, chosen("enemy")),
    dealDamage(1, each(query("enemy", { excluding: chosen("enemy") }))),
  ),

  // Agile Flight — Play only if your identity has the aerial trait (data). Hero Action (thwart): Remove a total of
  // up to 5 threat from among schemes (as you choose) (docs/phase7-wave3.md §3.41, §4 Q16: 0 is allowed too).
  "17029.agile-flight-action": heroAction({ label: "thwart" }, divide("threat", 5, query("scheme"), { upTo: true })),

  // Ever Vigilant — Play only if your identity has the aerial trait (data). Hero Action: Ready your hero and
  // remove 2 threat from the main scheme.
  "17030.ever-vigilant-action": heroAction(ready(yourIdentity), removeThreat(2, theMainScheme)),

  // Laser Blaster — Attach to a guardian ally. Max 1 per ally (data). Attached ally gets +1 ATK and its attacks
  // gain overkill.
  "17019.laser-blaster-constant": constant(
    gets("atk", 1, query("ally", { hostOfSelf: true })),
    attacksGainKeywords(["overkill"], { attacker: query("ally", { hostOfSelf: true }) }),
  ),

  // Cosmo — Interrupt: When Cosmo attacks or thwarts, name a card type, then discard the top card of a player
  // deck or the encounter deck. If that card is of the named type, Cosmo does not take consequential damage for
  // this use. Naming the type and choosing the source both fold into one `chooseOne` tree (docs/phase7-wave3.md
  // §3.21): a branch per source, then a branch per named type within it.
  "17020.cosmo-interrupt": interrupt(
    when.attacksOrThwarts("self"),
    chooseOne(
      option(
        "A player's deck",
        choosePlayer("owner"),
        chooseOne(
          ...(["ally", "event", "upgrade", "support", "resource"] as const).map((category) =>
            option(
              category,
              moveCards(topOfDeck(1, chosenPlayer("owner")), "discard", "named"),
              ifThen(refMatchesAnywhere(chosen("named"), query(category)), cancelConsequentialDamage()),
            ),
          ),
        ),
      ),
      option(
        "The encounter deck",
        chooseOne(
          ...(["minion", "sideScheme", "attachment", "treachery", "obligation"] as const).map((category) =>
            option(
              category,
              moveCards(encounterCards(["deck"], undefined, 1), "discard", "named"),
              ifThen(refMatchesAnywhere(chosen("named"), query(category)), cancelConsequentialDamage()),
            ),
          ),
        ),
      ),
    ),
  ),

  // C.I.T.T. — Hero Action: Exhaust C.I.T.T. and spend 2 resources of any type → ready a guardian character.
  "17021.citt-action": heroAction(
    { cost: [exhaustThis, spend(2)] },
    chooseTarget("character", GUARDIAN_CHARACTERS),
    ready(chosen("character")),
  ),

  // Pulse Grenade — Hero Action (attack): Discard Pulse Grenade and choose an enemy → discard the top 2 cards of
  // the encounter deck. Deal 1 damage to the chosen enemy for each boost icon discarded this way.
  "17023.pulse-grenade-action": heroAction(
    { label: "attack", cost: discardThis },
    chooseTarget("enemy", query("enemy")),
    moveCards(encounterCards(["deck"], undefined, 2), "discard", "milled"),
    attack(varOf("milled.boostIcons"), chosen("enemy")),
  ),
});
