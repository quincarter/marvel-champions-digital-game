/**
 * Yondu (by DesignHacker, nemesis set by BlueHG; Hitch template): every ability of the pack, each modeled on the
 * base-game card named in its comment. The pack's own printed text is the authority (docs/custom-content-packs.md
 * section 6), then the RRG (v1.8) and FFG rulings for what the text does not override. The English text of Yondu's
 * D'ast Whistlin' and of Whistle While You Work is the authors' SUGGESTED ERRATA (2026-11-11, awaiting the author;
 * ENGINE_NOTES): scripted as that text says, not as the printed one.
 *
 * Ability ids are `<card code>.<slug>`, as the importer wrote them.
 *
 * THIS PACK IS A DRAFT (the folder's DRAFT file), waiting for its art bundle. Every ability is scripted; the four that
 * waited for engine primitives now use them (the README lists their sources):
 *   1. Yaka Arrow, "cannot be attached to cards unless it is in play": `cannotBeAttachedUnlessInPlay`.
 *   2. D'ast Whistlin', "attached to or removed from an enemy": `on.cardAttachedOrRemoved`.
 *   3. Jackpot!, "treat the next card you spend as if it has double the resources": `doubleNextCardSpent`.
 *   4. Sav'rkk, "upgrades cannot be removed from Sav'rkk": `upgradesCannotBeRemoved`.
 * Summon searches everywhere in or out of play (`findCard`'s `anywhere`). Two are working APPROXIMATIONS, marked
 * `APPROXIMATION`: Ravage's fragile (no `fragile` keyword; the overkill is scripted directly) and Sword-Gun-Arm's hit
 * point check (read after damage, not as a standing state).
 */
import {
  after,
  addCounters,
  action,
  anAttackableEnemy,
  attachCard,
  attack,
  applyRuleUntil,
  attacksGainKeywords,
  boost,
  cannotBeAttachedUnlessInPlay,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  dealDamage,
  definePackAbilities,
  discard,
  doubleNextCardSpent,
  draw,
  each,
  enemyAttack,
  eventSource,
  eventTarget,
  exhaust,
  exhaustThis,
  exists,
  findCard,
  forcedInterrupt,
  forcedResponse,
  FRIENDLY_CHARACTER,
  gets,
  giveTough,
  hasAttachment,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  host,
  ifThen,
  isAttached,
  moveCards,
  not,
  on,
  oncePerRound,
  option,
  packObligation,
  preventDamage,
  query,
  ready,
  refMatches,
  remainingHpOf,
  repeatTimes,
  response,
  self,
  stun,
  surge,
  theVillain,
  upgradesCannotBeRemoved,
  valueAtLeast,
  valueEquals,
  varOf,
  when,
  whenRevealed,
  you,
  yourIdentity,
  YOUR_IDENTITY,
  zoneCountOf,
} from "@mc/mod-sdk";

/** The Yaka Arrow upgrade in play, whoever it is attached to (what the enemy-side readings look at). */
const ARROW = query("upgrade", { name: "Yaka Arrow" });
/**
 * "The Yaka Arrow upgrade" the acting player owns, in play. An upgrade on an enemy stays controlled by its owner
 * (RRG 1.8 "Ownership and Control"), so this finds it on an enemy too.
 */
const MY_ARROW = query("upgrade", { name: "Yaka Arrow", controller: "you" });
const TAHLEI = query("upgrade", { name: "Tahlei", controller: "you" });
/**
 * "That enemy has the Yaka Arrow upgrade attached". (An earlier note here said `hasAttachment` inside `refMatches` did
 * not see the arrow: that came from the tests' state surgery, which set the arrow's host without the host's
 * attachment list; the engine keeps both, and `upgrade-host-primitives.test.ts` checks the reading.)
 */
const arrowOn = (card: Parameters<typeof refMatches>[0]) =>
  refMatches(card, query("enemy", hasAttachment({ name: "Yaka Arrow" })));
const SAVRKK = query("minion", { name: "Sav'rkk" });
const SWORD_GUN_ARM = query("attachment", { name: "Sword-Gun-Arm" });

/** "An enemy or your identity": where the Arrow may be attached by Twirlin', Invest and Tahlei. */
const ARROW_HOSTS = { anyOf: [query("enemy"), YOUR_IDENTITY] };

/** "Attach the Yaka Arrow upgrade to an enemy or to your identity" (a no-op while the arrow is not in play). */
const attachArrowToEnemyOrIdentity = [
  chooseTarget("arrowHost", ARROW_HOSTS),
  attachCard(each(MY_ARROW), chosen("arrowHost")),
];

/**
 * "Summon X" (DesignHacker's keyword, "search everywhere in or out of play for the specified card (shuffle)"): a
 * `findCard` with `anywhere`, which searches what Find does (in play, the decks, the discard piles, the set-aside
 * areas; RRG 1.8 "Find", p. 19) and, wider on purpose, the cards removed from the game, the victory display and the
 * facedown encounter cards (ENGINE_NOTES). A deck it searched is shuffled, as for a find.
 */
const SUMMON = { anywhere: true } as const;
const summonToHand = (name: string) => findCard(query("upgrade", { name }), "hand", { owner: you, ...SUMMON });

export default definePackAbilities({
  // =========================================================================
  // 01a Yondu (hero identity)
  // =========================================================================

  // D'ast Whistlin': "Response: After the Yaka Arrow upgrade is attached to or removed from an enemy, deal 1 damage to
  // that enemy." (The errata made this a Response; printed it was an Interrupt.) One pattern for both halves
  // (`on.cardAttachedOrRemoved`): attached is Hot-Headed's `cardAttached` (Iceman 46024); removed is every way the
  // arrow leaves an enemy (moved to another host, returned to hand, discarded, its host leaving play). A moved arrow is
  // heard twice, removed from the first enemy and then attached to the second, each dealing 1 damage to its own enemy
  // (an engine reading: RRG 1.8 "Attach To", p. 8, does not order the two). An enemy that left play (the arrow went
  // with it, or its Forced Interrupt moved it as the enemy was defeated) takes no damage. The damage is not an attack.
  "x.yondu-dh.01a.dast-whistlin": response(
    on.cardAttachedOrRemoved(ARROW, { host: query("enemy") }),
    dealDamage(1, eventTarget),
  ),

  // "Response: After the Yaka Arrow upgrade is attached to your identity, heal 1 damage from Yondu."
  "x.yondu-dh.01a.yondu-response": response(on.cardAttached(ARROW, { to: YOUR_IDENTITY }), heal(1, yourIdentity)),

  // =========================================================================
  // 01b Yondu Udonta (alter-ego)
  // =========================================================================

  // Crew Cut: "Action: Summon the Tahlei upgrade and add it to your hand. (Limit once per round.)"
  "x.yondu-dh.01b.crew-cut": action({ limit: oncePerRound }, summonToHand("Tahlei")),

  // Whistlin': "Action: Exhaust Yondu Udonta -> summon the Yaka Arrow upgrade and add it to your hand."
  "x.yondu-dh.01b.whistlin": action({ cost: exhaustThis }, summonToHand("Yaka Arrow")),

  // =========================================================================
  // 02 Cheap Shot / 03 Fight Dirty (events)
  // =========================================================================

  // "Hero Action (attack): Stun an enemy. Then, if that enemy has the Yaka Arrow upgrade attached, deal 6 damage to that
  // enemy." The "(attack)" label makes the 6 damage an attack (as Kickflip, Night Thrasher 05), so the enemy must be
  // one the hero may attack (guard) and retaliate applies.
  "x.yondu-dh.02.cheap-shot-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    stun(chosen("enemy")),
    ifThen(arrowOn(chosen("enemy")), attack(6, chosen("enemy"))),
  ),
  "x.yondu-dh.03.fight-dirty-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    confuse(chosen("enemy")),
    ifThen(arrowOn(chosen("enemy")), attack(6, chosen("enemy"))),
  ),

  // =========================================================================
  // 04 Whistle While You Work (event)
  // =========================================================================

  // ERRATA TEXT (suggested 2026-11-11): "If the Yaka Arrow upgrade is in play, attach it to Yondu and ready Yondu and
  // the Tahlei upgrade. Otherwise, summon it and add it to your hand."
  "x.yondu-dh.04.whistle-while-you-work-action": heroAction(
    ifThen(
      exists(MY_ARROW),
      [attachCard(each(MY_ARROW), yourIdentity), ready(yourIdentity), ready(each(TAHLEI))],
      summonToHand("Yaka Arrow"),
    ),
  ),

  // =========================================================================
  // 05 Tough Motherlover (event)
  // =========================================================================

  // "Action: Give your identity a tough status card. Then, if you have the Yaka Arrow upgrade in your hand, draw a
  // card." (Observe, Luke Cage 62035, for the tough status card.)
  "x.yondu-dh.05.tough-motherlover-action": action(
    giveTough(yourIdentity),
    ifThen(valueAtLeast(zoneCountOf("hand", you, query("upgrade", { name: "Yaka Arrow" })), 1), draw(1)),
  ),

  // =========================================================================
  // 06 Twirlin' and Whirlin' (event)
  // =========================================================================

  // "You may repeat this ability for each resource you overpaid for this card." Carried by the Action below
  // (`overpaid.total`, Ant-Man 12011 / Ionic Blast 58004): the cost is 0, so every resource paid is overpaid.
  "x.yondu-dh.06.twirlin-and-whirlin-constant": constant(),
  // "Hero Action: Attach the Yaka Arrow upgrade to an enemy or to your identity." Once, then once more per overpaid
  // resource if the player says so (each repeat is its own choice of host, RRG 1.8 "For Each", p. 20).
  "x.yondu-dh.06.twirlin-and-whirlin-action": heroAction(
    ...attachArrowToEnemyOrIdentity,
    repeatTimes(
      varOf("overpaid.total"),
      chooseOne(
        option("Repeat: attach the Yaka Arrow again", ...attachArrowToEnemyOrIdentity),
        option("Do not repeat"),
      ),
    ),
  ),

  // =========================================================================
  // 07 Jackpot! (resource)
  // =========================================================================

  // "Response: After you spend this card, treat the next card you spend as if it has double the resources." Reading
  // settled with the authors: lasts until the end of the round. A lasting rule (`doubleNextCardSpent`): the first card
  // from hand you spend in a later payment generates double (every icon), and the effect is used up by it. The cards
  // spent with Jackpot! are spent at the same time (RRG 1.8 "Cost", p. 13), so none of them is "next".
  "x.yondu-dh.07.jackpot-response": response(on.youSpendThis(), applyRuleUntil(doubleNextCardSpent(), "endOfRound")),

  // =========================================================================
  // 08 Ravager Redshirts (support)
  // =========================================================================

  // "Hero Interrupt: When you would take any amount of damage from an enemy with the Yaka Arrow upgrade attached,
  // exhaust Ravager Redshirts -> prevent up to 2 of that damage." The enemy is the damage's source
  // (`eventSource`, Frost Giant 06029); partial prevention is `preventDamage(2)` (Tailblock).
  "x.yondu-dh.08.ravager-redshirts-interrupt": heroInterrupt(
    when.damage(YOUR_IDENTITY),
    { while: arrowOn(eventSource), cost: exhaustThis },
    preventDamage(2),
  ),

  // =========================================================================
  // 09 Invest (upgrade)
  // =========================================================================

  // "Hero Action: Exhaust Invest and spend 2 or more resources from your hand -> if the number of resources spent this
  // way was: 2 - attach the Yaka Arrow to an enemy or your identity. 3 - ready Yondu and the Tahlei upgrade. 4 or more
  // - draw 5 cards." X is every resource of any type paid (`resourcesX`, Nebula's Ship 16093 / Husk 47012), at least 2.
  "x.yondu-dh.09.invest-action": heroAction(
    { cost: [exhaustThis, { resourcesX: { resource: "any", bind: "x", min: 2 } }] },
    ifThen(valueEquals(varOf("x"), 2), attachArrowToEnemyOrIdentity),
    ifThen(valueEquals(varOf("x"), 3), [ready(yourIdentity), ready(each(TAHLEI))]),
    ifThen(valueAtLeast(varOf("x"), 4), draw(5)),
  ),

  // =========================================================================
  // 10 Ravage (upgrade)
  // =========================================================================

  // "Minions with a wound counter gain the fragile keyword. (Attacks against fragile characters gain overkill.)"
  // APPROXIMATION: the engine has no `fragile` keyword (DesignHacker's own), so the effect itself is scripted: attacks
  // against a minion with a wound counter gain overkill (Cruisin' for a Bruisin' 62009, `target`). Nothing else reads
  // "fragile" in this pack, so the play is the same; the minion does not show the keyword.
  "x.yondu-dh.10.ravage-constant": constant(
    attacksGainKeywords(["overkill"], { target: query("minion", { hasCounter: "wound" }) }),
  ),
  // "Hero Response: After the Yaka Arrow upgrade is attached to a minion, exhaust Ravage -> place a wound counter on
  // that minion."
  "x.yondu-dh.10.ravage-response": heroResponse(
    on.cardAttached(ARROW, { to: query("minion") }),
    { cost: exhaustThis },
    addCounters("wound", 1, eventTarget),
  ),

  // =========================================================================
  // 11 Tahlei (upgrade)
  // =========================================================================

  // "Hero Action: Exhaust Tahlei -> if the Yaka Arrow upgrade is in play, attach it to an enemy, to your identity, or
  // add it to your hand."
  "x.yondu-dh.11.tahlei-action": heroAction(
    { cost: exhaustThis },
    ifThen(
      exists(MY_ARROW),
      chooseOne(
        option(
          "Attach the Yaka Arrow to an enemy",
          { when: exists(query("enemy")) },
          chooseTarget("arrowHost", query("enemy")),
          attachCard(each(MY_ARROW), chosen("arrowHost")),
        ),
        option("Attach the Yaka Arrow to your identity", attachCard(each(MY_ARROW), yourIdentity)),
        option("Add the Yaka Arrow to your hand", moveCards(cards(each(MY_ARROW)), "hand")),
      ),
    ),
  ),

  // =========================================================================
  // 12 Yaka Arrow (upgrade)
  // =========================================================================

  // "Yaka Arrow cannot be attached to cards unless it is in play. While Yaka Arrow is attached to Yondu, he gets +1 THW
  // and +1 ATK."
  // The first sentence is `cannotBeAttachedUnlessInPlay` (author, thread 2026-05-03; ENGINE_NOTES, Yondu table): no
  // effect attaches it from a hand, a deck, a discard pile or a set-aside area, and played from hand it enters play
  // attached to nothing, in its controller's play area; only effects attach it afterwards. The stat bonus: only while
  // the host is an identity (an enemy host gets nothing; in the play area it has no host).
  "x.yondu-dh.12.yaka-arrow-constant": constant(
    cannotBeAttachedUnlessInPlay,
    gets("thw", 1, query("identity", { hostOfSelf: true })),
    gets("atk", 1, query("identity", { hostOfSelf: true })),
  ),
  // "Forced Interrupt: When attached enemy would be defeated, attach Yaka Arrow to an enemy, to your identity, or add it
  // to your hand." The enemy being defeated is not a choice (it is leaving). The interrupt moves the arrow first, so
  // it is never stranded.
  "x.yondu-dh.12.yaka-arrow-forced-interrupt": forcedInterrupt(
    on.attachedCardDefeated(),
    { while: refMatches(host, query("enemy")) },
    chooseOne(
      option(
        "Attach the Yaka Arrow to another enemy",
        { when: exists(query("enemy", { excluding: host })) },
        chooseTarget("arrowHost", query("enemy", { excluding: host })),
        attachCard(self, chosen("arrowHost")),
      ),
      option("Attach the Yaka Arrow to your identity", attachCard(self, yourIdentity)),
      option("Add the Yaka Arrow to your hand", moveCards(cards(self), "hand")),
    ),
  ),

  // =========================================================================
  // 13 Banished (obligation)
  // =========================================================================

  // "Give to the Yondu Udonta player. You may flip to alter-ego form. Choose: Exhaust your alter-ego -> remove Banished
  // from the game. / Discard the Yaka Arrow upgrade and exhaust the Tahlei upgrade. Discard this obligation."
  // Unfulfilled Destiny (18024), the shared `obligation()` shape.
  "x.yondu-dh.13.obligation": packObligation("Yondu Udonta", {
    label: "Discard the Yaka Arrow upgrade and exhaust the Tahlei upgrade. Discard this obligation",
    effects: [discard(each(MY_ARROW)), exhaust(each(TAHLEI))],
  }),

  // =========================================================================
  // 14 Price on Your Head (side scheme, nemesis)
  // =========================================================================

  // "Forced Response: After a friendly character is defeated, heal 1 damage from Sav'rkk. If Sav'rkk is not in play,
  // heal 1 damage from the villain instead." (Judge, Jury, Executioner 90002 for the friendly-defeat trigger.)
  "x.yondu-dh.14.price-on-your-head-forced-response": forcedResponse(
    on.defeated(FRIENDLY_CHARACTER),
    ifThen(exists(SAVRKK), heal(1, each(SAVRKK)), heal(1, theVillain)),
  ),

  // =========================================================================
  // 15 Sav'rkk (minion, nemesis)
  // =========================================================================

  // "Upgrades cannot be removed from Sav'rkk." Reading settled with the authors (not printed): nothing attached to him,
  // the Yaka Arrow included, can be moved, returned to hand or discarded while he is in play; it goes when he is
  // defeated. `upgradesCannotBeRemoved` (RuleSpec `cannotLeaveHost`, his upgrades): every effect's move off him is
  // refused while he is in play, and the rule ends as he leaves play, his upgrades then discarded with him (RRG 1.8
  // "Attach To", p. 8). He is still in play while "when attached enemy would be defeated" resolves (RRG 1.8 "Interrupt",
  // p. 25), so the Yaka Arrow's own Forced Interrupt cannot move the arrow off him: it is discarded with him. (The
  // README's earlier shape had the rule lapse as he is being defeated so that interrupt could move it; "while he is in
  // play" reads the other way. Listed in the README's open items for the authors.)
  "x.yondu-dh.15.savrkk-constant": constant(upgradesCannotBeRemoved()),
  // "When Revealed: Summon the Sword-Gun-Arm attachment and attach it to Sav'rkk." Attached by this effect, not
  // revealed, so its own "attach to" text is not used.
  "x.yondu-dh.15.when-revealed": whenRevealed(findCard(SWORD_GUN_ARM, { attachTo: self }, SUMMON)),

  // =========================================================================
  // 16 Sword-Gun-Arm (attachment, nemesis)
  // =========================================================================

  // "Attach to Sav'rkk. If you cannot, attach to the minion with the highest ATK." is data (`attachesTo`, `ifAble`).
  // "If you cannot, this card gains surge": Goblin Glider (02033), checked after the engine tried the data host.
  "x.yondu-dh.16.sword-gun-arm-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // "[star] Attached character's attacks gain overkill." (Stolen Sai, Elektra 60035: attacks of the host.)
  "x.yondu-dh.16.sword-gun-arm-constant-2": constant(
    attacksGainKeywords(["overkill"], { attacker: { hostOfSelf: true } }),
  ),
  // "Forced Response: When attached character has 2 or less remaining hit points, discard Sword-Gun-Arm."
  // APPROXIMATION: a standing hit point check, read after the host takes damage (the only way remaining hit points
  // drop). Not caught: it is attached to a character that already has 2 or fewer (Savage Destruction's fallback host)
  // or a hit point loss without damage. Needs a state-condition trigger to be exact (ENGINE_NOTES: treat as constant).
  "x.yondu-dh.16.sword-gun-arm-forced-response": forcedResponse(
    after.damage("host", { taken: true }),
    { while: not(valueAtLeast(remainingHpOf(host), 3)) },
    discard(self),
  ),

  // =========================================================================
  // 17 Hard to Kill (treachery, nemesis)
  // =========================================================================

  // "When Revealed: If Sav'rkk is in play, he heals 2 damage. Otherwise, summon Sav'rkk and reveal him."
  "x.yondu-dh.17.when-revealed": whenRevealed(
    ifThen(exists(SAVRKK), heal(2, each(SAVRKK)), findCard(SAVRKK, "reveal", SUMMON)),
  ),
  // "[star] Boost: The villain heals 2 damage."
  "x.yondu-dh.17.boost": boost(heal(2, theVillain)),

  // =========================================================================
  // 18 Savage Destruction (treachery, nemesis)
  // =========================================================================

  // "When Revealed: If Sav'rkk is in play, he attacks you. Otherwise, summon Sav'rkk and reveal him." He attacks you in
  // alter-ego form too (reading settled with the authors; an enemy attack never needs a hero form).
  "x.yondu-dh.18.when-revealed": whenRevealed(
    ifThen(exists(SAVRKK), enemyAttack(each(SAVRKK), { against: you }), findCard(SAVRKK, "reveal", SUMMON)),
  ),
});
