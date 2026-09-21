/**
 * MarvelCDB's public deck JSON, as returned by both
 * `GET /api/public/decklist/<id>` (a shared, published decklist) and
 * `GET /api/public/deck/<id>` (a user's own deck, public or private to the
 * fetching session) — confirmed by fetching both live on 2026-09-13; they are
 * the same shape. Example (Black Panther's Core precon, `decklist/1`):
 *
 *   {
 *     "id": 1,
 *     "name": "Black Panther - Protection - Starter Deck",
 *     "date_creation": "2019-08-10T12:47:04+00:00",
 *     "date_update": "2026-02-06T00:24:57+00:00",
 *     "description_md": "Suggested starter deck from the core set.",
 *     "user_id": 1,
 *     "hero_code": "01040a",
 *     "hero_name": "Black Panther",
 *     "slots": { "01041": 1, "01042": 1, "01043a": 1, ..., "01043d": 2, "01044": 3, ... },
 *     "ignoreDeckLimitSlots": null,
 *     "version": "1.0",
 *     "meta": "{\"aspect\":\"protection\"}",
 *     "tags": "beginner"
 *   }
 *
 * Two quirks observed live, both left for the fetching side (the dev/preview
 * proxy) rather than this pure parser to handle:
 *  - An unknown `decklist` id answers HTTP 200 with an **empty, non-JSON**
 *    body rather than a 404 or an error payload.
 *  - An unknown or private `deck` id answers with a redirect to `/login`
 *    (whose target, followed, is an HTML page, not JSON).
 * Both mean "there is nothing to parse here", which is `invalid_input` from
 * `parseMarvelCdbDeckJsonText` once such a body reaches it — this module's
 * job starts once *some* text has arrived, not with deciding whether the
 * fetch succeeded.
 *
 * `hero_code` and every `slots` key are MarvelCDB card codes, and `@mc/content`
 * brands its own `CardId` directly from that code (`normalize.ts`) — so no
 * translation table is needed, only a pool lookup. That assumption is asserted
 * against real Core data in this module's test rather than just trusted.
 */
import type { AnyCard } from "../schema/cards/index.js";
import type { CoreAspect } from "../schema/aspects.js";
import type { CardId } from "../schema/ids.js";
import type { DeckCardEntry } from "../schema/decks.js";
import { indexById } from "./pool-index.js";
import {
  MAX_IMPORT_LINES,
  MAX_IMPORT_TEXT_LENGTH,
  MAX_LINE_QUANTITY,
  type ImportProblem,
  type ImportResult,
} from "./types.js";

export interface MarvelCdbDeckJson {
  readonly id: number;
  readonly name: string;
  readonly hero_code: string;
  readonly hero_name?: string | null;
  readonly slots: Readonly<Record<string, number>>;
  readonly meta?: string | null;
  readonly problem?: string | null;
}

const problem = (code: ImportProblem["code"], message: string, cardIds?: readonly CardId[]): ImportProblem => ({
  code,
  message,
  ...(cardIds ? { cardIds } : {}),
});

/**
 * Every `meta`-string key that names a chosen aspect, in ascending key order.
 * MarvelCDB records a single-aspect deck's choice as `{"aspect":"protection"}`;
 * this also accepts `aspect_1`, `aspect_2`, … for a deck built with more than
 * one (RRG 1.8 identities with `IdentityDeckbuilding.aspectCount > 1`), the
 * same numbering convention the ThronesDB-family sites use elsewhere in this
 * API for multi-valued meta fields. Unrecognized string values are passed
 * through as-is (as `CoreAspect` is a branded string) rather than filtered —
 * whether a value is a *legal* aspect is `validateDeck`'s question, not this
 * parser's; a nonsense aspect string still deserves a specific, traceable
 * "not a real aspect" message from the engine rather than silently vanishing
 * here.
 */
function aspectsFromMeta(meta: string | null | undefined): readonly string[] {
  if (!meta) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(meta);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const entries = Object.entries(parsed as Record<string, unknown>)
    .filter(([key, value]) => /^aspect(_\d+)?$/i.test(key) && typeof value === "string" && value.length > 0)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  return entries.map(([, value]) => (value as string).toLowerCase());
}

/**
 * Parses an already-`JSON.parse`d MarvelCDB deck/decklist response (or a
 * plain object built by a test) into `DeckContents`. Every problem is
 * collected before returning — malformed input never yields a half-built
 * deck.
 */
export function parseMarvelCdbDeckJson(raw: unknown, pool: readonly AnyCard[]): ImportResult {
  const problems: ImportProblem[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      problems: [problem("invalid_input", "This does not look like a MarvelCDB deck: expected a JSON object.")],
    };
  }
  const data = raw as Partial<MarvelCdbDeckJson>;

  if (typeof data.problem === "string" && data.problem.length > 0) {
    return {
      ok: false,
      problems: [problem("invalid_input", `MarvelCDB reports a problem with this deck: ${data.problem}`)],
    };
  }
  if (typeof data.hero_code !== "string" || data.hero_code.length === 0) {
    problems.push(problem("missing_identity", "This deck has no hero_code, so no identity can be determined."));
  }
  if (!data.slots || typeof data.slots !== "object" || Array.isArray(data.slots)) {
    return {
      ok: false,
      problems: [...problems, problem("invalid_input", "This deck has no card list (`slots`).")],
    };
  }
  const slotEntries = Object.entries(data.slots as Record<string, unknown>);
  if (slotEntries.length > MAX_IMPORT_LINES) {
    return {
      ok: false,
      problems: [
        problem(
          "oversized_input",
          `This deck lists ${slotEntries.length} different cards, more than the ${MAX_IMPORT_LINES} this importer accepts.`,
        ),
      ],
    };
  }

  const cardsById = indexById(pool);
  const heroName = typeof data.hero_name === "string" ? data.hero_name : null;

  let identityCardId: CardId | null = null;
  if (typeof data.hero_code === "string" && data.hero_code.length > 0) {
    const identityCard = cardsById.get(data.hero_code);
    if (!identityCard) {
      problems.push(
        problem("unknown_identity", `The identity card code "${data.hero_code}" is not in the card pool.`, [
          data.hero_code as CardId,
        ]),
      );
    } else if (identityCard.type !== "hero_identity") {
      problems.push(
        problem(
          "not_an_identity",
          `"${data.hero_code}" (${identityCard.name}) is a ${identityCard.type.replace(/_/g, " ")} card, not a hero identity.`,
          [identityCard.id],
        ),
      );
    } else {
      identityCardId = identityCard.id;
    }
  }

  const cards: DeckCardEntry[] = [];
  const seen = new Set<string>();
  for (const [code, rawQuantity] of slotEntries) {
    if (seen.has(code)) {
      problems.push(problem("duplicate_line", `Card code "${code}" is listed more than once.`, [code as CardId]));
      continue;
    }
    seen.add(code);
    if (!Number.isInteger(rawQuantity) || (rawQuantity as number) < 1 || (rawQuantity as number) > MAX_LINE_QUANTITY) {
      problems.push(
        problem(
          "invalid_quantity",
          `Card code "${code}" is listed with quantity ${JSON.stringify(rawQuantity)}, which is not a whole number between 1 and ${MAX_LINE_QUANTITY}.`,
          [code as CardId],
        ),
      );
      continue;
    }
    const card = cardsById.get(code);
    if (!card) {
      problems.push(problem("unknown_card", `Card code "${code}" is not in the card pool.`, [code as CardId]));
      continue;
    }
    cards.push({ cardId: card.id, quantity: rawQuantity as number });
  }

  const aspects = aspectsFromMeta(data.meta);
  if (aspects.length === 0) {
    problems.push(problem("missing_aspect", "This decklist records no chosen aspect."));
  }

  if (problems.length > 0 || !identityCardId) {
    return { ok: false, problems };
  }
  // Arbitrary strings, deliberately: whether a value is one of the five
  // legal aspects is `validateDeck`'s `aspect_choice` check, not this parser's.
  return { ok: true, heroName, contents: { identityCardId, aspects: aspects as CoreAspect[], cards } };
}

/**
 * Parses raw response text (what a fetch actually returns) rather than an
 * already-parsed object: guards input size and JSON well-formedness before
 * `parseMarvelCdbDeckJson` ever sees it, which is also where the "empty body"
 * / "redirected to an HTML login page" upstream quirks noted above resolve to
 * one clear `invalid_input` message instead of a JSON.parse crash.
 */
export function parseMarvelCdbDeckJsonText(text: string, pool: readonly AnyCard[]): ImportResult {
  if (text.length === 0) {
    return { ok: false, problems: [{ code: "invalid_input", message: "MarvelCDB has no deck at that URL or id." }] };
  }
  if (text.length > MAX_IMPORT_TEXT_LENGTH) {
    return {
      ok: false,
      problems: [
        {
          code: "oversized_input",
          message: `This response is ${text.length} characters, more than the ${MAX_IMPORT_TEXT_LENGTH} this importer accepts.`,
        },
      ],
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      problems: [
        {
          code: "invalid_input",
          message:
            "MarvelCDB did not return a deck (the response was not JSON — the id may be wrong, or the deck may be private).",
        },
      ],
    };
  }
  return parseMarvelCdbDeckJson(parsed, pool);
}
