/**
 * The Spanish release reports. A report has one page, `public/releases/<version>/index.html`, and one text map,
 * `docs/releases/es/reports/<version>.json`, from each block of English to its Spanish. `vite-release-history.ts` writes
 * `index.es.html` from the two at dev and build time, so layout and images are only ever edited once, and the page
 * needs no script.
 *
 * A block is the innermost `p`, `li`, heading, caption, `div` or footer, with its inline tags, so the Spanish can put
 * its bold words where Spanish wants them. Pure strings in and out.
 */

export const SPANISH_REPORT_NOTICE = "Todo el texto en español fue traducido con IA y puede contener errores.";

/** The notice's bar, room for the accents on a two-line heading, and a thank-you wider than its column. */
const SPANISH_STYLES = `.notice { border: 0; background: var(--gold); color: var(--gold-ink); font: 700 16px/1.5 var(--b); margin: 0 0 24px; }
      h1 { line-height: 1.04; } .thanks h2 { font-size: clamp(48px, 6vw, 70px); }`;

const NOT_INLINE = "div|p|li|ul|h[1-4]|figure|figcaption|footer|section|header|nav|img|style";
const BLOCK = new RegExp(
  `(<(div|p|li|h[1-4]|figcaption|footer|title)\\b[^>]*>)((?:(?!</?(?:${NOT_INLINE})\\b)[\\s\\S])*?)(</\\2>)`,
  "g",
);
const ATTRIBUTE = /\b(alt|content|aria-label)="([^"]*)"/g;

const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();
/** Marks, numbers and symbols have nothing to translate. */
const hasWords = (text: string): boolean => /\p{L}/u.test(text.replace(/<[^>]*>/g, ""));

/** Every piece of English on a page that the text map has to hold, in page order. */
export function reportTexts(html: string): readonly string[] {
  const texts = [...html.matchAll(BLOCK)].map((match) => normalize(match[3]!));
  const attributes = [...html.matchAll(ATTRIBUTE)].map((match) => normalize(match[2]!));
  return [...texts, ...attributes].filter(hasWords);
}

/** The Spanish page for an English one. Text the map doesn't hold stays in English. */
export function spanishReport(html: string, texts: Readonly<Record<string, string>>): string {
  const translate = (text: string): string | undefined => texts[normalize(text)];
  return html
    .replace(/<html lang="en">/, '<html lang="es">')
    .replace(BLOCK, (block, open: string, _tag: string, inner: string, close: string) => {
      const spanish = translate(inner);
      return spanish === undefined ? block : `${open}${spanish}${close}`;
    })
    .replace(ATTRIBUTE, (attribute, name: string, value: string) => {
      const spanish = translate(value);
      return spanish === undefined ? attribute : `${name}="${spanish}"`;
    })
    .replace("</style>", `${SPANISH_STYLES}\n    </style>`)
    .replace(
      '<div class="wrap">',
      `<div class="wrap">\n      <div class="notice" role="note" data-history-link>${SPANISH_REPORT_NOTICE}</div>`,
    );
}
