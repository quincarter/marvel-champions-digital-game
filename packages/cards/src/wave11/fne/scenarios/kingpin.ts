import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  activatingEnemy,
  activationIs,
  actingCharacter,
  addCounters,
  advanceMainScheme,
  after,
  andThen,
  anyOfCards,
  attachCard,
  attachInstruction,
  identityOf,
  boost,
  chooseCards,
  chosen,
  confuse,
  constant,
  countersOn,
  dealDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterUntil,
  discardFromHandCost,
  each,
  eachPlayer,
  encounterCards,
  enemyActivates,
  enemyAttack,
  enemyScheme,
  eventAmount,
  eventSource,
  eventTarget,
  exists,
  findCard,
  firstPlayer,
  flipCard,
  forEachPlayer,
  forEachPlayerInChosenOrder,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gets,
  giveBoostCard,
  giveStatus,
  heroAction,
  ifThen,
  inForm,
  inMode,
  instead,
  interrupt,
  isConfused,
  isStunned,
  modifyAttack,
  moveCards,
  cards,
  not,
  on,
  perHero,
  placeDamage,
  placeThreat,
  query,
  refMatches,
  removeCountersFrom,
  removeThreat,
  revealCard,
  rule,
  damagedAtLeast,
  self,
  selectCards,
  setAside,
  setup,
  shuffleEncounterDeck,
  spend,
  stun,
  sum,
  surge,
  takeControl,
  thatPlayer,
  theMainScheme,
  theVillain,
  threatOn,
  treatSelfAsAlly,
  valueAtLeast,
  valueEquals,
  varAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
} from "../../../dsl/index.js";

const UNDERLING = trait("UNDERLING");
const MARTIAL_ARTIST = trait("MARTIAL ARTIST");
const THWART = trait("THWART");
const ATTACK = trait("ATTACK");

const UNDERLING_MINION = query("minion", { trait: UNDERLING });
const PUBLIC_SUPPORT = query("environment", { name: "Public Support" });
/** The Kingpin villain on his martial-artist side (A2 / B2); on side 1 he is only a Criminal. */
const KINGPIN_IS_MARTIAL_ARTIST = exists(query("villain", { trait: MARTIAL_ARTIST }));
/**
 * "Your / their nemesis minion" and "nemesis side scheme" (RRG 1.8 "Nemesis Encounter Set", p. 30), for the scoped
 * player. */
const NEMESIS_MINION_OF_THAT_PLAYER = query("minion", { nemesisMinionOf: thatPlayer });
const NEMESIS_SIDE_SCHEME_OF_THAT_PLAYER = query("sideScheme", { nemesisSideSchemeOf: thatPlayer });
/** The scoped player's nemesis minion, in play (a reveal that was turned away leaves it out). */
const NEMESIS_MINION_IN_PLAY = query("minion", { nemesisMinionOf: thatPlayer });
const ORGANIZED_CRIME = query("sideScheme", { name: "Organized Crime" });
/** "Your set-aside nemesis set" (Bag of Tricks): the cards of your nemesis encounter set in your set-aside area. */
const YOUR_NEMESIS_SET = { nemesisSetOf: you } as const;
/** "The attacker" that Spot's damage goes back to: the character that made the attack (RRG 1.8 "You, Your", p. 49). */
const ATTACKER = actingCharacter(eventSource);

/**
 * "Kingpin cannot be dealt damage or have upgrades attached." (60159a, 60160a.) "Cannot be dealt" is the `dealt`
 * stage of `cannotTakeDamage`: nothing is dealt, so Mountain of Muscle's "would take" never sees it, while his
 * "after attacked" windows and retaliate still run (docs/phase7-wave11-scenarios.md section S3.5). "Stalwart" (no
 * stun or
 * confused status, MC60 p. 23) is data.
 */
const untouchable = () =>
  constant(
    rule({ kind: "cannotTakeDamage", target: { self: true }, stage: "dealt" }),
    rule({ kind: "cannotHaveAttachments", target: { self: true }, from: "upgrade" }),
  );

/**
 * "[star] Forced Interrupt: When Kingpin would attack you, he schemes instead." (As Echo's Kingpin 60061, for every
 * player.) */
const schemesInstead = () =>
  forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    { would: true },
    instead(enemyScheme(self, { against: you })),
  );

/**
 * "[star] Forced Interrupt: When Kingpin activates against you, if you are not engaged with a minion, give Kingpin 1
 * additional boost card for this activation[ and this activation gains overkill if it is an attack]." (60159b, 60160b.)
 */
const alone = (overkill: boolean) =>
  forcedInterrupt(
    on.enemyActivates("self", { againstYou: true }),
    ifThen(not(exists(query("minion", { engagedWith: "you" }))), [
      modifyAttack({ extraBoostCards: 1 }),
      ...(overkill ? [ifThen(activationIs("attack"), modifyAttack({ overkill: true }))] : []),
    ]),
  );

/**
 * "Find an Underling minion that is not in play and reveal it" for `thatPlayer`: the finder picks among the Underling
 * minions in the encounter deck and discard pile (a nemesis set holds no Underling). The caller shuffles the deck.
 */
const findUnderling = [
  chooseCards("underling", encounterCards(["deck", "discard"], UNDERLING_MINION), {
    min: 1,
    max: 1,
    chooser: thatPlayer,
  }),
  revealCard(chosen("underling"), thatPlayer),
];

/** The nemesis minion of `thatPlayer`, out of play: the encounter deck, its discard pile, or the set-aside area. */
const findNemesisMinion = anyOfCards(
  encounterCards(["deck", "discard"], NEMESIS_MINION_OF_THAT_PLAYER),
  setAside(thatPlayer, NEMESIS_MINION_OF_THAT_PLAYER),
);

/** The cost of James Wesley's and Vanessa Fisk's Hero Actions: "Discard a [Thwart / Attack] event from your hand". */
const discardEvent = (kind: typeof THWART) => ({
  cost: discardFromHandCost(1, 1, undefined, query("event", { trait: kind })),
});

/**
 * "If Kingpin has the Martial Artist trait, attach to [host]. Otherwise, this card gains surge." (Bear Hug 60164,
 * Mountain
 * of Muscle 60167.) The host depends on Kingpin's side, so it is no data host: the card's attach instruction attaches
 * it, or gives it surge.
 */
// Conditional "attach to" text: RRG 1.8 "Attach To" p. 8, "Reveal" p. 38 step 2; docs/phase7-wave7.md section 3.35.
const attachIfMartialArtist = (...host: Parameters<typeof attachCard>[1][]) =>
  attachInstruction(
    ifThen(
      KINGPIN_IS_MARTIAL_ARTIST,
      host.map((h) => attachCard(self, h)),
      surge(),
    ),
  );

/**
 * The Kingpin scenario (docs/phase7-wave11-scenarios.md section S6; MC60 p. 23, FAQ p. 26).
 *
 * **60159a/b, 60160a/b Kingpin (A1/A2, B1/B2)**: side 1 (both modes) cannot be dealt damage or have upgrades attached
 * and
 * schemes in place of every attack (Stalwart is data); side 2 (Steady is data) gives Kingpin 1 additional boost card
 * for an activation against a player not engaged with a minion, and in expert mode (B2) an attack that activation makes
 * gains overkill.
 * **60161a/b The King's Gambit**: Setup reveals each player's set-aside nemesis minion; one that shares a title with a
 * character in play (Echo's Kingpin) is removed from the game and that player finds and reveals an Underling instead
 * (the minion is removed, not discarded: MC60 p. 23, unlike the Unique Icon rule of RRG 1.8 pp. 45-46). 1B puts Public
 * Support into play, Low side up. Hero Action: remove 5 threat (4 in expert mode), shuffle the encounter discard pile
 * into the deck and discard
 * until a minion is discarded and reveal that minion. Completing the stage loses the game (data).
 * **60162a/b Endgame**: When Revealed: each player finds their nemesis minion that is out of play and reveals it; a
 * player whose nemesis minion did not enter play this way (in play, removed from the game, or not found) finds an
 * Underling and reveals it; in expert mode the first player finds and reveals Organized Crime. Each minion gains guard.
 * **60163a/b Public Support**: a Forced Response counts defeated minions; at 2[per_hero]+2 support counters the
 * villain phase's start flips Kingpin, advances the main scheme and flips this card to High (a flip reveals the new
 * face but is not a reveal of this card, so no When Revealed: docs/phase7-wave11-scenarios.md section S4.0).
 * **60164 Bear Hug**: "cannot change to alter-ego form" only matters in hero form, where it is attached
 * (`inForm("hero")`); the Forced Interrupt replaces a thwart or attack by the host with a grip counter lost, and Uses
 * (data) discards it with the last.
 * **60165 James Wesley**, **60168 Vanessa Fisk**: attach to Kingpin (data). Their Hero Actions pay with an event from
 * hand.
 * **60166 Kingpin's Cane**: Forced Response stuns the hero Kingpin damaged and discards the Cane if a status card was
 * given.
 * **60167 Mountain of Muscle**: Retaliate 1 to its host; absorbs the host's damage ("would take", so after a tough
 * status card, RRG 1.8 "Damage", p. 14) and goes at 8.
 * **60169 Black Cat**: owner decision Q205 = B (docs/phase7-wave11-scenarios.md section S4.1): she is an ally while she
 * has exactly 4 threat. The Hero Action puts the 4th threat on and takes control of her.
 * **60170 Diamondback**: 1 damage to the player when he attacks them, and as a boost. **60171 Spot, 60172
 * Stilt-Man**: "enters
 * play with N counters" is a Forced Response after entering play (as Core's Hawkeye). Spot sends an attack's damage
 * back to the
 * attacker while he has a counter; Stilt-Man loses a counter instead of taking damage while he has one (with none he
 * takes it: reading flagged to the rules expert).
 * **60173 Kingpin's Influence**: the defeating player puts 3 threat on their nemesis side scheme, or reveals it when it
 * is not in play (no threat is placed on a scheme that is not there yet: the printed order).
 * **60174 Organized Crime**, **60176 Unrelenting Hate**: as printed (an unfound nemesis minion is replaced by an
 * Underling).
 * 60163b's High-side Interrupt replaces the give of a facedown boost card to an enemy (`on.boostCardWouldBeGiven`,
 * docs/phase7-wave11-scenarios.md E23). **60175 Bag of Tricks** picks its card from the seeded RNG (`setAside`'s
 * `random`, E24).
 *
 * Cards (17):
 * - 60159a Kingpin (villain)
 * - 60160a Kingpin (villain)
 * - 60161a The King's Gambit (main_scheme)
 * - 60163a Public Support (environment)
 * - 60164 Bear Hug (attachment)
 * - 60165 James Wesley (attachment)
 * - 60166 Kingpin's Cane (attachment)
 * - 60167 Mountain of Muscle (attachment)
 * - 60168 Vanessa Fisk (attachment)
 * - 60169 Black Cat (minion)
 * - 60170 Diamondback (minion)
 * - 60171 Spot (minion)
 * - 60172 Stilt-Man (minion)
 * - 60173 Kingpin's Influence (side_scheme)
 * - 60174 Organized Crime (side_scheme)
 * - 60175 Bag of Tricks (treachery)
 * - 60176 Unrelenting Hate (treachery)
 */
export const FNE_SCENARIOS_KINGPIN: AbilityRegistry = defineAbilities({
  "60159a.kingpin-constant": untouchable(),
  "60159a.kingpin-forced-interrupt": schemesInstead(),
  "60159b.kingpin-forced-interrupt": alone(false),
  "60160a.kingpin-constant": untouchable(),
  "60160a.kingpin-forced-interrupt": schemesInstead(),
  "60160b.kingpin-forced-interrupt": alone(true),

  "60161a.setup": setup(
    forEachPlayerInChosenOrder(
      eachPlayer,
      selectCards("nemesis", setAside(thatPlayer, NEMESIS_MINION_OF_THAT_PLAYER)),
      ifThen(
        exists(query("character", { sharesTitleWith: chosen("nemesis") })),
        [moveCards(cards(chosen("nemesis")), "removedFromGame"), ...findUnderling],
        revealCard(chosen("nemesis"), thatPlayer),
      ),
    ),
    shuffleEncounterDeck(),
  ),
  "60161b.when-revealed": whenRevealed(findCard(PUBLIC_SUPPORT, "play")),
  "60161b.the-kings-gambit-action": heroAction(
    // An encounter card's Hero Action: it ignores crisis icons (RRG 1.8 "Crisis Icon", p. 14; owner Q66 = B).
    ifThen(
      inMode("expert"),
      removeThreat(4, self, { ignoreCrisis: true }),
      removeThreat(5, self, { ignoreCrisis: true }),
    ),
    moveCards(encounterCards(["discard"]), "encounterDeckShuffle"),
    discardEncounterUntil(query("minion"), "found"),
    revealCard(chosen("found"), you),
  ),

  // All players find their nemesis minion first; then each player whose nemesis minion did not enter play (in play
  // already, removed from the game, not found, or turned away by the Unique rule) finds an Underling. A counter on the
  // identity carries "entered play this way" from the first pass to the second.
  "60162a.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      selectCards("nemesis", findNemesisMinion),
      revealCard(chosen("nemesis"), thatPlayer),
      ifThen(
        exists(NEMESIS_MINION_IN_PLAY),
        ifThen(varAtLeast("nemesis.count"), addCounters("nemesisEntered", 1, identityOf(thatPlayer))),
      ),
    ),
    forEachPlayerInChosenOrder(
      eachPlayer,
      ifThen(
        valueAtLeast(countersOn(identityOf(thatPlayer), "nemesisEntered"), 1),
        removeCountersFrom(identityOf(thatPlayer), "nemesisEntered", 1),
        findUnderling,
      ),
    ),
    shuffleEncounterDeck(),
    ifThen(inMode("expert"), [
      selectCards("crime", encounterCards(["deck", "discard"], ORGANIZED_CRIME)),
      revealCard(chosen("crime"), firstPlayer),
      shuffleEncounterDeck(),
    ]),
  ),
  "60162b.endgame-constant": constant(gainsKeyword({ name: "guard" }, query("minion"))),

  "60163a.public-support-forced-response": forcedResponse(after.defeated(query("minion")), addCounters("support", 1)),
  "60163a.public-support-forced-interrupt": forcedInterrupt(
    on.phaseBeginning("villain"),
    ifThen(valueAtLeast(countersOn(self, "support"), sum(perHero(2), 2)), [
      flipCard(theVillain),
      advanceMainScheme(),
      flipCard(self),
    ]),
  ),
  // Any player may use it (an encounter card's optional ability, RRG 1.8 "Ability", p. 4). No → (RRG 1.8 'Cost Arrow
  // Icon', p. 14): the removal is the replacement's effect, not a cost, so it may partially resolve ('Otherwise',
  // p. 31; 'Initiating Abilities', p. 24). With 0 counters the replacement cannot resolve and cannot trigger (ruling
  // Mar 19, 2026 R5, Redwing; June 27, 2023 #32, C.S.I.). Engine reading: no ruling covers a partly resolving
  // replacement. Owner Q207 open, built B.
  "60163b.public-support-interrupt": interrupt(
    on.boostCardWouldBeGiven({ to: query("enemy") }),
    { would: true, while: valueAtLeast(countersOn(self, "support"), 1) },
    instead(removeCountersFrom(self, "support", perHero(1))),
  ),
  "60163b.public-support-forced-response": forcedResponse(after.defeated(query("minion")), addCounters("support", 1)),

  // Revealed in alter-ego form there is no hero to attach to: the card is discarded without surge (RRG 1.8 "Attach
  // To", p. 8).
  "60164.bear-hug-constant": attachInstruction(
    ifThen(KINGPIN_IS_MARTIAL_ARTIST, ifThen(inForm("hero"), attachCard(self, yourIdentity)), surge()),
  ),
  "60164.bear-hug-constant-2": constant(rule({ kind: "cannotChangeForm", player: you, while: inForm("hero") })),
  "60164.bear-hug-forced-interrupt": forcedInterrupt(
    on.attacksOrThwarts("host"),
    { would: true },
    instead(removeCountersFrom(self, "grip", 1)),
  ),

  "60165.when-revealed": whenRevealed(giveBoostCard(theVillain)),
  "60165.james-wesley-action": heroAction(
    discardEvent(THWART),
    discard(self),
    enemyScheme(theVillain, { against: you }),
  ),
  "60165.boost": boost(attachCard(self, theVillain)),

  "60166.when-revealed": whenRevealed(stun(yourIdentity)),
  "60166.kingpins-cane-forced-response": forcedResponse(
    after.enemyAttacks("host", { damages: true }),
    ifThen(refMatches(eventTarget, query("hero")), [
      giveStatus(eventTarget, "stunned", { bind: "stunned" }),
      ifThen(varAtLeast("stunned.amount"), discard(self)),
    ]),
  ),
  "60166.boost": boost(ifThen(isStunned(yourIdentity), dealDamage(1, yourIdentity)), stun(yourIdentity)),

  "60167.mountain-of-muscle-constant": attachIfMartialArtist(theVillain),
  "60167.mountain-of-muscle-constant-2": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, query("villain", { hostOfSelf: true })),
  ),
  "60167.mountain-of-muscle-forced-interrupt": forcedInterrupt(
    when.damage(query("villain", { hostOfSelf: true })),
    instead(placeDamage(eventAmount, self)),
    andThen(ifThen(damagedAtLeast(self, 8), discard(self))),
  ),

  "60168.when-revealed": whenRevealed(confuse(yourIdentity)),
  "60168.vanessa-fisk-action": heroAction(
    discardEvent(ATTACK),
    discard(self),
    enemyAttack(theVillain, { against: you }),
  ),
  "60168.boost": boost(ifThen(isConfused(yourIdentity), placeThreat(1, theMainScheme)), confuse(yourIdentity)),

  // Owner Q205 = B (docs/phase7-wave11-scenarios.md section S4.1): exactly 4 threat, not "at least 4".
  "60169.black-cat-constant": constant(treatSelfAsAlly(valueEquals(threatOn(self), 4), 2)),
  "60169.black-cat-action": heroAction(
    { cost: spend({ mental: 1 }) },
    placeThreat(1, self),
    ifThen(valueEquals(threatOn(self), 4), takeControl(self)),
  ),

  "60170.diamondback-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    dealDamage(1, yourIdentity),
  ),
  "60170.boost": boost(dealDamage(1, yourIdentity)),

  "60171.spot-constant": forcedResponse(after.entersPlay("self"), addCounters("spot", 1)),
  "60171.spot-forced-interrupt": forcedInterrupt(
    on.damage("self", { fromAttack: true }),
    { wouldBeDealt: true },
    ifThen(
      valueAtLeast(countersOn(self, "spot"), 1),
      instead(removeCountersFrom(self, "spot", 1), dealDamage(eventAmount, ATTACKER)),
      addCounters("spot", 1),
    ),
  ),

  "60172.stilt-man-constant": forcedResponse(after.entersPlay("self"), addCounters("stilt", 2)),
  "60172.stilt-man-constant-2": constant(
    gets("sch", countersOn(self, "stilt"), { self: true }),
    gets("atk", countersOn(self, "stilt"), { self: true }),
  ),
  // "remove 1 stilt counter from him instead" can only be done with a counter to remove: with none left the damage is
  // taken (a Stilt-Man who could never be hurt is not the card). A Forced ability resolves as far as it can (RRG 1.8
  // "Forced" p. 20; "Target" p. 42). Reading flagged for the rules expert.
  "60172.stilt-man-forced-interrupt": forcedInterrupt(
    when.damage("self"),
    ifThen(valueAtLeast(countersOn(self, "stilt"), 1), instead(removeCountersFrom(self, "stilt", 1))),
  ),

  "60173.when-defeated": whenDefeated(
    forEachPlayer(
      defeatingPlayer,
      placeThreat(3, each(NEMESIS_SIDE_SCHEME_OF_THAT_PLAYER)),
      ifThen(not(exists(NEMESIS_SIDE_SCHEME_OF_THAT_PLAYER)), [
        selectCards(
          "scheme",
          anyOfCards(
            encounterCards(["deck", "discard"], NEMESIS_SIDE_SCHEME_OF_THAT_PLAYER),
            setAside(thatPlayer, NEMESIS_SIDE_SCHEME_OF_THAT_PLAYER),
          ),
        ),
        revealCard(chosen("scheme"), thatPlayer),
        shuffleEncounterDeck(),
      ]),
    ),
  ),

  "60174.organized-crime-constant": constant(gets("hp", 2, query("minion"))),

  // "Your set-aside nemesis set" names the set, not the whole set-aside area (`nemesisSetOf`). An empty set reveals
  // nothing, and the card gains surge.
  "60175.when-revealed": whenRevealed(
    selectCards("trick", setAside(you, YOUR_NEMESIS_SET, { random: 1 })),
    revealCard(chosen("trick"), you),
    ifThen(not(varAtLeast("trick.count")), surge()),
  ),
  // "As an additional boost card": given while this activation's boost cards are being turned faceup, it joins them
  // and is turned faceup in its turn. "Your" is the player the activation is against.
  "60175.boost": boost(
    selectCards("trick", setAside(you, YOUR_NEMESIS_SET, { random: 1 })),
    giveBoostCard(activatingEnemy, { card: chosen("trick") }),
  ),

  "60176.when-revealed": whenRevealed(
    enemyActivates(each(query("minion", { nemesisMinionOf: you })), { against: you }),
    ifThen(not(exists(query("minion", { nemesisMinionOf: you }))), [
      selectCards(
        "nemesis",
        anyOfCards(
          encounterCards(["deck", "discard"], query("minion", { nemesisMinionOf: you })),
          setAside(you, query("minion", { nemesisMinionOf: you })),
        ),
      ),
      revealCard(chosen("nemesis"), you),
      ifThen(not(varAtLeast("nemesis.count")), [
        chooseCards("underling", encounterCards(["deck", "discard"], UNDERLING_MINION), { min: 1, max: 1 }),
        revealCard(chosen("underling"), you),
      ]),
      shuffleEncounterDeck(),
    ]),
  ),
  "60176.boost": boost(ifThen(activationIs("attack"), modifyAttack({ overkill: true }))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_SCENARIOS_KINGPIN_SKIPPED: Readonly<Record<string, string>> = {};
