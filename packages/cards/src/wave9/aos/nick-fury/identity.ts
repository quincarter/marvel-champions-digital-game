import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  alterEgoAction,
  changeAdditionalForm,
  defineAbilities,
  each,
  forcedInterrupt,
  placeThreat,
  printedForm,
  putIntoPlayFromSetAside,
  query,
  response,
  setup,
  when,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../../dsl/index.js";

/** "Your suit form upgrade": the Assault / Stealth upgrade (50035a/b) this player controls, whichever face shows. */
export const YOUR_SUIT_FORM = each(query("upgrade", { ...printedForm("suit"), controller: "you" }));

/**
 * Wave 9 scripting module `aos/nick-fury/identity` (docs/phase7-wave9.md section 8.4, 3.7, 3.8).
 *
 * Cards (1):
 * - 50034a Nick Fury (hero_identity) / 50034b Nick Fury (alter ego)
 *
 * **50034a (hero face)**: "Gather Intel - Response: After Nick Fury makes a basic thwart, place 1 threat on your suit
 * form upgrade." Optional, and only for a basic thwart by his identity (not an ally's, not a thwart event). The threat
 * is a token on a card that is not a scheme (section 3.7). "Break Cover - Forced Interrupt: When you attack, change to
 * Assault suit form." Fires on a basic attack and on an attack event, before the attack's own interrupts, so Assault's
 * "When you attack" is offered afterwards. A change to the form already showing changes nothing (RRG 1.8 "Form, Change
 * Form", p. 21; MC50 p. 3: it is not the once-per-turn hero/alter-ego flip).
 *
 * **50034b (alter-ego face)**: "Suit Up - Setup: Put your suit form upgrade into play, Assault side faceup." The
 * upgrade is Permanent, so it was set aside before setup (RRG 1.8 "Permanent", p. 32) and is taken from there.
 * "Infiltrate - Action: Change to Stealth suit form." Free, no limit; with Stealth already showing it changes nothing.
 */
export const NICK_FURY_IDENTITY: AbilityRegistry = defineAbilities({
  "50034a.star-gather-intel": response(after.thwarts(YOUR_IDENTITY, { basic: true }), placeThreat(1, YOUR_SUIT_FORM)),
  "50034a.break-cover": forcedInterrupt(
    when.attacks(YOUR_IDENTITY),
    changeAdditionalForm("suit", { toName: "Assault" }),
  ),

  "50034b.suit-up": setup(
    putIntoPlayFromSetAside("suit", query("upgrade", { name: "Assault" }), { attachTo: yourIdentity }),
  ),
  "50034b.infiltrate": alterEgoAction(changeAdditionalForm("suit", { toName: "Stealth" })),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const NICK_FURY_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
