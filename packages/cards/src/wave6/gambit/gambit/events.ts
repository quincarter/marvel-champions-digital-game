import { trait } from "@mc/content";
import {
  action,
  addCounters,
  alterEgoAction,
  aScheme,
  anAttackableEnemy,
  attack,
  attackAnEnemy,
  cards,
  chooseCards,
  chosen,
  confuse,
  constant,
  countersOn,
  defineAbilities,
  draw,
  heroAction,
  heroInterrupt,
  ifThen,
  inPlay,
  modifyStat,
  moveCards,
  on,
  playNote,
  placeCountersCost,
  playOnlyIf,
  query,
  removeThreatFromAScheme,
  theVillain,
  thwart,
  thwartAScheme,
  threatOn,
  valueEquals,
  varAtLeast,
  YOUR_IDENTITY,
  yourIdentity,
  anyOf,
  youHaveTrait,
  dealDamage,
  you,
  zone,
} from "../../../dsl/index.js";
import { THROW_DE_CARD_NOTE } from "./identity.js";

/** "Your discard pile", read for the cards Mutant Education / X-Men Instruction shuffle back. */
const fromDiscard = (filter: ReturnType<typeof query>) => zone("discard", you, { filter });
const SPY = trait("SPY");
const THIEF = trait("THIEF");
const X_MEN = trait("X-MEN");

/**
 * Gambit's hero-kit and Justice / basic events (`gambit` 37006-37009, 37014, 37015, 37019-37021, 37031),
 * docs/phase7-wave6.md §6.2, §3.52-§3.53, §4.1 Q27. Trait gates ("SPY or THIEF", MUTANT) and Team-Up are card data
 * (`playRestrictions`, the `teamUp` keyword) except Breaking and Entering's "or", which is its own constant.
 *
 * - **Charged Card (37006)**: the attack's keywords come from the play note Throw de Card wrote (`identity.ts`):
 *   1+ ranged, 2+ also piercing, 3 also overkill. The chain is one attack per branch; exactly one resolves.
 * - **Royal Flush (37007)**: the counter goes on first, then three separately chosen instances of 0 damage; Throw de
 *   Card's bonus adds to each instance (Q27). The three are the damage of one labeled attack.
 * - **Natural Agility (37008)**: the counter is the cost, so the +DEF counts it.
 * - **Creole Charmer (37009)**: "the last threat" is read after the removal (Fly Over's shape).
 */
export const GAMBIT_EVENTS = defineAbilities({
  "37006.charged-card-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    ifThen(
      playNote(THROW_DE_CARD_NOTE, 3),
      attack(4, chosen("enemy"), { keywords: ["ranged", "piercing", "overkill"] }),
      ifThen(
        playNote(THROW_DE_CARD_NOTE, 2),
        attack(4, chosen("enemy"), { keywords: ["ranged", "piercing"] }),
        ifThen(
          playNote(THROW_DE_CARD_NOTE, 1),
          attack(4, chosen("enemy"), { keywords: ["ranged"] }),
          attack(4, chosen("enemy")),
        ),
      ),
    ),
  ),

  "37007.royal-flush-action": heroAction(
    { label: "attack" },
    addCounters("charge", 1, yourIdentity),
    anAttackableEnemy("first"),
    dealDamage(0, chosen("first")),
    anAttackableEnemy("second"),
    dealDamage(0, chosen("second")),
    anAttackableEnemy("third"),
    dealDamage(0, chosen("third")),
  ),

  "37008.natural-agility-interrupt": heroInterrupt(
    on.defends(YOUR_IDENTITY),
    { label: "defense", cost: placeCountersCost("charge", 1, { onIdentity: true }) },
    modifyStat("def", countersOn(yourIdentity, "charge"), yourIdentity, "endOfAttack"),
  ),

  "37009.creole-charmer-action": alterEgoAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(3, chosen("scheme")),
    ifThen(valueEquals(threatOn(chosen("scheme")), 0), confuse(theVillain)),
  ),

  "37014.stealth-strike-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(4, chosen("enemy"), { bind: "hit" }),
    ifThen(varAtLeast("hit.defeated"), removeThreatFromAScheme(2)),
  ),

  "37015.breaking-and-entering-constant": constant(playOnlyIf(anyOf(youHaveTrait(SPY), youHaveTrait(THIEF)))),
  "37015.breaking-and-entering-action": action({ label: "thwart" }, thwartAScheme(3)),

  "37019.beauty-and-the-thief-constant": heroAction(
    { label: ["attack", "thwart"] },
    attackAnEnemy(4),
    thwartAScheme(4),
  ),

  "37020.hit-and-run-constant": heroAction({ label: ["attack", "thwart"] }, attackAnEnemy(2), thwartAScheme(2)),

  "37021.mutant-education-action": alterEgoAction(
    chooseCards("found", fromDiscard(query([], { identitySetOf: you })), { min: 0, max: 2 }),
    moveCards(cards(chosen("found")), "deckShuffle"),
    ifThen(inPlay("X-Mansion"), draw(1)),
  ),

  "37031.x-men-instruction-action": alterEgoAction(
    chooseCards("found", fromDiscard(query("ally", { trait: X_MEN })), { min: 0, max: 2 }),
    moveCards(cards(chosen("found")), "deckShuffle"),
    ifThen(inPlay("X-Mansion"), draw(1)),
  ),
});
