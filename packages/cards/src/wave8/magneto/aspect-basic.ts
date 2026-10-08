import { trait } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import {
  allOf,
  anyOf,
  applyRuleUntil,
  canPayResources,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  discardCardsCost,
  discardThis,
  draw,
  each,
  encounterSetAside,
  exists,
  find,
  forEachPlayer,
  eachPlayer,
  gainsKeyword,
  gainsTrait,
  gets,
  grantOwnedCards,
  cards,
  hasStatus,
  heal,
  heroAction,
  made,
  ifThen,
  discardEncounterUntil,
  excludedFromAllyLimit,
  giveTough,
  moveCards,
  not,
  on,
  option,
  playFromHandReducingCost,
  playOnlyIf,
  printedHpOf,
  putIntoPlay,
  query,
  alterEgoAction,
  ready,
  refCount,
  removeStatus,
  removeThreat,
  response,
  revealCard,
  selectCards,
  self,
  shuffleEncounterDeck,
  spendResources,
  thatPlayer,
  valueAtLeast,
  varOf,
  whenDefeated,
  youHaveTrait,
  yourIdentity,
  zone,
  atMost,
  anyOfCards,
  encounterCards,
  setAside,
  you,
} from "../../dsl/index.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";

const X_MEN = trait("X-MEN");
const X_FORCE = trait("X-FORCE");
const X_FACTOR = trait("X-FACTOR");
const MUTANT = trait("MUTANT");
const NEW = trait("NEW");

/** The existing script of a card this one reprints, found by its ability id (docs/phase7-wave8.md §3.81). */
function reprintOf(id: string): AbilityDefinition {
  const definition = WAVE7_ABILITIES[id];
  if (!definition) throw new Error(`reprint source ${id} is not scripted`);
  return definition;
}

/** "If you have the [MUTANT] or [X-MEN] trait": the controller's identity as it stands, gained traits included. */
const MUTANT_OR_XMEN = anyOf(youHaveTrait(MUTANT), youHaveTrait(X_MEN));
/** "Play only if your identity has the [X-FORCE] or [X-MEN] trait." (Breaking and Entering's shape, `gambit` 37015.) */
const XFORCE_OR_XMEN_IDENTITY = anyOf(youHaveTrait(X_FORCE), youHaveTrait(X_MEN));

/** The player's own nemesis minion (RRG 1.8 "Nemesis Encounter Set", p. 30), wherever it is. */
const NEMESIS_MINION = query("minion", { nemesisMinionOf: you });

/**
 * Magneto pack aspect and basic player cards, docs/phase7-wave8.md §7.5, §3.78, §3.81.
 *
 * Cards (20):
 * - 49012 M (ally)
 * - 49013 Kid Omega (ally)
 * - 49014 Phoenix (ally)
 * - 49015 Cyclops (ally)
 * - 49016 Won't Stay Down (support)
 * - 49017 Squared Off (event)
 * - 49018 Noble Sacrifice (event)
 * - 49019 "You Got This!" (event)
 * - 49020 New Recruits (player_side_scheme)
 * - 49021 White Queen (ally)
 * - 49022 Face the Past (event)
 * - 49023 Deft Focus (upgrade)
 * - 49024 Energy (resource)
 * - 49025 Genius (resource)
 * - 49026 Strength (resource)
 * - 49033 Surge (ally)
 * - 49034 Anole (ally)
 * - 49035 Bling! (ally)
 * - 49036 Indra (ally)
 * - 49037 Children of the Atom (support)
 *
 * **Reprints, one script under two ids**: Deft Focus 49023 is `gmw` 16024's (raw `duplicate_of_code`; the Basic
 * classification is an erratum already in the data). Energy, Genius and Strength print no ability.
 *
 * **M (49012) is not registered.** "Defeat a minion with fewer remaining hit points than M" restricts the minions
 * that may be chosen by a comparison of their remaining hit points with M's, and no `TargetQuery` field compares
 * remaining hit points (`statCompare` has no hit-point stat, `maxPrintedHp` is the printed number, `remainingHpOf`
 * is a value for predicates and `superlative`). Choosing any minion and then checking would offer targets the card
 * does not allow, so it is left out; docs/phase7-wave8.md §3.81 row "After M enters play" names "a target query on
 * `remainingHp`", which does not exist.
 *
 * **Kid Omega (49013)**: each bullet is a spend, offered only to a player who can pay it (RRG 1.8 "Choose (Option)",
 * p. 12), and the effect follows only a spend that was made.
 *
 * **Cyclops (49015)**: Q46 = A, the +1 applies to every instance of damage the enemy takes from an attack. The grant
 * names the chosen enemy through its slot, lasts to the end of the phase and reaches every player's attacks.
 *
 * **"You Got This!" (49019) is not registered.** "Discard an ally you control →" is a cost, and the ally's power is read
 * after the cost has been paid, when the ally is already in the discard pile: `statOf` then returns its printed
 * number, not the number it had in play. The two agree for Kid Omega, Phoenix and Cyclops (nothing modifies them) and
 * differ for Surge with her bonus (3 in play, 2 read afterwards; docs/phase7-wave8.md §8 says "Surge with her bonus adds
 * 3"). No DSL value reads a discarded card's last stat. Choosing the ally as an effect, reading its power and only then
 * discarding it gives the right number, but turns a cost into an effect, so it is left to the main session to accept;
 * the test file proves both forms side by side.
 *
 * **New Recruits (49020)**: Victory 0, 2 threat per player and "Play only if your identity has the X-Men trait" are
 * data. Its When Defeated is each player's own choice among the set-aside NEW allies (the linked allies, set aside
 * ownerless at setup) and the chosen ally is taken into that player's hand, who owns it from then on (RRG 1.8
 * "Linked (Card Title)", p. 27).
 *
 * **Surge, Anole, Bling! and Indra (49033 to 49036)**: Linked is data. While the controller's identity has the MUTANT
 * or X-MEN trait as it stands (Children of the Atom can give X-MEN), the ally has its bonus and is left out of the ally
 * limit; Bling! has toughness, so she enters play with her tough status card only if the condition holds then.
 *
 * **White Queen (49021)**: the "Play only if" line names two traits, which `playRestrictions` cannot hold, so it is the
 * constant. The Response lets the player pick the character and then which status card of it to discard.
 *
 * **Face the Past (49022)**: searches the three areas the card names (not a find: a nemesis minion in play is out of
 * reach), so it is playable only while one is there. In The Wrecking Crew only the active villain's encounter deck
 * exists (ruling January 17, 2026 - Ruling 5), which the encounter selectors already read, and the revealed minion goes
 * to that deck's discard pile when it is defeated. "You cannot attack the villain this phase" is a lasting rule on the
 * player, so it covers the identity and every ally the player controls (docs/phase7-wave8.md §3.81).
 */
export const MAGNETO_ASPECT_BASIC: AbilityRegistry = defineAbilities({
  "49013.kid-omega-response": response(
    on.entersPlay("self"),
    chooseOne(
      option(
        "Spend an energy resource: 1 damage to each enemy",
        { when: canPayResources({ energy: 1 }) },
        spendResources({ energy: 1 }, "spent"),
        ifThen(made("spent"), dealDamage(1, each(query("enemy")))),
      ),
      option(
        "Spend a mental resource: remove 1 threat from each scheme",
        { when: canPayResources({ mental: 1 }) },
        spendResources({ mental: 1 }, "spent"),
        ifThen(made("spent"), removeThreat(1, each(query("scheme")))),
      ),
    ),
  ),

  "49014.phoenix-response": response(
    on.entersPlay("self"),
    chooseTarget("xmen", query("ally", { trait: X_MEN })),
    ready(chosen("xmen")),
    heal(1, chosen("xmen")),
  ),

  "49015.cyclops-response": response(
    on.entersPlay("self"),
    chooseTarget("enemy", query("enemy")),
    applyRuleUntil(
      { kind: "increaseDamageTaken", target: query("enemy", { inSlot: "enemy" }), amount: 1, fromAttack: true },
      "endOfPhase",
    ),
  ),

  "49016.wont-stay-down-constant": constant(playOnlyIf(XFORCE_OR_XMEN_IDENTITY)),
  "49016.wont-stay-down-action": alterEgoAction(
    { cost: discardThis },
    chooseCards("back", zone("discard", you, { filter: query("ally", { anyTrait: [X_FORCE, X_MEN] }) }), {
      min: 1,
      max: 1,
    }),
    moveCards(cards(chosen("back")), "hand"),
  ),

  "49017.squared-off-action": heroAction(
    discardEncounterUntil(query("minion"), "found"),
    putIntoPlay(chosen("found"), undefined, { bind: "entered" }),
    ifThen(valueAtLeast(varOf("entered.count"), 1), playFromHandReducingCost(3, you, { filter: query("ally") })),
  ),

  "49018.noble-sacrifice-action": heroAction(
    { cost: discardCardsCost(query("ally", { controller: "you" })) },
    heal(printedHpOf(chosen("discarded")), yourIdentity),
    giveTough(yourIdentity),
  ),

  "49020.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      chooseCards("taken", encounterSetAside(query("ally", { trait: NEW })), {
        min: 1,
        max: 1,
        chooser: thatPlayer,
      }),
      grantOwnedCards(cards(chosen("taken")), "hand", thatPlayer),
    ),
  ),

  "49021.white-queen-constant": constant(playOnlyIf(XFORCE_OR_XMEN_IDENTITY)),
  "49021.white-queen-response": response(
    on.entersPlay("self"),
    chooseTarget("who", query("character", { hasAnyStatus: true })),
    chooseOne(
      option(
        "Discard the stunned status",
        { when: hasStatus(chosen("who"), "stunned") },
        removeStatus(chosen("who"), "stunned", { count: 1 }),
      ),
      option(
        "Discard the confused status",
        { when: hasStatus(chosen("who"), "confused") },
        removeStatus(chosen("who"), "confused", { count: 1 }),
      ),
      option(
        "Discard the tough status",
        { when: hasStatus(chosen("who"), "tough") },
        removeStatus(chosen("who"), "tough", { count: 1 }),
      ),
    ),
  ),

  "49022.face-the-past-action": heroAction(
    {
      while: allOf(valueAtLeast(refCount(find(NEMESIS_MINION)), 1), not(exists(NEMESIS_MINION))),
    },
    selectCards(
      "nemesis",
      atMost(
        1,
        anyOfCards(
          encounterCards(["deck", "discard"], NEMESIS_MINION),
          setAside(you, NEMESIS_MINION),
          encounterSetAside(NEMESIS_MINION),
        ),
      ),
    ),
    shuffleEncounterDeck(),
    revealCard(chosen("nemesis")),
    ready(yourIdentity),
    draw(3),
    applyRuleUntil({ kind: "cannotAttack", target: query("villain"), player: you }, "endOfPhase"),
    moveCards(cards(self), "removedFromGame"),
  ),

  "49023.deft-focus-action": reprintOf("16024.deft-focus-action"),

  "49033.surge-constant": constant(
    gets("atk", 1, { self: true }, { while: MUTANT_OR_XMEN }),
    excludedFromAllyLimit({ self: true }, { while: MUTANT_OR_XMEN }),
  ),
  "49034.anole-constant": constant(
    gets("thw", 1, { self: true }, { while: MUTANT_OR_XMEN }),
    excludedFromAllyLimit({ self: true }, { while: MUTANT_OR_XMEN }),
  ),
  "49035.bling-constant": constant(
    gainsKeyword({ name: "toughness" }, { self: true }, { while: MUTANT_OR_XMEN }),
    excludedFromAllyLimit({ self: true }, { while: MUTANT_OR_XMEN }),
  ),
  "49036.indra-constant": constant(
    gets("hp", 2, { self: true }, { while: MUTANT_OR_XMEN }),
    excludedFromAllyLimit({ self: true }, { while: MUTANT_OR_XMEN }),
  ),

  "49037.children-of-the-atom-constant": constant(
    ...[X_FACTOR, X_FORCE, X_MEN].map((t) =>
      gainsTrait(t, query(["identity", "ally"], { controller: "you", anyTrait: [X_FACTOR, X_FORCE, X_MEN] })),
    ),
  ),
});

/** Refs of this module's cards left unregistered, each with its reason; `coverage.test.ts` pins them. */
export const MAGNETO_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "49019.you-got-this-response":
    "the discard is a cost and `statOf` of the discarded ally reads its printed stat, not the stat it had in play (Surge with her bonus: 3 in play, 2 afterwards); no value snapshots a cost-discarded card: docs/phase7-wave8.md §3.81 row 'After you exhaust your hero'",
  "49012.m-response":
    "'defeat a minion with fewer remaining hit points than M' needs a target query comparing remaining hit points; no TargetQuery field does (statCompare has no hp stat): docs/phase7-wave8.md §3.81 row 'After M enters play'",
};
