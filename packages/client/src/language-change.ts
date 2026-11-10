/**
 * The one place a language switch is announced (issue #337). Whatever draws something language-dependent subscribes
 * here instead of each screen watching the setting on its own:
 *
 *  - `art/card-art.ts` redraws every screen showing card art, so faces drawn in this frame ask for the new scans;
 *  - `session.ts` has the session store hand its current state to every subscriber again, so a screen that built its
 *    view model from the game state (the table's card tiles, the villain phase, a pile) builds it anew, now resolving
 *    art in the new language;
 *  - the language button relabels itself.
 *
 * Translated app text (#390) will subscribe here too. `art/art-source.ts`'s `setArtLanguage` is the only caller of
 * `announceLanguageChange`.
 */

const listeners = new Set<() => void>();

/** Called after the language changes; returns an unsubscribe. */
export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function announceLanguageChange(): void {
  for (const listener of [...listeners]) listener();
}

/**
 * Something a card's picture depends on changed without the language changing (an installed pack's pictures became
 * available, `art/pack-art.ts`): only the art caches redraw and ask again. Deliberately not the language channel, which
 * makes the session store republish its state.
 */
export function announceArtChange(): void {
  for (const listener of [...artListeners]) listener();
}

const artListeners = new Set<() => void>();

/** Called when a card picture became available without a language change (`announceArtChange`); returns an unsubscribe. */
export function onArtChange(listener: () => void): () => void {
  artListeners.add(listener);
  return () => artListeners.delete(listener);
}
