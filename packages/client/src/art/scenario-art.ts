/**
 * Villain artwork and end-of-game scenes, found by convention in the repo's
 * `art/` folder (see `art/README.md`):
 *
 *   art/scenarios/<scenarioId>/villain.<ext>         the villain, for that scenario
 *   art/scenarios/<scenarioId>/villain-wins.<ext>    shown when the players lose to it
 *   art/scenarios/<scenarioId>/villain-loses.<ext>   shown when the players beat it
 *   art/outcomes/defeat.<ext>                        any loss with no scene of its own
 *   art/outcomes/victory.<ext>                       any win with no scene of its own
 *
 * `<scenarioId>` is the content package's own `Scenario.id` (`rhino`, `klaw`,
 * `ultron`, `risky-business`, `mutagen-formula`, `breakout`), so there is no
 * table mapping scenarios to files — the folder name *is* the lookup. A slot
 * may hold several pictures: `villain.jpg`, `villain-2.jpg`, `villain-3.png`;
 * one is picked at random.
 *
 * The parsing and the lookups are pure functions over a path → URL map, so
 * they are tested without the glob.
 */
import { pickPicture, type Picture } from "./pictures.js";

/** Longest first: `villain-wins-2` must match `villain-wins`, not read as a variant of `villain`. */
const SCENARIO_SLOTS = ["villain-wins", "villain-loses", "villain"] as const;
const OUTCOME_SLOTS = ["defeat", "victory"] as const;
export type ScenarioArtSlot = (typeof SCENARIO_SLOTS)[number];
export type OutcomeArtSlot = (typeof OUTCOME_SLOTS)[number];

export interface ArtCatalog {
  readonly scenarios: ReadonlyMap<string, Readonly<Record<ScenarioArtSlot, readonly Picture[]>>>;
  readonly outcomes: Readonly<Record<OutcomeArtSlot, readonly Picture[]>>;
  /** Files under `art/scenarios/` or `art/outcomes/` whose name fits no slot — a typo, by any other name. */
  readonly unrecognized: readonly string[];
}

/** The slot a file stem names: the slot itself, or the slot plus a `-variant` suffix. */
function slotOf<S extends string>(stem: string, slots: readonly S[]): S | null {
  return slots.find((slot) => stem === slot || stem.startsWith(`${slot}-`)) ?? null;
}

/**
 * Builds the catalog from a path → URL map. Only the part of each path from
 * `art/` on is read, so the map's keys may be relative to anywhere.
 */
export function parseArtCatalog(files: Readonly<Record<string, string>>): ArtCatalog {
  const scenarios = new Map<string, Record<ScenarioArtSlot, Picture[]>>();
  const outcomes: Record<OutcomeArtSlot, Picture[]> = { defeat: [], victory: [] };
  const unrecognized: string[] = [];

  for (const fullPath of Object.keys(files).sort()) {
    const underArt = fullPath.slice(fullPath.lastIndexOf("art/") + "art/".length);
    const parts = underArt.split("/");
    const file = parts[parts.length - 1] ?? "";
    const stem = file.slice(0, file.lastIndexOf("."));
    const picture: Picture = { key: `scene-art:${underArt}`, url: files[fullPath]! };

    if (parts[0] === "scenarios" && parts.length === 3) {
      const slot = slotOf(stem, SCENARIO_SLOTS);
      if (!slot) {
        unrecognized.push(underArt);
        continue;
      }
      const scenarioId = parts[1]!;
      const entry = scenarios.get(scenarioId) ?? { villain: [], "villain-wins": [], "villain-loses": [] };
      entry[slot].push(picture);
      scenarios.set(scenarioId, entry);
    } else if (parts[0] === "outcomes" && parts.length === 2) {
      const slot = slotOf(stem, OUTCOME_SLOTS);
      if (slot) outcomes[slot].push(picture);
      else unrecognized.push(underArt);
    } else {
      unrecognized.push(underArt);
    }
  }
  return { scenarios, outcomes, unrecognized };
}

/** The villain's own artwork for a scenario, or null when there is none. */
export function villainArtFor(catalog: ArtCatalog, scenarioId: string, random: () => number = Math.random): Picture | null {
  return pickPicture(catalog.scenarios.get(scenarioId)?.villain ?? [], null, random);
}

/**
 * The scene for how a game ended.
 *
 * A loss shows the villain winning, a win shows it losing; each falls back to
 * the generic scene when that scenario has none of its own. A concession shows
 * only the generic defeat — the team stopped, the villain didn't beat them, so
 * its victory scene would claim something that didn't happen.
 */
export function outcomeArtFor(
  catalog: ArtCatalog,
  scenarioId: string,
  result: "win" | "loss" | "conceded",
  random: () => number = Math.random,
): Picture | null {
  const scenario = catalog.scenarios.get(scenarioId);
  const own = result === "win" ? scenario?.["villain-loses"] : result === "loss" ? scenario?.["villain-wins"] : undefined;
  const generic = catalog.outcomes[result === "win" ? "victory" : "defeat"];
  return pickPicture(own && own.length > 0 ? own : generic, null, random);
}

// Two literal patterns (a glob pattern cannot be built from a variable) covering the two conventions above.
const files = {
  ...(import.meta.glob("../../../../art/scenarios/*/*.{png,jpg,jpeg,webp,avif}", { eager: true, query: "?url", import: "default" }) as Record<string, string>),
  ...(import.meta.glob("../../../../art/outcomes/*.{png,jpg,jpeg,webp,avif}", { eager: true, query: "?url", import: "default" }) as Record<string, string>),
};

/** Everything in `art/scenarios/` and `art/outcomes/`. */
export const ART_CATALOG: ArtCatalog = parseArtCatalog(files);
