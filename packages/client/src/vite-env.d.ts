/** Build-time variables the client reads from `import.meta.env` beyond Vite's own. */
interface ImportMetaEnv {
  /** Base URL of the save-transfer Worker (`save-data/transfer-config.ts`). Unset in dev uses the local Worker. */
  readonly VITE_SYNC_URL?: string;
  /**
   * The Mod Store's catalog (`packs/catalog.ts`). Netlify builds (non-production) set it to `/packs/index.json`, a
   * catalog of the repo's own packs built into the site by `scripts/build-pack-catalog.mjs`. Unset uses production.
   */
  readonly VITE_PACK_CATALOG?: string;
}
