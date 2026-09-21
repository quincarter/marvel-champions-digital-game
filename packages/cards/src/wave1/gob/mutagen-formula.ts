import {
  after,
  bindTargets,
  boost,
  cards,
  chooseOne,
  chosen,
  constant,
  countOf,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discard,
  eachPlayer,
  enemyAttack,
  enemyScheme,
  encounterCards,
  engagedPlayerOf,
  exists,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  gets,
  hasStatus,
  heroAction,
  identityOf,
  ifThen,
  isAlterEgo,
  modifyAttack,
  moveCards,
  not,
  option,
  placeThreat,
  putIntoPlay,
  query,
  scaled,
  self,
  selectCards,
  setup,
  shuffleEncounterDeck,
  spend,
  stun,
  surge,
  takeDamage,
  thatPlayer,
  theMainScheme,
  theVillain,
  varAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import {
  atEndOfActivation,
  dealIndirectDamage,
  discardEncounterCards,
  enemyAttackNoBoost,
  firstOf,
  GOBLIN_TRAIT,
  isAttached,
  refMatchesAnywhere,
  villainStageNumberOf,
  whenCompleted,
} from "./local.js";

const GOBLIN_ENEMY = query(["enemy"], { trait: GOBLIN_TRAIT });
const GOBLIN_MINION = query(["minion"], { trait: GOBLIN_TRAIT });

/**
 * Mutagen Formula: Green Goblin (02014), Unleashing the Mutagen / Mutagen Cloud (02017a), Goblin Glider (02019),
 * Hysteria (02020), Pumpkin Bombs (02021), Goblin Knight (02022), Goblin Soldier (02023), Goblin Thrall (02024),
 * Monster (02025), Goblin Reinforcements (02026), Goblin Nation (02027), Overrun (02028), Death from Above (02029),
 * I See You (02030), Overconfidence (02031), Wicked Ambitions (02032).
 */
export const MUTAGEN_FORMULA = defineAbilities({
  // Green Goblin (I) — [star] Forced Response: After Green Goblin attacks and damages you, place 1 threat on the main scheme.
  "02014.green-goblin-forced-response": forcedResponse(
    after.villainAttacks({ againstYou: true, damages: true }),
    placeThreat(1, theMainScheme),
  ),
  // Green Goblin (II) — When Revealed: Deal 2 encounter cards to each player. Same Forced Response as (I).
  "02015.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, dealEncounterCard(thatPlayer), dealEncounterCard(thatPlayer)),
  ),
  "02015.green-goblin-forced-response": forcedResponse(
    after.villainAttacks({ againstYou: true, damages: true }),
    placeThreat(1, theMainScheme),
  ),
  // Green Goblin (III) — When Revealed: Deal 3 encounter cards to each player. Forced Response: place 2 threat.
  "02016.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      dealEncounterCard(thatPlayer),
      dealEncounterCard(thatPlayer),
      dealEncounterCard(thatPlayer),
    ),
  ),
  "02016.green-goblin-forced-response": forcedResponse(
    after.villainAttacks({ againstYou: true, damages: true }),
    placeThreat(2, theMainScheme),
  ),

  // Unleashing the Mutagen 1A — Setup: Put a Goblin Thrall minion into play engaged with each player (found in the
  // encounter deck, RRG 1.8 "Find", p. 19 — a fresh copy per player). `putIntoPlay`'s controller is `thatPlayer`,
  // not `you`: `forEachPlayer` sets `scopedPlayerId` per iteration for `thatPlayer` to read, but never rebinds
  // `you`/`controller` itself (`resolve/apply-effect.ts`'s `forEachPlayer` case keeps `controllerId: frame.
  // controllerId` unchanged) — so `you` inside a `forEachPlayer` body still means the ability's *original*
  // controller for every iteration, not the iterated player. Shuffle the encounter deck.
  "02017a.setup": setup(
    forEachPlayer(
      eachPlayer,
      selectCards("gt", encounterCards(["deck"], { name: "Goblin Thrall" })),
      bindTargets("firstGt", firstOf(chosen("gt"))),
      putIntoPlay(chosen("firstGt"), thatPlayer),
    ),
    shuffleEncounterDeck(),
  ),
  // Unleashing the Mutagen 1B — When Completed: In player order, each player not engaged with a Goblin minion must
  // discard 3 cards from the encounter deck and put the first Goblin minion they discarded this way into play
  // engaged with them. `TargetQuery.engagedWithPlayer` (not the "you"/"any"-only `engagedWith`) is what makes "not
  // engaged with a Goblin minion" checkable per iterated player inside `forEachPlayer`.
  "02017b.when-completed": whenCompleted(
    forEachPlayer(
      eachPlayer,
      ifThen(not(exists({ categories: ["minion"], trait: GOBLIN_TRAIT, engagedWithPlayer: thatPlayer })), [
        discardEncounterCards(3, { bind: "um" }),
        selectCards("umGoblins", cards(chosen("um"), GOBLIN_MINION)),
        bindTargets("firstUm", firstOf(chosen("umGoblins"))),
        putIntoPlay(chosen("firstUm"), thatPlayer),
      ]),
    ),
  ),
  // Mutagen Cloud 2A — When Revealed: Advance to stage 2B (implicit, klaw.ts/rhino.ts convention).
  "02018a.when-revealed": whenRevealed(),
  // Mutagen Cloud 2B — X is equal to the number of Goblin enemies (including Green Goblin) in play (`printedX`,
  // content data — `stages[1].printedX === ["acceleration"]`). "If this stage is completed, the players lose the
  // game" is a scenario/data rule with no ability of its own (Hostile Takeover 2B's identical empty `abilities: []`).
  "02018b.mutagen-cloud-constant": constant(
    gets("acceleration", countOf(GOBLIN_ENEMY), { self: true }, { setBase: true }),
  ),

  // Goblin Glider — Attach per `attachesTo` (data/engine, docs/phase7-wave1.md §3.14). When Revealed: if you
  // cannot, this card gains surge (`Predicate.isAttached`, landed against this exact card).
  "02019.goblin-glider-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  "02019.goblin-glider-action": heroAction({ cost: spend({ energy: 2 }) }, discard(self)),

  // Hysteria — Attach to Green Goblin (data). [star] Forced Interrupt: When Green Goblin schemes or attacks, give
  // him 1 additional boost card for that activation. `"host"`: the attached villain, per `Who`'s convention.
  "02020.hysteria-forced-interrupt": forcedInterrupt(
    when.enemySchemesOrAttacks("host"),
    modifyAttack({ extraBoostCards: 1 }),
  ),
  "02020.hysteria-action": heroAction({ cost: spend({ mental: 2 }) }, discard(self)),

  // Pumpkin Bombs — Attach to the villain (data). [star] Forced Response: After the villain attacks you, discard
  // Pumpkin Bombs and take 2 indirect damage.
  "02021.pumpkin-bombs-forced-response": forcedResponse(
    after.villainAttacks({ againstYou: true }),
    discard(self),
    dealIndirectDamage(2, you),
  ),
  "02021.pumpkin-bombs-action": heroAction({ cost: spend({ physical: 2 }) }, discard(self)),

  // Goblin Knight — Elite, Goblin (data). [star] Forced Response: After Goblin Knight attacks you, discard 1 card
  // from the encounter deck. If that card is a Goblin minion, put it into play engaged with you.
  "02022.goblin-knight-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    discardEncounterCards(1, { bind: "gk" }),
    ifThen(refMatchesAnywhere(chosen("gk"), GOBLIN_MINION), putIntoPlay(chosen("gk"), you)),
  ),
  // [star] Boost: After this activation ends, shuffle this card into the encounter deck.
  "02022.boost": boost(atEndOfActivation(moveCards(cards(self), "encounterDeckShuffle"))),

  // Goblin Soldier — Goblin (data). When Defeated: Deal 1 damage to the engaged player. [star] Boost: Put Goblin
  // Soldier into play engaged with you.
  "02023.when-defeated": whenDefeated(dealDamage(1, identityOf(engagedPlayerOf(self)))),
  "02023.boost": boost(putIntoPlay(self, you)),

  // Goblin Thrall — Guard, Goblin (data). [star] Boost: Put Goblin Thrall into play engaged with you.
  "02024.boost": boost(putIntoPlay(self, you)),

  // Monster — Elite, Goblin (data). When Revealed: You are stunned. If you are already stunned, take 2 damage.
  // [star] Boost: After this activation ends, shuffle this card into the encounter deck.
  "02025.when-revealed": whenRevealed(ifThen(hasStatus(yourIdentity, "stunned"), takeDamage(2), stun(yourIdentity))),
  "02025.boost": boost(atEndOfActivation(moveCards(cards(self), "encounterDeckShuffle"))),

  // Goblin Reinforcements — When Revealed: Place 1 additional threat here for each Goblin minion in play.
  "02026.when-revealed": whenRevealed(placeThreat(countOf(GOBLIN_MINION), self)),

  // Goblin Nation — Each Goblin enemy (including Green Goblin) gets +1 ATK. [star] Boost: Put Goblin Nation into play.
  "02027.goblin-nation-constant": constant(gets("atk", 1, GOBLIN_ENEMY)),
  "02027.boost": boost(putIntoPlay(self, you)),

  // Overrun — When Defeated: In player order, each player must discard 2 cards from the encounter deck and put each
  // Goblin minion they discarded this way into play engaged with them (every match, not just the first).
  "02028.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      discardEncounterCards(2, { bind: "ov" }),
      selectCards("ovGoblins", cards(chosen("ov"), GOBLIN_MINION)),
      putIntoPlay(chosen("ovGoblins"), thatPlayer),
    ),
  ),

  // Death from Above — When Revealed (Alter-Ego): Green Goblin schemes with +X SCH, where X is the villain's stage
  // number. `enemyScheme`'s own `schBonus` (docs/phase7-wave1-scripting.md §6) carries the bonus with exactly the
  // activation this effect initiates, evaluated once. **Not** `modifyStat(..., theVillain, "endOfPhase")` — the
  // previous stand-in here, which was a proven bug: it buffed every *other* activation in the same phase too, so
  // two copies of this card revealed in one phase (2+ players, or a surge chain) made the second activation +2X,
  // and a copy revealed in the player phase left the villain buffed into the villain phase.
  "02029.when-revealed-alter-ego": whenRevealedAlterEgo(
    enemyScheme(theVillain, { against: you, schBonus: villainStageNumberOf(theVillain) }),
  ),
  // When Revealed (Hero): Green Goblin attacks with +X ATK, X = the villain's stage number.
  "02029.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, atkBonus: villainStageNumberOf(theVillain) }),
  ),

  // I See You — When Revealed: Green Goblin attacks you. If you are in alter-ego form, do not give the villain a
  // boost card for this activation (`EffectSpec.enemyAttack.boost: false`, documented against this exact card).
  "02030.when-revealed": whenRevealed(
    ifThen(isAlterEgo(), enemyAttackNoBoost(theVillain, you), enemyAttack(theVillain, { against: you })),
  ),
  // [star] Boost: This card gets +1 boost icon if at least one Goblin minion is engaged with you — a constant
  // modifier read while the card is still sitting in the deck as a boost-card candidate (docs/phase7-wave1.md §3.9,
  // `boostIconsFor`). The card data's ability id ends in "-boost", but (like Oscorp Manufacturing's "-constant" and
  // Mad Genius's "-constant") that is an ingestion-naming artifact, not the trigger kind this needs.
  "02030.boost": constant(
    gets(
      "boostIcons",
      1,
      { self: true },
      { while: exists({ categories: ["minion"], trait: GOBLIN_TRAIT, engagedWith: "you" }) },
    ),
  ),

  // Overconfidence — When Revealed (Alter-Ego): Green Goblin schemes. If at least 3 threat was placed by this
  // activation, this card gains surge.
  "02031.when-revealed-alter-ego": whenRevealedAlterEgo(
    enemyScheme(theVillain, { against: you, bind: "oc" }),
    ifThen(varAtLeast("oc.threatPlaced", 3), surge()),
  ),
  // When Revealed (Hero): Green Goblin attacks you. If at least 3 damage was placed (dealt) by this activation, this card gains surge.
  "02031.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, bind: "oc2" }),
    ifThen(varAtLeast("oc2.damage", 3), surge()),
  ),

  // Wicked Ambitions — When Revealed: Discard X cards from the encounter deck, X = double the villain's stage
  // number. Each time a Goblin minion is discarded this way, choose to either take 3 damage or put that minion into
  // play engaged with you (`EffectSpec.discardEncounterCards.forEachDiscarded`, documented against this exact card).
  "02032.when-revealed": whenRevealed(
    discardEncounterCards(scaled(villainStageNumberOf(theVillain), { times: 2 }), {
      forEachDiscarded: {
        slot: "wa",
        effects: [
          ifThen(
            refMatchesAnywhere(chosen("wa"), GOBLIN_MINION),
            chooseOne(
              option("Take 3 damage", takeDamage(3)),
              option("Put that minion into play engaged with you", putIntoPlay(chosen("wa"), you)),
            ),
          ),
        ],
      },
    }),
  ),
});
