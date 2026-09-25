import { trait } from "@mc/content";
import type { PlayerRef } from "@mc/engine";
import {
  chosen,
  dealDamage,
  defineAbilities,
  discard,
  each,
  named,
  enemyAttack,
  enemyScheme,
  encounterCards,
  eventAmount,
  exists,
  forcedInterrupt,
  giveTough,
  ifThen,
  modifyAttack,
  on,
  oneCopyOf,
  preventDamage,
  putIntoPlay,
  query,
  removeThreat,
  searchAndReveal,
  self,
  selectCards,
  shuffleEncounterDeck,
  surge,
  whenDefeated,
  whenRevealed,
  you,
} from "../../dsl/index.js";

/** The Mister Hyde modular set (`hood` 24033-24036, docs/phase7-wave4.md §2.3): Self-Experimentation, Calvin Zabo,
 * Mister Hyde and Hyde Formula — a searched-minion pair whose two halves reference each other by name.
 *
 * "Mister Hyde attacks you with +2 ATK. That attack gains overkill" (24034) is `enemyAttack(...)` then
 * `modifyAttack(...)` as sibling effects — the same shape `wave1/twc/piledriver.ts` uses (referenced approvingly by
 * `mts/thanos.ts`'s own docblock) for "X attacks. That attack gains Y" where the attack is newly initiated, not
 * retargeted. */

const BRUTE = trait("BRUTE");
const MISTER_HYDE = { name: "Mister Hyde" };
const CALVIN_ZABO = { name: "Calvin Zabo" };

/** "Search the encounter deck and discard pile for Mister Hyde and put him into play engaged with `player`.
 * (Shuffle.)" */
const searchAndPutHydeInto = (player: PlayerRef) => [
  selectCards("hyde", oneCopyOf(encounterCards(["deck", "discard"], { name: "Mister Hyde" }))),
  putIntoPlay(chosen("hyde"), player),
  shuffleEncounterDeck(),
];

export const MISTER_HYDE_SET = defineAbilities({
  // Self-Experimentation (24033, side scheme) — When Revealed: search the encounter deck and discard pile for
  // Mister Hyde and reveal him. (Shuffle.) Forced Interrupt: when a Brute enemy would take any amount of damage,
  // remove that much threat from this scheme instead.
  "24033.when-revealed": whenRevealed(...searchAndReveal("Mister Hyde")),
  "24033.self-experimentation-forced-interrupt": forcedInterrupt(
    on.damage(query("enemy", { trait: BRUTE })),
    preventDamage(),
    removeThreat(eventAmount, self),
  ),

  // Calvin Zabo (24034, minion; ELITE/MASTERS OF EVIL are data) — When Revealed: if Mister Hyde is in play, discard
  // this card → Mister Hyde attacks you with +2 ATK; that attack gains overkill. When Defeated: search the
  // encounter deck and discard pile for Mister Hyde and put him into play engaged with the player who was engaged
  // with Calvin Zabo.
  "24034.when-revealed": whenRevealed(
    ifThen(exists(query("minion", MISTER_HYDE)), [
      discard(self),
      enemyAttack(named("Mister Hyde"), { atkBonus: 2 }),
      modifyAttack({ overkill: true }),
    ]),
  ),
  "24034.when-defeated": whenDefeated(...searchAndPutHydeInto(you)),

  // Mister Hyde (24035, minion; BRUTE/ELITE/MASTERS OF EVIL are data) — When Revealed: if Calvin Zabo is engaged
  // with a player, discard Calvin Zabo → Mister Hyde engages that player; give Mister Hyde a tough status card and
  // deal 1 damage to each hero and ally in play.
  "24035.when-revealed": whenRevealed(
    ifThen(exists(query("minion", { ...CALVIN_ZABO, engagedWith: "any" })), [
      discard(named("Calvin Zabo")),
      giveTough(self),
      dealDamage(1, each(query(["identity", "ally"]))),
    ]),
  ),

  // Hyde Formula (24036, treachery) — When Revealed: if Calvin Zabo is in play, he schemes with +3 SCH, then takes
  // 4 damage. If Mister Hyde is in play, give him a tough status card and he attacks you (even in alter-ego form —
  // `enemyAttack` is a scripted effect, not gated on the player's own form). If neither is in play, this card
  // gains surge.
  "24036.when-revealed": whenRevealed(
    ifThen(
      exists(query("minion", CALVIN_ZABO)),
      [enemyScheme(named("Calvin Zabo"), { schBonus: 3 }), dealDamage(4, named("Calvin Zabo"))],
      ifThen(
        exists(query("minion", MISTER_HYDE)),
        [giveTough(named("Mister Hyde")), enemyAttack(named("Mister Hyde"))],
        surge(),
      ),
    ),
  ),
});
