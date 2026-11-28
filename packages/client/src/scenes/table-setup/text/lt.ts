/**
 * `lt`: Set up the table's text in the app language. The view models print English; in Spanish each phrase goes through
 * the guide's terms (`rules-es.ts`) and, where a phrase names a card set, a product, a villain or a hero, through the
 * Spanish names the card data has (`content/set-names-es.ts`, the card text table). English is returned untouched.
 */
import { currentCardsById } from "../../../content/pool.js";
import { artLanguageNow } from "../../../art/art-source.js";
import { cardTextReady, localizedFaceOf } from "../../../view/card-text.js";
import { EXACT_ES, RULES_ES } from "./rules-es.js";

type Names = Readonly<Record<string, string>>;

let setNames: Names | null = null;
let packNames: Names | null = null;
let loading: Promise<boolean> | null = null;

/** Brings in the set and product names (a data module, loaded only for Spanish); true once they are in. */
export function loadSetupNames(): Promise<boolean> {
  if (artLanguageNow() === "en" || setNames) return Promise.resolve(true);
  loading ??= import("../../../content/set-names-es.js").then(
    (m) => {
      setNames = m.SET_NAMES_ES;
      packNames = m.PACK_NAMES_ES;
      return true;
    },
    () => {
      loading = null;
      return false;
    },
  );
  return loading;
}

/** Names the generated tables spell the Standard/Expert way the app does not: the app's own words win. */
const SKIP = new Set(["Standard", "Expert", "Standard II", "Standard III", "Expert II", "Villain"]);

let cardNames: {
  readonly cards: object;
  readonly ready: boolean;
  readonly sets: boolean;
  readonly list: readonly (readonly [string, string])[];
} | null = null;

/** Villain and hero names in Spanish, longest first (so "Captain Marvel" is not eaten by a shorter name). */
function names(): readonly (readonly [string, string])[] {
  const cards = currentCardsById();
  const ready = cardTextReady("es");
  if (cardNames?.cards === cards && cardNames.ready === ready && cardNames.sets === (setNames !== null))
    return cardNames.list;
  const found = new Map<string, string>();
  // A card's own Spanish name first (a hero's "Spiderman"), then the set and product tables.
  if (ready)
    for (const card of cards.values()) {
      if (card.type !== "hero_identity" && card.type !== "villain") continue;
      const es = localizedFaceOf(card.id as string, "es")?.n;
      if (es && es !== card.name && !found.has(card.name)) found.set(card.name, es);
    }
  for (const table of [setNames, packNames])
    for (const [en, es] of Object.entries(table ?? {})) if (!SKIP.has(en) && !found.has(en)) found.set(en, es);
  const list = [...found].sort((a, b) => b[0].length - a[0].length);
  cardNames = { cards, ready, sets: setNames !== null, list };
  return list;
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `text` through an exact entry or a pattern, whole; null when it matches none. */
function matched(text: string): string | null {
  const exact = EXACT_ES[text];
  if (exact !== undefined) return exact;
  for (const [pattern, make] of RULES_ES) {
    const match = pattern.exec(text);
    if (match) return renamed(make(...(match.slice(1) as string[])));
  }
  return null;
}

/** One piece of a phrase around its dots: matched, else with its names renamed. */
const phrase = (text: string): string => matched(text) ?? renamed(text);

function renamed(text: string): string {
  let out = text;
  for (const [en, es] of names()) {
    if (!out.includes(en)) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escape(en)}(?![\\p{L}\\p{N}])`, "gu"), es);
  }
  return out;
}

/** `text` in the app language. */
export function lt(text: string): string {
  if (artLanguageNow() === "en" || text.length === 0) return text;
  // The whole phrase first (some patterns hold a " · "), then piece by piece around the dots.
  return matched(text) ?? text.split(" · ").map(phrase).join(" · ");
}
