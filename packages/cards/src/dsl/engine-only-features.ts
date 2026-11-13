import type { AbilityRegistry } from "@mc/engine";
import { trait } from "@mc/content";
import {
  action,
  activatesBeforeVillain,
  agile,
  boost,
  boostIconsCount,
  cannotBeAttachedUnlessInPlay,
  cannotHaveStatus,
  constant,
  costModifier,
  discardThis,
  response,
  doubleStat,
  forcedInterrupt,
  forcedResponse,
  heroInterrupt,
  ignoreBoostAbilities,
  minDamageTaken,
  on,
  resourcesGeneratedAsWild,
  setAsideDestination,
  tagged,
  upgradesCannotBeRemoved,
} from "./abilities.js";
import {
  applyRuleUntil,
  blankTextBoxForPlayers,
  cancelBoostedActivation,
  cancelIt,
  cards,
  dealDamage,
  discard,
  doubleNextCardSpent,
  enemyActivates,
  draw,
  enemyAttacksEnemy,
  findCard,
  giveBasicPowerBoostCard,
  instead,
  loseKeywordUntil,
  loseTraitUntil,
  modifyAttack,
  moveCards,
  putIntoPlayFacedown,
  replaceNextVillainPhaseWithPlayerPhase,
  resolveOneTagged,
  resolveTagged,
  scenarioArea,
  selectCards,
  topOfDeck,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  attackInProgress,
  chosen,
  each,
  eachPlayer,
  eventPlayer,
  eventTarget,
  hasTaggedAbility,
  lastPlayedThisRound,
  query,
  self,
  statOf,
  taggedAbilitiesOn,
  theVillain,
  you,
  YOUR_IDENTITY,
} from "./values.js";

/**
 * DSL shapes the engine supports that no base card uses yet, so the mod SDK's feature walk over the base registry
 * (`dslFeatures(PLAYABLE_DEPS.abilities)`, `SUPPORTED_DSL_FEATURES`) would not find them, and a custom-content pack that
 * uses them would be refused by a client that can run it (docs/custom-content-packs.md §6, §11.2). One small example
 * definition per primitive, built with the same builders a pack script uses; the SDK walks these with the base
 * registry. Never registered with the engine: no card id here is a real card, and nothing plays them.
 *
 * Add an entry with each engine primitive that lands for custom content before any base card uses it; it can go once a
 * base card does.
 */
export const ENGINE_ONLY_DSL_EXAMPLES: AbilityRegistry = {
  // Agile X: "reduce damage taken from undefended villain and villainous attacks by X" (`reduceDamageTaken`'s
  // `onlyUndefended` and `onlyAttacker`).
  "engine-only.agile": constant(agile(1, { categories: ["hero"], controller: "you" })),
  // "If the last card you played this round was a [title] event, reduce the cost to play this card by 1"
  // (`Predicate lastPlayedThisRound`).
  "engine-only.last-played": constant(
    costModifier({
      delta: -1,
      appliesTo: { self: true },
      activeIn: "hand",
      while: lastPlayedThisRound(query("event", { identitySetOf: you })),
    }),
  ),
  // "Each player who discarded … may treat this card's printed text box as if it were blank" (`blankTextBox`'s
  // `forPlayers`).
  "engine-only.per-player-blank": action(blankTextBoxForPlayers(self, eachPlayer, "endOfPhase")),
  // "When [your hero] uses a basic power, you may give him a boost card" (`giveBasicPowerBoostCard`).
  "engine-only.basic-power-boost": heroInterrupt(on.basicPowerUsing(YOUR_IDENTITY), giveBasicPowerBoostCard()),
  // A tagged ability with no trigger ("speech bubbles"; `AbilityTriggerSpec special.tag`): "Draw 1 card now".
  "engine-only.tagged": tagged("pinkBubble", draw(1)),
  // "Resolve whatever is written in a PINK BUBBLE in play" (`resolveSpecials` `tag` and `pick: "one"`).
  "engine-only.resolve-one-tagged": action(resolveOneTagged("pinkBubble")),
  // "Remove this card from the game → resolve all the PINK BUBBLES in play", its own included (`of` with `cards`).
  "engine-only.resolve-all-tagged": action(resolveTagged("pinkBubble", { of: self, bind: "bubbles" })),
  // "Deal X damage, where X equals the PINK BUBBLES you control" (`ValueSpec taggedAbilities`).
  "engine-only.tagged-count": action(dealDamage(taggedAbilitiesOn("pinkBubble", { controller: "you" }), theVillain)),
  // "Increase the cost of each card with a PINK BUBBLE you play by 2" (`TargetQuery hasTaggedAbility`).
  "engine-only.has-tagged": constant(
    costModifier({ delta: 2, appliesTo: query("upgrade", { controller: "you", ...hasTaggedAbility("pinkBubble") }) }),
  ),
  // "When the villain phase would begin, instead … start another player phase" (`replaceNextVillainPhaseWithPlayerPhase`).
  "engine-only.extra-player-phase": forcedInterrupt(
    on.phaseBeginning("villain"),
    cancelIt(),
    replaceNextVillainPhaseWithPlayerPhase(),
  ),
  // "[star] Boost: Cancel this activation" (`cancelBoostedActivation`; community pack `mephisto-nep`, Blackheart).
  "engine-only.boost-cancels-activation": boost(cancelBoostedActivation()),
  // "Ignore one keyword or trait on one card until the end of the round" (`grantKeywordUntil` / `grantTraitUntil`'s
  // `loses`).
  "engine-only.lose-keyword": action(loseKeywordUntil({ name: "guard" }, theVillain, "endOfRound")),
  "engine-only.lose-trait": action(loseTraitUntil(trait("ELITE"), theVillain, "endOfRound")),
  // "You cannot flip [a card] until the start of the next villain phase" (`applyRuleUntil` with a `cannotFlip` rule).
  "engine-only.lasting-flip-lock": action(
    applyRuleUntil({ kind: "cannotFlip", target: query("upgrade", { controller: "you" }) }, "nextVillainPhaseBegins"),
  ),
  // "Discard 1 upgrade you control at random" (`CardSelector ref.random`: a seeded random pick among cards in play).
  "engine-only.random-in-play": action(
    selectCards("upgrade", cards(each(query("upgrade", { controller: "you" })), undefined, { random: 1 })),
    discard(chosen("upgrade")),
  ),
  // "Muse attacks … If this attack defeats a character, heal 1 damage from Muse for each point of excess damage":
  // `enemyAttacksEnemy`'s `bind`, read as `<bind>.excessDealt` by what follows in the same replacement.
  "engine-only.enemy-attacks-enemy-bind": forcedInterrupt(
    on.enemyAttacks("self"),
    instead(enemyAttacksEnemy(self, theVillain, { bind: "hit" })),
  ),
  // "Put 1 card from the top of your deck facedown into Damnation" (`moveCards.facedown`, a `{ scenarioArea }`
  // destination; community pack `mephisto-nep`).
  "engine-only.facedown-into-area": action(
    moveCards(topOfDeck(1), { scenarioArea: "Damnation" }, undefined, { facedown: true }),
  ),
  // "Look at 1 card in Damnation → shuffle it back into its owner's deck" (`CardSelector scenarioArea.random`).
  "engine-only.random-from-area": action(moveCards(scenarioArea("Damnation", undefined, { random: 1 }), "deckShuffle")),
  // "When a card is set aside from a player's deck, put it facedown into Damnation instead" (`RuleSpec
  // setAsideDestination`).
  "engine-only.set-aside-destination": constant(setAsideDestination("Damnation", { facedown: true, from: ["deck"] })),
  // "Double the THW value of your identity" (`RuleSpec multiplyStat`).
  "engine-only.double-stat": constant(doubleStat("thw", YOUR_IDENTITY)),
  // "Your identity cannot take damage less than its DEF from each attack" (`RuleSpec minDamageTakenPerAttack`).
  "engine-only.min-damage-taken": constant(
    minDamageTaken(YOUR_IDENTITY, statOf({ kind: "slot", slot: "affected" }, "def")),
  ),
  // "Each resource you generate is considered a wild resource" (`RuleSpec resourcesGeneratedAsWild`).
  "engine-only.resources-as-wild": constant(resourcesGeneratedAsWild(you)),
  // "Put the top card of your discard pile facedown engaged with you as a Mystic minion" (`putIntoPlayFacedown.from`).
  "engine-only.facedown-from-discard": action(
    putIntoPlayFacedown(you, { kind: "minion", traits: [trait("MYSTIC")] }, 1, { from: "discard" }),
  ),
  // "When a card is put into Damnation from a player's deck, put 1 additional card into Damnation from that player's
  // deck" (`TriggerEvent cardPutIntoScenarioArea`).
  "engine-only.put-into-area": forcedResponse(
    on.cardPutIntoScenarioArea("Damnation", { from: "deck", notFromSelf: true }),
    moveCards(topOfDeck(1, eventPlayer), { scenarioArea: "Damnation" }, undefined, { facedown: true }),
  ),
  // "Discard this card → Mephisto activates against you. Apply this card's boost icons for this activation as if it
  // were a boost card" (`enemyActivation.boostCards`).
  "engine-only.activation-boost-card": response(
    on.yourTurnBegins(),
    { cost: discardThis },
    enemyActivates(theVillain, { against: you, boostCards: self }),
  ),
  // "Yaka Arrow cannot be attached to cards unless it is in play" (`attachedOnlyWhileInPlay`; community pack `yondu-dh`).
  "engine-only.attached-only-in-play": constant(cannotBeAttachedUnlessInPlay),
  // "After the Yaka Arrow upgrade is removed from an enemy, deal 1 damage to that enemy" (`TriggerEvent cardUnattached`).
  "engine-only.card-unattached": response(
    on.cardUnattached(query("upgrade", { name: "Yaka Arrow" }), { from: query("enemy") }),
    dealDamage(1, eventTarget),
  ),
  // "After you spend this card, treat the next card you spend as if it has double the resources" until the end of the
  // round (`RuleSpec doubleNextCardSpent`; community pack `yondu-dh`, Jackpot!).
  "engine-only.double-next-card-spent": response(
    on.youSpendThis(),
    applyRuleUntil(doubleNextCardSpent(), "endOfRound"),
  ),
  // "Upgrades cannot be removed from Sav'rkk" (`RuleSpec cannotLeaveHost`).
  "engine-only.cannot-leave-host": constant(upgradesCannotBeRemoved()),
  // "Summon the Tahlei upgrade and add it to your hand": search everywhere in or out of play (`findCard.anywhere`).
  "engine-only.find-anywhere": action(
    findCard(query("upgrade", { name: "Tahlei" }), "hand", { owner: you, anywhere: true }),
  ),
  // The Punisher community scenario (`punisher-pk`). "Ignore each 'Boost' ability" during his attacks on minions, the
  // icons still counting (`RuleSpec ignoreBoost` `only: "abilities"`).
  "engine-only.ignore-boost-abilities": constant(
    ignoreBoostAbilities(
      { self: true },
      { while: attackInProgress({ attacker: { self: true }, target: query("minion") }) },
    ),
  ),
  // "Each boost icon counts twice during The Punisher's attacks against minions" (`RuleSpec boostIconsMultiplied`).
  "engine-only.boost-icons-multiplied": constant(
    boostIconsCount(2, query("villain"), {
      while: attackInProgress({ attacker: query("villain"), target: query("minion") }),
    }),
  ),
  // "During step 2 of the villain phase, Barracuda activates against you before The Punisher does" (`RuleSpec
  // activatesBeforeVillain`).
  "engine-only.activates-before-villain": constant(activatesBeforeVillain()),
  // "Minions cannot stun him" (`RuleSpec cannotHaveStatus` `from`).
  "engine-only.cannot-have-status-from": constant(cannotHaveStatus(["stunned"], { from: query("minion") })),
  // "When The Punisher attacks Jigsaw, give The Punisher an additional boost card for this attack": an interrupt to an
  // enemy's attack on this card (`on.thisIsAttacked`, heard on `enemyAttacksEnemy`) that gives it another boost card.
  "engine-only.attacked-by-enemy-extra-boost": forcedInterrupt(
    on.thisIsAttacked({ by: query("villain") }),
    modifyAttack({ extraBoostCards: 1 }),
  ),
};

/** Every example is a valid definition (checked by the DSL's own validator, as `defineAbilities` would). */
export const engineOnlyDslProblems = (): readonly string[] =>
  Object.entries(ENGINE_ONLY_DSL_EXAMPLES).flatMap(([id, definition]) =>
    validateDefinition(definition).map((problem) => `${id}: ${problem}`),
  );
