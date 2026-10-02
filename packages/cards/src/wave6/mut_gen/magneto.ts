import { trait } from "@mc/content";
import type { RuleSpec } from "@mc/engine";
import {
  addCounters,
  allOf,
  andThen,
  atEndOfActivation,
  atMost,
  boost,
  cannotRecover,
  cannotThwart,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  countAmong,
  countOf,
  countersOn,
  dealDamage,
  dealEncounterCard,
  defeat,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterCards,
  discardEncounterUntil,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  enemyActivates,
  eventAmount,
  eventDealt,
  eventTarget,
  exhaust,
  exhaustYourHero,
  exists,
  firstPlayer,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  action,
  gainsKeyword,
  giveBoostCard,
  giveTough,
  heroResponse,
  host,
  instead,
  ifThen,
  confuse,
  losesKeyword,
  maxSustainedDamage,
  moveCards,
  not,
  on,
  perHero,
  placeDamage,
  placeThreat,
  query,
  refMatches,
  removeCountersFrom,
  revealCard,
  rule,
  scaled,
  searchAndReveal,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  stun,
  takeDamage,
  theMainScheme,
  theVillain,
  thatPlayer,
  topOfDeck,
  tuckCards,
  valueAtLeast,
  varOf,
  victoryDisplayCount,
  damagedAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  you,
  zone,
  coveredByEngineRule,
} from "../../dsl/index.js";

const MAGNETIC = trait("MAGNETIC");
const SENTINEL = trait("SENTINEL");
const MAGNETO = query("villain", { name: "Magneto" });
/** The villain the card is attached to (Magneto's own attachments; "attached to Magneto" is data). */
const HOST_VILLAIN = query("villain", { hostOfSelf: true });
/** Any card carrying the Magnetic trait, whatever its type. */
const MAGNETIC_CARD = query([], { trait: MAGNETIC });
const MAGNET_COUNTERS = countersOn(theMainScheme, "magnet");
/** "After your hero makes a basic attack against Magneto": an encounter card has no "you" to match, so the pattern names
 * any hero; the player offered the response is the attacking hero's (`heroResponse` also needs hero form). */
const ON_HERO_BASIC_ATTACKS_MAGNETO = on.attacks(query("hero"), { basic: true, target: MAGNETO });
const SPEND_ENERGY_MENTAL_PHYSICAL = spend({ energy: 1, mental: 1, physical: 1 });

/** "[star] Forced Response: After Magneto attacks you, place 1 magnet counter on the main scheme." (All three stages.) */
const magnetoForcedResponse = () =>
  forcedResponse(on.enemyAttacks("self", { againstYou: true }), addCounters("magnet", 1, theMainScheme));

/**
 * "Forced Response: After you place a magnet counter on this scheme, if there are at least 3 magnet counters here,
 * remove 3 of them and discard cards from the encounter deck until a [Magnetic] card is discarded. Reveal that card."
 * (Each main scheme B side, with the RRG 1.8 p. 68 erratum: the removal comes first.) Q8 (docs/phase7-wave6.md §4.1):
 * one `countersPlaced` event per placement, so six counters placed at once remove 3 once and leave 3. The encounter
 * deck is the first player's to reveal from; the card is revealed engaged with them if it is a minion.
 */
const magnetsGather = () =>
  forcedResponse(
    on.countersPlaced("magnet", "self"),
    ifThen(valueAtLeast(countersOn(self, "magnet"), 3), [
      removeCountersFrom(self, "magnet", 3),
      discardEncounterUntil(MAGNETIC_CARD, "magnetic"),
      revealCard(chosen("magnetic"), firstPlayer),
    ]),
  );

/** Sabotage Master Mold, the side scheme that is added to the victory display when it is defeated. */
const SABOTAGE = query("sideScheme", { name: "Sabotage Master Mold" });

/** "Take N damage. You may discard X cards from your hand to prevent X of that damage": the player picks X first. */
const missileDamage = () => [
  chooseCards("prevent", zone("hand", you), { min: 0, max: 5 }),
  moveCards(cards(chosen("prevent")), "discard", "prevented"),
  takeDamage(scaled(varOf("prevented.count"), { times: -1, plus: 5 })),
];

/**
 * The Magneto scenario's own encounter set (`mut_gen` 32138-32158, MC32 p. 18, docs/phase7-wave6.md §2.2): the villain
 * Magneto (32138-32140), the main scheme Asteroid M / Factory Online / The Rule of Magnus (32141a-32143b), the two
 * double-sided side schemes Boarding Party / Sabotage Master Mold (32144a/b) and Orbital Decay / Physical Strain
 * (32145a/b), M-Type Sentinel, Magneto's Helmet, Magneto's Armor, Magnetic Bubble, Wrapped in Metal, and the treacheries
 * and side schemes Master of Magnetism, Electric Shock, Electromagnetic Blast, Metal Shards, Magnetic Missile, Magnetic
 * Mayhem, Magnetically Sealed and Seized!. Not the Acolytes modular set (Zeal for the Cause 32164 is that set's).
 *
 * **The three damage caps** (Boarding Party 6, Sabotage Master Mold 12, Orbital Decay 18 `[per_hero]`) are
 * `maxSustainedDamage` (§3.3): damage beyond a cap is neither taken nor prevented and gives no excess (Q9 amended).
 * **Magnet counters** are placed one event per placement (Q8, §3.2).
 *
 * **Not scripted** (`KNOWN_SKIPPED`, `../coverage.test.ts`): M-Type Sentinel's boost (32146), see the comment on it.
 *
 * **Not exact**: Wrapped in Metal's "cannot thwart" is `cannotThwart` of the attached identity's *player*, so it also
 * stops that player's allies thwarting (the engine has no thwarter-scoped rule; Baron Zemo's "you cannot thwart" reads
 * the same way); "cannot attack" and "cannot defend" are scoped to the identity. Master of Magnetism's "topmost"
 * Magnetic card is `atMost(1, ...)` over the discard pile (docs/phase7-wave6-handoff.md §3.76: a selector with no
 * "topmost only" form).
 */
export const MAGNETO_ABILITIES = defineAbilities({
  "32138.magneto-forced-response": magnetoForcedResponse(),
  // Stages II and III — When Revealed: Deal each player a facedown encounter card.
  "32139.when-revealed": whenRevealed(dealEncounterCard(eachPlayer)),
  "32139.magneto-forced-response": magnetoForcedResponse(),
  "32140.when-revealed": whenRevealed(dealEncounterCard(eachPlayer)),
  "32140.magneto-forced-response": magnetoForcedResponse(),

  // Asteroid M 1A — Setup: Set the Orbital Decay side scheme aside. Reveal the Boarding Party side scheme.
  "32141a.setup": setup(
    moveCards(encounterCards(["deck"], { name: "Orbital Decay" }), "encounterSetAside"),
    ...searchAndReveal("Boarding Party", ["deck"], firstPlayer),
  ),
  "32141b.asteroid-m-forced-response": magnetsGather(),

  // Factory Online 2A — When Revealed: Place 1 magnet counter here. If Sabotage Master Mold is not in the victory
  // display, the first player searches the encounter deck and discard pile for a copy of the M-Type Sentinel minion and
  // reveals it.
  "32142a.when-revealed": whenRevealed(
    addCounters("magnet", 1, theMainScheme),
    ifThen(
      not(valueAtLeast(victoryDisplayCount(SABOTAGE), 1)),
      searchAndReveal("M-Type Sentinel", ["deck", "discard"], firstPlayer),
    ),
  ),
  "32142b.factory-online-forced-response": magnetsGather(),

  // The Rule of Magnus 3A — When Revealed: Place 2 magnet counters here. If Physical Strain is not attached to Magneto,
  // the first player searches the encounter deck and discard pile for a Magnetic attachment and reveals it.
  "32143a.when-revealed": whenRevealed(
    addCounters("magnet", 2, theMainScheme),
    ifThen(not(exists(query("attachment", { name: "Physical Strain" }))), [
      chooseCards("found", encounterCards(["deck", "discard"], query("attachment", { trait: MAGNETIC })), {
        min: 1,
        max: 1,
        chooser: firstPlayer,
      }),
      revealCard(chosen("found"), firstPlayer),
      shuffleEncounterDeck(),
    ]),
  ),
  "32143b.the-rule-of-magnus-forced-response": magnetsGather(),

  // Boarding Party (32144a) — Magneto cannot have more than 6[per_hero] sustained damage. When Defeated: Flip this card
  // and reveal Sabotage Master Mold.
  "32144a.boarding-party-constant": constant(maxSustainedDamage(MAGNETO, perHero(6))),
  "32144a.when-defeated": whenDefeated(flipCard(self)),
  // Sabotage Master Mold (32144b) — 12[per_hero]. When Defeated: Reveal the set-aside Orbital Decay side scheme. Add
  // this card to the victory display. The card goes to the display as it is defeated because it has Victory 0 here
  // (the data has no keyword for it: RRG 1.8 "Victory X", p. 46, sends a defeated side scheme with the keyword there).
  "32144b.sabotage-master-mold-constant": constant(
    maxSustainedDamage(MAGNETO, perHero(12)),
    gainsKeyword({ name: "victory", value: 0 }, SABOTAGE),
  ),
  "32144b.when-defeated": whenDefeated(
    selectCards("decay", encounterSetAside({ name: "Orbital Decay" })),
    revealCard(chosen("decay"), firstPlayer),
  ),
  // Orbital Decay (32145a) — 18[per_hero]. When Defeated: Flip this card and reveal Physical Strain.
  "32145a.orbital-decay-constant": constant(maxSustainedDamage(MAGNETO, perHero(18))),
  "32145a.when-defeated": whenDefeated(flipCard(self)),
  // Physical Strain (32145b) — Attach to Magneto (data). Permanent (data). Magneto loses steady.
  "32145b.physical-strain-constant": constant(losesKeyword({ name: "steady" }, HOST_VILLAIN)),

  // M-Type Sentinel (32146) — Guard (data). When Defeated: Give Magneto a tough status card.
  "32146.when-defeated": whenDefeated(giveTough(theVillain)),
  // [star] Boost: Give Magneto a tough status card and a facedown boost card. KNOWN_SKIPPED (docblock): `giveBoostCard`
  // is refused inside a Boost ability by `validateDefinition`, and `extraBoostCards` is wrong here (the card goes to
  // Magneto, who is not the enemy activating when the Sentinel is a boost card of another minion's activation).

  // Magneto's Helmet (32147) — Attach to Magneto (data). Magneto cannot be confused. Hero Response: After your hero
  // makes a basic attack against Magneto, spend [energy][mental][physical] → discard this card.
  "32147.magnetos-helmet-constant": constant(
    rule({ kind: "cannotHaveStatus", target: HOST_VILLAIN, statuses: ["confused"] } as RuleSpec),
  ),
  "32147.magnetos-helmet-response": heroResponse(
    ON_HERO_BASIC_ATTACKS_MAGNETO,
    { cost: SPEND_ENERGY_MENTAL_PHYSICAL },
    discard(self),
  ),
  // Magneto's Armor (32148) — Magneto cannot be stunned. The same Hero Response.
  "32148.magnetos-armor-constant": constant(
    rule({ kind: "cannotHaveStatus", target: HOST_VILLAIN, statuses: ["stunned"] } as RuleSpec),
  ),
  "32148.magnetos-armor-response": heroResponse(
    ON_HERO_BASIC_ATTACKS_MAGNETO,
    { cost: SPEND_ENERGY_MENTAL_PHYSICAL },
    discard(self),
  ),

  // Magnetic Bubble (32149) — Attach to Magneto (data). Magneto gains retaliate 1. Forced Interrupt: When Magneto would
  // take any amount of damage, place it here instead. Then, if there is 8 or more damage here, discard this card.
  // (`wave2/trors/crossbones.ts`' Armor: the damage placed here is not taken, so a hit that brings it to 8 is absorbed
  // in full.)
  "32149.magnetic-bubble-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, HOST_VILLAIN)),
  "32149.magnetic-bubble-forced-interrupt": forcedInterrupt(
    when.damage("host"),
    instead(placeDamage(eventAmount, self), ifThen(damagedAtLeast(self, 8), discard(self))),
  ),

  // Wrapped in Metal (32150) — Attach to your identity (data). Max 1 per identity: the set has one copy, so the
  // restriction can never apply. Attached identity cannot thwart, attack, defend, or recover.
  "32150.wrapped-in-metal-constant": coveredByEngineRule(),
  "32150.wrapped-in-metal-constant-2": constant(
    cannotThwart(controllerOf(host)),
    rule({
      kind: "cannotAttack",
      target: query("enemy"),
      attacker: query("identity", { hostOfSelf: true }),
    } as RuleSpec),
    rule({ kind: "cannotDefend", target: query("identity", { hostOfSelf: true }) } as RuleSpec),
    cannotRecover(controllerOf(host)),
  ),
  // Action: Exhaust your identity and spend a [physical] resource → discard this card.
  "32150.wrapped-in-metal-action": action({ cost: [exhaustYourHero, spend({ physical: 1 })] }, discard(self)),

  // Master of Magnetism (32151) — When Revealed: Take the topmost Magnetic card in the encounter discard pile and give it
  // to Magneto as a facedown boost card. Magneto activates against you. (§3.76: `atMost(1, ...)`, not "topmost" proper.)
  "32151.when-revealed": whenRevealed(
    selectCards("magnetic", atMost(1, encounterCards(["discard"], MAGNETIC_CARD))),
    giveBoostCard(theVillain, { card: chosen("magnetic") }),
    enemyActivates(theVillain, { against: you }),
  ),

  // Electric Shock (32152) — When Revealed (Alter-Ego): You are confused. Place 1 threat on the main scheme for each
  // magnet counter on it. (Hero): You are stunned. Take 1 damage for each magnet counter on the main scheme.
  "32152.when-revealed-alter-ego": whenRevealedAlterEgo(
    confuse(yourIdentity),
    placeThreat(MAGNET_COUNTERS, theMainScheme),
  ),
  "32152.when-revealed-hero": whenRevealedHero(stun(yourIdentity), takeDamage(MAGNET_COUNTERS)),

  // Electromagnetic Blast (32153) — When Revealed: Exhaust each upgrade and support you control. Place 1 magnet counter
  // on the main scheme. [star] Boost: Exhaust your identity.
  "32153.when-revealed": whenRevealed(
    exhaust(each(query(["upgrade", "support"], { controller: "you" }))),
    addCounters("magnet", 1, theMainScheme),
  ),
  "32153.boost": boost(exhaust(yourIdentity)),

  // Metal Shards (32154) — When Revealed: Deal 1 damage to each character you control. Place 1 magnet counter on the
  // main scheme. [star] Boost: If this is an attack that defeats an ally, place 1 magnet counter on the main scheme
  // (read at the end of the activation: `sabretooth.ts`'s Sabretooth Strikes).
  "32154.when-revealed": whenRevealed(
    dealDamage(1, each(query("character", { controller: "you" }))),
    addCounters("magnet", 1, theMainScheme),
  ),
  "32154.boost": boost(
    atEndOfActivation(
      ifThen(
        allOf(eventDealt("defeated"), refMatches(eventTarget, query("ally"), { anywhere: true })),
        addCounters("magnet", 1, theMainScheme),
      ),
    ),
  ),

  // Magnetic Missile (32155) — Surge (data). When Revealed: Defeat a Sentinel minion in play. Then, take 5 damage. You
  // may discard X cards from your hand to prevent X of that damage. The prevention is chosen before the damage, so the
  // damage is dealt as 5 minus X (as Sabretooth Strikes' exhaust-to-prevent option); the Sentinel is the revealing
  // player's choice, and with none in play the "then" part does not resolve (RRG 1.8 "'Then'", p. 44).
  "32155.when-revealed": whenRevealed(
    chooseTarget("sentinel", query("minion", { trait: SENTINEL })),
    defeat(chosen("sentinel")),
    andThen(...missileDamage()),
  ),

  // Magnetic Mayhem (32156) — When Defeated: The player who defeated this scheme discards the top 4 cards of the
  // encounter deck. That player places 1 magnet counter on the main scheme for each Magnetic card discarded this way.
  "32156.when-defeated": whenDefeated(
    discardEncounterCards(4, { bind: "mayhem" }),
    addCounters("magnet", countAmong(chosen("mayhem"), MAGNETIC_CARD), theMainScheme),
  ),

  // Magnetically Sealed (32157) — Crisis (data). When Revealed: Place 2 additional threat here for each ally in play.
  // [star] Boost: Exhaust each ally you control.
  "32157.when-revealed": whenRevealed(placeThreat(scaled(countOf(query("ally")), { times: 2 }), self)),
  "32157.boost": boost(exhaust(each(query("ally", { controller: "you" })))),

  // Seized! (32158) — When Revealed: Each player places the top 6 cards of their deck facedown under here. When
  // Defeated: Magneto activates against the player who defeated this scheme. (The cards under here are discarded with it.)
  "32158.when-revealed": whenRevealed(forEachPlayer(eachPlayer, tuckCards(topOfDeck(6, thatPlayer), self, true))),
  "32158.when-defeated": whenDefeated(enemyActivates(theVillain, { against: defeatingPlayer })),
});
