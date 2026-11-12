/**
 * The Punisher scenario pack (punisher-pk), by PermaKarma (rebuilt and reworded by the curators of
 * bluefireF5ran/mc-digital-custom-packs): every ability of the pack, each modeled on the base-game card or DSL builder
 * named in its comment. The pack's printed text is the authority (docs/custom-content-packs.md section 6), then the
 * RRG (v1.8) and FFG rulings for what the text does not override.
 *
 * Shared pieces:
 * - The Punisher attacking minions is `enemyAttacksEnemy` with a boost card (the Headpool ruling of January 26, 2026 (4),
 *   44014). That is an attack, not an activation (wave 3 section 4 Q12), so his own "After The Punisher activates against
 *   you" does not hear it: there is no loop. Nobody defends it and it is not made against a player (the event's own
 *   shape), which is the "cannot be defended, not made against a player" of the villain's text.
 * - War on Crime defines the war counter (`definedCounterTypes: ["war"]` in its card record); every threshold reads the
 *   counters on it live, so a threshold turns off again when counters leave.
 * - Three pieces still need engine primitives; each is a marked `TODO(engine)` below and listed in the README:
 *   (1) "ignore each Boost ability" with the boost icons still counting, on the Punisher's attacks on minions;
 *   (2) "Minions cannot stun him"; (3) a per-minion "activates before the villain" order; (4) Jigsaw's extra boost card
 *   on an attack against a minion; (5) Extreme Prejudice doubling boost icons. Until they exist those lines do nothing.
 */
import {
  action,
  addCounters,
  after,
  allOf,
  andThen,
  attackInProgress,
  bindTargets,
  chooseTarget,
  chosen,
  constant,
  countOf,
  countersOn,
  dealDamage,
  dealIndirectDamage,
  definePackAbilities,
  discard,
  discardEncounterCards,
  discardEncounterUntil,
  each,
  engagedPlayerOf,
  enemyAttacksEnemy,
  eventSource,
  eventTarget,
  exists,
  firstPlayer,
  forEachCard,
  forEachPlayer,
  eachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsIcon,
  gainsKeyword,
  gets,
  giveTough,
  heal,
  ifThen,
  instead,
  moveCards,
  encounterCards,
  named,
  not,
  on,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  refMatches,
  remainingHpOf,
  resetHitPoints,
  rule,
  self,
  spend,
  stun,
  superlative,
  surge,
  theMainScheme,
  theVillain,
  thatPlayer,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
} from "@mc/mod-sdk";

// The content package's `trait()` is not part of the SDK; a trait is its upper-cased name (as the Carnage pack does).
type Trait = NonNullable<NonNullable<Parameters<typeof query>[1]>["trait"]>;
const trait = (name: string): Trait => name.toUpperCase() as Trait;
const CRIMINAL = trait("Criminal");
const LOCATION = trait("Location");
const VEHICLE = trait("Vehicle");

const WAR_ON_CRIME = named("War on Crime");
/** The Punisher, whichever of his three stages is the villain. */
const THE_PUNISHER = query("villain", { name: "The Punisher" });
/** "An ally or enemy". */
const ALLY_OR_ENEMY = { anyOf: [query("ally"), query("enemy")] };
/** "An encounter card" as the source of damage: a card with no controller (the villain, a minion, a treachery, ...). */
const ENCOUNTER_CARD = { controller: "encounter" } as const;

/** "If the number of war counters here is at least N[per_hero]". */
const warAtLeast = (n: number) => valueAtLeast(countersOn(self, "war"), perHero(n));

/** The three stages share one text. */
const punisherStage = (stage: "i" | "ii" | "iii") => ({
  // [star] Forced Response: After The Punisher activates against you, he also attacks each minion engaged with you.
  // Modeled on Headpool (44014, `enemyAttacksEnemy` with a boost card) and Whirlwind (01130, "also" attacks): one attack
  // per minion engaged with the player he activated against, resolved in an order the first player picks (forEachCard's
  // default chooser). Rachel Cole-Alves is skipped by her own "cannot attack" rule.
  // TODO(engine): "ignore each 'Boost' ability" while the boost icons still count. `ignoreBoost` and
  // `ignoreBoostForThisAttack` ignore icons and abilities together (Aerial Agility 42004). Needed: an abilities-only
  // variant that applies to this `enemyAttacksEnemy` attack: boost card dealt, icons added to the ATK, no "Boost:" ability
  // resolved.
  [`x.punisher-pk.01.activation-attacks-minions-${stage}`]: forcedResponse(
    on.enemyActivates("self", { againstYou: true }),
    forEachCard(
      "minion",
      each(query("minion", { engagedWith: "you" })),
      enemyAttacksEnemy(self, chosen("minion"), { boost: true }),
    ),
  ),
  // Forced Response: After an ally or enemy is defeated by The Punisher or by an encounter card, place 1 war counter on
  // War on Crime. Modeled on Small but Mighty (13001a, `characterDefeated.sourceIs`). The Punisher is an encounter card
  // himself, so "or by an encounter card" already covers him; it is written as printed. A minion's retaliate or a
  // treachery's damage (source: that card) counts, a player's attack does not.
  [`x.punisher-pk.01.war-counter-${stage}`]: forcedResponse(
    { ...on.defeated(ALLY_OR_ENEMY), sourceIs: ENCOUNTER_CARD },
    addCounters("war", 1, WAR_ON_CRIME),
  ),
  // Minions cannot attack or stun him. (Printed in the first ability's box; its own constant here.) Attack: Speed Demon's
  // attack back and any minion's attack on him are `cannotAttack` with `attacker` the minions (docs/phase7-wave2.md 25).
  // TODO(engine): "cannot be stunned by" a minion (Sinister Syndicate's Shocker stuns the attacker, 24045): a rule filtered
  // on the source of the status card, so a minion's effect cannot place a stunned status card on him.
  [`x.punisher-pk.01.minions-cannot-attack-${stage}`]: constant(
    rule({ kind: "cannotAttack", attacker: query("minion"), target: { self: true } }),
  ),
});

/** "During step 2 of the villain phase, X activates against you before The Punisher does." */
// TODO(engine): a per-minion "activates before the villain" flag. RRG 1.8 villain phase step 2 resolves the villain
// first, then each minion; `activationOrder` orders villains only (The Sinister Six). Needed: a keyword-like grant on a
// minion (`activatesBeforeVillain`) read by the step-2 loop, so the minion activates against its engaged player ahead of
// the villain's activation against that player. Until then it is an empty constant and the minion activates after him.
const ACTIVATES_BEFORE_THE_VILLAIN = () => constant();

export default definePackAbilities({
  ...punisherStage("i"),
  ...punisherStage("ii"),
  ...punisherStage("iii"),

  // Frank's War 1B — Forced Interrupt: When the player phase begins, each player who is not engaged with a minion
  // discards the top card of the encounter deck. If that card is a minion, that player puts it into play engaged with
  // them. Modeled on Superhero Jailbreak (56202b: each player in order discards the top card, a minion is put into play
  // engaged with them) and Hail Hydra! (03030: the "not engaged with" check). Maggia Thug's own text, "Ignore Maggia Thug
  // when resolving Frank's War's Forced Interrupt", is applied here as a name filter: a player engaged only with Maggia
  // Thugs is not engaged with a minion for this ability. ("If this stage is completed, the players lose" is data.)
  "x.punisher-pk.04b.franks-war-forced-interrupt": forcedInterrupt(
    on.phaseBeginning("player"),
    forEachPlayer(
      eachPlayer,
      ifThen(not(exists(query("minion", { engagedWithPlayer: thatPlayer, not: { name: "Maggia Thug" } }))), [
        discardEncounterCards(1, { bind: "war" }),
        ifThen(refMatches(chosen("war"), query("minion"), { anywhere: true }), putIntoPlay(chosen("war"), thatPlayer)),
      ]),
    ),
  ),

  // War on Crime — Permanent. Setup. (data) If the number of war counters here is at least:
  // 1[per_hero]: The Punisher gains steady. Modeled on Formidable Foe (24049a, "the villain gains steady").
  "x.punisher-pk.05.war-on-crime-constant": constant(
    gainsKeyword({ name: "steady" }, THE_PUNISHER, { while: warAtLeast(1) }),
  ),
  // 2[per_hero]: +1 SCH and +1 ATK. Cumulative with the tier above. Modeled on Ultron (01136: a villain stat boost).
  "x.punisher-pk.05.war-on-crime-constant-2": constant(
    gets("sch", 1, THE_PUNISHER, { while: warAtLeast(2) }),
    gets("atk", 1, THE_PUNISHER, { while: warAtLeast(2) }),
  ),
  // 4[per_hero]: 1[per_hero] hazard icon. `gainsIcon`'s count is a number, not a per-player value, so there is one rule
  // per possible player count (1 to 4): the rule for k players applies only with k or more players, and exactly one more
  // icon per player is in effect. Modeled on Rule by Force (29029, a conditional hazard icon).
  // Reading: if the engine's icon count ever takes a per-player amount, this collapses to one rule.
  "x.punisher-pk.05.war-on-crime-constant-3": constant(
    ...[1, 2, 3, 4].map((k) =>
      gainsIcon("hazard", THE_PUNISHER, {
        count: 1,
        while: allOf(warAtLeast(4), valueAtLeast(perHero(1), k)),
      }),
    ),
  ),
  // 6[per_hero]: Threat cannot be removed from the main scheme. Modeled on Ultron III (01136: a "cannot be removed" rule).
  "x.punisher-pk.05.war-on-crime-constant-4": constant(
    rule({ kind: "threatCannotBeRemoved", target: query("mainScheme"), while: warAtLeast(6) }),
  ),

  // David "Micro" Lieberman — Attach to the villain (data). Forced Response: After a minion is defeated by The Punisher,
  // place 1 threat on the main scheme and 1 war counter on War on Crime. Modeled on Prelate Sidearm (45063: a forced
  // response on an attachment to the villain) with Small but Mighty's defeat source (13001a).
  "x.punisher-pk.06.david-micro-lieberman-forced-response": forcedResponse(
    { ...on.defeated(query("minion")), sourceIs: query("villain") },
    placeThreat(1, theMainScheme),
    addCounters("war", 1, WAR_ON_CRIME),
  ),
  // Action: Spend [energy][mental][physical] resources -> discard this card. Modeled on Sonic Converter (01118).
  "x.punisher-pk.06.david-micro-lieberman-action": action(
    { cost: spend({ energy: 1, mental: 1, physical: 1 }) },
    discard(self),
  ),

  // Maggia Capo — Incite 1 (data). When Revealed: Discard cards from the encounter deck until a Criminal minion is
  // discarded. Put that minion into play engaged with you. The Masters of Evil (01128). With no Criminal minion left the
  // discarding stops at the end of the deck (RRG 1.8 "Encounter Deck", p. 17) and nothing is put into play: the author has
  // been asked (README, open items).
  "x.punisher-pk.07.when-revealed": whenRevealed(
    discardEncounterUntil(query("minion", { trait: CRIMINAL }), "minion"),
    putIntoPlay(chosen("minion"), you),
  ),

  // Maggia Enforcer — Incite 1 (data). [star] Maggia Enforcer gets +1 ATK for each other minion engaged with you ("you" on
  // a minion is the engaged player). Modeled on Ultron's drone count (01135, `countOf` of the engaged player's minions).
  "x.punisher-pk.08.maggia-enforcer-constant": constant(
    gets("atk", countOf(query("minion", { engagedWithPlayer: engagedPlayerOf(self), not: { self: true } })), {
      self: true,
    }),
  ),

  // Maggia Thug — Ignore Maggia Thug when resolving Frank's War's Forced Interrupt. Applied on Frank's War itself (a name
  // filter in its check, above), so the card's own ability is text with nothing to resolve (as Breakout, 07001a).
  "x.punisher-pk.09.maggia-thug-constant": constant(),

  // Barracuda — Toughness (data).
  "x.punisher-pk.10.barracuda-constant": ACTIVATES_BEFORE_THE_VILLAIN(),
  // When Defeated: If Barracuda was defeated by The Punisher, give The Punisher a tough status card. A When Defeated reads
  // the defeat's source (`eventSource`), as Hydra Soldier's reads the defeating player (core hydra-and-doomsday).
  "x.punisher-pk.10.when-defeated": whenDefeated(ifThen(refMatches(eventSource, THE_PUNISHER), giveTough(theVillain))),

  // Bullseye — activates before The Punisher (TODO above).
  "x.punisher-pk.11.bullseye-constant": ACTIVATES_BEFORE_THE_VILLAIN(),
  // Forced Response: After Bullseye attacks and damages an ally, discard that ally. Modeled on Sonic Converter (01118:
  // after the villain attacks and damages a character, act on that character).
  "x.punisher-pk.11.bullseye-forced-response": forcedResponse(
    after.enemyAttacks("self", { damages: true }),
    ifThen(refMatches(eventTarget, query("ally")), discard(eventTarget)),
  ),
  // When Defeated: If Bullseye was defeated by The Punisher, place 1[per_hero] war counter on War on Crime.
  "x.punisher-pk.11.when-defeated": whenDefeated(
    ifThen(refMatches(eventSource, THE_PUNISHER), addCounters("war", perHero(1), WAR_ON_CRIME)),
  ),

  // Hammerhead — activates before The Punisher (TODO above).
  "x.punisher-pk.12.hammerhead-constant": ACTIVATES_BEFORE_THE_VILLAIN(),
  // Forced Response: After a friendly character attacks Hammerhead, stun that character. Modeled on Shocker (24045). Only
  // a friendly character makes an `attack`; the Punisher's attacks are `enemyAttacksEnemy` and are not heard.
  "x.punisher-pk.12.hammerhead-forced-response": forcedResponse({ on: "attack", selfIs: "target" }, stun(eventSource)),
  // When Defeated: If Hammerhead was defeated by The Punisher, place 1[per_hero] threat on the main scheme.
  "x.punisher-pk.12.when-defeated": whenDefeated(
    ifThen(refMatches(eventSource, THE_PUNISHER), placeThreat(perHero(1), theMainScheme)),
  ),

  // Jigsaw — activates before The Punisher (TODO above).
  "x.punisher-pk.13.jigsaw-constant": ACTIVATES_BEFORE_THE_VILLAIN(),
  // Forced Interrupt: When The Punisher attacks Jigsaw, give The Punisher an additional boost card for this attack.
  // TODO(engine): `modifyAttack({ extraBoostCards })` and `extraBoostCards` on `enemyActivates` act on an activation; the
  // Punisher's attack on Jigsaw is an `enemyAttacksEnemy`. Needed: an interrupt to `enemyAttacksEnemy` (pattern: this
  // card is the target, the attacker a villain) that adds boost cards to that attack (`modifyAttack`-style, read where
  // the attack's boost cards are dealt, resolve/event.ts enemyAttacksEnemy with `boostPlayerId`). Empty until then.
  "x.punisher-pk.13.jigsaw-forced-interrupt": constant(),
  // When Defeated: If Jigsaw was defeated by The Punisher, heal 3 damage from The Punisher.
  "x.punisher-pk.13.when-defeated": whenDefeated(ifThen(refMatches(eventSource, THE_PUNISHER), heal(3, theVillain))),

  // Rachel Cole-Alves (the curators' proposal, not the author's card) — The Punisher cannot attack Rachel Cole-Alves.
  // An `attacker`- and `target`-scoped `cannotAttack` rule also holds for an `enemyAttacksEnemy` attack (the effect's own
  // contract, spec.ts), so forEachCard's attack on her does not happen. Modeled on Encased in Ice (54035).
  "x.punisher-pk.14.rachel-cole-alves-constant": constant(
    rule({ kind: "cannotAttack", attacker: THE_PUNISHER, target: { self: true } }),
  ),
  // The Punisher gets +2 ATK while attacking a minion. Modeled on Secret Avengers (56142b: +ATK while attacking), with
  // `attackInProgress` reading the minion target of an enemyAttacksEnemy attack.
  "x.punisher-pk.14.rachel-cole-alves-constant-2": constant(
    gets("atk", 2, THE_PUNISHER, { while: attackInProgress({ attacker: THE_PUNISHER, target: query("minion") }) }),
  ),
  // Forced Interrupt: When The Punisher schemes, heal 2 damage from him.
  "x.punisher-pk.14.rachel-cole-alves-forced-interrupt": forcedInterrupt(
    on.enemySchemes(THE_PUNISHER),
    heal(2, theVillain),
  ),

  // The Russian — activates before The Punisher (TODO above).
  "x.punisher-pk.15.the-russian-constant": ACTIVATES_BEFORE_THE_VILLAIN(),
  // Forced Interrupt: When The Russian would be defeated by a friendly character or a player card, discard the top card of
  // the encounter deck. If that card is a minion, reset The Russian's hit points to 1 instead. Modeled on Loki (06028:
  // "would be defeated", discard the top card, `instead`) with the defeat's source as the filter: a card with a controller
  // is a friendly character or a player card, so The Punisher's own attacks (an encounter card) kill him normally.
  "x.punisher-pk.15.the-russian-forced-interrupt": forcedInterrupt(
    { ...on.defeated("self"), sourceIs: { not: ENCOUNTER_CARD } },
    { would: true },
    moveCards(encounterCards(["deck"], undefined, 1), "discard", "flipped"),
    ifThen(
      refMatches(chosen("flipped"), query("minion"), { anywhere: true }),
      instead(resetHitPoints(self, { to: 1 })),
    ),
  ),

  // Extreme Prejudice — Each boost icon counts twice during The Punisher's attacks against minions.
  // TODO(engine): a doubling modifier on the `boostIconsCounting` event (Scarlet Witch's Crest adds +1; this multiplies
  // the count), scoped to an attack by The Punisher whose target is a minion. Shape: an interrupt or rule on
  // `boostIconsCounting` with a `factor: 2` (or "count each icon N times"), conditioned on `attackInProgress({ attacker:
  // The Punisher, target: a minion })`. Empty until then.
  "x.punisher-pk.16.extreme-prejudice-constant": constant(),

  // War on Vigilantes — [star] Hinder 1[per_hero] (data). Forced Interrupt: When the villain phase ends, in player order,
  // each player discards the top card of the encounter deck. Each player who discards a minion this way puts it into play
  // engaged with them. Modeled on Superhero Jailbreak (56202b).
  "x.punisher-pk.17.war-on-vigilantes-forced-interrupt": forcedInterrupt(
    on.phaseEnding("villain"),
    forEachPlayer(
      eachPlayer,
      discardEncounterCards(1, { bind: "vigilantes" }),
      ifThen(
        refMatches(chosen("vigilantes"), query("minion"), { anywhere: true }),
        putIntoPlay(chosen("vigilantes"), thatPlayer),
      ),
    ),
  ),

  // War Zone — [star] Hinder 1[per_hero] (data). The Punisher cannot be attacked while there is a minion in play (any
  // minion, Rachel included). Modeled on Ultron III's "cannot take damage while a Drone is in play" (01136), as a
  // `cannotAttack` rule with a `while` (players' attacks on him; the table is bound).
  "x.punisher-pk.18.war-zone-constant": constant(
    rule({ kind: "cannotAttack", target: THE_PUNISHER, while: exists(query("minion")) }),
  ),

  // Collateral Damage — When Revealed: Discard a Location or Vehicle support or upgrade you control. Then take 3 indirect
  // damage. If no card was discarded this way, this card gains surge. "Then" (RRG 1.8 "'Then'", p. 44): the indirect damage
  // resolves only if a card was discarded, so with none the card only gains surge. Reading: the printed "If no card was
  // discarded" after a "Then" is the replacement for the damage, not an addition to it (README, readings).
  "x.punisher-pk.19.when-revealed": whenRevealed(
    ifThen(
      exists(query(["support", "upgrade"], { controller: "you", anyTrait: [LOCATION, VEHICLE] })),
      [
        chooseTarget("collateral", query(["support", "upgrade"], { controller: "you", anyTrait: [LOCATION, VEHICLE] })),
        discard(chosen("collateral")),
        andThen(dealIndirectDamage(you, 3)),
      ],
      surge(),
    ),
  ),

  // Explosive Surprise — When Revealed: You are stunned. Deal 3 damage to the minion in play with the fewest remaining hit
  // points (a tie: the first player picks). Modeled on You're Dead Meat! (07016, the superlative then a pick).
  "x.punisher-pk.20.when-revealed": whenRevealed(
    stun(yourIdentity),
    bindTargets("fewest", superlative("lowest", each(query("minion")), remainingHpOf(chosen("candidate")))),
    chooseTarget("surprise", { inSlot: "fewest" }, { chooser: firstPlayer }),
    dealDamage(3, chosen("surprise")),
  ),

  // Submachine Gun Spray — When Revealed: Deal 1 damage to each character you control and each minion engaged with you.
  "x.punisher-pk.21.when-revealed": whenRevealed(
    dealDamage(
      1,
      each({ anyOf: [query("character", { controller: "you" }), query("minion", { engagedWith: "you" })] }),
    ),
  ),
});
