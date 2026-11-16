/** What `vite.site.config.ts`'s download stats plugin builds into the stats page. */
declare module "virtual:download-stats" {
  import type { DownloadStats } from "./download-stats.js";

  /** Every release's downloads as GitHub counted them when the page was built, or `null` if GitHub was out of reach. */
  export const DOWNLOAD_STATS: DownloadStats | null;
  /** The top releases' headlines from the release history, per language, by version ("v0.43.2"). */
  export const RELEASE_TITLES: Readonly<
    Record<"en" | "es", Readonly<Record<string, { readonly title: string; readonly summaryHtml: string }>>>
  >;
}
