/** Build-time variables the client reads from `import.meta.env` beyond Vite's own. */
interface ImportMetaEnv {
  /** Base URL of the save-transfer Worker (`save-data/transfer-config.ts`). Unset in dev uses the local Worker. */
  readonly VITE_SYNC_URL?: string;
}
