import type { AbilityRegistry } from "@mc/engine";
import {
  allOf,
  applyRuleUntil,
  atEndOfAttack,
  attachCard,
  attackUsedAtk,
  attacksLoseKeywords,
  boost,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  dealEncounterCard,
  defeatingPlayer,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  encounterCards,
  enemyActivates,
  enemyAttack,
  enemyScheme,
  eventDamageTaken,
  eventSource,
  exists,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gainsKeywordX,
  giveBoostCard,
  giveTough,
  heroResponse,
  host,
  ifThen,
  modifyAttack,
  named,
  on,
  oneCopyOf,
  query,
  refMatches,
  revealCard,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spendSameType,
  stun,
  theVillain,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../../dsl/index.js";

const CAPS_SHIELD_NAME = "Cap's Shield";
const SHIELD = named(CAPS_SHIELD_NAME);
const CAPTAIN_AMERICA = query("villain", { name: "Captain America" });
const HOST_VILLAIN = query("villain", { hostOfSelf: true });
/** "If Cap's Shield is attached to Captain America" */
const SHIELD_ON_CAPTAIN_AMERICA = exists(query("attachment", { name: CAPS_SHIELD_NAME, host: theVillain }));
/** A character Heroic Strike can stun: an identity or an ally (one the attack defeated has left play). */
const FRIENDLY_CHARACTER = query(["identity", "ally"]);

/**
 * Setup of stages I and III: "The enemy team finds Cap's Shield and attaches it to Captain America." One Cap's Shield
 * is in the set, so the find has nothing to decide and no prompt is shown (docs/phase7-wave10.md section 2.4, 3.5); a
 * search shuffles the encounter deck after it (RRG 1.8 "Search", p. 39). The Shield is Permanent.
 */
const captainAmericaSetup = () =>
  setup(
    selectCards("shield", oneCopyOf(encounterCards(["deck"], query("attachment", { name: CAPS_SHIELD_NAME })))),
    attachCard(chosen("shield"), theVillain),
    shuffleEncounterDeck(),
  );

/**
 * Every stage: "Forced Response: After Cap's Shield is attached to Captain America, give him a tough status card."
 * Heard for the Setup's attach, a card's "attach Cap's Shield to Captain America", and the Shield returning to him when
 * its holder leaves play (MC56 p. 20, docs/phase7-wave10.md section 3.19); not for a Shield that was already on him.
 */
const captainAmericaForcedResponse = () =>
  forcedResponse(
    on.cardAttached(query("attachment", { name: CAPS_SHIELD_NAME }), { to: "self" }),
    giveTough(theVillain),
  );

/**
 * Stages II and IV: "When Revealed: Deal each player an encounter card. Captain America cannot take damage this phase."
 * The stage is revealed when the one before it is defeated, in the player phase, so the lasting effect covers the rest
 * of that phase (the same card text as Captain Marvel's and Spider-Woman's, docs/phase7-wave10.md section 3.7).
 */
const advancedWhenRevealed = () =>
  whenRevealed(
    dealEncounterCard(eachPlayer),
    applyRuleUntil({ kind: "cannotTakeDamage", target: CAPTAIN_AMERICA }, "endOfPhase"),
  );

/**
 * Captain America, the Resistance leader (MC56 p. 3, docs/phase7-wave10.md section 2.4, 3.7, 3.17 to 3.19): a villain
 * in a cooperative game; his four stages 56137 to 56140 (I and II standard, III and IV expert) and his encounter set
 * 56143 to 56149 (set "Captain America").
 *
 * **Cap's Shield (56143)**: Permanent, "Attach to Captain America" (data). The holder gains retaliate 1 and attacks
 * against the holder lose piercing, so a tough status card on the holder survives a piercing attack. Its Forced
 * Response moves it: after a hero or the Captain America leader uses their ATK to attack and the holder takes damage,
 * it attaches to the attacker. "Uses their ATK" is a basic attack, an attack whose damage reads the attacker's ATK, and
 * every enemy attack, not a flat "deal 4 damage" attack ability (FFG ruling Dec 17, 2025, R2). The damage is the
 * holder's damage taken, so a tough card or full prevention means no move, and overkill damage that reaches the holder
 * moves it though he was not the target (FFG rulings Jan 11, 2026, R1 and R2; Jan 26, 2026, R3: overkill counts damage
 * taken). A holder that leaves play sends the Shield back to Captain America by the rules, not by a script (MC56 p. 20,
 * docs/phase7-wave10.md section 3.19).
 *
 * **Cap's Helmet (56144)**: attaches to Captain America (+1 SCH, data) who gains stalwart; its Hero Response needs 3
 * resources of the same type. **Super-Soldier Serum (56145)**: +2 ATK (data); when he attacks, that attack gains
 * overkill and the card is discarded at the end of it.
 *
 * **Shield Block (56146)**, **Shield Toss (56147)**, **Heroic Strike (56148)** and **Fearless Determination (56149)**
 * move the Shield or hurt as printed. Fearless Determination is in play until its When Defeated resolves, so its amplify
 * icon holds while Captain America activates (FFG ruling Jan 11, 2026, R1).
 *
 * Cards (8):
 * - 56137 Captain America (villain)
 * - 56143 Cap's Shield (attachment)
 * - 56144 Cap's Helmet (attachment)
 * - 56145 Super-Soldier Serum (attachment)
 * - 56146 Shield Block (treachery)
 * - 56147 Shield Toss (treachery)
 * - 56148 Heroic Strike (treachery)
 * - 56149 Fearless Determination (side_scheme)
 */
export const LEADERS_CAPTAIN_AMERICA: AbilityRegistry = defineAbilities({
  "56137.setup": captainAmericaSetup(),
  "56137.captain-america-forced-response": captainAmericaForcedResponse(),
  "56138.when-revealed": advancedWhenRevealed(),
  "56138.captain-america-forced-response": captainAmericaForcedResponse(),
  "56139.setup": captainAmericaSetup(),
  "56139.captain-america-forced-response": captainAmericaForcedResponse(),
  "56140.when-revealed": advancedWhenRevealed(),
  "56140.captain-america-forced-response": captainAmericaForcedResponse(),

  "56143.caps-shield-constant": constant(
    gainsKeywordX("retaliate", 1, { hostOfSelf: true }),
    attacksLoseKeywords(["piercing"], { target: { hostOfSelf: true } }),
  ),
  "56143.caps-shield-forced-response": forcedResponse(
    on.either(on.attacks(query("hero")), on.enemyAttacks(CAPTAIN_AMERICA)),
    { while: allOf(attackUsedAtk(), eventDamageTaken(host)) },
    attachCard(self, eventSource),
  ),

  "56144.caps-helmet-constant": constant(gainsKeyword({ name: "stalwart" }, HOST_VILLAIN)),
  "56144.caps-helmet-response": heroResponse(
    on.attacks(query("identity"), { basic: true, byYou: true, target: HOST_VILLAIN }),
    { cost: spendSameType(3) },
    discard(self),
  ),
  "56144.boost": boost(revealCard(self)),

  "56145.super-soldier-serum-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("host"),
    modifyAttack({ keywords: ["overkill"] }),
    atEndOfAttack(discard(self)),
  ),
  "56145.boost": boost(revealCard(self)),

  "56146.when-revealed": whenRevealed(
    ifThen(SHIELD_ON_CAPTAIN_AMERICA, giveTough(theVillain), attachCard(SHIELD, theVillain)),
    giveBoostCard(theVillain),
  ),

  "56147.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(theVillain)),
  "56147.when-revealed-hero": whenRevealedHero(
    ifThen(
      SHIELD_ON_CAPTAIN_AMERICA,
      dealDamage(2, each(query(["identity", "ally"], { controller: "you" }))),
      attachCard(SHIELD, theVillain),
    ),
  ),

  "56148.when-revealed-alter-ego": whenRevealedAlterEgo(
    // No "choose": an encounter card targeting one of several eligible cards; the first player selects
    // (RRG 1.8 "First Player", p. 19).
    chooseTarget("lost", query(["ally", "upgrade"], { controller: "you" }), { chooser: firstPlayer }),
    discard(chosen("lost")),
  ),
  "56148.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, bind: "strike" }),
    // A defending ally the attack defeated is no longer in play to be stunned.
    ifThen(refMatches(chosen("strike.damaged"), FRIENDLY_CHARACTER), stun(chosen("strike.damaged"))),
  ),

  "56149.when-defeated": whenDefeated(
    attachCard(SHIELD, theVillain),
    enemyActivates(theVillain, { against: defeatingPlayer }),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const LEADERS_CAPTAIN_AMERICA_SKIPPED: Readonly<Record<string, string>> = {};
