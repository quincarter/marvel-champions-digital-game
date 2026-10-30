/**
 * The deck builder's search cheat sheet (issue #531): every search term `pool-query.ts` reads, how they combine, and
 * ready examples a player can use or copy. Plain data, drawn by `scenes/search-help-sheet.ts`; a test runs every query
 * here through the real parser and pool, so the sheet can't drift from what the search does.
 */

export type SearchHelpRow =
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "query"; readonly query: string; readonly meaning: string };

const heading = (text: string): SearchHelpRow => ({ kind: "heading", text });
const note = (text: string): SearchHelpRow => ({ kind: "note", text });
const query = (text: string, meaning: string): SearchHelpRow => ({ kind: "query", query: text, meaning });

export const SEARCH_HELP_ROWS: readonly SearchHelpRow[] = [
  heading("How it works"),
  note("This looks familiar, or it should! We tried to bring in all the filtering you know and love from MarvelCDB."),
  note("Words search names, traits and card text, and forgive a typo. Terms like o:2 filter exactly."),
  note("Mix as many of both as you like, split by spaces. A card has to match every one."),

  heading("Every term"),
  note("Spelled-out names work too: cost:2 is the same as o:2, and trait:spy the same as k:spy."),
  query("o:2", "The card's cost"),
  query("t:ally", "Card type: ally, event, upgrade, side scheme and more"),
  query("rp:1", "Physical resource icons"),
  query("rm:1", "Mental resource icons"),
  query("re:1", "Energy resource icons"),
  query("rw:1", "Wild resource icons"),
  query("k:spy", "Trait"),
  query("kw:retaliate", "Keyword: Guard, Retaliate, Uses, Requirement and more"),
  query("x:draw", "A word in the rules text"),
  query("v:spider", "A word in the flavor text"),
  query("f:justice", "Aspect: justice, pool, basic, hero and more"),
  query("e:core", "Pack, by name or code"),
  query("y:core", "Wave, by name"),
  query("u:1", "Unique cards. u:0 is cards that are not"),
  query("atk>=2", "An ally's attack"),
  query("thw>=2", "An ally's thwart"),
  query("h>=3", "An ally's health"),

  heading("Try these"),
  query("t:ally o<3", "Allies costing 2 or less"),
  query("t:event rp>=1", "Events with a physical resource icon"),
  query("t:support|upgrade o<=1", "Supports and upgrades costing 0 or 1"),
  query("t:ally thw>=2 o<4", "Cheap allies with 2 or more thwart"),
  query("kw:uses o<3", "Cheap cards with Uses counters"),
  query("k:avenger t:ally", "Avenger allies"),
  query("k:shield t!ally", "S.H.I.E.L.D. cards that are not allies"),
  query("f:justice t:event o:0", "Free Justice events"),
  query("x:ready t:event", "Events that mention ready"),
  query("t:resource rw>=1", "Resource cards with a wild icon"),
  query("spider t:ally", "Allies matching the word spider"),

  heading("Ways to combine"),
  query("o:2", "A colon means is, so cost is 2. An = works too"),
  query("o>1", "> and < compare numbers"),
  query("o>=4", ">= and <= include the number itself"),
  query("t!event", "! means is not, so everything but events"),
  query("t:ally|event", "| means either, so allies or events"),
  query('x:"draw 1 card"', "Quotes keep spaces in a value"),
  query("t:ally o<3 k:avenger", "Spaces stack terms: all of them must match"),
  query("web t:event o<2", "Words and terms mix in any order"),
];
