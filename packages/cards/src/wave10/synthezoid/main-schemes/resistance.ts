import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import { MAIN_SCHEMES_REGISTRATION } from "../../cw/main-schemes/registration.js";
import { MAIN_SCHEMES_RESISTANCE } from "../../cw/main-schemes/resistance.js";

const reuse = (registry: AbilityRegistry, ref: string): AbilityDefinition => {
  const definition = registry[ref];
  if (!definition) throw new Error(`Civil War main scheme script ${ref} is missing`);
  return definition;
};

/**
 * The Synthezoid Smackdown resistance main scheme (MC57, docs/phase7-synthezoid.md sections 1.5, 7.5, 8.3): two
 * stages, with A faces 57044a and 57045a. The printed text was diffed against the Civil War stages it repeats and is
 * word for word the same, so each ref reuses that stage's script (plain data) under the new id:
 *
 * 57044a Setup = 56141a.setup.
 * 57044b Protect Secret Identities = 56122b Public Outrage: hinder 2[per_hero] with more than one player on the
 *   team, and a Forced Response after step 1 of the villain phase: each player discards the top 3 cards of their deck.
 * 57045b Expose Overreach = 56124b No Going Back: allies enter play exhausted. Completing it loses the game: data
 *   (`completionLoses`), not a script.
 * 57045a has no ability.
 *
 * Cards (1):
 * - 57044a Superhero Resistance (main_scheme)
 */
export const SYNTHEZOID_MAIN_SCHEMES_RESISTANCE: AbilityRegistry = {
  "57044a.setup": reuse(MAIN_SCHEMES_RESISTANCE, "56141a.setup"),
  "57044b.protect-secret-identities-constant": reuse(MAIN_SCHEMES_REGISTRATION, "56122b.public-outrage-constant"),
  "57044b.protect-secret-identities-forced-response": reuse(
    MAIN_SCHEMES_REGISTRATION,
    "56122b.public-outrage-forced-response",
  ),
  "57045b.expose-overreach-constant": reuse(MAIN_SCHEMES_REGISTRATION, "56124b.no-going-back-constant"),
};

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const SYNTHEZOID_MAIN_SCHEMES_RESISTANCE_SKIPPED: Readonly<Record<string, string>> = {};
