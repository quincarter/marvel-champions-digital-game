/**
 * Test helper (#390): switch the app text to Spanish for one test, then back. `setArtLanguage` only takes a language
 * the build carries (`__CARD_LANGS__`), which a unit test run does not, so the helper stubs that to carry both.
 */
import { vi } from "vitest";
import { setArtLanguage } from "../art/art-source.js";

export function useSpanish(): void {
  vi.stubGlobal("__CARD_LANGS__", "en,es");
  setArtLanguage("es");
}

/** For an `afterEach`: back to English and the build's real languages. */
export function useEnglish(): void {
  setArtLanguage("en");
  delete (globalThis as { __CARD_LANGS__?: string }).__CARD_LANGS__;
}
