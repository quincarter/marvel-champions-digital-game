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
import type { CardId } from "../schema/ids.js";
import { CATALOG_REPRINTS } from "../data/catalog.js";
import {
  cardMatchesToken,
  describeCandidates,
  indexByName,
  normalizeName,
  resolveTitleCopies,
  splitTitleSuffix,
} from "./pool-index.js";
import {
  MAX_IMPORT_LINES,
  MAX_IMPORT_TEXT_LENGTH,
  MAX_LINE_QUANTITY,
  type ImportNote,
  type ImportProblem,
  type ImportResult,
} from "./types.js";

const problem = (code: ImportProblem["code"], message: string, cardIds?: readonly CardId[]): ImportProblem => ({
  code,
  message,
  ...(cardIds ? { cardIds } : {}),
});

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
  readonly lineNumber?: number;
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

/** `Deck name: Stolen Thunder!`, `Name: …`, `Title: …`: the deck's own name, when the export carries one. */
const NAME_LINE = /^\s*(?:deck\s*name|deck\s*title|name|title)\s*:\s*(.+?)\s*$/i;
/** Summary/metadata lines a text export prints (`Deck Size: 40`, `Total Cards: 40`): informational, never cards. */
const META_LINE =
  /^\s*(?:deck\s*size|total(?:\s*cards)?|cards?|size|deck|pack|packs|set|sets|author|source|url|link|description|notes?|date|version|created|updated|tags?)\s*:/i;
/** Comment and rule lines: `# Hero`, `// notes`, `-----`, `=====`, `**Hero**`. */
const COMMENT_LINE = /^\s*(?:#|\/\/|--|==|\*\*|>)/;
/**
 * Section names a text export prints between card groups. A bare line made of one of these (optionally with a
 * `(14)` count or a trailing colon) is a header, not a card.
 */
const SECTION_WORDS = new Set([
  "hero",
  "hero cards",
  "basic",
  "basic cards",
  "aggression",
  "justice",
  "leadership",
  "protection",
  "pool",
  "determination",
  "aspect",
  "aspect cards",
  "event",
  "events",
  "ally",
  "allies",
  "upgrade",
  "upgrades",
  "support",
  "supports",
  "resource",
  "resources",
  "obligation",
  "obligations",
  "nemesis",
  "nemesis set",
  "signature",
  "signature cards",
  "campaign",
  "campaign cards",
  "other",
  "other cards",
  "cards",
  "deck",
  "main deck",
  "identity",
  "sideboard",
]);
const COUNT_SUFFIX = /\s*\(\s*\d+(?:\s*cards?)?\s*\)\s*$/i;

function isSectionHeader(line: string): boolean {
  const bare = line
    .trim()
    .replace(COUNT_SUFFIX, "")
    .replace(/\s*:\s*$/, "")
    .trim()
    .toLowerCase();
  return SECTION_WORDS.has(bare);
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

  const names = indexByName(pool);
  const notes: ImportNote[] = [];
  let deckName: string | null = null;
  let seenContent = false;

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const hero = HERO_LINE.exec(line);
    if (hero) {
      heroName = hero[1]!;
      seenContent = true;
      continue;
    }
    const aspect = ASPECT_LINE.exec(line);
    if (aspect) {
      aspects.push(...splitAspects(aspect[1]!));
      seenContent = true;
      continue;
    }
    const named = NAME_LINE.exec(line);
    if (named) {
      deckName ??= named[1]!;
      continue;
    }
    if (META_LINE.test(line) || COMMENT_LINE.test(line) || isSectionHeader(trimmed)) continue;
    const card = parseLine(line);
    if (card) {
      cardLines.push({ ...card, lineNumber: index + 1 });
      seenContent = true;
      continue;
    }
    // No quantity: the common convention is a bare card name meaning one copy.
    if ((names.get(normalizeName(trimmed)) ?? []).some((c) => c.type !== "hero_identity")) {
      cardLines.push({ raw: trimmed, quantityText: "1", name: trimmed, lineNumber: index + 1 });
      seenContent = true;
      continue;
    }
    // The first line of a text export is often the decklist's own title ("Stolen Thunder!", "Storm (Justice)").
    if (!seenContent && deckName === null) {
      deckName = trimmed;
      continue;
    }
    notes.push({ code: "unreadable_line", message: `Could not read line ${index + 1}: ${trimmed}` });
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

  const byName = names;
  let identityCard: AnyCard | null = null;
  if (heroName) {
    const isIdentity = (card: AnyCard) => card.type === "hero_identity";
    let candidates = (byName.get(normalizeName(heroName)) ?? []).filter(isIdentity);
    // `Hero: Spider-Man (27030a)`: a code or pack suffix picks one of several identities sharing a name.
    const suffix = candidates.length === 0 ? splitTitleSuffix(heroName) : null;
    if (suffix) {
      const titled = (byName.get(normalizeName(suffix.title)) ?? []).filter(isIdentity);
      const picked = titled.filter((card) => cardMatchesToken(card, suffix.token));
      candidates = picked.length > 0 ? picked : titled;
      heroName = suffix.title;
    }
    if (candidates.length > 1) {
      // Two heroes can share a name (both Spider-Men): the identity whose own set has the most of this list's titles.
      const listed = new Set(cardLines.map((line) => normalizeName(splitTitleSuffix(line.name)?.title ?? line.name)));
      const score = (identity: AnyCard) =>
        new Set(
          [...listed].filter((title) =>
            (byName.get(title) ?? []).some((card) => "aspect" in card && card.aspect === `hero:${identity.id}`),
          ),
        ).size;
      const scored = candidates.map((card) => [card, score(card)] as const).sort((x, y) => y[1] - x[1]);
      if (scored[0]![1] > 0 && scored[0]![1] > scored[1]![1]) candidates = [scored[0]![0]];
    }
    if (candidates.length === 0) {
      problems.push(problem("unknown_identity", `No hero identity named "${heroName}" is in the card pool.`));
    } else if (candidates.length > 1) {
      problems.push(
        problem(
          "ambiguous_card_name",
          `More than one hero identity is named "${heroName}": ${describeCandidates(candidates)}. Write the one you mean with its code, like "Hero: ${heroName} (${candidates[0]!.id})", or import by MarvelCDB id.`,
          candidates.map((card) => card.id),
        ),
      );
    } else {
      identityCard = candidates[0]!;
    }
  }

  const context = { identity: identityCard, aspects };
  const merged = new Map<string, { quantity: number; raw: string; name: string }>();
  for (const line of cardLines) {
    const key = normalizeName(line.name);
    const existing = merged.get(key);
    merged.set(key, {
      quantity: (existing?.quantity ?? 0) + Number(line.quantityText),
      raw: line.raw,
      name: line.name,
    });
  }

  const totals = new Map<string, number>();
  const addCard = (cardId: string, quantity: number) => totals.set(cardId, (totals.get(cardId) ?? 0) + quantity);
  for (const [key, { quantity, raw, name }] of merged) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      problems.push(
        problem(
          "invalid_quantity",
          `"${raw}" lists a quantity of ${quantity}, which is not a whole number between 1 and ${MAX_LINE_QUANTITY}.`,
        ),
      );
      continue;
    }
    // `Title (44002)` / `Title (Deadpool)`: a suffix picks among cards sharing the title. A title that really ends
    // in a parenthetical is matched whole first.
    let matches = byName.get(key) ?? [];
    let suffixed = false;
    let label = name;
    if (matches.length === 0) {
      const suffix = splitTitleSuffix(name);
      if (suffix) {
        const titled = byName.get(normalizeName(suffix.title)) ?? [];
        const picked = titled.filter((card) => cardMatchesToken(card, suffix.token));
        // An unrecognized suffix (a pack name from a MarvelCDB export) just falls back to the bare title.
        matches = picked.length > 0 ? picked : titled;
        suffixed = picked.length > 0;
        label = suffix.title;
      }
    }
    // A pasted name could also name the identity itself (some exports repeat
    // it in the card section) or an encounter card sharing a title; that's
    // left for `validateDeck` (`identity_in_deck` / `not_a_player_card`) —
    // this parser's job is only to resolve the name to a card at all.
    if (matches.length === 0) {
      problems.push(problem("unknown_card", `No card named "${raw}" is in the card pool.`));
      continue;
    }
    if (matches.length === 1) {
      addCard(matches[0]!.id, quantity);
      continue;
    }
    const split = resolveTitleCopies(matches, quantity, context, CATALOG_REPRINTS);
    if (!split) {
      const candidates = matches.filter((card) => card.type !== "hero_identity" && "aspect" in card);
      problems.push(
        problem(
          "ambiguous_card_name",
          `"${label}" is printed as ${matches.length} different cards and this decklist doesn't say which one${suffixed ? " (even with that pack)" : ""}: ${describeCandidates(candidates.length > 0 ? candidates : matches)}. Write the one you mean with its code, like "${quantity}x ${label} (${(candidates[0] ?? matches[0]!).id})", or import by MarvelCDB id.`,
          matches.map((card) => card.id),
        ),
      );
      continue;
    }
    for (const [cardId, qty] of split) addCard(cardId, qty);
  }
  const cards: DeckCardEntry[] = [...totals].map(([cardId, quantity]) => ({ cardId: cardId as CardId, quantity }));

  if (problems.length > 0 || !identityCard) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    heroName,
    deckName,
    contents: { identityCardId: identityCard.id, aspects: aspects as CoreAspect[], cards },
    ...(notes.length > 0 ? { notes } : {}),
  };
}
