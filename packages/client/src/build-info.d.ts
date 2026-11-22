/**
 * Set by `vite.config.ts`'s `define` at build time: the short git commit the bundle was built from (Netlify's
 * `COMMIT_REF`, else `git rev-parse`), or "" when neither is available. Undeclared under Vitest, which doesn't run the
 * `define` — read it through `view/app-version.ts`'s `buildCommit()`, which guards for that.
 */
declare const __BUILD_COMMIT__: string;

/**
 * Set the same way: the language of the card scans this bundle carries (`MC_CARD_LANG`, default "en"). Read it through
 * `art/card-language.ts`'s `cardLanguage()`.
 */
declare const __CARD_LANG__: string;

/**
 * Every language whose card scans this bundle carries, comma-separated (`MC_CARD_LANGS`; the build language alone when
 * unset). Read it through `art/card-language.ts`'s `availableCardLanguages()`.
 */
declare const __CARD_LANGS__: string;

/**
 * Set the same way: a short hash of the rules source (engine, cards, content, mod SDK, client session code) (`rules-fingerprint.ts`), so live rooms
 * can tell two builds with the same version strings but different rules code apart. Read it through
 * `view/app-version.ts`'s `rulesFingerprint()`, which guards for Vitest.
 */
declare const __RULES_FINGERPRINT__: string;
