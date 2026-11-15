/**
 * The release pages (`public/releases`) are written for the game's own origin: their "Play in your browser" link is a
 * relative `href` that climbs back to the site's root (`../` from the history page, `../../` from a report). The
 * landing build copies them to the top-level domain, where that root is the landing page, so the copy points those
 * links at the game instead. Release navigation (`../index.html#v0.44.0`) and the game's own copies are left alone.
 */

/** An `href` made only of `../` steps: the site's root, wherever the page sits. */
const ROOT_LINK = /(\s)href="(?:\.\.\/)+"/g;

/** `html` with every link to the site's root sent to `gameUrl`. */
export function pointRootLinksAt(html: string, gameUrl: string): string {
  return html.replace(ROOT_LINK, `$1href="${gameUrl}"`);
}
