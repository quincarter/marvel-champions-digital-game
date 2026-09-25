import {
  attacksGainKeywords,
  boost,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  dealDamage,
  defineAbilities,
  discard,
  each,
  exists,
  ifThen,
  moveCards,
  query,
  removeCountersFrom,
  surge,
  undefendedAttack,
  valueAtMost,
  valueEquals,
  varOf,
  whenDefeated,
  whenRevealed,
  yourIdentity,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

/**
 * Equipment Malfunction (23028), War Machine's obligation, and his nemesis set: Living Laser (23029), Deadly Light
 * Show (23030), Laser Strike ×3 (23031).
 */
export const WAR_MACHINE_OBLIGATION_NEMESIS = defineAbilities({
  // Equipment Malfunction — Give to the James Rhodes player. You may flip to your alter-ego form. Choose:
  // • Exhaust James Rhodes → remove Equipment Malfunction from the game.
  // • Remove all ammo counters from your identity. If 2 or fewer ammo counters were removed this way, this card
  //   gains surge. Discard this obligation.
  // "If 2 or fewer were removed" is read *before* the removal (removing "all" always removes however many are
  // there), so the condition and the removal are two independent effects in sequence rather than needing a bind on
  // `removeCounters` (which the engine doesn't expose — `EffectSpec.removeCounters` has no `bind` field, unlike
  // `addCounters`).
  "23028.obligation": obligation("James Rhodes", {
    label: "Remove all ammo counters from your identity",
    effects: [
      ifThen(valueAtMost(countersOn(yourIdentity, "ammo"), 2), surge()),
      removeCountersFrom(yourIdentity, "ammo", countersOn(yourIdentity, "ammo")),
    ],
  }),

  // Living Laser (nemesis minion, 23029) — Quickstrike (data). [star] Living Laser's attacks gain piercing. (War
  // Machine's nemesis minion, parenthetical is flavor text, not scripted.) The [star] marker is a print-layout cue
  // (it also labels this text as the minion's own boost-icon reminder), not extra game logic: the ability is a
  // plain constant, the same as Kidpool's/Wolverine's identical "[star] <name>'s attacks gain piercing." printings.
  "23029.living-laser-constant": constant(
    attacksGainKeywords(["piercing"], { attacker: query("minion", { self: true }) }),
  ),

  // Deadly Light Show (side scheme, 23030) — Hinder 1[per_hero] (data). When Defeated: Deal 1 damage to each
  // identity.
  "23030.when-defeated": whenDefeated(dealDamage(1, each(query("identity")))),

  // Laser Strike (treachery ×3, 23031) — When Revealed: Discard an upgrade you control. If you cannot, this card
  // gains surge.
  "23031.when-revealed": whenRevealed(
    chooseCards("discarded", cards(each(query("upgrade", { controller: "you" }))), { min: 0, max: 1 }),
    moveCards(cards(chosen("discarded")), "discard", "moved"),
    ifThen(valueEquals(varOf("moved.count"), 0), surge()),
  ),
  // Laser Strike — [star] Boost: If this resolves during an undefended attack, discard an upgrade you control. The
  // Hydra Flame-Soldier boost shape (`wave2/trors/red-skull.ts`), "upgrade" in place of "support".
  "23031.boost": boost(
    ifThen(undefendedAttack, [
      chooseTarget("upgrade", query("upgrade", { controller: "you" })),
      ifThen(exists(query("upgrade", { controller: "you" })), discard(chosen("upgrade"))),
    ]),
  ),
});
