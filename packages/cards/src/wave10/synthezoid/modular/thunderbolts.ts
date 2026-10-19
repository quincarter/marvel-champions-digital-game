import type { AbilityRegistry } from "@mc/engine";
import { trait } from "@mc/content";
import {
  boost,
  chooseTarget,
  chosen,
  confuse,
  constant,
  dealDamage,
  defineAbilities,
  each,
  enemyActivates,
  enemyLeader,
  exists,
  firstPlayer,
  ifThen,
  query,
  refCount,
  rule,
  stun,
  valueAtLeast,
  whenRevealed,
  yourIdentity,
  yourLeader,
  you,
} from "../../../dsl/index.js";

const MINION = query("minion");
const THUNDERBOLT_MINION = query("minion", { trait: trait("THUNDERBOLT") });

/**
 * "[Effect] your leader. Otherwise, [effect] you." An ability that refers to "your leader" cannot be resolved in a
 * cooperative game, where the "Otherwise" sentence resolves instead (MC57 p. 4; RRG 1.8 "Otherwise", p. 31). The
 * leader is read, not the game mode, as Luke Cage and Jessica Jones (`wave10/cw/modular/defenders.ts`) do.
 */
const stunYourLeaderOtherwiseYou = ifThen(valueAtLeast(refCount(yourLeader), 1), stun(yourLeader), stun(yourIdentity));
const confuseYourLeaderOtherwiseYou = ifThen(
  valueAtLeast(refCount(yourLeader), 1),
  confuse(yourLeader),
  confuse(yourIdentity),
);
/**
 * "Deal N damage to a character you control." Nothing says "choose", so with several characters the first player
 * selects (RRG 1.8 "First Player", p. 19).
 */
const damageCharacterYouControl = (n: number) => [
  chooseTarget("hit", query("character", { controller: "you" }), { chooser: firstPlayer }),
  dealDamage(n, chosen("hit")),
];
const damageYourLeaderOtherwiseCharacter = (leaderDamage: number, otherwise: number) =>
  ifThen(
    valueAtLeast(refCount(yourLeader), 1),
    dealDamage(leaderDamage, yourLeader),
    damageCharacterYouControl(otherwise),
  );

/**
 * Modular set `thunderbolts_modular` (Registration side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section
 * 7.3). Hinder 1[per_hero] on The Thunderbolts is a data keyword. Every "your leader" sentence resolves its "Otherwise"
 * in a cooperative game (see `stunYourLeaderOtherwiseYou`); "you" in a Boost is the defending player.
 *
 * **Atlas (57017)**, **Songbird (57018)**: When Revealed and Boost: stun (confuse) your leader, otherwise you are
 * stunned (confused).
 *
 * **Penance (57019)**: When Revealed: 2 damage to your leader, otherwise 2 damage to a character you control. Boost:
 * 2 damage to your leader, otherwise 1 damage to a character you control.
 *
 * **Justice Like Lightning (57020)** (docs/phase7-synthezoid.md M8): each minion activates against the player it is
 * engaged with; otherwise (no minion in play) the enemy leader activates against you. No boost card is given for these
 * activations: `enemyActivates(..., { noBoost: true })`, the engine's existing option (the M8 gap was only a search
 * miss). Same text and shape as Street Defenders (`STREET_DEFENDERS` in `defenders.ts`); written here rather than
 * imported so this module has no dependency on the Civil War sets.
 *
 * **The Thunderbolts (57021)**: threat cannot be removed from this scheme while a Thunderbolt minion is in play (every
 * removal is stopped, RRG 1.8 "'Cannot'", p. 11).
 *
 * Cards (5):
 * - 57017 Atlas (minion)
 * - 57018 Songbird (minion)
 * - 57019 Penance (minion)
 * - 57020 Justice Like Lightning (treachery)
 * - 57021 The Thunderbolts (side_scheme)
 */
export const SYNTHEZOID_MODULAR_THUNDERBOLTS: AbilityRegistry = defineAbilities({
  "57017.when-revealed": whenRevealed(stunYourLeaderOtherwiseYou),
  "57017.boost": boost(stunYourLeaderOtherwiseYou),

  "57018.when-revealed": whenRevealed(confuseYourLeaderOtherwiseYou),
  "57018.boost": boost(confuseYourLeaderOtherwiseYou),

  "57019.when-revealed": whenRevealed(damageYourLeaderOtherwiseCharacter(2, 2)),
  "57019.boost": boost(damageYourLeaderOtherwiseCharacter(2, 1)),

  "57020.when-revealed": whenRevealed(
    ifThen(
      exists(MINION),
      enemyActivates(each(MINION), { noBoost: true }),
      enemyActivates(enemyLeader, { against: you, noBoost: true }),
    ),
  ),

  "57021.the-thunderbolts-constant": constant(
    rule({ kind: "threatCannotBeRemoved", target: { self: true }, while: exists(THUNDERBOLT_MINION) }),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_THUNDERBOLTS_SKIPPED: Readonly<Record<string, string>> = {};
