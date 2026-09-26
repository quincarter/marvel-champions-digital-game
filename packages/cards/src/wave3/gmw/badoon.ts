import {
  andThen,
  activationIs,
  addCounters,
  adjustBoostCount,
  attacksGainKeywords,
  boost,
  choosePlayer,
  chooseOne,
  chooseTarget,
  chosen,
  chosenPlayer,
  constant,
  countersOn,
  countOf,
  dealDamage,
  dealEncounterCard,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardEncounterCards,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  exhaustCardsCost,
  exists,
  firstPlayerAction,
  firstPlayer,
  forcedResponse,
  forEachPlayer,
  gainsKeyword,
  giveTough,
  hasStatus,
  heroAction,
  ifThen,
  inPlay,
  isHero,
  modifyAttack,
  not,
  on,
  option,
  perHero,
  putIntoPlay,
  query,
  refMatches,
  removeCountersFrom,
  removeThreat,
  resolveSpecials,
  searchAndReveal,
  selectCards,
  self,
  setup,
  special,
  spend,
  superlativePlayer,
  thatPlayer,
  theVillain,
  valueAtLeast,
  whenRevealed,
  you,
  enemyAttack,
  giveBoostCard,
} from "../../dsl/index.js";

/**
 * Brotherhood of Badoon: the villain Drang (16058–16060), the main scheme Terrestrial Invasion / Protect the
 * Planet (16061–16062), Badoon Ship (16063), Drang's Spear (16064), Badoon Engineer (16065), the side schemes
 * Blockade/Bombardment/Oppressive Armada/Spatial Positioning (16066–16069), and the Band of Badoon modular set
 * (Badoon Assassin/Grunt/Lieutenant/Sentry/Warlord, 16117–16121).
 *
 * `16060.when-revealed` ("Discard the top 4[per_hero] cards of the encounter deck. Each time a minion is discarded
 * this way, put it into play engaged with the player who is engaged with the fewest minions.") was recorded as a
 * primitive gap — the DSL's `superlative` only ranked *cards*, not players by a per-player count. Closed by
 * `PlayerRef superlative`/`choosePlayer.among` (docs/phase7-wave3.md §3.35). Re-ranked fresh for each discarded
 * minion, since `forEachDiscarded` runs its effects once per card and each run resolves fully before the next
 * starts; a tie goes to the first player among the tied ones (RRG 1.8 "First Player", p. 19).
 */

const chargeUp = () => resolveSpecials(query("environment", { name: "Badoon Ship" }));
const exhaustMilano = exhaustCardsCost(query("support", { name: "Milano" }));

export const BADOON = defineAbilities({
  // Drang I — [star] Forced Response: After Drang schemes, resolve the Badoon Ship's "Charge Up" ability.
  "16058.drang-forced-response": forcedResponse(on.enemySchemes("self"), chargeUp()),

  // Drang II — When Revealed: If Drang's Spear is in play, give Drang 1 facedown boost card; otherwise, search the
  // encounter deck and discard pile for Drang's Spear, reveal it, and shuffle the encounter deck.
  "16059.when-revealed": whenRevealed(
    ifThen(inPlay("Drang's Spear"), giveBoostCard(theVillain), searchAndReveal("Drang's Spear")),
  ),
  // Drang II — [star] Forced Response: After Drang schemes, resolve the Badoon Ship's "Charge Up" ability.
  "16059.drang-forced-response": forcedResponse(on.enemySchemes("self"), chargeUp()),

  // Drang III — When Revealed: Discard the top 4[per_hero] cards of the encounter deck. Each time a minion is
  // discarded this way, put it into play engaged with the player who is engaged with the fewest minions.
  "16060.when-revealed": whenRevealed(
    discardEncounterCards(perHero(4), {
      forEachDiscarded: {
        slot: "discarded",
        effects: [
          ifThen(refMatches(chosen("discarded"), query("minion"), { anywhere: true }), [
            choosePlayer("fewest", firstPlayer, {
              among: superlativePlayer("lowest", countOf(query("minion", { engagedWithPlayer: thatPlayer }))),
            }),
            putIntoPlay(chosen("discarded"), chosenPlayer("fewest")),
          ]),
        ],
      },
    }),
  ),
  // Drang III — [star] Forced Response: After Drang activates, resolve the Badoon Ship's "Charge Up" ability.
  "16060.drang-forced-response": forcedResponse(on.enemySchemesOrAttacks("self"), chargeUp()),

  // Terrestrial Invasion 1A — Setup: Put the Badoon Ship environment and the Milano support into play. Badoon Ship
  // starts in the encounter deck (found by name there); the Milano is a scenario-specific card that starts set
  // aside (`../setup.ts`'s `scenarioSpecificSetAside`), found by name in the set-aside area instead.
  "16061a.setup": setup(
    selectCards("ship", encounterCards(["deck"], { name: "Badoon Ship" })),
    putIntoPlay(chosen("ship"), firstPlayer),
    selectCards("milano", encounterSetAside({ name: "Milano" })),
    putIntoPlay(chosen("milano"), firstPlayer),
  ),
  // Terrestrial Invasion 1B — [star] Forced Response: After resolving step one of the villain phase, resolve the
  // Badoon Ship's "Charge Up" ability.
  "16061b.terrestrial-invasion-forced-response": forcedResponse(on.villainStepResolved(), chargeUp()),
  // Terrestrial Invasion 1B — First Player Action: Exhaust the Milano → remove 3 threat from this scheme.
  "16061b.terrestrial-invasion-constant": firstPlayerAction({ cost: exhaustMilano }, removeThreat(3, self)),

  // Protect the Planet 2A — When Revealed: Resolve the Badoon Ship's "Charge Up" ability.
  "16062a.when-revealed": whenRevealed(chargeUp()),
  // Protect the Planet 2B — [star] Forced Response: After resolving step one of the villain phase, resolve the
  // Badoon Ship's "Charge Up" ability.
  "16062b.protect-the-planet-forced-response": forcedResponse(on.villainStepResolved(), chargeUp()),
  // Protect the Planet 2B — First Player Action: Exhaust the Milano → choose to either remove 3 threat from this
  // scheme or deal 3 damage to a minion. ("If this stage is completed, the players lose the game" is the RRG 1.8
  // "Villain Defeat" (p. 47) default rule for a main scheme's final stage completing — no ability ref for it, and
  // none is printed in `abilities` for 16062b either.)
  "16062b.protect-the-planet-constant": firstPlayerAction(
    { cost: exhaustMilano },
    chooseOne(
      option("Remove 3 threat from this scheme", removeThreat(3, self)),
      option("Deal 3 damage to a minion", chooseTarget("target", query("minion")), dealDamage(3, chosen("target"))),
    ),
  ),

  // Badoon Ship — Charge Up — Special: Place 1 barrage counter here. Then, if there are 4 or more barrage counters
  // here, deal 2 indirect damage to each player and remove all barrage counters from here.
  // The pre-"then" text is the placement, which always resolves; the threshold "if" is post-"then" text and gates
  // itself (RRG 1.8 "'Then'", p. 44).
  "16063.charge-up": special(
    addCounters("barrage", 1, self),
    andThen(
      ifThen(valueAtLeast(countersOn(self, "barrage"), 4), [
        forEachPlayer(eachPlayer, dealIndirectDamage(thatPlayer, 2)),
        removeCountersFrom(self, "barrage", countersOn(self, "barrage")),
      ]),
    ),
  ),

  // Drang's Spear — Attach to Drang (data-driven). Drang gains stalwart.
  "16064.drangs-spear-constant": constant(gainsKeyword({ name: "stalwart" }, { hostOfSelf: true })),
  // Drang's Spear — Hero Action: Spend [mental][physical][physical] resources → discard this card.
  "16064.drangs-spear-action": heroAction({ cost: spend({ mental: 1, physical: 2 }) }, discard(self)),

  // Badoon Engineer — [star] Forced Response: After Badoon Engineer engages you or activates against you, resolve
  // the Badoon Ship's "Charge Up" ability.
  "16065.badoon-engineer-forced-response": forcedResponse(
    { on: ["minionEngaged", "enemyAttack", "enemyScheme"], selfIs: "source" },
    chargeUp(),
  ),
  // Badoon Engineer — [star] Boost: Resolve the Badoon Ship's "Charge Up" ability.
  "16065.boost": boost(chargeUp()),

  // Blockade — Hinder 2[per_hero] (data-driven). First Player Action: Exhaust the Milano → remove 3 threat from
  // this scheme.
  "16066.blockade-constant": firstPlayerAction({ cost: exhaustMilano }, removeThreat(3, self)),

  // Bombardment — Forced Response: After resolving step one of the villain phase, resolve the Badoon Ship's
  // "Charge Up" ability.
  "16067.bombardment-forced-response": forcedResponse(on.villainStepResolved(), chargeUp()),
  // Bombardment — First Player Action: Exhaust the Milano → remove 3 threat from this scheme.
  "16067.bombardment-constant": firstPlayerAction({ cost: exhaustMilano }, removeThreat(3, self)),

  // Oppressive Armada — Hinder 3[per_hero] (data-driven). First Player Action: Exhaust the Milano → remove 3
  // threat from this scheme.
  "16068.oppressive-armada-constant": firstPlayerAction({ cost: exhaustMilano }, removeThreat(3, self)),

  // Spatial Positioning — First Player Action: Exhaust the Milano → remove 3 threat from this scheme.
  "16069.spatial-positioning-constant": firstPlayerAction({ cost: exhaustMilano }, removeThreat(3, self)),

  // Band of Badoon (modular) --------------------------------------------------------------------------------

  // Badoon Assassin — Forced Response: After Badoon Assassin engages your hero, it attacks you with +2 ATK.
  "16117.badoon-assassin-forced-response": forcedResponse(
    { on: "minionEngaged", selfIs: "source" },
    ifThen(isHero(), enemyAttack(self, { against: you, atkBonus: 2 })),
  ),
  // Badoon Assassin — [star] Boost: If this activation is an attack, this attack gains overkill, piercing, and
  // ranged.
  "16117.boost": boost(ifThen(activationIs("attack"), modifyAttack({ keywords: ["overkill", "piercing", "ranged"] }))),

  // Badoon Grunt — Forced Response: After Badoon Grunt engages you, if there are no other minions engaged with
  // you, deal yourself 1 facedown encounter card.
  "16118.badoon-grunt-forced-response": forcedResponse(
    { on: "minionEngaged", selfIs: "source" },
    ifThen(not(exists(query("minion", { engagedWith: "you", excluding: self }))), dealEncounterCard(you)),
  ),
  // Badoon Grunt — [star] Boost: Put Badoon Grunt into play engaged with you.
  "16118.boost": boost(putIntoPlay(self, you)),

  // Badoon Lieutenant — Patrol (data-driven). [star] Boost: If this activation is a scheme, this card gets +2
  // boost icons for this activation.
  "16119.boost": boost(ifThen(activationIs("scheme"), adjustBoostCount(2))),

  // Badoon Sentry — Retaliate 1 (data-driven). [star] Boost: Give the villain a tough status card. If the villain
  // already has a tough status card, this card gets +2 boost icons for this activation. (Checked before the give,
  // so it reads whether the villain *already* had one.)
  "16120.boost": boost(ifThen(hasStatus(theVillain, "tough"), adjustBoostCount(2)), giveTough(theVillain)),

  // Badoon Warlord — [star] Badoon Warlord's attacks gain overkill.
  "16121.badoon-warlord-constant": constant(attacksGainKeywords(["overkill"], { attacker: { self: true } })),
  // Badoon Warlord — [star] Boost: If this activation is an attack, this card gets +2 boost icons for this
  // activation.
  "16121.boost": boost(ifThen(activationIs("attack"), adjustBoostCount(2))),
});
