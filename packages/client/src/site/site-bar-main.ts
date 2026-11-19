/**
 * The release pages' script for the shared top bar (`site-bar.ts`). The landing build bundles it as `/site-bar.js`
 * (`vite.site.config.ts`), and `withReleaseBar` loads it on every release page.
 */
import { mountSteamButton, trackBarHeight } from "./site-bar.js";

mountSteamButton();
trackBarHeight();
