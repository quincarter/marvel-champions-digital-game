import { trait } from "@mc/content";
import type { EventPattern } from "@mc/engine";
import {
  attachCard,
  boost,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defeatingPlayer,
  defineAbilities,
  discardEncounterUntil,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  enemyAttack,
  enemyScheme,
  eventTarget,
  exists,
  firstPlayer,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gets,
  giveTough,
  ifThen,
  isAttached,
  modifyAttack,
  moveCards,
  not,
  on,
  putIntoPlay,
  query,
  selectCards,
  self,
  setup,
  stun,
  surge,
  theVillain,
  thatPlayer,
  valueEquals,
  varOf,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  type EffectArg,
} from "../../dsl/index.js";

const SENTINEL = trait("SENTINEL");
const SENTINEL_MINION = query("minion", { trait: SENTINEL });
const SENTINEL_ENEMY = query("enemy", { trait: SENTINEL });
const MINIONS_ENGAGED_WITH_YOU = query("minion", { engagedWith: "you" });
const HOST_MINION = query("minion", { hostOfSelf: true });

/** "Each [Sentinel] minion gains guard." (Both stages of the main scheme.) */
const sentinelsGainGuard = () => constant(gainsKeyword({ name: "guard" }, SENTINEL_MINION));

/** "Discard cards from the encounter deck until a [Sentinel] minion is discarded, then put it into play engaged with
 * `player`" (`wave4/mts/ebony-maw.ts`'s Spell version): nothing is put into play when the deck has none. */
const sentinelIntoPlayFor = (player: Parameters<typeof putIntoPlay>[1]): EffectArg[] => [
  discardEncounterUntil(SENTINEL_MINION, "sentinel"),
  putIntoPlay(chosen("sentinel"), player),
];
/** "Each player discards cards from the encounter deck until they discard a [Sentinel] minion, then puts it into play
 * engaged with them." */
const eachPlayerSentinel = () => forEachPlayer(eachPlayer, ...sentinelIntoPlayFor(thatPlayer));

/**
 * "[star] Forced Interrupt: When Master Mold schemes against you, discard cards from the encounter deck until a
 * [Sentinel] minion is discarded. Put that minion into play engaged with you. Do not give Master Mold a boost card for
 * this activation." (Identical on all three stages.) "Schemes against you" is the scheme activation only (not the
 * attack, which `on.enemyActivates` would also match): the scheme's player is the player it is against. The interrupt
 * rides the activation in progress, so `modifyAttack.noBoost` (docs/phase7-wave6.md §3.15) withholds its boost card;
 * the minion that enters play activates as normal after Master Mold (MC32 p. 12).
 */
const masterMoldSchemesAgainstYou: EventPattern = {
  ...on.enemySchemes("self"),
  playerIs: "controller",
} as EventPattern;
const masterMoldForcedInterrupt = () =>
  forcedInterrupt(masterMoldSchemesAgainstYou, ...sentinelIntoPlayFor(you), modifyAttack({ noBoost: true }));

/**
 * The Master Mold scenario's own encounter set (`mut_gen` 32109-32120, MC32 p. 12, docs/phase7-wave6.md §2.2): the
 * villain Master Mold (32109-32111), the main scheme The Sentinel Factory / Master Mold's Agenda (32112a/b, 32113a/b),
 * Sentinel Mark VIII, the Unit Upgrade and Stun Beam attachments, Master Mold's Children and Shields Up, and the Intruder
 * Alert! and Insert Virus Program side schemes. Not the Sentinels or Zero Tolerance modular sets.
 *
 * **Magneto (172B)** belongs to the campaign set (`mut_gen_campaign`), not to this one, so his own text is not scripted
 * here. 32112a's Setup only puts him into play under the first player's control from the set-aside area (the scenario
 * builder passes him through `setAsideCardIds`).
 */
export const MASTER_MOLD_ABILITIES = defineAbilities({
  "32109.master-mold-forced-interrupt": masterMoldForcedInterrupt(),
  "32110.master-mold-forced-interrupt": masterMoldForcedInterrupt(),
  "32111.master-mold-forced-interrupt": masterMoldForcedInterrupt(),

  // The Sentinel Factory 1A — Setup: Put the Magneto ally (172B) into play under the first player's control.
  "32112a.setup": setup(
    // One copy: in the campaign both the scenario's `setAsideCardIds` and the composed `mut_gen_campaign` set hold him.
    selectCards("magneto", encounterSetAside(query("ally", { name: "Magneto" }), { random: 1 })),
    putIntoPlay(chosen("magneto"), firstPlayer),
  ),
  // 1B — Each [Sentinel] minion gains guard. When Revealed: each player discards until a Sentinel minion, puts it into
  // play engaged with them.
  "32112b.the-sentinel-factory-constant": sentinelsGainGuard(),
  "32112b.when-revealed": whenRevealed(eachPlayerSentinel()),
  // Master Mold's Agenda 2A — When Revealed: Shuffle the encounter discard pile into the encounter deck. Then as 1B.
  "32113a.when-revealed": whenRevealed(
    moveCards(encounterCards(["discard"]), "encounterDeckShuffle"),
    eachPlayerSentinel(),
  ),
  // 2B — Each [Sentinel] minion gains guard. (If this stage is completed, the players lose: data.)
  "32113b.master-molds-agenda-constant": sentinelsGainGuard(),

  // Sentinel Mark VIII (32114) — Forced Response: After this minion engages you, attach the topmost Sentinel
  // attachment from the discard pile to this minion (the encounter discard pile: only encounter cards are attachments).
  "32114.sentinel-mark-viii-forced-response": forcedResponse(
    { on: "minionEngaged", selfIs: "source" },
    selectCards(
      "sentinel",
      encounterCards(["discard"], query("attachment", { trait: SENTINEL }), { topmostOnly: true }),
    ),
    attachCard(chosen("sentinel"), self),
  ),

  // Unit Upgrade (32115) — Attach to a Sentinel minion (data). Otherwise, this card gains surge. (The data names the
  // surge sentence "-constant", as Razor Claws', `wave5/sm/spider-man-morales/obligation-nemesis.ts`.)
  "32115.unit-upgrade-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // Attached minion gets +2 hit points and gains retaliate 1 (+1 SCH / +1 ATK are data).
  "32115.unit-upgrade-constant-2": constant(
    gets("hp", 2, HOST_MINION),
    gainsKeyword({ name: "retaliate", value: 1 }, HOST_MINION),
  ),
  // [star] Boost: Attach to a Sentinel minion.
  "32115.boost": boost(chooseTarget("host", SENTINEL_MINION), attachCard(self, chosen("host"))),

  // Stun Beam (32116) — Attach to a Sentinel minion without Stun Beam attached (data). Otherwise, this card gains surge.
  "32116.stun-beam-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // [star] Forced Response: After attached minion attacks and damages a character, stun that character.
  "32116.stun-beam-forced-response": forcedResponse(on.enemyAttacks("host", { damages: true }), stun(eventTarget)),

  // Master Mold's Children (32117) — When Revealed (Alter-Ego): Each minion engaged with you schemes. If you are not
  // engaged with a minion, Master Mold schemes.
  "32117.when-revealed-alter-ego": whenRevealedAlterEgo(
    ifThen(
      exists(MINIONS_ENGAGED_WITH_YOU),
      enemyScheme(each(MINIONS_ENGAGED_WITH_YOU), { against: you }),
      enemyScheme(theVillain, { against: you }),
    ),
  ),
  // When Revealed (Hero): Each minion engaged with you attacks you. If you are not engaged with a minion, Master Mold
  // attacks you.
  "32117.when-revealed-hero": whenRevealedHero(
    ifThen(
      exists(MINIONS_ENGAGED_WITH_YOU),
      enemyAttack(each(MINIONS_ENGAGED_WITH_YOU), { against: you }),
      enemyAttack(theVillain, { against: you }),
    ),
  ),

  // Shields Up (32118) — When Revealed: Give each [Sentinel] minion engaged with you a tough status card. Otherwise,
  // this card gains surge. "Otherwise" = none was given (a minion already tough takes none: `<bind>.amount`,
  // `wave4/hood/wrecking-crew.ts` Magic Muscle, docs/phase7-wave4.md §3.60).
  "32118.when-revealed": whenRevealed(
    giveTough(each(query("minion", { trait: SENTINEL, engagedWith: "you" })), { bind: "given" }),
    ifThen(valueEquals(varOf("given.amount"), 0), surge()),
  ),
  // [star] Boost: Give the villain a tough status card.
  "32118.boost": boost(giveTough(theVillain)),

  // Intruder Alert! (32119) — When Defeated: The player who defeated this scheme discards cards from the encounter deck
  // until they discard a Sentinel minion, then puts it into play engaged with them.
  "32119.when-defeated": whenDefeated(...sentinelIntoPlayFor(defeatingPlayer)),

  // Insert Virus Program (32120) — Hinder 2[per_hero]. Victory 1 (data). When Defeated: Deal 2 damage to each Sentinel enemy.
  "32120.when-defeated": whenDefeated(dealDamage(2, each(SENTINEL_ENEMY))),
});
