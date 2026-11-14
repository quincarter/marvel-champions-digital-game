/**
 * Where things live once the site moves to Cloudflare (docs/custom-content-packs.md §4.1): the landing page at the
 * domain's top level, the game on its own subdomain. Both pages under `site/` read every address from here, so a
 * different subdomain is a one-line change.
 */
export const SITE_DOMAIN = "champions-digital-game.com";

/**
 * The game's new home. `marvel.` names the game, so another game or content line can take its own subdomain later
 * (the owner, 2026-11-14).
 */
export const GAME_URL = `https://marvel.${SITE_DOMAIN}/`;

/** The landing page. */
export const LANDING_URL = `https://${SITE_DOMAIN}/`;

/** The old address, where the "we have moved" page stays so it can still read the saves this origin holds. */
export const OLD_SITE_URL = "https://marvel-champions-digital-game.netlify.app/";

export const REPO_URL = "https://github.com/quincarter/marvel-champions-digital-game";
export const RELEASES_URL = `${REPO_URL}/releases`;
export const LATEST_RELEASE_URL = `${RELEASES_URL}/latest`;
export const LATEST_RELEASE_API =
  "https://api.github.com/repos/quincarter/marvel-champions-digital-game/releases/latest";
export const ISSUES_URL = `${REPO_URL}/issues`;

/** The mod store's catalog, the same file the game reads (`packs/catalog.ts`). */
export const PACK_CATALOG_URL = `https://packs.${SITE_DOMAIN}/index.json`;

/** The game's own community Discord (README, `view/issue-report.ts`). */
export const GAME_DISCORD_URL = "https://discord.gg/tCy5tqu46j";
/** The Marvel Champions Homebrew community, in English and in Spanish. */
export const HOMEBREW_DISCORD_EN_URL = "https://discord.com/invite/eYBGKQFYAq";
export const HOMEBREW_DISCORD_ES_URL = "https://discord.com/invite/FcX5NkhAVW";

export const PROXY_NEXUS_URL = "https://proxynexus.net";
export const MARVELCDB_URL = "https://marvelcdb.com";
export const HALL_OF_HEROES_URL = "https://hallofheroeslcg.com";
