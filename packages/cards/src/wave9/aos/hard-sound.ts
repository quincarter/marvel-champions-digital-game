import type { AbilityRegistry } from "@mc/engine";
import {
  andThen,
  boost,
  constant,
  defineAbilities,
  discard,
  enemyActivates,
  eventAmount,
  find,
  forcedInterrupt,
  ifThen,
  instead,
  isStunned,
  losesKeyword,
  modifyAttack,
  named,
  not,
  on,
  query,
  removeThreat,
  revealCard,
  self,
  stun,
  surge,
  varAtLeast,
  whenRevealed,
  yourIdentity,
  you,
} from "../../dsl/index.js";

const SONGBIRD = "Songbird";
/** The enemy a Solid Sound Constructs is attached to ("attached enemy"). */
const HOST_ENEMY = query("enemy", { hostOfSelf: true });

/**
 * Modular encounter set `hard_sound` (Agents of S.H.I.E.L.D., a Thunderbolt set; docs/phase7-wave9.md sections 3.25,
 * 3.33, 3.35). Villainous and Victory 1 are data keywords; so are Solid Sound Constructs' amplify icon and its
 * "Attach to Songbird. Otherwise, attach to the villain."
 *
 * **Songbird (50143)**: Forced Interrupt: when she activates (an attack or a scheme), she gets 1 additional boost card
 * for that activation, `modifyAttack({ extraBoostCards: 1 })` (the validator refuses `giveBoostCard` in an interrupt
 * of an activation, which is a card dealt for the next one).
 *
 * **Solid Sound Constructs (50144)**: the attached enemy loses stalwart (`losesKeyword`, so it beats a printed or
 * granted stalwart), and when it would gain a confused or stunned status card this card is discarded instead
 * (`on.wouldGainStatus`, interrupt only). A give the enemy has no room for opens no window, which is why the card
 * prints "loses stalwart": with stalwart the enemy would be immune and the attachment would never go.
 *
 * **Hard Sound Bindings (50145)**: attached to a player's identity. Forced Interrupt: when that identity would attack,
 * the attack is replaced: discard this card, then the identity is stunned. Boost: the player's identity is stunned; if
 * it already was, the activating enemy gets an additional boost card for this activation.
 *
 * **Sonic Bubble (50146)**: Forced Interrupt: when any amount of damage would be dealt to an enemy, the same amount of
 * threat is removed from here instead (all of the damage, even when less threat is here; the scheme is defeated at 0).
 *
 * **Hard Sound (50147)**: finds and reveals Songbird (when in play she engages the revealing player), who activates
 * against that player; surge when nobody activated. Boost: the activating enemy gets an additional boost card.
 *
 * Cards (5):
 * - 50143 Songbird (minion)
 * - 50144 Solid Sound Constructs (attachment)
 * - 50145 Hard Sound Bindings (attachment)
 * - 50146 Sonic Bubble (side_scheme)
 * - 50147 Hard Sound (treachery)
 */
export const HARD_SOUND: AbilityRegistry = defineAbilities({
  "50143.songbird-forced-interrupt": forcedInterrupt(on.enemyActivates("self"), modifyAttack({ extraBoostCards: 1 })),

  "50144.solid-sound-constructs-constant": constant(losesKeyword({ name: "stalwart" }, HOST_ENEMY)),
  "50144.solid-sound-constructs-forced-interrupt": forcedInterrupt(
    on.wouldGainStatus("host", ["confused", "stunned"]),
    { would: true },
    instead(discard(self)),
  ),

  "50145.hard-sound-bindings-forced-interrupt": forcedInterrupt(
    on.attacks("host"),
    { would: true },
    instead(discard(self), andThen(stun(yourIdentity))),
  ),
  "50145.boost": boost(ifThen(isStunned(yourIdentity), modifyAttack({ extraBoostCards: 1 })), stun(yourIdentity)),

  "50146.sonic-bubble-forced-interrupt": forcedInterrupt(
    on.damage(query("enemy")),
    instead(removeThreat(eventAmount, self)),
  ),

  "50147.when-revealed": whenRevealed(
    revealCard(find(query("minion", { name: SONGBIRD })), you),
    enemyActivates(named(SONGBIRD), { against: you, bind: "activated" }),
    ifThen(not(varAtLeast("activated.made")), surge()),
  ),
  "50147.boost": boost(modifyAttack({ extraBoostCards: 1 })),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const HARD_SOUND_SKIPPED: Readonly<Record<string, string>> = {};
