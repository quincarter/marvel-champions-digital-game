import {
  addCounters,
  after,
  alterEgoAction,
  applyRuleUntil,
  attacksGainKeywords,
  attachCard,
  basicThwartOnlyAgainst,
  basicThwartsIgnore,
  chooseTarget,
  chosen,
  constant,
  countBoostIcons,
  damageAnEnemy,
  dealDamage,
  defineAbilities,
  discardEncounterCards,
  discardFromHand,
  discardTopOfDeckCost,
  draw,
  each,
  eventTarget,
  exhaustThis,
  forcedResponse,
  gainsKeyword,
  gets,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifThen,
  interrupt,
  modifyStat,
  not,
  on,
  oncePerRound,
  preventDamage,
  query,
  ready,
  removeCounter,
  self,
  spend,
  stun,
  superlative,
  takeIndirectDamageCost,
  threatOn,
  valueAtLeast,
  valueEquals,
  varOf,
  yourIdentity,
  YOUR_HERO,
  YOUR_IDENTITY,
} from "../../../dsl/index.js";

/**
 * The Sinister Motives campaign's "Campaign - S.H.I.E.L.D. Tech" player upgrades (MC27 pp. 4, 22; `sm` 27182-27189,
 * each a Setup/Permanent front with an Enhanced back of the same printed name): reputation node 1's own reward pool
 * (`../../../campaigns/sm.ts`'s `SHIELD_TECH_SET`/`ENHANCED_SHIELD_TECH` own job to grant a copy and, later, flip
 * it to Enhanced — this module scripts each card's own printed text only, the same division of labor
 * `wave4/mts/mts-campaign-cards.ts`'s own docblock describes). `@mc/content`'s `specificTo: { kind: "campaign",
 * encounterSetId: "shield_tech" }` on all eight already keeps them out of ordinary deckbuilding (`validateDeck`,
 * proven for two of the eight already in `../../../campaigns/sm-campaign-cards-availability.test.ts`); nothing
 * here re-enforces that.
 *
 * None of the eight prints an "attach to" clause, so each attaches to its owner's identity by default (RRG 1.8
 * "Attach", p. 8: an upgrade with no printed host attaches to the player's identity; `packages/engine/src/
 * actions.ts`'s own `attachTo = ... card.attachesTo ? null : ownIdentity`) — every "your hero"/"your identity"
 * grant below targets `YOUR_HERO`/`YOUR_IDENTITY` (resolved through the granting card's own controller), **not**
 * `{ self: true }` (which restricts a modifier's target to the granting card's own instance, not its host —
 * confirmed against a real game: `wave4/mts/mts-campaign-cards.ts`'s own Norn Stone (21187a/b) constants read
 * `gets("thw", 1, { self: true })` and grant nothing to the hero at all, a genuine bug in already-merged wave4
 * content, out of this module's scope to fix but flagged here so it is not copied forward. `YOUR_IDENTITY` for a
 * stat that applies in either form ("Your identity gets +N hit points"); `YOUR_HERO` for a stat/keyword the card's
 * own wording scopes to hero form ("Your hero gets …").
 */
export const SHIELD_TECH_CAMPAIGN_CARDS = defineAbilities({
  // --- Compact Darts (27182a / 27182b) ----------------------------------------------------------------------------
  // "Setup. Permanent.\nHero Response: After your hero attacks, remove 1 dart counter from here → deal 1 damage to
  // an enemy.\nAlter-Ego Action: Spend 1 resource of any type → place 3 dart counters here. (Limit once per round.)"
  "27182a.compact-darts-response": heroResponse(
    after.attacks(YOUR_HERO),
    { cost: removeCounter("dart", 1) },
    damageAnEnemy(1),
  ),
  "27182a.compact-darts-action": alterEgoAction({ cost: spend(1), limit: oncePerRound }, addCounters("dart", 3, self)),
  // Enhanced back — "Hero Response: … deal 1 damage to up to 2 different enemies."
  "27182b.compact-darts-response": heroResponse(
    after.attacks(YOUR_HERO),
    { cost: removeCounter("dart", 1) },
    chooseTarget("enemies", query("enemy"), { count: 2, upTo: true }),
    dealDamage(1, chosen("enemies")),
  ),
  "27182b.compact-darts-action": alterEgoAction({ cost: spend(1), limit: oncePerRound }, addCounters("dart", 3, self)),

  // --- Impact-Dampening Suit (27183a / 27183b) --------------------------------------------------------------------
  // "Setup. Permanent.\nYour identity gets +2 hit points.\nHero Interrupt: When the villain phase begins, spend 1
  // resource of any type → until the end of the phase, reduce the amount of damage your hero takes from each enemy
  // attack by 1."
  "27183a.impact-dampening-suit-constant": constant(gets("hp", 2, YOUR_IDENTITY)),
  "27183a.impact-dampening-suit-interrupt": heroInterrupt(
    on.phaseBeginning("villain"),
    { cost: spend(1) },
    applyRuleUntil({ kind: "reduceDamageTaken", target: YOUR_HERO, amount: 1, fromAttack: true }, "endOfPhase"),
  ),
  // Enhanced back — "Your identity gets +3 hit points.\nHero Interrupt: When your hero would take any amount of
  // damage from an enemy attack, discard the top card of your deck → prevent 1 of that damage."
  "27183b.impact-dampening-suit-constant": constant(gets("hp", 3, YOUR_IDENTITY)),
  "27183b.impact-dampening-suit-interrupt": heroInterrupt(
    on.damage(YOUR_HERO, { fromAttack: true }),
    { cost: discardTopOfDeckCost() },
    preventDamage(1),
  ),

  // --- Laser Goggles (27184a / 27184b) --------------------------------------------------------------------------
  // "Setup. Permanent.\nYour hero gets -1 THW.\nYour hero gets +1 ATK, and your hero's basic attacks gain
  // overkill."
  "27184a.laser-goggles-constant": constant(gets("thw", -1, YOUR_HERO)),
  "27184a.laser-goggles-constant-2": constant(
    gets("atk", 1, YOUR_HERO),
    attacksGainKeywords(["overkill"], { attacker: YOUR_HERO, basicOnly: true }),
  ),
  // Enhanced back — "Your hero gets +2 ATK, and your hero's basic attacks gain overkill and piercing."
  "27184b.laser-goggles-constant": constant(gets("thw", -1, YOUR_HERO)),
  "27184b.laser-goggles-constant-2": constant(
    gets("atk", 2, YOUR_HERO),
    attacksGainKeywords(["overkill", "piercing"], { attacker: YOUR_HERO, basicOnly: true }),
  ),

  // --- Propulsion Gauntlet (27185a / 27185b) ----------------------------------------------------------------------
  // "Setup. Permanent.\nHero Action: Exhaust Propulsion Gauntlet and take 2 indirect damage → ready your hero."
  "27185a.propulsion-gauntlet-action": heroAction(
    { cost: [exhaustThis, takeIndirectDamageCost(2)] },
    ready(yourIdentity),
  ),
  // Enhanced back — "… ready your hero. Your hero gets +1 THW, +1 ATK, and +1 DEF until the end of the phase."
  "27185b.propulsion-gauntlet-action": heroAction(
    { cost: [exhaustThis, takeIndirectDamageCost(2)] },
    ready(yourIdentity),
    modifyStat("thw", 1, yourIdentity, "endOfPhase"),
    modifyStat("atk", 1, yourIdentity, "endOfPhase"),
    modifyStat("def", 1, yourIdentity, "endOfPhase"),
  ),

  // --- Retinal Display (27186a / 27186b) --------------------------------------------------------------------------
  // "Setup. Permanent.\nYour hero's basic thwart power (THW) can only remove threat from the scheme with the most
  // threat.\nYour hero gets +1 THW, and your hero's basic thwarts ignore the crisis icon ([crisis])."
  "27186a.retinal-display-constant": constant(
    basicThwartOnlyAgainst(YOUR_HERO, superlative("highest", each(query("scheme")), threatOn(chosen("candidate")))),
  ),
  "27186a.retinal-display-constant-2": constant(gets("thw", 1, YOUR_HERO), basicThwartsIgnore(YOUR_HERO, ["crisis"])),
  // Enhanced back — "Your hero gets +2 THW, and your hero's basic thwarts ignore the crisis icon ([crisis]) and
  // the patrol keyword."
  "27186b.retinal-display-constant": constant(
    basicThwartOnlyAgainst(YOUR_HERO, superlative("highest", each(query("scheme")), threatOn(chosen("candidate")))),
  ),
  "27186b.retinal-display-constant-2": constant(
    gets("thw", 2, YOUR_HERO),
    basicThwartsIgnore(YOUR_HERO, ["crisis", "patrol"]),
  ),

  // --- Shock Knuckles (27187a / 27187b) -------------------------------------------------------------------------
  // "Setup. Permanent.\nHero Response: After your hero makes a basic attack against an enemy, discard the top card
  // of the encounter deck. If no boost icons ([boost]) were discarded this way, stun that enemy."
  "27187a.shock-knuckles-response": heroResponse(
    after.attacks(YOUR_HERO, { basic: true, target: query("enemy") }),
    discardEncounterCards(1, { bind: "d" }),
    countBoostIcons(chosen("d"), "d"),
    ifThen(valueEquals(varOf("d.boostIcons"), 0), stun(eventTarget)),
  ),
  // Enhanced back — "Your hero gets +1 ATK.\nHero Response: … If 1 or fewer boost icons ([boost]) were discarded
  // this way, stun that enemy."
  "27187b.shock-knuckles-constant": constant(gets("atk", 1, YOUR_HERO)),
  "27187b.shock-knuckles-response": heroResponse(
    after.attacks(YOUR_HERO, { basic: true, target: query("enemy") }),
    discardEncounterCards(1, { bind: "d" }),
    countBoostIcons(chosen("d"), "d"),
    ifThen(not(valueAtLeast(varOf("d.boostIcons"), 2)), stun(eventTarget)),
  ),

  // --- Wave Bracers (27188a / 27188b) ---------------------------------------------------------------------------
  // "Setup. Permanent.\nYour hero gets -1 ATK.\nYour hero gets +1 DEF, and gains retaliate 1 and steady."
  "27188a.wave-bracers-constant": constant(gets("atk", -1, YOUR_HERO)),
  "27188a.wave-bracers-constant-2": constant(
    gets("def", 1, YOUR_HERO),
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_HERO),
    gainsKeyword({ name: "steady" }, YOUR_HERO),
  ),
  // Enhanced back — "Your hero gets +2 DEF, and gains retaliate 1 and stalwart."
  "27188b.wave-bracers-constant": constant(gets("atk", -1, YOUR_HERO)),
  "27188b.wave-bracers-constant-2": constant(
    gets("def", 2, YOUR_HERO),
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_HERO),
    gainsKeyword({ name: "stalwart" }, YOUR_HERO),
  ),

  // --- Wrist Navigator (27189a / 27189b) ------------------------------------------------------------------------
  // "Setup. Permanent.\nForced Response: After a minion or side scheme enters play, attach Wrist Navigator to
  // it.\nInterrupt: When the attached card is defeated, draw 1 card. (Return this card to your play area.)" —
  // the parenthetical is `coveredByEngineRule` (module docblock, `dsl/abilities.ts`'s own `on.attachedCardDefeated`
  // doc comment): a permanent player-owned attachment already stays in play, unattached, in its controller's play
  // area when its host leaves play (`packages/engine/src/effects.ts`'s `discardWithLeavingHost`/
  // `staysInPlayWithoutHost`), so only the draw is scripted.
  "27189a.wrist-navigator-forced-response": forcedResponse(
    on.entersPlay(query(["minion", "sideScheme"])),
    attachCard(self, eventTarget),
  ),
  "27189a.wrist-navigator-interrupt": interrupt(on.attachedCardDefeated(), draw(1)),
  // Enhanced back — "Interrupt: … draw 2 cards, then discard 1 card from your hand."
  "27189b.wrist-navigator-forced-response": forcedResponse(
    on.entersPlay(query(["minion", "sideScheme"])),
    attachCard(self, eventTarget),
  ),
  "27189b.wrist-navigator-interrupt": interrupt(on.attachedCardDefeated(), draw(2), discardFromHand(1)),
});
