import { trait } from "@mc/content";
import {
  action,
  after,
  alterEgoAction,
  anEnemy,
  attachCard,
  attack,
  attacksGainKeywords,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  countAmong,
  dealDamage,
  defineAbilities,
  discard,
  encounterCards,
  eventAmount,
  eventSource,
  exhaustEachCost,
  exhaustThis,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifThen,
  moveCards,
  modifyStat,
  on,
  payPrintedCostOf,
  playableAttachments,
  preventDamage,
  printedCostOf,
  putIntoPlay,
  query,
  ready,
  refMatches,
  removeCounter,
  removeThreatFromAScheme,
  resource,
  response,
  selectCards,
  self,
  shuffleDeck,
  statOf,
  stun,
  sum,
  teamUpCharacters,
  topOfDeck,
  valueAtLeast,
  you,
  yourIdentity,
  zone,
  atEndOfPhase,
} from "../../dsl/index.js";

const AVENGER = trait("AVENGER");
const GUARDIAN = trait("GUARDIAN");
const TECH = trait("TECH");

/** The two-slot Alliance cost this pack's two Alliance cards share (As One!, Stand Together; docs/phase7-wave4.md §3.17). */
const avengerAndGuardian = exhaustEachCost({
  avenger: query(["identity", "ally"], { trait: AVENGER }),
  guardian: query(["identity", "ally"], { trait: GUARDIAN }),
});
/** "The combined ATK of those characters" (As One!): the two `exhaustEachCost` slots' ATK, summed. */
const combinedAtk = sum(statOf(chosen("avenger"), "atk"), statOf(chosen("guardian"), "atk"));

/**
 * War Machine's remaining pack cards (23012–23027, 23032–23035): the leadership, basic, aggression, justice and
 * protection cards bundled with the pack, not part of his signature hero-kit set (`war-machine-kit.ts`).
 *
 * **Exact reprints under a new ability id** (a new physical card, same printed text, no reprint-aliasing module for
 * wave 4 yet — the `nebu` precedent, `nebu/nebula-pack-cards.ts`'s own docblock): Falcon (23014, `cap` 03011),
 * Goliath (23015, `trors`/`cap` 04013), Mockingbird (23022, Core 01083), Quincarrier (23023, `bkw` 08023), Make the
 * Call (23020, Core 01071).
 */
export const WAR_MACHINE_PACK_CARDS = defineAbilities({
  // Black Panther (ally, 23012) — You may play the event attached to Black Panther as if it were in your hand.
  // Response: After Black Panther enters play, choose a leadership (blue) event in your discard pile and attach it
  // to him facedown. The Hawkeye's Quiver shape (`wave2/trors/hawkeye-kit.ts`) for the constant.
  "23012.black-panther-constant": constant(playableAttachments(query("event", { host: self }))),
  "23012.black-panther-response": response(
    after.entersPlay("self"),
    chooseCards("found", zone("discard", you, { filter: query("event", { aspect: "leadership" }) }), {
      min: 0,
      max: 1,
    }),
    attachCard(chosen("found"), self, { facedown: true }),
  ),

  // Captain Marvel (ally, 23013) — Response: After Captain Marvel enters play, discard the top 4 cards of your
  // deck. If you discard a printed [energy] resource, deal 3 damage to an enemy. If you discard more than one
  // printed [energy] resource, also stun that enemy. `countAmong` reads the milled slot specifically (not the whole
  // discard pile), the "Black Cat"/Core `01002` shape (`core/heroes/spider-man.ts`) extended with the stun clause.
  "23013.captain-marvel-response": response(
    after.entersPlay("self"),
    moveCards(topOfDeck(4), "discard", "milled"),
    ifThen(valueAtLeast(countAmong(chosen("milled"), query([], { printedResource: "energy" })), 1), [
      anEnemy("enemy"),
      dealDamage(3, chosen("enemy")),
      ifThen(
        valueAtLeast(countAmong(chosen("milled"), query([], { printedResource: "energy" })), 2),
        stun(chosen("enemy")),
      ),
    ]),
  ),

  // Falcon (ally, 23014) — exact Core/`cap` reprint (module docblock): Response: After Falcon enters play, look at
  // the top 3 cards of the encounter deck. For each treachery looked at this way, remove 1 threat from a scheme.
  "23014.falcon-response": response(
    after.entersPlay("self"),
    selectCards("looked", encounterCards(["deck"], undefined, 3)),
    removeThreatFromAScheme(countAmong(chosen("looked"), query("treachery"))),
  ),

  // Goliath (ally, 23015) — exact reprint: Action: Goliath gets +4 ATK until the end of the phase. At the end of
  // the phase, discard Goliath. (Max once per phase.)
  "23015.goliath-action": action(
    { limit: { count: 1, period: "phase" } },
    modifyStat("atk", 4, self, "endOfPhase"),
    atEndOfPhase(discard(self)),
  ),

  // Command Team (support ×3, 23016) — Uses (3 command counters) (data). Action: Exhaust Command Team and remove 1
  // command counter from it → ready an ally.
  "23016.command-team-action": action(
    { cost: [exhaustThis, removeCounter("command", 1)] },
    chooseTarget("ally", query("ally")),
    ready(chosen("ally")),
  ),

  // Sneak Attack (event ×3, 23017) — Action: Choose an ally in your hand that shares a trait with your identity →
  // put that ally into play. If that ally is still in play at the end of the phase, discard it. `refMatches` with
  // no `anywhere` reads "still in play" (RRG 1.8; `packages/engine/src/select.ts`'s own `refMatches` case).
  "23017.sneak-attack-action": action(
    chooseCards("ally", zone("hand", you, { filter: query("ally", { sharesTraitWith: yourIdentity }) }), {
      min: 1,
      max: 1,
    }),
    putIntoPlay(chosen("ally")),
    atEndOfPhase(ifThen(refMatches(chosen("ally"), query("ally")), discard(chosen("ally")))),
  ),

  // Save the Day (event ×3, 23018) — Hero Action: Discard an ally you control → remove threat from a scheme equal
  // to that ally's printed cost. No in-play "discard cards you control" `AbilityCost` exists yet (the same gap
  // Nebula's Lethal Weapon hit, `nebu/nebula-obligation-nemesis.ts`), so the choose-then-discard is modeled as
  // ordered effects rather than a cost — behaviorally identical here (nothing else needs the discard to have
  // happened *before* the ability is legal to use).
  "23018.save-the-day-action": heroAction(
    chooseTarget("ally", query("ally", { controller: "you" })),
    discard(chosen("ally")),
    removeThreatFromAScheme(printedCostOf(chosen("ally"))),
  ),

  // Go Down Swinging (event ×3, 23019) — Hero Action: Discard an ally you control → deal damage to an enemy equal
  // to that ally's printed cost. Same shape as Save the Day above.
  "23019.go-down-swinging-action": heroAction(
    chooseTarget("ally", query("ally", { controller: "you" })),
    discard(chosen("ally")),
    anEnemy("enemy"),
    dealDamage(printedCostOf(chosen("ally")), chosen("enemy")),
  ),

  // Make the Call (event ×2, 23020) — exact Core reprint (01071): Action: Pay the printed cost of an ally in any
  // player's discard pile → put that ally into play under your control.
  "23020.make-the-call-action": action(
    { cost: payPrintedCostOf("ally", { zone: "discard", player: "any", query: query("ally") }, { entersPlay: true }) },
    putIntoPlay(chosen("ally"), you),
  ),

  // Innovation (resource, 23021) — Max 1 per deck (data). Hero Response: After you spend this card, heal 1 damage
  // from an ally you control.
  "23021.innovation-response": heroResponse(
    on.youSpendThis(),
    chooseTarget("ally", query("ally", { controller: "you" })),
    heal(1, chosen("ally")),
  ),

  // Mockingbird (ally, 23022) — exact Core reprint (01083): Response: After Mockingbird enters play, stun an enemy.
  "23022.mockingbird-response": response(after.entersPlay("self"), anEnemy(), stun(chosen("enemy"))),

  // Quincarrier (support, 23023) — exact `bkw` reprint (08023): Play only if your identity has the Avenger trait
  // (data). Resource: Exhaust Quincarrier → generate a [wild] resource.
  "23023.quincarrier-resource": resource({ wild: 1 }, { cost: exhaustThis }),

  // Two Against the World (event, 23024) — Team-Up (Iron Man and War Machine) (data). Max 1 per deck (data). Hero
  // Action: Search your deck for a tech upgrade and put it into play. Shuffle your deck. Ready Iron Man and War
  // Machine.
  "23024.two-against-the-world-action": heroAction(
    chooseCards("found", zone("deck", you, { filter: query("upgrade", { trait: TECH }) }), { min: 0, max: 1 }),
    putIntoPlay(chosen("found")),
    shuffleDeck(),
    ready(teamUpCharacters()),
  ),

  // As One! (event ×3, 23032, Aggression) — Alliance (data). Hero Action (attack): Exhaust an avenger character and
  // a guardian character → deal X damage to an enemy, where X is the combined ATK of those characters. This attack
  // gains overkill. `exhaustEachCost` (docs/phase7-wave4.md §3.17); the fixture in
  // `dsl/wave4-hero-primitives.test.ts` covers the same cost/query shape generically.
  "23032.as-one-action": heroAction(
    { label: "attack", cost: avengerAndGuardian },
    anEnemy("enemy"),
    attack(combinedAtk, chosen("enemy"), { overkill: true }),
  ),

  // Vigilante Training (support ×2, 23033, Justice) — Max 2 per deck. Uses (2 training counters) (data). Alter-Ego
  // Action: Exhaust this card and remove 1 training counter from it → choose a justice (yellow) event in your
  // discard pile and shuffle it into your deck. The Nebula "Defensive Training" shape (`nebu/nebula-pack-cards.ts`).
  "23033.vigilante-training-action": alterEgoAction(
    { cost: [exhaustThis, removeCounter("training", 1)] },
    chooseCards("found", zone("discard", you, { filter: query("event", { aspect: "justice" }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "deckShuffle"),
  ),

  // Stand Together (event ×3, 23034, Protection) — Alliance (data). Hero Interrupt: When a friendly character would
  // take any amount of damage from an attack, exhaust an avenger character and a guardian character → prevent all
  // of that damage. Deal that much damage to the attacking enemy. The exact fixture shape validated in
  // `dsl/wave4-hero-primitives.test.ts` §3.17.
  "23034.stand-together-interrupt": heroInterrupt(
    on.damage(query(["identity", "ally"]), { fromAttack: true }),
    { cost: avengerAndGuardian },
    preventDamage(),
    dealDamage(eventAmount, eventSource),
  ),

  // Sidearm (upgrade ×3, 23035, Basic) — Attach to an ally. Max 1 per ally (data). Attached ally gets +1 ATK and
  // its attacks gain ranged.
  "23035.sidearm-constant": constant(
    gets("atk", 1, { hostOfSelf: true }),
    attacksGainKeywords(["ranged"], { attacker: { hostOfSelf: true } }),
  ),
});
