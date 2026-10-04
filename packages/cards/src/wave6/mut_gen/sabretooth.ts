import type { EventPattern, RuleSpec } from "@mc/engine";
import {
  allOf,
  atEndOfActivation,
  attachCard,
  attacksGainKeywords,
  blanksTextBox,
  boost,
  cannotBeHealed,
  chosen,
  constant,
  controllerOf,
  damagedAtLeast,
  dealDamage,
  dealEncounterCard,
  defeat,
  defeatingPlayer,
  defineAbilities,
  detach,
  discard,
  discardEncounterCards,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  enemyAttack,
  enemyScheme,
  eventAmount,
  eventDealt,
  eventTarget,
  exhaust,
  firstPlayer,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  heal,
  heroAction,
  heroResponse,
  ifElse,
  instead,
  ifThen,
  advanceMainScheme,
  isAttached,
  isHero,
  named,
  not,
  on,
  option,
  chooseOne,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  ready,
  refMatches,
  rule,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  theMainScheme,
  theVillain,
  threatOn,
  undefendedAttack,
  valueAtLeast,
  varOf,
  when,
  whenCompleted,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  you,
} from "../../dsl/index.js";

/** Robert Kelly (32066), the scenario's captive senator. */
const KELLY = named("Robert Kelly");
const KELLY_QUERY = query("ally", { name: "Robert Kelly" });
const THE_VILLAIN_HOST = query("villain", { hostOfSelf: true });
const YOUR_IDENTITY_QUERY = query("identity", { controller: "you" });

/** Sabretooth (I-III) — "[star] Forced Response: After Sabretooth activates against you, discard the top card of the
 * encounter deck. Heal damage from Sabretooth equal to the number of boost icons discarded this way." (Q67: any
 * activation against you, from the villain phase or from a card.) */
const sabretoothForcedResponse = () =>
  forcedResponse(
    on.enemyActivates("self", { againstYou: true }),
    discardEncounterCards(1, { bind: "d" }),
    heal(varOf("d.boostIcons"), theVillain),
  );

/** "Robert Kelly cannot be healed by player card effects and cannot have upgrades attached." (Find the Senator and
 * Protect the Senator both print it.) */
const senatorProtections = () =>
  constant(
    cannotBeHealed(KELLY_QUERY, { bySource: "playerCard" }),
    rule({ kind: "cannotHaveAttachments", target: KELLY_QUERY, from: "upgrade" } as RuleSpec),
  );

const NOT_ATTACHED = not(isAttached(self));
/** "While Robert Kelly is attached to Find the Senator" (the only thing he is ever attached to). */
const KELLY_ATTACHED = isAttached(KELLY);

/** The attacking enemy must be Sabretooth: `defended`'s source is the enemy (`trigger-events.ts` `eventSubjects`). */
const defendsAgainstSabretooth: EventPattern = {
  ...on.defends(YOUR_IDENTITY_QUERY),
  sourceIs: query("villain", { name: "Sabretooth" }),
} as EventPattern;

/**
 * The Sabretooth scenario's own encounter set (`mut_gen` 32060-32072, MC32 p. 7, docs/phase7-wave6.md §2.2): the
 * villain (32060-32062), the main scheme Stalked by Sabretooth / The Injured Senator (32063a/b, 32064a/b), Find the
 * Senator and the Protect the Senator environment it flips into (32065a/b), Robert Kelly (32066), Adamantium Claws,
 * Animal Ferocity, Sabretooth Strikes, Unrelenting Savage, Medical Emergency and Feral Rage. Not the Brotherhood or
 * Mystique modular sets.
 *
 * **Robert Kelly** is a scenario-specific ally with no encounter set: the scenario builder sets him aside
 * (`../setup.ts`'s `SETASIDE_BY_SCENARIO`) and 32063a's Setup attaches him to Find the Senator. While he is attached
 * his own text is blank (32063b), so Stalked by Sabretooth carries the "leaves play: the players lose" rule and Find the
 * Senator carries the heal and attachment restrictions.
 *
 * **Attached, he is an ally in play under no player's control** (32063a; docs/phase7-wave6.md §3.75): in no play area,
 * so no player attacks, thwarts or defends with him and "an ally you control" / "a friendly character" does not reach
 * him (ruling Jun 25, 2026 (4) #5), while an encounter card that names him ("Deal 2 damage to Robert Kelly", "Heal 2
 * damage from Robert Kelly") does, and lethal damage defeats him. A player card that says only "an ally" can still
 * choose him (RRG 1.8 "In Play and Out of Play", p. 23); the printed restrictions are what stop its heal or upgrade.
 * The Injured Senator's "When Completed: Defeat Robert Kelly" resolves before that final stage's completion loses the
 * game (RRG 1.8 "When Completed Abilities", p. 48), so his leaving play is what ends it.
 *
 * **Q4 (docs/phase7-wave6.md §4.1)**: Robert Kelly's Forced Interrupt reads literally: "against you" is his
 * controller, the first player, and only an undefended attack. An undefended attack on another player is not
 * redirected.
 */
export const SABRETOOTH_ABILITIES = defineAbilities({
  "32060.sabretooth-forced-response": sabretoothForcedResponse(),
  "32061.sabretooth-forced-response": sabretoothForcedResponse(),
  "32062.sabretooth-forced-response": sabretoothForcedResponse(),

  // Stalked by Sabretooth 1A — Setup: Put the Find the Senator side scheme into play. Attach Robert Kelly to it.
  "32063a.setup": setup(
    selectCards("senator", encounterCards(["deck"], { name: "Find the Senator" })),
    putIntoPlay(chosen("senator"), firstPlayer),
    selectCards("kelly", encounterSetAside({ name: "Robert Kelly" })),
    attachCard(chosen("kelly"), chosen("senator")),
    shuffleEncounterDeck(),
  ),
  // 1B — Forced Response: After resolving step 1 of the villain phase, deal 2 damage to Robert Kelly (3 damage
  // instead if there is at least 6[per_hero] threat here).
  "32063b.stalked-by-sabretooth-forced-response": forcedResponse(
    on.villainStepResolved(),
    dealDamage(ifElse(valueAtLeast(threatOn(self), perHero(6)), 3, 2), KELLY),
  ),
  // 1B — While Robert Kelly is attached to Find the Senator, treat his text box as if it were blank.
  "32063b.stalked-by-sabretooth-constant": constant(blanksTextBox(KELLY_QUERY, { while: KELLY_ATTACHED })),
  // 1B — If Robert Kelly leaves play, the players lose the game.
  "32063b.stalked-by-sabretooth-constant-2": constant(
    rule({ kind: "leavingPlayLoses", target: KELLY_QUERY } as RuleSpec),
  ),

  // The Injured Senator 2A — When Revealed: Deal each player a facedown encounter card.
  "32064a.when-revealed": whenRevealed(dealEncounterCard(eachPlayer)),
  // 2B — When Completed: Defeat Robert Kelly. If he leaves play, the players lose the game.
  "32064b.when-completed": whenCompleted(defeat(KELLY)),
  "32064b.the-injured-senator-constant": constant(rule({ kind: "leavingPlayLoses", target: KELLY_QUERY } as RuleSpec)),

  // Find the Senator (32065a).
  "32065a.find-the-senator-constant": senatorProtections(),
  // When Defeated: The first player detaches Robert Kelly from this scheme and takes control of him. Advance to main
  // scheme 2A. Flip this card and place it next to the main scheme.
  "32065a.when-defeated": whenDefeated(detach(KELLY, firstPlayer), advanceMainScheme(), flipCard(self)),

  // Protect the Senator (32065b, environment).
  "32065b.protect-the-senator-constant": senatorProtections(),
  // Hero Response: After your hero defends against an attack from Sabretooth, spend 2 resources of any type → ready
  // your hero. Only the player who controls Robert Kelly can trigger this ability.
  "32065b.protect-the-senator-response": heroResponse(
    defendsAgainstSabretooth,
    { cost: spend(2), triggerableBy: controllerOf(KELLY) },
    ready(yourIdentity),
  ),

  // Robert Kelly (32066) — The first player controls Robert Kelly. He does not count against your ally limit and
  // cannot have player cards attached.
  "32066.robert-kelly-constant": constant(
    // "While attached to Find the Senator, Robert Kelly is in play but under no player's control" (32063a Setup), so the
    // rules also wait for him to be detached, on top of his text box being blank then (32063b), as Odin's do.
    rule({ kind: "controlledByFirstPlayer", target: { self: true }, while: NOT_ATTACHED } as RuleSpec),
    rule({ kind: "excludedFromAllyLimit", target: { self: true }, while: NOT_ATTACHED } as RuleSpec),
    // "Cannot have player cards attached": any card a player owns, not upgrades alone (Find the Senator's wording).
    rule({ kind: "cannotHaveAttachments", target: { self: true }, from: "playerCard" } as RuleSpec),
  ),
  // Forced Interrupt: When an enemy resolves an undefended attack against you, deal that damage to Robert Kelly.
  "32066.robert-kelly-forced-interrupt": forcedInterrupt(
    when.damage(YOUR_IDENTITY_QUERY, { fromAttack: true }),
    // The damage is still the attacker's: the log reads "Robert Kelly took 2 damage from Sabretooth".
    ifThen(undefendedAttack, instead(dealDamage(eventAmount, self, { sourceFromEvent: true }))),
  ),

  // Adamantium Claws (32067) — Attach to Sabretooth (data). [star] Sabretooth's attacks gain piercing. Hero Action:
  // Spend [energy][mental][physical] → discard. [star] Boost: Attach this card to Sabretooth.
  "32067.adamantium-claws-constant": constant(attacksGainKeywords(["piercing"], { attacker: THE_VILLAIN_HOST })),
  "32067.adamantium-claws-action": heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self)),
  "32067.boost": boost(attachCard(self, theVillain)),

  // Animal Ferocity (32068) — Attach to Sabretooth (data). Sabretooth gains stalwart. Hero Action as above.
  "32068.animal-ferocity-constant": constant(gainsKeyword({ name: "stalwart" }, THE_VILLAIN_HOST)),
  "32068.animal-ferocity-action": heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self)),
  "32068.boost": boost(attachCard(self, theVillain)),

  // Sabretooth Strikes (32069) — When Revealed: Deal 1 damage to Robert Kelly. You may exhaust your hero to prevent
  // this. [star] Boost: If this attack defeats an ally, place 2 threat on the main scheme (read at the end of the
  // activation, `wave4/mts/hela.ts`'s Hela's Domain).
  "32069.when-revealed": whenRevealed(
    chooseOne(
      option("Exhaust your hero to prevent this damage", exhaust(yourIdentity), {
        when: allOf(isHero(you), not(refMatches(yourIdentity, { exhausted: true }))),
      }),
      option("Deal 1 damage to Robert Kelly", dealDamage(1, KELLY)),
    ),
  ),
  "32069.boost": boost(
    atEndOfActivation(
      ifThen(
        allOf(eventDealt("defeated"), refMatches(eventTarget, query("ally"), { anywhere: true })),
        placeThreat(2, theMainScheme),
      ),
    ),
  ),

  // Unrelenting Savage (32070) — When Revealed (Alter-Ego): Sabretooth schemes. If he has no sustained damage, he gets
  // +1 SCH for this activation. (The data names the alter-ego clause "-constant".)
  "32070.unrelenting-savage-constant": whenRevealedAlterEgo(
    ifThen(not(damagedAtLeast(theVillain, 1)), enemyScheme(theVillain, { schBonus: 1 }), enemyScheme(theVillain)),
  ),
  // When Revealed (Hero): Sabretooth attacks you. If he has no sustained damage, he gets +1 ATK for this activation.
  "32070.when-revealed-hero": whenRevealedHero(
    ifThen(
      not(damagedAtLeast(theVillain, 1)),
      enemyAttack(theVillain, { against: you, atkBonus: 1 }),
      enemyAttack(theVillain, { against: you }),
    ),
  ),

  // Medical Emergency (32071) — Hinder 2[per_hero]. Victory 1 (data). When Defeated: Heal 2 damage from Robert Kelly.
  "32071.when-defeated": whenDefeated(heal(2, KELLY)),
  // Feral Rage (32072) — When Defeated: Sabretooth attacks the player who defeated this scheme (even if that player is
  // in alter-ego form: `enemyAttack` is an attack whatever the form).
  "32072.when-defeated": whenDefeated(enemyAttack(theVillain, { against: defeatingPlayer })),
});
