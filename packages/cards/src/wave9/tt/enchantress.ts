import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec, PlayerRef } from "@mc/engine";
import {
  addCounters,
  after,
  alterEgoAction,
  boost,
  cannotMakeBasicAttacks,
  chooseOne,
  chooseOptions,
  controllerOf,
  defeatingPlayer,
  discardEncounterUntil,
  eachPlayerCost,
  engagedPlayerOf,
  enemyActivates,
  enemyAttack,
  enemyScheme,
  eventSource,
  firstPlayer,
  gets,
  giveStatus,
  hasTrait,
  heroAction,
  option,
  playFromHandReducingCost,
  refMatches,
  setVar,
  spend,
  type ChoiceOption,
  whenDefeated,
  anyOf,
  attachCard,
  canTakeStatus,
  choiceFoundNothing,
  chooseCards,
  chooseTarget,
  chosen,
  confuse,
  constant,
  defineAbilities,
  discard,
  discardAtRandom,
  discardFromHand,
  draw,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  eventAmount,
  exhaust,
  exhaustThis,
  exists,
  flipCard,
  forEachPlayer,
  forcedAction,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gainsTrait,
  giveBoostCard,
  heal,
  identityOf,
  ifThen,
  inMode,
  instead,
  moveCards,
  not,
  on,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  ready,
  refCount,
  removeThreat,
  revealCard,
  rule,
  searchAndReveal,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  stateCheck,
  stun,
  takeDamage,
  theMainScheme,
  theVillain,
  thatPlayer,
  countersOn,
  dealDamage,
  dealIndirectDamage,
  varAtLeast,
  valueAtLeast,
  whenRevealed,
  you,
  zone,
} from "../../dsl/index.js";

const ENCHANTMENT = trait("ENCHANTMENT");
const ENTHRALLED = trait("ENTHRALLED");
const DEFIANT = trait("DEFIANT");

const ENCHANTRESS_VILLAIN = query("villain", { name: "Enchantress" });
const FUTURE_OF_DESPAIR = query("sideScheme", { name: "Future of Despair" });
const CROWN = query("attachment", { name: "Crown of the Enchantress" });
const HYPNOTIC_GAZE = query([], { name: "Hypnotic Gaze" });
/** "The Enchantment card in your play area": the Gaze (or Trance) attached to your identity. */
const YOUR_ENCHANTMENT = each(query("attachment", { trait: ENCHANTMENT, host: identityOf(you) }));
/** "A card you control": a player card in play (encounter cards are under the scenario's control, RRG "Control", p. 11). */
const CARD_YOU_CONTROL = query(["ally", "support", "upgrade"], { controller: "you" });
/** Your identity, if a status card of this type could be given to it now (RRG "Otherwise": cannot at least partly resolve). */
const YOUR_IDENTITY_CAN_BE = (status: "stunned" | "confused"): ReturnType<typeof query> =>
  query("identity", { controller: "you", ...canTakeStatus(status) });

/** "The Enchantment card in their play area": the Enchantment attached to that player's identity. */
const ENCHANTMENT_OF = (player: PlayerRef) =>
  each(query("attachment", { trait: ENCHANTMENT, host: identityOf(player) }));
/** "Place 1 charm counter on the Enchantment card in your play area." */
const placeCharm = () => addCounters("charm", 1, YOUR_ENCHANTMENT);
/** "[Enchantress] schemes against you" (a scheme only: `on.enemyActivates` would hear her attacks too). */
const schemesAgainstYou = (by: "host") => ({ ...on.enemySchemes(by), playerIs: "controller" as const });

/**
 * "When Revealed: If your identity has the Defiant trait, choose one. If your identity has the Enthralled trait, do both
 * in any order" ("Do My Bidding", Magical Restraints, Spell Blast; docs/phase7-wave9.md section 3.56). Ruling February
 * 28, 2026 (5): each sentence chooses its options, and only then are the chosen options resolved. Both traits are read
 * first (`setVar`), so an option that flips the Hypnotic Gaze while it resolves (the fifth charm counter turns a Defiant
 * identity Enthralled) does not add the second sentence's options. `chooseOptions(2, ...)` is "both, in the order
 * chosen". Options are offered whether or not they would change anything (a confused Enchantress may be chosen to
 * scheme, which removes the status card: ruling February 28, 2026 (5), question 2).
 */
const defiantChoosesOneEnthralledDoesBoth = (...options: readonly ChoiceOption[]): EffectSpec[] => [
  ifThen(hasTrait(identityOf(you), ENTHRALLED), setVar("enthralled", 1)),
  ifThen(hasTrait(identityOf(you), DEFIANT), chooseOne(...options)),
  ifThen(varAtLeast("enthralled"), chooseOptions(2, options)),
];

/** "Search the encounter deck and discard pile for [a card of this kind] and reveal it. (Shuffle.)" */
const searchFor = (slot: string, kind: "minion" | "sideScheme"): EffectSpec[] => [
  chooseCards(slot, encounterCards(["deck", "discard"], query(kind)), { min: 1, max: 1 }),
  revealCard(chosen(slot), you),
  shuffleEncounterDeck(),
];

/** "Forced Response: After Enchantress attacks you, place 1 charm counter on the Enchantment card in your play area." */
const enchantressForcedResponse = () =>
  forcedResponse(after.enemyAttacks("self", { againstYou: true }), addCounters("charm", 1, YOUR_ENCHANTMENT));

/**
 * "Put the set-aside Future of Despair into play, then place an additional N[per_hero] threat on it." It is put into
 * play, not revealed: its own When Revealed does not trigger (RRG "When Revealed", p. 52; see the module header).
 */
const putFutureOfDespairIntoPlay = (additionalPerHero: number): readonly EffectSpec[] => [
  selectCards("despair", encounterSetAside(FUTURE_OF_DESPAIR)),
  putIntoPlay(chosen("despair")),
  placeThreat(perHero(additionalPerHero), chosen("despair")),
];

/**
 * "Forced Interrupt: When a charm counter would be placed on the Enchantment card in your play area, if your identity
 * has the Enthralled trait, place 1 threat here instead." (Prime Real Estate 1B, Sovereign Sorceress 2B.) The
 * placement is per counter: N counters become N threat on the main scheme (docs/phase7-wave9.md section 3.55).
 */
const charmBecomesThreat = () =>
  forcedInterrupt(
    on.countersWouldBePlaced(
      "charm",
      query("attachment", { trait: ENCHANTMENT, host: each(query("identity", { trait: ENTHRALLED })) }),
    ),
    instead(placeThreat(eventAmount, self)),
  );

/** Hypnotic Gaze, the same card five times: the Defiant grant and the flip at five charm counters. */
const gazeDefiant = () => constant(gainsTrait(DEFIANT, query("identity", { hostOfSelf: true })));
/**
 * "If there are 5 or more charm counters here, remove each charm counter from here and flip this card." The card says
 * only "flip"; MC55 p. 7 says the Trance side's When Revealed triggers as normal, hence the reveal
 * (docs/phase7-wave9.md section 3.54).
 */
const gazeFlip = () =>
  stateCheck(
    valueAtLeast(countersOn(self, "charm"), 5),
    { kind: "removeCounters", target: self, counterType: "charm" },
    flipCard(self, { reveal: true }),
  );
const tranceEnthralled = () => constant(gainsTrait(ENTHRALLED, query("identity", { hostOfSelf: true })));

/**
 * Trance of Greed: "Draw 1 card, then play that card (paying its cost). If you cannot, take 1 damage." The DSL has no
 * builder for a paid play of a named card (`playFromHandIgnoringCost` takes `card`; the paid builder does not), so the
 * engine's `playFromHand { card, costReduction: 0, mustPay }` is written out. "If you cannot": nothing was drawn, or the
 * drawn card is still in the hand because it cannot be played or paid for (a resource card, a wrong form, no valid
 * target, a unique already in play, a cost the player cannot meet). Owner decision 62B (2026-10-11): "play" has no
 * "may", so a card that can be played and paid for must be; the payment cannot be declined to keep the card and take
 * the damage (`mustPay`).
 */
const playDrawnCard: EffectSpec = {
  kind: "playFromHand",
  player: you,
  card: chosen("drawn"),
  costReduction: { kind: "const", value: 0 },
  mustPay: true,
};

/**
 * Enchantress, the Trickster Takeover scenario frame (docs/phase7-wave9.md sections 2.8, 3.53 to 3.56 and 8.4 item
 * 66; MC55 pp. 6 to 7). First half: the villain, both main schemes, Future of Despair, the five Hypnotic Gazes and their
 * Trance reverse sides. Second half: the encounter cards 55012 to 55026 (the Temptation attachments, Seduced, the Crown, the
 * four minions, the two side schemes and the four treacheries), scripted in one registry with the first half.
 *
 * **The villain (55001 to 55003)**: each stage's Forced Response puts a charm counter on the Enchantment card in the
 * attacked player's play area. Stage II (standard mode only) and stage III put the set-aside Future of Despair into
 * play and add 3 or 4 threat per hero to it (2 + 3 = 5, 2 + 4 = 6 per hero, MC55 p. 22 FAQ). Steady and Toughness are
 * data.
 *
 * **Prime Real Estate (55004, 55005)**: 1A's Setup sets Future of Despair aside (the scenario record does not list it
 * in `setAsideCardIds`, so the Setup does, which is what the card says) and attaches a random set-aside Hypnotic Gaze to
 * each identity, in player order, with its reverse side hidden (`attachCard` `hideReverse`). The five Gazes are
 * set aside by the scenario builder (Permanent, no Setup keyword), so "set each remaining Hypnotic Gaze aside" is
 * already done. Both stages' Forced Interrupt turns each charm counter bound for an Enthralled identity's Enchantment
 * into 1 threat on the main scheme. 2A: stun each identity if the Crown is in play; otherwise search for it and reveal it.
 *
 * **Future of Despair (55006)**: Enchantress gains stalwart and cannot take damage. Its When Revealed (a charm counter
 * on each Enchantment card in play) is scripted as printed, but the villain puts the card into play without revealing
 * it, so by the RRG the When Revealed never triggers in this scenario (owner question in the handoff).
 *
 * **Hypnotic Gaze and Trance (55007 to 55011)**: the Gaze (Defiant) flips at five charm counters, removing them all,
 * and the Trance's When Revealed resolves for the Gaze's player. Each Trance grants Enthralled and has a Forced Action
 * (exhaust this card) the player must take before the player phase ends. Each When Revealed is "X. Otherwise, Y": Y
 * resolves when X cannot (a card to discard, a status card that can be given, an identity that can be exhausted).
 *
 * Cards (23 listed by representative id, each with every ability of its card scripted; nothing is skipped):
 * - 55001 Enchantress (villain)
 * - 55004a Prime Real Estate (main_scheme)
 * - 55006 Future of Despair (side_scheme)
 * - 55007a Hypnotic Gaze (attachment)
 * - 55008a Hypnotic Gaze (attachment)
 * - 55009a Hypnotic Gaze (attachment)
 * - 55010a Hypnotic Gaze (attachment)
 * - 55011a Hypnotic Gaze (attachment)
 * - 55012 Alluring Call (attachment)
 * - 55013 Kiss of Temptation (attachment)
 * - 55014 Love Concoction (attachment)
 * - 55015 Seduced (attachment)
 * - 55016 Crown of the Enchantress (attachment)
 * - 55017 Enthralled Lackey (minion)
 * - 55018 Enthralled Brute (minion)
 * - 55019 Sindr (minion)
 * - 55020 Ulik (minion)
 * - 55021 Law of Attraction (side_scheme)
 * - 55022 Spellbound (side_scheme)
 * - 55023 "Do My Bidding" (treachery)
 * - 55024 Magical Restraints (treachery)
 * - 55025 Spell Blast (treachery)
 * - 55026 Spell Shards (treachery)
 */
export const ENCHANTRESS: AbilityRegistry = defineAbilities({
  // The villain.
  "55001.enchantress-forced-response": enchantressForcedResponse(),
  "55002.enchantress-forced-response": enchantressForcedResponse(),
  "55002.when-revealed": whenRevealed(ifThen(inMode("standard"), putFutureOfDespairIntoPlay(3))),
  "55003.enchantress-forced-response": enchantressForcedResponse(),
  "55003.when-revealed": whenRevealed(putFutureOfDespairIntoPlay(4)),

  // Prime Real Estate 1A / 1B and Sovereign Sorceress 2A / 2B.
  "55004a.setup": setup(
    moveCards(encounterCards(["deck", "discard"], FUTURE_OF_DESPAIR), "encounterSetAside"),
    forEachPlayer(
      eachPlayer,
      selectCards("gaze", encounterSetAside(HYPNOTIC_GAZE, { random: 1 })),
      attachCard(chosen("gaze"), identityOf(thatPlayer), { hideReverse: true }),
    ),
  ),
  "55004b.prime-real-estate-forced-interrupt": charmBecomesThreat(),
  "55005a.when-revealed": whenRevealed(
    ifThen(
      exists(CROWN),
      stun(each(query("identity"))),
      // "Search the encounter deck and discard pile for Crown of the Enchantress and reveal it. (Shuffle.)"
      searchAndReveal("Crown of the Enchantress"),
    ),
  ),
  "55005b.sovereign-sorceress-forced-interrupt": charmBecomesThreat(),

  // Future of Despair.
  "55006.future-of-despair-constant": constant(
    gainsKeyword({ name: "stalwart" }, ENCHANTRESS_VILLAIN),
    rule({ kind: "cannotTakeDamage", target: ENCHANTRESS_VILLAIN }),
  ),
  "55006.when-revealed": whenRevealed(addCounters("charm", 1, each(query("attachment", { trait: ENCHANTMENT })))),

  // The five Hypnotic Gazes: Defiant, and the flip at five charm counters.
  "55007a.hypnotic-gaze-constant": gazeDefiant(),
  "55007a.hypnotic-gaze-constant-2": gazeFlip(),
  "55008a.hypnotic-gaze-constant": gazeDefiant(),
  "55008a.hypnotic-gaze-constant-2": gazeFlip(),
  "55009a.hypnotic-gaze-constant": gazeDefiant(),
  "55009a.hypnotic-gaze-constant-2": gazeFlip(),
  "55010a.hypnotic-gaze-constant": gazeDefiant(),
  "55010a.hypnotic-gaze-constant-2": gazeFlip(),
  "55011a.hypnotic-gaze-constant": gazeDefiant(),
  "55011a.hypnotic-gaze-constant-2": gazeFlip(),

  // Trance of Envy.
  "55007b.trance-of-envy-constant": tranceEnthralled(),
  "55007b.when-revealed": whenRevealed(
    // No "choose": an encounter card targeting one of several eligible cards; the first player selects
    // (RRG 1.8 "First Player", p. 19).
    chooseTarget("card", CARD_YOU_CONTROL, { chooser: firstPlayer }),
    discard(chosen("card")),
    ifThen(choiceFoundNothing(), moveCards(zone("deck", you, { top: 8 }), "discard")),
  ),
  "55007b.trance-of-envy-forced-action": forcedAction(
    { cost: exhaustThis },
    giveBoostCard(theVillain),
    ready(identityOf(you)),
  ),

  // Trance of Greed.
  "55008b.trance-of-greed-constant": tranceEnthralled(),
  "55008b.when-revealed": whenRevealed(
    ifThen(exists(YOUR_IDENTITY_CAN_BE("confused")), confuse(identityOf(you)), takeDamage(2)),
  ),
  "55008b.trance-of-greed-forced-action": forcedAction(
    { cost: exhaustThis },
    draw(1, you, { bind: "drawn" }),
    playDrawnCard,
    selectCards("held", zone("hand", you, { filter: { inSlot: "drawn" } })),
    ifThen(anyOf(not(varAtLeast("drawn.count")), valueAtLeast(refCount(chosen("held")), 1)), takeDamage(1)),
  ),

  // Trance of Pride.
  "55009b.trance-of-pride-constant": tranceEnthralled(),
  "55009b.when-revealed": whenRevealed(
    ifThen(
      exists(query("identity", { controller: "you", exhausted: false })),
      exhaust(identityOf(you)),
      discardAtRandom(1),
    ),
  ),
  "55009b.trance-of-pride-forced-action": forcedAction(
    { cost: exhaustThis },
    placeThreat(1, theMainScheme),
    chooseTarget("scheme", query("sideScheme"), { chooser: firstPlayer }),
    removeThreat(2, chosen("scheme")),
  ),

  // Trance of Sloth.
  "55010b.trance-of-sloth-constant": tranceEnthralled(),
  "55010b.when-revealed": whenRevealed(
    ifThen(exists(YOUR_IDENTITY_CAN_BE("stunned")), stun(identityOf(you)), placeThreat(2, theMainScheme)),
  ),
  "55010b.trance-of-sloth-forced-action": forcedAction(
    { cost: exhaustThis },
    heal(1, theVillain),
    draw(1),
    discardFromHand(1),
  ),

  // Trance of Wrath.
  "55011b.trance-of-wrath-constant": tranceEnthralled(),
  "55011b.when-revealed": whenRevealed(
    chooseCards("found", encounterCards(["deck"], undefined, 5), { min: 1, max: 1 }),
    revealCard(chosen("found"), you),
    shuffleEncounterDeck(),
  ),
  "55011b.trance-of-wrath-forced-action": forcedAction(
    { cost: exhaustThis },
    dealIndirectDamage(you, 1),
    chooseTarget("minion", query("minion"), { chooser: firstPlayer }),
    dealDamage(2, chosen("minion")),
  ),

  // Alluring Call, Kiss of Temptation, Love Concoction: the sentence that needs no target (the counter) comes first, so
  // a missing target in the rest is not a way out (MC55 p. 22 FAQ: the counter may be the only outcome). The star
  // boost reveals the attachment, which attaches to the revealing player's identity.
  "55012.alluring-call-forced-action": forcedAction(
    { cost: exhaustThis },
    placeCharm(),
    playFromHandReducingCost(1, you, { mustPay: true }),
  ),
  "55012.alluring-call-action": alterEgoAction({ cost: exhaustThis }, discard(self)),
  "55012.boost": boost(revealCard(self, you)),
  "55013.kiss-of-temptation-forced-action": forcedAction(
    { cost: exhaustThis },
    placeCharm(),
    draw(1),
    discardFromHand(1),
  ),
  "55013.kiss-of-temptation-action": alterEgoAction({ cost: exhaustThis }, discard(self)),
  "55013.boost": boost(revealCard(self, you)),
  "55014.love-concoction-forced-action": forcedAction({ cost: exhaustThis }, placeCharm(), ready(identityOf(you))),
  "55014.love-concoction-action": alterEgoAction({ cost: exhaustThis }, discard(self)),
  "55014.boost": boost(revealCard(self, you)),

  // Seduced: no basic attacks (the identity's own; allies and attack abilities are untouched) and no Attack events.
  "55015.seduced-constant": constant(
    cannotMakeBasicAttacks(),
    rule({ kind: "cannotPlay", player: you, cards: query("event", { trait: trait("ATTACK") }) }),
  ),
  "55015.seduced-action": alterEgoAction({ cost: spend({ energy: 1, mental: 1 }) }, discard(self)),

  // Crown of the Enchantress (attached to Enchantress). The star in its SCH box is a reminder of the star Forced Response
  // (no SCH modifier). Hero Action: each player pays; with a tough status card among them the cost cannot be paid (RRG
  // p. 14; owner question 57, open, built on that).
  "55016.crown-of-the-enchantress-constant": constant(
    gainsKeyword({ name: "stalwart" }, { hostOfSelf: true }, { while: inMode("expert") }),
  ),
  "55016.crown-of-the-enchantress-forced-response": forcedResponse(schemesAgainstYou("host"), placeCharm()),
  "55016.crown-of-the-enchantress-action": heroAction(
    { cost: eachPlayerCost({ exhaustIdentity: true, damage: 1 }) },
    discard(self),
  ),

  // Enthralled Lackey (Quickstrike is data).
  "55017.enthralled-lackey-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    placeCharm(),
  ),
  "55017.boost": boost(
    chooseOne(
      option("Place 1 charm counter on your Enchantment card", placeCharm()),
      option(
        "Confuse your identity",
        chooseTarget("identity", YOUR_IDENTITY_CAN_BE("confused")),
        confuse(chosen("identity")),
      ),
    ),
  ),

  // Enthralled Brute (Guard is data).
  "55018.enthralled-brute-constant": constant(
    gets("hp", 3, { self: true }, { while: hasTrait(identityOf(engagedPlayerOf(self)), ENTHRALLED) }),
  ),
  "55018.boost": boost(
    chooseOne(
      option("Place 1 charm counter on your Enchantment card", placeCharm()),
      option("Exhaust your identity", exhaust(identityOf(you))),
    ),
  ),

  // Sindr: the two traits are read in separate sentences, in order (an activation that flips the Gaze changes the answer
  // to the second).
  "55019.sindr-constant": constant(rule({ kind: "attacksDealIndirectDamage", attacker: { self: true } })),
  "55019.when-revealed": whenRevealed(
    ifThen(hasTrait(identityOf(you), DEFIANT), enemyActivates(self, { against: you })),
    ifThen(hasTrait(identityOf(you), ENTHRALLED), giveStatus(self, "tough")),
  ),

  // Ulik. "That player" is the controller of the card that dealt the damage (an ally's or event's damage counts: "a
  // player deals"); damage "dealt" counts even when Future of Despair stops all of it.
  "55020.ulik-constant": constant(gainsKeyword({ name: "toughness" }, { self: true }, { while: inMode("expert") })),
  "55020.ulik-forced-response": forcedResponse(
    on.damage(ENCHANTRESS_VILLAIN, { dealt: true }),
    enemyAttack(self, { against: controllerOf(eventSource) }),
  ),
  "55020.when-defeated": whenDefeated(enemyAttack(theVillain, { against: defeatingPlayer, atkBonus: 1 })),

  // Law of Attraction.
  "55021.when-revealed": whenRevealed(
    discardEncounterUntil(query("minion", { trait: ENTHRALLED }), "found"),
    revealCard(chosen("found"), you),
  ),
  "55021.boost": boost(placeCharm()),

  // Spellbound: two sentences, so every Defiant player's counter first, then every Enthralled player's discard.
  "55022.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      ifThen(hasTrait(identityOf(thatPlayer), DEFIANT), addCounters("charm", 1, ENCHANTMENT_OF(thatPlayer))),
    ),
    forEachPlayer(
      eachPlayer,
      ifThen(hasTrait(identityOf(thatPlayer), ENTHRALLED), [
        chooseTarget("card", query(["ally", "support", "upgrade"], { controlledBy: thatPlayer }), {
          chooser: thatPlayer,
        }),
        discard(chosen("card")),
      ]),
    ),
  ),

  // "Do My Bidding", Magical Restraints, Spell Blast.
  "55023.when-revealed": whenRevealed(
    defiantChoosesOneEnthralledDoesBoth(
      option("Search for a minion and reveal it", searchFor("minion", "minion")),
      option("Search for a side scheme and reveal it", searchFor("scheme", "sideScheme")),
    ),
  ),
  "55024.when-revealed": whenRevealed(
    defiantChoosesOneEnthralledDoesBoth(
      option("You are stunned; place 1 charm counter", stun(identityOf(you)), placeCharm()),
      option("You are confused; place 1 charm counter", confuse(identityOf(you)), placeCharm()),
    ),
  ),
  "55025.when-revealed": whenRevealed(
    defiantChoosesOneEnthralledDoesBoth(
      option(
        "Enchantress schemes",
        ifThen(
          inMode("expert"),
          enemyScheme(theVillain, { against: you, schBonus: 1 }),
          enemyScheme(theVillain, { against: you }),
        ),
      ),
      option(
        "Enchantress attacks you",
        ifThen(
          inMode("expert"),
          enemyAttack(theVillain, { against: you, atkBonus: 1 }),
          enemyAttack(theVillain, { against: you }),
        ),
      ),
    ),
  ),

  // Spell Shards: "if your identity took any amount of damage this way" reads the characters that took indirect damage.
  "55026.when-revealed": whenRevealed(
    dealIndirectDamage(you, 3, { bind: "shards" }),
    ifThen(refMatches(chosen("shards.damaged"), query("identity", { controller: "you" })), placeCharm()),
  ),
  "55026.boost": boost(placeCharm()),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ENCHANTRESS_SKIPPED: Readonly<Record<string, string>> = {};
