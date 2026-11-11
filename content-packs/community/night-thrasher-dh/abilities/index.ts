/**
 * Night Thrasher (by DesignHacker, Hitch template): every ability of the pack, each modeled on the base-game card named
 * in its comment. The pack's own printed text is the authority (docs/custom-content-packs.md section 6), then the RRG
 * (v1.8) and FFG rulings for what the text does not override.
 *
 * Ability ids are `<card code>.<slug>`, as the importer wrote them. The Battle Board (`02a` / `02b`) is one
 * double-sided Permanent upgrade, "Setup" on its front: it is attached to its owner's identity at setup (RRG 1.8
 * Appendix II step 11; `putSetupCardsIntoPlay`) and flipped by `flipCard`. Its two faces carry their own traits (the
 * Vehicle front, the Weapon back), which every "if the Battle Board upgrade has the ... trait" below reads.
 *
 * Primitives new for this pack (engine commit b51277136, `packages/cards/src/dsl/engine-only-features.ts`): `agile`
 * (Battle Board front), `lastPlayedThisRound` (Kickflip), `blankTextBoxForPlayers` (Cemented).
 *
 * Nothing is left unscripted. See the pack README for the readings flagged for the author.
 */
import {
  action,
  agile,
  alterEgoResponse,
  anAttackableEnemy,
  anEnemy,
  ANY_NUMBER,
  addCounters,
  cannotFlip,
  forcedInterrupt,
  removeEachCounterFrom,
  attack,
  attackAnEnemy,
  attacksGainKeywords,
  blankTextBoxForPlayers,
  boost,
  cannotAttach,
  cannotMakeBasicAttacks,
  cards,
  changeForm,
  chooseCards,
  chooseOne,
  chooseOneBy,
  chosen,
  confuse,
  constant,
  costModifier,
  countOf,
  damageAnEnemy,
  dealIndirectDamage,
  definePackAbilities,
  discardEncounterCards,
  discardFromHand,
  divide,
  draw,
  each,
  eachPlayer,
  exhaust,
  exhaustThis,
  exists,
  flipCard,
  forEachPlayer,
  forcedResponse,
  gainsKeyword,
  gets,
  handCountOf,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifThen,
  inPlay,
  isHero,
  lastPlayedThisRound,
  moveCards,
  not,
  on,
  oncePerPhase,
  oncePerRound,
  option,
  preventDamage,
  query,
  reduceNextCardCost,
  removeThreatFromAScheme,
  resource,
  response,
  revealCard,
  rule,
  selectCards,
  setVar,
  refCount,
  varOf,
  self,
  stun,
  surge,
  thatPlayer,
  thwartAScheme,
  valueAtLeast,
  whenRevealed,
  when,
  after,
  attachCard,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
  gainTraitUntil,
  varAtLeast,
} from "@mc/mod-sdk";

// The content package's `trait()` is not part of the SDK; a trait is its upper-cased name.
type Trait = NonNullable<Parameters<typeof gainTraitUntil>[0]>;
const trait = (name: string): Trait => name.toUpperCase() as Trait;
const SKILL = trait("Skill");
const VEHICLE = trait("Vehicle");
const WEAPON = trait("Weapon");

/** A player card of any type a "Skill" card can be (events, upgrades, supports, allies, resources). */
const SKILL_CARD = query(["event", "upgrade", "support", "ally", "resource"], { trait: SKILL });

/** The Battle Board upgrade the acting player controls (either face: both are titled Battle Board). */
const BATTLE_BOARD = query("upgrade", { name: "Battle Board", controller: "you" });
/** "Flip the Battle Board upgrade". */
const FLIP_BOARD = flipCard(each(BATTLE_BOARD));
/** "If the Battle Board upgrade has the [Vehicle / Weapon] trait": the face showing now. */
const BOARD_IS_VEHICLE = exists({ ...BATTLE_BOARD, trait: VEHICLE });
const BOARD_IS_WEAPON = exists({ ...BATTLE_BOARD, trait: WEAPON });

const TERRAX = query("minion", { name: "Terrax the Tamer" });

export default definePackAbilities({
  // =========================================================================
  // 01 Night Thrasher / Dwayne Taylor (identity)
  // =========================================================================

  // Varial Heelflip: "Response: After you play a Skill card, flip the Battle Board upgrade. (Limit once per phase.)"
  // A plain (optional) Response on the hero face, as Death-Dealer; limited once per phase (`oncePerPhase`).
  "x.night-thrasher-dh.01a.varial-heelflip": response(
    on.youPlayedCard(SKILL_CARD),
    { limit: oncePerPhase },
    FLIP_BOARD,
  ),

  // Tech Deck: "During deck-building you may include up to 4 Skill cards in your deck from aspects other than your
  // own." Data: `deckbuilding.offAspectAllowance` (Gamora 18001b, "Skilled Tactician"). PARTIAL: the schema's
  // allowance names one card type, so only Skill upgrades are allowed (see the pack README).
  "x.night-thrasher-dh.01b.dwayne-taylor-constant": constant(),

  // Manual: "Action: Shuffle X Skill cards from your hand into your deck -> draw X cards. (Limit once per round.)"
  // Modeled on Shield Toss (Captain America 03006), whose "X cards" is a variable count (X = 0 allowed, its open
  // question) and on `moveCards(..., "deckShuffle")` (Breakthrough, Jessica Jones 61005). There is no hand-to-deck cost
  // in the DSL, so the shuffle is the first effect rather than a cost, and X is counted before the cards move (a count
  // of the chosen cards, `refCount`, read once). The draw is the same X. A reading flagged for the author.
  "x.night-thrasher-dh.01b.manual": action(
    { limit: oncePerRound },
    chooseCards("shuffled", zone("hand", you, { filter: SKILL_CARD }), { min: 0, max: ANY_NUMBER }),
    setVar("x", refCount(chosen("shuffled"))),
    moveCards(cards(chosen("shuffled")), "deckShuffle"),
    draw(varOf("x")),
  ),

  // =========================================================================
  // 02 Battle Board (upgrade, double-sided, Permanent; Setup on the front)
  // =========================================================================

  // Front (Vehicle): "Night Thrasher gets +1 THW and gains agile 1." Agile is DesignHacker's own keyword
  // (`agile`, engine commit b51277136): damage taken from an undefended villain or villainous attack is reduced by 1.
  // Night Thrasher is the hero form: the stat bonus is read in hero form, as Dense (Vision 26002b).
  "x.night-thrasher-dh.02a.battle-board-constant": constant(
    gets("thw", 1, YOUR_IDENTITY, { while: isHero() }),
    agile(1, { categories: ["hero"], controller: "you" }),
  ),
  // "Response: After you flip to this side, remove 1 threat from a scheme." Not a Hero Response (printed plain).
  // A flip is announced as `cardFlipped` (RRG 1.8 "Flip", p. 20), heard by the face that is up afterwards, as
  // `on.characterFlips` ("self" is the card; the pattern also covers an identity's change of form).
  "x.night-thrasher-dh.02a.battle-board-response": response(on.characterFlips("self"), removeThreatFromAScheme(1)),
  // Back (Weapon): "Night Thrasher gets +1 ATK and +1 DEF."
  "x.night-thrasher-dh.02b.battle-board-constant": constant(
    gets("atk", 1, YOUR_IDENTITY, { while: isHero() }),
    gets("def", 1, YOUR_IDENTITY, { while: isHero() }),
  ),
  // "Hero Response: After you flip to this side, deal 1 damage to an enemy." Damage, not an attack.
  "x.night-thrasher-dh.02b.battle-board-response": heroResponse(on.characterFlips("self"), damageAnEnemy(1)),

  // Practice's "cannot flip the Battle Board until the start of the next villain phase": see Practice (12). Each face
  // carries the lock and the clear, so the lock holds whichever side is up. A forced interrupt, so it resolves before
  // an optional one that begins the same phase (Prewind Stance): "until the start" has already passed by then.
  "x.night-thrasher-dh.02a.practice-lock": constant(
    cannotFlip(query("upgrade", { name: "Battle Board", hasCounter: "practice" })),
  ),
  "x.night-thrasher-dh.02a.practice-clear": forcedInterrupt(
    on.phaseBeginning("villain"),
    removeEachCounterFrom(self, "practice"),
  ),
  "x.night-thrasher-dh.02b.practice-lock": constant(
    cannotFlip(query("upgrade", { name: "Battle Board", hasCounter: "practice" })),
  ),
  "x.night-thrasher-dh.02b.practice-clear": forcedInterrupt(
    on.phaseBeginning("villain"),
    removeEachCounterFrom(self, "practice"),
  ),

  // =========================================================================
  // 03 Disaster (event)
  // =========================================================================

  // Hero Action (attack/thwart): flip the Battle Board. Then, if it has Vehicle, remove 3 threat from a scheme (a
  // thwart); if Weapon, deal 4 damage to an enemy (an attack). The two labels are See No Evil, Hear No Evil's (60055).
  // "Then, if it has the" reads the face after the flip (RRG 1.8 "'Then'", p. 44), which is what the next lines'
  // conditions read.
  "x.night-thrasher-dh.03.disaster-constant": heroAction(
    { label: ["attack", "thwart"] },
    FLIP_BOARD,
    ifThen(BOARD_IS_VEHICLE, thwartAScheme(3)),
    ifThen(BOARD_IS_WEAPON, attackAnEnemy(4)),
  ),

  // =========================================================================
  // 04 Drop In (event)
  // =========================================================================

  // Hero Response: after you change to hero form, if the Battle Board has Vehicle, confuse an enemy; if Weapon, stun
  // an enemy. Modeled on Ant-Man's Helmet (12008): a Hero Response to `youChangeForm`, which is only ever offered in
  // hero form, that is, after a change to hero form.
  "x.night-thrasher-dh.04.drop-in-response": heroResponse(
    on.youChangeForm(),
    ifThen(BOARD_IS_VEHICLE, [anEnemy("enemy"), confuse(chosen("enemy"))]),
    ifThen(BOARD_IS_WEAPON, [anEnemy("enemy"), stun(chosen("enemy"))]),
  ),

  // =========================================================================
  // 05 Kickflip (event)
  // =========================================================================

  // "If the last card you played this round was a Night Thrasher event, reduce the cost to play this card by 1."
  // `lastPlayedThisRound` (engine commit b51277136): the play before this card's own, by play order. "Night Thrasher
  // event" is an event of Night Thrasher's identity set (`identitySetOf`), as "Carnage event" in the Carnage pack.
  "x.night-thrasher-dh.05.kickflip-constant": constant(
    costModifier({
      delta: -1,
      appliesTo: { self: true },
      activeIn: "hand",
      while: lastPlayedThisRound(query("event", { identitySetOf: you })),
    }),
  ),
  // Hero Action (attack): flip the Battle Board and deal 1 damage to an enemy (an attack). Draw 1 card.
  "x.night-thrasher-dh.05.kickflip-action": heroAction({ label: "attack" }, FLIP_BOARD, attackAnEnemy(1), draw(1)),

  // =========================================================================
  // 06 Melon Grab (event)
  // =========================================================================

  // Hero Action (attack): deal 8 damage to an enemy. Vehicle: the damage can be divided among enemies as you choose
  // (Wasp Sting 13006: `divide`, an attack-labeled division is one attack, RRG 1.8 "Labeled Ability", p. 26). Weapon:
  // this attack gains piercing and overkill (Echo's Katana 60045: `attack` with `keywords`). The 8 damage is not
  // conditional on either trait.
  "x.night-thrasher-dh.06.melon-grab-action": heroAction(
    { label: "attack" },
    ifThen(
      BOARD_IS_VEHICLE,
      divide("damage", 8, query("enemy")),
      ifThen(
        BOARD_IS_WEAPON,
        [anAttackableEnemy("enemy"), attack(8, chosen("enemy"), { keywords: ["piercing", "overkill"] })],
        [anAttackableEnemy("enemy"), attack(8, chosen("enemy"))],
      ),
    ),
  ),

  // =========================================================================
  // 07 Tailblock (event)
  // =========================================================================

  // Hero Interrupt (defense): when you would take any amount of damage, Vehicle: prevent 1 of that damage and draw 2
  // cards; Weapon: prevent 3 of that damage. Modeled on Shield Block (Captain America 03005, the same trigger and
  // label) with a partial prevention (`preventDamage(n)`: "prevent 1 / 3 of that damage").
  "x.night-thrasher-dh.07.tailblock-interrupt": heroInterrupt(
    when.damage(YOUR_IDENTITY),
    { label: "defense" },
    ifThen(BOARD_IS_VEHICLE, [preventDamage(1), draw(2)]),
    ifThen(BOARD_IS_WEAPON, preventDamage(3)),
  ),

  // =========================================================================
  // 08 The Mancave (support)
  // =========================================================================

  // Alter-Ego Response: after you change form, heal 1 damage from your identity. (Ant-Man 12001b form.)
  "x.night-thrasher-dh.08.the-mancave-response": alterEgoResponse(on.youChangeForm(), heal(1, yourIdentity)),
  // Hero Response: after you change form, reduce the resource cost of the next Skill card you play this turn by 1.
  // Modeled on Avengers Tower (03024) / Carnage's Lethal Restraint: `reduceNextCardCost`, here with the "turn" span.
  "x.night-thrasher-dh.08.the-mancave-hero-response": heroResponse(
    on.youChangeForm(),
    reduceNextCardCost(you, 1, "turn", SKILL_CARD),
  ),

  // =========================================================================
  // 09 Escrima Sticks (upgrade)
  // =========================================================================

  // "While the Battle Board upgrade has the Vehicle trait, your attacks gain piercing and overkill." Modeled on
  // Frenzied Violence (Carnage) / Psi-Katana: `attacksGainKeywords` for the identity's attacks, with a `while`.
  "x.night-thrasher-dh.09.escrima-sticks-constant": constant(
    attacksGainKeywords(["piercing", "overkill"], { attacker: YOUR_IDENTITY, while: BOARD_IS_VEHICLE }),
  ),
  // Hero Action (attack): deal 6 damage to an enemy. Shuffle this card into your deck. (Breakthrough, Jessica Jones
  // 61005: `moveCards(self, "deckShuffle")`.)
  "x.night-thrasher-dh.09.escrima-sticks-action": heroAction(
    { label: "attack" },
    attackAnEnemy(6),
    moveCards(cards(self), "deckShuffle"),
  ),

  // =========================================================================
  // 10 Multi-Skilled (upgrade)
  // =========================================================================

  // "Resource: Exhaust Multi-Skilled -> generate a [wild] resource for a Skill card." Modeled on Jet Belt (Wonder Man
  // 58008, `generatesFor`; that one prints "Hero Resource", this one a plain "Resource"), so it works in either form.
  "x.night-thrasher-dh.10.multi-skilled-resource": resource(
    { wild: 1 },
    { cost: exhaustThis, generatesFor: SKILL_CARD },
  ),

  // =========================================================================
  // 11 Prewind Stance (upgrade)
  // =========================================================================

  // "Night Thrasher gets +1 DEF and gains retaliate 1." (Captain America's Shield 03009 for the retaliate.)
  "x.night-thrasher-dh.11.prewind-stance-constant": constant(
    gets("def", 1, YOUR_IDENTITY, { while: isHero() }),
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY),
  ),
  // Hero Interrupt: when your turn or the villain phase begins, exhaust this card -> flip the Battle Board upgrade.
  // `on.either` of the two timing points (Captain America's Quinjet 03019 for the turn start, 16085b for the villain
  // phase).
  "x.night-thrasher-dh.11.prewind-stance-interrupt": heroInterrupt(
    on.either(on.yourTurnBegins(), on.phaseBeginning("villain")),
    { cost: exhaustThis },
    FLIP_BOARD,
  ),

  // =========================================================================
  // 12 Practice (obligation)
  // =========================================================================

  // "Give to the Night Thrasher player. You may flip to alter-ego form. Choose: [A] Exhaust your alter-ego or discard
  // 1 card from your hand -> remove Practice from the game. [B] You cannot flip the Battle Board upgrade until the
  // start of the next villain phase. Discard this obligation." The base obligation shape (`obligation()`, Core
  // obligations), but bullet A has two costs to choose from, so it is two options here: exhaust the alter-ego (only
  // while in alter-ego form and ready: the "Exhaust your alter-ego" errata) or discard a card from hand (RRG 1.8
  // "Cost", p. 13: a cost is paid in full or not at all, so an option whose cost cannot be paid is not offered).
  // "You cannot flip the Battle Board until the start of the next villain phase" is a practice counter on the Battle
  // Board (Need to Kill's bookkeeping in the Carnage pack): the board's two faces each stop their own flip while it
  // holds one (the `practice-lock` constants) and clear it as the next villain phase begins (`practice-clear`). A lasting
  // `applyRuleUntil` with `cannotFlip` is the exact form, but the SDK's DSL feature list has no `expr:cannotFlip`
  // (no base card has a lasting flip lock), so a pack using it would be refused: see the README.
  "x.night-thrasher-dh.12.obligation": whenRevealed(
    chooseOne(
      option("Flip to alter-ego form", { when: isHero() }, changeForm(you, "alterEgo")),
      option("Stay in hero form", { when: isHero() }),
    ),
    chooseOne(
      option(
        "Exhaust Dwayne Taylor -> remove this obligation from the game",
        { when: exists(query("alterEgo", { controller: "you", exhausted: false })) },
        exhaust(yourIdentity),
        moveCards(cards(self), "removedFromGame"),
      ),
      option(
        "Discard 1 card from your hand -> remove this obligation from the game",
        { when: valueAtLeast(handCountOf(you), 1) },
        discardFromHand(1),
        moveCards(cards(self), "removedFromGame"),
      ),
      option(
        "You cannot flip the Battle Board until the start of the next villain phase. Discard this obligation",
        addCounters("practice", 1, each(BATTLE_BOARD)),
        moveCards(cards(self), "discard"),
      ),
    ),
  ),

  // =========================================================================
  // 13 Terrax the Tamer (minion, nemesis)
  // =========================================================================

  // Forced Response: after Terrax activates, discard the top 8 cards of the encounter deck. If the Cosmic Ax
  // attachment was discarded this way, reveal it. Modeled on Electromagnetic Pulse (02043): `discardEncounterCards`
  // binds what it discarded; the named card is picked out of that bind and revealed (an attachment finds its host,
  // Terrax, by its own "Attach to").
  "x.night-thrasher-dh.13.terrax-the-tamer-forced-response": forcedResponse(
    after.enemyActivates("self"),
    discardEncounterCards(8, { bind: "tamed" }),
    selectCards("ax", cards(chosen("tamed"), query("attachment", { name: "Cosmic Ax" }))),
    ifThen(varAtLeast("ax.count"), revealCard(chosen("ax"), you)),
  ),

  // =========================================================================
  // 14 Cemented (side scheme, nemesis)
  // =========================================================================

  // Hinder 1[per_hero] is data. "Players cannot make basic attacks with heroes or allies or flip upgrades or
  // identities." The three rules are unscoped ("players"), as the engine test of the per-player blank states them:
  // basic attacks (`cannotMakeBasicAttacks`, Seduced 55015), flipping upgrades (`cannotFlip`, Body Swapped 41025) and
  // changing form for each player (`cannotChangeForm`, an identity "flip", RRG 1.8 "Form, Change Form", p. 21).
  "x.night-thrasher-dh.14.cemented-constant": constant(
    cannotMakeBasicAttacks({ categories: ["hero", "ally"] }),
    cannotFlip(query("upgrade")),
    rule({ kind: "cannotChangeForm", player: eachPlayer }),
  ),
  // Action: each player may discard 1 card from their hand. Until the end of the phase, each player who discarded a
  // card this way may treat this card's printed text box as if it were blank. `blankTextBoxForPlayers` (engine commit
  // b51277136) blanks it for the players who discarded only; the others keep it. Each player answers for themselves.
  "x.night-thrasher-dh.14.cemented-action": action(
    forEachPlayer(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option(
          "Discard 1 card from your hand and treat Cemented's text box as blank until the end of the phase",
          { when: valueAtLeast(handCountOf(thatPlayer), 1) },
          discardFromHand(1, thatPlayer),
          blankTextBoxForPlayers(self, thatPlayer, "endOfPhase"),
        ),
        option("Do not discard"),
      ),
    ),
  ),

  // =========================================================================
  // 15 Cosmic Connection (treachery, nemesis)
  // =========================================================================

  // When Revealed: if the Cosmic Ax attachment is in play and your hero has a Weapon card in play, take 3 indirect
  // damage. If no damage was taken this way, this card gains surge. READING (flagged, ENGINE_NOTES): "your hero has a
  // Weapon card in play" is read literally, as you in hero form controlling a Weapon card, so in alter-ego form the
  // condition fails and the card surges. Modeled on Spell Shards (Enchantress 55026): the indirect damage binds the
  // characters that took it (`<bind>.damaged`).
  "x.night-thrasher-dh.15.when-revealed": whenRevealed(
    ifThen(
      {
        kind: "and",
        of: [
          inPlay("Cosmic Ax"),
          isHero(),
          exists(query(["upgrade", "support", "ally"], { trait: WEAPON, controller: "you" })),
        ],
      },
      dealIndirectDamage(you, 3, { bind: "connection" }),
    ),
    ifThen(not(valueAtLeast(countOf({ inSlot: "connection.damaged" }), 1)), surge()),
  ),

  // =========================================================================
  // 16 Cosmic Ax (attachment, nemesis)
  // =========================================================================

  // "Attach to Terrax the Tamer (data). If you cannot, discard the top 8 cards of the encounter deck. If Terrax the
  // Tamer was discarded this way, reveal him and attach Cosmic Ax to him." `cannotAttach` is the "If you cannot" half
  // of an Attach to (The Initiative's Drafted 56080 for the reveal-then-attach). A card the effects leave unattached
  // is discarded.
  "x.night-thrasher-dh.16.cosmic-ax-constant": cannotAttach(
    discardEncounterCards(8, { bind: "tamed" }),
    selectCards("terrax", cards(chosen("tamed"), TERRAX)),
    ifThen(varAtLeast("terrax.count"), [revealCard(chosen("terrax"), you), attachCard(self, chosen("terrax"))]),
  ),
  // [star] Boost: if Terrax the Tamer is in play, reveal this card. Master Manipulator (60062).
  "x.night-thrasher-dh.16.boost": boost(ifThen(inPlay("Terrax the Tamer"), revealCard(self, you))),
});
