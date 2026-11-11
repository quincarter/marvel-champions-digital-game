/**
 * Carnage (by Neptune, Hitch template): every ability of the pack, each modeled on the base-game card named in its
 * comment. The pack's own printed text is the authority (docs/custom-content-packs.md section 6), then the RRG
 * (v1.8) and FFG rulings for what the text does not override.
 *
 * Ability ids are `<card code>.<slug>`. Four ids are not in the importer's stub; the card JSON names them (see the
 * pack README): the bookkeeping of Need to Kill (`01a.need-to-kill-tracker`, `01b.need-to-kill-reset`) and the two
 * extra constants of Amorphous Arsenal (`08.amorphous-arsenal-constant-piercing`, `-ranged`).
 */
import {
  action,
  adjustBoostCount,
  after,
  allOf,
  alterEgoAction,
  anAttackableEnemy,
  anyOfCards,
  atEndOfAttack,
  attack,
  attacksGainKeywords,
  bindTargets,
  boost,
  cancelIt,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  coveredByEngineRule,
  countOf,
  dealIndirectDamage,
  definePackAbilities,
  discard,
  discardEncounterUntil,
  each,
  encounterCards,
  encounterSetAside,
  enemyActivates,
  enemyAttack,
  enemyAttacksEnemy,
  eventDealt,
  eventResult,
  eventTarget,
  exhaustThis,
  exists,
  findCard,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gainsTrait,
  gainTraitUntil,
  activatingEnemy,
  aScheme,
  gets,
  heal,
  heroAction,
  giveBasicPowerBoostCard,
  heroInterrupt,
  heroResponse,
  host,
  ifThen,
  isAttached,
  made,
  modifyAttack,
  moveCards,
  not,
  ofIdentitySetTitled,
  on,
  oncePerRound,
  oneCopyOf,
  option,
  packObligation,
  putIntoPlay,
  query,
  ready,
  reduceNextCardCost,
  refMatches,
  remainingHpOf,
  removeEachCounterFrom,
  removeThreatFromAScheme,
  resource,
  response,
  retargetAttack,
  returnToHandCost,
  rule,
  sameClassificationAs,
  scaled,
  selectCards,
  self,
  shuffleDeck,
  shuffleEncounterDeck,
  stun,
  sum,
  superlative,
  surge,
  takeDamage,
  thwart,
  countersOn,
  valueAtLeast,
  valueAtMost,
  valueEquals,
  varAtLeast,
  activationIs,
  instead,
  placeThreat,
  theMainScheme,
  spend,
  eventSource,
  addCounters,
  varOf,
  whenRevealed,
  YOUR_IDENTITY,
  yourIdentity,
  you,
  zone,
  revealCard,
  boostIconsOn,
  damageThisCardCost,
  preventDamage,
  statOf,
  interrupt,
} from "@mc/mod-sdk";

// The content package's `trait()` is not part of the SDK; a trait is its upper-cased name.
type Trait = NonNullable<Parameters<typeof gainTraitUntil>[0]>;
const trait = (name: string): Trait => name.toUpperCase() as Trait;
const ELITE = trait("Elite");
const KILLER = trait("Killer");
const PERSONA = trait("Persona");
const AERIAL = trait("Aerial");
const CARNAGE = ofIdentitySetTitled("Carnage");

const HAND = "hand" as const;

/** An enemy that is a minion or the villain: the printed word "enemy" in a player query. */
const ENEMY_CHARACTER = query(["minion", "villain"]);

/** "Torment", by name, wherever the minion is in play. */
const TORMENT = each(query("minion", { name: "Torment" }));

// ---------------------------------------------------------------------------
// Torment's and Death Spiral's classification matching
// ---------------------------------------------------------------------------

/**
 * "An ally or Persona support with the same classification as that character (identity-specific, aspect, or basic)".
 * A query's `trait` applies to every category it lists, so the ally and the Persona support are two queries.
 * Classification handling: Superpower Adaptation (`rogue` 38009), `sameClassificationAs`; RRG 1.8 "Classifications"
 * (p. 12). `of` is the attacked character.
 */
const ALLY_OF_CLASS = (extra: { readonly controller?: "you" } = {}) =>
  query("ally", sameClassificationAs(eventTarget), extra);
const PERSONA_OF_CLASS = (extra: { readonly controller?: "you" } = {}) =>
  query("support", sameClassificationAs(eventTarget), { trait: PERSONA, ...extra });

export default definePackAbilities({
  // =========================================================================
  // 01 Carnage / Eddie Brock (identity)
  // =========================================================================

  // Death-Dealer. Modeled on Prince of Power (Hercules, 59017): "After Hercules attacks and defeats an enemy, heal 1
  // damage from Hercules for each point of excess damage dealt to that enemy by that attack." Optional, no cost.
  "x.carnage-nep.01a.death-dealer": response(
    after.attacks(YOUR_IDENTITY, { defeats: true }),
    heal(eventResult("excessDealt"), yourIdentity),
  ),

  // Need to Kill: "At the end of the round, if you did not defeat an enemy this round, take damage equal to your ATK."
  // Modeled on Mitigated Threat (Jessica Jones, 61040): a Forced Response at the end of the round. There is no
  // "defeated an enemy this round" predicate, so it is a composition: a forced response counts each enemy Carnage
  // defeats on his own identity card, the round-end response reads it, and clears it.
  // "You defeat" is the player's identity and the cards that are an extension of it (RRG 1.8 "You, Your", p. 49), not
  // an ally: the source is the same query `on.youDealDamage` uses. Any defeat counts, an attack's or not.
  "x.carnage-nep.01a.need-to-kill-tracker": forcedResponse(
    {
      on: "characterDefeated",
      targetIs: ENEMY_CHARACTER,
      sourceIs: { controller: "you", categories: ["identity", "event", "resource", "upgrade"] },
    },
    addCounters("defeated", 1),
  ),
  "x.carnage-nep.01a.need-to-kill": forcedResponse(
    on.roundEnding(),
    ifThen(not(valueAtLeast(countersOn(self, "defeated"), 1)), takeDamage(statOf(yourIdentity, "atk"))),
    removeEachCounterFrom(self, "defeated"),
  ),
  // The identity's other face keeps the count honest: Need to Kill is on the hero side only (intended: being Eddie
  // at the end of the round avoids it), so a defeat made in hero form must not carry into the next round.
  "x.carnage-nep.01b.need-to-kill-reset": forcedResponse(on.roundEnding(), removeEachCounterFrom(self, "defeated")),

  // Eddie's deck-building rule (up to 5 off-aspect Attack events) is data: `deckbuilding.offAspectAllowance`.
  "x.carnage-nep.01b.eddie-brock-constant": coveredByEngineRule(),

  // Dark Urges. Modeled on "Come Get Me, Bub!" (48016) and Squared Off (49017): discard from the encounter deck
  // until a minion is discarded, put it into play. With no minion left nothing is bound and nothing enters play.
  // Put into play engaged with you (a minion enters engaged with the player who controls the entry).
  "x.carnage-nep.01b.dark-urges": action(
    { limit: oncePerRound },
    discardEncounterUntil(query("minion"), "found"),
    putIntoPlay(chosen("found"), you),
  ),

  // =========================================================================
  // 02 Spider-Man (ally)
  // =========================================================================

  // "When you would take any amount of damage from Carnage's Need to Kill ability, exhaust Spider-Man and deal 1
  // damage to him -> prevent all of that damage." Modeled on Backflip (01003) for the prevention and Luke Cage
  // (61003) for the damage-to-self cost. Need to Kill is the only damage Carnage's identity card deals to its own
  // player, so the source filter is "your identity card, not an attack".
  "x.carnage-nep.02.spider-man-interrupt": interrupt(
    {
      on: "dealDamage",
      targetIs: YOUR_IDENTITY,
      sourceIs: query("identity", { controller: "you" }),
      fromAttack: false,
    },
    { cost: [exhaustThis, damageThisCardCost(1)] },
    preventDamage(),
  ),

  // =========================================================================
  // 03 Symbiote Hive-Mind (support)
  // =========================================================================

  // Eddie Brock gets +1 REC. Modeled on Down Time (05033): `gets("rec", ..)` on the alter-ego.
  "x.carnage-nep.03.symbiote-hive-mind-constant": constant(gets("rec", 1, query("alterEgo", { controller: "you" }))),
  // Alter-Ego Action: exhaust -> shuffle 1 Carnage card from your discard pile into your deck. Modeled on Altman
  // Residence (Hulkling, 56031).
  "x.carnage-nep.03.symbiote-hive-mind-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("shuffled", zone("discard", you, { filter: CARNAGE }), { min: 1, max: 1 }),
    moveCards(cards(chosen("shuffled")), "deckShuffle"),
  ),

  // =========================================================================
  // 04 Lethal Restraint (upgrade)
  // =========================================================================

  // Carnage gains retaliate 1. Modeled on Captain America's Shield (03009).
  "x.carnage-nep.04.lethal-restraint-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY)),
  // Hero Action: return this card to your hand (from play) -> reduce the cost of the next Carnage event you play this
  // phase by 1. Modeled on Daredevil's Billy Club (60017, the return-to-hand cost) and Avengers Tower (03024, the
  // next-card reduction).
  "x.carnage-nep.04.lethal-restraint-action": heroAction(
    { cost: returnToHandCost(query("upgrade", { self: true })) },
    reduceNextCardCost(you, 1, "phase", query("event", CARNAGE)),
  ),

  // =========================================================================
  // 05 Probing Minds (upgrade)
  // =========================================================================

  // Hero Interrupt: when you reveal a non-Elite minion, exhaust this card -> branch on its boost icons. Modeled on
  // Batroc's Brigade (50101, the non-Elite minion reveal interrupt) and Telepathic Suggestion (Psylocke 41007, "you
  // reveal a card from the encounter deck"). The icons are the minion's printed [boost] icons (`boostIconsOn`).
  "x.carnage-nep.05.probing-minds-interrupt": heroInterrupt(
    { ...on.encounterCardRevealedFromEncounterDeck(query("minion", { withoutTrait: ELITE })), playerIs: "controller" },
    { cost: exhaustThis },
    ifThen(valueAtMost(boostIconsOn(eventTarget), 0), heal(1, yourIdentity)),
    ifThen(valueEquals(boostIconsOn(eventTarget), 1), confuse(eventTarget)),
    ifThen(valueEquals(boostIconsOn(eventTarget), 2), stun(eventTarget)),
    ifThen(valueAtLeast(boostIconsOn(eventTarget), 3), removeThreatFromAScheme(1)),
  ),

  // =========================================================================
  // 06 Frenzied Violence (upgrade)
  // =========================================================================

  // Carnage gets +1 ATK and his basic attacks gain overkill. Modeled on Hercules's upgrade (59013) and Psi-Katana
  // (basic attacks gain a keyword).
  "x.carnage-nep.06.frenzied-violence-constant": constant(
    gets("atk", 1, YOUR_IDENTITY),
    attacksGainKeywords(["overkill"], { attacker: YOUR_IDENTITY, basicOnly: true }),
  ),
  // Hero Response: after you attack and defeat an enemy, exhaust this card -> ready Carnage.
  "x.carnage-nep.06.frenzied-violence-response": heroResponse(
    after.attacks(YOUR_IDENTITY, { defeats: true }),
    { cost: exhaustThis },
    ready(yourIdentity),
  ),

  // =========================================================================
  // 07 Hunting Hosts (upgrade)
  // =========================================================================

  // Response: after you attack and defeat an Elite minion, ready this card.
  "x.carnage-nep.07.hunting-hosts-response": response(
    after.attacks(YOUR_IDENTITY, { target: query("minion", { trait: ELITE }), defeats: true }),
    ready(self),
  ),
  // Action: exhaust -> search the encounter deck and discard pile for a minion and put it into play engaged with
  // you. (Shuffle.) Modeled on Masters of Mayhem (01133): a searched deck is shuffled whether or not it found one.
  "x.carnage-nep.07.hunting-hosts-action": action(
    { cost: exhaustThis },
    chooseCards("minion", encounterCards(["deck", "discard"], query("minion")), { min: 1, max: 1 }),
    putIntoPlay(chosen("minion"), you),
    shuffleEncounterDeck(),
  ),

  // =========================================================================
  // 08 Amorphous Arsenal (upgrade)
  // =========================================================================

  // "When you make an attack that has a keyword (overkill, piercing, or ranged), that attack deals 1 additional
  // damage for each keyword it has." Modeled on Directed Force (Psylocke, 41019): an interrupt to your attack
  // that has the keyword. One forced interrupt per keyword, each adding 1: the three together are 1 per keyword.
  // The keywords are read as the attack's interrupt window opens (`EventPattern.attackHas`), so a keyword that
  // Amorphous Arsenal's own interrupt grants afterwards is not counted for this bonus (OPEN: asked of the author;
  // there is no read-at-damage-time attack keyword count in the engine).
  "x.carnage-nep.08.amorphous-arsenal-constant": forcedInterrupt(
    on.attacks(YOUR_IDENTITY, { has: ["overkill"] }),
    modifyAttack({ extraDamage: 1 }),
  ),
  "x.carnage-nep.08.amorphous-arsenal-constant-piercing": forcedInterrupt(
    on.attacks(YOUR_IDENTITY, { has: ["piercing"] }),
    modifyAttack({ extraDamage: 1 }),
  ),
  "x.carnage-nep.08.amorphous-arsenal-constant-ranged": forcedInterrupt(
    on.attacks(YOUR_IDENTITY, { has: ["ranged"] }),
    modifyAttack({ extraDamage: 1 }),
  ),
  // Hero Interrupt: when you attack, exhaust this card and choose a keyword -> that attack gains it. Modeled on
  // Hercules's Hero Interrupt that grants overkill (59013) with the choice of Cyclops-style keyword options.
  "x.carnage-nep.08.amorphous-arsenal-interrupt": heroInterrupt(
    on.attacks(YOUR_IDENTITY),
    { cost: exhaustThis },
    chooseOne(
      option("The attack gains overkill", modifyAttack({ keywords: ["overkill"] })),
      option("The attack gains piercing", modifyAttack({ keywords: ["piercing"] })),
      option("The attack gains ranged", modifyAttack({ keywords: ["ranged"] })),
    ),
  ),

  // =========================================================================
  // 09 Klyntar Bond (upgrade)
  // =========================================================================

  // Hero Interrupt: when Carnage uses a basic power, you may give him a boost card. NOT SCRIPTED: see the pack README
  // ("Klyntar Bond"). The villainous keyword's give-and-resolve is forced and is only set up for a character that
  // has the keyword when the power is announced (`pushCharacterBoost`, `resolve/villainous.ts`), so a "may" give
  // from an interrupt would leave a facedown boost card that is never turned up. Needs an optional form of the
  // villainous character boost.
  // Resource: exhaust this card -> generate a [physical] resource. Modeled on Super-Soldier Serum (03010).
  // Klyntar Bond: "you may give him a boost card" when Carnage uses a basic power. An optional hero interrupt on the
  // basic power, resolved like villainous on a friendly character (RRG 1.8 p. 47, MC60 FAQ), which is what the
  // author expects (ENGINE_NOTES: the boost icons add to the basic power).
  "x.carnage-nep.09.klyntar-bond-interrupt": heroInterrupt(
    on.basicPowerUsing(YOUR_IDENTITY),
    giveBasicPowerBoostCard(),
  ),
  "x.carnage-nep.09.klyntar-bond-resource": resource({ physical: 1 }, { cost: exhaustThis }),

  // =========================================================================
  // 10 Sinister Flight (event)
  // =========================================================================

  // Hero Action (thwart): remove 2 threat from a scheme, ignoring the patrol keyword. Carnage gains the Aerial trait
  // until the end of the phase. Modeled on Just Passing Through (Vision, 26010) for the patrol-ignoring thwart.
  "x.carnage-nep.10.sinister-flight-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(2, chosen("scheme"), { ignorePatrol: true }),
    gainTraitUntil(AERIAL, yourIdentity, "endOfPhase"),
  ),

  // =========================================================================
  // 11 Vicious Lashing (event)
  // =========================================================================

  // Hero Interrupt (attack/defense): when an enemy attacks you, deal 4 damage to that enemy; this attack gains ranged.
  // Modeled on Powerful Punch (32014): the (attack) label makes the damage an attack, the (defense) label makes the
  // hero the defender. The ability id is `-constant` (a parse artifact of the importer; the trigger is the interrupt).
  "x.carnage-nep.11.vicious-lashing-constant": heroInterrupt(
    on.enemyAttacks(query("enemy"), { againstYou: true }),
    { label: ["attack", "defense"] },
    attack(4, eventSource, { keywords: ["ranged"] }),
  ),
  // Hero Action (attack): deal 2 damage to an enemy. Deal 2 damage to an enemy. This attack gains ranged.
  // Modeled on Slice and Dice (35009), whose "two attacks, each choosing its own enemy" shape is FAQ "Dance of Death
  // (#4)" (RRG 1.8 p. 59). READING: "this attack gains ranged" is given to both of the two attacks (the card is
  // one (attack) action and the author's text gives the ranged to all of it); flagged for the author.
  "x.carnage-nep.11.vicious-lashing-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy1"),
    attack(2, chosen("enemy1"), { keywords: ["ranged"] }),
    anAttackableEnemy("enemy2"),
    attack(2, chosen("enemy2"), { keywords: ["ranged"] }),
  ),

  // =========================================================================
  // 12 Chomp (event)
  // =========================================================================

  // Hero Action (attack): deal 8 damage to an enemy. This attack gains piercing. If this attack defeats that enemy,
  // ready Carnage. Modeled on Echo's Katana (60045, "attack ... keywords: piercing").
  "x.carnage-nep.12.chomp-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(8, chosen("enemy"), { keywords: ["piercing"], bind: "chomp" }),
    ifThen(varAtLeast("chomp.defeated"), ready(yourIdentity)),
  ),

  // =========================================================================
  // 13 Rend (event)
  // =========================================================================

  // Hero Action (attack): deal 6 damage to an enemy. This attack gains overkill. Deal 2 additional damage to that
  // enemy for each [physical] resource you overpaid for this card (to a maximum of three). Modeled on Ionic Blast
  // (Wonder Man, 58004): the overpay is part of the one attack's amount ("additional damage" is not a second
  // instance, Q53: Repulsor Blast), so 6 + 2 per overpaid [physical], at most 3.
  "x.carnage-nep.13.rend-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(sum(6, scaled(varOf("overpaid.physical"), { times: 2, max: 6 })), chosen("enemy"), {
      keywords: ["overkill"],
    }),
  ),

  // =========================================================================
  // 14 Essential Bloodlust (obligation)
  // =========================================================================

  // Give to the Eddie Brock player. You may flip to alter-ego form. Choose: exhaust Eddie Brock -> remove this from
  // the game; or take indirect damage equal to Carnage's ATK and discard this obligation. Modeled on the Core
  // obligations (Eviction Notice, 01165), `packObligation`. OPEN (ENGINE_NOTES, question for the author): Carnage's
  // ATK once he is out of play, printed or current. Printed (2) is the safe reading and is used here, so it is the
  // same whether or not the player flips.
  "x.carnage-nep.14.obligation": packObligation("Eddie Brock", {
    label: "Take indirect damage equal to Carnage's printed ATK (2). Discard this obligation",
    effects: [dealIndirectDamage(you, 2)],
  }),

  // =========================================================================
  // 15 Torment (minion, nemesis)
  // =========================================================================

  // When Revealed: search the encounter deck, discard pile and set-aside area for Death Spiral and reveal it.
  // Modeled on Kang's Wrath 4B (`searchAndReveal` over several zones, `anyOfCards`): one copy, then shuffle.
  "x.carnage-nep.15.when-revealed": whenRevealed(
    selectCards(
      "found",
      oneCopyOf(
        anyOfCards(
          encounterCards(["deck", "discard"], { name: "Death Spiral" }),
          encounterSetAside({ name: "Death Spiral" }),
        ),
      ),
    ),
    revealCard(chosen("found"), you),
    shuffleEncounterDeck(),
  ),
  // [star] Forced Interrupt: when Torment attacks a friendly character, if you control or have in your hand an ally
  // or Persona support with the same classification as that character, cancel that attack, then discard that card
  // instead. The player chooses among several matches (the text does not say who; the attacked player is "you").
  "x.carnage-nep.15.torment-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    chooseCards(
      "matched",
      anyOfCards(
        cards(each(ALLY_OF_CLASS({ controller: "you" }))),
        cards(each(PERSONA_OF_CLASS({ controller: "you" }))),
        zone(HAND, you, { filter: ALLY_OF_CLASS() }),
        zone(HAND, you, { filter: PERSONA_OF_CLASS() }),
      ),
      { min: 1, max: 1 },
    ),
    ifThen(valueAtLeast(countOf({ inSlot: "matched" }), 1), [cancelIt(), discard(chosen("matched"))]),
  ),

  // =========================================================================
  // 16 Meticulous Targeting (side scheme, nemesis)
  // =========================================================================

  // When Revealed: find Torment and reveal him (if he is already in play, he engages you). Torment activates against
  // you. If no enemy activated this way, this card gains surge. (The acceleration icon is data.)
  "x.carnage-nep.16.when-revealed": whenRevealed(
    findCard(query("minion", { name: "Torment" }), "reveal"),
    enemyActivates(TORMENT, { against: you, bind: "activated" }),
    ifThen(not(made("activated")), surge()),
  ),

  // =========================================================================
  // 17 Death Spiral (attachment, nemesis)
  // =========================================================================

  // Attach to Torment (data). Otherwise this card gains surge. Modeled on Goblin Glider (02019).
  "x.carnage-nep.17.death-spiral-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // [star] Forced Response: after Torment attacks a friendly character you control, search your deck for an ally or
  // Persona support with the same classification as that character. Discard that card. (Shuffle.)
  "x.carnage-nep.17.death-spiral-forced-response": forcedResponse(
    after.enemyAttacks("host", { againstYou: true }),
    chooseCards(
      "found",
      anyOfCards(zone("deck", you, { filter: ALLY_OF_CLASS() }), zone("deck", you, { filter: PERSONA_OF_CLASS() })),
      { min: 0, max: 1 },
    ),
    moveCards(cards(chosen("found")), "discard"),
    shuffleDeck(),
  ),
  // Hero Action: spend [mental][physical] resources -> discard this card. Modeled on Goblin Glider's / Hysteria's
  // spend-to-discard (02019, 02020).
  "x.carnage-nep.17.death-spiral-action": heroAction({ cost: spend({ mental: 1, physical: 1 }) }, discard(self)),

  // =========================================================================
  // 18 Closing the Loops (treachery, nemesis)
  // =========================================================================

  // When Revealed: Torment attacks you (even in alter-ego form). If no attack was made this way, gains surge.
  // Modeled on Masters of Mayhem (01133): `enemyAttack` with a bind, then surge when none was made.
  "x.carnage-nep.18.when-revealed": whenRevealed(
    enemyAttack(TORMENT, { against: you, bind: "loop" }),
    ifThen(not(made("loop")), surge()),
  ),
  // [star] Boost: this card gets +1 boost icon if you have more than 2 classifications in play (identity-specific,
  // aspect, or basic). "More than 2" is all three, since your identity is always in play. Modeled on 50102
  // (`adjustBoostCount`); the classifications read off card data (`ofClassification`, RRG 1.8 p. 12).
  "x.carnage-nep.18.boost": boost(
    ifThen(
      allOf(
        exists(
          query(["identity", "ally", "upgrade", "support"], { controller: "you", classification: "identitySpecific" }),
        ),
        exists(query(["ally", "upgrade", "support"], { controller: "you", classification: "aspect" })),
        exists(query(["ally", "upgrade", "support"], { controller: "you", classification: "basic" })),
      ),
      adjustBoostCount(1),
    ),
  ),

  // =========================================================================
  // 19 Muse (minion, Twisted Killers)
  // =========================================================================

  // [star] Forced Interrupt: when Muse attacks, he attacks the character with the fewest remaining hit points. This
  // attack gains piercing. If this attack defeats a character, heal 1 damage from Muse for each point of excess
  // damage dealt to that character. Modeled on Crossfire (24026: retarget to the fewest remaining hit points, a tie
  // is the first player's choice). READING: "the character" is a friendly character (hero or ally), as Crossfire's;
  // Murderous Nature, which means other enemies too, says so in words. Flagged for the author.
  "x.carnage-nep.19.muse-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self"),
    bindTargets(
      "fewest-hp",
      superlative("lowest", each(query(["identity", "ally"])), remainingHpOf(chosen("candidate"))),
    ),
    ifThen(
      valueAtLeast(countOf({ inSlot: "fewest-hp" }), 2),
      chooseTarget("muse-target", { inSlot: "fewest-hp" }, { chooser: firstPlayer }),
      bindTargets("muse-target", chosen("fewest-hp")),
    ),
    retargetAttack(chosen("muse-target")),
    modifyAttack({ keywords: ["piercing"] }),
    atEndOfAttack(ifThen(eventDealt("excessDealt"), heal(eventResult("excessDealt"), self))),
  ),

  // =========================================================================
  // 20 Bushwacker (minion, Twisted Killers)
  // =========================================================================

  // [star] Bushwacker's attacks gain piercing and overkill. Modeled on Wolfsbane (32092, "his attacks gain piercing").
  "x.carnage-nep.20.bushwacker-constant": constant(
    attacksGainKeywords(["piercing", "overkill"], { attacker: { self: true } }),
  ),
  // [star] Boost: if Murderous Nature is attached to the activating enemy, give it another boost card for this
  // activation. Modeled on Namor (56163) / Taskmaster (57025) boosts (`extraBoostCards`).
  "x.carnage-nep.20.boost": boost(
    ifThen(
      exists(query("attachment", { name: "Murderous Nature", host: activatingEnemy })),
      modifyAttack({ extraBoostCards: 1 }),
    ),
  ),

  // =========================================================================
  // 21 Recognizing Evil (side scheme, Twisted Killers)
  // =========================================================================

  // Excess damage dealt by Killer minions is placed as threat here. Modeled on Radioactive Buildup (Thunderball,
  // 07022): `excessDamageAsThreat`, filtered by the source's trait.
  "x.carnage-nep.21.recognizing-evil-constant": constant(
    rule({ kind: "excessDamageAsThreat", source: query("minion", { trait: KILLER }), scheme: self }),
  ),
  // When Revealed: find a copy of Murderous Nature and reveal it.
  "x.carnage-nep.21.when-revealed": whenRevealed(findCard(query("attachment", { name: "Murderous Nature" }), "reveal")),

  // =========================================================================
  // 22 Murderous Nature (attachment, Twisted Killers)
  // =========================================================================

  // Attach to a non-Elite minion without a copy of Murderous Nature attached (data). Otherwise this card gains surge.
  "x.carnage-nep.22.murderous-nature-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // Attached enemy gains the Killer trait and villainous. Gaining a keyword from an attachment: Solid Sound Body
  // (01119). Villainous on a non-villain enemy is the keyword as printed (RRG 1.8 p. 47).
  "x.carnage-nep.22.murderous-nature-constant-2": constant(
    gainsTrait(KILLER, { hostOfSelf: true }),
    gainsKeyword({ name: "villainous" }, { hostOfSelf: true }),
    // "That attack gains overkill": every attack of the attached enemy is redirected by the forced interrupt below,
    // so the grant is the same as a grant to the redirected attack.
    attacksGainKeywords(["overkill"], { attacker: { hostOfSelf: true } }),
  ),
  // [star] Forced Interrupt: when attached enemy attacks, it attacks the friendly character or other enemy with the
  // fewest remaining hit points (a tie is the first player's choice). Crossfire (24026) for a friendly character;
  // Cop (60182, `enemyAttacksEnemy`) for an enemy, which replaces the activation's attack.
  "x.carnage-nep.22.murderous-nature-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("host"),
    bindTargets(
      "fewest-hp",
      superlative(
        "lowest",
        each(query(["identity", "ally", "minion", "villain"], { excluding: host })),
        remainingHpOf(chosen("candidate")),
      ),
    ),
    ifThen(
      valueAtLeast(countOf({ inSlot: "fewest-hp" }), 2),
      chooseTarget("nature-target", { inSlot: "fewest-hp" }, { chooser: firstPlayer }),
      bindTargets("nature-target", chosen("fewest-hp")),
    ),
    ifThen(
      refMatches(chosen("nature-target"), query("enemy")),
      instead(enemyAttacksEnemy(host, chosen("nature-target"))),
      retargetAttack(chosen("nature-target")),
    ),
  ),

  // =========================================================================
  // 23 Hunting Victims (treachery, Twisted Killers)
  // =========================================================================

  // When Revealed: each Killer minion engaged with a player activates against that player. If no minion activates
  // this way, this card gains surge. Modeled on Hail Hydra (03030): "engaged with a player" is any form.
  "x.carnage-nep.23.when-revealed": whenRevealed(
    enemyActivates(each(query("minion", { trait: KILLER, engagedWith: "any" })), { bind: "hunt" }),
    ifThen(not(made("hunt")), surge()),
  ),
  // [star] Boost: if this is an attack that defeats a character, place threat on the main scheme equal to the excess
  // damage dealt by this attack. Modeled on Man-Bull's boost (60140).
  "x.carnage-nep.23.boost": boost(
    ifThen(
      activationIs("attack"),
      atEndOfAttack(ifThen(eventDealt("excessDealt"), placeThreat(eventResult("excessDealt"), theMainScheme))),
    ),
  ),
});
