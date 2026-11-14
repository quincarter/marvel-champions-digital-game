/** What `vite.site.config.ts`'s landing plugin builds into the landing page. */
declare module "virtual:landing-data" {
  import type { PackIndexEntry } from "@mc/content";

  export interface FeedRelease {
    readonly version: string;
    /** `YYYY-MM-DD`. */
    readonly date: string;
    readonly title: string;
    /** Already escaped by the release history builder. */
    readonly summaryHtml: string;
    readonly report: boolean;
    readonly reportFile: string;
  }

  export interface Screenshot {
    /** A bundled asset URL. */
    readonly src: string;
    readonly version: string;
    readonly alt: Readonly<Record<"en" | "es", string>>;
    readonly caption: Readonly<Record<"en" | "es", string>>;
  }

  /** Newest first, per language. */
  export const RELEASES: Readonly<Record<"en" | "es", readonly FeedRelease[]>>;
  export const SCREENSHOTS: readonly Screenshot[];
  /** What the page shows of a store pack. */
  export type StoreMod = Pick<PackIndexEntry, "id" | "kind" | "name" | "creator" | "summary" | "thumbnail" | "latest">;
  /** The store's packs at build time, withdrawn ones left out; the page refreshes them live where it can. */
  export const MODS: readonly StoreMod[];
  export const BUILT_AT: string;
  /** Each hero's portrait by identity card code, with the CSS `object-position` that keeps its subject in frame. */
  export const HERO_ART: Readonly<Record<string, { readonly src: string; readonly position: string }>>;
  /** Each villain's artwork by scenario id. */
  export const VILLAIN_ART: Readonly<Record<string, string>>;
  /** The title wallpapers: the page's top (wide and tall) and the ones between sections. */
  export const WALLPAPERS: {
    readonly wide: string | null;
    readonly tall: string | null;
    readonly bands: readonly string[];
  };
}
