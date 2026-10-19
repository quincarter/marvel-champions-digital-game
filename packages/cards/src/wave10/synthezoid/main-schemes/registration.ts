import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import { MAIN_SCHEMES_REGISTRATION } from "../../cw/main-schemes/registration.js";
import { MAIN_SCHEMES_RESISTANCE } from "../../cw/main-schemes/resistance.js";

const reuse = (registry: AbilityRegistry, ref: string): AbilityDefinition => {
  const definition = registry[ref];
  if (!definition) throw new Error(`Civil War main scheme script ${ref} is missing`);
  return definition;
};

/**
 * The Synthezoid Smackdown registration main scheme (MC57, docs/phase7-synthezoid.md sections 1.5, 7.5, 8.3): two
 * stages, with A faces 57005a and 57006a. The printed text was diffed against the Civil War stages it repeats and is
 * the same (57006b reworded, same meaning), so each ref reuses that stage's script (plain data) under the new id:
 *
 * 57005a Setup = 56063a.setup (the A faces repeat Civil War's; the competitive sentence stays a marker).
 * 57005b Enforce the Law: hinder 2[per_hero] with more than one player on the team (the constant all four Civil War
 *   stage 1s print, read from 56063b) and the enemy leader gains steady (the text of 56200b Going Underground).
 * 57006b Mighty Avengers = 56142b Secret Avengers: the enemy leader gets +1 ATK while attacking, +2 when undefended.
 *   Completing it loses the game: data (`completionLoses`), not a script.
 * 57006a has no ability.
 *
 * Cards (1):
 * - 57005a Superhero Registration Act (main_scheme)
 */
export const SYNTHEZOID_MAIN_SCHEMES_REGISTRATION: AbilityRegistry = {
  "57005a.setup": reuse(MAIN_SCHEMES_REGISTRATION, "56063a.setup"),
  "57005b.enforce-the-law-constant": reuse(MAIN_SCHEMES_REGISTRATION, "56063b.cut-off-support-constant"),
  "57005b.enforce-the-law-constant-2": reuse(MAIN_SCHEMES_RESISTANCE, "56200b.going-underground-constant-2"),
  "57006b.mighty-avengers-constant": reuse(MAIN_SCHEMES_RESISTANCE, "56142b.secret-avengers-constant"),
};

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const SYNTHEZOID_MAIN_SCHEMES_REGISTRATION_SKIPPED: Readonly<Record<string, string>> = {};
