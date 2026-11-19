/**
 * The shared top bar's Steam button (`site-nav.ts`): shown, pointing at the latest release's Install for Steam script,
 * on a computer that release has one for, and hidden everywhere else, the way the landing page's own download buttons
 * decide (`steamButtonFor`). The landing page calls `showSteamButton` with the release it already holds; the stats
 * page and the release pages call `mountSteamButton`, which asks GitHub for the latest release.
 */
import { BUILT_RELEASE } from "virtual:site-release";
import { browserDevice, downloadsOf, fetchLatestRelease, steamButtonFor, type LatestRelease } from "./downloads.js";
import { PAGE_LANGUAGES, type PageLanguage } from "./page-language.js";
import { fileKey, SHARED_TEXT } from "./site-text.js";
import { LATEST_RELEASE_API } from "./site-urls.js";

/** The page's language, from its `<html lang>`. */
function pageLanguage(): PageLanguage {
  const lang = document.documentElement.lang.toLowerCase().split("-")[0];
  return (PAGE_LANGUAGES as readonly string[]).includes(lang ?? "") ? (lang as PageLanguage) : "en";
}

/** Shows the bar's Steam button for `release`'s script, or hides it when the reader's computer has none. */
export function showSteamButton(release: LatestRelease | null, language: PageLanguage = pageLanguage()): void {
  const button = document.getElementById("bar-steam") as HTMLAnchorElement | null;
  if (!button) return;
  const steam = release ? steamButtonFor(downloadsOf(release, language), browserDevice()) : undefined;
  button.hidden = !steam;
  if (steam) {
    button.href = steam.url;
    button.setAttribute("aria-label", SHARED_TEXT[language][fileKey(steam.id)]);
  } else {
    button.removeAttribute("href");
  }
}

/** The Steam button from the build's copy of the latest release at once, then from GitHub's answer. */
export function mountSteamButton(): void {
  showSteamButton(BUILT_RELEASE);
  void fetchLatestRelease(LATEST_RELEASE_API).then((latest) => {
    if (latest) showSteamButton(latest);
  });
}
