import { trait } from "@mc/content";
import {
  addMainSchemeStageToVictoryDisplay,
  addVillain,
  advanceMainScheme,
  boost,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  countOf,
  coveredByEngineRule,
  dealEncounterCard,
  dealIndirectDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardAtRandom,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  endGame,
  enemyActivates,
  eventTarget,
  exhaust,
  exists,
  firstPlayer,
  forEachPlayer,
  forcedResponse,
  gainsKeyword,
  gets,
  ifThen,
  modifyAttack,
  moveCards,
  named,
  on,
  partOf,
  placeThreat,
  putIntoPlay,
  query,
  scaled,
  searchAndReveal,
  selectCards,
  self,
  setup,
  shuffleDeck,
  shuffleEncounterDeck,
  shuffleMainSchemeStages,
  stun,
  theVillain,
  thatPlayer,
  topOfDeck,
  totalPrintedResources,
  valueAtLeast,
  victoryCondition,
  victoryDisplayCount,
  whenCompleted,
  whenDefeated,
  whenRevealed,
  yourIdentity,
  you,
  zone,
} from "../../dsl/index.js";

const BROTHERHOOD = trait("BROTHERHOOD OF MUTANTS");
const THE_VILLAINS = query("villain");
/** The four Brotherhood titles shared by a villain and its minion (Avalanche 32073, Blob 32074, Pyro 32075, Toad 32076). */
const TITLES = ["Avalanche", "Blob", "Pyro", "Toad"] as const;
const enemyNamed = (name: string) => query("enemy", { name });
const AFTER_ATTACKS_YOU = on.enemyAttacks("self", { againstYou: true });

/** "Avalanche": "[star] Forced Response: After Avalanche attacks you, exhaust an ally you control." An ally that is
 * already exhausted is not a valid target: the exhaust could not affect it (RRG 1.8 "Target", p. 42). */
const avalancheForcedResponse = () =>
  forcedResponse(
    AFTER_ATTACKS_YOU,
    chooseTarget("ally", query("ally", { controller: "you", exhausted: false })),
    exhaust(chosen("ally")),
  );
/** "Blob": "[star] Forced Response: After Blob attacks and damages a character, stun that character." */
const blobForcedResponse = () => forcedResponse(on.enemyAttacks("self", { damages: true }), stun(eventTarget));
/** "Pyro": "[star] Forced Response: After Pyro attacks you, discard the top 2 cards of your deck. Take 1 indirect damage
 * for each printed resource icon discarded this way." (Wild icons count: every printed resource icon.) */
const pyroForcedResponse = () =>
  forcedResponse(
    AFTER_ATTACKS_YOU,
    selectCards("top", topOfDeck(2, you)),
    moveCards(cards(chosen("top")), "discard"),
    dealIndirectDamage(you, totalPrintedResources(chosen("top"))),
  );
/** "Toad": "[star] Forced Response: After Toad attacks and damages a character you control, discard 1 random card from
 * your hand." */
const toadForcedResponse = () =>
  forcedResponse(on.enemyAttacks("self", { againstYou: true, damages: true }), discardAtRandom(1, you));

/**
 * "[Name] activates against you. If he is not in play, search the encounter deck and discard pile for the [Name] minion
 * and reveal him." The villain counts as "in play" and activates (RRG 1.8 "Unique", p. 46: the minion cannot be in play
 * with the villain of its title); the revealed minion does not activate.
 */
const activatesOrSearch = (name: string) =>
  whenRevealed(
    ifThen(
      exists(enemyNamed(name)),
      enemyActivates(named(name), { against: you }),
      searchAndReveal(name, ["deck", "discard"], you),
    ),
  );
/** "[star] Boost: If the villain is [Name], give him an additional boost card for this activation." */
const extraBoostIfVillain = (name: string) =>
  boost(ifThen(exists(query("villain", { name })), modifyAttack({ extraBoostCards: 1 })));

/**
 * One main scheme stage 2's own text: "[constant]. When Completed: Add this scheme to the victory display. Advance to
 * the next card in the main scheme deck. If there are 3 main schemes in the victory display, the players lose the
 * game." The advance is the engine's own completion step, after this ability (docs/phase7-wave6.md §3.19); the loss is
 * checked as soon as the stage is in the display, before the advance.
 */
const stageWhenCompleted = () =>
  whenCompleted(
    addMainSchemeStageToVictoryDisplay(),
    ifThen(valueAtLeast(victoryDisplayCount(query("mainScheme")), 3), endGame("loss", "mainSchemeCompleted")),
  );

/** Each stage 2A's "When Revealed: Flip this card." The engine flips every revealed A side itself. */
const flipsItself = () => coveredByEngineRule();

/**
 * "Each ... gains toughness" gives the tough status card as a card **enters** play (RRG 1.8 "Toughness", p. 45), so it
 * does not reach allies or minions already in play when The Basketball Court becomes the main scheme.
 */
const EVERY_CHARACTER = query("character");

/** Beyond a villain's own text, the four Brotherhood villains' titles are what Save the School looks for among minions. */
const sameTitleMinionDealtWith = (name: string) =>
  ifThen(
    exists(query("villain", { name })),
    forEachPlayer(
      eachPlayer,
      ifThen(exists(query("minion", { name, engagedWithPlayer: thatPlayer })), [
        discard(each(query("minion", { name, engagedWithPlayer: thatPlayer }))),
        enemyActivates(theVillain, { against: thatPlayer }),
      ]),
    ),
  );

/**
 * The Mansion Attack scenario's own encounter set (`mut_gen` 32121-32137, MC32 p. 15, docs/phase7-wave6.md §1.4/§1.5,
 * §2.2): the four Brotherhood villains in a standard (a, 32121a-32124a) and an expert (b) version each, the main scheme
 * The Brotherhood Strikes! (32125a, one card with five stages: 1A/1B and four alternative stage 2s), Save the School,
 * Brotherhood Beatdown, the four activation treacheries, Protect the Students and Under Siege. Not the Brotherhood or
 * Mystique modular sets (the Brotherhood minions 32073-32076 are that set's).
 *
 * **The villain deck** is the scenario builder's (`../setup.ts`): the villains are shuffled, the top one starts in play
 * (`randomStartingVillain`), the others start set aside, and expert mode swaps in each B card (`expertVillains`).
 * Save the School brings in the next, at random, from the set-aside area. **The main scheme deck**: 1A's Setup shuffles
 * the four stage 2s (`shuffleMainSchemeStages`, docs/phase7-wave6.md §3.18); 1B and each 2B add themselves to the
 * victory display, and three main schemes there (1B counts as one) lose the game (§3.19).
 */
export const MANSION_ATTACK_ABILITIES = defineAbilities({
  "32121a.avalanche-forced-response": avalancheForcedResponse(),
  "32121b.avalanche-forced-response": avalancheForcedResponse(),
  "32122a.blob-forced-response": blobForcedResponse(),
  "32122b.blob-forced-response": blobForcedResponse(),
  "32123a.pyro-forced-response": pyroForcedResponse(),
  "32123b.pyro-forced-response": pyroForcedResponse(),
  "32124a.toad-forced-response": toadForcedResponse(),
  "32124b.toad-forced-response": toadForcedResponse(),

  // The Brotherhood Strikes! 1A — Setup: Put the Save the School environment into play. Shuffle all copies of main
  // scheme 2A and stack them under this scheme. (The villain deck is the scenario's `randomStartingVillain`.)
  "32125a.setup": setup(
    selectCards("school", encounterCards(["deck"], { name: "Save the School" })),
    putIntoPlay(chosen("school"), firstPlayer),
    shuffleEncounterDeck(),
    shuffleMainSchemeStages(1),
  ),
  // 1B — When Revealed: Deal each player a facedown encounter card. Advance to the next card in the main scheme deck.
  // Add this card to the victory display. (The card goes first: after the advance "this card" would be the next stage.)
  "32125b.when-revealed": whenRevealed(
    dealEncounterCard(eachPlayer),
    addMainSchemeStageToVictoryDisplay(),
    advanceMainScheme(),
  ),

  // The Atrium (stage 2): Each character gains steady.
  "32126a.when-revealed": flipsItself(),
  "32126b.the-atrium-constant": constant(gainsKeyword({ name: "steady" }, EVERY_CHARACTER)),
  "32126b.when-completed": stageWhenCompleted(),
  "32126b.the-atrium-constant-2": partOf("32126b.when-completed"),
  // The Cafeteria: Each character gains retaliate 1.
  "32127a.when-revealed": flipsItself(),
  "32127b.the-cafeteria-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, EVERY_CHARACTER)),
  "32127b.when-completed": stageWhenCompleted(),
  "32127b.the-cafeteria-constant-2": partOf("32127b.when-completed"),
  // The Basketball Court: Each ally and minion gains toughness.
  "32128a.when-revealed": flipsItself(),
  "32128b.the-basketball-court-constant": constant(gainsKeyword({ name: "toughness" }, query(["ally", "minion"]))),
  "32128b.when-completed": stageWhenCompleted(),
  "32128b.the-basketball-court-constant-2": partOf("32128b.when-completed"),
  // The Courtyard: Each character gains +1 ATK.
  "32129a.when-revealed": flipsItself(),
  "32129b.the-courtyard-constant": constant(gets("atk", 1, EVERY_CHARACTER)),
  "32129b.when-completed": stageWhenCompleted(),
  "32129b.the-courtyard-constant-2": partOf("32129b.when-completed"),

  // Save the School (32130) — Forced Response: After the villain is defeated, if there are X villains in the victory
  // display, the players win the game. Otherwise, deal each player an encounter card and reveal the next villain. If a
  // minion with the same title as the new villain is engaged with a player, discard that minion and the villain
  // activates against that player. (The card names no title, so the four are checked one by one.)
  "32130.save-the-school-forced-response": forcedResponse(
    on.defeated(THE_VILLAINS),
    ifThen(valueAtLeast(victoryDisplayCount(THE_VILLAINS), victoryCondition), endGame("win"), [
      dealEncounterCard(eachPlayer),
      selectCards("next", encounterSetAside(THE_VILLAINS, { random: 1 })),
      addVillain(chosen("next"), { reveal: true }),
      ...TITLES.map(sameTitleMinionDealtWith),
    ]),
  ),

  // Brotherhood Beatdown (32131) — When Revealed: For each of the following enemies in play: Avalanche, exhaust your
  // identity. Blob, you are stunned. Pyro, take 2 indirect damage. Toad, discard 1 random card from your hand.
  "32131.when-revealed": whenRevealed(
    ifThen(exists(enemyNamed("Avalanche")), exhaust(yourIdentity)),
    ifThen(exists(enemyNamed("Blob")), stun(yourIdentity)),
    ifThen(exists(enemyNamed("Pyro")), dealIndirectDamage(you, 2)),
    ifThen(exists(enemyNamed("Toad")), discardAtRandom(1, you)),
  ),
  "32131.brotherhood-beatdown-constant": partOf("32131.when-revealed"),
  "32131.brotherhood-beatdown-constant-2": partOf("32131.when-revealed"),
  "32131.brotherhood-beatdown-constant-3": partOf("32131.when-revealed"),
  "32131.brotherhood-beatdown-constant-4": partOf("32131.when-revealed"),

  // Ground Swell / Immovable / Pyromaniac / Hopping Mad (32132-32135).
  "32132.when-revealed": activatesOrSearch("Avalanche"),
  "32132.boost": extraBoostIfVillain("Avalanche"),
  "32133.when-revealed": activatesOrSearch("Blob"),
  "32133.boost": extraBoostIfVillain("Blob"),
  "32134.when-revealed": activatesOrSearch("Pyro"),
  "32134.boost": extraBoostIfVillain("Pyro"),
  "32135.when-revealed": activatesOrSearch("Toad"),
  "32135.boost": extraBoostIfVillain("Toad"),

  // Protect the Students (32136) — Hinder 2[per_hero] (data). When Defeated: The player who defeated this scheme
  // searches their deck and discard pile for an ally and adds it to their hand. (Shuffle after a deck search: RRG 1.8
  // "Search", p. 39.)
  "32136.when-defeated": whenDefeated(
    chooseCards("ally", zone(["deck", "discard"], defeatingPlayer, { filter: query("ally") }), {
      min: 1,
      max: 1,
      chooser: defeatingPlayer,
    }),
    moveCards(cards(chosen("ally")), "hand"),
    shuffleDeck(defeatingPlayer),
  ),

  // Under Siege (32137) — When Revealed: Place 3 threat on this scheme for each Brotherhood of Mutants character in play.
  "32137.when-revealed": whenRevealed(
    placeThreat(scaled(countOf(query("character", { trait: BROTHERHOOD })), { times: 3 }), self),
  ),
});
