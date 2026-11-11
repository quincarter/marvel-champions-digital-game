/**
 * Gwenpool (by Patatasaurio, G.Triskelion template): every ability of the pack, each modeled on the base-game card
 * named in its comment. The pack's own printed text is the authority (docs/custom-content-packs.md section 6), then the
 * RRG (v1.8) and FFG rulings for what the text does not override. English is the text language; Spanish is the author's
 * canonical version, so a reading that differs between the two is flagged in the README.
 *
 * **Speech bubbles.** Her kit rests on text written in speech bubbles that other cards "resolve". Each bubble is a
 * tagged ability with no trigger (`tagged`, engine commit ead4f84e3): it resolves only when an effect names its tag
 * (`resolveOneTagged`, `resolveTagged`), and it counts for `taggedAbilitiesOn` / `hasTaggedAbility` while its card is
 * in play (in hand: its printed ones). A flavor bubble is `tagged(tag)` with nothing to resolve; it still counts. The
 * pack's `extensions.json` (the importer's `x_bubbles`) lists every bubble and whether its text is an instruction
 * (`rules: true`). Pink bubbles are on her player cards (tag "pinkBubble"); purple ones on her nemesis cards (tag
 * "purpleBubble"). The author's own rules for them (ENGINE_NOTES, Gwenpool) are quoted where used.
 *
 * Primitives new for this pack (engine commits ead4f84e3 and later, `packages/cards/src/dsl/engine-only-features.ts`):
 * `tagged`, `resolveOneTagged`, `resolveTagged`, `taggedAbilitiesOn`, `hasTaggedAbility`,
 * `replaceNextVillainPhaseWithPlayerPhase`, `loseKeywordUntil`, `loseTraitUntil`.
 *
 * Left unscripted or partial (see the pack README "Open items"): Handbook's status-card option, Handbook's trait list
 * (curated, not "any trait"), That Shouldn't Be There's damage tokens and typed counters, and the Handbook bubble's
 * resource.
 */
import {
  action,
  addAccelerationToken,
  alterEgoAction,
  anAttackableEnemy,
  anEnemy,
  after,
  attack,
  blanksTextBox,
  cannotLeavePlay,
  cancelIt,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  costModifier,
  dealDamage,
  definePackAbilities,
  discard,
  discardAtRandom,
  discardFromHand,
  discardFromHandCost,
  draw,
  encounterCards,
  exhaustThis,
  exists,
  forcedInterrupt,
  forcedResponse,
  gets,
  giveStatus,
  hasTaggedAbility,
  heroAction,
  heroInterrupt,
  identityOf,
  ifThen,
  inPlay,
  instead,
  interrupt,
  loseKeywordUntil,
  loseTraitUntil,
  modifyStat,
  moveCards,
  moveCounters,
  moveThreat,
  not,
  on,
  oncePerRound,
  option,
  placeThreat,
  playersWhere,
  preventDamage,
  putIntoPlay,
  query,
  refMatches,
  removeAnAccelerationToken,
  removeStatus,
  removeThreat,
  removeThreatFromAScheme,
  replaceNextVillainPhaseWithPlayerPhase,
  resolveOneTagged,
  resolveTagged,
  selectCards,
  self,
  setRemainingHitPoints,
  shuffleEncounterDeck,
  stun,
  sum,
  tagged,
  taggedAbilitiesOn,
  thatPlayer,
  revealEncounterCard,
  varAtLeast,
  varOf,
  when,
  whenRevealed,
  you,
  yourIdentity,
  YOUR_HERO,
  YOUR_IDENTITY,
  zone,
} from "@mc/mod-sdk";

// The content package's `trait()` is not part of the SDK; a trait is its upper-cased name.
type KeywordInstance = Parameters<typeof loseKeywordUntil>[0];
type Trait = NonNullable<Parameters<typeof loseTraitUntil>[0]>;
const trait = (name: string): Trait => name.toUpperCase() as Trait;

const PINK = "pinkBubble";
const PURPLE = "purpleBubble";
const EVIL_GWENPOOL = "Evil Gwenpool";

/** "The PINK BUBBLES you control": every pink bubble on the cards you control in play, flavor ones included. */
const YOUR_PINK_BUBBLES = taggedAbilitiesOn(PINK, { controller: "you" });

/**
 * "The Gwenpool player": the player whose identity is Gwenpool in either form (the hero face is "Gwenpool", the
 * alter-ego face "Gwendolyn Poole"), as Luke Cage's "the Luke Cage player" (`62029.boost`). The nemesis treacheries put
 * Evil Gwenpool engaged with her even in alter-ego form (the 2026-11-03 rules fix).
 */
const GWENPOOL_PLAYER = playersWhere(
  refMatches(
    identityOf(thatPlayer),
    query("identity", {
      anyOf: [query("identity", { name: "Gwenpool" }), query("identity", { name: "Gwendolyn Poole" })],
    }),
  ),
);

/**
 * "If Evil Gwenpool is not in play, search the encounter deck and discard pile for Evil Gwenpool and put it into play
 * engaged with the Gwenpool player. Shuffle the encounter deck." As Legions of Hydra's Madame Hydra
 * (`core/modular/hydra-and-doomsday.ts` `fetchIntoPlay`): the shuffle is the Search rule's own (RRG 1.8 "Search", p.
 * 39), so it happens whether or not the search found her. `evil.count` is only bound when the search ran.
 */
const FETCH_EVIL_GWENPOOL = ifThen(not(inPlay(EVIL_GWENPOOL)), [
  selectCards("evil", encounterCards(["deck", "discard"], { name: EVIL_GWENPOOL })),
  putIntoPlay(chosen("evil"), GWENPOOL_PLAYER),
  shuffleEncounterDeck(),
]);

// ---------------------------------------------------------------------------
// That Shouldn't Be There: the movable things
// ---------------------------------------------------------------------------

const STATUSES = ["stunned", "confused", "tough"] as const;

/**
 * "Move 1 token, counter or status card wherever you like. (This involves removing and putting.)" One option per thing
 * that can be moved; an option is only offered when something could be taken from somewhere (and, for a status, put
 * somewhere). "Take one from the pool or return one to it" (ENGINE_NOTES) is the "from the pool" / "to the pool"
 * options. NOT SCRIPTED: damage tokens (moving one takes a heal-free removal the DSL has no builder for) and typed
 * counters other than all-purpose ones (placing one from the pool needs the counter's name).
 */
const MOVE_THINGS = chooseOne(
  option(
    "Move 1 threat from a scheme to another scheme",
    { when: exists(query("scheme", { hasThreat: true })) },
    chooseTarget("from", query("scheme", { hasThreat: true })),
    chooseTarget("to", query("scheme")),
    moveThreat(chosen("from"), chosen("to"), { amount: 1 }),
  ),
  option(
    "Return 1 threat from a scheme to the pool",
    { when: exists(query("scheme", { hasThreat: true })) },
    chooseTarget("from", query("scheme", { hasThreat: true })),
    removeThreat(1, chosen("from")),
  ),
  option(
    "Take 1 threat from the pool and put it on a scheme",
    chooseTarget("to", query("scheme")),
    placeThreat(1, chosen("to")),
  ),
  option(
    "Move 1 all-purpose counter from a card to another",
    { when: exists({ hasCounter: "any" }) },
    chooseTarget("from", { hasCounter: "any" }),
    chooseTarget("to", query(["support", "upgrade", "ally"])),
    moveCounters(chosen("from"), chosen("to"), "any", 1),
  ),
  option(
    "Move 1 acceleration token to a main scheme",
    { when: exists({ hasAccelerationToken: true }) },
    removeAnAccelerationToken(),
    chooseTarget("to", query("mainScheme")),
    addAccelerationToken(chosen("to")),
  ),
  option(
    "Return 1 acceleration token to the pool",
    { when: exists({ hasAccelerationToken: true }) },
    removeAnAccelerationToken(),
  ),
  option("Take 1 acceleration token from the pool and put it on the main scheme", addAccelerationToken()),
  ...STATUSES.flatMap((status) => [
    option(
      `Move 1 ${status} status card to another character`,
      { when: exists(query("character", { hasStatus: status })) },
      chooseTarget("from", query("character", { hasStatus: status })),
      chooseTarget("to", query("character", { canTakeStatus: status })),
      removeStatus(chosen("from"), status, { count: 1 }),
      giveStatus(chosen("to"), status),
    ),
    option(
      `Return 1 ${status} status card to the pool`,
      { when: exists(query("character", { hasStatus: status })) },
      chooseTarget("from", query("character", { hasStatus: status })),
      removeStatus(chosen("from"), status, { count: 1 }),
    ),
    option(
      `Take 1 ${status} status card from the pool and give it to a character`,
      { when: exists(query("character", { canTakeStatus: status })) },
      chooseTarget("to", query("character", { canTakeStatus: status })),
      giveStatus(chosen("to"), status),
    ),
  ]),
);

// ---------------------------------------------------------------------------
// Marvel Champions Handbook: the keywords and traits that can be ignored
// ---------------------------------------------------------------------------

/**
 * The keywords a card in play can have that mean something while it is there. "Ignore one keyword ... on one card":
 * the card loses that keyword until the end of the round (`loseKeywordUntil`, RRG 1.8 "'Loses'", p. 27). Only
 * options with a card in play to apply to are offered.
 */
const IGNORABLE_KEYWORDS = [
  "guard",
  "retaliate",
  "toughness",
  "patrol",
  "stalwart",
  "quickstrike",
  "overkill",
  "piercing",
  "ranged",
  "villainous",
  "steady",
  "assault",
  "amplify",
  "hinder",
  "permanent",
  "restricted",
  "peril",
  "incite",
  "vulnerable",
  "victory",
] as const;

/**
 * Traits a rules effect commonly reads on a card in play. A trait cannot be chosen from the card (the DSL's
 * `loseTraitUntil` names its trait), so this list is the traits the Handbook can ignore. PARTIAL, flagged in the README:
 * a data-driven "a trait on that card" needs a `loseTraitUntil` that takes a chosen trait.
 */
const IGNORABLE_TRAITS = [
  "Elite",
  "Aerial",
  "Tech",
  "Weapon",
  "Armor",
  "Hydra",
  "Drone",
  "Criminal",
  "Mutant",
  "Avenger",
  "Guardian",
  "Civilian",
  "Hero",
  "Villain",
  "Asgard",
  "Brute",
  "Item",
  "Location",
  "Place",
  "Superpower",
  "Skill",
  "Attack",
  "Defense",
  "Thwart",
  "Tactic",
  "Persona",
  "Condition",
  "Masters of Evil",
  "Black Panther",
  "Wakanda",
  "S.H.I.E.L.D.",
  "Scheme",
  "Tough",
].map(trait);

const HANDBOOK = chooseOne(
  ...IGNORABLE_KEYWORDS.map((keyword) =>
    option(
      `Ignore ${keyword} on a card`,
      { when: exists({ withKeyword: keyword }) },
      chooseTarget("card", { withKeyword: keyword }),
      loseKeywordUntil({ name: keyword } as KeywordInstance, chosen("card"), "endOfRound"),
    ),
  ),
  ...IGNORABLE_TRAITS.map((t) =>
    option(
      `Ignore the ${String(t)} trait on a card`,
      { when: exists({ trait: t }) },
      chooseTarget("card", { trait: t }),
      loseTraitUntil(t, chosen("card"), "endOfRound"),
    ),
  ),
);

export default definePackAbilities({
  // =========================================================================
  // 01 Gwenpool / Gwendolyn Poole (identity)
  // =========================================================================

  // Reading the comic: "Action: Resolve whatever is written in a PINK BUBBLE in play. (Limit once per round.)" A plain
  // Action printed on the hero face. `resolveOneTagged`: one pink bubble in play, her pick (a flavor one included, which
  // resolves into nothing), from any card in play, whoever controls it (the author: "in play").
  "x.gwenpool-ptt.01a.reading-the-comic": action({ limit: oncePerRound }, resolveOneTagged(PINK)),
  // The hero face prints two pink bubbles (ids -bubble and -bubble-2). READING flagged for the author: both count as
  // pink bubbles she controls (ENGINE_NOTES says "up to 6 in play", one per card, which a literal count of this card's
  // two bubbles makes 7). "Hey, psst, here. Draw 1 card now while they're not looking." is an instruction.
  "x.gwenpool-ptt.01a.pink-bubble": tagged(PINK, draw(1)),
  // "What? Am I in a card game now? And it's fan-made on top of that!": flavor.
  "x.gwenpool-ptt.01a.pink-bubble-2": tagged(PINK),

  // That's not fair!: "Action: Discard X cards from your hand -> draw X cards. (Limit once per round.)" Shield Toss
  // (03006): a variable discard cost, X bound as `x`; X = 0 is allowed (Shield Toss's own open question).
  "x.gwenpool-ptt.01b.thats-not-fair": action(
    { limit: oncePerRound, cost: discardFromHandCost(0, undefined, "x") },
    draw(varOf("x")),
  ),
  // "Look, look! It's me!": flavor, on the alter-ego face.
  "x.gwenpool-ptt.01b.pink-bubble": tagged(PINK),

  // =========================================================================
  // 02 Batroc (ally)
  // =========================================================================

  // "Interrupt: When Batroc is defeated, stun an enemy." Not a replacement: he is defeated; the stun resolves first
  // (an Interrupt to his defeat, as Clea's shape without `instead`).
  "x.gwenpool-ptt.02.batroc-interrupt": interrupt(when.defeated("self"), anEnemy("enemy"), stun(chosen("enemy"))),
  // "For the sake of it, remove 2 threat from a scheme." Not a thwart.
  "x.gwenpool-ptt.02.pink-bubble": tagged(PINK, removeThreatFromAScheme(2)),

  // =========================================================================
  // 03 Precise Cut (event)
  // =========================================================================

  // "Hero Action (attack): Deal 2 damage to an enemy. Deal X additional damage, where X equals to the PINK BUBBLES you
  // control. This attack gains overkill." One attack of 2 + X damage (`attack(..., { keywords })`, as Night Thrasher's
  // Melon Grab). The event is being played, not in play, so its own bubble does not count; the ones on your cards in
  // play do (live: a blanked text box counts none).
  "x.gwenpool-ptt.03.precise-cut-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(sum(2, YOUR_PINK_BUBBLES), chosen("enemy"), { keywords: ["overkill"] }),
  ),
  // "Critical, 999 damage! Haha!": flavor (it still counts for Too Much Pink while in hand).
  "x.gwenpool-ptt.03.pink-bubble": tagged(PINK),

  // =========================================================================
  // 04 Plot Armor (event)
  // =========================================================================

  // "Hero Interrupt (defense): When you would take any amount of damage, prevent X of that damage, where X equals to
  // the PINK BUBBLES you control." Wiggle Room (05005): the same trigger and label, with a counted amount.
  "x.gwenpool-ptt.04.plot-armor-interrupt": heroInterrupt(
    when.damage(YOUR_IDENTITY),
    { label: "defense" },
    preventDamage(YOUR_PINK_BUBBLES),
  ),
  // "I am fighting versus Rhino? Because this seems like a tutorial.": flavor.
  "x.gwenpool-ptt.04.pink-bubble": tagged(PINK),

  // =========================================================================
  // 05 Secrets From The Comics (event)
  // =========================================================================

  // "Hero Action: choose an enemy -> mention one of his secrets and confuse that enemy. (You can't mention the same
  // secret again.) That enemy gains -2 ATK until the end of the round." "Mention a secret" is table flavor and is
  // skipped (ENGINE_NOTES). Confuse (Mind Games' shape) and a lasting stat modifier (`modifyStat`).
  "x.gwenpool-ptt.05.secrets-from-the-comics-action": heroAction(
    anEnemy("enemy"),
    confuse(chosen("enemy")),
    modifyStat("atk", -2, chosen("enemy"), "endOfRound"),
  ),
  // "Oops, spoiler!": flavor.
  "x.gwenpool-ptt.05.pink-bubble": tagged(PINK),

  // =========================================================================
  // 06 That Shouldn't Be There (event)
  // =========================================================================

  // "Hero Action: move 1 token, counter or status card wherever you like. (This involves removing and putting.)" See
  // `MOVE_THINGS`. The author means it broadly (acceleration tokens too, which the rules normally forbid moving).
  // PARTIAL: damage tokens and typed counters are not scripted (README "Open items").
  "x.gwenpool-ptt.06.that-shouldnt-be-there-action": heroAction(MOVE_THINGS),
  // "If they ask, it's not cheating, it's strategy.": flavor.
  "x.gwenpool-ptt.06.pink-bubble": tagged(PINK),

  // =========================================================================
  // 07 Out Of The Game (upgrade)
  // =========================================================================

  // "Forced Interrupt: When the villain phase is about to begin, instead remove this card from the game -> start again
  // player phase." The extra player phase takes the villain phase's place within the same round (no new round, no
  // threat placed, round limits and "until the end of the round" effects carry on, the first player token stays;
  // `replaceNextVillainPhaseWithPlayerPhase`, engine commit ead4f84e3). The beginning is cancelled so the villain phase
  // does not run. Forced: it fires on the first villain phase after it enters play.
  "x.gwenpool-ptt.07.out-of-the-game-forced-interrupt": forcedInterrupt(
    on.phaseBeginning("villain"),
    cancelIt(),
    moveCards(cards(self), "removedFromGame"),
    replaceNextVillainPhaseWithPlayerPhase(),
  ),
  // "Okay, let's do this one last time, yeah? My name is Gwendolyne Poole...": flavor.
  "x.gwenpool-ptt.07.pink-bubble": tagged(PINK),

  // =========================================================================
  // 08 Marvel Champions Handbook (upgrade)
  // =========================================================================

  // "Action: Exhaust Marvel Champions Handbook -> ignore one keyword, trait, or status card of your choice until the
  // end of the round." Keyword and trait: one card loses it until the end of the round (`loseKeywordUntil`,
  // `loseTraitUntil`); one option per keyword, and per trait of a curated list (`HANDBOOK`). NOT SCRIPTED: ignoring a
  // status card (a lasting "ignore status" the DSL has no builder for); README "Open items".
  "x.gwenpool-ptt.08.marvel-champions-handbook-action": action({ cost: exhaustThis }, HANDBOOK),
  // "Oops, I drop a [wild] resource! Well, let's not waste it." The author's reading (ENGINE_NOTES): a free [wild]
  // resource for a card being paid for now, and one generated with nothing to pay for is lost. A bubble resolves from
  // an Action or an Interrupt, never in the middle of a payment, so it resolves into nothing; it counts as a bubble.
  // NOT SCRIPTED as a resource: a tagged ability cannot generate a resource for a payment in progress.
  "x.gwenpool-ptt.08.pink-bubble": tagged(PINK),

  // =========================================================================
  // 09 That's Not How The Game Ends (upgrade)
  // =========================================================================

  // "Interrupt: When Gwenpool would be defeated by an enemy attack, set her hit point dial to 1 instead and remove this
  // card from the game -> resolve all the PINK BUBBLES in play." A replacement (RRG 1.8 "'Would'", p. 48): Captain
  // America's Helmet (03008) for the dial, Wonder Man's What Are You (58011) for the removal, hero form only (she is
  // named). "By an enemy attack": `byAttackFrom` an enemy (Regroup, 19032). The card removes itself first and then
  // resolves every pink bubble in play, "its own included" (the author: its own bubble is no longer in play when they
  // resolve, but he intends it to resolve too: `of: self`, ENGINE_NOTES). The player picks the order.
  "x.gwenpool-ptt.09.thats-not-how-the-game-ends-interrupt": interrupt(
    when.defeated(YOUR_HERO, { byAttackFrom: query("enemy") }),
    { would: true },
    instead(
      setRemainingHitPoints(1, yourIdentity),
      moveCards(cards(self), "removedFromGame"),
      resolveTagged(PINK, { of: self }),
    ),
  ),
  // "Lift the top card of the villain deck, I want to see if my katanas are there." Read as: reveal the top card of the
  // encounter deck (ENGINE_NOTES): it resolves like any reveal (a treachery fires, a minion enters play), a risk and
  // not a bonus.
  "x.gwenpool-ptt.09.pink-bubble": tagged(PINK, revealEncounterCard(you)),

  // =========================================================================
  // 10 Comic Shop (support)
  // =========================================================================

  // "Alter-Ego Action: exhaust Comic Shop -> place 1 card from your discard pile on the top of your deck."
  "x.gwenpool-ptt.10.comic-shop-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("card", zone("discard", you), { min: 1, max: 1 }),
    moveCards(cards(chosen("card")), "deckTop"),
  ),
  // "Look out I drop my katanas! Sorry to deal you 2 damage hehe." The author means an enemy, not you (ENGINE_NOTES):
  // deal 2 damage to an enemy (damage, not an attack).
  "x.gwenpool-ptt.10.pink-bubble": tagged(PINK, anEnemy("enemy"), dealDamage(2, chosen("enemy"))),

  // =========================================================================
  // 11 Too Much Pink (obligation)
  // =========================================================================

  // "Increase the resource cost of each upgrade, support and ally with PINK BUBBLES you play by 2." Growing Pains
  // (39062) for the shape; `hasTaggedAbility` reads the printed bubbles of a card in hand. "You" on an obligation is the
  // player it was given to.
  "x.gwenpool-ptt.11.too-much-pink-constant": constant(
    costModifier({
      delta: 2,
      appliesTo: query(["upgrade", "support", "ally"], { controller: "you", ...hasTaggedAbility(PINK) }),
    }),
  ),
  // "Alter-Ego Action: Discard 2 cards with PINK BUBBLES -> discard this obligation." Friends and Family (27132): a
  // hand discard cost with a filter. Events count (every Gwenpool card has a bubble), the alter-ego is not a card.
  "x.gwenpool-ptt.11.too-much-pink-action": alterEgoAction(
    { cost: discardFromHandCost(2, 2, undefined, hasTaggedAbility(PINK)) },
    discard(self),
  ),

  // =========================================================================
  // 12 Game Rules (side scheme, nemesis)
  // =========================================================================

  // "This card cannot leave play while Evil Gwenpool is in play." Absolute (RRG 1.8 "'Cannot'", p. 11; as Wrecker's
  // side scheme: `cannotLeavePlay`).
  "x.gwenpool-ptt.12.game-rules-constant": constant(cannotLeavePlay({ self: true }, { while: inPlay(EVIL_GWENPOOL) })),
  // "Treat Gwenpool's printed text box as if it were blank (except for TRAITS)." Pestilence (45083) / Tech Theft
  // (12026): `blanksTextBox`. The target names the face showing, "Gwenpool", so only her hero side is blank; the
  // alter-ego (Gwendolyn Poole) keeps its text (the author's reading, ENGINE_NOTES). Her stats and traits stay.
  "x.gwenpool-ptt.12.game-rules-constant-2": constant(blanksTextBox(query("identity", { name: "Gwenpool" }))),
  // "Discard 1 card at random from your hand." Purple bubble: "you" is the player resolving it (the one Evil Gwenpool
  // attacked).
  "x.gwenpool-ptt.12.purple-bubble": tagged(PURPLE, discardAtRandom(1, you)),

  // =========================================================================
  // 13 Evil Gwenpool (minion, nemesis)
  // =========================================================================

  // "Evil Gwenpool gets +X hit points, where X is equal to the number of PURPLE BUBBLES in play." Live count, her own
  // bubble included (3 to 5 in practice: her own, Game Rules', and the two treacheries' are not in play).
  "x.gwenpool-ptt.13.evil-gwenpool-constant": constant(gets("hp", taggedAbilitiesOn(PURPLE), { self: true })),
  // "[star] Forced Response: After Evil Gwenpool attacks you, resolve whatever is written in all the PURPLE BUBBLES in
  // play." The attack must be against you (the 2026-11-03 rules fix added the missing trigger). Every purple bubble in
  // play resolves, in the order the player chooses.
  "x.gwenpool-ptt.13.evil-gwenpool-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    resolveTagged(PURPLE),
  ),
  // "Deal 2 damage to Gwen." The attacked player takes 2 damage (ENGINE_NOTES).
  "x.gwenpool-ptt.13.purple-bubble": tagged(PURPLE, dealDamage(2, yourIdentity)),

  // =========================================================================
  // 14 "I Found You" / 15 "Hello Again" (treacheries, nemesis)
  // =========================================================================

  // "When Revealed: If Evil Gwenpool is not in play, search the encounter deck and discard pile for Evil Gwenpool and put
  // it into play engaged with the Gwenpool player. Shuffle the encounter deck." If she is already in play it does
  // nothing (the author: intended).
  "x.gwenpool-ptt.14.when-revealed": whenRevealed(FETCH_EVIL_GWENPOOL),
  // "You can't hide Gwen.": flavor (a treachery is never in play).
  "x.gwenpool-ptt.14.purple-bubble": tagged(PURPLE),

  // "Surge. When Revealed: ... If no cards were put it into play this way, discard 1 upgrade card at random." Surge is
  // data. READING flagged for the author: "discard 1 upgrade card at random" is read as a random upgrade from the
  // revealing player's hand (the DSL has no random pick from the cards in play). `evil.count` is only bound when the
  // search ran, so it is unbound (0) when she was already in play.
  "x.gwenpool-ptt.15.when-revealed": whenRevealed(
    FETCH_EVIL_GWENPOOL,
    ifThen(not(varAtLeast("evil.count")), discardFromHand(1, you, { random: true, filter: query("upgrade") })),
  ),
  // "Sometimes I get confused with Ronan.": flavor.
  "x.gwenpool-ptt.15.purple-bubble": tagged(PURPLE),
});
