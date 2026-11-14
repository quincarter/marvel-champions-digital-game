/** What `vite.site.config.ts`'s release plugin builds into both site pages (the shape of `downloads.ts`'s `LatestRelease`). */
declare module "virtual:site-release" {
  /** GitHub's latest release when the page was built, or `null` if GitHub was out of reach. */
  export const BUILT_RELEASE: {
    readonly tag_name: string;
    readonly html_url: string;
    readonly published_at?: string;
    readonly assets: readonly { readonly name: string; readonly browser_download_url: string }[];
  } | null;
}
