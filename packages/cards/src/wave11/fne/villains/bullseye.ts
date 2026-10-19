import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  activationIs,
  addCounters,
  andThen,
  anyOfCards,
  atEndOfActivation,
  atEndOfAttack,
  atMost,
  attachCard,
  attackInProgress,
  attacksGainKeywords,
  attacksLoseKeywords,
  boost,
  cannotAttach,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  damagedAtLeast,
  dealIndirectDamage,
  defineAbilities,
  discard,
  encounterCards,
  encounterSetAside,
  enemyActivates,
  eventAmount,
  eventDealt,
  eventTarget,
  exists,
  findCard,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  giveBoostCard,
  heal,
  heroResponse,
  host,
  ifThen,
  max,
  modifyAttack,
  moveCards,
  not,
  on,
  option,
  placeDamage,
  placeThreat,
  preventDamage,
  query,
  refMatches,
  removeCountersFrom,
  retargetAttack,
  revealCard,
  selectCards,
  self,
  shuffleEncounterDeck,
  sum,
  surge,
  theVillain,
  undefendedAttack,
  valueAtLeast,
  varOf,
  villainStageNumberOf,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../../dsl/index.js";

const SPINE = "Adamantium-Laced Spine";
const BLOODLUST = "Deranged Bloodlust";
const BULLSEYE = query("villain", { name: "Bullseye" });
const ALLY = query("ally");
const YOUR_ALLY = query("ally", { controller: "you" });
const YOUR_PERSONA = query("support", { trait: trait("Persona"), controller: "you" });

/** "Find the Spine": the encounter deck, its discard pile and the set-aside area; at most one card. */
const findSpine = (slot: string) =>
  selectCards(
    slot,
    atMost(
      1,
      anyOfCards(
        encounterCards(["deck", "discard"], query("attachment", { name: SPINE })),
        encounterSetAside(query("attachment", { name: SPINE })),
      ),
    ),
  );

/**
 * "[star] Forced Interrupt: When Bullseye activates, each of his boost cards gains [boost]. If this activation is an
 * attack, it gains ranged." (60065-60067.) The activation's own interrupt window (`enemySchemesOrAttacks`), before the
 * boost step: `boostIconsEach` is added to every boost card turned faceup in this activation, the facedown ones he held
 * included (the same sentence as an amplify icon, RRG 1.8 "Amplify Icon", p. 7). `keywords` is read for an attack only.
 *
 * Deadly Sai (60070) makes his attacks lose ranged by itself (`attacksLoseKeywords`, attacker-scoped; RRG 1.8 "Lose",
 * p. 27: a loss beats a gain, whatever grants it).
 */
const bullseyeInterrupt = () =>
  forcedInterrupt(
    on.enemySchemesOrAttacks("self"),
    modifyAttack({ boostIconsEach: 1 }),
    modifyAttack({ keywords: ["ranged"] }),
  );

/**
 * Bullseye villain set (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (9):
 * - 60065 Bullseye (villain, stages I-III in one card): I sets the Spine aside, II finds it and attaches it, III finds
 *   and reveals Deranged Bloodlust. Each stage's Forced Interrupt is `bullseyeInterrupt`.
 * - 60068a Adamantium-Laced Spine (attachment, Permanent; flips to 60068b Damaged Spine): damage prevented, kept here.
 * - 60069 Raise the Stakes (attachment): one additional boost card for his attack; then removed or shuffled in.
 * - 60070 Deadly Sai (attachment): +2 ATK (data), his attacks gain piercing (and lose ranged, see `bullseyeInterrupt`).
 * - 60071 Incessant Pursuit (attachment): the villain's attack on you goes to the attached ally, with overkill.
 * - 60072 Lady Bullseye (minion): an undefended attack gets one more boost card.
 * - 60073 Deranged Bloodlust (side_scheme)
 * - 60074 Everything is a Weapon (treachery)
 * - 60075 Unerring Desire (treachery)
 */
export const FNE_VILLAINS_BULLSEYE: AbilityRegistry = defineAbilities({
  // Stage I: "Set aside Adamantium-Laced Spine (68A)". A search shuffles the encounter deck after it (RRG 1.8 "Search").
  "60065.when-revealed": whenRevealed(
    findSpine("spine"),
    moveCards(cards(chosen("spine")), "encounterSetAside"),
    shuffleEncounterDeck(),
  ),
  "60065.bullseye-forced-interrupt": bullseyeInterrupt(),
  "60066.when-revealed": whenRevealed(findSpine("spine"), attachCard(chosen("spine"), self), shuffleEncounterDeck()),
  "60066.bullseye-forced-interrupt": bullseyeInterrupt(),
  "60067.when-revealed": whenRevealed(findCard(query("sideScheme", { name: BLOODLUST }), "reveal")),
  "60067.bullseye-forced-interrupt": bullseyeInterrupt(),

  // Prevent all but 3 of the damage and keep the prevented damage here; "then" the flip is its own sentence (RRG 1.8
  // "'Then'", p. 44), read once the damage is placed. "Would take": after a tough status card, as the printed word.
  "60068a.adamantium-laced-spine-forced-interrupt": forcedInterrupt(
    on.damage("host"),
    preventDamage(max(sum(eventAmount, -3), 0), { bind: "prevented" }),
    placeDamage(varOf("prevented.amount"), self),
    andThen(ifThen(damagedAtLeast(self, 6), flipCard(self))),
  ),
  // "Remove" damage from a card that is not a character is a heal of its damage tokens (engine reading, tier 5).
  "60068b.damaged-spine-forced-response": forcedResponse(
    on.enemySchemes("host"),
    heal(3, self),
    andThen(ifThen(not(damagedAtLeast(self, 1)), flipCard(self))),
  ),

  // The extra card is given as the attack is initiated (before the boost step). The rest waits for the attack's end:
  // a friendly character it defeated leaves the game with this card; otherwise this card is shuffled into the deck.
  // Only an ally can be removed from the game here: a defeated hero eliminates their player (engine reading, tier 5).
  "60069.raise-the-stakes-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("host"),
    modifyAttack({ extraBoostCards: 1 }),
    atEndOfAttack(
      ifThen(
        eventDealt("defeated"),
        [
          ifThen(refMatches(eventTarget, ALLY, { anywhere: true }), moveCards(cards(eventTarget), "removedFromGame")),
          moveCards(cards(self), "removedFromGame"),
        ],
        moveCards(cards(self), "encounterDeckShuffle"),
      ),
    ),
  ),

  // +2 ATK is data. His attacks gain piercing; and they lose ranged.
  "60070.deadly-sai-constant": constant(
    attacksGainKeywords(["piercing"], { attacker: query("villain", { hostOfSelf: true }) }),
    attacksLoseKeywords(["ranged"], { attacker: query("villain", { hostOfSelf: true }) }),
  ),
  "60070.deadly-sai-response": heroResponse(
    { ...on.defends(query("identity")), sourceIs: { hostOfSelf: true }, playerIs: "controller" },
    { cost: { resources: 2, distinctResourceTypes: 2 } },
    discard(self),
  ),

  // "Attach to an ally without Incessant Pursuit attached" is data; with no such ally, the card gains surge.
  "60071.incessant-pursuit-constant": cannotAttach(surge()),
  "60071.incessant-pursuit-forced-interrupt": forcedInterrupt(
    on.villainAttacks({ againstYou: true }),
    selectCards("ally", cards(host)),
    retargetAttack(host),
    modifyAttack({ overkill: true }),
    atEndOfAttack(ifThen(eventDealt("defeated"), moveCards(cards(chosen("ally")), "removedFromGame"))),
  ),

  // Once per attack. No per-attack limit exists (`maxOnePerTriggeringInstance` counts each flip as its own event), so a
  // counter on her, cleared at the end of the attack, stops the extra card's own flip from giving another.
  "60072.lady-bullseye-forced-interrupt": forcedInterrupt(
    { on: "boostCardTurnedFaceup", selfIs: "source", activation: "attack" },
    { while: not(valueAtLeast(countersOn(self, "extra"), 1)) },
    ifThen(undefendedAttack, [
      addCounters("extra", 1),
      giveBoostCard(self),
      atEndOfAttack(removeCountersFrom(self, "extra", 1)),
    ]),
  ),

  "60073.when-revealed": whenRevealed(placeThreat(villainStageNumberOf(), self)),
  "60073.boost": boost(atEndOfActivation(revealCard(self))),

  "60074.when-revealed-alter-ego": whenRevealedAlterEgo(dealIndirectDamage(you, 2)),
  "60074.when-revealed-hero": whenRevealedHero(
    chooseOne(
      option("Bullseye activates against you", enemyActivates(theVillain, { against: you })),
      option(
        "Remove an ally you control from the game",
        { when: exists(YOUR_ALLY) },
        chooseTarget("ally", YOUR_ALLY),
        moveCards(cards(chosen("ally")), "removedFromGame"),
      ),
    ),
  ),
  "60074.boost": boost(
    ifThen(attackInProgress({ attacker: BULLSEYE }), modifyAttack({ extraBoostCards: 1, keywords: ["piercing"] })),
  ),

  "60075.when-revealed": whenRevealed(
    chooseOne(
      option("Give this card to the villain as a facedown boost card", giveBoostCard(theVillain, { card: self })),
      option(
        "Remove a Persona support you control from the game",
        { when: exists(YOUR_PERSONA) },
        chooseTarget("persona", YOUR_PERSONA),
        moveCards(cards(chosen("persona")), "removedFromGame"),
      ),
    ),
  ),
  "60075.boost": boost(ifThen(activationIs("attack"), modifyAttack({ overkill: true }))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_VILLAINS_BULLSEYE_SKIPPED: Readonly<Record<string, string>> = {};
