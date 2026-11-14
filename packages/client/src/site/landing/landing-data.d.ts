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
}
