/**
 * Where the save-transfer Worker lives. CI sets `VITE_SYNC_URL` at build time: production gets the workers.dev address
 * `https://mc-sync.<subdomain>.workers.dev`, previews `https://mc-sync-staging.<subdomain>.workers.dev`. In dev the
 * default is `wrangler dev`'s own address (`pnpm dev:sync`). Anywhere else, with nothing set, there is no service and
 * the transfer screens say so rather than guess a host.
 */

export const DEV_SYNC_URL = "http://localhost:8787";

export interface SyncEnv {
  readonly VITE_SYNC_URL?: string;
  readonly DEV?: boolean;
}

export function syncServiceUrl(env: SyncEnv = import.meta.env): string | null {
  const configured = env.VITE_SYNC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return env.DEV ? DEV_SYNC_URL : null;
}
