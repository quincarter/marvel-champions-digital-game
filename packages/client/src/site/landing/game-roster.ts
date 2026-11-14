/**
 * The heroes and scenarios the game offers, for the landing page. Kept in `game-roster.json`, which
 * `game-roster.test.ts` checks against the card pool (and rewrites with `MC_UPDATE_SITE_DATA=1`), so the page never
 * bundles the pool itself.
 */
import roster from "./game-roster.json";

export interface GameRoster {
  readonly heroCount: number;
  readonly scenarioCount: number;
  /** `id` names the villain's art folder (`art/scenarios/<id>/`). */
  readonly scenarios: readonly { readonly id: string; readonly name: string }[];
  /** One per release wave, oldest first. */
  readonly waves: readonly {
    readonly name: string;
    /** `id` is the identity card's code, which names its art folder (`art/heroes/<id>-<slug>/`). */
    readonly heroes: readonly { readonly id: string; readonly name: string; readonly aspects: readonly string[] }[];
  }[];
  /** The MarvelCDB authors whose decks the game recommends. */
  readonly deckAuthors: readonly string[];
}

export const GAME_ROSTER: GameRoster = roster;
