import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  addVillain,
  allOf,
  advanceMainScheme,
  andThen,
  attacksGainKeywords,
  attachCard,
  canTakeStatus,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  controllerOf,
  damagedAtLeast,
  dealIndirectDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterCards,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  endGame,
  enemyActivates,
  enemyScheme,
  enemyAttack,
  eventAmount,
  eventSource,
  exhaust,
  exists,
  flipCard,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsIcon,
  gainsKeyword,
  gets,
  giveTough,
  heroResponse,
  host,
  ifThen,
  inMode,
  instead,
  moveCards,
  anyOfCards,
  on,
  option,
  perHero,
  placeDamage,
  printedHpOf,
  putIntoPlay,
  query,
  selectCards,
  self,
  setRemainingHitPoints,
  setup,
  shuffleEncounterDeck,
  sharesTitleWith,
  stun,
  theVillain,
  thatPlayer,
  uncancellable,
  whenDefeated,
  whenRevealed,
  you,
} from "../../dsl/index.js";

/**
 * The On the Run scenario's own set (40103-40111: Gotta Get Away / Escaping with Hope, Hope's Captor and the encounter
 * cards). The seven Marauder villains are `marauders.ts`, Mutant Slayers' minions `mutant-slayers.ts`.
 *
 * Every minion this set searches for is a MARAUDER (the Mutant Slayers and Nasty Boys minions, and any other that
 * carries the trait). The minion with the starting villain's title is removed at setup (1A), so a revealed Marauder
 * never shares a title with the villain in play (Q4 = A covers a later change of villain, which this scenario has not).
 */
const MARAUDER = trait("MARAUDER");
const MARAUDER_MINIONS = query("minion", { trait: MARAUDER });
const MARAUDER_ENEMIES = query("enemy", { trait: MARAUDER });
const THE_VILLAIN = query("villain");
const YOUR_MARAUDER_MINIONS = query("minion", { trait: MARAUDER, engagedWith: "you" });
const ATTACHED_VILLAIN = query("villain", { hostOfSelf: true });
/** "A character you control", for the Dizzying Deeds exhaust: a ready one (an exhausted card cannot be exhausted again). */
/** "A character you control" that a stunned / confused status card can still be given to (Q8's reading of "in full"). */
const CAN_BE_STUNNED = query("character", { controller: "you", ...canTakeStatus("stunned") });
const CAN_BE_CONFUSED = query("character", { controller: "you", ...canTakeStatus("confused") });
const READY_CHARACTER = query("character", { controller: "you", exhausted: false });

/** "[player] searches the encounter deck (and discard pile) for a MARAUDER minion and puts it into play engaged with them." */
const searchForMarauder = (zones: readonly ("deck" | "discard")[], player: typeof you | typeof thatPlayer) => [
  chooseCards("found", encounterCards(zones, MARAUDER_MINIONS), { min: 1, max: 1, chooser: player }),
  putIntoPlay(chosen("found"), player),
];

/**
 * Hope's Captor, both faces: "[star] Forced Interrupt: When the villain would attack you, if a MARAUDER minion is engaged
 * with you, the villain schemes instead." A replacement of the attack itself (RRG 1.8 "Replacement Effect", p. 37), so it
 * is heard for every attack on the player, a villain-phase one and a card-caused one alike, before the boost card is
 * dealt (Q9 = A); the scheme gets the boost card the attack would have had. Not `enemyActivating`, which only the villain
 * phase announces.
 */
const schemesInstead = () =>
  forcedInterrupt(
    on.enemyAttacks("host", { againstYou: true }),
    ifThen(exists(YOUR_MARAUDER_MINIONS), instead(enemyScheme(host, { against: you }))),
  );

export const ON_THE_RUN: AbilityRegistry = defineAbilities({
  // Gotta Get Away 1A — Setup: Put 1 random MARAUDER villain into play. Remove the minion with the same title as the
  // villain, along with each other villain, from the game. Attach the Hope's Captor attachment to the villain,
  // [CONFIDENT] side up. (Every villain starts set aside, `startingVillain: "bySetup"`; the villain's own Setup and When
  // Revealed wait for Appendix II step 12c, after 1B's.)
  "40103a.setup": setup(
    selectCards("starting", encounterSetAside(THE_VILLAIN, { random: 1 })),
    addVillain(chosen("starting")),
    moveCards(
      anyOfCards(
        encounterSetAside(THE_VILLAIN),
        encounterCards(["deck", "discard"], query("minion", sharesTitleWith(chosen("starting")))),
      ),
      "removedFromGame",
    ),
    selectCards("captor", encounterSetAside({ name: "Hope's Captor" })),
    attachCard(chosen("captor"), theVillain),
  ),
  // 1B — Each MARAUDER minion gains steady.
  "40103b.gotta-get-away-constant": constant(gainsKeyword({ name: "steady" }, MARAUDER_MINIONS)),
  // When Revealed: Each player searches the encounter deck for a MARAUDER minion and puts it into play engaged with
  // them. (Shuffle.) "If this stage is completed, the players lose the game" is `MainSchemeStage.completionLoses`.
  "40103b.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, searchForMarauder(["deck"], thatPlayer)),
    shuffleEncounterDeck(),
  ),

  // Escaping with Hope 2A — When Revealed: Each player searches the encounter deck and discard pile for a MARAUDER
  // minion and puts that minion into play engaged with them. (Shuffle.) Give each MARAUDER enemy a tough status card.
  "40104a.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, searchForMarauder(["deck", "discard"], thatPlayer)),
    shuffleEncounterDeck(),
    giveTough(each(MARAUDER_ENEMIES)),
  ),
  // 2B — Each MARAUDER minion gains guard and steady. In expert mode, the villain gains steady.
  "40104b.escaping-with-hope-constant": constant(
    gainsKeyword({ name: "guard" }, MARAUDER_MINIONS),
    gainsKeyword({ name: "steady" }, MARAUDER_MINIONS),
    gainsKeyword({ name: "steady" }, THE_VILLAIN, { while: inMode("expert") }),
  ),
  // If the villain is defeated, the players win the game. (The scenario's win is a card ability.)
  "40104b.escaping-with-hope-constant-2": forcedResponse(on.defeated(THE_VILLAIN), endGame("win")),

  // Hope's Captor (40105a, CONFIDENT) — Permanent (data). Forced Interrupt: When the villain would attack you, if a
  // MARAUDER minion is engaged with you, the villain schemes instead.
  "40105a.hopes-captor-forced-interrupt": schemesInstead(),
  // Forced Interrupt: When the villain would be defeated, reset attached villain's hit points to its printed hit point
  // value instead. Flip this card and reveal it. Q10 = A: the dial is reset here, and the b face's +6[per_hero] then
  // raises the dial along with the maximum. Nothing else of the villain changes (the stage, its statuses and
  // attachments stay), and it is not defeated.
  "40105a.hopes-captor-forced-interrupt-2": forcedInterrupt(
    on.defeated("host"),
    instead(setRemainingHitPoints(printedHpOf(host), host), flipCard(self, { reveal: true })),
  ),
  // Hope's Captor (40105b, DESPERATE) — Permanent. The villain gets +6[per_hero] hit points.
  "40105b.hopes-captor-constant": constant(gets("hp", perHero(6), ATTACHED_VILLAIN)),
  // When Revealed: Advance the main scheme to stage 2A. This effect cannot be canceled. An advance, not a completion
  // (stage 1 completing loses the game, `completionLoses`).
  "40105b.when-revealed": uncancellable(whenRevealed(advanceMainScheme({ to: { stageNumber: 2 } }))),
  "40105b.hopes-captor-forced-interrupt": schemesInstead(),

  // Hidden in the Clutter (40106) — Attach to the enemy with the fewest remaining hit points (data). Forced Interrupt:
  // When any amount of damage would be dealt to attached enemy, place it here instead. If there is at least 3 damage
  // here, attached enemy attacks the player who dealt the damage just placed here. Then, discard this card.
  // Reading (rules question 1): the discard goes with the 3-damage threshold, as Armored Rhino Suit's does; below 3 the
  // card stays and keeps absorbing. With no dealing player the attack is skipped and the card is still discarded (Q11 = A).
  "40106.hidden-in-the-clutter-forced-interrupt": forcedInterrupt(
    on.damage("host"),
    instead(
      placeDamage(eventAmount, self),
      andThen(
        ifThen(damagedAtLeast(self, 3), [enemyAttack(host, { against: controllerOf(eventSource) }), discard(self)]),
      ),
    ),
  ),

  // Favored Weapon (40107) — Attach to Greycrow or Harpoon, otherwise the MARAUDER enemy with the lowest ATK (data, +1
  // ATK is data). [star] Attached enemy's attacks gain overkill, piercing, and ranged.
  "40107.favored-weapon-constant": constant(
    attacksGainKeywords(["overkill", "piercing", "ranged"], { attacker: query("enemy", { hostOfSelf: true }) }),
  ),
  // Hero Response: After your hero defends against an attack from attached enemy and takes no damage → discard this card.
  // An encounter card has no controller, so "you" is the player the defense is about (`playerIs`) and the defender is
  // any hero (the responding player's own, by that rule).
  "40107.favored-weapon-response": heroResponse(
    {
      ...on.defends(query("hero"), { takingNoDamage: true }),
      playerIs: "controller" as const,
      sourceIs: query("enemy", { hostOfSelf: true }),
    },
    discard(self),
  ),

  // Bushwhack (40108) — Hazard icon (data). When Defeated: The player who defeated this scheme searches the encounter
  // deck and discard pile for a MARAUDER minion and puts that minion into play engaged with them. (Shuffle.) With no
  // defeating player nobody searches (Q2).
  "40108.when-defeated": whenDefeated(
    chooseCards("found", encounterCards(["deck", "discard"], MARAUDER_MINIONS), {
      min: 1,
      max: 1,
      chooser: defeatingPlayer,
    }),
    putIntoPlay(chosen("found"), defeatingPlayer),
    shuffleEncounterDeck(),
  ),

  // Pure Force (40109) — Acceleration icon (data). While Blockbuster is in play, this scheme gains the crisis icon. While
  // Chimera is in play, this scheme gains the amplify icon.
  "40109.pure-force-constant": constant(
    gainsIcon("crisis", query("sideScheme", { self: true }), {
      while: exists(query(["villain", "minion"], { name: "Blockbuster" })),
    }),
  ),
  "40109.pure-force-constant-2": constant(
    gainsIcon("amplify", query("sideScheme", { self: true }), {
      while: exists(query(["villain", "minion"], { name: "Chimera" })),
    }),
  ),

  // Dizzying Deeds (40110) — When Revealed: Exhaust a character you control. If the following enemies are in play:
  // Arclight — Stun a character you control. Riptide — Take 3 indirect damage. Vertigo — Confuse a character you control.
  "40110.when-revealed": whenRevealed(
    ifThen(exists(READY_CHARACTER), [chooseTarget("tired", READY_CHARACTER), exhaust(chosen("tired"))]),
    ifThen(allOf(exists(query("enemy", { name: "Arclight" })), exists(CAN_BE_STUNNED)), [
      chooseTarget("stunned", CAN_BE_STUNNED),
      stun(chosen("stunned")),
    ]),
    ifThen(exists(query("enemy", { name: "Riptide" })), dealIndirectDamage(you, 3)),
    ifThen(allOf(exists(query("enemy", { name: "Vertigo" })), exists(CAN_BE_CONFUSED)), [
      chooseTarget("confused", CAN_BE_CONFUSED),
      confuse(chosen("confused")),
    ]),
  ),

  // Tag Team (40111) — When Revealed: Choose: • Each MARAUDER minion engaged with you activates against you. • Discard 7
  // cards from the top of the encounter deck. Put the topmost MARAUDER minion in the encounter discard pile into play
  // engaged with you. The first option is offered only if a Marauder minion is engaged with you (Q8 = A).
  "40111.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Each MARAUDER minion engaged with you activates against you",
        { when: exists(YOUR_MARAUDER_MINIONS) },
        enemyActivates(each(YOUR_MARAUDER_MINIONS), { against: you }),
      ),
      option(
        "Discard 7 cards from the top of the encounter deck; put the topmost MARAUDER minion in the discard pile into play engaged with you",
        discardEncounterCards(7),
        selectCards("topmost", encounterCards(["discard"], MARAUDER_MINIONS, { topmostOnly: true })),
        putIntoPlay(chosen("topmost"), you),
      ),
    ),
  ),
});
