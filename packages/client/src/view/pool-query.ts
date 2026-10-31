/**
 * The deck builder's search filters (issue #531): a search can mix free words with `field:value` terms in the style of
 * marvelcdb's smart filter, so "o<2 t:event rp:1 kw:guard spider" is "events costing under 2 with a physical icon and
 * the Guard keyword, best match for 'spider'". The free words go to the ranked fuzzy search (`deck-search.ts`); the
 * terms filter the pool here, exactly.
 *
 *   o / cost        cost                 t / type        ally, event, support, upgrade, resource, side scheme
 *   rp rm re rw     physical / mental / energy / wild resource icons (a resource card's own icons count)
 *   k / trait       trait                kw / keyword    Guard, Retaliate, Uses, Requirement, Permanent, ...
 *   x / text        rules text           v / flavor      flavor text
 *   f / aspect      aggression, justice, leadership, protection, pool, basic, hero
 *   e / pack        pack name or code    y / cycle       wave/cycle name
 *   u / unique      u:1 unique, u:0 not  atk thw h / hp  an ally's stats
 *
 * Operators: `:` (or `=`) is "is" (a word: contains it), `!` is "is not", `>` `<` `>=` `<=` compare numbers. `|`
 * separates alternatives ("t:ally|event"), and quotes hold spaces (k:"s.h.i.e.l.d. agent"). A term with an unknown
 * field stays a free word, so ordinary text with a colon still searches.
 */
import type { AnyCard } from "@mc/content";
import type { PackInfo } from "./deck-builder-model.js";

export type QueryOp = ":" | "!" | ">" | "<" | ">=" | "<=";

export type QueryField =
  | "cost"
  | "type"
  | "physical"
  | "mental"
  | "energy"
  | "wild"
  | "trait"
  | "keyword"
  | "text"
  | "flavor"
  | "aspect"
  | "pack"
  | "cycle"
  | "unique"
  | "atk"
  | "thw"
  | "hp";

export interface QueryClause {
  readonly field: QueryField;
  readonly op: QueryOp;
  /** Alternatives, lowercased; the clause holds when any one does (for `!`, when none does). */
  readonly values: readonly string[];
}

export interface PoolQuery {
  /** The words left for the ranked text search. */
  readonly text: string;
  readonly clauses: readonly QueryClause[];
}

const FIELD_ALIASES: Readonly<Record<string, QueryField>> = {
  o: "cost",
  cost: "cost",
  t: "type",
  type: "type",
  rp: "physical",
  physical: "physical",
  rm: "mental",
  mental: "mental",
  re: "energy",
  energy: "energy",
  rw: "wild",
  wild: "wild",
  k: "trait",
  trait: "trait",
  traits: "trait",
  kw: "keyword",
  keyword: "keyword",
  x: "text",
  text: "text",
  v: "flavor",
  flavor: "flavor",
  f: "aspect",
  aspect: "aspect",
  e: "pack",
  pack: "pack",
  y: "cycle",
  cycle: "cycle",
  wave: "cycle",
  u: "unique",
  unique: "unique",
  atk: "atk",
  thw: "thw",
  h: "hp",
  hp: "hp",
};

/** Fields whose values are numbers: these compare, the rest match words. */
const NUMERIC: ReadonlySet<QueryField> = new Set(["cost", "physical", "mental", "energy", "wild", "atk", "thw", "hp"]);

const TERM = /^([a-z]+)(>=|<=|:|=|!|>|<)(.*)$/i;

/** Splits on spaces outside double quotes; a quote pair is dropped and keeps its spaces. */
function tokensOf(text: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (/\s/.test(ch) && !quoted) {
      if (current) out.push(current);
      current = "";
    } else current += ch;
  }
  if (current) out.push(current);
  return out;
}

export function parsePoolQuery(text: string): PoolQuery {
  const free: string[] = [];
  const clauses: QueryClause[] = [];
  for (const token of tokensOf(text)) {
    const term = TERM.exec(token);
    const field = term ? FIELD_ALIASES[term[1]!.toLowerCase()] : undefined;
    const raw = term?.[3]?.trim() ?? "";
    if (!term || !field || raw === "") {
      free.push(token);
      continue;
    }
    const op: QueryOp = term[2] === "=" ? ":" : (term[2] as QueryOp);
    const values = raw
      .toLowerCase()
      .split("|")
      .map((v) => v.trim())
      .filter(Boolean);
    // A comparison only makes sense on a number field with a number.
    if ((op === ">" || op === "<" || op === ">=" || op === "<=") && (!NUMERIC.has(field) || values.length !== 1)) {
      free.push(token);
      continue;
    }
    clauses.push({ field, op, values });
  }
  return { text: free.join(" "), clauses };
}

/** Lowercase, accents and periods dropped, "_" and "-" read as spaces: "S.H.I.E.L.D." is "shield". */
const norm = (text: string): string =>
  text
    .replace(/\./g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[_-]/g, " ")
    .toLowerCase();

const iconsOf = (card: AnyCard): Readonly<Partial<Record<string, number>>> =>
  "producesIcons" in card && card.producesIcons
    ? card.producesIcons
    : "resourceIcons" in card && card.resourceIcons
      ? card.resourceIcons
      : {};

const numberOf = (value: unknown): number | null => (typeof value === "number" ? value : null);

/** A card's number for `field`, or null when it prints none (a resource's cost, an event's attack, an "X"). */
function numericOf(card: AnyCard, field: QueryField): number | null {
  switch (field) {
    case "cost":
      return "cost" in card && !("specialCost" in card && card.specialCost) ? numberOf(card.cost) : null;
    case "physical":
    case "mental":
    case "energy":
    case "wild":
      return iconsOf(card)[field] ?? 0;
    case "atk":
      return "atk" in card ? numberOf(card.atk) : null;
    case "thw":
      return "thw" in card ? numberOf(card.thw) : null;
    case "hp":
      return "hp" in card ? numberOf(card.hp) : null;
    default:
      return null;
  }
}

/** A card's words for `field`; a value matches when one of them contains it. */
function wordsOf(card: AnyCard, field: QueryField, packs: readonly PackInfo[]): readonly string[] {
  switch (field) {
    case "type":
      return [card.type.replace(/_/g, " ")];
    case "trait":
      return "traits" in card ? (card.traits as readonly string[]) : [];
    case "keyword":
      return "keywords" in card ? card.keywords.map((k) => (k.name === "teamUp" ? "team up" : k.name)) : [];
    case "text": {
      const text = "text" in card ? (card.text as { readonly current?: string } | string | undefined) : undefined;
      return [typeof text === "string" ? text : (text?.current ?? "")];
    }
    case "flavor":
      return "flavor" in card && typeof card.flavor === "string" ? [card.flavor] : [];
    case "aspect": {
      const aspect = "aspect" in card && typeof card.aspect === "string" ? card.aspect : "";
      return [aspect.startsWith("hero:") ? "hero" : aspect];
    }
    case "pack": {
      const pack = packs.find((p) => p.code === (card.setCode as string));
      return [card.setCode as string, ...(pack ? [pack.name] : [])];
    }
    case "cycle": {
      const pack = packs.find((p) => p.code === (card.setCode as string));
      return [card.cycleId as string, ...(pack ? [pack.cycleName] : [])];
    }
    default:
      return [];
  }
}

function valueHolds(card: AnyCard, clause: QueryClause, value: string, packs: readonly PackInfo[]): boolean {
  const { field, op } = clause;
  if (field === "unique") {
    const wanted = !["0", "false", "no", "n"].includes(value);
    return card.unique === wanted;
  }
  if (NUMERIC.has(field)) {
    const target = Number(value);
    if (!Number.isFinite(target)) return false;
    const have = numericOf(card, field);
    if (have === null) return false;
    if (op === ">") return have > target;
    if (op === "<") return have < target;
    if (op === ">=") return have >= target;
    if (op === "<=") return have <= target;
    return have === target;
  }
  const wanted = norm(value);
  return wordsOf(card, field, packs).some((word) => norm(word).includes(wanted));
}

/** Whether `card` meets every clause. */
export function matchesClauses(card: AnyCard, clauses: readonly QueryClause[], packs: readonly PackInfo[]): boolean {
  return clauses.every((clause) => {
    const any = clause.values.some((value) => valueHolds(card, clause, value, packs));
    return clause.op === "!" ? !any : any;
  });
}
