/** Choose a scenario's text search: it runs in a worker (`view/deck-search-client.ts`) and `ranking` is its last answer. */
import {
  currentCardsById,
  currentEncounterSets,
  currentPoolKey,
  currentScenarios,
  packNameOf,
} from "../../content/pool.js";
import { DeckSearchClient } from "../../view/deck-search-client.js";
import { scenarioSearchDocumentOf } from "../../view/scenario-search.js";

export class ScenarioSearch {
  readonly #client = new DeckSearchClient();
  /** Each scenario's score for the text, or null when no search is active. */
  ranking: ReadonlyMap<string, number> | null = null;

  /** Hands the worker the pool's scenarios (again when packs load or change in the Mod Store). */
  setDocuments(): void {
    this.#client.setDocuments(
      currentScenarios().map((s) =>
        scenarioSearchDocumentOf(s, currentCardsById(), currentEncounterSets(), packNameOf),
      ),
      currentPoolKey() + ":scenarios",
    );
  }

  /** Drops the search: every scenario shows again. */
  clear(): void {
    this.#client.cancel();
    this.ranking = null;
  }

  /** Asks the worker to rank the scenarios for `text`; `redraw` runs when the newest answer arrives. Empty text clears at once. */
  run(text: string, redraw: () => void, active: () => boolean): void {
    if (text.trim() === "") {
      this.clear();
      redraw();
      return;
    }
    this.#client.search(text, (ranked) => {
      if (!active()) return;
      this.ranking = new Map(ranked.map((r) => [r.id, r.score]));
      redraw();
    });
  }

  destroy(): void {
    this.#client.destroy();
  }
}
