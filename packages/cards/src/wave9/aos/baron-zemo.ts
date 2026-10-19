import { AOS_EVIDENCE_COMBINATIONS, trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  accusationWrongGuesses,
  accuse,
  accusedWrong,
  addCounters,
  additionalCostToReady,
  additionalPowerCost,
  advanceMainScheme,
  allOf,
  bindTargets,
  cards,
  chooseOne,
  chooseOneBy,
  chooseTarget,
  chosen,
  countersOn,
  constant,
  coveredByEngineRule,
  dealHiddenPiles,
  defeat,
  defineAbilities,
  discard,
  each,
  enemyAttack,
  enemyScheme,
  eventAmount,
  exists,
  findCard,
  firstPlayer,
  flipCard,
  forEachCard,
  forcedInterrupt,
  forcedResponse,
  gainFromHiddenPile,
  gainsAbility,
  gainsKeyword,
  heroAction,
  heroNoCharacterIsTitledAs,
  hiddenPileCount,
  identifyMole,
  ifElse,
  ifThen,
  inCampaign,
  instead,
  made,
  modifyAttack,
  moveCards,
  not,
  on,
  option,
  perHero,
  placeThreat,
  preventThreat,
  printedCostOf,
  putIntoPlayAsHost,
  product,
  query,
  remainingHpOf,
  removeCountersAmong,
  removeCountersFrom,
  resetHitPoints,
  response,
  searchCollection,
  self,
  setup,
  spend,
  eitherCost,
  spendXResources,
  superlative,
  theAccused,
  theMainScheme,
  theMole,
  theVillain,
  treatAttachedHeroAsMinion,
  valueAtLeast,
  varOf,
  varAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  withFewestCounters,
  you,
} from "../../dsl/index.js";

const BOARD_MEMBER = trait("BOARD MEMBER");
const ELITE = trait("ELITE");
/** "Board Member environment": the environment face only (every removal, 1B's Response). */
const BOARD_MEMBER_ENVIRONMENTS = query("environment", { trait: BOARD_MEMBER });
/** "Board Member card": either face, in play (50165b / 50166b, 50168b step 2). */
const BOARD_MEMBER_CARDS = query([], { trait: BOARD_MEMBER });
/** "Board Member attachment" (50169b). */
const BOARD_MEMBER_ATTACHMENTS = query("attachment", { trait: BOARD_MEMBER });
/** "A Board Member environment that has no secret counters on it" (50167b). */
const BARE_BOARD_MEMBER_ENVIRONMENTS = query("environment", { trait: BOARD_MEMBER, not: { hasCounter: "secret" } });
const BARON_ZEMOS_SWORD = query("attachment", { name: "Baron Zemo's Sword" });

/** The two hidden evidence piles, dealt by 50167a Setup (docs/phase7-wave9.md section 3.29). */
const AIM_PILE = "aim";
const SHIELD_PILE = "shield";

/**
 * "Forced Interrupt: When Baron Zemo would be defeated, reset his hit points to N instead. Remove 3 secret counters
 * from among Board Member environments." The card says Forced Interrupt; MC50 p. 18 says Forced Response. The printed
 * card wins (docs/phase7-wave9.md section 1, rules conflicts). The first player splits the removal (RRG 1.8 "First
 * Player", p. 19; owner decision Q28 = A).
 */
const zemoForcedInterruptA = (to: 12 | 16) =>
  forcedInterrupt(
    on.defeated("self"),
    { would: true },
    instead(resetHitPoints(self, { to })),
    removeCountersAmong("secret", 3, BOARD_MEMBER_ENVIRONMENTS, { chooser: firstPlayer }),
  );

/**
 * "[star] Forced Interrupt: When Baron Zemo activates against you, either place N secret counter(s) on a Board Member
 * card or give Baron Zemo an additional boost card for this activation." The first player chooses, and
 * names the card (a Board Member card is either face).
 */
const zemoForcedInterruptB = (counters: 1 | 2) =>
  forcedInterrupt(
    when.enemyActivates("self", { againstYou: true }),
    chooseOne(
      option(
        `Place ${counters} secret counter${counters === 1 ? "" : "s"} on a Board Member card`,
        // No "choose": an encounter card targeting one of several eligible cards; the first player selects
        // (RRG 1.8 "First Player", p. 19).
        chooseTarget("board", BOARD_MEMBER_CARDS, { chooser: firstPlayer }),
        addCounters("secret", counters, chosen("board")),
      ),
      option("Give Baron Zemo an additional boost card for this activation", modifyAttack({ extraBoostCards: 1 })),
    ),
  );

/**
 * "Place N secret counters on the Board Member environment with the fewest secret counters" (50170, 50172, 50176): a
 * card holding none is the fewest, and a tie goes to the first player (RRG 1.8 "First Player", p. 19; docs/phase7-wave9.md
 * section 3.27).
 */
const placeOnFewest = (counters: number) => [
  bindTargets("fewest", withFewestCounters(each(BOARD_MEMBER_ENVIRONMENTS), "secret")),
  chooseTarget("board", { inSlot: "fewest" }, { chooser: firstPlayer }),
  addCounters("secret", counters, chosen("board")),
];

/** "Remove 1[per_hero] secret counters from among Board Member environments" (the When Defeated of 50173 and 50174). */
const removePerHero = () =>
  whenDefeated(removeCountersAmong("secret", perHero(1), BOARD_MEMBER_ENVIRONMENTS, { chooser: firstPlayer }));

/**
 * The Sword's Hero Action: "Spend [physical][physical][physical] or [energy][energy][energy] -> remove 1 secret counter
 * from a Board Member environment. Discard this card." The payment is the ability's own cost (`eitherCost`), so a player
 * who can make neither is not offered it and cannot initiate it (RRG 1.8 "Cost", p. 13; "Initiating Abilities" step 5,
 * p. 49). The environment must hold a counter to be targeted (RRG 1.8 "Target", p. 42).
 */
const swordAction = () =>
  heroAction(
    { cost: eitherCost(spend({ physical: 3 }), spend({ energy: 3 })) },
    chooseTarget("board", query("environment", { trait: BOARD_MEMBER, hasCounter: "secret" })),
    removeCountersFrom(chosen("board"), "secret", 1),
    discard(self),
  );

/**
 * Baron Zemo, the scenario frame (MC50 pp. 18 to 19; docs/phase7-wave9.md sections 3.26, 3.29 (a) and (b), 4.1 Q1, Q28
 * and Q30). The encounter cards 50170 to 50177 follow the frame below.
 *
 * **The villain**: each of the two cards (A for standard, B for expert) has a masked face, whose Forced Interrupt
 * resets his hit points (12, 16) and removes 3 secret counters from among the Board Member environments, and an Unmasked
 * face (the main scheme's 3A flips him, 50169a), whose Forced Interrupt makes each activation against a player cost
 * either secret counters (1, 2) on a Board Member card or an additional boost card. Steady is data.
 *
 * **Zemo's Manipulations (50167a / 50167b)**: Setup deals the two hidden evidence piles (`aim`: one card of each kind;
 * `shield`: the other six) and places 2 secret counters on each Board Member environment (the Setup keyword already put
 * them into play). The Response is two independent offers to the first player: place 2 secret counters on a Board
 * Member environment with none, to gain 2 cards from the `shield` pile (Q30 = A: not offered while the pile is empty);
 * and advance to stage 2A. The campaign branches (docs/phase7-wave9.md section 3.75) are in the same scripts: in a
 * campaign game (`inCampaign`) Setup deals no piles and places no counters (the log's envelopes and recorded counters
 * arrive through the campaign definition) and the Response gains 1 card instead of 2.
 *
 * **The Accusation (50168a / 50168b)**: 2A asks the first player for a combination not crossed out. 2B's When Revealed
 * is four steps in order: identify the mole (the `aim` pile turns faceup; no `revealHiddenPile` first), 1 secret
 * counter on each Board Member card (either face) per wrong guess, 3 more on the accused when the accused is not the
 * mole, advance to stage 3A. The four `-constant` refs the data lists are those numbered steps, not abilities.
 *
 * **Fighting Zemo (50169a / 50169b)**: 3A flips Zemo to his Unmasked face, resets his hit points to its printed value
 * and finds Baron Zemo's Sword for him. 3B flips the mole (its environment face; the 2B penalties can already have
 * flipped it) to its attachment face, which keeps its secret counters (Q1 = A), and places 1[per_hero] threat per
 * secret counter on each Board Member attachment, one placement per attachment.
 *
 * **The encounter deck (50170 to 50177)**: the Sword's Forced Response answers an attack by its host that defeats a
 * character; S.H.I.E.L.D. Agent's Forced Interrupt answers its own activation or defeat; Undermine Support taxes
 * readying a support; both side schemes remove 1[per_hero] secret counters when defeated; Might Makes Right and The
 * Ends Justify the Means finish with secret counters removed from among the Board Member environments (the first
 * player splits them, Q28 = A). Reluctant Foe is the §3.30 hero-as-minion kit (below); `BARON_ZEMO_SKIPPED` is empty.
 *
 * Cards (11):
 * - 50165a Baron Zemo (villain)
 * - 50166a Baron Zemo (villain)
 * - 50167a Zemo's Manipulations (main_scheme)
 * - 50170 Baron Zemo's Sword (attachment)
 * - 50171 Reluctant Foe (attachment)
 * - 50172 S.H.I.E.L.D. Agent (minion)
 * - 50173 Divided Loyalties (side_scheme)
 * - 50174 Undermine Support (side_scheme)
 * - 50175 Battle of Wits (treachery)
 * - 50176 Might Makes Right (treachery)
 * - 50177 The Ends Justify the Means (treachery)
 */
export const BARON_ZEMO: AbilityRegistry = defineAbilities({
  "50165a.baron-zemo-forced-interrupt": zemoForcedInterruptA(12),
  "50165b.baron-zemo-forced-interrupt": zemoForcedInterruptB(1),
  "50166a.baron-zemo-forced-interrupt": zemoForcedInterruptA(16),
  "50166b.baron-zemo-forced-interrupt": zemoForcedInterruptB(2),

  // 1A Setup: prepare the evidence (not in a campaign, whose envelopes arrive from the log) and 2 secret counters on
  // each Board Member environment (not in a campaign either). "Put each Board Member environment into play" is their
  // Setup keyword.
  "50167a.setup": setup(
    // In a campaign the envelopes come from the log (the definition's `seedHiddenPiles`) and the counters are the ones
    // recorded (the board preparation in `campaign/executive-board.ts`), so neither is dealt or placed here (MC50 pp. 18
    // to 19; docs/phase7-wave9.md section 3.75).
    ifThen(not(inCampaign), [
      dealHiddenPiles("executive_board_evidence", { onePerGroupTo: AIM_PILE, restTo: SHIELD_PILE }),
    ]),
    ifThen(not(inCampaign), [addCounters("secret", 2, each(BOARD_MEMBER_ENVIRONMENTS))]),
  ),
  // 1B Response: two independent offers to the first player (see the module header).
  "50167b.zemos-manipulations-response": response(
    on.phaseEnding("player"),
    { firstPlayerOnly: true },
    ifThen(
      allOf(exists(BARE_BOARD_MEMBER_ENVIRONMENTS), valueAtLeast(hiddenPileCount(SHIELD_PILE), 1)),
      chooseOneBy(
        firstPlayer,
        option(
          "Place 2 secret counters on a Board Member environment with none to gain 2 evidence cards",
          chooseTarget("environment", BARE_BOARD_MEMBER_ENVIRONMENTS, { chooser: firstPlayer }),
          addCounters("secret", 2, chosen("environment")),
          // "2 cards from the S.H.I.E.L.D. envelope (1 card instead in campaign mode)". The option's label names the
          // standalone 2; the client words the campaign's 1 from the game's mode.
          gainFromHiddenPile(SHIELD_PILE, ifElse(inCampaign, 1, 2)),
        ),
        option("Do not gain evidence"),
      ),
    ),
    chooseOneBy(
      firstPlayer,
      option("Advance to stage 2A to make the accusation", advanceMainScheme({ to: { stageNumber: 2 } })),
      option("Do not advance"),
    ),
  ),

  // 2A When Revealed.
  "50168a.when-revealed": whenRevealed(accuse(AOS_EVIDENCE_COMBINATIONS)),
  // 2B When Revealed, the four steps in order.
  "50168b.when-revealed": whenRevealed(
    identifyMole(AIM_PILE, AOS_EVIDENCE_COMBINATIONS),
    addCounters("secret", accusationWrongGuesses, each(BOARD_MEMBER_CARDS)),
    ifThen(accusedWrong, addCounters("secret", 3, each(theAccused))),
    advanceMainScheme({ to: { stageNumber: 3 } }),
  ),
  // The data lists the numbered steps of 2B's When Revealed as four more abilities; the one above carries them all.
  "50168b.the-accusation-constant": coveredByEngineRule(),
  "50168b.the-accusation-constant-2": coveredByEngineRule(),
  "50168b.the-accusation-constant-3": coveredByEngineRule(),
  "50168b.the-accusation-constant-4": coveredByEngineRule(),

  // 3A When Revealed: the villain turns Unmasked (a flip keeps his attachments), his hit points reset to the new face's
  // printed value, and the Sword (found in play, the discard pile or the encounter deck) attaches to him.
  "50169a.when-revealed": whenRevealed(
    flipCard(theVillain),
    resetHitPoints(theVillain),
    findCard(BARON_ZEMOS_SWORD, { attachTo: theVillain }),
  ),
  // 3B When Revealed: the mole (an environment; one the 2B penalties flipped already is an attachment and stays) flips
  // to its attachment face with its secret counters, then 1[per_hero] threat for each secret counter on each Board
  // Member attachment, the mole's own included.
  "50169b.when-revealed": whenRevealed(
    flipCard(each({ ...theMole, categories: ["environment"] }), { keepCounters: ["secret"] }),
    forEachCard(
      "member",
      each(BOARD_MEMBER_ATTACHMENTS),
      placeThreat(product(perHero(1), countersOn(chosen("member"), "secret")), theMainScheme),
    ),
  ),
  // The Sword: "After Baron Zemo attacks and defeats a character" (an attack by the host that defeated something).
  "50170.baron-zemos-sword-forced-response": forcedResponse(
    { ...on.enemyAttacks("host"), requireResults: { defeated: 1 } },
    ...placeOnFewest(1),
  ),
  "50170.baron-zemos-sword-action": swordAction(),

  // S.H.I.E.L.D. Agent: Quickstrike and Vulnerable are data.
  "50172.shield-agent-forced-interrupt": forcedInterrupt(
    on.either(when.enemyActivates("self"), on.defeated("self")),
    ...placeOnFewest(1),
  ),

  // Reluctant Foe (docs/phase7-wave9.md section 3.30; owner Q39 to Q46, MC50 p. 22). The constant treats the attached
  // hero as an Elite minion (SCH from its printed THW, its printed traits kept, Q41), makes it Villainous and gives it
  // the When Defeated below in place of its printed text. In that When Defeated `self` is the hero, and the order
  // matters: the attachment first (it needs the hero as its host), then the hero. The When Revealed searches the
  // collection for a hero whose hero-side title matches no character in play (Q42, Q44) and puts it into play engaged
  // with the revealing player with this card attached. The card has no `attachesTo`, so a reveal that finds no hero
  // discards it (Q46).
  "50171.reluctant-foe-constant": constant(
    treatAttachedHeroAsMinion([ELITE]),
    gainsKeyword({ name: "villainous" }, { hostOfSelf: true }),
    gainsAbility("50171.when-defeated", { to: { hostOfSelf: true } }),
  ),
  "50171.when-defeated": whenDefeated(
    moveCards(cards(each(query("attachment", { name: "Reluctant Foe", host: self }))), "removedFromGame"),
    moveCards(cards(self), "removedFromGame"),
  ),
  "50171.when-revealed": whenRevealed(
    searchCollection(heroNoCharacterIsTitledAs, "hero"),
    putIntoPlayAsHost(chosen("hero")),
  ),

  // Divided Loyalties: Hinder is data; every ally's attack, thwart and defense costs its player 1 more resource.
  "50173.divided-loyalties-constant": constant(additionalPowerCost(query("ally"), ["attack", "thwart", "defend"], 1)),
  "50173.when-defeated": removePerHero(),

  // Undermine Support: readying a support costs its readier 1 resource of any type (RRG "Ready", p. 36: may decline).
  "50174.undermine-support-constant": constant(additionalCostToReady(query("support"), 1)),
  "50174.when-defeated": removePerHero(),

  "50176.when-revealed-alter-ego": whenRevealedAlterEgo(...placeOnFewest(2)),
  "50176.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, bind: "attack" }),
    ifThen(
      allOf(made("attack"), not(varAtLeast("attack.damage"))),
      removeCountersAmong("secret", 3, BOARD_MEMBER_ENVIRONMENTS, { chooser: firstPlayer }),
    ),
  ),

  // Battle of Wits: Zemo schemes; the threat that activation would place on the main scheme is the pending amount
  // (`eventAmount`), the most X can be. The revealing player (`you`) chooses X once, from 0 to the most [mental]
  // resources they could pay, and pays X in one payment (`spendXResources`), so a card that generates two [mental]
  // covers 2. X of that threat is prevented and X secret counters are removed, the first player splitting the removal
  // (Q28 = A). The removal is not conditional on a counter being left: the prevention does not depend on it, and
  // removing fewer than X because fewer remain is "as many as possible". With no threat to place the effects never
  // resolve, and a player with no [mental] resource to spend is not asked.
  "50175.when-revealed": whenRevealed(
    enemyScheme(theVillain, {
      wouldPlaceThreat: [
        spendXResources({ mental: 1 }, eventAmount, "paid"),
        ifThen(made("paid"), [
          preventThreat(varOf("paid.amount")),
          removeCountersAmong("secret", varOf("paid.amount"), BOARD_MEMBER_ENVIRONMENTS, { chooser: firstPlayer }),
        ]),
      ],
    }),
  ),

  // The Ends Justify the Means: the revealing player chooses. The tie for "fewest remaining hit points" and the split of
  // the counters are the first player's.
  "50177.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Baron Zemo defeats the minion with the fewest remaining hit points and schemes",
        { when: exists(query("minion")) },
        bindTargets("fewest", superlative("lowest", each(query("minion")), remainingHpOf(chosen("candidate")))),
        chooseTarget("minion", { inSlot: "fewest" }, { chooser: firstPlayer }),
        defeat(chosen("minion")),
        enemyScheme(theVillain),
      ),
      option(
        "Discard an ally or support you control to remove secret counters equal to its printed cost",
        { when: exists(query(["ally", "support"], { controller: "you" })) },
        chooseTarget("card", query(["ally", "support"], { controller: "you" }), { chooser: firstPlayer }),
        discard(chosen("card")),
        removeCountersAmong("secret", printedCostOf(chosen("card")), BOARD_MEMBER_ENVIRONMENTS, {
          chooser: firstPlayer,
        }),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None remain. */
export const BARON_ZEMO_SKIPPED: Readonly<Record<string, string>> = {};
