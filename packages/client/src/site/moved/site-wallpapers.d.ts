/** What `vite.site.config.ts`'s wallpaper plugin builds into the moved page. */
declare module "virtual:site-wallpapers" {
  /** The title wallpapers: the page's top (wide and tall) and the ones between sections. */
  export const WALLPAPERS: {
    readonly wide: string | null;
    readonly tall: string | null;
    readonly bands: readonly string[];
  };
}
