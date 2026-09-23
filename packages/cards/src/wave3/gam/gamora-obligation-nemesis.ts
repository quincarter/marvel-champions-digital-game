import { trait } from "@mc/content";
import {
  anyOf,
  blanksTextBox,
  confuse,
  constant,
  dealEncounterCard,
  defineAbilities,
  discard,
  discardFromHand,
  discardFromHandCost,
  controllerOf,
  each,
  forcedInterrupt,
  forcedResponse,
  hasStatus,
  heroAction,
  ifThen,
  on,
  otherPlayers,
  query,
  rule,
  self,
  stun,
  surge,
  takeDamageCost,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

const ATTACK = trait("ATTACK");
/**
 * Gamora's identity, whoever controls it. An identity query, not `named("Gamora")`: `named` returns the first card
 * in play with that title, which can be Drax's Gamora ally (19020) at another seat. Both of Gamora's faces are titled
 * "Gamora", so this matches her in either form.
 */
const GAMORA = each(query("identity", { name: "Gamora" }));
/** Gamora's own player, however this ability's card came to be in play (an obligation, a side scheme, a nemesis
 * minion, an attachment on her identity). */
const GAMORA_PLAYER = controllerOf(GAMORA);

/**
 * Unfulfilled Destiny (18024), Gamora's obligation, and her nemesis set: Sibling Rivalry (18025), Nebula (18026,
 * the nemesis minion — distinct from the Nebula ally, 18002, and the Nebula villain, `gmw` 16088–16090; docs/
 * phase7-wave3.md §2.1's "same title, different cards"), In a Bind (18027), Waylay ×2 (18028).
 */
export const GAMORA_OBLIGATION_NEMESIS = defineAbilities({
  // Unfulfilled Destiny — Give to the Gamora player. You may flip to alter-ego form. Choose:
  // • Exhaust your alter-ego → remove Unfulfilled Destiny from the game.
  // • Choose and discard 2 events from your hand. Discard this obligation.
  "18024.obligation": obligation("Gamora", {
    label: "Choose and discard 2 events from your hand",
    effects: [discardFromHand(2, you, { filter: query("event") })],
  }),

  // Sibling Rivalry — Players other than Gamora cannot remove threat from Sibling Rivalry. docs/phase7-wave3.md
  // §3.26: `RuleSpec threatCannotBeRemoved`'s new `player` field scopes the restriction to everyone but the Gamora
  // player, rather than blocking every removal outright (the shape every earlier use of this rule needed).
  "18025.sibling-rivalry-constant": constant(
    rule({ kind: "threatCannotBeRemoved", target: { self: true }, player: otherPlayers(GAMORA_PLAYER) }),
  ),
  // Sibling Rivalry — Forced Response: After the villain phase begins, deal 1 facedown encounter card to Gamora.
  "18025.sibling-rivalry-forced-response": forcedResponse(
    on.phaseBeginning("villain"),
    dealEncounterCard(GAMORA_PLAYER),
  ),

  // Nebula (nemesis minion) — Retaliate 2 (data). Forced Interrupt: When this minion would enter play, discard the
  // Nebula ally from play. (Gamora's nemesis minion.) docs/phase7-wave2.md §3.13.10: `cardEntersPlay` is
  // interruptible, so the ally is gone before the minion's own enter-play keywords (and the ally limit) ever see it.
  "18026.nebula-forced-interrupt": forcedInterrupt(
    on.entersPlay("self"),
    discard(each(query("ally", { name: "Nebula" }))),
  ),

  // In a Bind — Attach to Gamora. Treat Gamora's printed text box as if it were blank (except for traits).
  // docs/phase7-wave2.md §8's `blanksTextBox`, targeted at this attachment's own host.
  "18027.in-a-bind-constant": constant(blanksTextBox({ hostOfSelf: true })),
  // In a Bind — Hero Action: Choose and discard an attack event from your hand and deal 1 damage to Gamora →
  // discard this card.
  "18027.in-a-bind-action": heroAction(
    { cost: [discardFromHandCost(1, 1, undefined, query("event", { trait: ATTACK })), takeDamageCost(1)] },
    discard(self),
  ),

  // Waylay — When Revealed: Stun and confuse Gamora. If Gamora is already stunned or confused, this card gains
  // surge. "Already" is read before this reveal's own stun/confuse are applied.
  "18028.when-revealed": whenRevealed(
    ifThen(anyOf(hasStatus(GAMORA, "stunned"), hasStatus(GAMORA, "confused")), surge()),
    stun(GAMORA),
    confuse(GAMORA),
  ),
});
