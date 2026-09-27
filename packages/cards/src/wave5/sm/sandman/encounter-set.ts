import { trait } from "@mc/content";
import {
  addCounters,
  boost,
  chosen,
  constant,
  countAmong,
  countersOn,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardEncounterCards,
  enemyAttack,
  exhaustCardsCost,
  forcedInterrupt,
  heroAction,
  ifThen,
  instead,
  moveCards,
  named,
  cards,
  gets,
  oncePerRoundPerPlayer,
  placeThreat,
  query,
  removeCountersFrom,
  resolveSpecialsOf,
  resolveWhenRevealedOf,
  revealCard,
  self,
  special,
  statOf,
  stun,
  surge,
  theVillain,
  valueAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
} from "../../../dsl/index.js";

/** "City Streets" (27065), read from anywhere in Sandman's own encounter set and his villain card. */
export const CITY_STREETS = named("City Streets");

/**
 * Sandman's own encounter set (`sm` 27065–27072, docs/phase7-wave5.md §2.2/§3.7): City Streets, Sand Form, Sand
 * Clone, Dirt Trap, Tidal Sands, Sandslide, Sand Storm and Sand Smash. `SANDMAN` (`villain.ts`) reads `CITY_STREETS`
 * from here for its own "resolve the 'Surging Sands' ability" effects.
 */
export const SANDMAN_ENCOUNTER_SET = defineAbilities({
  // City Streets (27065) — Surging Sands (Special): Place 1 sand counter here. Discard cards from the top of the
  // encounter deck equal to the number of sand counters here (docs/phase7-wave5.md §3.7's own worked example).
  "27065.surging-sands": special(
    addCounters("sand", 1),
    discardEncounterCards(countersOn(self, "sand"), { bind: "discarded" }),
  ),
  // Hero Action: Exhaust a character you control → remove sand counters from here equal to that character's ATK.
  // (Limit once per round per player.)
  "27065.city-streets-action": heroAction(
    { cost: exhaustCardsCost(query("character")), limit: oncePerRoundPerPlayer },
    removeCountersFrom(self, "sand", statOf(chosen("exhausted"), "atk")),
  ),

  // Sand Form (27066, attachment, "Attach to Sandman" is the card's own reveal, no separate ref needed —
  // `core/scenarios/rhino.ts`'s Charge is the same shape) — Forced Interrupt: When you would deal any amount of
  // damage to Sandman, discard Sand Form instead → resolve the "Surging Sands" ability on City Streets.
  "27066.sand-form-forced-interrupt": forcedInterrupt(
    when.damage("host"),
    instead(discard(self)),
    resolveSpecialsOf(CITY_STREETS),
  ),
  // [star] Boost: Reveal this card.
  "27066.boost": boost(revealCard(self)),

  // Sand Clone (27067, ATK "X" in the data) — X is equal to the number of sand counters on City Streets.
  // When Defeated: Resolve the "Surging Sands" ability on City Streets.
  "27067.sand-clone-constant": constant(gets("atk", countersOn(CITY_STREETS, "sand"), { self: true })),
  "27067.when-defeated": whenDefeated(resolveSpecialsOf(CITY_STREETS)),

  // Dirt Trap (27068, side scheme) — When Defeated: Resolve the "Surging Sands" ability on City Streets. Resolve
  // it again.
  "27068.when-defeated": whenDefeated(resolveSpecialsOf(CITY_STREETS), resolveSpecialsOf(CITY_STREETS)),

  // Tidal Sands (27069, side scheme) — When Revealed: Place X additional threat here, where X is equal to the
  // number of sand counters on City Streets.
  "27069.when-revealed": whenRevealed(placeThreat(countersOn(CITY_STREETS, "sand"), self)),

  // Sandslide (27070) — When Revealed: Place 2 sand counters on City Streets, then resolve its "Surging Sands"
  // ability. If at least 1 Sandman card was discarded this way, you are stunned (docs/phase7-wave5.md §3.7's own
  // worked example, `wave5-primitives.test.ts`). [star] Boost: Resolve this card's "When Revealed" ability.
  "27070.when-revealed": whenRevealed(
    addCounters("sand", 2, CITY_STREETS),
    resolveSpecialsOf(CITY_STREETS, undefined, { bind: "sands" }),
    ifThen(valueAtLeast(countAmong(chosen("sands.discarded"), { trait: trait("SANDMAN") }), 1), stun(yourIdentity)),
  ),
  "27070.boost": boost(resolveWhenRevealedOf(self)),

  // Sand Storm (27071) — When Revealed: Deal X indirect damage among players (divided as you choose), where X is
  // the number of sand counters on City Streets. If there are none, place 3 sand counters on it [City Streets] and
  // shuffle this card into the encounter deck (so the reveal is never a dead draw).
  "27071.when-revealed": whenRevealed(
    ifThen(
      valueAtLeast(countersOn(CITY_STREETS, "sand"), 1),
      dealIndirectDamage("group", countersOn(CITY_STREETS, "sand")),
      [addCounters("sand", 3, CITY_STREETS), moveCards(cards(self), "encounterDeckShuffle")],
    ),
  ),

  // Sand Smash (27072) — When Revealed (Alter-Ego): Resolve the "Surging Sands" ability on City Streets. This card
  // gains surge. When Revealed (Hero): Sandman attacks you with +1 ATK.
  "27072.when-revealed-alter-ego": whenRevealedAlterEgo(resolveSpecialsOf(CITY_STREETS), surge()),
  "27072.when-revealed-hero": whenRevealedHero(enemyAttack(theVillain, { against: you, atkBonus: 1 })),
});
