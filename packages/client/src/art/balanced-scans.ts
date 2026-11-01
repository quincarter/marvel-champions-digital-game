/**
 * The edited scans of Galaxy's Most Wanted's Balanced house rule (issue #609), made by bluefireF5ran. Plain data, no
 * imports: `art-source.ts` swaps a normal scan for its Balanced one the way it swaps in a promo, and `vite-card-art.ts`
 * (through `allArtFor`) carries them in the build.
 *
 * Each is filed beside the scan it replaces under a `-balanced` name, in English and Spanish alike
 * (`assets/card-art/bundles/cards/16070-balanced.png`, `assets/card-art-locales/es/bundles/cards/16070-balanced.png`),
 * so the card-art bundle that owns the pack's prefix carries it and a language without one falls back to English.
 */

/** When a Balanced scan shows: always in a Balanced run, or only with this toggle on. */
export type BalancedScanGate = "always" | { readonly toggle: string } | { readonly toggleOff: string };

export interface BalancedScan {
  /** The normal scan's file stem, which this one stands in for. */
  readonly scan: string;
  /** What a game's set of shown scans names this one by: the scan's stem, or with a suffix for a second version of it. */
  readonly id: string;
  /** Its path under `assets/card-art/` (and `/card-art/` when served). */
  readonly path: string;
  readonly gate: BalancedScanGate;
}

const entry = (scan: string, gate: BalancedScanGate, variant = ""): BalancedScan => ({
  scan,
  id: variant === "" ? scan : `${scan}-${variant}`,
  path: `bundles/cards/${scan}-balanced${variant === "" ? "" : `-${variant}`}.png`,
  gate,
});

export const BALANCED_SCANS: readonly BalancedScan[] = [
  // The Collector (I, II, III): a card would go to The Collection instead of a discard pile, not an encounter card's removal.
  entry("16070", "always"),
  entry("16071", "always"),
  entry("16072", "always"),
  // The Grand Collection (Space Pirates in the Museum).
  entry("16073a", { toggle: "spacePirates" }),
  entry("16073b", { toggle: "spacePirates" }),
  // Nebula's Ship.
  entry("16093", "always"),
  // Interception Imminent's 1A: the setup that shuffles Kree Supremacy in shows with that toggle on, the one that
  // stops at removing the Kree Command Ship with it off (so one of them shows in every Balanced Ronan game).
  entry("16106a", { toggle: "kreeSupremacy" }),
  entry("16106a", { toggleOff: "kreeSupremacy" }, "nokree"),
  entry("16106b", "always"),
  entry("16107b", "always"),
  // The Milano (Milano Mods can't be used while it is exhausted).
  entry("16142", { toggle: "milanoExhausted" }),
];

export const BALANCED_SCAN_STEMS: ReadonlySet<string> = new Set(BALANCED_SCANS.map((entry) => entry.scan));
