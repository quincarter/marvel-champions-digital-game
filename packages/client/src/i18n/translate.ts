/**
 * Translated app text (issue #390). `t(key)` gives a string in the language the player picked (`Settings.cardLanguage`,
 * the same setting card faces follow: `art/art-source.ts`'s `artLanguageNow`), falling back to English for any key that
 * language has no translation for yet, so a screen can be translated a piece at a time.
 *
 * English (`en.ts`) is the full catalog and the source of every key: a key it lacks doesn't compile. Other languages
 * are partial catalogs over it (`es.ts`). A `{name}` in a message is filled from `params`.
 *
 * A screen that shows translated text redraws on `language-change.ts`'s `onLanguageChange`, as card art does.
 *
 * One setting for both, deliberately for now: text follows the language card faces are drawn in, so it is clamped to
 * the languages this bundle's scans carry (all of them on the web, one in a native installer). Giving text its own,
 * unclamped source is a later choice for the owner (#390).
 */
import { artLanguageNow } from "../art/art-source.js";
import type { CardLanguage } from "../art/card-language.js";
import { en } from "./en.js";
import { es } from "./es.js";

export type Catalog = typeof en;
export type MessageKey = keyof Catalog;

export type Params = Readonly<Record<string, string | number>>;

export type PartialCatalog = Readonly<Partial<Record<MessageKey, string>>>;

export const CATALOGS: Readonly<Record<CardLanguage, PartialCatalog>> = { en, es };

/** `key`'s message in `catalog`, else the English one. */
export function messageFrom(catalog: PartialCatalog, key: MessageKey): string {
  return catalog[key] ?? en[key];
}

/** The message for `key` in `lang`, else in English. */
export function message(key: MessageKey, lang: CardLanguage = artLanguageNow()): string {
  return messageFrom(CATALOGS[lang], key);
}

export function fill(text: string, params: Params | undefined): string {
  if (params === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  );
}

/** `key`'s message in the current language (else English), its `{name}` placeholders filled from `params`. */
export function t(key: MessageKey, params?: Params, lang: CardLanguage = artLanguageNow()): string {
  return fill(message(key, lang), params);
}

/** A key pair `<base>_one` / `<base>_other` in the catalog: the `<base>` a plural message is asked for by. */
export type PluralBase =
  Extract<MessageKey, `${string}_one`> extends `${infer Base}_one`
    ? Base extends string
      ? `${Base}_other` extends MessageKey
        ? Base
        : never
      : never
    : never;

/**
 * A message that depends on a count: the `<base>_one` / `<base>_other` entry the language's plural rule
 * (`Intl.PluralRules`) picks for `count`, else its `_other`, else English's. `{count}` is filled from `count`.
 * Other forms a language has (`few`, `many`) are not catalogued yet; they use `_other`.
 */
export function tPlural(
  base: PluralBase,
  count: number,
  params?: Params,
  lang: CardLanguage = artLanguageNow(),
): string {
  return pluralFrom(CATALOGS[lang], lang, base, count, params);
}

/** `tPlural` over one catalog: the form `lang`'s rule picks, else the catalog's `_other`, else English in English's own form. */
export function pluralFrom(
  catalog: PartialCatalog,
  lang: string,
  base: PluralBase,
  count: number,
  params?: Params,
): string {
  const form = new Intl.PluralRules(lang).select(count) === "one" ? "one" : "other";
  const englishForm = new Intl.PluralRules("en").select(count) === "one" ? "one" : "other";
  const text = catalog[`${base}_${form}`] ?? catalog[`${base}_other`] ?? en[`${base}_${englishForm}`];
  return fill(text, { ...params, count });
}

/** The `{name}` placeholders a message uses, sorted (the catalog test checks a translation keeps English's). */
export function placeholdersOf(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].sort();
}
