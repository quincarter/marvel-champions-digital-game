/**
 * Which house rules' rebuilt faces a game shows (docs/custom-content-packs.md §11.11). Pure: the session applies the
 * answer to `art-source.ts` while a game screen is up and clears it when the game ends, as `balanced-art.ts` does for
 * the Balanced scans. A Balanced game's GMW Fixes faces need nothing here: they follow the Balanced scans.
 */

/** The part of a game's config this reads: the packs it carries. */
export interface HouseRuleArtConfig {
  readonly packs?: readonly {
    readonly id: string;
    readonly houseRule?: { readonly traitAdditions?: readonly unknown[] };
  }[];
}

/** The trait house rules a game carries (`SessionConfig.packs`), by pack id: the rules it was set up with. */
export function houseRuleFacesOf(config: HouseRuleArtConfig | null | undefined): readonly string[] {
  return (config?.packs ?? [])
    .filter((pack) => (pack.houseRule?.traitAdditions?.length ?? 0) > 0)
    .map((pack) => pack.id);
}

/**
 * Decides when a game's house-rule faces show: only while a game screen is up (a setup deal or the Board; a hand-off
 * overlaps two, so it counts them), for the current game's config. `apply` is called only when the answer changes.
 */
export class HouseRuleArtGate {
  #screens = 0;
  #config: HouseRuleArtConfig | null = null;
  #key = "";

  constructor(private readonly apply: (packIds: readonly string[]) => void) {}

  /** The current game's config (null with no game): call it on every store update. */
  setConfig(config: HouseRuleArtConfig | null): void {
    this.#config = config;
    this.#refresh();
  }

  enter(): void {
    this.#screens += 1;
    this.#refresh();
  }

  leave(): void {
    this.#screens = Math.max(0, this.#screens - 1);
    this.#refresh();
  }

  #refresh(): void {
    const ids = this.#screens > 0 ? houseRuleFacesOf(this.#config) : [];
    const key = ids.join(",");
    if (key === this.#key) return;
    this.#key = key;
    this.apply(ids);
  }
}
