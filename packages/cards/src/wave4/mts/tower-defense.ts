/**
 * The Mad Titan's Shadow's Tower Defense scenario (docs/phase7-wave4.md §2.2 Tower Defense row, §3.2-§3.5, §3.23):
 * Proxima Midnight, Corvus Glaive, their paired main schemes (Under Siege / The Armies of Thanos, `mts` 21098a/b,
 * 21099a/b), Focused Defense (21101), Avengers Tower (21100a/b) and the Tower Defense encounter set's own modulars
 * (Black Order Besieger 21102, Proxima's Spear 21103, Corvus's Glaive 21104, Direct Assault 21105, Proxima's Power
 * 21106, Corvus's Cunning 21107, Bound by Blood 21108, Rain Fire 21109, City Under Attack 21110).
 *
 * **Villain succession, a content-shape note (not a `@mc/content` edit):** `MTS_CARDS` emits Proxima Midnight and
 * Corvus Glaive as three separate single-stage `VillainCard`s apiece (21092/21093/21094, 21095/21096/21097),
 * because `normalizeVillains` cannot combine same-numbered stages into one card when two villains share the
 * `tower_defense` `card_set_code` (docs/phase7-wave4.md §1.6's own `villainCardCodes` disambiguation note — the
 * same shape wave 2's Kang/Sinister Six precedent uses). Unlike Kang, Tower Defense's own villains genuinely do
 * advance stage-to-stage by ordinary defeat (MC21 p. 10, "Villain Deck: Corvus Glaive (I), Corvus Glaive (II),
 * Proxima Midnight (I), Proxima Midnight (II)"; RRG 1.8 `VillainSide`'s own docblock, "After a villain stage is
 * defeated, the next stage of the villain deck enters play"), which the landed engine primitive
 * (`defeatVillainStage`, `villain-mutual-protection.test.ts`'s own synthetic `stubVillain` with two `stages`)
 * implements only *within one `VillainCard`'s own `sides[0].stages`* — it cannot chain from one `CardId` to
 * another. `mergeVillainStages` below re-packages the three official per-stage records (hp/atk/sch/text/traits/
 * keywords/abilities/image, copied verbatim, not re-authored) into the single multi-stage `VillainCard` shape
 * Ebony Maw's own villain record already uses, purely as scenario-setup wiring in `@mc/cards` — no `@mc/content`
 * edit, no new card text, no engine change. `TOWER_DEFENSE_CARDS` below is `WAVE4_CARDS` (which folds in `MTS_CARDS`
 * plus the Core/earlier-wave pool the Standard/Expert sets and identity sets live in) with the six split records
 * replaced by the two merged cards.
 */
import { cardId, type AnyCard, type CardId, type VillainCard, type VillainStage } from "@mc/content";
import { WAVE4_CARDS } from "../cards.js";
import {
  allOf,
  atEndOfActivation,
  atEndOfAttack,
  attachCard,
  boost,
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
// Villain succession: merging the split per-stage cards (see module docblock)
// ---------------------------------------------------------------------------

/** Combines several single-stage `VillainCard`s (same title, in stage order) into one multi-stage `VillainCard`,
 * keeping every stage's printed fields (hp/atk/sch/text/traits/keywords/abilities/image) verbatim. */
function mergeVillainStages(pool: readonly AnyCard[], stageCardIds: readonly CardId[]): VillainCard {
  const found = stageCardIds.map((id) => {
    const card = pool.find((c) => c.id === id);
    if (!card || card.type !== "villain") throw new Error(`${id} is not a villain card`);
    return card;
  });
  const [first] = found;
  if (!first) throw new Error("no stages to merge");
  const stages: VillainStage[] = found.map((card) => {
    const stage = card.sides[0].stages[0];
    if (!stage) throw new Error(`${card.id} has no stage`);
    return stage;
  });
  const [firstStage, ...restStages] = stages;
  if (!firstStage) throw new Error("no stages to merge");
  return { ...first, sides: [{ side: "A", name: first.name, stages: [firstStage, ...restStages] }] };
}

const PROXIMA_STAGE_IDS: readonly CardId[] = [cardId("21092"), cardId("21093"), cardId("21094")];
const CORVUS_STAGE_IDS: readonly CardId[] = [cardId("21095"), cardId("21096"), cardId("21097")];

/** Proxima Midnight I/II/III, merged into one three-stage `VillainCard` (id `21092`). */
export const PROXIMA_MIDNIGHT: VillainCard = mergeVillainStages(WAVE4_CARDS, PROXIMA_STAGE_IDS);
/** Corvus Glaive I/II/III, merged the same way (id `21095`). */
export const CORVUS_GLAIVE: VillainCard = mergeVillainStages(WAVE4_CARDS, CORVUS_STAGE_IDS);

const SPLIT_STAGE_IDS: ReadonlySet<CardId> = new Set([...PROXIMA_STAGE_IDS, ...CORVUS_STAGE_IDS]);

/** `WAVE4_CARDS` with Proxima Midnight/Corvus Glaive's six split per-stage records replaced by the two merged cards
 * above. Used as the Tower Defense scenario's own `GameSetupConfig.cards`. */
export const TOWER_DEFENSE_CARDS: readonly AnyCard[] = [
  ...WAVE4_CARDS.filter((card) => !SPLIT_STAGE_IDS.has(card.id)),
  PROXIMA_MIDNIGHT,
  CORVUS_GLAIVE,
];

/** Villain cards set aside at setup, found by name via the main scheme's own "Setup"/"When Revealed" abilities
 * (MC21 p. 10-11): the environment and the Focused Defense attachment are scenario furniture, not shuffled into
 * the encounter deck like an ordinary treachery/minion, even though both carry `encounterSetIds: [tower_defense]`. */
export const TOWER_DEFENSE_SET_ASIDE_IDS: readonly CardId[] = [cardId("21100a"), cardId("21101")];

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
  // Focused Defense into play attached to this stage, each player searches for a Black Order Besieger and puts it
  // into play engaged with them, then shuffle.
  "21099a.when-revealed": whenRevealed(
    selectCards("tower", encounterSetAside({ name: "Avengers Tower" })),
    putIntoPlay(chosen("tower"), firstPlayer),
    selectCards("focused", encounterSetAside({ name: "Focused Defense" })),
    attachCard(chosen("focused"), self),
    forEachPlayer(
      eachPlayer,
      selectCards("besieger", encounterCards(["deck"], { name: "Black Order Besieger" })),
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
