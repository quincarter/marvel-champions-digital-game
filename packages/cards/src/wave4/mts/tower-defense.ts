/**
 * The Mad Titan's Shadow's Tower Defense scenario (docs/phase7-wave4.md §2.2 Tower Defense row, §3.2-§3.5, §3.23):
 * Proxima Midnight, Corvus Glaive, their paired main schemes (Under Siege / The Armies of Thanos, `mts` 21098a/b,
 * 21099a/b), Focused Defense (21101), Avengers Tower (21100a/b) and the Tower Defense encounter set's own modulars
 * (Black Order Besieger 21102, Proxima's Spear 21103, Corvus's Glaive 21104, Direct Assault 21105, Proxima's Power
 * 21106, Corvus's Cunning 21107, Bound by Blood 21108, Rain Fire 21109, City Under Attack 21110).
 *
 * These ability scripts name Proxima Midnight/Corvus Glaive only by printed title (`named("Proxima Midnight")`) or
 * by data field (`villainOf` on the main scheme stages), never by importing the villain cards directly — so they
 * don't care that `villain-merge.ts` (`../mts/tower-defense-setup.ts`'s own import) currently builds those two
 * `VillainCard`s by merging split per-stage records rather than reading them straight from `@mc/content`; see that
 * file's own docblock for the gap and its planned removal.
 */
import {
  allOf,
  atEndOfActivation,
  atEndOfAttack,
  attachCard,
  boost,
  cards,
  chooseCards,
  chooseOne,
  chosen,
  constant,
  coveredByEngineRule,
  damageOn,
  dealDamage,
  dealEncounterCard,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterCards,
  draw,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  endGame,
  enemyAttack,
  eventDealt,
  eventTarget,
  firstPlayer,
  flipCard,
  focusedMainScheme,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  gainsKeyword,
  giveStatus,
  heal,
  heroAction,
  host,
  ifThen,
  instead,
  modifyAttack,
  named,
  on,
  option,
  perHero,
  putIntoPlay,
  putMainSchemeStageIntoPlay,
  query,
  refMatches,
  removeThreat,
  rule,
  self,
  selectCards,
  setup,
  shuffleEncounterDeck,
  spend,
  statOf,
  takeDamageCost,
  takeDamage,
  thatPlayer,
  theVillain,
  threatOn,
  undefendedAttack,
  valueAtLeast,
  varOf,
  when,
  whenDefeated,
  whenRevealed,
  you,
} from "../../dsl/index.js";

// ---------------------------------------------------------------------------
// Ability scripts
// ---------------------------------------------------------------------------

const AVENGERS_TOWER = named("Avengers Tower");
/** "the other villain": whichever villain is not the one currently activating (wave2 §6.8's non-active-villain
 * reading, expressed as a query rather than an `AttachmentHost`, for Proxima's Power/Corvus's Cunning's boost). */
const otherVillain = each(query("villain", { excluding: theVillain }));

/** "Proxima Midnight cannot be defeated while Corvus Glaive has any hit points remaining." / the mirror on Corvus
 * (docs/phase7-wave4.md §3.3: `cannotBeDefeated` with `while: valueAtLeast(remainingHpOf(named(other)), 1)`). */
const protectedWhileOtherHasHp = (otherTitle: string) =>
  constant(
    rule({
      kind: "cannotBeDefeated",
      target: { self: true },
      while: valueAtLeast({ kind: "remainingHp", of: named(otherTitle) }, 1),
    }),
  );

/** "[star] Forced Interrupt: When Proxima Midnight attacks you, choose to either deal 1 damage to Avenger's Tower,
 * or Proxima Midnight gets +2 ATK for this attack." — identical on all three of her stages. */
const proximaForcedInterrupt = () =>
  forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    chooseOne(
      option("Deal 1 damage to Avengers Tower", dealDamage(1, AVENGERS_TOWER)),
      option("Proxima Midnight gets +2 ATK for this attack", modifyAttack({ atkBonus: 2 })),
    ),
  );

/** "[star] Forced Interrupt: After Corvus Glaive makes an undefended attack, discard the top card of the encounter
 * deck → deal 1 damage to Avenger's Tower for each boost icon on that card." — identical on all three stages.
 * Triggers on every attack of his and gates on `undefendedAttack` (the `absorbing-man.ts`/`wrecker.ts` precedent for
 * "makes an undefended attack", rather than trying to filter it out of the trigger itself). */
const corvusForcedInterrupt = () =>
  forcedResponse(
    on.enemyAttacks("self"),
    ifThen(undefendedAttack, [
      discardEncounterCards(1, { bind: "d" }),
      dealDamage(varOf("d.boostIcons"), AVENGERS_TOWER),
    ]),
  );

const towerAtLeast9 = valueAtLeast(damageOn(self), perHero(9));

export const TOWER_DEFENSE = defineAbilities({
  // Proxima Midnight I/II/III — same Forced Interrupt and mutual-protection constant on every stage (§3.3).
  "21092.proxima-midnight-forced-interrupt": proximaForcedInterrupt(),
  "21092.proxima-midnight-constant": protectedWhileOtherHasHp("Corvus Glaive"),
  "21093.proxima-midnight-forced-interrupt": proximaForcedInterrupt(),
  "21093.proxima-midnight-constant": protectedWhileOtherHasHp("Corvus Glaive"),
  "21094.proxima-midnight-forced-interrupt": proximaForcedInterrupt(),
  "21094.proxima-midnight-constant": protectedWhileOtherHasHp("Corvus Glaive"),

  // Corvus Glaive I/II/III.
  "21095.corvus-glaive-forced-interrupt": corvusForcedInterrupt(),
  "21095.corvus-glaive-constant": protectedWhileOtherHasHp("Proxima Midnight"),
  "21096.corvus-glaive-forced-interrupt": corvusForcedInterrupt(),
  "21096.corvus-glaive-constant": protectedWhileOtherHasHp("Proxima Midnight"),
  "21097.corvus-glaive-forced-interrupt": corvusForcedInterrupt(),
  "21097.corvus-glaive-constant": protectedWhileOtherHasHp("Proxima Midnight"),

  // Under Siege 1A — Setup: reveal stage 2A and put it into play, so there are two main schemes and two villains.
  "21098a.setup": setup(putMainSchemeStageIntoPlay(2)),
  // Under Siege 1B — "Proxima Midnight's Scheme." is data (`MainSchemeStage.villainOf`), not a separate rule.
  "21098b.under-siege-constant": coveredByEngineRule(),
  // Under Siege 1B — Forced Interrupt: when this stage would be completed, remove all its threat instead, then
  // deal 6[per_hero] damage to Avengers Tower (docs/phase7-wave4.md §3.4).
  "21098b.under-siege-forced-interrupt": forcedInterrupt(
    on.mainSchemeCompleting("self"),
    instead(removeThreat(threatOn(self), self)),
    dealDamage(perHero(6), AVENGERS_TOWER),
  ),

  // The Armies of Thanos 2A — When Revealed: put Avengers Tower into play (stronghold side, its default face), put
  // Focused Defense into play attached to this stage, each player searches for A copy of Black Order Besieger and
  // puts it into play engaged with them, then shuffle. `selectCards` binds every matching instance (Black Order
  // Besieger prints 4 copies); `chooseCards` (not `chooseTarget`, which only searches cards already in play) narrows
  // that to the one copy the search actually finds — the cards are identical, so which one is picked doesn't matter.
  "21099a.when-revealed": whenRevealed(
    selectCards("tower", encounterSetAside({ name: "Avengers Tower" })),
    putIntoPlay(chosen("tower"), firstPlayer),
    selectCards("focused", encounterSetAside({ name: "Focused Defense" })),
    attachCard(chosen("focused"), self),
    forEachPlayer(
      eachPlayer,
      selectCards("besiegers", encounterCards(["deck"], { name: "Black Order Besieger" })),
      chooseCards("besieger", cards(chosen("besiegers")), { min: 1, max: 1, chooser: thatPlayer }),
      putIntoPlay(chosen("besieger"), thatPlayer),
    ),
    shuffleEncounterDeck(),
  ),
  // The Armies of Thanos 2B — "Corvus Glaive's Scheme." is data, not a separate rule.
  "21099b.the-armies-of-thanos-constant": coveredByEngineRule(),
  // The Armies of Thanos 2B — Forced Interrupt: when this stage would be completed, remove all its threat
  // instead, then deal each player 1 facedown encounter card.
  "21099b.the-armies-of-thanos-forced-interrupt": forcedInterrupt(
    on.mainSchemeCompleting("self"),
    instead(removeThreat(threatOn(self), self)),
    forEachPlayer(eachPlayer, dealEncounterCard(thatPlayer)),
  ),

  // Avengers Tower, Stronghold side — "The unique rule does not apply to Avengers Tower." (§3.5).
  "21100a.avengers-tower-constant": constant(rule({ kind: "uniqueRuleExempt", title: "Avengers Tower" })),
  // Avengers Tower, Stronghold side — Forced Response: after damage is placed here, at 9[per_hero]+ remove it all,
  // discard each other Avengers Tower from play (the Damaged side's own printed "When Revealed" reinforcing the
  // unique rule this way, per the user's 2026-09-24 decision that a flip does not resolve "When Revealed" — RRG 1.8
  // "Environments flip, they are not revealed", rulings Jun 25, 2026 (4) #3 and Jan 26, 2026 (4) #2 — so the discard
  // is scripted here, on the flipping side, rather than on 21100b.when-revealed), then flip.
  "21100a.avengers-tower-forced-response": forcedResponse(
    when.damage("self", { taken: true }),
    ifThen(towerAtLeast9, [
      heal(damageOn(self), self),
      discard(each(query([], { name: "Avengers Tower", excluding: self }))),
      flipCard(self),
    ]),
  ),
  // Avengers Tower, Damaged side — When Revealed: discard each other Avengers Tower from play (any card sharing the
  // title — MC21 p. 11 names the player's own "Avengers Tower" support card specifically). Scripted for
  // completeness/coverage; never resolves via the scenario's own flip (see the forced-response docblock above).
  "21100b.when-revealed": whenRevealed(discard(each(query([], { name: "Avengers Tower", excluding: self })))),
  // Avengers Tower, Damaged side — Forced Response: after damage is placed here, at 9[per_hero]+, the players lose.
  "21100b.avengers-tower-forced-response": forcedResponse(
    when.damage("self", { taken: true }),
    ifThen(towerAtLeast9, endGame("loss")),
  ),

  // Focused Defense — Permanent. The villain who matches the attached scheme is the active villain (§3.2).
  "21101.focused-defense-constant": constant(focusedMainScheme()),
  // Focused Defense — Forced Response: after the player phase ends, attach this card to the other main scheme.
  "21101.focused-defense-forced-response": forcedResponse(
    on.phaseEnding("player"),
    attachCard(self, each(query("mainScheme", { excluding: host }))),
  ),

  // Black Order Besieger — Forced Response: after it engages you, choose either 1 damage to Avengers Tower or 2 to
  // your identity.
  "21102.black-order-besieger-forced-response": forcedResponse(
    { on: "minionEngaged", selfIs: "source" },
    chooseOne(
      option("Deal 1 damage to Avengers Tower", dealDamage(1, AVENGERS_TOWER)),
      option("Deal 2 damage to your identity", takeDamage(2)),
    ),
  ),

  // Proxima's Spear — Attach to Proxima Midnight (data). [star] Her attacks gain overkill and piercing. Hero
  // Action: take 1 damage and spend [energy][mental] → discard.
  "21103.proximas-spear-constant": constant(
    gainsKeyword({ name: "overkill" }, query("enemy", { hostOfSelf: true })),
    gainsKeyword({ name: "piercing" }, query("enemy", { hostOfSelf: true })),
  ),
  "21103.proximas-spear-action": heroAction(
    { cost: [takeDamageCost(1), spend({ energy: 1, mental: 1 })] },
    discard(self),
  ),

  // Corvus's Glaive — Attach to Corvus Glaive (data). He gains retaliate 1. Hero Action: take 1 damage and spend
  // [energy][physical] → discard.
  "21104.corvuss-glaive-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, query("enemy", { hostOfSelf: true })),
  ),
  "21104.corvuss-glaive-action": heroAction(
    { cost: [takeDamageCost(1), spend({ energy: 1, physical: 1 })] },
    discard(self),
  ),

  // Direct Assault — Attach to the non-active villain (data). [star] Forced Interrupt: when attached villain
  // attacks, the attack gains ranged; if it defeats an ally, deal 3 damage to Avengers Tower; at the end of that
  // attack, discard Direct Assault.
  "21105.direct-assault-forced-interrupt": {
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { hostOfSelf: true } } },
    effects: [
      modifyAttack({ keywords: ["ranged"] }),
      atEndOfAttack(
        ifThen(
          allOf(eventDealt("defeated"), refMatches(eventTarget, query("ally"), { anywhere: true })),
          dealDamage(3, AVENGERS_TOWER),
        ),
        discard(self),
      ),
    ],
  },

  // Proxima's Power — When Revealed: Proxima Midnight activates against you (read as an attack, the cycle-1/2
  // "activates against" convention `kang-encounter-set.ts`/`kree-fanatic.ts` establish). [star] Boost: add the
  // other villain's SCH and ATK to this villain's for this activation.
  "21106.when-revealed": whenRevealed(
    enemyAttack(named("Proxima Midnight"), { against: you, additionalResolution: true }),
  ),
  "21106.boost": boost(
    modifyAttack({ atkBonus: statOf(otherVillain, "atk"), threatBonus: statOf(otherVillain, "sch") }),
  ),

  // Corvus's Cunning — the mirror of Proxima's Power for Corvus Glaive.
  "21107.when-revealed": whenRevealed(
    enemyAttack(named("Corvus Glaive"), { against: you, additionalResolution: true }),
  ),
  "21107.boost": boost(
    modifyAttack({ atkBonus: statOf(otherVillain, "atk"), threatBonus: statOf(otherVillain, "sch") }),
  ),

  // Bound by Blood — When Revealed: heal 2 from each villain and give each a tough status card. [star] Boost: heal
  // 2 from the active villain and give it a tough status card.
  "21108.when-revealed": whenRevealed(heal(2, each(query("villain"))), giveStatus(each(query("villain")), "tough")),
  "21108.boost": boost(heal(2, theVillain), giveStatus(theVillain, "tough")),

  // Rain Fire — When Revealed: deal 3 damage to Avengers Tower.
  "21109.when-revealed": whenRevealed(dealDamage(3, AVENGERS_TOWER)),
  // [star] Boost: if damage from this attack defeats an ally, deal 3 damage to Avengers Tower — read at the end of
  // the activation (`atEndOfActivation`, the same primitive Kree Fanatic's "If this activation defeats a character"
  // boost uses), narrowed to "an ally" via the defeated character's own category (`refMatches` with `anywhere` since
  // a defeated ally has already left play by the time the activation ends).
  "21109.boost": boost(
    atEndOfActivation(
      ifThen(
        allOf(eventDealt("defeated"), refMatches(eventTarget, query("ally"), { anywhere: true })),
        dealDamage(3, AVENGERS_TOWER),
      ),
    ),
  ),

  // City Under Attack — Hinder 1[per_hero] (data). When Defeated: the player who defeated it draws 1 card.
  "21110.when-defeated": whenDefeated(draw(1, defeatingPlayer)),
});
