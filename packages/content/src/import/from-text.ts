/**
 * A pasted decklist, parsed with no network and no proxy — the fallback PLAN.md
 * Phase 9 requires to exist regardless of MarvelCDB's availability, and the
 * only import path that works offline or from a packaged build.
 *
 * **Format note.** MarvelCDB's own "Export Text" button renders its output
 * client-side from already-loaded card data rather than serving it from a
 * fetchable endpoint, so this build could not confirm its exact bytes live
 * (no browser available to this pass — flagged for the integrating session to
 * check against a real export and adjust the two regexes below if needed).
 * What is implemented instead is the shape every MarvelCDB-family export and
 * every plain hand-typed decklist this author has seen actually has in
 * common, documented here rather than assumed silently:
 *
 *   - Header lines naming the identity and aspect(s), e.g. `Hero: Spider-Man`
 *     or `Identity: Spider-Man`, and `Aspect: Justice` (a multi-aspect deck
 *     may repeat the line, or separate names with "and"/",").
 *   - Card lines as a quantity and a name, `2x Web-Shooter`, `2 Web-Shooter`,
 *     or the quantity trailing, `Web-Shooter x2`.
 *   - Group header lines with no leading quantity, e.g. `Aggression (15)` or
 *     `Basic`, and a trailing `Deck Size: 40` summary line. None of these
 *     match the card-line shape (a card line always *starts* with its
 *     quantity, or trails it after an explicit `x`), so they're ignored
 *     without special-casing them by name. A `Name (Count)` parenthetical
 *     trailing form is deliberately NOT accepted as a card line for the same
 *     reason: it is exactly how a group header is printed, and guessing which
 *     one a line is would risk a silently wrong quantity.
 *
 * Cards are named by *title*, not by code, which is a real ambiguity this
 * parser has to resolve honestly rather than guess through: Core's four
 * "Wakanda Forever!" codes share one title. `splitByQuantityInSet` resolves
 * that the only way that isn't a guess — by the identity set's own printed
 * makeup — and refuses (rather than picks one) when a title can't be resolved
 * that way.
 */
import type { AnyCard } from "../schema/cards/index.js";
import type { CoreAspect } from "../schema/aspects.js";
import type { DeckCardEntry } from "../schema/decks.js";
import { indexByName, normalizeName, splitByQuantityInSet } from "./pool-index.js";
import {
  MAX_IMPORT_LINES,
  MAX_IMPORT_TEXT_LENGTH,
  MAX_LINE_QUANTITY,
  type ImportProblem,
  type ImportResult,
} from "./types.js";

const problem = (code: ImportProblem["code"], message: string): ImportProblem => ({ code, message });

const HERO_LINE = /^\s*(?:hero|identity)\s*:\s*(.+?)\s*$/i;
const ASPECT_LINE = /^\s*aspect\s*:\s*(.+?)\s*$/i;
/** `2x Card Name`, `2 Card Name`, `x2 Card Name`. Quantity leads, so a group header like `Aggression (15)` never matches. */
const LEADING_QTY = /^\s*[xX]?\s*([+-]?\d+)\s*[xX]?\s+(.+?)\s*$/;
/**
 * `Card Name x2`. Deliberately not `Card Name (2)`: that shape is
 * indistinguishable from a group header printed the same way (`Justice (14)`,
 * `Hero (5)`), and guessing which one a line is would risk exactly the "half
 * a real card, half a section total" deck this parser exists to refuse.
 */
const TRAILING_QTY = /^\s*(.+?)\s*[xX]\s*([+-]?\d+)\s*$/;

interface CardLine {
  readonly raw: string;
  readonly quantityText: string;
  readonly name: string;
}

/** Splits an aspect header's value on "and"/",", so `Aspect: Aggression and Justice` reads as two aspects. */
function splitAspects(value: string): readonly string[] {
  return value
    .split(/\s*(?:,|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.toLowerCase());
}

function parseLine(line: string): CardLine | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  const leading = LEADING_QTY.exec(trimmed);
  if (leading) return { raw: trimmed, quantityText: leading[1]!, name: leading[2]! };
  const trailing = TRAILING_QTY.exec(trimmed);
  if (trailing) return { raw: trimmed, quantityText: trailing[2]!, name: trailing[1]! };
  return null;
}

export function parseDecklistText(text: string, pool: readonly AnyCard[]): ImportResult {
  if (text.trim().length === 0) {
    return { ok: false, problems: [problem("invalid_input", "Paste a decklist first.")] };
  }
  if (text.length > MAX_IMPORT_TEXT_LENGTH) {
    return {
      ok: false,
      problems: [
        problem(
          "oversized_input",
          `That decklist is ${text.length} characters, more than the ${MAX_IMPORT_TEXT_LENGTH} this importer accepts.`,
        ),
      ],
    };
  }
  const lines = text.split(/\r?\n/);
  if (lines.length > MAX_IMPORT_LINES) {
    return {
      ok: false,
      problems: [
        problem(
          "oversized_input",
          `That decklist has ${lines.length} lines, more than the ${MAX_IMPORT_LINES} this importer accepts.`,
        ),
      ],
    };
  }

  const problems: ImportProblem[] = [];
  let heroName: string | null = null;
  const aspects: string[] = [];
  const cardLines: CardLine[] = [];

  for (const line of lines) {
    const hero = HERO_LINE.exec(line);
    if (hero) {
      heroName = hero[1]!;
      continue;
    }
    const aspect = ASPECT_LINE.exec(line);
    if (aspect) {
      aspects.push(...splitAspects(aspect[1]!));
      continue;
    }
    const card = parseLine(line);
    if (card) cardLines.push(card);
  }

  if (!heroName) {
    problems.push(
      problem("missing_identity", 'No "Hero:" or "Identity:" line was found, so no identity can be determined.'),
    );
  }
  if (aspects.length === 0) {
    problems.push(problem("missing_aspect", 'No "Aspect:" line was found.'));
  }
  if (cardLines.length === 0) {
    problems.push(
      problem("invalid_input", 'No card lines were recognized in this text (expected lines like "2x Web-Shooter").'),
    );
  }

  const byName = indexByName(pool);
  let identityCard: AnyCard | null = null;
  if (heroName) {
    const candidates = (byName.get(normalizeName(heroName)) ?? []).filter((card) => card.type === "hero_identity");
    if (candidates.length === 0) {
      problems.push(problem("unknown_identity", `No hero identity named "${heroName}" is in the card pool.`));
    } else if (candidates.length > 1) {
      problems.push(
        problem(
          "ambiguous_card_name",
          `More than one hero identity is named "${heroName}"; import by MarvelCDB id instead.`,
        ),
      );
    } else {
      identityCard = candidates[0]!;
    }
  }

  const merged = new Map<string, { quantity: number; raw: string }>();
  for (const line of cardLines) {
    const key = normalizeName(line.name);
    const existing = merged.get(key);
    merged.set(key, { quantity: (existing?.quantity ?? 0) + Number(line.quantityText), raw: line.raw });
  }

  const cards: DeckCardEntry[] = [];
  for (const [key, { quantity, raw }] of merged) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      problems.push(
        problem(
          "invalid_quantity",
          `"${raw}" lists a quantity of ${quantity}, which is not a whole number between 1 and ${MAX_LINE_QUANTITY}.`,
        ),
      );
      continue;
    }
    const matches = byName.get(key) ?? [];
    // A pasted name could also name the identity itself (some exports repeat
    // it in the card section) or an encounter card sharing a title; that's
    // left for `validateDeck` (`identity_in_deck` / `not_a_player_card`) —
    // this parser's job is only to resolve the name to a card at all.
    if (matches.length === 0) {
      problems.push(problem("unknown_card", `No card named "${raw}" is in the card pool.`));
      continue;
    }
    if (matches.length === 1) {
      cards.push({ cardId: matches[0]!.id, quantity });
      continue;
    }
    const split = splitByQuantityInSet(matches, quantity);
    if (!split) {
      problems.push(
        problem(
          "ambiguous_card_name",
          `"${matches[0]!.name}" is printed as ${matches.length} different cards (codes ${matches.map((c) => c.id).join(", ")}), and the listed quantity (${quantity}) doesn't match splitting it their printed way; import by MarvelCDB id instead.`,
        ),
      );
      continue;
    }
    for (const [cardId, qty] of split) cards.push({ cardId, quantity: qty });
  }

  if (problems.length > 0 || !identityCard) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    heroName,
    contents: { identityCardId: identityCard.id, aspects: aspects as CoreAspect[], cards },
  };
}
