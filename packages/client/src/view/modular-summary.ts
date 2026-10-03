/**
 * What a scenario says about its modular sets in words (MojoMania, docs/phase7-wave6.md §3.63): a scenario with a
 * `modularSetPool` draws its genre sets at random, and Mojo sets some aside instead of shuffling any in. Its
 * `recommendedModularSetIds` is the whole pool, so naming the first of them ("Crime") says nothing true. Pure text
 * over `Scenario`'s own counts: no rules here, the engine's setup decides what really happens.
 */
import { setAsideModularSetCountFor, type Scenario } from "@mc/content";

const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;

/**
 * A scenario whose modular picks are sets it sets aside and shuffles none in at the start (Mojo): the table's picks on
 * Table setup are the set-aside sets, in order, and 1B brings the first of them in at setup.
 */
export function modularPicksAreSetAside(scenario: Scenario): boolean {
  return (
    scenario.modularSetPool !== undefined &&
    (scenario.modularSetCount ?? 1) === 0 &&
    setAsideModularSetCountFor(scenario, 1) > 0
  );
}

/** A scenario that sets modular sets aside and shuffles none in at the start (Mojo): 1B brings one of them in at setup. */
export const setAsideJoinsAtSetup = modularPicksAreSetAside;

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

/**
 * Table setup's Modular sets header, right side. A plain scenario: "1 required · 1 chosen". A pooled scenario says
 * how many sets the table picks (Mojo: its set-aside count for this table's size, in the order they come in) and
 * where the picks stand: none is "random", a full pick is "chosen", anything between or past it says what is off.
 */
export function modularHeaderRightLabel(
  scenario: Scenario,
  requiredCount: number,
  playerCount: number,
  pickedCount: number,
): string {
  const required = `${requiredCount} required`;
  const count = scenario.modularSetCount ?? 1;
  if (scenario.modularSetPool && count === 0) {
    const aside = setAsideModularSetCountFor(scenario, Math.max(1, playerCount));
    if (aside === 0) return `${required} · none used`;
    const joins = modularPicksAreSetAside(scenario) ? "the first joins at setup" : "none shuffled in";
    if (pickedCount === 0) return `${required} · ${aside} set aside at random · ${joins}`;
    if (pickedCount === aside) return `${required} · ${aside} set aside, chosen · ${joins}`;
    return `${required} · ${pickedCount} chosen, ${aside} needed or pick Random`;
  }
  if (scenario.modularSetPool) {
    if (pickedCount === 0) return `${required} · ${count} random`;
    if (pickedCount === count) return `${required} · ${count} chosen`;
    return `${required} · ${pickedCount} of ${count} chosen, or pick Random`;
  }
  return `${required} · ${count} chosen`;
}

/** The "Encounter deck N cards" summary value: Mojo's deck grows at setup when 1B shuffles a set-aside set in. */
export function encounterDeckSizeText(scenario: Scenario, size: number): string {
  return setAsideJoinsAtSetup(scenario) ? `${size} cards + 1 set` : `${size} cards`;
}
