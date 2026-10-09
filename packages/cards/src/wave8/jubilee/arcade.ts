import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  chooseTarget,
  chosen,
  confuse,
  constant,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterUntil,
  each,
  exists,
  hasStatus,
  identityOf,
  ifThen,
  not,
  placeThreat,
  query,
  resolveWhenDefeatedOf,
  revealCard,
  rule,
  stun,
  takeDamage,
  theMainScheme,
  varAtLeast,
  whenDefeated,
  whenRevealed,
} from "../../dsl/index.js";

const TRAP = trait("TRAP!");
const A_TRAP_SCHEME = query("sideScheme", { trait: TRAP });
/** The player who defeated the scheme, or under Elaborate Trap the player who revealed it. */
const defeater = identityOf(defeatingPlayer);

/** "Discard cards from the top of the encounter deck until a TRAP! side scheme is discarded and reveal it." */
const discardUntilTrapAndReveal = () => [discardEncounterUntil(A_TRAP_SCHEME, "found"), revealCard(chosen("found"))];

/**
 * Modular encounter set `arcade` (Jubilee pack, docs/phase7-wave8.md §7.3, §3.70, §8.4). Waits on no engine work: every
 * card is existing vocabulary, no "exists (verify)" row falls to this module.
 *
 * Hinder 1 per hero and each side scheme's threat are data. "Already stunned" and "already confused" are read before
 * the status is given, the convention of every earlier card of this shape. Arcade's Funhouse's discard is of an ally or
 * a non-permanent upgrade the defeating player controls (RRG p. 32: a permanent card is not discarded by an effect
 * that does not name it). Under Elaborate Trap "the player who defeated this side scheme" is the player who revealed it.
 *
 * Cards (5):
 * - 47030 Arcade (minion)
 * - 47031 Welcome to Murderworld (side_scheme)
 * - 47032 Arcade's Funhouse (side_scheme)
 * - 47033 Hall of Mirrors (side_scheme)
 * - 47034 Elaborate Trap (treachery)
 */
export const ARCADE: AbilityRegistry = defineAbilities({
  // Arcade — cannot take damage while a TRAP! side scheme is in play.
  "47030.arcade-constant": constant(
    rule({ kind: "cannotTakeDamage", target: query("minion", { self: true }), while: exists(A_TRAP_SCHEME) }),
  ),
  // Arcade — When Revealed: discard from the encounter deck until a TRAP! side scheme is discarded; reveal it.
  "47030.when-revealed": whenRevealed(...discardUntilTrapAndReveal()),

  // Welcome to Murderworld — When Defeated: the defeating player takes 2 damage.
  "47031.when-defeated": whenDefeated(takeDamage(2, defeatingPlayer)),

  // Arcade's Funhouse — When Defeated: the defeating player is stunned; if already stunned, they discard an ally or
  // upgrade they control.
  "47032.when-defeated": whenDefeated(
    ifThen(
      hasStatus(defeater, "stunned"),
      [
        chooseTarget(
          "pick",
          { anyOf: [query("ally"), query("upgrade", { withoutKeyword: "permanent" })], controlledBy: defeatingPlayer },
          { chooser: defeatingPlayer },
        ),
        discard(chosen("pick")),
      ],
      stun(defeater),
    ),
  ),

  // Hall of Mirrors — When Defeated: the defeating player is confused; if already confused, 2 threat on the main scheme.
  "47033.when-defeated": whenDefeated(
    ifThen(hasStatus(defeater, "confused"), placeThreat(2, theMainScheme), confuse(defeater)),
  ),

  // Elaborate Trap — When Revealed: resolve the When Defeated of each TRAP! side scheme as if you defeated it; if none
  // resolved, discard until a TRAP! side scheme and reveal it.
  "47034.when-revealed": whenRevealed(
    resolveWhenDefeatedOf(each(A_TRAP_SCHEME), { bind: "resolved" }),
    ifThen(not(varAtLeast("resolved.count")), discardUntilTrapAndReveal()),
  ),
});
