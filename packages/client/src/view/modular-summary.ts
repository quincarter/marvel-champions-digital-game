/**
 * What a scenario says about its modular sets in words (MojoMania, docs/phase7-wave6.md §3.63): a scenario with a
 * `modularSetPool` draws its genre sets at random, and Mojo sets some aside instead of shuffling any in. Its
 * `recommendedModularSetIds` is the whole pool, so naming the first of them ("Crime") says nothing true. Pure text
 * over `Scenario`'s own counts: no rules here, the engine's setup decides what really happens.
 */
import { setAsideModularSetCountFor, type Scenario } from "@mc/content";

const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** A scenario that sets modular sets aside and shuffles none in at the start (Mojo): 1B brings one of them in at setup. */
export function setAsideJoinsAtSetup(scenario: Scenario): boolean {
  return (
    scenario.modularSetPool !== undefined &&
    (scenario.modularSetCount ?? 1) === 0 &&
    setAsideModularSetCountFor(scenario, 1) > 0
  );
}

/** A pooled scenario's modular sets as one phrase for Scenario select, null for every other scenario. */
export function pooledModularSummary(scenario: Scenario): string | null {
  if (!scenario.modularSetPool) return null;
  const count = scenario.modularSetCount ?? 1;
  if (count > 0) return `${plural(count, "random genre set")}`;
  const aside = scenario.setAsideModularSetCount;
  if (aside === undefined) return "No modular sets";
  if (typeof aside === "number") return `${plural(aside, "genre set")} set aside`;
  return aside.perPlayer > 0
    ? `${plural(aside.base, "genre set")} + ${aside.perPlayer} per hero set aside`
    : `${plural(aside.base, "genre set")} set aside`;
}

/**
 * A pooled scenario's modular sets in a few words for a narrow cell (Scenario select's stat strip), null when the
 * full `pooledModularSummary` already says it briefly or the scenario isn't pooled. The detail panel keeps the full wording.
 */
export function pooledModularShortSummary(scenario: Scenario): string | null {
  if (!scenario.modularSetPool) return null;
  if ((scenario.modularSetCount ?? 1) > 0) return pooledModularSummary(scenario);
  return scenario.setAsideModularSetCount === undefined ? "No modular sets" : "Genre sets set aside";
}

/** Caption for a candidate set the table can't pick (Mojo sets some aside at random and takes no modular picks). */
export const MODULAR_SET_ASIDE_CAPTION = "Set aside at random";

/** True when the modular candidates are information, not choices: no picks (`modularSetCount: 0`) but sets set aside at random. */
export function modularChipsAreInformation(scenario: Scenario): boolean {
  return (
    scenario.modularSetPool !== undefined &&
    (scenario.modularSetCount ?? 1) === 0 &&
    setAsideModularSetCountFor(scenario, 1) > 0
  );
}

/**
 * Table setup's Modular sets header, right side. A plain scenario: "1 required · 1 chosen". A pooled scenario with
 * sets shuffled in says "random" until the players have picked; one that sets sets aside says how many, for this
 * table's size, and that none is shuffled in at the start.
 */
export function modularHeaderRightLabel(
  scenario: Scenario,
  requiredCount: number,
  playerCount: number,
  anyPicked: boolean,
): string {
  const required = `${requiredCount} required`;
  const count = scenario.modularSetCount ?? 1;
  if (scenario.modularSetPool && count === 0) {
    const aside = setAsideModularSetCountFor(scenario, Math.max(1, playerCount));
    if (aside === 0) return `${required} · none used`;
    return `${required} · ${aside} set aside · ${setAsideJoinsAtSetup(scenario) ? "1 joins at setup" : "none shuffled in"}`;
  }
  if (scenario.modularSetPool && !anyPicked) return `${required} · ${count} random`;
  return `${required} · ${count} chosen`;
}

/** The "Encounter deck N cards" summary value: Mojo's deck grows at setup when 1B shuffles a set-aside set in. */
export function encounterDeckSizeText(scenario: Scenario, size: number): string {
  return setAsideJoinsAtSetup(scenario) ? `${size} cards + 1 set` : `${size} cards`;
}
