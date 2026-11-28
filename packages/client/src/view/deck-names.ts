/**
 * A deck's and a hero's names in the player's language (Quin, 2026-11-27: the room deck picker showed "Spider-Man —
 * Core Set starter deck" and "Captain Marvel" beside Spanish chrome).
 *
 * A precon's printed name is English content data ("Spider-Man (Justice) — Core Set starter deck"). Every deck list
 * builds its title from translatable parts instead: the hero's name from the card text table (`view/card-text.ts`, the
 * names MarvelCDB's Spanish site prints, so "Capitana Marvel" and "Hulka"; a hero whose name is the same in Spanish
 * keeps the English one) and the product from the `deckTitle.*` messages, whose box and set names come from the
 * `unlock.name.*` keys. The aspect the printed name carries is dropped: every list shows it as its own stamp. A deck
 * the player named or imported keeps the name they gave it. Display only; the engine reads `Deck.name` as it is.
 */
import { artLanguageNow } from "../art/art-source.js";
import type { CardLanguage } from "../art/card-language.js";
import type { Deck } from "@mc/content";
import { t, type MessageKey } from "../i18n/translate.js";
import { aspectName } from "./aspect-stamp.js";
import { localizedFaceOf } from "./card-text.js";

/** A hero's name in `lang` (the card text table's name for the identity card), keeping an "(alter ego)" qualifier as given. */
export function localHeroName(identityCardId: string, english: string, lang: CardLanguage = artLanguageNow()): string {
  const name = localizedFaceOf(identityCardId, lang)?.n;
  if (name === undefined) return english;
  const base = english.replace(/ \([^()]*\)$/, "");
  return name + english.slice(base.length);
}

/** Sets whose starter decks are named "<Set> starter deck", by the `unlock.name.*` key that names them. */
const SET_KEYS: Readonly<Record<string, MessageKey>> = { "Fear No Evil": "unlock.name.fne" };

/** "Hero (Aspects) — Product", the shape of every precon's printed name; the aspects part is optional. */
const PRINTED = /^(.+?)(?: \(([^()]*)\))? — (.+)$/;

/** "Hero / Aspect", the other shape (the later heroes' precons). */
const SLASHED = /^(.+) \/ ([^/]+)$/;

function productTitle(hero: string, product: string, lang: CardLanguage): string | null {
  const box = t("unlock.name.core", undefined, lang);
  if (product === "Core Set starter deck") return t("deckTitle.coreStarter", { hero, box }, lang);
  if (product === "Core Set tutorial deck") return t("deckTitle.coreTutorial", { hero, box }, lang);
  if (product === "starter deck") return t("deckTitle.starter", { hero }, lang);
  if (/(^| )Hero Pack starter deck$/.test(product)) return t("deckTitle.pack", { hero }, lang);
  const set = /^(.+) starter deck$/.exec(product)?.[1];
  const key = set === undefined ? undefined : SET_KEYS[set];
  return key === undefined ? null : t("deckTitle.set", { hero, set: t(key, undefined, lang) }, lang);
}

/**
 * The title a precon is shown by in `lang`, built from parts; the printed `name` unchanged when it is not a precon's
 * printed shape (a deck the player named, an installed pack's own wording). `heroId` is the deck's identity card.
 */
export function deckNameIn(
  name: string,
  heroId: string,
  aspects: readonly string[],
  lang: CardLanguage = artLanguageNow(),
): string {
  const printed = PRINTED.exec(name);
  if (printed) return productTitle(localHeroName(heroId, printed[1]!, lang), printed[3]!, lang) ?? name;
  const slashed = SLASHED.exec(name);
  if (slashed && aspects.length > 0) {
    const named = aspects.map((aspect) => aspectName(aspect, lang)).join(" + ");
    return `${localHeroName(heroId, slashed[1]!, lang)} / ${named}`;
  }
  return name;
}

/** A deck's title in `lang`: a precon's built from parts, any other deck's as its owner named it. */
export function deckDisplayName(
  deck: Pick<Deck, "name" | "source" | "identityCardId" | "aspects">,
  lang: CardLanguage = artLanguageNow(),
): string {
  return deck.source.kind === "precon"
    ? deckNameIn(deck.name, deck.identityCardId as string, deck.aspects as readonly string[], lang)
    : deck.name;
}

/** The deck's hero as a list names it in `lang`: the engine's identity name (qualified) through the card text table; null when it has none. */
export function identityLabelOf(
  option: { readonly identityName: string | null; readonly deck: Pick<Deck, "identityCardId"> },
  lang: CardLanguage = artLanguageNow(),
): string | null {
  return option.identityName === null
    ? null
    : localHeroName(option.deck.identityCardId as string, option.identityName, lang);
}
