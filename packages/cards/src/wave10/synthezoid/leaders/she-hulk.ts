import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoResponse,
  after,
  applyRuleUntil,
  atEndOfAttack,
  attachCard,
  bindTargets,
  boost,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  encounterCards,
  enemyAttack,
  enemyScheme,
  eventPlayer,
  exhaust,
  exhaustYourHero,
  exists,
  forcedInterrupt,
  forcedResponse,
  firstPlayer,
  gainsKeyword,
  giveTough,
  identityOf,
  ifThen,
  modifyAttack,
  not,
  on,
  oneCopyOf,
  placeThreat,
  printedCostOf,
  query,
  removeThreat,
  revealCard,
  rule,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  superlative,
  surge,
  theMainScheme,
  theVillain,
  varAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../../dsl/index.js";

const HOST_VILLAIN = query("villain", { hostOfSelf: true });
/** "Each character you control" / "a character you control": the identity, allies, and any other friendly character. */
const YOUR_CHARACTERS = query("character", { controller: "you" });

/**
 * Setup (stages I and III): "The enemy team finds a copy of Superhuman Strength and attaches it to She-Hulk." Two
 * copies exist and they are identical, so "a copy" leaves the enemy team no real choice (`oneCopyOf`, as Captain
 * Marvel's Energy Channel); a search shuffles the encounter deck after it (RRG 1.8 "Find", p. 19; "Search", p. 39).
 */
const sheHulkSetup = () =>
  setup(
    selectCards("strength", oneCopyOf(encounterCards(["deck"], query("attachment", { name: "Superhuman Strength" })))),
    attachCard(chosen("strength"), theVillain),
    shuffleEncounterDeck(),
  );

/** When Revealed (stages II and IV): "Deal each player an encounter card. She-Hulk cannot take damage this phase." */
const sheHulkWhenRevealed = () =>
  whenRevealed(
    dealEncounterCard(eachPlayer),
    applyRuleUntil({ kind: "cannotTakeDamage", target: query("villain") }, "endOfPhase"),
  );

/**
 * Every stage: "Forced Response: After an alter-ego changes to hero form, deal 1 damage to that hero." Any player's
 * change (`on.playerChangesForm`, no "you" scope); `eventPlayer` is that player, and the damage is taken by their hero.
 */
const sheHulkForcedResponse = () =>
  forcedResponse(after.playerChangesForm("hero"), dealDamage(1, identityOf(eventPlayer)));

/**
 * She-Hulk, the Synthezoid Smackdown registration leader (MC57 p. 6; docs/phase7-synthezoid.md sections 2.1, 7.1):
 * stages 57001 to 57004, one VillainCard whose stages I and II are the standard game and III and IV the expert one.
 * Hit points, ATK, SCH and Steady are data.
 *
 * **Superhuman Strength (57007)**: a Forced Interrupt when She-Hulk attacks: the attack gains overkill, and the card
 * is discarded after the attack. **Focused Rage (57008)**: She-Hulk gains stalwart until she schemes. **One-Two Punch
 * (57009)**: She-Hulk schemes or attacks by form, then gets a tough status card. **Ground Stomp (57010)**: each
 * character you control is exhausted; with none ready to exhaust it gains surge. **Gamma Slam (57011)**: the
 * highest-cost ally or support you control is discarded and its cost placed on the main scheme as threat, else surge.
 *
 * **Legal Practice (57012)**: threat cannot be removed from it by heroes or allies (a `threatCannotBeRemoved` rule
 * that lets any character other than a hero or ally through, and every removal no character makes). The Alter-Ego
 * Response removes 3 threat as an effect, not a thwart, so it is neither a hero's nor an ally's removal (M10).
 *
 * Cards (7):
 * - 57001 She-Hulk (villain)
 * - 57007 Superhuman Strength (attachment)
 * - 57008 Focused Rage (attachment)
 * - 57009 One-Two Punch (treachery)
 * - 57010 Ground Stomp (treachery)
 * - 57011 Gamma Slam (treachery)
 * - 57012 Legal Practice (side_scheme)
 */
export const SYNTHEZOID_LEADERS_SHE_HULK: AbilityRegistry = defineAbilities({
  "57001.setup": sheHulkSetup(),
  "57001.she-hulk-forced-response": sheHulkForcedResponse(),
  "57002.when-revealed": sheHulkWhenRevealed(),
  "57002.she-hulk-forced-response": sheHulkForcedResponse(),
  "57003.setup": sheHulkSetup(),
  "57003.she-hulk-forced-response": sheHulkForcedResponse(),
  "57004.when-revealed": sheHulkWhenRevealed(),
  "57004.she-hulk-forced-response": sheHulkForcedResponse(),

  // Superhuman Strength: "When She-Hulk attacks, this attack gains overkill. Discard this card after this attack."
  "57007.superhuman-strength-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("host"),
    modifyAttack({ overkill: true }),
    atEndOfAttack(discard(self)),
  ),
  "57007.boost": boost(revealCard(self)),

  // Focused Rage: "She-Hulk gains stalwart. Forced Response: After She-Hulk schemes, discard this card."
  "57008.focused-rage-constant": constant(gainsKeyword({ name: "stalwart" }, HOST_VILLAIN)),
  "57008.focused-rage-forced-response": forcedResponse(after.enemySchemes("host"), discard(self)),
  "57008.boost": boost(revealCard(self)),

  // One-Two Punch
  "57009.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(theVillain), giveTough(theVillain)),
  "57009.when-revealed-hero": whenRevealedHero(enemyAttack(theVillain, { against: you }), giveTough(theVillain)),

  // Ground Stomp: "Exhaust each character you control. If no character was exhausted this way, this card gains surge."
  "57010.when-revealed": whenRevealed(
    ifThen(
      exists(query("character", { controller: "you", exhausted: false })),
      exhaust(each(YOUR_CHARACTERS)),
      surge(),
    ),
  ),
  // Only a ready character is a legal target of "exhaust" (RRG 1.8 "Target" pp. 42-43, "Exhaust" p. 19).
  "57010.boost": boost(
    chooseTarget("stomped", query("character", { controller: "you", exhausted: false }), { chooser: firstPlayer }),
    exhaust(chosen("stomped")),
  ),

  // Gamma Slam: the tie for highest cost is the first player's to break (RRG 1.8 "First Player", p. 19); a Permanent
  // card cannot be discarded, so it is not eligible (RRG 1.8 "Permanent", p. 32).
  "57011.when-revealed": whenRevealed(
    bindTargets(
      "costliest",
      superlative(
        "highest",
        each(query(["ally", "support"], { controller: "you", withoutKeyword: "permanent" })),
        printedCostOf(chosen("candidate")),
      ),
    ),
    chooseTarget("slammed", { inSlot: "costliest" }, { chooser: firstPlayer }),
    discard(chosen("slammed")),
    placeThreat(printedCostOf(chosen("slammed")), theMainScheme, { bind: "slam" }),
    ifThen(not(varAtLeast("slam.amount", 1)), surge()),
  ),

  // Legal Practice
  "57012.legal-practice-constant": constant(
    rule({
      kind: "threatCannotBeRemoved",
      target: { self: true },
      exceptBy: { not: { anyOf: [query("hero"), query("ally")] } },
    }),
  ),
  "57012.legal-practice-response": alterEgoResponse(
    after.youChangeForm(),
    { cost: exhaustYourHero },
    removeThreat(3, self),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const SYNTHEZOID_LEADERS_SHE_HULK_SKIPPED: Readonly<Record<string, string>> = {};
