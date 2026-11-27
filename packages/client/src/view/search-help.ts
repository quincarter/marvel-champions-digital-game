/**
 * The deck builder's search cheat sheet (issue #531): every search term `pool-query.ts` reads, how they combine, and
 * ready examples a player can use or copy. Plain data, drawn by `scenes/search-help-sheet.ts`; a test runs every query
 * here through the real parser and pool, so the sheet can't drift from what the search does.
 *
 * The explanations are translated (`searchHelp.<id>`); the queries are executable syntax and never are: the parser
 * reads the canonical English values (`ally`, `justice`, `guard`), so the Spanish sheet explains the same tokens.
 */
import type { CardLanguage } from "../art/card-language.js";
import { t, type MessageKey } from "../i18n/translate.js";

export type SearchHelpRow =
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "query"; readonly query: string; readonly meaning: string };

type SearchHelpSpec =
  | { readonly kind: "heading" | "note"; readonly id: string }
  | { readonly kind: "query"; readonly id: string; readonly query: string };

const heading = (id: string): SearchHelpSpec => ({ kind: "heading", id });
const note = (id: string): SearchHelpSpec => ({ kind: "note", id });
const query = (text: string, id: string): SearchHelpSpec => ({ kind: "query", id, query: text });

const SPECS: readonly SearchHelpSpec[] = [
  heading("how"),
  note("looks"),
  note("words"),
  note("mix"),
  heading("every"),
  note("spelled"),
  query("o:2", "cost"),
  query("t:ally", "type"),
  query("rp:1", "rp"),
  query("rm:1", "rm"),
  query("re:1", "re"),
  query("rw:1", "rw"),
  query("k:spy", "trait"),
  query("kw:retaliate", "keyword"),
  query("x:draw", "rules"),
  query("v:spider", "flavor"),
  query("f:justice", "aspect"),
  query("e:core", "pack"),
  query("y:core", "wave"),
  query("u:1", "unique"),
  query("atk>=2", "atk"),
  query("thw>=2", "thw"),
  query("h>=3", "hp"),
  heading("try"),
  query("t:ally o<3", "t1"),
  query("t:event rp>=1", "t2"),
  query("t:support|upgrade o<=1", "t3"),
  query("t:ally thw>=2 o<4", "t4"),
  query("kw:uses o<3", "t5"),
  query("k:avenger t:ally", "t6"),
  query("k:shield t!ally", "t7"),
  query("f:justice t:event o:0", "t8"),
  query("x:ready t:event", "t9"),
  query("t:resource rw>=1", "t10"),
  query("spider t:ally", "t11"),
  heading("combine"),
  query("o:2", "c1"),
  query("o>1", "c2"),
  query("o>=4", "c3"),
  query("t!event", "c4"),
  query("t:ally|event", "c5"),
  query('x:"draw 1 card"', "c6"),
  query("t:ally o<3 k:avenger", "c7"),
  query("web t:event o<2", "c8"),
];

/** The sheet's rows with their words in `lang` (the card language: the one the rest of the screen reads in). */
export function searchHelpRows(lang?: CardLanguage): readonly SearchHelpRow[] {
  return SPECS.map((spec): SearchHelpRow => {
    const text = t(`searchHelp.${spec.id}` as MessageKey, undefined, lang);
    return spec.kind === "query" ? { kind: "query", query: spec.query, meaning: text } : { kind: spec.kind, text };
  });
}

/** The rows in English: what the parser test runs. */
export const SEARCH_HELP_ROWS: readonly SearchHelpRow[] = searchHelpRows("en");
